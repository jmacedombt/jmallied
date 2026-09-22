import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeLancarNfProdutoEntregue } from "@/lib/orcamentos";
import { isAllied } from "@/lib/usuarios";
import { gerarBufferModeloRetorno, type SnapshotModeloRetorno } from "@/lib/modeloRetorno";

const RETENCAO_DIAS = 60;

function corteRetencaoIso(): string {
  return new Date(Date.now() - RETENCAO_DIAS * 24 * 60 * 60 * 1000).toISOString();
}

// Baixa de novo (remontando, não guardando o arquivo — ver migration
// 0049) uma planilha "Modelo de Retorno" já emitida, a partir do
// snapshot salvo na hora — sai idêntica à que foi baixada originalmente
// (mesma data/aba, ver data_referencia). Só dentro dos últimos 60 dias
// (mesmo filtro da listagem) — passado isso, o registro "some" mesmo
// que alguém tenha o link salvo.
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
  // ALLIED também pode baixar (pedido explícito) — a planilha só tem
  // venda de peça/mão de obra, nunca custo/BID.
  if (!podeLancarNfProdutoEntregue(perfil) && !isAllied(perfil)) {
    return NextResponse.json(
      { error: "Seu cargo não tem permissão pra acessar o histórico de Modelo de Retorno." },
      { status: 403 }
    );
  }

  const { data: registro, error } = await admin
    .from("modelo_retorno_geracoes")
    .select("nome_arquivo, data_referencia, dados")
    .eq("id", params.id)
    .gte("gerado_em", corteRetencaoIso())
    .single();

  if (error || !registro) {
    return NextResponse.json(
      { error: "Registro não encontrado — pode já ter passado dos 60 dias de retenção." },
      { status: 404 }
    );
  }

  const dados = registro.dados as SnapshotModeloRetorno;
  const buffer = await gerarBufferModeloRetorno(
    dados.aprovados,
    dados.recusados,
    dados.solucoesPorPartNumber,
    registro.data_referencia
  );

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${registro.nome_arquivo}"`,
      "Cache-Control": "no-store",
    },
  });
}
