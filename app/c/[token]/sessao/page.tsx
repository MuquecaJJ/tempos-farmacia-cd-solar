import { supabaseBrowser } from "@/lib/supabase-browser";
import type { Colaborador, Papel } from "@/lib/types";
import { SessaoForm } from "./SessaoForm";

export default async function SessaoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const [{ data: colaboradores }, { data: papeis }] = await Promise.all([
    supabaseBrowser
      .from("colaboradores")
      .select("id, nome, ativo")
      .eq("ativo", true)
      .order("nome") as unknown as Promise<{ data: Colaborador[] | null }>,
    supabaseBrowser
      .from("papeis")
      .select("id, nome, ordem")
      .order("ordem") as unknown as Promise<{ data: Papel[] | null }>,
  ]);

  return (
    <SessaoForm
      token={token}
      colaboradores={colaboradores ?? []}
      papeis={papeis ?? []}
    />
  );
}
