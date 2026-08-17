import Link from "next/link";
import { sair } from "../actions";

const ABAS = [
  { href: "/painel/cobertura", label: "Cobertura" },
  { href: "/painel/atividades", label: "Estatísticas" },
  { href: "/painel/registros", label: "Registros" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-[#5F0040] px-4 py-3 text-white">
        <nav className="flex flex-wrap gap-4 text-sm font-medium">
          {ABAS.map((aba) => (
            <Link key={aba.href} href={aba.href} className="underline-offset-4 hover:underline">
              {aba.label}
            </Link>
          ))}
        </nav>
        <form action={sair}>
          <button type="submit" className="text-xs underline opacity-90">
            sair
          </button>
        </form>
      </header>
      {children}
    </div>
  );
}
