import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeImportarBid } from "@/lib/bid";

export const maxDuration = 60;
const LOTE_BUSCA = 1000;
const TAMANHO_LOTE_UPDATE = 400;

// "Marcar BID como enviado": ação explícita e separada do "Gerar
// relatório" (que continua podendo rodar livremente como rascunho).
// Congela, peça a peça, o valor de Custo Peça (Allied) atual em
// valor_enviado_cliente/em/por — a partir daqui, um Recalcular BID que
// mudaria o valor de alguma dessas peças passa a exigir confirmação
// explícita (ver /api/bases/bid/recalcular e bid_reconciliacoes).
export async function POST() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: perfil } = await admin.from("usuarios").select("cargo, is_master").eq("id", user.id).single();

  if (!podeImportarBid(perfil)) {
    return NextResponse.json({ error: "Seu cargo não tem permissão para marcar o BID como enviado." }, { status: 403 });
  }

  type PecaParaEnvio = { id: string; modelo: string; part_number: string; custo_peca_allied: number | null };
  const pecas: PecaParaEnvio[] = [];
  for (let inicio = 0; ; inicio += LOTE_BUSCA) {
    const { data, error } = (await admin
      .from("bid_pecas")
      .select("id, modelo, part_number, custo_peca_allied")
      .not("custo_peca_allied", "is", null)
      .range(inicio, inicio + LOTE_BUSCA - 1)) as unknown as { data: PecaParaEnvio[] | null; error: { message: string } | null };
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (!data || data.length === 0) break;
    pecas.push(...data);
    if (data.length < LOTE_BUSCA) break;
  }

  if (pecas.length === 0) {
    return NextResponse.json({ error: "Não há nenhuma peça com Custo Peça (Allied) calculado pra marcar como enviada." }, { status: 409 });
  }

  const agora = new Date().toISOString();

  // modelo/part_number entram junto mesmo já existindo: o Postgres exige
  // as colunas not null no payload do upsert pra validar a linha, mesmo
  // quando cai no caminho de UPDATE (onConflict "id" já garante que não
  // duplica nada) — mesmo padrão do recalcular.
  const atualizacoes = (pecas ?? []).map((p) => ({
    id: p.id,
    modelo: p.modelo,
    part_number: p.part_number,
    valor_enviado_cliente: p.custo_peca_allied,
    valor_enviado_em: agora,
    valor_enviado_por: user.id,
  }));

  for (let i = 0; i < atualizacoes.length; i += TAMANHO_LOTE_UPDATE) {
    const lote = atualizacoes.slice(i, i + TAMANHO_LOTE_UPDATE);
    const { error } = await admin.from("bid_pecas").upsert(lote, { onConflict: "id" });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  return NextResponse.json({ quantidadeMarcada: atualizacoes.length, enviadoEm: agora });
}
