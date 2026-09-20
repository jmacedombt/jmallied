import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeRetrocederProdutoEntregue, STATUS_DESTINO_RETROCEDER_PRODUTO_ENTREGUE } from "@/lib/orcamentos";

// Retrocede manualmente um orçamento que já está em "Produto Entregue"
// pra qualquer outro status do pipeline (pedido explícito) — usado
// quando a entrega foi lançada por engano ou precisa ser desfeita.
// Diferente do "Voltar Etapa" de Ag. Emissão de Nota Fiscal (que só
// desfaz um passo e só antes de qualquer NF ser lançada), aqui:
//  - só funciona a partir de "Produto Entregue" (não afeta as outras
//    etapas, que já têm sua própria trava de reprovar/avançar);
//  - deixa escolher QUALQUER status de destino (ver
//    STATUS_DESTINO_RETROCEDER_PRODUTO_ENTREGUE);
//  - sempre apaga os 3 pares de NF (Mão de Obra/Peças/Retorno) e a data
//    de exportação, já que o orçamento está saindo do "pacote" de NF
//    emitida — evita deixar NF "fantasma" gravada num orçamento que já
//    não está mais entregue.
// Restrito a Administrador (is_master) ou Gerente (mesma trava de
// podeVoltarEtapaAgEmissaoNf — ver PopupAtendimentoPecas.tsx).
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: perfil } = await admin.from("usuarios").select("cargo, is_master").eq("id", user.id).single();

  if (!podeRetrocederProdutoEntregue(perfil)) {
    return NextResponse.json({ error: "Só Administrador ou Gerente podem retroceder um orçamento entregue." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const statusDestino = typeof body?.status_operacional === "string" ? body.status_operacional : null;

  const destinoValido = STATUS_DESTINO_RETROCEDER_PRODUTO_ENTREGUE.some((s) => s.valor === statusDestino);
  if (!statusDestino || !destinoValido) {
    return NextResponse.json({ error: "Status de destino inválido." }, { status: 400 });
  }

  const { data: atual, error: erroAtual } = await admin
    .from("orcamentos")
    .select("status_operacional")
    .eq("id", params.id)
    .single();

  if (erroAtual || !atual) {
    return NextResponse.json({ error: "Orçamento não encontrado." }, { status: 404 });
  }

  if (atual.status_operacional !== "Produto Entregue") {
    return NextResponse.json({ error: "Esse orçamento não está em Produto Entregue — nada a retroceder." }, { status: 409 });
  }

  const { error } = await admin
    .from("orcamentos")
    .update({
      status_operacional: statusDestino,
      nf_mao_de_obra_numero: null,
      nf_mao_de_obra_valor: null,
      nf_pecas_numero: null,
      nf_pecas_valor: null,
      nf_retorno_numero: null,
      nf_retorno_valor: null,
      nf_exportado_em: null,
    })
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, status_operacional: statusDestino });
}
