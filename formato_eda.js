// ============================================================
// formato_eda.js — Editor de Perfis de Formatação do Laudo
// Dependências: core_eda.js (confirmar, mostrarToast, _userFormatos),
//   storage_eda.js (salvarFormatos, definirPerfilAtivo, salvarPerfilFormato,
//   excluirPerfilFormato, _ehPerfilEmbutido, _formatosVazio),
//   laudo_eda.js (_perfilFormatoAtivo, _catalogoPerfis, _resetarBlocos),
//   historico_eda.js (_agendarLiveLaudo)
// ============================================================
//
// O editor é estruturado (não WYSIWYG): cada controle mapeia um campo do
// perfil ativo. Perfis EMBUTIDOS (ex.: Clássico) são somente leitura — o
// usuário duplica para editar. Edições em perfil de usuário aplicam-se ao vivo
// no #output (via _agendarLiveLaudo) e são persistidas com debounce.

// Fontes/tamanhos espelham a toolbar (#sel-fonte / #sel-tamanho).
var _FMT_FONTES = [
  { v: 'Arial',            t: 'Arial' },
  { v: 'Calibri',          t: 'Calibri' },
  { v: "'Courier New'",    t: 'Courier' },
  { v: 'Georgia',          t: 'Georgia' },
  { v: 'Segoe UI',         t: 'Segoe UI' },
  { v: 'Times New Roman',  t: 'Times New Roman' },
  { v: 'Verdana',          t: 'Verdana' }
];
var _FMT_TAMANHOS = ['8pt', '10pt', '11pt', '12pt', '14pt', '18pt'];
var _FMT_TAMANHOS_TITULO = ['11pt', '12pt', '14pt', '16pt', '18pt'];
var _FMT_ESPACOS = [
  { v: '<br>',         t: 'Compacto (sem linha em branco)' },
  { v: '<br><br>',     t: 'Normal (1 linha em branco)' },
  { v: '<br><br><br>', t: 'Amplo (2 linhas em branco)' }
];

var _salvarFormatosTimer = null;
function _agendarSalvarFormatos() {
  clearTimeout(_salvarFormatosTimer);
  _salvarFormatosTimer = setTimeout(function () {
    _salvarFormatosTimer = null;
    if (typeof salvarFormatos === 'function') salvarFormatos();
  }, 800);
}

// Snapshot do estado no momento em que o popup foi aberto — usado por Cancelar
// para reverter (formatos + seções custom em _DB).
var _formatoSnapshot = null;

function _novoIdPerfil() {
  return 'u' + Date.now().toString(36) + Math.floor(Math.random() * 1000).toString(36);
}

// Mapa de espaçamento UNIFORME entre todas as seções (modelo dos perfis de
// usuário — o editor expõe um único controle "Espaçamento entre blocos").
// Fonte única usada tanto na criação do perfil quanto na leitura do editor.
function _sepSecaoUniforme(espaco) {
  return {
    equipamento: espaco, sedacao: espaco, esofago: espaco, estomago: espaco,
    duodeno: espaco, jejuno: espaco, outros: espaco, conclusao: espaco,
    custom1: espaco, custom2: espaco, custom3: espaco, custom4: espaco
  };
}

// Perfil de usuário a partir de um base (ex.: o ativo) — usado em duplicar/novo.
function _perfilUsuarioDe(base, nome) {
  var c = (typeof _clone === 'function') ? _clone(base) : JSON.parse(JSON.stringify(base));
  c.id = _novoIdPerfil();
  c.nome = nome;
  // Normaliza o espaçamento já na criação: perfis de usuário são uniformes, e o
  // editor mostra o valor de 'estomago'. Sem isto, herdar um embutido com
  // sepSecao não-uniforme (ex.: Clássico, equipamento 3x / conclusao 1x) faria
  // o 1º edit de qualquer campo achatar silenciosamente o espaçamento.
  c.sepSecao = _sepSecaoUniforme((base.sepSecao && base.sepSecao.estomago) || '<br><br>');
  return c;
}

// ----------------------------------------------------------
// ABERTURA / RENDER
// ----------------------------------------------------------

function abrirEditorFormato() {
  if (typeof _visitanteBloqueado === 'function' && _visitanteBloqueado('edição de formato não permitida.')) return;
  // Snapshot p/ o botão Cancelar (revert do estado pré-edição).
  _formatoSnapshot = {
    formatos: _userFormatos ? _clone(_userFormatos) : null,
    secoesCustom: (typeof _DB !== 'undefined' && _DB && _DB.secoesCustom) ? _clone(_DB.secoesCustom) : null
  };
  _renderEditorFormato();
  if (typeof abrirPopup === 'function') abrirPopup('popup-formato');
  // abrirPopup força display:block inline; sobrescreve para 'grid' (layout
  // de 3 regiões: top fixo / scroll / bottom fixo).
  var pop = document.getElementById('popup-formato');
  if (pop) pop.style.display = 'grid';
}

// Só fecha o DOM do popup (display + backdrop). Helper compartilhado pelos
// caminhos de commit (fecharEditorFormato) e de revert (cancelarEditorFormato).
function _fecharPopupFormatoDOM() {
  var pop = document.getElementById('popup-formato');
  if (pop) pop.style.display = 'none';
  var bd = document.getElementById('backdrop');
  if (bd) bd.classList.remove('show');
}

// CAMINHO ÚNICO de fechamento com COMMIT — usado por Salvar, Esc, clique no
// backdrop (via fecharTodosPopups). Limpa o debounce e o snapshot, persiste o
// formato e o conteúdo das seções custom, e fecha o popup. "Esc/clique fora =
// commit" (as edições já foram aplicadas ao vivo).
function fecharEditorFormato() {
  if (_salvarFormatosTimer) { clearTimeout(_salvarFormatosTimer); _salvarFormatosTimer = null; }
  _formatoSnapshot = null;
  if (typeof salvarFormatos === 'function') salvarFormatos();
  if (typeof agendarAutoSave === 'function') agendarAutoSave();   // conteúdo das seções custom
  _fecharPopupFormatoDOM();
}

// "Salvar": idêntico ao fechamento por commit + toast de confirmação.
function salvarEditorFormato() {
  fecharEditorFormato();
  if (typeof mostrarToast === 'function') mostrarToast('✓ Formato salvo', '#1a3a1a', 2000);
}

// Compara o estado atual (formatos + seções custom) com o snapshot tirado na
// abertura do popup. Usado por Cancelar p/ pular confirmação/toast quando nada
// mudou.
function _formatoAlterado() {
  if (!_formatoSnapshot) return false;
  function eq(a, b) { return JSON.stringify(a == null ? null : a) === JSON.stringify(b == null ? null : b); }
  var formatosAtuais = (typeof _userFormatos !== 'undefined') ? _userFormatos : null;
  var secoesAtuais = (typeof _DB !== 'undefined' && _DB) ? _DB.secoesCustom : null;
  return !eq(_formatoSnapshot.formatos, formatosAtuais) ||
         !eq(_formatoSnapshot.secoesCustom, secoesAtuais);
}

// "Cancelar": confirma, restaura do snapshot, persiste o revert (sobrescreve
// qualquer auto-save intermediário) e fecha. Sem alterações, fecha em silêncio
// (sem confirmação nem toast).
async function cancelarEditorFormato() {
  if (!_formatoSnapshot || !_formatoAlterado()) {
    fecharEditorFormato();
    return;
  }
  var ok = await confirmar('Descartar as alterações feitas no Formato?', { danger: true, okText: 'Descartar' });
  if (!ok) return;
  if (_salvarFormatosTimer) { clearTimeout(_salvarFormatosTimer); _salvarFormatosTimer = null; }
  _userFormatos = _formatoSnapshot.formatos;
  if (typeof _DB !== 'undefined' && _DB && _formatoSnapshot.secoesCustom) {
    _DB.secoesCustom = _formatoSnapshot.secoesCustom;
  }
  _formatoSnapshot = null;
  // Persiste o estado restaurado (sobrescreve auto-saves intermediários).
  if (typeof salvarFormatos === 'function') salvarFormatos();
  if (typeof agendarAutoSave === 'function') agendarAutoSave();
  // Sincroniza UI e laudo.
  if (typeof _aplicarSecoesCustom === 'function') _aplicarSecoesCustom();
  if (typeof _aplicarFonteNaTela === 'function') _aplicarFonteNaTela(_perfilFormatoAtivo());
  if (typeof _agendarLiveLaudo === 'function') _agendarLiveLaudo();
  _fecharPopupFormatoDOM();
  if (typeof mostrarToast === 'function') mostrarToast('Alterações descartadas', '#7a4000', 2500);
}

function _renderEditorFormato() {
  var perfil = _perfilFormatoAtivo();
  var embutido = (typeof _ehPerfilEmbutido === 'function') && perfil && _ehPerfilEmbutido(perfil.id);

  _preencherSeletorPerfis(perfil && perfil.id);

  var aviso = document.getElementById('fmt-embutido-aviso');
  if (aviso) aviso.hidden = !embutido;

  var btnRenomear = document.getElementById('fmt-renomear');
  var btnExcluir  = document.getElementById('fmt-excluir');
  if (btnRenomear) btnRenomear.disabled = embutido;
  if (btnExcluir)  btnExcluir.disabled  = embutido;

  _preencherCampos(perfil, embutido);
}

function _preencherSeletorPerfis(idAtivo) {
  var sel = document.getElementById('fmt-perfil');
  if (!sel) return;
  var cat = (typeof _catalogoPerfis === 'function') ? _catalogoPerfis() : [];
  sel.innerHTML = '';
  cat.forEach(function (p) {
    if (!p) return;
    var emb = (typeof _ehPerfilEmbutido === 'function') && _ehPerfilEmbutido(p.id);
    var opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = (p.nome || p.id) + (emb ? ' (embutido)' : '');
    if (p.id === idAtivo) opt.selected = true;
    sel.appendChild(opt);
  });
}

function _opt(sel, val) {
  return '<option value="' + val + '"' + (sel === val ? ' selected' : '') + '>';
}

function _preencherCampos(p, embutido) {
  var box = document.getElementById('fmt-campos');
  if (!box) return;
  p = p || {};
  var t = p.titulo || {}, c = p.cabecalho || {}, k = p.conclusao || {};
  // Espaçamento exibido: usa o separador da seção 'estomago' como referência.
  var espaco = (p.sepSecao && p.sepSecao.estomago) || '<br><br>';

  var fontes = _FMT_FONTES.map(function (f) {
    return _opt((p.fonte || 'Arial'), f.v) + f.t + '</option>';
  }).join('');
  var tamanhos = _FMT_TAMANHOS.map(function (s) {
    return _opt((p.tamanho || '12pt'), s) + s + '</option>';
  }).join('');
  var espacos = _FMT_ESPACOS.map(function (e) {
    return _opt(espaco, e.v) + e.t + '</option>';
  }).join('');
  function alinhaOpts(v) {
    return _opt(v || 'left', 'left') + 'Esquerda</option>' +
           _opt(v || 'left', 'center') + 'Centralizado</option>' +
           _opt(v || 'left', 'right') + 'Direita</option>' +
           _opt(v || 'left', 'justify') + 'Justificado</option>';
  }

  box.innerHTML =
    '<fieldset class="fmt-grupo"><legend>Geral</legend>' +
      '<div class="fmt-row"><label>Fonte</label><select data-f="fonte">' + fontes + '</select></div>' +
      '<div class="fmt-row"><label>Tamanho</label><select data-f="tamanho">' + tamanhos + '</select></div>' +
      '<div class="fmt-row"><label>Espaçamento entre blocos</label><select data-f="espaco">' + espacos + '</select></div>' +
    '</fieldset>' +
    '<fieldset class="fmt-grupo"><legend>Título</legend>' +
      '<div class="fmt-row"><label>Texto</label><input type="text" data-f="titulo.texto" value="' + _attr(t.texto || '') + '"></div>' +
      '<div class="fmt-row"><label>Alinhamento</label><select data-f="titulo.alinhamento">' + alinhaOpts(t.alinhamento) + '</select></div>' +
      '<div class="fmt-row"><label><input type="checkbox" data-f="titulo.negrito"' + (t.negrito ? ' checked' : '') + '> Negrito</label></div>' +
      '<div class="fmt-row"><label>Tamanho</label><select data-f="titulo.tamanho">' +
        _opt(t.tamanho || '', '') + '(igual ao corpo)</option>' +
        _FMT_TAMANHOS_TITULO.map(function (s) { return _opt(t.tamanho || '', s) + s + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="fmt-row"><label>Linhas em branco depois</label><input type="number" min="0" max="6" data-f="titulo.linhasDepois" value="' + (t.linhasDepois != null ? t.linhasDepois : 3) + '"></div>' +
    '</fieldset>' +
    '<fieldset class="fmt-grupo"><legend>Cabeçalhos de seção</legend>' +
      '<div class="fmt-row"><label>Estilo</label><select data-f="cabecalho.estilo">' +
        _opt(c.estilo || 'inline', 'inline') + 'Em linha — "Esôfago: …"</option>' +
        _opt(c.estilo || 'inline', 'bloco') + 'Em bloco — "ESÔFAGO" / linha própria</option>' +
      '</select></div>' +
      '<div class="fmt-row"><label><input type="checkbox" data-f="cabecalho.negrito"' + (c.negrito !== false ? ' checked' : '') + '> Negrito</label></div>' +
      '<div class="fmt-row"><label><input type="checkbox" data-f="cabecalho.maiusculas"' + (c.maiusculas ? ' checked' : '') + '> MAIÚSCULAS</label></div>' +
      '<div class="fmt-row" data-only="inline"><label>Sufixo (inline)</label><input type="text" data-f="cabecalho.sufixo" value="' + _attr(c.sufixo != null ? c.sufixo : ': ') + '"></div>' +
      '<div class="fmt-row" data-only="bloco"><label>Quebras após cabeçalho</label><input type="number" min="1" max="6" data-f="cabecalho.quebras" value="' + (c.quebras != null ? c.quebras : 1) + '"></div>' +
    '</fieldset>' +
    '<fieldset class="fmt-grupo"><legend>Conclusão</legend>' +
      '<div class="fmt-row"><label>Rótulo</label><input type="text" data-f="conclusao.rotulo" value="' + _attr(k.rotulo || 'Conclusão:') + '"></div>' +
      '<div class="fmt-row"><label><input type="checkbox" data-f="conclusao.numerar"' + (k.numerar ? ' checked' : '') + '> Numerar (1. 2. …)</label></div>' +
    '</fieldset>' +
    '<fieldset class="fmt-grupo"><legend>Seções personalizadas</legend>' +
      '<p class="fmt-livre-ajuda">Seções com itens próprios (crie itens em "Criar item" e escolha a seção). Cada seção tem cabeçalho próprio (em bloco ou em linha, nº de quebras, negrito); os itens marcados empilham na linha de baixo.</p>' +
      _htmlSecoesCustom() +
    '</fieldset>' +
    '<fieldset class="fmt-grupo"><legend>Texto livre — Cabeçalho</legend>' +
      '<p class="fmt-livre-ajuda">Parágrafos fixos inseridos ANTES DO TÍTULO do laudo (ex.: nome do serviço, endereço, identificação da clínica).</p>' +
      '<div id="fmt-livres-aposTitulo" data-livre-pos="aposTitulo">' + _htmlLivreRows(p, 'aposTitulo') + '</div>' +
      '<button type="button" class="btn" data-livre-add="aposTitulo">＋ Adicionar bloco</button>' +
    '</fieldset>' +
    '<fieldset class="fmt-grupo"><legend>Texto livre — Rodapé</legend>' +
      '<p class="fmt-livre-ajuda">Parágrafos fixos inseridos NO RODAPÉ do laudo (ex.: identificação, observação final).</p>' +
      '<div id="fmt-livres-rodape" data-livre-pos="rodape">' + _htmlLivreRows(p, 'rodape') + '</div>' +
      '<button type="button" class="btn" data-livre-add="rodape">＋ Adicionar bloco</button>' +
    '</fieldset>';

  _atualizarVisibilidadeCabecalho(c.estilo || 'inline');

  // Desabilita edição em perfis embutidos — EXCETO as seções personalizadas,
  // que são CONTEÚDO (independem do perfil) e seguem sempre editáveis.
  Array.prototype.forEach.call(box.querySelectorAll('input,select,textarea,button'), function (el) {
    if (el.closest('#fmt-secoes-custom')) { el.disabled = false; return; }
    el.disabled = !!embutido;
  });

  _atualizarVisibQuebrasCustom();
}

// Linhas do editor para as seções personalizadas (config vinda de _DB),
// agrupadas por posição e dirigidas pelo catálogo SECOES_CUSTOM.
function _htmlSecoesCustom() {
  var sc = (typeof _DB !== 'undefined' && _DB && _DB.secoesCustom) || {};
  var lista = (typeof SECOES_CUSTOM !== 'undefined') ? SECOES_CUSTOM : [];
  function linha(s) {
    var cfg = sc[s.qual] || {};
    // Rótulo do checkbox inclui a posição (ex.: "Seção 1 (após o título)")
    // para distinguir do slot homônimo da outra posição.
    var nome = String(s.nome);
    var estilo = cfg.estilo || 'bloco';
    var quebras = (cfg.quebras != null) ? cfg.quebras : 1;
    var quebrasAntes = (cfg.quebrasAntes != null) ? cfg.quebrasAntes : 0;
    return '<div class="fmt-livre-row">' +
      '<div class="fmt-row"><label><input type="checkbox" data-cf="' + s.qual + '.ativa"' + (cfg.ativa ? ' checked' : '') + '> Ativar ' + nome + '</label></div>' +
      '<div class="fmt-row"><label>Rótulo</label><input type="text" data-cf="' + s.qual + '.rotulo" value="' + _attr(cfg.rotulo || '') + '" placeholder="Ex: Observação"></div>' +
      '<div class="fmt-row"><label>Quebras antes da seção</label><input type="number" min="0" max="6" data-cf="' + s.qual + '.quebrasAntes" value="' + quebrasAntes + '"></div>' +
      '<div class="fmt-row"><label>Cabeçalho</label><select data-cf="' + s.qual + '.estilo">' +
        _opt(estilo, 'bloco') + 'Em bloco (rótulo em linha própria)</option>' +
        _opt(estilo, 'inline') + 'Em linha (rótulo + conteúdo juntos)</option>' +
      '</select></div>' +
      '<div class="fmt-row" data-cf-quebras="' + s.qual + '"><label>Quebras após rótulo</label><input type="number" min="1" max="6" data-cf="' + s.qual + '.quebras" value="' + quebras + '"></div>' +
      '<div class="fmt-row"><label><input type="checkbox" data-cf="' + s.qual + '.negrito"' + (cfg.negrito !== false ? ' checked' : '') + '> Rótulo em negrito</label></div>' +
      '</div>';
  }
  function grupo(posicao, titulo) {
    var itens = lista.filter(function (s) { return s.posicao === posicao; });
    if (!itens.length) return '';
    return '<div class="fmt-subgrupo"><div class="fmt-sublegenda">' + titulo + '</div>' +
      itens.map(linha).join('') + '</div>';
  }
  return '<div id="fmt-secoes-custom">' +
    grupo('aposTitulo', 'Após o título') +
    grupo('rodape', 'Rodapé') +
    '</div>';
}

// Sincroniza a UI das seções personalizadas com _DB.secoesCustom: mostra/oculta
// a .sec-row de edição, ajusta o rótulo (.sec-label) e a opção do "Criar item".
// Chamada por inicializar() (core) e ao alterar a config no popup.
function _aplicarSecoesCustom() {
  var sc = (typeof _DB !== 'undefined' && _DB && _DB.secoesCustom) || {};
  var lista = (typeof SECOES_CUSTOM !== 'undefined') ? SECOES_CUSTOM : [];
  lista.forEach(function (s) {
    var cfg = sc[s.qual] || {};
    var nome = (cfg.rotulo && cfg.rotulo.trim()) ? cfg.rotulo.trim() : s.nome;
    var row = document.getElementById('sec-row-' + s.qual);
    if (row) row.classList.toggle('oculta', !cfg.ativa);
    var lbl = document.getElementById('sec-label-' + s.qual);
    if (lbl) lbl.textContent = nome;
  });
  _reconstruirOpcoesSecao(sc);
}

// Reconstrói as <option> do "Criar item" na ordem canônica, REMOVENDO do DOM as
// seções personalizadas inativas (o atributo `hidden` em <option> não é honrado
// de forma confiável em todos os navegadores; remover do DOM é universal).
function _reconstruirOpcoesSecao(sc) {
  var select = document.getElementById('section-select');
  if (!select) return;
  // Captura a ordem canônica das opções uma única vez (todas presentes no HTML
  // inicial); guarda também o rótulo padrão de cada uma para poder restaurá-lo.
  if (!select._ordemCanonica) {
    select._ordemCanonica = Array.prototype.slice.call(select.options);
    select._ordemCanonica.forEach(function (o) { o.dataset.labelPadrao = o.textContent; });
  }
  select._ordemCanonica.forEach(function (opt) {
    var ehCustom = opt.id && /^opt-custom/.test(opt.id);
    if (ehCustom) {
      var qual = opt.id.replace('opt-', '');
      var cfg = (sc && sc[qual]) || {};
      if (!cfg.ativa) { if (opt.parentNode) opt.parentNode.removeChild(opt); return; }
      opt.hidden = false;
      opt.textContent = (cfg.rotulo && cfg.rotulo.trim()) ? cfg.rotulo.trim() : opt.dataset.labelPadrao;
    }
    select.appendChild(opt); // appendChild reposiciona na ordem canônica
  });
}

// Lê os controles de seção custom do popup para _DB.secoesCustom (conteúdo).
function _aplicarSecoesCustomDoEditor() {
  if (typeof _DB === 'undefined' || !_DB) return;
  _DB.secoesCustom = _DB.secoesCustom || {};
  var box = document.getElementById('fmt-campos');
  if (!box) return;
  var lista = (typeof SECOES_CUSTOM !== 'undefined') ? SECOES_CUSTOM : [];
  lista.forEach(function (s) {
    var at = box.querySelector('[data-cf="' + s.qual + '.ativa"]');
    var ro = box.querySelector('[data-cf="' + s.qual + '.rotulo"]');
    var es = box.querySelector('[data-cf="' + s.qual + '.estilo"]');
    var ng = box.querySelector('[data-cf="' + s.qual + '.negrito"]');
    var qb = box.querySelector('[data-cf="' + s.qual + '.quebras"]');
    var qa = box.querySelector('[data-cf="' + s.qual + '.quebrasAntes"]');
    var nq = qb ? parseInt(qb.value, 10) : 1;
    if (isNaN(nq) || nq < 1) nq = 1; if (nq > 6) nq = 6;
    var nqa = qa ? parseInt(qa.value, 10) : 0;
    if (isNaN(nqa) || nqa < 0) nqa = 0; if (nqa > 6) nqa = 6;
    _DB.secoesCustom[s.qual] = {
      ativa: at ? !!at.checked : false,
      rotulo: ro ? ro.value : '',
      estilo: es ? es.value : 'bloco',
      negrito: ng ? !!ng.checked : true,
      quebras: nq,
      quebrasAntes: nqa,
      // Rótulo "em linha" implica itens na mesma linha; derivado do estilo (o
      // editor não expõe mais um seletor próprio para "Itens inline").
      itensInline: es ? es.value === 'inline' : false
    };
  });
  _aplicarSecoesCustom();
  _atualizarVisibQuebrasCustom();
  if (typeof agendarAutoSave === 'function') agendarAutoSave();   // salva como CONTEÚDO
  if (typeof _agendarLiveLaudo === 'function') _agendarLiveLaudo();
}

// Mostra/oculta o campo "Quebras após rótulo" conforme o estilo (só p/ bloco).
function _atualizarVisibQuebrasCustom() {
  var box = document.getElementById('fmt-campos');
  if (!box) return;
  var lista = (typeof SECOES_CUSTOM !== 'undefined') ? SECOES_CUSTOM : [];
  lista.forEach(function (s) {
    var es = box.querySelector('[data-cf="' + s.qual + '.estilo"]');
    var row = box.querySelector('[data-cf-quebras="' + s.qual + '"]');
    if (es && row) row.style.display = (es.value === 'inline') ? 'none' : '';
  });
}

// Roteia mudanças no editor: controles de seção custom → conteúdo; demais →
// perfil de formato.
function _onFmtCampoMudou(e) {
  if (e && e.target && e.target.closest && e.target.closest('#fmt-secoes-custom')) {
    _aplicarSecoesCustomDoEditor();
  } else {
    _aplicarCamposNoPerfilAtivo();
  }
}

// Linhas do editor para os blocos de texto livre do perfil, filtradas por
// posição (a posição é implícita pelo container que renderiza essas linhas).
function _htmlLivreRows(p, posicaoFiltro) {
  var livres = (p && p.blocosLivres) || [];
  var filtrados = livres.filter(function (bl) { return bl && bl.posicao === posicaoFiltro; });
  if (!filtrados.length) return '';
  return filtrados.map(function (bl) {
    var ali = bl.alinhamento || 'left';
    return '<div class="fmt-livre-row" data-id="' + _attr(bl.id) + '">' +
      '<div class="fmt-row">' +
        '<button type="button" class="btn-red fmt-livre-del" data-livre-del="' + _attr(bl.id) + '" title="Remover bloco">🗑</button>' +
      '</div>' +
      '<textarea class="fmt-livre-texto" data-lf="texto" rows="3" placeholder="Texto do parágrafo…">' + _attr(bl.texto || '') + '</textarea>' +
      '<div class="fmt-row">' +
        '<label><input type="checkbox" data-lf="negrito"' + (bl.negrito ? ' checked' : '') + '> Negrito</label>' +
        '<label>Alinhamento</label>' +
        '<select data-lf="alinhamento">' +
          _opt(ali, 'left') + 'Esquerda</option>' +
          _opt(ali, 'center') + 'Centralizado</option>' +
          _opt(ali, 'right') + 'Direita</option>' +
          _opt(ali, 'justify') + 'Justificado</option>' +
        '</select>' +
      '</div>' +
    '</div>';
  }).join('');
}

function _attr(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function _atualizarVisibilidadeCabecalho(estilo) {
  var box = document.getElementById('fmt-campos');
  if (!box) return;
  Array.prototype.forEach.call(box.querySelectorAll('[data-only]'), function (el) {
    el.style.display = (el.getAttribute('data-only') === estilo) ? '' : 'none';
  });
}

// ----------------------------------------------------------
// LEITURA DOS CAMPOS → PERFIL ATIVO (de usuário)
// ----------------------------------------------------------

function _aplicarCamposNoPerfilAtivo() {
  var perfil = _perfilFormatoAtivo();
  if (!perfil || (typeof _ehPerfilEmbutido === 'function' && _ehPerfilEmbutido(perfil.id))) return;
  var box = document.getElementById('fmt-campos');
  if (!box) return;

  function val(f) { var el = box.querySelector('[data-f="' + f + '"]'); return el ? el.value : undefined; }
  function chk(f) { var el = box.querySelector('[data-f="' + f + '"]'); return el ? el.checked : undefined; }

  perfil.fonte = val('fonte') || perfil.fonte;
  perfil.tamanho = val('tamanho') || perfil.tamanho;

  perfil.titulo = perfil.titulo || {};
  perfil.titulo.texto = val('titulo.texto');
  perfil.titulo.alinhamento = val('titulo.alinhamento');
  perfil.titulo.negrito = chk('titulo.negrito');
  perfil.titulo.tamanho = val('titulo.tamanho') || '';   // vazio = herda do corpo
  var ld = parseInt(val('titulo.linhasDepois'), 10);
  perfil.titulo.linhasDepois = isNaN(ld) ? 0 : Math.max(0, Math.min(6, ld));

  perfil.cabecalho = perfil.cabecalho || {};
  perfil.cabecalho.estilo = val('cabecalho.estilo');
  perfil.cabecalho.negrito = chk('cabecalho.negrito');
  perfil.cabecalho.maiusculas = chk('cabecalho.maiusculas');
  perfil.cabecalho.sufixo = val('cabecalho.sufixo');
  var cq = parseInt(val('cabecalho.quebras'), 10);
  perfil.cabecalho.quebras = isNaN(cq) ? 1 : Math.max(1, Math.min(6, cq));

  // Espaçamento uniforme em todas as seções (modelo simples p/ perfis de usuário).
  var espaco = val('espaco') || '<br><br>';
  perfil.sepSecao = _sepSecaoUniforme(espaco);

  perfil.conclusao = perfil.conclusao || {};
  perfil.conclusao.rotulo = val('conclusao.rotulo');
  perfil.conclusao.numerar = chk('conclusao.numerar');
  // mantém negrito do rótulo e brAntes/brDepois com defaults do montador

  // Blocos de texto livre: lê de cada container [data-livre-pos]. A posição é
  // implícita pelo container. Blocos com posições legadas (ex.: antesConclusao)
  // não exibidas no editor são preservados como estavam no perfil.
  var containers = box.querySelectorAll('[data-livre-pos]');
  if (containers.length) {
    var posicoesGerenciadas = {};
    var lidos = [];
    Array.prototype.forEach.call(containers, function (cont) {
      var pos = cont.getAttribute('data-livre-pos');
      posicoesGerenciadas[pos] = true;
      Array.prototype.forEach.call(cont.querySelectorAll('.fmt-livre-row'), function (row) {
        function lv(f) { var el = row.querySelector('[data-lf="' + f + '"]'); return el ? el.value : undefined; }
        function lc(f) { var el = row.querySelector('[data-lf="' + f + '"]'); return el ? el.checked : false; }
        lidos.push({
          id: row.getAttribute('data-id'), posicao: pos,
          texto: lv('texto'), negrito: lc('negrito'), alinhamento: lv('alinhamento')
        });
      });
    });
    var preservados = (perfil.blocosLivres || []).filter(function (bl) {
      return bl && !posicoesGerenciadas[bl.posicao];
    });
    perfil.blocosLivres = preservados.concat(lidos);
  }

  _atualizarVisibilidadeCabecalho(perfil.cabecalho.estilo || 'inline');
  if (typeof _aplicarFonteNaTela === 'function') _aplicarFonteNaTela(perfil);
  if (typeof _agendarLiveLaudo === 'function') _agendarLiveLaudo();
  _agendarSalvarFormatos();
}

// Reflete fonte/tamanho do perfil no #output e na toolbar.
function _aplicarFonteNaTela(perfil) {
  if (!perfil) return;
  var out = document.getElementById('output');
  if (out) {
    if (perfil.fonte) out.style.fontFamily = perfil.fonte;
    if (perfil.tamanho) out.style.fontSize = perfil.tamanho;
  }
  var selF = document.getElementById('sel-fonte');
  if (selF && perfil.fonte) selF.value = perfil.fonte;
  var selT = document.getElementById('sel-tamanho');
  if (selT && perfil.tamanho) {
    var idx = _FMT_TAMANHOS.indexOf(perfil.tamanho);
    if (idx >= 0) selT.value = String(idx + 1);
  }
}

// ----------------------------------------------------------
// AÇÕES DE PERFIL
// ----------------------------------------------------------

async function _trocarPerfilAtivoUI(id) {
  if (!id) return;
  // Decisão (a): avisar antes de regenerar quando há edições manuais no texto.
  var temEdicoes = window._secEditada && Object.keys(window._secEditada).some(function (k) { return window._secEditada[k]; });
  if (temEdicoes) {
    var ok = await confirmar('Trocar de perfil regenera o laudo e descarta as edições manuais feitas no texto. Continuar?');
    if (!ok) { _preencherSeletorPerfis(_perfilAtivoId()); return; }
    if (typeof _resetarBlocos === 'function') _resetarBlocos();
  }
  if (typeof definirPerfilAtivo === 'function') await definirPerfilAtivo(id);
  var perfil = _perfilFormatoAtivo();
  _aplicarFonteNaTela(perfil);
  _renderEditorFormato();
}

async function duplicarPerfilAtivo() {
  var base = _perfilFormatoAtivo();
  if (!base) return;
  var nome = window.prompt('Nome do novo perfil:', 'Cópia de ' + (base.nome || 'perfil'));
  if (nome == null) return;
  nome = nome.trim() || ('Cópia de ' + (base.nome || 'perfil'));
  var novo = _perfilUsuarioDe(base, nome);
  if (typeof salvarPerfilFormato === 'function') await salvarPerfilFormato(novo);
  if (typeof definirPerfilAtivo === 'function') await definirPerfilAtivo(novo.id);
  _aplicarFonteNaTela(_perfilFormatoAtivo());
  _renderEditorFormato();
  if (typeof mostrarToast === 'function') mostrarToast('✓ Perfil "' + nome + '" criado — já editável.', '#1a3a1a', 3000);
}

async function novoPerfil() {
  var nome = window.prompt('Nome do novo perfil:', 'Meu formato');
  if (nome == null) return;
  nome = nome.trim() || 'Meu formato';
  // Base: o Clássico (garante todos os campos preenchidos).
  var base = (typeof FORMATO_CLASSICO_EDA !== 'undefined') ? FORMATO_CLASSICO_EDA : _perfilFormatoAtivo();
  var novo = _perfilUsuarioDe(base, nome);
  if (typeof salvarPerfilFormato === 'function') await salvarPerfilFormato(novo);
  if (typeof definirPerfilAtivo === 'function') await definirPerfilAtivo(novo.id);
  _aplicarFonteNaTela(_perfilFormatoAtivo());
  _renderEditorFormato();
  if (typeof mostrarToast === 'function') mostrarToast('✓ Perfil "' + nome + '" criado.', '#1a3a1a', 3000);
}

async function renomearPerfilAtivo() {
  var perfil = _perfilFormatoAtivo();
  if (!perfil || (typeof _ehPerfilEmbutido === 'function' && _ehPerfilEmbutido(perfil.id))) return;
  var nome = window.prompt('Novo nome:', perfil.nome || '');
  if (nome == null) return;
  nome = nome.trim();
  if (!nome) return;
  perfil.nome = nome;
  if (typeof salvarPerfilFormato === 'function') await salvarPerfilFormato(perfil);
  _renderEditorFormato();
}

async function excluirPerfilAtivo() {
  var perfil = _perfilFormatoAtivo();
  if (!perfil || (typeof _ehPerfilEmbutido === 'function' && _ehPerfilEmbutido(perfil.id))) return;
  var ok = await confirmar('Excluir o perfil "' + (perfil.nome || perfil.id) + '"? Esta ação não pode ser desfeita.', { danger: true, okText: 'Excluir' });
  if (!ok) return;
  if (typeof excluirPerfilFormato === 'function') await excluirPerfilFormato(perfil.id);
  _aplicarFonteNaTela(_perfilFormatoAtivo());
  _renderEditorFormato();
  if (typeof mostrarToast === 'function') mostrarToast('Perfil excluído.', '#1a3a1a', 2500);
}

function adicionarBlocoLivre(posicao) {
  var perfil = _perfilFormatoAtivo();
  if (!perfil || (typeof _ehPerfilEmbutido === 'function' && _ehPerfilEmbutido(perfil.id))) return;
  perfil.blocosLivres = perfil.blocosLivres || [];
  perfil.blocosLivres.push({
    id: _novoIdPerfil(),
    posicao: posicao || 'aposTitulo',
    texto: '', negrito: false, alinhamento: 'left'
  });
  _renderEditorFormato();
  if (typeof _agendarLiveLaudo === 'function') _agendarLiveLaudo();
  _agendarSalvarFormatos();
}

function removerBlocoLivre(id) {
  var perfil = _perfilFormatoAtivo();
  if (!perfil || (typeof _ehPerfilEmbutido === 'function' && _ehPerfilEmbutido(perfil.id))) return;
  perfil.blocosLivres = (perfil.blocosLivres || []).filter(function (b) { return b.id !== id; });
  _renderEditorFormato();
  if (typeof _agendarLiveLaudo === 'function') _agendarLiveLaudo();
  _agendarSalvarFormatos();
}

// ----------------------------------------------------------
// LISTENERS
// ----------------------------------------------------------

// Os módulos são injetados dinamicamente no <head> — DOMContentLoaded já pode
// ter disparado. Liga imediatamente se o DOM já estiver pronto.
function _instalarEditorFormato() {
  // Delegação no container: sobrevive ao innerHTML recriado em _preencherCampos.
  var box = document.getElementById('fmt-campos');
  if (box) {
    box.addEventListener('input', _onFmtCampoMudou);
    box.addEventListener('change', _onFmtCampoMudou);
    // Botões dinâmicos dos blocos livres (delegação — sobrevivem ao re-render).
    box.addEventListener('click', function (e) {
      var add = e.target.closest && e.target.closest('[data-livre-add]');
      if (add) { adicionarBlocoLivre(add.getAttribute('data-livre-add')); return; }
      var del = e.target.closest && e.target.closest('[data-livre-del]');
      if (del) { removerBlocoLivre(del.getAttribute('data-livre-del')); return; }
    });
  }
  var sel = document.getElementById('fmt-perfil');
  if (sel) sel.addEventListener('change', function () { _trocarPerfilAtivoUI(this.value); });

  var liga = [
    ['fmt-novo', novoPerfil], ['fmt-duplicar', duplicarPerfilAtivo],
    ['fmt-renomear', renomearPerfilAtivo], ['fmt-excluir', excluirPerfilAtivo],
    ['fmt-salvar', salvarEditorFormato], ['fmt-cancelar', cancelarEditorFormato]
  ];
  liga.forEach(function (par) {
    var el = document.getElementById(par[0]);
    if (el) el.addEventListener('click', par[1]);
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _instalarEditorFormato);
} else {
  _instalarEditorFormato();
}

// ----------------------------------------------------------
// VERIFICAÇÃO DE DEPENDÊNCIAS
// ----------------------------------------------------------
if (typeof _perfilFormatoAtivo === 'undefined') {
  console.error('[formato_eda] ERRO: _perfilFormatoAtivo nao encontrado — laudo_eda.js precisa ser carregado antes');
}
if (typeof salvarFormatos === 'undefined') {
  console.error('[formato_eda] ERRO: salvarFormatos nao encontrado — storage_eda.js precisa ser carregado antes');
}
console.log('[formato_eda] Modulo carregado, dependencias OK');
