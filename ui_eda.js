// ============================================================
// UI — Gerar Laudo EDA
// DOM, popups, drag & drop, checkbox sync, serialization
// Depende de: core_eda.js (carregado antes)
// ============================================================

// ----------------------------------------------------------
// SEÇÕES CHECKBOX
// ----------------------------------------------------------

function popularCheckboxSection(containerId, itens, nomeSortable) {
  let container = document.getElementById(containerId);
  if (!container) return;
  container.querySelectorAll('.item[data-populated]').forEach(function (el) { el.remove(); });
  (itens || []).forEach(function (item) {
    if (item.separador) {
      let sep = document.createElement('div');
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
    let div = document.createElement('div');
    div.className = `item${(!item.valor || item.valor.indexOf('|||') >= 0) ? ' item-modificador' : ''}`;
    div.setAttribute('data-populated', '1');
    let idPadrao = nomeSortable ? `${item.nome}-${nomeSortable}` : `${item.nome}-${containerId}`;
    let id = item.id || idPadrao;
    let valorEsc = (item.valor || '')
      .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
    div.innerHTML =
      `<input type="checkbox" name="${item.nome}" value="${valorEsc}" id="${id}">` +
      `<label for="${id}">${item.nome}</label>`;
    // Support new `conclusao` field on predefined items: attach as data attribute
    if (item && item.conclusao !== undefined && item.conclusao !== null) {
      let inp = div.querySelector('input[type="checkbox"]');
      if (inp) inp.dataset.conclusao = String(item.conclusao);
    }
    container.appendChild(div);
  });
}

function popularSelect(id, opcoes) {
  let sel = document.getElementById(id);
  if (!sel) return;
  sel.innerHTML = '';
  (opcoes || []).forEach(function (op) {
    let opt = document.createElement('option');
    if (typeof op === 'string') {
      opt.value = op; opt.textContent = op || '-';
    } else {
      opt.value       = op.valor !== undefined ? op.valor : op;
      opt.textContent = op.label !== undefined ? op.label : op;
      ['extra', 'conclusao', 'anatomo', 'valor2', 'extra2', 'valor3', 'extra3', 'valor4', 'extra4', 'tipo']
        .forEach(function (k) { if (op[k] !== undefined) opt.dataset[k] = op[k]; });
    }
    sel.appendChild(opt);
  });
  // UIs de Achado multi-seleção (Atrofia/Gastrite): <select> oculto como
  // fonte de dados + render custom recolhido (mesma base, _renderModifMS).
  let msUi = { 'atr-modif': 'atr-modif-ui', 'gastr-modif': 'gastr-modif-ui', 'esof-modif': 'esof-modif-ui',
               'barrett-aval': 'barrett-aval-ui', 'barrett-bio': 'barrett-bio-ui' };
  if (msUi[id] && typeof _renderModifMS === 'function') _renderModifMS(id, msUi[id]);
}

// ----------------------------------------------------------
// EDITOR DE OPÇÕES DE DROPDOWN
// ----------------------------------------------------------

// Dados que abastecem mais de um <select> (Gastrite + Atrofia).
// Quando uma chave aqui é editada, todos os selects listados são repopulados.
const SHARED_SELECTS = {
  liquidoVolume: ['gastr-liquido-vol',  'atr-liquido-vol'],
  liquidoTipo:   ['gastr-liquido-tipo', 'atr-liquido-tipo']
};

// Modificadores legados (value === ''): id do checkbox → [find, replace]
// usados só para preencher os campos do popup de edição.
const LEGADOS_MOD = {
  checkboxhipocardia: ['ajustado', 'alargado em relação'],
  checkboxmi:         ['reduzido', 'reduzido, além de focos de provável metaplasia intestinal,'],
  checkbox23:         ['Hiato diafragmático ajustado ao aparelho, quando visto em retroversão.',
                       'À retroversão, nota-se fundoplicatura tópica e continente.'],
  checkboxfundopmig:  ['Hiato diafragmático ajustado ao aparelho, quando visto em retroversão.',
                       'À retroversão, nota-se alargamento do hiato e fundoplicatura com deslocamento cranial.']
};

// Lê "find|||replace[|||find2...]" → { find, replace } com <br> → \n para
// exibição em textarea. Centraliza o parse usado no popup de edição.
function _parseModValue(value) {
  let parts = String(value == null ? '' : value).split('|||');
  return {
    find:    (parts[0] || '').replace(/<br\s*\/?>/gi, '\n'),
    replace: parts.slice(1).join('|||').replace(/<br\s*\/?>/gi, '\n')
  };
}

let _editingOptions = null;

// Resolve um dbKey possivelmente aninhado por ponto ("varizes.numero") sob
// root[dbGroup], criando os objetos intermediários. Retorna { parent, key }
// para ler/gravar a lista final. dbKey simples ("itensEsofagite") segue igual.
function _resolverDestinoOptions(root, dbGroup, dbKey) {
  if (!root[dbGroup] || typeof root[dbGroup] !== 'object') root[dbGroup] = {};
  var partes = String(dbKey).split('.');
  var obj = root[dbGroup];
  for (var i = 0; i < partes.length - 1; i++) {
    if (!obj[partes[i]] || typeof obj[partes[i]] !== 'object') obj[partes[i]] = {};
    obj = obj[partes[i]];
  }
  return { parent: obj, key: partes[partes.length - 1] };
}

// Guarda única para ações bloqueadas no modo visitante. Retorna true (e
// mostra o toast) quando a ação deve ser abortada. `msg` completa a frase
// "👤 Modo visitante — …".
function _visitanteBloqueado(msg) {
  if (!_modoVisitante) return false;
  mostrarToast('👤 Modo visitante — ' + (msg || 'esta ação não está disponível.'), '#7a4000', 4000);
  return true;
}

function _toggleEditOptsMode() {
  if (_visitanteBloqueado('edição não permitida.')) return;
  let ligado = document.body.classList.toggle('mostrar-edit-opts');
  if (ligado) {
    document.body.classList.remove('edit-opts-wiggling');
    void document.body.offsetWidth;
    document.body.classList.add('edit-opts-wiggling');
    setTimeout(function () { document.body.classList.remove('edit-opts-wiggling'); }, 750);
  }
}

function editarOptions(selectId, titulo, dbGroup, dbKey, temExtra, modoModificador) {
  if (_visitanteBloqueado('edição não permitida.')) return;
  if (!_DB[dbGroup]) _DB[dbGroup] = {};
  var _dest = _resolverDestinoOptions(_DB, dbGroup, dbKey);
  if (!Array.isArray(_dest.parent[_dest.key])) _dest.parent[_dest.key] = [];

  _editingOptions = {
    selectId: selectId,
    dbGroup: dbGroup,
    dbKey: dbKey,
    temExtra: !!temExtra,
    temConclusao: (dbGroup === 'esofagoPainel' &&
                  (dbKey === 'itensEsofagite' || dbKey === 'modificadoresEsofagite'))
                  || (dbGroup === 'estomagoPainel' && dbKey === 'lesoesBiopsia'),
    temAnatomo: dbGroup === 'estomagoPainel' && dbKey === 'lesoesBiopsia',
    modoModificador: !!modoModificador
  };
  document.getElementById('popup-edit-options-title').textContent = `✎ ${titulo}`;

  let legenda = document.querySelector('#popup-edit-options .opt-editor-legenda');
  if (legenda) {
    legenda.className = 'opt-editor-legenda';
    if (modoModificador) {
      // Todo editor de modificador é "Achado tipado" (Substituição/Adição).
      legenda.classList.add('opt-editor-cols', 'opt-editor-cols-atrofia');
      legenda.innerHTML = '<strong>Tipo de item</strong><strong>Nome</strong><strong>A substituir</strong><strong>Substituição</strong>';
    } else if (dbKey && dbKey.indexOf('templatesConclusao') === 0) {
      legenda.innerHTML = '<strong>Label</strong>: identificador do cenário — <em>não altere</em>. <strong>Valor</strong>: texto da conclusão gerada. Placeholders disponíveis: <code>{intensidade}</code>, <code>{intensidade-corpo}</code>, <code>{intensidade-antro}</code>.';
    } else if (_editingOptions.temAnatomo) {
      legenda.innerHTML = '<strong>Label</strong>: como aparece no dropdown. <strong>Valor</strong>: texto inserido no laudo (Estômago). <strong>Conclusão</strong>: texto adicionado à conclusão da lesão. <strong>Anatomo</strong>: nome do procedimento — o item gerado fica <em>(este texto) de (lesão) (segmento)</em> (vazio = não cria item).';
    } else if (_editingOptions.temConclusao) {
      legenda.innerHTML = '<strong>Label</strong>: como aparece no dropdown. <strong>Valor</strong>: texto inserido no Esôfago. <strong>Conclusão</strong>: texto inserido na seção Conclusão.';
    } else {
      legenda.innerHTML = '<strong>Label</strong>: como aparece no dropdown (curto). <strong>Valor</strong>: texto inserido no laudo.';
    }
  }

  let arr = _dest.parent[_dest.key].map(function (v) {
    if (v && typeof v === 'object' && 'valor' in v) return v;
    return { valor: v == null ? '' : String(v), label: (v === '' || v == null) ? '-' : String(v) };
  });
  _renderEditorOptions(arr);
  abrirPopup('popup-edit-options');
}

function _renderEditorOptions(arr) {
  let body = document.getElementById('popup-edit-options-body');
  body.innerHTML = '';
  arr.forEach(function (op) { body.appendChild(_criarLinhaEditorOption(op)); });

  let addBtn = document.createElement('button');
  addBtn.className = 'btn-add';
  addBtn.style.marginTop = '10px';
  addBtn.textContent = '＋ Adicionar opção';
  addBtn.onclick = function () {
    let row = _criarLinhaEditorOption({ valor: '', label: '', extra: _editingOptions.temExtra ? '' : undefined });
    body.insertBefore(row, addBtn);
    requestAnimationFrame(function () { _ajustarAlturaLinha(row); });
  };
  body.appendChild(addBtn);

  // Ajuste inicial de altura — depois do layout para offsetHeight ser válido.
  requestAnimationFrame(function () {
    body.querySelectorAll('.opt-editor-row').forEach(_ajustarAlturaLinha);
  });
}

// Cada textarea da linha recebe altura mínima igual ao input do Label e
// auto-resize por scrollHeight quando há conteúdo. Vazia = altura do label.
function _ajustarAlturaLinha(row) {
  let labelEl = row.querySelector('.opt-label-in');
  let minH = labelEl ? labelEl.offsetHeight : 0;
  row.querySelectorAll('textarea').forEach(function (ta) {
    ta._minHeight = minH;
    autoResizeTextarea(ta);
  });
}

// Auto-resize textarea por scrollHeight, respeitando altura mínima (_minHeight)
// para que textareas vazias tenham o mesmo tamanho do input ao lado.
function autoResizeTextarea(el) {
  if (!el) return;
  let cs    = getComputedStyle(el);
  let lh    = parseFloat(cs.lineHeight) || (parseFloat(cs.fontSize) * 1.3);
  let padV  = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
  let bordV = el.offsetHeight - el.clientHeight;          // bordas
  let maxH  = Math.round(lh * 3 + padV + bordV);          // teto = 3 linhas
  let minH  = el._minHeight || 0;
  el.style.height = 'auto';
  let alvo = Math.max(el.scrollHeight, minH);
  if (alvo > maxH) {
    el.style.height = maxH + 'px';
    el.style.overflowY = 'auto';
  } else {
    el.style.height = alvo + 'px';
    el.style.overflowY = 'hidden';
  }
}

function _mkOptBtn(txt, cls, title, fn) {
  let b = document.createElement('button');
  b.className = 'opt-btn' + (cls ? ' ' + cls : '');
  b.textContent = txt;
  if (title) b.title = title;
  b.onclick = fn;
  return b;
}


function _criarLinhaEditorOption(op) {
  let temExtra = _editingOptions && _editingOptions.temExtra;
  let temConclusao = _editingOptions && _editingOptions.temConclusao;
  let temAnatomo = _editingOptions && _editingOptions.temAnatomo;
  let modoMod  = _editingOptions && _editingOptions.modoModificador;
  let temPar2  = modoMod && ((op && op.valor2) || (op && op.extra2));
  let row = document.createElement('div');

  let labelIn;
  if (modoMod) {
    labelIn = document.createElement('textarea');
    labelIn.rows = 1;
    labelIn.oninput = function () { autoResizeTextarea(this); };
  } else {
    labelIn = document.createElement('input');
    labelIn.type = 'text';
  }
  labelIn.className = 'opt-label-in';
  labelIn.placeholder = modoMod ? 'Nome' : 'Label';
  labelIn.value = (op && op.label) || '';

  let valorIn = document.createElement('textarea');
  valorIn.className = 'opt-valor-in';
  valorIn.placeholder = modoMod ? 'Substituir (texto a ser substituído)' : 'Texto inserido no laudo';
  valorIn.rows = 1;
  valorIn.value = (op && op.valor !== undefined) ? op.valor : '';
  valorIn.oninput = function () { autoResizeTextarea(this); };

  let extraIn = null;
  if (temExtra) {
    extraIn = document.createElement('textarea');
    extraIn.className = 'opt-extra-in';
    extraIn.placeholder = modoMod ? 'Por (texto final)' : 'Extra';
    extraIn.rows = 1;
    extraIn.value = (op && op.extra !== undefined) ? op.extra : '';
    extraIn.oninput = function () { autoResizeTextarea(this); };
  }

  let conclusaoIn = null;
  if (temConclusao) {
    conclusaoIn = document.createElement('textarea');
    conclusaoIn.className = 'opt-extra-in opt-conclusao-in';
    conclusaoIn.placeholder = 'Texto inserido na Conclusão';
    conclusaoIn.rows = 1;
    conclusaoIn.value = (op && op.conclusao !== undefined) ? op.conclusao : '';
    conclusaoIn.oninput = function () { autoResizeTextarea(this); };
  }

  let anatomoIn = null;
  if (temAnatomo) {
    anatomoIn = document.createElement('textarea');
    anatomoIn.className = 'opt-extra-in opt-anatomo-in';
    anatomoIn.placeholder = 'Nome no Anatomo (ex.: Biópsias) — vazio = não cria item';
    anatomoIn.rows = 1;
    anatomoIn.value = (op && op.anatomo !== undefined) ? op.anatomo : '';
    anatomoIn.oninput = function () { autoResizeTextarea(this); };
  }

  let btnUp = _mkOptBtn('↑', '', 'Mover para cima', function () {
    let prev = row.previousElementSibling;
    if (prev && prev.classList.contains('opt-editor-row')) row.parentNode.insertBefore(row, prev);
  });
  let btnDown = _mkOptBtn('↓', '', 'Mover para baixo', function () {
    let next = row.nextElementSibling;
    if (next && next.classList.contains('opt-editor-row')) row.parentNode.insertBefore(next, row);
  });
  let btnRm = _mkOptBtn('✕', 'opt-btn-rm', 'Remover', function () { row.remove(); });

  // ---- Layout NÃO-modificador (Vol./Líq./templatesConclusão): igual ao anterior ----
  if (!modoMod) {
    row.className = 'opt-editor-row';
    row.appendChild(labelIn);
    row.appendChild(valorIn);
    if (extraIn) row.appendChild(extraIn);
    if (conclusaoIn) row.appendChild(conclusaoIn);
    if (anatomoIn) row.appendChild(anatomoIn);
    row.appendChild(btnUp);
    row.appendChild(btnDown);
    row.appendChild(btnRm);
    return row;
  }

  // ---- Layout MODIFICADOR: grid 5 colunas ----
  // 1: Tipo (Substituição/Adição) | 2: Nome | 3: Substituir | 4: Por | 5: botões
  row.className = 'opt-editor-row opt-mod-row' + (temPar2 ? ' has-extra' : '');

  // Todo modificador é "Achado tipado" (Substituição/Adição).
  let tipoSel = null;
  if (modoMod) {
    tipoSel = document.createElement('select');
    tipoSel.className = 'opt-tipo-in';
    [['substituicao', 'Substituição'], ['adicao', 'Adição']].forEach(function (par) {
      let o = document.createElement('option');
      o.value = par[0]; o.textContent = par[1];
      tipoSel.appendChild(o);
    });
    tipoSel.value = (op && op.tipo === 'adicao') ? 'adicao' : 'substituicao';
    tipoSel.style.gridArea = '1 / 1';
    row.appendChild(tipoSel);
  }

  labelIn.style.gridArea = '1 / 2';
  valorIn.style.gridArea = '1 / 3';
  row.appendChild(labelIn);
  row.appendChild(valorIn);
  if (extraIn) { extraIn.style.gridArea = '1 / 4'; row.appendChild(extraIn); }

  let btnAddPair = _mkOptBtn('＋', 'opt-btn-add-pair', 'Adicionar par de substituição', function () {
    var p = _proxOculto();
    if (p) _setSlot(p, true);
  });

  // Coluna 5 (linha 1): ↑ ↓ ＋ ✕
  let btns = document.createElement('div');
  btns.className = 'opt-mod-btns';
  btns.style.gridArea = '1 / 5';
  btns.appendChild(btnUp);
  btns.appendChild(btnDown);
  btns.appendChild(btnAddPair);
  btns.appendChild(btnRm);
  row.appendChild(btns);

  // Pares de substituição 2..4 — cada um numa linha, colunas 3/4, botões na 5.
  // Valem inclusive para itens de Adição (substituição extra).
  let slots = [];
  [2, 3, 4].forEach(function (n) {
    let vIn = document.createElement('textarea');
    vIn.rows = 1;
    vIn.className = 'opt-valor' + n + '-in';
    vIn.placeholder = 'Substituir ' + n + ' (opcional)';
    vIn.value = (op && op['valor' + n] !== undefined) ? op['valor' + n] : '';
    vIn.style.gridArea = n + ' / 3';
    vIn.oninput = function () { autoResizeTextarea(this); };

    let eIn = document.createElement('textarea');
    eIn.rows = 1;
    eIn.className = 'opt-extra' + n + '-in';
    eIn.placeholder = 'Por ' + n + ' (opcional)';
    eIn.value = (op && op['extra' + n] !== undefined) ? op['extra' + n] : '';
    eIn.style.gridArea = n + ' / 4';
    eIn.oninput = function () { autoResizeTextarea(this); };

    // Botões do par: ↑ ↓ (reordenam a prioridade da substituição) + ✕ (remove).
    let up = _mkOptBtn('↑', 'opt-pair-up', 'Subir prioridade da substituição', function () {
      _moverPar(n, -1);
    });
    let down = _mkOptBtn('↓', 'opt-pair-down', 'Descer prioridade da substituição', function () {
      _moverPar(n, +1);
    });
    let rm = _mkOptBtn('✕', 'opt-btn-rm', 'Remover par ' + n, function () {
      vIn.value = ''; eIn.value = ''; _setSlot(n, false);
    });
    let btns = document.createElement('div');
    btns.className = 'opt-pair-btns';
    btns.style.gridArea = n + ' / 5';
    btns.appendChild(up);
    btns.appendChild(down);
    btns.appendChild(rm);

    row.appendChild(vIn);
    row.appendChild(eIn);
    row.appendChild(btns);
    slots.push({ n: n, v: vIn, e: eIn, btns: btns, up: up, down: down });
  });

  // Slots de substituição em ORDEM POSICIONAL: par 1 (Substituir/Por) + pares
  // 2-4. Essa ordem é a ordem de aplicação no laudo — o slot mais ao topo é
  // aplicado primeiro e, em trechos sobrepostos, prevalece ("1º vence"). As
  // setas ↑/↓ trocam os valores entre slots ativos adjacentes, alterando a
  // prioridade; salvarOptionsEditadas grava na ordem posicional resultante.
  let pairSlots = [{ v: valorIn, e: extraIn, par1: true }].concat(
    slots.map(function (s) { return { v: s.v, e: s.e, n: s.n }; })
  );
  function _parAtivo(ps) {
    // Adição: par 1 não é substituição (campo "Substituir" oculto).
    if (ps.par1) return !!extraIn && !(tipoSel && tipoSel.value === 'adicao');
    return ps.v.style.display !== 'none';
  }
  function _parsAtivos() { return pairSlots.filter(_parAtivo); }
  function _moverPar(n, dir) {
    let alvo = null;
    for (let i = 0; i < pairSlots.length; i++) if (pairSlots[i].n === n) alvo = pairSlots[i];
    if (!alvo) return;
    let arr = _parsAtivos();
    let i = arr.indexOf(alvo);
    let j = i + dir;
    if (i < 0 || j < 0 || j >= arr.length) return;
    let a = arr[i], b = arr[j];
    let tv = a.v.value; a.v.value = b.v.value; b.v.value = tv;
    let te = a.e.value; a.e.value = b.e.value; b.e.value = te;
    [a.v, a.e, b.v, b.e].forEach(function (el) { autoResizeTextarea(el); });
    _atualizarSetasPar();
  }
  function _atualizarSetasPar() {
    let arr = _parsAtivos();
    slots.forEach(function (s) {
      let ps = null;
      for (let i = 0; i < pairSlots.length; i++) if (pairSlots[i].n === s.n) ps = pairSlots[i];
      let idx = arr.indexOf(ps);
      let ativo = idx >= 0;
      // ↑ só faz sentido se houver par ativo acima; ↓ se houver abaixo.
      s.up.disabled = !ativo || idx === 0;
      s.down.disabled = !ativo || idx === arr.length - 1;
    });
  }

  function _setSlot(n, mostrar) {
    let s = slots[n - 2];
    if (!s) return;
    s.v.style.display = mostrar ? '' : 'none';
    s.e.style.display = mostrar ? '' : 'none';
    s.btns.style.display = mostrar ? '' : 'none';
    if (mostrar) { autoResizeTextarea(s.v); autoResizeTextarea(s.e); }
    _atualizarAddPair();
    _atualizarSetasPar();
  }
  function _proxOculto() {
    for (let i = 0; i < slots.length; i++) {
      if (slots[i].v.style.display === 'none') return slots[i].n;
    }
    return 0;
  }
  function _atualizarAddPair() {
    let p = _proxOculto();
    btnAddPair.style.display = p ? '' : 'none';
  }
  slots.forEach(function (s) {
    let tem = op && ((op['valor' + s.n] && op['valor' + s.n] !== '') ||
                     (op['extra' + s.n] && op['extra' + s.n] !== ''));
    _setSlot(s.n, !!tem);
  });
  _atualizarAddPair();
  _atualizarSetasPar();

  // tipo "Adição": esconde "Substituir" da linha 1; "Por" vira "Texto a
  // adicionar". Os pares 2..4 continuam disponíveis (substituição extra).
  if (tipoSel) {
    let aplicarTipo = function () {
      let ad = tipoSel.value === 'adicao';
      valorIn.style.display = ad ? 'none' : '';
      if (extraIn) extraIn.placeholder = ad ? 'Texto a adicionar:' : 'Por (texto final)';
      _atualizarSetasPar();
    };
    tipoSel.onchange = aplicarTipo;
    aplicarTipo();
  }

  // Conclusão do modificador: linha própria abaixo dos pares (row 5), cobrindo
  // as colunas de dados (2→5). Não colide com Tipo/Nome/pares nem com a coluna
  // de botões. O placeholder já explica a função (legenda fica nas colunas).
  if (conclusaoIn) {
    conclusaoIn.placeholder = 'Texto inserido na Conclusão (opcional)';
    conclusaoIn.style.gridArea = '5 / 2 / 6 / 6';
    row.appendChild(conclusaoIn);
  }

  return row;
}

function salvarOptionsEditadas() {
  if (_visitanteBloqueado('esta ação não está disponível.')) return;
  if (!_editingOptions) return;
  let rows = document.querySelectorAll('#popup-edit-options-body .opt-editor-row');
  let novoArr = [];
  rows.forEach(function (row) {
    let label = row.querySelector('.opt-label-in').value;
    let valor = row.querySelector('.opt-valor-in').value;
    if (label === '' && valor === '') return;
    let op = { valor: valor, label: label };
    let tipoEl = row.querySelector('.opt-tipo-in');
    let tipo = tipoEl ? tipoEl.value : null;
    if (tipo) {
      op.tipo = tipo;
      if (tipo === 'adicao') op.valor = '';   // adição não usa "Substituir"
    }
    if (_editingOptions.temExtra) {
      let ex = row.querySelector('.opt-extra-in');
      if (ex) op.extra = ex.value;
    }
    if (_editingOptions.temConclusao) {
      let con = row.querySelector('.opt-conclusao-in');
      if (con) op.conclusao = con.value;
    }
    if (_editingOptions.temAnatomo) {
      let ana = row.querySelector('.opt-anatomo-in');
      if (ana) op.anatomo = ana.value;
    }
    if (_editingOptions.modoModificador) {
      [2, 3, 4].forEach(function (n) {
        let v = row.querySelector('.opt-valor' + n + '-in');
        let e = row.querySelector('.opt-extra' + n + '-in');
        if (v) op['valor' + n] = v.value;
        if (e) op['extra' + n] = e.value;
      });
    }
    novoArr.push(op);
  });

  if (novoArr.length === 0) {
    mostrarToast('⚠ Pelo menos uma opção é necessária.', '#7a4000', 3500);
    return;
  }

  var _destSalvar = _resolverDestinoOptions(_DB, _editingOptions.dbGroup, _editingOptions.dbKey);
  _destSalvar.parent[_destSalvar.key] = novoArr;

  // Selects que precisam refletir a edição: o originador + irmãos compartilhados
  let alvos = SHARED_SELECTS[_editingOptions.dbKey] || [_editingOptions.selectId];
  alvos.forEach(function (id) {
    if (!id) return;
    let sel = document.getElementById(id);
    let valorAnterior = sel ? sel.value : null;
    popularSelect(id, novoArr);
    if (sel && valorAnterior !== null) {
      let existe = Array.from(sel.options).some(function (o) { return o.value === valorAnterior; });
      if (existe) sel.value = valorAnterior;
    }
  });

  fecharTodosPopups();
  _editingOptions = null;
  if (typeof registrarSnapshot === 'function') registrarSnapshot('editar lista de opções');
  salvarDados();
}

async function _obterPadraoGrupoOptions(dbGroup, dbKey) {
  var padrao = null;
  if (typeof obterTemplateAdminEDA === 'function') {
    try {
      var template = await obterTemplateAdminEDA();
      padrao = buscarGrupoOptionsNoBanco(template, dbGroup, dbKey);
    } catch (e) {
      console.warn('[restaurar] template admin', e);
    }
  }
  if (!padrao && typeof DB_PADRAO !== 'undefined') {
    padrao = buscarGrupoOptionsNoBanco(DB_PADRAO, dbGroup, dbKey);
  }
  return padrao;
}

// ---- Popup de edição: ações por item (restaurar padrão / excluir) ----
// Modelo deferido: ambas operam sobre groupEl._editCb (referência salva em
// showPopup). Restaurar = só carrega o padrão nos campos do popup; o commit
// só acontece em salvarItemEditado(). Excluir = remoção imediata (ação
// destrutiva com confirmação própria, fora do staging).

function _criarBotaoRestaurarItemPadrao(groupEl) {
  let btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn-muted btn-restaurar-item-padrao';
  btn.style.cssText = 'margin:6px 0 4px;font-size:12px;';
  btn.textContent = '↺ Restaurar padrão';
  btn.onclick = function () { restaurarItemCheckboxPadrao(groupEl); };
  return btn;
}

function _criarBotaoExcluirItem(groupEl) {
  let btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn-muted btn-excluir-item';
  btn.style.cssText = 'margin:6px 0 4px 8px;font-size:12px;';
  btn.textContent = '🗑 Excluir este item';
  btn.onclick = async function () {
    let cb = groupEl._editCb;
    if (!cb) return;
    let nomeIn = groupEl.querySelector('input[type="text"]');
    let nome = (nomeIn && nomeIn.value) || cb.name;
    if (!await confirmar(`Excluir o item "${nome}" desta seção?`, { danger: true, okText: 'Excluir' })) return;
    let oldName = cb.name;
    (cb.closest('.item') || cb.parentElement).remove();
    // Propagação cross-section: remove item paralelo na Conclusão pelo nome antigo
    try {
      document.querySelectorAll(`#sortable-conclusao input[name="${oldName}"]`).forEach(function (c) {
        var p = c.closest('.item'); if (p) p.remove();
      });
    } catch (e) {}
    groupEl.remove();
    let container = document.getElementById('checkbox-list');
    if (!container || container.children.length === 0) hidePopup();
    agendarAutoSave();
    if (typeof registrarSnapshot === 'function') registrarSnapshot('excluir item');
  };
  return btn;
}

// Rodapé comum de cada grupo do popup de edição: Restaurar padrão + Excluir.
function _anexarBotoesRodapeItem(group) {
  group.appendChild(_criarBotaoRestaurarItemPadrao(group));
  group.appendChild(_criarBotaoExcluirItem(group));
}

// Carrega os valores de um item-padrão nos campos do popup. NÃO toca no cb —
// o commit é responsabilidade de salvarItemEditado().
function _atualizarCamposPopupItem(groupEl, padrao) {
  if (!groupEl || !padrao) return;
  let valor = padrao.valor != null ? String(padrao.valor) : '';
  let nomeInput = groupEl.querySelector('input[type="text"]');
  if (nomeInput && padrao.nome != null) nomeInput.value = padrao.nome;

  let textareas = groupEl.querySelectorAll('textarea.edit-value-input:not(.edit-conclusao-input)');
  if (textareas.length >= 2) {
    let mod = _parseModValue(valor);
    textareas[0].value = mod.find;
    textareas[1].value = mod.replace;
    return;
  }
  let editor = groupEl.querySelector('.edit-value-contenteditable, div.edit-value-input[contenteditable="true"]');
  if (editor) editor.innerHTML = valor;
}

async function restaurarItemCheckboxPadrao(groupEl) {
  if (_visitanteBloqueado('esta ação não está disponível.')) return;
  if (!groupEl) return;
  let cb = groupEl._editCb;
  if (!cb) return;
  if (!await confirmar(
    'Restaurar este item para o padrão do administrador?\nAs alterações não salvas neste item serão descartadas.',
    { danger: true, okText: 'Restaurar' }
  )) return;

  let padrao = null;
  if (typeof obterTemplateAdminEDA === 'function') {
    try {
      let template = await obterTemplateAdminEDA();
      padrao = buscarItemCheckboxNoBanco(template, cb.id, cb.name);
    } catch (e) {
      console.warn('[restaurarItem] template admin', e);
    }
  }
  if (!padrao && typeof DB_PADRAO !== 'undefined') {
    padrao = buscarItemCheckboxNoBanco(DB_PADRAO, cb.id, cb.name);
  }
  if (!padrao) {
    mostrarToast('⚠ Item não encontrado no template do administrador.', '#7a4000', 4000);
    return;
  }
  _atualizarCamposPopupItem(groupEl, padrao);
  mostrarToast('✓ Padrão carregado — clique Salvar para confirmar', '#1a3a1a', 3500);
}

async function restaurarOptionsPadrao() {
  if (_visitanteBloqueado('esta ação não está disponível.')) return;
  if (!_editingOptions) return;
  if (!await confirmar(
    'Restaurar as opções para o padrão do administrador?\nSuas edições atuais nesta lista serão descartadas.',
    { danger: true, okText: 'Restaurar' }
  )) return;

  let padrao = await _obterPadraoGrupoOptions(_editingOptions.dbGroup, _editingOptions.dbKey);
  if (!padrao) {
    mostrarToast('⚠ Sem padrão definido para esta lista.', '#7a4000', 3500);
    return;
  }
  _renderEditorOptions(normalizarOptionsArray(padrao));
}

// ----------------------------------------------------------
// EDITOR DE ESTRUTURA (esqueleto das frases dos painéis)
// ----------------------------------------------------------
// Edita as frases fixas que envolvem os valores dinâmicos dos painéis. Config
// por painel em ESTRUTURA_PAINEIS (painel_eda.js). Dois layouts:
//   'sequencia' (Gastrite/Atrofia): lista ordenável de segmentos; tokens são
//                chips travados (reordenáveis/removíveis, re-inseríveis pela paleta).
//   'campos'    (Varizes/Barrett): templates string com tokens {…} inline travados.
// Persiste igual a salvarOptionsEditadas (snapshot p/ undo + salvarDados).
var _editingEstrutura = null;

function editarEstrutura(painelId) {
  if (_visitanteBloqueado('edição não permitida.')) return;
  var cfg = (typeof ESTRUTURA_PAINEIS !== 'undefined') && ESTRUTURA_PAINEIS[painelId];
  if (!cfg) return;
  _editingEstrutura = { painelId: painelId, cfg: cfg };
  document.getElementById('popup-edit-estrutura-title').textContent = '✎ ' + cfg.titulo;

  var legenda = document.querySelector('#popup-edit-estrutura .opt-editor-legenda');
  if (legenda) {
    legenda.innerHTML = (cfg.layout === 'sequencia')
      ? 'Cada linha é uma frase do parágrafo, na ordem em que aparece. Os <strong>tokens</strong> (em destaque) são preenchidos automaticamente e não podem ser editados — só reordenados (↑↓), removidos (✕) ou re-inseridos pela paleta.'
      : 'Edite o texto de cada campo. Os <strong>tokens</strong> (ex.: <code>{x}</code>) são preenchidos automaticamente: insira-os pela paleta e apague-os como um bloco único. Espaços no início/fim são significativos.';
  }

  if (cfg.layout === 'sequencia') _renderEstruturaSequencia(_estruturaPainel(cfg.dbGroup, cfg.dbKey));
  else                            _renderEstruturaCampos(cfg);
  abrirPopup('popup-edit-estrutura');
}

// ---- Layout 'sequencia' (Gastrite/Atrofia) ----

function _nomeTokenPainel(cfg, id) {
  var t = (cfg.tokens || []).find(function (x) { return x.id === id; });
  return t ? t.nome : id;
}

function _estruturaBtns(row) {
  var box = document.createElement('div');
  box.className = 'estrutura-row-btns';
  box.appendChild(_mkOptBtn('↑', '', 'Mover para cima', function () {
    var prev = row.previousElementSibling;
    if (prev && prev.classList.contains('estrutura-row')) row.parentNode.insertBefore(row, prev);
  }));
  box.appendChild(_mkOptBtn('↓', '', 'Mover para baixo', function () {
    var next = row.nextElementSibling;
    if (next && next.classList.contains('estrutura-row')) row.parentNode.insertBefore(next, row);
  }));
  box.appendChild(_mkOptBtn('✕', 'opt-btn-rm', 'Remover', function () { row.remove(); }));
  return box;
}

function _criarLinhaEstrutura(seg, cfg) {
  var row = document.createElement('div');
  row.className = 'estrutura-row';
  row.dataset.tipo = seg.tipo;
  if (seg.tipo === 'token') {
    row.dataset.token = seg.token;
    var chip = document.createElement('span');
    chip.className = 'estrutura-token-chip';
    chip.textContent = '{' + _nomeTokenPainel(cfg, seg.token) + '}';
    chip.title = 'Token {' + seg.token + '} — preenchido automaticamente';
    row.appendChild(chip);
  } else {
    var ta = document.createElement('textarea');
    ta.className = 'estrutura-fixo-in';
    ta.rows = 1;
    ta.value = seg.texto || '';
    ta.placeholder = 'Frase fixa';
    ta.oninput = function () { autoResizeTextarea(this); };
    row.appendChild(ta);
    requestAnimationFrame(function () { autoResizeTextarea(ta); });
  }
  row.appendChild(_estruturaBtns(row));
  return row;
}

function _renderEstruturaSequencia(arr) {
  var cfg = _editingEstrutura.cfg;
  var body = document.getElementById('popup-edit-estrutura-body');
  body.innerHTML = '';

  var lista = document.createElement('div');
  lista.className = 'estrutura-lista';
  body.appendChild(lista);
  (arr || []).forEach(function (seg) { lista.appendChild(_criarLinhaEstrutura(seg, cfg)); });

  var paleta = document.createElement('div');
  paleta.className = 'estrutura-paleta';
  var rotulo = document.createElement('span');
  rotulo.className = 'estrutura-paleta-rotulo';
  rotulo.textContent = 'Inserir:';
  paleta.appendChild(rotulo);
  (cfg.tokens || []).forEach(function (t) {
    paleta.appendChild(_mkBtnSimples('estrutura-token-add', '+ ' + t.nome, function () {
      lista.appendChild(_criarLinhaEstrutura({ tipo: 'token', token: t.id }, cfg));
    }));
  });
  paleta.appendChild(_mkBtnSimples('btn-add', '＋ frase fixa', function () {
    var row = _criarLinhaEstrutura({ tipo: 'fixo', texto: '' }, cfg);
    lista.appendChild(row);
    var ta = row.querySelector('textarea');
    if (ta) ta.focus();
  }));
  body.appendChild(paleta);
}

function _mkBtnSimples(cls, txt, fn) {
  var b = document.createElement('button');
  b.type = 'button';
  b.className = cls;
  b.textContent = txt;
  b.onclick = fn;
  return b;
}

// ---- Layout 'campos' (Varizes/Barrett): contenteditable com chips inline ----

function _criarChipInline(token) {
  var chip = document.createElement('span');
  chip.className = 'estrutura-token-chip estrutura-token-chip-inline';
  chip.contentEditable = 'false';
  chip.dataset.token = token;
  chip.textContent = '{' + token + '}';
  return chip;
}

// Preenche o editor a partir de um template string, transformando {tokens} em
// chips travados e mantendo o texto (incl. espaços) verbatim.
function _preencherEditorTokens(editor, tpl) {
  editor.innerHTML = '';
  var re = /\{(\w+)\}/g, last = 0, m;
  tpl = tpl || '';
  while ((m = re.exec(tpl))) {
    if (m.index > last) editor.appendChild(document.createTextNode(tpl.slice(last, m.index)));
    editor.appendChild(_criarChipInline(m[1]));
    last = re.lastIndex;
  }
  if (last < tpl.length) editor.appendChild(document.createTextNode(tpl.slice(last)));
}

// Serializa o editor de volta para template string. SEM trim/colapso — espaços
// de início/fim são significativos (ex.: avaliacaoPrefixo termina em espaço).
function _serializarEditorTokens(editor) {
  function walk(node) {
    var s = '';
    Array.prototype.forEach.call(node.childNodes, function (n) {
      if (n.nodeType === 3) { s += n.nodeValue; return; }
      if (n.nodeType !== 1) return;
      if (n.classList && n.classList.contains('estrutura-token-chip')) s += '{' + (n.dataset.token || '') + '}';
      else if (n.tagName === 'BR') s += '';
      else s += walk(n);
    });
    return s;
  }
  return walk(editor).replace(/ /g, ' ');
}

function _inserirChipNoEditor(editor, token) {
  editor.focus();
  var sel = window.getSelection();
  var chip = _criarChipInline(token);
  if (sel && sel.rangeCount && editor.contains(sel.anchorNode)) {
    var range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(chip);
    range.setStartAfter(chip);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
  } else {
    editor.appendChild(chip);
  }
}

function _criarCampoEstrutura(campo, valor) {
  var wrap = document.createElement('div');
  wrap.className = 'estrutura-campo';
  wrap.dataset.chave = campo.chave;

  var lab = document.createElement('div');
  lab.className = 'estrutura-campo-rotulo';
  lab.textContent = campo.nome;
  wrap.appendChild(lab);

  var editor = document.createElement('div');
  editor.className = 'estrutura-campo-editor';
  editor.contentEditable = 'true';
  editor.spellcheck = false;
  editor.addEventListener('keydown', function (e) { if (e.key === 'Enter') e.preventDefault(); });
  _preencherEditorTokens(editor, valor);
  wrap.appendChild(editor);

  if (campo.tokens && campo.tokens.length) {
    var paleta = document.createElement('div');
    paleta.className = 'estrutura-paleta';
    var rot = document.createElement('span');
    rot.className = 'estrutura-paleta-rotulo';
    rot.textContent = 'Inserir token:';
    paleta.appendChild(rot);
    campo.tokens.forEach(function (tk) {
      var b = _mkBtnSimples('estrutura-token-add', '+ {' + tk + '}', function () { _inserirChipNoEditor(editor, tk); });
      b.onmousedown = function (e) { e.preventDefault(); };   // preserva o cursor no editor
      paleta.appendChild(b);
    });
    wrap.appendChild(paleta);
  }
  return wrap;
}

function _renderEstruturaCampos(cfg, objOverride) {
  var body = document.getElementById('popup-edit-estrutura-body');
  body.innerHTML = '';
  var obj;
  if (objOverride && typeof objOverride === 'object') {
    obj = objOverride;
  } else {
    var dest = _resolverDestinoOptions(_DB, cfg.dbGroup, cfg.dbKey);
    obj = dest.parent[dest.key] || {};
  }
  var padObj = (typeof buscarGrupoOptionsNoBanco === 'function')
    ? (buscarGrupoOptionsNoBanco(_dbPadraoSeguro(), cfg.dbGroup, cfg.dbKey) || {})
    : {};
  (cfg.campos || []).forEach(function (campo) {
    var v = (obj[campo.chave] != null) ? String(obj[campo.chave])
          : (padObj[campo.chave] != null ? String(padObj[campo.chave]) : '');
    body.appendChild(_criarCampoEstrutura(campo, v));
  });
}

// ---- Salvar / Restaurar ----

function salvarEstruturaEditada() {
  if (_visitanteBloqueado('esta ação não está disponível.')) return;
  if (!_editingEstrutura) return;
  var cfg = _editingEstrutura.cfg;
  var dest = _resolverDestinoOptions(_DB, cfg.dbGroup, cfg.dbKey);

  if (cfg.layout === 'sequencia') {
    var arr = [];
    document.querySelectorAll('#popup-edit-estrutura-body .estrutura-row').forEach(function (row) {
      if (row.dataset.tipo === 'token') {
        arr.push({ tipo: 'token', token: row.dataset.token });
      } else {
        var ta = row.querySelector('textarea');
        var texto = ta ? ta.value : '';
        if (texto.trim() === '') return;             // descarta frase fixa vazia
        arr.push({ tipo: 'fixo', texto: texto });
      }
    });
    dest.parent[dest.key] = arr;
  } else {
    if (!dest.parent[dest.key] || typeof dest.parent[dest.key] !== 'object') dest.parent[dest.key] = {};
    var obj = dest.parent[dest.key];
    document.querySelectorAll('#popup-edit-estrutura-body .estrutura-campo').forEach(function (w) {
      var chave = w.dataset.chave;
      var editor = w.querySelector('.estrutura-campo-editor');
      if (chave && editor) obj[chave] = _serializarEditorTokens(editor);
    });
  }

  fecharTodosPopups();
  _editingEstrutura = null;
  if (typeof registrarSnapshot === 'function') registrarSnapshot('editar estrutura');
  if (typeof salvarDados === 'function') salvarDados();
  if (typeof _agendarLiveLaudo === 'function') _agendarLiveLaudo();
  if (typeof mostrarToast === 'function') mostrarToast('💾 Estrutura salva.', '#1a3a1a');
}

async function restaurarEstruturaPadrao() {
  if (_visitanteBloqueado('esta ação não está disponível.')) return;
  if (!_editingEstrutura) return;
  var cfg = _editingEstrutura.cfg;
  if (!await confirmar(
    'Restaurar esta estrutura para o padrão do administrador?\nSuas edições atuais aqui serão descartadas.',
    { danger: true, okText: 'Restaurar' }
  )) return;

  var padrao = await _obterPadraoGrupoOptions(cfg.dbGroup, cfg.dbKey);
  if (padrao == null) {
    mostrarToast('⚠ Sem padrão definido para esta estrutura.', '#7a4000', 3500);
    return;
  }
  if (cfg.layout === 'sequencia') _renderEstruturaSequencia(Array.isArray(padrao) ? padrao : []);
  else                            _renderEstruturaCampos(cfg, padrao);
}

// Drag & Drop em dnd_eda.js (inicializarSortable, ativarZona, ativarItem, getAfterElement)

// ----------------------------------------------------------
// SINCRONIZAÇÃO DE CHECKBOXES
// ----------------------------------------------------------

function inicializarSincronizacaoCheckboxes() {
  // Resolve label → input associado (clicar na label dispara mousedown na
  // label, não no checkbox).
  function _checkboxAlvo(target) {
    if (!target) return null;
    if (target.type === 'checkbox') return target;
    if (target.tagName === 'LABEL' && target.htmlFor) {
      let el = document.getElementById(target.htmlFor);
      if (el && el.type === 'checkbox') return el;
    }
    return null;
  }

  // Shift+Click suprime sincronização. Marcamos o checkbox no mousedown
  // (sempre é MouseEvent com shiftKey confiável) e consumimos no change.
  // Não dá pra ler shiftKey no próprio 'change' — ele não é MouseEvent.
  document.addEventListener('mousedown', function (e) {
    if (!e.shiftKey) return;
    let cb = _checkboxAlvo(e.target);
    if (cb) cb.dataset.noSync = '1';
  }, true);

  document.addEventListener('change', function (e) {
    if (e.target.type !== 'checkbox') return;
    if (e.target.dataset.noSync) {
      delete e.target.dataset.noSync;
      return;
    }
    let name = e.target.name, checked = e.target.checked;
    if (name === 'Normal') return;

    if (e.target.value === '' || e.target.value.includes('|||')) {
      // Espelha o estado (marcar E desmarcar) no irmão da Conclusão. Antes
      // só propagava ao marcar, então desmarcar no Estômago deixava o da
      // Conclusão preso marcado. O guard evita reescrever o próprio alvo
      // quando o evento já vem da Conclusão.
      document.querySelectorAll(`#Conclusão input[name="${name}"]`).forEach(function (concCb) {
        if (concCb !== e.target) concCb.checked = checked;
      });
    } else {
      document.querySelectorAll(`input[type="checkbox"][name="${name}"]`).forEach(function (cb) {
        if (cb !== e.target) cb.checked = checked;
      });

      if (name.includes('+')) {
        let partes = name.split('+');
        document.querySelectorAll(`#Conclusão input[name="${partes[0]}"]`).forEach(function (cb) {
          cb.checked = true;
        });
        if (partes[1]) {
          document.querySelectorAll(`#Conclusão input[name$="${partes[1]}"]`).forEach(function (cb) {
            cb.checked = true;
          });
        }
      }
    }

    // --- Criar / Remover item na seção Conclusão para itens predefinidos ---
    try {
      // Detectar se o checkbox vem de Esôfago/Estômago/Duodeno
      var sectionMap = { 'sortable-esofago': 'esofago', 'sortable-estomago': 'estomago', 'sortable-duodeno': 'duodeno' };
      var foundSection = null;
      Object.keys(sectionMap).forEach(function (sid) { if (!foundSection) { let el = document.getElementById(sid); if (el && el.contains(e.target)) foundSection = sectionMap[sid]; } });
      if (foundSection) {
        var origemName = e.target.name;
        var wrapper = e.target.closest && e.target.closest('.item');
        var isModificador = wrapper ? wrapper.classList.contains('item-modificador') : false;
        if (checked) {
          // Se já existir, apenas marca-la
          var existe = document.querySelector(`#sortable-conclusao input[name="${origemName}"]`);
          if (existe) { existe.checked = true; }
          else {
            // Para modificadores, só criamos conclusão se houver um texto
            // explícito em data-conclusao. Para itens normais, usamos
            // dataset.conclusao ou fallback para o value.
           var texto = '';
            if (e.target.dataset && e.target.dataset.conclusao) texto = e.target.dataset.conclusao;
            // ← REMOVE: else if (!isModificador) texto = e.target.value;
            // Agora SOMENTE usa dataset.conclusao — se vazio, não cria
            
            if (texto && texto !== '') {
              var div = (typeof createConclusaoDiv === 'function') ? createConclusaoDiv(texto, origemName) : createCheckboxDiv(texto, origemName);
              appendAfterLastChecked('sortable-conclusao', div, foundSection);
            }
          }
        } else {
          // Ao desmarcar, removemos o(s) item(s) correspondentes na Conclusão
          document.querySelectorAll(`#sortable-conclusao input[name="${origemName}"]`).forEach(function (cb) {
            var p = cb.closest('.item'); if (p) p.remove();
          });
        }
      }
    } catch (err) { console.warn('[sync-conclusao]', err); }
  });

  // Achado (Gastrite/Atrofia) → marca/desmarca itens de MESMO NOME em todas as
  // seções de laudo, em tempo real. Os multiselects 'gastr-modif'/'atr-modif'
  // disparam 'change' (bubbling) ao alternar uma opção (ver _renderModifMS).
  document.addEventListener('change', function (e) {
    var id = e.target && e.target.id;
    if ((id === 'gastr-modif' || id === 'atr-modif') &&
        typeof _sincronizarSecoesPorAchado === 'function') {
      _sincronizarSecoesPorAchado(id);
    }
  });
}

function inicializarConcNormal() {
  let concnormal = document.getElementById('concnormal');
  if (!concnormal) return;
  concnormal.addEventListener('change', function () {
    ['checkbox4', 'checkbox11', 'checkbox26'].forEach(function (id) {
      let cb = document.getElementById(id);
      if (cb) { cb.checked = concnormal.checked; cb.dispatchEvent(new Event('change', { bubbles: true })); }
    });
  });
}

// ----------------------------------------------------------
// SEDAÇÃO DINÂMICA
// ----------------------------------------------------------

function addParametersedacao() {
  let fentanil  = document.getElementById('fentanil').value;
  let midazolam = document.getElementById('midazolam').value;
  let map = {
    fentanil: fentanil,
    midazolam: midazolam ? (' + Midazolam ' + midazolam) : ''
  };
  let e = (_DB.sedacaoSelects && _DB.sedacaoSelects.estrutura)
       || (_dbPadraoSeguro().sedacaoSelects && _dbPadraoSeguro().sedacaoSelects.estrutura) || {};
  let texto = ['linha1', 'linha2', 'linha3']
    .map(function (k) {
      return String(e[k] || '').replace(/\{(\w+)\}/g, function (m, t) { return (t in map) ? map[t] : m; });
    })
    .filter(function (s) { return s.trim() !== ''; })
    .join('<br>');
  appendToSortable('sortable-sedacao', createCheckboxDiv(texto, 'sedacao'));
}

// ----------------------------------------------------------
// POPUPS — EDITAR / CRIAR / EXCLUIR
// ----------------------------------------------------------

function abrirPopup(id) {
  document.getElementById(id).style.display = 'block';
  document.getElementById('backdrop').classList.add('show');
}

function toggleModifierFields(type) {
  let modifier = document.getElementById('modifier-fields');
  let normal   = document.getElementById('checkbox-value-group');
  if (!modifier || !normal) return;
  if (type === 'modificador') {
    modifier.style.display = 'block';
    normal.style.display   = 'none';
  } else {
    modifier.style.display = 'none';
    normal.style.display   = 'block';
  }
}

function showPopup() {
  if (_visitanteBloqueado('edição não permitida.')) return;
  // Itens gerados por painel (item-dinamico) usam label via aria-labelledby
  // (sem `for`) e não têm um "nome" editável — editá-los aqui corrompia o
  // texto. São ignorados: ao editar um item persistente com um item de painel
  // também selecionado, este permanece intocado.
  let selecionados = document.querySelectorAll('.sortable-zone .item input[type="checkbox"]:checked');
  let checkboxes = Array.prototype.filter.call(selecionados, function (cb) {
    let item = cb.closest('.item');
    return !(item && item.classList.contains('item-dinamico'));
  });
  let container  = document.getElementById('checkbox-list');
  container.innerHTML = '';

  if (checkboxes.length === 0) {
    mostrarToast(selecionados.length > 0
      ? '⚠ Os itens selecionados são gerados por painel e não podem ser editados aqui.'
      : '⚠ Selecione um ou mais itens para editar.', '#7a4000', 4500);
    return;
  }

  // Inicializar toolbar compartilhada (apenas na primeira execução)
  if (!document.getElementById('popup-format-toolbar').dataset.initialized) {
    document.getElementById('popup-format-toolbar').dataset.initialized = '1';
    document.querySelectorAll('#popup-format-toolbar .fmt-btn').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var cmd = this.dataset.cmd;
        var editor = window._activeEditor;
        if (!editor) return;
        editor.focus();
        document.execCommand(cmd);
        editor.focus();
        // execCommand muta o editor staged; commit em _commitEdicoesPopup.
      });
    });
  }
  // Reset active editor ao abrir popup
  window._activeEditor = null;

  // Modelo deferido: cada edit-group guarda referências fechadas ao cb/label
  // originais (via _editCb/_editLabel/_editSuffix/_isModificador). Os campos
  // do popup carregam o estado staged, sem tocar no DOM real. Cancelar = fechar;
  // Salvar = walk dos groups e commit num passo único (_commitEdicoesPopup).
  checkboxes.forEach(function (cb) {
    let wrapper   = cb.closest('.item');
    let label     = wrapper ? wrapper.querySelector('label') : document.querySelector(`label[for="${cb.id}"]`);
    let labelText = label ? label.innerText : '';
    let suffix    = cb.id.replace(cb.name, '');

    let group = document.createElement('div');
    group.className = 'edit-group';
    group._editCb     = cb;
    group._editLabel  = label;
    group._editSuffix = suffix;

    let nomeLabel = document.createElement('strong');
    nomeLabel.textContent = 'Nome do Item:';
    let nomeInput = document.createElement('input');
    nomeInput.type = 'text';
    nomeInput.style.cssText = 'display:block;width:300px;margin:4px 0 10px;';
    nomeInput.value = labelText;

    let isModificador = wrapper ? wrapper.classList.contains('item-modificador') : false;
    group._isModificador = isModificador;

    if (isModificador) {
      let findValue, replaceValue;
      if (cb.value === '') {
        let leg = LEGADOS_MOD[cb.id] || ['', ''];
        findValue = leg[0];
        replaceValue = leg[1];
      } else {
        let mod = _parseModValue(cb.value);
        findValue = mod.find;
        replaceValue = mod.replace;
      }

      let findLabel = document.createElement('strong');
      findLabel.textContent = 'Texto a ser substituído:';
      let findTa = document.createElement('textarea');
      findTa.className = 'edit-value-input';
      findTa.style.cssText = 'display:block;height:60px;width:90%;margin-top:4px;';
      findTa.value = findValue;

      let replaceLabel = document.createElement('strong');
      replaceLabel.textContent = 'Texto final:';
      let replaceTa = document.createElement('textarea');
      replaceTa.className = 'edit-value-input';
      replaceTa.style.cssText = 'display:block;height:60px;width:90%;margin-top:4px;';
      replaceTa.value = replaceValue;

      group.appendChild(nomeLabel);
      group.appendChild(nomeInput);
      group.appendChild(findLabel);
      group.appendChild(findTa);
      group.appendChild(replaceLabel);
      group.appendChild(replaceTa);
    } else {
      let editorContainer = document.createElement('div');
      editorContainer.className = 'edit-value-editor';

      let editorDiv = document.createElement('div');
      editorDiv.className = 'edit-value-input edit-value-contenteditable';
      editorDiv.contentEditable = true;
      editorDiv.innerHTML = cb.value;

      editorDiv.addEventListener('focus', function () { window._activeEditor = this; });

      let valorLabel = document.createElement('strong');
      valorLabel.textContent = 'Texto da entrada:';

      editorContainer.appendChild(editorDiv);
      group.appendChild(nomeLabel);
      group.appendChild(nomeInput);
      group.appendChild(valorLabel);
      group.appendChild(editorContainer);

      // Itens da seção Anatomo: dropdown Frasco / Nota de rodapé. O toggle do
      // marcador [rodapé] é staged no editorDiv (não no cb) — commit só em Salvar.
      let _anatomoZone = document.getElementById('sortable-anatomo');
      if (_anatomoZone && _anatomoZone.contains(cb)) {
        let tipoWrap = document.createElement('div');
        let tipoStrong = document.createElement('strong');
        tipoStrong.textContent = 'Tipo (Anatomo):';
        tipoWrap.appendChild(tipoStrong);
        tipoWrap.appendChild(document.createElement('br'));
        let tipoSel = document.createElement('select');
        tipoSel.style.cssText = 'margin:4px 0 10px;';
        tipoSel.innerHTML =
          '<option value="frasco">Frasco (numerado)</option>' +
          '<option value="rodape">Nota de rodapé (texto no fim, sem número)</option>';
        tipoSel.value = (typeof _apEhRodape === 'function' && _apEhRodape(cb.value)) ? 'rodape' : 'frasco';
        tipoSel.addEventListener('change', function () {
          if (typeof _apSetRodape !== 'function') return;
          editorDiv.innerHTML = _apSetRodape(editorDiv.innerHTML, this.value === 'rodape');
        });
        tipoWrap.appendChild(tipoSel);
        group.appendChild(tipoWrap);
      }
    }

    // Campo "Texto da Conclusão (opcional)" — para Esôfago/Estômago/Duodeno.
    // Aplica-se tanto a itens normais quanto a modificadores.
    let conclZones = ['sortable-esofago','sortable-estomago','sortable-duodeno'];
    let belongs = conclZones.some(function (id) { let el = document.getElementById(id); return el && el.contains(cb); });
    if (belongs) {
      let conclStrong = document.createElement('strong');
      conclStrong.textContent = 'Texto da Conclusão (opcional):';
      let conclTa = document.createElement('textarea');
      conclTa.className = 'edit-value-input edit-conclusao-input';
      conclTa.style.cssText = 'display:block;height:50px;width:90%;margin-top:4px;';
      conclTa.value = cb.dataset && cb.dataset.conclusao ? String(cb.dataset.conclusao).replace(/<br\/?\>/gi, '\n') : '';
      group.appendChild(conclStrong);
      group.appendChild(conclTa);
    }

    _anexarBotoesRodapeItem(group);
    container.appendChild(group);
  });

  abrirPopup('popup');
}

// Walk-and-commit dos edit-groups: lê os campos do popup e aplica nos cbs
// originais (nome, valor, dataset.conclusao). Itens cujo cb foi removido
// ("Excluir este item") são pulados silenciosamente. Propagações cross-section
// (rename + valor de conclusion) rodam UMA vez no commit. Retorna true se algo
// foi alterado, false caso contrário.
function _commitEdicoesPopup() {
  let groups = document.querySelectorAll('#checkbox-list .edit-group');
  let alterou = false;
  groups.forEach(function (g) {
    let cb = g._editCb;
    if (!cb || !document.body.contains(cb)) return;
    let label  = g._editLabel;
    let suffix = g._editSuffix || '';
    let nomeInput = g.querySelector('input[type="text"]');
    let novoNome  = nomeInput ? nomeInput.value : cb.name;
    let oldName   = cb.name;

    // Novo valor: depende do tipo (modificador = find|||replace; demais = editor)
    let novoValor;
    if (g._isModificador) {
      let tas = g.querySelectorAll('textarea.edit-value-input:not(.edit-conclusao-input)');
      let findV = tas[0] ? tas[0].value.replace(/\n/g, '<br>') : '';
      let replV = tas[1] ? tas[1].value.replace(/\n/g, '<br>') : '';
      novoValor = findV + '|||' + replV;
    } else {
      let editorDiv = g.querySelector('.edit-value-contenteditable, .edit-value-input[contenteditable="true"]');
      novoValor = editorDiv ? editorDiv.innerHTML : cb.value;
    }

    // Rename: commit + propaga para items paralelos em #sortable-conclusao
    if (novoNome !== oldName) {
      let newId = novoNome + suffix;
      cb.id   = newId;
      cb.name = novoNome;
      if (label) {
        label.setAttribute('for', newId);
        label.innerText = novoNome;
      }
      try {
        document.querySelectorAll(`#sortable-conclusao input[name="${oldName}"]`).forEach(function (conc) {
          conc.name = novoNome;
        });
      } catch (e) { console.warn('[commit] propagar rename na Conclusão', e); }
      alterou = true;
    }

    if (novoValor !== cb.value) {
      cb.value = novoValor;
      alterou = true;
    }

    // Campo de Conclusão opcional: escreve dataset.conclusao + propaga para
    // item paralelo em #sortable-conclusao.
    let conclTa = g.querySelector('textarea.edit-conclusao-input');
    if (conclTa) {
      let novaConcl = conclTa.value.replace(/\n/g, '<br>');
      let antigaConcl = cb.dataset.conclusao || '';
      if (novaConcl !== antigaConcl) {
        cb.dataset.conclusao = novaConcl;
        let conc = document.querySelector(`#sortable-conclusao input[name="${cb.name}"]`);
        if (conc) {
          conc.value = novaConcl;
          let lbl2 = conc.closest('.item').querySelector('label');
          if (lbl2) lbl2.innerHTML = novaConcl || '';
        }
        alterou = true;
      }
    }
  });
  return alterou;
}

function salvarItemEditado() {
  let mudou = _commitEdicoesPopup();
  hidePopup();
  if (mudou) {
    if (typeof agendarAutoSave === 'function') agendarAutoSave();
    if (typeof registrarSnapshot === 'function') registrarSnapshot('editar item');
  }
}

// Cancelar = simplesmente fechar. As edições staged ficam nos campos do popup
// até o GC; o cb real nunca foi tocado.
function cancelarItemEditado() {
  hidePopup();
}

function hidePopup() {
  document.getElementById('popup').style.display = 'none';
  document.getElementById('checkbox-list').innerHTML = '';
  document.getElementById('backdrop').classList.remove('show');
}

async function deleteCheckedCheckboxes() {
  if (_visitanteBloqueado('exclusão não permitida.')) return;
  let checkboxes = document.querySelectorAll('.sortable-zone .item input[type="checkbox"]:checked');
  if (checkboxes.length === 0) return;
  if (!await confirmar(`Deseja excluir os ${checkboxes.length} item(ns) selecionado(s)?`, { danger: true, okText: 'Excluir' })) return;
  checkboxes.forEach(function (cb) { (cb.closest('.item') || cb.parentElement).remove(); });
  // Remover também itens na Conclusão que referenciam os nomes excluídos
  checkboxes.forEach(function (cb) {
    try { document.querySelectorAll(`#sortable-conclusao input[name="${cb.name}"]`).forEach(function (c) { var p = c.closest('.item'); if (p) p.remove(); }); } catch (e) { }
  });
  hidePopup();
  agendarAutoSave();
  if (typeof registrarSnapshot === 'function') registrarSnapshot('excluir itens marcados');
}

// Mostra o campo "Tipo (Anatomo)" só quando a seção Anatomo está escolhida.
function toggleAnatomoTipo() {
  let grupo = document.getElementById('anatomo-tipo-group');
  let sec   = document.getElementById('section-select');
  if (!grupo || !sec) return;
  grupo.style.display = (sec.value === 'sortable-anatomo') ? 'block' : 'none';
  // Mostrar campo de Conclusão apenas para Esôfago / Estômago / Duodeno
  let conclGroup = document.getElementById('checkbox-conclusao-group');
  if (conclGroup) {
    conclGroup.style.display = (sec.value === 'sortable-esofago' || sec.value === 'sortable-estomago' || sec.value === 'sortable-duodeno') ? 'block' : 'none';
  }
}

function showCreatePopup() {
  toggleAnatomoTipo();
  abrirPopup('create-popup');
}

function hideCreatePopup() {
  document.getElementById('create-popup').style.display = 'none';
  document.getElementById('backdrop').classList.remove('show');
}

function createCheckbox() {
  let nome      = document.getElementById('checkbox-name').value.trim();
  let tipo      = document.getElementById('checkbox-type').value;
  let valor     = document.getElementById('checkbox-value').value.replace(/\n/g, '<br>');
  let sectionId = document.getElementById('section-select').value;

  if (!nome) { mostrarToast('⚠ Digite um nome para o item.', '#7a4000'); return; }

  // Seção Anatomo: tipo "rodapé" grava o marcador [rodapé] no início do valor
  // (persistido via valor; removido na montagem do pedido de AP).
  if (sectionId === 'sortable-anatomo') {
    let tipoEl = document.getElementById('anatomo-tipo');
    if (tipoEl && tipoEl.value === 'rodape' && typeof _apSetRodape === 'function')
      valor = _apSetRodape(valor, true);
  }

  let section = document.getElementById(sectionId);
  let div = document.createElement('div');
  div.setAttribute('data-populated', '1');

  if (tipo === 'modificador') {
    let findValue    = document.getElementById('checkbox-find').value.trim();
    let replaceValue = document.getElementById('checkbox-replace').value.replace(/\n/g, '<br>');
    if (!findValue || !replaceValue) {
      mostrarToast('⚠ Digite texto a ser substituído e texto final para o modificador.', '#7a4000');
      return;
    }
    valor = `${findValue}|||${replaceValue}`;
    div.className = 'item item-modificador';
  } else {
    div.className = 'item';
  }
  
  let cb = document.createElement('input');
  cb.type = 'checkbox'; cb.name = nome; cb.value = valor;
  cb.id   = `${nome}-${sectionId}`;
  // Se o criador forneceu texto de conclusão, armazena no atributo dataset
  let conclVal = document.getElementById('checkbox-conclusao');
  if (conclVal && conclVal.value && (sectionId === 'sortable-esofago' || sectionId === 'sortable-estomago' || sectionId === 'sortable-duodeno')) {
    cb.dataset.conclusao = conclVal.value.replace(/\n/g, '<br>');
  }

  let lbl = document.createElement('label');
  lbl.htmlFor = cb.id; lbl.textContent = nome;

  div.appendChild(cb); div.appendChild(lbl);
  section.appendChild(div);

  hideCreatePopup();
  document.getElementById('checkbox-name').value    = '';
  document.getElementById('checkbox-value').value   = '';
  document.getElementById('checkbox-find').value    = '';
  document.getElementById('checkbox-replace').value = '';
  document.getElementById('checkbox-type').value    = 'normal';
  let tipoReset = document.getElementById('anatomo-tipo');
  if (tipoReset) tipoReset.value = 'frasco';
  toggleModifierFields('normal');

  if (typeof agendarAutoSave === 'function') agendarAutoSave();
  if (typeof registrarSnapshot === 'function') registrarSnapshot('criar item');
  mostrarToast('✓ Item criado!');
}

// Marca o exame como normal: desmarca tudo e ativa todos os itens nomeados
// "Normal" (Esôfago, Estômago, Duodeno, Conclusão) + o método histológico de
// pesquisa de H. pylori ("Histo"). Busca por NAME (não por id) para ser robusto
// a dados salvos cujos ids foram recriados/editados.
function marcarExameNormal() {
  document.querySelectorAll('input[type="checkbox"]').forEach(function (cb) { cb.checked = false; });

  var alvos = document.querySelectorAll(
    '.sortable-zone input[type="checkbox"][name="Normal"], ' +
    '.sortable-zone input[type="checkbox"][name="Histo HP"], ' +
    '.sortable-zone input[type="checkbox"][name="Histo"], ' +
    '.sortable-zone input[type="checkbox"][name="GIF-H170"], ' +
    '.sortable-zone input[type="checkbox"][name="Anestesista"]'
  );

  if (!alvos.length) {
    mostrarToast('⚠ Nenhum item "Normal" encontrado nas seções.', '#7a4000', 3500);
    return;
  }

  alvos.forEach(function (cb) {
    cb.checked = true;
    cb.dispatchEvent(new Event('change', { bubbles: true }));
    // Expande a seção que recebeu o item, para o estado ficar visível.
    var row = cb.closest('.sec-row');
    if (row) row.classList.remove('collapsed');
  });

  // Gera o laudo a partir dos itens recém-marcados e copia para a área de
  // transferência. Roda síncrono dentro do clique, preservando o "gesto de
  // usuário" exigido para a cópia. Não persiste estado (sem snapshot/auto-save).
  if (typeof generateText === 'function') {
    generateText();
  } else {
    if (typeof _agendarLiveLaudo === 'function') _agendarLiveLaudo();
    mostrarToast('✓ Exame normal marcado');
  }
}

// ----------------------------------------------------------
// SERIALIZAÇÃO DOM → objeto
// ----------------------------------------------------------

const IDS_CONTROLE = new Set(['sedacao-sortable']);

function serializarSecao(containerId, opts) {
  opts = opts || {};
  let container = document.getElementById(containerId);
  if (!container) return [];
  let itens = [];
  container.querySelectorAll(':scope > .item').forEach(function (div) {
    if (opts.semDinamicos && div.classList.contains('item-dinamico')) return;
    if (div.getAttribute('data-sep') === '1') { itens.push({ separador: true }); return; }
    let cb = div.querySelector('input[type="checkbox"]');
    if (!cb || IDS_CONTROLE.has(cb.id) || IDS_CONTROLE.has(cb.name)) return;
    if (div.getAttribute('data-ph')) return;
    let label = div.querySelector('label');
    let nome  = label ? label.innerText.trim() : cb.name;
    if (!nome) return;
    let item = { nome: nome };
    let idPadrao = `${nome}-${containerId}`;
    if (cb.id && cb.id !== idPadrao) item.id = cb.id;
    item.valor = cb.value;
    // Preserve conclusion text when present on the checkbox (new field)
    if (cb.dataset && cb.dataset.conclusao !== undefined) item.conclusao = cb.dataset.conclusao;
    itens.push(item);
  });
  return itens;
}

function coletarDB(opts) {
  let optsSelect = function (id) {
    let el = document.getElementById(id);
    if (!el) return [];
    return Array.from(el.options).map(function (o) {
      return { valor: o.value, label: o.textContent };
    });
  };
  let db = { sedacaoSelects: { fentanil: optsSelect('fentanil'), midazolam: optsSelect('midazolam') } };
  if (_DB && _DB.estomagoPainel) {
    db.estomagoPainel = _clone(_DB.estomagoPainel);
  } else if (_dbPadraoSeguro().estomagoPainel) {
    db.estomagoPainel = _clone(_dbPadraoSeguro().estomagoPainel);
  }
  if (_DB && _DB.esofagoPainel) {
    db.esofagoPainel = _clone(_DB.esofagoPainel);
  } else if (_dbPadraoSeguro().esofagoPainel) {
    db.esofagoPainel = _clone(_dbPadraoSeguro().esofagoPainel);
  }
  // Config das seções personalizadas (ativa + rótulo) é conteúdo, viaja no slot.
  if (_DB && _DB.secoesCustom) {
    db.secoesCustom = _clone(_DB.secoesCustom);
  } else if (_dbPadraoSeguro().secoesCustom) {
    db.secoesCustom = _clone(_dbPadraoSeguro().secoesCustom);
  }
  _SECOES.forEach(function (s) { db[s.chave] = serializarSecao(s.sortable, opts); });
  return db;
}

// ----------------------------------------------------------
// PAINEL DO ESTÔMAGO — helpers (Gastrite / Atrofia)
// ----------------------------------------------------------

function _atualizarMucosaDet(prefixo, regiao) {
  let estado = getSelectedLabel(prefixo + '-' + regiao + '-estado');
  let det    = document.getElementById(prefixo + '-' + regiao + '-det');
  let detEdit = document.getElementById(prefixo + '-' + regiao + '-det-edit');
  if (!det) return;

  let painel = (typeof _DB !== 'undefined' && _DB && _DB.estomagoPainel) ? _DB.estomagoPainel : null;
  if (!painel) return;

  let opcoes = null;
  let dbKey  = null;
  if (estado === 'enantema') { opcoes = painel.intensidade; dbKey = 'intensidade'; }
  else if (estado === 'erosões') { opcoes = painel.frequencia; dbKey = 'frequencia'; }

  if (opcoes) {
    popularSelect(prefixo + '-' + regiao + '-det', opcoes);
    det.style.display = '';
    if (detEdit) {
      detEdit.style.display = '';
      detEdit.dataset.dbKey = dbKey;
      let painelTitulo = (prefixo === 'gastr') ? 'Gastrite' : 'Atrofia';
      let regiaoTitulo = (regiao === 'corpo') ? 'Corpo' : 'Antro';
      let detTitulo = (dbKey === 'intensidade') ? 'intensidade' : 'frequência';
      detEdit.dataset.titulo = painelTitulo + ' · Mucosa ' + regiaoTitulo + ' (' + detTitulo + ')';
    }
  } else {
    det.innerHTML = '';
    det.style.display = 'none';
    if (detEdit) detEdit.style.display = 'none';
  }
}

function _editarMucosaDet(prefixo, regiao) {
  if (_visitanteBloqueado('esta ação não está disponível.')) return;
  // Se for select de estado (gastr-corpo-estado, gastr-antro-estado), usa editor especializado
  if (prefixo === 'gastr' && (regiao === 'corpo' || regiao === 'antro')) {
    _editarMucosaEstado(prefixo, regiao);
    return;
  }
  let detEdit = document.getElementById(prefixo + '-' + regiao + '-det-edit');
  if (!detEdit || !detEdit.dataset.dbKey) return;
  editarOptions(prefixo + '-' + regiao + '-det', detEdit.dataset.titulo,
                'estomagoPainel', detEdit.dataset.dbKey, false);
}

function _setDefault(id, v) {
  let el = document.getElementById(id);
  if (el) el.value = v;
}

function _inicializarPainelEstomago() {
  if (typeof _DB === 'undefined' || !_DB || !_DB.estomagoPainel) return;
  let p = _DB.estomagoPainel;
  // Default = primeiro valor do array (posição mais acima)
  let firstVal = function (arr) { return (arr && arr.length > 0) ? arr[0].valor : ''; };

  // Vol. / Líq. — dados compartilhados, mas selects independentes por painel
  popularSelect('gastr-liquido-tipo', p.liquidoTipo);
  popularSelect('gastr-liquido-vol',  p.liquidoVolume);
  popularSelect('atr-liquido-tipo',   p.liquidoTipo);
  popularSelect('atr-liquido-vol',    p.liquidoVolume);
  _setDefault('gastr-liquido-tipo', firstVal(p.liquidoTipo));
  _setDefault('gastr-liquido-vol',  firstVal(p.liquidoVolume));
  _setDefault('atr-liquido-tipo',   firstVal(p.liquidoTipo));
  _setDefault('atr-liquido-vol',    firstVal(p.liquidoVolume));

  popularSelect('gastr-pregueado',    p.pregueado);
  popularSelect('gastr-corpo-estado', p.mucosaEstado);
  popularSelect('gastr-antro-estado', p.mucosaEstado);
  popularSelect('gastr-modif', p.modificadoresGastrite || []);
  _setDefault('gastr-pregueado',    'normotrófico');
  _setDefault('gastr-corpo-estado', 'preservada');
  _setDefault('gastr-antro-estado', 'preservada');
  _atualizarMucosaDet('gastr', 'corpo');
  _atualizarMucosaDet('gastr', 'antro');

  popularSelect('atr-kt',    p.atrofiaKT);
  popularSelect('atr-modif', p.modificadoresAtrofia || []);
  let c1 = (p.atrofiaKT || []).find(function (o) { return o.label === 'C-1'; });
  _setDefault('atr-kt', c1 ? c1.valor : 'C-1');

  if (typeof _inicializarLesaoGastrica === 'function') _inicializarLesaoGastrica();
}

// Painel Esofagite (Esôfago) — mesmo padrão data-driven da Atrofia (item
// único → parágrafo) + modificadores multi-seleção idênticos aos da Gastrite.
// popularSelect já reconstrói o dropdown custom de #esof-modif (mapa msUi).
function _inicializarPainelEsofagite() {
  if (typeof _DB === 'undefined' || !_DB || !_DB.esofagoPainel) return;
  let p = _DB.esofagoPainel;
  popularSelect('esof-item',  p.itensEsofagite || []);
  popularSelect('esof-modif', p.modificadoresEsofagite || []);
  let hhd = document.getElementById('esof-hhd');
  if (hhd) {
    hhd.value = '';
    if (typeof _barrettStepInput === 'function') _barrettStepInput(hhd, 0.5);
  }
  if (typeof _inicializarVarizesEsofago === 'function') _inicializarVarizesEsofago();
  if (typeof _inicializarBarrettInline === 'function') _inicializarBarrettInline();
}

// ----------------------------------------------------------
// FECHAR TODOS OS POPUPS
// ----------------------------------------------------------

function fecharTodosPopups() {
  // Esc/clique no backdrop com o popup de edição aberto = Salvar implícito
  // (mantém a UX antiga: ninguém esperava que clicar fora descartasse edições).
  let pop = document.getElementById('popup');
  if (pop && pop.style.display === 'block') salvarItemEditado();
  else hidePopup();
  document.getElementById('create-popup').style.display = 'none';
  document.getElementById('admin-popup').style.display  = 'none';
  let editPopup = document.getElementById('popup-edit-options');
  if (editPopup) editPopup.style.display = 'none';
  let mucPopup = document.getElementById('popup-edit-mucosa-estado');
  if (mucPopup) mucPopup.style.display = 'none';
  let estrPopup = document.getElementById('popup-edit-estrutura');
  if (estrPopup) estrPopup.style.display = 'none';
  _editingEstrutura = null;
  let fmtPopup = document.getElementById('popup-formato');
  if (fmtPopup && fmtPopup.style.display !== 'none' && typeof fecharEditorFormato === 'function') {
    fecharEditorFormato();   // caminho único: commit + limpa snapshot/timer + fecha
  }
  _editingOptions = null;
  if (typeof fecharMenuSalvar === 'function') fecharMenuSalvar();
  if (typeof fecharMenuEditar === 'function') fecharMenuEditar();
}

// Editor especializado de Mucosa Estado em editor_mucosa_eda.js
// (_editarMucosaEstado, _criarLinhaMucosaEstado, _escapeHtml,
//  salvarMucosaEstadoEditada, adicionarLinhaMucosaEstado, fecharPopupMucosaEstado)

// ----------------------------------------------------------
// VERIFICAÇÃO DE DEPENDÊNCIAS
// (uso `typeof X` sem `window.` porque let/const globais não viram propriedades de window)
// ----------------------------------------------------------
// ----------------------------------------------------------
// SEÇÕES COLAPSÁVEIS + EFEITOS VISUAIS (acordeão + hover)
// Comportamento espelhado do Laudo Colono: seções inativas ficam
// com opacidade reduzida; hover expande a seção (itens perdem transparência).
// Preferência persistida em localStorage com a chave 'eda_efeitos'.
// ----------------------------------------------------------

// Preferência de efeitos visuais (animação do acordeão e transição da caixa
// lateral). Default: ligado. Respeita `prefers-reduced-motion` do SO — usuários
// com redução de movimento ativa veem a UI sem animações mesmo com a preferência
// local "on". Função compartilhada com historico_eda.js.
function _efeitosAtivos() {
  try {
    if (localStorage.getItem('eda_efeitos') === '0') return false;
  } catch (e) {}
  return !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
}

function _secConteudo(row) {
  return row ? row.querySelector(':scope > .sec-content') : null;
}

function expandirSecao(row) {
  if (!row) return;
  var c = _secConteudo(row);
  if (c) {
    // transição de entrada mais rápida (easing customizado)
    c.style.transition = 'opacity .18s cubic-bezier(.22,.61,.36,1)';
  }
  row.classList.remove('collapsed');
  // limpa estilos inline após o fade-in
  if (c) setTimeout(function () { if (c) c.style.cssText = ''; }, 220);
}

function colapsarSecao(row) {
  if (!row || row.classList.contains('collapsed')) return;
  var c = _secConteudo(row);
  if (c) {
    // transição de saída mais longa para efeito mais interessante (easing customizado)
    c.style.transition = 'opacity .9s cubic-bezier(.22,.61,.36,1)';
  }
  row.classList.add('collapsed');
  // limpa estilos inline após o fade-out
  if (c) setTimeout(function () { if (c) c.style.cssText = ''; }, 940);
}

function alternarSecao(row) {
  if (!row) return;
  if (!row.classList.contains('collapsed')) { colapsarSecao(row); return; }
  // Ao abrir, usamos a versão que aguarda fade-out das outras seções.
  abrirSecaoAccordion(row);
}

function abrirSecaoAccordion(row) {
  if (!row || !row.classList.contains('collapsed')) return;
  // Fecha as outras seções (fade-out) e abre a seção alvo imediatamente
  // para que fade-out e fade-in ocorram simultaneamente.
  document.querySelectorAll('.sec-row:not(.collapsed)').forEach(function (r) {
    if (r !== row) colapsarSecao(r);
  });
  expandirSecao(row);
}

// Hover que abre a seção (aplica apenas quando efeitos estão ativos)
(function () {
  var alvo = document.querySelector('.sections-table') || document;
  alvo.addEventListener('mouseover', function (e) {
    if (!_efeitosAtivos()) return;
    var row = e.target.closest && e.target.closest('.sec-row');
    if (!row || !row.classList.contains('collapsed')) return;
    abrirSecaoAccordion(row);
  });
})();

// Clique no label abre quando efeitos ativos
document.addEventListener('click', function (e) {
  if (!_efeitosAtivos()) return;
  var label = e.target.closest && e.target.closest('.sec-label');
  if (!label) return;
  var row = label.closest('.sec-row');
  if (row) abrirSecaoAccordion(row);
});

// Teclado: Enter/Espaço alterna quando efeitos ativos
document.addEventListener('keydown', function (e) {
  if (!_efeitosAtivos()) return;
  if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
  var label = e.target.closest && e.target.closest('.sec-label');
  if (!label) return;
  e.preventDefault();
  var row = label.closest('.sec-row');
  if (row) alternarSecao(row);
});

function _aplicarModoSecoes(efeitosAtivos) {
  document.querySelectorAll('.sec-row').forEach(function (r) {
    r._secTok = (r._secTok || 0) + 1;
    var c = _secConteudo(r);
    if (c) c.style.cssText = '';
    if (efeitosAtivos) r.classList.add('collapsed');
    else               r.classList.remove('collapsed');
  });
}

function toggleEfeitosVisuais() {
  var ativo = !_efeitosAtivos();
  try { localStorage.setItem('eda_efeitos', ativo ? '1' : '0'); } catch (e) {}
  document.body.classList.toggle('sem-efeitos', !ativo);
  _aplicarModoSecoes(ativo);
  if (typeof refrescarMenuSalvar === 'function') refrescarMenuSalvar();
  if (typeof mostrarToast === 'function')
    mostrarToast(ativo ? '✨ Efeitos visuais ativados' : '⏸️ Efeitos visuais desativados', '#1a3a1a', 2500);
}

// Aplica preferência no carregamento
(function () {
  function aplicarEfeitos() {
    var ativo = _efeitosAtivos();
    document.body.classList.toggle('sem-efeitos', !ativo);
    _aplicarModoSecoes(ativo);
  }
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', aplicarEfeitos);
  else
    aplicarEfeitos();
})();
if (typeof getVal === 'undefined') {
  console.error('[ui_eda] ERRO: getVal nao encontrado — core_eda.js precisa ser carregado antes');
}
if (typeof _SECOES === 'undefined') {
  console.error('[ui_eda] ERRO: _SECOES nao encontrado — core_eda.js precisa ser carregado antes');
}
if (typeof _clone === 'undefined') {
  console.warn('[ui_eda] AVISO: _clone nao encontrado');
}
if (typeof _dbPadraoSeguro === 'undefined') {
  console.warn('[ui_eda] AVISO: _dbPadraoSeguro nao encontrado');
}
console.log('[ui_eda] Modulo carregado, dependencias OK');
