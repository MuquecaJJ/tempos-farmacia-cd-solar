import { notFound } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import type { Atividade } from "@/lib/types";
import { CronometroAvulsa } from "./CronometroAvulsa";

export default async function AvulsaPage({
  params,
}: {
  params: Promise<{ token: string; id: string }>;
}) {
  const { token, id } = await params;
  const atividadeId = Number(id);
  if (!Number.isInteger(atividadeId)) notFound();

  const { data: atividade, error } = (await supabaseBrowser
    .from("atividades")
    .select(
      "id, codigo, processo_id, nome, tipo_atividade, natureza, modo, unidade, requer_quantidade, meta_amostras, ativo, interrompe_fluxo_id, interrupcao_global, exige_motivo"
    )
    .eq("id", atividadeId)
    .eq("ativo", true)
    .single()) as unknown as { data: Atividade | null; error: unknown };

  if (error || !atividade || atividade.modo !== "AVULSA") notFound();

  return <CronometroAvulsa token={token} atividade={atividade} />;
}
