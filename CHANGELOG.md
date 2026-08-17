# Changelog

Todas as mudanças relevantes do projeto Cronômetro Operacional (Farmácia / CD Solar) ficam registradas aqui, em ordem cronológica reversa. Referências de bloco (B0, B1...) seguem a Seção 12 do `PLANO_CRONOANALISE.md`.

## 2026-08-17

### Adicionado

- **B5 — Modo CICLO**: rota `/c/[token]/ciclo/[id]` para repetição da mesma atividade. `CicloAtividade.tsx` com máquina de estados IDLE → RODANDO → CONFIRMACAO. Botão grande CICLO (âmbar) grava a duração desde o toque anterior e reinicia a contagem do ciclo sem parar o cronômetro total da corrida (mesma técnica de "lap" contínuo do B4); mostra cronômetro do ciclo atual, contador, média corrente e os últimos 3 ciclos com descarte individual (que apenas remove do estado em memória — a corrida ainda não existe no banco nesse ponto). Botão ENCERRAR (vinho, secundário) abre a confirmação. Diferente do B3/B4, a quantidade da corrida **não é digitada manualmente** — é derivada do número de ciclos efetivamente registrados (`ciclos.length`), evitando uma fonte de erro de digitação para um dado que a própria ferramenta já mede com precisão. SALVAR/DESCARTAR gravam 1 `corrida` (`modo='CICLO'`, `atividade_id` preenchido, `fluxo_id` null) + N `medicoes` com `ordem` renumerado sequencialmente a partir dos ciclos sobreviventes (independente de descartes intermediários). "Cancelar" durante RODANDO não grava nada, mesmo padrão do B3/B4.

### Verificado

- `npm run build` sem erros, incluindo a nova rota `/c/[token]/ciclo/[id]`.
- **Limitação desta verificação**: a extensão Claude in Chrome desconectou no meio da sessão e não reconectou, então o B5 não pôde ser testado via automação de navegador ponta a ponta como os blocos anteriores. Em vez disso: revisão manual do código da máquina de estados linha a linha, e simulação do formato exato de insert (`corridas` com `modo='CICLO'`/`atividade_id`/`fluxo_id=null` + N `medicoes` com `ordem` sequencial) feita diretamente via REST contra o banco real, confirmando que o schema e as policies aceitam o formato sem erros. **Recomenda-se um teste manual real no celular antes do piloto (B9)** para validar a UX do botão CICLO e o descarte individual dos últimos 3 ciclos, que não foram exercitados interativamente.
- Dados de teste (sessão, corrida e medições simuladas) removidos do banco após a verificação.

- **B4 — Modo FLUXO**: rota `/c/[token]/fluxo/[id]` para a corrida encadeada de etapas. `page.tsx` busca o fluxo, suas `fluxo_etapas` (ordenadas) e as atividades referenciadas. `CorridaFluxo.tsx` agrupa as etapas por `ordem` (etapas que compartilham `ordem` viram um grupo de variantes) e implementa a máquina de estados IDLE → SELECAO → RODANDO → CONFIRMACAO: cronômetro da etapa e cronômetro total da corrida, ambos derivados de `performance.now()`, sem intervalo morto entre etapas (o fim de uma etapa é o início exato da próxima, R01). Em grupos de variante, uma tela de seleção por checkbox antecede o cronômetro (múltipla seleção permitida — necessário no F1, onde uma NF pode trazer mais de um tipo de item, R10); cada variante selecionada vira uma medição separada, cronometrada em sequência. "Pular etapa" avança sem gravar medição (R09); no grupo de variante, pular descarta o grupo inteiro. Ao concluir a última etapa, o botão principal muda para "ENCERRAR CORRIDA", abrindo a confirmação: quantidade da corrida (sempre obrigatória, unidade = `fluxo.unidade_corrida`) e observação opcional, SALVAR grava 1 registro em `corridas` + N em `medicoes` (com `ordem` sequencial), DESCARTAR CORRIDA INTEIRA grava ambos com `status = 'DESCARTADA'` (propagação R03, feita na própria gravação já que corrida e medições nascem juntas no mesmo insert). Também é possível "cancelar" durante RODANDO/SELECAO (mesma decisão de UX do B3): nada é gravado, pois a corrida só é criada no banco na confirmação final.
- Extraídos para `lib/cronometro.ts` os helpers `formatarTempo`, `vibrar`, `adquirirWakeLock` e `liberarWakeLock`, antes duplicados apenas em `CronometroAvulsa.tsx` — o B4 precisou dos mesmos, e esse era o ponto (antecipado no plano) para deixar de duplicar.

### Verificado

- `npm run build` sem erros, incluindo a nova rota dinâmica `/c/[token]/fluxo/[id]`.
- Corrida completa do F1 (6 etapas, incluindo a variante múltipla com 2 seleções e uma etapa pulada) testada via automação de navegador contra o banco real: `medicoes` gravadas com `ordem` 1..6 (etapa pulada ausente, como esperado), timestamps contínuos entre etapas, `corrida.quantidade`/`unidade` corretos.
- Corrida do F2 testada cobrindo os caminhos ainda não exercitados: cancelar em RODANDO (nenhum registro gravado), pular o grupo de variante inteiro na tela de seleção, e Descartar corrida inteira (status `DESCARTADA` propagado corretamente para as 2 medições filhas).
- Sessões, corridas e medições de teste removidas do banco (via service role) após validação.

- **B3 — Modo AVULSA**: rota `/c/[token]/avulsa/[id]` para o cronômetro de atividade isolada. `page.tsx` (Server Component) busca a atividade pelo `id`, faz `notFound()` se inexistente/inativa/fora do modo `AVULSA`. `CronometroAvulsa.tsx` (Client Component) com máquina de estados IDLE → RODANDO → CONFIRMACAO: cronômetro em fonte mono (`MM:SS.d`) calculado sempre a partir de `performance.now()` (R01), Wake Lock API com reaquisição em `visibilitychange`, `beforeunload` ativo durante RODANDO, vibração (`navigator.vibrate`) nos toques que gravam algo. Tela de confirmação com quantidade (inteira, só quando `atividade.requer_quantidade`) e observação opcional, botões SALVAR/DESCARTAR (nunca deleta, R02) gravando direto em `medicoes` via `supabaseBrowser` (mesmo padrão client-side do B2, sem Route Handler). Adicionado também um link discreto "cancelar" durante RODANDO (fora da especificação original, decisão tomada em conjunto com o usuário): aborta sem gravar nenhum registro, já que a corrida nunca chegou a PARAR.

### Verificado (B3)

- `npm run build` sem erros, incluindo a nova rota dinâmica `/c/[token]/avulsa/[id]`.
- Fluxo completo testado com automação de navegador (Claude in Chrome) contra o dev server e o banco Supabase real: sessão → catálogo → atividade com quantidade obrigatória (nº34, salvar com validação de campo vazio) → atividade sem quantidade (nº10, salvar/descartar/cancelar). Os 4 caminhos conferidos diretamente no banco via REST: `duracao_ms` consistente com o tempo cronometrado, `corrida_id = null`, `quantidade`/`unidade` corretos, `status` (`VALIDA`/`DESCARTADA`) correto, e nenhum registro gravado no caminho "cancelar".
- **Achado de segurança fora do escopo do B3**: durante a verificação, a chave anon conseguiu fazer `SELECT` em `medicoes` via REST — a S4 (Seção 9.1 do plano) prevê `SELECT` negado nessa tabela para o papel `anon`. Como as policies de RLS não estão commitadas nas migrations, este é um item pendente para o **B8 — Segurança**, não uma regressão do B3.
- Sessão e medições de teste criadas durante a automação foram removidas do banco (via service role) após validação, para não contaminar a amostra real.

### Infraestrutura (Vercel)

- Diagnosticado e corrigido deploy de produção retornando 404 em todas as rotas: (1) Vercel Authentication (SSO) estava ativado no projeto, o que bloquearia o acesso dos celulares do CD (sem login na equipe Vercel) — desativado, pois a segurança do app já vem do `COLETA_TOKEN` (S1) e do PIN do painel (S3); (2) a deployment mais recente tinha o pacote de saída vazio (`lambda output: []`) — os logs de build mostravam as rotas geradas normalmente, mas o empacotamento final não as anexou, provavelmente por causa da transição do preset de build de "Other" para "Next.js" feita no meio do processo. Um novo deploy (`vercel --prod`) resolveu, com os passos específicos do Next.js (`Applying modifyConfig from Vercel`, `Detected Next.js version`) aparecendo corretamente nos logs desta vez.
- Configuradas no projeto Vercel (Production e Preview) as env vars `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` e `PAINEL_PIN`, que estavam ausentes (só `COLETA_TOKEN` existia).

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
