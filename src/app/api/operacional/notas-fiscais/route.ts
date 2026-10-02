import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { podeLancarNfProdutoEntregue, STATUS_PRODUTO_ENTREGUE } from "@/lib/orcamentos";

type LinhaOrcamentoNf = {
  nf_remessa_allied: string;
  nf_mao_de_obra_numero: string | null;
  nf_mao_de_obra_valor: number | null;
  nf_pecas_numero: string | null;
  nf_pecas_valor: number | null;
  nf_retorno_numero: string | null;
  nf_retorno_valor: number | null;
  status_operacional: string;
  updated_at: string;
};

export type GrupoNotaFiscal = {
  nfRemessa: string;
  quantidade: number;
  nfMaoDeObraNumero: string | null;
  nfMaoDeObraValor: number | null;
  nfPecasNumero: string | null;
  nfPecasValor: number | null;
  nfRetornoNumero: string | null;
  nfRetornoValor: number | null;
  situacao: "Produto Entregue" | "Em andamento";
  ultimaAtualizacao: string;
};

type Acumulador = Omit<GrupoNotaFiscal, "situacao"> & { todosProdutoEntregue: boolean };

async function autenticarEAutorizar() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { erro: NextResponse.json({ error: "Não autenticado." }, { status: 401 }) } as const;
  }

  const admin = createAdminClient();
  const { data: perfil } = await admin.from("usuarios").select("cargo, is_master").eq("id", user.id).single();
  // Sem o fallback ALLIED que "Modelo de Retorno" tem (ver
  // autenticarEAutorizar em api/operacional/modelo-retorno/route.ts) —
  // esse relatório expõe número/valor de NF Mão de Obra/Peças/Retorno,
  // que a Allied não precisa ver aqui (pedido explícito).
  if (!podeLancarNfProdutoEntregue(perfil)) {
    return {
      erro: NextResponse.json(
        { error: "Seu cargo não tem permissão pra acessar a Relação de Notas Fiscais." },
        { status: 403 }
      ),
    } as const;
  }

  return { admin } as const;
}

/** Tira vírgula e parênteses de um texto de busca livre antes de embutir
 * num filtro `.or()` do supabase-js — esse filtro é montado como uma
 * string "coluna.operador.valor" separada por vírgula, então uma vírgula
 * ou parêntese digitado pelo usuário quebraria o parser. */
function sanitizarBusca(busca: string): string {
  return busca.replace(/[(),]/g, "").trim();
}

// Lista, agrupado por NF Remessa, todo orçamento que já teve QUALQUER NF
// lançada (Mão de Obra, Peças ou Retorno) em Ag. Emissão de Nota Fiscal —
// pedido explícito: "relação de notas fiscais que foram emitidas". Não
// filtra pelo status_operacional atual (um lote continua aparecendo aqui
// mesmo depois de ir pra "Produto Entregue") — só exige que pelo menos
// um dos 3 números esteja preenchido.
//
// `busca` filtra por NF Remessa ou por qualquer um dos 3 números de NF;
// `dataInicio`/`dataFim` (aaaa-mm-dd) filtram pelo updated_at do
// orçamento — a única data que existe pra isso no banco, e só uma
// aproximação de "quando a NF foi lançada" (ver aviso na tela e o
// comentário na migration 0048: updated_at bumba com QUALQUER alteração
// na linha, não só o lançamento da NF).
export async function GET(request: Request) {
  const auth = await autenticarEAutorizar();
  if ("erro" in auth) return auth.erro;

  const { searchParams } = new URL(request.url);
  const busca = searchParams.get("busca")?.trim() || "";
  const dataInicio = searchParams.get("dataInicio") || "";
  const dataFim = searchParams.get("dataFim") || "";

  let query = auth.admin
    .from("orcamentos")
    .select(
      "nf_remessa_allied, nf_mao_de_obra_numero, nf_mao_de_obra_valor, nf_pecas_numero, nf_pecas_valor, nf_retorno_numero, nf_retorno_valor, status_operacional, updated_at"
    )
    .or("nf_mao_de_obra_numero.not.is.null,nf_pecas_numero.not.is.null,nf_retorno_numero.not.is.null")
    .order("updated_at", { ascending: false })
    .limit(5000);

  const termoBusca = busca ? sanitizarBusca(busca) : "";
  if (termoBusca) {
    query = query.or(
      `nf_remessa_allied.ilike.%${termoBusca}%,nf_mao_de_obra_numero.ilike.%${termoBusca}%,nf_pecas_numero.ilike.%${termoBusca}%,nf_retorno_numero.ilike.%${termoBusca}%`
    );
  }
  // Fuso fixo (-03:00): Sistema Allied é só pro Brasil e o Brasil não
  // tem mais horário de verão desde 2019 — não precisa de conversão
  // dinâmica de fuso pra isso (ver lib/tempo.ts).
  if (dataInicio) query = query.gte("updated_at", `${dataInicio}T00:00:00-03:00`);
  if (dataFim) query = query.lte("updated_at", `${dataFim}T23:59:59-03:00`);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const linhas = (data ?? []) as LinhaOrcamentoNf[];

  // Já vem ordenado por updated_at desc — o primeiro valor não-nulo
  // encontrado em cada grupo é, por isso, também o mais recente.
  const mapa = new Map<string, Acumulador>();
  for (const linha of linhas) {
    const chave = linha.nf_remessa_allied || "—";
    const atual: Acumulador =
      mapa.get(chave) ??
      {
        nfRemessa: chave,
        quantidade: 0,
        nfMaoDeObraNumero: null,
        nfMaoDeObraValor: null,
        nfPecasNumero: null,
        nfPecasValor: null,
        nfRetornoNumero: null,
        nfRetornoValor: null,
        ultimaAtualizacao: linha.updated_at,
        todosProdutoEntregue: true,
      };

    atual.quantidade += 1;
    if (atual.nfMaoDeObraNumero == null && linha.nf_mao_de_obra_numero) {
      atual.nfMaoDeObraNumero = linha.nf_mao_de_obra_numero;
      atual.nfMaoDeObraValor = linha.nf_mao_de_obra_valor;
    }
    if (atual.nfPecasNumero == null && linha.nf_pecas_numero) {
      atual.nfPecasNumero = linha.nf_pecas_numero;
      atual.nfPecasValor = linha.nf_pecas_valor;
    }
    if (atual.nfRetornoNumero == null && linha.nf_retorno_numero) {
      atual.nfRetornoNumero = linha.nf_retorno_numero;
      atual.nfRetornoValor = linha.nf_retorno_valor;
    }
    if (linha.status_operacional !== STATUS_PRODUTO_ENTREGUE) atual.todosProdutoEntregue = false;
    mapa.set(chave, atual);
  }

  const grupos: GrupoNotaFiscal[] = Array.from(mapa.values()).map(({ todosProdutoEntregue, ...resto }) => ({
    ...resto,
    situacao: todosProdutoEntregue ? "Produto Entregue" : "Em andamento",
  }));

  return NextResponse.json({ grupos });
}
