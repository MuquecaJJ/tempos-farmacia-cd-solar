import { supabaseBrowser } from "@/lib/supabase-browser";
import type { Atividade } from "@/lib/types";
import { CatalogoAtividades, type FluxoResumo } from "./CatalogoAtividades";

export default async function AtividadesPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const [{ data: atividades }, { data: fluxos }] = await Promise.all([
    supabaseBrowser
      .from("atividades")
      .select(
        "id, numero, processo_id, papel_id, nome, tipo_atividade, natureza, modo, unidade, requer_quantidade, meta_amostras, ativo"
      )
      .eq("ativo", true)
      .order("numero") as unknown as Promise<{ data: Atividade[] | null }>,
    supabaseBrowser
      .from("fluxos")
      .select("id, nome, unidade_corrida, processo_id, ordem")
      .order("ordem") as unknown as Promise<{ data: FluxoResumo[] | null }>,
  ]);

  return (
    <CatalogoAtividades
      token={token}
      atividades={(atividades ?? []).filter((a) => a.modo !== "FLUXO")}
      fluxos={fluxos ?? []}
    />
  );
}
