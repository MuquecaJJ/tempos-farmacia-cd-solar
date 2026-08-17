-- M1 — schema v2 (PLANO_MIGRACAO_V2.md, Seção 2).
--
-- Rodar como execução própria no SQL Editor, ANTES de rodar 0007 (M2/seed) —
-- os dois novos valores de modo_coleta precisam estar commitados antes de
-- serem usados em INSERTs (M2 usa 'CICLO_EM_FLUXO' e 'INTERRUPCAO').
--
-- Desvio deliberado do documento: as duas constraints que dependem dos dados
-- já estarem no formato novo (codigo NOT NULL + UNIQUE, e o CHECK de
-- vocabulário de unidade) NÃO estão aqui — ficam no fim da migration 0007,
-- depois que o reseed já populou os valores corretos. Se rodássemos essas
-- constraints aqui, elas quebrariam contra as 56 atividades v1 ainda
-- presentes na tabela (codigo NULL, unidades fora do vocabulário novo).

-- Novos modos.
alter type modo_coleta add value if not exists 'CICLO_EM_FLUXO';
alter type modo_coleta add value if not exists 'INTERRUPCAO';

-- Remoção do papel.
alter table atividades drop column if exists papel_id;
alter table sessoes    drop column if exists papel_id;
drop table if exists papeis;

-- Chave estável de atividade (imune a reordenação de linhas).
alter table atividades add column if not exists codigo text;
alter table atividades drop column if exists numero;

-- Etapa condicional (substitui o conceito de variante).
alter table fluxo_etapas add column if not exists condicao text;
-- a coluna 'variante' fica dormente: nenhuma atividade v2 a usa. Não remover.

-- Etapa de fluxo que roda em modo ciclo.
alter table fluxo_etapas add column if not exists modo_etapa modo_coleta not null default 'FLUXO';

-- Interrupção: escopo de aplicação.
alter table atividades add column if not exists interrompe_fluxo_id smallint references fluxos(id);
alter table atividades add column if not exists interrupcao_global boolean not null default false;
alter table atividades add column if not exists exige_motivo boolean not null default false;

-- Contabilidade de pausa.
alter table corridas add column if not exists tempo_pausado_ms integer not null default 0;
alter table corridas add column if not exists qtd_interrupcoes smallint not null default 0;

-- Vínculo e posicionamento das medições.
alter table medicoes add column if not exists eh_interrupcao boolean not null default false;
alter table medicoes add column if not exists ordem_etapa smallint;
alter table medicoes add column if not exists motivo_interrupcao text;
-- 'ordem' passa a significar EXCLUSIVAMENTE o número do ciclo dentro da etapa.

-- Observador exclusivo.
alter table colaboradores add column if not exists eh_observador boolean not null default false;
