"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PAINEL_COOKIE, pinValido } from "@/lib/painel-auth";

export async function entrar(formData: FormData) {
  const pin = String(formData.get("pin") ?? "");

  if (!pinValido(pin)) {
    redirect("/painel?erro=1");
  }

  (await cookies()).set(PAINEL_COOKIE, pin, {
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  redirect("/painel/cobertura");
}

export async function sair() {
  (await cookies()).delete(PAINEL_COOKIE);
  redirect("/painel");
}
