-- M0 — reset da base de coleta antes da migração v2.
-- Idempotente: a base já havia sido zerada manualmente durante o piloto,
-- mas roda de novo para garantir consistência antes do M1/M2.
truncate medicoes, corridas, sessoes cascade;
