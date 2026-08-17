import { supabaseAdmin } from "@/lib/supabase-admin";
import type { Atividade, Colaborador, Fluxo, FluxoEtapa, Processo, Turno, TipoColeta } from "@/lib/types";
import { EstatisticasAtividades } from "./EstatisticasAtividades";

// Dashboard precisa refletir dados atuais a cada visita — nunca servir HTML estático do build.
export const dynamic = "force-dynamic";

export type MedicaoEstatistica = {
  atividade_id: number;
  duracao_ms: number;
  quantidade: number | null;
  ordem_etapa: number | null;
  eh_interrupcao: boolean;
  motivo_interrupcao: string | null;
  sessoes: {
    tipo_coleta: TipoColeta;
    turno: Turno;
    colaborador_id: number;
  } | null;
};

export type CorridaEstatistica = {
  id: string;
  fluxo_id: number | null;
  iniciada_em: string;
  encerrada_em: string;
  tempo_pausado_ms: number;
  qtd_interrupcoes: number;
};

export default async function AtividadesEstatisticasPage() {
  const [
    { data: atividades },
    { data: processos },
    { data: fluxos },
    { data: fluxoEtapas },
    { data: colaboradores },
    { data: medicoes },
    { data: corridas },
  ] = await Promise.all([
    supabaseAdmin
      .from("atividades")
      .select(
        "id, codigo, processo_id, nome, tipo_atividade, natureza, modo, unidade, requer_quantidade, meta_amostras, ativo, interrompe_fluxo_id, interrupcao_global, exige_motivo"
      )
      .eq("ativo", true)
      .order("codigo") as unknown as Promise<{ data: Atividade[] | null }>,
    supabaseAdmin.from("processos").select("id, codigo, nome, ordem").order("ordem") as unknown as Promise<{
      data: Processo[] | null;
    }>,
    supabaseAdmin.from("fluxos").select("id, processo_id, nome, unidade_corrida, ordem").order("ordem") as unknown as Promise<{
      data: Fluxo[] | null;
    }>,
    supabaseAdmin
      .from("fluxo_etapas")
      .select("id, fluxo_id, atividade_id, ordem, variante, opcional, condicao, modo_etapa") as unknown as Promise<{
      data: FluxoEtapa[] | null;
    }>,
    supabaseAdmin.from("colaboradores").select("id, nome, ativo, eh_observador") as unknown as Promise<{
      data: Colaborador[] | null;
    }>,
    supabaseAdmin
      .from("medicoes")
      .select(
        "atividade_id, duracao_ms, quantidade, ordem_etapa, eh_interrupcao, motivo_interrupcao, sessoes(tipo_coleta, turno, colaborador_id)"
      )
      .eq("status", "VALIDA") as unknown as Promise<{ data: MedicaoEstatistica[] | null }>,
    supabaseAdmin
      .from("corridas")
      .select("id, fluxo_id, iniciada_em, encerrada_em, tempo_pausado_ms, qtd_interrupcoes")
      .eq("status", "VALIDA") as unknown as Promise<{ data: CorridaEstatistica[] | null }>,
  ]);

  return (
    <EstatisticasAtividades
      atividades={atividades ?? []}
      processos={processos ?? []}
      fluxos={fluxos ?? []}
      fluxoEtapas={fluxoEtapas ?? []}
      colaboradores={colaboradores ?? []}
      medicoes={medicoes ?? []}
      corridas={corridas ?? []}
    />
  );
}
