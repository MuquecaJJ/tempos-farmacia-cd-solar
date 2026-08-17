-- M2 — seed v2 (PLANO_MIGRACAO_V2.md, Seção 3).
-- Roda depois de 0006 (M1) já commitada.
--
-- Desvio deliberado do documento: os 2 colaboradores observadores
-- ('YGOR CIRAUDO', 'DOUGLAS PIRES') já existem na tabela desde a migration
-- 0003 — em vez de inserir de novo (violaria unique(nome)), aqui só
-- atualizamos a flag eh_observador. Nenhum insert de colaborador é
-- necessário: 45 executantes + 2 observadores já somam 47.

-- ============================================================
-- RESET DO CATÁLOGO (processos → cascata em fluxos, atividades,
-- fluxo_etapas; e também sessoes → corridas → medicoes, já vazias por M0)
-- ============================================================
truncate processos cascade;

-- ============================================================
-- 3.1 PROCESSOS (10)
-- ============================================================
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

-- ============================================================
-- 3.2 FLUXOS (8)
-- ============================================================
insert into fluxos (processo_id, nome, unidade_corrida, ordem) values
  ((select id from processos where codigo='SEDIS-001'), 'Recebimento por NF', 'nota fiscal', 1),
  ((select id from processos where codigo='SEDIS-002'), 'Etiquetagem', 'lote', 2),
  ((select id from processos where codigo='SEDIS-004'), 'Lançamento de NF', 'nota fiscal', 3),
  ((select id from processos where codigo='SEFAP-001'), 'Preparação das Rotas', 'dia de rotas', 4),
  ((select id from processos where codigo='SEFAP-002'), 'Separação das Rotas', 'paciente', 5),
  ((select id from processos where codigo='SEFAP-003'), 'Dispensação das Rotas', 'paciente', 6),
  ((select id from processos where codigo='SEFAP-004'), 'Acréscimo ou Admissão', 'paciente', 7),
  ((select id from processos where codigo='SEFAP-005'), 'Dispensação de Pendências', 'lote diário de pendências', 8);

-- ============================================================
-- 3.3 ATIVIDADES (35)
-- natureza = 'Rotina' em todas (o conceito v1 de 'Eventual' foi substituído
-- pelo mecanismo de Interrupção). requer_quantidade = true sempre que há
-- unidade.
-- ============================================================

-- SEDIS-001 — Recebimento (F1, corrida = 1 nota fiscal)
insert into atividades (codigo, processo_id, nome, tipo_atividade, natureza, modo, unidade, requer_quantidade, meta_amostras) values
('SEDIS-001-01', (select id from processos where codigo='SEDIS-001'), 'Receber o fornecedor e conferir os dados da nota fiscal', 'Conferência/Verificação', 'Rotina', 'FLUXO', null, false, 30),
('SEDIS-001-02', (select id from processos where codigo='SEDIS-001'), 'Conferir os itens recebidos e segregados na área de recebimento', 'Conferência/Verificação', 'Rotina', 'FLUXO', 'itens', true, 30),
('SEDIS-001-03', (select id from processos where codigo='SEDIS-001'), 'Colar etiqueta de identificação dos volumes recebidos', 'Manuseio Físico', 'Rotina', 'FLUXO', 'itens', true, 20),
('SEDIS-001-04', (select id from processos where codigo='SEDIS-001'), 'Direcionar os insumos por tipo (etiquetagem ou armazenamento)', 'Manuseio Físico', 'Rotina', 'FLUXO', 'volumes', true, 30);

-- SEDIS-002 — Fracionamento e Etiquetagem (F2, corrida = 1 lote)
insert into atividades (codigo, processo_id, nome, tipo_atividade, natureza, modo, unidade, requer_quantidade, meta_amostras) values
('SEDIS-002-01', (select id from processos where codigo='SEDIS-002'), 'Configurar a quantidade de rótulos e a fração da embalagem primária', 'Registro/Documentação', 'Rotina', 'AVULSA', null, false, 25),
('SEDIS-002-02', (select id from processos where codigo='SEDIS-002'), 'Retirar da embalagem os itens a serem etiquetados (setup inicial)', 'Manuseio Físico', 'Rotina', 'FLUXO', null, false, 25),
('SEDIS-002-03', (select id from processos where codigo='SEDIS-002'), 'Etiquetar os itens', 'Manuseio Físico', 'Rotina', 'CICLO_EM_FLUXO', 'itens', true, 100),
('SEDIS-002-04', (select id from processos where codigo='SEDIS-002'), 'Agrupar os itens etiquetados (setup final)', 'Manuseio Físico', 'Rotina', 'FLUXO', null, false, 25);

-- SEDIS-003 — Armazenamento (sem fluxo)
insert into atividades (codigo, processo_id, nome, tipo_atividade, natureza, modo, unidade, requer_quantidade, meta_amostras) values
('SEDIS-003-01', (select id from processos where codigo='SEDIS-003'), 'Retirar itens do estoque de transição e armazenar', 'Manuseio Físico', 'Rotina', 'CICLO', 'volumes', true, 60),
('SEDIS-003-02', (select id from processos where codigo='SEDIS-003'), 'Desmontar e organizar embalagens não utilizáveis (descarte)', 'Organização', 'Rotina', 'AVULSA', null, false, 12);

-- SEDIS-004 — Lançamento de NF (F3, corrida = 1 nota fiscal)
insert into atividades (codigo, processo_id, nome, tipo_atividade, natureza, modo, unidade, requer_quantidade, meta_amostras) values
('SEDIS-004-01', (select id from processos where codigo='SEDIS-004'), 'Conferência da NF com o pedido de compras', 'Registro/Documentação', 'Rotina', 'FLUXO', 'itens', true, 30),
('SEDIS-004-02', (select id from processos where codigo='SEDIS-004'), 'Entrada de NF no IW', 'Registro/Documentação', 'Rotina', 'FLUXO', 'itens', true, 30),
('SEDIS-004-03', (select id from processos where codigo='SEDIS-004'), 'Organizar as notas fiscais físicas', 'Organização', 'Rotina', 'AVULSA', 'notas', true, 12);

-- SEFAP-001 — Preparação das Rotas (F4, corrida = 1 dia de rotas)
insert into atividades (codigo, processo_id, nome, tipo_atividade, natureza, modo, unidade, requer_quantidade, meta_amostras) values
('SEFAP-001-01', (select id from processos where codigo='SEFAP-001'), 'Setup inicial (selecionar prescrições da rota, bloquear e imprimir)', 'Organização', 'Rotina', 'FLUXO', null, false, 10),
('SEFAP-001-02', (select id from processos where codigo='SEFAP-001'), 'Organização das guias de separação por equipe', 'Organização', 'Rotina', 'FLUXO', 'pacientes', true, 10);

-- SEFAP-002 — Separação para Dispensação (F5, corrida = 1 paciente)
insert into atividades (codigo, processo_id, nome, tipo_atividade, natureza, modo, unidade, requer_quantidade, meta_amostras) values
('SEFAP-002-01', (select id from processos where codigo='SEFAP-002'), 'Setup inicial (organização das guias de maior para menor)', 'Organização', 'Rotina', 'AVULSA', 'pacientes', true, 10),
('SEFAP-002-02', (select id from processos where codigo='SEFAP-002'), 'Coletar itens das guias de separação', 'Manuseio Físico', 'Rotina', 'FLUXO', 'itens', true, 40),
('SEFAP-002-04', (select id from processos where codigo='SEFAP-002'), 'Disponibilizar caixas de separação para equipe de dispensação', 'Manuseio Físico', 'Rotina', 'FLUXO', 'caixas', true, 40);

-- SEFAP-002-03 — interrupção catalogada, restrita ao F5 (inserida à parte
-- porque referencia o id do fluxo, que já existe a essa altura).
insert into atividades (codigo, processo_id, nome, tipo_atividade, natureza, modo, unidade, requer_quantidade, meta_amostras, interrompe_fluxo_id, exige_motivo) values
('SEFAP-002-03', (select id from processos where codigo='SEFAP-002'), 'Abastecimento do estoque em caso de gôndola vazia', 'Interrupção', 'Rotina', 'INTERRUPCAO', 'itens', true, 15,
  (select id from fluxos where nome='Separação das Rotas'), false);

-- SEFAP-003 — Dispensação de Produtos (F6, corrida = 1 paciente)
insert into atividades (codigo, processo_id, nome, tipo_atividade, natureza, modo, unidade, requer_quantidade, meta_amostras) values
('SEFAP-003-01', (select id from processos where codigo='SEFAP-003'), 'Setup inicial (abertura na prescrição do IW e identificação do volume)', 'Manuseio Físico', 'Rotina', 'FLUXO', null, false, 40),
('SEFAP-003-02', (select id from processos where codigo='SEFAP-003'), 'Bipagem dos itens separados', 'Conferência/Verificação', 'Rotina', 'FLUXO', 'itens', true, 40),
('SEFAP-003-03', (select id from processos where codigo='SEFAP-003'), 'Geração do protocolo e organização dos volumes dispensados', 'Registro/Documentação', 'Rotina', 'FLUXO', null, false, 40),
('SEFAP-003-04', (select id from processos where codigo='SEFAP-003'), 'Transferência dos volumes fechados para a área de expedição', 'Manuseio Físico', 'Rotina', 'AVULSA', null, false, 15);

-- SEFAP-004 — Acréscimo ou Admissão (F7, corrida = 1 paciente)
insert into atividades (codigo, processo_id, nome, tipo_atividade, natureza, modo, unidade, requer_quantidade, meta_amostras) values
('SEFAP-004-01', (select id from processos where codigo='SEFAP-004'), 'Impressão da guia de dispensação', 'Registro/Documentação', 'Rotina', 'FLUXO', null, false, 20),
('SEFAP-004-02', (select id from processos where codigo='SEFAP-004'), 'Separar e agrupar os materiais e medicamentos', 'Manuseio Físico', 'Rotina', 'FLUXO', 'itens', true, 20),
('SEFAP-004-03', (select id from processos where codigo='SEFAP-004'), 'Bipar os itens separados', 'Conferência/Verificação', 'Rotina', 'FLUXO', 'itens', true, 20),
('SEFAP-004-04', (select id from processos where codigo='SEFAP-004'), 'Empacotar todos os itens', 'Manuseio Físico', 'Rotina', 'FLUXO', 'volumes', true, 20),
('SEFAP-004-05', (select id from processos where codigo='SEFAP-004'), 'Realização do protocolo e impressão da prescrição (setup final)', 'Registro/Documentação', 'Rotina', 'FLUXO', null, false, 20),
('SEFAP-004-06', (select id from processos where codigo='SEFAP-004'), 'Direcionar itens para logística', 'Manuseio Físico', 'Rotina', 'FLUXO', null, false, 20);

-- SEFAP-005 — Pendências Pré-rota (F8, corrida = 1 lote diário de pendências)
insert into atividades (codigo, processo_id, nome, tipo_atividade, natureza, modo, unidade, requer_quantidade, meta_amostras) values
('SEFAP-005-01', (select id from processos where codigo='SEFAP-005'), 'Imprimir a lista de pendências das rotas já separadas', 'Organização', 'Rotina', 'FLUXO', null, false, 10),
('SEFAP-005-02', (select id from processos where codigo='SEFAP-005'), 'Separar os itens de pendências que serão dispensados', 'Manuseio Físico', 'Rotina', 'FLUXO', 'itens', true, 10),
('SEFAP-005-03', (select id from processos where codigo='SEFAP-005'), 'Bipagem e dispensação dos itens separados', 'Conferência/Verificação', 'Rotina', 'FLUXO', 'itens', true, 10),
('SEFAP-005-04', (select id from processos where codigo='SEFAP-005'), 'Organização e identificação dos volumes', 'Manuseio Físico', 'Rotina', 'FLUXO', 'volumes', true, 10),
('SEFAP-005-05', (select id from processos where codigo='SEFAP-005'), 'Imprimir os protocolos, anexar aos volumes e transferir para fila de expedição', 'Manuseio Físico', 'Rotina', 'FLUXO', null, false, 10);

-- SIST-000 — Eventos de Interrupção (interrupção genérica, global)
insert into atividades (codigo, processo_id, nome, tipo_atividade, natureza, modo, unidade, requer_quantidade, meta_amostras, interrupcao_global, exige_motivo) values
('SIST-000-01', (select id from processos where codigo='SIST-000'), 'Interrupção (motivo livre)', 'Interrupção', 'Rotina', 'INTERRUPCAO', null, false, 0, true, true);

-- ============================================================
-- 3.4 FLUXO_ETAPAS (27)
-- ============================================================

-- F1 — Recebimento por NF: 01 → 02 → 03(opcional) → 04
insert into fluxo_etapas (fluxo_id, atividade_id, ordem, opcional, condicao) values
  ((select id from fluxos where nome='Recebimento por NF'), (select id from atividades where codigo='SEDIS-001-01'), 1, false, null),
  ((select id from fluxos where nome='Recebimento por NF'), (select id from atividades where codigo='SEDIS-001-02'), 2, false, null),
  ((select id from fluxos where nome='Recebimento por NF'), (select id from atividades where codigo='SEDIS-001-03'), 3, true,  'Somente dieta e medicamento'),
  ((select id from fluxos where nome='Recebimento por NF'), (select id from atividades where codigo='SEDIS-001-04'), 4, false, null);

-- F2 — Etiquetagem: 02(setup) → 03(ciclo) → 04(setup)
insert into fluxo_etapas (fluxo_id, atividade_id, ordem, modo_etapa) values
  ((select id from fluxos where nome='Etiquetagem'), (select id from atividades where codigo='SEDIS-002-02'), 1, 'FLUXO'),
  ((select id from fluxos where nome='Etiquetagem'), (select id from atividades where codigo='SEDIS-002-03'), 2, 'CICLO_EM_FLUXO'),
  ((select id from fluxos where nome='Etiquetagem'), (select id from atividades where codigo='SEDIS-002-04'), 3, 'FLUXO');

-- F3 — Lançamento de NF: 01 → 02
insert into fluxo_etapas (fluxo_id, atividade_id, ordem) values
  ((select id from fluxos where nome='Lançamento de NF'), (select id from atividades where codigo='SEDIS-004-01'), 1),
  ((select id from fluxos where nome='Lançamento de NF'), (select id from atividades where codigo='SEDIS-004-02'), 2);

-- F4 — Preparação das Rotas: 01 → 02
insert into fluxo_etapas (fluxo_id, atividade_id, ordem) values
  ((select id from fluxos where nome='Preparação das Rotas'), (select id from atividades where codigo='SEFAP-001-01'), 1),
  ((select id from fluxos where nome='Preparação das Rotas'), (select id from atividades where codigo='SEFAP-001-02'), 2);

-- F5 — Separação das Rotas: 02 → 04 (01 e 03 são autônomas/interrupção)
insert into fluxo_etapas (fluxo_id, atividade_id, ordem) values
  ((select id from fluxos where nome='Separação das Rotas'), (select id from atividades where codigo='SEFAP-002-02'), 1),
  ((select id from fluxos where nome='Separação das Rotas'), (select id from atividades where codigo='SEFAP-002-04'), 2);

-- F6 — Dispensação das Rotas: 01 → 02 → 03 (04 é avulsa)
insert into fluxo_etapas (fluxo_id, atividade_id, ordem) values
  ((select id from fluxos where nome='Dispensação das Rotas'), (select id from atividades where codigo='SEFAP-003-01'), 1),
  ((select id from fluxos where nome='Dispensação das Rotas'), (select id from atividades where codigo='SEFAP-003-02'), 2),
  ((select id from fluxos where nome='Dispensação das Rotas'), (select id from atividades where codigo='SEFAP-003-03'), 3);

-- F7 — Acréscimo ou Admissão: 01 → 02 → 03 → 04 → 05 → 06
insert into fluxo_etapas (fluxo_id, atividade_id, ordem) values
  ((select id from fluxos where nome='Acréscimo ou Admissão'), (select id from atividades where codigo='SEFAP-004-01'), 1),
  ((select id from fluxos where nome='Acréscimo ou Admissão'), (select id from atividades where codigo='SEFAP-004-02'), 2),
  ((select id from fluxos where nome='Acréscimo ou Admissão'), (select id from atividades where codigo='SEFAP-004-03'), 3),
  ((select id from fluxos where nome='Acréscimo ou Admissão'), (select id from atividades where codigo='SEFAP-004-04'), 4),
  ((select id from fluxos where nome='Acréscimo ou Admissão'), (select id from atividades where codigo='SEFAP-004-05'), 5),
  ((select id from fluxos where nome='Acréscimo ou Admissão'), (select id from atividades where codigo='SEFAP-004-06'), 6);

-- F8 — Dispensação de Pendências: 01 → 02 → 03 → 04 → 05
insert into fluxo_etapas (fluxo_id, atividade_id, ordem) values
  ((select id from fluxos where nome='Dispensação de Pendências'), (select id from atividades where codigo='SEFAP-005-01'), 1),
  ((select id from fluxos where nome='Dispensação de Pendências'), (select id from atividades where codigo='SEFAP-005-02'), 2),
  ((select id from fluxos where nome='Dispensação de Pendências'), (select id from atividades where codigo='SEFAP-005-03'), 3),
  ((select id from fluxos where nome='Dispensação de Pendências'), (select id from atividades where codigo='SEFAP-005-04'), 4),
  ((select id from fluxos where nome='Dispensação de Pendências'), (select id from atividades where codigo='SEFAP-005-05'), 5);

-- ============================================================
-- 3.5 COLABORADORES — flag dos 2 observadores exclusivos
-- (já existem desde 0003_observadores.sql; 45 executantes + 2 = 47, sem insert)
-- ============================================================
update colaboradores set eh_observador = true where nome in ('YGOR CIRAUDO', 'DOUGLAS PIRES');

-- ============================================================
-- Finaliza as constraints de codigo/unidade, adiadas de 0006 (M1) até aqui
-- porque dependiam do catálogo já estar no formato v2.
-- ============================================================
alter table atividades alter column codigo set not null;
alter table atividades add constraint uq_atividades_codigo unique (codigo);
alter table atividades add constraint ck_unidade
  check (unidade is null or unidade in ('itens','volumes','notas','pacientes','caixas'));

-- ============================================================
-- Conferência de totais (M2 aceite)
-- ============================================================
select
  (select count(*) from processos)     as processos,     -- esperado: 10
  (select count(*) from fluxos)        as fluxos,         -- esperado: 8
  (select count(*) from atividades)    as atividades,     -- esperado: 35
  (select count(*) from fluxo_etapas)  as etapas_fluxo,   -- esperado: 27
  (select count(*) from colaboradores) as colaboradores,  -- esperado: 47
  (select count(*) from colaboradores where eh_observador) as observadores; -- esperado: 2
