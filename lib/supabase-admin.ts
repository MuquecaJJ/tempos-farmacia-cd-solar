import "server-only";
import { createClient } from "@supabase/supabase-js";

// Cliente com service role — NUNCA importar em componente "use client".
// Uso exclusivo do painel (S6): leitura de sessoes/corridas/medicoes bypassando RLS.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
