import { notFound } from "next/navigation";

// S1: token aleatório de 32 chars validado server-side. Token inválido → 404
// (não revela nem a existência da rota).
export default async function ColetaLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  if (!process.env.COLETA_TOKEN || token !== process.env.COLETA_TOKEN) {
    notFound();
  }

  return <>{children}</>;
}
