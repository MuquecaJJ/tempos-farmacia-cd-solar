"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { lerSessaoAtiva } from "@/lib/sessao-storage";
import { adquirirWakeLock, formatarTempo, liberarWakeLock, vibrar } from "@/lib/cronometro";
import type { Atividade, Fluxo, FluxoEtapa, SessaoAtiva } from "@/lib/types";

type Fase = "IDLE" | "SELECAO" | "RODANDO" | "CICLO_EM_FLUXO" | "INTERROMPIDO" | "CONFIRMACAO";

type MedicaoPendente = {
  atividade_id: number;
  ordem_etapa: number | null;
  ordem: number | null;
  iniciada_em: string;
  encerrada_em: string;
  duracao_ms: number;
  eh_interrupcao?: boolean;
  motivo_interrupcao?: string | null;
  quantidade?: number | null;
  unidade?: string | null;
};

type CicloEtapa = {
  numero: number;
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
  interrupcaoGenerica,
  interrupcaoCatalogada,
}: {
  token: string;
  fluxo: Fluxo;
  etapas: FluxoEtapa[];
  atividades: Atividade[];
  interrupcaoGenerica: Atividade | null;
  interrupcaoCatalogada: Atividade | null;
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
  const [ciclosEtapa, setCiclosEtapa] = useState<CicloEtapa[]>([]);
  const [quantidade, setQuantidade] = useState("");
  const [quantidadesPorAtividade, setQuantidadesPorAtividade] = useState<Record<number, string>>({});
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [faseAntesDaPausa, setFaseAntesDaPausa] = useState<Fase | null>(null);
  const [interrupcaoAtual, setInterrupcaoAtual] = useState<Atividade | null>(null);
  const [motivoInterrupcao, setMotivoInterrupcao] = useState("");
  const [quantidadeInterrupcao, setQuantidadeInterrupcao] = useState("");
  const [tempoPausadoMs, setTempoPausadoMs] = useState(0);
  const [qtdInterrupcoes, setQtdInterrupcoes] = useState(0);

  const corridaInicioPerfRef = useRef<number | null>(null);
  const corridaIniciadaEmRef = useRef<string | null>(null);
  const etapaInicioPerfRef = useRef<number | null>(null);
  const etapaIniciadaEmRef = useRef<string | null>(null);
  const cicloEtapaInicioPerfRef = useRef<number | null>(null);
  const cicloEtapaIniciadaEmRef = useRef<string | null>(null);
  const proximoCicloNumeroRef = useRef(1);
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
    if (fase !== "RODANDO" && fase !== "CICLO_EM_FLUXO" && fase !== "INTERROMPIDO") return;
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

  // Nome da próxima etapa, exibido durante a medição para o observador se
  // preparar com antecedência para encerrar a etapa atual.
  const proximaEtapaNome = (() => {
    if (subIndex + 1 < subFila.length) {
      return atividadesPorId.get(subFila[subIndex + 1].atividade_id)?.nome ?? null;
    }
    if (grupoIndex + 1 < totalGrupos) {
      const opcoes = grupos[grupoIndex + 1].opcoes;
      const nomes = opcoes
        .map((o) => atividadesPorId.get(o.atividade_id)?.nome)
        .filter((nome): nome is string => Boolean(nome));
      return nomes.length > 0 ? nomes.join(" ou ") : null;
    }
    return null;
  })();

  const etapaElapsedMs =
    fase === "RODANDO" && etapaInicioPerfRef.current !== null
      ? performance.now() - etapaInicioPerfRef.current
      : 0;
  const cicloEtapaElapsedMs =
    fase === "CICLO_EM_FLUXO" && cicloEtapaInicioPerfRef.current !== null
      ? performance.now() - cicloEtapaInicioPerfRef.current
      : 0;
  const corridaElapsedMs =
    corridaInicioPerfRef.current !== null
      ? performance.now() - corridaInicioPerfRef.current
      : 0;
  const pausaElapsedMs =
    fase === "INTERROMPIDO" && pausaInicioPerfRef.current !== null
      ? performance.now() - pausaInicioPerfRef.current
      : 0;

  // Só F4 e F8 (corrida = lote diário) coletam uma quantidade geral da
  // corrida (§3.2 do plano) — os demais fluxos capturam quantidade por
  // atividade (abaixo), não uma soma solta ao final.
  const exigeQuantidadeCorrida =
    fluxo.nome === "Preparação das Rotas" || fluxo.nome === "Dispensação de Pendências";

  // Uma atividade pede quantidade própria na confirmação quando foi de fato
  // executada nesta corrida (apareceu em `medicoes`), requer_quantidade e
  // não é CICLO_EM_FLUXO (nesse caso a quantidade já é o nº de ciclos).
  const idsAtividadesExecutadas = Array.from(
    new Set(medicoes.filter((m) => !m.eh_interrupcao).map((m) => m.atividade_id))
  );
  const atividadesComQuantidade = idsAtividadesExecutadas
    .map((id) => atividadesPorId.get(id))
    .filter(
      (a): a is Atividade => Boolean(a) && a!.requer_quantidade && a!.modo !== "CICLO_EM_FLUXO"
    );

  // Etapas com modo_etapa = CICLO_EM_FLUXO viram um sub-cronômetro repetível
  // (1 medição por ciclo, ex.: por item etiquetado) em vez de uma medição
  // única da etapa. O cronômetro da corrida nunca pausa (§4.1).
  function entrarEtapa(etapa: FluxoEtapa, startPerf: number, startIso: string) {
    if (etapa.modo_etapa === "CICLO_EM_FLUXO") {
      setCiclosEtapa([]);
      proximoCicloNumeroRef.current = 1;
      cicloEtapaInicioPerfRef.current = startPerf;
      cicloEtapaIniciadaEmRef.current = startIso;
      setFase("CICLO_EM_FLUXO");
    } else {
      etapaInicioPerfRef.current = startPerf;
      etapaIniciadaEmRef.current = startIso;
      setFase("RODANDO");
    }
  }

  function iniciarGrupo(idx: number, startPerf: number, startIso: string) {
    const grupo = grupos[idx];
    if (grupo.opcoes.length === 1) {
      const etapa = grupo.opcoes[0];
      setSubFila([etapa]);
      setSubIndex(0);
      entrarEtapa(etapa, startPerf, startIso);
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
        ordem_etapa: etapaAtual.ordem,
        ordem: null,
        iniciada_em: etapaIniciadaEmRef.current,
        encerrada_em: fimIso,
        duracao_ms: Math.round(fimPerf - (etapaInicioPerfRef.current ?? fimPerf)),
      };
      setMedicoes((prev) => [...prev, novaMedicao]);
    }

    if (subIndex + 1 < subFila.length) {
      const proximaSub = subFila[subIndex + 1];
      setSubIndex((i) => i + 1);
      entrarEtapa(proximaSub, fimPerf, fimIso);
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

  function registrarCicloEtapa() {
    vibrar();
    const fimPerf = performance.now();
    const fimIso = new Date().toISOString();
    const novo: CicloEtapa = {
      numero: proximoCicloNumeroRef.current++,
      iniciada_em: cicloEtapaIniciadaEmRef.current!,
      encerrada_em: fimIso,
      duracao_ms: Math.round(fimPerf - (cicloEtapaInicioPerfRef.current ?? fimPerf)),
    };
    setCiclosEtapa((prev) => [...prev, novo]);
    cicloEtapaInicioPerfRef.current = fimPerf;
    cicloEtapaIniciadaEmRef.current = fimIso;
  }

  function descartarCicloEtapa(numero: number) {
    vibrar();
    setCiclosEtapa((prev) => prev.filter((c) => c.numero !== numero));
  }

  function encerrarCiclosEtapa() {
    vibrar();
    if (etapaAtual && ciclosEtapa.length > 0) {
      const atividadeId = etapaAtual.atividade_id;
      const ordemEtapa = etapaAtual.ordem;
      const novasMedicoes: MedicaoPendente[] = ciclosEtapa.map((c, index) => ({
        atividade_id: atividadeId,
        ordem_etapa: ordemEtapa,
        ordem: index + 1,
        iniciada_em: c.iniciada_em,
        encerrada_em: c.encerrada_em,
        duracao_ms: c.duracao_ms,
      }));
      setMedicoes((prev) => [...prev, ...novasMedicoes]);
    }
    setCiclosEtapa([]);
    avancarAposEtapa(false);
  }

  // Interrupção (catalogada ou genérica, §4.2): pausa etapa e corrida, um
  // terceiro cronômetro conta a pausa. Ao retomar, desloca os cronômetros
  // pausados pela duração da pausa (para medir tempo líquido) e grava uma
  // medição com eh_interrupcao = true, fora da sequência de etapas.
  function iniciarInterrupcao(atividade: Atividade) {
    vibrar();
    const agoraPerf = performance.now();
    const agoraIso = new Date().toISOString();
    pausaInicioPerfRef.current = agoraPerf;
    pausaIniciadaEmRef.current = agoraIso;
    setFaseAntesDaPausa(fase);
    setInterrupcaoAtual(atividade);
    setMotivoInterrupcao("");
    setQuantidadeInterrupcao("");
    setErro(null);
    setFase("INTERROMPIDO");
  }

  function retomarInterrupcao() {
    if (!interrupcaoAtual) return;

    if (interrupcaoAtual.exige_motivo && !motivoInterrupcao.trim()) {
      setErro("Informe o motivo da interrupção.");
      return;
    }
    if (interrupcaoAtual.requer_quantidade && !quantidadeInterrupcao) {
      setErro("Informe a quantidade.");
      return;
    }

    vibrar();
    setErro(null);
    const agoraPerf = performance.now();
    const agoraIso = new Date().toISOString();
    const duracaoPausaMs = Math.round(agoraPerf - (pausaInicioPerfRef.current ?? agoraPerf));

    // desloca os cronômetros em andamento para não contar o tempo pausado
    if (corridaInicioPerfRef.current !== null) corridaInicioPerfRef.current += duracaoPausaMs;
    if (etapaInicioPerfRef.current !== null) etapaInicioPerfRef.current += duracaoPausaMs;
    if (cicloEtapaInicioPerfRef.current !== null) cicloEtapaInicioPerfRef.current += duracaoPausaMs;

    const qtd = quantidadeInterrupcao ? Number(quantidadeInterrupcao) : null;
    const novaMedicao: MedicaoPendente = {
      atividade_id: interrupcaoAtual.id,
      ordem_etapa: null,
      ordem: null,
      iniciada_em: pausaIniciadaEmRef.current!,
      encerrada_em: agoraIso,
      duracao_ms: duracaoPausaMs,
      eh_interrupcao: true,
      motivo_interrupcao: interrupcaoAtual.exige_motivo ? motivoInterrupcao.trim() : null,
      quantidade: interrupcaoAtual.requer_quantidade ? qtd : null,
      unidade: interrupcaoAtual.requer_quantidade ? interrupcaoAtual.unidade : null,
    };
    setMedicoes((prev) => [...prev, novaMedicao]);
    setTempoPausadoMs((prev) => prev + duracaoPausaMs);
    setQtdInterrupcoes((prev) => prev + 1);

    setInterrupcaoAtual(null);
    setFase(faseAntesDaPausa ?? "RODANDO");
    setFaseAntesDaPausa(null);
  }

  function confirmarSelecao() {
    vibrar();
    const escolhidos = grupoAtualOpcoes().filter((o) => selecionados.has(o.atividade_id));
    const agoraPerf = performance.now();
    const agoraIso = new Date().toISOString();
    setSubFila(escolhidos);
    setSubIndex(0);
    entrarEtapa(escolhidos[0], agoraPerf, agoraIso);
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

    let qtdCorrida: number | null = null;
    if (exigeQuantidadeCorrida) {
      qtdCorrida = Number(quantidade);
      if (!quantidade || !Number.isFinite(qtdCorrida) || qtdCorrida < 0) {
        setErro("Informe a quantidade da corrida.");
        return;
      }
    }

    const quantidadesFinais = new Map<number, number>();
    for (const a of atividadesComQuantidade) {
      const valor = quantidadesPorAtividade[a.id];
      const num = Number(valor);
      if (!valor || !Number.isFinite(num) || num < 0) {
        setErro(`Informe a quantidade de "${a.nome}".`);
        return;
      }
      quantidadesFinais.set(a.id, num);
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
      quantidade: qtdCorrida,
      unidade: exigeQuantidadeCorrida ? fluxo.unidade_corrida : null,
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
          ? "Não foi possível salvar a corrida. Tente novamente."
          : "Não foi possível descartar a corrida. Tente novamente."
      );
      return;
    }

    if (medicoes.length > 0) {
      const linhas = medicoes.map((m) => {
        const quantidadeEtapa = quantidadesFinais.has(m.atividade_id)
          ? quantidadesFinais.get(m.atividade_id)!
          : (m.quantidade ?? null);
        const unidadeEtapa = quantidadesFinais.has(m.atividade_id)
          ? (atividadesPorId.get(m.atividade_id)?.unidade ?? null)
          : (m.unidade ?? null);
        return {
          sessao_id: sessao!.id,
          corrida_id: corridaId,
          atividade_id: m.atividade_id,
          ordem_etapa: m.ordem_etapa,
          ordem: m.ordem,
          iniciada_em: m.iniciada_em,
          encerrada_em: m.encerrada_em,
          duracao_ms: m.duracao_ms,
          quantidade: quantidadeEtapa,
          unidade: unidadeEtapa,
          observacao: null,
          status,
          eh_interrupcao: m.eh_interrupcao ?? false,
          motivo_interrupcao: m.motivo_interrupcao ?? null,
        };
      });
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
        {etapaAtual?.opcional && etapaAtual.condicao && (
          <p className="text-center text-xs text-neutral-500">
            Aplica-se apenas: {etapaAtual.condicao}
          </p>
        )}
        <div className="flex flex-1 flex-col items-center justify-center gap-2">
          <p className="font-mono text-6xl font-bold tabular-nums text-[#5F0040]">
            {formatarTempo(etapaElapsedMs)}
          </p>
          <p className="font-mono text-lg tabular-nums text-neutral-400">
            total {formatarTempo(corridaElapsedMs)}
          </p>
        </div>
        {proximaEtapaNome && (
          <p className="text-center text-xs text-neutral-500">
            Próxima etapa: <span className="font-medium text-neutral-600">{proximaEtapaNome}</span>
          </p>
        )}
        <button
          onClick={proximaEtapa}
          className="min-h-[40vh] w-full rounded-lg bg-[#5F0040] text-2xl font-bold text-white"
        >
          {ehUltimaEtapa ? "ENCERRAR CORRIDA" : "PRÓXIMA ETAPA"}
        </button>
        <button onClick={pularEtapa} className="text-sm text-neutral-500 underline">
          pular etapa
        </button>
        <BotoesInterrupcao
          interrupcaoGenerica={interrupcaoGenerica}
          interrupcaoCatalogada={interrupcaoCatalogada}
          onIniciar={iniciarInterrupcao}
        />
      </div>
    );
  }

  if (fase === "CICLO_EM_FLUXO") {
    const mediaCicloMs =
      ciclosEtapa.length > 0
        ? ciclosEtapa.reduce((soma, c) => soma + c.duracao_ms, 0) / ciclosEtapa.length
        : 0;
    const ultimosCiclosEtapa = ciclosEtapa.slice(-3).reverse();

    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-4 p-6">
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
        <div className="flex flex-col items-center gap-1">
          <p className="font-mono text-6xl font-bold tabular-nums text-[#5F0040]">
            {formatarTempo(cicloEtapaElapsedMs)}
          </p>
          <p className="text-sm text-neutral-500">
            ciclo {ciclosEtapa.length + 1} · média {formatarTempo(mediaCicloMs)} · total{" "}
            {formatarTempo(corridaElapsedMs)}
          </p>
        </div>
        {proximaEtapaNome && (
          <p className="text-center text-xs text-neutral-500">
            Próxima etapa: <span className="font-medium text-neutral-600">{proximaEtapaNome}</span>
          </p>
        )}

        <button
          onClick={registrarCicloEtapa}
          className="min-h-[30vh] w-full rounded-lg bg-[#FBB040] text-3xl font-bold"
        >
          CICLO
        </button>

        <button
          onClick={encerrarCiclosEtapa}
          className="rounded-lg bg-[#5F0040] px-4 py-4 text-lg font-semibold text-white"
        >
          CONCLUIR ETAPA
        </button>

        {ultimosCiclosEtapa.length > 0 && (
          <div className="flex flex-col gap-2">
            {ultimosCiclosEtapa.map((c) => (
              <div
                key={c.numero}
                className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm"
              >
                <span className="text-neutral-600">
                  Ciclo {c.numero} — {formatarTempo(c.duracao_ms)}
                </span>
                <button
                  onClick={() => descartarCicloEtapa(c.numero)}
                  className="text-xs text-neutral-400 underline"
                >
                  descartar
                </button>
              </div>
            ))}
          </div>
        )}
        <BotoesInterrupcao
          interrupcaoGenerica={interrupcaoGenerica}
          interrupcaoCatalogada={interrupcaoCatalogada}
          onIniciar={iniciarInterrupcao}
        />
      </div>
    );
  }

  if (fase === "INTERROMPIDO") {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 bg-amber-50 p-6">
        <div className="rounded-lg border-2 border-amber-500 bg-amber-100 p-4 text-center">
          <p className="text-lg font-bold text-amber-800">⏸ FLUXO PAUSADO</p>
          <p className="text-sm text-amber-700">{interrupcaoAtual?.nome}</p>
        </div>
        <p className="text-center font-mono text-5xl font-bold tabular-nums text-amber-600">
          {formatarTempo(pausaElapsedMs)}
        </p>

        {interrupcaoAtual?.requer_quantidade && (
          <div>
            <label className="mb-1 block text-sm font-medium text-neutral-600">
              Quantidade {interrupcaoAtual.unidade ? `(${interrupcaoAtual.unidade})` : ""}
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

        {interrupcaoAtual?.exige_motivo && (
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
        <h1 className="text-xl font-semibold text-[#5F0040]">{fluxo.nome}</h1>
        <p className="font-mono text-2xl tabular-nums text-neutral-600">
          {formatarTempo(corridaElapsedMs)}
        </p>
      </div>

      {atividadesComQuantidade.map((a) => (
        <div key={a.id}>
          <label className="mb-1 block text-sm font-medium text-neutral-600">
            {a.nome} {a.unidade ? `(${a.unidade})` : ""}
          </label>
          <input
            type="number"
            inputMode="numeric"
            step={1}
            min={0}
            value={quantidadesPorAtividade[a.id] ?? ""}
            onChange={(e) =>
              setQuantidadesPorAtividade((prev) => ({ ...prev, [a.id]: e.target.value }))
            }
            className="w-full rounded-lg border border-neutral-300 px-4 py-3 text-base"
          />
        </div>
      ))}

      {exigeQuantidadeCorrida && (
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

function BotoesInterrupcao({
  interrupcaoGenerica,
  interrupcaoCatalogada,
  onIniciar,
}: {
  interrupcaoGenerica: Atividade | null;
  interrupcaoCatalogada: Atividade | null;
  onIniciar: (atividade: Atividade) => void;
}) {
  if (!interrupcaoGenerica && !interrupcaoCatalogada) return null;
  return (
    <div className="flex flex-col gap-1">
      {interrupcaoCatalogada && (
        <button
          onClick={() => onIniciar(interrupcaoCatalogada)}
          className="text-sm text-amber-700 underline"
        >
          ⏸ ABASTECER GÔNDOLA
        </button>
      )}
      {interrupcaoGenerica && (
        <button
          onClick={() => onIniciar(interrupcaoGenerica)}
          className="text-sm text-amber-700 underline"
        >
          ⏸ INTERROMPER
        </button>
      )}
    </div>
  );
}
