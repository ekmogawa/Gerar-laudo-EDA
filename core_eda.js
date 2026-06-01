// ============================================================
// CORE — Gerar Laudo EDA (Firebase Edition)
// Globals, Firebase init, Auth, Auto-save, Utilities
// Depende de: dados_eda.js (carregado antes)
// ============================================================

const ADMIN_TEMPLATE_EMAIL = 'ekmogawa@hotmail.com';  // template oficial — sincroniza visitante/publico
const ADMIN_PESSOAL_EMAIL  = 'ekmogawa@gmail.com';    // conta pessoal — também tem acesso admin na UI
const _clone = function (v) { return JSON.parse(JSON.stringify(v)); };
const _dbPadraoSeguro = function () {
  return (typeof DB_PADRAO !== 'undefined') ? DB_PADRAO : {};
};

function _ehAdmin(email) {
  return email === ADMIN_TEMPLATE_EMAIL || email === ADMIN_PESSOAL_EMAIL;
}

// ----------------------------------------------------------
// FIREBASE — instâncias globais
// ----------------------------------------------------------

let _auth      = null;   // firebase.auth()
let _firestore = null;   // firebase.firestore()
let _user      = null;   // usuário autenticado atual
let _modoVisitante  = false;
const _CADASTRO_ABERTO = true; // cadastro reativado

// Entrada para a versão gratuita (free.html) — sem Firebase
function inicializarLivre() {
  let dados = _dbPadraoSeguro();
  inicializar(dados);
}

function inicializarFirebase() {
  if (typeof FIREBASE_CONFIG === 'undefined' ||
      FIREBASE_CONFIG.apiKey === 'COLE_SUA_API_KEY_AQUI') {
    document.body.innerHTML =
      '<div style="font:16px Arial;padding:48px;color:#900;max-width:560px;margin:auto">' +
      '<h2 style="margin-bottom:12px">⚠ Firebase não configurado</h2>' +
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
      let el = document.getElementById(id);
      if (el) el.addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        id === 'auth-password' ? loginUsuario() : registrarUsuario();
      });
    });

    // Oculta aba de cadastro se fechado
    let tabCad = document.getElementById('tab-cadastrar');
    if (tabCad) tabCad.style.display = _CADASTRO_ABERTO ? '' : 'none';

    _auth.onAuthStateChanged(function (user) {
      _user = user;
      _modoVisitante = !!(user && user.isAnonymous);
      document.body.classList.toggle('modo-visitante', _modoVisitante);
      if (user) {
        ocultarModalAuth();
        atualizarStatusUsuario();
        carregarDados();
        // Mostrar botão admin apenas para o administrador
        let btnAdmin = document.getElementById('btn-admin-codigos');
        if (btnAdmin) {
          btnAdmin.style.display = _ehAdmin(user.email) ? '' : 'none';
        }
      } else {
        _modoVisitante = false;
        document.body.classList.toggle('modo-visitante', false);
        mostrarModalAuth();
        atualizarStatusUsuario();
        _limparDOM();
        let btnAdmin = document.getElementById('btn-admin-codigos');
        if (btnAdmin) btnAdmin.style.display = 'none';
      }
    });

  } catch (e) {
    console.error('[Firebase] Erro na inicialização:', e);
    mostrarToast(`❌ Erro ao conectar ao Firebase: ${e.message}`, '#7a1a1a', 10000);
  }
}

// ----------------------------------------------------------
// AUTH — UI
// ----------------------------------------------------------

function mostrarModalAuth() {
  let overlay = document.getElementById('auth-overlay');
  if (overlay) overlay.classList.add('show');
}

function ocultarModalAuth() {
  let overlay = document.getElementById('auth-overlay');
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
  let el = document.getElementById('auth-erro');
  if (el) el.textContent = msg;
}

const _MSGS_AUTH = {
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
  let email = document.getElementById('auth-email').value.trim();
  let senha = document.getElementById('auth-password').value;
  if (!email || !senha) { _mostrarErroAuth('Preencha e-mail e senha.'); return; }
  let btn = document.getElementById('btn-login');
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
  let email  = document.getElementById('cad-email').value.trim();
  let senha  = document.getElementById('cad-password').value;
  let senha2 = document.getElementById('cad-password2').value;
  let codigo = document.getElementById('cad-codigo').value.trim().toUpperCase();

  if (!email || !senha || !codigo) { _mostrarErroAuth('Preencha todos os campos, incluindo o código de acesso.'); return; }
  if (senha !== senha2)            { _mostrarErroAuth('As senhas não coincidem.'); return; }
  if (senha.length < 6)            { _mostrarErroAuth('Mínimo de 6 caracteres na senha.'); return; }

  let btn = document.getElementById('btn-cadastrar');
  btn.disabled = true;

  // 1. Validar o código no Firestore (leitura pública — precisa de regra adequada)
  let codigoDoc;
  try {
    codigoDoc = await _firestore.collection('codigos').doc(codigo).get();
  } catch (e) {
    console.error('[registro] Erro ao ler código:', e);
    btn.disabled = false;
    if (e.code === 'permission-denied') {
      _mostrarErroAuth('As regras do Firestore não permitem validar o código. O administrador precisa liberar leitura pública na coleção "codigos".');
    } else {
      _mostrarErroAuth('Erro de conexão ao validar o código. Tente novamente.');
    }
    return;
  }

  if (!codigoDoc.exists || codigoDoc.data().usado) {
    _mostrarErroAuth('Código de acesso inválido ou já utilizado.');
    btn.disabled = false;
    return;
  }

  // 2. Criar a conta
  let cred;
  try {
    cred = await _auth.createUserWithEmailAndPassword(email, senha);
  } catch (e) {
    _mostrarErroAuth(_MSGS_AUTH[e.code] || e.message);
    btn.disabled = false;
    return;
  }

  // 3. Marcar código como usado
  try {
    await _firestore.collection('codigos').doc(codigo).update({
      usado:    true,
      usadoPor: cred.user.uid,
      usadoEm:  firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (e) {
    console.error('[registro] Conta criada mas FALHA CRÍTICA ao marcar código:', e);
    // Se falhou ao marcar, deleta a conta recém-criada pra evitar uso indevido
    try { await cred.user.delete(); } catch (e2) {}
    btn.disabled = false;
    if (e.code === 'permission-denied') {
      _mostrarErroAuth('❌ Código não pôde ser validado. O administrador precisa ajustar as regras do Firestore para permitir escrita de usuários autenticados na coleção "codigos".');
    } else {
      _mostrarErroAuth(`❌ Erro ao marcar código como usado: ${e.message}`);
    }
    return;
  }

  // 4. Copiar banco do template para o novo usuário
  try {
    const baseInicial = await _lerTemplateInicial('eda');
    await _firestore.collection('users').doc(cred.user.uid).set({
      email: email,
      slotsEDA: {
        slot1: baseInicial,
        slot2: null,
        ativo: 'slot1'
      },
      atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch (e) {
    console.error('[registro] Erro ao criar documento do usuário:', e);
  } finally {
    btn.disabled = false;
  }
}

async function entrarComoVisitante() {
  let btn = document.getElementById('btn-visitante');
  if (btn) { btn.disabled = true; btn.textContent = 'Aguarde…'; }
  try {
    await _auth.signInAnonymously();
  } catch (e) {
    _mostrarErroAuth(
      e.code === 'auth/operation-not-allowed'
        ? 'Acesso como visitante não habilitado. Contate o administrador.'
        : `Erro: ${e.message || e}`
    );
    if (btn) { btn.disabled = false; btn.textContent = '👤 Entrar como Visitante'; }
  }
}

async function resetarSenha() {
  let email = document.getElementById('auth-email').value.trim();
  if (!email) { _mostrarErroAuth('Digite seu e-mail acima para redefinir a senha.'); return; }
  try {
    await _auth.sendPasswordResetEmail(email);
    _mostrarErroAuth('');
    mostrarToast('📧 E-mail de redefinição enviado!', '#1a3a1a', 5000);
  } catch (e) {
    _mostrarErroAuth(_MSGS_AUTH[e.code] || e.message);
  }
}

async function sairUsuario() {
  if (!await confirmar('Deseja sair?')) return;
  // Redes restritivas (ex.: proxy/firewall de hospital) podem bloquear ou
  // "segurar" as chamadas aos endpoints de auth do Google, fazendo o signOut()
  // travar ou rejeitar. Sem proteção, o usuário ficaria preso no modo visitante
  // sem nenhum feedback. Corre o signOut() contra um timeout e, se a sessão não
  // tiver caído, força o estado deslogado localmente.
  try {
    await Promise.race([
      _auth.signOut(),
      new Promise(function (resolve) { setTimeout(resolve, 4000); })
    ]);
  } catch (e) {
    console.warn('[logout] signOut falhou:', e);
  }
  // Se o listener onAuthStateChanged não derrubou a sessão (rede travada),
  // garante a saída para o usuário nunca ficar preso.
  if (_auth.currentUser) {
    mostrarToast('⚠ Rede instável — encerrando sessão localmente…', '#7a4000', 5000);
    try {
      // Migra a sessão para a persistência em memória: isso REMOVE a sessão
      // anônima do IndexedDB/localStorage, então o reload abaixo não a restaura
      // mesmo que o signOut() não tenha completado por causa da rede. É uma
      // operação local (não depende de rede), mas mantemos o timeout por garantia.
      await Promise.race([
        _auth.setPersistence(firebase.auth.Auth.Persistence.NONE),
        new Promise(function (resolve) { setTimeout(resolve, 2000); })
      ]);
    } catch (e) {
      console.warn('[logout] setPersistence falhou:', e);
    }
    location.reload();
  }
}

function atualizarStatusUsuario() {
  let el = document.getElementById('user-status');
  if (!el) return;
  if (_user && _modoVisitante) {
    el.innerHTML =
      '<span class="user-email" style="background:rgba(255,180,0,.18);border-color:rgba(255,180,0,.4);color:rgba(255,240,180,.95);">👤 Visitante</span>' +
      '<button class="btn-ghost btn-xs" onclick="sairUsuario()">Sair</button>';
  } else if (_user) {
    el.innerHTML =
      `<span class="user-email">${_user.email}</span>` +
      '<button class="btn-ghost btn-xs" onclick="sairUsuario()">Sair</button>';
  } else {
    el.innerHTML = '';
  }
}

// ----------------------------------------------------------
// BANCO ATIVO
// ----------------------------------------------------------

let _DB = null;

// ----------------------------------------------------------
// AUTO-SAVE
// ----------------------------------------------------------

let _autoSaveAtivo = localStorage.getItem('eda_autosave') === '1';
let _autoSaveTimer = null;
let _temAlteracoes = false;
let _userSlots = null;
let _userFormatos = null;   // perfis de formatação do usuário (espelha formatosEDA do Firestore)
let _autoSavePausado = false;

function agendarAutoSave() {
  if (_modoVisitante) return;
  _temAlteracoes = true;
  atualizarIndicadorSalvo();
  if (typeof _agendarLiveLaudo === 'function') _agendarLiveLaudo();
  if (_autoSavePausado) return;
  if (!_autoSaveAtivo) return;
  clearTimeout(_autoSaveTimer);
  _autoSaveTimer = setTimeout(salvarDados, 500);
}

// Garante que nenhuma alteração pendente se perca: salva imediatamente quando
// a aba é escondida/fechada ou em pontos de "commit" (copiar/gerar). Respeita
// o modelo opt-in do autosave — só salva se ele estiver ativo e houver
// alterações. visibilitychange(hidden) é mais confiável que beforeunload para
// dar tempo à escrita assíncrona do Firestore.
function _flushAutoSave() {
  if (_modoVisitante || _autoSavePausado || !_autoSaveAtivo || !_temAlteracoes) return;
  clearTimeout(_autoSaveTimer);
  _autoSaveTimer = null;
  try { salvarDados(); } catch (e) { console.warn('[autosave flush]', e); }
}

if (typeof window !== 'undefined' && !window._autoSaveFlushHooked) {
  window._autoSaveFlushHooked = true;
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') _flushAutoSave();
  });
  window.addEventListener('pagehide', _flushAutoSave);
}

// HISTÓRICO + BUSCA RÁPIDA — ver historico_eda.js

function toggleAutoSave() {
  if (_modoVisitante) {
    mostrarToast('👤 Modo visitante — esta ação não está disponível.', '#7a4000', 4000);
    return;
  }
  _autoSaveAtivo = !_autoSaveAtivo;
  localStorage.setItem('eda_autosave', _autoSaveAtivo ? '1' : '0');
  atualizarBotaoAutoSave();
  if (typeof refrescarMenuSalvar === 'function') refrescarMenuSalvar();
  // Não salva imediato ao ativar — espera próxima alteração disparar agendarAutoSave.
}

function atualizarBotaoAutoSave() {
  // Botão "btn-autosave" é legacy (não existe no HTML atual). O indicador real
  // é o badge "sb-state-autosave" no submenu, atualizado via refrescarMenuSalvar.
  let btn = document.getElementById('btn-autosave');
  if (btn) {
    if (_autoSaveAtivo) {
      btn.textContent = '🔄 Auto-save: ON';
      btn.className   = 'btn-save btn-autosave-on';
    } else {
      btn.textContent = '🔄 Auto-save: OFF';
      btn.className   = 'btn-ghost';
    }
  }
  // Sincroniza também o badge do submenu, se já estiver disponível
  let badge = document.getElementById('sb-state-autosave');
  if (badge) {
    badge.textContent = _autoSaveAtivo ? 'ON' : 'OFF';
    badge.classList.toggle('on', _autoSaveAtivo);
  }
}

function atualizarIndicadorSalvo() {
  let el = document.getElementById('save-indicator');
  if (!el) return;
  el.textContent = _temAlteracoes ? '● Não salvo' : '✓ Salvo';
  el.style.opacity = _temAlteracoes ? '0.75' : '0.4';
}

// ----------------------------------------------------------
// UTILITÁRIOS
// ----------------------------------------------------------

function mostrarToast(msg, cor, duracao) {
  let t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.style.background = cor || '#1a3a1a';
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(function () { t.classList.remove('show'); }, duracao || 3200);
}

// ----------------------------------------------------------
// HANDLER GLOBAL DE ERRO — surface erros não capturados ao usuário
// via toast (em vez de falhar mudo) e registra no console com contexto.
// Fundação para telemetria do SaaS (enviar a um sink remoto futuramente).
// NÃO chama preventDefault: o erro continua aparecendo no console nativo.
// Throttle: no máximo um toast a cada 5s para não inundar a tela.
// ----------------------------------------------------------
var _ultimoToastErro = 0;
function _notificarErroGlobal(origem, detalhe) {
  console.error('[erro:' + origem + ']', detalhe);
  var agora = Date.now();
  if (agora - _ultimoToastErro < 5000) return;   // throttle anti-flood
  _ultimoToastErro = agora;
  if (typeof mostrarToast === 'function')
    mostrarToast('⚠ Ocorreu um erro inesperado. Se persistir, recarregue a página.', '#7a2a2a', 5000);
}

window.addEventListener('error', function (e) {
  // Ignora erros de carregamento de recurso (img/script) — só erros de JS reais.
  if (!e || (!e.error && !e.message)) return;
  _notificarErroGlobal('js', e.error || e.message);
});
window.addEventListener('unhandledrejection', function (e) {
  _notificarErroGlobal('promise', e && e.reason);
});

// Confirmação modal estilizada (substitui o confirm() nativo).
function confirmar(mensagem, opts) {
  opts = opts || {};
  return new Promise(function (resolve) {
    let ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(5,20,12,.45);z-index:99997;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(3px);';
    let box = document.createElement('div');
    box.style.cssText = 'background:#fff;border-radius:10px;width:min(94vw,440px);box-shadow:0 10px 40px rgba(0,0,0,.25);font-family:DM Sans,sans-serif;padding:22px 22px 16px;';
    let msg = document.createElement('div');
    msg.style.cssText = 'color:#172418;font-size:15px;line-height:1.5;white-space:pre-line;margin-bottom:18px;';
    msg.textContent = mensagem;
    let btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;';
    let btnCancel = document.createElement('button');
    btnCancel.className = 'btn-ghost';
    btnCancel.textContent = opts.cancelText || 'Cancelar';
    let btnOk = document.createElement('button');
    btnOk.className = opts.danger ? 'btn-red' : 'btn-primary';
    btnOk.textContent = opts.okText || 'OK';
    btnRow.appendChild(btnCancel);
    btnRow.appendChild(btnOk);
    box.appendChild(msg);
    box.appendChild(btnRow);
    ov.appendChild(box);
    document.body.appendChild(ov);

    function fechar(valor) {
      document.removeEventListener('keydown', onKey, true);
      ov.remove();
      resolve(valor);
    }
    function onKey(e) {
      if (e.key === 'Escape')     { e.preventDefault(); e.stopPropagation(); fechar(false); }
      else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); fechar(true); }
    }
    btnCancel.addEventListener('click', function () { fechar(false); });
    btnOk.addEventListener('click',     function () { fechar(true); });
    ov.addEventListener('click', function (e) { if (e.target === ov) fechar(false); });
    document.addEventListener('keydown', onKey, true);
    setTimeout(function () { btnOk.focus(); }, 30);
  });
}

let _contadorDinamico = 0;

function createCheckboxDiv(text, name) {
  let div = document.createElement('div');
  div.className = 'item item-dinamico';
  div.setAttribute('data-populated', '1');
  let nomeUnico = `${name}_d${++_contadorDinamico}`;
  let cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.name = nomeUnico;
  cb.id = nomeUnico;
  cb.value = text;
  cb.checked = true;
  let lbl = document.createElement('label');
  lbl.id = nomeUnico + '_lbl';
  // Associação a11y via aria-labelledby (não `for`): leitores de tela ligam
  // label↔checkbox sem ativar o toggle nativo do label — o clique já é tratado
  // pelo handler do item (dnd_eda.js), então `for` causaria duplo-toggle.
  cb.setAttribute('aria-labelledby', lbl.id);
  lbl.innerHTML = text;
  div.appendChild(cb);
  div.appendChild(lbl);
  return div;
}

// Cria um item de Conclusão específico: usa `name` (não único) para que
// a checkbox criada na Conclusão compartilhe o mesmo `name` do item origem
// (assim a sincronização por nome funciona). Retorna a div pronta.
function createConclusaoDiv(text, name) {
  let div = document.createElement('div');
  div.className = 'item item-dinamico';
  div.setAttribute('data-populated', '1');
  let id = `${name}-concl-${++_contadorDinamico}`;
  let cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.name = name; // mantém o mesmo name para sincronização
  cb.id = id;
  cb.value = text;
  cb.checked = true;
  // Armazenar o texto de conclusão também como data attribute
  cb.dataset.conclusao = text;
  let lbl = document.createElement('label');
  lbl.id = id + '_lbl';
  cb.setAttribute('aria-labelledby', lbl.id);
  lbl.innerHTML = text;
  div.appendChild(cb);
  div.appendChild(lbl);
  return div;
}

function appendToSortable(elementId, div) {
  document.getElementById(elementId).appendChild(div);
  if (typeof _agendarLiveLaudo === 'function') _agendarLiveLaudo();
}

// Insere `div` no container, posicionando por seção de origem quando
// `section` é fornecido ('esofago' | 'estomago'). Dentro de uma mesma
// chamada síncrona (lote do painel) mantém a ordem original: a 1ª inserção
// vai para o topo da zona, as seguintes ficam logo abaixo dela. Um microtask
// reseta o lote — painéis disparados em momentos diferentes empilham com o
// mais recente no topo.
// - section='esofago' ou sem section: insere no TOPO (comportamento atual).
// - section='estomago': insere após o último item de esôfago, antes do
//   primeiro item de estômago já existente.
let _topoBatch = { container: null, ultimoNo: null };

function appendAfterLastChecked(elementId, div, section) {
  let container = document.getElementById(elementId);
  if (!container) return;

  if (section) div.dataset.section = section;

  if (_topoBatch.container === container &&
      _topoBatch.ultimoNo && _topoBatch.ultimoNo.parentNode === container) {
    // Mesmo batch: manter ordem (inalterado)
    container.insertBefore(div, _topoBatch.ultimoNo.nextSibling);
  } else {
    // Novo batch: lógica de posicionamento por seção
    if (!section || section === 'esofago') {
      // Esôfago ou sem seção: topo (comportamento atual)
      container.insertBefore(div, container.firstChild);
    } else {
      // Inserção por seção: suportamos 'estomago' e 'duodeno'. Objetivo:
      // ordenar conclusões como: esofago → estomago → duodeno.
      if (section === 'estomago') {
        // Estômago: inserir antes do primeiro estômago existente (lote mais
        // recente no topo da zona) ou após o último esôfago quando não
        // houver estômago salvo ainda.
        var firstEstomago = container.querySelector('[data-section="estomago"]');
        if (firstEstomago) {
          container.insertBefore(div, firstEstomago);
        } else {
          var esofagos = container.querySelectorAll('[data-section="esofago"]');
          var lastEsofago = esofagos[esofagos.length - 1];
          if (lastEsofago) {
            container.insertBefore(div, lastEsofago.nextSibling);
          } else {
            container.insertBefore(div, container.firstChild);
          }
        }
      } else if (section === 'duodeno') {
        // Duodeno: inserir após os itens de estômago já existentes; se não
        // houver estômago, após os esôfago; caso contrário topo.
        var lastDuodeno = container.querySelectorAll('[data-section="duodeno"]');
        lastDuodeno = lastDuodeno[lastDuodeno.length - 1];
        if (lastDuodeno) {
          container.insertBefore(div, lastDuodeno.nextSibling);
        } else {
          var lastEstomago = container.querySelectorAll('[data-section="estomago"]');
          lastEstomago = lastEstomago[lastEstomago.length - 1];
          if (lastEstomago) {
            container.insertBefore(div, lastEstomago.nextSibling);
          } else {
            var esofagos = container.querySelectorAll('[data-section="esofago"]');
            var lastEsofago = esofagos[esofagos.length - 1];
            if (lastEsofago) {
              container.insertBefore(div, lastEsofago.nextSibling);
            } else {
              container.insertBefore(div, container.firstChild);
            }
          }
        }
      } else {
        // Fallback: tratar como estomago (compatibilidade) — mesmo comportamento
        var firstEstomago = container.querySelector('[data-section="estomago"]');
        if (firstEstomago) {
          container.insertBefore(div, firstEstomago);
        } else {
          var esofagos = container.querySelectorAll('[data-section="esofago"]');
          var lastEsofago = esofagos[esofagos.length - 1];
          if (lastEsofago) {
            container.insertBefore(div, lastEsofago.nextSibling);
          } else {
            container.insertBefore(div, container.firstChild);
          }
        }
      }
    }
  }

  _topoBatch.container = container;
  _topoBatch.ultimoNo = div;
  Promise.resolve().then(function () {
    _topoBatch.container = null;
    _topoBatch.ultimoNo = null;
  });
  if (typeof _agendarLiveLaudo === 'function') _agendarLiveLaudo();
}

// ----------------------------------------------------------
// INICIALIZAÇÃO
// ----------------------------------------------------------

const _SECOES = [
  { sortable: 'sortable-equipamento', chave: 'equipamento' },
  { sortable: 'sortable-sedacao',     chave: 'sedacao' },
  { sortable: 'sortable-esofago',     chave: 'esofago' },
  { sortable: 'sortable-estomago',    chave: 'estomago' },
  { sortable: 'sortable-duodeno',     chave: 'duodeno' },
  { sortable: 'sortable-jejuno',      chave: 'jejuno' },
  { sortable: 'sortable-conclusao',   chave: 'conclusao' },
  { sortable: 'sortable-outros',      chave: 'outros' },
  { sortable: 'sortable-custom1',     chave: 'custom1' },
  { sortable: 'sortable-custom2',     chave: 'custom2' },
  { sortable: 'sortable-custom3',     chave: 'custom3' },
  { sortable: 'sortable-custom4',     chave: 'custom4' },
  { sortable: 'sortable-anatomo',     chave: 'anatomo' }
];

function inicializar(dados) {
  if (!dados) return;
  window._inicializado = true;
  _DB = _clone(dados);

  _migrarItensNovos(_DB);

  _SECOES.forEach(function (s) { popularCheckboxSection(s.sortable, _DB[s.chave]); });

  // Seções personalizadas: migração silenciosa + visibilidade/rótulos na UI.
  if (!_DB.secoesCustom || typeof _DB.secoesCustom !== 'object') _DB.secoesCustom = {};
  if (typeof SECOES_CUSTOM !== 'undefined') {
    SECOES_CUSTOM.forEach(function (s) {
      var c = _DB.secoesCustom[s.qual];
      if (!c || typeof c !== 'object') c = { ativa: false, rotulo: '' };
      if (c.negrito === undefined) c.negrito = true;
      if (c.estilo  === undefined) c.estilo  = 'bloco';
      if (c.quebras === undefined) c.quebras = 1;
      if (c.quebrasAntes === undefined) c.quebrasAntes = 0;
      if (c.itensInline === undefined) c.itensInline = false;
      _DB.secoesCustom[s.qual] = c;
    });
  }
  if (typeof _aplicarSecoesCustom === 'function') _aplicarSecoesCustom();

  let ss = _DB.sedacaoSelects || {};
  popularSelect('fentanil',  ss.fentanil);
  popularSelect('midazolam', ss.midazolam);

  // Painel de descritores do Estômago — garante que todas as chaves existem,
  // preenchendo do DB_PADRAO o que estiver faltando (migração silenciosa)
  if (_dbPadraoSeguro().estomagoPainel) {
    if (!_DB.estomagoPainel) _DB.estomagoPainel = {};
    Object.keys(_dbPadraoSeguro().estomagoPainel).forEach(function (k) {
      if (!Array.isArray(_DB.estomagoPainel[k]) || _DB.estomagoPainel[k].length === 0) {
        _DB.estomagoPainel[k] = _clone(_dbPadraoSeguro().estomagoPainel[k]);
      }
    });
    // Migração específica para mucosaEstado: mesclar novos campos
    // (textoIgual, textoMesmoDet, textoDiferente, texto) em itens
    // existentes que ainda não os possuem
    var mucUser = _DB.estomagoPainel.mucosaEstado;
    var mucPadrao = _dbPadraoSeguro().estomagoPainel.mucosaEstado;
    if (Array.isArray(mucUser) && Array.isArray(mucPadrao)) {
      mucUser.forEach(function (item) {
        var padrao = mucPadrao.find(function (p) { return p.label === item.label; });
        if (padrao) {
          if (item.textoIgual === undefined) item.textoIgual = padrao.textoIgual;
          if (item.textoMesmoDet === undefined) item.textoMesmoDet = padrao.textoMesmoDet;
          if (item.textoDiferente === undefined) item.textoDiferente = padrao.textoDiferente;
          if (item.texto === undefined) item.texto = padrao.texto;
        }
      });
    }
    // Migração: textoIgual de "erosões" (mesmo estado, frequência diferente
    // entre corpo e antro) passou a mencionar as duas regiões. Só reescreve
    // o default antigo, para não sobrepor customizações do admin.
    if (Array.isArray(mucUser)) {
      var erosItem = mucUser.find(function (m) { return m && m.label === 'erosões'; });
      if (erosItem && erosItem.textoIgual === 'A mucosa apresenta {det-corpo} erosões planas recobertas por fibrina em corpo e antro.') {
        erosItem.textoIgual = 'A mucosa apresenta {det-corpo} erosões planas recobertas por fibrina no corpo gástrico e {det-antro} no antro.';
      }
    }
    // Migração: modificador "sufusão hemorrágica" agora mira tokens (dois
    // pares: {intensidade-sing-corpo} e {intensidade-plural-corpo}), sem
    // exigir mudança nos templates. Só reescreve o default antigo conhecido.
    var modGastrite = _DB.estomagoPainel.modificadoresGastrite;
    if (Array.isArray(modGastrite)) {
      var modSuf = modGastrite.find(function (m) { return m && m.label === 'sufusão hemorrágica'; });
      if (modSuf && modSuf.valor === 'edema e enantema moderados difusamente') {
        modSuf.valor  = '{intensidade-sing-corpo}';
        modSuf.extra  = '{intensidade-sing-corpo} com pontos de sufusão hemorrágica no interior de áreas gástricas';
        modSuf.valor2 = '{intensidade-plural-corpo}';
        modSuf.extra2 = '{intensidade-plural-corpo} com pontos de sufusão hemorrágica no interior de áreas gástricas';
      }
    }
    // Migração: template assimétrico passou a usar {intensidade} (grau pelo
    // item de maior peso). Só reescreve se ainda for o default antigo, para
    // não sobrepor customizações do admin.
    var tplGastrite = _DB.estomagoPainel.templatesConclusaoGastrite;
    if (Array.isArray(tplGastrite)) {
      var tplAssim = tplGastrite.find(function (t) {
        return t && t.label === 'Pangastrite enantematosa assimétrica';
      });
      if (tplAssim && tplAssim.valor === '- Pangastrite enantematosa.') {
        tplAssim.valor = '- Pangastrite enantematosa {intensidade}.';
      }
    }
    // Migração ADITIVA: cenários de "atrofia" (corpo) × antro. Só insere se a
    // label estiver ausente — nunca sobrescreve template existente/customizado.
    if (Array.isArray(tplGastrite)) {
      [
        { label: 'Corpo: atrofia',                 valor: '- Gastrite atrófica de provável etiologia autoimune.' },
        { label: 'Corpo atrofia + antro enantema', valor: '- Gastrite atrófica de provável etiologia autoimune associada a gastrite enantematosa {intensidade} do antro.' },
        { label: 'Corpo atrofia + antro erosões',  valor: '- Gastrite atrófica de provável etiologia autoimune associada a gastrite erosiva {intensidade} do antro.' },
        { label: 'Pangastrite atrófica',           valor: '- Gastrite atrófica com provável etiologia autoimune associada a possível atrofia pós infecção por H. pylori em antro.' }
      ].forEach(function (nv) {
        if (!tplGastrite.some(function (t) { return t && t.label === nv.label; })) tplGastrite.push(nv);
      });
    }
    // Migração: a frase fixa do Hiato na Estrutura de Atrofia deixou de usar
    // "em relação" (uniformizada com a Gastrite). Só reescreve o default antigo
    // conhecido — preserva edições manuais via "✎ estrutura". Idempotente.
    var estrAtr = _DB.estomagoPainel.estruturaAtrofia;
    if (Array.isArray(estrAtr)) {
      estrAtr.forEach(function (seg) {
        if (seg && seg.tipo === 'fixo' &&
            seg.texto === 'Hiato diafragmático ajustado em relação ao aparelho, quando visto em retroversão.') {
          seg.texto = 'Hiato diafragmático ajustado ao aparelho, quando visto em retroversão.';
        }
      });
    }
  }

  // Painel Esofagite (Esôfago) — mesma migração silenciosa do estomagoPainel:
  // garante que itensEsofagite/modificadoresEsofagite existam, preenchendo do
  // DB_PADRAO o que estiver faltando (os dados salvos não têm esofagoPainel).
  if (_dbPadraoSeguro().esofagoPainel) {
    if (!_DB.esofagoPainel) _DB.esofagoPainel = {};
    var epPad = _dbPadraoSeguro().esofagoPainel;
    // Barrett mudou de popup→inline (estrutura nova). Se vier do formato
    // antigo (tinha tecnica/conclusao ou falta displasiaAreaFrag), redefine
    // os fragmentos pelo padrão — recurso era novo/não testado, sem
    // customização do admin a preservar.
    var _bAt = _DB.esofagoPainel.barrett;
    if (_bAt && typeof _bAt === 'object' &&
        (_bAt.tecnica || _bAt.conclusao || _bAt.magnificacaoSufixo ||
         !_bAt.displasiaAreaFrag || !_bAt.baseSoCirc) &&
        epPad.barrett) {
      _DB.esofagoPainel.barrett = _clone(epPad.barrett);
    }
    // Esqueleto do Barrett: a medida passou a terminar em "...a partir da
    // transição esofagogástrica" e a transição virou oração relativa
    // (", que coincide..."). Não há editor de UI p/ estas frases e o
    // deep-fill nunca sobrescreve — então migra aqui, trocando SÓ o texto
    // idêntico ao antigo (preserva eventual edição manual). Idempotente.
    if (_bAt && typeof _bAt === 'object' && epPad.barrett) {
      var _barrettAntigo = {
        baseSemCirc:     'calibre e distensibilidade preservados. No terço distal, nota-se mucosa de aspecto colunar digitiforme medindo cerca de {y}cm.',
        baseSoCirc:      'calibre e distensibilidade preservados. No terço distal, nota-se mucosa de aspecto colunar com área circunferencial medindo cerca de {x}cm.',
        baseComCirc:     'calibre e distensibilidade preservados. No terço distal, nota-se mucosa de aspecto colunar com área circunferencial medindo cerca de {x}cm e área digitiforme medindo cerca de {y}cm.',
        transicaoSemHHD: 'A transição esofagogástrica coincide com o pinçamento diafragmático.',
        transicaoComHHD: 'A transição esofagogástrica está deslocada {hhd}cm acima do pinçamento diafragmático.'
      };
      Object.keys(_barrettAntigo).forEach(function (k) {
        if (_bAt[k] === _barrettAntigo[k]) _bAt[k] = epPad.barrett[k];
      });
      if (_bAt.transicaoComHHD === ', que está deslocada {hhd}cm acima do pinçamento diafragmático.') {
        _bAt.transicaoComHHD = epPad.barrett.transicaoComHHD;
      }
    }
    Object.keys(epPad).forEach(function (k) {
      var pad = epPad[k];
      var atual = _DB.esofagoPainel[k];
      if (Array.isArray(pad)) {
        // Listas (itensEsofagite, modificadoresEsofagite): semeia se faltar/vazia.
        if (!Array.isArray(atual) || atual.length === 0) {
          _DB.esofagoPainel[k] = _clone(pad);
        } else if (k === 'itensEsofagite' || k === 'modificadoresEsofagite') {
          if (k === 'modificadoresEsofagite') {
            var temVarizes = atual.some(function (item) {
              return item && typeof item === 'object' &&
                     (item.label || '').trim().toLowerCase() === 'varizes';
            });
            if (!temVarizes) {
              var varizesPad = pad.find(function (item) {
                return item && typeof item === 'object' &&
                       (item.label || '').trim().toLowerCase() === 'varizes';
              });
              if (varizesPad) atual.push(_clone(varizesPad));
            }
          }
          // `conclusao` é campo NOVO (itens E modificadores): ausente OU vazio
          // = "ainda não definido" (nunca uma escolha do usuário), então
          // preenche do DB_PADRAO nos dois casos. Só um texto não-vazio já
          // salvo é preservado — aí sim pode ser customização. Casa por label
          // (trim/lowercase).
          atual.forEach(function (item) {
            if (!item || typeof item !== 'object') return;
            var atualConcl = (item.conclusao == null) ? '' : String(item.conclusao).trim();
            if (atualConcl !== '') return;          // já tem texto → preserva
            var label = (item.label || '').trim().toLowerCase();
            var ref = pad.find(function (p) {
              return p && typeof p === 'object' && (p.label || '').trim().toLowerCase() === label;
            });
            if (ref && ref.conclusao) item.conclusao = ref.conclusao;
          });
        }
      } else if (pad && typeof pad === 'object') {
        // Objeto (barrett): cria se ausente e faz deep-fill SÓ das subchaves
        // faltantes — nunca sobrescreve edição do admin.
        if (!atual || typeof atual !== 'object') {
          _DB.esofagoPainel[k] = _clone(pad);
        } else {
          Object.keys(pad).forEach(function (sub) {
            var subPad = pad[sub];
            var subAt  = atual[sub];
            var faltaArr = Array.isArray(subPad) && (!Array.isArray(subAt) || subAt.length === 0);
            var faltaObj = subPad && typeof subPad === 'object' && !Array.isArray(subPad) &&
                           (!subAt || typeof subAt !== 'object');
            var faltaEsc = (subPad === null || typeof subPad !== 'object') &&
                           (subAt === undefined || subAt === null || subAt === '');
            if (faltaArr || faltaObj || faltaEsc) atual[sub] = _clone(subPad);
          });
        }
      } else if (atual === undefined || atual === null || atual === '') {
        _DB.esofagoPainel[k] = _clone(pad);
      }
    });
  }

  // Toolbar de formatação: o navegador restaura o estado dos <select> entre
  // recarregamentos (bfcache/form restoration), ignorando o atributo
  // `selected`. Sem isto, ter escolhido 11pt uma vez vira o "padrão" no F5.
  // Fixa explicitamente o padrão: Arial / 12pt (value="4").
  var _selTam = document.getElementById('sel-tamanho');
  if (_selTam) _selTam.value = '4';
  var _selFonte = document.getElementById('sel-fonte');
  if (_selFonte) _selFonte.value = 'Arial';

  _inicializarPainelEstomago();
  if (typeof _inicializarPainelEsofagite === 'function') _inicializarPainelEsofagite();

  inicializarSortable();
  inicializarSincronizacaoCheckboxes();
  inicializarConcNormal();
  if (typeof _instalarHandlerEnterBr === 'function') _instalarHandlerEnterBr();

  _temAlteracoes = false;
  atualizarIndicadorSalvo();
  atualizarBotaoAutoSave();

  _instalarHistorico();
  if (!_histAplicando) _resetHistorico();
}

function _idxPorId(arr, id) {
  return arr.findIndex(function (i) { return i && i.id === id; });
}

function _inserirAposOuFim(arr, ancoraIdx, item) {
  if (ancoraIdx >= 0) arr.splice(ancoraIdx + 1, 0, item);
  else arr.push(item);
}

// Bump ao adicionar/alterar migração que REESCREVE valores existentes.
const _SCHEMA_VERSION = 1;

function _migrarItensNovos(db) {
  if (!db) return;
  // Seção Anatomo (alimenta o Pedido de AP; não entra no laudo). Chave nova:
  // só semeia quando ausente — array vazio já conta como presente, nunca
  // sobrescreve edições do usuário. Aditivo: fora do gate de versão.
  if (!Array.isArray(db.anatomo)) {
    db.anatomo = _clone((typeof DB_PADRAO !== 'undefined' && DB_PADRAO.anatomo) ? DB_PADRAO.anatomo : []);
  }

  // As migrações abaixo REESCREVEM valores — rodam só uma vez (gate em
  // localStorage, por navegador) e fazem um snapshot pré-migração recuperável
  // antes de mutar, para que um bug não corrompa o template do usuário sem
  // possibilidade de recuperação. Os guards de conteúdo de cada migração já a
  // tornam idempotente; o gate evita reprocessamento desnecessário a cada load.
  try {
    var _gate = 'eda_schema_migrado_v' + _SCHEMA_VERSION;
    if (localStorage.getItem(_gate) === '1') return;
    var _bkp = 'eda_db_prebackup_v' + _SCHEMA_VERSION;
    if (!localStorage.getItem(_bkp)) {
      localStorage.setItem(_bkp, JSON.stringify({ em: new Date().toISOString(), db: db }));
    }
  } catch (e) { console.warn('[migracao] backup/gate indisponível:', e); }

  if (Array.isArray(db.estomago)) {
    if (_idxPorId(db.estomago, 'checkboxhipocardia') < 0) {
      _inserirAposOuFim(db.estomago, _idxPorId(db.estomago, 'checkboxmi'),
        { nome: 'Hipotonia de cárdia', id: 'checkboxhipocardia', valor: '' });
    }
    let idxFundop = _idxPorId(db.estomago, 'checkbox23');
    if (idxFundop >= 0 && db.estomago[idxFundop].valor !== '') {
      db.estomago[idxFundop].valor = '';
    }
    if (_idxPorId(db.estomago, 'checkboxfundopmig') < 0) {
      _inserirAposOuFim(db.estomago, idxFundop,
        { nome: 'Fundop migrada', id: 'checkboxfundopmig', valor: '' });
    }
  }
  if (db.sedacaoSelects && Array.isArray(db.sedacaoSelects.midazolam)) {
    db.sedacaoSelects.midazolam = db.sedacaoSelects.midazolam.map(function (v) {
      return typeof v === 'string' ? v.replace(/^\s*\+\s*Midazolam\s*/i, '') : v;
    });
  }
  // Migração: liquidoVolume agora carrega a frase completa com "volume" na
  // posição correta ("pequeno volume" / "volume regular"), em vez de só o
  // adjetivo. Valores antigos ("regular"/"pequeno") são reescritos in-place.
  if (db.estomagoPainel && Array.isArray(db.estomagoPainel.liquidoVolume)) {
    db.estomagoPainel.liquidoVolume.forEach(function (op) {
      if (!op) return;
      if (op.valor === 'regular') op.valor = 'volume regular';
      else if (op.valor === 'pequeno') op.valor = 'pequeno volume';
    });
  }

  // Migração ADITIVA: copiar campo `conclusao` do DB_PADRAO para itens
  // top-level das seções esôfago, estomago e duodeno quando ausente.
  try {
    ['esofago', 'estomago', 'duodeno'].forEach(function (sec) {
      if (!Array.isArray(db[sec]) || typeof DB_PADRAO === 'undefined' || !Array.isArray(DB_PADRAO[sec])) return;
      db[sec].forEach(function (item) {
        if (!item || typeof item !== 'object') return;
        var atualConcl = (item.conclusao == null) ? '' : String(item.conclusao).trim();
        if (atualConcl !== '') return; // preserva edição do usuário
        var ref = DB_PADRAO[sec].find(function (p) { return p && (p.nome === item.nome || p.id === item.id); });
        if (ref && ref.conclusao) item.conclusao = ref.conclusao;
      });
    });
  } catch (e) { console.warn('[migracao] copiar conclusao padrao', e); }

  try { localStorage.setItem('eda_schema_migrado_v' + _SCHEMA_VERSION, '1'); } catch (e) {}
}

function _limparDOM() {
  window._inicializado = false;
  _SECOES.forEach(function (s) {
    let el = document.getElementById(s.sortable);
    if (el) el.querySelectorAll('.item[data-populated]').forEach(function (i) { i.remove(); });
  });
  let out = document.getElementById('output');
  if (out) out.innerHTML = '';
  if (typeof _resetarBlocos === 'function') _resetarBlocos();
}

// ----------------------------------------------------------
// BUSCA NO TEMPLATE / BANCO
// ----------------------------------------------------------

function buscarItemCheckboxNoBanco(banco, checkboxId, nome) {
  if (!banco) return null;
  var encontrado = null;
  _SECOES.forEach(function (s) {
    if (encontrado) return;
    var itens = banco[s.chave];
    if (!Array.isArray(itens)) return;
    for (var i = 0; i < itens.length; i++) {
      var item = itens[i];
      if (!item || item.separador) continue;
      if (item.id && item.id === checkboxId) { encontrado = item; return; }
      if ((item.nome + '-' + s.sortable) === checkboxId) { encontrado = item; return; }
    }
  });
  if (!encontrado && nome) {
    _SECOES.forEach(function (s) {
      if (encontrado) return;
      var itens = banco[s.chave];
      if (!Array.isArray(itens)) return;
      for (var j = 0; j < itens.length; j++) {
        var it = itens[j];
        if (it && !it.separador && it.nome === nome) { encontrado = it; return; }
      }
    });
  }
  return encontrado ? _clone(encontrado) : null;
}

function buscarGrupoOptionsNoBanco(banco, dbGroup, dbKey) {
  if (!banco || !banco[dbGroup]) return null;
  var obj = banco[dbGroup];
  var partes = String(dbKey).split('.');   // suporta aninhado: "varizes.numero"
  for (var i = 0; i < partes.length; i++) {
    if (obj == null) return null;
    obj = obj[partes[i]];
  }
  return obj == null ? null : _clone(obj);
}

function normalizarOptionsArray(arr) {
  return (arr || []).map(function (v) {
    if (v && typeof v === 'object' && 'valor' in v) return _clone(v);
    return { valor: v == null ? '' : String(v), label: (v === '' || v == null) ? '-' : String(v) };
  });
}

// ----------------------------------------------------------
// HELPERS COMPARTILHADOS
// ----------------------------------------------------------

function getVal(id) {
  var el = document.getElementById(id);
  return el ? el.value : '';
}

function getSelectedLabel(id) {
  var sel = document.getElementById(id);
  if (!sel || sel.selectedIndex < 0) return '';
  return sel.options[sel.selectedIndex].textContent;
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Dependability check
console.log('[core_eda] Modulo carregado');
