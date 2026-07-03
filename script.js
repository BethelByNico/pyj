/* =====================================================================
   R2 FINANZAS — Aplicación (Vanilla JS ES6+)
   Offline-first: guarda en el dispositivo y sincroniza con Google Sheets.
   ===================================================================== */
'use strict';

/* ------------------------------------------------------------------ *
 * 1. CONFIGURACIÓN
 * ------------------------------------------------------------------ */
const CONFIG = {
  // ⚠️ Pegue aquí la URL /exec de su Google Apps Script (ver README).
  // Si se deja vacío, la app funciona 100% local en este dispositivo.
  API_URL: 'https://script.google.com/macros/s/AKfycbzxhVaidRG1ABH_jFunGSqCbBrHv89WxTm6IS_APQZ-zLgtXDC3A1rBBnOd8MMfRySE0Q/exec',
  PASSWORD: '185463',
  USERS: ['Julieth', 'Felipe'],
  ANT_THRESHOLD: 20000,          // umbral "gasto hormiga" (COP)
};

const ACCOUNTS = [
  { id: 'Davivienda', emoji: '🏦', color: '#e11d48', tipo: 'banco' },
  { id: 'Lulo Bank',  emoji: '🪙', color: '#f59e0b', tipo: 'banco' },
  { id: 'Nequi',      emoji: '💜', color: '#8b5cf6', tipo: 'banco' },
  { id: 'Daviplata',  emoji: '💙', color: '#2563eb', tipo: 'banco' },
  { id: 'Efectivo',   emoji: '💵', color: '#10b981', tipo: 'efectivo' },
];

const METHODS = ['Transferencia', 'Tarjeta Débito', 'Tarjeta Crédito', 'PSE', 'Efectivo', 'Otro'];

const CATEGORIES = [
  { id: 'Arriendo',             emoji: '🏠', color: '#f43f5e', fijo: true },
  { id: 'Mercado',              emoji: '🛒', color: '#10b981', fijo: false },
  { id: 'Agua',                 emoji: '💧', color: '#38bdf8', fijo: true },
  { id: 'Luz',                  emoji: '⚡', color: '#f59e0b', fijo: true },
  { id: 'Gas',                  emoji: '🔥', color: '#fb923c', fijo: true },
  { id: 'Teléfono Julieth',     emoji: '📱', color: '#a855f7', fijo: true },
  { id: 'ICETEX',               emoji: '🎓', color: '#6366f1', fijo: true },
  { id: 'Addi',                 emoji: '💳', color: '#ec4899', fijo: true },
  { id: 'Sistecrédito',         emoji: '💳', color: '#14b8a6', fijo: true },
  { id: 'Colegio Gaviota',      emoji: '🏫', color: '#0ea5e9', fijo: true },
  { id: 'Préstamos Davivienda', emoji: '🏦', color: '#ef4444', fijo: true },
  { id: 'Aportes en Línea',     emoji: '💼', color: '#22c55e', fijo: true },
  { id: 'Otros gastos',         emoji: '🧾', color: '#94a3b8', fijo: false },
];

const SERVICES_CATALOG = [
  { name: 'Arriendo',             portal: null, reminder: true },
  { name: 'Agua',                 portal: 'https://similpay.com/#/biller_code/18500' },
  { name: 'Luz',                  portal: 'https://enel.com.co/es/AccessMyEnel.html' },
  { name: 'Gas',                  portal: 'https://pagosenlinea.grupovanti.com/' },
  { name: 'ICETEX',               portal: 'https://aplicaciones.icetex.gov.co/LoginPortalTransaccionalFront/login' },
  { name: 'Addi',                 portal: 'https://clientes.addi.com/login' },
  { name: 'Sistecrédito',         portal: 'https://payonline-web.sistecredito.com/' },
  { name: 'Aportes en Línea',     portal: 'https://independientes.aportesenlinea.com/Portal/Paginas/DashBoard.aspx' },
  { name: 'Colegio Gaviota',      portal: null, reminder: true },
  { name: 'Préstamos Davivienda', portal: null, reminder: true },
];

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MESES_LARGO = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const SHEETS = ['Salarios','Gastos','Transferencias','Ahorros','Servicios','Metas','SaldosIniciales','Configuracion','Deudas'];

// Entidades sugeridas para deudas/créditos (se puede escribir cualquier otra)
const DEBT_ENTITIES = ['ICETEX','Addi','Sistecrédito','Préstamos Davivienda','Davivienda','Lulo Bank','Nequi','Tarjeta de crédito','Banco de Bogotá','Bancolombia','Falabella','Codensa','Otra entidad'];

/* ------------------------------------------------------------------ *
 * 2. ESTADO + PERSISTENCIA
 * ------------------------------------------------------------------ */
const LS = {
  auth: 'r2_auth', theme: 'r2_theme', scope: 'r2_scope',
  data: 'r2_data', queue: 'r2_queue',
};

const state = {
  scope: localStorage.getItem(LS.scope) || 'familia',
  route: 'inicio',
  data: emptyData(),
  queue: [],
  charts: {},
};

function emptyData() {
  const d = {}; SHEETS.forEach(s => d[s] = []); return d;
}
function loadCache() {
  try { const d = JSON.parse(localStorage.getItem(LS.data)); if (d) state.data = Object.assign(emptyData(), d); } catch (e) {}
  try { state.queue = JSON.parse(localStorage.getItem(LS.queue)) || []; } catch (e) { state.queue = []; }
}
function saveCache() {
  localStorage.setItem(LS.data, JSON.stringify(state.data));
  localStorage.setItem(LS.queue, JSON.stringify(state.queue));
}

/* ------------------------------------------------------------------ *
 * 3. API (Google Apps Script) con cola de sincronización
 * ------------------------------------------------------------------ */
const API = {
  configured() { return !!CONFIG.API_URL; },

  async pull() {
    if (!API.configured()) return;
    setSync('Sincronizando…');
    try {
      const res = await fetch(CONFIG.API_URL + '?action=getAll', { method: 'GET' });
      const json = await res.json();
      if (json && json.ok && json.data) {
        state.data = Object.assign(emptyData(), json.data);
        saveCache();
        setSync('Sincronizado con Google Sheets', 'ok');
      } else { setSync('Usando datos locales', 'err'); }
    } catch (e) { setSync('Sin conexión · datos locales', 'err'); }
  },

  enqueue(op) { state.queue.push(op); saveCache(); API.flush(); },

  async flush() {
    if (!API.configured() || !state.queue.length) return;
    const ops = state.queue.slice();
    try {
      const res = await fetch(CONFIG.API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // evita preflight CORS
        body: JSON.stringify({ token: CONFIG.PASSWORD, action: 'bulk', ops }),
      });
      const json = await res.json();
      if (json && json.ok) {
        state.queue = [];
        if (json.data) state.data = Object.assign(emptyData(), json.data);
        saveCache();
        setSync('Sincronizado', 'ok');
      } else { setSync('Pendiente de sincronizar', 'err'); }
    } catch (e) { setSync('Sin conexión · se sincronizará luego', 'err'); }
  },
};

function setSync(msg, kind) {
  const bar = $('#syncBar');
  if (!API.configured()) { bar.hidden = true; return; }
  bar.hidden = false; bar.textContent = msg;
  bar.className = 'sync-bar' + (kind ? ' ' + kind : '');
  if (kind === 'ok') setTimeout(() => { bar.hidden = true; }, 2500);
}

/* Mutaciones (optimistas: aplican local + encolan) */
function addRecord(sheet, record) {
  if (!record.id) record.id = genId();
  state.data[sheet].push(record);
  saveCache();
  API.enqueue({ op: 'add', sheet, record });
  return record;
}
function updateRecord(sheet, id, patch) {
  const r = state.data[sheet].find(x => String(x.id) === String(id));
  if (r) Object.assign(r, patch);
  saveCache();
  API.enqueue({ op: 'update', sheet, id, record: patch });
}
function deleteRecord(sheet, id) {
  state.data[sheet] = state.data[sheet].filter(x => String(x.id) !== String(id));
  saveCache();
  API.enqueue({ op: 'delete', sheet, id });
}

/* ------------------------------------------------------------------ *
 * 4. UTILIDADES
 * ------------------------------------------------------------------ */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const COP = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const num = v => { const n = Number(String(v == null ? '' : v).replace(/[^0-9.-]/g, '')); return isFinite(n) ? n : 0; };
const money = n => COP.format(Math.round(num(n)));
const moneyK = n => { n = num(n); const a = Math.abs(n); if (a >= 1e6) return (n/1e6).toFixed(a>=1e7?0:1)+'M'; if (a >= 1e3) return Math.round(n/1e3)+'k'; return String(Math.round(n)); };
const genId = () => 'id' + Date.now().toString(36) + Math.floor(Math.random()*1e6).toString(36);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const todayISO = () => new Date().toLocaleDateString('en-CA'); // yyyy-mm-dd local
const curMonth = () => todayISO().slice(0, 7);
const monthKey = d => String(d || '').slice(0, 7);
function fmtDate(d) { if (!d) return ''; const p = String(d).slice(0,10).split('-'); if (p.length < 3) return d; return `${+p[2]} ${MESES[+p[1]-1]||''}`; }
function monthLabel(mk) { const p = String(mk).split('-'); return `${MESES_LARGO[+p[1]-1]||''} ${p[0]}`; }
function addMonths(mk, delta) { const [y,m] = mk.split('-').map(Number); const dt = new Date(y, m-1+delta, 1); return dt.toLocaleDateString('en-CA').slice(0,7); }
function daysInMonth(mk) { const [y,m] = mk.split('-').map(Number); return new Date(y, m, 0).getDate(); }
function cat(id) { return CATEGORIES.find(c => c.id === id) || { id, emoji: '🧾', color: '#94a3b8', fijo: false }; }
function acct(id) { return ACCOUNTS.find(a => a.id === id) || { id, emoji: '💠', color: '#94a3b8' }; }

/* ------------------------------------------------------------------ *
 * 5. CÁLCULOS DERIVADOS
 * ------------------------------------------------------------------ */
function scopeUsers() { return state.scope === 'familia' ? CONFIG.USERS.slice() : [state.scope]; }
function inScope(u) { return scopeUsers().includes(u); }

function saldoInicial(user, account) {
  const r = state.data.SaldosIniciales.find(x => x.usuario === user && x.cuenta === account);
  return r ? num(r.valor) : 0;
}
function accountBalance(user, account) {
  let b = saldoInicial(user, account);
  state.data.Salarios.forEach(s => { if (s.usuario === user && s.cuenta === account) b += num(s.salario); });
  state.data.Gastos.forEach(g => { if (g.usuario === user && g.cuenta === account) b -= num(g.valor); });
  state.data.Transferencias.forEach(t => {
    if (t.usuario === user) { if (t.origen === account) b -= num(t.valor); if (t.destino === account) b += num(t.valor); }
  });
  return b;
}
function scopeAccountBalance(account) { return scopeUsers().reduce((s, u) => s + accountBalance(u, account), 0); }
function patrimonio() { return ACCOUNTS.reduce((s, a) => s + scopeAccountBalance(a.id), 0); }
function userPatrimonio(user) { return ACCOUNTS.reduce((s, a) => s + accountBalance(user, a.id), 0); }

function salariosMes(mk) {
  return state.data.Salarios.filter(s => inScope(s.usuario) && monthKey(s.fecha || (s.mes||'')) === mk)
    .reduce((s, r) => s + num(r.salario), 0);
}
function gastosMes(mk) {
  return state.data.Gastos.filter(g => inScope(g.usuario) && monthKey(g.fecha) === mk)
    .reduce((s, r) => s + num(r.valor), 0);
}
function ahorrosMes(mk) {
  return state.data.Ahorros.filter(a => inScope(a.usuario) && monthKey(a.fecha) === mk)
    .reduce((s, r) => s + num(r.valor), 0);
}
function ahorroTotal() {
  return state.data.Ahorros.filter(a => inScope(a.usuario)).reduce((s, r) => s + num(r.valor), 0);
}
function diezmoMes(mk) { return salariosMes(mk) * 0.10; }
function ahorroObjetivoMes(mk) { return salariosMes(mk) * 0.20; }
function disponibleMes(mk) { return salariosMes(mk) - diezmoMes(mk) - ahorroObjetivoMes(mk) - gastosMes(mk); }

function gastosPorCategoria(mk) {
  const map = {};
  state.data.Gastos.filter(g => inScope(g.usuario) && monthKey(g.fecha) === mk)
    .forEach(g => { map[g.categoria] = (map[g.categoria] || 0) + num(g.valor); });
  return Object.entries(map).map(([id, val]) => ({ id, val })).sort((a, b) => b.val - a.val);
}
function serviciosDelMes(mk) {
  return state.data.Servicios.filter(s => monthKey(s.fechaLimite) === mk || monthKey(s.fechaPago) === mk);
}
function estadoServicio(s) {
  if (s.estado === 'Pagado') return 'Pagado';
  if (s.fechaLimite && String(s.fechaLimite).slice(0,10) < todayISO()) return 'Vencido';
  return 'Pendiente';
}

/* ---------- Deudas / créditos ---------- */
// Un abono a una deuda es un Gasto etiquetado con deudaId: descuenta la cuenta y reduce el saldo.
function deudaAbonado(d) {
  return state.data.Gastos.filter(g => String(g.deudaId) === String(d.id)).reduce((s, g) => s + num(g.valor), 0);
}
function deudaSaldo(d) { return Math.max(0, num(d.valorInicial) - deudaAbonado(d)); }
function deudaSaldada(d) { return num(d.valorInicial) - deudaAbonado(d) <= 0; }
function deudaPct(d) { const v = num(d.valorInicial); return v ? Math.min(100, deudaAbonado(d) / v * 100) : 0; }
function deudasScope() { return state.data.Deudas.filter(d => inScope(d.usuario)); }
function totalDeuda() { return deudasScope().filter(d => !deudaSaldada(d)).reduce((s, d) => s + deudaSaldo(d), 0); }

// Próxima fecha de pago a partir de un día del mes (1-31), respetando meses cortos
function nextDueDate(dia) {
  dia = Math.min(31, Math.max(1, Math.round(num(dia)) || 1));
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const clamp = (yy, mm) => Math.min(dia, new Date(yy, mm + 1, 0).getDate());
  let d = new Date(t.getFullYear(), t.getMonth(), clamp(t.getFullYear(), t.getMonth()));
  if (d < t) { const nm = new Date(t.getFullYear(), t.getMonth() + 1, 1); d = new Date(nm.getFullYear(), nm.getMonth(), clamp(nm.getFullYear(), nm.getMonth())); }
  return d.toLocaleDateString('en-CA');
}
function diasHasta(iso) {
  if (!iso) return null;
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const p = String(iso).slice(0, 10).split('-').map(Number);
  const d = new Date(p[0], p[1] - 1, p[2]);
  return Math.round((d - t) / 86400000);
}

/* Semáforo financiero: verde/ámbar/rojo */
function semaphore(mk) {
  const ing = salariosMes(mk);
  const disp = disponibleMes(mk);
  if (ing === 0) return { level: 'amber', text: 'Registra tu salario del mes' };
  if (disp >= ing * 0.05) return { level: 'green', text: 'Finanzas saludables' };
  if (disp >= 0) return { level: 'amber', text: 'Vas justo este mes' };
  return { level: 'red', text: 'Gastaste más de lo disponible' };
}

/* Asegura instancias de servicios del mes actual desde el catálogo */
function ensureServicesForMonth(mk) {
  const existing = new Set(state.data.Servicios
    .filter(s => monthKey(s.fechaLimite) === mk)
    .map(s => s.servicio));
  let created = false;
  SERVICES_CATALOG.forEach(sc => {
    if (!existing.has(sc.name)) {
      const [y, m] = mk.split('-');
      state.data.Servicios.push({
        id: genId(), servicio: sc.name, valor: '',
        fechaLimite: `${y}-${m}-05`, estado: 'Pendiente',
        usuarioPago: '', cuenta: '', fechaPago: '',
      });
      created = true;
    }
  });
  if (created) { saveCache(); }
}

/* ------------------------------------------------------------------ *
 * 6. COMPONENTES UI (toast, sheet, modal)
 * ------------------------------------------------------------------ */
function toast(msg, kind = 'ok') {
  const host = $('#toastHost');
  const t = document.createElement('div');
  t.className = 'toast ' + kind;
  t.innerHTML = `<span class="t-ic">${kind === 'err' ? '⚠️' : kind === 'info' ? 'ℹ️' : '✅'}</span><span>${esc(msg)}</span>`;
  host.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateY(8px)'; setTimeout(() => t.remove(), 250); }, 2600);
}

function openSheet(title, bodyHTML, opts = {}) {
  const host = $('#sheetHost');
  host.innerHTML = ''; // elimina cualquier hoja anterior de inmediato (evita duplicados)
  const scrim = document.createElement('div'); scrim.className = 'scrim';
  const sheet = document.createElement('div'); sheet.className = 'sheet';
  sheet.innerHTML = `<div class="sheet-grip"></div>
    ${title ? `<div class="sheet-title">${esc(title)}</div>` : ''}
    ${opts.desc ? `<div class="sheet-desc">${esc(opts.desc)}</div>` : ''}
    <div class="sheet-body">${bodyHTML}</div>`;
  host.appendChild(scrim); host.appendChild(sheet);
  requestAnimationFrame(() => { scrim.classList.add('show'); sheet.classList.add('show'); });
  scrim.addEventListener('click', closeSheet);
  if (opts.onMount) opts.onMount(sheet);
  return sheet;
}
function closeSheet() {
  const host = $('#sheetHost');
  $$('.sheet', host).forEach(s => { s.classList.remove('show'); });
  $$('.scrim', host).forEach(s => { s.classList.remove('show'); });
  setTimeout(() => { host.innerHTML = ''; }, 300);
}

function confirmModal(title, text, onYes, opts = {}) {
  const host = $('#modalHost');
  host.innerHTML = `<div class="scrim show"></div>
    <div class="modal"><div class="modal-card">
      <div class="modal-title">${esc(title)}</div>
      <div class="modal-text">${esc(text)}</div>
      <div class="modal-actions">
        <button class="btn btn-ghost" data-x>Cancelar</button>
        <button class="btn ${opts.danger ? 'btn-danger' : 'btn-primary'}" data-y>${esc(opts.yes || 'Confirmar')}</button>
      </div></div></div>`;
  const close = () => { host.innerHTML = ''; };
  $('[data-x]', host).onclick = close;
  $('.scrim', host).onclick = close;
  $('[data-y]', host).onclick = () => { close(); onYes(); };
}

/* ------------------------------------------------------------------ *
 * 7. ROUTER + RENDER
 * ------------------------------------------------------------------ */
const ROUTES = {
  inicio: renderInicio, cuentas: renderCuentas, servicios: renderServicios,
  analisis: renderAnalisis, metas: renderMetas, ahorros: renderAhorros,
  historial: renderHistorial, salarios: renderSalarios, deudas: renderDeudas,
};
const TABBAR_ROUTE = { inicio:'inicio', cuentas:'cuentas', servicios:'servicios', analisis:'analisis' };

function go(route) {
  state.route = route;
  ensureServicesForMonth(curMonth());
  Object.values(state.charts).forEach(c => { try { c.destroy(); } catch (e) {} });
  state.charts = {};
  const fn = ROUTES[route] || renderInicio;
  const view = $('#view');
  view.innerHTML = fn();
  view.scrollTop = 0; window.scrollTo(0, 0);
  if (fn.mount) fn.mount(view);
  // Sync tab highlight
  $$('.tab').forEach(t => t.classList.toggle('is-active', t.dataset.route === (TABBAR_ROUTE[route] || '')));
}
function refresh() { go(state.route); }

/* ---------- INICIO (Dashboard) ---------- */
function renderInicio() {
  const mk = curMonth();
  const ing = salariosMes(mk), gas = gastosMes(mk), disp = disponibleMes(mk);
  const diez = diezmoMes(mk), ahoObj = ahorroObjetivoMes(mk);
  const pat = patrimonio();
  const sem = semaphore(mk);
  const pend = serviciosDelMes(mk).filter(s => estadoServicio(s) !== 'Pagado');
  const pendTotal = pend.reduce((s, x) => s + num(x.valor), 0);

  // distribución por cuenta
  const dist = ACCOUNTS.map(a => ({ a, v: scopeAccountBalance(a.id) })).filter(x => x.v > 0);
  const distTotal = dist.reduce((s, x) => s + x.v, 0) || 1;
  const distBar = dist.map(x => `<span class="dist-seg" style="width:${(x.v/distTotal*100).toFixed(1)}%;background:${x.a.color}"></span>`).join('');
  const distLeg = dist.map(x => `<span class="dist-item"><span class="dot" style="background:${x.a.color}"></span>${x.a.emoji} ${x.a.id} · <b class="mono-num">${money(x.v)}</b></span>`).join('');

  const scopeName = state.scope === 'familia' ? 'del hogar' : 'de ' + state.scope;
  const insights = buildInsights(mk).slice(0, 3);

  // Deudas activas (para tarjeta resumen)
  const deudasAct = deudasScope().filter(d => !deudaSaldada(d)).sort((a, b) => deudaSaldo(b) - deudaSaldo(a));
  const deudaTot = totalDeuda();
  const deudaCard = deudasAct.length ? `
    <div class="section-title">Deudas y créditos <span class="link" data-go="deudas">Gestionar</span></div>
    <div class="card">
      <div class="between"><span class="tiny muted">Total por pagar</span><b class="mono-num" style="font-size:18px">${money(deudaTot)}</b></div>
      ${deudasAct.slice(0, 3).map(d => { const due = d.diaPago ? diasHasta(nextDueDate(d.diaPago)) : null;
        return `<div class="row"><div class="row-ic" style="background:#6366f122;color:#6366f1">💳</div>
        <div class="row-main"><div class="row-title">${esc(d.entidad)}</div>
          <div class="row-sub">${deudaPct(d).toFixed(0)}% pagado${d.diaPago ? ` · paga el ${d.diaPago}${due != null && due <= 5 ? (due === 0 ? ' · ¡hoy!' : ` · en ${due}d`) : ''}` : ''}</div></div>
        <div class="row-amt mono-num">${money(deudaSaldo(d))}</div></div>`; }).join('')}
      ${deudasAct.length > 3 ? `<div class="tiny muted mt8" style="text-align:center">y ${deudasAct.length - 3} más…</div>` : ''}
    </div>` : '';

  return `
  <section class="hero">
    <div class="hero-label">💠 Patrimonio disponible ${scopeName}</div>
    <div class="hero-amount mono-num">${money(pat)}</div>
    <div class="hero-sub">${monthLabel(mk)} · <span class="semaphore" style="display:inline-flex;vertical-align:middle">
        <span class="sem-light sem-${sem.level==='green'?'green on':sem.level==='amber'?'amber on':'red on'}"></span></span> ${sem.text}</div>
    <div class="dist">
      <div class="dist-bar">${distBar || '<span class="dist-seg" style="width:100%;background:var(--chip)"></span>'}</div>
      <div class="dist-legend">${distLeg || '<span class="tiny">Aún no hay saldos. Ajusta tus cuentas para empezar.</span>'}</div>
    </div>
    <div class="hero-row">
      <div class="hero-pill"><span class="k">Ingresos mes</span><span class="v mono-num">${money(ing)}</span></div>
      <div class="hero-pill"><span class="k">Gastos mes</span><span class="v mono-num">${money(gas)}</span></div>
      <div class="hero-pill"><span class="k">Disponible</span><span class="v mono-num" style="color:${disp<0?'var(--bad)':'var(--good)'}">${money(disp)}</span></div>
    </div>
  </section>

  <div class="section-title">Resumen del mes</div>
  <div class="stat-grid">
    <div class="stat"><div class="k">🙏 Diezmo (10%)</div><div class="v mono-num">${money(diez)}</div><div class="d muted">Apartado sugerido</div></div>
    <div class="stat"><div class="k">🐷 Ahorro (20%)</div><div class="v mono-num">${money(ahoObj)}</div><div class="d muted">Meta del mes</div></div>
    <div class="stat"><div class="k">💰 Ahorrado total</div><div class="v mono-num">${money(ahorroTotal())}</div><div class="d muted">Acumulado</div></div>
    <div class="stat"><div class="k">📅 Servicios</div><div class="v mono-num">${money(pendTotal)}</div><div class="d ${pend.length?'down':'up'}">${pend.length} pendiente${pend.length===1?'':'s'}</div></div>
  </div>

  <div class="section-title">Gastos por categoría <span class="link" data-go="analisis">Ver análisis</span></div>
  <div class="card">
    ${gas > 0 ? '<div class="chart-wrap sm"><canvas id="catChart"></canvas></div>' : emptyState('🛒','Sin gastos este mes','Toca + para registrar el primero')}
  </div>

  <div class="section-title">Ingresos vs gastos <span class="tiny">últimos 6 meses</span></div>
  <div class="card"><div class="chart-wrap"><canvas id="trendChart"></canvas></div></div>

  ${deudaCard}

  ${insights.length ? `<div class="section-title">Análisis inteligente <span class="link" data-go="analisis">Ver todo</span></div>
    <div class="card card-flat">${insights.map(insightHTML).join('')}</div>` : ''}

  <div class="section-title">Accesos</div>
  <div class="qa-grid">
    ${quickNav('💳','Deudas','deudas')}
    ${quickNav('🎯','Metas','metas')}
    ${quickNav('🐷','Ahorro','ahorros')}
    ${quickNav('💵','Salarios','salarios')}
    ${quickNav('🕘','Historial','historial')}
    ${quickNav('🏦','Cuentas','cuentas')}
    ${quickNav('⚙️','Ajustes',null,'openSettings')}
  </div>
  <div style="height:20px"></div>`;
}
renderInicio.mount = () => {
  const mk = curMonth();
  const cats = gastosPorCategoria(mk);
  if (cats.length && $('#catChart')) {
    state.charts.cat = new Chart($('#catChart'), {
      type: 'doughnut',
      data: { labels: cats.map(c => c.id),
        datasets: [{ data: cats.map(c => c.val), backgroundColor: cats.map(c => cat(c.id).color), borderWidth: 0 }] },
      options: donutOpts(),
    });
  }
  // trend
  const months = Array.from({length:6}, (_,i) => addMonths(mk, -(5-i)));
  state.charts.trend = new Chart($('#trendChart'), {
    type: 'bar',
    data: { labels: months.map(m => MESES[+m.split('-')[1]-1]),
      datasets: [
        { label: 'Ingresos', data: months.map(salariosMes), backgroundColor: 'rgba(16,185,129,.75)', borderRadius: 6, barPercentage: .62, categoryPercentage: .6 },
        { label: 'Gastos', data: months.map(gastosMes), backgroundColor: 'rgba(239,68,68,.75)', borderRadius: 6, barPercentage: .62, categoryPercentage: .6 },
      ] },
    options: barOpts(),
  });
};

/* ---------- CUENTAS ---------- */
function renderCuentas() {
  const rows = ACCOUNTS.map(a => {
    const bal = scopeAccountBalance(a.id);
    const perUser = state.scope === 'familia'
      ? CONFIG.USERS.map(u => `${u.slice(0,3)} ${moneyK(accountBalance(u, a.id))}`).join(' · ')
      : a.tipo;
    return `<div class="acct">
      <div class="acct-ic" style="background:${a.color}">${a.emoji}</div>
      <div><div class="acct-name">${a.id}</div><div class="acct-sub">${esc(perUser)}</div></div>
      <div class="acct-bal mono-num">${money(bal)}</div>
    </div>`;
  }).join('');

  const total = patrimonio();
  const juli = userPatrimonio('Julieth'), feli = userPatrimonio('Felipe');

  return `
  <div class="view-title">Cuentas</div>
  <div class="card">
    <div class="between"><span class="muted">Total ${state.scope==='familia'?'del hogar':'de '+state.scope}</span>
      <b class="mono-num" style="font-size:19px">${money(total)}</b></div>
  </div>
  <div class="card">${rows}</div>

  <div class="section-title">Por persona</div>
  <div class="stat-grid" style="grid-template-columns:1fr 1fr">
    <div class="stat"><div class="k">👩 Julieth</div><div class="v mono-num">${money(juli)}</div></div>
    <div class="stat"><div class="k">👨 Felipe</div><div class="v mono-num">${money(feli)}</div></div>
  </div>

  <div class="section-title">Acciones</div>
  <div class="qa-grid">
    ${quickAct('💸','Gasto','openGasto')}
    ${quickAct('🔄','Transferir','openTransferencia')}
    ${quickAct('🏧','Retirar','openRetiro')}
    ${quickAct('💵','Salario','openSalario')}
    ${quickAct('🐷','Ahorro','openAhorro')}
    ${quickAct('⚖️','Ajustar saldo','openAjuste')}
  </div>
  <div style="height:20px"></div>`;
}

/* ---------- SERVICIOS / PAGOS ---------- */
function renderServicios() {
  const mk = curMonth();
  ensureServicesForMonth(mk);
  const items = state.data.Servicios
    .filter(s => monthKey(s.fechaLimite) === mk)
    .sort((a, b) => String(a.fechaLimite).localeCompare(String(b.fechaLimite)));

  const pend = items.filter(s => estadoServicio(s) === 'Pendiente');
  const venc = items.filter(s => estadoServicio(s) === 'Vencido');
  const paid = items.filter(s => estadoServicio(s) === 'Pagado');
  const totalPend = [...pend, ...venc].reduce((s, x) => s + num(x.valor), 0);
  const prox = [...venc, ...pend].filter(s => s.fechaLimite).sort((a,b)=>String(a.fechaLimite).localeCompare(String(b.fechaLimite)))[0];

  const row = s => {
    const st = estadoServicio(s);
    const c = cat(s.servicio);
    const meta = SERVICES_CATALOG.find(x => x.name === s.servicio) || {};
    const badge = st === 'Pagado' ? 'paid' : st === 'Vencido' ? 'late' : 'pend';
    return `<div class="row" data-svc="${s.id}">
      <div class="row-ic" style="background:${c.color}22;color:${c.color}">${c.emoji}</div>
      <div class="row-main">
        <div class="row-title">${esc(s.servicio)} <span class="badge ${badge}">${st}</span></div>
        <div class="row-sub">Vence ${fmtDate(s.fechaLimite)}${s.valor?` · ${money(s.valor)}`:''}${st==='Pagado'&&s.usuarioPago?` · pagó ${esc(s.usuarioPago)}`:''}</div>
      </div>
      <div class="flex">
        ${meta.portal ? `<a class="btn btn-ghost btn-sm" href="${meta.portal}" target="_blank" rel="noopener">Ir a pagar ↗</a>`
          : meta.reminder ? `<span class="chip">App bancaria</span>` : ''}
        ${st !== 'Pagado' ? `<button class="btn btn-ghost btn-sm" data-edit-svc="${s.id}" aria-label="Editar fecha">✏️</button>` : ''}
        ${st !== 'Pagado' ? `<button class="btn btn-primary btn-sm" data-pay="${s.id}">Pagar</button>` : ''}
      </div>
    </div>`;
  };

  // Deudas activas para la tarjeta resumen y el calendario
  const deudasAct = deudasScope().filter(d => !deudaSaldada(d));
  const deudaTot = totalDeuda();

  // Calendario de vencimientos: servicios pendientes + próximos pagos de deudas
  const cal = [];
  [...pend, ...venc].forEach(s => { if (s.fechaLimite) cal.push({ fecha: String(s.fechaLimite).slice(0,10), tipo: 'Servicio', nombre: s.servicio, valor: num(s.valor), emoji: cat(s.servicio).emoji }); });
  deudasAct.forEach(d => { if (d.diaPago) cal.push({ fecha: nextDueDate(d.diaPago), tipo: 'Deuda', nombre: d.entidad, valor: num(d.cuota), emoji: '💳' }); });
  cal.sort((a, b) => a.fecha.localeCompare(b.fecha));
  const calRows = cal.slice(0, 8).map(x => {
    const dl = diasHasta(x.fecha);
    const urgent = dl != null && dl <= 3;
    const tag = dl == null ? '' : dl < 0 ? 'vencido' : dl === 0 ? 'hoy' : dl === 1 ? 'mañana' : `en ${dl} días`;
    return `<div class="row">
      <div class="row-ic" style="background:${urgent ? 'var(--bad)22' : 'var(--chip)'};color:${urgent ? 'var(--bad)' : 'var(--muted)'}">${x.emoji}</div>
      <div class="row-main"><div class="row-title">${esc(x.nombre)} <span class="tiny muted">· ${x.tipo}</span></div>
        <div class="row-sub">${fmtDate(x.fecha)}${tag ? ` · <b style="color:${urgent ? 'var(--bad)' : 'inherit'}">${tag}</b>` : ''}</div></div>
      <div class="row-amt mono-num">${x.valor ? money(x.valor) : ''}</div>
    </div>`;
  }).join('');

  return `
  <div class="view-title">Pagos y servicios</div>
  <div class="stat-grid" style="grid-template-columns:repeat(3,1fr)">
    <div class="stat"><div class="k">Pendiente</div><div class="v mono-num" style="font-size:18px">${money(totalPend)}</div></div>
    <div class="stat"><div class="k">Por vencer</div><div class="v mono-num" style="font-size:18px">${pend.length + venc.length}</div></div>
    <div class="stat"><div class="k">Próximo</div><div class="v" style="font-size:15px">${prox?esc(prox.servicio):'—'}</div><div class="d muted">${prox?fmtDate(prox.fechaLimite):''}</div></div>
  </div>

  <div class="card deuda-banner" data-go="deudas">
    <div class="row" style="border:0;padding:0">
      <div class="row-ic" style="background:#6366f122;color:#6366f1">💳</div>
      <div class="row-main"><div class="row-title">Deudas y créditos</div>
        <div class="row-sub">${deudasAct.length ? `${deudasAct.length} activa${deudasAct.length===1?'':'s'} · por pagar ${money(deudaTot)}` : 'Sin deudas activas · toca para registrar'}</div></div>
      <span class="chip">Gestionar ›</span>
    </div>
  </div>

  ${cal.length ? `<div class="section-title">📅 Calendario de vencimientos</div><div class="card">${calRows}</div>` : ''}

  ${venc.length ? `<div class="section-title" style="color:var(--bad)">Vencidos</div><div class="card">${venc.map(row).join('')}</div>` : ''}
  <div class="section-title">Pendientes</div>
  <div class="card">${pend.length ? pend.map(row).join('') : emptyState('🎉','Todo al día','No tienes pagos pendientes este mes')}</div>
  ${paid.length ? `<div class="section-title">Pagados</div><div class="card">${paid.map(row).join('')}</div>` : ''}

  <div class="section-title">Recordatorio</div>
  <div class="card card-flat"><p class="tiny">Arriendo, Colegio Gaviota y Préstamos Davivienda se pagan desde la app del banco. Cualquiera de los dos puede pagarlos desde cualquier cuenta.</p></div>
  <div style="height:20px"></div>`;
}
renderServicios.mount = (view) => {
  $$('[data-pay]', view).forEach(b => b.onclick = () => openPagoServicio(b.dataset.pay));
  $$('[data-edit-svc]', view).forEach(b => b.onclick = (e) => { e.stopPropagation(); openServicioEdit(b.dataset.editSvc); });
};

/* ---------- ANÁLISIS ---------- */
function renderAnalisis() {
  const mk = curMonth();
  const insights = buildInsights(mk);
  const ant = antHormiga(mk);
  const cats = gastosPorCategoria(mk);
  const fijos = cats.filter(c => cat(c.id).fijo).reduce((s,c)=>s+c.val,0);
  const varia = cats.filter(c => !cat(c.id).fijo).reduce((s,c)=>s+c.val,0);
  const ing = salariosMes(mk), gas = gastosMes(mk);
  const pctGasto = ing ? Math.min(100, gas/ing*100) : 0;
  const pctAhorro = ing ? Math.max(0, (ahorrosMes(mk))/ing*100) : 0;
  const days = daysInMonth(mk); const elapsed = Math.max(1, +todayISO().slice(8,10));
  const promDia = gas / elapsed; const proyeccion = promDia * days;

  const top = state.data.Gastos.filter(g => inScope(g.usuario) && monthKey(g.fecha) === mk)
    .sort((a,b)=>num(b.valor)-num(a.valor)).slice(0,10);

  return `
  <div class="view-title">Análisis inteligente</div>

  <div class="stat-grid">
    <div class="stat"><div class="k">📉 % gastado</div><div class="v mono-num">${pctGasto.toFixed(0)}%</div><div class="d muted">del ingreso</div></div>
    <div class="stat"><div class="k">🐷 % ahorrado</div><div class="v mono-num">${pctAhorro.toFixed(0)}%</div><div class="d muted">del ingreso</div></div>
    <div class="stat"><div class="k">📆 Prom. diario</div><div class="v mono-num" style="font-size:17px">${money(promDia)}</div><div class="d muted">de gasto</div></div>
    <div class="stat"><div class="k">🔮 Proyección</div><div class="v mono-num" style="font-size:17px">${money(proyeccion)}</div><div class="d muted">fin de mes</div></div>
  </div>

  <div class="section-title">Observaciones</div>
  <div class="card card-flat">${insights.length ? insights.map(insightHTML).join('') : emptyState('🧠','Sin datos suficientes','Registra movimientos para generar análisis')}</div>

  <div class="section-title">🐜 Gastos hormiga</div>
  <div class="card">
    <div class="insight"><span class="emoji">🐜</span><div>
      <div class="t">${ant.count} compras menores a ${money(CONFIG.ANT_THRESHOLD)}</div>
      <div class="s">Suman <b>${money(ant.sum)}</b> este mes. Reduciéndolas podrían ahorrar ~<b>${money(ant.potential)}</b>.</div>
    </div></div>
    ${ant.repeats.length ? `<div class="mt12 tiny muted">Repetitivos:</div>` + ant.repeats.map(r=>`<div class="row"><div class="row-main"><div class="row-title">${esc(r.desc)}</div><div class="row-sub">${r.n} veces</div></div><div class="row-amt mono-num">${money(r.sum)}</div></div>`).join('') : ''}
  </div>

  <div class="section-title">Fijos vs variables</div>
  <div class="card"><div class="chart-wrap sm"><canvas id="fvChart"></canvas></div>
    <div class="between mt12"><span class="dist-item"><span class="dot" style="background:#6366f1"></span>Fijos <b class="mono-num">&nbsp;${money(fijos)}</b></span>
      <span class="dist-item"><span class="dot" style="background:#f59e0b"></span>Variables <b class="mono-num">&nbsp;${money(varia)}</b></span></div>
  </div>

  <div class="section-title">Top 10 gastos del mes</div>
  <div class="card">${top.length ? top.map(g=>{const c=cat(g.categoria);return `<div class="row"><div class="row-ic" style="background:${c.color}22;color:${c.color}">${c.emoji}</div><div class="row-main"><div class="row-title">${esc(g.descripcion||g.categoria)}</div><div class="row-sub">${esc(g.categoria)} · ${fmtDate(g.fecha)} · ${esc(g.usuario)}</div></div><div class="row-amt neg mono-num">${money(g.valor)}</div></div>`;}).join('') : emptyState('📊','Sin gastos','Aún no hay gastos este mes')}</div>

  <div class="section-title">Flujo de caja <span class="tiny">6 meses</span></div>
  <div class="card"><div class="chart-wrap"><canvas id="flowChart"></canvas></div></div>
  <div style="height:20px"></div>`;
}
renderAnalisis.mount = () => {
  const mk = curMonth();
  const cats = gastosPorCategoria(mk);
  const fijos = cats.filter(c => cat(c.id).fijo).reduce((s,c)=>s+c.val,0);
  const varia = cats.filter(c => !cat(c.id).fijo).reduce((s,c)=>s+c.val,0);
  if ($('#fvChart')) state.charts.fv = new Chart($('#fvChart'), {
    type: 'doughnut',
    data: { labels: ['Fijos','Variables'], datasets: [{ data: [fijos, varia], backgroundColor: ['#6366f1','#f59e0b'], borderWidth: 0 }] },
    options: donutOpts(false),
  });
  const months = Array.from({length:6}, (_,i) => addMonths(mk, -(5-i)));
  state.charts.flow = new Chart($('#flowChart'), {
    type: 'line',
    data: { labels: months.map(m => MESES[+m.split('-')[1]-1]),
      datasets: [
        { label:'Disponible', data: months.map(disponibleMes), borderColor:'#10b981', backgroundColor:'rgba(16,185,129,.15)', fill:true, tension:.4, pointRadius:3 },
        { label:'Gastos', data: months.map(gastosMes), borderColor:'#ef4444', backgroundColor:'transparent', tension:.4, pointRadius:3 },
      ] },
    options: lineOpts(),
  });
};

/* ---------- METAS ---------- */
function renderMetas() {
  const metas = state.data.Metas.slice().sort((a,b)=>num(b.objetivo)-num(a.objetivo));
  const rows = metas.map(m => {
    const obj = num(m.objetivo), acc = num(m.acumulado);
    const pct = obj ? Math.min(100, acc/obj*100) : 0;
    const falta = Math.max(0, obj - acc);
    return `<div class="card">
      <div class="between"><b>${esc(m.meta)}</b><span class="tiny">${pct.toFixed(0)}%</span></div>
      <div class="progress mt8"><i style="width:${pct}%"></i></div>
      <div class="between mt8"><span class="tiny">Acumulado <b class="mono-num">${money(acc)}</b></span>
        <span class="tiny">Meta <b class="mono-num">${money(obj)}</b></span></div>
      <div class="between mt8">
        <span class="tiny muted">Falta ${money(falta)}${m.fecha?` · para ${fmtDate(m.fecha)}`:''}</span>
        <span class="flex">
          <button class="btn btn-ghost btn-sm" data-add-meta="${m.id}">+ Abonar</button>
          <button class="row-del" data-del-meta="${m.id}" aria-label="Eliminar">🗑</button>
        </span>
      </div>
    </div>`;
  }).join('');

  return `
  <div class="view-title">Metas de ahorro</div>
  <button class="btn btn-primary btn-block" data-new-meta>+ Nueva meta</button>
  <div class="mt16">${metas.length ? rows : emptyState('🎯','Sin metas aún','Crea una meta: viaje, casa, carro…')}</div>
  <div style="height:20px"></div>`;
}
renderMetas.mount = (view) => {
  $('[data-new-meta]', view).onclick = openMeta;
  $$('[data-add-meta]', view).forEach(b => b.onclick = () => abonarMeta(b.dataset.addMeta));
  $$('[data-del-meta]', view).forEach(b => b.onclick = () => {
    const m = state.data.Metas.find(x=>x.id===b.dataset.delMeta);
    confirmModal('Eliminar meta', `¿Eliminar "${m?m.meta:''}"?`, () => { deleteRecord('Metas', b.dataset.delMeta); toast('Meta eliminada'); refresh(); }, { danger:true, yes:'Eliminar' });
  });
};

/* ---------- DEUDAS / CRÉDITOS ---------- */
function renderDeudas() {
  const list = deudasScope();
  const activas = list.filter(d => !deudaSaldada(d)).sort((a, b) => deudaSaldo(b) - deudaSaldo(a));
  const saldadas = list.filter(d => deudaSaldada(d));
  const total = totalDeuda();
  const totalInicial = activas.reduce((s, d) => s + num(d.valorInicial), 0);
  const totalAbonado = activas.reduce((s, d) => s + deudaAbonado(d), 0);
  const pctGlobal = totalInicial ? Math.min(100, totalAbonado / totalInicial * 100) : 0;

  const card = d => {
    const saldo = deudaSaldo(d), abonado = deudaAbonado(d), pct = deudaPct(d), saldada = deudaSaldada(d);
    const due = d.diaPago ? nextDueDate(d.diaPago) : '';
    const dLeft = due ? diasHasta(due) : null;
    const dueTxt = due ? (dLeft === 0 ? '¡Hoy!' : dLeft === 1 ? 'mañana' : dLeft > 1 ? `en ${dLeft} días` : 'vencido') : '';
    const dueClass = dLeft != null && dLeft <= 3 ? 'late' : 'pend';
    return `<div class="card${saldada ? ' is-done' : ''}">
      <div class="between">
        <b>💳 ${esc(d.entidad)} ${saldada ? '<span class="badge paid">Saldada ✅</span>' : ''}</b>
        <span class="flex">
          ${!saldada ? `<button class="btn btn-ghost btn-sm" data-edit-deuda="${d.id}" aria-label="Editar">✏️</button>` : ''}
          <button class="row-del" data-del-deuda="${d.id}" aria-label="Eliminar">🗑</button>
        </span>
      </div>
      ${d.descripcion ? `<div class="tiny muted mt4">${esc(d.descripcion)} · ${esc(d.usuario)}</div>` : `<div class="tiny muted mt4">${esc(d.usuario)}</div>`}
      <div class="deuda-amount mono-num mt8" style="color:${saldada ? 'var(--good)' : 'var(--text)'}">${money(saldo)}<span class="tiny muted"> ${saldada ? 'pagado' : 'por pagar'}</span></div>
      <div class="progress mt8"><i style="width:${pct}%;background:${saldada ? 'var(--good)' : 'linear-gradient(90deg,var(--brand),var(--brand2))'}"></i></div>
      <div class="between mt8">
        <span class="tiny">Abonado <b class="mono-num">${money(abonado)}</b></span>
        <span class="tiny">Total <b class="mono-num">${money(d.valorInicial)}</b> · ${pct.toFixed(0)}%</span>
      </div>
      <div class="between mt8">
        <span class="tiny muted">${d.diaPago ? `📅 Paga el ${d.diaPago} · <b class="${dueClass === 'late' ? '' : 'muted'}">${dueTxt}</b>` : 'Sin fecha de pago'}${d.cuota ? ` · cuota ${money(d.cuota)}` : ''}</span>
        ${!saldada ? `<button class="btn btn-primary btn-sm" data-pay-deuda="${d.id}">Abonar / Pagar</button>` : ''}
      </div>
    </div>`;
  };

  return `
  <div class="view-title">Deudas y créditos</div>

  <section class="hero hero-compact">
    <div class="hero-label">💳 Deuda total ${state.scope === 'familia' ? 'del hogar' : 'de ' + state.scope}</div>
    <div class="hero-amount mono-num">${money(total)}</div>
    ${activas.length ? `<div class="hero-sub">${activas.length} deuda${activas.length === 1 ? '' : 's'} activa${activas.length === 1 ? '' : 's'} · ${pctGlobal.toFixed(0)}% pagado</div>
      <div class="dist"><div class="dist-bar"><span class="dist-seg" style="width:${pctGlobal}%;background:linear-gradient(90deg,#22c55e,#10b981)"></span><span class="dist-seg" style="width:${100 - pctGlobal}%;background:var(--chip)"></span></div></div>` : '<div class="hero-sub">Sin deudas activas 🎉</div>'}
  </section>

  <button class="btn btn-primary btn-block" data-new-deuda>+ Registrar deuda</button>

  <div class="section-title">Activas</div>
  <div>${activas.length ? activas.map(card).join('') : emptyState('🎉', 'Sin deudas activas', 'Registra un crédito para hacerle seguimiento')}</div>

  ${saldadas.length ? `<div class="section-title">Saldadas ✅</div><div>${saldadas.map(card).join('')}</div>` : ''}

  <div class="card card-flat mt12"><p class="tiny muted">Cada abono se registra también como gasto y se descuenta de la cuenta que elijas. Cuando el saldo llega a $0, la deuda queda <b>Saldada</b>.</p></div>
  <div style="height:20px"></div>`;
}
renderDeudas.mount = (view) => {
  $('[data-new-deuda]', view).onclick = openDeuda;
  $$('[data-pay-deuda]', view).forEach(b => b.onclick = () => abonarDeuda(b.dataset.payDeuda));
  $$('[data-edit-deuda]', view).forEach(b => b.onclick = () => openDeuda(b.dataset.editDeuda));
  $$('[data-del-deuda]', view).forEach(b => b.onclick = () => {
    const d = state.data.Deudas.find(x => x.id === b.dataset.delDeuda);
    confirmModal('Eliminar deuda', `¿Eliminar "${d ? d.entidad : ''}"? Los abonos ya registrados como gastos se conservarán.`,
      () => { deleteRecord('Deudas', b.dataset.delDeuda); toast('Deuda eliminada'); refresh(); }, { danger: true, yes: 'Eliminar' });
  });
};

/* ---------- AHORROS ---------- */
function renderAhorros() {
  const list = state.data.Ahorros.filter(a => inScope(a.usuario)).sort((a,b)=>String(b.fecha).localeCompare(String(a.fecha)));
  const total = ahorroTotal();
  const rows = list.map(a => `<div class="row">
      <div class="row-ic" style="background:#10b98122;color:#10b981">🐷</div>
      <div class="row-main"><div class="row-title">${esc(a.tipo||'Ahorro')}</div><div class="row-sub">${fmtDate(a.fecha)} · ${esc(a.usuario)}</div></div>
      <div class="row-amt pos mono-num">${money(a.valor)}</div>
      <button class="row-del" data-del="${a.id}" aria-label="Eliminar">🗑</button>
    </div>`).join('');
  return `
  <div class="view-title">Ahorro</div>
  <div class="hero"><div class="hero-label">🐷 Total ahorrado ${state.scope==='familia'?'del hogar':'de '+state.scope}</div>
    <div class="hero-amount mono-num">${money(total)}</div></div>
  <button class="btn btn-primary btn-block mt16" data-new-ahorro>+ Registrar ahorro</button>
  <div class="card mt16">${list.length ? rows : emptyState('🐷','Sin ahorros','Empieza a construir tu colchón')}</div>
  <div style="height:20px"></div>`;
}
renderAhorros.mount = (view) => {
  $('[data-new-ahorro]', view).onclick = openAhorro;
  bindDeletes(view, 'Ahorros', 'Ahorro eliminado');
};

/* ---------- SALARIOS ---------- */
function renderSalarios() {
  const list = state.data.Salarios.filter(s => inScope(s.usuario)).sort((a,b)=>String(b.fecha).localeCompare(String(a.fecha)));
  const rows = list.map(s => {
    const mk = monthKey(s.fecha);
    return `<div class="row">
      <div class="row-ic" style="background:#22c55e22;color:#22c55e">💵</div>
      <div class="row-main"><div class="row-title">${esc(s.usuario)} · ${monthLabel(mk)}</div>
        <div class="row-sub">Diezmo ${money(num(s.salario)*.1)} · Ahorro ${money(num(s.salario)*.2)} · ${esc(s.cuenta||'')}</div></div>
      <div class="row-amt pos mono-num">${money(s.salario)}</div>
      <button class="row-del" data-del="${s.id}">🗑</button>
    </div>`;
  }).join('');
  return `
  <div class="view-title">Salarios e ingresos</div>
  <button class="btn btn-primary btn-block" data-new-salario>+ Registrar salario</button>
  <div class="card mt16">${list.length ? rows : emptyState('💵','Sin ingresos','Registra el salario del mes')}</div>
  <div style="height:20px"></div>`;
}
renderSalarios.mount = (view) => {
  $('[data-new-salario]', view).onclick = openSalario;
  bindDeletes(view, 'Salarios', 'Salario eliminado');
};

/* ---------- HISTORIAL ---------- */
const histFilter = { mes: 'todos', usuario: 'todos', categoria: 'todos', cuenta: 'todos' };
function renderHistorial() {
  const months = Array.from(new Set(state.data.Gastos.map(g => monthKey(g.fecha)).filter(Boolean))).sort().reverse();
  let list = state.data.Gastos.filter(g => inScope(g.usuario));
  if (histFilter.mes !== 'todos') list = list.filter(g => monthKey(g.fecha) === histFilter.mes);
  if (histFilter.usuario !== 'todos') list = list.filter(g => g.usuario === histFilter.usuario);
  if (histFilter.categoria !== 'todos') list = list.filter(g => g.categoria === histFilter.categoria);
  if (histFilter.cuenta !== 'todos') list = list.filter(g => g.cuenta === histFilter.cuenta);
  list.sort((a,b)=>String(b.fecha).localeCompare(String(a.fecha)));
  const total = list.reduce((s,g)=>s+num(g.valor),0);

  const opt = (v,l,cur)=>`<option value="${esc(v)}"${cur===v?' selected':''}>${esc(l)}</option>`;
  const rows = list.map(g => { const c = cat(g.categoria); return `<div class="row">
      <div class="row-ic" style="background:${c.color}22;color:${c.color}">${c.emoji}</div>
      <div class="row-main"><div class="row-title">${esc(g.descripcion||g.categoria)}</div>
        <div class="row-sub">${esc(g.categoria)} · ${fmtDate(g.fecha)} · ${esc(g.usuario)} · ${esc(g.cuenta||'')}</div></div>
      <div class="row-amt neg mono-num">${money(g.valor)}</div>
      <button class="row-del" data-del="${g.id}">🗑</button>
    </div>`; }).join('');

  return `
  <div class="view-title">Historial</div>
  <div class="card card-flat">
    <div class="field-row">
      <label class="field" style="margin:0"><span class="field-label">Mes</span>
        <select data-f="mes">${opt('todos','Todos',histFilter.mes)}${months.map(m=>opt(m,monthLabel(m),histFilter.mes)).join('')}</select></label>
      <label class="field" style="margin:0"><span class="field-label">Usuario</span>
        <select data-f="usuario">${opt('todos','Todos',histFilter.usuario)}${CONFIG.USERS.map(u=>opt(u,u,histFilter.usuario)).join('')}</select></label>
    </div>
    <div class="field-row mt12">
      <label class="field" style="margin:0"><span class="field-label">Categoría</span>
        <select data-f="categoria">${opt('todos','Todas',histFilter.categoria)}${CATEGORIES.map(c=>opt(c.id,c.id,histFilter.categoria)).join('')}</select></label>
      <label class="field" style="margin:0"><span class="field-label">Cuenta</span>
        <select data-f="cuenta">${opt('todos','Todas',histFilter.cuenta)}${ACCOUNTS.map(a=>opt(a.id,a.id,histFilter.cuenta)).join('')}</select></label>
    </div>
  </div>
  <div class="between mt16" style="padding:0 4px">
    <span class="muted">${list.length} gastos · <b class="mono-num">${money(total)}</b></span>
    <button class="btn btn-ghost btn-sm" data-export>⬇ Exportar CSV</button>
  </div>
  <div class="card mt8">${list.length ? rows : emptyState('🔍','Sin resultados','Ajusta los filtros')}</div>
  <div style="height:20px"></div>`;
}
renderHistorial.mount = (view) => {
  $$('[data-f]', view).forEach(sel => sel.onchange = () => { histFilter[sel.dataset.f] = sel.value; refresh(); });
  $('[data-export]', view).onclick = exportCSV;
  bindDeletes(view, 'Gastos', 'Gasto eliminado', true);
};

/* ------------------------------------------------------------------ *
 * 8. HELPERS DE RENDER
 * ------------------------------------------------------------------ */
function emptyState(ic, t, s) {
  return `<div class="empty"><div class="e-ic">${ic}</div><div class="e-t">${esc(t)}</div><div class="tiny">${esc(s)}</div></div>`;
}
function insightHTML(i) { return `<div class="insight"><span class="emoji">${i.emoji}</span><div><div class="t">${esc(i.t)}</div><div class="s">${esc(i.s)}</div></div></div>`; }
function quickNav(ic, label, route, action) {
  return `<button class="qa" ${route?`data-go="${route}"`:`data-action="${action}"`}><span class="qa-ic" style="background:linear-gradient(135deg,var(--brand-1),var(--brand-3))">${ic}</span>${label}</button>`;
}
function quickAct(ic, label, action) {
  return `<button class="qa" data-action="${action}"><span class="qa-ic" style="background:linear-gradient(135deg,var(--brand-1),var(--brand-3))">${ic}</span>${label}</button>`;
}
function bindDeletes(view, sheet, msg, needRefresh) {
  $$('[data-del]', view).forEach(b => b.onclick = () => {
    confirmModal('Eliminar registro', '¿Seguro que deseas eliminar este registro?', () => {
      deleteRecord(sheet, b.dataset.del); toast(msg); refresh();
    }, { danger:true, yes:'Eliminar' });
  });
}

/* Chart options (respetan el tema) */
function themeColors() {
  const cs = getComputedStyle(document.body);
  return { text: cs.getPropertyValue('--text-2').trim(), grid: cs.getPropertyValue('--stroke-2').trim() };
}
function donutOpts(legend = true) {
  const c = themeColors();
  return { responsive:true, maintainAspectRatio:false, cutout:'62%',
    plugins:{ legend:{ display:legend, position:'bottom', labels:{ color:c.text, boxWidth:10, boxHeight:10, padding:12, font:{size:11} } },
      tooltip:{ callbacks:{ label: ctx => ` ${ctx.label}: ${money(ctx.parsed)}` } } } };
}
function barOpts() {
  const c = themeColors();
  return { responsive:true, maintainAspectRatio:false,
    plugins:{ legend:{ display:true, position:'bottom', labels:{ color:c.text, boxWidth:10, padding:12, font:{size:11} } },
      tooltip:{ callbacks:{ label: ctx => ` ${ctx.dataset.label}: ${money(ctx.parsed.y)}` } } },
    scales:{ x:{ grid:{display:false}, ticks:{ color:c.text, font:{size:11} } },
      y:{ grid:{ color:c.grid }, ticks:{ color:c.text, font:{size:10}, callback:v=>moneyK(v) } } } };
}
function lineOpts() {
  const c = themeColors();
  return { responsive:true, maintainAspectRatio:false,
    plugins:{ legend:{ display:true, position:'bottom', labels:{ color:c.text, boxWidth:10, padding:12, font:{size:11} } },
      tooltip:{ callbacks:{ label: ctx => ` ${ctx.dataset.label}: ${money(ctx.parsed.y)}` } } },
    scales:{ x:{ grid:{display:false}, ticks:{ color:c.text, font:{size:11} } },
      y:{ grid:{ color:c.grid }, ticks:{ color:c.text, font:{size:10}, callback:v=>moneyK(v) } } } };
}

/* ------------------------------------------------------------------ *
 * 9. MOTOR DE ANÁLISIS
 * ------------------------------------------------------------------ */
function antHormiga(mk) {
  const small = state.data.Gastos.filter(g => inScope(g.usuario) && monthKey(g.fecha) === mk && num(g.valor) > 0 && num(g.valor) < CONFIG.ANT_THRESHOLD);
  const sum = small.reduce((s,g)=>s+num(g.valor),0);
  const byDesc = {};
  small.forEach(g => { const k = (g.descripcion||g.categoria||'—').toLowerCase().trim(); byDesc[k] = byDesc[k] || { desc:g.descripcion||g.categoria, n:0, sum:0 }; byDesc[k].n++; byDesc[k].sum += num(g.valor); });
  const repeats = Object.values(byDesc).filter(r => r.n >= 3).sort((a,b)=>b.sum-a.sum).slice(0,4);
  return { count: small.length, sum, potential: Math.round(sum * 0.4), repeats };
}

function buildInsights(mk) {
  const out = [];
  const prev = addMonths(mk, -1);
  const gas = gastosMes(mk), gasPrev = gastosMes(prev);
  const ing = salariosMes(mk);
  const aho = ahorrosMes(mk), ahoPrev = ahorrosMes(prev);
  const disp = disponibleMes(mk);
  const days = daysInMonth(mk); const elapsed = Math.max(1, +todayISO().slice(8,10)); const left = days - elapsed;

  if (gasPrev > 0) {
    const diff = gas - gasPrev; const pct = Math.abs(diff / gasPrev * 100);
    if (diff > 0) out.push({ emoji:'📈', t:`Gastaron ${pct.toFixed(0)}% más que ${MESES_LARGO[+prev.split('-')[1]-1]}`, s:`${money(gas)} vs ${money(gasPrev)} el mes pasado.` });
    else if (diff < 0) out.push({ emoji:'📉', t:`Bajaron el gasto ${pct.toFixed(0)}%`, s:`Gastaron ${money(Math.abs(diff))} menos que el mes pasado. ¡Bien!` });
  }
  if (aho > ahoPrev && aho > 0) out.push({ emoji:'🐷', t:'Aumentaron el ahorro', s:`Este mes han ahorrado ${money(aho)}.` });

  // categoría con mayor variación (mercado)
  const catNow = {}, catPrev = {};
  state.data.Gastos.forEach(g => { if(!inScope(g.usuario)) return; if(monthKey(g.fecha)===mk) catNow[g.categoria]=(catNow[g.categoria]||0)+num(g.valor); if(monthKey(g.fecha)===prev) catPrev[g.categoria]=(catPrev[g.categoria]||0)+num(g.valor); });
  let bigCat=null, bigDiff=0;
  Object.keys(catNow).forEach(k => { const d=(catNow[k]||0)-(catPrev[k]||0); if(d>bigDiff){bigDiff=d;bigCat=k;} });
  if (bigCat && bigDiff > CONFIG.ANT_THRESHOLD) out.push({ emoji: cat(bigCat).emoji, t:`El gasto en ${bigCat} aumentó`, s:`+${money(bigDiff)} frente al mes anterior.` });

  if (ing > 0) {
    const promDia = gas / elapsed; const proy = promDia * days;
    out.push({ emoji:'🔮', t:`Proyección de fin de mes`, s:`A este ritmo cerrarán con ~${money(ing*0.7 - proy)} disponible tras diezmo y ahorro.` });
    if (left > 0) out.push({ emoji:'📅', t:`Quedan ${left} días del mes`, s: disp>=0 ? `Disponible actual: ${money(disp)}.` : `Van ${money(-disp)} sobre el presupuesto.` });
    const metaAho = ing*0.20;
    if (aho >= metaAho && metaAho>0) out.push({ emoji:'🎯', t:'Cumpliendo la meta de ahorro', s:`Meta 20% (${money(metaAho)}) alcanzada.` });
    else if (metaAho>0) out.push({ emoji:'🎯', t:'Meta de ahorro en progreso', s:`Faltan ${money(metaAho-aho)} para el 20% del mes.` });
  }

  // gasto atípico (mayor a 2.5x el promedio)
  const gm = state.data.Gastos.filter(g=>inScope(g.usuario)&&monthKey(g.fecha)===mk);
  if (gm.length >= 4) { const avg = gas/gm.length; const outlier = gm.find(g=>num(g.valor) > avg*2.5 && num(g.valor) > CONFIG.ANT_THRESHOLD);
    if (outlier) out.push({ emoji:'🚨', t:'Gasto fuera de lo habitual', s:`${outlier.descripcion||outlier.categoria}: ${money(outlier.valor)}.` }); }

  return out;
}

/* ------------------------------------------------------------------ *
 * 10. FORMULARIOS (bottom sheets)
 * ------------------------------------------------------------------ */
function fieldSelect(name, label, options, selected) {
  return `<label class="field"><span class="field-label">${label}</span><select name="${name}">
    ${options.map(o => { const v = typeof o==='object'?o.v:o; const l = typeof o==='object'?o.l:o; return `<option value="${esc(v)}"${selected===v?' selected':''}>${esc(l)}</option>`; }).join('')}
  </select></label>`;
}
function userField(sel) { return fieldSelect('usuario','Usuario', CONFIG.USERS, sel || defaultUser()); }
function accountField(name, label, sel) { return fieldSelect(name, label, ACCOUNTS.map(a=>({v:a.id,l:`${a.emoji} ${a.id}`})), sel); }
function defaultUser() { return state.scope !== 'familia' ? state.scope : CONFIG.USERS[0]; }

function openQuickAdd() {
  openSheet('Registro rápido', `
    <div class="qa-grid">
      ${quickAct('💸','Gasto','openGasto')}
      ${quickAct('💵','Salario','openSalario')}
      ${quickAct('🔄','Transferir','openTransferencia')}
      ${quickAct('🏧','Retirar','openRetiro')}
      ${quickAct('🐷','Ahorro','openAhorro')}
      ${quickAct('🎯','Meta','openMeta')}
      ${quickAct('💳','Deuda','openDeuda')}
    </div>`);
}

function openGasto() {
  openSheet('Nuevo gasto', `
    <form data-form="gasto">
      <input class="amount-input" name="valor" inputmode="numeric" placeholder="$ 0" autocomplete="off" />
      ${userField()}
      ${fieldSelect('categoria','Categoría', CATEGORIES.map(c=>({v:c.id,l:`${c.emoji} ${c.id}`})))}
      <label class="field"><span class="field-label">Descripción</span><input name="descripcion" placeholder="Ej: Mercado D1" /></label>
      <div class="field-row">
        ${accountField('cuenta','Cuenta', 'Davivienda')}
        ${fieldSelect('metodo','Método', METHODS)}
      </div>
      <div class="field-row">
        <label class="field"><span class="field-label">Fecha</span><input type="date" name="fecha" value="${todayISO()}" /></label>
        <label class="field"><span class="field-label">Observaciones</span><input name="observaciones" placeholder="Opcional" /></label>
      </div>
      <button class="btn btn-primary btn-block" type="submit">Guardar gasto</button>
    </form>`, { onMount: mountAmount });
}

function openSalario() {
  openSheet('Registrar salario', `
    <form data-form="salario">
      <input class="amount-input" name="salario" inputmode="numeric" placeholder="$ 0" autocomplete="off" />
      ${userField()}
      <div class="field-row">
        <label class="field"><span class="field-label">Mes</span><input type="month" name="mes" value="${curMonth()}" /></label>
        ${accountField('cuenta','Ingresa a', 'Davivienda')}
      </div>
      <div class="card card-flat" id="salPreview" style="margin:4px 0 14px"></div>
      <button class="btn btn-primary btn-block" type="submit">Guardar salario</button>
    </form>`, { onMount: (s) => {
      const inp = $('[name="salario"]', s); mountAmount(s);
      const upd = () => { const v = num(inp.value); $('#salPreview', s).innerHTML =
        `<div class="between"><span class="tiny">🙏 Diezmo 10%</span><b class="mono-num">${money(v*.1)}</b></div>
         <div class="between mt8"><span class="tiny">🐷 Ahorro 20%</span><b class="mono-num">${money(v*.2)}</b></div>
         <div class="between mt8"><span class="tiny">✅ Disponible</span><b class="mono-num" style="color:var(--good)">${money(v*.7)}</b></div>`; };
      inp.addEventListener('input', upd); upd();
    } });
}

function openTransferencia() {
  openSheet('Transferencia entre cuentas', `
    <form data-form="transferencia">
      <input class="amount-input" name="valor" inputmode="numeric" placeholder="$ 0" />
      ${userField()}
      <div class="field-row">
        ${accountField('origen','Desde', 'Davivienda')}
        ${accountField('destino','Hacia', 'Nequi')}
      </div>
      <div class="field-row">
        <label class="field"><span class="field-label">Fecha</span><input type="date" name="fecha" value="${todayISO()}" /></label>
        <label class="field"><span class="field-label">Descripción</span><input name="descripcion" placeholder="Opcional" /></label>
      </div>
      <button class="btn btn-primary btn-block" type="submit">Transferir</button>
    </form>`, { onMount: mountAmount });
}

function openRetiro() {
  openSheet('Retirar efectivo', `
    <form data-form="retiro">
      <input class="amount-input" name="valor" inputmode="numeric" placeholder="$ 0" />
      ${userField()}
      ${accountField('origen','Desde el banco', 'Davivienda')}
      <div class="field-row">
        <label class="field"><span class="field-label">Fecha</span><input type="date" name="fecha" value="${todayISO()}" /></label>
        <label class="field"><span class="field-label">Descripción</span><input name="descripcion" placeholder="Opcional" /></label>
      </div>
      <p class="tiny muted mb8">El dinero pasará del banco a 💵 Efectivo.</p>
      <button class="btn btn-primary btn-block" type="submit">Registrar retiro</button>
    </form>`, { onMount: mountAmount });
}

function openAhorro() {
  openSheet('Registrar ahorro', `
    <form data-form="ahorro">
      <input class="amount-input" name="valor" inputmode="numeric" placeholder="$ 0" />
      ${userField()}
      <div class="field-row">
        <label class="field"><span class="field-label">Tipo</span><input name="tipo" placeholder="Ej: Ahorro mensual" value="Ahorro mensual" /></label>
        <label class="field"><span class="field-label">Fecha</span><input type="date" name="fecha" value="${todayISO()}" /></label>
      </div>
      <button class="btn btn-primary btn-block" type="submit">Guardar ahorro</button>
    </form>`, { onMount: mountAmount });
}

function openMeta() {
  openSheet('Nueva meta de ahorro', `
    <form data-form="meta">
      <label class="field"><span class="field-label">Nombre</span><input name="meta" placeholder="Ej: Viaje a San Andrés" /></label>
      <div class="field-row">
        <label class="field"><span class="field-label">Valor objetivo</span><input name="objetivo" inputmode="numeric" placeholder="$ 0" /></label>
        <label class="field"><span class="field-label">Ya tienes</span><input name="acumulado" inputmode="numeric" placeholder="$ 0" value="0" /></label>
      </div>
      <label class="field"><span class="field-label">Fecha estimada</span><input type="date" name="fecha" /></label>
      <button class="btn btn-primary btn-block" type="submit">Crear meta</button>
    </form>`);
}

function openAjuste() {
  const rows = ACCOUNTS.map(a => `<label class="field"><span class="field-label">${a.emoji} ${a.id}</span>
    <input name="acc_${esc(a.id)}" inputmode="numeric" placeholder="Saldo actual" value="${scopeUsers().length===1?num(saldoInicial(scopeUsers()[0],a.id))||'':''}" /></label>`).join('');
  const u = defaultUser();
  openSheet('Ajustar saldos', `
    <p class="sheet-desc">Fija el saldo inicial real de cada cuenta de <b>${esc(u)}</b>. La app sumará y restará los movimientos a partir de aquí.</p>
    <form data-form="ajuste">
      ${fieldSelect('usuario','Usuario', CONFIG.USERS, u)}
      ${rows}
      <button class="btn btn-primary btn-block" type="submit">Guardar saldos</button>
    </form>`, { desc:null });
}

function openPagoServicio(id) {
  const s = state.data.Servicios.find(x => x.id === id); if (!s) return;
  openSheet(`Pagar ${s.servicio}`, `
    <form data-form="pago" data-id="${id}">
      <input class="amount-input" name="valor" inputmode="numeric" placeholder="$ 0" value="${s.valor?num(s.valor):''}" />
      ${userField()}
      ${accountField('cuenta','Pagar desde', 'Davivienda')}
      <label class="field"><span class="field-label">Fecha de pago</span><input type="date" name="fechaPago" value="${todayISO()}" /></label>
      <p class="tiny muted mb8">Se creará el gasto en la categoría "${esc(s.servicio)}" y se descontará de la cuenta.</p>
      <button class="btn btn-primary btn-block" type="submit">Confirmar pago</button>
    </form>`, { onMount: mountAmount });
}

function openServicioEdit(id) {
  const s = state.data.Servicios.find(x => x.id === id); if (!s) return;
  openSheet(`Editar ${s.servicio}`, `
    <form data-form="servicioEdit" data-id="${id}">
      <label class="field"><span class="field-label">Valor estimado</span>
        <input class="amount-input" name="valor" inputmode="numeric" placeholder="$ 0" value="${s.valor ? '$ ' + num(s.valor).toLocaleString('es-CO') : ''}" /></label>
      <label class="field"><span class="field-label">📅 Fecha oportuna de pago</span>
        <input type="date" name="fechaLimite" value="${s.fechaLimite ? String(s.fechaLimite).slice(0,10) : ''}" /></label>
      <p class="tiny muted mb8">Define hasta qué día tienes plazo para pagar esta obligación.</p>
      <button class="btn btn-primary btn-block" type="submit">Guardar</button>
    </form>`, { onMount: mountAmount });
}

function abonarMeta(id) {
  const m = state.data.Metas.find(x => x.id === id); if (!m) return;
  openSheet(`Abonar a ${m.meta}`, `
    <form data-form="abono" data-id="${id}">
      <input class="amount-input" name="valor" inputmode="numeric" placeholder="$ 0" />
      <p class="tiny muted mb8">Acumulado actual: ${money(m.acumulado)} / ${money(m.objetivo)}</p>
      <button class="btn btn-primary btn-block" type="submit">Abonar</button>
    </form>`, { onMount: mountAmount });
}

function openDeuda(id) {
  const d = id ? state.data.Deudas.find(x => x.id === id) : null;
  const dl = DEBT_ENTITIES.map(e => `<option value="${esc(e)}"></option>`).join('');
  openSheet(d ? 'Editar deuda' : 'Registrar deuda', `
    <form data-form="deuda"${d ? ` data-id="${d.id}"` : ''}>
      <label class="field"><span class="field-label">Entidad</span>
        <input name="entidad" list="entList" placeholder="Ej: ICETEX" autocomplete="off" value="${d ? esc(d.entidad) : ''}" />
        <datalist id="entList">${dl}</datalist></label>
      ${userField(d ? d.usuario : undefined)}
      <label class="field"><span class="field-label">${d ? 'Saldo / valor total de la deuda' : 'Valor total que debes hoy'}</span>
        <input class="amount-input" name="valorInicial" inputmode="numeric" placeholder="$ 0" value="${d ? '$ ' + num(d.valorInicial).toLocaleString('es-CO') : ''}" /></label>
      <label class="field"><span class="field-label">Descripción (opcional)</span><input name="descripcion" placeholder="Ej: Crédito educativo" value="${d ? esc(d.descripcion || '') : ''}" /></label>
      <div class="field-row">
        <label class="field"><span class="field-label">Cuota mensual (opcional)</span><input name="cuota" inputmode="numeric" placeholder="$ 0" value="${d && d.cuota ? '$ ' + num(d.cuota).toLocaleString('es-CO') : ''}" /></label>
        <label class="field"><span class="field-label">Día de pago</span><input type="number" name="diaPago" min="1" max="31" inputmode="numeric" placeholder="1-31" value="${d && d.diaPago ? esc(d.diaPago) : ''}" /></label>
      </div>
      <p class="tiny muted mb8">${d ? 'Ajustar el valor total recalcula cuánto falta por pagar.' : 'Registra el saldo pendiente actual. Cada abono lo irá descontando hasta llegar a $0.'}</p>
      <button class="btn btn-primary btn-block" type="submit">${d ? 'Guardar cambios' : 'Registrar deuda'}</button>
    </form>`, { onMount: mountAmount });
}

function abonarDeuda(id) {
  const d = state.data.Deudas.find(x => x.id === id); if (!d) return;
  const saldo = deudaSaldo(d);
  const sugerido = d.cuota ? Math.min(num(d.cuota), saldo) : saldo;
  openSheet(`Abonar a ${d.entidad}`, `
    <form data-form="deudaAbono" data-id="${id}">
      <input class="amount-input" name="valor" inputmode="numeric" placeholder="$ 0" value="${sugerido ? '$ ' + Math.round(sugerido).toLocaleString('es-CO') : ''}" />
      ${userField(d.usuario)}
      <div class="field-row">
        ${accountField('cuenta','Pagar desde', 'Davivienda')}
        ${fieldSelect('metodo','Método', METHODS)}
      </div>
      <label class="field"><span class="field-label">Fecha</span><input type="date" name="fecha" value="${todayISO()}" /></label>
      <div class="card card-flat" style="margin:4px 0 12px">
        <div class="between"><span class="tiny">Saldo actual</span><b class="mono-num">${money(saldo)}</b></div>
        <div class="between mt4"><span class="tiny">Quedaría</span><b class="mono-num" id="deudaRestante">${money(Math.max(0, saldo - sugerido))}</b></div>
      </div>
      <p class="tiny muted mb8">Se creará un gasto y se descontará de la cuenta. Si cubres el total, la deuda quedará <b>Saldada</b>.</p>
      <button class="btn btn-primary btn-block" type="submit">Registrar abono</button>
    </form>`, { onMount: (s) => {
      mountAmount(s);
      const inp = $('[name="valor"]', s), out = $('#deudaRestante', s);
      const upd = () => { out.textContent = money(Math.max(0, saldo - num(inp.value))); };
      inp.addEventListener('input', upd);
    } });
}

/* Formatea el input de monto mientras se escribe */
function mountAmount(scope) {
  const el = $('.amount-input', scope) || $('[inputmode="numeric"]', scope);
  $$('[inputmode="numeric"]', scope).forEach(inp => {
    inp.addEventListener('input', () => {
      const raw = num(inp.value);
      inp.value = raw ? (inp.classList.contains('amount-input') ? '$ ' : '') + raw.toLocaleString('es-CO') : '';
    });
  });
}

/* Manejo de envío de formularios */
function handleForm(form) {
  const kind = form.dataset.form;
  const data = {}; $$('[name]', form).forEach(i => data[i.name] = i.value.trim());
  const V = n => num(data[n]);

  switch (kind) {
    case 'gasto': {
      if (V('valor') <= 0) return toast('Ingresa un valor', 'err');
      addRecord('Gastos', { fecha:data.fecha||todayISO(), usuario:data.usuario, categoria:data.categoria,
        descripcion:data.descripcion, valor:V('valor'), cuenta:data.cuenta, metodo:data.metodo, observaciones:data.observaciones });
      toast('Gasto registrado'); break;
    }
    case 'salario': {
      if (V('salario') <= 0) return toast('Ingresa el salario', 'err');
      const mes = data.mes || curMonth();
      addRecord('Salarios', { mes, usuario:data.usuario, salario:V('salario'), cuenta:data.cuenta, fecha:`${mes}-01` });
      toast('Salario guardado'); break;
    }
    case 'transferencia': {
      if (V('valor') <= 0) return toast('Ingresa un valor', 'err');
      if (data.origen === data.destino) return toast('Elige cuentas distintas', 'err');
      addRecord('Transferencias', { fecha:data.fecha||todayISO(), usuario:data.usuario, origen:data.origen,
        destino:data.destino, valor:V('valor'), tipo:'transferencia', descripcion:data.descripcion });
      toast('Transferencia registrada'); break;
    }
    case 'retiro': {
      if (V('valor') <= 0) return toast('Ingresa un valor', 'err');
      addRecord('Transferencias', { fecha:data.fecha||todayISO(), usuario:data.usuario, origen:data.origen,
        destino:'Efectivo', valor:V('valor'), tipo:'retiro', descripcion:data.descripcion||'Retiro de efectivo' });
      toast('Retiro registrado'); break;
    }
    case 'ahorro': {
      if (V('valor') <= 0) return toast('Ingresa un valor', 'err');
      addRecord('Ahorros', { fecha:data.fecha||todayISO(), usuario:data.usuario, valor:V('valor'), tipo:data.tipo||'Ahorro' });
      toast('Ahorro registrado'); break;
    }
    case 'meta': {
      if (!data.meta) return toast('Ponle un nombre', 'err');
      if (V('objetivo') <= 0) return toast('Ingresa el objetivo', 'err');
      addRecord('Metas', { meta:data.meta, objetivo:V('objetivo'), acumulado:V('acumulado'), fecha:data.fecha });
      toast('Meta creada'); break;
    }
    case 'abono': {
      const m = state.data.Metas.find(x => x.id === form.dataset.id); if (!m) return;
      updateRecord('Metas', m.id, { acumulado: num(m.acumulado) + V('valor') });
      toast('Abono agregado'); break;
    }
    case 'ajuste': {
      const u = data.usuario;
      ACCOUNTS.forEach(a => {
        const key = 'acc_' + a.id; if (data[key] === undefined || data[key] === '') return;
        const val = num(data[key]);
        const ex = state.data.SaldosIniciales.find(x => x.usuario === u && x.cuenta === a.id);
        if (ex) updateRecord('SaldosIniciales', ex.id, { valor: val });
        else addRecord('SaldosIniciales', { usuario:u, cuenta:a.id, valor:val });
      });
      toast('Saldos actualizados'); break;
    }
    case 'pago': {
      const s = state.data.Servicios.find(x => x.id === form.dataset.id); if (!s) return;
      if (V('valor') <= 0) return toast('Ingresa el valor', 'err');
      addRecord('Gastos', { fecha:data.fechaPago||todayISO(), usuario:data.usuario, categoria:s.servicio,
        descripcion:`Pago ${s.servicio}`, valor:V('valor'), cuenta:data.cuenta, metodo:'Transferencia', observaciones:'Servicio' });
      updateRecord('Servicios', s.id, { valor:V('valor'), estado:'Pagado', usuarioPago:data.usuario, cuenta:data.cuenta, fechaPago:data.fechaPago||todayISO() });
      toast(`${s.servicio} pagado`); break;
    }
    case 'servicioEdit': {
      const s = state.data.Servicios.find(x => x.id === form.dataset.id); if (!s) return;
      updateRecord('Servicios', s.id, { valor: V('valor'), fechaLimite: data.fechaLimite || s.fechaLimite });
      toast('Obligación actualizada'); break;
    }
    case 'deuda': {
      if (!data.entidad) return toast('Escribe la entidad', 'err');
      if (V('valorInicial') <= 0) return toast('Ingresa el valor de la deuda', 'err');
      const dia = data.diaPago ? Math.min(31, Math.max(1, Math.round(num(data.diaPago)))) : '';
      if (form.dataset.id) {
        updateRecord('Deudas', form.dataset.id, { entidad:data.entidad, usuario:data.usuario,
          valorInicial:V('valorInicial'), descripcion:data.descripcion, cuota:V('cuota'), diaPago:dia });
        toast('Deuda actualizada');
      } else {
        addRecord('Deudas', { usuario:data.usuario, entidad:data.entidad, descripcion:data.descripcion,
          valorInicial:V('valorInicial'), cuota:V('cuota'), diaPago:dia, fecha:todayISO(), estado:'Activa' });
        toast('Deuda registrada');
      }
      break;
    }
    case 'deudaAbono': {
      const d = state.data.Deudas.find(x => x.id === form.dataset.id); if (!d) return;
      if (V('valor') <= 0) return toast('Ingresa un valor', 'err');
      const categoria = CATEGORIES.find(c => c.id === d.entidad) ? d.entidad : 'Otros gastos';
      addRecord('Gastos', { fecha:data.fecha||todayISO(), usuario:data.usuario, categoria,
        descripcion:`Abono ${d.entidad}`, valor:V('valor'), cuenta:data.cuenta, metodo:data.metodo||'Transferencia',
        observaciones:'Abono deuda', deudaId:d.id });
      const saldaAhora = num(d.valorInicial) - deudaAbonado(d) <= 0;
      if (saldaAhora) updateRecord('Deudas', d.id, { estado:'Saldada' });
      toast(saldaAhora ? `¡${d.entidad} saldada! 🎉` : `Abono a ${d.entidad} registrado`); break;
    }
  }
  closeSheet();
  refresh();
}

/* Búsqueda global */
function openSearch() {
  openSheet('Buscar', `
    <div class="search-panel">
      <input id="searchInput" placeholder="Buscar gasto, servicio, meta…" autocomplete="off" />
      <div id="searchResults" class="mt12"></div>
    </div>`, { onMount: (s) => {
      const inp = $('#searchInput', s), res = $('#searchResults', s);
      inp.focus();
      const run = () => {
        const q = inp.value.toLowerCase().trim();
        if (!q) { res.innerHTML = '<p class="tiny muted">Escribe para buscar…</p>'; return; }
        const g = state.data.Gastos.filter(x => `${x.descripcion} ${x.categoria} ${x.usuario}`.toLowerCase().includes(q)).slice(0,8);
        const sv = state.data.Servicios.filter(x => String(x.servicio).toLowerCase().includes(q)).slice(0,4);
        const mt = state.data.Metas.filter(x => String(x.meta).toLowerCase().includes(q)).slice(0,4);
        const de = state.data.Deudas.filter(x => `${x.entidad} ${x.descripcion||''}`.toLowerCase().includes(q)).slice(0,4);
        let html = '';
        if (de.length) html += '<div class="tiny muted mt8">Deudas</div>' + de.map(x=>`<div class="row"><div class="row-ic" style="background:#6366f122;color:#6366f1">💳</div><div class="row-main"><div class="row-title">${esc(x.entidad)}</div><div class="row-sub">${deudaSaldada(x)?'Saldada ✅':`por pagar ${money(deudaSaldo(x))}`}</div></div><div class="row-amt mono-num">${money(x.valorInicial)}</div></div>`).join('');
        if (g.length) html += '<div class="tiny muted mt8">Gastos</div>' + g.map(x=>{const c=cat(x.categoria);return `<div class="row"><div class="row-ic" style="background:${c.color}22;color:${c.color}">${c.emoji}</div><div class="row-main"><div class="row-title">${esc(x.descripcion||x.categoria)}</div><div class="row-sub">${fmtDate(x.fecha)} · ${esc(x.usuario)}</div></div><div class="row-amt neg mono-num">${money(x.valor)}</div></div>`;}).join('');
        if (sv.length) html += '<div class="tiny muted mt8">Servicios</div>' + sv.map(x=>`<div class="row"><div class="row-ic">📅</div><div class="row-main"><div class="row-title">${esc(x.servicio)}</div><div class="row-sub">${estadoServicio(x)} · vence ${fmtDate(x.fechaLimite)}</div></div><div class="row-amt mono-num">${x.valor?money(x.valor):''}</div></div>`).join('');
        if (mt.length) html += '<div class="tiny muted mt8">Metas</div>' + mt.map(x=>`<div class="row"><div class="row-ic">🎯</div><div class="row-main"><div class="row-title">${esc(x.meta)}</div><div class="row-sub">${money(x.acumulado)} / ${money(x.objetivo)}</div></div></div>`).join('');
        res.innerHTML = html || '<p class="tiny muted">Sin resultados.</p>';
      };
      inp.addEventListener('input', run); run();
    } });
}

/* Configuración */
function openSettings() {
  const st = API.configured() ? '🟢 Conectado a Google Sheets' : '🟡 Modo local (este dispositivo)';
  openSheet('Ajustes', `
    <div class="card card-flat mb8"><div class="between"><span class="tiny">Sincronización</span><span class="tiny">${st}</span></div></div>
    <div class="qa-grid">
      ${quickAct('⚖️','Ajustar saldos','openAjuste')}
      ${quickAct('🔄','Sincronizar','forceSync')}
      ${quickAct('⬇️','Exportar CSV','exportCSV')}
    </div>
    <button class="btn btn-ghost btn-block mt16" data-action="logout">Cerrar sesión</button>
    <p class="tiny muted mt16" style="text-align:center">R2 Finanzas · datos guardados en tu cuenta de Google.</p>`);
}
function forceSync() { closeSheet(); API.pull().then(() => { API.flush(); refresh(); toast('Sincronizando…','info'); }); }

/* Exportar CSV */
function exportCSV() {
  const rows = [['Fecha','Usuario','Categoria','Descripcion','Valor','Cuenta','Metodo','Observaciones']];
  state.data.Gastos.filter(g => inScope(g.usuario)).sort((a,b)=>String(a.fecha).localeCompare(String(b.fecha)))
    .forEach(g => rows.push([g.fecha,g.usuario,g.categoria,g.descripcion,num(g.valor),g.cuenta,g.metodo,g.observaciones]));
  const csv = rows.map(r => r.map(c => `"${String(c==null?'':c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = `R2_Finanzas_gastos_${curMonth()}.csv`; a.click();
  toast('CSV exportado');
}

/* ------------------------------------------------------------------ *
 * 11. TEMA / SESIÓN / EVENTOS
 * ------------------------------------------------------------------ */
function applyTheme(t) {
  document.body.dataset.theme = t;
  localStorage.setItem(LS.theme, t);
}
function toggleTheme() { applyTheme(document.body.dataset.theme === 'dark' ? 'light' : 'dark'); refresh(); }

function login() { localStorage.setItem(LS.auth, '1'); $('#login').hidden = true; $('#app').hidden = false; boot(); }
function logout() { localStorage.removeItem(LS.auth); location.reload(); }

const ACTIONS = { openGasto, openSalario, openTransferencia, openRetiro, openAhorro, openMeta, openDeuda, openAjuste, openSettings, forceSync, exportCSV, logout };

function wire() {
  // Login
  $('#loginForm').addEventListener('submit', e => {
    e.preventDefault();
    const pin = $('#pin').value.trim();
    if (pin === CONFIG.PASSWORD) { $('#loginError').hidden = true; login(); }
    else { $('#loginError').hidden = false; $('#pin').value=''; }
  });

  // Tabbar
  $$('.tab[data-route]').forEach(t => t.addEventListener('click', () => go(t.dataset.route)));
  $('#homeBtn').addEventListener('click', () => go('inicio'));

  // Scope switch
  $$('.scope-btn').forEach(b => b.addEventListener('click', () => {
    $$('.scope-btn').forEach(x => x.classList.remove('is-active'));
    b.classList.add('is-active');
    state.scope = b.dataset.scope; localStorage.setItem(LS.scope, state.scope); refresh();
  }));

  // Top actions
  $('#themeBtn').addEventListener('click', toggleTheme);
  $('#searchBtn').addEventListener('click', openSearch);
  $('#fab').addEventListener('click', openQuickAdd);

  // Delegated: navegación, acciones, forms
  document.body.addEventListener('click', e => {
    const goEl = e.target.closest('[data-go]');
    if (goEl) { closeSheet(); go(goEl.dataset.go); return; }
    const actEl = e.target.closest('[data-action]');
    if (actEl) { const fn = ACTIONS[actEl.dataset.action]; if (fn) fn(); return; }
  });
  document.body.addEventListener('submit', e => {
    const form = e.target.closest('[data-form]');
    if (form) { e.preventDefault(); handleForm(form); }
  });
}

/* Restaura el scope activo en la UI */
function syncScopeUI() {
  $$('.scope-btn').forEach(x => x.classList.toggle('is-active', x.dataset.scope === state.scope));
}

/* Arranque de la app (tras login) */
async function boot() {
  loadCache();
  syncScopeUI();
  ensureServicesForMonth(curMonth());
  go('inicio');
  await API.pull();
  ensureServicesForMonth(curMonth());
  refresh();
}

/* ------------------------------------------------------------------ *
 * 12. INIT
 * ------------------------------------------------------------------ */
function init() {
  applyTheme(localStorage.getItem(LS.theme) || 'dark');
  wire();
  if (localStorage.getItem(LS.auth) === '1') { $('#login').hidden = true; $('#app').hidden = false; boot(); }
  else { $('#login').hidden = false; $('#app').hidden = true; setTimeout(()=>$('#pin')?.focus(), 300); }

  // Service worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('service-worker.js').catch(()=>{}));
  }
  // Reintenta sincronizar al recuperar conexión
  window.addEventListener('online', () => API.flush());
}

document.addEventListener('DOMContentLoaded', init);
