import { Suspense } from "react";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { Atividade, Colaborador, StatusRegistro } from "@/lib/types";
import { RegistrosFiltros } from "./RegistrosFiltros";
import { marcarSuspeita } from "./actions";

const TAMANHO_PAGINA = 50;

type MedicaoRegistro = {
  id: string;
  atividade_id: number;
  iniciada_em: string;
  encerrada_em: string;
  duracao_ms: number;
  quantidade: number | null;
  unidade: string | null;
  observacao: string | null;
  status: StatusRegistro;
  criado_em: string;
  atividades: { numero: number; nome: string } | null;
  sessoes: { colaborador_id: number; turno: string; tipo_coleta: string } | null;
};

const CORES_STATUS: Record<StatusRegistro, string> = {
  VALIDA: "bg-green-100 text-green-700",
  DESCARTADA: "bg-neutral-200 text-neutral-600",
  SUSPEITA: "bg-red-100 text-red-700",
};

export default async function RegistrosPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; atividade?: string }>;
}) {
  const { page: pageParam, status, atividade } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const de = (page - 1) * TAMANHO_PAGINA;
  const ate = de + TAMANHO_PAGINA - 1;

  let query = supabaseAdmin
    .from("medicoes")
    .select(
      "id, atividade_id, iniciada_em, encerrada_em, duracao_ms, quantidade, unidade, observacao, status, criado_em, atividades(numero, nome), sessoes(colaborador_id, turno, tipo_coleta)",
      { count: "exact" }
    )
    .order("criado_em", { ascending: false })
    .range(de, ate);

  if (status) query = query.eq("status", status);
  if (atividade) query = query.eq("atividade_id", Number(atividade));

  const [{ data: medicoes, count }, { data: atividades }, { data: colaboradores }] = await Promise.all([
    query as unknown as Promise<{ data: MedicaoRegistro[] | null; count: number | null }>,
    supabaseAdmin
      .from("atividades")
      .select("id, numero, processo_id, papel_id, nome, tipo_atividade, natureza, modo, unidade, requer_quantidade, meta_amostras, ativo")
      .order("numero") as unknown as Promise<{ data: Atividade[] | null }>,
    supabaseAdmin.from("colaboradores").select("id, nome, ativo") as unknown as Promise<{
      data: Colaborador[] | null;
    }>,
  ]);

  const colaboradorNome = new Map((colaboradores ?? []).map((c) => [c.id, c.nome]));
  const totalPaginas = count ? Math.ceil(count / TAMANHO_PAGINA) : 1;

  return (
    <div className="flex flex-col gap-4">
      <Suspense fallback={<div className="h-12" />}>
        <RegistrosFiltros atividades={atividades ?? []} />
      </Suspense>

      <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs text-neutral-500">
              <th className="px-3 py-2">Data</th>
              <th className="px-3 py-2">Atividade</th>
              <th className="px-3 py-2">Colaborador</th>
              <th className="px-3 py-2">Turno</th>
              <th className="px-3 py-2">Tipo</th>
              <th className="px-3 py-2">Duração</th>
              <th className="px-3 py-2">Qtd</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {(medicoes ?? []).map((m) => (
              <tr key={m.id} className="border-b border-neutral-100 last:border-0">
                <td className="whitespace-nowrap px-3 py-2 text-neutral-500">
                  {new Date(m.criado_em).toLocaleString("pt-BR")}
                </td>
                <td className="px-3 py-2">
                  {m.atividades ? `${m.atividades.numero} — ${m.atividades.nome}` : m.atividade_id}
                </td>
                <td className="px-3 py-2">
                  {m.sessoes ? colaboradorNome.get(m.sessoes.colaborador_id) ?? "—" : "—"}
                </td>
                <td className="px-3 py-2">{m.sessoes?.turno ?? "—"}</td>
                <td className="px-3 py-2">{m.sessoes?.tipo_coleta ?? "—"}</td>
                <td className="px-3 py-2 font-mono">{(m.duracao_ms / 1000).toFixed(1)}s</td>
                <td className="px-3 py-2 font-mono">
                  {m.quantidade ?? "—"} {m.unidade ?? ""}
                </td>
                <td className="px-3 py-2">
                  <span className={`rounded px-2 py-1 text-xs font-semibold ${CORES_STATUS[m.status]}`}>
                    {m.status}
                  </span>
                </td>
                <td className="px-3 py-2">
                  {m.status !== "SUSPEITA" && (
                    <form action={marcarSuspeita.bind(null, m.id)}>
                      <button type="submit" className="text-xs text-neutral-500 underline">
                        marcar suspeita
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-neutral-500">
        <span>
          Página {page} de {totalPaginas} · {count ?? 0} registros
        </span>
        <div className="flex gap-3">
          {page > 1 && (
            <a
              className="underline"
              href={`?${new URLSearchParams({ ...(status && { status }), ...(atividade && { atividade }), page: String(page - 1) }).toString()}`}
            >
              anterior
            </a>
          )}
          {page < totalPaginas && (
            <a
              className="underline"
              href={`?${new URLSearchParams({ ...(status && { status }), ...(atividade && { atividade }), page: String(page + 1) }).toString()}`}
            >
              próxima
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
