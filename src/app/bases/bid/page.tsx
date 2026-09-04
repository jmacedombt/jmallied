import Link from "next/link";
import { AlertTriangle, FileSpreadsheet, Info } from "lucide-react";
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

  return (
    <AppShell titulo="Base BID" perfil={perfil}>
      <div className="flex items-center gap-2 mb-5">
        <p className="text-sm" style={{ color: "var(--ink)" }}>
          Tabela de preços de peças enviada pra Allied.
        </p>
        <div className="group relative inline-flex">
          <Info size={15} style={{ color: "var(--muted)" }} className="cursor-help" />
          <div
            className="pointer-events-none absolute left-0 top-6 z-20 hidden w-80 rounded-lg border p-3 text-xs shadow-2xl group-hover:block"
            style={{ background: "var(--surface2)", borderColor: "var(--line)", color: "var(--muted)" }}
          >
            O Custo Peça (Allied) é sempre recalculado a partir do custo mais recente da Base Peças e das faixas de
            markup configuradas.
          </div>
        </div>
      </div>

      {podeImportarBid(perfil) && (
        <div className="mb-6">
          <ImportarBidForm />
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border p-4" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
          <p className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--muted)" }}>
            Peças no BID
          </p>
          <p className="text-2xl font-semibold" style={{ color: "var(--ink)" }}>
            {totalPecas ?? 0}
          </p>
        </div>
        <Link
          href="/bases/bid/pendencias"
          className="rounded-xl border p-4 transition hover:border-amber-500/50"
          style={{ background: "var(--surface)", borderColor: "var(--line)" }}
        >
          <p className="text-xs uppercase tracking-wide mb-1 flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
            <AlertTriangle size={13} className="text-amber-500" /> Pendências BID
          </p>
          <p className="text-2xl font-semibold" style={{ color: (totalPendentes ?? 0) > 0 ? "#f59e0b" : "var(--ink)" }}>
            {totalPendentes ?? 0}
          </p>
        </Link>
        {podeImportarBid(perfil) && (
          <Link
            href="/bases/bid/relatorio"
            className="rounded-xl border p-4 transition hover:border-[var(--accent2)] flex flex-col justify-center"
            style={{ background: "var(--surface)", borderColor: "var(--line)" }}
          >
            <p className="text-xs uppercase tracking-wide mb-1 flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
              <FileSpreadsheet size={13} /> Relatório BID
            </p>
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              Exportar peças completas em Excel
            </p>
          </Link>
        )}
      </div>

      <form method="GET" className="mb-4 max-w-sm">
        <input
          type="text"
          name="busca"
          defaultValue={busca}
          placeholder="Buscar por modelo ou Part Number..."
          className="w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none focus:border-[var(--accent2)] focus:ring-1 focus:ring-[var(--accent2)] transition bg-[var(--surface2)] border-[var(--line)]"
          style={{ color: "var(--ink)" }}
        />
      </form>

      <TabelaBidPecas pecas={pecas ?? []} faixas={faixas} icmsPercentual={icmsPercentual} />

      {totalPaginas > 1 && (
        <div className="flex items-center gap-2 mt-4 text-sm">
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
    </AppShell>
  );
}
