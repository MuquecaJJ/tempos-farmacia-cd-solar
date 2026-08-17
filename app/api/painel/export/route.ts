import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { PAINEL_COOKIE, pinValido } from "@/lib/painel-auth";
import type { Atividade, Colaborador, Fluxo, Papel, Processo, StatusRegistro } from "@/lib/types";

type MedicaoExport = {
  id: string;
  sessao_id: string;
  corrida_id: string | null;
  atividade_id: number;
  ordem: number | null;
  iniciada_em: string;
  encerrada_em: string;
  duracao_ms: number;
  quantidade: number | null;
  unidade: string | null;
  observacao: string | null;
  status: StatusRegistro;
  sessoes: {
    colaborador_id: number;
    observador_id: number | null;
    papel_id: number;
    turno: string;
    tipo_coleta: string;
    dispositivo: string | null;
    processo_id: number;
  } | null;
};

const CABECALHO = [
  "medicao_id",
  "sessao_id",
  "corrida_id",
  "data",
  "hora",
  "turno",
  "colaborador",
  "papel",
  "tipo_coleta",
  "observador",
  "dispositivo",
  "processo_codigo",
  "processo_nome",
  "fluxo",
  "atividade_numero",
  "atividade_nome",
  "tipo_atividade",
  "natureza",
  "modo",
  "ordem",
  "duracao_ms",
  "duracao_seg",
  "quantidade",
  "unidade",
  "tempo_por_unidade_seg",
  "status",
  "observacao",
];

function escaparCampo(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined) return "";
  const texto = String(valor);
  if (texto.includes(";") || texto.includes('"') || texto.includes("\n")) {
    return `"${texto.replace(/"/g, '""')}"`;
  }
  return texto;
}

export async function GET() {
  const cookie = (await cookies()).get(PAINEL_COOKIE)?.value;
  if (!pinValido(cookie)) {
    return new Response("Não autorizado", { status: 401 });
  }

  const [
    { data: medicoes },
    { data: atividades },
    { data: processos },
    { data: papeis },
    { data: colaboradores },
    { data: corridas },
    { data: fluxos },
  ] = await Promise.all([
    supabaseAdmin
      .from("medicoes")
      .select(
        "id, sessao_id, corrida_id, atividade_id, ordem, iniciada_em, encerrada_em, duracao_ms, quantidade, unidade, observacao, status, sessoes(colaborador_id, observador_id, papel_id, turno, tipo_coleta, dispositivo, processo_id)"
      )
      .order("criado_em") as unknown as Promise<{ data: MedicaoExport[] | null }>,
    supabaseAdmin
      .from("atividades")
      .select("id, numero, processo_id, papel_id, nome, tipo_atividade, natureza, modo, unidade, requer_quantidade, meta_amostras, ativo") as unknown as Promise<{
      data: Atividade[] | null;
    }>,
    supabaseAdmin.from("processos").select("id, codigo, nome, ordem") as unknown as Promise<{ data: Processo[] | null }>,
    supabaseAdmin.from("papeis").select("id, nome, ordem") as unknown as Promise<{ data: Papel[] | null }>,
    supabaseAdmin.from("colaboradores").select("id, nome, ativo") as unknown as Promise<{ data: Colaborador[] | null }>,
    supabaseAdmin.from("corridas").select("id, fluxo_id") as unknown as Promise<{
      data: { id: string; fluxo_id: number | null }[] | null;
    }>,
    supabaseAdmin.from("fluxos").select("id, processo_id, nome, unidade_corrida, ordem") as unknown as Promise<{
      data: Fluxo[] | null;
    }>,
  ]);

  const atividadePorId = new Map((atividades ?? []).map((a) => [a.id, a]));
  const processoPorId = new Map((processos ?? []).map((p) => [p.id, p]));
  const papelPorId = new Map((papeis ?? []).map((p) => [p.id, p.nome]));
  const colaboradorPorId = new Map((colaboradores ?? []).map((c) => [c.id, c.nome]));
  const fluxoIdPorCorrida = new Map((corridas ?? []).map((c) => [c.id, c.fluxo_id]));
  const fluxoNomePorId = new Map((fluxos ?? []).map((f) => [f.id, f.nome]));

  const linhas = (medicoes ?? []).map((m) => {
    const atividade = atividadePorId.get(m.atividade_id);
    const processo = atividade ? processoPorId.get(atividade.processo_id) : undefined;
    const fluxoId = m.corrida_id ? fluxoIdPorCorrida.get(m.corrida_id) : null;
    const fluxoNome = fluxoId ? fluxoNomePorId.get(fluxoId) : null;
    const dataHora = new Date(m.encerrada_em);
    const duracaoSeg = m.duracao_ms / 1000;
    const tempoPorUnidade = m.quantidade && m.quantidade > 0 ? duracaoSeg / m.quantidade : null;

    const campos = [
      m.id,
      m.sessao_id,
      m.corrida_id ?? "",
      dataHora.toLocaleDateString("pt-BR"),
      dataHora.toLocaleTimeString("pt-BR"),
      m.sessoes?.turno ?? "",
      m.sessoes ? colaboradorPorId.get(m.sessoes.colaborador_id) ?? "" : "",
      m.sessoes ? papelPorId.get(m.sessoes.papel_id) ?? "" : "",
      m.sessoes?.tipo_coleta ?? "",
      m.sessoes?.observador_id ? colaboradorPorId.get(m.sessoes.observador_id) ?? "" : "",
      m.sessoes?.dispositivo ?? "",
      processo?.codigo ?? "",
      processo?.nome ?? "",
      fluxoNome ?? "",
      atividade?.numero ?? "",
      atividade?.nome ?? "",
      atividade?.tipo_atividade ?? "",
      atividade?.natureza ?? "",
      atividade?.modo ?? "",
      m.ordem ?? "",
      m.duracao_ms,
      duracaoSeg.toFixed(3),
      m.quantidade ?? "",
      m.unidade ?? "",
      tempoPorUnidade !== null ? tempoPorUnidade.toFixed(3) : "",
      m.status,
      m.observacao ?? "",
    ];

    return campos.map(escaparCampo).join(";");
  });

  const csv = String.fromCharCode(0xfeff) + [CABECALHO.join(";"), ...linhas].join("\r\n");
  const dataArquivo = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="medicoes_${dataArquivo}.csv"`,
    },
  });
}
