-- Correção de dado: SEDIS-001-03 "Colar etiqueta de identificação dos
-- volumes recebidos" estava com unidade=itens, inconsistente com o próprio
-- nome da atividade (fala de volumes). Corrige para unidade=volumes.
update atividades set unidade = 'volumes' where codigo = 'SEDIS-001-03';
