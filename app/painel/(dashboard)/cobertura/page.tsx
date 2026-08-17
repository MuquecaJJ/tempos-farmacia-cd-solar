import { supabaseAdmin } from "@/lib/supabase-admin";
import type { Atividade, Papel, Processo, TipoColeta } from "@/lib/types";
import { CoberturaTable } from "./CoberturaTable";

// Dashboard precisa refletir dados atuais a cada visita — nunca servir HTML estático do build.
export const dynamic = "force-dynamic";

export type MedicaoCobertura = {
  atividade_id: number;
  encerrada_em: string;
  sessoes: { papel_id: number; tipo_coleta: TipoColeta } | null;
};

export default async function CoberturaPage() {
  const [{ data: atividades }, { data: processos }, { data: papeis }, { data: medicoes }] =
    await Promise.all([
      supabaseAdmin
        .from("atividades")
        .select("id, numero, processo_id, papel_id, nome, tipo_atividade, natureza, modo, unidade, requer_quantidade, meta_amostras, ativo")
        .eq("ativo", true)
        .order("numero") as unknown as Promise<{ data: Atividade[] | null }>,
      supabaseAdmin
        .from("processos")
        .select("id, codigo, nome, ordem")
        .order("ordem") as unknown as Promise<{ data: Processo[] | null }>,
      supabaseAdmin
        .from("papeis")
        .select("id, nome, ordem")
        .order("ordem") as unknown as Promise<{ data: Papel[] | null }>,
      supabaseAdmin
        .from("medicoes")
        .select("atividade_id, encerrada_em, sessoes(papel_id, tipo_coleta)")
        .eq("status", "VALIDA") as unknown as Promise<{ data: MedicaoCobertura[] | null }>,
    ]);

  return (
    <CoberturaTable
      atividades={atividades ?? []}
      processos={processos ?? []}
      papeis={papeis ?? []}
      medicoes={medicoes ?? []}
    />
  );
}
