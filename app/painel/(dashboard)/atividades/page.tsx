import { supabaseAdmin } from "@/lib/supabase-admin";
import type { Atividade, Colaborador, Fluxo, FluxoEtapa, Processo, Turno, TipoColeta } from "@/lib/types";
import { EstatisticasAtividades } from "./EstatisticasAtividades";

// Dashboard precisa refletir dados atuais a cada visita — nunca servir HTML estático do build.
export const dynamic = "force-dynamic";

export type MedicaoEstatistica = {
  atividade_id: number;
  duracao_ms: number;
  quantidade: number | null;
  sessoes: {
    papel_id: number;
    tipo_coleta: TipoColeta;
    turno: Turno;
    colaborador_id: number;
  } | null;
};

export default async function AtividadesEstatisticasPage() {
  const [
    { data: atividades },
    { data: processos },
    { data: fluxos },
    { data: fluxoEtapas },
    { data: colaboradores },
    { data: medicoes },
  ] = await Promise.all([
    supabaseAdmin
      .from("atividades")
      .select(
        "id, numero, processo_id, papel_id, nome, tipo_atividade, natureza, modo, unidade, requer_quantidade, meta_amostras, ativo"
      )
      .eq("ativo", true)
      .order("numero") as unknown as Promise<{ data: Atividade[] | null }>,
    supabaseAdmin.from("processos").select("id, codigo, nome, ordem").order("ordem") as unknown as Promise<{
      data: Processo[] | null;
    }>,
    supabaseAdmin.from("fluxos").select("id, processo_id, nome, unidade_corrida, ordem").order("ordem") as unknown as Promise<{
      data: Fluxo[] | null;
    }>,
    supabaseAdmin
      .from("fluxo_etapas")
      .select("id, fluxo_id, atividade_id, ordem, variante, opcional") as unknown as Promise<{
      data: FluxoEtapa[] | null;
    }>,
    supabaseAdmin.from("colaboradores").select("id, nome, ativo") as unknown as Promise<{
      data: Colaborador[] | null;
    }>,
    supabaseAdmin
      .from("medicoes")
      .select("atividade_id, duracao_ms, quantidade, sessoes(papel_id, tipo_coleta, turno, colaborador_id)")
      .eq("status", "VALIDA") as unknown as Promise<{ data: MedicaoEstatistica[] | null }>,
  ]);

  return (
    <EstatisticasAtividades
      atividades={atividades ?? []}
      processos={processos ?? []}
      fluxos={fluxos ?? []}
      fluxoEtapas={fluxoEtapas ?? []}
      colaboradores={colaboradores ?? []}
      medicoes={medicoes ?? []}
    />
  );
}
