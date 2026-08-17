import { supabaseBrowser } from "@/lib/supabase-browser";
import type { Atividade } from "@/lib/types";
import { CatalogoAtividades, type FluxoResumo } from "./CatalogoAtividades";

// Etapas embutidas em fluxo (FLUXO / CICLO_EM_FLUXO) e interrupções não
// aparecem como itens soltos do catálogo — só via card do fluxo ou botão de
// interrupção dentro da corrida. A sessão já fixa o processo (SIST-000 não é
// selecionável na abertura de sessão), então o catálogo já sai agrupado por
// processo sem filtro adicional aqui.
const MODOS_FORA_DO_CATALOGO_SOLTO = ["FLUXO", "CICLO_EM_FLUXO", "INTERRUPCAO"];

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
        "id, codigo, processo_id, nome, tipo_atividade, natureza, modo, unidade, requer_quantidade, meta_amostras, ativo, interrompe_fluxo_id, interrupcao_global, exige_motivo"
      )
      .eq("ativo", true)
      .order("codigo") as unknown as Promise<{ data: Atividade[] | null }>,
    supabaseBrowser
      .from("fluxos")
      .select("id, nome, unidade_corrida, processo_id, ordem")
      .order("ordem") as unknown as Promise<{ data: FluxoResumo[] | null }>,
  ]);

  return (
    <CatalogoAtividades
      token={token}
      atividades={(atividades ?? []).filter((a) => !MODOS_FORA_DO_CATALOGO_SOLTO.includes(a.modo))}
      fluxos={fluxos ?? []}
    />
  );
}
