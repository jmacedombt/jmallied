import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const PAGINA_TAMANHO = 100;

// Detalhe de um recálculo específico do BID: peça a peça, o valor que
// era e o valor que passou a ser (Custo Peça Samsung, Valor com Margem,
// Custo Peça Allied) — aberto ao clicar num item da lista de "Ver
// histórico de recálculos" na tela Base BID.
export async function GET(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const pagina = Math.max(1, Number(searchParams.get("pagina") ?? "1") || 1);
  const inicio = (pagina - 1) * PAGINA_TAMANHO;

  const [{ data: recalculo, error: erroRecalculo }, { data: pecas, count, error: erroPecas }] = await Promise.all([
    supabase
      .from("bid_recalculos")
      .select("id, executado_em, pecas_verificadas, pecas_alteradas, usuarios:executado_por (nome, sobrenome)")
      .eq("id", params.id)
      .maybeSingle(),
    supabase
      .from("bid_historico_valores")
      .select(
        "id, custo_peca_samsung_anterior, custo_peca_samsung_novo, valor_com_margem_anterior, valor_com_margem_novo, custo_peca_allied_anterior, custo_peca_allied_novo, valor_imposto_anterior, valor_imposto_novo, bid_pecas:bid_peca_id (modelo, part_number)",
        { count: "exact" }
      )
      .eq("recalculo_id", params.id)
      .order("id", { ascending: true })
      .range(inicio, inicio + PAGINA_TAMANHO - 1),
  ]);

  if (erroRecalculo) {
    return NextResponse.json({ error: erroRecalculo.message }, { status: 400 });
  }
  if (!recalculo) {
    return NextResponse.json({ error: "Recálculo não encontrado." }, { status: 404 });
  }
  if (erroPecas) {
    return NextResponse.json({ error: erroPecas.message }, { status: 400 });
  }

  return NextResponse.json({
    recalculo,
    pecas: pecas ?? [],
    total: count ?? 0,
    pagina,
    totalPaginas: Math.max(1, Math.ceil((count ?? 0) / PAGINA_TAMANHO)),
  });
}
