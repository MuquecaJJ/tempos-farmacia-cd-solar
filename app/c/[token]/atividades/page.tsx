import { supabaseBrowser } from "@/lib/supabase-browser";
import type { Atividade, Processo } from "@/lib/types";
import { CatalogoAtividades, type FluxoComPapel } from "./CatalogoAtividades";

type FluxoQuery = {
  id: number;
  nome: string;
  unidade_corrida: string;
  processo_id: number;
  ordem: number;
  fluxo_etapas: { ordem: number; atividades: { papel_id: number } | null }[];
};

export default async function AtividadesPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const [{ data: atividades }, { data: fluxosRaw }, { data: processos }] =
    await Promise.all([
      supabaseBrowser
        .from("atividades")
        .select(
          "id, numero, processo_id, papel_id, nome, tipo_atividade, natureza, modo, unidade, requer_quantidade, meta_amostras, ativo"
        )
        .eq("ativo", true)
        .order("numero") as unknown as Promise<{ data: Atividade[] | null }>,
      supabaseBrowser
        .from("fluxos")
        .select("id, nome, unidade_corrida, processo_id, ordem, fluxo_etapas(ordem, atividades(papel_id))")
        .order("ordem") as unknown as Promise<{ data: FluxoQuery[] | null }>,
      supabaseBrowser
        .from("processos")
        .select("id, codigo, nome, ordem")
        .order("ordem") as unknown as Promise<{ data: Processo[] | null }>,
    ]);

  // O "papel" de um fluxo é inferido do papel da sua primeira etapa —
  // na prática todas as etapas de um mesmo fluxo pertencem ao mesmo papel.
  const fluxos: FluxoComPapel[] = (fluxosRaw ?? []).map((f) => {
    const primeiraEtapa = [...f.fluxo_etapas].sort((a, b) => a.ordem - b.ordem)[0];
    return {
      id: f.id,
      nome: f.nome,
      unidade_corrida: f.unidade_corrida,
      processo_id: f.processo_id,
      papel_id: primeiraEtapa?.atividades?.papel_id ?? -1,
    };
  });

  return (
    <CatalogoAtividades
      token={token}
      atividades={(atividades ?? []).filter((a) => a.modo !== "FLUXO")}
      fluxos={fluxos}
      processos={processos ?? []}
    />
  );
}
