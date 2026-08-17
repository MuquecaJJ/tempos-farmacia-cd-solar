import { entrar } from "./actions";

export default async function PainelLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ erro?: string }>;
}) {
  const { erro } = await searchParams;

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-5 p-6">
      <h1 className="text-xl font-semibold text-[#5F0040]">Painel — Cronômetro Operacional</h1>
      <form action={entrar} className="flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-600">PIN de acesso</label>
          <input
            type="password"
            name="pin"
            inputMode="numeric"
            autoFocus
            required
            className="w-full rounded-lg border border-neutral-300 px-4 py-3 text-base"
          />
        </div>
        {erro && <p className="text-sm text-red-600">PIN incorreto.</p>}
        <button
          type="submit"
          className="rounded-lg bg-[#FBB040] px-4 py-4 text-lg font-semibold"
        >
          Entrar
        </button>
      </form>
    </div>
  );
}
