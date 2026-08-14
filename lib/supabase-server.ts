import "server-only";
import { createClient } from "@supabase/supabase-js";

// Cliente com service role — só pode ser importado em Route Handlers / Server Components.
// O pacote "server-only" quebra o build se este arquivo for importado por engano
// em um componente "use client".
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
