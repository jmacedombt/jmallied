import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { STATUS_OPERACIONAL } from "@/lib/orcamentos";

// caminhos de página que o cargo ALLIED (login externo, só consulta)
// pode abrir — Operacional > Painel, a etapa de cada card (qualquer
// slug de STATUS_OPERACIONAL) e a tela Backlog. Qualquer outra página
// (Bases/BID, Métricas, Configurações, Usuários, Manutenção,
// Reconhecimento Lote, Dashboard etc.) é redirecionada pra /operacional
// — mesmo entrando pela URL direto. Isso é só a metade "página" da
// proteção: a metade "dado" (nunca devolver custo/BID) é reforçada no
// banco, ver migration 0035_cargo_allied.sql.
const SLUGS_OPERACIONAL_ALLIED = STATUS_OPERACIONAL.map((s) => s.slug);

// única chamada de API que ALLIED pode fazer: o botão "Exportar
// backlog" da tela Backlog — sem nenhuma coluna de custo, então não
// tem problema nenhum em liberar (ver route.ts dessa rota).
const APIS_PERMITIDAS_ALLIED = ["/api/operacional/backlog/exportar-allied"];

function rotaPermitidaParaAllied(path: string): boolean {
  if (path === "/operacional") return true;
  if (path === "/operacional/backlog" || path.startsWith("/operacional/backlog/")) return true;
  return SLUGS_OPERACIONAL_ALLIED.some(
    (slug) => path === `/operacional/${slug}` || path.startsWith(`/operacional/${slug}/`)
  );
}

/**
 * Protege as rotas do sistema:
 * - sem sessão -> manda para /login
 * - com sessão e must_change_password=true -> força /trocar-senha
 * - já logado tentando abrir /login -> manda para /dashboard
 * - cargo ALLIED -> só pode abrir Operacional (Painel/etapas/Backlog);
 *   qualquer outra página vira redirect pra /operacional, e qualquer
 *   chamada de API própria (/api/**) é barrada (ALLIED é só consulta,
 *   nenhuma tela dele precisa chamar API nenhuma — os dados vêm todos
 *   já prontos do Server Component).
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  // "Esqueci minha senha" (pop-up da tela de login) chama essa API sem
  // ninguém autenticado ainda — tem que ficar pública igual o /login,
  // senão o middleware redireciona a chamada antes dela chegar na rota.
  const isPublic = path === "/login" || path === "/api/auth/solicitar-reset-senha";
  const isTrocarSenha = path === "/trocar-senha";

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  let perfil: { must_change_password: boolean; cargo: string } | null = null;
  if (user) {
    const { data } = await supabase
      .from("usuarios")
      .select("must_change_password, cargo")
      .eq("id", user.id)
      .single();
    perfil = data;
  }

  if (user && isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = perfil?.cargo === "ALLIED" ? "/operacional" : "/dashboard";
    return NextResponse.redirect(url);
  }

  if (user && !isTrocarSenha) {
    if (perfil?.must_change_password) {
      const url = request.nextUrl.clone();
      url.pathname = "/trocar-senha";
      return NextResponse.redirect(url);
    }

    if (perfil?.cargo === "ALLIED") {
      if (path.startsWith("/api/") && !APIS_PERMITIDAS_ALLIED.includes(path)) {
        return NextResponse.json({ error: "Não permitido para este cargo." }, { status: 403 });
      }
      if (!rotaPermitidaParaAllied(path)) {
        const url = request.nextUrl.clone();
        url.pathname = "/operacional";
        url.search = "";
        return NextResponse.redirect(url);
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|logo-allied.png).*)",
  ],
};
