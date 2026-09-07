import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeImportarBasePecas } from "@/lib/pecas";
import { dataDeHojeSaoPaulo } from "@/lib/tempo";
import { calcularCustoPecaAllied, direcaoValor, type FaixaMarkup } from "@/lib/bid";

// Cadastro manual de uma peça que ainda não tem custo na Base Peças —
// aberto a partir do pop-up de peças em Validação de Orçamentos quando um
// código do orçamento não é encontrado em pecas_vigentes. Grava como se
// fosse uma linha de compra importada (mesma tabela pecas_compras), então
// o valor passa a valer daí pra frente em qualquer lugar que use esse
// código (BID, outros orçamentos, etc.) — não fica restrito a esse
// orçamento.
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

  if (!podeImportarBasePecas(perfil)) {
    return NextResponse.json({ error: "Seu cargo não tem permissão para cadastrar peças na Base Peças." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const codigo = String(body?.codigo ?? "").trim();
  const valorUnitario = Number(body?.valor_unitario);
  const descricao = body?.descricao ? String(body.descricao).trim() : null;

  if (!codigo) {
    return NextResponse.json({ error: "Código da peça não informado." }, { status: 400 });
  }
  if (!Number.isFinite(valorUnitario) || valorUnitario <= 0) {
    return NextResponse.json({ error: "Informe um valor de custo válido." }, { status: 400 });
  }

  const { error } = await admin.from("pecas_compras").insert({
    codigo,
    descricao,
    data_compra: dataDeHojeSaoPaulo(),
    quantidade: 1,
    valor_total: valorUnitario,
    delivery: "CADASTRO MANUAL",
  });

  // colisão com uma linha idêntica já cadastrada hoje (mesmo código +
  // data + entrega + qtd + valor) não é erro de verdade — o valor já
  // está vigente, só não precisa duplicar a linha.
  if (error && error.code !== "23505") {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // esse código também alimenta o BID (custo_peca_samsung parte da Base
  // Peças): qualquer peça já cadastrada lá com esse mesmo Part Number, em
  // qualquer modelo, que NÃO esteja travada recalcula na hora com esse
  // custo novo — sem isso, a peça continuava "sem custo" no BID até
  // alguém rodar o recálculo em massa da tela Base BID, mesmo já tendo
  // custo aqui na Base Peças.
  type PecaBidExistente = {
    id: string;
    custo_peca_samsung: number | null;
    valor_com_margem: number | null;
    custo_peca_allied: number | null;
    valor_imposto: number | null;
    valor_atualizado_em: string;
    valor_direcao: "+" | "-" | null;
    travado: boolean;
  };

  const { data: pecasBid } = (await admin
    .from("bid_pecas")
    .select("id, custo_peca_samsung, valor_com_margem, custo_peca_allied, valor_imposto, valor_atualizado_em, valor_direcao, travado")
    .eq("part_number", codigo)) as unknown as { data: PecaBidExistente[] | null };

  const paraAtualizar = (pecasBid ?? []).filter((p) => !p.travado);

  if (paraAtualizar.length > 0) {
    const [{ data: faixasBrutas }, { data: configImposto }] = await Promise.all([
      admin.from("configuracoes_bid_markup").select("valor_min, valor_max, multiplicador").order("ordem", { ascending: true }),
      admin.from("configuracoes_impostos").select("icms_percentual").eq("id", 1).single(),
    ]);
    const faixas: FaixaMarkup[] = (
      (faixasBrutas ?? []) as { valor_min: number; valor_max: number | null; multiplicador: number }[]
    ).map((f) => ({
      valor_min: Number(f.valor_min),
      valor_max: f.valor_max == null ? null : Number(f.valor_max),
      multiplicador: Number(f.multiplicador),
    }));
    const icmsPercentual = Number(configImposto?.icms_percentual ?? 0);
    const resultado = calcularCustoPecaAllied(valorUnitario, faixas, icmsPercentual);

    if (resultado) {
      for (const peca of paraAtualizar) {
        const mudouValorFinal =
          peca.custo_peca_allied == null || Math.abs(peca.custo_peca_allied - resultado.custoPecaAllied) > 0.001;
        const valorAtualizadoEm = mudouValorFinal ? new Date().toISOString() : peca.valor_atualizado_em;
        const valorDirecao = mudouValorFinal ? direcaoValor(peca.custo_peca_allied, resultado.custoPecaAllied) : peca.valor_direcao;

        await admin
          .from("bid_pecas")
          .update({
            custo_peca_samsung: valorUnitario,
            valor_com_margem: resultado.valorComMargem,
            custo_peca_allied: resultado.custoPecaAllied,
            valor_imposto: resultado.valorImposto,
            valor_atualizado_em: valorAtualizadoEm,
            valor_direcao: valorDirecao,
          })
          .eq("id", peca.id);

        await admin.from("bid_historico_valores").insert({
          bid_peca_id: peca.id,
          custo_peca_samsung_anterior: peca.custo_peca_samsung,
          custo_peca_samsung_novo: valorUnitario,
          valor_com_margem_anterior: peca.valor_com_margem,
          valor_com_margem_novo: resultado.valorComMargem,
          custo_peca_allied_anterior: peca.custo_peca_allied,
          custo_peca_allied_novo: resultado.custoPecaAllied,
          valor_imposto_anterior: peca.valor_imposto,
          valor_imposto_novo: resultado.valorImposto,
          origem: "recalculo",
          alterado_por: user.id,
        });
      }
    }
  }

  return NextResponse.json({ ok: true, codigo, valor_unitario: valorUnitario });
}
