// ============================================================
// HISTÓRICO — Gerar Laudo Colonoscopia (Firebase Edition)
// Depende de: core_colono.js + ui_colono.js + storage_colono.js + laudo_colono.js
// ============================================================

// ----------------------------------------------------------
// HISTÓRICO — Desfazer / Refazer / Último laudo
// ----------------------------------------------------------

// _histUndo/_histRedo guardam entradas { snap, label }, onde `label` descreve
// a ação que produziu a transição (ex.: "criar item"). O mesmo label viaja
// entre as pilhas para que desfazer e refazer anunciem a mesma ação.
let _histUndo      = [];
let _histRedo      = [];
let _histLast      = null;
let _histPendLabel = '';   // label da ação pendente até o próximo _histCommit()
let _histAplicando = false;
let _histTimer     = null;
let _histInstalado = false;
const HIST_LIMITE    = 50;
const HIST_KEY_LAUDO = 'colono_ultimo_laudo';

const _ZONAS_DINAMICAS_HIST = ['sortable-alteracao','sortable-diverticulo','sortable-canalanal'];

function _capturarDinamicos() {
  let dump = {};
  _ZONAS_DINAMICAS_HIST.forEach(function (zid) {
    let zone = document.getElementById(zid);
    if (!zone) return;
    let arr = [];
    zone.querySelectorAll(':scope > .item.item-dinamico').forEach(function (div) {
      let cb = div.querySelector('input[type="checkbox"]');
      if (!cb) return;
      arr.push({
        name:    cb.name || '',
        value:   cb.value || '',
        checked: !!cb.checked,
        attrs:   {
          paris:     div.getAttribute('data-paris'),
          loc:       div.getAttribute('data-loc'),
          numero:    div.getAttribute('data-numero'),
          resseccao: div.getAttribute('data-resseccao'),
          auto:      div.getAttribute('data-auto')
        }
      });
    });
    dump[zid] = arr;
  });
  return dump;
}

function _restaurarDinamicos(dump) {
  if (!dump) return;
  Object.keys(dump).forEach(function (zid) {
    if (!_ZONAS_DINAMICAS_HIST.includes(zid)) return;
    let zone = document.getElementById(zid);
    if (!zone) return;
    zone.querySelectorAll(':scope > .item.item-dinamico').forEach(function (el) { el.remove(); });
    (dump[zid] || []).forEach(function (it) {
      let div = createCheckboxDiv(it.value, it.name.replace(/_d\d+$/, ''));
      let cb = div.querySelector('input[type="checkbox"]');
      if (cb) {
        cb.name    = it.name;
        cb.checked = it.checked;
      }
      if (it.attrs) {
        Object.keys(it.attrs).forEach(function (k) {
          if (it.attrs[k] != null) div.setAttribute('data-' + k, it.attrs[k]);
        });
      }
      zone.appendChild(div);
    });
  });
}

// Snapshot só dos "dados salvos" (estrutura que vai pro Firestore):
// itens das seções e listas de dropdown. NÃO inclui estado de marcação
// de checkboxes, selects de uso, achados dinâmicos nem output gerado —
// esses formam a "camada de uso" e são preservados intactos no desfazer.
function _histCapturar() {
  if (!window._inicializado) return null;
  try {
    return JSON.stringify(coletarDB({ semDinamicos: true }));
  } catch (e) { return null; }
}

// Snapshot completo do laudo (estrutura + camada de uso). Usado pelo
// "↺ Último laudo" no sessionStorage, que precisa reproduzir o laudo
// inteiro (com itens marcados, valores escolhidos e texto gerado).
function _capturarLaudoCompleto() {
  if (!window._inicializado) return null;
  try {
    let checks = Array.from(document.querySelectorAll('input[type="checkbox"]')).map(function (cb) {
      return { id: cb.id || '', name: cb.name || '', checked: !!cb.checked };
    });
    let selects = Array.from(document.querySelectorAll('select')).map(function (s) {
      return { id: s.id || '', value: s.value };
    });
    let out = document.getElementById('output');
    return JSON.stringify({
      db:        coletarDB(),
      dinamicos: _capturarDinamicos(),
      checks:    checks,
      selects:   selects,
      output:    out ? out.innerHTML : ''
    });
  } catch (e) { return null; }
}

function _restaurarLaudoCompleto(snapJson) {
  if (!snapJson) return;
  let estado;
  try { estado = JSON.parse(snapJson); } catch (e) { return; }
  _histAplicando = true;
  window._histAplicando = true;
  try {
    _DB = JSON.parse(JSON.stringify(estado.db));
    if (typeof _repararDB === 'function') _repararDB(_DB);
    window._inicializado = false;
    inicializar();
    _restaurarDinamicos(estado.dinamicos);
    let checksByName = {};
    document.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
      let n = cb.name || '';
      if (!checksByName[n]) checksByName[n] = [];
      checksByName[n].push(cb);
    });
    (estado.checks || []).forEach(function (c) {
      let el = c.id ? document.getElementById(c.id) : null;
      if (el && el.type === 'checkbox') { el.checked = c.checked; return; }
      if (c.name && checksByName[c.name]) {
        checksByName[c.name].forEach(function (cb) { cb.checked = c.checked; });
      }
    });
    (estado.selects || []).forEach(function (s) {
      if (!s.id) return;
      let el = document.getElementById(s.id);
      if (el) el.value = s.value;
    });
    let out = document.getElementById('output');
    if (out) {
      out.innerHTML = estado.output || '';
      delete out.dataset.dirty;
    }
    _histLast = _histCapturar();
    _temAlteracoes = true;
    if (typeof atualizarIndicadorSalvo === 'function') atualizarIndicadorSalvo();
  } catch (e) {
    console.error('[hist] erro ao restaurar laudo completo:', e);
  } finally {
    setTimeout(function () {
      _histAplicando = false;
      window._histAplicando = false;
      if (typeof _agendarLiveLaudo === 'function') _agendarLiveLaudo();
    }, 60);
    atualizarBotoesHistorico();
  }
}

function _histRestaurar(snapJson) {
  if (!snapJson) return;
  let db;
  try { db = JSON.parse(snapJson); } catch (e) { return; }
  _histAplicando = true;
  window._histAplicando = true; // espelha pro guard em inicializar()
  try {
    // Preserva a camada de uso (não é dado salvo).
    let checks = Array.from(document.querySelectorAll('input[type="checkbox"]')).map(function (cb) {
      return { id: cb.id || '', name: cb.name || '', checked: !!cb.checked };
    });
    let selects = Array.from(document.querySelectorAll('select')).map(function (s) {
      return { id: s.id || '', value: s.value };
    });
    let dinamicos = _capturarDinamicos();
    let out = document.getElementById('output');
    let outputHtml  = out ? out.innerHTML : '';
    let outputDirty = !!(out && out.dataset.dirty);

    // Substitui a estrutura e re-renderiza as seções/dropdowns.
    _DB = JSON.parse(JSON.stringify(db));
    if (typeof _repararDB === 'function') _repararDB(_DB);
    window._inicializado = false;
    inicializar();

    // Re-aplica camada de uso por cima da nova estrutura.
    _restaurarDinamicos(dinamicos);
    let checksByName = {};
    document.querySelectorAll('input[type="checkbox"]').forEach(function (cb) {
      let n = cb.name || '';
      if (!checksByName[n]) checksByName[n] = [];
      checksByName[n].push(cb);
    });
    checks.forEach(function (c) {
      let el = c.id ? document.getElementById(c.id) : null;
      if (el && el.type === 'checkbox') { el.checked = c.checked; return; }
      if (c.name && checksByName[c.name]) {
        checksByName[c.name].forEach(function (cb) { cb.checked = c.checked; });
      }
    });
    selects.forEach(function (s) {
      if (!s.id) return;
      let el = document.getElementById(s.id);
      if (!el) return;
      // Só re-aplica se a option ainda existir (lista pode ter mudado).
      let existe = Array.from(el.options).some(function (o) { return o.value === s.value; });
      if (existe) el.value = s.value;
    });
    if (out) {
      out.innerHTML = outputHtml;
      if (outputDirty) out.dataset.dirty = '1'; else delete out.dataset.dirty;
    }

    _histLast = snapJson;
    // Sinaliza que precisa re-persistir no Firestore.
    if (typeof _temAlteracoes !== 'undefined') _temAlteracoes = true;
    if (typeof atualizarIndicadorSalvo === 'function') atualizarIndicadorSalvo();
  } catch (e) {
    console.error('[hist] erro ao restaurar:', e);
  } finally {
    setTimeout(function () {
      _histAplicando = false;
      window._histAplicando = false;
    }, 60);
    atualizarBotoesHistorico();
  }
}

function _histCommit() {
  let snap = _histCapturar();
  if (snap === null) return;
  let label = _histPendLabel; _histPendLabel = '';
  if (_histLast === null) { _histLast = snap; atualizarBotoesHistorico(); return; }
  if (snap === _histLast) return;
  _histUndo.push({ snap: _histLast, label: label });
  if (_histUndo.length > HIST_LIMITE) _histUndo.shift();
  _histRedo.length = 0;
  _histLast = snap;
  atualizarBotoesHistorico();
}

function _flushSnapshot() {
  if (_histTimer === null) return;
  clearTimeout(_histTimer);
  _histTimer = null;
  if (_histAplicando || !window._inicializado) return;
  _histCommit();
}

function registrarSnapshot(label) {
  if (_histAplicando) return;
  if (!window._inicializado) return;
  if (label) _histPendLabel = label;
  clearTimeout(_histTimer);
  _histTimer = setTimeout(function () {
    _histTimer = null;
    if (_histAplicando || !window._inicializado) return;
    _histCommit();
  }, 350);
}

function desfazer() {
  _flushSnapshot();
  if (!_histUndo.length) { mostrarToast('↶ Nada para desfazer', '#7a4000', 1500); return; }
  let atual = _histCapturar();
  let entry = _histUndo.pop();
  let label = entry.label;
  if (atual !== null && atual !== entry.snap) _histRedo.push({ snap: atual, label: label });
  _histRestaurar(entry.snap);
  mostrarToast(label ? '↶ Desfeito: ' + label : '↶ Desfeito', '#1a3a5a', 1600);
}

function refazer() {
  _flushSnapshot();
  if (!_histRedo.length) { mostrarToast('↷ Nada para refazer', '#7a4000', 1500); return; }
  let atual = _histCapturar();
  let entry = _histRedo.pop();
  let label = entry.label;
  if (atual !== null && atual !== entry.snap) _histUndo.push({ snap: atual, label: label });
  _histRestaurar(entry.snap);
  mostrarToast(label ? '↷ Refeito: ' + label : '↷ Refeito', '#1a3a5a', 1600);
}

function salvarUltimoLaudo() {
  let snap = _capturarLaudoCompleto();
  if (!snap) return;
  try { sessionStorage.setItem(HIST_KEY_LAUDO, snap); } catch (e) {}
  atualizarBotoesHistorico();
}

async function recuperarUltimoLaudo() {
  let snap = sessionStorage.getItem(HIST_KEY_LAUDO);
  if (!snap) { mostrarToast('Nenhum laudo anterior salvo nesta sessão.', '#7a4000', 2800); return; }
  if (!await confirmar('Substituir o estado atual pelo último laudo gerado?', { okText: 'Substituir' })) return;
  _flushSnapshot();
  // Empurra o snapshot estrutural atual pro undo, para permitir reverter
  // caso a restauração mude itens criados/excluídos desde então.
  let atualEstrutura = _histCapturar();
  if (atualEstrutura !== null && atualEstrutura !== _histLast) {
    _histUndo.push({ snap: _histLast, label: 'recuperar último laudo' });
    if (_histUndo.length > HIST_LIMITE) _histUndo.shift();
    _histRedo.length = 0;
    _histLast = atualEstrutura;
  }
  _restaurarLaudoCompleto(snap);
  mostrarToast('↺ Último laudo recuperado.', '#1a3a1a', 2500);
}

function atualizarBotoesHistorico() {
  // Atualiza TODAS as cópias dos botões (sidebar + barra de título), por isso
  // selecionamos via onclick em vez de getElementById (id é único no DOM).
  let undoOff = _histUndo.length === 0;
  let redoOff = _histRedo.length === 0;
  let lastOff = !sessionStorage.getItem(HIST_KEY_LAUDO);
  document.querySelectorAll('[onclick="desfazer()"]').forEach(function (b) { b.disabled = undoOff; });
  document.querySelectorAll('[onclick="refazer()"]').forEach(function (b) { b.disabled = redoOff; });
  document.querySelectorAll('[onclick="recuperarUltimoLaudo()"]').forEach(function (b) { b.disabled = lastOff; });
}

let _liveTimer = null;
function _agendarLiveLaudo() {
  if (_histAplicando) return;
  if (typeof montarLaudo !== 'function') return;
  clearTimeout(_liveTimer);
  _liveTimer = setTimeout(function () {
    _liveTimer = null;
    try { montarLaudo(); } catch (e) { console.warn('[live] montarLaudo:', e); }
  }, 200);
}

function _instalarHistorico() {
  if (_histInstalado) return;
  _histInstalado = true;

  // Marca o #output como "dirty" quando o usuário o edita manualmente.
  // Atribuições programáticas a innerHTML (montarLaudo) não disparam 'input',
  // então a flag só liga em edição genuína. montarLaudo() respeita a flag e
  // não sobrescreve; resets explícitos (reiniciarPagina,
  // recuperarUltimoLaudo, _histRestaurar) e Ctrl+Enter limpam a flag.
  let outEl = document.getElementById('output');
  if (outEl) {
    outEl.addEventListener('input', function () {
      if (_histAplicando) return;
      this.dataset.dirty = '1';
    });
  }

  // Live-preview do laudo: atualiza o #output em mudanças de UI, mas NÃO
  // cria snapshot. O histórico é capturado apenas em ações estruturais
  // explícitas (criar/editar/excluir item, editar listas, carregar padrão).
  document.addEventListener('change', function (e) {
    let t = e.target;
    if (!t) return;
    if (t.type === 'checkbox' || t.tagName === 'SELECT' ||
        (t.tagName === 'INPUT' && /^(text|number|search|email|url|tel)$/i.test(t.type))) {
      _agendarLiveLaudo();
    }
  });

  document.addEventListener('keydown', function (e) {
    let alvo = e.target;
    let emTexto = alvo && (alvo.tagName === 'TEXTAREA' || alvo.isContentEditable ||
      (alvo.tagName === 'INPUT' && /^(text|search|email|password|number|url|tel)$/i.test(alvo.type)));

    if (e.key === 'Escape') {
      if (typeof fecharTodosPopups === 'function') {
        let pop = document.getElementById('popup');
        let crp = document.getElementById('create-popup');
        if ((pop && pop.style.display === 'block') || (crp && crp.style.display === 'block')) {
          e.preventDefault(); fecharTodosPopups();
        }
      }
      return;
    }

    if (!(e.ctrlKey || e.metaKey)) return;
    let k = (e.key || '').toLowerCase();

    if (k === 'enter') { e.preventDefault(); generateText(); return; }
    if (k === 's')     { e.preventDefault(); salvarDados(); return; }

    if (emTexto) return;
    if (k === 'z' && !e.shiftKey)                    { e.preventDefault(); desfazer(); }
    else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); refazer(); }
  });
}

function _resetHistorico() {
  _histUndo.length = 0;
  _histRedo.length = 0;
  _histLast = null;
  setTimeout(function () {
    _histLast = _histCapturar();
    atualizarBotoesHistorico();
  }, 100);
}

// ----------------------------------------------------------
// SIDEBAR — submenu Sallete toggle "Caixa lateral"
// ----------------------------------------------------------

const LATERAL_KEY = 'colono_lateral_on';
const HEADER_H = 58;
const LATERAL_DESKTOP_MQ = '(min-width: 1281px)';

var _roToolbar = null;
var _resizeChromeTimer = null;
var _animCaixaTimer = null;

function _syncLateralHtmlClass(on) {
  document.documentElement.classList.toggle('lateral-on', on);
}

function _isLateralDesktop() {
  return window.matchMedia(LATERAL_DESKTOP_MQ).matches;
}

function _aplicarChromeFallback() {
  document.documentElement.style.setProperty('--toolbar-h', '52px');
  document.documentElement.style.setProperty('--chrome-h', (HEADER_H + 52) + 'px');
}

function atualizarChromeLateral() {
  var root = document.documentElement;
  var on = document.body.classList.contains('lateral-on');
  _syncLateralHtmlClass(on);

  if (!on || !_isLateralDesktop()) {
    root.style.removeProperty('--toolbar-h');
    root.style.removeProperty('--chrome-h');
    return;
  }

  var tb = document.querySelector('.toolbar');
  if (!tb || window.getComputedStyle(tb).display === 'none') return;

  var th = Math.ceil(tb.getBoundingClientRect().height);
  if (th < 1) th = 52;
  root.style.setProperty('--toolbar-h', th + 'px');
  root.style.setProperty('--chrome-h', (HEADER_H + th) + 'px');
}

function observarToolbar() {
  var tb = document.querySelector('.toolbar');
  if (!tb || typeof ResizeObserver === 'undefined') return;
  if (_roToolbar) _roToolbar.disconnect();
  _roToolbar = new ResizeObserver(function () {
    if (document.body.classList.contains('lateral-on')) atualizarChromeLateral();
  });
  _roToolbar.observe(tb);
}

function _agendarChromeLateral() {
  requestAnimationFrame(function () {
    requestAnimationFrame(atualizarChromeLateral);
  });
}

function _resetScrollLateral() {
  window.scrollTo(0, 0);
}

function _efeitosAtivos() {
  try {
    if (localStorage.getItem('colono_efeitos') === '0') return false;
  } catch (e) {}
  return !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

function _prepararAnimacaoCaixa() {
  if (!_efeitosAtivos()) return null;
  var caixa = document.querySelector('.output-wrap');
  if (!caixa) return null;
  var rect = caixa.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return null;
  return rect;
}

function _animarTransicaoCaixa(rectAntes, lateralOn) {
  if (!rectAntes || !_efeitosAtivos()) return;

  var caixa = document.querySelector('.output-wrap');
  var main = document.querySelector('.main-col');
  if (!caixa) return;

  clearTimeout(_animCaixaTimer);
  caixa.classList.remove('caixa-layout-animando');
  caixa.style.transition = '';
  caixa.style.transform = '';
  caixa.style.transformOrigin = '';
  caixa.style.opacity = '';

  requestAnimationFrame(function () {
    var rectDepois = caixa.getBoundingClientRect();
    if (rectDepois.width < 1 || rectDepois.height < 1) return;

    var dx = rectAntes.left - rectDepois.left;
    var dy = rectAntes.top - rectDepois.top;
    var sx = rectAntes.width / rectDepois.width;
    var sy = rectAntes.height / rectDepois.height;

    document.body.classList.toggle('caixa-transicao-lateral', !!lateralOn);
    document.body.classList.toggle('caixa-transicao-horizontal', !lateralOn);
    caixa.classList.add('caixa-layout-animando');
    if (main) main.classList.add('main-col-layout-animando');

    caixa.style.transformOrigin = 'top left';
    caixa.style.transform = 'translate(' + dx + 'px, ' + dy + 'px) scale(' + sx + ', ' + sy + ')';
    caixa.style.opacity = '0.88';

    caixa.getBoundingClientRect();
    requestAnimationFrame(function () {
      caixa.style.transition = 'transform 460ms cubic-bezier(.16, 1, .3, 1), opacity 240ms ease, box-shadow 460ms cubic-bezier(.16, 1, .3, 1)';
      caixa.style.transform = 'translate(0, 0) scale(1, 1)';
      caixa.style.opacity = '';
    });

    var limpar = function (ev) {
      if (ev && ev.propertyName !== 'transform') return;
      caixa.classList.remove('caixa-layout-animando');
      caixa.style.transition = '';
      caixa.style.transform = '';
      caixa.style.transformOrigin = '';
      caixa.style.opacity = '';
      document.body.classList.remove('caixa-transicao-lateral', 'caixa-transicao-horizontal');
      if (main) main.classList.remove('main-col-layout-animando');
      caixa.removeEventListener('transitionend', limpar);
    };

    caixa.addEventListener('transitionend', limpar);
    _animCaixaTimer = setTimeout(limpar, 620);
  });
}

function _fecharSubmenusLaterais() {
  ['salvar', 'carregar'].forEach(function (q) {
    var sub = document.getElementById('sb-submenu-' + q);
    var btn = document.getElementById('sb-folder-toggle-' + q);
    if (sub) sub.classList.remove('show');
    if (btn) btn.classList.remove('open');
  });
}

function _posicionarMenuToolbar(menu, alvo) {
  if (!menu || !alvo) return;
  var gap = 0;
  var r = alvo.getBoundingClientRect();
  var sidebar = alvo.closest ? alvo.closest('.sidebar') : null;
  var toolbar = alvo.closest ? alvo.closest('.toolbar') : null;

  if (sidebar && window.getComputedStyle(sidebar).display !== 'none') {
    var sr = sidebar.getBoundingClientRect();
    menu.style.top = r.top + 'px';
    menu.style.left = (sr.right + gap) + 'px';
    return;
  }

  if (toolbar && window.getComputedStyle(toolbar).display !== 'none') {
    var tr = toolbar.getBoundingClientRect();
    menu.style.top = (tr.bottom + gap) + 'px';
    menu.style.left = r.left + 'px';
    return;
  }

  menu.style.top = r.bottom + 'px';
  menu.style.left = r.left + 'px';
}

function toggleMenuSalvar(ev) {
  if (ev) ev.stopPropagation();
  // Fecha o menu Editar se estiver aberto
  let ed = document.getElementById('sb-menu-editar');
  if (ed) ed.classList.remove('show');
  let m = document.getElementById('sb-menu-salvar');
  if (!m) return;
  if (m.classList.contains('show')) { m.classList.remove('show'); return; }
  if (ev && ev.currentTarget) {
    _posicionarMenuToolbar(m, ev.currentTarget);
  }
  refrescarMenuSalvar();
  m.classList.add('show');
}

function fecharMenuSalvar() {
  let m = document.getElementById('sb-menu-salvar');
  if (m) m.classList.remove('show');
  _fecharSubmenusLaterais();
}

function toggleMenuEditar(ev) {
  if (ev) ev.stopPropagation();
  // Fecha o menu Opções se estiver aberto
  let m = document.getElementById('sb-menu-salvar');
  if (m) m.classList.remove('show');
  _fecharSubmenusLaterais();
  let ed = document.getElementById('sb-menu-editar');
  if (!ed) return;
  if (ed.classList.contains('show')) { ed.classList.remove('show'); return; }
  if (ev && ev.currentTarget) {
    _posicionarMenuToolbar(ed, ev.currentTarget);
  }
  ed.classList.add('show');
}

function fecharMenuEditar() {
  let ed = document.getElementById('sb-menu-editar');
  if (ed) ed.classList.remove('show');
}

function toggleSubpasta(qual, ev) {
  if (ev) ev.stopPropagation();
  var sub = document.getElementById('sb-submenu-' + qual);
  var btn = document.getElementById('sb-folder-toggle-' + qual);
  if (!sub || !btn) return;

  // Fecha a outra subpasta lateral — só uma aberta por vez
  var outra = qual === 'salvar' ? 'carregar' : 'salvar';
  var subOutra = document.getElementById('sb-submenu-' + outra);
  var btnOutra = document.getElementById('sb-folder-toggle-' + outra);
  if (subOutra) subOutra.classList.remove('show');
  if (btnOutra) btnOutra.classList.remove('open');

  if (sub.classList.contains('show')) {
    sub.classList.remove('show');
    btn.classList.remove('open');
    return;
  }

  // Posiciona ao lado do menu principal, alinhado ao topo do botão clicado
  var mainMenu = document.getElementById('sb-menu-salvar');
  if (mainMenu) {
    var menuRect = mainMenu.getBoundingClientRect();
    var btnRect = btn.getBoundingClientRect();
    var gap = 4;
    var subWidth = 220;
    var leftPos = menuRect.right + gap;
    if (leftPos + subWidth > window.innerWidth - 8) {
      leftPos = Math.max(8, menuRect.left - subWidth - gap);
    }
    sub.style.left = leftPos + 'px';
    sub.style.top = btnRect.top + 'px';
  }
  sub.classList.add('show');
  btn.classList.add('open');
}

function _formatarDataSlot(ts) {
  if (!ts) return '';
  var d;
  if (ts && typeof ts.toDate === 'function') d = ts.toDate();           // Firestore Timestamp
  else if (ts instanceof Date) d = ts;
  else if (typeof ts === 'number') d = new Date(ts);
  else if (ts && typeof ts.seconds === 'number') d = new Date(ts.seconds * 1000);
  else return '';
  var dia = String(d.getDate()).padStart(2, '0');
  var mes = String(d.getMonth() + 1).padStart(2, '0');
  var ano = String(d.getFullYear()).slice(-2);
  var hh = String(d.getHours()).padStart(2, '0');
  var mm = String(d.getMinutes()).padStart(2, '0');
  return dia + '/' + mes + '/' + ano + ' ' + hh + ':' + mm;
}

function _slotInfo(slotKey) {
  var slots = (typeof _userSlots !== 'undefined') ? _userSlots : null;
  var dados = slots ? slots[slotKey] : null;
  var salvoEm = slots ? slots[slotKey + 'SalvoEm'] : null;
  var ativo = slots ? slots.ativo : null;
  return {
    vazio: !dados,
    ativo: slotKey === ativo,
    data: _formatarDataSlot(salvoEm)
  };
}

function refrescarMenuSalvar() {
  let s1 = document.getElementById('sb-state-autosave');
  if (s1) {
    let on1 = (typeof _autoSaveAtivo !== 'undefined' && _autoSaveAtivo);
    s1.textContent = on1 ? 'ON' : 'OFF';
    s1.classList.toggle('on', on1);
  }

  let sEf = document.getElementById('sb-state-efeitos');
  if (sEf) {
    let onEf = (localStorage.getItem('colono_efeitos') !== '0');
    sEf.textContent = onEf ? 'ON' : 'OFF';
    sEf.classList.toggle('on', onEf);
  }

  // Atualiza rótulo do botão Caixa Lateral / Caixa Horizontal
  let label = document.getElementById('btn-toggle-caixa-label');
  if (label) {
    let on2 = document.body.classList.contains('lateral-on');
    label.textContent = on2 ? 'Caixa Horizontal' : 'Caixa Lateral';
  }

  // Atualiza estado dos slots — agora exibe data do último salvamento
  ['slot1', 'slot2'].forEach(function (sk) {
    var num = sk === 'slot1' ? '1' : '2';
    var info = _slotInfo(sk);
    var texto = info.vazio ? 'vazio' : (info.data || 'com dados');
    [['sb-salvar-slot' + num], ['sb-carregar-slot' + num]].forEach(function (pair) {
      var el = document.getElementById(pair[0]);
      if (!el) return;
      var sp = el.querySelector('.slot-data');
      if (!sp) { sp = document.createElement('span'); sp.className = 'slot-data'; el.appendChild(sp); }
      sp.textContent = texto;
      sp.className = 'slot-data' + (info.ativo ? ' ativo' : '');
    });
  });
}

function toggleCaixaLateral() {
  var rectAntes = _prepararAnimacaoCaixa();
  document.body.classList.toggle('lateral-on');
  var on = document.body.classList.contains('lateral-on');
  try {
    localStorage.setItem(LATERAL_KEY, on ? '1' : '0');
  } catch (e) {}
  if (on && _isLateralDesktop()) _aplicarChromeFallback();
  if (!on) _resetScrollLateral();
  _agendarChromeLateral();
  refrescarMenuSalvar();
  _animarTransicaoCaixa(rectAntes, on);
}

(function () {
  function aplicarLateral() {
    try {
      if (localStorage.getItem(LATERAL_KEY) === '1') document.body.classList.add('lateral-on');
    } catch (e) {}
    if (document.body.classList.contains('lateral-on') && _isLateralDesktop()) _aplicarChromeFallback();
    _syncLateralHtmlClass(document.body.classList.contains('lateral-on'));
    observarToolbar();
    _agendarChromeLateral();
    refrescarMenuSalvar();
  }

  function onResizeChrome() {
    clearTimeout(_resizeChromeTimer);
    _resizeChromeTimer = setTimeout(atualizarChromeLateral, 100);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', aplicarLateral);
  } else {
    aplicarLateral();
  }
  window.addEventListener('resize', onResizeChrome);

  document.addEventListener('click', function (e) {
    let m = document.getElementById('sb-menu-salvar');
    if (!m || !m.classList.contains('show')) return;
    if (m.contains(e.target)) return;
    let s1 = document.getElementById('sb-submenu-salvar');
    let s2 = document.getElementById('sb-submenu-carregar');
    if (s1 && s1.contains(e.target)) return;
    if (s2 && s2.contains(e.target)) return;
    let btn = e.target.closest && e.target.closest('button');
    if (btn && btn.getAttribute('onclick') && btn.getAttribute('onclick').indexOf('toggleMenuSalvar') >= 0) return;
    fecharMenuSalvar();
  });
})();

// ----------------------------------------------------------
// VERIFICAÇÃO DE DEPENDÊNCIAS (historico_colono)
// (uso `typeof X` sem `window.` porque let/const globais não viram propriedades de window)
// ----------------------------------------------------------
if (typeof coletarDB === 'undefined') {
  console.error('[historico_colono] ERRO: coletarDB nao encontrado — core_colono.js precisa ser carregado antes');
}
if (typeof createCheckboxDiv === 'undefined') {
  console.error('[historico_colono] ERRO: createCheckboxDiv nao encontrado — core_colono.js precisa ser carregado antes');
}
console.log('[historico_colono] Modulo carregado, dependencias OK');
