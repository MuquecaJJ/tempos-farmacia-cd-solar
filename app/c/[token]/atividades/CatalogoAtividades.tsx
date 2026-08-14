"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { lerSessaoAtiva, encerrarSessaoAtiva } from "@/lib/sessao-storage";
import type { Atividade, SessaoAtiva } from "@/lib/types";

export type FluxoResumo = {
  id: number;
  nome: string;
  unidade_corrida: string;
  processo_id: number;
  ordem: number;
};

export function CatalogoAtividades({
  token,
  atividades,
  fluxos,
}: {
  token: string;
  atividades: Atividade[];
  fluxos: FluxoResumo[];
}) {
  const router = useRouter();
  const [sessao, setSessao] = useState<SessaoAtiva | null | undefined>(undefined);

  useEffect(() => {
    const s = lerSessaoAtiva();
    if (!s) {
      router.replace(`/c/${token}/sessao`);
      return;
    }
    setSessao(s);
  }, [token, router]);

  if (sessao === undefined || sessao === null) {
    return null;
  }

  const fluxosDoProcesso = fluxos.filter((f) => f.processo_id === sessao.processoId);
  const atividadesDoProcesso = atividades.filter((a) => a.processo_id === sessao.processoId);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-4 pb-10">
      <header className="flex items-center justify-between rounded-lg bg-[#5F0040] px-4 py-3 text-white">
        <div>
          <p className="text-sm opacity-80">{sessao.processoNome}</p>
          <p className="font-semibold">{sessao.colaboradorNome}</p>
        </div>
        <button
          onClick={() => {
            encerrarSessaoAtiva();
            router.push(`/c/${token}/sessao`);
          }}
          className="text-xs underline opacity-90"
        >
          trocar macroprocesso
        </button>
      </header>

      {fluxosDoProcesso.length === 0 && atividadesDoProcesso.length === 0 && (
        <p className="text-sm text-neutral-500">
          Nenhuma atividade cadastrada para este macroprocesso.
        </p>
      )}

      <div className="flex flex-col gap-2">
        {fluxosDoProcesso.map((fluxo) => (
          <Link
            key={`fluxo-${fluxo.id}`}
            href={`/c/${token}/fluxo/${fluxo.id}`}
            className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-4 py-3"
          >
            <span className="font-medium">{fluxo.nome}</span>
            <span className="rounded bg-[#FBB040]/20 px-2 py-1 text-xs font-semibold text-[#5F0040]">
              FLUXO
            </span>
          </Link>
        ))}

        {atividadesDoProcesso.map((atividade) => (
          <Link
            key={`atividade-${atividade.id}`}
            href={`/c/${token}/${atividade.modo === "CICLO" ? "ciclo" : "avulsa"}/${atividade.id}`}
            className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-4 py-3"
          >
            <span className="font-medium">{atividade.nome}</span>
            <span className="rounded bg-neutral-100 px-2 py-1 text-xs font-semibold text-neutral-600">
              {atividade.modo}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
