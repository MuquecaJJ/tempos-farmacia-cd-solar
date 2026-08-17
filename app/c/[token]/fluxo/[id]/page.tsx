import { notFound } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import type { Atividade, Fluxo, FluxoEtapa } from "@/lib/types";
import { CorridaFluxo } from "./CorridaFluxo";

export default async function FluxoPage({
  params,
}: {
  params: Promise<{ token: string; id: string }>;
}) {
  const { token, id } = await params;
  const fluxoId = Number(id);
  if (!Number.isInteger(fluxoId)) notFound();

  const { data: fluxo, error: fluxoError } = (await supabaseBrowser
    .from("fluxos")
    .select("id, processo_id, nome, unidade_corrida, ordem")
    .eq("id", fluxoId)
    .single()) as unknown as { data: Fluxo | null; error: unknown };

  if (fluxoError || !fluxo) notFound();

  const { data: etapas } = (await supabaseBrowser
    .from("fluxo_etapas")
    .select("id, fluxo_id, atividade_id, ordem, variante, opcional, condicao, modo_etapa")
    .eq("fluxo_id", fluxoId)
    .order("ordem")) as unknown as { data: FluxoEtapa[] | null };

  if (!etapas || etapas.length === 0) notFound();

  const atividadeIds = etapas.map((e) => e.atividade_id);
  const [{ data: atividades }, { data: interrupcoes }] = await Promise.all([
    supabaseBrowser
      .from("atividades")
      .select(
        "id, codigo, processo_id, nome, tipo_atividade, natureza, modo, unidade, requer_quantidade, meta_amostras, ativo, interrompe_fluxo_id, interrupcao_global, exige_motivo"
      )
      .in("id", atividadeIds) as unknown as Promise<{ data: Atividade[] | null }>,
    supabaseBrowser
      .from("atividades")
      .select(
        "id, codigo, processo_id, nome, tipo_atividade, natureza, modo, unidade, requer_quantidade, meta_amostras, ativo, interrompe_fluxo_id, interrupcao_global, exige_motivo"
      )
      .eq("modo", "INTERRUPCAO")
      .eq("ativo", true) as unknown as Promise<{ data: Atividade[] | null }>,
  ]);

  const interrupcaoGenerica = (interrupcoes ?? []).find((a) => a.interrupcao_global) ?? null;
  const interrupcaoCatalogada =
    (interrupcoes ?? []).find((a) => a.interrompe_fluxo_id === fluxoId) ?? null;

  return (
    <CorridaFluxo
      token={token}
      fluxo={fluxo}
      etapas={etapas}
      atividades={atividades ?? []}
      interrupcaoGenerica={interrupcaoGenerica}
      interrupcaoCatalogada={interrupcaoCatalogada}
    />
  );
}
