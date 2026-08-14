# Changelog

Todas as mudanças relevantes do projeto Cronômetro Operacional (Farmácia / CD Solar) ficam registradas aqui, em ordem cronológica reversa. Referências de bloco (B0, B1...) seguem a Seção 12 do `PLANO_CRONOANALISE.md`.

## 2026-08-14

### Adicionado

- **B0 — Fundação**: projeto Next.js 15 (App Router) + TypeScript + Tailwind CSS criado na raiz do repositório. Fonte Montserrat e paleta vinho (`#5F0040`) / âmbar (`#FBB040`) configuradas em `app/globals.css` e `app/layout.tsx`. Helpers de cliente Supabase (`lib/supabase-browser.ts` com chave anon, `lib/supabase-server.ts` com service role, protegido por `server-only`). `.env.example` documentando as variáveis necessárias. Deploy e criação do projeto Supabase feitos manualmente pelo usuário; projeto conectado ao repositório `MuquecaJJ/tempos-farmacia-cd-solar` no GitHub.
- **B1 — Banco**: migration `0001_init.sql` com o DDL completo do catálogo (`papeis`, `processos`, `fluxos`, `atividades`, `fluxo_etapas`, `colaboradores`) e da coleta (`sessoes`, `corridas`, `medicoes`), aplicada no projeto Supabase remoto via `supabase db push`. Seeds dos 7 papéis, 6 processos, 56 atividades, 7 fluxos, 31 etapas de fluxo e 45 colaboradores. `meta_amostras` já sai com valor 5 (em vez do default 40) para as 6 atividades de natureza Eventual, antecipando o item A03 do plano.
- **B2 — Sessão e catálogo**: rota `/c/[token]` com validação de token server-side (404 se inválido). Tela de abertura de sessão (`/c/[token]/sessao`) com escolha de dispositivo (1ª vez, persistida em `localStorage`), aviso de transparência (LGPD) sempre visível, e formulário com colaborador (busca), papel, turno, tipo de coleta e observador condicional. Estado da sessão ativa persistido em `sessionStorage`. Catálogo (`/c/[token]/atividades`) listando fluxos e atividades da sessão ativa.
- Migration `0003_observadores.sql`: adiciona **YGOR CIRAUDO** e **DOUGLAS PIRES** ao cadastro de colaboradores, para uso como observadores nas sessões do tipo OBSERVADO (item A01 do plano).

### Alterado

- **Catálogo passa a ser filtrado por macroprocesso, não por papel.** Mudança de escopo pedida após teste do B2: a tela de sessão ganhou um campo de seleção de **macroprocesso** (um dos 6 `processos` já existentes), exibido logo após o colaborador. O papel continua sendo perguntado (para as quebras estatísticas do dashboard no B6), mas deixou de determinar o que aparece no catálogo. Migration `0002_sessao_processo.sql` adiciona a coluna `processo_id` (not null) em `sessoes`. `CatalogoAtividades` foi simplificado: filtra atividades e fluxos diretamente pelo `processo_id` de cada um, sem precisar inferir o papel via join em `fluxo_etapas`.

### Verificado

- Build de produção (`npm run build`) e dev server sem erros em cada bloco.
- Fluxo completo de sessão → catálogo testado com automação de navegador (Playwright headless) contra o dev server e o banco Supabase real: escolha de dispositivo, busca de colaborador, seleção de macroprocesso/papel/turno/tipo de coleta, campo de observador condicional, persistência de sessão via reload, troca de macroprocesso. Sem erros de console em nenhuma rodada.
- Contagens do catálogo conferidas via REST API: 7 papéis, 6 processos, 56 atividades, 7 fluxos, 31 etapas de fluxo, 47 colaboradores (45 + 2 observadores). Sequência do fluxo F1 (`1 → 4 → 2 → 3 → [5|6|7|8] → 9`) e `meta_amostras = 5` das 6 atividades eventuais confirmados por query direta.
- Sessões de teste criadas durante a automação foram removidas do banco após validação, para não contaminar a amostra.
