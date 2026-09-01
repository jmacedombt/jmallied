import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { calcularValorComMargem, podeImportarBid, type FaixaMarkup } from "@/lib/bid";

export const maxDuration = 60;
const TAMANHO_LOTE = 400;

type PecaExistente = {
  id: string;
  part_number: string;
  custo_peca_samsung: number | null;
  valor_com_margem: number | null;
};

function valoresDiferentes(a: number | null, b: number | null): boolean {
  if (a == null && b == null) return false;
  if (a == null || b == null) return true;
  return Math.abs(a - b) > 0.001;
}

// Refaz o cálculo de custo_peca_samsung/valor_com_margem de todas as
// peças do BID a partir da Base Peças e das faixas de markup atuais —
// sem precisar reimportar o arquivo. Usado depois de uma Base Peças
// nova ser importada. Toda mudança de valor entra no histórico.
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
    return NextResponse.json({ error: "Seu cargo não tem permissão para recalcular o BID." }, { status: 403 });
  }

  const [{ data: pecas }, { data: faixasBrutas }] = await Promise.all([
    admin.from("bid_pecas").select("id, part_number, custo_peca_samsung, valor_com_margem") as unknown as Promise<{
      data: PecaExistente[] | null;
    }>,
    admin.from("configuracoes_bid_markup").select("valor_min, valor_max, multiplicador").order("ordem", { ascending: true }),
  ]);

  if (!pecas || pecas.length === 0) {
    return NextResponse.json({ pecasVerificadas: 0, pecasAlteradas: 0 });
  }

  const faixas: FaixaMarkup[] = (
    (faixasBrutas ?? []) as { valor_min: number; valor_max: number | null; multiplicador: number }[]
  ).map((f) => ({
    valor_min: Number(f.valor_min),
    valor_max: f.valor_max == null ? null : Number(f.valor_max),
    multiplicador: Number(f.multiplicador),
  }));

  const partNumbersUnicos = Array.from(new Set(pecas.map((p) => p.part_number)));
  const custosPorPartNumber = new Map<string, number>();
  for (let i = 0; i < partNumbersUnicos.length; i += TAMANHO_LOTE) {
    const lote = partNumbersUnicos.slice(i, i + TAMANHO_LOTE);
    const { data } = await admin.from("pecas_vigentes").select("codigo, valor_unitario").in("codigo", lote);
    for (const linha of data ?? []) custosPorPartNumber.set(linha.codigo, Number(linha.valor_unitario));
  }

  const atualizacoes: { id: string; custo_peca_samsung: number | null; valor_com_margem: number | null }[] = [];
  const historico: Record<string, unknown>[] = [];

  for (const peca of pecas) {
    const custoSamsung = custosPorPartNumber.get(peca.part_number) ?? null;
    const valorComMargem = custoSamsung != null ? calcularValorComMargem(custoSamsung, faixas) : null;

    const mudou =
      valoresDiferentes(peca.custo_peca_samsung, custoSamsung) ||
      valoresDiferentes(peca.valor_com_margem, valorComMargem);

    if (!mudou) continue;

    atualizacoes.push({ id: peca.id, custo_peca_samsung: custoSamsung, valor_com_margem: valorComMargem });
    historico.push({
      bid_peca_id: peca.id,
      custo_peca_samsung_anterior: peca.custo_peca_samsung,
      custo_peca_samsung_novo: custoSamsung,
      valor_com_margem_anterior: peca.valor_com_margem,
      valor_com_margem_novo: valorComMargem,
      origem: "recalculo",
      alterado_por: user.id,
    });
  }

  for (const item of atualizacoes) {
    await admin
      .from("bid_pecas")
      .update({
        custo_peca_samsung: item.custo_peca_samsung,
        valor_com_margem: item.valor_com_margem,
        custo_peca_allied: item.valor_com_margem,
      })
      .eq("id", item.id);
  }

  for (let i = 0; i < historico.length; i += TAMANHO_LOTE) {
    await admin.from("bid_historico_valores").insert(historico.slice(i, i + TAMANHO_LOTE));
  }

  return NextResponse.json({ pecasVerificadas: pecas.length, pecasAlteradas: atualizacoes.length });
}
