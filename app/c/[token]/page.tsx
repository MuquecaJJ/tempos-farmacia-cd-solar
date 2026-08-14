import { redirect } from "next/navigation";

export default async function ColetaEntrada({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  redirect(`/c/${token}/sessao`);
}
