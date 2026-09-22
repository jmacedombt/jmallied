import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeConfirmarAprovacaoOrcamento } from "@/lib/orcamentos";
import { isAllied } from "@/lib/usuarios";
import { montarPlanilhaOrcamentos, type LinhaPlanilhaOrcamento } from "@/lib/email";

// Baixa de novo (remontando, não guardando o arquivo — mesmo princípio do
// Modelo de Retorno) uma planilha "Contra Propostas" já gerada, a partir
// do snapshot das linhas salvo na hora — sai idêntica à que foi baixada
// originalmente.
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: perfil } = await admin.from("usuarios").select("cargo, is_master").eq("id", user.id).single();

  if (!podeConfirmarAprovacaoOrcamento(perfil) && !isAllied(perfil)) {
    return NextResponse.json(
      { error: "Seu cargo não tem permissão pra acessar o histórico de Contra Propostas." },
      { status: 403 }
    );
  }

  const { data: registro, error } = await admin
    .from("contra_proposta_geracoes")
    .select("nome_arquivo, dados")
    .eq("id", params.id)
    .single();

  if (error || !registro) {
    return NextResponse.json({ error: "Registro não encontrado." }, { status: 404 });
  }

  const dados = registro.dados as { linhas: LinhaPlanilhaOrcamento[] };
  const buffer = montarPlanilhaOrcamentos(dados.linhas ?? []);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${registro.nome_arquivo}"`,
      "Cache-Control": "no-store",
    },
  });
}
