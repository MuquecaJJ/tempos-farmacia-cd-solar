"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { BuscaLista } from "@/components/BuscaLista";
import {
  lerDispositivo,
  lerSessaoAtiva,
  salvarDispositivo,
  salvarSessaoAtiva,
  encerrarSessaoAtiva,
} from "@/lib/sessao-storage";
import type { Colaborador, Papel, Processo, SessaoAtiva, TipoColeta, Turno } from "@/lib/types";

const DISPOSITIVOS = ["CEL-01", "CEL-02", "CEL-03", "CEL-04"];

const TURNOS: { valor: Turno; label: string }[] = [
  { valor: "MANHA", label: "Manhã" },
  { valor: "TARDE", label: "Tarde" },
  { valor: "NOITE", label: "Noite" },
];

const TIPOS_COLETA: { valor: TipoColeta; label: string }[] = [
  { valor: "AUTO", label: "Autocronometragem" },
  { valor: "OBSERVADO", label: "Observado" },
];

export function SessaoForm({
  token,
  colaboradores,
  papeis,
  processos,
}: {
  token: string;
  colaboradores: Colaborador[];
  papeis: Papel[];
  processos: Processo[];
}) {
  const router = useRouter();

  const [dispositivo, setDispositivo] = useState<string | null | undefined>(undefined);
  const [sessaoAtiva, setSessaoAtiva] = useState<SessaoAtiva | null | undefined>(undefined);

  const [colaboradorId, setColaboradorId] = useState<number | null>(null);
  const [processoId, setProcessoId] = useState<number | null>(null);
  const [papelId, setPapelId] = useState<number | null>(null);
  const [turno, setTurno] = useState<Turno | null>(null);
  const [tipoColeta, setTipoColeta] = useState<TipoColeta | null>(null);
  const [observadorId, setObservadorId] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setDispositivo(lerDispositivo());
    setSessaoAtiva(lerSessaoAtiva());
  }, []);

  if (dispositivo === undefined || sessaoAtiva === undefined) {
    return null;
  }

  if (!dispositivo) {
    return (
      <TelaDispositivo
        onEscolher={(d) => {
          salvarDispositivo(d);
          setDispositivo(d);
        }}
      />
    );
  }

  if (sessaoAtiva) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
        <h1 className="text-xl font-semibold text-[#5F0040]">Sessão ativa</h1>
        <div className="rounded-lg border border-neutral-300 bg-white p-4 text-sm">
          <p><strong>Colaborador:</strong> {sessaoAtiva.colaboradorNome}</p>
          <p><strong>Macroprocesso:</strong> {sessaoAtiva.processoNome}</p>
          <p><strong>Papel:</strong> {sessaoAtiva.papelNome}</p>
          <p><strong>Turno:</strong> {sessaoAtiva.turno}</p>
          <p><strong>Tipo:</strong> {sessaoAtiva.tipoColeta}</p>
        </div>
        <button
          onClick={() => router.push(`/c/${token}/atividades`)}
          className="rounded-lg bg-[#FBB040] px-4 py-4 text-lg font-semibold"
        >
          Continuar sessão
        </button>
        <button
          onClick={() => {
            encerrarSessaoAtiva();
            setSessaoAtiva(null);
          }}
          className="rounded-lg bg-neutral-200 px-4 py-3 text-neutral-700"
        >
          Encerrar e trocar de colaborador
        </button>
      </div>
    );
  }

  const precisaObservador = tipoColeta === "OBSERVADO";

  async function abrirSessao() {
    setErro(null);

    if (!colaboradorId || !processoId || !papelId || !turno || !tipoColeta) {
      setErro("Preencha todos os campos obrigatórios.");
      return;
    }
    if (precisaObservador && !observadorId) {
      setErro("Informe o observador.");
      return;
    }

    setSalvando(true);
    const { data, error } = await supabaseBrowser
      .from("sessoes")
      .insert({
        colaborador_id: colaboradorId,
        observador_id: precisaObservador ? observadorId : null,
        processo_id: processoId,
        papel_id: papelId,
        turno,
        tipo_coleta: tipoColeta,
        dispositivo,
      })
      .select("id")
      .single();

    setSalvando(false);

    if (error || !data) {
      setErro("Não foi possível abrir a sessão. Tente novamente.");
      return;
    }

    const colaborador = colaboradores.find((c) => c.id === colaboradorId)!;
    const processo = processos.find((p) => p.id === processoId)!;
    const papel = papeis.find((p) => p.id === papelId)!;
    const observador = colaboradores.find((c) => c.id === observadorId) ?? null;

    salvarSessaoAtiva({
      id: data.id,
      colaboradorId,
      colaboradorNome: colaborador.nome,
      processoId,
      processoNome: processo.nome,
      papelId,
      papelNome: papel.nome,
      turno,
      tipoColeta,
      observadorId: precisaObservador ? observadorId : null,
      observadorNome: precisaObservador ? (observador?.nome ?? null) : null,
      dispositivo: dispositivo!,
      iniciadaEm: new Date().toISOString(),
    });

    router.push(`/c/${token}/atividades`);
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col gap-5 p-6">
      <div>
        <h1 className="text-xl font-semibold text-[#5F0040]">Nova sessão de medição</h1>
        <p className="text-sm text-neutral-500">{dispositivo}</p>
      </div>

      <AvisoTransparencia />

      <BuscaLista
        label="Colaborador (quem executa)"
        items={colaboradores}
        selecionadoId={colaboradorId}
        onSelecionar={(item) => setColaboradorId(item.id)}
      />

      <div>
        <label className="block text-sm font-medium text-neutral-600 mb-2">Macroprocesso</label>
        <div className="flex flex-col gap-2">
          {processos.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setProcessoId(p.id)}
              className={`rounded-lg px-4 py-3 text-left text-base font-medium ${
                processoId === p.id ? "bg-[#5F0040] text-white" : "bg-neutral-200 text-neutral-700"
              }`}
            >
              {p.nome}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-600 mb-1">Papel no momento</label>
        <select
          value={papelId ?? ""}
          onChange={(e) => setPapelId(e.target.value ? Number(e.target.value) : null)}
          className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-3 text-base"
        >
          <option value="">Selecione...</option>
          {papeis.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-600 mb-2">Turno</label>
        <div className="grid grid-cols-3 gap-2">
          {TURNOS.map((t) => (
            <button
              key={t.valor}
              type="button"
              onClick={() => setTurno(t.valor)}
              className={`rounded-lg py-4 text-base font-medium ${
                turno === t.valor ? "bg-[#5F0040] text-white" : "bg-neutral-200 text-neutral-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-neutral-600 mb-2">Tipo de coleta</label>
        <div className="grid grid-cols-2 gap-2">
          {TIPOS_COLETA.map((t) => (
            <button
              key={t.valor}
              type="button"
              onClick={() => setTipoColeta(t.valor)}
              className={`rounded-lg py-4 text-base font-medium ${
                tipoColeta === t.valor ? "bg-[#5F0040] text-white" : "bg-neutral-200 text-neutral-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {precisaObservador && (
        <BuscaLista
          label="Observador"
          items={colaboradores.filter((c) => c.id !== colaboradorId)}
          selecionadoId={observadorId}
          onSelecionar={(item) => setObservadorId(item.id)}
        />
      )}

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      <button
        onClick={abrirSessao}
        disabled={salvando}
        className="rounded-lg bg-[#FBB040] px-4 py-4 text-lg font-semibold disabled:opacity-50"
      >
        {salvando ? "Abrindo..." : "Iniciar sessão"}
      </button>
    </div>
  );
}

function TelaDispositivo({ onEscolher }: { onEscolher: (d: string) => void }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6">
      <h1 className="text-xl font-semibold text-[#5F0040]">Qual é este aparelho?</h1>
      <p className="text-sm text-neutral-500">
        Pergunta feita apenas uma vez por aparelho.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {DISPOSITIVOS.map((d) => (
          <button
            key={d}
            onClick={() => onEscolher(d)}
            className="rounded-lg bg-neutral-200 py-6 text-lg font-semibold text-neutral-700"
          >
            {d}
          </button>
        ))}
      </div>
    </div>
  );
}

function AvisoTransparencia() {
  return (
    <div className="rounded-lg border border-[#FBB040] bg-[#FBB040]/10 p-3 text-xs text-neutral-700">
      <p className="font-semibold text-[#5F0040]">Sobre esta medição</p>
      <p className="mt-1">
        Os tempos coletados são utilizados exclusivamente para o estudo de
        readequação do layout e do fluxo da Farmácia. O objetivo é entender o
        processo, não avaliar pessoas individualmente. Os dados não serão
        usados para fins disciplinares nem para avaliação de desempenho.
        Dúvidas: procure a coordenação.
      </p>
    </div>
  );
}
