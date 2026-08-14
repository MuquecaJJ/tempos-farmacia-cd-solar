import { supabaseBrowser } from "@/lib/supabase-browser";
import type { Colaborador, Papel, Processo } from "@/lib/types";
import { SessaoForm } from "./SessaoForm";

export default async function SessaoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const [{ data: colaboradores }, { data: papeis }, { data: processos }] = await Promise.all([
    supabaseBrowser
      .from("colaboradores")
      .select("id, nome, ativo")
      .eq("ativo", true)
      .order("nome") as unknown as Promise<{ data: Colaborador[] | null }>,
    supabaseBrowser
      .from("papeis")
      .select("id, nome, ordem")
      .order("ordem") as unknown as Promise<{ data: Papel[] | null }>,
    supabaseBrowser
      .from("processos")
      .select("id, codigo, nome, ordem")
      .order("ordem") as unknown as Promise<{ data: Processo[] | null }>,
  ]);

  return (
    <SessaoForm
      token={token}
      colaboradores={colaboradores ?? []}
      papeis={papeis ?? []}
      processos={processos ?? []}
    />
  );
}
