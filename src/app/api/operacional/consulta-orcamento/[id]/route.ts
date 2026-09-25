import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeConsultarOrcamento, isAllied } from "@/lib/usuarios";

// Todos os campos da "ficha" de um orçamento (pedido explícito,
// "Consulta/Alteração", migration 0070) — identificação, etapa atual,
// as 10 peças + 5 Add lançadas (código/custo), mão de obra, observação
// da reparadora e motivo de reprova (quando tiver). ALLIED nunca vê
// custo (mesma regra do resto do sistema — nem custo_peca_N nem os
// totais que dependem dele) — ver `campos` abaixo.
const CAMPOS_COMUNS = [
  "id",
  "nf_remessa_allied",
  "os_reparadora",
  "imei_reparadora",
  "atendimento",
  "os_care_allied",
  "trade_allied",
  "imei_allied",
  "classificacao_allied",
  "sku",
  "descricao_completa",
  "modelo_comercial",
  "status_operacional",
  "observacao_tecnica_reparadora",
  "motivo_reprova",
  "mao_de_obra",
  "peca_1", "peca_2", "peca_3", "peca_4", "peca_5",
  "peca_6", "peca_7", "peca_8", "peca_9", "peca_10",
  "peca_add_1", "peca_add_2", "peca_add_3", "peca_add_4", "peca_add_5",
].join(", ");

const CAMPOS_CUSTO = [
  "custo_peca_1", "custo_peca_2", "custo_peca_3", "custo_peca_4", "custo_peca_5",
  "custo_peca_6", "custo_peca_7", "custo_peca_8", "custo_peca_9", "custo_peca_10",
  "custo_peca_add_1", "custo_peca_add_2", "custo_peca_add_3", "custo_peca_add_4", "custo_peca_add_5",
  "valor_total_peca",
  "valor_total_reparo",
].join(", ");

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

  if (!podeConsultarOrcamento(perfil)) {
    return NextResponse.json({ error: "Seu cargo não tem permissão pra acessar essa tela." }, { status: 403 });
  }

  // ALLIED nunca recebe custo nenhum — nem no JSON de resposta, pra não
  // depender só da tela esconder a coluna (mesmo princípio já usado nas
  // outras rotas liberadas pro ALLIED, ver middleware.ts).
  const ehAllied = isAllied(perfil);
  const campos = ehAllied ? CAMPOS_COMUNS : `${CAMPOS_COMUNS}, ${CAMPOS_CUSTO}`;

  const { data, error } = await admin.from("orcamentos").select(campos).eq("id", params.id).single();

  if (error || !data) {
    return NextResponse.json({ error: "Orçamento não encontrado." }, { status: 404 });
  }

  return NextResponse.json({ orcamento: data });
}
