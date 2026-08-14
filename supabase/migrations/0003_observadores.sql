-- Item A01 do plano: incluir estagiário(s) observador(es) no cadastro de
-- colaboradores (mesma tabela, sem flag — usados como observador nas sessões).
insert into colaboradores (nome) values
  ('YGOR CIRAUDO'),
  ('DOUGLAS PIRES')
on conflict (nome) do nothing;
