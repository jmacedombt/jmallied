import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeManutencaoBanco, type TamanhoTabela } from "@/lib/manutencao";

// Configurações > Monitoramento (pedido explícito, 07/11/2026). Só leitura:
// uso do Supabase (migration 0085), maiores tabelas, dados públicos do
// repositório no GitHub e informações do deploy atual na Vercel. Nenhuma
// chave/token é exposta na resposta.
const REPO_GITHUB = "jmacedombt/jmallied";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const admin = createAdminClient();
  const { data: perfil } = await admin.from("usuarios").select("cargo, is_master").eq("id", user.id).single();
  if (!podeManutencaoBanco(perfil)) {
    return NextResponse.json({ error: "Só um Administrador pode acessar o Monitoramento." }, { status: 403 });
  }

  const [uso, tabelas, github] = await Promise.all([
    admin.rpc("monitoramento_supabase_uso"),
    admin.rpc("manutencao_tamanho_tabelas"),
    buscarGithub(),
  ]);

  // referência do projeto (parte pública da URL do Supabase) — só pra
  // montar o link do painel do Supabase
  let refSupabase: string | null = null;
  try {
    refSupabase = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname.split(".")[0] || null;
  } catch {
    refSupabase = null;
  }

  return NextResponse.json({
    geradoEm: new Date().toISOString(),
    supabase: {
      ref: refSupabase,
      uso: uso.error ? null : uso.data,
      erro: uso.error ? uso.error.message : null,
      maioresTabelas: ((tabelas.data ?? []) as TamanhoTabela[]).slice(0, 8),
    },
    vercel: {
      ambiente: process.env.VERCEL_ENV ?? null,
      regiao: process.env.VERCEL_REGION ?? null,
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      mensagemCommit: process.env.VERCEL_GIT_COMMIT_MESSAGE ?? null,
      url: process.env.VERCEL_PROJECT_PRODUCTION_URL ?? null,
    },
    github,
  });
}

async function buscarGithub() {
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO_GITHUB}`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "sistema-allied" },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 404) return { repo: REPO_GITHUB, privado: true, tamanhoKb: null, atualizadoEm: null, erro: null };
    if (!res.ok) return { repo: REPO_GITHUB, privado: null, tamanhoKb: null, atualizadoEm: null, erro: `GitHub respondeu ${res.status}` };
    const d = (await res.json()) as { size?: number; private?: boolean; pushed_at?: string };
    return { repo: REPO_GITHUB, privado: !!d.private, tamanhoKb: d.size ?? null, atualizadoEm: d.pushed_at ?? null, erro: null };
  } catch {
    return { repo: REPO_GITHUB, privado: null, tamanhoKb: null, atualizadoEm: null, erro: "Não foi possível consultar o GitHub agora." };
  }
}
