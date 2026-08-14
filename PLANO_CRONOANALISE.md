# Cronômetro Operacional — Farmácia / CD Solar
## Documento de Planejamento para Desenvolvimento

**Versão:** 1.0
**Data:** 14/08/2026
**Autor do briefing:** Lucas Netto
**Destino:** Claude Code
**Projeto pai:** Adequação de layout e fluxo processual da Farmácia (CD)

---

## 0. Como usar este documento

Este arquivo é a especificação completa. Cole-o inteiro no Claude Code e execute os blocos da Seção 12 em ordem. Cada bloco tem critério de aceite próprio — não avance sem passar no anterior.

Regra de ouro deste projeto: **é uma ferramenta descartável de uso pontual.** Não há requisito de escala, multi-tenancy, testes automatizados extensivos, i18n ou acessibilidade AAA. Toda decisão em caso de dúvida deve favorecer *velocidade de entrega* e *confiabilidade do dado coletado*, nessa ordem. Rejeitar abstrações prematuras.

---

## 1. Contexto e objetivo

A Farmácia do Centro de Distribuição está passando por um projeto de readequação de layout e de fluxo processual. Para sustentar tecnicamente as decisões de redesenho, é necessário construir uma base quantitativa de tempos de execução das atividades operacionais.

Objetivos da medição, em ordem de prioridade:

1. **Baseline "antes"** — registro dos tempos atuais para comparação com o cenário pós-mudança.
2. **Mapa de gargalos** — identificar quais atividades e quais tipos de esforço consomem mais tempo, subsidiando decisões de layout.
3. **Dimensionamento** — insumo para cálculo de capacidade e quadro.

O produto é uma aplicação web mobile-first usada em 4 celulares corporativos dentro do CD.

### 1.1 O que NÃO está no escopo

- Cálculo de tempo padrão de cronoanálise clássica (fator de ritmo, tolerâncias de fadiga/necessidades pessoais). A saída são **estatísticas descritivas do tempo cronometrado bruto**.
- Registro de motivo de interrupção/parada.
- Modo offline com fila de sincronização (o Wi-Fi do CD é estável).
- Login individual por colaborador.
- Qualquer integração com sistemas internos (IW, ERP, etc.).
- Uso após o encerramento do projeto de layout.

---

## 2. Decisões de produto (fechadas)

| # | Tema | Decisão |
|---|---|---|
| D01 | Método de cálculo | Estatística descritiva apenas: n, média, mediana, desvio-padrão, mín, máx, p90, tempo por unidade |
| D02 | Quem cronometra | Ambos: autocronometragem pelo colaborador **e** cronometragem por estagiário observador |
| D03 | Distinção das duas formas | Campo obrigatório `tipo_coleta` (AUTO / OBSERVADO) na abertura da sessão |
| D04 | Identificação | Nominal, a partir de lista pré-cadastrada de 45 colaboradores. Sem matrícula |
| D05 | Papel e turno | **Não são fixos** por pessoa. Selecionados pelo usuário a cada sessão |
| D06 | Autenticação da coleta | Sem login. URL com token aleatório não-adivinhável |
| D07 | Autenticação do dashboard | PIN único, cookie httpOnly |
| D08 | Quantidade processada | Sim, capturada. Unidade definida por atividade |
| D09 | Meta amostral | 40 registros por atividade (default), configurável por atividade |
| D10 | Período de coleta | Sem data fixa de início/fim. Encerra quando a cobertura amostral for satisfatória |
| D11 | Descarte | O próprio usuário pode descartar uma medição que suspeite estar incorreta |
| D12 | Observação | Campo de texto livre opcional ao encerrar |
| D13 | Dispositivos | 4 celulares corporativos, ~6h/dia de operação |
| D14 | Stack | Next.js (App Router) + Supabase + Vercel, em **projeto novo e separado** do Órbita |

---

## 3. Stack e infraestrutura

- **Framework:** Next.js 15+, App Router, TypeScript
- **Estilo:** Tailwind CSS
- **Banco:** Supabase (Postgres) — **projeto novo**, não reaproveitar o do Órbita
- **Deploy:** Vercel
- **Fonte:** Montserrat (alinhamento com identidade Solar Cuidados)
- **Paleta:** vinho `#5F0040` (primária), âmbar `#FBB040` (ação/destaque), neutros
- **Sem:** ORM pesado, state manager global, biblioteca de componentes. Usar `@supabase/supabase-js` direto e `useState`/`useReducer`.

### 3.1 Variáveis de ambiente

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # SERVER-SIDE ONLY — nunca prefixar com NEXT_PUBLIC_
COLETA_TOKEN=                     # slug aleatório de 32 chars da URL de coleta
PAINEL_PIN=                       # PIN de acesso ao dashboard
```

> **Regra inegociável:** `SUPABASE_SERVICE_ROLE_KEY` só pode ser lida em Route Handlers / Server Components. Qualquer import dela em componente `"use client"` é bug bloqueante.

---

## 4. Modelo de dados

### 4.1 Diagrama lógico

```
colaboradores          papeis            processos
      │                   │                  │
      │                   │                  ├──── fluxos
      │                   │                  │        │
      └───────┬───────────┘                  └──── atividades ──── fluxo_etapas
              │                                          │
           sessoes ──────── corridas ──────────────── medicoes
```

### 4.2 DDL

```sql
-- ============================================================
-- CATÁLOGO
-- ============================================================

create table papeis (
  id            smallserial primary key,
  nome          text not null unique,
  ordem         smallint not null default 0
);

create table processos (
  id            smallserial primary key,
  codigo        text not null unique,          -- 'SEDIS-001'
  nome          text not null,
  ordem         smallint not null default 0
);

create table fluxos (
  id              smallserial primary key,
  processo_id     smallint not null references processos(id),
  nome            text not null,               -- 'Recebimento por NF'
  unidade_corrida text not null,               -- 'nota fiscal', 'paciente', 'reposição'
  ordem           smallint not null default 0
);

create type modo_coleta as enum ('FLUXO', 'CICLO', 'AVULSA');
create type natureza_ativ as enum ('Rotina', 'Eventual');

create table atividades (
  id                smallserial primary key,
  numero            smallint not null unique,   -- Nº da tabela mestre (1..56)
  processo_id       smallint not null references processos(id),
  papel_id          smallint not null references papeis(id),
  nome              text not null,
  tipo_atividade    text not null,              -- 'Manuseio Fisico', 'Conferencia/Verificacao', ...
  natureza          natureza_ativ not null,
  modo              modo_coleta not null,
  unidade           text,                       -- unidade da quantidade; null = não pede quantidade
  requer_quantidade boolean not null default false,
  meta_amostras     smallint not null default 40,
  ativo             boolean not null default true
);

-- Etapas que compõem cada fluxo, na ordem de execução.
-- Etapas variantes (ex.: conferir medicamento comum vs termolábil) compartilham
-- a mesma 'ordem' e são apresentadas como escolha ao usuário.
create table fluxo_etapas (
  id            serial primary key,
  fluxo_id      smallint not null references fluxos(id),
  atividade_id  smallint not null references atividades(id),
  ordem         smallint not null,
  variante      boolean not null default false,
  opcional      boolean not null default false,
  unique (fluxo_id, atividade_id)
);

create table colaboradores (
  id      smallserial primary key,
  nome    text not null unique,
  ativo   boolean not null default true
);

-- ============================================================
-- COLETA
-- ============================================================

create type tipo_coleta_enum as enum ('AUTO', 'OBSERVADO');
create type turno_enum       as enum ('MANHA', 'TARDE', 'NOITE');
create type status_registro  as enum ('VALIDA', 'DESCARTADA', 'SUSPEITA');

create table sessoes (
  id             uuid primary key default gen_random_uuid(),
  colaborador_id smallint not null references colaboradores(id),  -- quem EXECUTA
  observador_id  smallint references colaboradores(id),           -- obrigatório se OBSERVADO
  papel_id       smallint not null references papeis(id),
  turno          turno_enum not null,
  tipo_coleta    tipo_coleta_enum not null,
  dispositivo    text,                                            -- 'CEL-01'..'CEL-04'
  iniciada_em    timestamptz not null default now(),
  encerrada_em   timestamptz
);

create table corridas (
  id                uuid primary key default gen_random_uuid(),
  sessao_id         uuid not null references sessoes(id) on delete cascade,
  fluxo_id          smallint references fluxos(id),      -- null quando modo = CICLO
  atividade_id      smallint references atividades(id),  -- preenchido quando modo = CICLO
  modo              modo_coleta not null,
  quantidade        numeric,                             -- qtd da corrida inteira (FLUXO)
  unidade           text,
  iniciada_em       timestamptz not null default now(),
  encerrada_em      timestamptz,
  observacao        text,
  status            status_registro not null default 'VALIDA'
);

create table medicoes (
  id                uuid primary key default gen_random_uuid(),
  sessao_id         uuid not null references sessoes(id) on delete cascade,
  corrida_id        uuid references corridas(id) on delete cascade,  -- null quando AVULSA
  atividade_id      smallint not null references atividades(id),
  ordem             smallint,            -- ordem na corrida (FLUXO) ou nº do ciclo (CICLO)
  iniciada_em       timestamptz not null,
  encerrada_em      timestamptz not null,
  duracao_ms        integer not null,    -- medido no cliente (monotônico) — FONTE DE VERDADE
  quantidade        numeric,
  unidade           text,
  observacao        text,
  status            status_registro not null default 'VALIDA',
  motivo_descarte   text,
  criado_em         timestamptz not null default now()
);

create index idx_medicoes_atividade on medicoes(atividade_id) where status = 'VALIDA';
create index idx_medicoes_sessao    on medicoes(sessao_id);
create index idx_corridas_sessao    on corridas(sessao_id);
```

### 4.3 Precisão do cronômetro

`duracao_ms` é a **fonte de verdade** e deve ser calculada no cliente com `performance.now()` (relógio monotônico), não com diferença de `Date.now()` — o relógio de parede do celular pode ser ajustado por NTP durante a medição e corromper o registro.

`iniciada_em` / `encerrada_em` são `Date.now()` convertidos para ISO, usados apenas para contexto temporal (turno, dia, ordenação). Nunca recalcular duração a partir deles.

---

## 5. Seed do catálogo

### 5.1 Papéis (7)

```sql
insert into papeis (nome, ordem) values
  ('Auxiliar de Farmácia - Recebimento', 1),
  ('Auxiliar de Farmácia / Produção', 2),
  ('Auxiliar de Impressão de Rotas', 3),
  ('Auxiliar de Separação', 4),
  ('Auxiliar de Dispensação (Bipagem)', 5),
  ('Auxiliar de Farmácia (Dispensação de Pendências)', 6),
  ('Farmacêutico', 7);
```

### 5.2 Processos (6)

```sql
insert into processos (codigo, nome, ordem) values
  ('SEDIS-001', 'Recebimento de Mercadorias', 1),
  ('SEDIS-002', 'Fracionamento e Etiquetagem de Mercadorias', 2),
  ('SEDIS-003', 'Armazenamento de Mercadorias', 3),
  ('SEDIS-004', 'Lançamento de Notas Fiscais', 4),
  ('SEFAP-001', 'Separação e Dispensação de Produtos', 5),
  ('SEFAP-002', 'Pendências Pré-rota', 6);
```

### 5.3 Atividades (56)

Colunas: `numero | processo | papel | nome | tipo_atividade | natureza | modo | unidade | requer_qtd`

**SEDIS-001 — Recebimento de Mercadorias** (papel: Auxiliar de Farmácia - Recebimento)

| Nº | Atividade | Tipo | Natureza | Modo | Unidade |
|---|---|---|---|---|---|
| 1 | Retirar o relatório de itens digitados na NF junto ao auxiliar de lançamento | Coordenação | Rotina | FLUXO | — |
| 4 | Receber o fornecedor e conferir os dados da nota fiscal | Conferência/Verificação | Rotina | FLUXO | — |
| 2 | Conferir os itens recebidos e segregados na área de recebimento | Conferência/Verificação | Rotina | FLUXO | itens |
| 3 | Direcionar os insumos por tipo (etiquetagem ou armazenamento) | Manuseio Físico | Rotina | FLUXO | volumes |
| 5 | Conferir fisicamente medicamentos comuns | Conferência/Verificação | Rotina | FLUXO *(variante)* | itens |
| 6 | Conferir fisicamente medicamentos termolábeis | Conferência/Verificação | Rotina | FLUXO *(variante)* | itens |
| 7 | Conferir fisicamente produtos para saúde | Conferência/Verificação | Rotina | FLUXO *(variante)* | itens |
| 8 | Conferir fisicamente dietas enterais | Conferência/Verificação | Rotina | FLUXO *(variante)* | itens |
| 9 | Finalizar o recebimento (carimbar, identificar/segregar volumes, encaminhar) | Registro/Documentação | Rotina | FLUXO | volumes |
| 10 | Organizar o posto de trabalho | Organização | Rotina | AVULSA | — |
| 11 | Tratar destinatário incorreto (devolver NF e orientar o fornecedor) | Correção de Exceção | Eventual | AVULSA | — |
| 12 | Tratar CNPJ incorreto (informar compras / solicitar carta de correção) | Correção de Exceção | Eventual | AVULSA | — |
| 13 | Tratar não conformidade (informar compras e aguardar devolutiva) | Correção de Exceção | Eventual | AVULSA | — |

**SEDIS-002 — Fracionamento e Etiquetagem** (papel: Auxiliar de Farmácia / Produção)

| Nº | Atividade | Tipo | Natureza | Modo | Unidade |
|---|---|---|---|---|---|
| 14 | Configurar a quantidade de rótulos e a fração da embalagem primária | Registro/Documentação | Rotina | AVULSA | — |
| 15 | Etiquetar cada embalagem primária | Manuseio Físico | Rotina | **CICLO** | embalagem |

**SEDIS-003 — Armazenamento** (papel: Auxiliar de Farmácia / Produção)

| Nº | Atividade | Tipo | Natureza | Modo | Unidade |
|---|---|---|---|---|---|
| 16 | Verificar os bins e reabastecer com subestoque — Medicamentos (FEFO) | Manuseio Físico | Rotina | FLUXO | — |
| 17 | Verificar itens etiquetados disponíveis para armazenamento — Medicamentos | Conferência/Verificação | Rotina | FLUXO | itens |
| 18 | Armazenar medicamentos padrão (bins/subestoque) | Armazenagem | Rotina | FLUXO | itens |
| 19 | Armazenar medicamentos psicotrópicos/controle especial (sala específica) | Armazenagem | Rotina | FLUXO *(variante de 18)* | itens |
| 20 | Armazenar medicamentos termolábeis (Geladeira 1/2/3) | Armazenagem | Rotina | FLUXO *(variante de 18)* | itens |
| 21 | Verificar as estantes e reabastecer com subestoque — Dietas enterais (FEFO) | Manuseio Físico | Rotina | FLUXO | — |
| 22 | Verificar dietas recebidas/etiquetadas disponíveis para armazenamento | Conferência/Verificação | Rotina | FLUXO | itens |
| 23 | Armazenar a dieta enteral etiquetada | Armazenagem | Rotina | FLUXO | itens |
| 24 | Verificar as estantes e reabastecer — Produtos p/ saúde loteados (FEFO) | Manuseio Físico | Rotina | FLUXO | — |
| 25 | Verificar materiais loteados etiquetados disponíveis | Conferência/Verificação | Rotina | FLUXO | itens |
| 26 | Armazenar o material etiquetado (bins/estantes ou subestoque) | Armazenagem | Rotina | FLUXO | itens |
| 27 | Verificar as estantes e reabastecer — Produtos p/ saúde não-loteados (FEFO) | Manuseio Físico | Rotina | FLUXO | — |
| 28 | Verificar materiais recebidos disponíveis para armazenamento | Conferência/Verificação | Rotina | FLUXO | itens |
| 29 | Armazenar o material no subestoque | Armazenagem | Rotina | FLUXO | itens |
| 30 | Desmontar e organizar embalagens não utilizáveis (descarte) | Organização | Rotina | AVULSA | — |

**SEDIS-004 — Lançamento de Notas Fiscais** (papel: Auxiliar de Farmácia / Produção)

| Nº | Atividade | Tipo | Natureza | Modo | Unidade |
|---|---|---|---|---|---|
| 31 | Carregar dados da NF e preencher campos gerais (datas, valor, vencimentos, frete, boletos) | Registro/Documentação | Rotina | FLUXO | — |
| 32 | Vincular ao pedido do fornecedor e preencher dados do item (qtd, lote, validade, fabricante) | Registro/Documentação | Rotina | FLUXO | itens |
| 33 | Concluir o lançamento (anotar ID gerado e direcionar NF física ao financeiro) | Registro/Documentação | Rotina | FLUXO | — |
| 34 | Organizar as notas fiscais físicas ao final do expediente | Organização | Rotina | AVULSA | notas |
| 35 | Corrigir divergência de prazo de pagamento | Correção de Exceção | Eventual | AVULSA | — |
| 36 | Corrigir divergência de valor da nota fiscal | Correção de Exceção | Eventual | AVULSA | — |
| 37 | Completar campo pendente de lançamento | Correção de Exceção | Eventual | AVULSA | — |

**SEFAP-001 — Separação e Dispensação**

| Nº | Atividade | Papel | Tipo | Natureza | Modo | Unidade |
|---|---|---|---|---|---|---|
| 38 | Separar e dividir as rotas entre os auxiliares de separação | Aux. Impressão de Rotas | Coordenação | Rotina | AVULSA | rotas |
| 39 | Embalar formas líquidas/pastosas (embalagem original) | Aux. Separação | Manuseio Físico | Rotina | **CICLO** | item |
| 40 | Embalar ampolas (proteção com plástico bolha) | Aux. Separação | Manuseio Físico | Rotina | **CICLO** | item |
| 41 | Embalar comprimidos/cápsulas/drágeas (embalagem primária) | Aux. Separação | Manuseio Físico | Rotina | **CICLO** | item |
| 42 | Embalar óleos e álcool (saco individualizado) | Aux. Separação | Manuseio Físico | Rotina | **CICLO** | item |
| 43 | Embalar dietas/soro/materiais de alta cubagem (caixa de papelão) | Aux. Separação | Manuseio Físico | Rotina | **CICLO** | item |
| 44 | Direcionar os volumes ao setor de dispensação (anotar total de volumes) | Aux. Separação | Manuseio Físico | Rotina | AVULSA | volumes |
| 45 | Recolher os volumes a serem bipados (um paciente por vez) | Aux. Dispensação | Manuseio Físico | Rotina | FLUXO | volumes |
| 46 | Bipar os itens separados | Aux. Dispensação | Conferência/Verificação | Rotina | FLUXO | itens |
| 47 | Identificar o responsável pela separação da rota e confirmar a dispensação | Aux. Dispensação | Conferência/Verificação | Rotina | FLUXO | — |
| 48 | Registrar a conferência (volumes, data, tipo de entrega, geladeira, natureza) | Aux. Dispensação | Registro/Documentação | Rotina | FLUXO | — |
| 49 | Direcionar os volumes e protocolos à expedição | Aux. Dispensação | Manuseio Físico | Rotina | FLUXO | volumes |
| 50 | Organizar a bancada ao final do expediente | Aux. Dispensação | Organização | Rotina | AVULSA | — |

**SEFAP-002 — Pendências Pré-rota**

| Nº | Atividade | Papel | Tipo | Natureza | Modo | Unidade |
|---|---|---|---|---|---|---|
| 51 | Analisar o arquivo de pendências em Excel e montar a contagem de itens | Farmacêutico | Análise | Rotina | AVULSA | itens |
| 52 | Realizar o pedido de compras no sistema para os itens pendentes | Farmacêutico | Registro/Documentação | Rotina | AVULSA | itens |
| 53 | Registrar o acompanhamento do pedido de compras | Farmacêutico | Registro/Documentação | Rotina | AVULSA | pedidos |
| 54 | Realizar a dispensação dos itens pendentes já recebidos | Aux. Disp. Pendências | Manuseio Físico | Rotina | AVULSA | itens |
| 55 | Realizar reunião presencial com o setor de compras | Farmacêutico | Comunicação/Reunião | Rotina | AVULSA | — |
| 56 | Realizar reunião via Teams com a equipe multidisciplinar | Farmacêutico | Comunicação/Reunião | Rotina | AVULSA | — |

### 5.4 Fluxos e suas etapas

| Fluxo | Processo | Unidade da corrida | Etapas (ordem) |
|---|---|---|---|
| F1 — Recebimento por NF | SEDIS-001 | nota fiscal | 1 → 4 → 2 → 3 → [5 \| 6 \| 7 \| 8] → 9 |
| F2 — Armazenamento: Medicamentos | SEDIS-003 | reposição | 16 → 17 → [18 \| 19 \| 20] |
| F3 — Armazenamento: Dietas enterais | SEDIS-003 | reposição | 21 → 22 → 23 |
| F4 — Armazenamento: PPS loteados | SEDIS-003 | reposição | 24 → 25 → 26 |
| F5 — Armazenamento: PPS não-loteados | SEDIS-003 | reposição | 27 → 28 → 29 |
| F6 — Lançamento de NF | SEDIS-004 | nota fiscal | 31 → 32 → 33 |
| F7 — Bipagem por paciente | SEFAP-001 | paciente | 45 → 46 → 47 → 48 → 49 |

**Etapas variantes:** dentro de `[ ]` o usuário escolhe qual variante está executando. No F1 a etapa de conferência física permite **múltipla seleção** (uma NF pode trazer medicamento comum e termolábil na mesma entrega) — nesse caso, cada variante selecionada vira uma medição separada, cronometrada em sequência.

### 5.5 Colaboradores (45)

```
ADAO ARAUJO DE SOUZA
ADRIANA ALLES DA SILVA
ALEXANDRE MACIEL DA SILVA
ALINE SILVA DE SOUZA
ANA VIRGINIA PEREIRA DE SOUSA
ANDRE LUIS SILVERIO DA SILVA JUNIOR
BEATRIZ DA COSTA MARTINS
BIANCA MARIA BATINGA BATISTA
BRENDA FREITAS DE MORAES
CARLA CRISTINA FERREIRA DE ANDRADE
CARLOS ANTONIO DA SILVA ALVES
CRISTIAN MENDES
DOUGLAS DE SOUZA RANGEL
DOUGLAS RODRIGUES DA SILVA
EDSON JOSE TRAJANO
GABRIEL DOS SANTOS PEREIRA
HENRIQUE TELLES DE OLIVEIRA
ITALO DOS SANTOS DE VASCONCELLOS
JOÃO VITOR OLIVEIRA VENTURA
JORGE GOMES VASCONCELOS
JOSE COSTA RODRIGUES JUNIOR
JOYCE RIBEIRO SOARES
JULIA RODRIGUES TARTAGLIA DE SOUZA
KAIO CESAR FERNANDES DA SILVA
KAYLLAN DA SILVA VIEIRA MARINHO
KEILA CAROLINA OLIVEIRA DE SOUZA
LUAN LESSA SILVA
LUCAS QUINTINO DE OLIVEIRA
MARCELO SANT ANNA PEREIRA
MATHEUS DA SILVA SAMPAIO
MICHEL AREAS DA SILVA REIS
PATRICIA MOLINARO
PAULO RICARDO PAGANOTO E SOUZA
PEDRO CORREIA CANOZA
PEDRO FELIPE GASPAR DA ROCHA FREITAS
RODRIGO FERNANDES ROSSANI DA SILVA BRITTO
RUAN BERNARDINO DOS SANTOS
STEFANE DA SILVA TORRES
THIAGO ASSIS VALDEVINO DA SILVA
THIAGO AUGUSTO SILVA DIAS
UILLIANS DA SILVA FREITAS
VALTEMAR FRANCISCO VIEIRA
VICTORIA CHRYSTINNE DE MOURA GIMA
VITORIA CRISTINA LINHARES DE SANTA MARIA
YURI SANT ANNA BARROS SANTOS
```

> **Pendência de cadastro:** incluir também o(s) estagiário(s) observador(es), que não constam nesta lista. Marcar com um flag ou simplesmente adicionar ao cadastro de colaboradores — a lista de observadores é a mesma tabela.

---

## 6. Modos de coleta — especificação funcional

### 6.1 Modo AVULSA (30 atividades)

Cronometragem simples de uma atividade isolada.

1. Usuário escolhe a atividade na lista filtrada pelo papel.
2. Toca **INICIAR** → cronômetro corre em tela cheia.
3. Toca **PARAR**.
4. Tela de confirmação: quantidade (se `requer_quantidade`), observação (opcional), botões **SALVAR** e **DESCARTAR**.
5. Retorna à lista.

### 6.2 Modo FLUXO (7 fluxos)

Corrida encadeada. O cronômetro **não zera entre etapas** — cada toque em "PRÓXIMA ETAPA" fecha a medição da etapa atual e abre a próxima, sem intervalo morto.

1. Usuário escolhe o fluxo.
2. Toca **INICIAR CORRIDA** → começa a etapa 1.
3. Tela mostra: nome da etapa atual, cronômetro da etapa, cronômetro total da corrida, indicador `etapa 3 de 6`.
4. Botão primário: **PRÓXIMA ETAPA**. Botão secundário: **PULAR ETAPA** (grava a etapa como pulada, sem medição).
5. Em etapa variante, a tela apresenta as opções antes de iniciar o cronômetro da etapa. No F1, seleção múltipla permitida.
6. Ao concluir a última etapa: **ENCERRAR CORRIDA** → tela de confirmação com quantidade da corrida, observação, **SALVAR** / **DESCARTAR CORRIDA INTEIRA**.
7. Persistência: grava-se 1 registro em `corridas` + N registros em `medicoes` (um por etapa executada), com `ordem` sequencial.

**Regra:** descartar a corrida marca `status = 'DESCARTADA'` em cascata nas medições filhas. Não deletar — o registro descartado é evidência de qualidade do estudo.

### 6.3 Modo CICLO (6 atividades)

Repetição da mesma atividade. Cada toque grava um ciclo individual.

1. Usuário escolhe a atividade.
2. Toca **INICIAR** → cronômetro corre.
3. A cada repetição concluída, toca o botão grande **CICLO** → grava a duração desde o toque anterior e reinicia a contagem do ciclo, **sem parar** o cronômetro da sessão.
4. Tela mostra: cronômetro do ciclo atual, contador de ciclos, média corrente dos ciclos, e os últimos 3 ciclos com botão de descarte individual.
5. Toca **ENCERRAR** → confirmação, observação, salvar.
6. Persistência: 1 registro em `corridas` (com `atividade_id` e `modo='CICLO'`) + N registros em `medicoes`, `ordem` = número do ciclo.

**Regra:** o primeiro toque em CICLO fecha o ciclo 1. O tempo entre INICIAR e o primeiro CICLO é o ciclo 1 e conta normalmente.

---

## 7. Telas e rotas

```
/c/[token]                      Entrada da coleta (validação do token)
  ├── /c/[token]/sessao         Abertura de sessão (5 campos)
  ├── /c/[token]/atividades     Catálogo filtrado por papel
  ├── /c/[token]/avulsa/[id]    Cronômetro modo AVULSA
  ├── /c/[token]/fluxo/[id]     Cronômetro modo FLUXO
  └── /c/[token]/ciclo/[id]     Cronômetro modo CICLO

/painel                         Login por PIN
  ├── /painel/cobertura         Cobertura amostral (tela inicial)
  ├── /painel/atividades        Estatísticas por atividade
  ├── /painel/registros         Lista de medições, com invalidação manual
  └── /api/painel/export        Download CSV
```

### 7.1 Tela de abertura de sessão

Cinco campos, todos obrigatórios exceto `observador`:

| Campo | Controle | Observação |
|---|---|---|
| Colaborador (quem executa) | Busca + lista | 45 nomes; campo de busca por digitação é essencial |
| Papel no momento | Select, 7 opções | **Não fixo** — define o filtro do catálogo |
| Turno | 3 botões grandes | MANHÃ / TARDE / NOITE |
| Tipo de coleta | 2 botões grandes | AUTOCRONOMETRAGEM / OBSERVADO |
| Observador | Busca + lista | Aparece **apenas** se tipo = OBSERVADO. Obrigatório nesse caso |
| Dispositivo | Select CEL-01..04 | Persistir em localStorage; pergunta só na 1ª vez do aparelho |

A sessão permanece ativa até o usuário encerrá-la explicitamente ou trocar de colaborador. Persistir `sessao_id` em `sessionStorage` para sobreviver a refresh acidental.

### 7.2 Diretrizes de UI para a tela de cronômetro

Este é o ponto onde a ferramenta ganha ou perde o dado.

- Botão de ação primário ocupando **no mínimo 40% da altura da tela**. Operador de CD usa luva, tem pressa e não olha para a tela.
- Cronômetro em fonte mono, tamanho mínimo 48px, formato `MM:SS.d`.
- **Wake Lock API** (`navigator.wakeLock.request('screen')`) para impedir bloqueio de tela durante medição ativa. Com fallback silencioso se indisponível.
- `beforeunload` ativo enquanto há cronômetro rodando.
- Feedback tátil: `navigator.vibrate(50)` em cada toque que grava algo.
- Cores: botão de iniciar/avançar em âmbar `#FBB040`; botão de parar/encerrar em vinho `#5F0040`; descartar em cinza discreto, **nunca em vermelho de destaque** — descarte não deve ser um ato constrangedor, senão o colaborador salva dado ruim.
- Nada de modal de confirmação para o toque principal. Confirmação só no salvar final.

---

## 8. Dashboard

Acesso via PIN. Tela inicial = **cobertura amostral**, porque a pergunta operacional durante o estudo é sempre "já posso parar?".

### 8.1 Tela: Cobertura amostral

Tabela agrupada por processo, uma linha por atividade:

| Coluna | Conteúdo |
|---|---|
| Nº / Atividade | identificação |
| Natureza | Rotina / Eventual |
| n coletado | contagem de medições `VALIDA` |
| Meta | `meta_amostras` (default 40) |
| % | barra de progresso com semáforo: vermelho <50%, âmbar 50–99%, verde ≥100% |
| Última coleta | data/hora do registro mais recente |

Filtros: processo, papel, natureza, tipo_coleta.

### 8.2 Tela: Estatísticas por atividade

Por atividade, sobre medições `VALIDA`:

- n, média, mediana, desvio-padrão, coeficiente de variação (CV = σ/μ), mín, máx, p90
- tempo por unidade (`duracao_ms / quantidade`) quando `requer_quantidade`
- histograma simples de distribuição
- **quebra por `tipo_coleta`** (AUTO vs OBSERVADO), lado a lado — se as médias divergirem muito, há viés de observação e isso precisa aparecer
- quebra por turno e por colaborador (tabela secundária, colapsada por padrão)

**Visões agregadas (é aqui que mora o argumento de layout):**

- Tempo total e médio por **Processo**
- Tempo total e médio por **Tipo de Atividade** — a distribuição entre Manuseio Físico / Conferência / Registro / Armazenagem / Organização é o insumo direto para justificar redesenho de fluxo
- Tempo médio por **etapa dentro de cada fluxo** — identifica o gargalo posicional

**Sinalizador de CV:** destacar atividades com CV > 0,30. Alta variabilidade indica ou processo não padronizado ou amostra contaminada — nos dois casos é achado relevante para o projeto.

### 8.3 Tela: Registros

Lista paginada de medições com filtros. Permite ao analista marcar `status = 'SUSPEITA'` manualmente (revisão pós-coleta). Ação server-side.

### 8.4 Export CSV

Endpoint `/api/painel/export`, server-side com service role. Um arquivo achatado (`UTF-8 com BOM`, separador `;` para abrir direto no Excel pt-BR):

```
medicao_id;sessao_id;corrida_id;data;hora;turno;colaborador;papel;tipo_coleta;observador;
dispositivo;processo_codigo;processo_nome;fluxo;atividade_numero;atividade_nome;
tipo_atividade;natureza;modo;ordem;duracao_ms;duracao_seg;quantidade;unidade;
tempo_por_unidade_seg;status;observacao
```

Incluir registros `DESCARTADA` e `SUSPEITA` com a coluna `status` preenchida — a filtragem é decisão do analista, não da ferramenta.

---

## 9. Segurança e proteção de dados

Contexto: a base contém **dado pessoal nominal associado a desempenho individual** (LGPD art. 5º, I). A aplicação é publicamente acessível por design (sem login). As medidas abaixo são o mínimo defensável e somam ~45 minutos de implementação.

### 9.1 Controles obrigatórios

| # | Controle | Ameaça mitigada | Referência |
|---|---|---|---|
| S1 | URL de coleta com token aleatório de 32 caracteres (`crypto.randomBytes(24).toString('base64url')`), validado server-side. Token inválido → 404 | Descoberta trivial do endpoint | CWE-306 / OWASP A01:2021 |
| S2 | `X-Robots-Tag: noindex, nofollow` + `robots.txt` bloqueando tudo | Indexação da aplicação por buscadores | — |
| S3 | Dashboard atrás de PIN, validado em Route Handler, cookie `httpOnly` + `Secure` + `SameSite=Strict` | Leitura da base nominal por quem tem o link de coleta | CWE-284 |
| S4 | **RLS habilitado em todas as tabelas.** Papel `anon`: `SELECT` apenas nas tabelas de catálogo (`papeis`, `processos`, `fluxos`, `atividades`, `fluxo_etapas`, `colaboradores`); `INSERT` e `UPDATE` em `sessoes`, `corridas`, `medicoes`; **`SELECT` negado** em `sessoes`, `corridas`, `medicoes` | Exfiltração da base de medições via chave anon exposta no bundle | CWE-1220 / OWASP API1:2023 |
| S5 | `SUPABASE_SERVICE_ROLE_KEY` exclusivamente em Route Handlers. Proibido `NEXT_PUBLIC_` | Comprometimento total do banco | CWE-798 / OWASP A02:2021 |
| S6 | Dashboard lê dados **apenas** via Route Handler com service role. Nenhuma query de leitura de medições no cliente | Bypass do PIN por chamada direta ao Supabase | CWE-602 |
| S7 | Aviso de transparência na tela de abertura da sessão | Base legal LGPD e adesão do time | LGPD arts. 6º, VI e 9º |
| S8 | Nenhum dado sensível em log. Não logar corpo de requisição em produção | Exposição em logs da Vercel | OWASP A09:2021 |

### 9.2 Texto do aviso de transparência

Exibir na tela de abertura da sessão, sempre visível (não é modal de aceite):

> **Sobre esta medição**
> Os tempos coletados são utilizados exclusivamente para o estudo de readequação do layout e do fluxo da Farmácia. O objetivo é entender o processo, não avaliar pessoas individualmente. Os dados não serão usados para fins disciplinares nem para avaliação de desempenho. Dúvidas: procure a coordenação.

### 9.3 Riscos residuais aceitos

| Risco | Severidade | Justificativa da aceitação |
|---|---|---|
| Quem tiver o link de coleta pode inserir registros falsos | Baixa | Universo fechado (4 aparelhos corporativos), uso pontual, e registros anômalos são detectáveis via CV e revisão no dashboard |
| Sem trilha de auditoria de quem operou o aparelho | Baixa | `dispositivo` + `colaborador` + `observador` dão rastreabilidade suficiente para o propósito |
| PIN único compartilhado no dashboard | Média | Acesso restrito ao time de análise (Lucas + estagiário). Mitigado pelo prazo curto de vida da aplicação |

### 9.4 Encerramento do estudo

Ao final da coleta: exportar CSV, arquivar, e **excluir o projeto Supabase e o deploy Vercel**. Registrar a data do descarte. Isso encerra o tratamento de dados pessoais e é a medida mais eficaz do pacote inteiro (LGPD art. 16).

---

## 10. Regras de negócio consolidadas

| # | Regra |
|---|---|
| R01 | `duracao_ms` sempre calculada com `performance.now()`, nunca com `Date.now()` |
| R02 | Descarte nunca deleta registro — apenas altera `status` |
| R03 | Descartar corrida propaga `DESCARTADA` para todas as medições filhas |
| R04 | Estatísticas do dashboard consideram apenas `status = 'VALIDA'` |
| R05 | Export CSV inclui todos os status |
| R06 | Quantidade só é solicitada quando `requer_quantidade = true` |
| R07 | Observador obrigatório quando `tipo_coleta = 'OBSERVADO'` |
| R08 | Catálogo de atividades filtrado pelo `papel_id` selecionado na sessão |
| R09 | Etapa pulada em FLUXO não gera registro em `medicoes` |
| R10 | No F1, seleção múltipla de variantes gera uma medição por variante selecionada |
| R11 | `sessao_id` persistido em `sessionStorage`; `dispositivo` em `localStorage` |
| R12 | Meta amostral default 40, editável por atividade direto no banco |

---

## 11. Critérios de aceite globais

- [ ] As 56 atividades, 6 processos, 7 papéis, 7 fluxos e 45 colaboradores estão no banco
- [ ] Os três modos (AVULSA, FLUXO, CICLO) gravam corretamente
- [ ] Uma corrida de fluxo com 6 etapas gera 1 `corrida` + 6 `medicoes` com `ordem` 1..6
- [ ] Uma sessão de ciclo com 20 toques gera 1 `corrida` + 20 `medicoes`
- [ ] Cronômetro não sofre desvio em teste de 10 minutos contra cronômetro externo (tolerância ±200ms)
- [ ] Tela não bloqueia durante medição ativa
- [ ] Descarte funciona nos três modos
- [ ] Dashboard exibe cobertura, estatísticas e quebra AUTO × OBSERVADO
- [ ] CSV abre corretamente no Excel pt-BR com acentuação íntegra
- [ ] `SUPABASE_SERVICE_ROLE_KEY` não aparece em nenhum arquivo do bundle cliente (verificar com `grep -r` no `.next/static`)
- [ ] Acesso a `/painel` sem PIN retorna 401
- [ ] `SELECT` em `medicoes` com a chave anon retorna vazio ou erro

---

## 12. Plano de execução

Janela: sexta 14/08 (noite) → segunda 17/08 (fim do dia).

| Bloco | Duração | Entrega | Aceite |
|---|---|---|---|
| **B0 — Fundação** | 30 min | Projeto Next.js + TypeScript + Tailwind; projeto Supabase novo; `.env.local`; deploy inicial na Vercel | Deploy responde em produção |
| **B1 — Banco** | 1h | DDL da Seção 4.2 + seeds da Seção 5 | Query de conferência retorna 56 atividades, 7 fluxos, 45 colaboradores |
| **B2 — Sessão** | 1h30 | Rota `/c/[token]`, validação de token, tela de abertura de sessão, catálogo filtrado por papel | Sessão gravada com os 5 campos; catálogo muda ao trocar o papel |
| **B3 — Modo AVULSA** | 1h30 | Cronômetro, quantidade, observação, salvar, descartar, wake lock | 30 atividades avulsas mensuráveis |
| **B4 — Modo FLUXO** | 2h30 | Máquina de estados da corrida, etapas, variantes (incl. múltipla no F1), pular etapa, encerrar | Corrida completa do F1 gravada corretamente |
| **B5 — Modo CICLO** | 1h30 | Contador de ciclos, média corrente, descarte de ciclo individual | Sessão de 20 ciclos gravada |
| **B6 — Dashboard** | 2h30 | PIN, cobertura, estatísticas, quebra AUTO×OBSERVADO, agregações por processo e tipo | Todas as visões da Seção 8 renderizam |
| **B7 — Export** | 1h | Route Handler CSV com todas as colunas da Seção 8.4 | Abre no Excel pt-BR sem quebra de acento |
| **B8 — Segurança** | 45 min | S1 a S8 da Seção 9.1 | Todos os itens de segurança do checklist da Seção 11 |
| **B9 — Piloto** | 1h | Teste em campo com 1 colaborador real, 1 fluxo e 1 ciclo | Dado chega íntegro ao dashboard |

**Ordem de corte se o prazo apertar:** B9 → B6 (dashboard pode virar consulta SQL direta no Supabase Studio) → B4 (fluxos viram atividades avulsas encadeadas manualmente). **B8 não corta.**

---

## 13. Prompt inicial sugerido para o Claude Code

```
Vou construir uma ferramenta interna de cronoanálise conforme o plano em
PLANO_CRONOANALISE.md, que está na raiz do projeto. Leia o arquivo inteiro
antes de escrever qualquer código.

Contexto: ferramenta descartável, uso pontual, 4 celulares, ~3 semanas de
vida útil. Priorize velocidade de entrega e confiabilidade do dado.
Não introduza abstrações, ORMs, testes automatizados extensivos ou
padrões arquiteturais além do necessário.

Comece pelo Bloco B0 da Seção 12. Ao terminar cada bloco, pare, mostre o
que foi feito e confirme o critério de aceite antes de avançar.

Duas restrições que não podem ser violadas em nenhuma hipótese:
1. SUPABASE_SERVICE_ROLE_KEY nunca pode ser importada em componente cliente
   nem prefixada com NEXT_PUBLIC_.
2. duracao_ms é sempre calculada com performance.now(), nunca com Date.now().
```

---

## 14. Pontos em aberto (não bloqueantes)

| # | Item | Ação |
|---|---|---|
| A01 | Nomes do(s) estagiário(s) observador(es) | Adicionar ao seed de `colaboradores` antes do piloto |
| A02 | Ordem de execução do F1 (Recebimento) assume `1 → 4 → 2 → 3 → [5-8] → 9`, com a conferência física posicionada após o direcionamento por tipo | Validar em campo no piloto (B9); ajuste é uma linha de seed |
| A03 | Meta de 40 amostras é inatingível para as 6 atividades de natureza Eventual (Nº 11, 12, 13, 35, 36, 37) | Reduzir `meta_amostras` dessas 6 para 5 via UPDATE após o B1 |
| A04 | Identificação do dispositivo (CEL-01..04) | Etiquetar fisicamente os 4 aparelhos antes de distribuir |
| A05 | Data de descarte da base ao fim do estudo | Definir e registrar (Seção 9.4) |
