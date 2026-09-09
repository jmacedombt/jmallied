import Link from "next/link";
import { AlertTriangle, ArrowLeft, Info } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import TabelaBidPecas, { type PecaBid } from "@/components/TabelaBidPecas";
import BotaoResumoPrioridadeBid from "@/components/BotaoResumoPrioridadeBid";
import { pecasReferenciadasEmOrcamentosAbertos, podeImportarBid, type FaixaMarkup } from "@/lib/bid";

const PAGINA_TAMANHO = 50;
const LOTE_BUSCA = 1000;

export default async function PendenciasBidPage({
  searchParams,
}: {
  searchParams: { pagina?: string; partNumber?: string; modelo?: string; prioridade?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let perfil: { nome: string; sobrenome: string; cargo: string; is_master: boolean } | null = null;
  if (user) {
    const { data } = await supabase
      .from("usuarios")
      .select("nome, sobrenome, cargo, is_master")
      .eq("id", user.id)
      .single();
    perfil = data;
  }

  const buscaPartNumber = (searchParams.partNumber ?? "").trim();
  const buscaModelo = (searchParams.modelo ?? "").trim();
  const somentePrioridade = searchParams.prioridade === "1";
  const pagina = Math.max(1, Number(searchParams.pagina ?? "1") || 1);

  // busca todas as pendências (não só a página atual) pra poder ordenar
  // prioridade (peça referenciada por pedido em aberto) primeiro, e só
  // depois fatiar a página — a base de pendências é pequena o bastante
  // (ordem de milhares) pra isso caber tranquilo numa única viagem.
  let query = supabase
    .from("bid_pecas")
    .select(
      "id, modelo, part_number, custo_peca_samsung, valor_com_margem, custo_peca_allied, valor_imposto, mao_de_obra, travado, valor_atualizado_em, valor_direcao, bid_solucoes(id, peca_solucao, principal)"
    )
    .is("custo_peca_samsung", null);

  if (buscaPartNumber) query = query.ilike("part_number", `%${buscaPartNumber}%`);
  if (buscaModelo) query = query.ilike("modelo", `%${buscaModelo}%`);

  const todasPendentes: PecaBid[] = [];
  for (let inicio = 0; ; inicio += LOTE_BUSCA) {
    const { data, error } = await query
      .order("modelo", { ascending: true })
      .order("part_number", { ascending: true })
      .range(inicio, inicio + LOTE_BUSCA - 1)
      .returns<PecaBid[]>();
    if (error || !data || data.length === 0) break;
    todasPendentes.push(...data);
    if (data.length < LOTE_BUSCA) break;
  }

  const [{ data: faixasBrutas }, { data: configImposto }, mapaReferenciados] = await Promise.all([
    supabase.from("configuracoes_bid_markup").select("valor_min, valor_max, multiplicador").order("ordem", { ascending: true }),
    supabase.from("configuracoes_impostos").select("icms_percentual").eq("id", 1).single(),
    pecasReferenciadasEmOrcamentosAbertos(supabase),
  ]);

  const faixas: FaixaMarkup[] = (faixasBrutas ?? []).map((f) => ({
    valor_min: Number(f.valor_min),
    valor_max: f.valor_max == null ? null : Number(f.valor_max),
    multiplicador: Number(f.multiplicador),
  }));
  const icmsPercentual = Number(configImposto?.icms_percentual ?? 0);

  const partNumbersPrioritarios = new Set(mapaReferenciados.keys());

  // peças referenciadas por orçamento em aberto que nem chegaram a ter
  // UMA linha no BID ainda (nenhum cadastro, nem pendente) — sem isso
  // ficavam completamente fora dessa tela, mesmo sendo o caso mais
  // urgente de pendência que existe (a pessoa nem sabe que precisa
  // cadastrar). Checa existência (qualquer custo, não só nulo) em lotes,
  // pra não montar um "in (...)" gigante numa lista grande de Part
  // Numbers.
  const todosReferenciados = Array.from(mapaReferenciados.keys());
  const partNumbersComLinhaNoBid = new Set<string>();
  const LOTE_EXISTENCIA = 400;
  for (let i = 0; i < todosReferenciados.length; i += LOTE_EXISTENCIA) {
    const lote = todosReferenciados.slice(i, i + LOTE_EXISTENCIA);
    const { data } = await supabase.from("bid_pecas").select("part_number").in("part_number", lote);
    for (const linha of (data ?? []) as { part_number: string }[]) partNumbersComLinhaNoBid.add(linha.part_number);
  }

  const pecasVirtuais: PecaBid[] = todosReferenciados
    .filter((pn) => !partNumbersComLinhaNoBid.has(pn))
    .sort((a, b) => (mapaReferenciados.get(a) ?? "").localeCompare(mapaReferenciados.get(b) ?? "") || a.localeCompare(b))
    .map((pn) => ({
      id: `virtual:${pn}`,
      modelo: mapaReferenciados.get(pn) ?? "",
      part_number: pn,
      custo_peca_samsung: null,
      valor_com_margem: null,
      custo_peca_allied: null,
      valor_imposto: null,
      mao_de_obra: null,
      travado: false,
      valor_atualizado_em: "",
      valor_direcao: null,
      bid_solucoes: [],
      virtual: true,
    }))
    // mesmos filtros de busca aplicados na query do BID acima — essas
    // peças nunca passaram pelo banco com esse filtro, então repete aqui.
    .filter((p) => (buscaPartNumber ? p.part_number.toLowerCase().includes(buscaPartNumber.toLowerCase()) : true))
    .filter((p) => (buscaModelo ? p.modelo.toLowerCase().includes(buscaModelo.toLowerCase()) : true));

  // prioridade primeiro (peça esperada por algum pedido em aberto agora),
  // depois ordem alfabética já aplicada na busca é preservada (sort é
  // estável) — dentro de cada grupo continua modelo/part number.
  const pendentesOrdenadas = [...todasPendentes, ...pecasVirtuais].sort((a, b) => {
    const prioridadeA = partNumbersPrioritarios.has(a.part_number) ? 0 : 1;
    const prioridadeB = partNumbersPrioritarios.has(b.part_number) ? 0 : 1;
    return prioridadeA - prioridadeB;
  });

  const pecasPrioritarias = pendentesOrdenadas.filter((p) => partNumbersPrioritarios.has(p.part_number));
  const totalPrioritarias = pecasPrioritarias.length;
  const podeCadastrar = podeImportarBid(perfil);

  // filtro "só prioridade" entra depois da ordenação e não mexe nos
  // totais do resumo acima (que sempre mostram o total geral) — só
  // reduz o que aparece na tabela/paginação abaixo.
  const pendentesFiltradas = somentePrioridade
    ? pendentesOrdenadas.filter((p) => partNumbersPrioritarios.has(p.part_number))
    : pendentesOrdenadas;

  const totalPaginas = Math.max(1, Math.ceil(pendentesFiltradas.length / PAGINA_TAMANHO));
  const inicioPagina = (pagina - 1) * PAGINA_TAMANHO;
  const pecasPagina = pendentesFiltradas.slice(inicioPagina, inicioPagina + PAGINA_TAMANHO);

  function linkComFiltros(novaPagina: number, prioridadeOverride: boolean = somentePrioridade) {
    const params = new URLSearchParams();
    if (buscaPartNumber) params.set("partNumber", buscaPartNumber);
    if (buscaModelo) params.set("modelo", buscaModelo);
    if (prioridadeOverride) params.set("prioridade", "1");
    params.set("pagina", String(novaPagina));
    return `/bases/bid/pendencias?${params.toString()}`;
  }

  return (
    <AppShell titulo="Pendências BID" perfil={perfil}>
      {/* altura fixa (viewport - cabeçalho do app) — só a tabela rola
          dentro dela, a página nunca cresce além do viewport, evitando
          a barra de rolagem dupla (da página + da tabela). */}
      <div className="flex flex-col" style={{ height: "calc(100vh - 112px)" }}>
      <Link
        href="/bases/bid"
        className="inline-flex items-center gap-1.5 text-xs hover:opacity-80 mb-3 shrink-0"
        style={{ color: "var(--muted)" }}
      >
        <ArrowLeft size={14} />
        Voltar para BID
      </Link>

      <div className="flex items-center gap-4 mb-3 flex-wrap shrink-0">
        <p className="text-sm" style={{ color: "var(--ink)" }}>
          <strong>{pendentesOrdenadas.length}</strong> peça(s) pendente(s)
          {totalPrioritarias > 0 && (
            <>
              {" "}
              — <strong style={{ color: "#ef4444" }}>{totalPrioritarias}</strong> em{" "}
              <span style={{ color: "#ef4444" }}>prioridade</span> (esperando pedido em aberto)
            </>
          )}
          .
        </p>

        <div className="group relative inline-flex">
          <Info size={15} style={{ color: "var(--muted)" }} className="cursor-help" />
          <div
            className="pointer-events-none absolute left-1/2 top-6 z-20 hidden w-72 -translate-x-1/2 rounded-lg border p-3 text-xs shadow-2xl group-hover:block"
            style={{ background: "var(--surface2)", borderColor: "var(--line)", color: "var(--muted)" }}
          >
            Peças do BID cujo Part Number ainda não foi encontrado na Base Peças — por isso não têm custo calculado —
            e peças usadas em algum orçamento em aberto que nem chegaram a ter cadastro no BID (marcadas em{" "}
            <strong style={{ color: "#f97316" }}>Sem cadastro</strong>). As do primeiro grupo somem automaticamente
            assim que o código aparecer numa importação da Base Peças (use o botão "Recalcular" na tela do BID depois
            de importar); as do segundo somem assim que alguém cadastrar a peça por aqui. As marcadas como{" "}
            <strong>Prioridade</strong> têm ao menos um pedido em aberto esperando o cadastro dessa peça.
          </div>
        </div>
      </div>

      <form method="GET" className="mb-4 flex gap-3 flex-wrap items-center shrink-0">
        <input
          type="text"
          name="partNumber"
          defaultValue={buscaPartNumber}
          placeholder="Buscar por Part Number..."
          className="w-full max-w-xs rounded-lg border px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent2)] focus:ring-1 focus:ring-[var(--accent2)] transition bg-[var(--surface2)] border-[var(--line)]"
          style={{ color: "var(--ink)" }}
        />
        <input
          type="text"
          name="modelo"
          defaultValue={buscaModelo}
          placeholder="Buscar por Modelo..."
          className="w-full max-w-xs rounded-lg border px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent2)] focus:ring-1 focus:ring-[var(--accent2)] transition bg-[var(--surface2)] border-[var(--line)]"
          style={{ color: "var(--ink)" }}
        />
        {somentePrioridade && <input type="hidden" name="prioridade" value="1" />}
        <button
          type="submit"
          className="rounded-lg border px-4 py-2.5 text-sm transition hover:border-[var(--accent2)]"
          style={{ borderColor: "var(--line)", color: "var(--ink)" }}
        >
          Buscar
        </button>

        <Link
          href={linkComFiltros(1, !somentePrioridade)}
          className="inline-flex items-center gap-1.5 rounded-lg border px-4 py-2.5 text-sm transition"
          style={
            somentePrioridade
              ? { borderColor: "#ef4444", background: "rgba(239, 68, 68, 0.12)", color: "#ef4444" }
              : { borderColor: "var(--line)", color: "var(--ink)" }
          }
          title="Mostrar só as peças com pedido em aberto esperando o cadastro"
        >
          <AlertTriangle size={15} />
          Só prioridade
        </Link>

        {(buscaPartNumber || buscaModelo || somentePrioridade) && (
          <Link
            href="/bases/bid/pendencias"
            className="inline-flex items-center text-sm px-2"
            style={{ color: "var(--muted)" }}
          >
            Limpar
          </Link>
        )}

        <BotaoResumoPrioridadeBid
          pecas={pecasPrioritarias.map((p) => ({ modelo: p.modelo, part_number: p.part_number }))}
        />
      </form>

      <div className="flex-1 min-h-0">
        <TabelaBidPecas
          pecas={pecasPagina}
          faixas={faixas}
          icmsPercentual={icmsPercentual}
          partNumbersPrioritarios={partNumbersPrioritarios}
          podeCadastrar={podeCadastrar}
        />
      </div>

      {totalPaginas > 1 && (
        <div className="flex items-center gap-2 mt-4 text-sm shrink-0">
          {pagina > 1 && (
            <Link
              href={linkComFiltros(pagina - 1)}
              className="rounded-lg border px-3 py-1.5 hover:border-[var(--accent2)] transition"
              style={{ borderColor: "var(--line)", color: "var(--ink)" }}
            >
              ← Anterior
            </Link>
          )}
          <span style={{ color: "var(--muted)" }}>
            Página {pagina} de {totalPaginas}
          </span>
          {pagina < totalPaginas && (
            <Link
              href={linkComFiltros(pagina + 1)}
              className="rounded-lg border px-3 py-1.5 hover:border-[var(--accent2)] transition"
              style={{ borderColor: "var(--line)", color: "var(--ink)" }}
            >
              Próxima →
            </Link>
          )}
        </div>
      )}
      </div>
    </AppShell>
  );
}
