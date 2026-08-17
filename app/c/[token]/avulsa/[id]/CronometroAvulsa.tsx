"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { lerSessaoAtiva } from "@/lib/sessao-storage";
import { adquirirWakeLock, formatarTempo, liberarWakeLock, vibrar } from "@/lib/cronometro";
import type { Atividade, SessaoAtiva } from "@/lib/types";

type Fase = "IDLE" | "RODANDO" | "CONFIRMACAO";

export function CronometroAvulsa({
  token,
  atividade,
}: {
  token: string;
  atividade: Atividade;
}) {
  const router = useRouter();

  const [sessao, setSessao] = useState<SessaoAtiva | null | undefined>(undefined);
  const [fase, setFase] = useState<Fase>("IDLE");
  const [, setTick] = useState(0);
  const [quantidade, setQuantidade] = useState("");
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const inicioPerfRef = useRef<number | null>(null);
  const iniciadaEmRef = useRef<string | null>(null);
  const encerradaEmRef = useRef<string | null>(null);
  const duracaoMsRef = useRef<number | null>(null);
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
    if (fase !== "RODANDO") {
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
    if (fase !== "RODANDO") return;
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

  const elapsedMs =
    fase === "RODANDO" && inicioPerfRef.current !== null
      ? performance.now() - inicioPerfRef.current
      : (duracaoMsRef.current ?? 0);

  function iniciar() {
    vibrar();
    inicioPerfRef.current = performance.now();
    iniciadaEmRef.current = new Date().toISOString();
    setFase("RODANDO");
  }

  function cancelar() {
    vibrar();
    inicioPerfRef.current = null;
    iniciadaEmRef.current = null;
    setFase("IDLE");
    router.push(`/c/${token}/atividades`);
  }

  function parar() {
    vibrar();
    const fimPerf = performance.now();
    duracaoMsRef.current = Math.round(fimPerf - inicioPerfRef.current!);
    encerradaEmRef.current = new Date().toISOString();
    setFase("CONFIRMACAO");
  }

  async function gravar(status: "VALIDA" | "DESCARTADA") {
    setErro(null);

    if (status === "VALIDA" && atividade.requer_quantidade) {
      const qtd = Number(quantidade);
      if (!quantidade || !Number.isFinite(qtd) || qtd < 0) {
        setErro("Informe a quantidade.");
        return;
      }
    }

    vibrar();
    setSalvando(true);

    const qtdInformada = atividade.requer_quantidade && quantidade ? Number(quantidade) : null;

    const { error } = await supabaseBrowser.from("medicoes").insert({
      sessao_id: sessao!.id,
      corrida_id: null,
      atividade_id: atividade.id,
      ordem: null,
      iniciada_em: iniciadaEmRef.current,
      encerrada_em: encerradaEmRef.current,
      duracao_ms: duracaoMsRef.current,
      quantidade: qtdInformada,
      unidade: qtdInformada !== null ? atividade.unidade : null,
      observacao: observacao.trim() || null,
      status,
    });

    setSalvando(false);

    if (error) {
      setErro(
        status === "VALIDA"
          ? "Não foi possível salvar. Tente novamente."
          : "Não foi possível descartar. Tente novamente."
      );
      return;
    }

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
      <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-neutral-500">{atividade.nome}</p>
          <button onClick={cancelar} className="text-xs text-neutral-400 underline">
            cancelar
          </button>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center">
          <p className="font-mono text-6xl font-bold tabular-nums text-[#5F0040]">
            {formatarTempo(elapsedMs)}
          </p>
        </div>
        <button
          onClick={parar}
          className="min-h-[40vh] w-full rounded-lg bg-[#5F0040] text-2xl font-bold text-white"
        >
          PARAR
        </button>
      </div>
    );
  }

  // CONFIRMACAO
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 p-6">
      <div>
        <h1 className="text-xl font-semibold text-[#5F0040]">{atividade.nome}</h1>
        <p className="font-mono text-2xl tabular-nums text-neutral-600">
          {formatarTempo(duracaoMsRef.current ?? 0)}
        </p>
      </div>

      {atividade.requer_quantidade && (
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-600">
            Quantidade {atividade.unidade ? `(${atividade.unidade})` : ""}
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
      )}

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
        onClick={() => gravar("VALIDA")}
        disabled={salvando}
        className="rounded-lg bg-[#FBB040] px-4 py-4 text-lg font-semibold disabled:opacity-50"
      >
        {salvando ? "Salvando..." : "SALVAR"}
      </button>
      <button
        onClick={() => gravar("DESCARTADA")}
        disabled={salvando}
        className="rounded-lg bg-neutral-200 px-4 py-3 text-neutral-700 disabled:opacity-50"
      >
        Descartar
      </button>
    </div>
  );
}
