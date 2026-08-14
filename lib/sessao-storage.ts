import type { SessaoAtiva } from "./types";

const SESSAO_KEY = "cronometro:sessao";
const DISPOSITIVO_KEY = "cronometro:dispositivo";

// R11: sessao_id (e demais dados da sessão) em sessionStorage; dispositivo em localStorage.

export function lerSessaoAtiva(): SessaoAtiva | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(SESSAO_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SessaoAtiva;
  } catch {
    return null;
  }
}

export function salvarSessaoAtiva(sessao: SessaoAtiva) {
  window.sessionStorage.setItem(SESSAO_KEY, JSON.stringify(sessao));
}

export function encerrarSessaoAtiva() {
  window.sessionStorage.removeItem(SESSAO_KEY);
}

export function lerDispositivo(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(DISPOSITIVO_KEY);
}

export function salvarDispositivo(dispositivo: string) {
  window.localStorage.setItem(DISPOSITIVO_KEY, dispositivo);
}
