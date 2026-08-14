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

-- ============================================================
-- SEED — PAPÉIS (7)
-- ============================================================

insert into papeis (nome, ordem) values
  ('Auxiliar de Farmácia - Recebimento', 1),
  ('Auxiliar de Farmácia / Produção', 2),
  ('Auxiliar de Impressão de Rotas', 3),
  ('Auxiliar de Separação', 4),
  ('Auxiliar de Dispensação (Bipagem)', 5),
  ('Auxiliar de Farmácia (Dispensação de Pendências)', 6),
  ('Farmacêutico', 7);

-- ============================================================
-- SEED — PROCESSOS (6)
-- ============================================================

insert into processos (codigo, nome, ordem) values
  ('SEDIS-001', 'Recebimento de Mercadorias', 1),
  ('SEDIS-002', 'Fracionamento e Etiquetagem de Mercadorias', 2),
  ('SEDIS-003', 'Armazenamento de Mercadorias', 3),
  ('SEDIS-004', 'Lançamento de Notas Fiscais', 4),
  ('SEFAP-001', 'Separação e Dispensação de Produtos', 5),
  ('SEFAP-002', 'Pendências Pré-rota', 6);

-- ============================================================
-- SEED — ATIVIDADES (56)
-- Meta amostral: 5 para as 6 atividades de natureza Eventual (nº 11,12,13,35,36,37),
-- conforme item A03 do plano — o default de 40 é inatingível para exceções raras.
-- ============================================================

insert into atividades (numero, processo_id, papel_id, nome, tipo_atividade, natureza, modo, unidade, requer_quantidade, meta_amostras) values
-- SEDIS-001 — Recebimento de Mercadorias (papel: Auxiliar de Farmácia - Recebimento)
(1,  (select id from processos where codigo='SEDIS-001'), (select id from papeis where nome='Auxiliar de Farmácia - Recebimento'), 'Retirar o relatório de itens digitados na NF junto ao auxiliar de lançamento', 'Coordenação', 'Rotina', 'FLUXO', null, false, 40),
(4,  (select id from processos where codigo='SEDIS-001'), (select id from papeis where nome='Auxiliar de Farmácia - Recebimento'), 'Receber o fornecedor e conferir os dados da nota fiscal', 'Conferência/Verificação', 'Rotina', 'FLUXO', null, false, 40),
(2,  (select id from processos where codigo='SEDIS-001'), (select id from papeis where nome='Auxiliar de Farmácia - Recebimento'), 'Conferir os itens recebidos e segregados na área de recebimento', 'Conferência/Verificação', 'Rotina', 'FLUXO', 'itens', true, 40),
(3,  (select id from processos where codigo='SEDIS-001'), (select id from papeis where nome='Auxiliar de Farmácia - Recebimento'), 'Direcionar os insumos por tipo (etiquetagem ou armazenamento)', 'Manuseio Físico', 'Rotina', 'FLUXO', 'volumes', true, 40),
(5,  (select id from processos where codigo='SEDIS-001'), (select id from papeis where nome='Auxiliar de Farmácia - Recebimento'), 'Conferir fisicamente medicamentos comuns', 'Conferência/Verificação', 'Rotina', 'FLUXO', 'itens', true, 40),
(6,  (select id from processos where codigo='SEDIS-001'), (select id from papeis where nome='Auxiliar de Farmácia - Recebimento'), 'Conferir fisicamente medicamentos termolábeis', 'Conferência/Verificação', 'Rotina', 'FLUXO', 'itens', true, 40),
(7,  (select id from processos where codigo='SEDIS-001'), (select id from papeis where nome='Auxiliar de Farmácia - Recebimento'), 'Conferir fisicamente produtos para saúde', 'Conferência/Verificação', 'Rotina', 'FLUXO', 'itens', true, 40),
(8,  (select id from processos where codigo='SEDIS-001'), (select id from papeis where nome='Auxiliar de Farmácia - Recebimento'), 'Conferir fisicamente dietas enterais', 'Conferência/Verificação', 'Rotina', 'FLUXO', 'itens', true, 40),
(9,  (select id from processos where codigo='SEDIS-001'), (select id from papeis where nome='Auxiliar de Farmácia - Recebimento'), 'Finalizar o recebimento (carimbar, identificar/segregar volumes, encaminhar)', 'Registro/Documentação', 'Rotina', 'FLUXO', 'volumes', true, 40),
(10, (select id from processos where codigo='SEDIS-001'), (select id from papeis where nome='Auxiliar de Farmácia - Recebimento'), 'Organizar o posto de trabalho', 'Organização', 'Rotina', 'AVULSA', null, false, 40),
(11, (select id from processos where codigo='SEDIS-001'), (select id from papeis where nome='Auxiliar de Farmácia - Recebimento'), 'Tratar destinatário incorreto (devolver NF e orientar o fornecedor)', 'Correção de Exceção', 'Eventual', 'AVULSA', null, false, 5),
(12, (select id from processos where codigo='SEDIS-001'), (select id from papeis where nome='Auxiliar de Farmácia - Recebimento'), 'Tratar CNPJ incorreto (informar compras / solicitar carta de correção)', 'Correção de Exceção', 'Eventual', 'AVULSA', null, false, 5),
(13, (select id from processos where codigo='SEDIS-001'), (select id from papeis where nome='Auxiliar de Farmácia - Recebimento'), 'Tratar não conformidade (informar compras e aguardar devolutiva)', 'Correção de Exceção', 'Eventual', 'AVULSA', null, false, 5),

-- SEDIS-002 — Fracionamento e Etiquetagem (papel: Auxiliar de Farmácia / Produção)
(14, (select id from processos where codigo='SEDIS-002'), (select id from papeis where nome='Auxiliar de Farmácia / Produção'), 'Configurar a quantidade de rótulos e a fração da embalagem primária', 'Registro/Documentação', 'Rotina', 'AVULSA', null, false, 40),
(15, (select id from processos where codigo='SEDIS-002'), (select id from papeis where nome='Auxiliar de Farmácia / Produção'), 'Etiquetar cada embalagem primária', 'Manuseio Físico', 'Rotina', 'CICLO', 'embalagem', true, 40),

-- SEDIS-003 — Armazenamento (papel: Auxiliar de Farmácia / Produção)
(16, (select id from processos where codigo='SEDIS-003'), (select id from papeis where nome='Auxiliar de Farmácia / Produção'), 'Verificar os bins e reabastecer com subestoque — Medicamentos (FEFO)', 'Manuseio Físico', 'Rotina', 'FLUXO', null, false, 40),
(17, (select id from processos where codigo='SEDIS-003'), (select id from papeis where nome='Auxiliar de Farmácia / Produção'), 'Verificar itens etiquetados disponíveis para armazenamento — Medicamentos', 'Conferência/Verificação', 'Rotina', 'FLUXO', 'itens', true, 40),
(18, (select id from processos where codigo='SEDIS-003'), (select id from papeis where nome='Auxiliar de Farmácia / Produção'), 'Armazenar medicamentos padrão (bins/subestoque)', 'Armazenagem', 'Rotina', 'FLUXO', 'itens', true, 40),
(19, (select id from processos where codigo='SEDIS-003'), (select id from papeis where nome='Auxiliar de Farmácia / Produção'), 'Armazenar medicamentos psicotrópicos/controle especial (sala específica)', 'Armazenagem', 'Rotina', 'FLUXO', 'itens', true, 40),
(20, (select id from processos where codigo='SEDIS-003'), (select id from papeis where nome='Auxiliar de Farmácia / Produção'), 'Armazenar medicamentos termolábeis (Geladeira 1/2/3)', 'Armazenagem', 'Rotina', 'FLUXO', 'itens', true, 40),
(21, (select id from processos where codigo='SEDIS-003'), (select id from papeis where nome='Auxiliar de Farmácia / Produção'), 'Verificar as estantes e reabastecer com subestoque — Dietas enterais (FEFO)', 'Manuseio Físico', 'Rotina', 'FLUXO', null, false, 40),
(22, (select id from processos where codigo='SEDIS-003'), (select id from papeis where nome='Auxiliar de Farmácia / Produção'), 'Verificar dietas recebidas/etiquetadas disponíveis para armazenamento', 'Conferência/Verificação', 'Rotina', 'FLUXO', 'itens', true, 40),
(23, (select id from processos where codigo='SEDIS-003'), (select id from papeis where nome='Auxiliar de Farmácia / Produção'), 'Armazenar a dieta enteral etiquetada', 'Armazenagem', 'Rotina', 'FLUXO', 'itens', true, 40),
(24, (select id from processos where codigo='SEDIS-003'), (select id from papeis where nome='Auxiliar de Farmácia / Produção'), 'Verificar as estantes e reabastecer — Produtos p/ saúde loteados (FEFO)', 'Manuseio Físico', 'Rotina', 'FLUXO', null, false, 40),
(25, (select id from processos where codigo='SEDIS-003'), (select id from papeis where nome='Auxiliar de Farmácia / Produção'), 'Verificar materiais loteados etiquetados disponíveis', 'Conferência/Verificação', 'Rotina', 'FLUXO', 'itens', true, 40),
(26, (select id from processos where codigo='SEDIS-003'), (select id from papeis where nome='Auxiliar de Farmácia / Produção'), 'Armazenar o material etiquetado (bins/estantes ou subestoque)', 'Armazenagem', 'Rotina', 'FLUXO', 'itens', true, 40),
(27, (select id from processos where codigo='SEDIS-003'), (select id from papeis where nome='Auxiliar de Farmácia / Produção'), 'Verificar as estantes e reabastecer — Produtos p/ saúde não-loteados (FEFO)', 'Manuseio Físico', 'Rotina', 'FLUXO', null, false, 40),
(28, (select id from processos where codigo='SEDIS-003'), (select id from papeis where nome='Auxiliar de Farmácia / Produção'), 'Verificar materiais recebidos disponíveis para armazenamento', 'Conferência/Verificação', 'Rotina', 'FLUXO', 'itens', true, 40),
(29, (select id from processos where codigo='SEDIS-003'), (select id from papeis where nome='Auxiliar de Farmácia / Produção'), 'Armazenar o material no subestoque', 'Armazenagem', 'Rotina', 'FLUXO', 'itens', true, 40),
(30, (select id from processos where codigo='SEDIS-003'), (select id from papeis where nome='Auxiliar de Farmácia / Produção'), 'Desmontar e organizar embalagens não utilizáveis (descarte)', 'Organização', 'Rotina', 'AVULSA', null, false, 40),

-- SEDIS-004 — Lançamento de Notas Fiscais (papel: Auxiliar de Farmácia / Produção)
(31, (select id from processos where codigo='SEDIS-004'), (select id from papeis where nome='Auxiliar de Farmácia / Produção'), 'Carregar dados da NF e preencher campos gerais (datas, valor, vencimentos, frete, boletos)', 'Registro/Documentação', 'Rotina', 'FLUXO', null, false, 40),
(32, (select id from processos where codigo='SEDIS-004'), (select id from papeis where nome='Auxiliar de Farmácia / Produção'), 'Vincular ao pedido do fornecedor e preencher dados do item (qtd, lote, validade, fabricante)', 'Registro/Documentação', 'Rotina', 'FLUXO', 'itens', true, 40),
(33, (select id from processos where codigo='SEDIS-004'), (select id from papeis where nome='Auxiliar de Farmácia / Produção'), 'Concluir o lançamento (anotar ID gerado e direcionar NF física ao financeiro)', 'Registro/Documentação', 'Rotina', 'FLUXO', null, false, 40),
(34, (select id from processos where codigo='SEDIS-004'), (select id from papeis where nome='Auxiliar de Farmácia / Produção'), 'Organizar as notas fiscais físicas ao final do expediente', 'Organização', 'Rotina', 'AVULSA', 'notas', true, 40),
(35, (select id from processos where codigo='SEDIS-004'), (select id from papeis where nome='Auxiliar de Farmácia / Produção'), 'Corrigir divergência de prazo de pagamento', 'Correção de Exceção', 'Eventual', 'AVULSA', null, false, 5),
(36, (select id from processos where codigo='SEDIS-004'), (select id from papeis where nome='Auxiliar de Farmácia / Produção'), 'Corrigir divergência de valor da nota fiscal', 'Correção de Exceção', 'Eventual', 'AVULSA', null, false, 5),
(37, (select id from processos where codigo='SEDIS-004'), (select id from papeis where nome='Auxiliar de Farmácia / Produção'), 'Completar campo pendente de lançamento', 'Correção de Exceção', 'Eventual', 'AVULSA', null, false, 5),

-- SEFAP-001 — Separação e Dispensação
(38, (select id from processos where codigo='SEFAP-001'), (select id from papeis where nome='Auxiliar de Impressão de Rotas'), 'Separar e dividir as rotas entre os auxiliares de separação', 'Coordenação', 'Rotina', 'AVULSA', 'rotas', true, 40),
(39, (select id from processos where codigo='SEFAP-001'), (select id from papeis where nome='Auxiliar de Separação'), 'Embalar formas líquidas/pastosas (embalagem original)', 'Manuseio Físico', 'Rotina', 'CICLO', 'item', true, 40),
(40, (select id from processos where codigo='SEFAP-001'), (select id from papeis where nome='Auxiliar de Separação'), 'Embalar ampolas (proteção com plástico bolha)', 'Manuseio Físico', 'Rotina', 'CICLO', 'item', true, 40),
(41, (select id from processos where codigo='SEFAP-001'), (select id from papeis where nome='Auxiliar de Separação'), 'Embalar comprimidos/cápsulas/drágeas (embalagem primária)', 'Manuseio Físico', 'Rotina', 'CICLO', 'item', true, 40),
(42, (select id from processos where codigo='SEFAP-001'), (select id from papeis where nome='Auxiliar de Separação'), 'Embalar óleos e álcool (saco individualizado)', 'Manuseio Físico', 'Rotina', 'CICLO', 'item', true, 40),
(43, (select id from processos where codigo='SEFAP-001'), (select id from papeis where nome='Auxiliar de Separação'), 'Embalar dietas/soro/materiais de alta cubagem (caixa de papelão)', 'Manuseio Físico', 'Rotina', 'CICLO', 'item', true, 40),
(44, (select id from processos where codigo='SEFAP-001'), (select id from papeis where nome='Auxiliar de Separação'), 'Direcionar os volumes ao setor de dispensação (anotar total de volumes)', 'Manuseio Físico', 'Rotina', 'AVULSA', 'volumes', true, 40),
(45, (select id from processos where codigo='SEFAP-001'), (select id from papeis where nome='Auxiliar de Dispensação (Bipagem)'), 'Recolher os volumes a serem bipados (um paciente por vez)', 'Manuseio Físico', 'Rotina', 'FLUXO', 'volumes', true, 40),
(46, (select id from processos where codigo='SEFAP-001'), (select id from papeis where nome='Auxiliar de Dispensação (Bipagem)'), 'Bipar os itens separados', 'Conferência/Verificação', 'Rotina', 'FLUXO', 'itens', true, 40),
(47, (select id from processos where codigo='SEFAP-001'), (select id from papeis where nome='Auxiliar de Dispensação (Bipagem)'), 'Identificar o responsável pela separação da rota e confirmar a dispensação', 'Conferência/Verificação', 'Rotina', 'FLUXO', null, false, 40),
(48, (select id from processos where codigo='SEFAP-001'), (select id from papeis where nome='Auxiliar de Dispensação (Bipagem)'), 'Registrar a conferência (volumes, data, tipo de entrega, geladeira, natureza)', 'Registro/Documentação', 'Rotina', 'FLUXO', null, false, 40),
(49, (select id from processos where codigo='SEFAP-001'), (select id from papeis where nome='Auxiliar de Dispensação (Bipagem)'), 'Direcionar os volumes e protocolos à expedição', 'Manuseio Físico', 'Rotina', 'FLUXO', 'volumes', true, 40),
(50, (select id from processos where codigo='SEFAP-001'), (select id from papeis where nome='Auxiliar de Dispensação (Bipagem)'), 'Organizar a bancada ao final do expediente', 'Organização', 'Rotina', 'AVULSA', null, false, 40),

-- SEFAP-002 — Pendências Pré-rota
(51, (select id from processos where codigo='SEFAP-002'), (select id from papeis where nome='Farmacêutico'), 'Analisar o arquivo de pendências em Excel e montar a contagem de itens', 'Análise', 'Rotina', 'AVULSA', 'itens', true, 40),
(52, (select id from processos where codigo='SEFAP-002'), (select id from papeis where nome='Farmacêutico'), 'Realizar o pedido de compras no sistema para os itens pendentes', 'Registro/Documentação', 'Rotina', 'AVULSA', 'itens', true, 40),
(53, (select id from processos where codigo='SEFAP-002'), (select id from papeis where nome='Farmacêutico'), 'Registrar o acompanhamento do pedido de compras', 'Registro/Documentação', 'Rotina', 'AVULSA', 'pedidos', true, 40),
(54, (select id from processos where codigo='SEFAP-002'), (select id from papeis where nome='Auxiliar de Farmácia (Dispensação de Pendências)'), 'Realizar a dispensação dos itens pendentes já recebidos', 'Manuseio Físico', 'Rotina', 'AVULSA', 'itens', true, 40),
(55, (select id from processos where codigo='SEFAP-002'), (select id from papeis where nome='Farmacêutico'), 'Realizar reunião presencial com o setor de compras', 'Comunicação/Reunião', 'Rotina', 'AVULSA', null, false, 40),
(56, (select id from processos where codigo='SEFAP-002'), (select id from papeis where nome='Farmacêutico'), 'Realizar reunião via Teams com a equipe multidisciplinar', 'Comunicação/Reunião', 'Rotina', 'AVULSA', null, false, 40);

-- ============================================================
-- SEED — FLUXOS (7)
-- ============================================================

insert into fluxos (processo_id, nome, unidade_corrida, ordem) values
  ((select id from processos where codigo='SEDIS-001'), 'Recebimento por NF', 'nota fiscal', 1),
  ((select id from processos where codigo='SEDIS-003'), 'Armazenamento: Medicamentos', 'reposição', 2),
  ((select id from processos where codigo='SEDIS-003'), 'Armazenamento: Dietas enterais', 'reposição', 3),
  ((select id from processos where codigo='SEDIS-003'), 'Armazenamento: PPS loteados', 'reposição', 4),
  ((select id from processos where codigo='SEDIS-003'), 'Armazenamento: PPS não-loteados', 'reposição', 5),
  ((select id from processos where codigo='SEDIS-004'), 'Lançamento de NF', 'nota fiscal', 6),
  ((select id from processos where codigo='SEFAP-001'), 'Bipagem por paciente', 'paciente', 7);

-- ============================================================
-- SEED — FLUXO_ETAPAS
-- ============================================================

-- F1 — Recebimento por NF: 1 → 4 → 2 → 3 → [5|6|7|8] → 9
insert into fluxo_etapas (fluxo_id, atividade_id, ordem, variante) values
  ((select id from fluxos where nome='Recebimento por NF'), (select id from atividades where numero=1), 1, false),
  ((select id from fluxos where nome='Recebimento por NF'), (select id from atividades where numero=4), 2, false),
  ((select id from fluxos where nome='Recebimento por NF'), (select id from atividades where numero=2), 3, false),
  ((select id from fluxos where nome='Recebimento por NF'), (select id from atividades where numero=3), 4, false),
  ((select id from fluxos where nome='Recebimento por NF'), (select id from atividades where numero=5), 5, true),
  ((select id from fluxos where nome='Recebimento por NF'), (select id from atividades where numero=6), 5, true),
  ((select id from fluxos where nome='Recebimento por NF'), (select id from atividades where numero=7), 5, true),
  ((select id from fluxos where nome='Recebimento por NF'), (select id from atividades where numero=8), 5, true),
  ((select id from fluxos where nome='Recebimento por NF'), (select id from atividades where numero=9), 6, false);

-- F2 — Armazenamento: Medicamentos: 16 → 17 → [18|19|20]
insert into fluxo_etapas (fluxo_id, atividade_id, ordem, variante) values
  ((select id from fluxos where nome='Armazenamento: Medicamentos'), (select id from atividades where numero=16), 1, false),
  ((select id from fluxos where nome='Armazenamento: Medicamentos'), (select id from atividades where numero=17), 2, false),
  ((select id from fluxos where nome='Armazenamento: Medicamentos'), (select id from atividades where numero=18), 3, true),
  ((select id from fluxos where nome='Armazenamento: Medicamentos'), (select id from atividades where numero=19), 3, true),
  ((select id from fluxos where nome='Armazenamento: Medicamentos'), (select id from atividades where numero=20), 3, true);

-- F3 — Armazenamento: Dietas enterais: 21 → 22 → 23
insert into fluxo_etapas (fluxo_id, atividade_id, ordem, variante) values
  ((select id from fluxos where nome='Armazenamento: Dietas enterais'), (select id from atividades where numero=21), 1, false),
  ((select id from fluxos where nome='Armazenamento: Dietas enterais'), (select id from atividades where numero=22), 2, false),
  ((select id from fluxos where nome='Armazenamento: Dietas enterais'), (select id from atividades where numero=23), 3, false);

-- F4 — Armazenamento: PPS loteados: 24 → 25 → 26
insert into fluxo_etapas (fluxo_id, atividade_id, ordem, variante) values
  ((select id from fluxos where nome='Armazenamento: PPS loteados'), (select id from atividades where numero=24), 1, false),
  ((select id from fluxos where nome='Armazenamento: PPS loteados'), (select id from atividades where numero=25), 2, false),
  ((select id from fluxos where nome='Armazenamento: PPS loteados'), (select id from atividades where numero=26), 3, false);

-- F5 — Armazenamento: PPS não-loteados: 27 → 28 → 29
insert into fluxo_etapas (fluxo_id, atividade_id, ordem, variante) values
  ((select id from fluxos where nome='Armazenamento: PPS não-loteados'), (select id from atividades where numero=27), 1, false),
  ((select id from fluxos where nome='Armazenamento: PPS não-loteados'), (select id from atividades where numero=28), 2, false),
  ((select id from fluxos where nome='Armazenamento: PPS não-loteados'), (select id from atividades where numero=29), 3, false);

-- F6 — Lançamento de NF: 31 → 32 → 33
insert into fluxo_etapas (fluxo_id, atividade_id, ordem, variante) values
  ((select id from fluxos where nome='Lançamento de NF'), (select id from atividades where numero=31), 1, false),
  ((select id from fluxos where nome='Lançamento de NF'), (select id from atividades where numero=32), 2, false),
  ((select id from fluxos where nome='Lançamento de NF'), (select id from atividades where numero=33), 3, false);

-- F7 — Bipagem por paciente: 45 → 46 → 47 → 48 → 49
insert into fluxo_etapas (fluxo_id, atividade_id, ordem, variante) values
  ((select id from fluxos where nome='Bipagem por paciente'), (select id from atividades where numero=45), 1, false),
  ((select id from fluxos where nome='Bipagem por paciente'), (select id from atividades where numero=46), 2, false),
  ((select id from fluxos where nome='Bipagem por paciente'), (select id from atividades where numero=47), 3, false),
  ((select id from fluxos where nome='Bipagem por paciente'), (select id from atividades where numero=48), 4, false),
  ((select id from fluxos where nome='Bipagem por paciente'), (select id from atividades where numero=49), 5, false);

-- ============================================================
-- SEED — COLABORADORES (45)
-- Pendência A01: incluir estagiário(s) observador(es) antes do piloto (B9).
-- ============================================================

insert into colaboradores (nome) values
  ('ADAO ARAUJO DE SOUZA'),
  ('ADRIANA ALLES DA SILVA'),
  ('ALEXANDRE MACIEL DA SILVA'),
  ('ALINE SILVA DE SOUZA'),
  ('ANA VIRGINIA PEREIRA DE SOUSA'),
  ('ANDRE LUIS SILVERIO DA SILVA JUNIOR'),
  ('BEATRIZ DA COSTA MARTINS'),
  ('BIANCA MARIA BATINGA BATISTA'),
  ('BRENDA FREITAS DE MORAES'),
  ('CARLA CRISTINA FERREIRA DE ANDRADE'),
  ('CARLOS ANTONIO DA SILVA ALVES'),
  ('CRISTIAN MENDES'),
  ('DOUGLAS DE SOUZA RANGEL'),
  ('DOUGLAS RODRIGUES DA SILVA'),
  ('EDSON JOSE TRAJANO'),
  ('GABRIEL DOS SANTOS PEREIRA'),
  ('HENRIQUE TELLES DE OLIVEIRA'),
  ('ITALO DOS SANTOS DE VASCONCELLOS'),
  ('JOÃO VITOR OLIVEIRA VENTURA'),
  ('JORGE GOMES VASCONCELOS'),
  ('JOSE COSTA RODRIGUES JUNIOR'),
  ('JOYCE RIBEIRO SOARES'),
  ('JULIA RODRIGUES TARTAGLIA DE SOUZA'),
  ('KAIO CESAR FERNANDES DA SILVA'),
  ('KAYLLAN DA SILVA VIEIRA MARINHO'),
  ('KEILA CAROLINA OLIVEIRA DE SOUZA'),
  ('LUAN LESSA SILVA'),
  ('LUCAS QUINTINO DE OLIVEIRA'),
  ('MARCELO SANT ANNA PEREIRA'),
  ('MATHEUS DA SILVA SAMPAIO'),
  ('MICHEL AREAS DA SILVA REIS'),
  ('PATRICIA MOLINARO'),
  ('PAULO RICARDO PAGANOTO E SOUZA'),
  ('PEDRO CORREIA CANOZA'),
  ('PEDRO FELIPE GASPAR DA ROCHA FREITAS'),
  ('RODRIGO FERNANDES ROSSANI DA SILVA BRITTO'),
  ('RUAN BERNARDINO DOS SANTOS'),
  ('STEFANE DA SILVA TORRES'),
  ('THIAGO ASSIS VALDEVINO DA SILVA'),
  ('THIAGO AUGUSTO SILVA DIAS'),
  ('UILLIANS DA SILVA FREITAS'),
  ('VALTEMAR FRANCISCO VIEIRA'),
  ('VICTORIA CHRYSTINNE DE MOURA GIMA'),
  ('VITORIA CRISTINA LINHARES DE SANTA MARIA'),
  ('YURI SANT ANNA BARROS SANTOS');
