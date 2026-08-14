"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { lerSessaoAtiva, encerrarSessaoAtiva } from "@/lib/sessao-storage";
import type { Atividade, Processo, SessaoAtiva } from "@/lib/types";

export type FluxoComPapel = {
  id: number;
  nome: string;
  unidade_corrida: string;
  processo_id: number;
  papel_id: number;
};

export function CatalogoAtividades({
  token,
  atividades,
  fluxos,
  processos,
}: {
  token: string;
  atividades: Atividade[];
  fluxos: FluxoComPapel[];
  processos: Processo[];
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

  const atividadesDoPapel = atividades.filter((a) => a.papel_id === sessao.papelId);
  const fluxosDoPapel = fluxos.filter((f) => f.papel_id === sessao.papelId);

  const processosComItens = processos
    .map((processo) => ({
      processo,
      fluxos: fluxosDoPapel.filter((f) => f.processo_id === processo.id),
      atividades: atividadesDoPapel.filter((a) => a.processo_id === processo.id),
    }))
    .filter((p) => p.fluxos.length > 0 || p.atividades.length > 0);

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-4 pb-10">
      <header className="flex items-center justify-between rounded-lg bg-[#5F0040] px-4 py-3 text-white">
        <div>
          <p className="text-sm opacity-80">{sessao.papelNome}</p>
          <p className="font-semibold">{sessao.colaboradorNome}</p>
        </div>
        <button
          onClick={() => {
            encerrarSessaoAtiva();
            router.push(`/c/${token}/sessao`);
          }}
          className="text-xs underline opacity-90"
        >
          trocar papel/colaborador
        </button>
      </header>

      {processosComItens.length === 0 && (
        <p className="text-sm text-neutral-500">
          Nenhuma atividade cadastrada para este papel.
        </p>
      )}

      {processosComItens.map(({ processo, fluxos: fluxosProcesso, atividades: atividadesProcesso }) => (
        <section key={processo.id} className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            {processo.nome}
          </h2>

          {fluxosProcesso.map((fluxo) => (
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

          {atividadesProcesso.map((atividade) => (
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
        </section>
      ))}
    </div>
  );
}
