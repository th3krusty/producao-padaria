import { createClient } from "@supabase/supabase-js";

// Essas variáveis vêm do seu .env (veja .env.example) e também precisam
// ser configuradas em Project Settings → Environment Variables na Vercel.
// No Vite, variáveis expostas ao navegador precisam começar com VITE_.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.error(
    "[Supabase] VITE_SUPABASE_URL e/ou VITE_SUPABASE_ANON_KEY não configurados. " +
    "Copie .env.example para .env e preencha com os dados do seu projeto Supabase " +
    "(Project Settings → API)."
  );
}

export const supabase = createClient(supabaseUrl ?? "", supabaseAnonKey ?? "");
