export const PAINEL_COOKIE = "painel_sessao";

export function pinValido(valor: string | undefined): boolean {
  const pin = process.env.PAINEL_PIN;
  return Boolean(pin) && valor === pin;
}
