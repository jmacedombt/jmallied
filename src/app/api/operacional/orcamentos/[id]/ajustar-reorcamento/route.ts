import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import {
  calcularDetalheReorcamento,
  STATUS_AG_RESPOSTA_REORCAMENTO,
  type ConfiguracaoMaoDeObra,
  type DetalheValidacaoOrcamento,
  type PecaAddEntrada,
} from "@/lib/orcamentos";
import { type FaixaMarkup } from "@/lib/bid";

const POSICOES_VALIDAS = ["Extra 1", "Extra 2", "Extra 3", "Extra 4", "Extra 5"];

// Ajuste manual das Peça Add / Custo Add de um reorçamento, em "4 - Ag.
// Resposta de Reorçamento" — só antes de mandar a planilha Complementar
// pra Allied (reorcamento_enviado_em ainda vazio). Depois de enviado
// fica travado: o Excel já saiu com esses valores, editar depois
// deixaria a tela diferente do que a Allied recebeu. Recalcula tudo do
// zero, igual o Reorçamento original ([id]/reorcamento/route.ts) —
// nunca confia no total calculado no navegador.
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const pecasBrutas = Array.isArray(body?.pecas) ? body.pecas : [];
  const pecas: PecaAddEntrada[] = [];
  for (const p of pecasBrutas) {
    const posicao = String(p?.posicao ?? "");
    const codigo = String(p?.codigo ?? "").trim();
    const custo = Number(p?.custo);

    if (!POSICOES_VALIDAS.includes(posicao)) {
      return NextResponse.json({ error: "Posição de peça adicional inválida." }, { status: 400 });
    }
    if (!codigo || !Number.isFinite(custo) || custo < 0) {
      return NextResponse.json({ error: "Preencha o código e o custo de cada peça adicional lançada." }, { status: 400 });
    }
    pecas.push({ posicao, codigo, custo });
  }

  if (pecas.length === 0) {
    return NextResponse.json({ error: "Lance pelo menos uma peça adicional." }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: atual, error: erroAtual } = await admin
    .from("orcamentos")
    .select("status_operacional, validacao_snapshot, reorcamento_detalhe, reorcamento_enviado_em")
    .eq("id", params.id)
    .single();

  if (erroAtual || !atual) {
    return NextResponse.json({ error: "Orçamento não encontrado." }, { status: 404 });
  }
  if (atual.status_operacional !== STATUS_AG_RESPOSTA_REORCAMENTO || !atual.reorcamento_detalhe) {
    return NextResponse.json({ error: "Esse orçamento não está com um reorçamento pendente nessa etapa." }, { status: 409 });
  }
  if (atual.reorcamento_enviado_em) {
    return NextResponse.json({ error: "Esse reorçamento já foi enviado pra Allied — não dá mais pra editar." }, { status: 409 });
  }

  const snapshotAtual = atual.validacao_snapshot as DetalheValidacaoOrcamento | null;
  if (!snapshotAtual) {
    return NextResponse.json({ error: "Esse orçamento não tem o cálculo original confirmado." }, { status: 409 });
  }

  const [{ data: configImposto }, { data: configMaoObraBruta }, { data: faixasMarkupBrutas }] = await Promise.all([
    admin.from("configuracoes_impostos").select("icms_percentual").eq("id", 1).single(),
    admin.from("configuracoes_mao_de_obra").select("valor_uma_peca, valor_mais_de_uma_peca").eq("id", 1).single(),
    admin.from("configuracoes_bid_markup").select("valor_min, valor_max, multiplicador").order("ordem", { ascending: true }),
  ]);

  const icmsPercentual = Number(configImposto?.icms_percentual ?? 0);
  const configMaoDeObra: Pick<ConfiguracaoMaoDeObra, "valor_uma_peca" | "valor_mais_de_uma_peca"> = {
    valor_uma_peca: Number(configMaoObraBruta?.valor_uma_peca ?? 0),
    valor_mais_de_uma_peca: Number(configMaoObraBruta?.valor_mais_de_uma_peca ?? 0),
  };
  const faixasMarkup: FaixaMarkup[] = (
    (faixasMarkupBrutas ?? []) as { valor_min: number; valor_max: number | null; multiplicador: number }[]
  ).map((f) => ({
    valor_min: Number(f.valor_min),
    valor_max: f.valor_max == null ? null : Number(f.valor_max),
    multiplicador: Number(f.multiplicador),
  }));

  const detalhe = calcularDetalheReorcamento(pecas, snapshotAtual, icmsPercentual, configMaoDeObra, faixasMarkup);

  const atualizacao: Record<string, unknown> = { reorcamento_detalhe: detalhe };
  for (let i = 1; i <= 5; i++) {
    const posicao = `Extra ${i}`;
    const lancada = pecas.find((p) => p.posicao === posicao);
    atualizacao[`peca_add_${i}`] = lancada?.codigo ?? null;
    atualizacao[`custo_peca_add_${i}`] = lancada?.custo ?? null;
  }

  const { error } = await admin.from("orcamentos").update(atualizacao).eq("id", params.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
