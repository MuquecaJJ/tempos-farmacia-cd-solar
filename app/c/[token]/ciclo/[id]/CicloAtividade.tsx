"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { lerSessaoAtiva } from "@/lib/sessao-storage";
import { adquirirWakeLock, formatarTempo, liberarWakeLock, vibrar } from "@/lib/cronometro";
import type { Atividade, SessaoAtiva } from "@/lib/types";

type Fase = "IDLE" | "RODANDO" | "INTERROMPIDO" | "CONFIRMACAO";

type Ciclo = {
  numero: number;
  iniciada_em: string;
  encerrada_em: string;
  duracao_ms: number;
};

type InterrupcaoRegistrada = {
  atividade_id: number;
  iniciada_em: string;
  encerrada_em: string;
  duracao_ms: number;
  motivo_interrupcao: string | null;
  quantidade: number | null;
  unidade: string | null;
};

export function CicloAtividade({
  token,
  atividade,
  interrupcaoGenerica,
}: {
  token: string;
  atividade: Atividade;
  interrupcaoGenerica: Atividade | null;
}) {
  const router = useRouter();

  const [sessao, setSessao] = useState<SessaoAtiva | null | undefined>(undefined);
  const [fase, setFase] = useState<Fase>("IDLE");
  const [, setTick] = useState(0);
  const [ciclos, setCiclos] = useState<Ciclo[]>([]);
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [faseAntesDaPausa, setFaseAntesDaPausa] = useState<Fase | null>(null);
  const [motivoInterrupcao, setMotivoInterrupcao] = useState("");
  const [quantidadeInterrupcao, setQuantidadeInterrupcao] = useState("");
  const [interrupcoes, setInterrupcoes] = useState<InterrupcaoRegistrada[]>([]);
  const [tempoPausadoMs, setTempoPausadoMs] = useState(0);
  const [qtdInterrupcoes, setQtdInterrupcoes] = useState(0);

  const corridaInicioPerfRef = useRef<number | null>(null);
  const corridaIniciadaEmRef = useRef<string | null>(null);
  const cicloInicioPerfRef = useRef<number | null>(null);
  const cicloIniciadaEmRef = useRef<string | null>(null);
  const proximoNumeroRef = useRef(1);
  const pausaInicioPerfRef = useRef<number | null>(null);
  const pausaIniciadaEmRef = useRef<string | null>(null);
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
    if (fase !== "RODANDO" && fase !== "INTERROMPIDO") return;
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

  const cicloElapsedMs =
    fase === "RODANDO" && cicloInicioPerfRef.current !== null
      ? performance.now() - cicloInicioPerfRef.current
      : 0;
  const corridaElapsedMs =
    corridaInicioPerfRef.current !== null
      ? performance.now() - corridaInicioPerfRef.current
      : 0;
  const pausaElapsedMs =
    fase === "INTERROMPIDO" && pausaInicioPerfRef.current !== null
      ? performance.now() - pausaInicioPerfRef.current
      : 0;
  const mediaMs =
    ciclos.length > 0
      ? ciclos.reduce((soma, c) => soma + c.duracao_ms, 0) / ciclos.length
      : 0;
  const ultimosCiclos = ciclos.slice(-3).reverse();

  function iniciar() {
    vibrar();
    const agoraPerf = performance.now();
    const agoraIso = new Date().toISOString();
    corridaInicioPerfRef.current = agoraPerf;
    corridaIniciadaEmRef.current = agoraIso;
    cicloInicioPerfRef.current = agoraPerf;
    cicloIniciadaEmRef.current = agoraIso;
    proximoNumeroRef.current = 1;
    setCiclos([]);
    setInterrupcoes([]);
    setTempoPausadoMs(0);
    setQtdInterrupcoes(0);
    setFase("RODANDO");
  }

  function registrarCiclo() {
    vibrar();
    const fimPerf = performance.now();
    const fimIso = new Date().toISOString();
    const novoCiclo: Ciclo = {
      numero: proximoNumeroRef.current++,
      iniciada_em: cicloIniciadaEmRef.current!,
      encerrada_em: fimIso,
      duracao_ms: Math.round(fimPerf - (cicloInicioPerfRef.current ?? fimPerf)),
    };
    setCiclos((prev) => [...prev, novoCiclo]);
    cicloInicioPerfRef.current = fimPerf;
    cicloIniciadaEmRef.current = fimIso;
  }

  function descartarCiclo(numero: number) {
    vibrar();
    setCiclos((prev) => prev.filter((c) => c.numero !== numero));
  }

  function encerrar() {
    vibrar();
    setFase("CONFIRMACAO");
  }

  function cancelar() {
    vibrar();
    router.push(`/c/${token}/atividades`);
  }

  // Interrupção genérica (§4.2): pausa os cronômetros da corrida e do ciclo
  // em andamento; ao retomar, desloca-os pela duração da pausa e grava uma
  // medição com eh_interrupcao = true, fora da contagem de ciclos.
  function iniciarInterrupcao() {
    if (!interrupcaoGenerica) return;
    vibrar();
    const agoraPerf = performance.now();
    const agoraIso = new Date().toISOString();
    pausaInicioPerfRef.current = agoraPerf;
    pausaIniciadaEmRef.current = agoraIso;
    setFaseAntesDaPausa(fase);
    setMotivoInterrupcao("");
    setQuantidadeInterrupcao("");
    setErro(null);
    setFase("INTERROMPIDO");
  }

  function retomarInterrupcao() {
    if (!interrupcaoGenerica) return;

    if (interrupcaoGenerica.exige_motivo && !motivoInterrupcao.trim()) {
      setErro("Informe o motivo da interrupção.");
      return;
    }
    if (interrupcaoGenerica.requer_quantidade && !quantidadeInterrupcao) {
      setErro("Informe a quantidade.");
      return;
    }

    vibrar();
    setErro(null);
    const agoraPerf = performance.now();
    const agoraIso = new Date().toISOString();
    const duracaoPausaMs = Math.round(agoraPerf - (pausaInicioPerfRef.current ?? agoraPerf));

    if (corridaInicioPerfRef.current !== null) corridaInicioPerfRef.current += duracaoPausaMs;
    if (cicloInicioPerfRef.current !== null) cicloInicioPerfRef.current += duracaoPausaMs;

    const qtd = quantidadeInterrupcao ? Number(quantidadeInterrupcao) : null;
    setInterrupcoes((prev) => [
      ...prev,
      {
        atividade_id: interrupcaoGenerica.id,
        iniciada_em: pausaIniciadaEmRef.current!,
        encerrada_em: agoraIso,
        duracao_ms: duracaoPausaMs,
        motivo_interrupcao: interrupcaoGenerica.exige_motivo ? motivoInterrupcao.trim() : null,
        quantidade: interrupcaoGenerica.requer_quantidade ? qtd : null,
        unidade: interrupcaoGenerica.requer_quantidade ? interrupcaoGenerica.unidade : null,
      },
    ]);
    setTempoPausadoMs((prev) => prev + duracaoPausaMs);
    setQtdInterrupcoes((prev) => prev + 1);

    setFase(faseAntesDaPausa ?? "RODANDO");
    setFaseAntesDaPausa(null);
  }

  async function finalizar(status: "VALIDA" | "DESCARTADA") {
    setErro(null);
    vibrar();
    setSalvando(true);

    const corridaId = crypto.randomUUID();
    const { error: corridaError } = await supabaseBrowser.from("corridas").insert({
      id: corridaId,
      sessao_id: sessao!.id,
      fluxo_id: null,
      atividade_id: atividade.id,
      modo: "CICLO",
      quantidade: ciclos.length,
      unidade: atividade.unidade,
      iniciada_em: corridaIniciadaEmRef.current,
      encerrada_em: new Date().toISOString(),
      observacao: observacao.trim() || null,
      status,
      tempo_pausado_ms: tempoPausadoMs,
      qtd_interrupcoes: qtdInterrupcoes,
    });

    if (corridaError) {
      setSalvando(false);
      setErro(
        status === "VALIDA"
          ? "Não foi possível salvar. Tente novamente."
          : "Não foi possível descartar. Tente novamente."
      );
      return;
    }

    const linhasCiclos = ciclos.map((c, index) => ({
      sessao_id: sessao!.id,
      corrida_id: corridaId,
      atividade_id: atividade.id,
      ordem: index + 1,
      iniciada_em: c.iniciada_em,
      encerrada_em: c.encerrada_em,
      duracao_ms: c.duracao_ms,
      quantidade: null,
      unidade: null,
      observacao: null,
      status,
    }));
    const linhasInterrupcoes = interrupcoes.map((i) => ({
      sessao_id: sessao!.id,
      corrida_id: corridaId,
      atividade_id: i.atividade_id,
      ordem: null,
      iniciada_em: i.iniciada_em,
      encerrada_em: i.encerrada_em,
      duracao_ms: i.duracao_ms,
      quantidade: i.quantidade,
      unidade: i.unidade,
      observacao: null,
      status,
      eh_interrupcao: true,
      motivo_interrupcao: i.motivo_interrupcao,
    }));
    const linhas = [...linhasCiclos, ...linhasInterrupcoes];

    if (linhas.length > 0) {
      const { error: medicoesError } = await supabaseBrowser.from("medicoes").insert(linhas);
      if (medicoesError) {
        setSalvando(false);
        setErro("Corrida salva, mas houve um erro ao gravar os ciclos.");
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
          <p className="text-sm text-neutral-500">{atividade.codigo}</p>
          <h1 className="text-xl font-semibold text-[#5F0040]">{atividade.nome}</h1>
        </div>
        <button
          onClick={() => router.push(`/c/${token}/atividades`)}
          className="text-sm text-neutral-500 underline"
        >
          voltar ao catálogo
        </button>
        <div className="flex flex-1 items-end">
          <button
            onClick={iniciar}
            className="min-h-[40vh] w-full rounded-lg bg-[#FBB040] text-2xl font-bold"
          >
            INICIAR
          </button>
        </div>
      </div>
    );
  }

  if (fase === "RODANDO") {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-neutral-500">{atividade.nome}</p>
          <button onClick={cancelar} className="text-xs text-neutral-400 underline">
            cancelar
          </button>
        </div>

        <div className="flex flex-col items-center gap-1">
          <p className="font-mono text-6xl font-bold tabular-nums text-[#5F0040]">
            {formatarTempo(cicloElapsedMs)}
          </p>
          <p className="text-sm text-neutral-500">
            ciclo {ciclos.length + 1} · média {formatarTempo(mediaMs)} · total{" "}
            {formatarTempo(corridaElapsedMs)}
          </p>
        </div>

        <button
          onClick={registrarCiclo}
          className="min-h-[35vh] w-full rounded-lg bg-[#FBB040] text-3xl font-bold"
        >
          CICLO
        </button>

        <button
          onClick={encerrar}
          className="rounded-lg bg-[#5F0040] px-4 py-4 text-lg font-semibold text-white"
        >
          ENCERRAR
        </button>

        {ultimosCiclos.length > 0 && (
          <div className="flex flex-col gap-2">
            {ultimosCiclos.map((c) => (
              <div
                key={c.numero}
                className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm"
              >
                <span className="text-neutral-600">
                  Ciclo {c.numero} — {formatarTempo(c.duracao_ms)}
                </span>
                <button
                  onClick={() => descartarCiclo(c.numero)}
                  className="text-xs text-neutral-400 underline"
                >
                  descartar
                </button>
              </div>
            ))}
          </div>
        )}

        {interrupcaoGenerica && (
          <button onClick={iniciarInterrupcao} className="text-sm text-amber-700 underline">
            ⏸ INTERROMPER
          </button>
        )}
      </div>
    );
  }

  if (fase === "INTERROMPIDO") {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 bg-amber-50 p-6">
        <div className="rounded-lg border-2 border-amber-500 bg-amber-100 p-4 text-center">
          <p className="text-lg font-bold text-amber-800">⏸ CICLO PAUSADO</p>
          <p className="text-sm text-amber-700">{interrupcaoGenerica?.nome}</p>
        </div>
        <p className="text-center font-mono text-5xl font-bold tabular-nums text-amber-600">
          {formatarTempo(pausaElapsedMs)}
        </p>

        {interrupcaoGenerica?.requer_quantidade && (
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-600">
              Quantidade {interrupcaoGenerica.unidade ? `(${interrupcaoGenerica.unidade})` : ""}
            </label>
            <input
              type="number"
              inputMode="numeric"
              step={1}
              min={0}
              value={quantidadeInterrupcao}
              onChange={(e) => setQuantidadeInterrupcao(e.target.value)}
              className="w-full rounded-lg border border-neutral-300 px-4 py-3 text-base"
            />
          </div>
        )}

        {interrupcaoGenerica?.exige_motivo && (
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-600">Motivo</label>
            <textarea
              value={motivoInterrupcao}
              onChange={(e) => setMotivoInterrupcao(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-neutral-300 px-4 py-3 text-base"
            />
          </div>
        )}

        {erro && <p className="text-sm text-red-600">{erro}</p>}

        <div className="flex flex-1 items-end">
          <button
            onClick={retomarInterrupcao}
            className="min-h-[30vh] w-full rounded-lg bg-amber-500 text-2xl font-bold text-white"
          >
            RETOMAR
          </button>
        </div>
      </div>
    );
  }

  // CONFIRMACAO
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 p-6">
      <div>
        <h1 className="text-xl font-semibold text-[#5F0040]">{atividade.nome}</h1>
        <p className="text-sm text-neutral-500">
          {ciclos.length} ciclo{ciclos.length === 1 ? "" : "s"} · {atividade.unidade}
        </p>
        <p className="font-mono text-2xl tabular-nums text-neutral-600">
          {formatarTempo(corridaElapsedMs)}
        </p>
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
