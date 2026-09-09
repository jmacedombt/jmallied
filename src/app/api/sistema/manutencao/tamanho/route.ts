import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeManutencaoBanco, type TamanhoTabela } from "@/lib/manutencao";

// Tamanho em disco (dados + índices) e estimativa de linhas de cada
// tabela do schema public — Sistema > Manutenção do Banco. Só leitura;
// a função SQL usa pg_catalog/pg_stat_user_tables (n_live_tup é
// estimativa do autovacuum, não count(*) exato).
export async function GET() {
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
    return NextResponse.json({ error: "Só um Administrador pode acessar a Manutenção do Banco." }, { status: 403 });
  }

  const { data, error } = await admin.rpc("manutencao_tamanho_tabelas");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ tabelas: (data ?? []) as TamanhoTabela[] });
}
