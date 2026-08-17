-- B8 — Segurança (S4): RLS em todas as tabelas.
-- anon: SELECT só no catálogo; INSERT/UPDATE (sem SELECT) em sessoes/corridas/medicoes.
-- O painel usa a service role, que ignora RLS — nenhuma policy adicional é necessária para ele.

alter table papeis enable row level security;
alter table processos enable row level security;
alter table fluxos enable row level security;
alter table atividades enable row level security;
alter table fluxo_etapas enable row level security;
alter table colaboradores enable row level security;
alter table sessoes enable row level security;
alter table corridas enable row level security;
alter table medicoes enable row level security;

create policy "catalogo_select_anon" on papeis for select to anon using (true);
create policy "catalogo_select_anon" on processos for select to anon using (true);
create policy "catalogo_select_anon" on fluxos for select to anon using (true);
create policy "catalogo_select_anon" on atividades for select to anon using (true);
create policy "catalogo_select_anon" on fluxo_etapas for select to anon using (true);
create policy "catalogo_select_anon" on colaboradores for select to anon using (true);

create policy "sessoes_insert_anon" on sessoes for insert to anon with check (true);
create policy "sessoes_update_anon" on sessoes for update to anon using (true) with check (true);

create policy "corridas_insert_anon" on corridas for insert to anon with check (true);
create policy "corridas_update_anon" on corridas for update to anon using (true) with check (true);

create policy "medicoes_insert_anon" on medicoes for insert to anon with check (true);
create policy "medicoes_update_anon" on medicoes for update to anon using (true) with check (true);
