import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeManutencaoBanco, PALAVRA_CONFIRMACAO_ZERAR, type GrupoZerar } from "@/lib/manutencao";

const FUNCAO_POR_GRUPO: Record<GrupoZerar, string> = {
  pecas: "manutencao_zerar_pecas",
  gspn: "manutencao_zerar_gspn",
  orcamentos: "manutencao_zerar_orcamentos",
};

// Zera POR COMPLETO um dos três grupos de dados de implantação (Peças,
// GSPN ou Orçamentos) — Sistema > Manutenção do Banco. Nunca mexe em
// usuarios nem configuracoes_* (ver migration 0030_manutencao_banco.sql
// pra ordem exata de delete de cada grupo, pensada pra nunca esbarrar
// numa FK). Exige digitar a palavra de confirmação certinha — sem isso,
// nem chega a chamar a função SQL.
export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: perfil } = await admin.from("usuarios").select("cargo, is_master").eq("id", user.id).single();

  if (!podeManutencaoBanco(perfil)) {
    return NextResponse.json({ error: "Só um Administrador pode zerar dados do sistema." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const grupo = body?.grupo as GrupoZerar | undefined;
  const confirmacao = String(body?.confirmacao ?? "").trim();

  if (!grupo || !FUNCAO_POR_GRUPO[grupo]) {
    return NextResponse.json({ error: "Grupo inválido." }, { status: 400 });
  }

  if (confirmacao !== PALAVRA_CONFIRMACAO_ZERAR) {
    return NextResponse.json(
      { error: `Digite exatamente "${PALAVRA_CONFIRMACAO_ZERAR}" pra confirmar — nada foi apagado.` },
      { status: 400 }
    );
  }

  const { error } = await admin.rpc(FUNCAO_POR_GRUPO[grupo]);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, grupo });
}
