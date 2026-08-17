"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { lerSessaoAtiva } from "@/lib/sessao-storage";
import { adquirirWakeLock, formatarTempo, liberarWakeLock, vibrar } from "@/lib/cronometro";
import type { Atividade, Fluxo, FluxoEtapa, SessaoAtiva } from "@/lib/types";

type Fase = "IDLE" | "SELECAO" | "RODANDO" | "CONFIRMACAO";

type MedicaoPendente = {
  atividade_id: number;
  ordem: number;
  iniciada_em: string;
  encerrada_em: string;
  duracao_ms: number;
};

type Grupo = { ordem: number; opcoes: FluxoEtapa[] };

export function CorridaFluxo({
  token,
  fluxo,
  etapas,
  atividades,
}: {
  token: string;
  fluxo: Fluxo;
  etapas: FluxoEtapa[];
  atividades: Atividade[];
}) {
  const router = useRouter();

  const atividadesPorId = useMemo(() => {
    const mapa = new Map<number, Atividade>();
    for (const a of atividades) mapa.set(a.id, a);
    return mapa;
  }, [atividades]);

  const grupos = useMemo<Grupo[]>(() => {
    const porOrdem = new Map<number, FluxoEtapa[]>();
    for (const e of etapas) {
      const lista = porOrdem.get(e.ordem) ?? [];
      lista.push(e);
      porOrdem.set(e.ordem, lista);
    }
    return Array.from(porOrdem.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([ordem, opcoes]) => ({ ordem, opcoes }));
  }, [etapas]);

  const [sessao, setSessao] = useState<SessaoAtiva | null | undefined>(undefined);
  const [fase, setFase] = useState<Fase>("IDLE");
  const [, setTick] = useState(0);
  const [grupoIndex, setGrupoIndex] = useState(0);
  const [subFila, setSubFila] = useState<FluxoEtapa[]>([]);
  const [subIndex, setSubIndex] = useState(0);
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [medicoes, setMedicoes] = useState<MedicaoPendente[]>([]);
  const [quantidade, setQuantidade] = useState("");
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const corridaInicioPerfRef = useRef<number | null>(null);
  const corridaIniciadaEmRef = useRef<string | null>(null);
  const etapaInicioPerfRef = useRef<number | null>(null);
  const etapaIniciadaEmRef = useRef<string | null>(null);
  const proximaOrdemRef = useRef(1);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    const s = lerSessaoAtiva();
    if (!s) {
      router.replace(`/c/${token}/sessao`);
      return;
    }
    setSessao(s);
  }, [token, router]);

  useEffect(() => {
    if (fase !== "RODANDO") return;
    const id = setInterval(() => setTick((t) => t + 1), 100);
    return () => clearInterval(id);
  }, [fase]);

  useEffect(() => {
    if (fase === "IDLE") {
      liberarWakeLock(wakeLockRef);
      return;
    }
    adquirirWakeLock(wakeLockRef);

    function onVisibilityChange() {
      if (document.visibilityState === "visible") adquirirWakeLock(wakeLockRef);
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      liberarWakeLock(wakeLockRef);
    };
  }, [fase]);

  useEffect(() => {
    if (fase === "IDLE") return;
    function handler(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [fase]);

  if (sessao === undefined || sessao === null) {
    return null;
  }

  const totalGrupos = grupos.length;
  const etapaAtual = subFila[subIndex];
  const atividadeAtual = etapaAtual ? atividadesPorId.get(etapaAtual.atividade_id) : undefined;
  const ehUltimaEtapa =
    grupoIndex === totalGrupos - 1 && subIndex === subFila.length - 1;

  const etapaElapsedMs =
    fase === "RODANDO" && etapaInicioPerfRef.current !== null
      ? performance.now() - etapaInicioPerfRef.current
      : 0;
  const corridaElapsedMs =
    corridaInicioPerfRef.current !== null
      ? performance.now() - corridaInicioPerfRef.current
      : 0;

  function iniciarGrupo(idx: number, startPerf: number, startIso: string) {
    const grupo = grupos[idx];
    if (grupo.opcoes.length === 1) {
      setSubFila([grupo.opcoes[0]]);
      setSubIndex(0);
      etapaInicioPerfRef.current = startPerf;
      etapaIniciadaEmRef.current = startIso;
      setFase("RODANDO");
    } else {
      setSubFila([]);
      setSubIndex(0);
      setSelecionados(new Set());
      setFase("SELECAO");
    }
  }

  function iniciarCorrida() {
    vibrar();
    const agoraPerf = performance.now();
    const agoraIso = new Date().toISOString();
    corridaInicioPerfRef.current = agoraPerf;
    corridaIniciadaEmRef.current = agoraIso;
    setGrupoIndex(0);
    iniciarGrupo(0, agoraPerf, agoraIso);
  }

  function avancarAposEtapa(gravarMedicao: boolean) {
    const fimPerf = performance.now();
    const fimIso = new Date().toISOString();

    if (gravarMedicao && etapaAtual && etapaIniciadaEmRef.current) {
      const novaMedicao: MedicaoPendente = {
        atividade_id: etapaAtual.atividade_id,
        ordem: proximaOrdemRef.current++,
        iniciada_em: etapaIniciadaEmRef.current,
        encerrada_em: fimIso,
        duracao_ms: Math.round(fimPerf - (etapaInicioPerfRef.current ?? fimPerf)),
      };
      setMedicoes((prev) => [...prev, novaMedicao]);
    }

    if (subIndex + 1 < subFila.length) {
      setSubIndex((i) => i + 1);
      etapaInicioPerfRef.current = fimPerf;
      etapaIniciadaEmRef.current = fimIso;
      return;
    }

    if (grupoIndex + 1 < totalGrupos) {
      const novoIndex = grupoIndex + 1;
      setGrupoIndex(novoIndex);
      iniciarGrupo(novoIndex, fimPerf, fimIso);
      return;
    }

    setFase("CONFIRMACAO");
  }

  function proximaEtapa() {
    vibrar();
    avancarAposEtapa(true);
  }

  function pularEtapa() {
    vibrar();
    avancarAposEtapa(false);
  }

  function confirmarSelecao() {
    vibrar();
    const escolhidos = grupoAtualOpcoes().filter((o) => selecionados.has(o.atividade_id));
    const agoraPerf = performance.now();
    const agoraIso = new Date().toISOString();
    setSubFila(escolhidos);
    setSubIndex(0);
    etapaInicioPerfRef.current = agoraPerf;
    etapaIniciadaEmRef.current = agoraIso;
    setFase("RODANDO");
  }

  function pularGrupoInteiro() {
    vibrar();
    if (grupoIndex + 1 < totalGrupos) {
      const novoIndex = grupoIndex + 1;
      const agoraPerf = performance.now();
      const agoraIso = new Date().toISOString();
      setGrupoIndex(novoIndex);
      iniciarGrupo(novoIndex, agoraPerf, agoraIso);
      return;
    }
    setFase("CONFIRMACAO");
  }

  function grupoAtualOpcoes(): FluxoEtapa[] {
    return grupos[grupoIndex]?.opcoes ?? [];
  }

  function alternarSelecao(atividadeId: number) {
    setSelecionados((prev) => {
      const novo = new Set(prev);
      if (novo.has(atividadeId)) novo.delete(atividadeId);
      else novo.add(atividadeId);
      return novo;
    });
  }

  function cancelar() {
    vibrar();
    router.push(`/c/${token}/atividades`);
  }

  async function finalizar(status: "VALIDA" | "DESCARTADA") {
    setErro(null);

    const qtd = Number(quantidade);
    if (!quantidade || !Number.isFinite(qtd) || qtd < 0) {
      setErro("Informe a quantidade da corrida.");
      return;
    }

    vibrar();
    setSalvando(true);

    const corridaId = crypto.randomUUID();
    const { error: corridaError } = await supabaseBrowser.from("corridas").insert({
      id: corridaId,
      sessao_id: sessao!.id,
      fluxo_id: fluxo.id,
      atividade_id: null,
      modo: "FLUXO",
      quantidade: qtd,
      unidade: fluxo.unidade_corrida,
      iniciada_em: corridaIniciadaEmRef.current,
      encerrada_em: new Date().toISOString(),
      observacao: observacao.trim() || null,
      status,
    });

    if (corridaError) {
      setSalvando(false);
      setErro(
        status === "VALIDA"
          ? "Não foi possível salvar a corrida. Tente novamente."
          : "Não foi possível descartar a corrida. Tente novamente."
      );
      return;
    }

    if (medicoes.length > 0) {
      const linhas = medicoes.map((m) => ({
        sessao_id: sessao!.id,
        corrida_id: corridaId,
        atividade_id: m.atividade_id,
        ordem: m.ordem,
        iniciada_em: m.iniciada_em,
        encerrada_em: m.encerrada_em,
        duracao_ms: m.duracao_ms,
        quantidade: null,
        unidade: null,
        observacao: null,
        status,
      }));
      const { error: medicoesError } = await supabaseBrowser.from("medicoes").insert(linhas);
      if (medicoesError) {
        setSalvando(false);
        setErro("Corrida salva, mas houve um erro ao gravar as etapas.");
        return;
      }
    }

    setSalvando(false);
    router.push(`/c/${token}/atividades`);
  }

  if (fase === "IDLE") {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6">
        <div>
          <p className="text-sm text-neutral-500">Fluxo</p>
          <h1 className="text-xl font-semibold text-[#5F0040]">{fluxo.nome}</h1>
        </div>
        <button
          onClick={() => router.push(`/c/${token}/atividades`)}
          className="text-sm text-neutral-500 underline"
        >
          voltar ao catálogo
        </button>
        <div className="flex flex-1 items-end">
          <button
            onClick={iniciarCorrida}
            className="min-h-[40vh] w-full rounded-lg bg-[#FBB040] text-2xl font-bold"
          >
            INICIAR CORRIDA
          </button>
        </div>
      </div>
    );
  }

  if (fase === "SELECAO") {
    const opcoes = grupoAtualOpcoes();
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-neutral-500">
            etapa {grupoIndex + 1} de {totalGrupos}
          </p>
          <button onClick={cancelar} className="text-xs text-neutral-400 underline">
            cancelar
          </button>
        </div>
        <h1 className="text-lg font-semibold text-[#5F0040]">
          Qual variante está sendo executada?
        </h1>
        <p className="text-xs text-neutral-500">Selecione uma ou mais opções.</p>
        <div className="flex flex-col gap-2">
          {opcoes.map((o) => {
            const atividade = atividadesPorId.get(o.atividade_id);
            const marcado = selecionados.has(o.atividade_id);
            return (
              <button
                key={o.atividade_id}
                type="button"
                onClick={() => alternarSelecao(o.atividade_id)}
                className={`rounded-lg border px-4 py-3 text-left text-base font-medium ${
                  marcado
                    ? "border-[#5F0040] bg-[#5F0040] text-white"
                    : "border-neutral-200 bg-white text-neutral-700"
                }`}
              >
                {atividade?.nome ?? `Atividade ${o.atividade_id}`}
              </button>
            );
          })}
        </div>
        <button
          onClick={confirmarSelecao}
          disabled={selecionados.size === 0}
          className="rounded-lg bg-[#FBB040] px-4 py-4 text-lg font-semibold disabled:opacity-50"
        >
          PRÓXIMA ETAPA
        </button>
        <button onClick={pularGrupoInteiro} className="text-sm text-neutral-500 underline">
          pular etapa
        </button>
      </div>
    );
  }

  if (fase === "RODANDO") {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-neutral-500">
            etapa {grupoIndex + 1} de {totalGrupos}
          </p>
          <button onClick={cancelar} className="text-xs text-neutral-400 underline">
            cancelar
          </button>
        </div>
        <h1 className="text-center text-lg font-semibold text-[#5F0040]">
          {atividadeAtual?.nome ?? ""}
        </h1>
        <div className="flex flex-1 flex-col items-center justify-center gap-2">
          <p className="font-mono text-6xl font-bold tabular-nums text-[#5F0040]">
            {formatarTempo(etapaElapsedMs)}
          </p>
          <p className="font-mono text-lg tabular-nums text-neutral-400">
            total {formatarTempo(corridaElapsedMs)}
          </p>
        </div>
        <button
          onClick={proximaEtapa}
          className="min-h-[40vh] w-full rounded-lg bg-[#5F0040] text-2xl font-bold text-white"
        >
          {ehUltimaEtapa ? "ENCERRAR CORRIDA" : "PRÓXIMA ETAPA"}
        </button>
        <button onClick={pularEtapa} className="text-sm text-neutral-500 underline">
          pular etapa
        </button>
      </div>
    );
  }

  // CONFIRMACAO
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 p-6">
      <div>
        <h1 className="text-xl font-semibold text-[#5F0040]">{fluxo.nome}</h1>
        <p className="font-mono text-2xl tabular-nums text-neutral-600">
          {formatarTempo(corridaElapsedMs)}
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-600">
          Quantidade ({fluxo.unidade_corrida})
        </label>
        <input
          type="number"
          inputMode="numeric"
          step={1}
          min={0}
          value={quantidade}
          onChange={(e) => setQuantidade(e.target.value)}
          className="w-full rounded-lg border border-neutral-300 px-4 py-3 text-base"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-600">
          Observação (opcional)
        </label>
        <textarea
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-neutral-300 px-4 py-3 text-base"
        />
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <button
        onClick={() => finalizar("VALIDA")}
        disabled={salvando}
        className="rounded-lg bg-[#FBB040] px-4 py-4 text-lg font-semibold disabled:opacity-50"
      >
        {salvando ? "Salvando..." : "SALVAR"}
      </button>
      <button
        onClick={() => finalizar("DESCARTADA")}
        disabled={salvando}
        className="rounded-lg bg-neutral-200 px-4 py-3 text-neutral-700 disabled:opacity-50"
      >
        Descartar corrida inteira
      </button>
    </div>
  );
}
