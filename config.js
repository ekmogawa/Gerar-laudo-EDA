// ============================================================
// CONFIGURAÇÃO — Gerar Laudo Colonoscopia
// O token está criptografado com AES-256-GCM + PBKDF2.
// Repositório pode ser público — sem a senha o token é inútil.
//
// Para gerar este arquivo:
//   1. Abra criptografar_token.html no browser (localmente)
//   2. Cole seu token GitHub e escolha uma senha
//   3. Substitua este arquivo pelo resultado gerado
// ============================================================

// ============================================================
// CONFIGURAÇÃO — Gerar Laudo Colonoscopia
// O token está criptografado com AES-256-GCM + PBKDF2.
// Repositório pode ser público — sem a senha o token é inútil.
// ============================================================

const GITHUB_CONFIG = {
  owner:  'ekmogawa',
  repo:   'Gerar-laudo-EDA',
  branch: 'main',
  path:   'dados_eda.js',

  // Token criptografado — NÃO edite estes valores manualmente
  tokenCriptografado: 'Nq5xiPPdW3uKDdtkPiFZzjIAwc/Lu/IyPAeJ1EtMlCYvYab2Z8HaavZSW+QvglScBeKfxZw7eYU=',
  salt: 'uKolz86dP3HJl2DsO39aYA==',
  iv:   'as+GZvO4cOwVvR9Q',
};
