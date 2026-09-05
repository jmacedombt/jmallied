import Link from "next/link";
import { AlertTriangle, Database, FileSpreadsheet, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import ImportarBidForm from "@/components/ImportarBidForm";
import TabelaBidPecas, { type PecaBid } from "@/components/TabelaBidPecas";
import { podeImportarBid, type FaixaMarkup } from "@/lib/bid";

const PAGINA_TAMANHO = 50;

export default async function BidPage({ searchParams }: { searchParams: { busca?: string; pagina?: string } }) {
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

  const busca = (searchParams.busca ?? "").trim();
  const pagina = Math.max(1, Number(searchParams.pagina ?? "1") || 1);

  let query = supabase
    .from("bid_pecas")
    .select(
      "id, modelo, part_number, custo_peca_samsung, valor_com_margem, custo_peca_allied, valor_imposto, mao_de_obra, travado, valor_atualizado_em, valor_direcao, bid_solucoes(id, peca_solucao, principal)",
      { count: "exact" }
    );

  if (busca) {
    query = query.or(`modelo.ilike.%${busca}%,part_number.ilike.%${busca}%`);
  }

  const inicio = (pagina - 1) * PAGINA_TAMANHO;
  const { data: pecas, count } = await query
    .order("modelo", { ascending: true })
    .order("part_number", { ascending: true })
    .range(inicio, inicio + PAGINA_TAMANHO - 1)
    .returns<PecaBid[]>();

  const [{ count: totalPecas }, { count: totalPendentes }, { data: faixasBrutas }, { data: configImposto }] = await Promise.all([
    supabase.from("bid_pecas").select("id", { count: "exact", head: true }),
    supabase.from("bid_pecas").select("id", { count: "exact", head: true }).is("custo_peca_samsung", null),
    supabase.from("configuracoes_bid_markup").select("valor_min, valor_max, multiplicador").order("ordem", { ascending: true }),
    supabase.from("configuracoes_impostos").select("icms_percentual").eq("id", 1).single(),
  ]);

  const faixas: FaixaMarkup[] = (faixasBrutas ?? []).map((f) => ({
    valor_min: Number(f.valor_min),
    valor_max: f.valor_max == null ? null : Number(f.valor_max),
    multiplicador: Number(f.multiplicador),
  }));
  const icmsPercentual = Number(configImposto?.icms_percentual ?? 0);

  const totalPaginas = Math.max(1, Math.ceil((count ?? 0) / PAGINA_TAMANHO));

  const tituloInfo =
    "Tabela de preços de peças enviada pra Allied. O Custo Peça (Allied) é sempre recalculado a partir do custo mais recente da Base Peças e das faixas de markup configuradas.";

  return (
    <AppShell titulo="Base BID" tituloInfo={tituloInfo} perfil={perfil}>
      {/* altura fixa (viewport - cabeçalho do app) — só a tabela rola
          dentro dela, a página nunca cresce além do viewport, evitando
          a barra de rolagem dupla (da página + da tabela). */}
      <div className="flex flex-col" style={{ height: "calc(100vh - 112px)" }}>
      <div className="flex flex-wrap items-center gap-3 mb-4 shrink-0">
        {podeImportarBid(perfil) && <ImportarBidForm />}

        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs"
            style={{ background: "var(--surface)", borderColor: "var(--line)", color: "var(--ink)" }}
          >
            <Database size={13} style={{ color: "var(--muted)" }} />
            <strong>{totalPecas ?? 0}</strong> <span style={{ color: "var(--muted)" }}>peças no BID</span>
          </span>

          <Link
            href="/bases/bid/pendencias"
            className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition hover:border-amber-500/60"
            style={{
              background: "var(--surface)",
              borderColor: (totalPendentes ?? 0) > 0 ? "rgba(245,158,11,0.4)" : "var(--line)",
              color: (totalPendentes ?? 0) > 0 ? "#f59e0b" : "var(--ink)",
            }}
          >
            <AlertTriangle size={13} />
            <strong>{totalPendentes ?? 0}</strong> pendência(s)
          </Link>

          {podeImportarBid(perfil) && (
            <Link
              href="/bases/bid/relatorio"
              className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition hover:border-[var(--accent2)]"
              style={{ background: "var(--surface)", borderColor: "var(--line)", color: "var(--ink)" }}
            >
              <FileSpreadsheet size={13} />
              Relatório BID
            </Link>
          )}
        </div>
      </div>

      <form method="GET" className="mb-4 max-w-sm shrink-0">
        <div className="relative">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--muted)" }}
          />
          <input
            type="text"
            name="busca"
            defaultValue={busca}
            placeholder="Buscar por modelo ou Part Number..."
            className="w-full rounded-lg border pl-9 pr-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent2)] focus:ring-1 focus:ring-[var(--accent2)] transition bg-[var(--surface2)] border-[var(--line)]"
            style={{ color: "var(--ink)" }}
          />
        </div>
      </form>

      <div className="flex-1 min-h-0">
        <TabelaBidPecas pecas={pecas ?? []} faixas={faixas} icmsPercentual={icmsPercentual} />
      </div>

      {totalPaginas > 1 && (
        <div className="flex items-center gap-2 mt-4 text-sm shrink-0">
          {pagina > 1 && (
            <Link
              href={`/bases/bid?busca=${encodeURIComponent(busca)}&pagina=${pagina - 1}`}
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
              href={`/bases/bid?busca=${encodeURIComponent(busca)}&pagina=${pagina + 1}`}
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
