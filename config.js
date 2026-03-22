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
  repo:   'Gerar-Laudo-Colono',
  branch: 'main',
  path:   'dados_colono.js',

  // Token criptografado — NÃO edite estes valores manualmente
  tokenCriptografado: 'Ix4pVcnoFGR1N8P21UwqEYYm0scRS5RuhLD0dFl+48nsm8dsJpisPD0aX8MAhng+KV03BHRfo+A=',
  salt: 'SGsAp2fXvrH6xv881W/blg==',
  iv:   'wiYdKmGo6fCDBoht',
};
