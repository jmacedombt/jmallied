import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeLancarNfProdutoEntregue, STATUS_AG_NF_SERVICO_VENDA_RETORNO } from "@/lib/orcamentos";

const TAMANHO_LOTE = 400;

// "Enviar para Produto Entregue" do bloco Aprovados de "Ag. Emissão de
// Nota Fiscal" (quem veio de "7 - Reparo Finalizado") — só move quem
// ainda estiver de fato em STATUS_AG_NF_SERVICO_VENDA_RETORNO e já tiver
// as 3 NFs lançadas (Mão de Obra + Peças, iguais pra todo o bloco, e
// Retorno, próprio de cada NF Remessa — ver PainelAgEmissaoNf.tsx).
// Confere de novo no servidor (não confia só na trava do botão no
// navegador) antes de mudar o status.
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

  if (!podeLancarNfProdutoEntregue(perfil)) {
    return NextResponse.json({ error: "Seu cargo não tem permissão pra enviar pra Produto Entregue." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const ids: string[] = Array.isArray(body?.ids) ? body.ids.filter((id: unknown) => typeof id === "string") : [];

  if (ids.length === 0) {
    return NextResponse.json({ error: "Selecione ao menos um aparelho." }, { status: 400 });
  }

  const { data: pendentes, error: erroConferencia } = await admin
    .from("orcamentos")
    .select("id, nf_mao_de_obra_numero, nf_pecas_numero, nf_retorno_numero")
    .in("id", ids)
    .eq("status_operacional", STATUS_AG_NF_SERVICO_VENDA_RETORNO);

  if (erroConferencia) {
    return NextResponse.json({ error: erroConferencia.message }, { status: 400 });
  }

  const semNf = (pendentes ?? []).find(
    (a: { nf_mao_de_obra_numero: string | null; nf_pecas_numero: string | null; nf_retorno_numero: string | null }) =>
      !a.nf_mao_de_obra_numero || !a.nf_pecas_numero || !a.nf_retorno_numero
  );
  if (semNf) {
    return NextResponse.json(
      { error: "Ainda tem aparelho sem NF Mão de Obra, NF Peças ou NF Retorno lançada nesse lote." },
      { status: 400 }
    );
  }

  let movidos = 0;
  for (let i = 0; i < ids.length; i += TAMANHO_LOTE) {
    const lote = ids.slice(i, i + TAMANHO_LOTE);
    const { data, error } = await admin
      .from("orcamentos")
      .update({ status_operacional: "Produto Entregue" })
      .in("id", lote)
      .eq("status_operacional", STATUS_AG_NF_SERVICO_VENDA_RETORNO)
      .select("id");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    movidos += data?.length ?? 0;
  }

  return NextResponse.json({ ok: true, movidos });
}
