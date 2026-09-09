import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeManutencaoBanco, type LinhaCompactacao } from "@/lib/manutencao";

// Apaga registros de histórico/log mais antigos que N meses (nunca dado
// operacional/mestre) e roda ANALYZE nas tabelas mexidas — Sistema >
// Manutenção do Banco. Ver comentário da função manutencao_compactar_
// historico (migration 0030) pra lista exata de tabelas e por que não
// dá pra rodar VACUUM de verdade por aqui (Postgres não deixa VACUUM ser
// chamado de dentro de uma function — só o autovacuum do Supabase faz
// isso, automaticamente, em segundo plano).
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
    return NextResponse.json({ error: "Só um Administrador pode rodar a compactação." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const meses = Number(body?.meses);

  if (!Number.isFinite(meses) || meses < 1) {
    return NextResponse.json({ error: "Informe um prazo válido (mínimo 1 mês)." }, { status: 400 });
  }

  const { data, error } = await admin.rpc("manutencao_compactar_historico", { p_meses: Math.floor(meses) });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ resultados: (data ?? []) as LinhaCompactacao[] });
}
