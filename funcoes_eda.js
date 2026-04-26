// ============================================================
// FUNÇÕES — Gerar Laudo EDA (Firebase Edition)
// Depende de: firebase-config.js + dados_eda.js (carregados antes)
// ============================================================

// ----------------------------------------------------------
// FIREBASE — instâncias globais
// ----------------------------------------------------------

var _auth      = null;   // firebase.auth()
var _firestore = null;   // firebase.firestore()
var _user      = null;   // usuário autenticado atual
var _modoVisitante  = false;
var _CADASTRO_ABERTO = false; // mude para true para reabrir o cadastro

// Entrada para a versão gratuita (free.html) — sem Firebase
function inicializarLivre() {
  var dados = (typeof DB_PADRAO !== 'undefined') ? DB_PADRAO : {};
  inicializar(dados);
}

function inicializarFirebase() {
  if (typeof FIREBASE_CONFIG === 'undefined' ||
      FIREBASE_CONFIG.apiKey === 'COLE_SUA_API_KEY_AQUI') {
    document.body.innerHTML =
      '<div style="font:16px Arial;padding:48px;color:#900;max-width:560px;margin:auto">' +
      '<h2 style="margin-bottom:12px">&#9888; Firebase não configurado</h2>' +
      '<p>Edite <b>firebase-config.js</b> com as credenciais do seu projeto Firebase.</p>' +
      '<p style="margin-top:8px;color:#666;font-size:14px">Veja as instruções dentro do próprio arquivo.</p></div>';
    return;
  }

  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    _auth      = firebase.auth();
    _firestore = firebase.firestore();

    _firestore.enablePersistence({ synchronizeTabs: true }).catch(function (err) {
      if (err.code !== 'failed-precondition' && err.code !== 'unimplemented')
        console.warn('[Firestore] Persistência offline:', err.code);
    });

    // Atalho Enter nos campos de auth
    ['auth-password', 'cad-password2'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        id === 'auth-password' ? loginUsuario() : registrarUsuario();
      });
    });

    // Oculta aba de cadastro se fechado
    var tabCad = document.getElementById('tab-cadastrar');
    if (tabCad) tabCad.style.display = _CADASTRO_ABERTO ? '' : 'none';

    _auth.onAuthStateChanged(function (user) {
      _user = user;
      _modoVisitante = !!(user && user.isAnonymous);
      if (user) {
        ocultarModalAuth();
        atualizarStatusUsuario();
        carregarDados();
      } else {
        _modoVisitante = false;
        mostrarModalAuth();
        atualizarStatusUsuario();
        _limparDOM();
      }
    });

  } catch (e) {
    console.error('[Firebase] Erro na inicialização:', e);
    mostrarToast('&#10060; Erro ao conectar ao Firebase: ' + e.message, '#7a1a1a', 10000);
  }
}

// ----------------------------------------------------------
// BANCO ATIVO
// ----------------------------------------------------------

var _DB = null;

// ----------------------------------------------------------
// AUTO-SAVE
// ----------------------------------------------------------

var _autoSaveAtivo = localStorage.getItem('eda_autosave') === '1';
var _autoSaveTimer = null;
var _temAlteracoes = false;

function agendarAutoSave() {
  if (_modoVisitante) return;
  _temAlteracoes = true;
  atualizarIndicadorSalvo();
  registrarSnapshot();
  if (typeof _agendarLiveLaudo === 'function') _agendarLiveLaudo();
  if (!_autoSaveAtivo) return;
  clearTimeout(_autoSaveTimer);
  _autoSaveTimer = setTimeout(salvarDados, 1500);
}

// HISTÓRICO + BUSCA RÁPIDA — ver historico_eda.js

function toggleAutoSave() {
  _autoSaveAtivo = !_autoSaveAtivo;
  localStorage.setItem('eda_autosave', _autoSaveAtivo ? '1' : '0');
  atualizarBotaoAutoSave();
  if (_autoSaveAtivo && _temAlteracoes) salvarDados();
}

function atualizarBotaoAutoSave() {
  var btn = document.getElementById('btn-autosave');
  if (!btn) return;
  if (_autoSaveAtivo) {
    btn.textContent = '&#128260; Auto-save: ON';
    btn.className   = 'btn-save btn-autosave-on';
  } else {
    btn.textContent = '&#128260; Auto-save: OFF';
    btn.className   = 'btn-ghost';
  }
}

function atualizarIndicadorSalvo() {
  var el = document.getElementById('save-indicator');
  if (!el) return;
  el.textContent = _temAlteracoes ? '&#9679; Não salvo' : '&#10003; Salvo';
  el.style.opacity = _temAlteracoes ? '0.75' : '0.4';
}

// ----------------------------------------------------------
// UTILITÁRIOS
// ----------------------------------------------------------

function mostrarToast(msg, cor, duracao) {
  var t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.style.background = cor || '#1a3a1a';
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(function () { t.classList.remove('show'); }, duracao || 3200);
}

var _contadorDinamico = 0;

function createCheckboxDiv(text, name) {
  var div = document.createElement('div');
  div.className = 'item item-dinamico';
  div.setAttribute('data-populated', '1');
  div.style.display = 'block';
  var nomeUnico = name + '_d' + (++_contadorDinamico);
  div.innerHTML =
    '<input type="checkbox" name="' + nomeUnico + '" value="' + text + '" checked>' +
    '<label>' + text + '</label>';
  return div;
}

function appendToSortable(elementId, div) {
  document.getElementById(elementId).appendChild(div);
}

// ----------------------------------------------------------
// INICIALIZAÇÃO
// ----------------------------------------------------------

function popularCheckboxSection(containerId, itens) {
  var container = document.getElementById(containerId);
  if (!container) return;
  container.querySelectorAll('.item[data-populated]').forEach(function (el) { el.remove(); });
  (itens || []).forEach(function (item) {
    if (item.separador) {
      var sep = document.createElement('div');
      sep.className = 'item';
      sep.setAttribute('data-sep', '1');
      sep.setAttribute('data-populated', '1');
      sep.style.cssText =
        'width:100%;height:0;border-top:1px solid var(--border2);margin:3px 0;' +
        'padding:0;background:transparent;border-radius:0;box-shadow:none;' +
        'cursor:default;pointer-events:none;flex-basis:100%;';
      container.appendChild(sep);
      return;
    }
    var div = document.createElement('div');
    div.className = 'item';
    div.setAttribute('data-populated', '1');
    var idPadrao = item.nome + '-' + containerId;
    var id = item.id || idPadrao;
    var valorEsc = (item.valor || '')
      .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
    div.innerHTML =
      '<input type="checkbox" name="' + item.nome +
      '" value="' + valorEsc + '" id="' + id + '">' +
      '<label for="' + id + '">' + item.nome + '</label>';
    container.appendChild(div);
  });
}

function popularSelect(id, opcoes) {
  var sel = document.getElementById(id);
  if (!sel) return;
  sel.innerHTML = '';
  (opcoes || []).forEach(function (op) {
    var opt = document.createElement('option');
    if (typeof op === 'string') {
      opt.value = op; opt.textContent = op || '-';
    } else {
      opt.value       = op.valor !== undefined ? op.valor : op;
      opt.textContent = op.label !== undefined ? op.label : op;
    }
    sel.appendChild(opt);
  });
}

function inicializar(dados) {
  if (!dados) return;
  window._inicializado = true;
  _DB = JSON.parse(JSON.stringify(dados));

  popularCheckboxSection('sortable-equipamento', _DB.equipamento);
  popularCheckboxSection('sortable-sedacao',     _DB.sedacao);
  popularCheckboxSection('sortable-esofago',     _DB.esofago);
  popularCheckboxSection('sortable-estomago',    _DB.estomago);
  popularCheckboxSection('sortable-duodeno',     _DB.duodeno);
  popularCheckboxSection('sortable-jejuno',      _DB.jejuno);
  popularCheckboxSection('sortable-conclusao',   _DB.conclusao);
  popularCheckboxSection('sortable-outros',      _DB.outros);

  var ss = _DB.sedacaoSelects || {};
  popularSelect('fentanil',  ss.fentanil);
  popularSelect('midazolam', ss.midazolam);

  inicializarSortable();
  inicializarSincronizacaoCheckboxes();
  inicializarConcNormal();

  _temAlteracoes = false;
  atualizarIndicadorSalvo();
  atualizarBotaoAutoSave();

  _instalarHistorico();
  if (!_histAplicando) _resetHistorico();
}

function _limparDOM() {
  window._inicializado = false;
  ['sortable-equipamento','sortable-sedacao','sortable-esofago',
   'sortable-estomago','sortable-duodeno','sortable-jejuno',
   'sortable-conclusao','sortable-outros'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.querySelectorAll('.item[data-populated]').forEach(function (i) { i.remove(); });
  });
  var out = document.getElementById('output');
  if (out) out.innerHTML = '';
}

// ----------------------------------------------------------
// DRAG & DROP — Pointer Events (sem flickering)
// ----------------------------------------------------------

function inicializarSortable() {
  ['sortable-equipamento','sortable-sedacao','sortable-esofago',
   'sortable-estomago','sortable-duodeno','sortable-jejuno',
   'sortable-conclusao','sortable-outros'].forEach(function (id) {
    var zone = document.getElementById(id);
    if (zone) ativarZona(zone);
  });
}

function ativarZona(zone) {
  zone.querySelectorAll('.item').forEach(ativarItem);
  new MutationObserver(function (ms) {
    ms.forEach(function (m) {
      m.addedNodes.forEach(function (n) {
        if (n.nodeType === 1 && n.classList.contains('item')) ativarItem(n);
      });
    });
  }).observe(zone, { childList: true });
}

function ativarItem(item) {
  if (item.getAttribute('data-sep') === '1') return;
  if (item.getAttribute('data-drag-init')) return;
  item.setAttribute('data-drag-init', '1');

  var wasDragged = false;

  item.addEventListener('click', function (e) {
    if (e.target.matches('input[type=checkbox], button, select')) return;
    if (wasDragged) { wasDragged = false; return; }
    var cb = item.querySelector('input[type=checkbox]');
    if (cb) {
      cb.checked = !cb.checked;
      cb.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  item.addEventListener('pointerdown', function (e) {
    if (e.target.matches('input[type=checkbox], button, select')) return;
    if (e.button !== 0) return;

    item.setPointerCapture(e.pointerId);

    var zone       = item.closest('.sortable-zone');
    var rect       = item.getBoundingClientRect();
    var offX       = e.clientX - rect.left;
    var offY       = e.clientY - rect.top;
    var moved      = false;
    var ghost      = null;
    var ph         = null;
    var lastTarget = undefined;

    function startDrag() {
      moved = true; wasDragged = true;
      ph = document.createElement('div');
      ph.className = 'item';
      ph.setAttribute('data-ph', '1');
      ph.style.cssText =
        'width:' + rect.width + 'px;height:' + rect.height + 'px;' +
        'border:2px dashed var(--accent);background:var(--accent-l);' +
        'border-radius:6px;pointer-events:none;flex-shrink:0;';
      zone.insertBefore(ph, item);
      item.style.display = 'none';

      ghost = item.cloneNode(true);
      ghost.style.cssText =
        'position:fixed;z-index:9999;pointer-events:none;width:' + rect.width + 'px;' +
        'opacity:.88;box-shadow:0 8px 24px rgba(0,0,0,.22);' +
        'transform:rotate(1.5deg) scale(1.03);' +
        'left:' + (e.clientX - offX) + 'px;top:' + (e.clientY - offY) + 'px;';
      document.body.appendChild(ghost);
    }

    function onMove(ev) {
      var dx = ev.clientX - (rect.left + offX);
      var dy = ev.clientY - (rect.top  + offY);
      if (!moved) {
        if (Math.sqrt(dx * dx + dy * dy) < 5) return;
        startDrag();
      }
      ghost.style.left = (ev.clientX - offX) + 'px';
      ghost.style.top  = (ev.clientY - offY) + 'px';

      ghost.style.visibility = 'hidden';
      var elUnder = document.elementFromPoint(ev.clientX, ev.clientY);
      ghost.style.visibility = '';
      var targetZone = elUnder ? elUnder.closest('.sortable-zone') : null;
      if (!targetZone) targetZone = zone;

      if (ph.parentElement !== targetZone) { targetZone.appendChild(ph); lastTarget = undefined; }
      var after = getAfterElement(targetZone, ev.clientX, ev.clientY, ph);
      var key   = after || null;
      if (key === lastTarget) return;
      lastTarget = key;
      after ? targetZone.insertBefore(ph, after) : targetZone.appendChild(ph);
    }

    function onUp() {
      item.removeEventListener('pointermove',   onMove);
      item.removeEventListener('pointerup',     onUp);
      item.removeEventListener('pointercancel', onUp);
      if (moved) {
        if (ph && ph.parentElement) ph.parentElement.insertBefore(item, ph);
        if (ph)    ph.remove();
        if (ghost) ghost.remove();
        item.style.display = '';
        agendarAutoSave();
      }
    }

    item.addEventListener('pointermove',   onMove);
    item.addEventListener('pointerup',     onUp);
    item.addEventListener('pointercancel', onUp);
  });
}

function getAfterElement(zone, x, y, exclude) {
  var items = Array.from(zone.querySelectorAll('.item')).filter(function (el) {
    return el !== exclude && !el.getAttribute('data-ph') && el.getAttribute('data-sep') !== '1';
  });

  var rows = [];
  items.forEach(function (el) {
    var r    = el.getBoundingClientRect();
    var rowY = Math.round(r.top / 8) * 8;
    var row  = rows.find(function (rw) { return rw.y === rowY; });
    if (!row) { row = { y: rowY, bottom: r.bottom, els: [] }; rows.push(row); }
    row.bottom = Math.max(row.bottom, r.bottom);
    row.els.push({ el: el, midX: r.left + r.width / 2 });
  });
  rows.sort(function (a, b) { return a.y - b.y; });
  if (!rows.length) return null;

  var targetRow = rows[rows.length - 1];
  for (var i = 0; i < rows.length; i++) {
    if (y <= rows[i].bottom) { targetRow = rows[i]; break; }
  }
  var sorted = targetRow.els.slice().sort(function (a, b) { return a.midX - b.midX; });
  for (var j = 0; j < sorted.length; j++) {
    if (x < sorted[j].midX) return sorted[j].el;
  }
  var ri = rows.indexOf(targetRow);
  if (ri < rows.length - 1) {
    var next = rows[ri + 1].els.slice().sort(function (a, b) { return a.midX - b.midX; });
    return next[0].el;
  }
  return null;
}

// ----------------------------------------------------------
// SINCRONIZAÇÃO DE CHECKBOXES
// ----------------------------------------------------------

function inicializarSincronizacaoCheckboxes() {
  document.addEventListener('change', function (e) {
    if (e.target.type !== 'checkbox') return;
    var name = e.target.name, checked = e.target.checked;
    if (name === 'Normal') return;

    document.querySelectorAll('input[type="checkbox"][name="' + name + '"]').forEach(function (cb) {
      if (cb !== e.target) cb.checked = checked;
    });

    if (name.includes('+')) {
      var partes = name.split('+');
      document.querySelectorAll('#Conclusão input[name="' + partes[0] + '"]').forEach(function (cb) {
        cb.checked = true;
      });
      if (partes[1]) {
        document.querySelectorAll('#Conclusão input[name$="' + partes[1] + '"]').forEach(function (cb) {
          cb.checked = true;
        });
      }
    }
  });
}

function inicializarConcNormal() {
  var concnormal = document.getElementById('concnormal');
  if (!concnormal) return;
  concnormal.addEventListener('change', function () {
    ['checkbox4', 'checkbox11', 'checkbox26'].forEach(function (id) {
      var cb = document.getElementById(id);
      if (cb) { cb.checked = concnormal.checked; cb.dispatchEvent(new Event('change', { bubbles: true })); }
    });
  });
}

// ----------------------------------------------------------
// SEDAÇÃO DINÂMICA
// ----------------------------------------------------------

function addParametersedacao() {
  var fentanil  = document.getElementById('fentanil').value;
  var midazolam = document.getElementById('midazolam').value;
  var texto =
    'Fentanil ' + fentanil + midazolam + ' + Propofol titulado IV.<br>' +
    'Suplementação de O2 por catéter nasal a 3 L/min.<br>' +
    'Monitorização de oximetria de pulso e PNI.';
  appendToSortable('sortable-sedacao', createCheckboxDiv(texto, 'sedacao'));
}

// ----------------------------------------------------------
// EDITAR / CRIAR / EXCLUIR
// ----------------------------------------------------------

function fecharTodosPopups() {
  document.getElementById('popup').style.display        = 'none';
  document.getElementById('create-popup').style.display = 'none';
  document.getElementById('backdrop').classList.remove('show');
  document.getElementById('checkbox-list').innerHTML    = '';
}

function abrirPopup(id) {
  document.getElementById(id).style.display = 'block';
  document.getElementById('backdrop').classList.add('show');
}

function showPopup() {
  if (_modoVisitante) {
    mostrarToast('&#128100; Modo visitante \u2014 edi\u00e7\u00e3o n\u00e3o permitida.', '#7a4000', 4000);
    return;
  }
  var checkboxes = document.querySelectorAll('input[type="checkbox"]:checked');
  var container  = document.getElementById('checkbox-list');
  container.innerHTML = '';

  if (checkboxes.length === 0) {
    container.innerHTML = '<p style="color:var(--ink3);padding:8px 0">Nenhum item selecionado.</p>';
    abrirPopup('popup');
    return;
  }

  checkboxes.forEach(function (cb) {
    var label     = document.querySelector('label[for="' + cb.id + '"]');
    var labelText = label ? label.innerText : '';
    var suffix    = cb.id.replace(cb.name, '');

    var group = document.createElement('div');
    group.className = 'edit-group';

    // Campo nome
    var nomeLabel = document.createElement('strong');
    nomeLabel.textContent = 'Nome do Item:';
    var nomeInput = document.createElement('input');
    nomeInput.type = 'text';
    nomeInput.style.cssText = 'display:block;width:300px;margin:4px 0 10px;';
    nomeInput.value = labelText;
    nomeInput.dataset.targetId = cb.id;
    nomeInput.dataset.suffix   = suffix;

    // Campo valor
    var valorLabel = document.createElement('strong');
    valorLabel.textContent = 'Texto da entrada:';
    var valorTa = document.createElement('textarea');
    valorTa.className = 'edit-value-input';
    valorTa.style.cssText = 'display:block;height:60px;width:90%;margin-top:4px;';
    valorTa.value = cb.value;
    valorTa.dataset.targetId = cb.id;

    nomeInput.addEventListener('input', function () {
      updateEverything(this.dataset.targetId, this.value, this.dataset.suffix, this, valorTa);
    });
    valorTa.addEventListener('input', function () {
      updateOnlyValue(this.dataset.targetId, this.value);
    });

    group.appendChild(nomeLabel);
    group.appendChild(nomeInput);
    group.appendChild(valorLabel);
    group.appendChild(valorTa);
    container.appendChild(group);
  });

  abrirPopup('popup');
}

function hidePopup() {
  document.getElementById('popup').style.display = 'none';
  document.getElementById('checkbox-list').innerHTML = '';
  document.getElementById('backdrop').classList.remove('show');
}

function updateEverything(currentId, newName, suffix, nomeInput, valorTa) {
  var checkbox = document.getElementById(currentId);
  var label    = document.querySelector('label[for="' + currentId + '"]');
  if (checkbox && label) {
    var newId = newName + suffix;
    checkbox.id   = newId;
    checkbox.name = newName;
    label.setAttribute('for', newId);
    label.innerText = newName;
    if (nomeInput) nomeInput.dataset.targetId = newId;
    if (valorTa)   valorTa.dataset.targetId   = newId;
  }
  agendarAutoSave();
}

function updateOnlyValue(id, newValue) {
  var cb = document.getElementById(id);
  if (cb) cb.value = newValue;
  agendarAutoSave();
}

function deleteCheckedCheckboxes() {
  if (_modoVisitante) {
    mostrarToast('&#128100; Modo visitante \u2014 exclus\u00e3o n\u00e3o permitida.', '#7a4000', 4000);
    return;
  }
  var checkboxes = document.querySelectorAll('input[type="checkbox"]:checked');
  if (checkboxes.length === 0) return;
  if (!confirm('Deseja excluir os ' + checkboxes.length + ' item(ns) selecionado(s)?')) return;
  checkboxes.forEach(function (cb) { (cb.closest('.item') || cb.parentElement).remove(); });
  hidePopup();
  agendarAutoSave();
}

function showCreatePopup() { abrirPopup('create-popup'); }

function hideCreatePopup() {
  document.getElementById('create-popup').style.display = 'none';
  document.getElementById('backdrop').classList.remove('show');
}

function createCheckbox() {
  if (_modoVisitante) {
    mostrarToast('&#128100; Modo visitante \u2014 cria\u00e7\u00e3o n\u00e3o permitida.', '#7a4000', 4000);
    return;
  }
  var nome      = document.getElementById('checkbox-name').value.trim();
  var valor     = document.getElementById('checkbox-value').value.replace(/\n/g, '<br>');
  var sectionId = document.getElementById('section-select').value;

  if (!nome) { mostrarToast('&#9888; Digite um nome para o item.', '#7a4000'); return; }

  var section = document.getElementById(sectionId);
  var div = document.createElement('div');
  div.className = 'item';
  div.setAttribute('data-populated', '1');

  var cb = document.createElement('input');
  cb.type = 'checkbox'; cb.name = nome; cb.value = valor;
  cb.id   = nome + '-' + sectionId;

  var lbl = document.createElement('label');
  lbl.htmlFor = cb.id; lbl.textContent = nome;

  div.appendChild(cb); div.appendChild(lbl);
  section.appendChild(div);

  document.getElementById('create-popup').style.display = 'none';
  document.getElementById('backdrop').classList.remove('show');
  document.getElementById('checkbox-name').value  = '';
  document.getElementById('checkbox-value').value = '';

  agendarAutoSave();
  mostrarToast(_autoSaveAtivo ? '&#10003; Item criado! Salvando\u2026' : '&#10003; Item criado!');
}

function uncheckAll() {
  document.querySelectorAll('input[type="checkbox"]').forEach(function (cb) { cb.checked = false; });
  registrarSnapshot();
  if (typeof _agendarLiveLaudo === 'function') _agendarLiveLaudo();
}

// ----------------------------------------------------------
// SERIALIZAÇÃO DOM → objeto
// ----------------------------------------------------------

var IDS_CONTROLE_EDA = new Set(['sedacao-sortable']);

function serializarSecao(containerId, opts) {
  opts = opts || {};
  var container = document.getElementById(containerId);
  if (!container) return [];
  var itens = [];
  container.querySelectorAll(':scope > .item').forEach(function (div) {
    if (opts.semDinamicos && div.classList.contains('item-dinamico')) return;
    if (div.getAttribute('data-sep') === '1') { itens.push({ separador: true }); return; }
    var cb = div.querySelector('input[type="checkbox"]');
    if (!cb || IDS_CONTROLE_EDA.has(cb.id) || IDS_CONTROLE_EDA.has(cb.name)) return;
    if (div.getAttribute('data-ph')) return;
    var label = div.querySelector('label');
    var nome  = label ? label.innerText.trim() : cb.name;
    if (!nome) return;
    var item = { nome: nome };
    var idPadrao = nome + '-' + containerId;
    if (cb.id && cb.id !== idPadrao) item.id = cb.id;
    item.valor = cb.value;
    itens.push(item);
  });
  return itens;
}

function montarConteudoJS(dbObj) {
  return (
    '// ============================================================\n' +
    '// BANCO DE DADOS \u2014 Gerar Laudo EDA\n' +
    '// Salvo em: ' + new Date().toLocaleString('pt-BR') + '\n' +
    '// ============================================================\n\n' +
    'var DB_PADRAO = ' + JSON.stringify(dbObj, null, 2) + ';\n'
  );
}

function coletarDB(opts) {
  var fentanilOpts  = Array.from(document.getElementById('fentanil').options).map(function (o) { return o.value; });
  var midazolamOpts = Array.from(document.getElementById('midazolam').options).map(function (o) { return o.value; });
  return {
    equipamento:    serializarSecao('sortable-equipamento', opts),
    sedacao:        serializarSecao('sortable-sedacao', opts),
    sedacaoSelects: { fentanil: fentanilOpts, midazolam: midazolamOpts },
    esofago:        serializarSecao('sortable-esofago', opts),
    estomago:       serializarSecao('sortable-estomago', opts),
    duodeno:        serializarSecao('sortable-duodeno', opts),
    jejuno:         serializarSecao('sortable-jejuno', opts),
    conclusao:      serializarSecao('sortable-conclusao', opts),
    outros:         serializarSecao('sortable-outros', opts)
  };
}

// ----------------------------------------------------------
// FIRESTORE — CARREGAR / SALVAR
// ----------------------------------------------------------

async function carregarDados() {
  if (!_user || !_firestore) return;
  mostrarToast('&#8987; Carregando\u2026', '#1a2e3a', 8000);

  if (_modoVisitante) {
    try {
      var vDoc = await _firestore.collection('visitante').doc('publico').get();
      var vDados = (vDoc.exists && vDoc.data() && vDoc.data().db)
        ? vDoc.data().db
        : (typeof DB_PADRAO !== 'undefined' ? DB_PADRAO : {});
      inicializar(vDados);
      mostrarToast('&#128100; Modo visitante \u2014 somente leitura', '#1a3a5a', 3500);
    } catch (e) {
      console.error('[carregarDados visitante]', e);
      inicializar(typeof DB_PADRAO !== 'undefined' ? DB_PADRAO : {});
      mostrarToast('&#128100; Visitante (banco padr\u00e3o)', '#1a3a5a', 3500);
    }
    return;
  }

  try {
    var doc = await _firestore.collection('users').doc(_user.uid).get();
    var dados;
    if (doc.exists && doc.data().db) {
      dados = doc.data().db;
    } else {
      // Primeiro acesso — inicializa com o template padrão
      dados = (typeof DB_PADRAO !== 'undefined') ? DB_PADRAO : {};
      await _firestore.collection('users').doc(_user.uid).set({
        db:       dados,
        email:    _user.email,
        criadoEm: firebase.firestore.FieldValue.serverTimestamp()
      });
    }
    inicializar(dados);
    mostrarToast('&#10003; Dados carregados.', '#1a3a1a', 2000);
  } catch (e) {
    console.error('[carregarDados]', e);
    mostrarToast('&#10060; Erro ao carregar: ' + e.message, '#7a1a1a', 10000);
  }
}

async function salvarDados() {
  if (_modoVisitante) {
    mostrarToast('&#128100; Modo visitante \u2014 salvamento n\u00e3o permitido.', '#7a4000', 4000);
    return;
  }
  if (!_user || !_firestore) {
    mostrarToast('&#9888; Faça login para salvar.', '#7a4000', 5000);
    return;
  }
  clearTimeout(_autoSaveTimer);
  mostrarToast('&#128260; Salvando\u2026', '#1a2e3a', 6000);
  try {
    var db = coletarDB({ semDinamicos: true });
    await _firestore.collection('users').doc(_user.uid).set(
      { db: db, atualizadoEm: firebase.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
    Object.assign(_DB, db);
    _temAlteracoes = false;
    atualizarIndicadorSalvo();
    mostrarToast('&#10003; Salvo!', '#1a3a1a', 2500);

    // Sincroniza banco público para visitantes
    if (_user.email === 'ekmogawa@gmail.com') {
      _firestore.collection('visitante').doc('publico').set({ db: db })
        .catch(function (e) { console.warn('[visitante sync]', e); });
    }
  } catch (e) {
    console.error('[salvarDados]', e);
    mostrarToast('&#10060; Erro ao salvar: ' + e.message, '#7a1a1a', 10000);
  }
}

// ----------------------------------------------------------
// BACKUP GITHUB (legado — mantido para exportação)
// ----------------------------------------------------------

async function salvarBackupGitHub() {
  if (_modoVisitante) {
    mostrarToast('&#128100; Modo visitante \u2014 backup n\u00e3o permitido.', '#7a4000', 4000);
    return;
  }
  var c = (typeof GITHUB_CONFIG !== 'undefined') ? GITHUB_CONFIG : {};
  var token = sessionStorage.getItem('colono_github_token') || c.token;

  if (c.tokenCriptografado && !sessionStorage.getItem('colono_github_token')) {
    await _inicializarTokenGitHub();
    if (!sessionStorage.getItem('colono_github_token')) return;
    token = sessionStorage.getItem('colono_github_token');
  }
  if (!c.owner || !c.repo || !token) {
    mostrarToast('&#9888; config.js não configurado para backup GitHub.', '#7a4000', 6000);
    return;
  }

  var branch  = c.branch || 'main';
  var path    = c.path   || 'dados_eda.js';
  var apiBase = 'https://api.github.com/repos/' + c.owner + '/' + c.repo + '/contents/' + path;
  var headers = {
    'Authorization': 'token ' + token,
    'Accept':        'application/vnd.github+json',
    'Content-Type':  'application/json'
  };

  mostrarToast('&#128260; Enviando backup para GitHub\u2026', '#1a2e3a', 10000);
  try {
    var getResp = await fetch(apiBase + '?ref=' + encodeURIComponent(branch), { headers: headers });
    if (!getResp.ok && getResp.status !== 404) throw new Error('Erro ao ler arquivo: HTTP ' + getResp.status);
    var getSha;
    if (getResp.ok) {
      var getData = await getResp.json().catch(function () { return {}; });
      getSha = getData.sha;
    }
    var dbAtual   = coletarDB({ semDinamicos: true });
    var conteudo  = montarConteudoJS(dbAtual);
    var b64       = btoa(unescape(encodeURIComponent(conteudo)));
    var body = { message: 'Backup via EDA \u2014 ' + new Date().toLocaleString('pt-BR'), content: b64, branch: branch };
    if (getSha) body.sha = getSha;

    var putResp = await fetch(apiBase, { method: 'PUT', headers: headers, body: JSON.stringify(body) });
    if (!putResp.ok) {
      var errPut = await putResp.json().catch(function () { return {}; });
      var msg = errPut.message || 'HTTP ' + putResp.status;
      if (putResp.status === 401) msg = 'Token inválido (401).';
      if (putResp.status === 403) msg = 'Sem permissão de escrita (403).';
      if (putResp.status === 409) msg = 'Conflito (409). Recarregue e tente novamente.';
      throw new Error(msg);
    }
    mostrarToast('&#10003; Backup salvo no GitHub!', '#1a3a1a', 4000);
  } catch (e) {
    mostrarToast('&#10060; ' + e.message, '#7a1a1a', 8000);
    console.error('[salvarBackupGitHub]', e);
  }
}

async function _inicializarTokenGitHub() {
  var c = (typeof GITHUB_CONFIG !== 'undefined') ? GITHUB_CONFIG : {};
  if (!c.tokenCriptografado) return;
  if (sessionStorage.getItem('colono_github_token')) return;
  var tentativas = 0;
  while (tentativas < 3) {
    var msg   = tentativas === 0 ? '&#128272; Senha para backup GitHub:' : '&#10060; Senha incorreta. Tentativa ' + (tentativas + 1) + '/3:';
    var senha = await _pedirSenhaGitHub(msg);
    if (senha === null) break;
    var token = await _descriptografarToken(senha);
    if (token) { sessionStorage.setItem('colono_github_token', token); return; }
    tentativas++;
  }
}

function _pedirSenhaGitHub(msg) {
  return new Promise(function (resolve) {
    var overlay = document.getElementById('senha-overlay');
    var msgEl   = document.getElementById('senha-msg');
    var input   = document.getElementById('senha-input');
    var btnOk   = document.getElementById('senha-ok');
    var btnCanc = document.getElementById('senha-cancelar');
    msgEl.textContent = msg; input.value = ''; overlay.classList.add('show'); input.focus();
    function fechar(v) {
      overlay.classList.remove('show');
      btnOk.removeEventListener('click', onOk); btnCanc.removeEventListener('click', onCanc);
      input.removeEventListener('keydown', onKey); resolve(v);
    }
    function onOk()   { fechar(input.value); }
    function onCanc() { fechar(null); }
    function onKey(e) { if (e.key === 'Enter') fechar(input.value); if (e.key === 'Escape') fechar(null); }
    btnOk.addEventListener('click', onOk); btnCanc.addEventListener('click', onCanc);
    input.addEventListener('keydown', onKey);
  });
}

async function _descriptografarToken(senha) {
  try {
    var c = (typeof GITHUB_CONFIG !== 'undefined') ? GITHUB_CONFIG : {};
    var fromB64 = function (b64) { return Uint8Array.from(atob(b64), function (ch) { return ch.charCodeAt(0); }); };
    var keyMat  = await crypto.subtle.importKey('raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveKey']);
    var key     = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: fromB64(c.salt), iterations: 200000, hash: 'SHA-256' },
      keyMat, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    var dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(c.iv) }, key, fromB64(c.tokenCriptografado));
    return new TextDecoder().decode(dec);
  } catch (e) { return null; }
}

// ----------------------------------------------------------
// AUTH — UI
// ----------------------------------------------------------

function mostrarModalAuth() {
  var overlay = document.getElementById('auth-overlay');
  if (overlay) overlay.classList.add('show');
}

function ocultarModalAuth() {
  var overlay = document.getElementById('auth-overlay');
  if (overlay) overlay.classList.remove('show');
}

function mostrarTabAuth(tab) {
  document.getElementById('form-entrar').style.display    = tab === 'entrar'    ? '' : 'none';
  document.getElementById('form-cadastrar').style.display = tab === 'cadastrar' ? '' : 'none';
  document.getElementById('tab-entrar').classList.toggle('active',    tab === 'entrar');
  document.getElementById('tab-cadastrar').classList.toggle('active', tab === 'cadastrar');
  document.getElementById('auth-erro').textContent = '';
  document.getElementById(tab === 'entrar' ? 'auth-email' : 'cad-email').focus();
}

function _mostrarErroAuth(msg) {
  var el = document.getElementById('auth-erro');
  if (el) el.textContent = msg;
}

var _MSGS_AUTH = {
  'auth/user-not-found':        'Usuário não encontrado.',
  'auth/wrong-password':        'Senha incorreta.',
  'auth/invalid-credential':    'E-mail ou senha incorretos.',
  'auth/email-already-in-use':  'Este e-mail já está cadastrado.',
  'auth/weak-password':         'A senha deve ter pelo menos 6 caracteres.',
  'auth/invalid-email':         'E-mail inválido.',
  'auth/network-request-failed':'Sem conexão. Verifique a internet.',
  'auth/too-many-requests':     'Muitas tentativas. Aguarde alguns minutos.',
  'auth/missing-password':      'Digite a senha.'
};

async function loginUsuario() {
  var email = document.getElementById('auth-email').value.trim();
  var senha = document.getElementById('auth-password').value;
  if (!email || !senha) { _mostrarErroAuth('Preencha e-mail e senha.'); return; }
  var btn = document.getElementById('btn-login');
  btn.disabled = true;
  try {
    await _auth.signInWithEmailAndPassword(email, senha);
  } catch (e) {
    _mostrarErroAuth(_MSGS_AUTH[e.code] || e.message);
  } finally {
    btn.disabled = false;
  }
}

async function registrarUsuario() {
  if (!_CADASTRO_ABERTO) {
    _mostrarErroAuth('Cadastro de novas contas está temporariamente suspenso.');
    return;
  }
  var email  = document.getElementById('cad-email').value.trim();
  var senha  = document.getElementById('cad-password').value;
  var senha2 = document.getElementById('cad-password2').value;
  var codigo = document.getElementById('cad-codigo').value.trim().toUpperCase();

  if (!email || !senha || !codigo) { _mostrarErroAuth('Preencha todos os campos, incluindo o código de acesso.'); return; }
  if (senha !== senha2)            { _mostrarErroAuth('As senhas não coincidem.'); return; }
  if (senha.length < 6)            { _mostrarErroAuth('Mínimo de 6 caracteres na senha.'); return; }

  var btn = document.getElementById('btn-cadastrar');
  btn.disabled = true;

  try {
    // 1. Verificar se o código existe e não foi usado
    var codigoDoc = await _firestore.collection('codigos').doc(codigo).get();
    if (!codigoDoc.exists || codigoDoc.data().usado) {
      _mostrarErroAuth('Código de acesso inválido ou já utilizado.');
      return;
    }

    // 2. Criar a conta
    var cred = await _auth.createUserWithEmailAndPassword(email, senha);

    // 3. Marcar código como usado
    await _firestore.collection('codigos').doc(codigo).update({
      usado:    true,
      usadoPor: cred.user.uid,
      usadoEm:  firebase.firestore.FieldValue.serverTimestamp()
    });

  } catch (e) {
    _mostrarErroAuth(_MSGS_AUTH[e.code] || e.message);
  } finally {
    btn.disabled = false;
  }
}

async function entrarComoVisitante() {
  var btn = document.getElementById('btn-visitante');
  if (btn) { btn.disabled = true; btn.textContent = 'Aguarde\u2026'; }
  try {
    await _auth.signInAnonymously();
  } catch (e) {
    _mostrarErroAuth(
      e.code === 'auth/operation-not-allowed'
        ? 'Acesso como visitante n\u00e3o habilitado. Contate o administrador.'
        : ('Erro: ' + (e.message || e))
    );
    if (btn) { btn.disabled = false; btn.textContent = '&#128100; Entrar como Visitante'; }
  }
}

async function resetarSenha() {
  var email = document.getElementById('auth-email').value.trim();
  if (!email) { _mostrarErroAuth('Digite seu e-mail acima para redefinir a senha.'); return; }
  try {
    await _auth.sendPasswordResetEmail(email);
    _mostrarErroAuth('');
    mostrarToast('&#128231; E-mail de redefinição enviado!', '#1a3a1a', 5000);
  } catch (e) {
    _mostrarErroAuth(_MSGS_AUTH[e.code] || e.message);
  }
}

async function sairUsuario() {
  if (!confirm('Deseja sair?')) return;
  await _auth.signOut();
}

function atualizarStatusUsuario() {
  var el = document.getElementById('user-status');
  if (!el) return;
  if (_user && _modoVisitante) {
    el.innerHTML =
      '<span class="user-email" style="background:rgba(255,180,0,.18);border-color:rgba(255,180,0,.4);color:rgba(255,240,180,.95);">&#128100; Visitante</span>' +
      '<button class="btn-ghost btn-xs" onclick="sairUsuario()">Sair</button>';
  } else if (_user) {
    el.innerHTML =
      '<span class="user-email">' + _user.email + '</span>' +
      '<button class="btn-ghost btn-xs" onclick="sairUsuario()">Sair</button>';
  } else {
    el.innerHTML = '';
  }
}

// ----------------------------------------------------------
// GERAR LAUDO — lógica clínica preservada integralmente
// ----------------------------------------------------------

function _isChecked(id) {
  var el = document.getElementById(id);
  return !!(el && el.checked);
}

function _coletarSecao(containerId, sep) {
  var el = document.getElementById(containerId);
  if (!el) return '';
  var texto = '';
  el.querySelectorAll('input[type="checkbox"]:checked').forEach(function (cb) {
    texto += cb.value + sep;
  });
  return texto;
}

function montarLaudo() {
  var eqText   = _coletarSecao('equipamento', '<br><br><br>');
  var sedText  = _coletarSecao('Sedação',     '<br><br>');
  var estText  = _coletarSecao('Estômago',    '<br><br>');
  var duoText  = _coletarSecao('Duodeno',     '<br><br>');
  var jejText  = _coletarSecao('Jejuno',      '<br><br>');
  var outText  = _coletarSecao('Outros',      '<br><br>');
  var concText = _coletarSecao('Conclusão',   '<br>');

  var esfText        = '';
  var deslocadaFound = false;
  var esfEl = document.getElementById('Esôfago');
  if (esfEl) {
    esfEl.querySelectorAll('input[type="checkbox"]:checked').forEach(function (cb) {
      var val = cb.value;
      if (val.includes('deslocada')) { val = val.replace('ajustado', 'alargado em relação'); deslocadaFound = true; }
      esfText += val + '<br><br>';
    });
  }

  var isGeral = _isChecked('geral');
  var isMI    = _isChecked('checkboxmi') ||
                !!(document.querySelector('input[name="MI"]:checked'));

  if (deslocadaFound) estText = estText.replace(/ajustado/g, 'alargado em relação');
  if (isMI) {
    estText = estText
      .replace(/reduzido/g, 'reduzido, além de focos de provável metaplasia intestinal,')
      .replace(/<br><br>/, '');
  }

  if (isMI) {
    concText = concText
      .replace(/área de atrofia/g,  'área de atrofia com metaplasia intestinal')
      .replace(/atrófica/g,          'atrófica com metaplasia intestinal');
  }

  var text = outText ? '' : '<strong>ENDOSCOPIA DIGESTIVA ALTA</strong><br><br><br>';

  if (eqText)   text += eqText;
  if (sedText)  text += isGeral ? sedText : '<strong>Sedação: </strong>' + sedText;
  if (esfText)  text += '<strong>Esôfago: </strong>'  + esfText;
  if (estText)  text += '<strong>Estômago: </strong>' + estText;
  if (duoText)  text += '<strong>Duodeno: </strong>'  + duoText;
  if (jejText)  text += '<strong>Jejuno: </strong>'   + jejText;
  if (outText)  text += outText;
  if (concText) text += '<br><br><strong>Conclusão:</strong><br><br>' + concText;

  text = text
    .replace(/<span class='bold'>/g, '<span style="font-weight:bold">')
    .replace(/<span class="bold">/g, '<span style="font-weight:bold">');

  var output = document.getElementById('output');
  if (!output) return null;
  // Não sobrescreve se o usuário está editando o output diretamente
  if (document.activeElement === output) return output;
  output.innerHTML = text;
  return output;
}

function generateText() {
  var output = montarLaudo();
  if (!output) return;

  try { output.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {}

  salvarUltimoLaudo();

  var htmlFormatado =
    '<div style="font-family:Arial,sans-serif;font-size:12pt;">' + output.innerHTML + '</div>';

  if (navigator.clipboard && window.ClipboardItem) {
    navigator.clipboard.write([new ClipboardItem({
      'text/html':  new Blob([htmlFormatado],    { type: 'text/html' }),
      'text/plain': new Blob([output.innerText], { type: 'text/plain' })
    })]).then(function () {
      mostrarToast('&#128203; Laudo gerado e copiado!', '#1a3a1a');
    }).catch(function () { copiarPorSelecao(output); });
  } else {
    copiarPorSelecao(output);
  }
}

function copiarPorSelecao(output) {
  output.focus();
  var sel = window.getSelection(), range = document.createRange();
  range.selectNodeContents(output);
  sel.removeAllRanges(); sel.addRange(range);
  document.execCommand('copy');
  sel.removeAllRanges();
  mostrarToast('&#128203; Laudo gerado e copiado!', '#1a3a1a');
}

// ----------------------------------------------------------
// COPIAR
// ----------------------------------------------------------

function copiarConteudo() {
  var output = document.getElementById('output');
  var html   = '<div style="font-family:Arial,sans-serif;font-size:12pt;">' + output.innerHTML + '</div>';
  if (navigator.clipboard && window.ClipboardItem) {
    navigator.clipboard.write([new ClipboardItem({
      'text/html':  new Blob([html],             { type: 'text/html' }),
      'text/plain': new Blob([output.innerText], { type: 'text/plain' })
    })]).then(function () {
      mostrarToast('&#128196; Texto copiado!');
    }).catch(function () { copiarPorSelecao(output); mostrarToast('&#128196; Texto copiado!'); });
  } else {
    copiarPorSelecao(output); mostrarToast('&#128196; Texto copiado!');
  }
}

async function copiarFormatado() {
  var output = document.getElementById('output');
  var html   = '<div style="font-family:Arial,sans-serif;font-size:11pt;">' + output.innerHTML + '</div>';
  if (navigator.clipboard && window.ClipboardItem) {
    try {
      await navigator.clipboard.write([new ClipboardItem({
        'text/html':  new Blob([html],             { type: 'text/html' }),
        'text/plain': new Blob([output.innerText], { type: 'text/plain' })
      })]);
      mostrarToast('&#128424; Copiado em Arial 11!'); return;
    } catch (e) { /* fallback */ }
  }
  copiarPorSelecao(output); mostrarToast('&#128424; Copiado em Arial 11!');
}
