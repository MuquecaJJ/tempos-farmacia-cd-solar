import { supabaseAdmin } from "@/lib/supabase-admin";
import type { Atividade, Processo, TipoColeta } from "@/lib/types";
import { CoberturaTable } from "./CoberturaTable";

// Dashboard precisa refletir dados atuais a cada visita — nunca servir HTML estático do build.
export const dynamic = "force-dynamic";

export type MedicaoCobertura = {
  atividade_id: number;
  encerrada_em: string;
  sessoes: { tipo_coleta: TipoColeta } | null;
};

export default async function CoberturaPage() {
  const [{ data: atividades }, { data: processos }, { data: medicoes }] = await Promise.all([
    supabaseAdmin
      .from("atividades")
      .select(
        "id, codigo, processo_id, nome, tipo_atividade, natureza, modo, unidade, requer_quantidade, meta_amostras, ativo, interrompe_fluxo_id, interrupcao_global, exige_motivo"
      )
      .eq("ativo", true)
      .order("codigo") as unknown as Promise<{ data: Atividade[] | null }>,
    supabaseAdmin
      .from("processos")
      .select("id, codigo, nome, ordem")
      .order("ordem") as unknown as Promise<{ data: Processo[] | null }>,
    supabaseAdmin
      .from("medicoes")
      .select("atividade_id, encerrada_em, sessoes(tipo_coleta)")
      .eq("status", "VALIDA") as unknown as Promise<{ data: MedicaoCobertura[] | null }>,
  ]);

  // SIST-000 (interrupção genérica) fica fora da contagem de cobertura amostral.
  const sistId = (processos ?? []).find((p) => p.codigo === "SIST-000")?.id;
  const atividadesCobertura = (atividades ?? []).filter((a) => a.processo_id !== sistId);
  const processosCobertura = (processos ?? []).filter((p) => p.codigo !== "SIST-000");

  return (
    <CoberturaTable
      atividades={atividadesCobertura}
      processos={processosCobertura}
      medicoes={medicoes ?? []}
    />
  );
}
