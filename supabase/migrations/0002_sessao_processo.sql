-- O catálogo passa a ser filtrado pelo macroprocesso escolhido na sessão
-- (não mais pelo papel). Papel continua sendo coletado, só que apenas
-- para fins estatísticos no dashboard.
alter table sessoes
  add column processo_id smallint references processos(id);

update sessoes set processo_id = (select id from processos order by id limit 1)
  where processo_id is null;

alter table sessoes
  alter column processo_id set not null;
