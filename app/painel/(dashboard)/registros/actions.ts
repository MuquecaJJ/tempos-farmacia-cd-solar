"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { PAINEL_COOKIE, pinValido } from "@/lib/painel-auth";

export async function marcarSuspeita(medicaoId: string) {
  const cookie = (await cookies()).get(PAINEL_COOKIE)?.value;
  if (!pinValido(cookie)) redirect("/painel");

  await supabaseAdmin.from("medicoes").update({ status: "SUSPEITA" }).eq("id", medicaoId);
  revalidatePath("/painel/registros");
}
