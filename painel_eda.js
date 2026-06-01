// ============================================================
// painel_eda.js — Painéis Gastrite / Atrofia + TPL_EDA
// Dependências: core_eda.js, ui_eda.js
// ============================================================

// ----------------------------------------------------------
// CONSTANTES DE MAPEAMENTO
// ----------------------------------------------------------

// Mapeamento de adjetivos por intensidade (acompanha "edema e enantema")
const _INT_SING = { 'leve': 'discreto', 'moderado': 'moderado', 'intenso': 'intenso' };
const _INT_PLU  = { 'leve': 'discretos', 'moderado': 'moderados', 'intenso': 'intensos' };
// Forma feminina para conclusão ("Pangastrite enantematosa moderada")
const _INT_FEM  = { 'leve': 'leve', 'moderado': 'moderada', 'intenso': 'intensa' };
// Frequência de erosões → adjetivo de intensidade na conclusão
const _FREQ_FEM = { 'raras': 'leve', 'algumas': 'moderada', 'numerosas': 'intensa' };

// Pregueado mucoso é determinado pelo KT no painel Atrofia
const _pregueadoPorKT = function (kt) {
  return ({ 'O-2': 'hipotrófico', 'O-3': 'atrófico' }[kt] || 'normotrófico');
};

// ----------------------------------------------------------
// ESTRUTURA EDITÁVEL DOS PAINÉIS (esqueleto das frases)
// ----------------------------------------------------------
// A estrutura de cada painel é editável pelo usuário (botão "✎ estrutura" no
// modo "Editar listas"). Layout 'sequencia' (Gastrite/Atrofia): array ordenado
// de segmentos {tipo:'fixo',texto} | {tipo:'token',token}, montados com join(' ').
// Layout 'campos' (Varizes/Barrett): templates string com tokens {…} inline.
// A lógica dinâmica (flexão, condições) fica nos resolvedores — o usuário só
// edita as frases fixas e a ordem. Ver [[editar-estrutura]] no plano.
var ESTRUTURA_PAINEIS = {
  gastrite: {
    titulo: 'Estômago · Estrutura (Gastrite)', dbGroup: 'estomagoPainel', dbKey: 'estruturaGastrite',
    layout: 'sequencia',
    tokens: [
      { id: 'liquido',   nome: 'Líquido' },
      { id: 'pregueado', nome: 'Pregueado mucoso' },
      { id: 'mucosa',    nome: 'Mucosa (gastrite)' }
    ]
  },
  atrofia: {
    titulo: 'Estômago · Estrutura (Atrofia)', dbGroup: 'estomagoPainel', dbKey: 'estruturaAtrofia',
    layout: 'sequencia',
    tokens: [
      { id: 'liquido',   nome: 'Líquido' },
      { id: 'pregueado', nome: 'Pregueado mucoso' },
      { id: 'mucosa',    nome: 'Mucosa (atrofia/KT)' }
    ]
  },
  varizes: {
    titulo: 'Esôfago · Estrutura (Varizes)', dbGroup: 'esofagoPainel', dbKey: 'varizes',
    layout: 'campos',
    campos: [
      { chave: 'estrutura', nome: 'Frase das varizes',
        tokens: ['nucleo', 'trajeto', 'calibre', 'coloracao', 'sinais', 'localizacao', 'retracoes', 'ligadura'] }
    ]
  },
  barrett: {
    titulo: 'Esôfago · Estrutura (Barrett)', dbGroup: 'esofagoPainel', dbKey: 'barrett',
    layout: 'campos',
    campos: [
      { chave: 'baseComCirc',      nome: 'Medida — circunf. + digitiforme', tokens: ['x', 'y'] },
      { chave: 'baseSoCirc',       nome: 'Medida — só circunferencial',     tokens: ['x'] },
      { chave: 'baseSemCirc',      nome: 'Medida — só digitiforme',         tokens: ['y'] },
      { chave: 'transicaoComHHD',  nome: 'Transição — com HHD',             tokens: ['hhd'] },
      { chave: 'transicaoSemHHD',  nome: 'Transição — sem HHD',             tokens: [] },
      { chave: 'avaliacaoPrefixo', nome: 'Avaliação complementar (prefixo)', tokens: [] },
      { chave: 'displasiaNao',     nome: 'Displasia — ausente',             tokens: [] },
      { chave: 'displasiaAreaFrag', nome: 'Displasia — área (fragmento)',   tokens: ['parede', 'w'] },
      { chave: 'displasiaSimSing', nome: 'Displasia — presente (singular)', tokens: ['areas'] },
      { chave: 'displasiaSimPlur', nome: 'Displasia — presente (plural)',   tokens: ['areas'] }
    ]
  },
  sedacao: {
    titulo: 'Sedação · Estrutura', dbGroup: 'sedacaoSelects', dbKey: 'estrutura',
    layout: 'campos',
    campos: [
      { chave: 'linha1', nome: 'Linha 1 — medicação', tokens: ['fentanil', 'midazolam'] },
      { chave: 'linha2', nome: 'Linha 2 — suplementação de O2', tokens: [] },
      { chave: 'linha3', nome: 'Linha 3 — monitorização', tokens: [] }
    ]
  }
};

// Monta um parágrafo a partir de um array de segmentos (layout 'sequencia').
// `resolver(token)` devolve o texto dinâmico de um segmento token; segmentos
// fixos usam .texto. Vazios são descartados (igual ao .filter(Boolean) antigo).
function _montarPorEstrutura(arr, resolver) {
  return (arr || []).map(function (s) {
    if (!s) return '';
    return s.tipo === 'token' ? (resolver(s.token) || '') : (s.texto || '');
  }).filter(Boolean).join(' ');
}

// Estrutura salva do painel (com fallback ao DB_PADRAO se ausente/vazia).
function _estruturaPainel(dbGroup, dbKey) {
  var atual = _DB && _DB[dbGroup] && _DB[dbGroup][dbKey];
  if (Array.isArray(atual) && atual.length) return atual;
  var pad = _dbPadraoSeguro()[dbGroup];
  return (pad && Array.isArray(pad[dbKey])) ? pad[dbKey] : [];
}

// ----------------------------------------------------------
// PAINEL GASTRITE
// ----------------------------------------------------------

function _comporMucosaGastrite(cE, cD, aE, aD) {
  var painel = _DB && _DB.estomagoPainel;
  if (!painel) return '';

  var estadoOpts = painel.mucosaEstado || [];

  // ⚠ REGRA DE OURO: usar .label (NUNCA .valor)
  // cE e aE vêm de getSelectedLabel() que retorna textContent = label
  var corpoOpt = estadoOpts.find(function (o) { return o.label === cE; });
  var antroOpt = estadoOpts.find(function (o) { return o.label === aE; });
  if (!corpoOpt) return '';

  // Devolve o texto AINDA COM TOKENS. A resolução é feita depois
  // (em addGastriteParagrafo), após os modificadores — assim o modificador
  // "Achado" pode mirar tokens (ex.: {intensidade-sing-corpo}) e funciona
  // de forma agnóstica de intensidade e correta por região, SEM exigir
  // qualquer alteração nos templates de Mucosa.
  if (cE === aE) {
    // Mesmo estado; se também a mesma intensidade/frequência (cD === aD),
    // usa texto unificado. Fallback para textoIgual se o campo não existir.
    return (cD === aD && corpoOpt.textoMesmoDet)
      ? corpoOpt.textoMesmoDet
      : (corpoOpt.textoIgual || '');
  }
  // Estados diferentes — concatena textoDiferente do Corpo + texto do Antro
  return (corpoOpt.textoDiferente || '') + (antroOpt ? (antroOpt.texto || '') : '');
}

// Resolve os placeholders de intensidade/det. Chamado UMA vez, no fim,
// depois de compor o parágrafo e aplicar os modificadores.
// ⚠ TODAS as resoluções com fallback || '' para evitar "erosões undefined".
function _resolverPlaceholdersGastrite(texto, cD, aD) {
  var resolvidos = {
    '{intensidade-sing-corpo}': (_INT_SING[cD] || cD || ''),
    '{intensidade-sing-antro}': (_INT_SING[aD] || aD || ''),
    '{intensidade-plural-corpo}': (_INT_PLU[cD] || cD || ''),
    '{intensidade-plural-antro}': (_INT_PLU[aD] || aD || ''),
    '{det-corpo}': (cD || ''),
    '{det-antro}': (aD || '')
  };
  return texto.replace(
    /\{intensidade-sing-corpo\}|\{intensidade-sing-antro\}|\{intensidade-plural-corpo\}|\{intensidade-plural-antro\}|\{det-corpo\}|\{det-antro\}/g,
    function (match) { return resolvidos[match] || ''; }
  );
}

// Compõe a frase "Líquido X em Y." Retorna '' se faltar tipo ou volume.
// O valor de liqVol deve carregar a posição correta de "volume" (ex.:
// "pequeno volume" ou "volume regular") — definido nas opções editáveis.
function _fraseLiquido(liqTipo, liqVol) {
  if (!liqTipo || !liqVol) return '';
  return 'Líquido ' + liqTipo + ' em ' + liqVol + '.';
}

function _comporParagrafoGastrite() {
  var pregueado = getVal('gastr-pregueado');
  return _montarPorEstrutura(_estruturaPainel('estomagoPainel', 'estruturaGastrite'), function (tk) {
    switch (tk) {
      case 'liquido':   return _fraseLiquido(getVal('gastr-liquido-tipo'), getVal('gastr-liquido-vol'));
      case 'pregueado': return pregueado ? ('Pregueado mucoso ' + pregueado + '.') : '';
      case 'mucosa':    return _comporMucosaGastrite(
                          getSelectedLabel('gastr-corpo-estado'), getVal('gastr-corpo-det'),
                          getSelectedLabel('gastr-antro-estado'), getVal('gastr-antro-det'));
      default:          return '';
    }
  });
}

// Peso do det (intensidade/frequência) = posição na lista editável (1-based).
// Quanto mais abaixo na lista, maior o grau. 0 = sem det ou não encontrado.
function _pesoDet(estado, det) {
  if (!det) return 0;
  var painel = _DB && _DB.estomagoPainel;
  if (!painel) return 0;
  var arr = (estado === 'enantema') ? painel.intensidade
          : (estado === 'erosões')  ? painel.frequencia
          : null;
  if (!Array.isArray(arr)) return 0;
  for (var i = 0; i < arr.length; i++) {
    if (arr[i] && arr[i].valor === det) return i + 1;
  }
  return 0;
}

// Mapeia a combinação para a label do template no banco (templatesConclusaoGastrite)
function _conclusaoLabelGastrite(cE, cD, aE, aD) {
  if (cE === 'preservada' && aE === 'preservada') return 'Normal';
  if (cE === 'preservada' && aE === 'enantema' && aD) return 'Antro: enantema';
  if (cE === 'preservada' && aE === 'erosões'  && aD) return 'Antro: erosões';
  if (aE === 'preservada' && cE === 'enantema' && cD) return 'Corpo: enantema';
  if (aE === 'preservada' && cE === 'erosões'  && cD) return 'Corpo: erosões';
  if (cE === 'atrofia' && aE === 'atrofia')        return 'Pangastrite atrófica';
  if (cE === 'atrofia' && aE === 'preservada')     return 'Corpo: atrofia';
  if (cE === 'atrofia' && aE === 'enantema' && aD) return 'Corpo atrofia + antro enantema';
  if (cE === 'atrofia' && aE === 'erosões'  && aD) return 'Corpo atrofia + antro erosões';
  if (cE === 'enantema' && aE === 'enantema' && cD && aD) {
    return (cD === aD) ? 'Pangastrite enantematosa' : 'Pangastrite enantematosa assimétrica';
  }
  if (cE === 'erosões' && aE === 'erosões' && cD && aD) return 'Pangastrite erosiva';
  if (cE === 'enantema' && aE === 'erosões'  && cD && aD) return 'Corpo enantema + antro erosões';
  if (cE === 'erosões'  && aE === 'enantema' && cD && aD) return 'Corpo erosões + antro enantema';
  return '';
}

function _comporConclusaoGastrite(cE, cD, aE, aD) {
  var label = _conclusaoLabelGastrite(cE, cD, aE, aD);
  if (!label) return '';
  var templates = (_DB && _DB.estomagoPainel && _DB.estomagoPainel.templatesConclusaoGastrite) || [];
  var tpl = templates.find(function (t) { return t && t.label === label; });
  if (!tpl) return '';
  var texto = tpl.valor || '';

  // Resolve placeholders {intensidade}, {intensidade-corpo}, {intensidade-antro}
  var intCorpo = (cE === 'enantema' && cD) ? (_INT_FEM[cD] || '')
               : (cE === 'erosões'  && cD) ? (_FREQ_FEM[cD] || '')
               : '';
  var intAntro = (aE === 'enantema' && aD) ? (_INT_FEM[aD] || '')
               : (aE === 'erosões'  && aD) ? (_FREQ_FEM[aD] || '')
               : '';
  // Grau geral = det de maior peso entre corpo e antro. Empate (ou antro
  // sem det) → usa o do corpo, preservando o fallback anterior.
  var intGeral = (_pesoDet(aE, aD) > _pesoDet(cE, cD)) ? intAntro : intCorpo;
  texto = texto.replace(/\{intensidade-corpo\}/g, intCorpo)
               .replace(/\{intensidade-antro\}/g, intAntro)
               .replace(/\{intensidade\}/g, intGeral);
  return texto;
}

// Coleta os Achados marcados num <select multiple> como snapshots.
// _snapshotAchado / _achadoValido são declarados adiante (hoisting).
function _coletarAchados(selId) {
  var out = [];
  var sel = document.getElementById(selId);
  if (sel) Array.prototype.forEach.call(sel.options, function (o) {
    if (o.selected && _achadoValido(o)) out.push(_snapshotAchado(o));
  });
  return out;
}

// Seções de laudo varridas pela sincronização Achado → itens de mesmo nome.
var _ZONAS_ACHADO = [
  'sortable-esofago', 'sortable-estomago', 'sortable-duodeno', 'sortable-jejuno',
  'sortable-conclusao', 'sortable-outros', 'sortable-anatomo'
];

// Sincroniza (bidirecional) os checkboxes das seções acima cujo `name` casa,
// por igualdade exata (sem espaços nas pontas, case-insensitive), com o label
// de um Achado do multiselect `selId`. Achado marcado → itens de mesmo nome
// ficam marcados; Achado desmarcado → ficam desmarcados. Percorre TODAS as
// opções (não só as marcadas) para que a desmarcação propague. Não cria itens;
// só afeta itens cujo name casa com ALGUM label de achado válido — os demais
// (sem correspondência, ou dinâmicos com sufixo "_dN") ficam intocados.
function _sincronizarSecoesPorAchado(selId) {
  var sel = document.getElementById(selId);
  if (!sel) return;
  var alvos = {};
  Array.prototype.forEach.call(sel.options, function (o) {
    if (!_achadoValido(o)) return;            // ignora "—" / inválidos
    var n = (o.textContent || '').trim().toLowerCase();
    if (n) alvos[n] = o.selected;
  });
  _ZONAS_ACHADO.forEach(function (zid) {
    var cont = document.getElementById(zid);
    if (!cont) return;
    Array.prototype.forEach.call(
      cont.querySelectorAll('.item input[type="checkbox"]'),
      function (cb) {
        var nome = (cb.getAttribute('name') || '').trim().toLowerCase();
        if (nome && alvos[nome] !== undefined) cb.checked = alvos[nome];
      }
    );
  });
}

// Painéis colapsáveis (Barrett / Atrofia / Lesão). O botão (.painel-toggle) fica
// fora do painel, numa linha de botões; é localizado pelo atributo data-painel.
function _btnDoPainel(id) {
  return document.querySelector('.painel-toggle[data-painel="' + id + '"]');
}

var _timerLayoutEsofagoGeral = null;
var _timerFlipEsofago = null;

// Anima (técnica FLIP) os itens da zona sortable do Esôfago ao trocar entre os
// dois layouts: em coluna (abaixo do painel) ↔ em linha (ao lado do painel
// "Geral"). mudarLayout() faz a troca de classe; sem o FLIP a troca é um salto
// seco. Respeita a preferência de efeitos e prefers-reduced-motion.
function _flipItensEsofago(mudarLayout) {
  var zona = document.getElementById('sortable-esofago');
  // _efeitosAtivos() já compõe a preferência local com prefers-reduced-motion.
  var semEfeitos = (typeof _efeitosAtivos === 'function') && !_efeitosAtivos();
  if (!zona || !zona.children.length || semEfeitos) {
    mudarLayout();
    return;
  }
  var itens = Array.prototype.slice.call(zona.children);
  // First: posições atuais (relativas à viewport).
  var first = itens.map(function (el) { return el.getBoundingClientRect(); });
  // Last: aplica o novo layout e mede de novo.
  mudarLayout();
  var movidos = [];
  itens.forEach(function (el, i) {
    var last = el.getBoundingClientRect();
    var dx = first[i].left - last.left;
    var dy = first[i].top - last.top;
    if (!dx && !dy) return;
    // Invert: devolve o item à posição antiga, sem transição.
    el.style.transition = 'none';
    el.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    movidos.push(el);
  });
  if (!movidos.length) return;
  // Commit do estado invertido antes de soltar (senão o browser não anima).
  void zona.offsetWidth;
  // Play: solta os transforms com transição → desliza ao destino.
  movidos.forEach(function (el) {
    el.style.transition = 'transform .32s cubic-bezier(.22,.61,.36,1)';
    el.style.transform = '';
  });
  // Limpa estilos inline ao fim p/ não interferir no hover/drag dos itens.
  clearTimeout(_timerFlipEsofago);
  _timerFlipEsofago = setTimeout(function () {
    movidos.forEach(function (el) { el.style.transition = ''; el.style.transform = ''; });
  }, 360);
}

function _setLayoutEsofagoGeral(on, delay) {
  var sec = document.getElementById('Esôfago');
  if (!sec) return;
  clearTimeout(_timerLayoutEsofagoGeral);
  if (!on) {
    if (sec.classList.contains('esofago-geral-em-linha')) {
      _flipItensEsofago(function () { sec.classList.remove('esofago-geral-em-linha'); });
    }
    return;
  }
  _timerLayoutEsofagoGeral = setTimeout(function () {
    var geral = document.getElementById('painel-esofago-esofagite');
    if (geral && !geral.classList.contains('is-collapsed') &&
        !sec.classList.contains('esofago-geral-em-linha')) {
      _flipItensEsofago(function () { sec.classList.add('esofago-geral-em-linha'); });
    }
  }, delay || 0);
}

// Colapsa um painel: volta a clipar (overflow:hidden) p/ a animação não vazar,
// adiciona is-collapsed (CSS anima grid-template-rows → 0fr) e atualiza o botão.
function _colapsarPainel(p) {
  if (!p || p.classList.contains('is-collapsed')) return;
  var inner = p.querySelector('.painel-colapsavel-inner');
  if (inner) inner.style.overflow = 'hidden';
  p.classList.add('is-collapsed');
  var btn = _btnDoPainel(p.id);
  if (btn) btn.setAttribute('aria-expanded', 'false');
}

// Expande um painel: remove is-collapsed (anima 0fr → 1fr) e, ao terminar, libera
// overflow:visible para os dropdowns (.ms-panel) escaparem da caixa.
function _expandirPainel(p) {
  if (!p) return;
  p.classList.remove('is-collapsed');
  var inner = p.querySelector('.painel-colapsavel-inner');
  if (inner) {
    var corpo = inner.parentNode;
    var liberar = function (e) {
      if (e.target !== corpo || e.propertyName !== 'grid-template-rows') return;
      inner.style.overflow = 'visible';
      corpo.removeEventListener('transitionend', liberar);
    };
    corpo.addEventListener('transitionend', liberar);
  }
  var btn = _btnDoPainel(p.id);
  if (btn) btn.setAttribute('aria-expanded', 'true');
}

// Alterna um painel. Accordion POR SEÇÃO: ao abrir, fecha os outros painéis
// colapsáveis do MESMO grupo (.painel-grupo) — apenas um aberto por vez dentro
// da seção. A altura é animada por CSS. Como cada seção tem seu grupo, Esofagite
// e Gastrite podem ficar abertos por padrão simultaneamente (seções distintas).
function togglePainel(id) {
  var p = document.getElementById(id);
  if (!p) return;
  // Só mexe no layout em linha do Esôfago se o painel alternado pertencer à
  // própria seção Esôfago — caso contrário, abrir um painel de outra seção
  // (ex.: Gastrite no Estômago) derrubaria o layout em linha indevidamente.
  var noEsofago = !!p.closest('#Esôfago');
  if (noEsofago && id !== 'painel-esofago-esofagite') _setLayoutEsofagoGeral(false);
  if (p.classList.contains('is-collapsed')) {
    var grupo = p.closest('.painel-grupo') || document;
    Array.prototype.forEach.call(
      grupo.querySelectorAll('.painel-colapsavel:not(.is-collapsed)'),
      function (outro) { if (outro !== p) _colapsarPainel(outro); }
    );
    _expandirPainel(p);
    // delay 0: o reposicionamento (FLIP) dos itens arranca junto com a abertura
    // do painel, em vez de esperar a expansão terminar.
    if (id === 'painel-esofago-esofagite') _setLayoutEsofagoGeral(true, 0);
  } else {
    _colapsarPainel(p);
    if (id === 'painel-esofago-esofagite') _setLayoutEsofagoGeral(false);
  }
}

function addGastriteParagrafo() {
  var texto = _comporParagrafoGastrite();
  if (!texto) return;

  // Conclusão composta ANTES dos achados — substituições agem em parágrafo
  // E conclusão; adições entram antes de "Piloro centrado e pérvio." (frase
  // sempre presente no parágrafo da Gastrite). Idêntico à Atrofia.
  var concl = _comporConclusaoGastrite(
    getSelectedLabel('gastr-corpo-estado'), getVal('gastr-corpo-det'),
    getSelectedLabel('gastr-antro-estado'), getVal('gastr-antro-det')
  );

  // Achado fixo (multi-seleção). Aplicado sobre o texto COM TOKENS — find/extra
  // podem mirar placeholders (ex.: {intensidade-sing-corpo}).
  var achados = _coletarAchados('gastr-modif');
  var r = _aplicarAchadosAtrofia(texto, concl || '', achados);

  // Resolução única no fim, cobrindo tokens vindos também do extra do achado.
  var par = _resolverPlaceholdersGastrite(r.par, getVal('gastr-corpo-det'), getVal('gastr-antro-det'));

  appendToSortable('sortable-estomago', createCheckboxDiv(par, 'estomago'));
  if (r.con) appendAfterLastChecked('sortable-conclusao', createCheckboxDiv(r.con, 'conclusao'), 'estomago');
  _sincronizarSecoesPorAchado('gastr-modif');
}

// ----------------------------------------------------------
// PAINEL ATROFIA
// ----------------------------------------------------------

function _comporMucosaAtrofia(cE, cD, kt) {
  var temGastriteAtiva = (cE === 'enantema' && cD);
  var iP = temGastriteAtiva ? (_INT_PLU[cD] || cD) : '';
  var TEXTOS = {
    'C-1': [
      'A mucosa está relativamente preservada em fundo e corpo. Na incisura angular e antro, a mucosa é discretamente pálida com relevo reduzido (Kimura-Takemoto C-1), aspecto possivelmente correlacionado com quadro de infecção prévia por H. pylori (pós-tratamento).',
      'A mucosa apresenta enantema e edema ' + iP + ' e difusos no corpo. Na incisura angular e antro, o enantema é entremeado por áreas de palidez com relevo reduzido.'
    ],
    'C-2': [
      'A mucosa apresenta aspecto relativamente preservado na maior parte do corpo com área pálida e relevo reduzido na pequena curvatura do corpo distal, incisura angular e todo o antro.',
      'A mucosa apresenta enantema e edema ' + iP + ' e difusos, notando-se enantema entremeado por áreas de palidez e relevo reduzido na pequena curvatura do corpo distal, incisura angular e antro.'
    ],
    'C-3': [
      'A mucosa apresenta aspecto relativamente preservado na maior parte do corpo com área pálida e relevo reduzido na pequena curvatura do corpo, incisura angular e todo o antro.',
      'A mucosa apresenta enantema e edema ' + iP + ' e difusos na maior parte do corpo com área pálida e relevo reduzido na pequena curvatura do corpo, incisura angular e todo o antro.'
    ],
    'O-1': ['A mucosa apresenta-se pálida com relevo reduzido em parte do corpo.'],
    'O-2': ['A mucosa apresenta-se pálida com relevo reduzido e vasos submucosos evidentes na maior parte do corpo, incisura angular e todo o antro.'],
    'O-3': ['A mucosa apresenta-se pálida com relevo reduzido e vasos submucosos evidentes em todos os segmentos.']
  };
  var entry = TEXTOS[kt];
  return entry ? entry[temGastriteAtiva ? 1 : 0] || entry[0] : '';
}

function _comporParagrafoAtrofia(ktTexto) {
  var kt = getVal('atr-kt');
  return _montarPorEstrutura(_estruturaPainel('estomagoPainel', 'estruturaAtrofia'), function (tk) {
    switch (tk) {
      case 'liquido':   return _fraseLiquido(getVal('atr-liquido-tipo'), getVal('atr-liquido-vol'));
      case 'pregueado': return 'Pregueado mucoso ' + _pregueadoPorKT(kt) + '.';
      case 'mucosa':    return ktTexto || _comporMucosaAtrofia(
                          getVal('atr-corpo-estado'), getVal('atr-corpo-det'), kt);
      default:          return '';
    }
  });
}

function _conclusaoLabelAtrofia(cE, cD, kt) {
  var temGastriteAtiva = (cE === 'enantema' && cD);
  var suf = temGastriteAtiva ? ' com gastrite ativa' : '';
  // Label da conclusão = label do item de KT (data-driven). Qualquer item
  // novo no dropdown Atrofia casa automaticamente com um template de
  // conclusão de MESMO label. Mantém C-1..O-3 idêntico (eram identidade).
  return kt ? (kt + suf) : '';
}

function _comporConclusaoAtrofia(cE, cD, kt) {
  var label = _conclusaoLabelAtrofia(cE, cD, kt);
  if (!label) return '';
  var templates = (_DB && _DB.estomagoPainel && _DB.estomagoPainel.templatesConclusaoAtrofia) || [];
  var tpl = templates.find(function (t) { return t && t.label === label; });
  if (!tpl) return '';
  return tpl.valor || '';
}

var _ANCORA_ATROFIA = 'Piloro centrado e pérvio.';

// Snapshot do item: tipo, frase (só adição) e até 4 pares de substituição.
// substituição → par 1 = valor/extra; pares 2-4 = valorN/extraN.
// adição → frase = extra (par 1 é a frase, não substituição); pares 2-4 valem.
function _snapshotAchado(opt) {
  var tipo = opt.dataset.tipo || 'substituicao';
  var subs = [];
  function addPar(f, r) { if (f) subs.push({ find: f, repl: r || '' }); }
  if (tipo !== 'adicao') addPar(opt.value || '', opt.dataset.extra || '');
  addPar(opt.dataset.valor2 || '', opt.dataset.extra2 || '');
  addPar(opt.dataset.valor3 || '', opt.dataset.extra3 || '');
  addPar(opt.dataset.valor4 || '', opt.dataset.extra4 || '');
  return {
    tipo: tipo,
    label: opt.textContent || '',
    frase: tipo === 'adicao' ? (opt.dataset.extra || '') : '',
    conclusao: opt.dataset.conclusao || '',
    subs: subs
  };
}

function _achadoValido(opt) {
  if (!opt) return false;
  if ((opt.textContent || '').trim().toLowerCase() === 'varizes') return true;
  var t = opt.dataset.tipo || 'substituicao';
  if (t === 'adicao') return (opt.dataset.extra || '').trim() !== '';
  return (opt.value || '') !== '' || (opt.dataset.valor2 || '') !== '';
}

// Substituições (de todos os itens) agem em PARÁGRAFO e CONCLUSÃO; adições no
// parágrafo (antes da âncora). Retorna { par, con }.
function _aplicarAchadosAtrofia(par, con, achados) {
  function subst(txt, find, repl) {
    return find ? txt.replace(new RegExp(escapeRegExp(find), 'g'), repl) : txt;
  }
  achados.forEach(function (a) {
    // Pares em ordem de prioridade: aplica APENAS o primeiro cujo "find" é
    // encontrado no parágrafo ou na conclusão; os pares seguintes do mesmo
    // item são ignorados (a primeira correspondência vence e interrompe).
    for (var i = 0; i < a.subs.length; i++) {
      var p = a.subs[i];
      if (!p.find) continue;
      if (par.indexOf(p.find) >= 0 || con.indexOf(p.find) >= 0) {
        par = subst(par, p.find, p.repl);
        con = subst(con, p.find, p.repl);
        break;
      }
    }
  });
  achados.filter(function (a) { return a.tipo === 'adicao'; }).forEach(function (a) {
    var frase = (a.frase || '').trim();
    if (!frase) return;
    if (par.indexOf(_ANCORA_ATROFIA) >= 0) {
      par = par.replace(_ANCORA_ATROFIA, frase + ' ' + _ANCORA_ATROFIA);
    } else {
      par = par.trim();
      if (par && !/[.!?]$/.test(par)) par += '.';
      par += ' ' + frase;
    }
  });
  return { par: par, con: con };
}

// ---- Dropdown custom (visual recolhido) com multi-seleção para o Achado ----
// Mantém o <select multiple> oculto como fonte de dados; a UI só liga/desliga
// option.selected. Reconstruída sempre que o select é populado. Genérico:
// usado pela Atrofia (atr-modif) e pela Gastrite (gastr-modif).
var _msFechaInstalado = false;

function _renderModifMS(selId, uiId) {
  var sel = document.getElementById(selId);
  var box = document.getElementById(uiId);
  if (!sel || !box) return;
  box.innerHTML = '';

  var control = document.createElement('div');
  control.className = 'ms-control';
  control.tabIndex = 0;
  var lbl = document.createElement('span');
  lbl.className = 'ms-label';
  var car = document.createElement('span');
  car.className = 'ms-caret';
  car.textContent = '▾';
  control.appendChild(lbl);
  control.appendChild(car);

  var panel = document.createElement('div');
  panel.className = 'ms-panel';
  panel.style.display = 'none';

  function atualizarResumo() {
    var marc = Array.prototype.filter.call(sel.options, function (o) {
      return o.selected && _achadoValido(o);
    });
    lbl.textContent = marc.length
      ? marc.map(function (o) { return o.textContent; }).join(', ')
      : '—';
  }

  // ⚠ NÃO usar <input type="checkbox"> aqui: o gerador do laudo coleta
  // input[type=checkbox]:checked dentro de #Estômago e injetaria "on".
  // Estado real fica no <select> oculto (o.selected); marcador é só visual.
  Array.prototype.forEach.call(sel.options, function (o) {
    if (!_achadoValido(o)) return;          // pula "—" / inválidos
    var rowEl = document.createElement('div');
    rowEl.className = 'ms-opt' + (o.selected ? ' is-on' : '');
    var bx = document.createElement('span');
    bx.className = 'ms-box';
    bx.textContent = o.selected ? '☑' : '☐';
    var tx = document.createElement('span');
    tx.textContent = o.textContent;
    rowEl.appendChild(bx);
    rowEl.appendChild(tx);
    rowEl.onclick = function () {
      o.selected = !o.selected;
      rowEl.classList.toggle('is-on', o.selected);
      bx.textContent = o.selected ? '☑' : '☐';
      atualizarResumo();
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    };
    panel.appendChild(rowEl);
  });

  control.onclick = function (e) {
    e.stopPropagation();
    panel.style.display = (panel.style.display === 'none') ? 'block' : 'none';
  };

  box.appendChild(control);
  box.appendChild(panel);
  atualizarResumo();

  if (!_msFechaInstalado) {
    _msFechaInstalado = true;
    document.addEventListener('click', function (ev) {
      Array.prototype.forEach.call(document.querySelectorAll('.ms-wrap'), function (b) {
        var p = b.querySelector('.ms-panel');
        if (p && !b.contains(ev.target)) p.style.display = 'none';
      });
    });
  }
}

function addAtrofiaParagrafo() {
  var ktSelect = document.getElementById('atr-kt');
  if (!ktSelect || !ktSelect.value) {
    mostrarToast('⚠ Selecione um valor de KT primeiro.', '#7a4000', 3500);
    return;
  }

  var ktOptions = (_DB && _DB.estomagoPainel && _DB.estomagoPainel.atrofiaKT) || [];
  var ktOption = ktOptions.find(function (opt) { return opt.valor === ktSelect.value; });
  if (!ktOption) {
    mostrarToast('⚠ Opção KT não encontrada.', '#7a4000', 3500);
    return;
  }

  var texto = _comporParagrafoAtrofia(ktOption.valor);
  var concl = _comporConclusaoAtrofia('', '', ktOption.label);

  // Achados = todos os itens marcados no dropdown multi-seleção (sem botão)
  var achados = _coletarAchados('atr-modif');

  var r = _aplicarAchadosAtrofia(texto, concl, achados);

  appendToSortable('sortable-estomago', createCheckboxDiv(r.par, 'estomago'));
  if (r.con) appendAfterLastChecked('sortable-conclusao', createCheckboxDiv(r.con, 'conclusao'), 'estomago');
  _sincronizarSecoesPorAchado('atr-modif');
}

// ----------------------------------------------------------
// PAINEL LESÃO GÁSTRICA (Estômago)
// ----------------------------------------------------------
// Constrói um parágrafo estruturado de lesão gástrica e, quando há biópsia,
// cria também um item marcado na seção Anatomo ("Biópsias de <lesão> <segmento>")
// que alimenta o Pedido de AP. Data-driven em _DB.estomagoPainel.lesoes*.
// ⚠ Só <select>/<input number> — nada de <input type=checkbox>: o gerador do
// laudo coleta input[type=checkbox]:checked dentro de #Estômago.

function _inicializarLesaoGastrica() {
  var p = _DB && _DB.estomagoPainel;
  if (!p) return;
  popularSelect('lesao-gastr-parede',       p.lesoesParede || []);
  popularSelect('lesao-gastr-segmento',     p.lesoesSegmento || []);
  popularSelect('lesao-gastr-tipo',         p.lesoesTipo || []);
  popularSelect('lesao-gastr-magnificacao', p.lesoesMagnificacao || []);
  popularSelect('lesao-gastr-dl',           p.lesoesDL || []);
  popularSelect('lesao-gastr-mv',           p.lesoesMV || []);
  popularSelect('lesao-gastr-ms',           p.lesoesMS || []);
  popularSelect('lesao-gastr-biopsia',      p.lesoesBiopsia || []);
  popularSelect('lesao-gastr-hemostasia',   p.lesoesHemostasia || []);
  var tam = document.getElementById('lesao-gastr-tamanho');
  if (tam) {
    tam.value = '';
    // Mesmo visual/comportamento do HHD (esof-hhd): text+decimal, botões
    // ▲/▼, vírgula como separador. Passo 1 (tamanho em mm).
    if (typeof _barrettStepInput === 'function') _barrettStepInput(tam, 1);
  }
  _lesaoGastrToggleMagnif();
}

// Magnificação=Não ⇒ DL e MV/MS não entram no parágrafo (são achados de
// magnificação + cromoscopia). Desabilita/esmaece os controles dependentes
// para deixar a regra visível; a composição do texto também os ignora.
function _lesaoGastrToggleMagnif() {
  var on = getVal('lesao-gastr-magnificacao') !== '';
  Array.prototype.forEach.call(
    document.querySelectorAll('.lesao-gastr-magnif-dep'),
    function (el) {
      if (el.tagName === 'SELECT' || el.tagName === 'BUTTON') el.disabled = !on;
      el.style.opacity = on ? '' : '0.4';
    }
  );
}

// Normaliza: espaços duplos, espaço antes de pontuação, pontos duplos e
// capitaliza a 1ª letra (a parede/segmento vêm em minúsculas).
function _normalizarLesaoGastrica(t) {
  return t
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,;])/g, '$1')
    .replace(/\.{2,}/g, '.')
    .trim()
    .replace(/^./, function (c) { return c.toUpperCase(); });
}

// Substitui placeholders disponíveis nos campos Conclusão/Anatomo das opções
// de Procedimento (campo lesoesBiopsia): {lesao} e {segmento}.
function _subPlaceholdersLesao(tpl, lesao, segmento) {
  return (tpl || '')
    .replace(/\{lesao\}/g, lesao || '')
    .replace(/\{segmento\}/g, segmento || '');
}

function addLesaoGastricaParagrafo() {
  var lesaoValor = getVal('lesao-gastr-tipo');                // valor (ex.: "lesão deprimida")
  var tamanho    = parseInt(getVal('lesao-gastr-tamanho'), 10);
  if (!lesaoValor)    { mostrarToast('⚠ Selecione o tipo de lesão.', '#7a4000', 3500); return; }
  if (!(tamanho > 0)) { mostrarToast('⚠ Informe o tamanho da lesão (mm).', '#7a4000', 3500); return; }

  var parede   = getVal('lesao-gastr-parede');                // "" quando "-"
  var segmento = getVal('lesao-gastr-segmento');
  var magnif   = getVal('lesao-gastr-magnificacao');          // "" quando "Não"
  var dl       = magnif ? getVal('lesao-gastr-dl') : '';
  var mv       = magnif ? getVal('lesao-gastr-mv') : '';
  var ms       = magnif ? getVal('lesao-gastr-ms') : '';
  var biopsiaSel = document.getElementById('lesao-gastr-biopsia');
  var biopsiaOpt = biopsiaSel ? biopsiaSel.options[biopsiaSel.selectedIndex] : null;
  var biopsia    = biopsiaSel ? biopsiaSel.value : '';        // texto p/ o laudo (Estômago)
  var dsProc     = (biopsiaOpt && biopsiaOpt.dataset) ? biopsiaOpt.dataset : {};
  // Conclusão/Anatomo por opção (data-driven puro, sem fallback legado):
  // usa SOMENTE os valores configurados na opção de Procedimento.
  //  - Conclusão vazia → não acrescenta nada à conclusão da lesão
  //  - Anatomo vazio   → não cria item no Anatomo
  var procConcl   = dsProc.conclusao || '';
  var procAnatomo = dsProc.anatomo   || '';

  // Hemostasia (igual ao painel de lesões do Colono): valor → parágrafo,
  // extra → conclusão. Ambos trazem a própria pontuação/conectivo.
  var hemoSel   = document.getElementById('lesao-gastr-hemostasia');
  var hemoOpt   = hemoSel ? hemoSel.options[hemoSel.selectedIndex] : null;
  var hemostasia      = hemoSel ? hemoSel.value : '';
  var hemostasiaExtra = (hemoOpt && hemoOpt.dataset && hemoOpt.dataset.extra) ? hemoOpt.dataset.extra : '';

  // Frase 1: Na (parede) (segmento), observa-se (lesão) medindo cerca de (d)mm.
  var prefix = 'Na ' + [parede, segmento].filter(Boolean).join(' ');
  if (!parede) prefix = prefix.replace(/^Na do /, 'No ').replace(/^Na da /, 'Na ');
  var f1 = prefix + ', observa-se ' + lesaoValor + ' medindo cerca de ' + tamanho + 'mm.';

  // Frase 2: só com magnificação E ao menos um achado (DL/MV/MS).
  var f2 = '';
  if (magnif) {
    var achados = [dl, mv, ms].filter(Boolean).join(' ');
    if (achados) f2 = magnif + ' ' + achados + '.';
  }

  var parBase = [f1, f2, biopsia].filter(Boolean).join(' ');
  // Hemostasia anexada ao fim da última frase (o valor já traz "," ou ". ").
  if (hemostasia) parBase = parBase.replace(/\.\s*$/, '') + hemostasia + '.';
  var par = _normalizarLesaoGastrica(parBase);
  appendToSortable('sortable-estomago', createCheckboxDiv(par, 'estomago'));

  // Conclusão (zona compartilhada, seção 'estomago' = ordem da hierarquia):
  // - (Lesão, 1ª maiúscula) (Segmento). (texto de Conclusão da opção de Procedimento)
  var lesaoCap = lesaoValor.replace(/^./, function (c) { return c.toUpperCase(); });
  var con = '- ' + [lesaoCap, segmento].filter(Boolean).join(' ') + '.';
  var conSuf = _subPlaceholdersLesao(procConcl, lesaoValor, segmento).trim();
  if (conSuf) con += ' ' + conSuf;
  // Hemostasia: anexa o "extra" ao fim da conclusão, antes do ponto final.
  if (hemostasiaExtra) con = con.replace(/\.\s*$/, '') + hemostasiaExtra + '.';
  appendAfterLastChecked('sortable-conclusao', createCheckboxDiv(con, 'conclusao'), 'estomago');

  // Item de Anatomo (já marcado) — uma linha = um frasco no Pedido de AP.
  // Estrutura: (procedimento) de (lesão) (segmento). O campo "anatomo" da opção
  // guarda só o nome do procedimento (ex.: "Biópsias"); vazio = não cria item.
  var anatomoNome = (procAnatomo || '').trim();
  if (anatomoNome) {
    var anatomo = _normalizarLesaoGastrica(
      anatomoNome + ' de ' + [lesaoValor, segmento].filter(Boolean).join(' ')
    );
    appendToSortable('sortable-anatomo', createCheckboxDiv(anatomo, 'anatomo'));
  }
}

// ----------------------------------------------------------
// PAINEL ESOFAGITE (Esôfago)
// ----------------------------------------------------------
// Item único (LAA/LAB/.../Varizes) → parágrafo, igual ao padrão data-driven
// da Atrofia. Os modificadores reutilizam EXATAMENTE o mecanismo da Gastrite
// (substituição/adição via _aplicarAchadosAtrofia). A conclusão vem do campo
// "conclusao" do item selecionado no dropdown.
function _aplicarHhdEsofagite(texto, hhd) {
  if (!hhd) return texto;
  var deslocQue = 'que está deslocada cerca de ' + hhd + 'cm acima do pinçamento diafragmático';
  var deslocFrase = 'A transição esofagogástrica está deslocada cerca de ' + hhd + 'cm acima do pinçamento diafragmático';
  return texto
    .replace(/que coincide com o pinçamento diafragmático/g, deslocQue)
    .replace(/que está deslocada(?: cerca de)? [\d,.]+cm acima do pinçamento diafragmático/g, deslocQue)
    .replace(/A transição esofagogástrica coincide com o pinçamento diafragmático/g, deslocFrase)
    .replace(/A transição esofagogástrica está deslocada(?: cerca de)? [\d,.]+cm acima do pinçamento diafragmático/g, deslocFrase);
}

function _esofVarizesSelecionado() {
  var sel = document.getElementById('esof-modif');
  if (!sel) return false;
  return Array.prototype.some.call(sel.options, function (o) {
    return o.selected && (o.textContent || '').trim().toLowerCase() === 'varizes';
  });
}

function _esofVarizesToggle() {
  var wrap = document.getElementById('esof-varizes-wrap');
  if (wrap) {
    wrap.style.display = '';
    wrap.classList.toggle('is-collapsed', !_esofVarizesSelecionado());
  }
  _esofVarizesToggleBandas();
}

function _esofVarizesToggleBandas() {
  var lig = getVal('esof-variz-ligadura');
  var bw = document.getElementById('esof-variz-bandas-wrap');
  if (bw) bw.style.display = (lig === 'sim') ? '' : 'none';
}

function _inicializarVarizesEsofago() {
  var v = _DB && _DB.esofagoPainel && _DB.esofagoPainel.varizes;
  if (!v) return;
  popularSelect('esof-variz-numero',      v.numero || []);
  popularSelect('esof-variz-localizacao', v.localizacao || []);
  popularSelect('esof-variz-morfologia',  v.morfologia || []);
  popularSelect('esof-variz-calibre',     v.calibre || []);
  popularSelect('esof-variz-coloracao',   v.coloracao || []);
  popularSelect('esof-variz-sinais',      v.sinaisCorVermelha || []);
  popularSelect('esof-variz-retracoes',   v.retracoes || []);
  popularSelect('esof-variz-ligadura',    v.ligadura || []);
  popularSelect('esof-variz-bandas',      v.bandas || []);
  var modif = document.getElementById('esof-modif');
  if (modif && !modif.dataset.varizesToggleOn) {
    modif.dataset.varizesToggleOn = '1';
    modif.addEventListener('change', _esofVarizesToggle);
  }
  _esofVarizesToggle();
}

function _flexVarizesEsofago(palavra, numero) {
  if (numero === 1) return palavra;
  if (palavra === 'retilíneo') return 'retilíneos';
  return palavra + 's';
}

// Numeral por extenso (1–20). genero 'f' flexiona um→uma, dois→duas.
// Fora da faixa, devolve o próprio numeral como string.
function _numeroExtenso(n, genero) {
  n = parseInt(n, 10) || 0;
  var ext = ['zero', 'um', 'dois', 'três', 'quatro', 'cinco', 'seis', 'sete',
             'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'catorze', 'quinze',
             'dezesseis', 'dezessete', 'dezoito', 'dezenove', 'vinte'];
  if (n < 0 || n >= ext.length) return String(n);
  var p = ext[n];
  if (genero === 'f') {
    if (n === 1) p = 'uma';
    else if (n === 2) p = 'duas';
  }
  return p;
}

// Conclusão das varizes, condicionada aos parâmetros selecionados.
function _comporConclusaoVarizesEsofago() {
  if (!_esofVarizesSelecionado()) return '- Varizes esofágicas.';
  var sinais = getVal('esof-variz-sinais') || 'sem sinais de cor vermelha';
  var temCor = !/^\s*sem\b/i.test(sinais);
  var con = '- Varizes esofágicas ' +
            (temCor ? 'com' : 'sem') + ' sinais de cor vermelha.';
  if (getVal('esof-variz-ligadura') === 'sim') {
    con += ' Realizada ligadura elástica; propõe-se reavaliação endoscópica ' +
           'em 6 semanas; oriento repouso e dieta líquida por 3 dias com ' +
           'progressão gradual após.';
  }
  return con;
}

// Template (esqueleto) editável da frase de varizes; fallback ao DB_PADRAO.
function _estruturaVarizes() {
  var v = _DB && _DB.esofagoPainel && _DB.esofagoPainel.varizes;
  if (v && typeof v.estrutura === 'string' && v.estrutura) return v.estrutura;
  var pad = _dbPadraoSeguro().esofagoPainel;
  return (pad && pad.varizes && pad.varizes.estrutura) || '';
}

function _comporFraseVarizesEsofago() {
  if (!_esofVarizesSelecionado()) return '';
  var numero = parseInt(getVal('esof-variz-numero'), 10) || 0;
  var map = {
    nucleo: numero === 1 ? 'um cordão varicoso' :
            numero > 1  ? _numeroExtenso(numero, 'm') + ' cordões varicosos' :
                          'cordões varicosos',
    trajeto:     _flexVarizesEsofago(getVal('esof-variz-morfologia') || 'tortuoso', numero),
    calibre:     getVal('esof-variz-calibre')     || 'médio calibre',
    coloracao:   getVal('esof-variz-coloracao')   || 'coloração arroxeada',
    sinais:      getVal('esof-variz-sinais')      || 'sem sinais de cor vermelha',
    localizacao: getVal('esof-variz-localizacao') || 'terço distal',
    retracoes:   getVal('esof-variz-retracoes') === 'sim'
                   ? ', notando-se retrações cicatriciais compatíveis com tratamento endoscópico prévio' : '',
    ligadura:    ''
  };
  if (getVal('esof-variz-ligadura') === 'sim') {
    var bandas = parseInt(getVal('esof-variz-bandas'), 10) || 1;
    var bandaTxt = (bandas === 1) ? 'banda elástica' : 'bandas elásticas';
    map.ligadura = ' Realizada ligadura elástica com ' + _numeroExtenso(bandas, 'f') +
                   ' ' + bandaTxt + ' sem intercorrências.';
  }
  var frase = _estruturaVarizes().replace(/\{(\w+)\}/g, function (m, k) {
    return (k in map) ? map[k] : m;
  });
  return frase.replace(/\s{2,}/g, ' ').trim();
}

function addEsofagiteParagrafo() {
  var sel = document.getElementById('esof-item');
  if (!sel || !sel.value) {
    mostrarToast('⚠ Selecione um item de Esofagite primeiro.', '#7a4000', 3500);
    return;
  }
  var texto = getVal('esof-item');           // value do <option> = parágrafo
  if (!texto) return;
  var opt = sel.options[sel.selectedIndex];
  var conclusao = opt && opt.dataset ? (opt.dataset.conclusao || '') : '';
  var hhd = _barrettFormatDecimal(getVal('esof-hhd'));
  var hhdNum = _barrettParseDecimal(hhd);

  var achados = _coletarAchados('esof-modif');
  var r = _aplicarAchadosAtrofia(texto, '', achados);
  r.par = _aplicarHhdEsofagite(r.par, hhdNum > 0 ? hhd : '');
  var fraseVarizes = _comporFraseVarizesEsofago();
  if (fraseVarizes) {
    if (r.par && !/[.!?]$/.test(r.par)) r.par += '.';
    r.par += ' ' + fraseVarizes;
  }

  var nomeEsof = (hhdNum > 0) ? 'esofagoHHD' : 'esofago';
  appendToSortable('sortable-esofago', createCheckboxDiv(r.par, nomeEsof));
  if (conclusao) appendAfterLastChecked('sortable-conclusao', createCheckboxDiv(conclusao, 'conclusao'), 'esofago');
  // Cada modificador (Achado) selecionado também pode ter sua própria
  // conclusão — vira um item dinâmico marcado, igual ao do item de Esofagite.
  achados.forEach(function (a) {
    if (!a || !a.conclusao) return;
    var con = ((a.label || '').trim().toLowerCase() === 'varizes')
      ? _comporConclusaoVarizesEsofago()
      : a.conclusao;
    appendAfterLastChecked('sortable-conclusao', createCheckboxDiv(con, 'conclusao'), 'esofago');
  });
  if (hhdNum >= 2) appendAfterLastChecked('sortable-conclusao', createCheckboxDiv('- Hérnia hiatal por deslizamento.', 'conclusao'), 'esofago');
}

// ----------------------------------------------------------
// CRIADOR DE BARRETT (painel inline · Esôfago)
// ----------------------------------------------------------
// Mesma forma inline de Esofagite/Gastrite: steppers numéricos, multi-seleção
// ms-wrap (avaliação complementar / biópsias), parede(s) progressivas e
// conclusão por precedência. Data-driven em _DB.esofagoPainel.* — listas
// editáveis pelo botão de edição de listas (editarOptions).

function _barrettDB() {
  return (_DB && _DB.esofagoPainel && _DB.esofagoPainel.barrett) || null;
}

// Junta lista por extenso: "a", "a e b", "a, b e c".
function _barrettLista(arr) {
  arr = (arr || []).filter(Boolean);
  if (arr.length <= 1) return arr.join('');
  return arr.slice(0, -1).join(', ') + ' e ' + arr[arr.length - 1];
}

// Opções marcadas de um <select multiple> oculto do ms-wrap (ignora vazio).
function _barrettColetarMS(selId) {
  var out = [];
  var sel = document.getElementById(selId);
  if (sel) Array.prototype.forEach.call(sel.options, function (o) {
    if (o.selected && (o.value || '') !== '') out.push({ valor: o.value, label: o.textContent || '' });
  });
  return out;
}

function _barrettParseDecimal(valor) {
  return parseFloat(String(valor || '').replace(',', '.')) || 0;
}

function _barrettFormatDecimal(valor) {
  return String(valor || '').trim().replace('.', ',');
}

// <input type=number> sempre usa "." (o separador exibido depende do locale
// do navegador, não do lang). Para garantir vírgula, trocamos por type=text
// com botões de passo (−/+) próprios. IDs/values seguem compatíveis com
// _barrettParseDecimal/_barrettFormatDecimal (que já tratam vírgula).
function _barrettStepInput(input, passo) {
  if (!input) return;
  passo = passo || 0.5;
  input.type = 'text';
  input.inputMode = 'decimal';
  input.setAttribute('autocomplete', 'off');
  if (input.dataset.stepperOn) return;   // idempotente: não duplica botões
  input.dataset.stepperOn = '1';

  function minNum() {
    var m = parseFloat(input.dataset.min);
    return isNaN(m) ? 0 : m;
  }
  function fmt(n) {
    return (Math.round(n * 100) / 100).toString().replace('.', ',');
  }
  function bump(dir) {
    var vazio = input.value.trim() === '';
    if (vazio && dir < 0) return;        // − em campo vazio não faz nada
    var v = vazio ? minNum() : _barrettParseDecimal(input.value);
    v = Math.round((v + dir * passo) * 100) / 100;
    if (v < minNum()) v = minNum();
    input.value = fmt(v);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  var inc = document.createElement('button');
  inc.type = 'button'; inc.className = 'barrett-step barrett-step-up';
  inc.tabIndex = -1; inc.textContent = '▲';
  inc.onclick = function () { bump(1); };
  var dec = document.createElement('button');
  dec.type = 'button'; dec.className = 'barrett-step barrett-step-down';
  dec.tabIndex = -1; dec.textContent = '▼';
  dec.onclick = function () { bump(-1); };
  var spin = document.createElement('span');
  spin.className = 'barrett-spin';
  spin.appendChild(inc);
  spin.appendChild(dec);
  input.parentNode.insertBefore(spin, input.nextSibling);

  // Saneia digitação manual: só dígitos e UMA vírgula.
  input.addEventListener('input', function () {
    var s = input.value.replace(/[^\d,]/g, '');
    var i = s.indexOf(',');
    if (i !== -1) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/,/g, '');
    if (s !== input.value) input.value = s;
  });
  // Setas ↑/↓ do teclado continuam funcionando como no type=number.
  input.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowUp')   { e.preventDefault(); bump(1); }
    if (e.key === 'ArrowDown') { e.preventDefault(); bump(-1); }
  });
}

// Pares (parede + dist. TEG) progressivos: ao escolher a parede do ÚLTIMO
// par, surge um novo par vazio. Container = #barrett-paredes-wrap.
function _barrettAddPar() {
  var wrap = document.getElementById('barrett-paredes-wrap');
  var ep = _DB && _DB.esofagoPainel;
  if (!wrap || !ep) return;
  var i = wrap.querySelectorAll('.barrett-par').length;
  var span = document.createElement('span');
  span.className = 'barrett-par';
  var sel = document.createElement('select');
  sel.id = 'barrett-parede-' + i;
  var w = document.createElement('input');
  w.type = 'text'; w.id = 'barrett-w-' + i; w.dataset.min = '0';
  w.style.width = '62px'; w.placeholder = 'cm';
  span.appendChild(document.createTextNode(' Parede '));
  span.appendChild(sel);
  span.appendChild(document.createTextNode(' TEG '));
  span.appendChild(w);
  _barrettStepInput(w, 0.5);
  wrap.appendChild(span);
  popularSelect('barrett-parede-' + i, ep.barrettParedes || []);
  sel.value = '';
  sel.onchange = function () {
    var pares = wrap.querySelectorAll('.barrett-par');
    if (sel.value !== '' && pares.length && pares[pares.length - 1] === span) _barrettAddPar();
  };
}

function _barrettRenderParedes() {
  var wrap = document.getElementById('barrett-paredes-wrap');
  if (!wrap) return;
  wrap.innerHTML = '';
  _barrettAddPar();   // primeiro par
}

function _barrettColetarParedes() {
  var wrap = document.getElementById('barrett-paredes-wrap');
  var out = [];
  if (!wrap) return out;
  Array.prototype.forEach.call(wrap.querySelectorAll('.barrett-par'), function (sp) {
    var sel = sp.querySelector('select');
    var w   = sp.querySelector('input');
    var parede = sel ? sel.value : '';
    if (parede !== '') out.push({ parede: parede, w: (w && w.value ? _barrettFormatDecimal(w.value) : '') });
  });
  return out;
}

function _barrettToggleInline() {
  var wrap = document.getElementById('barrett-paredes-wrap');
  if (wrap) wrap.style.display = (getVal('barrett-displasia') === 'sim') ? '' : 'none';
}

// Regra de Praga: não há área digitiforme menor que a circunferencial
// (C ≤ M). O mínimo do stepper Digit. acompanha o valor de Circunf.;
// se o valor atual de Digit. ficar abaixo, é limpo.
function _barrettSyncMin() {
  var ex = document.getElementById('barrett-x');
  var ey = document.getElementById('barrett-y');
  if (!ex || !ey) return;
  var xv = _barrettParseDecimal(ex.value);
  ey.dataset.min = xv;   // Praga: digitiforme nunca menor que circunferencial
  if (ey.value !== '') {
    var yv = _barrettParseDecimal(ey.value);
    if (yv < xv) ey.value = '';
  }
}

function _inicializarBarrettInline() {
  var ep = _DB && _DB.esofagoPainel;
  if (!ep) return;
  // Reset aos padrões a cada carga (o navegador restaura inputs no refresh).
  ['barrett-x', 'barrett-y', 'barrett-hhd'].forEach(function (id) {
    var e = document.getElementById(id);
    if (e) { e.value = ''; _barrettStepInput(e, 0.5); }
  });
  var d = document.getElementById('barrett-displasia'); if (d) d.value = 'nao';
  var inf = document.getElementById('barrett-inflamacao'); if (inf) inf.value = '';
  popularSelect('barrett-aval', ep.barrettAvaliacao || []);
  popularSelect('barrett-bio',  ep.barrettBiopsia || []);
  _barrettRenderParedes();
  _barrettSyncMin();
  _barrettToggleInline();
}

function addBarrettParagrafo() {
  var ep = _DB && _DB.esofagoPainel;
  var b  = ep && ep.barrett;
  if (!b) return;

  var x   = _barrettFormatDecimal(getVal('barrett-x'));
  var y   = _barrettFormatDecimal(getVal('barrett-y'));
  var hhd = _barrettFormatDecimal(getVal('barrett-hhd'));

  var xNum   = _barrettParseDecimal(x);
  var hhdNum = _barrettParseDecimal(hhd);
  var yNum   = _barrettParseDecimal(y);
  if (xNum <= 0 && yNum <= 0) {
    mostrarToast('⚠ Informe a medida da área (Circunf. e/ou Digit.).', '#7a4000', 3500); return;
  }

  // Avaliação complementar e biópsias são OPCIONAIS.
  var aval = _barrettColetarMS('barrett-aval');
  var bio  = _barrettColetarMS('barrett-bio');

  var displ = getVal('barrett-displasia') === 'sim';
  var areas = [];
  if (displ) {
    areas = _barrettColetarParedes();
    if (areas.length === 0) { mostrarToast('⚠ Informe ao menos uma parede com displasia.', '#7a4000', 3500); return; }
    for (var i = 0; i < areas.length; i++) {
      if (!areas[i].w) { mostrarToast('⚠ Informe a distância da TEG de cada parede.', '#7a4000', 3500); return; }
    }
  }

  // --- Parágrafo ---
  // 3 casos (regra de Praga C ≤ M): só circunferencial (x>0, sem digit.
  // maior) | circ.+digit. (y>x) | só digitiforme (x=0).
  var base;
  if (xNum > 0 && yNum > xNum) {
    base = (b.baseComCirc || '').replace(/\{x\}/g, x).replace(/\{y\}/g, y);
  } else if (xNum > 0) {
    base = (b.baseSoCirc || '').replace(/\{x\}/g, x);
  } else {
    base = (b.baseSemCirc || '').replace(/\{y\}/g, y);
  }
  var transicao = (hhdNum > 0)
    ? (b.transicaoComHHD || '').replace(/\{hhd\}/g, hhd)
    : (b.transicaoSemHHD || '');
  var displasiaTxt;
  if (displ) {
    var frags = areas.map(function (a) {
      return (b.displasiaAreaFrag || '')
        .replace(/\{parede\}/g, a.parede).replace(/\{w\}/g, a.w);
    });
    var modelo = (areas.length > 1) ? (b.displasiaSimPlur || '') : (b.displasiaSimSing || '');
    displasiaTxt = modelo.replace(/\{areas\}/g, _barrettLista(frags));
  } else {
    displasiaTxt = b.displasiaNao || '';
  }
  // Avaliação complementar é OPCIONAL. Com avaliação: "<prefixo lista>;
  // <displasia minúscula>". Sem avaliação: displasia com inicial maiúscula.
  var avalSeg;
  if (aval.length) {
    var avalClause = (b.avaliacaoPrefixo || '') +
      _barrettLista(aval.map(function (a) { return a.valor || a.label; }));
    avalSeg = avalClause + '; ' + displasiaTxt;
  } else {
    avalSeg = displasiaTxt
      ? (displasiaTxt.charAt(0).toUpperCase() + displasiaTxt.slice(1))
      : '';
  }
  var biopsiaTxt = bio.map(function (s) { return s.valor; }).filter(Boolean).join(' ');

  // Inflamação ativa na junção escamocolunar (opcional). O value do <select>
  // já contém a frase ou string vazia — .filter(Boolean) descarta vazio.
  var inflamacaoTxt = getVal('barrett-inflamacao');

  // base termina em "...a partir da transição esofagogástrica" e a transição
  // entra como oração relativa (", que coincide..."), sem espaço entre eles.
  var corpo = base + transicao;
  var par = [corpo, inflamacaoTxt, avalSeg, biopsiaTxt]
              .filter(Boolean).join(' ').replace(/\s{2,}/g, ' ').trim();

  // --- Conclusão (precedência: área suspeita > diagnóstico > seguimento) ---
  var labels = bio.map(function (s) { return (s.label || '').toLowerCase(); });
  var temDirec = labels.some(function (l) { return l.indexOf('direcionad') >= 0; });
  var temAleat = labels.some(function (l) { return l.indexOf('aleat') >= 0; });
  var tplKey = (displ || temDirec) ? 'displasia'
             : temAleat            ? 'diagnostico'
             :                       'seguimento';
  var tpls = ep.templatesConclusaoBarrett || [];
  var tpl  = tpls.find(function (t) { return t && t.label === tplKey; });
  // Praga: C = circunferencial (0 se ausente); M = maior extensão
  // (digitiforme se > circ.; senão a própria circ.; sem circ. → y).
  var mNum = (xNum > 0 && yNum > xNum) ? yNum : (xNum > 0 ? xNum : yNum);
  var mStr = (xNum > 0 && yNum > xNum) ? y   : (xNum > 0 ? x    : y);
  var cStr = xNum > 0 ? x : '0';
  var seg  = (mNum <= 3) ? (b.segCurto || 'curto') : (b.segLongo || 'longo');
  var con  = (tpl ? (tpl.valor || '') : '')
              .replace(/\{seg\}/g, seg)
              .replace(/\{x\}/g, cStr)
              .replace(/\{y\}/g, mStr);

  // Se inflamação ativa, adiciona alerta na conclusão sobre falso positivo.
  if (inflamacaoTxt && con) {
    con += ' Devido a presença de inflamação atual, há maior possibilidade de falso positivo para displasia em biópsia.';
  }

  // Nome com "HHD" quando há hérnia: o gerador (laudo_eda.js) lê cb.name para
  // sinalizar hérnia hiatal e ajustar a frase do estômago ("alargado em
  // relação"), como faz com o item estático HHD+Barrett.
  var nomeEsof = (hhdNum > 0) ? 'esofagoHHD' : 'esofago';
  appendToSortable('sortable-esofago', createCheckboxDiv(par, nomeEsof));
  if (con) appendAfterLastChecked('sortable-conclusao', createCheckboxDiv(con, 'conclusao'), 'esofago');
  if (hhdNum >= 2) appendAfterLastChecked('sortable-conclusao', createCheckboxDiv('- Hérnia hiatal por deslizamento.', 'conclusao'), 'esofago');
}

// ----------------------------------------------------------
// TPL_EDA — constantes de template para montagem do laudo
// ----------------------------------------------------------

const TPL_EDA = {
  TITULO:                   '<strong>ENDOSCOPIA DIGESTIVA ALTA</strong><br><br><br>',
  HIATO_AJUSTADO:           /Hiato diafragmático ajustado ao aparelho, quando visto em retroversão\./g,
  HIATO_FLEX:               /Hiato diafragmático (?:ajustado|alargado em relação) ao aparelho, quando visto em retroversão\./g,
  FUNDOP_TEXTO:             'À retroversão, nota-se fundoplicatura tópica e continente.',
  FUNDOP_MIG_TEXTO:         'À retroversão, nota-se alargamento do hiato e fundoplicatura com deslocamento cranial.',
  REDUZIDO_RE:              /reduzido/g,
  REDUZIDO_MI:              'reduzido, além de focos de provável metaplasia intestinal,',
  AJUSTADO_RE:              /ajustado/g,
  AJUSTADO_ALARGADO:        'alargado em relação',
  AREA_ATROFIA_RE:          /área de atrofia/g,
  AREA_ATROFIA_MI:          'área de atrofia com metaplasia intestinal',
  ATROFICA_RE:              /atrófica/g,
  ATROFICA_MI:              'atrófica com metaplasia intestinal'
};

// ----------------------------------------------------------
// VERIFICAÇÃO DE DEPENDÊNCIAS
// (uso `typeof X` sem `window.` porque let/const globais não viram propriedades de window)
// ----------------------------------------------------------
if (typeof getVal === 'undefined') {
  console.error('[painel_eda] ERRO: getVal nao encontrado — core_eda.js precisa ser carregado antes');
}
if (typeof _DB === 'undefined') {
  console.error('[painel_eda] ERRO: _DB nao encontrado — core_eda.js precisa ser carregado antes');
}
if (typeof _contadorDinamico === 'undefined') {
  console.warn('[painel_eda] AVISO: _contadorDinamico nao encontrado');
}
if (typeof appendToSortable === 'undefined') {
  console.error('[painel_eda] ERRO: appendToSortable nao encontrado — core_eda.js precisa ser carregado antes');
}
if (typeof createCheckboxDiv === 'undefined') {
  console.error('[painel_eda] ERRO: createCheckboxDiv nao encontrado — core_eda.js precisa ser carregado antes');
}
if (typeof escapeRegExp === 'undefined') {
  console.warn('[painel_eda] AVISO: escapeRegExp nao encontrado');
}
console.log('[painel_eda] Modulo carregado, dependencias OK');
