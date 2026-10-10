/* Stock de Semillas · MORERO Semillas y Cereales S.A.
   Todo se guarda en el navegador (localStorage). No hay servidor. */
(function () {
  'use strict';

  var CLAVE = 'morero_stock_v1';
  var GRANOS = ['Girasol', 'Maíz', 'Sorgo'];
  var BANDAS = ['Banda 1', 'Banda 2', 'Banda 3', 'Sin banda'];
  var TIPOS_INGRESO = ['Existencia inicial campaña', 'Compra', 'Pedido', 'Mercadería consignada'];
  var DEVOL = 'Devolución de cliente';
  // En el formulario de ventas también se cargan las devoluciones (que suman stock).
  var TIPOS_SALIDA = ['Venta', 'Reserva', 'Pedido de cliente', DEVOL];
  // Códigos de operación de Algoritmo
  var DOCS = {
    FAC: { nombre: 'Factura', tipo: 'Venta' },
    REM: { nombre: 'Remito', tipo: 'Venta' },
    PED: { nombre: 'Pedido', tipo: 'Pedido de cliente' },
    RDE: { nombre: 'Devolución', tipo: DEVOL }
  };

  // ---------- Datos ----------
  var db = cargar();

  function vacio() { return { hibridos: [], clientes: [], movimientos: [] }; }

  function cargar() {
    try {
      var txt = localStorage.getItem(CLAVE);
      if (!txt) return vacio();
      var d = JSON.parse(txt);
      return {
        hibridos: Array.isArray(d.hibridos) ? d.hibridos : [],
        clientes: Array.isArray(d.clientes) ? d.clientes : [],
        movimientos: Array.isArray(d.movimientos) ? d.movimientos : []
      };
    } catch (e) {
      return vacio();
    }
  }

  function guardar() {
    invalidar();
    try {
      localStorage.setItem(CLAVE, JSON.stringify(db));
      return true;
    } catch (e) {
      aviso('No se pudo guardar en el navegador. Bajá una copia de seguridad.', true);
      return false;
    }
  }

  function nuevoId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  // ---------- Utilidades ----------
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Quita acentos y pasa a minúsculas, para buscar y comparar.
  function norm(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }

  function num(n) {
    return Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 });
  }

  function precioTxt(m) {
    if (m.precio == null || m.precio === '') return '';
    var s = m.moneda === 'ARS' ? '$ ' : 'US$ ';
    return s + Number(m.precio).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fechaTxt(iso) {
    if (!iso) return '';
    var p = iso.split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : iso;
  }

  function hoy() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var dd = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + dd;
  }

  var timerAviso;
  function aviso(msg, error) {
    var t = $('#toast');
    t.textContent = msg;
    t.className = 'toast ver' + (error ? ' error' : '');
    clearTimeout(timerAviso);
    timerAviso = setTimeout(function () { t.className = 'toast'; }, 3500);
  }

  function hibrido(id) { return db.hibridos.find(function (h) { return h.id === id; }); }
  function cliente(id) { return db.clientes.find(function (c) { return c.id === id; }); }

  function nombreHibrido(h) { return h ? h.semillero + ' · ' + h.hibrido : '(híbrido borrado)'; }

  function ordenarHibridos(lista) {
    return lista.slice().sort(function (a, b) {
      return GRANOS.indexOf(a.grano) - GRANOS.indexOf(b.grano) ||
        a.semillero.localeCompare(b.semillero, 'es') ||
        a.hibrido.localeCompare(b.hibrido, 'es');
    });
  }

  function opciones(sel, lista, primera) {
    sel.innerHTML = (primera ? '<option value="">' + esc(primera) + '</option>' : '') +
      lista.map(function (v) { return '<option>' + esc(v) + '</option>'; }).join('');
  }

  function claseDe(tipo) { return TIPOS_INGRESO.indexOf(tipo) >= 0 || tipo === DEVOL ? 'ingreso' : 'salida'; }
  // Las devoluciones de clientes se ven y se cargan en «Ventas».
  function enVentas(m) { return m.clase === 'salida' || m.tipo === DEVOL; }

  function movPorId(id) { return id ? db.movimientos.find(function (m) { return m.id === id; }) : null; }

  // Código de la operación: el de Algoritmo, o uno equivalente para lo cargado a mano.
  function docDe(m) {
    if (!m) return '';
    if (m.doc) return m.doc;
    if (m.tipo === 'Venta') return 'FAC';
    if (m.tipo === 'Pedido de cliente' || m.tipo === 'Reserva') return 'PED';
    return '';
  }

  // Un pedido, sus remitos y su factura forman una sola operación (mismo «grupo»).
  // El stock se descuenta una sola vez: lo mayor entre lo pedido, lo remitido y lo facturado.
  function claveGrupo(m) { return m.grupo || m.id; }
  function agrupable(m) { return m.clase === 'salida' && !!docDe(m); }

  var cache = null;
  function invalidar() { cache = null; }

  function calcularGrupos() {
    if (cache) return cache;
    var grupos = {}, efectos = {};
    db.movimientos.forEach(function (m) {
      if (!agrupable(m)) return;
      var k = claveGrupo(m);
      (grupos[k] = grupos[k] || { miembros: [] }).miembros.push(m);
    });
    Object.keys(grupos).forEach(function (k) {
      var g = grupos[k];
      g.miembros.sort(function (a, b) { return (a.fecha || '').localeCompare(b.fecha || '') || (a.creado || 0) - (b.creado || 0); });
      g.PED = 0; g.REM = 0; g.FAC = 0;
      var antes = 0;
      g.miembros.forEach(function (m) {
        g[docDe(m)] += Number(m.cantidad || 0);
        var ahora = Math.max(g.PED, g.REM, g.FAC);
        efectos[m.id] = ahora - antes;
        antes = ahora;
      });
      g.aRemitir = Math.max(0, Math.max(g.PED, g.FAC) - g.REM);
      // El saldo a remitir se muestra en el primer pedido o factura de la operación.
      var raiz = g.miembros.find(function (m) { return docDe(m) !== 'REM'; });
      g.raizId = raiz ? raiz.id : '';
    });
    cache = { grupos: grupos, efectos: efectos };
    return cache;
  }

  function grupoDe(m) { return agrupable(m) ? calcularGrupos().grupos[claveGrupo(m)] : null; }

  // Bolsas que la operación mueve en el stock (lo ya contado en el pedido, remito o factura no se cuenta dos veces).
  function efecto(m) {
    var e = agrupable(m) ? calcularGrupos().efectos[m.id] : undefined;
    return e === undefined ? Number(m.cantidad || 0) : e;
  }

  // Otras operaciones vinculadas a esta.
  function hijos(m) {
    var g = grupoDe(m);
    return g ? g.miembros.filter(function (x) { return x.id !== m.id; }) : [];
  }

  // Saldo a remitir de la operación (null si esta fila no lo muestra).
  function aRemitir(m) {
    var g = grupoDe(m);
    return g && g.raizId === m.id ? g.aRemitir : null;
  }

  function nombreDoc(m) {
    var d = DOCS[docDe(m)];
    return (m.doc && d ? d.nombre : m.tipo) + (m.comprobante ? ' ' + m.comprobante : '') + ' del ' + fechaTxt(m.fecha);
  }

  function textoVinculo(m) {
    var otros = hijos(m);
    if (!otros.length) return '';
    var e = efecto(m), c = Number(m.cantidad || 0);
    return 'Vinculada con ' + otros.map(nombreDoc).join(', ') +
      (e === c ? '' : e ? ' (descuenta ' + num(e) + ' bls.; el resto ya estaba contado)' : ' (no descuenta stock: ya estaba contado)');
  }

  // Stock de un híbrido (opcionalmente de una banda). Ingresos suman, salidas restan.
  function stock(hibridoId, banda, excluirId) {
    return db.movimientos.reduce(function (s, m) {
      if (m.hibridoId !== hibridoId) return s;
      if (banda && m.banda !== banda) return s;
      if (excluirId && m.id === excluirId) return s;
      return s + (m.clase === 'ingreso' ? 1 : -1) * efecto(m);
    }, 0);
  }

  // ---------- Navegación ----------
  function ir(sec) {
    $$('.seccion').forEach(function (s) { s.classList.toggle('activa', s.id === 'sec-' + sec); });
    $$('#menu button').forEach(function (b) { b.classList.toggle('activo', b.dataset.sec === sec); });
    if (sec === 'copia') infoCopia();
    window.scrollTo(0, 0);
  }

  $('#menu').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (b) ir(b.dataset.sec);
  });

  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-ir]');
    if (!a) return;
    e.preventDefault();
    ir(a.dataset.ir);
    if (a.dataset.accion === 'nuevaCompra') abrirMov('ingreso');
    if (a.dataset.accion === 'nuevaVenta') abrirMov('salida');
  });

  $$('[data-cerrar]').forEach(function (b) {
    b.addEventListener('click', function () { b.closest('dialog').close(); });
  });

  // ---------- Render general ----------
  function refrescar() {
    renderInicio();
    renderHibridos();
    renderClientes();
    renderMovs('ingreso');
    renderMovs('salida');
    renderPanelesFiltro();
    $('#lista-semilleros').innerHTML = semilleros().map(function (s) {
      return '<option value="' + esc(s) + '">';
    }).join('');
  }

  function semilleros() {
    var vistos = {};
    db.hibridos.forEach(function (h) { vistos[h.semillero] = true; });
    return Object.keys(vistos).sort(function (a, b) { return a.localeCompare(b, 'es'); });
  }

  function renderInicio() {
    var html = GRANOS.map(function (g) {
      var hs = db.hibridos.filter(function (h) { return h.grano === g; });
      var total = hs.reduce(function (s, h) { return s + stock(h.id); }, 0);
      return '<div class="tarjeta"><div class="t">' + esc(g) + '</div>' +
        '<div class="n' + (total < 0 ? ' neg' : '') + '">' + num(total) + '</div>' +
        '<div class="d">bolsas · ' + hs.length + ' híbridos</div></div>';
    }).join('');
    html += '<div class="tarjeta"><div class="t">Clientes</div><div class="n">' + db.clientes.length +
      '</div><div class="d">' + db.movimientos.length + ' operaciones cargadas</div></div>';
    $('#resumen-inicio').innerHTML = html;
  }

  // ---------- Híbridos ----------
  opciones($('#grano-hibridos'), GRANOS, 'Todos los granos');
  opciones($('#form-hibrido [name=grano]'), GRANOS, 'Elegir…');

  function renderHibridos() {
    var q = norm($('#busca-hibridos').value);
    var g = $('#grano-hibridos').value;
    var lista = ordenarHibridos(db.hibridos).filter(function (h) {
      return (!g || h.grano === g) && (!q || norm(h.semillero + ' ' + h.hibrido).indexOf(q) >= 0);
    });
    var t = $('#tabla-hibridos');
    if (!db.hibridos.length) {
      t.innerHTML = '<tr><td class="vacio">Todavía no hay híbridos. Cargalos con el botón o importá un Excel.</td></tr>';
      return;
    }
    t.innerHTML = '<thead><tr><th>Grano</th><th>Semillero</th><th>Híbrido</th><th class="num">Stock (bolsas)</th><th class="acc"></th></tr></thead><tbody>' +
      (lista.length ? lista.map(function (h) {
        var s = stock(h.id);
        return '<tr><td>' + esc(h.grano) + '</td><td>' + esc(h.semillero) + '</td><td><b>' + esc(h.hibrido) + '</b></td>' +
          '<td class="num' + (s < 0 ? ' neg' : '') + '">' + num(s) + '</td>' +
          '<td class="acc"><button class="mini" data-edit-h="' + h.id + '">Editar</button> ' +
          '<button class="mini borrar" data-del-h="' + h.id + '">Borrar</button></td></tr>';
      }).join('') : '<tr><td colspan="5" class="vacio">No hay coincidencias.</td></tr>') + '</tbody>';
  }

  $('#busca-hibridos').addEventListener('input', renderHibridos);
  $('#grano-hibridos').addEventListener('change', renderHibridos);
  $('#btn-nuevo-hibrido').addEventListener('click', function () { abrirHibrido(); });

  function abrirHibrido(h) {
    var f = $('#form-hibrido');
    f.reset();
    f.uid.value = h ? h.id : '';
    if (h) { f.grano.value = h.grano; f.semillero.value = h.semillero; f.hibrido.value = h.hibrido; }
    $('#tit-hibrido').textContent = h ? 'Editar híbrido' : 'Cargar híbrido';
    $('#dlg-hibrido').showModal();
  }

  $('#form-hibrido').addEventListener('submit', function (e) {
    var f = e.target;
    var datos = { grano: f.grano.value, semillero: f.semillero.value.trim(), hibrido: f.hibrido.value.trim() };
    var repetido = db.hibridos.find(function (h) {
      return h.id !== f.uid.value && h.grano === datos.grano &&
        norm(h.semillero) === norm(datos.semillero) && norm(h.hibrido) === norm(datos.hibrido);
    });
    if (repetido) { e.preventDefault(); aviso('Ese híbrido ya está cargado.', true); return; }
    if (f.uid.value) {
      Object.assign(hibrido(f.uid.value), datos);
      aviso('Híbrido actualizado.');
    } else {
      datos.id = nuevoId();
      db.hibridos.push(datos);
      aviso('Híbrido cargado.');
    }
    guardar();
    refrescar();
  });

  $('#tabla-hibridos').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.editH) abrirHibrido(hibrido(b.dataset.editH));
    if (b.dataset.delH) {
      var id = b.dataset.delH;
      var usos = db.movimientos.filter(function (m) { return m.hibridoId === id; }).length;
      if (usos) { aviso('No se puede borrar: tiene ' + usos + ' operaciones cargadas.', true); return; }
      if (!confirm('¿Borrar el híbrido ' + nombreHibrido(hibrido(id)) + '?')) return;
      db.hibridos = db.hibridos.filter(function (h) { return h.id !== id; });
      guardar();
      refrescar();
      aviso('Híbrido borrado.');
    }
  });

  // ---------- Clientes ----------
  function renderClientes() {
    var q = norm($('#busca-clientes').value);
    var lista = db.clientes.slice().sort(function (a, b) { return a.nombre.localeCompare(b.nombre, 'es'); })
      .filter(function (c) { return !q || norm(c.nombre + ' ' + c.cuit + ' ' + c.localidad).indexOf(q) >= 0; });
    var t = $('#tabla-clientes');
    if (!db.clientes.length) {
      t.innerHTML = '<tr><td class="vacio">Todavía no hay clientes. Cargalos con el botón o importá un Excel.</td></tr>';
      return;
    }
    t.innerHTML = '<thead><tr><th>Nombre</th><th>CUIT</th><th>Localidad</th><th>Teléfono</th><th>Correo</th><th class="acc"></th></tr></thead><tbody>' +
      (lista.length ? lista.map(function (c) {
        return '<tr><td><b>' + esc(c.nombre) + '</b></td><td>' + esc(c.cuit) + '</td><td>' + esc(c.localidad) + '</td>' +
          '<td>' + esc(c.telefono) + '</td><td>' + esc(c.correo) + '</td>' +
          '<td class="acc"><button class="mini" data-edit-c="' + c.id + '">Editar</button> ' +
          '<button class="mini borrar" data-del-c="' + c.id + '">Borrar</button></td></tr>';
      }).join('') : '<tr><td colspan="6" class="vacio">No hay coincidencias.</td></tr>') + '</tbody>';
  }

  $('#busca-clientes').addEventListener('input', renderClientes);
  $('#btn-nuevo-cliente').addEventListener('click', function () { abrirCliente(); });

  function abrirCliente(c) {
    var f = $('#form-cliente');
    f.reset();
    f.uid.value = c ? c.id : '';
    if (c) ['nombre', 'cuit', 'localidad', 'telefono', 'correo'].forEach(function (k) { f[k].value = c[k] || ''; });
    $('#tit-cliente').textContent = c ? 'Editar cliente' : 'Cargar cliente';
    $('#dlg-cliente').showModal();
  }

  $('#form-cliente').addEventListener('submit', function (e) {
    var f = e.target;
    var datos = {};
    ['nombre', 'cuit', 'localidad', 'telefono', 'correo'].forEach(function (k) { datos[k] = f[k].value.trim(); });
    var repetido = db.clientes.find(function (c) { return c.id !== f.uid.value && norm(c.nombre) === norm(datos.nombre); });
    if (repetido) { e.preventDefault(); aviso('Ya hay un cliente con ese nombre.', true); return; }
    if (f.uid.value) {
      Object.assign(cliente(f.uid.value), datos);
      aviso('Cliente actualizado.');
    } else {
      datos.id = nuevoId();
      db.clientes.push(datos);
      aviso('Cliente cargado.');
    }
    guardar();
    refrescar();
  });

  $('#tabla-clientes').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.editC) abrirCliente(cliente(b.dataset.editC));
    if (b.dataset.delC) {
      var id = b.dataset.delC;
      var usos = db.movimientos.filter(function (m) { return m.clienteId === id; }).length;
      if (usos) { aviso('No se puede borrar: tiene ' + usos + ' ventas o reservas cargadas.', true); return; }
      if (!confirm('¿Borrar el cliente ' + cliente(id).nombre + '?')) return;
      db.clientes = db.clientes.filter(function (c) { return c.id !== id; });
      guardar();
      refrescar();
      aviso('Cliente borrado.');
    }
  });

  // ---------- Importar Excel (se lee en el navegador) ----------
  function leerExcel(archivo, listo, crudo) {
    if (typeof XLSX === 'undefined') { aviso('No se pudo cargar el lector de Excel.', true); return; }
    var r = new FileReader();
    r.onload = function () {
      try {
        var libro = XLSX.read(new Uint8Array(r.result), { type: 'array', cellDates: !!crudo });
        var hoja = libro.Sheets[libro.SheetNames[0]];
        var filas = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: '', raw: !!crudo });
        listo(filas.filter(function (f) { return f.some(function (c) { return String(c).trim() !== ''; }); }));
      } catch (err) {
        aviso('No se pudo leer el archivo. ¿Es un Excel?', true);
      }
    };
    r.readAsArrayBuffer(archivo);
  }

  // Busca la fila de títulos y la columna de cada campo. Si no hay títulos, usa el orden dado.
  function mapearColumnas(filas, campos, clave) {
    for (var i = 0; i < Math.min(filas.length, 10); i++) {
      var fila = filas[i].map(norm);
      var mapa = {};
      Object.keys(campos).forEach(function (k) {
        var idx = fila.findIndex(function (c) {
          return c && campos[k].some(function (p) { return c.indexOf(p) >= 0; });
        });
        if (idx >= 0) mapa[k] = idx;
      });
      if (mapa[clave] != null) {
        return { mapa: mapa, desde: i + 1 };
      }
    }
    var porOrden = {};
    Object.keys(campos).forEach(function (k, i) { porOrden[k] = i; });
    return { mapa: porOrden, desde: 0 };
  }

  function granoDe(txt) {
    var t = norm(txt);
    if (t.indexOf('gir') === 0) return 'Girasol';
    if (t.indexOf('mai') === 0 || t.indexOf('maiz') >= 0) return 'Maíz';
    if (t.indexOf('sor') === 0) return 'Sorgo';
    return '';
  }

  $('#imp-hibridos').addEventListener('change', function (e) {
    var archivo = e.target.files[0];
    e.target.value = '';
    if (!archivo) return;
    leerExcel(archivo, function (filas) {
      var m = mapearColumnas(filas, {
        semillero: ['semillero', 'marca', 'empresa', 'proveedor'],
        hibrido: ['hibrido', 'producto', 'variedad'],
        grano: ['grano', 'cultivo', 'especie']
      }, 'hibrido');
      var agregados = 0, repetidos = 0, sinGrano = 0, incompletos = 0;
      filas.slice(m.desde).forEach(function (f) {
        var sem = String(f[m.mapa.semillero] == null ? '' : f[m.mapa.semillero]).trim();
        var hib = String(f[m.mapa.hibrido] == null ? '' : f[m.mapa.hibrido]).trim();
        var gr = granoDe(f[m.mapa.grano]);
        if (!sem || !hib) { incompletos++; return; }
        if (!gr) { sinGrano++; return; }
        var existe = db.hibridos.some(function (h) {
          return h.grano === gr && norm(h.semillero) === norm(sem) && norm(h.hibrido) === norm(hib);
        });
        if (existe) { repetidos++; return; }
        db.hibridos.push({ id: nuevoId(), grano: gr, semillero: sem, hibrido: hib });
        agregados++;
      });
      guardar();
      refrescar();
      var msg = 'Se agregaron ' + agregados + ' híbridos.';
      if (repetidos) msg += '\n' + repetidos + ' ya estaban cargados.';
      if (sinGrano) msg += '\n' + sinGrano + ' sin grano válido (debe decir Girasol, Maíz o Sorgo).';
      if (incompletos) msg += '\n' + incompletos + ' filas sin semillero o híbrido.';
      alert(msg);
    });
  });

  $('#imp-clientes').addEventListener('change', function (e) {
    var archivo = e.target.files[0];
    e.target.value = '';
    if (!archivo) return;
    leerExcel(archivo, function (filas) {
      var m = mapearColumnas(filas, {
        nombre: ['nombre', 'cliente', 'razon social', 'razon'],
        cuit: ['cuit', 'cuil', 'dni'],
        localidad: ['localidad', 'ciudad', 'domicilio', 'direccion'],
        telefono: ['telefono', 'tel', 'celular', 'whatsapp'],
        correo: ['correo', 'mail', 'email']
      }, 'nombre');
      var agregados = 0, repetidos = 0;
      filas.slice(m.desde).forEach(function (f) {
        var c = {};
        ['nombre', 'cuit', 'localidad', 'telefono', 'correo'].forEach(function (k) {
          c[k] = m.mapa[k] == null ? '' : String(f[m.mapa[k]] == null ? '' : f[m.mapa[k]]).trim();
        });
        if (!c.nombre) return;
        if (db.clientes.some(function (x) { return norm(x.nombre) === norm(c.nombre); })) { repetidos++; return; }
        c.id = nuevoId();
        db.clientes.push(c);
        agregados++;
      });
      guardar();
      refrescar();
      alert('Se agregaron ' + agregados + ' clientes.' + (repetidos ? '\n' + repetidos + ' ya estaban cargados.' : ''));
    });
  });

  function bajarExcel(nombre, hojas) {
    var libro = XLSX.utils.book_new();
    hojas.forEach(function (h) {
      XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(h.filas), h.nombre.slice(0, 31));
    });
    XLSX.writeFile(libro, nombre);
  }

  $('#modelo-hibridos').addEventListener('click', function () {
    bajarExcel('modelo-hibridos.xlsx', [{ nombre: 'Híbridos', filas: [
      ['Semillero', 'Híbrido', 'Grano'],
      ['Nidera', 'NS 1113', 'Girasol'],
      ['Dekalb', 'DK 72-70', 'Maíz'],
      ['Advanta', 'ADV 1302', 'Sorgo']
    ] }]);
  });

  $('#modelo-clientes').addEventListener('click', function () {
    bajarExcel('modelo-clientes.xlsx', [{ nombre: 'Clientes', filas: [
      ['Nombre', 'CUIT', 'Localidad', 'Teléfono', 'Correo'],
      ['Agropecuaria Ejemplo S.A.', '30-12345678-9', 'Pergamino', '2477 123456', 'compras@ejemplo.com.ar']
    ] }]);
  });

  // ---------- Compras y ventas ----------
  opciones($('#tipo-compras'), TIPOS_INGRESO, 'Todos los tipos');
  opciones($('#tipo-ventas'), TIPOS_SALIDA, 'Todos los tipos');

  function renderMovs(clase) {
    var ing = clase === 'ingreso';
    var q = norm($(ing ? '#busca-compras' : '#busca-ventas').value);
    var tipo = $(ing ? '#tipo-compras' : '#tipo-ventas').value;
    var t = $(ing ? '#tabla-compras' : '#tabla-ventas');
    var soloRemitir = !ing && $('#solo-remitir').checked;
    var todos = db.movimientos.filter(function (m) { return enVentas(m) === !ing; });
    if (!todos.length) {
      t.innerHTML = '<tr><td class="vacio">' + (ing ? 'Todavía no hay compras cargadas.' : 'Todavía no hay ventas ni reservas cargadas.') + '</td></tr>';
      return;
    }
    var lista = todos.filter(function (m) {
      var h = hibrido(m.hibridoId), c = cliente(m.clienteId);
      var texto = nombreHibrido(h) + ' ' + (c ? c.nombre : '') + ' ' + (m.obs || '') + ' ' + (m.comprobante || '');
      return (!tipo || m.tipo === tipo) && (!q || norm(texto).indexOf(q) >= 0) && (!soloRemitir || aRemitir(m) > 0);
    }).sort(function (a, b) { return (b.fecha || '').localeCompare(a.fecha || '') || (b.creado || 0) - (a.creado || 0); });

    var cab = '<thead><tr><th>Fecha</th><th>Tipo</th>' + (ing ? '' : '<th>Cliente</th>') +
      '<th>Grano</th><th>Semillero</th><th>Híbrido</th><th>Banda</th><th class="num">Bolsas</th>' + (ing ? '' : '<th class="num">A remitir</th>') + '<th class="num">Precio</th><th>Comprob.</th><th>Obs.</th><th class="acc"></th></tr></thead>';
    var cols = ing ? 11 : 13;
    t.innerHTML = cab + '<tbody>' + (lista.length ? lista.map(function (m) {
      var h = hibrido(m.hibridoId) || {}, c = cliente(m.clienteId);
      var ar = aRemitir(m), vin = textoVinculo(m);
      return '<tr><td>' + fechaTxt(m.fecha) + '</td><td><span class="etq ' + (m.clase === 'ingreso' ? 'in' : 'out') + '">' + esc(m.tipo) + '</span>' +
        (m.doc ? ' <small>' + esc(m.doc) + '</small>' : '') + '</td>' +
        (ing ? '' : '<td>' + esc(c ? c.nombre : '(cliente borrado)') + '</td>') +
        '<td>' + esc(h.grano) + '</td><td>' + esc(h.semillero) + '</td><td><b>' + esc(h.hibrido) + '</b></td><td>' + esc(m.banda) + '</td>' +
        '<td class="num">' + num(m.cantidad) + '</td>' +
        (ing ? '' : '<td class="num' + (ar > 0 ? ' neg' : '') + '">' + (ar == null ? '' : num(ar)) + '</td>') +
        '<td class="num">' + precioTxt(m) + '</td><td>' + esc(m.comprobante) + '</td>' +
        '<td>' + (vin ? '<small class="vinc">' + esc(vin) + '</small><br>' : '') + esc(m.obs) + '</td>' +
        '<td class="acc"><button class="mini" data-edit-m="' + m.id + '">Editar</button> ' +
        '<button class="mini borrar" data-del-m="' + m.id + '">Borrar</button></td></tr>';
    }).join('') : '<tr><td colspan="' + cols + '" class="vacio">No hay coincidencias.</td></tr>') + '</tbody>';
  }

  ['compras', 'ventas'].forEach(function (s) {
    var clase = s === 'compras' ? 'ingreso' : 'salida';
    $('#busca-' + s).addEventListener('input', function () { renderMovs(clase); });
    $('#tipo-' + s).addEventListener('change', function () { renderMovs(clase); });
    if (s === 'ventas') $('#solo-remitir').addEventListener('change', function () { renderMovs(clase); });
    $('#tabla-' + s).addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      var m = db.movimientos.find(function (x) { return x.id === (b.dataset.editM || b.dataset.delM); });
      if (!m) return;
      if (b.dataset.editM) abrirMov(enVentas(m) ? 'salida' : 'ingreso', m);
      if (b.dataset.delM) {
        var nh = hijos(m).length;
        if (!confirm('¿Borrar esta operación (' + m.tipo + ' de ' + num(m.cantidad) + ' bolsas de ' + nombreHibrido(hibrido(m.hibridoId)) + ')?' +
          (nh ? '\n\nHay ' + nh + ' operaciones que corresponden a esta (remitos, facturas). Si la borrás, esas pasan a descontar stock por su cuenta.' : ''))) return;
        db.movimientos = db.movimientos.filter(function (x) { return x.id !== m.id; });
        guardar();
        refrescar();
        aviso('Operación borrada.');
      }
    });
  });

  $('#btn-nueva-compra').addEventListener('click', function () { abrirMov('ingreso'); });
  $('#btn-nueva-venta').addEventListener('click', function () { abrirMov('salida'); });

  var fMov = $('#form-mov');

  function abrirMov(clase, m) {
    var ing = clase === 'ingreso';
    if (!db.hibridos.length) {
      aviso('Primero cargá la lista de híbridos.', true);
      ir('hibridos');
      return;
    }
    if (!ing && !db.clientes.length) {
      aviso('Primero cargá al menos un cliente.', true);
      ir('clientes');
      return;
    }
    fMov.reset();
    fMov.uid.value = m ? m.id : '';
    fMov.clase.value = clase;
    opciones(fMov.tipo, ing ? TIPOS_INGRESO : TIPOS_SALIDA);
    $('#tit-mov').textContent = (m ? 'Editar ' : 'Cargar ') + (ing ? 'compra / ingreso' : 'venta, pedido o devolución');
    $('#bloque-cliente').style.display = ing ? 'none' : '';
    $('#vinculo-mov').textContent = m ? textoVinculo(m) : '';
    $('#busca-hibrido-mov').value = '';
    $('#busca-cliente-mov').value = '';
    fMov.fecha.value = m ? m.fecha : hoy();
    if (m) {
      fMov.tipo.value = m.tipo;
      fMov.banda.value = m.banda;
      fMov.cantidad.value = m.cantidad;
      fMov.precio.value = m.precio == null ? '' : m.precio;
      fMov.moneda.value = m.moneda || 'USD';
      fMov.comprobante.value = m.comprobante || '';
      fMov.obs.value = m.obs || '';
    }
    elegirCliente(m ? m.clienteId : '');
    listarHibridosMov(m ? m.hibridoId : '');
    mostrarDisponible();
    $('#dlg-mov').showModal();
    if (!ing && !m) $('#busca-cliente-mov').focus();
  }

  function listarHibridosMov(elegido) {
    var q = norm($('#busca-hibrido-mov').value);
    var sel = $('#sel-hibrido-mov');
    var actual = elegido != null ? elegido : sel.value;
    var lista = ordenarHibridos(db.hibridos).filter(function (h) {
      return h.id === actual || !q || norm(h.grano + ' ' + h.semillero + ' ' + h.hibrido).indexOf(q) >= 0;
    });
    sel.innerHTML = lista.map(function (h) {
      return '<option value="' + h.id + '">' + esc(h.grano + ' — ' + h.semillero + ' — ' + h.hibrido) + '</option>';
    }).join('');
    sel.value = actual || '';
    if (!sel.value && lista.length === 1) sel.value = lista[0].id;
  }

  $('#busca-hibrido-mov').addEventListener('input', function () { listarHibridosMov(); mostrarDisponible(); });
  $('#sel-hibrido-mov').addEventListener('change', mostrarDisponible);
  fMov.banda.addEventListener('change', mostrarDisponible);
  fMov.cantidad.addEventListener('input', mostrarDisponible);

  function mostrarDisponible() {
    var p = $('#disp-mov');
    var hid = fMov.hibridoId.value;
    p.className = 'disponible';
    if (!hid) { p.textContent = ''; return; }
    var banda = fMov.banda.value;
    var disp = stock(hid, banda, fMov.uid.value);
    var txt = 'Stock disponible' + (banda ? ' en ' + banda : ' (todas las bandas)') + ': ' + num(disp) + ' bolsas';
    if (claseDe(fMov.tipo.value) === 'salida' && banda && Number(fMov.cantidad.value) > disp) {
      p.className = 'disponible mal';
      txt += ' — la cantidad supera el stock';
    }
    p.textContent = txt;
  }

  // Buscador de clientes por nombre
  $('#busca-cliente-mov').addEventListener('input', function () {
    var q = norm(this.value);
    var cont = $('#resultados-cliente');
    if (!q) { cont.innerHTML = ''; return; }
    var lista = db.clientes.filter(function (c) { return norm(c.nombre + ' ' + c.cuit).indexOf(q) >= 0; })
      .sort(function (a, b) { return a.nombre.localeCompare(b.nombre, 'es'); }).slice(0, 12);
    cont.innerHTML = lista.length ? lista.map(function (c) {
      return '<button type="button" data-cli="' + c.id + '">' + esc(c.nombre) +
        (c.localidad ? ' <small>· ' + esc(c.localidad) + '</small>' : '') + '</button>';
    }).join('') : '<div class="nada">No se encontró ningún cliente con ese nombre. Cargalo primero en «Clientes».</div>';
  });

  $('#resultados-cliente').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (b) elegirCliente(b.dataset.cli);
  });

  function elegirCliente(id) {
    var c = cliente(id);
    fMov.clienteId.value = c ? c.id : '';
    var box = $('#cliente-elegido');
    $('#resultados-cliente').innerHTML = '';
    if (c) {
      box.innerHTML = '<span>' + esc(c.nombre) + '</span><button type="button" class="mini" id="cambiar-cli">Cambiar</button>';
      box.classList.add('ver');
      $('#busca-cliente-mov').value = '';
      $('#busca-cliente-mov').parentElement.style.display = 'none';
      $('#cambiar-cli').addEventListener('click', function () {
        elegirCliente('');
        $('#busca-cliente-mov').focus();
      });
    } else {
      box.innerHTML = '';
      box.classList.remove('ver');
      $('#busca-cliente-mov').parentElement.style.display = '';
    }
  }

  fMov.addEventListener('submit', function (e) {
    var ing = fMov.clase.value === 'ingreso';
    var sale = claseDe(fMov.tipo.value) === 'salida';
    if (!ing && !fMov.clienteId.value) { e.preventDefault(); aviso('Elegí un cliente.', true); return; }
    if (!fMov.hibridoId.value) { e.preventDefault(); aviso('Elegí un híbrido.', true); return; }
    var cant = Number(fMov.cantidad.value);
    if (!(cant > 0)) { e.preventDefault(); aviso('La cantidad debe ser mayor a cero.', true); return; }
    if (sale) {
      var disp = stock(fMov.hibridoId.value, fMov.banda.value, fMov.uid.value);
      if (cant > disp && !confirm('Hay ' + num(disp) + ' bolsas en stock en ' + fMov.banda.value + ' y querés descontar ' + num(cant) + '.\n¿Guardar igual?')) {
        e.preventDefault();
        return;
      }
    }
    var datos = {
      clase: claseDe(fMov.tipo.value),
      tipo: fMov.tipo.value,
      fecha: fMov.fecha.value,
      clienteId: ing ? '' : fMov.clienteId.value,
      hibridoId: fMov.hibridoId.value,
      banda: fMov.banda.value,
      cantidad: cant,
      precio: fMov.precio.value === '' ? null : Number(fMov.precio.value),
      moneda: fMov.moneda.value,
      comprobante: fMov.comprobante.value.trim(),
      obs: fMov.obs.value.trim()
    };
    var existente = db.movimientos.find(function (m) { return m.id === fMov.uid.value; });
    if (existente) {
      Object.assign(existente, datos);
      aviso('Operación actualizada.');
    } else {
      datos.id = nuevoId();
      datos.creado = Date.now();
      db.movimientos.push(datos);
      aviso(datos.tipo + ' cargada: ' + (sale ? 'descuenta ' : 'suma ') + num(cant) + ' bolsas.');
    }
    guardar();
    refrescar();
  });

  // ---------- Importar ventas de Algoritmo ----------
  var CLAVE_MAPEO = 'morero_mapeo_algoritmo';
  var imp = null; // { nombre, titulos, datos, filas }

  // Separa un texto en palabras y números: "ADV5407 CL" -> ["adv","5407","cl"]
  function fichas(txt) {
    return norm(txt).replace(/([a-z])(\d)/g, '$1 $2').replace(/(\d)([a-z])/g, '$1 $2')
      .split(/[^a-z0-9]+/).filter(Boolean);
  }

  // Busca el híbrido cargado cuyo nombre aparece completo dentro de la descripción.
  // Si hay varios, gana el nombre más largo (y el del mismo grano que dice la descripción).
  function detectarHibrido(desc) {
    var d = fichas(desc);
    var grano = granoEnTexto(desc);
    var mejor = null, puntos = 0;
    db.hibridos.forEach(function (h) {
      var n = fichas(h.hibrido);
      if (!n.length) return;
      for (var i = 0; i + n.length <= d.length; i++) {
        var ok = true;
        for (var j = 0; j < n.length; j++) { if (d[i + j] !== n[j]) { ok = false; break; } }
        if (ok) {
          var p = n.join('').length * 10 + n.length + (grano && h.grano === grano ? 1000 : 0);
          if (p > puntos) { puntos = p; mejor = h; }
          break;
        }
      }
    });
    return mejor;
  }

  function granoEnTexto(txt) {
    var t = norm(txt);
    if (/\bgirasol/.test(t)) return 'Girasol';
    if (/\bmaiz/.test(t)) return 'Maíz';
    if (/\bsorgo/.test(t)) return 'Sorgo';
    return '';
  }

  // Girasol: G0, G1, G2 -> Banda 1; G3 -> Banda 2; G3E, G4 -> Banda 3.
  function bandaGirasol(desc) {
    var m = norm(desc).match(/(?:^|[^a-z0-9])g\s?(3-?e|[0-4])(?![a-z0-9])/);
    if (!m) return '';
    var c = m[1].replace('-', '');
    if (c === '0' || c === '1' || c === '2') return 'Banda 1';
    if (c === '3') return 'Banda 2';
    return 'Banda 3';
  }

  // Números escritos a la argentina ("1.250,5") o ya numéricos.
  function numeroAR(v) {
    if (typeof v === 'number') return v;
    var t = String(v == null ? '' : v).trim().replace(/[^\d.,-]/g, '');
    if (!t) return NaN;
    if (t.indexOf(',') >= 0) t = t.replace(/\./g, '').replace(',', '.');
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
    return Number(t);
  }

  function fechaISO(v) {
    if (v instanceof Date && !isNaN(v)) {
      return v.getFullYear() + '-' + String(v.getMonth() + 1).padStart(2, '0') + '-' + String(v.getDate()).padStart(2, '0');
    }
    var m = String(v == null ? '' : v).trim().match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
    if (m) {
      var a = m[3].length === 2 ? '20' + m[3] : m[3];
      return a + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
    }
    m = String(v == null ? '' : v).trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? m[0] : '';
  }

  // La fila de títulos es, entre las primeras 15, la que tiene más celdas con texto.
  function filaTitulos(filas) {
    var mejor = 0, max = -1;
    for (var i = 0; i < Math.min(filas.length, 15); i++) {
      var n = filas[i].filter(function (c) { return typeof c === 'string' && c.trim() && isNaN(numeroAR(c)); }).length;
      if (n > max) { max = n; mejor = i; }
    }
    return mejor;
  }

  function adivinarColumna(titulos, palabras, evitar) {
    var t = titulos.map(norm);
    for (var p = 0; p < palabras.length; p++) {
      var i = t.findIndex(function (x) {
        return x.indexOf(palabras[p]) >= 0 && !(evitar || []).some(function (e) { return x.indexOf(e) >= 0; });
      });
      if (i >= 0) return i;
    }
    return -1;
  }

  $('#imp-ventas').addEventListener('change', function (e) {
    var archivo = e.target.files[0];
    e.target.value = '';
    if (!archivo) return;
    if (!db.hibridos.length) { aviso('Primero cargá la lista de híbridos.', true); ir('hibridos'); return; }
    leerExcel(archivo, function (filas) {
      if (!filas.length) { aviso('El archivo está vacío.', true); return; }
      var ft = filaTitulos(filas);
      var titulos = filas[ft].map(function (c, i) { return String(c || '').trim() || 'Columna ' + (i + 1); });
      var ancho = filas.reduce(function (m, f) { return Math.max(m, f.length); }, 0);
      for (var i = titulos.length; i < ancho; i++) titulos.push('Columna ' + (i + 1));
      imp = { nombre: archivo.name, titulos: titulos, datos: filas.slice(ft + 1), filas: [] };

      var guardado = {};
      try { guardado = JSON.parse(localStorage.getItem(CLAVE_MAPEO) || '{}'); } catch (err) { guardado = {}; }
      var porTitulo = function (k) { return guardado[k] ? titulos.indexOf(guardado[k]) : -1; };
      var col = {
        cliente: porTitulo('cliente'), descripcion: porTitulo('descripcion'), cantidad: porTitulo('cantidad'),
        fecha: porTitulo('fecha'), comprobante: porTitulo('comprobante'), operacion: porTitulo('operacion')
      };
      if (col.cliente < 0) col.cliente = adivinarColumna(titulos, ['razon social', 'cliente', 'nombre', 'denominacion'], ['cod', 'cuit', 'nro', 'num']);
      if (col.descripcion < 0) col.descripcion = adivinarColumna(titulos, ['descripcion', 'articulo', 'producto', 'detalle'], ['cod']);
      if (col.cantidad < 0) col.cantidad = adivinarColumna(titulos, ['cantidad', 'cant', 'bolsas', 'unidades']);
      if (col.fecha < 0) col.fecha = adivinarColumna(titulos, ['fecha']);
      if (col.comprobante < 0) col.comprobante = adivinarColumna(titulos, ['comprobante', 'factura', 'numero', 'nro']);
      if (col.operacion < 0) col.operacion = adivinarColumna(titulos, ['operacion', 'tipo de comprobante', 'tipo comprobante', 'tipo comp', 'cod. comp', 'tipo']);
      if (col.operacion === col.comprobante) col.operacion = -1;

      var opts = '<option value="-1">— elegir —</option>' + titulos.map(function (t, i) {
        return '<option value="' + i + '">' + esc(t) + '</option>';
      }).join('');
      $$('#form-imp [data-col]').forEach(function (s) {
        s.innerHTML = opts.replace('— elegir —', s.required ? '— elegir —' : '— no usar —');
        s.value = String(col[s.dataset.col]);
      });
      $('#imp-archivo').textContent = 'Archivo: ' + archivo.name + ' · ' + imp.datos.length + ' filas';
      $('#imp-solo-problemas').checked = false;
      armarImportacion();
      $('#dlg-imp').showModal();
    }, true);
  });

  var CAMPOS_IMP = ['cliente', 'descripcion', 'cantidad', 'operacion', 'fecha', 'comprobante'];

  function columnaElegida(k) { return Number($('#form-imp [data-col="' + k + '"]').value); }

  // FAC (factura) y REM (remito) → venta; PED → pedido; RDE → devolución (suma stock).
  function docDeTexto(txt) {
    var t = norm(txt);
    if (!t) return '';
    if (/(^|[^a-z])rde([^a-z]|$)/.test(t) || t.indexOf('devol') >= 0) return 'RDE';
    if (/(^|[^a-z])(fac|fca|fcb|fc)([^a-z]|$)/.test(t) || t.indexOf('factura') >= 0) return 'FAC';
    if (/(^|[^a-z])rem([^a-z]|$)/.test(t) || t.indexOf('remito') >= 0) return 'REM';
    if (/(^|[^a-z])ped([^a-z]|$)/.test(t) || t.indexOf('pedido') >= 0) return 'PED';
    return '';
  }

  function armarImportacion() {
    var c = {};
    CAMPOS_IMP.forEach(function (k) { c[k] = columnaElegida(k); });
    var celda = function (f, k) { var v = c[k] >= 0 ? f[c[k]] : ''; return v == null ? '' : v; };
    var porDefecto = $('#imp-tipo').value;
    imp.filas = [];
    if (c.cliente < 0 || c.descripcion < 0 || c.cantidad < 0) { renderImportacion(); return; }
    imp.datos.forEach(function (f) {
      var cli = String(celda(f, 'cliente')).trim();
      var desc = String(celda(f, 'descripcion')).trim();
      if (!cli && !desc) return;
      var comp = String(celda(f, 'comprobante')).trim();
      var doc = docDeTexto(celda(f, 'operacion')) || docDeTexto(comp);
      var cant = numeroAR(celda(f, 'cantidad'));
      var h = detectarHibrido(desc);
      var banda = '';
      if (h && h.grano === 'Girasol') banda = bandaGirasol(desc);
      else if (h) banda = 'Sin banda';
      imp.filas.push({
        cliente: cli, desc: desc, cantidad: cant,
        fecha: fechaISO(celda(f, 'fecha')) || hoy(),
        comprobante: comp, doc: doc || porDefecto, docAuto: !!doc,
        hibridoId: h ? h.id : '', banda: banda, vinculo: ''
      });
    });
    imp.filas.forEach(function (r) {
      if (r.doc === 'RDE' && r.cantidad < 0) r.cantidad = -r.cantidad;
      r.repetida = yaImportada(r);
      r.importar = !!r.hibridoId && !r.repetida;
    });
    renderImportacion();
  }

  function claveFila(r) {
    return [norm(r.cliente), norm(r.desc), r.cantidad, r.fecha, norm(r.comprobante)].join('|');
  }

  function yaImportada(r) {
    var k = claveFila(r);
    return db.movimientos.some(function (m) { return m.origen === k; });
  }

  function problemaBasico(r) {
    if (r.repetida) return 'Ya importada antes';
    if (!r.hibridoId) return 'Sin híbrido';
    if (!r.cliente) return 'Sin cliente';
    if (!(r.cantidad > 0)) return 'Cantidad inválida';
    if (!r.banda) return 'Falta banda';
    return '';
  }

  function problemaFila(r) {
    return problemaBasico(r) || (r.candidatos && r.candidatos.length && !r.vinculo ? 'Consultar: ¿corresponde a una anterior?' : '');
  }

  // Saldo de una operación (pedido + remitos + factura) para un remito o una factura nuevos.
  function saldoPara(doc, g) {
    if (doc === 'REM') return Math.max(g.PED, g.FAC) - g.REM;
    if (doc === 'FAC') return Math.max(g.PED, g.REM) - g.FAC;
    return 0;
  }

  // Recorre las filas por fecha. Para cada remito o factura busca operaciones anteriores del mismo
  // cliente e híbrido (guardadas o de este mismo archivo) que todavía tengan saldo, para preguntar.
  function calcularVinculos() {
    var bolsa = [];
    var grupos = calcularGrupos().grupos;
    Object.keys(grupos).forEach(function (k) {
      var g = grupos[k], m0 = g.miembros[0], c = cliente(m0.clienteId);
      bolsa.push({
        clave: 'm:' + k, cli: norm(c ? c.nombre : ''), hibridoId: m0.hibridoId, PED: g.PED, REM: g.REM, FAC: g.FAC,
        texto: g.miembros.map(nombreDoc).join(' + ')
      });
    });
    var orden = imp.filas.map(function (r, i) { return i; }).sort(function (x, y) {
      return imp.filas[x].fecha.localeCompare(imp.filas[y].fecha) || x - y;
    });
    orden.forEach(function (i) {
      var r = imp.filas[i];
      r.candidatos = [];
      r.descuenta = r.cantidad;
      if (!r.importar || problemaBasico(r) || r.doc === 'RDE') { r.vinculo = ''; return; }
      if (r.doc === 'REM' || r.doc === 'FAC') {
        r.candidatos = bolsa.filter(function (b) {
          return b.cli === norm(r.cliente) && b.hibridoId === r.hibridoId && saldoPara(r.doc, b) > 0;
        }).map(function (b) { return { clave: b.clave, texto: b.texto, pend: saldoPara(r.doc, b) }; });
      } else {
        r.vinculo = '';
      }
      if (r.vinculo && r.vinculo !== 'nuevo' && !r.candidatos.some(function (b) { return b.clave === r.vinculo; })) r.vinculo = '';
      var texto = DOCS[r.doc].nombre + (r.comprobante ? ' ' + r.comprobante : '') + ' del ' + fechaTxt(r.fecha) + ' (de este archivo)';
      if (r.vinculo && r.vinculo !== 'nuevo') {
        var b = bolsa.find(function (x) { return x.clave === r.vinculo; });
        var antes = Math.max(b.PED, b.REM, b.FAC);
        b[r.doc] += r.cantidad;
        r.descuenta = Math.max(b.PED, b.REM, b.FAC) - antes;
        b.texto += ' + ' + texto;
      } else {
        var nuevo = { clave: 'i:' + i, fila: i, cli: norm(r.cliente), hibridoId: r.hibridoId, PED: 0, REM: 0, FAC: 0, texto: texto };
        nuevo[r.doc] = r.cantidad;
        bolsa.push(nuevo);
      }
    });
  }

  function renderImportacion() {
    var t = $('#imp-tabla');
    if (!imp.filas.length) {
      t.innerHTML = '<tr><td class="vacio">Elegí las columnas de Cliente, Descripción y Cantidad para ver las ventas.</td></tr>';
      $('#imp-resumen').innerHTML = '';
      $('#imp-confirmar').textContent = 'Importar';
      return;
    }
    calcularVinculos();
    var solo = $('#imp-solo-problemas').checked;
    var opcH = '<option value="">— no es un híbrido cargado —</option>' + ordenarHibridos(db.hibridos).map(function (h) {
      return '<option value="' + h.id + '">' + esc(h.hibrido + ' · ' + h.semillero + ' (' + h.grano + ')') + '</option>';
    }).join('');
    var opcB = '<option value="">Elegir…</option>' + BANDAS.map(function (b) { return '<option>' + b + '</option>'; }).join('');
    var opcD = Object.keys(DOCS).map(function (k) { return '<option value="' + k + '">' + k + ' · ' + DOCS[k].nombre + '</option>'; }).join('');
    var html = '<thead><tr><th></th><th>Cliente</th><th>Operación</th><th>Descripción en Algoritmo</th><th>Híbrido</th><th>Banda</th>' +
      '<th class="num">Bolsas</th><th>Fecha</th><th>¿Corresponde a una operación anterior?</th><th>Estado</th></tr></thead><tbody>';
    imp.filas.forEach(function (r, i) {
      var prob = problemaFila(r);
      if (solo && !prob) return;
      var clienteNuevo = r.cliente && !db.clientes.some(function (c) { return norm(c.nombre) === norm(r.cliente); });
      var vinc = '—';
      if (r.candidatos && r.candidatos.length) {
        var pregunta = r.doc === 'REM' ? '¿Este remito descuenta de…?' : '¿Esta factura es nueva o corresponde a…?';
        vinc = '<select data-i="' + i + '" data-k="vinculo" class="sel-vinc' + (r.vinculo ? '' : ' falta') + '">' +
          '<option value="">' + pregunta + '</option>' +
          '<option value="nuevo"' + (r.vinculo === 'nuevo' ? ' selected' : '') + '>No, es nueva (descuenta stock)</option>' +
          r.candidatos.map(function (b) {
            return '<option value="' + b.clave + '"' + (r.vinculo === b.clave ? ' selected' : '') + '>Sí: ' + esc(b.texto) + ' · saldo ' + num(b.pend) + ' bls.</option>';
          }).join('') + '</select>' +
          (r.vinculo && r.vinculo !== 'nuevo' ? '<br><small>' + (r.descuenta ? 'Descuenta ' + num(r.descuenta) + ' bls. (excede el saldo)' : 'No descuenta stock (ya contado)') + '</small>' : '');
      }
      html += '<tr class="' + (!r.importar ? 'omitida' : prob ? 'revisar' : '') + '">' +
        '<td><input type="checkbox" data-i="' + i + '" data-k="importar"' + (r.importar ? ' checked' : '') + '></td>' +
        '<td>' + esc(r.cliente) + (clienteNuevo && r.importar ? ' <span class="etq warn">cliente nuevo</span>' : '') + '</td>' +
        '<td><select data-i="' + i + '" data-k="doc" class="sel-doc">' + opcD.replace('value="' + r.doc + '"', 'value="' + r.doc + '" selected') + '</select>' +
          (r.docAuto ? '' : '<br><small>no se reconoció</small>') + '</td>' +
        '<td class="desc">' + esc(r.desc) + (r.comprobante ? '<br><small>' + esc(r.comprobante) + '</small>' : '') + '</td>' +
        '<td>' + (r.hibridoId || r.elegir || pareceSemilla(r.desc)
          ? '<select data-i="' + i + '" data-k="hibridoId">' + opcH.replace('value="' + r.hibridoId + '"', 'value="' + r.hibridoId + '" selected') + '</select>'
          : '<button type="button" class="mini" data-elegir="' + i + '">Elegir híbrido</button>') + '</td>' +
        '<td><select data-i="' + i + '" data-k="banda">' + opcB.replace('<option>' + r.banda + '</option>', '<option selected>' + r.banda + '</option>') + '</select></td>' +
        '<td class="num">' + (isNaN(r.cantidad) ? '?' : num(r.cantidad)) + '</td>' +
        '<td>' + fechaTxt(r.fecha) + '</td>' +
        '<td>' + vinc + '</td>' +
        '<td>' + (prob ? '<span class="etq warn">' + prob + '</span>' : '<span class="etq in">OK</span>') + '</td></tr>';
    });
    t.innerHTML = html + '</tbody>';

    var listas = imp.filas.filter(function (r) { return r.importar && !problemaFila(r); }).length;
    var consultas = imp.filas.filter(function (r) { return r.importar && !problemaBasico(r) && problemaFila(r); }).length;
    var marcadasMal = imp.filas.filter(function (r) { return r.importar && problemaBasico(r); }).length;
    var sinH = imp.filas.filter(function (r) { return !r.hibridoId; }).length;
    var rep = imp.filas.filter(function (r) { return r.repetida; }).length;
    $('#imp-resumen').innerHTML =
      '<span class="etq in">' + listas + ' listas para importar</span>' +
      (consultas ? '<span class="etq warn">' + consultas + ' para responder si corresponden a una operación anterior</span>' : '') +
      (marcadasMal ? '<span class="etq warn">' + marcadasMal + ' marcadas con datos a completar</span>' : '') +
      (sinH ? '<span class="etq">' + sinH + ' sin híbrido reconocido (no se importan)</span>' : '') +
      (rep ? '<span class="etq">' + rep + ' ya importadas antes</span>' : '');
    $('#imp-confirmar').textContent = 'Importar ' + listas + ' operaciones';
  }

  // Para no llenar la pantalla de listas, solo se muestra el selector en filas que parecen semilla.
  function pareceSemilla(desc) {
    var t = norm(desc);
    if (granoEnTexto(desc) || t.indexOf('semilla') >= 0) return true;
    return semilleros().some(function (sm) { var n = norm(sm); return n.length > 2 && t.indexOf(n) >= 0; });
  }

  $('#imp-tabla').addEventListener('click', function (e) {
    var b = e.target.closest('[data-elegir]');
    if (!b) return;
    imp.filas[Number(b.dataset.elegir)].elegir = true;
    renderImportacion();
  });

  $$('#form-imp [data-col]').forEach(function (s) { s.addEventListener('change', armarImportacion); });
  $('#imp-tipo').addEventListener('change', armarImportacion);
  $('#imp-solo-problemas').addEventListener('change', renderImportacion);

  $('#imp-tabla').addEventListener('change', function (e) {
    var el = e.target, r = imp.filas[Number(el.dataset.i)];
    if (!r) return;
    if (el.dataset.k === 'importar') r.importar = el.checked;
    if (el.dataset.k === 'hibridoId') {
      r.hibridoId = el.value;
      var h = hibrido(el.value);
      if (h && !r.banda) r.banda = h.grano === 'Girasol' ? bandaGirasol(r.desc) : 'Sin banda';
      r.importar = !!el.value;
    }
    if (el.dataset.k === 'banda') r.banda = el.value;
    if (el.dataset.k === 'doc') { r.doc = el.value; r.docAuto = true; }
    if (el.dataset.k === 'vinculo') r.vinculo = el.value;
    renderImportacion();
  });

  $('#form-imp').addEventListener('submit', function (e) {
    calcularVinculos();
    var listas = imp.filas.filter(function (r) { return r.importar && !problemaFila(r); });
    var malas = imp.filas.filter(function (r) { return r.importar && problemaFila(r); }).length;
    if (!listas.length) { e.preventDefault(); aviso('No hay operaciones listas para importar.', true); return; }
    if (malas && !confirm(malas + ' filas marcadas tienen datos a completar o preguntas sin responder y no se van a importar. ¿Seguir con las ' + listas.length + ' que están bien?')) {
      e.preventDefault();
      return;
    }
    // Recordar qué columnas se usaron, para la próxima vez.
    var mapeo = {};
    CAMPOS_IMP.forEach(function (k) {
      var i = columnaElegida(k);
      if (i >= 0) mapeo[k] = imp.titulos[i];
    });
    try { localStorage.setItem(CLAVE_MAPEO, JSON.stringify(mapeo)); } catch (err) { /* no es grave */ }

    // Se guardan por fecha, así una fila puede corresponder a otra anterior del mismo archivo.
    var nuevos = 0, ahora = Date.now(), idDeFila = {}, cuenta = {};
    var orden = imp.filas.map(function (r, i) { return i; }).sort(function (x, y) {
      return imp.filas[x].fecha.localeCompare(imp.filas[y].fecha) || x - y;
    });
    orden.forEach(function (i, n) {
      var r = imp.filas[i];
      if (!r.importar || problemaFila(r)) return;
      var c = db.clientes.find(function (x) { return norm(x.nombre) === norm(r.cliente); });
      if (!c) {
        c = { id: nuevoId(), nombre: r.cliente, cuit: '', localidad: '', telefono: '', correo: '' };
        db.clientes.push(c);
        nuevos++;
      }
      var grupo = '';
      if (r.vinculo && r.vinculo.indexOf('m:') === 0) grupo = r.vinculo.slice(2);
      if (r.vinculo && r.vinculo.indexOf('i:') === 0) grupo = idDeFila[r.vinculo.slice(2)] || '';
      var tipo = DOCS[r.doc].tipo;
      var m = {
        id: nuevoId(), creado: ahora + n, clase: claseDe(tipo), tipo: tipo, doc: r.doc, fecha: r.fecha,
        clienteId: c.id, hibridoId: r.hibridoId, banda: r.banda, cantidad: r.cantidad,
        precio: null, moneda: 'USD', comprobante: r.comprobante,
        obs: 'Importado de Algoritmo: ' + r.desc, origen: claveFila(r)
      };
      if (grupo) m.grupo = grupo;
      db.movimientos.push(m);
      idDeFila[i] = claveGrupo(m);
      cuenta[DOCS[r.doc].nombre] = (cuenta[DOCS[r.doc].nombre] || 0) + 1;
    });
    guardar();
    refrescar();
    alert('Se importaron ' + listas.length + ' operaciones:\n' + Object.keys(cuenta).map(function (k) { return '· ' + k + ': ' + cuenta[k]; }).join('\n') +
      (nuevos ? '\nSe agregaron ' + nuevos + ' clientes nuevos.' : ''));
  });

  // ---------- Filtros de reportes ----------
  var filtros = { posicion: { grano: '', banda: '', ids: [] }, reporte: { grano: '', banda: '', ids: [] } };

  function renderPanelesFiltro() {
    $$('.panel-filtros').forEach(function (p) {
      var r = p.dataset.reporte;
      var f = filtros[r];
      var visibles = ordenarHibridos(db.hibridos).filter(function (h) { return !f.grano || h.grano === f.grano; });
      p.innerHTML =
        '<div class="fila">' +
        '<label>Grano<select data-f="grano">' + '<option value="">Todos</option>' +
        GRANOS.map(function (g) { return '<option' + (g === f.grano ? ' selected' : '') + '>' + g + '</option>'; }).join('') + '</select></label>' +
        '<label>Banda<select data-f="banda"><option value="">Todas</option>' +
        BANDAS.map(function (b) { return '<option' + (b === f.banda ? ' selected' : '') + '>' + b + '</option>'; }).join('') + '</select></label>' +
        '</div>' +
        '<div class="fila"><label>Híbridos <small>(si no marcás ninguno, salen todos los del grano)</small>' +
        '<input type="search" data-f="busca" placeholder="Filtrar la lista…"></label></div>' +
        '<div class="lista-checks">' + (visibles.length ? visibles.map(function (h) {
          return '<label data-txt="' + esc(norm(h.semillero + ' ' + h.hibrido)) + '"><input type="checkbox" value="' + h.id + '"' +
            (f.ids.indexOf(h.id) >= 0 ? ' checked' : '') + '>' + esc(h.semillero + ' · ' + h.hibrido) +
            (f.grano ? '' : ' <small>(' + esc(h.grano) + ')</small>') + '</label>';
        }).join('') : '<span class="ayuda">No hay híbridos.</span>') + '</div>' +
        '<div class="barra" style="margin:6px 0 0"><button type="button" class="mini" data-f="ninguno">Desmarcar todos</button></div>';
    });
  }

  document.addEventListener('change', function (e) {
    var p = e.target.closest('.panel-filtros');
    if (!p) return;
    var f = filtros[p.dataset.reporte];
    if (e.target.dataset.f === 'grano') {
      f.grano = e.target.value;
      f.ids = f.ids.filter(function (id) { var h = hibrido(id); return h && (!f.grano || h.grano === f.grano); });
      renderPanelesFiltro();
    } else if (e.target.dataset.f === 'banda') {
      f.banda = e.target.value;
    } else if (e.target.type === 'checkbox') {
      var id = e.target.value;
      f.ids = f.ids.filter(function (x) { return x !== id; });
      if (e.target.checked) f.ids.push(id);
    }
  });

  document.addEventListener('input', function (e) {
    if (e.target.dataset.f !== 'busca') return;
    var q = norm(e.target.value);
    var p = e.target.closest('.panel-filtros');
    $$('.lista-checks label', p).forEach(function (l) {
      l.style.display = !q || l.dataset.txt.indexOf(q) >= 0 ? '' : 'none';
    });
  });

  document.addEventListener('click', function (e) {
    if (e.target.dataset.f !== 'ninguno') return;
    var p = e.target.closest('.panel-filtros');
    filtros[p.dataset.reporte].ids = [];
    renderPanelesFiltro();
  });

  function hibridosFiltrados(f) {
    return ordenarHibridos(db.hibridos).filter(function (h) {
      return (!f.grano || h.grano === f.grano) && (!f.ids.length || f.ids.indexOf(h.id) >= 0);
    });
  }

  function descripcionFiltro(f) {
    var partes = [f.grano ? 'Grano: ' + f.grano : 'Todos los granos'];
    partes.push(f.banda ? f.banda : 'Todas las bandas');
    if (f.ids.length) partes.push(f.ids.length + ' híbridos seleccionados');
    return partes.join(' · ') + ' · Generado el ' + fechaTxt(hoy());
  }

  // ---------- Posición comercial ----------
  var COLS_POS = ['Exist. inicial', 'Compras', 'Pedidos', 'Consignada', 'Total ingresado', 'Ventas', 'Reservas', 'Pedidos clientes',
    'Devoluciones', 'Total salidas', 'Saldo', 'Saldo a remitir'];
  var COL_SALDO = 10;
  var datosPosicion = null;

  function calcularPosicion() {
    var f = filtros.posicion;
    var filas = [];
    hibridosFiltrados(f).forEach(function (h) {
      var movs = db.movimientos.filter(function (m) { return m.hibridoId === h.id && (!f.banda || m.banda === f.banda); });
      var bandas = BANDAS.filter(function (b) { return movs.some(function (m) { return m.banda === b; }); });
      if (!bandas.length) bandas = [f.banda || '—'];
      bandas.forEach(function (b) {
        var ms = movs.filter(function (m) { return m.banda === b; });
        // Un pedido que ya tiene remito o factura se cuenta como venta.
        var tipoPos = function (m) {
          var g = m.tipo === 'Pedido de cliente' ? grupoDe(m) : null;
          return g && (g.REM || g.FAC) ? 'Venta' : m.tipo;
        };
        var sum = function (clase, tipo) {
          return ms.filter(function (m) { return m.clase === clase && tipoPos(m) === tipo; }).reduce(function (s, m) { return s + efecto(m); }, 0);
        };
        var v = [sum('ingreso', 'Existencia inicial campaña'), sum('ingreso', 'Compra'), sum('ingreso', 'Pedido'), sum('ingreso', 'Mercadería consignada')];
        var ingr = v[0] + v[1] + v[2] + v[3];
        var ven = sum('salida', 'Venta'), res = sum('salida', 'Reserva'), ped = sum('salida', 'Pedido de cliente'), dev = sum('ingreso', DEVOL);
        var sal = ven + res + ped - dev;
        var arem = ms.reduce(function (s, m) { var a = aRemitir(m); return s + (a > 0 ? a : 0); }, 0);
        filas.push({ h: h, banda: b, v: v.concat([ingr, ven, res, ped, dev, sal, ingr - sal, arem]) });
      });
    });
    return filas;
  }

  function sumar(filas) {
    return COLS_POS.map(function (_, i) { return filas.reduce(function (s, f) { return s + f.v[i]; }, 0); });
  }

  $('#gen-posicion').addEventListener('click', function () {
    var filas = calcularPosicion();
    datosPosicion = filas;
    var out = $('#out-posicion');
    if (!filas.length) { out.innerHTML = '<p class="vacio">No hay híbridos para ese filtro.</p>'; return; }
    var cab = '<thead><tr><th>Semillero</th><th>Híbrido</th><th>Banda</th>' +
      COLS_POS.map(function (c) { return '<th class="num">' + c + '</th>'; }).join('') + '</tr></thead>';
    var celdas = function (v) {
      return v.map(function (n, i) { return '<td class="num' + (i === COL_SALDO && n < 0 ? ' neg' : '') + '">' + num(n) + '</td>'; }).join('');
    };
    var html = '<p class="meta">' + esc(descripcionFiltro(filtros.posicion)) + ' · Cantidades en bolsas</p>';
    GRANOS.forEach(function (g) {
      var fg = filas.filter(function (f) { return f.h.grano === g; });
      if (!fg.length) return;
      html += '<h4>' + esc(g) + '</h4><div class="tabla-cont"><table>' + cab + '<tbody>' +
        fg.map(function (f) {
          return '<tr><td>' + esc(f.h.semillero) + '</td><td><b>' + esc(f.h.hibrido) + '</b></td><td>' + esc(f.banda) + '</td>' + celdas(f.v) + '</tr>';
        }).join('') +
        '<tr class="total"><td colspan="3">Total ' + esc(g) + '</td>' + celdas(sumar(fg)) + '</tr></tbody></table></div>';
    });
    out.innerHTML = html;
  });

  $('#xls-posicion').addEventListener('click', function () {
    var filas = datosPosicion || calcularPosicion();
    if (!filas.length) { aviso('No hay datos para exportar.', true); return; }
    var aoa = [['Posición comercial — MORERO Semillas y Cereales S.A.'], [descripcionFiltro(filtros.posicion)], [],
      ['Grano', 'Semillero', 'Híbrido', 'Banda'].concat(COLS_POS)];
    GRANOS.forEach(function (g) {
      var fg = filas.filter(function (f) { return f.h.grano === g; });
      if (!fg.length) return;
      fg.forEach(function (f) { aoa.push([g, f.h.semillero, f.h.hibrido, f.banda].concat(f.v)); });
      aoa.push(['Total ' + g, '', '', ''].concat(sumar(fg)));
    });
    bajarExcel('posicion-comercial-' + hoy() + '.xlsx', [{ nombre: 'Posición comercial', filas: aoa }]);
  });

  // ---------- Reporte de stock (ficha) ----------
  var datosFicha = null;

  function calcularFichas() {
    var f = filtros.reporte;
    return hibridosFiltrados(f).map(function (h) {
      var saldo = 0;
      var movs = db.movimientos.filter(function (m) { return m.hibridoId === h.id && (!f.banda || m.banda === f.banda); })
        .sort(function (a, b) { return (a.fecha || '').localeCompare(b.fecha || '') || (a.creado || 0) - (b.creado || 0); })
        .map(function (m) {
          var ing = m.clase === 'ingreso' ? efecto(m) : 0;
          var sal = m.clase === 'salida' ? efecto(m) : 0;
          saldo += ing - sal;
          var c = cliente(m.clienteId);
          var notas = [textoVinculo(m)], ar = aRemitir(m);
          if (ar != null) notas.push('Saldo a remitir: ' + num(ar) + ' bls.');
          return {
            m: m, quien: m.clienteId ? (c ? c.nombre : '(cliente borrado)') : h.semillero, ing: ing, sal: sal, saldo: saldo,
            nota: notas.filter(Boolean).join(' · ')
          };
        });
      var porBanda = BANDAS.map(function (b) {
        var ms = movs.filter(function (x) { return x.m.banda === b; });
        return { banda: b, hay: ms.length > 0, saldo: ms.reduce(function (s, x) { return s + x.ing - x.sal; }, 0) };
      }).filter(function (x) { return x.hay; });
      return { h: h, movs: movs, saldo: saldo, porBanda: porBanda };
    });
  }

  $('#gen-reporte').addEventListener('click', function () {
    var fichas = calcularFichas();
    datosFicha = fichas;
    var out = $('#out-reporte');
    if (!fichas.length) { out.innerHTML = '<p class="vacio">No hay híbridos para ese filtro.</p>'; return; }
    var html = '<p class="meta">' + esc(descripcionFiltro(filtros.reporte)) + ' · Cantidades en bolsas</p>';
    var totalGeneral = 0;
    GRANOS.forEach(function (g) {
      var fg = fichas.filter(function (x) { return x.h.grano === g; });
      if (!fg.length) return;
      var totalGrano = 0;
      fg.forEach(function (x) {
        totalGrano += x.saldo;
        html += '<div class="ficha"><h4>' + esc(g + ' · ' + x.h.semillero + ' · ' + x.h.hibrido) + '</h4>';
        if (!x.movs.length) {
          html += '<p class="vacio">Sin operaciones.</p>';
        } else {
          html += '<div class="tabla-cont"><table><thead><tr><th>Fecha</th><th>Operación</th><th>Proveedor / Cliente</th><th>Banda</th>' +
            '<th class="num">Ingreso</th><th class="num">Salida</th><th class="num">Saldo</th><th class="num">Precio</th><th>Comprob.</th><th>Obs.</th></tr></thead><tbody>' +
            x.movs.map(function (r) {
              return '<tr><td>' + fechaTxt(r.m.fecha) + '</td><td><span class="etq ' + (r.m.clase === 'ingreso' ? 'in' : 'out') + '">' + esc(r.m.tipo) + '</span>' +
                (r.m.doc ? ' <small>' + esc(r.m.doc) + '</small>' : '') + '</td>' +
                '<td>' + esc(r.quien) + '</td><td>' + esc(r.m.banda) + '</td>' +
                '<td class="num">' + (r.m.clase === 'ingreso' ? num(r.ing) : '') + '</td><td class="num">' + (r.m.clase === 'salida' ? num(r.sal) : '') + '</td>' +
                '<td class="num' + (r.saldo < 0 ? ' neg' : '') + '">' + num(r.saldo) + '</td><td class="num">' + precioTxt(r.m) + '</td>' +
                '<td>' + esc(r.m.comprobante) + '</td><td>' + (r.nota ? '<small class="vinc">' + esc(r.nota) + '</small><br>' : '') + esc(r.m.obs) + '</td></tr>';
            }).join('') +
            '<tr class="total"><td colspan="4">Stock final</td><td class="num">' + num(x.movs.reduce(function (s, r) { return s + r.ing; }, 0)) +
            '</td><td class="num">' + num(x.movs.reduce(function (s, r) { return s + r.sal; }, 0)) +
            '</td><td class="num">' + num(x.saldo) + '</td><td colspan="3"></td></tr></tbody></table></div>';
          if (x.porBanda.length > 1) {
            html += '<div class="pie-ficha">Stock por banda: ' + x.porBanda.map(function (b) {
              return esc(b.banda) + ': <b>' + num(b.saldo) + '</b>';
            }).join(' · ') + '</div>';
          }
        }
        html += '</div>';
      });
      totalGeneral += totalGrano;
      html += '<div class="tabla-cont" style="margin-bottom:18px"><table><tbody><tr class="total"><td>Stock final ' + esc(g) +
        '</td><td class="num">' + num(totalGrano) + ' bolsas</td></tr></tbody></table></div>';
    });
    out.innerHTML = html;
  });

  $('#xls-reporte').addEventListener('click', function () {
    var fichas = datosFicha || calcularFichas();
    if (!fichas.length) { aviso('No hay datos para exportar.', true); return; }
    var aoa = [['Reporte de stock — MORERO Semillas y Cereales S.A.'], [descripcionFiltro(filtros.reporte)], [],
      ['Grano', 'Semillero', 'Híbrido', 'Fecha', 'Operación', 'Proveedor / Cliente', 'Banda', 'Ingreso', 'Salida', 'Saldo', 'Precio', 'Moneda', 'Comprobante', 'Vínculo / saldo a remitir', 'Observaciones']];
    fichas.forEach(function (x) {
      x.movs.forEach(function (r) {
        aoa.push([x.h.grano, x.h.semillero, x.h.hibrido, fechaTxt(r.m.fecha), r.m.tipo + (r.m.doc ? ' ' + r.m.doc : ''), r.quien, r.m.banda,
          r.m.clase === 'ingreso' ? r.ing : '', r.m.clase === 'salida' ? r.sal : '', r.saldo, r.m.precio == null ? '' : r.m.precio, r.m.precio == null ? '' : (r.m.moneda === 'ARS' ? '$' : 'US$'),
          r.m.comprobante || '', r.nota, r.m.obs || '']);
      });
      aoa.push([x.h.grano, x.h.semillero, x.h.hibrido, '', 'STOCK FINAL', '', '', '', '', x.saldo]);
      aoa.push([]);
    });
    bajarExcel('reporte-stock-' + hoy() + '.xlsx', [{ nombre: 'Reporte de stock', filas: aoa }]);
  });

  // ---------- Imprimir / PDF ----------
  $$('[data-imprimir]').forEach(function (b) {
    b.addEventListener('click', function () {
      var r = b.dataset.imprimir;
      $('#gen-' + r).click();
      var sec = $('#sec-' + r);
      $('#titulo-impresion').textContent = r === 'posicion' ? 'Posición comercial' : 'Reporte de stock';
      $('#fecha-impresion').textContent = descripcionFiltro(filtros[r]);
      sec.classList.add('imprimir');
      window.print();
      sec.classList.remove('imprimir');
    });
  });

  // ---------- Copia de seguridad ----------
  function infoCopia() {
    $('#info-copia').textContent = 'Datos actuales: ' + db.hibridos.length + ' híbridos, ' + db.clientes.length +
      ' clientes y ' + db.movimientos.length + ' operaciones.';
  }

  $('#btn-bajar-copia').addEventListener('click', function () {
    var blob = new Blob([JSON.stringify({ app: 'morero-stock', version: 1, fecha: new Date().toISOString(), datos: db }, null, 1)],
      { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'copia-stock-morero-' + hoy() + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    aviso('Copia descargada.');
  });

  $('#subir-copia').addEventListener('change', function (e) {
    var archivo = e.target.files[0];
    e.target.value = '';
    if (!archivo) return;
    var r = new FileReader();
    r.onload = function () {
      try {
        var d = JSON.parse(r.result);
        var datos = d.datos || d;
        if (!Array.isArray(datos.hibridos) || !Array.isArray(datos.clientes) || !Array.isArray(datos.movimientos)) throw new Error();
        if (!confirm('Esto reemplaza TODOS los datos actuales por los de la copia (' + datos.hibridos.length + ' híbridos, ' +
          datos.clientes.length + ' clientes, ' + datos.movimientos.length + ' operaciones). ¿Continuar?')) return;
        db = { hibridos: datos.hibridos, clientes: datos.clientes, movimientos: datos.movimientos };
        guardar();
        refrescar();
        infoCopia();
        aviso('Copia restaurada.');
      } catch (err) {
        aviso('El archivo no es una copia de seguridad válida.', true);
      }
    };
    r.readAsText(archivo);
  });

  refrescar();
})();
