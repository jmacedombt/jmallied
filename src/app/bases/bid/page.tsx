import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import ImportarBidForm from "@/components/ImportarBidForm";
import TabelaBidPecas, { type PecaBid } from "@/components/TabelaBidPecas";
import { podeImportarBid } from "@/lib/bid";

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
      "id, modelo, part_number, custo_peca_samsung, custo_peca_allied, mao_de_obra, bid_solucoes(id, peca_solucao, principal)",
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

  const [{ count: totalPecas }, { count: totalPendentes }] = await Promise.all([
    supabase.from("bid_pecas").select("id", { count: "exact", head: true }),
    supabase.from("bid_pecas").select("id", { count: "exact", head: true }).is("custo_peca_samsung", null),
  ]);

  const totalPaginas = Math.max(1, Math.ceil((count ?? 0) / PAGINA_TAMANHO));

  return (
    <AppShell titulo="BID" perfil={perfil}>
      <p className="text-sm mb-5" style={{ color: "var(--muted)" }}>
        Tabela de preços de peças enviada pra Allied. O Custo Peça (Allied) é sempre recalculado a partir do custo
        mais recente da Base Peças e das faixas de markup configuradas.
      </p>

      {podeImportarBid(perfil) && (
        <div className="mb-6">
          <ImportarBidForm />
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
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

      <TabelaBidPecas pecas={pecas ?? []} />

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
