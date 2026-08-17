import { supabaseBrowser } from "@/lib/supabase-browser";
import type { Colaborador, Processo } from "@/lib/types";
import { SessaoForm } from "./SessaoForm";

export default async function SessaoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const [{ data: colaboradores }, { data: processos }] = await Promise.all([
    supabaseBrowser
      .from("colaboradores")
      .select("id, nome, ativo, eh_observador")
      .eq("ativo", true)
      .order("nome") as unknown as Promise<{ data: Colaborador[] | null }>,
    supabaseBrowser
      .from("processos")
      .select("id, codigo, nome, ordem")
      .neq("codigo", "SIST-000")
      .order("ordem") as unknown as Promise<{ data: Processo[] | null }>,
  ]);

  return (
    <SessaoForm
      token={token}
      colaboradores={colaboradores ?? []}
      processos={processos ?? []}
    />
  );
}
