"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { Atividade } from "@/lib/types";

export function RegistrosFiltros({ atividades }: { atividades: Atividade[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function atualizar(chave: string, valor: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (valor === "todos") params.delete(chave);
    else params.set(chave, valor);
    params.delete("page");
    router.push(`/painel/registros?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-3 rounded-lg border border-neutral-200 bg-white p-3">
      <select
        defaultValue={searchParams.get("status") ?? "todos"}
        onChange={(e) => atualizar("status", e.target.value)}
        className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
      >
        <option value="todos">Todos os status</option>
        <option value="VALIDA">Válida</option>
        <option value="DESCARTADA">Descartada</option>
        <option value="SUSPEITA">Suspeita</option>
      </select>
      <select
        defaultValue={searchParams.get("atividade") ?? "todos"}
        onChange={(e) => atualizar("atividade", e.target.value)}
        className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
      >
        <option value="todos">Todas as atividades</option>
        {atividades.map((a) => (
          <option key={a.id} value={a.id}>
            {a.numero} — {a.nome}
          </option>
        ))}
      </select>
    </div>
  );
}
