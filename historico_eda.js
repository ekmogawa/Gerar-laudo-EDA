// ============================================================
// HISTÓRICO + BUSCA RÁPIDA — Gerar Laudo EDA
// Depende de: funcoes_eda.js (coletarDB, inicializar, mostrarToast,
//             generateText, salvarDados, fecharTodosPopups,
//             _temAlteracoes, atualizarIndicadorSalvo)
// ============================================================

// ----------------------------------------------------------
// HISTÓRICO — Desfazer / Refazer / Último laudo
// ----------------------------------------------------------

var _histUndo      = [];
var _histRedo      = [];
var _histLast      = null;
var _histAplicando = false;
var _histTimer     = null;
var _histInstalado = false;
var HIST_LIMITE    = 50;
var HIST_KEY_LAUDO = 'eda_ultimo_laudo';

function _histCapturar() {
  if (!window._inicializado) return null;
  try {
    var checks = Array.from(document.querySelectorAll('input[type="checkbox"]')).map(function (cb) {
      return { id: cb.id || '', name: cb.name || '', checked: !!cb.checked };
    });
    var selects = Array.from(document.querySelectorAll('select')).map(function (s) {
      return { id: s.id || '', value: s.value };
    });
    var out = document.getElementById('output');
    return JSON.stringify({
      db:      coletarDB(),
      checks:  checks,
      selects: selects,
      output:  out ? out.innerHTML : ''
    });
  } catch (e) { return null; }
}

function _histRestaurar(snapJson) {
  if (!snapJson) return;
  var estado;
  try { estado = JSON.parse(snapJson); } catch (e) { return; }
  _histAplicando = true;
  try {
    inicializar(estado.db);
    (estado.checks || []).forEach(function (c) {
      var el = c.id ? document.getElementById(c.id) : null;
      if (el && el.type === 'checkbox') { el.checked = c.checked; return; }
      if (c.name) {
        document.querySelectorAll('input[type="checkbox"][name="' + c.name.replace(/"/g, '\\"') + '"]').forEach(function (cb) {
          cb.checked = c.checked;
        });
      }
    });
    (estado.selects || []).forEach(function (s) {
      if (!s.id) return;
      var el = document.getElementById(s.id);
      if (el) el.value = s.value;
    });
    var out = document.getElementById('output');
    if (out) out.innerHTML = estado.output || '';
    _temAlteracoes = true;
    atualizarIndicadorSalvo();
    _histLast = snapJson;
  } catch (e) {
    console.error('[hist] erro ao restaurar:', e);
  } finally {
    setTimeout(function () { _histAplicando = false; }, 60);
    atualizarBotoesHistorico();
  }
}

function _histCommit() {
  var snap = _histCapturar();
  if (snap === null) return;
  if (_histLast === null) { _histLast = snap; atualizarBotoesHistorico(); return; }
  if (snap === _histLast) return;
  _histUndo.push(_histLast);
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

function registrarSnapshot() {
  if (_histAplicando) return;
  if (!window._inicializado) return;
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
  var atual = _histCapturar();
  var prev  = _histUndo.pop();
  if (atual !== null && atual !== prev) _histRedo.push(atual);
  _histRestaurar(prev);
  mostrarToast('↶ Desfeito', '#1a3a5a', 1400);
}

function refazer() {
  _flushSnapshot();
  if (!_histRedo.length) { mostrarToast('↷ Nada para refazer', '#7a4000', 1500); return; }
  var atual = _histCapturar();
  var next  = _histRedo.pop();
  if (atual !== null && atual !== next) _histUndo.push(atual);
  _histRestaurar(next);
  mostrarToast('↷ Refeito', '#1a3a5a', 1400);
}

function salvarUltimoLaudo() {
  var snap = _histCapturar();
  if (!snap) return;
  try { sessionStorage.setItem(HIST_KEY_LAUDO, snap); } catch (e) {}
  atualizarBotoesHistorico();
}

function recuperarUltimoLaudo() {
  var snap = sessionStorage.getItem(HIST_KEY_LAUDO);
  if (!snap) { mostrarToast('Nenhum laudo anterior salvo nesta sessão.', '#7a4000', 2800); return; }
  if (!confirm('Substituir o estado atual pelo último laudo gerado?\n\n(É possível desfazer com Ctrl+Z)')) return;
  _flushSnapshot();
  var atual = _histCapturar();
  if (atual !== null && atual !== snap) {
    _histUndo.push(atual);
    if (_histUndo.length > HIST_LIMITE) _histUndo.shift();
    _histRedo.length = 0;
  }
  _histRestaurar(snap);
  mostrarToast('↺ Último laudo recuperado.', '#1a3a1a', 2500);
}

function atualizarBotoesHistorico() {
  var bU = document.getElementById('btn-desfazer');
  var bR = document.getElementById('btn-refazer');
  var bL = document.getElementById('btn-recuperar');
  if (bU) bU.disabled = _histUndo.length === 0;
  if (bR) bR.disabled = _histRedo.length === 0;
  if (bL) bL.disabled = !sessionStorage.getItem(HIST_KEY_LAUDO);
}

var _liveTimer = null;
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

  document.addEventListener('change', function (e) {
    var t = e.target;
    if (!t) return;
    if (t.type === 'checkbox' || t.tagName === 'SELECT' ||
        (t.tagName === 'INPUT' && /^(text|number|search|email|url|tel)$/i.test(t.type))) {
      registrarSnapshot();
      _agendarLiveLaudo();
    }
  });

  document.addEventListener('keydown', function (e) {
    var alvo = e.target;
    var emTexto = alvo && (alvo.tagName === 'TEXTAREA' || alvo.isContentEditable ||
      (alvo.tagName === 'INPUT' && /^(text|search|email|password|number|url|tel)$/i.test(alvo.type)));

    if (e.key === 'Escape') {
      if (typeof fecharTodosPopups === 'function') {
        var pop = document.getElementById('popup');
        var crp = document.getElementById('create-popup');
        if ((pop && pop.style.display === 'block') || (crp && crp.style.display === 'block')) {
          e.preventDefault(); fecharTodosPopups();
        }
      }
      return;
    }

    if (!(e.ctrlKey || e.metaKey)) return;
    var k = (e.key || '').toLowerCase();

    if (k === 'enter') { e.preventDefault(); generateText(); return; }
    if (k === 's')     { e.preventDefault(); salvarDados(); return; }

    if (emTexto) return;
    if (k === 'z' && !e.shiftKey)                    { e.preventDefault(); desfazer(); }
    else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); refazer(); }
    else if (k === 'k') {
      if (typeof abrirBuscaRapida === 'function') { e.preventDefault(); abrirBuscaRapida(); }
    }
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
// BUSCA RÁPIDA (Ctrl+K)
// ----------------------------------------------------------

var _bqIndice = [];
var _bqSelecionado = 0;

function _bqMontarOverlay() {
  if (document.getElementById('busca-overlay')) return;
  var ov = document.createElement('div');
  ov.id = 'busca-overlay';
  ov.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(5,20,12,.45);z-index:99996;backdrop-filter:blur(3px);align-items:flex-start;justify-content:center;padding-top:80px;';
  ov.innerHTML =
    '<div id="busca-box" style="background:#fff;border-radius:10px;width:min(94vw,560px);box-shadow:0 10px 40px rgba(0,0,0,.25);overflow:hidden;font-family:\'DM Sans\',sans-serif;">' +
    '  <input id="busca-input" type="text" placeholder="Buscar item… (↑↓ navegar, Enter marcar, Esc fechar)" ' +
    '         style="width:100%;padding:14px 16px;font-size:15px;border:none;outline:none;border-bottom:1px solid #e0e8e3;box-sizing:border-box;">' +
    '  <div id="busca-resultados" style="max-height:50vh;overflow-y:auto;"></div>' +
    '</div>';
  document.body.appendChild(ov);
  ov.addEventListener('click', function (e) { if (e.target === ov) fecharBuscaRapida(); });
  var inp = document.getElementById('busca-input');
  inp.addEventListener('input', _bqAtualizar);
  inp.addEventListener('keydown', _bqTeclado);
}

function _bqIndexar() {
  _bqIndice = [];
  document.querySelectorAll('.sortable-zone').forEach(function (zona) {
    var secaoId = zona.id.replace('sortable-', '');
    var secLabel = '';
    var secRow = zona.closest('.sec-row');
    if (secRow) {
      var sl = secRow.querySelector('.sec-label');
      if (sl) secLabel = sl.textContent.trim();
    }
    zona.querySelectorAll('.item').forEach(function (item) {
      if (item.getAttribute('data-sep') === '1') return;
      var cb = item.querySelector('input[type="checkbox"]');
      var lab = item.querySelector('label');
      if (!cb || !lab) return;
      _bqIndice.push({
        nome: lab.textContent.trim(),
        valor: cb.value || '',
        secao: secLabel || secaoId,
        cb: cb,
        item: item
      });
    });
  });
}

function _bqAtualizar() {
  var q = (document.getElementById('busca-input').value || '').trim().toLowerCase();
  var lista = document.getElementById('busca-resultados');
  lista.innerHTML = '';
  _bqSelecionado = 0;
  if (!q) {
    lista.innerHTML = '<div style="padding:14px 16px;color:#7a9882;font-size:13px;">Digite para buscar entre os itens das seções.</div>';
    return;
  }
  var matches = _bqIndice.filter(function (it) {
    return it.nome.toLowerCase().indexOf(q) !== -1 || it.valor.toLowerCase().indexOf(q) !== -1;
  }).slice(0, 30);
  if (!matches.length) {
    lista.innerHTML = '<div style="padding:14px 16px;color:#7a9882;font-size:13px;">Nenhum item encontrado.</div>';
    return;
  }
  matches.forEach(function (m, i) {
    var d = document.createElement('div');
    d.className = 'busca-item';
    d.dataset.idx = i;
    d.style.cssText = 'padding:9px 16px;cursor:pointer;border-bottom:1px solid #f0f4f1;display:flex;justify-content:space-between;gap:10px;align-items:center;font-size:13.5px;' +
      (i === 0 ? 'background:#e6f4ed;' : '');
    var esq = document.createElement('div');
    esq.style.cssText = 'flex:1;min-width:0;';
    var nm = document.createElement('div');
    nm.textContent = (m.cb.checked ? '✓ ' : '') + m.nome;
    nm.style.cssText = 'color:#172418;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    var vl = document.createElement('div');
    vl.textContent = (m.valor || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').slice(0, 90);
    vl.style.cssText = 'color:#7a9882;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    esq.appendChild(nm); esq.appendChild(vl);
    var dir = document.createElement('div');
    dir.textContent = m.secao;
    dir.style.cssText = 'color:#3d5c46;font-size:11px;text-transform:uppercase;letter-spacing:.05em;flex-shrink:0;';
    d.appendChild(esq); d.appendChild(dir);
    d.addEventListener('click', function () { _bqAtivar(matches[Number(this.dataset.idx)]); });
    d.addEventListener('mouseenter', function () { _bqDestacar(Number(this.dataset.idx)); });
    lista.appendChild(d);
  });
  lista._matches = matches;
}

function _bqDestacar(idx) {
  var lista = document.getElementById('busca-resultados');
  Array.from(lista.children).forEach(function (el, i) {
    el.style.background = (i === idx) ? '#e6f4ed' : '';
  });
  _bqSelecionado = idx;
  var ativo = lista.children[idx];
  if (ativo && ativo.scrollIntoView) ativo.scrollIntoView({ block: 'nearest' });
}

function _bqTeclado(e) {
  var lista = document.getElementById('busca-resultados');
  var n = (lista._matches || []).length;
  if (e.key === 'ArrowDown') { e.preventDefault(); if (n) _bqDestacar((_bqSelecionado + 1) % n); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); if (n) _bqDestacar((_bqSelecionado - 1 + n) % n); }
  else if (e.key === 'Enter') { e.preventDefault(); if (n && lista._matches[_bqSelecionado]) _bqAtivar(lista._matches[_bqSelecionado]); }
  else if (e.key === 'Escape') { e.preventDefault(); fecharBuscaRapida(); }
}

function _bqAtivar(m) {
  if (!m || !m.cb) return;
  m.cb.checked = !m.cb.checked;
  m.cb.dispatchEvent(new Event('change', { bubbles: true }));
  fecharBuscaRapida();
  try { m.item.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) {}
  m.item.style.transition = 'box-shadow .25s';
  m.item.style.boxShadow = '0 0 0 3px rgba(42,122,82,.45)';
  setTimeout(function () { m.item.style.boxShadow = ''; }, 1100);
}

function abrirBuscaRapida() {
  _bqMontarOverlay();
  _bqIndexar();
  var ov = document.getElementById('busca-overlay');
  ov.style.display = 'flex';
  var inp = document.getElementById('busca-input');
  inp.value = '';
  _bqAtualizar();
  setTimeout(function () { inp.focus(); }, 30);
}

function fecharBuscaRapida() {
  var ov = document.getElementById('busca-overlay');
  if (ov) ov.style.display = 'none';
}

// ----------------------------------------------------------
// SIDEBAR — submenu Salvar e toggle "Caixa lateral"
// ----------------------------------------------------------

var LATERAL_KEY = 'eda_lateral_on';

function toggleMenuSalvar(ev) {
  if (ev) ev.stopPropagation();
  var m = document.getElementById('sb-menu-salvar');
  if (!m) return;
  if (m.classList.contains('show')) { m.classList.remove('show'); return; }
  if (ev && ev.currentTarget) {
    var r = ev.currentTarget.getBoundingClientRect();
    m.style.top = r.top + 'px';
  }
  refrescarMenuSalvar();
  m.classList.add('show');
}

function fecharMenuSalvar() {
  var m = document.getElementById('sb-menu-salvar');
  if (m) m.classList.remove('show');
}

function refrescarMenuSalvar() {
  var s1 = document.getElementById('sb-state-autosave');
  if (s1) {
    var on1 = (typeof _autoSaveAtivo !== 'undefined' && _autoSaveAtivo);
    s1.textContent = on1 ? 'ON' : 'OFF';
    s1.classList.toggle('on', on1);
  }
  var s2 = document.getElementById('sb-state-lateral');
  if (s2) {
    var on2 = document.body.classList.contains('lateral-on');
    s2.textContent = on2 ? 'ON' : 'OFF';
    s2.classList.toggle('on', on2);
  }
}

function toggleCaixaLateral() {
  document.body.classList.toggle('lateral-on');
  try {
    localStorage.setItem(LATERAL_KEY, document.body.classList.contains('lateral-on') ? '1' : '0');
  } catch (e) {}
}

(function () {
  function aplicarLateral() {
    try {
      if (localStorage.getItem(LATERAL_KEY) === '1') document.body.classList.add('lateral-on');
    } catch (e) {}
    refrescarMenuSalvar();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', aplicarLateral);
  else aplicarLateral();

  document.addEventListener('click', function (e) {
    var m = document.getElementById('sb-menu-salvar');
    if (!m || !m.classList.contains('show')) return;
    if (m.contains(e.target)) return;
    var btn = e.target.closest && e.target.closest('button');
    if (btn && btn.getAttribute('onclick') && btn.getAttribute('onclick').indexOf('toggleMenuSalvar') >= 0) return;
    fecharMenuSalvar();
  });
})();
