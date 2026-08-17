"use client";

import { useMemo, useState } from "react";
import { resumir, media, type Resumo } from "@/lib/estatisticas";
import type { Atividade, Colaborador, Fluxo, FluxoEtapa, Processo, Turno } from "@/lib/types";
import type { MedicaoEstatistica } from "./page";

function formatarMs(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function LinhaResumo({ titulo, resumo }: { titulo: string; resumo: Resumo }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-3 text-sm">
      <p className="mb-1 font-medium text-neutral-600">{titulo}</p>
      {resumo.n === 0 ? (
        <p className="text-neutral-400">sem dados</p>
      ) : (
        <div className="grid grid-cols-3 gap-x-3 gap-y-1 font-mono text-xs text-neutral-700 sm:grid-cols-6">
          <span>n={resumo.n}</span>
          <span>média={formatarMs(resumo.media)}</span>
          <span>mediana={formatarMs(resumo.mediana)}</span>
          <span>dp={formatarMs(resumo.desvioPadrao)}</span>
          <span>mín={formatarMs(resumo.min)}</span>
          <span>máx={formatarMs(resumo.max)}</span>
          <span>p90={formatarMs(resumo.p90)}</span>
          <span className={resumo.cv > 0.3 ? "font-semibold text-red-600" : ""}>
            cv={resumo.cv.toFixed(2)}
            {resumo.cv > 0.3 ? " ⚠" : ""}
          </span>
        </div>
      )}
    </div>
  );
}

function Histograma({ valores }: { valores: number[] }) {
  if (valores.length < 2) return null;
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  if (max === min) return null;
  const baldes = 8;
  const largura = (max - min) / baldes;
  const contagens = Array(baldes).fill(0);
  for (const v of valores) {
    const idx = Math.min(baldes - 1, Math.floor((v - min) / largura));
    contagens[idx]++;
  }
  const maiorContagem = Math.max(...contagens);
  return (
    <div className="flex h-12 items-end gap-0.5">
      {contagens.map((c, i) => (
        <div
          key={i}
          className="flex-1 rounded-t bg-[#FBB040]"
          style={{ height: `${maiorContagem > 0 ? (c / maiorContagem) * 100 : 0}%` }}
          title={`${c} medições`}
        />
      ))}
    </div>
  );
}

const TURNOS: Turno[] = ["MANHA", "TARDE", "NOITE"];

export function EstatisticasAtividades({
  atividades,
  processos,
  fluxos,
  fluxoEtapas,
  colaboradores,
  medicoes,
}: {
  atividades: Atividade[];
  processos: Processo[];
  fluxos: Fluxo[];
  fluxoEtapas: FluxoEtapa[];
  colaboradores: Colaborador[];
  medicoes: MedicaoEstatistica[];
}) {
  const [processoId, setProcessoId] = useState<number | "todos">("todos");

  const colaboradorNome = useMemo(() => {
    const mapa = new Map<number, string>();
    for (const c of colaboradores) mapa.set(c.id, c.nome);
    return mapa;
  }, [colaboradores]);

  const processoNome = useMemo(() => {
    const mapa = new Map<number, string>();
    for (const p of processos) mapa.set(p.id, p.nome);
    return mapa;
  }, [processos]);

  const fluxoDaAtividade = useMemo(() => {
    const mapa = new Map<number, number>();
    for (const e of fluxoEtapas) mapa.set(e.atividade_id, e.fluxo_id);
    return mapa;
  }, [fluxoEtapas]);

  const medicoesPorAtividade = useMemo(() => {
    const mapa = new Map<number, MedicaoEstatistica[]>();
    for (const m of medicoes) {
      const lista = mapa.get(m.atividade_id) ?? [];
      lista.push(m);
      mapa.set(m.atividade_id, lista);
    }
    return mapa;
  }, [medicoes]);

  const atividadesFiltradas = useMemo(
    () => atividades.filter((a) => processoId === "todos" || a.processo_id === processoId),
    [atividades, processoId]
  );

  const porProcesso = useMemo(() => {
    const mapa = new Map<number, number[]>();
    for (const m of medicoes) {
      const atividade = atividades.find((a) => a.id === m.atividade_id);
      if (!atividade) continue;
      const lista = mapa.get(atividade.processo_id) ?? [];
      lista.push(m.duracao_ms);
      mapa.set(atividade.processo_id, lista);
    }
    return Array.from(mapa.entries()).map(([pid, valores]) => ({
      nome: processoNome.get(pid) ?? `Processo ${pid}`,
      total: valores.reduce((s, v) => s + v, 0),
      media: media(valores),
      n: valores.length,
    }));
  }, [medicoes, atividades, processoNome]);

  const porTipoAtividade = useMemo(() => {
    const mapa = new Map<string, number[]>();
    for (const m of medicoes) {
      const atividade = atividades.find((a) => a.id === m.atividade_id);
      if (!atividade) continue;
      const lista = mapa.get(atividade.tipo_atividade) ?? [];
      lista.push(m.duracao_ms);
      mapa.set(atividade.tipo_atividade, lista);
    }
    return Array.from(mapa.entries()).map(([tipo, valores]) => ({
      nome: tipo,
      total: valores.reduce((s, v) => s + v, 0),
      media: media(valores),
      n: valores.length,
    }));
  }, [medicoes, atividades]);

  const porFluxo = useMemo(() => {
    const grupos = new Map<number, { atividade: Atividade; valores: number[] }[]>();
    for (const a of atividades) {
      if (a.modo !== "FLUXO") continue;
      const fluxoId = fluxoDaAtividade.get(a.id);
      if (fluxoId === undefined) continue;
      const valores = (medicoesPorAtividade.get(a.id) ?? []).map((m) => m.duracao_ms);
      const lista = grupos.get(fluxoId) ?? [];
      lista.push({ atividade: a, valores });
      grupos.set(fluxoId, lista);
    }
    return fluxos
      .filter((f) => grupos.has(f.id))
      .map((f) => ({ fluxo: f, etapas: grupos.get(f.id)! }));
  }, [atividades, fluxoDaAtividade, medicoesPorAtividade, fluxos]);

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-neutral-200 bg-white p-3">
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
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-[#5F0040]">Por atividade</h2>
        {atividadesFiltradas.map((a) => {
          const doAtividade = medicoesPorAtividade.get(a.id) ?? [];
          const geral = resumir(doAtividade.map((m) => m.duracao_ms));
          const auto = resumir(
            doAtividade.filter((m) => m.sessoes?.tipo_coleta === "AUTO").map((m) => m.duracao_ms)
          );
          const observado = resumir(
            doAtividade.filter((m) => m.sessoes?.tipo_coleta === "OBSERVADO").map((m) => m.duracao_ms)
          );
          const tempoPorUnidade = a.requer_quantidade
            ? media(
                doAtividade
                  .filter((m) => m.quantidade && m.quantidade > 0)
                  .map((m) => m.duracao_ms / (m.quantidade as number))
              )
            : null;

          const porTurno = TURNOS.map((turno) => ({
            turno,
            resumo: resumir(
              doAtividade.filter((m) => m.sessoes?.turno === turno).map((m) => m.duracao_ms)
            ),
          })).filter((t) => t.resumo.n > 0);

          const porColaborador = calcularPorColaborador(doAtividade, colaboradorNome);

          return (
            <div key={a.id} className="rounded-lg border border-neutral-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-medium text-[#5F0040]">
                  <span className="text-neutral-400">{a.numero}</span> {a.nome}
                </p>
                <span className="text-xs text-neutral-500">{a.tipo_atividade}</span>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <LinhaResumo titulo="Autocronometragem" resumo={auto} />
                <LinhaResumo titulo="Observado" resumo={observado} />
              </div>
              <div className="mt-2">
                <LinhaResumo titulo="Geral" resumo={geral} />
              </div>
              {tempoPorUnidade !== null && geral.n > 0 && (
                <p className="mt-2 text-xs text-neutral-500">
                  tempo por unidade ({a.unidade}): {formatarMs(tempoPorUnidade)}
                </p>
              )}
              <div className="mt-2">
                <Histograma valores={doAtividade.map((m) => m.duracao_ms)} />
              </div>

              {(porTurno.length > 0 || porColaborador.length > 0) && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-neutral-500 underline">
                    quebra por turno e colaborador
                  </summary>
                  <div className="mt-2 flex flex-col gap-3">
                    {porTurno.length > 0 && (
                      <div>
                        <p className="mb-1 text-xs font-medium text-neutral-500">Por turno</p>
                        <div className="grid gap-2 sm:grid-cols-3">
                          {porTurno.map(({ turno, resumo }) => (
                            <LinhaResumo key={turno} titulo={turno} resumo={resumo} />
                          ))}
                        </div>
                      </div>
                    )}
                    {porColaborador.length > 0 && (
                      <div>
                        <p className="mb-1 text-xs font-medium text-neutral-500">Por colaborador</p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {porColaborador.map(({ nome, resumo }) => (
                            <LinhaResumo key={nome} titulo={nome} resumo={resumo} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </details>
              )}
            </div>
          );
        })}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-[#5F0040]">Por processo</h2>
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                <th className="px-4 py-2">Processo</th>
                <th className="px-4 py-2">n</th>
                <th className="px-4 py-2">Total</th>
                <th className="px-4 py-2">Média</th>
              </tr>
            </thead>
            <tbody>
              {porProcesso.map((linha) => (
                <tr key={linha.nome} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-2">{linha.nome}</td>
                  <td className="px-4 py-2 font-mono">{linha.n}</td>
                  <td className="px-4 py-2 font-mono">{formatarMs(linha.total)}</td>
                  <td className="px-4 py-2 font-mono">{formatarMs(linha.media)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-[#5F0040]">Por tipo de atividade</h2>
        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="w-full min-w-[480px] text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                <th className="px-4 py-2">Tipo</th>
                <th className="px-4 py-2">n</th>
                <th className="px-4 py-2">Total</th>
                <th className="px-4 py-2">Média</th>
              </tr>
            </thead>
            <tbody>
              {porTipoAtividade.map((linha) => (
                <tr key={linha.nome} className="border-b border-neutral-100 last:border-0">
                  <td className="px-4 py-2">{linha.nome}</td>
                  <td className="px-4 py-2 font-mono">{linha.n}</td>
                  <td className="px-4 py-2 font-mono">{formatarMs(linha.total)}</td>
                  <td className="px-4 py-2 font-mono">{formatarMs(linha.media)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {porFluxo.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-[#5F0040]">Tempo médio por etapa (dentro de cada fluxo)</h2>
          {porFluxo.map(({ fluxo, etapas }) => (
            <div key={fluxo.id} className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 bg-neutral-50 text-left">
                    <th colSpan={3} className="px-4 py-2 font-semibold text-[#5F0040]">
                      {fluxo.nome}
                    </th>
                  </tr>
                  <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
                    <th className="px-4 py-2">Etapa</th>
                    <th className="px-4 py-2">n</th>
                    <th className="px-4 py-2">Média</th>
                  </tr>
                </thead>
                <tbody>
                  {etapas.map(({ atividade, valores }) => (
                    <tr key={atividade.id} className="border-b border-neutral-100 last:border-0">
                      <td className="px-4 py-2">{atividade.nome}</td>
                      <td className="px-4 py-2 font-mono">{valores.length}</td>
                      <td className="px-4 py-2 font-mono">{formatarMs(media(valores))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function calcularPorColaborador(
  doAtividade: MedicaoEstatistica[],
  colaboradorNome: Map<number, string>
) {
  const mapa = new Map<number, number[]>();
  for (const m of doAtividade) {
    const id = m.sessoes?.colaborador_id;
    if (id === undefined) continue;
    const lista = mapa.get(id) ?? [];
    lista.push(m.duracao_ms);
    mapa.set(id, lista);
  }
  return Array.from(mapa.entries()).map(([id, valores]) => ({
    nome: colaboradorNome.get(id) ?? `Colaborador ${id}`,
    resumo: resumir(valores),
  }));
}
