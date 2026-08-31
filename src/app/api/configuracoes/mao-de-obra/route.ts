import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeImportarOrcamentos } from "@/lib/orcamentos";

export async function PUT(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: perfil } = await admin.from("usuarios").select("cargo, is_master").eq("id", user.id).single();

  // mesmo grupo de cargos que pode importar as bases (Estoque, Supervisor, Gerente, Admin)
  if (!podeImportarOrcamentos(perfil)) {
    return NextResponse.json({ error: "Seu cargo não tem permissão para alterar essa configuração." }, { status: 403 });
  }

  const body = await request.json();
  const valorSemPeca = Number(body.valor_sem_peca);
  const valorUmaPeca = Number(body.valor_uma_peca);
  const valorMaisDeUmaPeca = Number(body.valor_mais_de_uma_peca);

  if (
    !Number.isFinite(valorSemPeca) || valorSemPeca < 0 ||
    !Number.isFinite(valorUmaPeca) || valorUmaPeca < 0 ||
    !Number.isFinite(valorMaisDeUmaPeca) || valorMaisDeUmaPeca < 0
  ) {
    return NextResponse.json({ error: "Informe valores numéricos válidos (maiores ou iguais a zero)." }, { status: 400 });
  }

  const { error } = await admin
    .from("configuracoes_mao_de_obra")
    .update({
      valor_sem_peca: valorSemPeca,
      valor_uma_peca: valorUmaPeca,
      valor_mais_de_uma_peca: valorMaisDeUmaPeca,
      atualizado_por: user.id,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
