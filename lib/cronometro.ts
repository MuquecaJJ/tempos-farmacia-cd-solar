import type { MutableRefObject } from "react";

export function formatarTempo(ms: number): string {
  const totalDecimos = Math.floor(ms / 100);
  const minutos = Math.floor(totalDecimos / 600);
  const segundos = Math.floor((totalDecimos % 600) / 10);
  const decimos = totalDecimos % 10;
  return `${String(minutos).padStart(2, "0")}:${String(segundos).padStart(2, "0")}.${decimos}`;
}

export function vibrar() {
  try {
    navigator.vibrate?.(50);
  } catch {}
}

export async function adquirirWakeLock(ref: MutableRefObject<WakeLockSentinel | null>) {
  try {
    ref.current = (await navigator.wakeLock?.request("screen")) ?? null;
  } catch {
    // fallback silencioso — API ausente ou permissão negada
  }
}

export function liberarWakeLock(ref: MutableRefObject<WakeLockSentinel | null>) {
  ref.current?.release().catch(() => {});
  ref.current = null;
}
