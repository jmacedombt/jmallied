import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

// O Next.js (App Router) intercepta o fetch global e, por padrão, tenta
// cachear respostas de GET indefinidamente (o "Data Cache") — mesmo em
// páginas renderizadas dinamicamente. Como o supabase-js usa fetch por
// baixo dos panos pra falar com o PostgREST, sem isso as consultas podem
// voltar com uma resposta em cache antiga mesmo depois dos dados terem
// mudado de verdade no banco (ex: apertar "Recalcular" grava certinho,
// mas a tela continua mostrando o valor antigo até o próximo deploy).
// "no-store" força toda consulta a ir direto no banco, sempre.
function fetchSemCache(input: RequestInfo | URL, init?: RequestInit) {
  return fetch(input, { ...init, cache: "no-store" });
}

/**
 * Cliente Supabase para uso em Server Components / Server Actions,
 * lendo e gravando a sessão nos cookies da requisição.
 */
export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: fetchSemCache },
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // chamado a partir de um Server Component: ignorado,
            // o middleware cuida de renovar a sessão.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            // idem acima
          }
        },
      },
    }
  );
}

/**
 * Cliente Supabase com a service role key — só pode ser usado em
 * rotinas de servidor (ex: cadastro de usuário), nunca no browser.
 */
export function createAdminClient() {
  const { createClient: createSupabaseClient } = require("@supabase/supabase-js");
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false }, global: { fetch: fetchSemCache } }
  );
}
