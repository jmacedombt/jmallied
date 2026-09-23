import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";

// Lista o histórico de cada arquivo de resultado (Upload aprovação de
// orçamentos) já subido em "3 - Ag. Resposta de Orçamento" — mesmo
// princípio de "Orçamentos Enviados"/"Modelo de Retorno": qualquer
// usuário autenticado pode ver (o cargo ALLIED também, pedido
// explícito), já que o resumo não traz custo/BID, só quantidade e
// percentual por resultado.
export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("orcamento_aprovacoes_uploads")
    .select(
      "id, nome_arquivo, arquivo_path, enviado_em, linhas_no_arquivo, linhas_nao_reconhecidas, casadas, nao_encontradas, aprovados, contra_proposta, reprovados, resumo_por_nf, usuarios:enviado_por (nome, sobrenome)"
    )
    .order("enviado_em", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ uploads: data ?? [] });
}
