/* Stock de Semillas · MORERO Semillas y Cereales S.A.
   Todo se guarda en el navegador (localStorage). No hay servidor. */
(function () {
  'use strict';

  var CLAVE = 'morero_stock_v1';
  var GRANOS = ['Girasol', 'Maíz', 'Sorgo'];
  var BANDAS = ['Banda 1', 'Banda 2', 'Banda 3', 'Sin banda'];
  var TIPOS_INGRESO = ['Existencia inicial campaña', 'Compra', 'Pedido', 'Mercadería consignada'];
  var TIPOS_SALIDA = ['Venta', 'Reserva'];

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

  // Stock de un híbrido (opcionalmente de una banda). Ingresos suman, salidas restan.
  function stock(hibridoId, banda, excluirId) {
    return db.movimientos.reduce(function (s, m) {
      if (m.hibridoId !== hibridoId) return s;
      if (banda && m.banda !== banda) return s;
      if (excluirId && m.id === excluirId) return s;
      return s + (m.clase === 'ingreso' ? 1 : -1) * Number(m.cantidad || 0);
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
  function leerExcel(archivo, listo) {
    if (typeof XLSX === 'undefined') { aviso('No se pudo cargar el lector de Excel.', true); return; }
    var r = new FileReader();
    r.onload = function () {
      try {
        var libro = XLSX.read(new Uint8Array(r.result), { type: 'array' });
        var hoja = libro.Sheets[libro.SheetNames[0]];
        var filas = XLSX.utils.sheet_to_json(hoja, { header: 1, defval: '', raw: false });
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
    var todos = db.movimientos.filter(function (m) { return m.clase === clase; });
    if (!todos.length) {
      t.innerHTML = '<tr><td class="vacio">' + (ing ? 'Todavía no hay compras cargadas.' : 'Todavía no hay ventas ni reservas cargadas.') + '</td></tr>';
      return;
    }
    var lista = todos.filter(function (m) {
      var h = hibrido(m.hibridoId), c = cliente(m.clienteId);
      var texto = nombreHibrido(h) + ' ' + (c ? c.nombre : '') + ' ' + (m.obs || '') + ' ' + (m.comprobante || '');
      return (!tipo || m.tipo === tipo) && (!q || norm(texto).indexOf(q) >= 0);
    }).sort(function (a, b) { return (b.fecha || '').localeCompare(a.fecha || '') || (b.creado || 0) - (a.creado || 0); });

    var cab = '<thead><tr><th>Fecha</th><th>Tipo</th>' + (ing ? '' : '<th>Cliente</th>') +
      '<th>Grano</th><th>Semillero</th><th>Híbrido</th><th>Banda</th><th class="num">Bolsas</th><th class="num">Precio</th><th>Comprob.</th><th>Obs.</th><th class="acc"></th></tr></thead>';
    var cols = ing ? 11 : 12;
    t.innerHTML = cab + '<tbody>' + (lista.length ? lista.map(function (m) {
      var h = hibrido(m.hibridoId) || {}, c = cliente(m.clienteId);
      return '<tr><td>' + fechaTxt(m.fecha) + '</td><td><span class="etq ' + (ing ? 'in' : 'out') + '">' + esc(m.tipo) + '</span></td>' +
        (ing ? '' : '<td>' + esc(c ? c.nombre : '(cliente borrado)') + '</td>') +
        '<td>' + esc(h.grano) + '</td><td>' + esc(h.semillero) + '</td><td><b>' + esc(h.hibrido) + '</b></td><td>' + esc(m.banda) + '</td>' +
        '<td class="num">' + num(m.cantidad) + '</td><td class="num">' + precioTxt(m) + '</td><td>' + esc(m.comprobante) + '</td><td>' + esc(m.obs) + '</td>' +
        '<td class="acc"><button class="mini" data-edit-m="' + m.id + '">Editar</button> ' +
        '<button class="mini borrar" data-del-m="' + m.id + '">Borrar</button></td></tr>';
    }).join('') : '<tr><td colspan="' + cols + '" class="vacio">No hay coincidencias.</td></tr>') + '</tbody>';
  }

  ['compras', 'ventas'].forEach(function (s) {
    var clase = s === 'compras' ? 'ingreso' : 'salida';
    $('#busca-' + s).addEventListener('input', function () { renderMovs(clase); });
    $('#tipo-' + s).addEventListener('change', function () { renderMovs(clase); });
    $('#tabla-' + s).addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      var m = db.movimientos.find(function (x) { return x.id === (b.dataset.editM || b.dataset.delM); });
      if (!m) return;
      if (b.dataset.editM) abrirMov(m.clase, m);
      if (b.dataset.delM) {
        if (!confirm('¿Borrar esta operación (' + m.tipo + ' de ' + num(m.cantidad) + ' bolsas de ' + nombreHibrido(hibrido(m.hibridoId)) + ')?')) return;
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
    $('#tit-mov').textContent = (m ? 'Editar ' : 'Cargar ') + (ing ? 'compra / ingreso' : 'venta o reserva');
    $('#bloque-cliente').style.display = ing ? 'none' : '';
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
    if (fMov.clase.value === 'salida' && banda && Number(fMov.cantidad.value) > disp) {
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
    if (!ing && !fMov.clienteId.value) { e.preventDefault(); aviso('Elegí un cliente.', true); return; }
    if (!fMov.hibridoId.value) { e.preventDefault(); aviso('Elegí un híbrido.', true); return; }
    var cant = Number(fMov.cantidad.value);
    if (!(cant > 0)) { e.preventDefault(); aviso('La cantidad debe ser mayor a cero.', true); return; }
    if (!ing) {
      var disp = stock(fMov.hibridoId.value, fMov.banda.value, fMov.uid.value);
      if (cant > disp && !confirm('Hay ' + num(disp) + ' bolsas en stock en ' + fMov.banda.value + ' y querés descontar ' + num(cant) + '.\n¿Guardar igual?')) {
        e.preventDefault();
        return;
      }
    }
    var datos = {
      clase: fMov.clase.value,
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
      aviso(ing ? 'Ingreso cargado: suma ' + num(cant) + ' bolsas.' : datos.tipo + ' cargada: descuenta ' + num(cant) + ' bolsas.');
    }
    guardar();
    refrescar();
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
  var COLS_POS = ['Exist. inicial', 'Compras', 'Pedidos', 'Consignada', 'Total ingresado', 'Ventas', 'Reservas', 'Total salidas', 'Saldo'];
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
        var sum = function (tipo) {
          return ms.filter(function (m) { return m.tipo === tipo; }).reduce(function (s, m) { return s + Number(m.cantidad); }, 0);
        };
        var v = [sum('Existencia inicial campaña'), sum('Compra'), sum('Pedido'), sum('Mercadería consignada')];
        var ingr = v[0] + v[1] + v[2] + v[3];
        var ven = sum('Venta'), res = sum('Reserva');
        filas.push({ h: h, banda: b, v: v.concat([ingr, ven, res, ven + res, ingr - ven - res]) });
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
      return v.map(function (n, i) { return '<td class="num' + (i === 8 && n < 0 ? ' neg' : '') + '">' + num(n) + '</td>'; }).join('');
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
          var ing = m.clase === 'ingreso' ? Number(m.cantidad) : 0;
          var sal = m.clase === 'salida' ? Number(m.cantidad) : 0;
          saldo += ing - sal;
          var c = cliente(m.clienteId);
          return { m: m, quien: m.clase === 'ingreso' ? h.semillero : (c ? c.nombre : '(cliente borrado)'), ing: ing, sal: sal, saldo: saldo };
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
              return '<tr><td>' + fechaTxt(r.m.fecha) + '</td><td><span class="etq ' + (r.ing ? 'in' : 'out') + '">' + esc(r.m.tipo) + '</span></td>' +
                '<td>' + esc(r.quien) + '</td><td>' + esc(r.m.banda) + '</td>' +
                '<td class="num">' + (r.ing ? num(r.ing) : '') + '</td><td class="num">' + (r.sal ? num(r.sal) : '') + '</td>' +
                '<td class="num' + (r.saldo < 0 ? ' neg' : '') + '">' + num(r.saldo) + '</td><td class="num">' + precioTxt(r.m) + '</td>' +
                '<td>' + esc(r.m.comprobante) + '</td><td>' + esc(r.m.obs) + '</td></tr>';
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
      ['Grano', 'Semillero', 'Híbrido', 'Fecha', 'Operación', 'Proveedor / Cliente', 'Banda', 'Ingreso', 'Salida', 'Saldo', 'Precio', 'Moneda', 'Comprobante', 'Observaciones']];
    fichas.forEach(function (x) {
      x.movs.forEach(function (r) {
        aoa.push([x.h.grano, x.h.semillero, x.h.hibrido, fechaTxt(r.m.fecha), r.m.tipo, r.quien, r.m.banda,
          r.ing || '', r.sal || '', r.saldo, r.m.precio == null ? '' : r.m.precio, r.m.precio == null ? '' : (r.m.moneda === 'ARS' ? '$' : 'US$'),
          r.m.comprobante || '', r.m.obs || '']);
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
