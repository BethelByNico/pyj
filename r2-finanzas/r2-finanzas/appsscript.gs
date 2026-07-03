/**
 * ============================================================
 *  R2 FINANZAS — API (Google Apps Script + Google Sheets)
 * ============================================================
 *  Actúa como backend/API para la PWA "R2 FINANZAS".
 *  Almacena toda la información en Google Sheets y expone
 *  endpoints GET/POST que la aplicación consume vía fetch.
 *
 *  DESPLIEGUE:
 *   1. Abra su hoja de Google Sheets.
 *   2. Menú Extensiones -> Apps Script.
 *   3. Pegue este archivo completo.
 *   4. Ejecute una vez la función  setup()  (crea las hojas).
 *   5. Implementar -> Nueva implementación -> App web.
 *        Ejecutar como:  Yo (su cuenta)
 *        Quién tiene acceso:  Cualquier persona
 *   6. Copie la URL /exec y péguela en script.js (API_URL).
 * ============================================================
 */

// Debe coincidir con la contraseña de la app (capa extra opcional).
var APP_TOKEN = '185463';

// Definición de hojas y sus columnas. La primera columna siempre es "id".
var SCHEMA = {
  Configuracion: ['id', 'clave', 'valor'],
  Salarios:      ['id', 'mes', 'usuario', 'salario', 'cuenta', 'fecha'],
  Gastos:        ['id', 'fecha', 'usuario', 'categoria', 'descripcion', 'valor', 'cuenta', 'metodo', 'observaciones', 'deudaId'],
  Transferencias:['id', 'fecha', 'usuario', 'origen', 'destino', 'valor', 'tipo', 'descripcion'],
  Ahorros:       ['id', 'fecha', 'usuario', 'valor', 'tipo'],
  Servicios:     ['id', 'servicio', 'valor', 'fechaLimite', 'estado', 'usuarioPago', 'cuenta', 'fechaPago'],
  Metas:         ['id', 'meta', 'objetivo', 'acumulado', 'fecha'],
  SaldosIniciales:['id', 'usuario', 'cuenta', 'valor'],
  Deudas:        ['id', 'usuario', 'entidad', 'descripcion', 'valorInicial', 'cuota', 'diaPago', 'fecha', 'estado']
};

/** Crea todas las hojas con sus encabezados (idempotente). */
function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SCHEMA).forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    var headers = SCHEMA[name];
    var lastCol = Math.max(1, sh.getLastColumn());
    var firstRow = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    var empty = firstRow.every(function (c) { return c === '' || c === null; });
    if (empty) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]);
      sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      sh.setFrozenRows(1);
    } else {
      // Agrega columnas nuevas del esquema sin borrar datos existentes
      headers.forEach(function (h) {
        if (firstRow.indexOf(h) === -1) {
          var col = sh.getLastColumn() + 1;
          sh.getRange(1, col).setValue(h).setFontWeight('bold');
          firstRow.push(h);
        }
      });
    }
  });
  // Elimina la hoja por defecto vacía si existe
  var def = ss.getSheetByName('Hoja 1') || ss.getSheetByName('Sheet1');
  if (def && ss.getSheets().length > 1) { try { ss.deleteSheet(def); } catch (e) {} }
  return 'Hojas creadas correctamente.';
}

/* ---------------------- Helpers ---------------------- */

function _sheet(name) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) { setup(); sh = ss.getSheetByName(name); }
  return sh;
}

function _read(name) {
  var sh = _sheet(name);
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  var rows = [];
  for (var r = 1; r < values.length; r++) {
    var obj = {};
    var hasData = false;
    for (var c = 0; c < headers.length; c++) {
      obj[headers[c]] = values[r][c];
      if (values[r][c] !== '' && values[r][c] !== null) hasData = true;
    }
    if (hasData) rows.push(obj);
  }
  return rows;
}

function _newId() {
  return 'id' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
}

function _append(name, record) {
  var sh = _sheet(name);
  // Mapea por los encabezados reales de la hoja (robusto a orden/columnas nuevas)
  var headers = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0];
  if (!headers.join('')) { headers = SCHEMA[name]; sh.getRange(1, 1, 1, headers.length).setValues([headers]); }
  if (!record.id) record.id = _newId();
  var row = headers.map(function (h) { return record[h] !== undefined ? record[h] : ''; });
  sh.appendRow(row);
  return record;
}

function _update(name, id, patch) {
  var sh = _sheet(name);
  var data = sh.getDataRange().getValues();
  var headers = data[0];
  var idCol = headers.indexOf('id');
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][idCol]) === String(id)) {
      headers.forEach(function (h, c) {
        if (patch[h] !== undefined) data[r][c] = patch[h];
      });
      sh.getRange(r + 1, 1, 1, headers.length).setValues([data[r]]);
      var obj = {}; headers.forEach(function (h, c) { obj[h] = data[r][c]; });
      return obj;
    }
  }
  return null;
}

function _delete(name, id) {
  var sh = _sheet(name);
  var data = sh.getDataRange().getValues();
  var headers = data[0];
  var idCol = headers.indexOf('id');
  for (var r = data.length - 1; r >= 1; r--) {
    if (String(data[r][idCol]) === String(id)) {
      sh.deleteRow(r + 1);
      return true;
    }
  }
  return false;
}

function _json(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function _all() {
  var out = {};
  Object.keys(SCHEMA).forEach(function (name) { out[name] = _read(name); });
  return out;
}

/* ---------------------- Endpoints ---------------------- */

function doGet(e) {
  try {
    var action = (e && e.parameter && e.parameter.action) || 'getAll';
    if (action === 'ping') return _json({ ok: true, service: 'R2 FINANZAS API' });
    if (action === 'getAll') return _json({ ok: true, data: _all() });
    return _json({ ok: false, error: 'Acción GET no reconocida' });
  } catch (err) {
    return _json({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  try {
    var body = {};
    if (e && e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }
    if (APP_TOKEN && body.token !== APP_TOKEN) {
      return _json({ ok: false, error: 'No autorizado' });
    }
    var action = body.action;
    var sheet = body.sheet;

    switch (action) {
      case 'getAll':
        return _json({ ok: true, data: _all() });

      case 'add':
        return _json({ ok: true, record: _append(sheet, body.record || {}) });

      case 'update':
        return _json({ ok: true, record: _update(sheet, body.id, body.record || {}) });

      case 'delete':
        return _json({ ok: true, deleted: _delete(sheet, body.id) });

      case 'bulk':
        // body.ops = [{op:'add'|'update'|'delete', sheet, id?, record?}]
        var results = (body.ops || []).map(function (o) {
          if (o.op === 'add') return _append(o.sheet, o.record || {});
          if (o.op === 'update') return _update(o.sheet, o.id, o.record || {});
          if (o.op === 'delete') return _delete(o.sheet, o.id);
        });
        return _json({ ok: true, results: results, data: _all() });

      case 'setConfig':
        var cfg = _read('Configuracion');
        var found = cfg.filter(function (c) { return c.clave === body.key; })[0];
        if (found) _update('Configuracion', found.id, { valor: body.value });
        else _append('Configuracion', { clave: body.key, valor: body.value });
        return _json({ ok: true });

      default:
        return _json({ ok: false, error: 'Acción no reconocida: ' + action });
    }
  } catch (err) {
    return _json({ ok: false, error: String(err) });
  }
}
