/* Guardado en la nube (Supabase) para las páginas de MORERO.
 * La página sigue trabajando con los datos del navegador (localStorage) como siempre;
 * este archivo copia esos datos a la nube cada vez que cambian y, al abrir la página
 * en otro equipo (PC o celular), trae la versión más nueva.
 * Necesita nube-config.js con la dirección del proyecto y la clave pública (anon).
 * Si no está configurado, no hace nada.
 */
(function () {
  'use strict';
  var CFG = window.NUBE_CONFIG || {};
  if (!CFG.url || !CFG.clave || !CFG.app) return;
  var URL_BASE = CFG.url.replace(/\/+$/, '');
  var APP = CFG.app;
  var PREFIJO = 'nube.';               // claves propias: no se suben a la nube
  var K_SESION = PREFIJO + 'sesion', K_META = PREFIJO + 'meta';
  var LS = window.localStorage;
  var proto = Storage.prototype, oSet = proto.setItem, oRem = proto.removeItem, oClear = proto.clear;
  var aplicando = false, listo = false, timer = null, subiendo = false;

  function leerJSON(k, d) { try { var v = LS.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function escribirJSON(k, v) { try { oSet.call(LS, k, JSON.stringify(v)); } catch (e) { /* nada */ } }
  function meta() { return leerJSON(K_META, { ultima: '', pendiente: false }); }
  function guardarMeta(m) { escribirJSON(K_META, m); }
  function sesion() { return leerJSON(K_SESION, null); }

  // ---------- Avisar cambios de la página ----------
  function huboCambio() {
    if (aplicando) return;
    var m = meta(); m.pendiente = true; guardarMeta(m);
    estado();
    clearTimeout(timer);
    timer = setTimeout(subir, 3000);
  }
  proto.setItem = function (k, v) { oSet.call(this, k, v); if (this === LS && String(k).indexOf(PREFIJO) !== 0) huboCambio(); };
  proto.removeItem = function (k) { oRem.call(this, k); if (this === LS && String(k).indexOf(PREFIJO) !== 0) huboCambio(); };
  proto.clear = function () {
    if (this !== LS) return oClear.call(this);
    var guardar = {};
    for (var i = 0; i < LS.length; i++) { var k = LS.key(i); if (k.indexOf(PREFIJO) === 0) guardar[k] = LS.getItem(k); }
    oClear.call(this);
    Object.keys(guardar).forEach(function (k) { oSet.call(LS, k, guardar[k]); });
    huboCambio();
  };

  function foto() {
    var d = {};
    for (var i = 0; i < LS.length; i++) {
      var k = LS.key(i);
      if (k.indexOf(PREFIJO) !== 0) d[k] = LS.getItem(k);
    }
    return d;
  }
  function tamanio(d) { return Object.keys(d || {}).reduce(function (t, k) { return t + String(d[k]).length; }, 0); }

  function aplicar(contenido) {
    aplicando = true;
    try {
      var borrar = [];
      for (var i = 0; i < LS.length; i++) { var k = LS.key(i); if (k.indexOf(PREFIJO) !== 0) borrar.push(k); }
      borrar.forEach(function (k) { oRem.call(LS, k); });
      Object.keys(contenido || {}).forEach(function (k) { oSet.call(LS, k, contenido[k]); });
    } finally { aplicando = false; }
  }

  // ---------- Conexión con Supabase ----------
  function pedir(ruta, opciones) {
    opciones = opciones || {};
    var h = { apikey: CFG.clave, 'Content-Type': 'application/json' };
    Object.keys(opciones.headers || {}).forEach(function (k) { h[k] = opciones.headers[k]; });
    return fetch(URL_BASE + ruta, { method: opciones.method || 'GET', headers: h, body: opciones.body ? JSON.stringify(opciones.body) : undefined })
      .then(function (r) {
        return r.text().then(function (t) {
          var j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { j = t; }
          if (!r.ok) { var err = new Error((j && (j.error_description || j.msg || j.message)) || ('Error ' + r.status)); err.status = r.status; throw err; }
          return j;
        });
      });
  }

  function guardarSesion(j) {
    escribirJSON(K_SESION, { access: j.access_token, refresh: j.refresh_token, vence: Date.now() + (j.expires_in || 3600) * 1000, email: j.user && j.user.email });
  }

  function token() {
    var s = sesion();
    if (!s) return Promise.reject(new Error('sin sesión'));
    if (Date.now() < s.vence - 60000) return Promise.resolve(s.access);
    return pedir('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: s.refresh } })
      .then(function (j) { guardarSesion(j); return j.access_token; })
      .catch(function (e) { if (e.status === 400 || e.status === 401) { oRem.call(LS, K_SESION); estado(); } throw e; });
  }

  function conToken(ruta, opciones) {
    return token().then(function (t) {
      opciones = opciones || {};
      opciones.headers = Object.assign({ Authorization: 'Bearer ' + t }, opciones.headers || {});
      return pedir(ruta, opciones);
    });
  }

  function leerNube(soloFecha) {
    return conToken('/rest/v1/datos?app=eq.' + encodeURIComponent(APP) + '&select=' + (soloFecha ? 'actualizado,equipo' : 'contenido,actualizado,equipo'))
      .then(function (filas) { return filas && filas[0] ? filas[0] : null; });
  }

  function equipo() {
    var u = navigator.userAgent;
    return /iPhone|iPad/.test(u) ? 'iPhone/iPad' : /Android/.test(u) ? 'Android' : /Windows/.test(u) ? 'PC Windows' : /Mac/.test(u) ? 'Mac' : 'otro equipo';
  }

  var ultimoError = '';

  function subir(forzar) {
    if (!listo || subiendo || !sesion()) return Promise.resolve();
    var m = meta();
    if (!m.pendiente && !forzar) return Promise.resolve();
    subiendo = true; estado();
    return leerNube(true).then(function (fila) {
      // Si otro equipo guardó después de la última vez que sincronizamos, preguntar.
      if (fila && m.ultima && fila.actualizado !== m.ultima && !forzar) {
        var usarNube = confirm('Los datos de la nube cambiaron desde otro equipo (' + (fila.equipo || '') + ', ' + fechaTxt(fila.actualizado) + ') y en este equipo también hay cambios.\n\n' +
          'Aceptar: traer los de la nube (se pierden los cambios de este equipo).\nCancelar: subir los de este equipo (reemplazan a los de la nube).');
        if (usarNube) { subiendo = false; return bajar(true); }
      }
      return conToken('/rest/v1/datos?on_conflict=usuario,app', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: { app: APP, contenido: foto(), equipo: equipo() }
      }).then(function (filas) {
        var f = filas && filas[0];
        guardarMeta({ ultima: f ? f.actualizado : '', pendiente: false, subido: Date.now() });
        ultimoError = '';
      });
    }).catch(function (e) {
      ultimoError = e.message === 'sin sesión' ? '' : 'No se pudo guardar en la nube (' + e.message + '). Se reintenta solo.';
      clearTimeout(timer); timer = setTimeout(subir, 30000);
    }).then(function () { subiendo = false; estado(); });
  }

  // Trae los datos de la nube y recarga la página.
  function bajar(sinPreguntar) {
    return leerNube(false).then(function (fila) {
      if (!fila) { aviso('Todavía no hay datos en la nube.'); return; }
      if (!sinPreguntar && !confirm('¿Reemplazar los datos de este equipo por los de la nube (' + fechaTxt(fila.actualizado) + ')?')) return;
      aplicar(fila.contenido);
      guardarMeta({ ultima: fila.actualizado, pendiente: false, subido: Date.now() });
      sessionStorage.setItem(PREFIJO + 'recarga', '1');
      location.reload();
    });
  }

  // Al abrir la página: si la nube tiene algo más nuevo, se trae; si no, se sube lo local.
  function sincronizarAlAbrir() {
    if (!sesion()) { listo = true; estado(); return; }
    var m = meta();
    leerNube(false).then(function (fila) {
      listo = true;
      var local = foto();
      if (!fila) { if (tamanio(local)) subir(true); return; }
      if (fila.actualizado === m.ultima) { if (m.pendiente) subir(); return; }
      // La nube es más nueva que lo último que vio este equipo.
      if (!m.pendiente || !tamanio(local) || !m.ultima) {
        if (sessionStorage.getItem(PREFIJO + 'recarga')) { sessionStorage.removeItem(PREFIJO + 'recarga'); guardarMeta({ ultima: fila.actualizado, pendiente: false }); return; }
        aplicar(fila.contenido);
        guardarMeta({ ultima: fila.actualizado, pendiente: false, subido: Date.now() });
        sessionStorage.setItem(PREFIJO + 'recarga', '1');
        location.reload();
        return;
      }
      subir();   // hay cambios en los dos lados: subir() pregunta qué hacer
    }).catch(function (e) {
      listo = true;
      ultimoError = 'No se pudo leer la nube (' + e.message + ').';
    }).then(estado);
    sessionStorage.removeItem(PREFIJO + 'recarga');
  }

  // Al volver a la pestaña, ver si otro equipo guardó algo.
  document.addEventListener('visibilitychange', function () {
    if (document.hidden || !listo || !sesion()) return;
    var m = meta();
    if (m.pendiente) { subir(); return; }
    leerNube(true).then(function (fila) {
      if (fila && m.ultima && fila.actualizado !== m.ultima) {
        aviso('Hay datos más nuevos en la nube (' + (fila.equipo || 'otro equipo') + '). Actualizando…');
        setTimeout(function () { bajar(true); }, 800);
      }
    }).catch(function () { /* sin conexión */ });
  });
  window.addEventListener('beforeunload', function (e) {
    if (meta().pendiente && sesion()) { subir(); e.preventDefault(); e.returnValue = ''; }
  });

  // ---------- Pantalla ----------
  function fechaTxt(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    return d.toLocaleDateString('es-AR') + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  var css = '' +
    '.nube-boton{position:fixed;left:12px;bottom:12px;z-index:900;display:flex;align-items:center;gap:6px;padding:7px 12px;border-radius:999px;border:1px solid #ccc;background:#fff;color:#5B5B5F;font:600 13px system-ui,sans-serif;box-shadow:0 2px 10px rgba(0,0,0,.15);cursor:pointer}' +
    '.nube-boton .p{width:9px;height:9px;border-radius:50%;background:#999}' +
    '.nube-boton.ok .p{background:#2e7d32}.nube-boton.pend .p{background:#e6a100}.nube-boton.mal .p{background:#8F131C}' +
    '.nube-dlg{border:none;border-radius:12px;padding:0;width:min(420px,calc(100vw - 32px));box-shadow:0 10px 40px rgba(0,0,0,.3);font:15px system-ui,sans-serif;color:#222}' +
    '.nube-dlg::backdrop{background:rgba(0,0,0,.35)}' +
    '.nube-dlg form{padding:18px 18px 14px;display:flex;flex-direction:column;gap:10px}' +
    '.nube-dlg h3{margin:0;color:#8F131C;font-size:18px}' +
    '.nube-dlg p{margin:0;color:#5B5B5F;font-size:14px;line-height:1.4}' +
    '.nube-dlg label{display:flex;flex-direction:column;gap:4px;font-weight:600;font-size:14px}' +
    '.nube-dlg input{font:inherit;padding:9px 10px;border:1px solid #bbb;border-radius:8px}' +
    '.nube-dlg .b{display:flex;flex-wrap:wrap;gap:8px;justify-content:flex-end;margin-top:4px}' +
    '.nube-dlg button{font:600 14px system-ui,sans-serif;padding:9px 14px;border-radius:8px;border:1px solid #8F131C;background:#fff;color:#8F131C;cursor:pointer}' +
    '.nube-dlg button.pri{background:#8F131C;color:#fff}' +
    '.nube-dlg .err{color:#8F131C;font-weight:600}' +
    '.nube-aviso{position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:1000;background:#5B5B5F;color:#fff;padding:10px 16px;border-radius:8px;font:14px system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.25);max-width:calc(100vw - 32px)}' +
    '@media print{.nube-boton,.nube-aviso{display:none!important}}';

  var boton, dlg;
  function aviso(t) {
    var a = document.createElement('div');
    a.className = 'nube-aviso'; a.textContent = t;
    (document.querySelector('dialog[open]') || document.body).appendChild(a);
    setTimeout(function () { a.remove(); }, 4000);
  }

  function estado() {
    if (!boton) return;
    var s = sesion(), m = meta();
    boton.className = 'nube-boton ' + (!s ? 'mal' : ultimoError ? 'mal' : (m.pendiente || subiendo) ? 'pend' : 'ok');
    boton.innerHTML = '<span class="p"></span>' + (!s ? 'Nube: entrar' : ultimoError ? 'Nube: sin conexión' : (m.pendiente || subiendo) ? 'Guardando en la nube…' : 'Guardado en la nube');
    boton.title = !s ? 'Tocá para entrar y guardar los datos en la nube' : ultimoError || (m.ultima ? 'Último guardado: ' + fechaTxt(m.ultima) : '');
  }

  function abrirPanel() {
    var s = sesion(), m = meta();
    if (!s) {
      dlg.innerHTML = '<form><h3>Guardar en la nube</h3>' +
        '<p>Entrá con tu correo y contraseña de MORERO. Los datos se guardan en la nube y se ven iguales en la PC y en el celular.</p>' +
        '<label>Correo <input type="email" name="email" autocomplete="username" required></label>' +
        '<label>Contraseña <input type="password" name="clave" autocomplete="current-password" required></label>' +
        '<p class="err" hidden></p>' +
        '<div class="b"><button type="button" data-n="cerrar">Cancelar</button><button class="pri" type="submit">Entrar</button></div></form>';
      dlg.querySelector('form').addEventListener('submit', function (e) {
        e.preventDefault();
        var f = e.target, err = f.querySelector('.err');
        err.hidden = true;
        pedir('/auth/v1/token?grant_type=password', { method: 'POST', body: { email: f.email.value.trim(), password: f.clave.value } })
          .then(function (j) {
            guardarSesion(j);
            dlg.close();
            aviso('Listo: conectado a la nube.');
            listo = false;
            sincronizarAlAbrir();
          })
          .catch(function (e2) { err.textContent = /invalid/i.test(e2.message) ? 'Correo o contraseña incorrectos.' : 'No se pudo entrar: ' + e2.message; err.hidden = false; });
      });
    } else {
      dlg.innerHTML = '<form><h3>Datos en la nube</h3>' +
        '<p>Conectado como <b>' + esc(s.email || '') + '</b>.</p>' +
        '<p>' + (m.pendiente ? 'Hay cambios esperando para subir.' : m.ultima ? 'Todo guardado. Último guardado: <b>' + esc(fechaTxt(m.ultima)) + '</b>.' : 'Todavía no se subió nada.') + '</p>' +
        (ultimoError ? '<p class="err">' + esc(ultimoError) + '</p>' : '') +
        '<p>Los cambios se suben solos. Al abrir la página en otro equipo, trae lo último.</p>' +
        '<div class="b"><button type="button" data-n="salir">Cerrar sesión</button><button type="button" data-n="bajar">Traer de la nube</button>' +
        '<button type="button" class="pri" data-n="subir">Guardar ahora</button></div>' +
        '<div class="b"><button type="button" data-n="cerrar">Cerrar</button></div></form>';
    }
    dlg.showModal();
  }

  function montar() {
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    boton = document.createElement('button');
    boton.type = 'button';
    boton.addEventListener('click', abrirPanel);
    document.body.appendChild(boton);
    dlg = document.createElement('dialog');
    dlg.className = 'nube-dlg';
    dlg.addEventListener('click', function (e) {
      var b = e.target.closest('[data-n]');
      if (!b) return;
      var n = b.dataset.n;
      if (n === 'cerrar') dlg.close();
      if (n === 'subir') { dlg.close(); subir(true).then(function () { aviso(ultimoError || 'Guardado en la nube.'); }); }
      if (n === 'bajar') { dlg.close(); bajar(false).catch(function (e2) { aviso('No se pudo leer la nube: ' + e2.message); }); }
      if (n === 'salir') {
        if (meta().pendiente && !confirm('Hay cambios sin subir. ¿Cerrar sesión igual?')) return;
        oRem.call(LS, K_SESION); dlg.close(); estado(); aviso('Sesión cerrada. Los datos siguen en este equipo.');
      }
    });
    document.body.appendChild(dlg);
    estado();
    sincronizarAlAbrir();
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* nada */ }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar);
  else montar();
})();
