# Gerar Laudo EDA

Aplicação web para geração de laudos de **Endoscopia Digestiva Alta (EDA)** com suporte a Firebase (autenticação, salvamento em nuvem, slots) e funcionalidades de formatação de texto e histórico de edição.

---

## Arquitetura dos Arquivos

O sistema é dividido em **módulos especializados** carregados sequencialmente via `async/await`. A ordem de carregamento respeita as dependências entre módulos.

```
index.html  ←  Loader sequencial (async/await)
   │
   ├── firebase-config.js       (configuração do Firebase — carregado antes do loader)
   ├── dados_eda.js             (DB_PADRAO — dados estáticos do banco)
   ├── core_eda.js              (Firebase, auth, globals, helpers)
   ├── ui_eda.js                (DOM, popups, edição, serialização)
   ├── dnd_eda.js               (Drag & drop — Pointer Events)
   ├── editor_mucosa_eda.js     (Editor especializado Mucosa Estado)
   ├── painel_eda.js            (Painéis Gastrite / Atrofia, TPL_EDA)
   ├── storage_eda.js           (Firestore CRUD, slots, auto-save)
   ├── laudo_eda.js             (Geração, cópia e formatação do laudo)
   ├── admin_eda.js             (Gerenciamento de códigos de acesso)
   └── historico_eda.js         (Desfazer/refazer, busca rápida, menu salvar)
```

---

## Mapa de Funcionalidades por Arquivo

### [`dados_eda.js`](dados_eda.js) — Banco de Dados Estático
| Funcionalidade | Descrição |
|---|---|
| `DB_PADRAO` | Objeto global com todos os dados padrão do sistema (equipamentos, seções, templates de conclusão, etc.) |

---

### [`core_eda.js`](core_eda.js) — Núcleo do Sistema
| Funcionalidade | Descrição |
|---|---|
| `ADMIN_TEMPLATE_EMAIL`, `ADMIN_PESSOAL_EMAIL` | Emails de administradores |
| `_clone()` | Clonagem profunda de objetos (`JSON.parse(JSON.stringify(v))`) |
| `_dbPadraoSeguro()` | Retorna `DB_PADRAO` ou `{}` se indefinido |
| `_ehAdmin()` | Verifica se email é administrador |
| `_auth`, `_firestore`, `_user` | Instâncias globais do Firebase |
| `_modoVisitante`, `_CADASTRO_ABERTO` | Flags de modo visitante e cadastro |
| `inicializarLivre()` | Inicialização para versão gratuita (sem Firebase) |
| `inicializarFirebase()` | Inicialização do Firebase Auth + Firestore |
| `mostrarModalAuth()`, `ocultarModalAuth()` | Controle do modal de autenticação |
| `mostrarTabAuth()` | Alternância entre abas "Entrar" / "Cadastrar" |
| `_mostrarErroAuth()` | Exibição de erros de autenticação |
| `_MSGS_AUTH` | Mapa de códigos de erro → mensagens em português |
| `loginUsuario()` | Login com email/senha |
| `registrarUsuario()` | Cadastro com validação de código de acesso |
| `entrarComoVisitante()` | Modo visitante (sem autenticação) |
| `resetarSenha()` | Recuperação de senha |
| `sairUsuario()` | Logout |
| `atualizarStatusUsuario()` | Atualiza UI com email do usuário logado |
| `_DB` | Referência global aos dados atuais do laudo |
| `_autoSaveAtivo`, `_autoSaveTimer`, `_temAlteracoes`, `_userSlots`, `_autoSavePausado` | Estado global do auto-save |
| `agendarAutoSave()` | Agenda salvamento automático |
| `toggleAutoSave()` | Liga/desliga auto-save |
| `atualizarBotaoAutoSave()` | Atualiza botão de auto-save na UI |
| `atualizarIndicadorSalvo()` | Atualiza indicador visual de "salvo" |
| `mostrarToast()` | Exibe notificação toast |
| `confirmar()` | Modal de confirmação estilizado (substitui `confirm()`) |
| `_contadorDinamico` | Contador global para IDs únicos |
| `createCheckboxDiv()` | Cria elemento de checkbox no DOM |
| `appendToSortable()` | Adiciona elemento a uma zona sortable |
| `_SECOES` | Configuração das seções do laudo (sortable containers) |
| `inicializar()` | Inicialização principal: popula DOM com dados carregados |
| `_idxPorId()` | Busca índice de item por ID em array |
| `_inserirAposOuFim()` | Insere item após âncora ou no final do array |
| `_migrarItensNovos()` | Migra itens novos do DB_PADRAO para o DB do usuário |
| `_limparDOM()` | Limpa o DOM antes de reinicializar |
| `_getVal()` | Obtém valor de um input pelo ID (com fallback seguro) |
| `escapeRegExp()` | Escapa caracteres especiais para uso em RegExp |

---

### [`ui_eda.js`](ui_eda.js) — Interface do Usuário
| Funcionalidade | Descrição |
|---|---|
| `popularCheckboxSection()` | Popula seção de checkboxes a partir de array de itens |
| `popularSelect()` | Popula elemento `<select>` com opções |
| `_editingOptions` | Estado global do editor de opções |
| `_toggleEditOptsMode()` | Alterna modo de edição de opções |
| `editarOptions()` | Abre popup para editar opções de um select |
| `_renderEditorOptions()` | Renderiza lista de opções no editor |
| `_criarLinhaEditorOption()` | Cria linha de edição para uma opção |
| `salvarOptionsEditadas()` | Salva alterações nas opções |
| `restaurarOptionsPadrao()` | Restaura opções para o padrão do DB_PADRAO |
| `inicializarSincronizacaoCheckboxes()` | Sincroniza checkboxes com labels via event delegation |
| `inicializarConcNormal()` | Inicializa toggle de concavidade normal |
| `addParametersedacao()` | Adiciona parâmetros de sedação ao laudo |
| `abrirPopup()` | Abre popup pelo ID |
| `toggleModifierFields()` | Exibe/esconde campos de modificador conforme tipo |
| `showPopup()` | Abre popup de edição (modelo deferido — edições só commitam no Salvar) |
| `_commitEdicoesPopup()` | Walk-and-commit dos edit-groups (nome, valor, find\|\|\|replace, dataset.conclusao + propagação cross-section) |
| `salvarItemEditado()` | Commit + fechar popup |
| `cancelarItemEditado()` | Fecha sem commit (cb nunca foi tocado) |
| `hidePopup()` | Fecha popup de edição |
| `deleteCheckedCheckboxes()` | Remove checkboxes selecionados |
| `showCreatePopup()` | Abre popup de criação |
| `hideCreatePopup()` | Fecha popup de criação |
| `createCheckbox()` | Cria novo checkbox no banco e no DOM |
| `IDS_CONTROLE_EDA` | Set de IDs de seções controladas |
| `serializarSecao()` | Serializa conteúdo de uma seção sortable |
| `montarConteudoJS()` | Gera string JS para exportar dados |
| `coletarDB()` | Coleta estado atual do formulário para objeto JS |
| `_atualizarMucosaDet()` | Atualiza detalhes da mucosa (Gastrite/Atrofia) |
| `_editarMucosaDet()` | Abre edição inline de detalhe da mucosa |
| `_inicializarPainelEstomago()` | Inicializa painéis de Gastrite e Atrofia |
| `fecharTodosPopups()` | Fecha todos os popups abertos |

---

### [`dnd_eda.js`](dnd_eda.js) — Drag & Drop
| Funcionalidade | Descrição |
|---|---|
| `inicializarSortable()` | Inicializa drag & drop em todas as zonas sortable |
| `ativarZona()` | Ativa eventos de drag em uma zona (com MutationObserver) |
| `ativarItem()` | Ativa eventos de drag em um item (Pointer Events) |
| `getAfterElement()` | Calcula posição de drop no drag & drop |

---

### [`editor_mucosa_eda.js`](editor_mucosa_eda.js) — Editor de Mucosa Estado
| Funcionalidade | Descrição |
|---|---|
| `_editarMucosaEstado()` | Abre popup de edição de mucosa (textoIgual/textoDiferente por estado) |
| `_salvarMucosaEstado()` | Salva alterações do editor de mucosa |
| `_renderMucosaEstado()` | Renderiza campos do editor conforme dados atuais |

---

### [`painel_eda.js`](painel_eda.js) — Painéis Gastrite / Atrofia
| Funcionalidade | Descrição |
|---|---|
| `_INT_SING`, `_INT_PLU`, `_INT_FEM` | Mapas de intensidade (singular, plural, feminino) |
| `_FREQ_FEM` | Mapa de frequência de erosões → intensidade |
| `_pregueadoPorKT()` | Determina pregueado mucoso pelo KT (O-0/O-1/O-2/O-3) |
| `_comporMucosaGastrite()` | Compõe descrição da mucosa na gastrite |
| `_comporParagrafoGastrite()` | Compõe parágrafo completo de gastrite |
| `_conclusaoLabelGastrite()` | Determina label de conclusão para gastrite |
| `_comporConclusaoGastrite()` | Compõe texto de conclusão da gastrite |
| `_aplicarModificadorPainel()` | Aplica modificador do painel como checkbox |
| `addGastriteParagrafo()` | Adiciona parágrafo de gastrite ao laudo |
| `_comporMucosaAtrofia()` | Compõe descrição da mucosa na atrofia |
| `_comporParagrafoAtrofia()` | Compõe parágrafo completo de atrofia |
| `_conclusaoLabelAtrofia()` | Determina label de conclusão para atrofia |
| `_comporConclusaoAtrofia()` | Compõe texto de conclusão da atrofia |
| `addAtrofiaParagrafo()` | Adiciona parágrafo de atrofia ao laudo |
| `TPL_EDA` | Template HTML do laudo (constante com estrutura completa) |

---

### [`storage_eda.js`](storage_eda.js) — Persistência (Firestore)
| Funcionalidade | Descrição |
|---|---|
| `carregarDados()` | Carrega dados do Firestore (com migração de slots) |
| `salvarDados()` | Salva dados no Firestore |
| `_recuperarOrfaosSlots()` | Recupera slots órfãos do formato legado |
| `_lerTemplateInicial()` | Lê template inicial do Firestore (EDA ou Colono) |
| `_migrarParaSlots()` | Migra dados do formato legado para o formato de slots |
| `salvarSlot()` | Salva slot específico (1-3) |
| `carregarSlot()` | Carrega slot específico (1-3) |
| `retornarAoInicial()` | Retorna ao template inicial (com confirmação) |
| `_pausarAutoSave()` | Pausa o auto-save temporariamente |

---

### [`laudo_eda.js`](laudo_eda.js) — Geração e Formatação do Laudo
| Funcionalidade | Descrição |
|---|---|
| `_isChecked()` | Verifica se checkbox está marcado |
| `_coletarSecao()` | Coleta texto de seção com separador |
| `_aplicarModificadores()` | Aplica modificadores find/replace ao texto |
| `montarLaudo()` | Monta o laudo completo a partir do estado atual |
| `_envolverHtml()` | Envolve HTML em div com fonte |
| `_copiarSaida()` | Copia saída formatada para a área de transferência |
| `generateText()` | Gera texto do laudo e exibe na área de output |
| `copiarPorSelecao()` | Copia texto selecionado |
| `reiniciarPagina()` | Reinicia página (com salvamento do último laudo) |
| `copiarConteudo()` | Copia conteúdo como texto simples |
| `copiarFormatado()` | Copia conteúdo como HTML formatado |
| `_copiarSaidaCom()` | Copia saída com fonte/tamanho específicos |
| `toggleFormat()` | Alterna formatação (bold/italic/underline) |
| `applyFont()` | Aplica fonte ao output |
| `applySize()` | Aplica tamanho ao output |
| Delegador de eventos (`data-action`) | Roteia cliques para ações baseadas em `data-action` |

---

### [`admin_eda.js`](admin_eda.js) — Administração
| Funcionalidade | Descrição |
|---|---|
| `abrirPopupAdmin()` | Abre popup de administração |
| `fecharPopupAdmin()` | Fecha popup de administração |
| `listarCodigosAdmin()` | Lista códigos de acesso do Firestore |
| `criarCodigoAdmin()` | Cria novo código de acesso |

---

### [`historico_eda.js`](historico_eda.js) — Histórico (Desfazer/Refazer)
| Funcionalidade | Descrição |
|---|---|
| `_histUndo`, `_histRedo`, `_histLast` | Pilhas de desfazer/refazer |
| `_histCapturar()` | Captura snapshot do estado atual |
| `_histRestaurar()` | Restaura estado a partir de snapshot |
| `_histCommit()` | Commit do snapshot atual no histórico |
| `_flushSnapshot()` | Força commit do snapshot pendente |
| `registrarSnapshot()` | Registra snapshot no histórico |
| `desfazer()` | Desfaz última ação |
| `refazer()` | Refaz ação desfeita |
| `salvarUltimoLaudo()` | Salva último laudo no sessionStorage |
| `recuperarUltimoLaudo()` | Recupera último laudo do sessionStorage |
| `atualizarBotoesHistorico()` | Atualiza estado dos botões desfazer/refazer |
| `_agendarLiveLaudo()` | Agenda atualização ao vivo do laudo |
| `_instalarHistorico()` | Instala listeners de histórico |
| `_resetHistorico()` | Reseta pilhas de histórico |
| `toggleMenuSalvar()` | Alterna menu de salvar |
| `fecharMenuSalvar()` | Fecha menu de salvar |
| `toggleSubpasta()` | Alterna subpastas no menu salvar |
| `_formatarDataSlot()` | Formata timestamp para exibição |
| `_slotInfo()` | Obtém informações de um slot |
| `refrescarMenuSalvar()` | Atualiza menu de salvar |
| `toggleCaixaLateral()` | Alterna caixa lateral |

---

### [`index.html`](index.html) — Loader e Estrutura HTML
| Funcionalidade | Descrição |
|---|---|
| `carregarModulo()` | Carrega script via Promise (com cache-busting `?t=`) |
| `domReady()` | Aguarda DOM estar pronto |
| `inicializarSistema()` | Loop `async/await` que carrega módulos em ordem |
| Estrutura HTML | Sidebar, toolbar, seções do laudo, output, popups |

---

### [`styles.css`](styles.css) — Estilos
| Funcionalidade | Descrição |
|---|---|
| Tema escuro | Variáveis CSS para cores, bordas, sombras |
| Layout responsivo | Sidebar, coluna principal, output |
| Drag & drop | Estilos para zonas sortable e itens |
| Popups | Modais de criação, edição, admin |
| Painel estômago | Layout específico para Gastrite/Atrofia |

---

### [`config.js`](config.js) — Configuração GitHub
| Funcionalidade | Descrição |
|---|---|
| `GITHUB_CONFIG` | Token criptografado (AES-256-GCM + PBKDF2) para push automático de dados |

---

## Ordem de Carregamento (Dependências)

```
dados_eda.js           (0) — sem dependências
core_eda.js            (1) — depende de dados_eda.js (DB_PADRAO)
ui_eda.js              (2) — depende de core_eda.js (_getVal, _SECOES, _clone, _dbPadraoSeguro)
dnd_eda.js             (3) — depende de core_eda.js (_SECOES, agendarAutoSave)
editor_mucosa_eda.js   (4) — depende de core_eda.js + ui_eda.js
painel_eda.js          (5) — depende de core_eda.js + ui_eda.js
storage_eda.js         (6) — depende de core_eda.js + ui_eda.js
laudo_eda.js           (7) — depende de core_eda.js + ui_eda.js + painel_eda.js (TPL_EDA)
admin_eda.js           (8) — depende de core_eda.js + storage_eda.js
historico_eda.js       (9) — depende de todos os anteriores
```

Cada módulo possui **verificação de dependências** no final do arquivo (ex: `if (typeof window._getVal === 'undefined') { console.error(...) }`), que ajuda a diagnosticar problemas de ordem de carregamento.

---

## ⚠️ Diretrizes para Manutenção

Ao **adicionar, remover ou renomear funções** em qualquer arquivo:

1. **Atualize este README** — mantenha o mapa de funcionalidades sincronizado com o código.
2. **Verifique as dependências** — se uma função for movida para outro módulo, ajuste a ordem de carregamento em [`index.html`](index.html:61) (array `scriptsParaCarregar`) e as verificações de dependência no final do arquivo.
3. **Mantenha o padrão de nomenclatura** — prefixos como `_` (interno), `_compor*` (composição de texto), `_hist*` (histórico) ajudam na legibilidade.
4. **Teste o console** — após qualquer alteração, verifique se não há mensagens de `ERRO` ou `AVISO` nas verificações de dependência.
5. **Cache** — o loader usa `?t=` com timestamp para cache-busting. Se necessário, force `Ctrl+F5` no navegador.

---

## Tecnologias

- **Firebase** (Auth + Firestore) — autenticação e persistência em nuvem
- **Vanilla JS** (ES5+/ES6+) — sem frameworks ou bundlers
- **CSS Custom Properties** — tema escuro via variáveis CSS
- **Pointer Events** — drag & drop sem flickering
- **Clipboard API** (`ClipboardItem`) — cópia de HTML formatado
- **MutationObserver** — inicialização de zonas de drag & drop
