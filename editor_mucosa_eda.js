// ============================================================
// editor_mucosa_eda.js — Editor especializado para Mucosa Estado (Gastrite)
// Popup com campos textoIgual / textoDiferente / texto por estado.
// Depende de: core_eda.js (_DB, agendarAutoSave),
//             ui_eda.js (popularSelect)
// ============================================================

function _editarMucosaEstado(prefixo, regiao) {
  var ehCorpo = (regiao === 'corpo');
  var painel = _DB && _DB.estomagoPainel;
  if (!painel) return;

  var dados = painel.mucosaEstado || [];
  var popup = document.getElementById('popup-edit-mucosa-estado');
  if (!popup) return;

  var tituloEl = popup.querySelector('.popup-title');
  if (tituloEl) {
    tituloEl.textContent = 'Gastrite · Mucosa ' + (ehCorpo ? 'Corpo' : 'Antro');
  }

  var container = popup.querySelector('.editor-items');
  if (!container) return;
  container.innerHTML = '';
  dados.forEach(function (item, idx) {
    container.appendChild(_criarLinhaMucosaEstado(item, idx, ehCorpo));
  });

  popup.style.display = 'flex';
}

function _criarLinhaMucosaEstado(item, idx, ehCorpo) {
  var div = document.createElement('div');
  div.className = 'editor-item';

  var html = '';
  html += '<div class="editor-item-header">';
  html += '  <span class="editor-item-num">' + (idx + 1) + '.</span>';
  html += '  <input class="editor-label" value="' + _escapeHtml(item.label) + '" placeholder="Label" />';
  html += '</div>';

  if (ehCorpo) {
    html += '<div class="editor-field-group">';
    html += '  <label>Corpo e antro iguais (e com mesma intensidade):</label>';
    html += '  <textarea class="editor-textarea texto-mesmodet" placeholder="Mesmo estado e mesma intensidade/frequência em corpo e antro (vazio = usa o campo abaixo)">' + _escapeHtml(item.textoMesmoDet || '') + '</textarea>';
    html += '</div>';
    html += '<div class="editor-field-group">';
    html += '  <label>Corpo e antro iguais (com intensidades diferentes):</label>';
    html += '  <textarea class="editor-textarea texto-igual" placeholder="Mesmo estado, mas intensidades/frequências diferentes entre corpo e antro">' + _escapeHtml(item.textoIgual || '') + '</textarea>';
    html += '</div>';
    html += '<div class="editor-field-group">';
    html += '  <label>Quando Antro é diferente (textoDiferente):</label>';
    html += '  <textarea class="editor-textarea texto-diferente" placeholder="Parte do Corpo quando estados são diferentes">' + _escapeHtml(item.textoDiferente || '') + '</textarea>';
    html += '</div>';
  } else {
    html += '<div class="editor-field-group">';
    html += '  <label>Texto do Antro (usado quando diferente do Corpo):</label>';
    html += '  <textarea class="editor-textarea texto-antro" placeholder="Parte do Antro quando estados são diferentes">' + _escapeHtml(item.texto || '') + '</textarea>';
    html += '</div>';
  }

  html += '<div class="editor-item-actions">';
  html += '  <button class="btn-sm btn-move-up" data-idx="' + idx + '">↑</button>';
  html += '  <button class="btn-sm btn-move-down" data-idx="' + idx + '">↓</button>';
  html += '  <button class="btn-sm btn-restaurar" title="Restaurar este subitem ao padrão do administrador">↺</button>';
  html += '  <button class="btn-sm btn-remove" data-idx="' + idx + '">✕</button>';
  html += '</div>';

  div.innerHTML = html;

  // O editor só renderiza os campos do modo atual (Corpo OU Antro), mas
  // cada subitem guarda os 3 campos. Preserva os campos do outro modo
  // para que o salvamento não os apague.
  div._mucosaOrig = {
    textoIgual:     item.textoIgual || '',
    textoMesmoDet:  item.textoMesmoDet || '',
    textoDiferente: item.textoDiferente || '',
    texto:          item.texto || ''
  };

  div.querySelector('.btn-move-up').addEventListener('click', function () {
    var prev = div.previousElementSibling;
    if (prev) div.parentNode.insertBefore(div, prev);
  });
  div.querySelector('.btn-move-down').addEventListener('click', function () {
    var next = div.nextElementSibling;
    if (next) div.parentNode.insertBefore(next, div);
  });
  div.querySelector('.btn-restaurar').addEventListener('click', function () {
    _restaurarLinhaMucosaEstado(div, ehCorpo);
  });
  div.querySelector('.btn-remove').addEventListener('click', function () {
    div.remove();
  });

  return div;
}

async function _restaurarLinhaMucosaEstado(div, ehCorpo) {
  if (typeof _modoVisitante !== 'undefined' && _modoVisitante) {
    mostrarToast('👤 Modo visitante — esta ação não está disponível.', '#7a4000', 4000);
    return;
  }
  var labelInput = div.querySelector('.editor-label');
  var label = labelInput ? labelInput.value.trim() : '';
  if (!label) {
    mostrarToast('⚠ Informe o label do subitem antes de restaurar.', '#7a4000', 4000);
    return;
  }

  var padrao = null;
  if (typeof _obterPadraoGrupoOptions === 'function') {
    padrao = await _obterPadraoGrupoOptions('estomagoPainel', 'mucosaEstado');
  }
  var alvo = Array.isArray(padrao)
    ? padrao.find(function (o) { return o && o.label === label; })
    : null;
  if (!alvo) {
    mostrarToast('⚠ Subitem "' + label + '" não encontrado no template do administrador.', '#7a4000', 4000);
    return;
  }

  if (ehCorpo) {
    var igualEl = div.querySelector('.texto-igual');
    var mesmoDetEl = div.querySelector('.texto-mesmodet');
    var difEl   = div.querySelector('.texto-diferente');
    if (igualEl)    igualEl.value    = alvo.textoIgual || '';
    if (mesmoDetEl) mesmoDetEl.value = alvo.textoMesmoDet || '';
    if (difEl)      difEl.value      = alvo.textoDiferente || '';
  } else {
    var antroEl = div.querySelector('.texto-antro');
    if (antroEl) antroEl.value = alvo.texto || '';
  }
  mostrarToast('✓ Subitem restaurado ao padrão — salve para persistir', '#1a3a1a', 3500);
}

function _escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function salvarMucosaEstadoEditada() {
  var container = document.querySelector('#popup-edit-mucosa-estado .editor-items');
  if (!container) return;
  var painel = _DB && _DB.estomagoPainel;
  if (!painel) return;

  var linhas = container.querySelectorAll('.editor-item');
  var novosDados = [];
  linhas.forEach(function (linha) {
    var labelInput = linha.querySelector('.editor-label');
    if (!labelInput) return;
    var label = labelInput.value.trim();
    if (!label) return;

    // Parte dos campos do outro modo (Corpo/Antro), não renderizados aqui,
    // para não apagá-los ao salvar.
    var orig = linha._mucosaOrig || {};
    var item = {
      valor: label,
      label: label,
      textoIgual:     orig.textoIgual || '',
      textoMesmoDet:  orig.textoMesmoDet || '',
      textoDiferente: orig.textoDiferente || '',
      texto:          orig.texto || ''
    };
    var textoIgualEl = linha.querySelector('.texto-igual');
    var textoMesmoDetEl = linha.querySelector('.texto-mesmodet');
    var textoDiferenteEl = linha.querySelector('.texto-diferente');
    var textoAntroEl = linha.querySelector('.texto-antro');

    if (textoIgualEl)     item.textoIgual     = textoIgualEl.value;
    if (textoMesmoDetEl)  item.textoMesmoDet  = textoMesmoDetEl.value;
    if (textoDiferenteEl) item.textoDiferente = textoDiferenteEl.value;
    if (textoAntroEl)     item.texto          = textoAntroEl.value;

    novosDados.push(item);
  });

  painel.mucosaEstado = novosDados;
  popularSelect('gastr-corpo-estado', novosDados);
  popularSelect('gastr-antro-estado', novosDados);
  agendarAutoSave();
  if (typeof registrarSnapshot === 'function') registrarSnapshot('editar estados da mucosa');
  document.getElementById('popup-edit-mucosa-estado').style.display = 'none';
}

function adicionarLinhaMucosaEstado() {
  var container = document.querySelector('#popup-edit-mucosa-estado .editor-items');
  if (!container) return;
  var ehCorpo = true;
  var tituloEl = document.querySelector('#popup-edit-mucosa-estado .popup-title');
  if (tituloEl && tituloEl.textContent.indexOf('Antro') !== -1) ehCorpo = false;

  var itemVazio = { valor: '', label: '', textoIgual: '', textoDiferente: '', texto: '' };
  var idx = container.children.length;
  container.appendChild(_criarLinhaMucosaEstado(itemVazio, idx, ehCorpo));
}

function fecharPopupMucosaEstado() {
  var popup = document.getElementById('popup-edit-mucosa-estado');
  if (popup) popup.style.display = 'none';
}

// ----------------------------------------------------------
// VERIFICAÇÃO DE DEPENDÊNCIAS
// ----------------------------------------------------------
if (typeof _DB === 'undefined') {
  console.error('[editor_mucosa_eda] ERRO: _DB nao encontrado — core_eda.js precisa ser carregado antes');
}
if (typeof popularSelect === 'undefined') {
  console.error('[editor_mucosa_eda] ERRO: popularSelect nao encontrado — ui_eda.js precisa ser carregado antes');
}
if (typeof agendarAutoSave === 'undefined') {
  console.error('[editor_mucosa_eda] ERRO: agendarAutoSave nao encontrado — core_eda.js precisa ser carregado antes');
}
if (typeof _obterPadraoGrupoOptions === 'undefined') {
  console.warn('[editor_mucosa_eda] AVISO: _obterPadraoGrupoOptions nao encontrado — ui_eda.js precisa ser carregado antes (restaurar subitem indisponivel)');
}
console.log('[editor_mucosa_eda] Modulo carregado, dependencias OK');
