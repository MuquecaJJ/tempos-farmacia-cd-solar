# Migração v2 — Instruções de Execução
## Ferramenta de cronoanálise · Farmácia / CD Solar

**Data:** 17/08/2026
**Substitui:** Seções 5, 6, 7 e 8 de `PLANO_CRONOANALISE.md`
**Situação:** a ferramenta existe e roda sobre o modelo v1 (56 atividades). Este documento a migra para o modelo v2 (35 atividades), mapeado em campo.

---

## 0. Instrução ao Claude Code

Documento de **delta**. A ferramenta já existe — não reescrever do zero.

Ordem obrigatória: ler tudo → executar M0 a M7 na ordem → parar ao fim de cada bloco e confirmar o critério de aceite antes de avançar.

Restrições invioláveis, herdadas do plano original:
- `SUPABASE_SERVICE_ROLE_KEY` nunca em componente cliente nem prefixada com `NEXT_PUBLIC_`.
- `duracao_ms` sempre calculada com `performance.now()`, nunca com `Date.now()`.

---

## 1. Resumo da mudança

| Dimensão | v1 | v2 |
|---|---|---|
| Atividades | 56 | **35** |
| Processos | 6 | **10** (9 operacionais + 1 de sistema) |
| Fluxos | 7 | **8** |
| Etapas em fluxo | 31 | **27** |
| Modos de coleta | 3 | **5** |
| Coluna `Responsável` / papel | existia | **removida de todo o modelo** |
| Colaboradores | 45 | **47** (45 executantes + 2 observadores exclusivos) |

**Três capacidades novas:**

1. **`CICLO_EM_FLUXO`** — etapa repetitiva dentro de uma corrida (etiquetagem). Padrão *setup → ciclo → teardown*.
2. **Interrupção cronometrada** — pausa o cronômetro do fluxo, cronometra a si mesma, retoma. Uma catalogada (gôndola vazia) e uma genérica com motivo livre, disponível em qualquer corrida.
3. **Metas amostrais calibradas** por duração de ciclo, em vez de 40 uniforme.

---

## 2. Schema

```sql
-- ============================================================
-- M1 · SCHEMA v2
-- ============================================================

-- Novos modos. ADD VALUE exige commit antes do uso: rodar em transação isolada.
alter type modo_coleta add value if not exists 'CICLO_EM_FLUXO';
alter type modo_coleta add value if not exists 'INTERRUPCAO';

-- Remoção do papel
alter table atividades drop column if exists papel_id;
alter table sessoes    drop column if exists papel_id;
drop table if exists papeis;

-- Chave estável de atividade (imune a reordenação de linhas)
alter table atividades add column if not exists codigo text;
-- popular no seed, depois:
alter table atividades alter column codigo set not null;
alter table atividades add constraint uq_atividades_codigo unique (codigo);
alter table atividades drop column if exists numero;

-- Etapa condicional (substitui o conceito de variante)
alter table fluxo_etapas add column if not exists condicao text;
-- a coluna 'variante' fica dormente: nenhuma atividade v2 a usa. Não remover.

-- Etapa de fluxo que roda em modo ciclo
alter table fluxo_etapas add column if not exists modo_etapa modo_coleta not null default 'FLUXO';

-- Interrupção: escopo de aplicação
alter table atividades add column if not exists interrompe_fluxo_id smallint references fluxos(id);
alter table atividades add column if not exists interrupcao_global boolean not null default false;
alter table atividades add column if not exists exige_motivo boolean not null default false;

-- Contabilidade de pausa
alter table corridas add column if not exists tempo_pausado_ms integer not null default 0;
alter table corridas add column if not exists qtd_interrupcoes smallint not null default 0;

-- Vínculo e posicionamento das medições
alter table medicoes add column if not exists eh_interrupcao boolean not null default false;
alter table medicoes add column if not exists ordem_etapa smallint;   -- posição da etapa no fluxo
alter table medicoes add column if not exists motivo_interrupcao text;
-- 'ordem' passa a significar EXCLUSIVAMENTE o número do ciclo dentro da etapa.

-- Vocabulário fechado de unidades
alter table atividades add constraint ck_unidade
  check (unidade is null or unidade in ('itens','volumes','notas','pacientes','caixas'));

-- Observador exclusivo
alter table colaboradores add column if not exists eh_observador boolean not null default false;
```

### 2.1 Semântica

| Campo | Regra |
|---|---|
| `medicoes.ordem_etapa` | Posição da etapa no fluxo (1..N). `null` em AVULSA e CICLO autônomo |
| `medicoes.ordem` | Número do ciclo dentro da etapa. `null` em etapa simples |
| `corridas.tempo_pausado_ms` | Soma das interrupções. **Tempo líquido = duração total − tempo_pausado_ms** |
| `medicoes.eh_interrupcao` | `true` retira a medição da sequência de etapas, mantendo o vínculo com a corrida |
| `atividades.interrompe_fluxo_id` | Interrupção catalogada, restrita a um fluxo |
| `atividades.interrupcao_global` | Interrupção disponível em **qualquer** corrida e sessão de ciclo |
| `atividades.exige_motivo` | Abre campo de texto obrigatório ao encerrar a interrupção |
| `colaboradores.eh_observador` | `true` = aparece só no seletor de observador, nunca no de executante |

> A separação `ordem_etapa` × `ordem` é a única armadilha real de modelagem desta migração. Resolvê-la **antes** de mexer nas telas.

---

## 3. Seed

### 3.1 Processos (10)

```sql
truncate processos cascade;
insert into processos (codigo, nome, ordem) values
  ('SEDIS-001', 'Recebimento de Mercadorias', 1),
  ('SEDIS-002', 'Fracionamento e Etiquetagem de Mercadorias', 2),
  ('SEDIS-003', 'Armazenamento de Mercadorias', 3),
  ('SEDIS-004', 'Lançamento de Notas Fiscais', 4),
  ('SEFAP-001', 'Preparação das Rotas', 5),
  ('SEFAP-002', 'Separação de Produtos para Dispensação', 6),
  ('SEFAP-003', 'Dispensação de Produtos', 7),
  ('SEFAP-004', 'Acréscimo ou Admissão', 8),
  ('SEFAP-005', 'Pendências Pré-rota', 9),
  ('SIST-000',  'Eventos de Interrupção', 99);
```

### 3.2 Fluxos (8)

| ID | Nome | Processo | Unidade da corrida | Etapas |
|---|---|---|---|---|
| F1 | Recebimento por NF | SEDIS-001 | nota fiscal | 4 |
| F2 | Etiquetagem | SEDIS-002 | lote | 3 *(etapa 2 = ciclo)* |
| F3 | Lançamento de NF | SEDIS-004 | nota fiscal | 2 |
| F4 | Preparação das Rotas | SEFAP-001 | dia de rotas | 2 |
| F5 | Separação das Rotas | SEFAP-002 | paciente | 2 |
| F6 | Dispensação das Rotas | SEFAP-003 | paciente | 3 |
| F7 | Acréscimo ou Admissão | SEFAP-004 | paciente | 6 |
| F8 | Dispensação de Pendências | SEFAP-005 | lote diário de pendências | 5 |

**Quantidade capturada ao encerrar a corrida** (`corridas.quantidade` + `corridas.unidade`):

| Fluxo | Frequência esperada | Quantidade da corrida |
|---|---|---|
| F1 | várias por dia | — |
| F2 | por lote | — |
| F3 | várias por dia | — |
| F4 | **1× por dia** | `pacientes` (total do dia) |
| F5 | muitas por dia | — |
| F6 | muitas por dia | — |
| F7 | por admissão/acréscimo | — |
| F8 | **1× por dia** | `pacientes` (total do lote) |

F4 e F8 são operações de lote diário: uma corrida cobre as rotas ou pendências de um dia inteiro, com vários pacientes. A contagem de pacientes é o que permite normalizar o tempo dessas duas corridas — sem ela, um dia com 30 pacientes e outro com 90 entram na mesma média.

### 3.3 Atividades (35)

Taxonomia de `tipo_atividade` — **6 valores fechados**: `Manuseio Físico` · `Conferência/Verificação` · `Registro/Documentação` · `Organização` · `Análise` · `Interrupção`

**SEDIS-001 · Recebimento** — F1, corrida = 1 nota fiscal

| Código | Etapa | Atividade | Tipo | Modo | Unidade | Meta |
|---|---|---|---|---|---|---|
| SEDIS-001-01 | 1 | Receber o fornecedor e conferir os dados da nota fiscal | Conferência/Verificação | FLUXO | — | 30 |
| SEDIS-001-02 | 2 | Conferir os itens recebidos e segregados na área de recebimento | Conferência/Verificação | FLUXO | itens | 30 |
| SEDIS-001-03 | 3 | Colar etiqueta de identificação dos volumes recebidos | Manuseio Físico | FLUXO *(opcional)* | volumes | 20 |
| SEDIS-001-04 | 4 | Direcionar os insumos por tipo (etiquetagem ou armazenamento) | Manuseio Físico | FLUXO | volumes | 30 |

`SEDIS-001-03`: `opcional = true`, `condicao = 'Somente dieta e medicamento'`. Exibir o texto na tela; o botão "Pular etapa" cobre o caso.

**SEDIS-002 · Fracionamento e Etiquetagem** — F2, corrida = 1 lote

| Código | Etapa | Atividade | Tipo | Modo | Unidade | Meta |
|---|---|---|---|---|---|---|
| SEDIS-002-01 | — | Configurar a quantidade de rótulos e a fração da embalagem primária | Registro/Documentação | **AVULSA** | — | 25 |
| SEDIS-002-02 | 1 | Retirar da embalagem os itens a serem etiquetados (setup inicial) | Manuseio Físico | FLUXO | — | 25 |
| SEDIS-002-03 | 2 | Etiquetar os itens | Manuseio Físico | **CICLO_EM_FLUXO** | itens | 100 |
| SEDIS-002-04 | 3 | Agrupar os itens etiquetados (setup final) | Manuseio Físico | FLUXO | — | 25 |

`SEDIS-002-01` é atividade autônoma, **sem vínculo com o F2**.

**SEDIS-003 · Armazenamento** — sem fluxo

| Código | Atividade | Tipo | Modo | Unidade | Meta |
|---|---|---|---|---|---|
| SEDIS-003-01 | Retirar itens do estoque de transição e armazenar | Manuseio Físico | **CICLO** | volumes | 60 |
| SEDIS-003-02 | Desmontar e organizar embalagens não utilizáveis (descarte) | Organização | AVULSA | — | 12 |

**SEDIS-004 · Lançamento de NF** — F3, corrida = 1 nota fiscal

| Código | Etapa | Atividade | Tipo | Modo | Unidade | Meta |
|---|---|---|---|---|---|---|
| SEDIS-004-01 | 1 | Conferência da NF com o pedido de compras | Registro/Documentação | FLUXO | itens | 30 |
| SEDIS-004-02 | 2 | Entrada de NF no IW | Registro/Documentação | FLUXO | itens | 30 |
| SEDIS-004-03 | — | Organizar as notas fiscais físicas | Organização | AVULSA | notas | 12 |

**SEFAP-001 · Preparação das Rotas** — F4, corrida = **1 dia de rotas** (vários pacientes)

| Código | Etapa | Atividade | Tipo | Modo | Unidade | Meta |
|---|---|---|---|---|---|---|
| SEFAP-001-01 | 1 | Setup inicial (selecionar prescrições da rota, bloquear e imprimir) | Organização | FLUXO | — | 10 |
| SEFAP-001-02 | 2 | Organização das guias de separação por equipe | Organização | FLUXO | pacientes | 10 |

Operação de lote diário: **1 corrida por dia**. Meta de 10 = 10 dias úteis de coleta.

**SEFAP-002 · Separação para Dispensação** — F5, corrida = **1 paciente** (rota completa de um paciente)

| Código | Etapa | Atividade | Tipo | Modo | Unidade | Meta |
|---|---|---|---|---|---|---|
| SEFAP-002-01 | — | Setup inicial (organização das guias de maior para menor) | Organização | **AVULSA** | pacientes | 10 |
| SEFAP-002-02 | 1 | Coletar itens das guias de separação | Manuseio Físico | FLUXO | itens | 40 |
| SEFAP-002-03 | — | Abastecimento do estoque em caso de gôndola vazia | Interrupção | **INTERRUPCAO** *(F5)* | itens | 15 |
| SEFAP-002-04 | 2 | Disponibilizar caixas de separação para equipe de dispensação | Manuseio Físico | FLUXO | caixas | 40 |

`SEFAP-002-01` é **atividade autônoma, sem vínculo com o F5**. A ordenação das guias é operação de lote, executada uma vez por turno — não se repete a cada paciente. Mesma lógica aplicada a `SEDIS-002-01`.

Com corrida = paciente, o F5 fica diretamente comparável ao F6 na mesma unidade: tempo de separação por paciente versus tempo de dispensação por paciente.

**SEFAP-003 · Dispensação de Produtos** — F6, corrida = 1 paciente

| Código | Etapa | Atividade | Tipo | Modo | Unidade | Meta |
|---|---|---|---|---|---|---|
| SEFAP-003-01 | 1 | Setup inicial (abertura na prescrição do IW e identificação do volume) | Manuseio Físico | FLUXO | — | 40 |
| SEFAP-003-02 | 2 | Bipagem dos itens separados | Conferência/Verificação | FLUXO | itens | 40 |
| SEFAP-003-03 | 3 | Geração do protocolo e organização dos volumes dispensados | Registro/Documentação | FLUXO | — | 40 |
| SEFAP-003-04 | — | Transferência dos volumes fechados para a área de expedição | Manuseio Físico | AVULSA | — | 15 |

**SEFAP-004 · Acréscimo ou Admissão** — F7, corrida = 1 paciente

| Código | Etapa | Atividade | Tipo | Modo | Unidade | Meta |
|---|---|---|---|---|---|---|
| SEFAP-004-01 | 1 | Impressão da guia de dispensação | Registro/Documentação | FLUXO | — | 20 |
| SEFAP-004-02 | 2 | Separar e agrupar os materiais e medicamentos | Manuseio Físico | FLUXO | itens | 20 |
| SEFAP-004-03 | 3 | Bipar os itens separados | Conferência/Verificação | FLUXO | itens | 20 |
| SEFAP-004-04 | 4 | Empacotar todos os itens | Manuseio Físico | FLUXO | volumes | 20 |
| SEFAP-004-05 | 5 | Realização do protocolo e impressão da prescrição (setup final) | Registro/Documentação | FLUXO | — | 20 |
| SEFAP-004-06 | 6 | Direcionar itens para logística | Manuseio Físico | FLUXO | — | 20 |

**SEFAP-005 · Pendências Pré-rota** — F8, corrida = **1 lote diário de pendências** (vários pacientes)

| Código | Etapa | Atividade | Tipo | Modo | Unidade | Meta |
|---|---|---|---|---|---|---|
| SEFAP-005-01 | 1 | Imprimir a lista de pendências das rotas já separadas | Organização | FLUXO | — | 10 |
| SEFAP-005-02 | 2 | Separar os itens de pendências que serão dispensados | Manuseio Físico | FLUXO | itens | 10 |
| SEFAP-005-03 | 3 | Bipagem e dispensação dos itens separados | Conferência/Verificação | FLUXO | itens | 10 |
| SEFAP-005-04 | 4 | Organização e identificação dos volumes | Manuseio Físico | FLUXO | volumes | 10 |
| SEFAP-005-05 | 5 | Imprimir os protocolos, anexar aos volumes e transferir para fila de expedição | Manuseio Físico | FLUXO | — | 10 |

Operação de lote diário: **1 corrida por dia**. Meta de 10 = 10 dias úteis de coleta.

**SIST-000 · Eventos de Interrupção**

| Código | Atividade | Tipo | Modo | Unidade | Meta |
|---|---|---|---|---|---|
| SIST-000-01 | Interrupção (motivo livre) | Interrupção | **INTERRUPCAO global** | — | 0 *(sem meta)* |

`interrupcao_global = true`, `exige_motivo = true`. Disponível em toda corrida de fluxo e toda sessão de ciclo.

**Conferência de totais:** 27 etapas em fluxo + 5 avulsas + 1 ciclo autônomo + 2 interrupções = **35 atividades**.

### 3.4 Base das metas amostrais

As metas substituem o 40 uniforme e seguem a lógica clássica de cronoanálise: **o n necessário cai conforme o ciclo alonga**, porque ciclos longos têm variabilidade relativa menor.

| Perfil | Meta | Aplicação |
|---|---|---|
| Ciclo curto repetitivo (segundos) | 100 | Etiquetagem de item |
| Ciclo médio repetitivo (dezenas de segundos) | 60 | Armazenagem de volume |
| Etapa de fluxo de alta frequência (por paciente) | 40 | F5, F6 |
| Etapa de fluxo de frequência média | 30 | F1, F3 |
| Etapa de fluxo de frequência baixa | 25 | F2 |
| Etapa de fluxo longo (5+ etapas) | 20 | F7 |
| **Etapa de fluxo de lote diário (1 corrida/dia)** | **10** | **F4, F8** |
| Etapa condicional | 20 | SEDIS-001-03 |
| Avulsa de lote (1×/turno ou 1×/dia) | 10–12 | SEFAP-002-01, organização |
| Avulsa intermitente | 15 | Transferência para expedição |
| Interrupção | 15 / sem meta | Oportunística |

**Restrição de calendário — atenção.** F4 e F8 rodam **uma vez por dia**. A meta de corridas é, literalmente, o número de dias úteis de coleta necessários para fechá-los: 10 corridas = 10 dias. Metas maiores (as 25 e 20 do rascunho anterior) exigiriam 4 a 5 semanas e travariam o encerramento do estudo. Se o prazo apertar ainda mais, esses dois são os primeiros a reduzir — 8 corridas ainda sustentam média e mediana, embora enfraqueçam o p90.

Volume total: **~890 medições**, contra 1.325 no esquema uniforme — e estatisticamente mais defensável, porque o n de cada atividade é proporcional à sua variabilidade esperada.

> Reavaliar após a primeira semana. Atividade com coeficiente de variação abaixo de 0,15 na metade da meta pode encerrar antes; acima de 0,30, ou precisa de mais amostras ou o processo não é padronizado — nos dois casos, achado relevante para o projeto.

### 3.5 Colaboradores (47)

**45 executantes** (lista v1, inalterada) + **2 observadores exclusivos**:

```sql
insert into colaboradores (nome, eh_observador) values
  ('YGOR CIRAUDO',   true),
  ('DOUGLAS PIRES',  true);
```

> **Nota:** nenhum dos dois consta da lista original de 45 — são inclusões novas, não remoções. Os dois `DOUGLAS` já cadastrados (Douglas de Souza Rangel e Douglas Rodrigues da Silva) são pessoas diferentes e permanecem como executantes. Conferir a grafia dos dois nomes novos antes do seed.

Regra de exibição: `eh_observador = true` → aparece **apenas** no seletor de observador. `false` → aparece **apenas** no seletor de executante.

---

## 4. Modos novos — especificação funcional

### 4.1 CICLO_EM_FLUXO — etapa 2 do F2

1. Etapa 1 corre normalmente (`PRÓXIMA ETAPA`).
2. Ao entrar na etapa 2, a tela troca: botão primário vira **CICLO**, com contador e média corrente visíveis.
3. Cada toque grava uma `medicao` com o `corrida_id` da corrida, `ordem_etapa = 2`, `ordem = nº do ciclo`. O cronômetro da corrida **não para**.
4. Botão secundário **CONCLUIR ETAPA** encerra o bloco de ciclos e avança para a etapa 3.
5. Etapa 3 volta ao comportamento normal.

O tempo da etapa 2 é a soma das medições de ciclo.

### 4.2 INTERRUPCAO

Dois gatilhos, mesma mecânica:

- **Catalogada** (`SEFAP-002-03`): botão **⏸ ABASTECER GÔNDOLA**, visível apenas em corridas do F5. Pede quantidade (`itens`) ao retomar.
- **Genérica** (`SIST-000-01`): botão **⏸ INTERROMPER**, visível em toda corrida de fluxo e toda sessão de ciclo. Pede **motivo em texto livre** (obrigatório) ao retomar. Sem quantidade.

Comportamento comum:

1. Ao acionar: cronômetro da etapa e da corrida **pausam**; um terceiro cronômetro, em âmbar, começa.
2. Tela exibe **`FLUXO PAUSADO`** de forma inequívoca — sem isso o colaborador acha que parou tudo e encerra a corrida.
3. **RETOMAR** grava a `medicao` com `eh_interrupcao = true` e o `corrida_id` vigente, soma em `corridas.tempo_pausado_ms`, incrementa `qtd_interrupcoes`, e retoma os cronômetros de onde pararam.
4. Múltiplas interrupções por corrida são permitidas.

As medições das etapas registram **tempo líquido**. A duração bruta se recupera somando `tempo_pausado_ms`.

O motivo livre é dado de descoberta: motivo que se repete na coleta vira candidato a interrupção catalogada — e provavelmente aponta uma falha estrutural que o layout deve resolver.

---

## 5. UI

| Tela | Alteração |
|---|---|
| Abertura de sessão | **Remover** o campo *Papel*. Passa a 5 campos: executante, turno, tipo de coleta, observador (se OBSERVADO), dispositivo |
| Seletores de pessoa | Executante lista só `eh_observador = false`; observador lista só `true` |
| Catálogo | Agrupar por **Processo** (9 grupos operacionais; SIST-000 não aparece). Fluxos como card único; avulsas e o ciclo autônomo soltos |
| Cronômetro FLUXO | Suportar etapa com `modo_etapa = CICLO_EM_FLUXO` (§4.1) |
| Cronômetro FLUXO | Exibir `condicao` em etapa opcional |
| Cronômetro FLUXO | Botão de interrupção catalogada (só no F5) + botão de interrupção genérica (sempre) |
| Cronômetro CICLO | Botão de interrupção genérica |
| Estado pausado | Indicação visual inequívoca em toda a tela, não só no botão |
| Variantes | Nenhuma atividade v2 usa. Manter o código dormente |

Diretrizes de UI do plano v1 permanecem: botão primário ≥40% da altura da tela, wake lock, vibração no toque, cronômetro mono ≥48px, descarte em cinza discreto.

---

## 6. Dashboard e export

**Cobertura amostral:** agrupar por Processo. Meta por atividade conforme §3.3, não mais 40 fixo. `SIST-000-01` fora da contagem de cobertura.

**Métricas novas:**

| Métrica | Cálculo |
|---|---|
| Tempo líquido × bruto por corrida | `duração total` e `duração total − tempo_pausado_ms` |
| Taxa de interrupção por fluxo | corridas com `qtd_interrupcoes > 0` ÷ total de corridas |
| **% do tempo de separação perdido com gôndola vazia** | Σ `tempo_pausado_ms` ÷ Σ duração bruta, no F5 |
| Setup × ciclo no F2 | Tempo das etapas 1 e 3 versus tempo total da etapa 2 |
| Tempo por ciclo de etiquetagem | Média das medições da etapa 2 do F2 |
| Motivos de interrupção genérica | Contagem e tempo total agrupados por `motivo_interrupcao` |

A métrica de gôndola vazia é o número-título do estudo: quantifica diretamente uma perda causada pelo layout atual.

**Export CSV** — adicionar: `codigo_atividade`, `ordem_etapa`, `eh_interrupcao`, `motivo_interrupcao`, `tempo_pausado_ms`, `qtd_interrupcoes`. Remover: `papel`. Manter `;` como separador e UTF-8 com BOM.

---

## 7. Reset da base

As medições do piloto referenciam atividades inexistentes e etapas com fronteira diferente. Não há de-para válido nem amostra relevante a preservar.

```sql
truncate medicoes, corridas, sessoes cascade;
```

Sem export prévio.

---

## 8. Blocos de execução

| Bloco | Duração | Entrega | Aceite |
|---|---|---|---|
| **M0** | 5 min | `truncate` das tabelas de coleta | Base zerada |
| **M1** | 45 min | DDL da Seção 2; decidir `ordem_etapa` × `ordem` | Migração limpa; enums novos disponíveis |
| **M2** | 45 min | Seed: 10 processos, 8 fluxos, 35 atividades, 27 etapas, 47 colaboradores | Query retorna os totais exatos; nenhum código duplicado |
| **M3** | 45 min | Remoção do papel; catálogo por processo; separação executante/observador | Sessão grava com 5 campos; Ygor e Douglas Pires não aparecem como executantes |
| **M4** | 1h30 | Ciclo dentro de fluxo (§4.1) | Corrida do F2 com 12 ciclos → 1 corrida + 2 medições de etapa + 12 de ciclo, com `ordem_etapa` e `ordem` corretos |
| **M5** | 1h30 | Interrupção catalogada e genérica (§4.2) | Corrida do F5 com uma de cada: `tempo_pausado_ms` correto, motivo gravado, etapas com tempo líquido |
| **M6** | 1h30 | Métricas e colunas novas de export | Métricas renderizam; CSV abre no Excel pt-BR com acentuação íntegra |
| **M7** | 1h | Piloto: 1 corrida do F2 e 1 do F5 com interrupção | Dado íntegro e coerente no dashboard |

**Ordem de corte:** M7 → M6 (consulta direta no Supabase Studio). **M4 e M5 não cortam** — são o motivo da migração.

---

## 9. Critérios de aceite

- [ ] 10 processos, 8 fluxos, 35 atividades, 27 etapas de fluxo, 47 colaboradores
- [ ] Nenhum identificador de fluxo duplicado
- [ ] Toda atividade com `codigo` único no padrão `POP-NN`
- [ ] `tipo_atividade` restrito aos 6 valores da taxonomia
- [ ] `unidade` restrita ao vocabulário fechado
- [ ] `SEDIS-002-01` e `SEFAP-002-01` são AVULSA, sem vínculo com F2 e F5
- [ ] Corridas de F4 e F8 pedem quantidade de `pacientes` ao encerrar
- [ ] Ygor Ciraudo e Douglas Pires aparecem apenas como observadores
- [ ] Campo *Papel* ausente de toda a aplicação
- [ ] Corrida do F2 distingue medições de etapa e de ciclo via `ordem_etapa` × `ordem`
- [ ] Corrida com interrupção: soma das etapas + `tempo_pausado_ms` = duração bruta (±100ms)
- [ ] Interrupção genérica exige motivo e está disponível em todos os fluxos e no ciclo autônomo
- [ ] Interrupções não aparecem na sequência de etapas do fluxo no dashboard
- [ ] Métrica de gôndola vazia calcula corretamente
- [ ] `SUPABASE_SERVICE_ROLE_KEY` ausente do bundle cliente (`grep -r` em `.next/static`)
- [ ] `/painel` sem PIN retorna 401
- [ ] `SELECT` em `medicoes` com a chave anon retorna vazio ou erro

---

## 10. Unidades de corrida — confirmadas

Todas validadas com o responsável pelo mapeamento. Não há premissa pendente neste documento.

| Fluxo | Uma corrida corresponde a | Consequência |
|---|---|---|
| F1 | 1 nota fiscal (1 entrega de fornecedor) | — |
| F2 | 1 lote de etiquetagem | Etapa 2 em modo ciclo |
| F3 | 1 nota fiscal | — |
| F4 | **as rotas de um dia inteiro**, vários pacientes | 1 corrida/dia · meta 10 · quantidade em `pacientes` |
| F5 | **a rota completa de 1 paciente** | Alta frequência · meta 40 · comparável ao F6 |
| F6 | 1 paciente | Alta frequência · meta 40 |
| F7 | 1 paciente (admissão ou acréscimo) | — |
| F8 | **1 lote diário de pendências**, vários pacientes | 1 corrida/dia · meta 10 · quantidade em `pacientes` |

Duas atividades de setup foram retiradas de seus fluxos por serem operações de lote que não se repetem a cada corrida: `SEDIS-002-01` (configuração de rótulos) e `SEFAP-002-01` (ordenação das guias). Ambas passaram a AVULSA.
