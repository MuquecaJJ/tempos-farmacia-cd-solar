import { createClient } from "@supabase/supabase-js";

// Cliente para uso em Client Components. Usa a chave anon — respeita RLS.
export const supabaseBrowser = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
