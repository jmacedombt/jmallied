import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeConfirmarAprovacaoOrcamento } from "@/lib/orcamentos";
import { isAllied } from "@/lib/usuarios";

// Lista o histórico de planilhas "Contra Propostas" já geradas (menu
// Operacional > Contra Propostas) — mais recente primeiro, sem limite de
// retenção (diferente de Modelo de Retorno). Só GET — o registro em si é
// feito automaticamente dentro de enviar-contra-proposta/route.ts, não
// existe um POST manual de "registrar emissão" aqui (diferente de
// modelo-retorno, que tem esse passo à parte).
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

  // ALLIED também pode ver o histórico (pedido explícito) — é justamente
  // onde a versão final das Contra Propostas fica disponível pra eles
  // depois que a equipe decide tudo.
  if (!podeConfirmarAprovacaoOrcamento(perfil) && !isAllied(perfil)) {
    return NextResponse.json(
      { error: "Seu cargo não tem permissão pra acessar o histórico de Contra Propostas." },
      { status: 403 }
    );
  }

  const { data, error } = await admin
    .from("contra_proposta_geracoes")
    .select(
      "id, gerado_em, nf_remessa_allied, quantidade_aprovados_iniciais, quantidade_contra_proposta_aceita, quantidade_reprovados, quantidade_ja_reprovados, nome_arquivo, usuarios:gerado_por (nome, sobrenome)"
    )
    .order("gerado_em", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ geracoes: data ?? [] });
}
