import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { STATUS_OPERACIONAL } from "@/lib/orcamentos";
import {
  operacionalRestrito,
  rotaBloqueadaParaOperacional,
  financeiroRestrito,
  rotaBloqueadaParaFinanceiro,
} from "@/lib/usuarios";

// caminhos de página que o cargo ALLIED (login externo, só consulta)
// pode abrir — Operacional > Painel, a etapa de cada card (qualquer
// slug de STATUS_OPERACIONAL) e a tela Backlog. Qualquer outra página
// (Bases/BID, Métricas, Configurações, Usuários, Manutenção,
// Reconhecimento Lote, Dashboard etc.) é redirecionada pra /operacional
// — mesmo entrando pela URL direto. Isso é só a metade "página" da
// proteção: a metade "dado" (nunca devolver custo/BID) é reforçada no
// banco, ver migration 0035_cargo_allied.sql.
const SLUGS_OPERACIONAL_ALLIED = STATUS_OPERACIONAL.map((s) => s.slug);

// chamadas de API que ALLIED pode fazer: o botão "Exportar backlog" da
// tela Backlog (sem nenhuma coluna de custo), o download de uma versão
// do Relatório BID já marcada como enviada (a própria rota confere de
// novo que aquele id está mesmo marcado como enviado antes de
// responder — ver .../relatorio/[id]/download/route.ts), e agora
// também o histórico "Modelo de Retorno" (pedido explícito — só venda
// de peça/mão de obra, nunca custo/BID, ver lib/modeloRetorno.ts): a
// listagem (GET) e o download de uma planilha específica (GET). O POST
// dessa mesma rota de listagem (registrar uma nova emissão) continua de
// fora — a própria rota confere de novo, no servidor, que só quem já
// lança NF pode gravar, então nem precisa constar aqui.
// "/api/auth/marcar-login" e "/api/auth/heartbeat" (migration 0058):
// ALLIED também é rastreado (login/atividade) e também é deslogado
// sozinho depois de 1h parado (pedido explícito) — só a LISTAGEM
// "/api/usuarios/online" é que fica de fora pra esse cargo, então nem
// entra nessa lista.
// "/api/operacional/contra-propostas" (migration 0060, GET listagem) e o
// download de uma geração específica (GET) — mesmo esquema do Modelo de
// Retorno: só a leitura do histórico da planilha FINAL (já sem
// custo/BID), nunca o detalhe peça a peça de Ag. Contra Proposta (esse
// continua bloqueado pro ALLIED, ver PainelContraProposta.tsx).
const APIS_PERMITIDAS_ALLIED = [
  "/api/operacional/backlog/exportar-allied",
  "/api/operacional/modelo-retorno",
  "/api/operacional/contra-propostas",
  "/api/auth/marcar-login",
  "/api/auth/heartbeat",
];
const REGEX_API_DOWNLOAD_BID_ALLIED = /^\/api\/bases\/bid\/relatorio\/[^/]+\/download$/;
const REGEX_API_DOWNLOAD_MODELO_RETORNO_ALLIED = /^\/api\/operacional\/modelo-retorno\/[^/]+\/download$/;
const REGEX_API_DOWNLOAD_CONTRA_PROPOSTAS_ALLIED = /^\/api\/operacional\/contra-propostas\/[^/]+\/download$/;

function apiPermitidaParaAllied(path: string): boolean {
  return (
    APIS_PERMITIDAS_ALLIED.includes(path) ||
    REGEX_API_DOWNLOAD_BID_ALLIED.test(path) ||
    REGEX_API_DOWNLOAD_MODELO_RETORNO_ALLIED.test(path) ||
    REGEX_API_DOWNLOAD_CONTRA_PROPOSTAS_ALLIED.test(path)
  );
}

// páginas de Métricas liberadas pro ALLIED (pedido explícito) — só a
// capa (/metricas, com os cards) e essas 2 telas; R-TAT, OQC e Previsão
// de Recebimento continuam de fora mesmo entrando pela URL direto.
const ROTAS_METRICAS_ALLIED = ["/metricas", "/metricas/volumetria", "/metricas/orcamentos"];

// menu "BID" liberado pro ALLIED (pedido explícito) — só essa tela de
// consulta (versões já marcadas como enviadas); o resto de Bases/BID
// continua de fora mesmo entrando pela URL direto.
const ROTA_BID_ALLIED = "/bases/bid/versoes-enviadas";

function rotaPermitidaParaAllied(path: string): boolean {
  if (path === "/operacional") return true;
  if (path === "/operacional/backlog" || path.startsWith("/operacional/backlog/")) return true;
  if (path === "/operacional/modelo-retorno" || path.startsWith("/operacional/modelo-retorno/")) return true;
  if (path === "/operacional/contra-propostas" || path.startsWith("/operacional/contra-propostas/")) return true;
  if (ROTAS_METRICAS_ALLIED.some((rota) => path === rota || path.startsWith(`${rota}/`))) return true;
  if (path === ROTA_BID_ALLIED || path.startsWith(`${ROTA_BID_ALLIED}/`)) return true;
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
 * - cargos restritos por etapa (Operacional e Triagem/OQC, sem
 *   is_master — ver operacionalRestrito em lib/usuarios.ts) -> Backlog,
 *   Reconhecimento Lote, Bases, Configurações e Sistema viram redirect
 *   pra /operacional, mesmo entrando pela URL direto.
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

  let perfil: { must_change_password: boolean; cargo: string; is_master: boolean } | null = null;
  if (user) {
    const { data } = await supabase
      .from("usuarios")
      .select("must_change_password, cargo, is_master")
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
      const apiPermitida = apiPermitidaParaAllied(path);

      if (path.startsWith("/api/") && !apiPermitida) {
        return NextResponse.json({ error: "Não permitido para este cargo." }, { status: 403 });
      }

      // a checagem de página abaixo não sabe nada sobre caminhos de API
      // (só reconhece /operacional e afins) — sem esse "OU apiPermitida",
      // até uma API já liberada acima (como o exportar do backlog) caía
      // nela e era redirecionada de volta pro Painel, sem nunca devolver
      // o arquivo.
      if (!apiPermitida && !rotaPermitidaParaAllied(path)) {
        const url = request.nextUrl.clone();
        url.pathname = "/operacional";
        url.search = "";
        return NextResponse.redirect(url);
      }
    }

    if (operacionalRestrito(perfil) && rotaBloqueadaParaOperacional(path)) {
      const url = request.nextUrl.clone();
      url.pathname = "/operacional";
      url.search = "";
      return NextResponse.redirect(url);
    }

    if (financeiroRestrito(perfil) && rotaBloqueadaParaFinanceiro(path)) {
      const url = request.nextUrl.clone();
      url.pathname = "/financeiro";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  // antes só excluía "logo-allied.png" por nome — o logo usado de
  // verdade no menu (logo-parceria-menu.png) não estava na lista, então
  // pra um login ALLIED cada pedido dessa imagem caía na checagem de
  // "página permitida" (que não sabe nada sobre arquivo estático),
  // levava um redirect pro /operacional, e o navegador recebia HTML no
  // lugar do PNG — o logo simplesmente não carregava, só pro cargo
  // ALLIED (outros cargos não passam por essa checagem). Trocado pra
  // excluir qualquer caminho terminado numa extensão de arquivo estático
  // comum, em vez de ter que listar cada imagem uma por uma.
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)",
  ],
};
