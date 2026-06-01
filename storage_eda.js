// ============================================================
// storage_eda.js — Firestore CRUD, Slots, Auto-save
// Dependências: core_eda.js, ui_eda.js
// ============================================================

// ----------------------------------------------------------
// FIRESTORE — CARREGAR / SALVAR
// ----------------------------------------------------------

async function carregarDados() {
  if (!_user || !_firestore) return;
  mostrarToast('⌛ Carregando\u2026', '#1a2e3a', 8000);

  if (_modoVisitante) {
    try {
      var vDoc = await _firestore.collection('visitante').doc('publico').get();
      var vData = (vDoc.exists && vDoc.data()) || {};
      var vDados = vData.dbEDA || vData.db
        || _dbPadraoSeguro();
      _carregarFormatos(vData);   // formatos compartilhados do admin (somente leitura)
      inicializar(vDados);
      if (typeof _aplicarFonteNaTela === 'function' && typeof _perfilFormatoAtivo === 'function')
        _aplicarFonteNaTela(_perfilFormatoAtivo());
      mostrarToast('👤 Modo visitante — somente leitura', '#1a3a5a', 3500);
    } catch (e) {
      console.error('[carregarDados visitante]', e);
      inicializar(_dbPadraoSeguro());
      mostrarToast('👤 Visitante (banco padrão)', '#1a3a5a', 3500);
    }
    return;
  }

  try {
    var doc = await _firestore.collection('users').doc(_user.uid).get();
    var dadosFirestore = doc.exists ? doc.data() : {};
    var slots = await _migrarParaSlots(_user.uid, dadosFirestore);

    // Popula cache em memória
    _userSlots = slots ? _clone(slots) : null;
    _carregarFormatos(dadosFirestore);   // perfis de formatação do usuário

    // Carrega o slot ativo
    var slotAtivo = (slots && slots.ativo) || 'slot1';
    var dadosSlot = slots ? slots[slotAtivo] : null;

    if (dadosSlot) {
      inicializar(dadosSlot);
    } else {
      // Fallback: template ou DB_PADRAO
      try {
        var template = await _lerTemplateInicial('eda');
        inicializar(template);
      } catch (e) {
        inicializar(_dbPadraoSeguro());
      }
    }
    // Reflete a fonte/tamanho do perfil de formatação ativo na prévia (#output).
    if (typeof _aplicarFonteNaTela === 'function' && typeof _perfilFormatoAtivo === 'function')
      _aplicarFonteNaTela(_perfilFormatoAtivo());
    mostrarToast('✓ Dados carregados.', '#1a3a1a', 2000);
  } catch (e) {
    console.error('[carregarDados]', e);
    mostrarToast('❌ Erro ao carregar: ' + e.message, '#7a1a1a', 10000);
  }
}

async function salvarDados() {
  if (_modoVisitante) {
    mostrarToast('👤 Modo visitante — salvamento não permitido.', '#7a4000', 4000);
    return;
  }
  if (!_user || !_firestore) {
    mostrarToast('⚠ Faça login para salvar.', '#7a4000', 5000);
    return;
  }
  clearTimeout(_autoSaveTimer);
  mostrarToast('🔄 Salvando\u2026', '#1a2e3a', 6000);
  try {
    var db = coletarDB({ semDinamicos: true });

    // Determina o slot ativo (padrão slot1 se não houver slots ainda)
    var slotAtivo = (_userSlots && _userSlots.ativo) || 'slot1';

    await _firestore.collection('users').doc(_user.uid).update({
      ['slotsEDA.' + slotAtivo]: db,
      ['slotsEDA.' + slotAtivo + 'SalvoEm']: firebase.firestore.FieldValue.serverTimestamp(),
      'slotsEDA.ativo': slotAtivo,
      atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Atualiza cache em memória
    if (!_userSlots) _userSlots = {};
    _userSlots[slotAtivo] = _clone(db);
    _userSlots[slotAtivo + 'SalvoEm'] = new Date();  // aproximação — server timestamp resolverá no próximo load
    _userSlots.ativo = slotAtivo;

    Object.assign(_DB, db);
    _temAlteracoes = false;
    _autoSavePausado = false;
    atualizarIndicadorSalvo();
    mostrarToast('✓ Salvo!', '#1a3a1a', 2500);

    // Sync público apenas para o admin de template
    if (_user.email === ADMIN_TEMPLATE_EMAIL) {
      _firestore.collection('visitante').doc('publico')
        .set({ dbEDA: db }, { merge: true })
        .catch(function (e) { console.warn('[visitante sync]', e); });
    }
  } catch (e) {
    console.error('[salvarDados]', e);
    mostrarToast('❌ Erro ao salvar: ' + e.message, '#7a1a1a', 10000);
  }
}

// ----------------------------------------------------------
// SLOTS
// ----------------------------------------------------------

async function _recuperarOrfaosSlots(uid, dadosFirestore) {
  var chavesOrfas = ['slotsEDA.slot1', 'slotsEDA.slot2', 'slotsEDA.ativo'];
  var orfaos = {};
  chavesOrfas.forEach(function (k) {
    if (dadosFirestore[k] !== undefined) orfaos[k] = dadosFirestore[k];
  });
  if (Object.keys(orfaos).length === 0) return;

  try {
    var docRef = _firestore.collection('users').doc(uid);

    // 1. Reescreve no caminho aninhado correto (update + dotted-path = nested)
    await docRef.update(orfaos);

    // 2. Apaga os campos órfãos literais (nomes com ponto exigem FieldPath)
    var FieldPath = firebase.firestore.FieldPath;
    var FieldValue = firebase.firestore.FieldValue;
    var deleteArgs = [];
    Object.keys(orfaos).forEach(function (k) {
      deleteArgs.push(new FieldPath(k));
      deleteArgs.push(FieldValue.delete());
    });
    await docRef.update.apply(docRef, deleteArgs);

    // 3. Reflete no objeto local pra continuar a migração com os dados corretos
    if (!dadosFirestore.slotsEDA) {
      dadosFirestore.slotsEDA = { slot1: null, slot2: null, ativo: 'slot1' };
    }
    Object.keys(orfaos).forEach(function (k) {
      var sub = k.substring('slotsEDA.'.length);  // 'slot1' / 'slot2' / 'ativo'
      dadosFirestore.slotsEDA[sub] = orfaos[k];
      delete dadosFirestore[k];
    });

    console.log('[recuperacao] Dados de campos órfãos restaurados:', Object.keys(orfaos));
  } catch (e) {
    console.warn('[recuperacao] Erro ao restaurar órfãos:', e);
  }
}

async function _lerTemplateInicial(app) {
  var campo = app === 'colono' ? 'dbColono' : 'dbEDA';
  try {
    var snap = await _firestore.collection('visitante').doc('publico').get();
    var banco = snap.exists ? snap.data()[campo] : null;
    return banco
      ? _clone(banco)
      : _clone(_dbPadraoSeguro());
  } catch (e) {
    console.warn('[lerTemplateInicial] fallback DB_PADRAO', e);
    return _clone(_dbPadraoSeguro());
  }
}

async function _migrarParaSlots(uid, dadosFirestore) {
  // Recuperação one-shot: campos órfãos literais "slotsEDA.slot1" / .slot2 / .ativo
  // (legado do bug em que set({merge:true}) com dotted-path criava nomes literais
  // em vez de campos aninhados — os dados reais do usuário ficaram nesses órfãos)
  await _recuperarOrfaosSlots(uid, dadosFirestore);

  // Se já tem slots, só retorna
  if (dadosFirestore.slotsEDA) return dadosFirestore.slotsEDA;

  var slots;
  // Prefere dbEDA, cai para db (legado)
  var dbAntigo = dadosFirestore.dbEDA || dadosFirestore.db || null;
  if (dbAntigo) {
    // Migração one-shot: db → slot1
    slots = {
      slot1: dbAntigo,
      slot2: null,
      ativo: 'slot1'
    };
    try {
      await _firestore.collection('users').doc(uid).set({
        slotsEDA: slots,
        dbEDA: firebase.firestore.FieldValue.delete(),
        db: firebase.firestore.FieldValue.delete()
      }, { merge: true });
      console.log('[migracao] db → slotsEDA.slot1 + delete');
    } catch (e) {
      console.warn('[migracao] erro ao migrar:', e);
    }
  } else {
    // Sem dados — cria a partir do template
    var template = await _lerTemplateInicial('eda');
    slots = {
      slot1: template,
      slot2: null,
      ativo: 'slot1'
    };
    try {
      await _firestore.collection('users').doc(uid).set({
        slotsEDA: slots,
        email: dadosFirestore.email || _user.email,
        atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    } catch (e) {
      console.warn('[migracao] erro ao criar slots:', e);
    }
  }
  return slots;
}

async function salvarSlot(numSlot) {
  if (_modoVisitante || !_user || !_firestore) {
    mostrarToast('⚠ Faça login para salvar.', '#7a4000', 5000);
    return;
  }

  var slotKey = 'slot' + numSlot;
  var slotJaTinhaDados = !!(_userSlots && _userSlots[slotKey]);

  if (slotJaTinhaDados && _temAlteracoes) {
    var ok = await confirmar('O Slot ' + numSlot + ' já possui dados salvos. Sobrescrever?');
    if (!ok) return;
  }

  var db = coletarDB({ semDinamicos: true });
  await _firestore.collection('users').doc(_user.uid).update({
    ['slotsEDA.' + slotKey]: db,
    ['slotsEDA.' + slotKey + 'SalvoEm']: firebase.firestore.FieldValue.serverTimestamp(),
    'slotsEDA.ativo': slotKey,
    atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
  });

  if (!_userSlots) _userSlots = {};
  _userSlots[slotKey] = _clone(db);
  _userSlots[slotKey + 'SalvoEm'] = new Date();
  _userSlots.ativo = slotKey;
  _DB = _clone(db);
  _temAlteracoes = false;
  _autoSavePausado = false;
  atualizarIndicadorSalvo();
  if (typeof refrescarMenuSalvar === 'function') refrescarMenuSalvar();
  mostrarToast('✓ Slot ' + numSlot + ' salvo', '#1a3a1a', 2500);

  if (_user.email === ADMIN_TEMPLATE_EMAIL) {
    _firestore.collection('visitante').doc('publico')
      .set({ dbEDA: db }, { merge: true })
      .catch(function (e) { console.warn('[visitante sync]', e); });
  }
}

async function carregarSlot(numSlot) {
  if (_modoVisitante) {
    mostrarToast('👤 Modo visitante — esta ação não está disponível.', '#7a4000', 4000);
    return;
  }
  var slotKey = 'slot' + numSlot;
  var dados = _userSlots ? _userSlots[slotKey] : null;

  if (!dados) {
    mostrarToast('Slot ' + numSlot + ' está vazio — salve neste slot primeiro', '#7a4000', 4000);
    return;
  }

  if (_temAlteracoes) {
    var ok = await confirmar(
      'Você tem alterações não salvas. Carregar o Slot ' + numSlot + ' descarta essas alterações. Continuar?'
    );
    if (!ok) return;
  }

  _DB = _clone(dados);
  window._inicializado = false;
  inicializar(_DB);

  if (_userSlots) _userSlots.ativo = slotKey;
  await _firestore.collection('users').doc(_user.uid).update({
    'slotsEDA.ativo': slotKey
  });

  _pausarAutoSave();
  _temAlteracoes = false;
  if (typeof refrescarMenuSalvar === 'function') refrescarMenuSalvar();
  mostrarToast('✓ Slot ' + numSlot + ' carregado', '#1a3a1a', 2500);
}

async function retornarAoInicial() {
  if (_modoVisitante) {
    mostrarToast('👤 Modo visitante — esta ação não está disponível.', '#7a4000', 4000);
    return;
  }
  var ok = await confirmar(
    'Restaurar o banco padrão do administrador descarta as alterações atuais. Continuar?'
  );
  if (!ok) return;

  var banco = await _lerTemplateInicial('eda');
  _DB = banco;
  window._inicializado = false;
  inicializar(_DB);

  _pausarAutoSave();
  _temAlteracoes = true;
  atualizarIndicadorSalvo();
  if (typeof registrarSnapshot === 'function') registrarSnapshot('restaurar banco padrão');
  mostrarToast('Banco padrão restaurado — use Salvar para persistir', '#1a3a1a', 4000);
}

function _pausarAutoSave() {
  clearTimeout(_autoSaveTimer);
  _autoSavePausado = true;
}

// ----------------------------------------------------------
// PERFIS DE FORMATAÇÃO (campo Firestore: formatosEDA)
// ----------------------------------------------------------
// Espelham o mecanismo de slots: cache em memória (_userFormatos) + campo
// formatosEDA no doc do usuário. APENAS perfis criados pelo usuário são
// persistidos; os embutidos (FORMATOS_PADRAO em dados_eda.js) vivem no código.
// `ativo` pode apontar para um id embutido ('classico') ou de usuário.
// _perfilFormatoAtivo()/_catalogoPerfis() (laudo_eda.js) leem _userFormatos.

function _formatosVazio() {
  var ativoPadrao = (typeof FORMATOS_PADRAO !== 'undefined' && FORMATOS_PADRAO.ativo) || 'classico';
  return { perfis: [], ativo: ativoPadrao };
}

// Hidrata _userFormatos a partir de um doc já lido (sem segunda leitura ao
// Firestore). `dados` = doc.data() do usuário ou de visitante/publico.
function _carregarFormatos(dados) {
  var f = dados && dados.formatosEDA;
  _userFormatos = (f && typeof f === 'object') ? _clone(f) : _formatosVazio();
  if (!Array.isArray(_userFormatos.perfis)) _userFormatos.perfis = [];
  if (!_userFormatos.ativo)
    _userFormatos.ativo = (typeof FORMATOS_PADRAO !== 'undefined' && FORMATOS_PADRAO.ativo) || 'classico';
}

function _ehPerfilEmbutido(id) {
  if (typeof FORMATOS_PADRAO === 'undefined' || !FORMATOS_PADRAO.perfis) return false;
  return FORMATOS_PADRAO.perfis.some(function (p) { return p.id === id; });
}

// Persiste _userFormatos no campo formatosEDA (merge). Admin também espelha em
// visitante/publico, igual ao sync de dbEDA em salvarDados/salvarSlot.
async function salvarFormatos() {
  if (_modoVisitante) {
    mostrarToast('👤 Modo visitante — salvamento não permitido.', '#7a4000', 4000);
    return;
  }
  if (!_user || !_firestore) {
    mostrarToast('⚠ Faça login para salvar.', '#7a4000', 5000);
    return;
  }
  if (!_userFormatos) _userFormatos = _formatosVazio();
  try {
    await _firestore.collection('users').doc(_user.uid).set({
      formatosEDA: _userFormatos,
      atualizadoEm: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    if (_user.email === ADMIN_TEMPLATE_EMAIL) {
      _firestore.collection('visitante').doc('publico')
        .set({ formatosEDA: _userFormatos }, { merge: true })
        .catch(function (e) { console.warn('[visitante sync formatos]', e); });
    }
  } catch (e) {
    console.error('[salvarFormatos]', e);
    mostrarToast('❌ Erro ao salvar formato: ' + e.message, '#7a1a1a', 8000);
  }
}

// Define o perfil ativo por id, re-renderiza o laudo e persiste.
async function definirPerfilAtivo(id) {
  if (!_userFormatos) _userFormatos = _formatosVazio();
  _userFormatos.ativo = id;
  if (typeof _agendarLiveLaudo === 'function') _agendarLiveLaudo();
  await salvarFormatos();
}

// Upsert de um perfil de usuário (por id). Embutidos não podem ser sobrescritos.
async function salvarPerfilFormato(perfil) {
  if (!perfil || !perfil.id) return;
  if (_ehPerfilEmbutido(perfil.id)) {
    mostrarToast('Perfil embutido não pode ser editado — duplique-o.', '#7a4000', 4000);
    return;
  }
  if (!_userFormatos) _userFormatos = _formatosVazio();
  var arr = _userFormatos.perfis, achou = false;
  for (var i = 0; i < arr.length; i++) {
    if (arr[i].id === perfil.id) { arr[i] = _clone(perfil); achou = true; break; }
  }
  if (!achou) arr.push(_clone(perfil));
  await salvarFormatos();
}

// Remove um perfil de usuário; se era o ativo, volta ao padrão embutido.
async function excluirPerfilFormato(id) {
  if (!_userFormatos || _ehPerfilEmbutido(id)) return;
  _userFormatos.perfis = _userFormatos.perfis.filter(function (p) { return p.id !== id; });
  if (_userFormatos.ativo === id)
    _userFormatos.ativo = (typeof FORMATOS_PADRAO !== 'undefined' && FORMATOS_PADRAO.ativo) || 'classico';
  if (typeof _agendarLiveLaudo === 'function') _agendarLiveLaudo();
  await salvarFormatos();
}

// ----------------------------------------------------------
// VERIFICAÇÃO DE DEPENDÊNCIAS
// (uso `typeof X` sem `window.` porque let/const globais não viram propriedades de window)
// ----------------------------------------------------------
if (typeof _user === 'undefined') {
  console.error('[storage_eda] ERRO: _user nao encontrado — core_eda.js precisa ser carregado antes');
}
if (typeof _firestore === 'undefined') {
  console.error('[storage_eda] ERRO: _firestore nao encontrado — core_eda.js precisa ser carregado antes');
}
if (typeof _clone === 'undefined') {
  console.error('[storage_eda] ERRO: _clone nao encontrado — core_eda.js precisa ser carregado antes');
}
if (typeof _dbPadraoSeguro === 'undefined') {
  console.error('[storage_eda] ERRO: _dbPadraoSeguro nao encontrado — core_eda.js precisa ser carregado antes');
}
if (typeof inicializar === 'undefined') {
  console.error('[storage_eda] ERRO: inicializar nao encontrado — core_eda.js precisa ser carregado antes');
}
if (typeof coletarDB === 'undefined') {
  console.error('[storage_eda] ERRO: coletarDB nao encontrado — ui_eda.js precisa ser carregado antes');
}
// ----------------------------------------------------------
// TEMPLATE DO ADMINISTRADOR (visitante/publico)
// ----------------------------------------------------------

async function obterTemplateAdminEDA() {
  if (typeof _lerTemplateInicial === 'function' && _firestore) {
    try {
      return await _lerTemplateInicial('eda');
    } catch (e) {
      console.warn('[obterTemplateAdminEDA] fallback DB_PADRAO', e);
    }
  }
  return _clone(_dbPadraoSeguro());
}

console.log('[storage_eda] Modulo carregado, dependencias OK');
