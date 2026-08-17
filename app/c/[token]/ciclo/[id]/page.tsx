import { notFound } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import type { Atividade } from "@/lib/types";
import { CicloAtividade } from "./CicloAtividade";

export default async function CicloPage({
  params,
}: {
  params: Promise<{ token: string; id: string }>;
}) {
  const { token, id } = await params;
  const atividadeId = Number(id);
  if (!Number.isInteger(atividadeId)) notFound();

  const [{ data: atividade, error }, { data: interrupcoes }] = await Promise.all([
    supabaseBrowser
      .from("atividades")
      .select(
        "id, codigo, processo_id, nome, tipo_atividade, natureza, modo, unidade, requer_quantidade, meta_amostras, ativo, interrompe_fluxo_id, interrupcao_global, exige_motivo"
      )
      .eq("id", atividadeId)
      .eq("ativo", true)
      .single() as unknown as Promise<{ data: Atividade | null; error: unknown }>,
    supabaseBrowser
      .from("atividades")
      .select(
        "id, codigo, processo_id, nome, tipo_atividade, natureza, modo, unidade, requer_quantidade, meta_amostras, ativo, interrompe_fluxo_id, interrupcao_global, exige_motivo"
      )
      .eq("modo", "INTERRUPCAO")
      .eq("interrupcao_global", true)
      .eq("ativo", true)
      .maybeSingle() as unknown as Promise<{ data: Atividade | null }>,
  ]);

  if (error || !atividade || atividade.modo !== "CICLO") notFound();

  return (
    <CicloAtividade token={token} atividade={atividade} interrupcaoGenerica={interrupcoes ?? null} />
  );
}
