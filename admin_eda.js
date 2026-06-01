// ============================================================
// admin_eda.js — Gerenciamento de Códigos de Acesso
// Dependências: core_eda.js, storage_eda.js
// ============================================================

// ----------------------------------------------------------
// ADMIN — Gerenciar Códigos de Acesso
// ----------------------------------------------------------

function abrirPopupAdmin() {
  if (_modoVisitante) {
    mostrarToast('👤 Modo visitante — esta ação não está disponível.', '#7a4000', 4000);
    return;
  }
  document.getElementById('admin-popup').style.display = 'block';
  document.getElementById('backdrop').classList.add('show');
  listarCodigosAdmin();
}

function fecharPopupAdmin() {
  document.getElementById('admin-popup').style.display = 'none';
  document.getElementById('backdrop').classList.remove('show');
  document.getElementById('admin-codigo-novo').value = '';
}

async function listarCodigosAdmin() {
  var container = document.getElementById('admin-lista-codigos');
  if (!container) return;
  container.innerHTML = '<p style="color:var(--ink3);font-size:13px;padding:8px;text-align:center;">Carregando...</p>';
  try {
    var snapshot = await _firestore.collection('codigos').orderBy('criadoEm', 'desc').get();
    if (snapshot.empty) {
      container.innerHTML = '<p style="color:var(--ink3);font-size:13px;padding:12px;text-align:center;">Nenhum código criado ainda.</p>';
      return;
    }
    var html = '';
    snapshot.forEach(function (doc) {
      var data = doc.data();
      var id = doc.id;
      var criadoEm = data.criadoEm
        ? (data.criadoEm.toDate ? data.criadoEm.toDate().toLocaleString('pt-BR') : data.criadoEm)
        : '-';
      var usadoPor = data.usadoPor || '-';
      var bg = data.usado ? 'rgba(200,70,70,.08)' : 'rgba(42,122,82,.08)';
      var color = data.usado ? '#a04040' : '#1a6a42';
      html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border-bottom:1px solid var(--border2);background:' + bg + ';border-radius:4px;margin-bottom:4px;">' +
        '<div><strong style="font-family:DM Mono,monospace;font-size:14px;color:' + color + ';">' + id + '</strong>' +
        '<br><span style="font-size:11.5px;color:var(--ink3);">Criado: ' + criadoEm + '</span>' +
        (data.usadoPor ? '<br><span style="font-size:11.5px;color:var(--ink3);">Usado por: ' + usadoPor + '</span>' : '') +
        '</div>' +
        '<span style="font-size:12px;font-weight:600;padding:3px 10px;border-radius:10px;background:' + (data.usado ? '#e8c4c4' : '#c4e8d4') + ';color:' + (data.usado ? '#7a3030' : '#1a5a32') + ';">' + (data.usado ? 'Usado' : 'Disponível') + '</span>' +
        '</div>';
    });
    container.innerHTML = html;
  } catch (e) {
    console.error('[listarCodigosAdmin]', e);
    container.innerHTML = '<p style="color:var(--danger);font-size:13px;padding:12px;text-align:center;">Erro ao carregar: ' + e.message + '</p>';
  }
}

async function criarCodigoAdmin() {
  var input = document.getElementById('admin-codigo-novo');
  var codigo = input.value.trim().toUpperCase();
  if (!codigo) {
    mostrarToast('⚠ Digite um código.', '#7a4000', 3000);
    return;
  }
  try {
    var ref = _firestore.collection('codigos').doc(codigo);
    var existente = await ref.get();
    if (existente.exists) {
      mostrarToast('⚠ Código "' + codigo + '" já existe.', '#7a4000', 4000);
      return;
    }
    await ref.set({
      criadoEm: firebase.firestore.FieldValue.serverTimestamp(),
      usado: false,
      usadoPor: null,
      usadoEm: null
    });
    mostrarToast('✓ Código "' + codigo + '" criado com sucesso!', '#1a3a1a', 4000);
    input.value = '';
    listarCodigosAdmin();
  } catch (e) {
    console.error('[criarCodigoAdmin]', e);
    mostrarToast('❌ Erro ao criar código: ' + e.message, '#7a1a1a', 5000);
  }
}

// ----------------------------------------------------------
// VERIFICAÇÃO DE DEPENDÊNCIAS
// (uso `typeof X` sem `window.` porque let/const globais não viram propriedades de window)
// ----------------------------------------------------------
if (typeof _firestore === 'undefined') {
  console.error('[admin_eda] ERRO: _firestore nao encontrado — core_eda.js precisa ser carregado antes');
}
console.log('[admin_eda] Modulo carregado, dependencias OK');
