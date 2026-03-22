// ============================================================
// FUNÇÕES — Gerar Laudo EDA
// Depende de: config.js e dados_eda.js (carregados antes)
// ============================================================

// ----------------------------------------------------------
// BANCO ATIVO — _DB para não colidir com dados_eda.js
// ----------------------------------------------------------
var _DB;
(function () {
  var fonte = (typeof DB_PADRAO !== 'undefined') ? DB_PADRAO
            : (typeof DB       !== 'undefined') ? DB
            : null;
  if (!fonte) {
    document.addEventListener('DOMContentLoaded', function () {
      document.body.innerHTML =
        '<div style="font:16px Arial;padding:40px;color:#900">' +
        '&#10060; Erro: <b>dados_eda.js</b> n&#227;o carregou.<br><br>' +
        'Certifique-se de que o reposit&#243;rio cont&#233;m os 4 arquivos:<br>' +
        '<code>index_eda.html &nbsp; config.js &nbsp; dados_eda.js &nbsp; funcoes_eda.js</code>' +
        '</div>';
    });
    return;
  }
  _DB = JSON.parse(JSON.stringify(fonte));
}());

// ----------------------------------------------------------
// UTILITÁRIOS
// ----------------------------------------------------------

function getSelectedOptionValue(selectElement) {
  return selectElement.value;
}

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
  div.className = 'item item-dinamico ui-sortable-handle';
  div.style.display = 'block';
  var nomeUnico = name + '_d' + (++_contadorDinamico);
  div.innerHTML = '<input type="checkbox" name="' + nomeUnico + '" value="' + text + '" checked><label>' + text + '</label>';
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
  itens.forEach(function (item) {
    var div = document.createElement('div');
    div.className = 'item ui-sortable-handle';
    var idPadrao = item.nome + '-' + containerId;
    var id = item.id || idPadrao;
    var valorEscapado = (item.valor || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    div.innerHTML =
      '<input type="checkbox" name="' + item.nome + '" value="' + valorEscapado + '" id="' + id + '">' +
      '<label for="' + id + '" contenteditable="true">' + item.nome + '</label>';
    container.appendChild(div);
  });
}

function popularSelect(id, opcoes) {
  var sel = document.getElementById(id);
  if (!sel) return;
  sel.innerHTML = '';
  opcoes.forEach(function (op) {
    var opt = document.createElement('option');
    if (typeof op === 'string') {
      opt.value = op;
      opt.textContent = op || '-';
    } else {
      opt.value = op.valor !== undefined ? op.valor : op;
      opt.textContent = op.label !== undefined ? op.label : op;
    }
    sel.appendChild(opt);
  });
}

function inicializar() {
  if (!_DB) return;

  popularCheckboxSection('sortable-equipamento', _DB.equipamento);
  popularCheckboxSection('sortable-sedacao',     _DB.sedacao);
  popularCheckboxSection('sortable-esofago',     _DB.esofago);
  popularCheckboxSection('sortable-estomago',    _DB.estomago);
  popularCheckboxSection('sortable-duodeno',     _DB.duodeno);
  popularCheckboxSection('sortable-jejuno',      _DB.jejuno);
  popularCheckboxSection('sortable-conclusao',   _DB.conclusao);
  popularCheckboxSection('sortable-outros',      _DB.outros);

  popularSelect('fentanil',  _DB.sedacaoSelects.fentanil);
  popularSelect('midazolam', _DB.sedacaoSelects.midazolam);

  inicializarSortable();
  inicializarSincronizacaoCheckboxes();
  inicializarConcNormal();
  atualizarStatusGitHub();
}

// ----------------------------------------------------------
// DRAG & DROP
// ----------------------------------------------------------

function inicializarSortable() {
  ['#sortable-equipamento','#sortable-sedacao','#sortable-esofago',
   '#sortable-estomago','#sortable-duodeno','#sortable-jejuno',
   '#sortable-conclusao','#sortable-outros']
  .forEach(function (sel) {
    $(sel).sortable({
      update: function () {
        var c = $(this), items = c.children('.item').get();
        c.empty();
        items.forEach(function (i) { c.append(i); c.append('\n'); });
      }
    });
  });
}

// ----------------------------------------------------------
// SINCRONIZAÇÃO DE CHECKBOXES (por nome)
// ----------------------------------------------------------

function inicializarSincronizacaoCheckboxes() {
  document.addEventListener('change', function (e) {
    if (e.target.type !== 'checkbox') return;
    var name = e.target.name, checked = e.target.checked;
    // Sync by name
    document.querySelectorAll('input[type="checkbox"][name="' + name + '"]').forEach(function (cb) {
      if (cb !== e.target) cb.checked = checked;
    });
    // Lógica "+": HH+LAA etc. marca conclusão correspondente
    if (name.includes('+')) {
      var partes = name.split('+');
      // Parte antes do +
      document.querySelectorAll('#Conclusão input[name="' + partes[0] + '"]').forEach(function (cb) {
        cb.checked = true;
      });
      // Parte depois do +
      if (partes[1]) {
        document.querySelectorAll('#Conclusão input[name$="' + partes[1] + '"]').forEach(function (cb) {
          cb.checked = true;
        });
      }
    }
  });
}

// ----------------------------------------------------------
// CONCNORMAL → marca checkbox4, checkbox11, checkbox26
// ----------------------------------------------------------

function inicializarConcNormal() {
  var concnormal = document.getElementById('concnormal');
  if (!concnormal) return;
  concnormal.addEventListener('change', function () {
    if (concnormal.checked) {
      ['checkbox4','checkbox11','checkbox26'].forEach(function (id) {
        var cb = document.getElementById(id);
        if (cb) cb.checked = true;
      });
    }
  });
}

// ----------------------------------------------------------
// SEDAÇÃO DINÂMICA
// ----------------------------------------------------------

function addParametersedacao() {
  var fentanil  = getSelectedOptionValue(document.getElementById('fentanil'));
  var midazolam = getSelectedOptionValue(document.getElementById('midazolam'));
  var texto = 'Fentanil ' + fentanil + midazolam + ' + Propofol titulado IV.<br>Suplementação de O2 por catéter nasal a 3 L/min.<br>Monitorização de oximetria de pulso e PNI.';
  appendToSortable('sortable-sedacao', createCheckboxDiv(texto, 'sedacao'));
}

// ----------------------------------------------------------
// EDITAR / CRIAR / EXCLUIR ITENS
// ----------------------------------------------------------

function showPopup() {
  var checkboxes = document.querySelectorAll('input[type="checkbox"]:checked');
  var container  = document.getElementById('checkbox-list');
  container.innerHTML = '';
  if (checkboxes.length === 0) {
    container.innerHTML = '<p>Nenhum item selecionado para editar.</p>';
    document.getElementById('popup').style.display = 'block';
    document.getElementById('backdrop').classList.add('show');
    return;
  }
  checkboxes.forEach(function (cb) {
    var label     = document.querySelector('label[for="' + cb.id + '"]');
    var labelText = label ? label.innerText : '';
    var suffix    = cb.id.replace(cb.name, '');
    var itemDiv   = document.createElement('div');
    itemDiv.className = 'edit-group';
    itemDiv.style.cssText = 'border-bottom:1px solid #ccc;padding:10px 0;';
    itemDiv.innerHTML =
      '<div><strong>Nome do Item:</strong><br>' +
      '<input type="text" style="width:300px;margin-bottom:10px;"' +
      ' oninput="updateEverything(\'' + cb.id + '\',this.value,\'' + suffix + '\',this)"' +
      ' value="' + labelText + '"></div>' +
      '<div><strong>Texto da entrada:</strong><br>' +
      '<textarea class="edit-value-input" style="height:60px;width:90%;"' +
      ' oninput="updateOnlyValue(\'' + cb.id + '\',this.value)">' + cb.value + '</textarea></div>';
    container.appendChild(itemDiv);
  });
  document.getElementById('popup').style.display = 'block';
  document.getElementById('backdrop').classList.add('show');
}

function updateEverything(currentId, newName, suffix, inputEl) {
  var checkbox = document.getElementById(currentId);
  var label    = document.querySelector('label[for="' + currentId + '"]');
  var newId    = newName + suffix;
  if (checkbox && label) {
    checkbox.id = newId; checkbox.name = newName;
    label.setAttribute('for', newId); label.innerText = newName;
    inputEl.setAttribute('oninput', 'updateEverything(\'' + newId + '\',this.value,\'' + suffix + '\',this)');
    inputEl.closest('div').parentElement.querySelector('.edit-value-input')
      .setAttribute('oninput', 'updateOnlyValue(\'' + newId + '\',this.value)');
  }
}

function updateOnlyValue(id, newValue) {
  var cb = document.getElementById(id);
  if (cb) cb.value = newValue;
}

function hidePopup() {
  document.getElementById('popup').style.display = 'none';
  document.getElementById('checkbox-list').innerHTML = '';
  document.getElementById('backdrop').classList.remove('show');
}

function deleteCheckedCheckboxes() {
  var checkboxes = document.querySelectorAll('input[type="checkbox"]:checked');
  if (checkboxes.length > 0 && confirm('Deseja excluir os itens selecionados?')) {
    checkboxes.forEach(function (cb) { (cb.closest('.item') || cb.parentElement).remove(); });
    hidePopup();
  }
}

function showCreatePopup() {
  document.getElementById('create-popup').style.display = 'block';
  document.getElementById('backdrop').classList.add('show');
}
function hideCreatePopup() {
  document.getElementById('create-popup').style.display = 'none';
  document.getElementById('backdrop').classList.remove('show');
}

function createCheckbox() {
  var nome      = document.getElementById('checkbox-name').value;
  var valor     = document.getElementById('checkbox-value').value.replace(/\n/g, '<br>');
  var sectionId = document.getElementById('section-select').value;
  var section   = document.getElementById(sectionId);
  var div = document.createElement('div');
  div.className = 'item';
  var cb = document.createElement('input');
  cb.type = 'checkbox'; cb.name = nome; cb.value = valor; cb.id = nome + '-' + sectionId;
  var lbl = document.createElement('label');
  lbl.htmlFor = cb.id; lbl.setAttribute('contenteditable', 'true'); lbl.innerHTML = nome;
  div.appendChild(cb); div.appendChild(lbl);
  section.appendChild(document.createTextNode('\n'));
  section.appendChild(div);
  document.getElementById('create-popup').style.display = 'none';
  document.getElementById('checkbox-name').value  = '';
  document.getElementById('checkbox-value').value = '';
  mostrarToast('✅ Item criado! Clique em "Salvar no GitHub" para persistir.');
}

function uncheckAll() {
  document.querySelectorAll('input[type="checkbox"]').forEach(function (cb) { cb.checked = false; });
}

// ----------------------------------------------------------
// SERIALIZAR DOM → objeto JS
// ----------------------------------------------------------

var IDS_CONTROLE_EDA = new Set([
  'sedacao-sortable'
]);

function serializarSecao(containerId) {
  var container = document.getElementById(containerId);
  if (!container) return [];
  var itens = [];
  container.querySelectorAll(':scope > .item').forEach(function (div) {
    var cb = div.querySelector('input[type="checkbox"]');
    if (!cb || IDS_CONTROLE_EDA.has(cb.id) || IDS_CONTROLE_EDA.has(cb.name)) return;
    var label = div.querySelector('label');
    var nome  = label ? label.innerText.trim() : cb.name;
    if (!nome) return;
    var tmp = document.createElement('textarea');
    tmp.innerHTML = cb.value;
    var item = { nome: nome };
    var idPadrao = nome + '-' + containerId;
    if (cb.id && cb.id !== idPadrao) item.id = cb.id;
    item.valor = tmp.value;
    itens.push(item);
  });
  return itens;
}

function montarConteudoJS(dbObj) {
  return '// ============================================================\n' +
    '// BANCO DE DADOS \u2014 Gerar Laudo EDA\n' +
    '// Salvo em: ' + new Date().toLocaleString('pt-BR') + '\n' +
    '// ============================================================\n\n' +
    'const DB_PADRAO = ' + JSON.stringify(dbObj, null, 2) + ';\n';
}

function coletarDB() {
  var fentanilOpts  = Array.from(document.getElementById('fentanil').options).map(function (o) { return o.value; });
  var midazolamOpts = Array.from(document.getElementById('midazolam').options).map(function (o) { return o.value; });
  return {
    equipamento:    serializarSecao('sortable-equipamento'),
    sedacao:        serializarSecao('sortable-sedacao'),
    sedacaoSelects: { fentanil: fentanilOpts, midazolam: midazolamOpts },
    esofago:        serializarSecao('sortable-esofago'),
    estomago:       serializarSecao('sortable-estomago'),
    duodeno:        serializarSecao('sortable-duodeno'),
    jejuno:         serializarSecao('sortable-jejuno'),
    conclusao:      serializarSecao('sortable-conclusao'),
    outros:         serializarSecao('sortable-outros')
  };
}

// ----------------------------------------------------------
// CONFIGURAÇÃO DO GITHUB
// ----------------------------------------------------------

function lerConfigGitHub() {
  if (typeof GITHUB_CONFIG !== 'undefined') return GITHUB_CONFIG;
  return {};
}

function githubConfigurado() {
  var c = lerConfigGitHub();
  if (c.tokenCriptografado) return !!sessionStorage.getItem('colono_github_token');
  return !!(c.token && c.owner && c.repo);
}

function atualizarStatusGitHub() {
  var el = document.getElementById('github-status');
  if (!el) return;
  var c = lerConfigGitHub();
  if (!c.owner) {
    el.textContent = '⚠️ config.js não configurado';
    el.style.color = 'rgba(255,255,255,.55)';
    return;
  }
  if (c.tokenCriptografado) {
    if (sessionStorage.getItem('colono_github_token')) {
      el.textContent = '✅ GitHub: ' + c.owner + '/' + c.repo + ' (🔓 ativo)';
      el.style.color = 'rgba(255,255,255,.88)';
    } else {
      el.textContent = '🔒 GitHub: ' + c.owner + '/' + c.repo + ' (sessão inativa — recarregue)';
      el.style.color = 'rgba(255,255,255,.62)';
    }
  } else if (c.token) {
    el.textContent = '✅ GitHub: ' + c.owner + '/' + c.repo;
    el.style.color = 'rgba(255,255,255,.88)';
  } else {
    el.textContent = '⚠️ Token não configurado';
    el.style.color = 'rgba(255,255,255,.55)';
  }
}

function pedirSenha(msg) {
  return new Promise(function (resolve) {
    var overlay = document.getElementById('senha-overlay');
    var msgEl   = document.getElementById('senha-msg');
    var input   = document.getElementById('senha-input');
    var btnOk   = document.getElementById('senha-ok');
    var btnCanc = document.getElementById('senha-cancelar');
    msgEl.textContent = msg;
    input.value = '';
    overlay.classList.add('show');
    input.focus();
    function fechar(v) {
      overlay.classList.remove('show');
      btnOk.removeEventListener('click', onOk);
      btnCanc.removeEventListener('click', onCanc);
      input.removeEventListener('keydown', onKey);
      resolve(v);
    }
    function onOk()   { fechar(input.value); }
    function onCanc() { fechar(null); }
    function onKey(e) { if (e.key === 'Enter') fechar(input.value); if (e.key === 'Escape') fechar(null); }
    btnOk.addEventListener('click', onOk);
    btnCanc.addEventListener('click', onCanc);
    input.addEventListener('keydown', onKey);
  });
}

async function descriptografarToken(senha) {
  try {
    if (!window.crypto || !window.crypto.subtle) {
      console.error('[descriptografarToken] crypto.subtle indisponível. A página precisa ser servida via HTTPS ou localhost.');
      return null;
    }
    var c       = lerConfigGitHub();
    var fromB64 = function (b64) { return Uint8Array.from(atob(b64), function (ch) { return ch.charCodeAt(0); }); };
    var salt    = fromB64(c.salt);
    var iv      = fromB64(c.iv);
    var cifrado = fromB64(c.tokenCriptografado);
    console.log('[descriptografarToken] salt bytes:', salt.length, '| iv bytes:', iv.length, '| cifrado bytes:', cifrado.length);
    var keyMat  = await crypto.subtle.importKey('raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveKey']);
    var key     = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: salt, iterations: 200000, hash: 'SHA-256' },
      keyMat, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
    var dec = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, cifrado);
    var token = new TextDecoder().decode(dec);
    console.log('[descriptografarToken] Token decriptografado com sucesso. Tamanho:', token.length, 'chars. Prefixo:', token.substring(0, 6) + '...');
    return token;
  } catch (e) {
    console.error('[descriptografarToken] Falha:', e.name, e.message);
    return null;
  }
}

async function inicializarTokenGitHub() {
  var c = lerConfigGitHub();
  if (!c.tokenCriptografado) { atualizarStatusGitHub(); return; }
  if (sessionStorage.getItem('colono_github_token')) { atualizarStatusGitHub(); return; }
  var tentativas = 0;
  while (tentativas < 3) {
    var msg   = tentativas === 0 ? '🔐 Digite a senha para ativar o GitHub:'
                                 : '❌ Senha incorreta. Tentativa ' + (tentativas + 1) + '/3:';
    var senha = await pedirSenha(msg);
    if (senha === null) break;
    var token = await descriptografarToken(senha);
    if (token) {
      sessionStorage.setItem('colono_github_token', token);
      mostrarToast('🔓 GitHub ativado para esta sessão!', '#1a3a1a');
      atualizarStatusGitHub(); return;
    }
    tentativas++;
  }
  if (tentativas >= 3) mostrarToast('⚠️ Senha incorreta 3×. GitHub inativo nesta sessão.', '#7a1a1a');
  atualizarStatusGitHub();
}

// ----------------------------------------------------------
// SALVAR NO GITHUB
// ----------------------------------------------------------

async function salvarDados() {
  var c     = lerConfigGitHub();
  var token = sessionStorage.getItem('colono_github_token') || c.token;

  if (c.tokenCriptografado && !sessionStorage.getItem('colono_github_token')) {
    await inicializarTokenGitHub();
    if (!sessionStorage.getItem('colono_github_token')) return;
    token = sessionStorage.getItem('colono_github_token');
  }

  if (!c.owner || !c.repo) {
    mostrarToast('⚠️ config.js sem owner/repo. Verifique o arquivo.', '#7a4000', 6000);
    console.error('[salvarDados] GITHUB_CONFIG:', c);
    return;
  }
  if (!token) {
    mostrarToast('⚠️ Token ausente. Verifique config.js ou refaça a autenticação.', '#7a4000', 6000);
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

  console.log('[salvarDados] Iniciando. URL:', apiBase, '| branch:', branch);
  console.log('[salvarDados] Token prefix (primeiros 15 chars):', token ? token.substring(0, 15) + '...' : 'VAZIO');
  mostrarToast('🔄 Enviando para o GitHub…', '#1a2e3a', 10000);

  try {
    var dbAtualizado = coletarDB(); // dentro do try para capturar erros de serialização

    // 1. Busca SHA atual (necessário para atualizar arquivo existente)
    console.log('[salvarDados] GET', apiBase + '?ref=' + branch);
    var getResp = await fetch(apiBase + '?ref=' + encodeURIComponent(branch), { headers: headers });
    console.log('[salvarDados] GET status:', getResp.status);

    if (!getResp.ok && getResp.status !== 404) {
      var errGet = await getResp.json().catch(function () { return {}; });
      throw new Error('Erro ao ler arquivo remoto: ' + (errGet.message || 'HTTP ' + getResp.status));
    }

    var getSha = undefined;
    if (getResp.ok) {
      var getData = await getResp.json().catch(function () { return {}; });
      getSha = getData.sha;
      console.log('[salvarDados] SHA encontrado:', getSha ? getSha.substring(0, 8) + '…' : 'nenhum');
    }

    // 2. Monta e envia o conteúdo
    var conteudo    = montarConteudoJS(dbAtualizado);
    var conteudoB64 = btoa(unescape(encodeURIComponent(conteudo)));
    var body = {
      message: 'Atualização via interface EDA — ' + new Date().toLocaleString('pt-BR'),
      content: conteudoB64,
      branch:  branch
    };
    if (getSha) body.sha = getSha;

    console.log('[salvarDados] PUT', apiBase, '| sha:', getSha ? getSha.substring(0, 8) : 'novo arquivo');
    var putResp = await fetch(apiBase, { method: 'PUT', headers: headers, body: JSON.stringify(body) });
    console.log('[salvarDados] PUT status:', putResp.status);

    if (!putResp.ok) {
      var errPut = await putResp.json().catch(function () { return {}; });
      var msg = errPut.message || ('HTTP ' + putResp.status);
      if (putResp.status === 401) msg = 'Token inválido ou expirado (401). Gere um novo token no GitHub e recrie o config.js.';
      if (putResp.status === 403) msg = 'Sem permissão de escrita (403). O token precisa do escopo "Contents: Read and write".';
      if (putResp.status === 404) msg = 'Repositório ou arquivo não encontrado (404). Verifique owner="' + c.owner + '" repo="' + c.repo + '" path="' + path + '".';
      if (putResp.status === 409) msg = 'Conflito de versão (409). Recarregue a página e tente novamente.';
      if (putResp.status === 422) msg = 'SHA inválido (422). Recarregue a página e tente novamente.';
      throw new Error(msg);
    }

    Object.assign(_DB, dbAtualizado);
    mostrarToast('✅ dados_eda.js salvo no GitHub!', '#1a3a1a', 4000);
    console.log('[salvarDados] Sucesso!');
  } catch (e) {
    mostrarToast('❌ ' + e.message, '#7a1a1a', 8000);
    console.error('[salvarDados] Erro completo:', e);
  }
}

// ----------------------------------------------------------
// GERAR LAUDO — lógica clínica original preservada integralmente
// ----------------------------------------------------------

function generateText() {
  var text = "<strong style='bold'>ENDOSCOPIA DIGESTIVA ALTA</strong><br><br><br>";

  var equipamentoText = "";
  $("#equipamento input[type='checkbox']:checked").each(function() {
    equipamentoText += $(this).val() + "<br><br><br>";
  });
  if (equipamentoText) text += equipamentoText;

  var sedacaoText = "";
  $("#Sedação input[type='checkbox']:checked").each(function() {
    sedacaoText += $(this).val() + "<br><br>";
  });
  if (sedacaoText) {
    if ($("#geral").is(":checked")) {
      text += sedacaoText;
    } else {
      text += "<strong style='bold'>Sedação: </strong>" + sedacaoText;
    }
  }

  var esofagoText = "";
  var deslocadaFound = false;
  $("#Esôfago input[type='checkbox']:checked").each(function() {
    var checkboxValue = $(this).val();
    if (checkboxValue.includes("deslocada")) {
      checkboxValue = checkboxValue.replace("ajustado", "alargado em relação");
      deslocadaFound = true;
    }
    esofagoText += checkboxValue + "<br><br>";
  });

  var estomagoText = "";
  $("#Estômago input[type='checkbox']:checked").each(function() {
    estomagoText += $(this).val() + "<br><br>";
  });

  if (deslocadaFound) {
    estomagoText = estomagoText.replace(/ajustado/g, "alargado em relação");
  }

  if ($("#checkboxmi").is(":checked")) {
    estomagoText = estomagoText.replace(/reduzido/g, "reduzido, além de focos de provável metaplasia intestinal,");
    estomagoText = estomagoText.replace(/<br><br>/, "");
  }

  if (esofagoText)  text += "<strong style='bold'>Esôfago: </strong>"  + esofagoText;
  if (estomagoText) text += "<strong style='bold'>Estômago: </strong>" + estomagoText;

  var duodenoText = "";
  $("#Duodeno input[type='checkbox']:checked").each(function() {
    duodenoText += $(this).val() + "<br><br>";
  });
  if (duodenoText) text += "<strong style='bold'>Duodeno: </strong>" + duodenoText;

  var jejunoText = "";
  $("#Jejuno input[type='checkbox']:checked").each(function() {
    jejunoText += $(this).val() + "<br><br>";
  });
  if (jejunoText) text += "<strong style='bold'>Jejuno: </strong>" + jejunoText;

  var outrosText = "";
  $("#Outros input[type='checkbox']:checked").each(function() {
    outrosText += $(this).val() + "<br><br>";
  });
  if (outrosText) text += outrosText;

  var conclusaoText = "";
  $("#Conclusão input[type='checkbox']:checked").each(function() {
    conclusaoText += $(this).val() + "<br>";
  });

  if ($("#checkboxmi").is(":checked") || $("input[name='MI']").is(":checked")) {
    conclusaoText = conclusaoText.replace(/área de atrofia/, "área de atrofia com metaplasia intestinal");
    conclusaoText = conclusaoText.replace(/atrófica/, "atrófica com metaplasia intestinal");
  }

  if (conclusaoText) text += "<br><strong style='bold'>Conclusão:</strong><br><br>" + conclusaoText;

  if ($("#Outros input[type='checkbox']:checked").length > 0) {
    text = text.replace("<strong style='bold'>ENDOSCOPIA DIGESTIVA ALTA</strong><br><br><br>", "");
  }

  // Converte bold class → inline style para compatibilidade Firefox
  text = text.replace(/<span class='bold'>/g, '<span style="font-weight:bold">')
             .replace(/<span class="bold">/g, '<span style="font-weight:bold">');

  $('#output').html(text);
  var output = document.getElementById('output');

  if (navigator.clipboard && window.ClipboardItem) {
    navigator.clipboard.write([new ClipboardItem({
      'text/html':  new Blob([output.innerHTML], { type: 'text/html' }),
      'text/plain': new Blob([output.innerText],  { type: 'text/plain' })
    })]).then(function () {
      mostrarToast('📋 Laudo gerado e copiado!', '#1a3a1a');
    }).catch(function () { copiarPorSelecao(output); });
  } else {
    copiarPorSelecao(output);
  }
}

function copiarPorSelecao(output) {
  output.focus();
  var sel   = window.getSelection();
  var range = document.createRange();
  range.selectNodeContents(output);
  sel.removeAllRanges();
  sel.addRange(range);
  document.execCommand('copy');
  sel.removeAllRanges();
  mostrarToast('📋 Laudo gerado e copiado!', '#1a3a1a');
}

// ----------------------------------------------------------
// COPIAR
// ----------------------------------------------------------

function copiarConteudo() {
  var output = document.getElementById('output');
  if (navigator.clipboard && window.ClipboardItem) {
    navigator.clipboard.write([new ClipboardItem({
      'text/html':  new Blob([output.innerHTML], { type: 'text/html' }),
      'text/plain': new Blob([output.innerText],  { type: 'text/plain' })
    })]).then(function () {
      mostrarToast('📄 Texto copiado!');
    }).catch(function () { copiarPorSelecao(output); mostrarToast('📄 Texto copiado!'); });
  } else {
    copiarPorSelecao(output);
    mostrarToast('📄 Texto copiado!');
  }
}

async function copiarFormatado() {
  var output = document.getElementById('output');
  var html = '<div style="font-family:Arial,sans-serif;font-size:11pt;">' + output.innerHTML + '</div>';
  if (navigator.clipboard && window.ClipboardItem) {
    try {
      await navigator.clipboard.write([new ClipboardItem({
        'text/html':  new Blob([html],              { type: 'text/html' }),
        'text/plain': new Blob([output.innerText],  { type: 'text/plain' })
      })]);
      mostrarToast('🖨️ Copiado em fonte 11!');
      return;
    } catch (e) { /* fallback */ }
  }
  copiarPorSelecao(output);
  mostrarToast('🖨️ Copiado em fonte 11!');
}

// ----------------------------------------------------------
// INICIALIZA
// ----------------------------------------------------------
// inicializar() é chamado diretamente pelo loader no index_eda.html
