"use client";

import { useMemo, useState } from "react";
import type { Atividade, Natureza, Papel, Processo, TipoColeta } from "@/lib/types";
import type { MedicaoCobertura } from "./page";

function corSemaforo(pct: number): string {
  if (pct >= 100) return "bg-green-500";
  if (pct >= 50) return "bg-[#FBB040]";
  return "bg-red-500";
}

export function CoberturaTable({
  atividades,
  processos,
  papeis,
  medicoes,
}: {
  atividades: Atividade[];
  processos: Processo[];
  papeis: Papel[];
  medicoes: MedicaoCobertura[];
}) {
  const [processoId, setProcessoId] = useState<number | "todos">("todos");
  const [papelId, setPapelId] = useState<number | "todos">("todos");
  const [natureza, setNatureza] = useState<Natureza | "todos">("todos");
  const [tipoColeta, setTipoColeta] = useState<TipoColeta | "todos">("todos");

  const linhas = useMemo(() => {
    return atividades
      .filter((a) => processoId === "todos" || a.processo_id === processoId)
      .filter((a) => papelId === "todos" || a.papel_id === papelId)
      .filter((a) => natureza === "todos" || a.natureza === natureza)
      .map((a) => {
        const doAtividade = medicoes.filter(
          (m) =>
            m.atividade_id === a.id &&
            (tipoColeta === "todos" || m.sessoes?.tipo_coleta === tipoColeta)
        );
        const n = doAtividade.length;
        const pct = a.meta_amostras > 0 ? (n / a.meta_amostras) * 100 : 0;
        const ultima = doAtividade.reduce<string | null>((max, m) => {
          if (!max || m.encerrada_em > max) return m.encerrada_em;
          return max;
        }, null);
        return { atividade: a, n, pct, ultima };
      });
  }, [atividades, medicoes, processoId, papelId, natureza, tipoColeta]);

  const porProcesso = useMemo(() => {
    const grupos = new Map<number, typeof linhas>();
    for (const linha of linhas) {
      const lista = grupos.get(linha.atividade.processo_id) ?? [];
      lista.push(linha);
      grupos.set(linha.atividade.processo_id, lista);
    }
    return processos
      .filter((p) => grupos.has(p.id))
      .map((p) => ({ processo: p, linhas: grupos.get(p.id)! }));
  }, [linhas, processos]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-3 rounded-lg border border-neutral-200 bg-white p-3">
        <select
          value={processoId}
          onChange={(e) => setProcessoId(e.target.value === "todos" ? "todos" : Number(e.target.value))}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        >
          <option value="todos">Todos os processos</option>
          {processos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
        <select
          value={papelId}
          onChange={(e) => setPapelId(e.target.value === "todos" ? "todos" : Number(e.target.value))}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        >
          <option value="todos">Todos os papéis</option>
          {papeis.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
        <select
          value={natureza}
          onChange={(e) => setNatureza(e.target.value as Natureza | "todos")}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        >
          <option value="todos">Rotina + Eventual</option>
          <option value="Rotina">Rotina</option>
          <option value="Eventual">Eventual</option>
        </select>
        <select
          value={tipoColeta}
          onChange={(e) => setTipoColeta(e.target.value as TipoColeta | "todos")}
          className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
        >
          <option value="todos">AUTO + OBSERVADO</option>
          <option value="AUTO">Autocronometragem</option>
          <option value="OBSERVADO">Observado</option>
        </select>
      </div>

      {porProcesso.map(({ processo, linhas }) => (
        <div key={processo.id} className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-left">
                <th colSpan={6} className="px-4 py-2 font-semibold text-[#5F0040]">
                  {processo.nome}
                </th>
              </tr>
              <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                <th className="px-4 py-2">Nº / Atividade</th>
                <th className="px-4 py-2">Natureza</th>
                <th className="px-4 py-2">n</th>
                <th className="px-4 py-2">Meta</th>
                <th className="px-4 py-2">%</th>
                <th className="px-4 py-2">Última coleta</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map(({ atividade, n, pct, ultima }) => (
                <tr key={atividade.id} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-2">
                    <span className="text-neutral-400">{atividade.numero}</span> {atividade.nome}
                  </td>
                  <td className="px-4 py-2 text-neutral-600">{atividade.natureza}</td>
                  <td className="px-4 py-2 font-mono">{n}</td>
                  <td className="px-4 py-2 font-mono text-neutral-500">{atividade.meta_amostras}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 overflow-hidden rounded-full bg-neutral-200">
                        <div
                          className={`h-full ${corSemaforo(pct)}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs text-neutral-600">{Math.round(pct)}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 text-neutral-500">
                    {ultima ? new Date(ultima).toLocaleString("pt-BR") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
