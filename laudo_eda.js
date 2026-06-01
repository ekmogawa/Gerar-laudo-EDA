// ============================================================
// laudo_eda.js — Geração, cópia e formatação do laudo
// Dependências: core_eda.js, ui_eda.js, painel_eda.js
// ============================================================

// ----------------------------------------------------------
// HELPERS DE SELEÇÃO
// ----------------------------------------------------------

function _isChecked(id) {
  var el = document.getElementById(id);
  return !!(el && el.checked);
}

// Valores dos itens marcados de uma seção (sem modificadores |||), na ordem do
// DOM. Base para _coletarSecao e para a numeração da conclusão.
function _coletarSecaoItens(containerId) {
  var el = document.getElementById(containerId);
  if (!el) return [];
  var itens = [];
  el.querySelectorAll('input[type="checkbox"]:checked').forEach(function (cb) {
    if (!cb.value || cb.value.indexOf('|||') !== -1) return;
    itens.push(cb.value);
  });
  return itens;
}

function _coletarSecao(containerId, sep) {
  var itens = _coletarSecaoItens(containerId);
  var texto = '';
  for (var i = 0; i < itens.length; i++) texto += itens[i] + sep;
  return texto;
}

// Coleta os modificadores "find|||replace" marcados em qualquer seção, na
// ordem dos checkboxes no DOM (determinística). São o primeiro grupo da lista
// de reescrituras; as legadas/cruzadas (MI/HHD/fundop) entram depois.
function _coletarModificadoresGlobais() {
  var pares = [];
  document.querySelectorAll('.sortable-zone input[type="checkbox"]:checked').forEach(function (cb) {
    if (!cb.value || cb.value.indexOf('|||') === -1) return;
    var partes = cb.value.split('|||');
    for (var i = 0; i < partes.length; i += 2) {
      var find = partes[i], replace = partes[i + 1] || '';
      if (find) pares.push([find, replace]);
    }
  });
  return pares;
}

// Modificadores DESmarcados: emite o par invertido [replace, find] para
// desfazer a substituição em seções editadas à mão (onde o texto já contém
// "replace" e não é regerado do zero). Em seções não editadas, regeradas a
// cada render, "replace" não está presente — o replace inverso é no-op.
// Idempotente p/ pares sem sobreposição entre find e replace.
function _coletarModificadoresInversos() {
  var pares = [];
  document.querySelectorAll('.sortable-zone input[type="checkbox"]:not(:checked)').forEach(function (cb) {
    if (!cb.value || cb.value.indexOf('|||') === -1) return;
    var partes = cb.value.split('|||');
    for (var i = 0; i < partes.length; i += 2) {
      var find = partes[i], replace = partes[i + 1] || '';
      if (replace && replace !== find) pares.push([replace, find]);
    }
  });
  return pares;
}

// Aplica a lista de reescrituras a um bloco. 'mod' = modificador do usuário
// (literal, global). 'leg' = regra legada/cruzada com find/replace cru do
// TPL_EDA (regex ou string — mesma semântica do laudo antigo), escopada a
// uma seção via op.sec. ops sem op.sec valem para qualquer bloco.
function _aplicarReescrituras(html, k, ops) {
  if (!html || !ops || !ops.length) return html;
  for (var i = 0; i < ops.length; i++) {
    var op = ops[i];
    if (op.sec && op.sec !== k) continue;
    if (op.tipo === 'mod') {
      if (op.find) html = html.replace(new RegExp(escapeRegExp(op.find), 'g'), op.repl);
    } else {
      html = html.replace(op.find, op.repl);
    }
  }
  return html;
}

// ----------------------------------------------------------
// PERFIL DE FORMATAÇÃO ATIVO
// ----------------------------------------------------------
// O perfil dirige a APRESENTAÇÃO do laudo (fonte, cabeçalhos, espaçamento,
// título, conclusão). O catálogo são os perfis EMBUTIDOS (FORMATOS_PADRAO em
// dados_eda.js) + os perfis do USUÁRIO (_userFormatos, persistidos no Firestore
// — ver storage_eda.js). O perfil ativo segue a preferência do usuário, caindo
// para o 'classico' embutido como fallback (output idêntico ao histórico).

// Catálogo completo: embutidos primeiro, depois os do usuário. Ids de usuário
// não devem colidir com os embutidos ('classico' é reservado).
function _catalogoPerfis() {
  var lista = [];
  if (typeof FORMATOS_PADRAO !== 'undefined' && FORMATOS_PADRAO && FORMATOS_PADRAO.perfis)
    lista = lista.concat(FORMATOS_PADRAO.perfis);
  if (typeof _userFormatos !== 'undefined' && _userFormatos && _userFormatos.perfis)
    lista = lista.concat(_userFormatos.perfis);
  return lista;
}

// Id do perfil ativo: preferência do usuário, senão o padrão embutido.
function _perfilAtivoId() {
  if (typeof _userFormatos !== 'undefined' && _userFormatos && _userFormatos.ativo)
    return _userFormatos.ativo;
  if (typeof FORMATOS_PADRAO !== 'undefined' && FORMATOS_PADRAO && FORMATOS_PADRAO.ativo)
    return FORMATOS_PADRAO.ativo;
  return 'classico';
}

function _perfilFormatoAtivo() {
  var id = _perfilAtivoId();
  var cat = _catalogoPerfis();
  var i;
  for (i = 0; i < cat.length; i++) if (cat[i] && cat[i].id === id) return cat[i];
  for (i = 0; i < cat.length; i++) if (cat[i]) return cat[i];   // 1º disponível
  return (typeof FORMATO_CLASSICO_EDA !== 'undefined') ? FORMATO_CLASSICO_EDA : null;
}

function _repetirBr(n) {
  var s = '';
  for (var i = 0; i < (n || 0); i++) s += '<br>';
  return s;
}

// Bloco de TÍTULO a partir do perfil. alinhamento 'left' => sem wrapper
// (texto cru, igual ao histórico); demais => <div style="text-align:…">.
function _montarTitulo(p) {
  var t = (p && p.titulo) || {};
  var inner = t.negrito ? ('<strong>' + (t.texto || '') + '</strong>') : (t.texto || '');
  // Tamanho de fonte específico do título (opcional; vazio = herda o corpo).
  // Limitação TESI: o Telerik ignora estilos internos, então o título assume o
  // tamanho do wrapper na cópia; no Word/HTML clipboard o tamanho é honrado.
  if (t.tamanho) inner = '<span style="font-size:' + t.tamanho + '">' + inner + '</span>';
  var brs = _repetirBr(t.linhasDepois);
  if (t.alinhamento && t.alinhamento !== 'left')
    return '<div style="text-align:' + t.alinhamento + '">' + inner + '</div>' + brs;
  return inner + brs;
}

// Rótulo de seção. 'inline' => "<strong>Esôfago: </strong>";
// 'bloco' => "<strong>ESÔFAGO</strong><br>" (nome em linha própria).
function _rotuloSecao(nome, p) {
  var c = (p && p.cabecalho) || {};
  if (c.estilo === 'bloco') {
    var n = c.maiusculas ? nome.toUpperCase() : nome;
    var lbl = c.negrito ? ('<strong>' + n + '</strong>') : n;
    // Nº de quebras após o rótulo (default 1 = rótulo seguido do conteúdo na
    // linha de baixo); permite afastar mais o conteúdo do cabeçalho.
    var nq = (c.quebras != null) ? parseInt(c.quebras, 10) : 1;
    if (isNaN(nq) || nq < 1) nq = 1;
    return lbl + _repetirBr(nq);
  }
  var suf = (c.sufixo != null) ? c.sufixo : ': ';
  var nomeInline = c.maiusculas ? nome.toUpperCase() : nome;
  return c.negrito ? ('<strong>' + nomeInline + suf + '</strong>') : (nomeInline + suf);
}

// Prefixo do bloco de conclusão: linhas em branco + rótulo + linhas em branco.
function _prefixoConclusao(p) {
  var c = (p && p.conclusao) || {};
  var rot = (c.rotulo || '');
  if (c.negrito !== false) rot = '<strong>' + rot + '</strong>';
  return _repetirBr(c.brAntes != null ? c.brAntes : 2) + rot +
         _repetirBr(c.brDepois != null ? c.brDepois : 2);
}

// Separador (trailing) de uma seção, conforme o perfil; cai para '<br><br>'.
// Para chaves custom* (custom1..N) não definidas no perfil, HERDA o espaçamento
// do perfil (representado por sepSecao.estomago) — evita que seções
// personalizadas tenham trailing diferente do escolhido em "Espaçamento entre
// blocos" (perfis legados não incluíam custom* nesse mapa).
function _sepSecao(k, p) {
  var s = (p && p.sepSecao) || {};
  if (s[k] != null) return s[k];
  if (/^custom\d+$/.test(k) && s.estomago != null) return s.estomago;
  return '<br><br>';
}

// Capitaliza a primeira letra (latina, com acentos) do HTML, ignorando tags e
// caracteres não-alfabéticos no início (espaços, "-", "1. ", "&nbsp;" etc.).
// Idempotente: se já está em maiúscula, retorna inalterado.
function _capitalizarPrimeiraLetra(html) {
  if (!html) return html;
  var s = String(html);
  var i = 0, inTag = false;
  while (i < s.length) {
    var ch = s[i];
    if (inTag) {
      if (ch === '>') inTag = false;
      i++; continue;
    }
    if (ch === '<') { inTag = true; i++; continue; }
    if (/[A-Za-zÀ-ÖØ-öø-ÿ]/.test(ch)) {
      var up = ch.toUpperCase();
      if (ch !== up) return s.substring(0, i) + up + s.substring(i + 1);
      return s;
    }
    i++;
  }
  return s;
}

// Aplica capitalização ao conteúdo quando o cabeçalho do perfil é em BLOCO
// (rótulo em linha própria, seguido de <br>). Em estilo inline, o conteúdo
// continua a frase do rótulo — não capitaliza.
function _capContentBloco(text, p) {
  return (text && p && p.cabecalho && p.cabecalho.estilo === 'bloco')
    ? _capitalizarPrimeiraLetra(text)
    : text;
}

// Bloco de TEXTO LIVRE (Tier 1): parágrafo estático do perfil (ex.: descrição
// dos procedimentos), inserido em posições fixas. Escapa HTML e converte
// quebras de linha em <br>; aplica negrito/alinhamento de forma TESI-segura.
function _htmlBlocoLivre(bl, p) {
  var txt = String((bl && bl.texto) || '');
  if (!txt.replace(/\s+/g, '')) return '';
  var esc = txt.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
               .replace(/\r?\n/g, '<br>');
  var inner = bl.negrito ? ('<strong>' + esc + '</strong>') : esc;
  var sep = _sepSecao('esofago', p);   // mesmo espaçamento entre blocos
  if (bl.alinhamento && bl.alinhamento !== 'left')
    return '<div style="text-align:' + bl.alinhamento + '">' + inner + '</div>' + sep;
  return inner + sep;
}

// Empurra para `blocos` os blocos livres do perfil numa dada posição. Cada um
// vira uma seção identificável (livre_<id>) — herda preservação de edição
// manual e desembrulho na cópia. `mostrar` espelha a visibilidade do contexto
// (ex.: só quando há corpo de laudo). Perfis sem blocosLivres: no-op (Clássico
// permanece idêntico).
function _pushBlocosLivres(blocos, p, posicao, mostrar) {
  var livres = (p && p.blocosLivres) || [];
  for (var i = 0; i < livres.length; i++) {
    var bl = livres[i];
    if (!bl || !bl.id || bl.posicao !== posicao) continue;
    blocos.push({ k: 'livre_' + bl.id, html: mostrar ? _htmlBlocoLivre(bl, p) : '' });
  }
}

// Configuração ({ativa, rotulo}) de uma seção personalizada — vive no CONTEÚDO
// (_DB.secoesCustom), não no perfil. Itens vivem em _DB.custom1/.custom2 e são
// coletados do DOM por _coletarSecao. Inativa (padrão) => seção não entra no
// laudo (laudos atuais permanecem idênticos).
function _secaoCustomCfg(qual) {
  var sc = (typeof _DB !== 'undefined' && _DB && _DB.secoesCustom) || null;
  return sc ? sc[qual] : null;
}

// Itens marcados de uma seção custom, unidos pelo separador escolhido
// (padrão '<br>' = linha abaixo; ' ' = inline na mesma linha).
function _coletarSecaoCustom(containerId, sep) {
  var el = document.getElementById(containerId);
  if (!el) return '';
  var itens = [];
  el.querySelectorAll('input[type="checkbox"]:checked').forEach(function (cb) {
    if (!cb.value || cb.value.indexOf('|||') !== -1) return;
    itens.push(cb.value);
  });
  return itens.join(sep != null ? sep : '<br>');
}

// Cabeçalho de uma seção custom, conforme a SUA config (independe do perfil):
// negrito (padrão sim); estilo 'inline' (rótulo + espaço, conteúdo na mesma
// linha) ou 'bloco' (rótulo + N quebras, conteúdo abaixo); quebras = nº de <br>
// após o rótulo no estilo bloco (uma ou mais). Rótulo vazio => sem cabeçalho.
function _cabecalhoSecaoCustom(cfg) {
  var rot = (cfg.rotulo || '').trim();
  if (!rot) return '';
  var inner = (cfg.negrito !== false) ? ('<strong>' + rot + '</strong>') : rot;
  if (cfg.estilo === 'inline') return inner + ' ';
  var nq = (cfg.quebras != null) ? parseInt(cfg.quebras, 10) : 1;
  if (isNaN(nq) || nq < 1) nq = 1;
  return inner + _repetirBr(nq);
}

// HTML de uma seção custom: cabeçalho (config própria) + itens + separador
// trailing do bloco (espaça da próxima seção). `containerId` = id do .sec-content.
function _blocoSecaoCustom(qual, containerId, p) {
  var cfg = _secaoCustomCfg(qual);
  if (!cfg || !cfg.ativa) return '';
  // Rótulo em linha (estilo 'inline') implica itens na mesma linha; nesse caso
  // o flag itensInline é redundante e o editor o omite.
  var sepItem = (cfg.itensInline || cfg.estilo === 'inline') ? ' ' : '<br>';
  var text = _coletarSecaoCustom(containerId, sepItem);
  if (!text) return '';
  // Quebra de linha entre rótulo e texto (estilo bloco com rótulo) =>
  // capitaliza a primeira letra do parágrafo.
  var rot = (cfg.rotulo || '').trim();
  if (rot && cfg.estilo === 'bloco') text = _capitalizarPrimeiraLetra(text);
  // Quebras EXTRAS antes do bloco (independente do trailing da seção anterior).
  // Default 0; útil p/ separar mais a seção do bloco prévio (ex.: conclusão).
  var qa = (cfg.quebrasAntes != null) ? parseInt(cfg.quebrasAntes, 10) : 0;
  if (isNaN(qa) || qa < 0) qa = 0;
  var prefix = qa > 0 ? _repetirBr(qa) : '';
  return prefix + _cabecalhoSecaoCustom(cfg) + text + _sepSecao(qual, p);
}

// Empurra para `blocos` as seções custom de uma posição (ordem do catálogo
// SECOES_CUSTOM). Gate por `mostrar` e por ativa/itens dentro de _blocoSecaoCustom.
function _pushSecoesCustom(blocos, posicao, p, mostrar) {
  if (typeof SECOES_CUSTOM === 'undefined') return;
  SECOES_CUSTOM.forEach(function (s) {
    if (s.posicao !== posicao) return;
    blocos.push({ k: s.qual, html: mostrar ? _blocoSecaoCustom(s.qual, s.container, p) : '' });
  });
}

// Normaliza o espaçamento da CAUDA do laudo (conclusão + blocos de rodapé):
// uma única linha em branco entre a conclusão e o 1º bloco de rodapé e entre
// blocos de rodapé consecutivos; sem trailing sobrando após o último. A
// conclusão é terminal (mantém o prefixo, perde só o trailing); cada bloco
// seguinte tem leading/trailing de <br> removidos e ganha "<br><br>" de entrada.
var _RE_BR_TRAIL = /(?:\s*<br\s*\/?>)+\s*$/i;
var _RE_BR_LEAD  = /^\s*(?:<br\s*\/?>\s*)+/i;
function _normalizarCaudaLaudo(blocos) {
  var ic = -1;
  for (var i = 0; i < blocos.length; i++)
    if (blocos[i].k === 'conclusao' && blocos[i].html) { ic = i; break; }
  if (ic === -1) return;
  blocos[ic].html = blocos[ic].html.replace(_RE_BR_TRAIL, '');
  for (var j = ic + 1; j < blocos.length; j++) {
    if (!blocos[j].html) continue;
    blocos[j].html = '<br><br>' + blocos[j].html.replace(_RE_BR_LEAD, '').replace(_RE_BR_TRAIL, '');
  }
}

// ----------------------------------------------------------
// MONTAGEM DO LAUDO
// ----------------------------------------------------------

function montarLaudo() {
  var p = _perfilFormatoAtivo();
  var eqText   = _coletarSecao('equipamento', _sepSecao('equipamento', p));
  var sedText  = _coletarSecao('Sedação',     _sepSecao('sedacao', p));
  var estText  = _coletarSecao('Estômago',    _sepSecao('estomago', p));
  var duoText  = _coletarSecao('Duodeno',     _sepSecao('duodeno', p));
  var jejText  = _coletarSecao('Jejuno',      _sepSecao('jejuno', p));
  var outText  = _coletarSecao('Outros',      _sepSecao('outros', p));

  // Conclusão: numerada (1. 2. …) quando o perfil pede; senão, itens unidos por
  // uma única quebra. A conclusão é a ÚLTIMA seção do corpo — NÃO emite
  // separador TRAILING: como bloco terminal, um trailing deixaria uma linha em
  // branco sobrando no fim do laudo; e seções pós-conclusão (rodapé custom) já
  // trazem o próprio espaçamento de entrada (quebrasAntes), então o trailing
  // duplicaria a linha em branco entre a conclusão e elas.
  var concItens = _coletarSecaoItens('Conclusão');
  var concText;
  if (p && p.conclusao && p.conclusao.numerar) {
    // Itens numerados em linhas consecutivas (1.\n2.\n…); remove marcador de
    // lista inicial ("- "/"–"/"•") para não ficar "1. - …".
    concText = concItens.map(function (v, i) {
      return (i + 1) + '. ' + String(v).replace(/^\s*[-–—•]\s*/, '');
    }).join('<br>');
  } else {
    concText = concItens.join('<br>');
  }

  var esfText  = '';
  var hhdAtivo = false;
  var esfEl = document.getElementById('Esôfago');
  if (esfEl) {
    esfEl.querySelectorAll('input[type="checkbox"]:checked').forEach(function (cb) {
      if (cb.value && cb.value.indexOf('|||') === -1) {
        esfText += cb.value + _sepSecao('esofago', p);
      }
      // Qualquer item cujo nome contenha "HHD" (HHD, HHD+LAA, HHD+Barrett...)
      // sinaliza hérnia hiatal: a frase do estômago precisa virar "alargado em relação"
      if (cb.name && cb.name.indexOf('HHD') !== -1) hhdAtivo = true;
    });
  }

  // Modificadores ||| do usuário (coletados aqui; entram na lista de
  // reescrituras montada logo abaixo, junto das legadas/cruzadas).
  var _mods    = _coletarModificadoresGlobais();
  var _modsInv = _coletarModificadoresInversos();

  // Caminho legado: quando o checkbox tem value vazio (modificador antigo,
  // sem formato "find|||replace"), aplica a regra hardcoded. Se o usuário
  // editou via popup e value virou "find|||replace", os modificadores globais
  // (camada final em _renderBlocosLaudo) já cuidam — não aplicar de novo aqui.
  function _legacyAtivo(id) {
    var el = document.getElementById(id);
    return !!(el && el.checked && el.value === '');
  }

  var isGeral         = _isChecked('geral');
  var isMI            = _legacyAtivo('checkboxmi') ||
                        !!(document.querySelector('input[name="MI"]:checked'));
  var isHipoCardia    = _legacyAtivo('checkboxhipocardia');
  var isFundop        = _legacyAtivo('checkbox23');
  var isFundopMigrada = _legacyAtivo('checkboxfundopmig');

  // TODAS as reescrituras (modificadores ||| do usuário, legados e regras
  // cruzadas) viram uma CAMADA FINAL aplicada ao conteúdo REAL de cada bloco
  // em _renderBlocosLaudo — assim valem mesmo em seções editadas à mão.
  // Ordem preservada do laudo original: modificadores do usuário primeiro,
  // depois as legadas (escopadas a estômago/conclusão). As legadas usam o
  // find/replace cru (regex/string do TPL_EDA), idêntico ao comportamento
  // anterior; os modificadores do usuário casam literal e global.
  // Inversos primeiro: desfazem "replace"→"find" em seções editadas à mão
  // antes de qualquer reaplicação dos modificadores ainda marcados.
  var _reescrituras = [];
  _modsInv.forEach(function (p) { _reescrituras.push({ tipo: 'mod', find: p[0], repl: p[1] }); });
  _mods.forEach(function (p) { _reescrituras.push({ tipo: 'mod', find: p[0], repl: p[1] }); });
  if (hhdAtivo || isHipoCardia)
    _reescrituras.push({ tipo: 'leg', find: TPL_EDA.AJUSTADO_RE, repl: TPL_EDA.AJUSTADO_ALARGADO, sec: 'estomago' });
  if (isFundop)
    _reescrituras.push({ tipo: 'leg', find: TPL_EDA.HIATO_AJUSTADO, repl: TPL_EDA.FUNDOP_TEXTO, sec: 'estomago' });
  if (isFundopMigrada)
    _reescrituras.push({ tipo: 'leg', find: TPL_EDA.HIATO_FLEX, repl: TPL_EDA.FUNDOP_MIG_TEXTO, sec: 'estomago' });
  if (isMI) {
    _reescrituras.push({ tipo: 'leg', find: TPL_EDA.REDUZIDO_RE,     repl: TPL_EDA.REDUZIDO_MI,     sec: 'estomago' });
    _reescrituras.push({ tipo: 'leg', find: TPL_EDA.AREA_ATROFIA_RE, repl: TPL_EDA.AREA_ATROFIA_MI, sec: 'conclusao' });
    _reescrituras.push({ tipo: 'leg', find: TPL_EDA.ATROFICA_RE,     repl: TPL_EDA.ATROFICA_MI,     sec: 'conclusao' });
  }

  // Cada trecho vira um BLOCO identificável (mesma ordem e conteúdo do laudo
  // de antes — só a forma de escrever no #output muda). _renderBlocosLaudo
  // preserva blocos editados à mão. Ver [[modelo-blocos]].
  var temCorpo = !!(eqText || sedText || esfText || estText || duoText ||
                    jejText || outText || concText);
  // Seções custom ativas com itens marcados também caracterizam "corpo" do
  // laudo — caso contrário, marcar só em custom não dispararia render.
  if (!temCorpo && typeof SECOES_CUSTOM !== 'undefined') {
    for (var _isc = 0; _isc < SECOES_CUSTOM.length; _isc++) {
      var _sc = SECOES_CUSTOM[_isc];
      var _cfgC = _secaoCustomCfg(_sc.qual);
      if (_cfgC && _cfgC.ativa && _coletarSecaoItens(_sc.container).length > 0) {
        temCorpo = true; break;
      }
    }
  }
  var mostrarTitulo = temCorpo && !outText;

  var blocos = [];
  // Texto livre do "Cabeçalho" entra ANTES do título (letterhead / cabeçalho do
  // laudo). Internamente a posição segue chamada 'aposTitulo' por compat com
  // perfis legados — semântica de UI: "cabeçalho" = topo do documento.
  _pushBlocosLivres(blocos, p, 'aposTitulo', mostrarTitulo);
  blocos.push({ k: '__titulo', html: mostrarTitulo ? _montarTitulo(p) : '' });
  // Seções personalizadas "Após o título" permanecem após — entre título e corpo.
  _pushSecoesCustom(blocos, 'aposTitulo', p, temCorpo);
  blocos.push({ k: 'equipamento', html: eqText || '' });
  blocos.push({ k: 'sedacao',     html: sedText ? (isGeral ? sedText : _rotuloSecao('Sedação', p) + _capContentBloco(sedText, p)) : '' });
  blocos.push({ k: 'esofago',     html: esfText ? _rotuloSecao('Esôfago', p) + _capContentBloco(esfText, p) : '' });
  blocos.push({ k: 'estomago',    html: estText ? _rotuloSecao('Estômago', p) + _capContentBloco(estText, p) : '' });
  blocos.push({ k: 'duodeno',     html: duoText ? _rotuloSecao('Duodeno', p) + _capContentBloco(duoText, p) : '' });
  blocos.push({ k: 'jejuno',      html: jejText ? _rotuloSecao('Jejuno', p)   + _capContentBloco(jejText, p) : '' });
  blocos.push({ k: 'outros',      html: outText || '' });
  _pushBlocosLivres(blocos, p, 'antesConclusao', temCorpo);
  // Conclusão: sempre há rótulo, e brDepois>=1 cria quebra entre rótulo e
  // conteúdo — então capitaliza a primeira letra do parágrafo. Em itens já
  // capitalizados (caso clássico "- Exame…"/"1. Exame…"), é no-op.
  var concBrDepois = (p && p.conclusao && p.conclusao.brDepois != null) ? p.conclusao.brDepois : 2;
  var concRotulo   = (p && p.conclusao && p.conclusao.rotulo) || '';
  var concFinal = (concText && concRotulo && concBrDepois >= 1) ? _capitalizarPrimeiraLetra(concText) : concText;
  blocos.push({ k: 'conclusao',   html: concText ? _prefixoConclusao(p) + concFinal : '' });
  _pushSecoesCustom(blocos, 'rodape', p, temCorpo);
  _pushBlocosLivres(blocos, p, 'rodape', temCorpo);
  // Espaçamento da CAUDA do laudo (conclusão + seções/textos de rodapé):
  // EXATAMENTE uma linha em branco entre a conclusão e a 1ª seção de rodapé, e
  // entre seções de rodapé consecutivas; nenhuma linha sobrando após a última.
  // Cada bloco de rodapé traz leading próprio (quebrasAntes) E trailing (herdado
  // do Estômago) — somados, duplicariam a linha em branco. Normaliza-se a cauda:
  // a conclusão mantém o prefixo (que a separa da seção anterior) e perde só o
  // trailing; cada bloco seguinte tem leading/trailing de <br> removidos e
  // recebe "<br><br>" (uma única linha em branco) de entrada.
  _normalizarCaudaLaudo(blocos);
  blocos.forEach(function (b) {
    b.html = b.html
      .replace(/<span class='bold'>/g, '<span style="font-weight:bold">')
      .replace(/<span class="bold">/g, '<span style="font-weight:bold">');
  });

  var output = document.getElementById('output');
  if (!output) return null;
  // Não sobrescreve enquanto o usuário edita o #output diretamente; a
  // detecção de seção editada já roda no evento 'input'.
  if (document.activeElement === output) return output;
  _renderBlocosLaudo(output, blocos, _reescrituras);
  return output;
}

// ----------------------------------------------------------
// MODELO DE BLOCOS POR SEÇÃO
// ----------------------------------------------------------
// O laudo é escrito como <span class="sec-blk" data-sec="K">…</span> por
// seção. _ultimoGeradoSec[K] guarda o HTML gerado (já normalizado pelo
// browser) de cada seção; _marcarSecoesEditadas (no 'input' do #output)
// marca em _secEditada[K] as seções cujo conteúdo divergiu do gerado.
// Numa regeração: seção não editada → substitui; editada com conteúdo →
// mantém intacta; editada mas desmarcada por completo → remove (decisão do
// usuário). Depois de montados, TODAS as reescrituras (ops: modificadores
// ||| + legadas/cruzadas MI/HHD/fundop) são aplicadas como CAMADA FINAL a
// todos os blocos — inclusive os editados à mão. Os spans são desembrulhados
// na cópia (_desembrulharBlocos) para o TESI seguir plano.
function _renderBlocosLaudo(output, blocos, ops) {
  window._ultimoGeradoSec = window._ultimoGeradoSec || {};
  window._secEditada = window._secEditada || {};
  var existentes = {};
  output.querySelectorAll('span.sec-blk').forEach(function (sp) {
    existentes[sp.getAttribute('data-sec')] = sp;
  });
  var partes = [];
  blocos.forEach(function (b) {
    var k = b.k, novo = b.html || '';
    var editado = !!window._secEditada[k];
    var spExist = existentes[k];
    if (editado && spExist && novo) {
      partes.push({ k: k, html: spExist.innerHTML });           // mantém edição
      return;
    }
    if (editado && (!novo || !spExist)) {                        // desmarcada → cai fora
      delete window._secEditada[k];
      delete window._ultimoGeradoSec[k];
      if (!novo) return;
    }
    if (!novo) { delete window._ultimoGeradoSec[k]; return; }
    partes.push({ k: k, html: novo });
  });
  output.innerHTML = partes.map(function (p) {
    return '<span class="sec-blk" data-sec="' + p.k + '">' + p.html + '</span>';
  }).join('');
  // Camada final: aplica TODAS as reescrituras (modificadores ||| + legadas/
  // cruzadas) a TODOS os blocos (gerados E editados à mão), sobre o texto
  // real já montado. Para replaces idempotentes (trocar A→B, B sem A)
  // reaplicar a cada render é no-op; o bloco editado mantém a edição do
  // usuário com a reescritura por cima.
  if (ops && ops.length) {
    output.querySelectorAll('span.sec-blk').forEach(function (sp) {
      sp.innerHTML = _aplicarReescrituras(sp.innerHTML, sp.getAttribute('data-sec'), ops);
    });
  }
  // Rebaseia com o innerHTML JÁ COM modificadores (a comparação no 'input'
  // fica confiável — sem falso "editada"). Não toca a base de seções editadas.
  output.querySelectorAll('span.sec-blk').forEach(function (sp) {
    var k = sp.getAttribute('data-sec');
    if (!window._secEditada[k]) window._ultimoGeradoSec[k] = sp.innerHTML;
  });
}

// Marca seções cujo conteúdo no DOM divergiu do gerado (chamado no 'input').
function _marcarSecoesEditadas(output) {
  window._ultimoGeradoSec = window._ultimoGeradoSec || {};
  window._secEditada = window._secEditada || {};
  output.querySelectorAll('span.sec-blk').forEach(function (sp) {
    var k = sp.getAttribute('data-sec');
    if (window._ultimoGeradoSec[k] === undefined) return;
    if (sp.innerHTML !== window._ultimoGeradoSec[k]) window._secEditada[k] = true;
  });
}

// Rebaseia tratando o conteúdo atual como base não editada (após restaurar
// histórico / último laudo). Snapshots antigos sem spans: nada a rebasear,
// e o próximo montarLaudo regenera das seções marcadas (comportamento antigo).
function _rebasearBlocos(output) {
  window._ultimoGeradoSec = {};
  window._secEditada = {};
  if (!output) return;
  output.querySelectorAll('span.sec-blk').forEach(function (sp) {
    window._ultimoGeradoSec[sp.getAttribute('data-sec')] = sp.innerHTML;
  });
}

function _resetarBlocos() {
  window._ultimoGeradoSec = {};
  window._secEditada = {};
}

// Achata os <span class="sec-blk"> num nó clonado (só na cópia, nunca no
// #output ao vivo) — o HTML enviado ao TESI fica idêntico ao laudo sem blocos.
function _desembrulharBlocos(node) {
  node.querySelectorAll('span.sec-blk').forEach(function (sp) {
    while (sp.firstChild) sp.parentNode.insertBefore(sp.firstChild, sp);
    sp.parentNode.removeChild(sp);
  });
}

// ----------------------------------------------------------
// CÓPIA — CLIPBOARD API + FALLBACK
// ----------------------------------------------------------

// Serializa um nó DOM em XHTML válido para parsers XML estritos
// (Telerik Reporting do TESI usa System.Xml.XmlTextReader).
function _serializarXhtml(node) {
  try {
    return new XMLSerializer().serializeToString(node);
  } catch (e) {
    console.warn('[clipboard] XMLSerializer falhou, fallback para outerHTML:', e);
    return node.outerHTML;
  }
}

// Intercepta Enter no #output para inserir <br> no lugar do <div>/<p> que o
// contenteditable do navegador insere por padrão. Mantém o HTML "plano" (só
// inline + <br>), igual ao template estático — assim os 3 canais de cópia
// (output.innerText do botão, seleção nativa do Ctrl+C, e Telerik do TESI)
// convergem para o mesmo resultado. Sem isto, cada algoritmo trata <div> e
// blocos vazios de um jeito, divergindo.
//
// Idempotente: pode ser chamado várias vezes (flag em dataset).
function _instalarHandlerEnterBr() {
  var output = document.getElementById('output');
  if (!output || output.dataset.brEnter === '1') return;
  output.dataset.brEnter = '1';

  function inserirBr(e) {
    e.preventDefault();
    var sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    try {
      var range = sel.getRangeAt(0);
      if (!range.collapsed) range.deleteContents();
      var br = document.createElement('br');
      range.insertNode(br);
      range.setStartAfter(br);
      range.setEndAfter(br);
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (err) {
      console.warn('[output:enter] insertNode falhou, fallback execCommand:', err);
      try {
        if (sel.rangeCount > 0) sel.collapseToStart();
        document.execCommand('insertHTML', false, '<br>');
      } catch (err2) {
        console.error('[output:enter] fallback execCommand falhou:', err2);
      }
    }
  }

  // beforeinput dispara antes do keydown em navegadores modernos e é onde
  // o Chromium decide criar <div>/<p>. Interceptamos aqui para impedir.
  output.addEventListener('beforeinput', function (e) {
    if (e.inputType === 'insertParagraph') inserirBr(e);
  });

  // keydown como fallback (navegadores sem beforeinput ou quando o tipo
  // não é 'insertParagraph' por algum motivo). Shift/Ctrl/Meta/Alt + Enter
  // continuam com comportamento default.
  output.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      inserirBr(e);
    }
  });
}

// Converte <div>/<p> sem alinhamento em <br>, como rede de segurança no
// momento da cópia. O handler de Enter em #output já previne a criação de
// blocos pelo contenteditable, mas paste de Word/Outlook ainda pode trazer
// estrutura de bloco que o Telerik (TESI) não renderiza igual ao <br><br>
// do template.
//
// Blocos COM text-align explícito (criados por execCommand('justifyCenter')
// etc.) são PRESERVADOS intactos: o Word/Outlook respeita alinhamento por
// parágrafo via <div style="text-align:...">. Para o TESI, que ignora estilo
// interno, _detectarAlinhamentoDominante aplica o alinhamento no wrapper.
function _normalizarBlocosParaTelerik(wrapper) {
  var guard = 1000;
  var el;
  while ((el = _proximoBlocoSemAlinhamento(wrapper)) && guard-- > 0) {
    var pai = el.parentNode;
    if (!pai) break;
    var conteudo = el.innerHTML.replace(/\s+/g, ' ').trim();
    var vazio = conteudo === '' || conteudo === '<br>' || conteudo === '<br/>' || conteudo === '&nbsp;';
    var frag = document.createDocumentFragment();
    frag.appendChild(document.createElement('br'));
    if (!vazio) {
      while (el.firstChild) frag.appendChild(el.firstChild);
    }
    pai.replaceChild(frag, el);
  }
}

function _proximoBlocoSemAlinhamento(wrapper) {
  var blocos = wrapper.querySelectorAll('div, p');
  for (var i = 0; i < blocos.length; i++) {
    var el = blocos[i];
    var temAlinhamento = !!(el.style && el.style.textAlign) || !!el.getAttribute('align');
    if (!temAlinhamento) return el;
  }
  return null;
}

// Detecta alinhamento "unificado" do conteúdo, para aplicar no wrapper
// (necessário pro TESI/Telerik, que ignora text-align em elementos internos).
//
// Regra: só retorna um alinhamento se TODOS os filhos diretos do wrapper
// forem blocos (<div>/<p>) com o MESMO alinhamento explícito (ignorando
// <br>s soltos e whitespace). Se houver texto inline solto, elemento inline
// (<strong>, <span>) solto, ou bloco sem alinhamento — é considerado misto
// e retorna '' (wrapper fica neutro, e cada <div style="text-align:...">
// preservado serve o Word por parágrafo).
//
// Cobre style.textAlign, atributo align (Firefox/legacy), e normaliza
// vendor prefixes (-webkit-center → center).
function _detectarAlinhamentoDominante(wrapper) {
  var alinhamentoUnificado = null;
  var children = wrapper.childNodes;
  for (var i = 0; i < children.length; i++) {
    var node = children[i];
    if (node.nodeType === 3) {
      if (node.nodeValue.trim() !== '') return '';
      continue;
    }
    if (node.nodeType !== 1) continue;
    var tag = node.tagName.toLowerCase();
    if (tag === 'br') continue;
    if (tag !== 'div' && tag !== 'p') return '';
    var align = '';
    if (node.style && node.style.textAlign) {
      align = node.style.textAlign.trim().toLowerCase();
    } else if (node.getAttribute('align')) {
      align = node.getAttribute('align').trim().toLowerCase();
    }
    if      (align === '-webkit-center' || align === 'center') align = 'center';
    else if (align === '-webkit-right'  || align === 'right')  align = 'right';
    else if (align === '-webkit-left'   || align === 'left')   align = 'left';
    else if (align === 'justify' || align === 'justify-all')   align = 'justify';
    else return '';
    if (alinhamentoUnificado === null) alinhamentoUnificado = align;
    else if (alinhamentoUnificado !== align) return '';
  }
  if (alinhamentoUnificado === null) return '';
  return alinhamentoUnificado === 'left' ? '' : alinhamentoUnificado;
}

// Remove nomes de fonte que exigem aspas e keyword system-ui — o Telerik do
// TESI decodifica &quot; → " antes de parsear como XML e quebra na primeira
// aspas interna do style="...". Funciona com fontes de uma palavra (Arial).
function _sanitizarFontFamily(font) {
  var s = String(font || '').trim();
  if (!s) return 'Arial, sans-serif';
  s = s.replace(/['"][^'"]*['"]/g, '');
  s = s.replace(/\bsystem-ui\b/gi, '');
  s = s.replace(/,\s*,+/g, ',').replace(/^\s*,|,\s*$/g, '').trim();
  return s || 'Arial, sans-serif';
}

// Empacota o HTML do laudo num <div> com fontFamily/fontSize fixos e copia
// para a área de transferência (HTML + texto). Cai para seleção+execCommand
// se a Clipboard API falhar ou não existir.
async function _copiarSaida(output, fontFamily, fontSize, msgSucesso) {
  var wrapper = document.createElement('div');
  wrapper.style.fontFamily = _sanitizarFontFamily(fontFamily);
  wrapper.style.fontSize = fontSize;
  wrapper.innerHTML = output.innerHTML;
  _desembrulharBlocos(wrapper);
  var alinhamento = _detectarAlinhamentoDominante(wrapper);
  if (alinhamento) wrapper.style.textAlign = alinhamento;
  _normalizarBlocosParaTelerik(wrapper);
  var html = _serializarXhtml(wrapper);
  if (navigator.clipboard && window.ClipboardItem) {
    try {
      await navigator.clipboard.write([new ClipboardItem({
        'text/html':  new Blob([html],             { type: 'text/html' }),
        'text/plain': new Blob([output.innerText], { type: 'text/plain' })
      })]);
      mostrarToast(msgSucesso, '#1a3a1a');
      return;
    } catch (e) { console.warn('[clipboard] write falhou, tentando seleção:', e); }
  }
  try {
    copiarPorSelecao(output);
    mostrarToast(msgSucesso, '#1a3a1a');
  } catch (e) {
    console.error('[clipboard] fallback falhou:', e);
    mostrarToast('❌ Não foi possível copiar — selecione e use Ctrl+C.', '#7a1a1a', 6000);
  }
}

function generateText() {
  var output = montarLaudo();
  if (!output) return;
  try { output.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {}
  if (typeof _flushAutoSave === 'function') _flushAutoSave();
  if (typeof salvarUltimoLaudo === 'function') salvarUltimoLaudo();
  var p = _perfilFormatoAtivo();
  _copiarSaida(output, (p && p.fonte) || 'Arial,sans-serif',
                       (p && p.tamanho) || '12pt', '📋 Laudo gerado e copiado!');
}

function copiarPorSelecao(output) {
  output.focus();
  var sel = window.getSelection(), range = document.createRange();
  range.selectNodeContents(output);
  sel.removeAllRanges(); sel.addRange(range);
  document.execCommand('copy');
  sel.removeAllRanges();
}

// ----------------------------------------------------------
// COPIAR — COM FONTE / TAMANHO
// ----------------------------------------------------------

function reiniciarPagina() {
  // Salva o estado atual como "último laudo" para recuperação caso acionado por engano
  if (typeof salvarUltimoLaudo === 'function') salvarUltimoLaudo();

  // Remove itens criados dinamicamente via dropdowns (classes item-dinamico)
  document.querySelectorAll('.item-dinamico').forEach(function (el) { el.remove(); });

  // Remove também itens em sortable containers cujo checkbox tenha nome com padrão dinâmico
  // (estomago_d1, conclusao_d2 etc.) — fallback caso a classe item-dinamico não tenha sido
  // aplicada por algum motivo
  document.querySelectorAll('.sortable-zone input[type="checkbox"]').forEach(function (cb) {
    if (/_[a-z]+_d\d+$/.test(cb.name) || /_d\d+$/.test(cb.name)) {
      var div = cb.closest('.item');
      if (div) div.remove();
    }
  });

  // Desmarca todos os checkboxes
  document.querySelectorAll('input[type="checkbox"]').forEach(function (cb) { cb.checked = false; });

  // Reseta selects não-essenciais para a primeira opção (mantém a toolbar de fonte intacta)
  document.querySelectorAll('select:not([onchange*="applySize"]):not([onchange*="applyFont"])').forEach(function (sel) {
    if (sel.options.length > 0) sel.selectedIndex = 0;
  });

  // Reaplica defaults dos painéis Gastrite/Atrofia (Estômago) e Geral/Barrett
  // (Esôfago) — repopula selects, zera inputs numéricos (HHD/x/y) e re-renderiza
  // multi-selects de modificadores, paredes etc.
  if (typeof _inicializarPainelEstomago === 'function') _inicializarPainelEstomago();
  if (typeof _inicializarPainelEsofagite === 'function') _inicializarPainelEsofagite();

  // Limpa a caixa de saída e o estado de blocos por seção
  var out = document.getElementById('output');
  if (out) out.innerHTML = '';
  if (typeof _resetarBlocos === 'function') _resetarBlocos();

  // Limpa a caixa do pedido de AP (Anatomo) e a esconde novamente
  var apOut = document.getElementById('ap-output');
  if (apOut) apOut.innerHTML = '';
  var apWrap = document.getElementById('ap-wrap');
  if (apWrap) apWrap.hidden = true;

  // Sai do modo de edição de opções, se estiver ativo
  document.body.classList.remove('mostrar-edit-opts', 'edit-opts-wiggling');

  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (typeof _agendarLiveLaudo === 'function') _agendarLiveLaudo();

  mostrarToast('🔄 Página reiniciada — use "↺ Último laudo" para recuperar.', '#1a3a5a', 3500);
}

function copiarConteudo() {
  if (typeof _flushAutoSave === 'function') _flushAutoSave();
  if (typeof salvarUltimoLaudo === 'function') salvarUltimoLaudo();
  var out = document.getElementById('output');
  if (!out) return;
  var cs = window.getComputedStyle(out);
  _copiarSaida(out, cs.fontFamily || 'Arial,sans-serif', cs.fontSize || '12pt', '📄 Texto copiado!');
}

// ----------------------------------------------------------
// PEDIDO DE ANATOMOPATOLÓGICO (AP)
// ----------------------------------------------------------
// A seção Anatomo (sortable-anatomo) não entra no laudo — alimenta só este
// pedido. Cada linha não vazia do valor de um item checado vira um frasco
// numerado; itens marcados como NOTA DE RODAPÉ ([rodapé] no início do valor)
// vão para o fim, sem número. O marcador vive no `valor` porque serializarSecao
// só persiste nome/valor/id.
var _AP_RODAPE_MARK = '[rodapé]';
var _AP_RODAPE_RE   = /^(?:\s|<br\s*\/?>)*\[rodap[eé]\]\s*/i;
function _apEhRodape(v)    { return _AP_RODAPE_RE.test(v || ''); }
function _apStripRodape(v) { return String(v || '').replace(_AP_RODAPE_RE, ''); }
function _apSetRodape(v, on) {
  var base = _apStripRodape(v);
  return on ? (_AP_RODAPE_MARK + ' ' + base) : base;
}

function gerarPedidoAP() {
  // Itens checados da seção Anatomo, na ordem da seção (DOM). Valor pode ter
  // <br> (itens criados) ou \n (padrão) — cada linha não vazia = um frasco.
  var anatomoFrasco = [];
  var rodapeLinhas  = [];
  Array.prototype.forEach.call(
    document.querySelectorAll('#sortable-anatomo .item'),
    function (div) {
      var cb = div.querySelector('input[type="checkbox"]');
      if (!cb || !cb.checked) return;
      var raw = String(cb.value || '');
      var ehR = _apEhRodape(raw);
      var tmp = document.createElement('div');
      tmp.innerHTML = _apStripRodape(raw).replace(/<br\s*\/?>/gi, '\n');
      var ls = tmp.textContent.split(/\r?\n/)
        .map(function (s) { return s.trim(); })
        .filter(Boolean);
      if (ehR) rodapeLinhas  = rodapeLinhas.concat(ls);
      else     anatomoFrasco = anatomoFrasco.concat(ls);
    }
  );

  if (anatomoFrasco.length === 0 && rodapeLinhas.length === 0) {
    if (typeof mostrarToast === 'function')
      mostrarToast('Nada elegível para o pedido de AP (marque itens da seção Anatomo).', '#7a5a1a', 3800);
    return;
  }

  // Anatomo numerado (1..N); notas de rodapé ao final, sem número, separadas
  // por uma linha em branco do bloco numerado.
  var linhas = [];
  anatomoFrasco.forEach(function (t, i) { linhas.push((i + 1) + '- ' + t); });
  if (rodapeLinhas.length) {
    if (linhas.length) linhas.push('');
    rodapeLinhas.forEach(function (t) { linhas.push(t); });
  }

  var box = document.getElementById('ap-wrap');
  var out = document.getElementById('ap-output');
  if (!out || !box) return;
  out.innerHTML = linhas.join('<br>');
  box.hidden = false;
  try { box.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {}
  if (typeof copiarPedidoAP === 'function') copiarPedidoAP();
}

function copiarPedidoAP() {
  var ap = document.getElementById('ap-output');
  if (!ap || !ap.innerText.trim()) {
    if (typeof mostrarToast === 'function')
      mostrarToast('⚠ Gere o pedido de AP primeiro.', '#7a4000', 3000);
    return;
  }
  _copiarSaida(ap, 'Arial,sans-serif', '12pt', '📋 Pedido de AP copiado!');
}

// Renumera os frascos do pedido de AP após edição manual (ex.: o usuário
// adicionou uma biópsia não prevista). Estratégia:
//   - Normaliza o conteúdo do contenteditable para linhas de texto (cobre os
//     dois modos que o browser usa para quebra: <br> e <div>/<p>).
//   - A PRIMEIRA linha em branco após o bloco numerado marca o início das
//     notas de rodapé — exatamente como gerarPedidoAP() monta a saída. Tudo
//     após esse marcador é preservado sem renumerar.
//   - No bloco numerado, qualquer prefixo "N- " / "N. " / "N) " é removido e
//     substituído por uma contagem 1..N. Linhas sem prefixo (adicionadas pelo
//     usuário) também recebem número, na posição em que estão.
function renumerarPedidoAP() {
  var out = document.getElementById('ap-output');
  if (!out || !out.innerText.trim()) {
    if (typeof mostrarToast === 'function')
      mostrarToast('⚠ Gere o pedido de AP primeiro.', '#7a4000', 3000);
    return;
  }
  // Converte quebras estruturais em \n preservando só o texto.
  var html = out.innerHTML
    .replace(/<br\s*\/?>(?!\s*<\/(?:div|p)>)/gi, '\n')
    .replace(/<\/(?:div|p)>/gi, '\n')
    .replace(/<(?:div|p)[^>]*>/gi, '');
  var tmp = document.createElement('div');
  tmp.innerHTML = html;
  var linhas = tmp.textContent.split(/\n/);

  var rePrefix = /^\s*\d+\s*[-.)]\s*/;
  var saida = [];
  var n = 0;
  var inRodape = false;
  var jaNumerou = false;
  for (var i = 0; i < linhas.length; i++) {
    var t = linhas[i].replace(/ /g, ' ').trim();
    if (!t) {
      // Linha em branco só inicia o rodapé se: (a) já houve numerado antes E
      // (b) a próxima linha não-branca NÃO é numerada. Assim, brancos colados
      // acidentalmente entre dois blocos numerados (ex.: cola do pedido do EDA
      // + frascos digitados do Colono) não disparam o modo rodapé.
      if (jaNumerou && !inRodape) {
        var j = i + 1;
        while (j < linhas.length && !linhas[j].replace(/ /g, ' ').trim()) j++;
        if (j < linhas.length && !rePrefix.test(linhas[j].replace(/ /g, ' ').trim())) {
          inRodape = true;
        }
      }
      continue;
    }
    if (inRodape) { saida.push(t); continue; }
    var semPrefix = t.replace(rePrefix, '');
    n++;
    jaNumerou = true;
    saida.push(n + '- ' + semPrefix);
  }

  // Reinsere o bloco de rodapé separado por uma linha em branco, como no gerador.
  var idxBranco = -1;
  for (var j = 0; j < saida.length; j++) {
    if (/^\d+- /.test(saida[j])) continue;
    idxBranco = j; break;
  }
  var html2 = saida.map(function (s, k) {
    var d = document.createElement('div');
    d.textContent = s;
    return (k === idxBranco ? '<br>' : '') + d.innerHTML;
  }).join('<br>');
  out.innerHTML = html2;

  if (typeof copiarPedidoAP === 'function') copiarPedidoAP();
}

// ----------------------------------------------------------
// FORMATTAÇÃO — TOOLBAR
// ----------------------------------------------------------

function toggleFormat(command) {
  var output = document.getElementById('output');
  if (!output) return;
  output.focus();
  document.execCommand(command);
  output.focus();
}

function applyFont(font) {
  // Aplica no elemento #output para que o texto gerado por checkbox também herde a fonte.
  // Se houver seleção ativa, aplica também via execCommand para sobrescrever inline.
  var output = document.getElementById('output');
  if (output) output.style.fontFamily = font;
  var sel = window.getSelection && window.getSelection();
  if (sel && sel.rangeCount > 0 && !sel.isCollapsed && output && output.contains(sel.anchorNode)) {
    document.execCommand('fontName', false, font);
  }
}

function applySize(size) {
  var sizes = ['8pt', '10pt', '11pt', '12pt', '14pt', '18pt'];
  var idx = parseInt(size, 10);
  if (!(idx >= 1 && idx <= sizes.length)) return;
  var pt = sizes[idx - 1] || '12pt';
  var output = document.getElementById('output');
  if (output) output.style.fontSize = pt;
  var sel = window.getSelection && window.getSelection();
  if (sel && sel.rangeCount > 0 && !sel.isCollapsed && output && output.contains(sel.anchorNode)) {
    document.execCommand('fontSize', false, String(idx));
    var fonts = output.querySelectorAll('font[size="' + idx + '"]');
    fonts.forEach(function (font) {
      font.removeAttribute('size');
      font.style.fontSize = pt;
    });
  }
}

// Atalhos applyBold/Italic/Underline removidos — HTML chama toggleFormat() direto.

// ----------------------------------------------------------
// DELEGADOR DE AÇÕES — alternativa moderna ao onclick inline.
// Use data-action="nomeDaFuncao" no HTML; opcional data-action-arg="…".
// Migração progressiva: novos botões usam data-action; legados ficam com onclick.
// ----------------------------------------------------------
document.addEventListener('click', function (e) {
  var el = e.target.closest && e.target.closest('[data-action]');
  if (!el) return;
  var fnName = el.getAttribute('data-action');
  var fn = window[fnName];
  if (typeof fn !== 'function') {
    console.warn('[data-action] função não encontrada:', fnName);
    return;
  }
  var arg = el.getAttribute('data-action-arg');
  fn.call(el, arg);
});

// ----------------------------------------------------------
// VERIFICAÇÃO DE DEPENDÊNCIAS
// (uso `typeof X` sem `window.` porque let/const globais não viram propriedades de window)
// ----------------------------------------------------------
if (typeof TPL_EDA === 'undefined') {
  console.error('[laudo_eda] ERRO: TPL_EDA nao encontrado — painel_eda.js precisa ser carregado antes');
}
if (typeof escapeRegExp === 'undefined') {
  console.error('[laudo_eda] ERRO: escapeRegExp nao encontrado — core_eda.js precisa ser carregado antes');
}
if (typeof FORMATOS_PADRAO === 'undefined') {
  console.error('[laudo_eda] ERRO: FORMATOS_PADRAO nao encontrado — dados_eda.js precisa ser carregado antes');
}
console.log('[laudo_eda] Modulo carregado, dependencias OK');
