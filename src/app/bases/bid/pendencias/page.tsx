import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import TabelaBidPecas, { type PecaBid } from "@/components/TabelaBidPecas";

const PAGINA_TAMANHO = 50;

export default async function PendenciasBidPage({ searchParams }: { searchParams: { pagina?: string } }) {
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

  const pagina = Math.max(1, Number(searchParams.pagina ?? "1") || 1);
  const inicio = (pagina - 1) * PAGINA_TAMANHO;

  const { data: pecas, count } = await supabase
    .from("bid_pecas")
    .select(
      "id, modelo, part_number, custo_peca_samsung, custo_peca_allied, mao_de_obra, bid_solucoes(id, peca_solucao, principal)",
      { count: "exact" }
    )
    .is("custo_peca_samsung", null)
    .order("modelo", { ascending: true })
    .order("part_number", { ascending: true })
    .range(inicio, inicio + PAGINA_TAMANHO - 1)
    .returns<PecaBid[]>();

  const totalPaginas = Math.max(1, Math.ceil((count ?? 0) / PAGINA_TAMANHO));

  return (
    <AppShell titulo="Pendências BID" perfil={perfil}>
      <Link
        href="/bases/bid"
        className="inline-flex items-center gap-1.5 text-xs hover:opacity-80 mb-4"
        style={{ color: "var(--muted)" }}
      >
        <ArrowLeft size={14} />
        Voltar para BID
      </Link>

      <p className="text-sm mb-5" style={{ color: "var(--muted)" }}>
        Peças do BID cujo Part Number ainda não foi encontrado na Base Peças — por isso não têm custo calculado.
        Assim que o código aparecer numa importação da Base Peças, a peça sai daqui automaticamente (use o botão
        "Recalcular" na tela do BID depois de importar).
      </p>

      <p className="text-sm mb-4" style={{ color: "var(--ink)" }}>
        <strong>{count ?? 0}</strong> peça(s) pendente(s).
      </p>

      <TabelaBidPecas pecas={pecas ?? []} />

      {totalPaginas > 1 && (
        <div className="flex items-center gap-2 mt-4 text-sm">
          {pagina > 1 && (
            <Link
              href={`/bases/bid/pendencias?pagina=${pagina - 1}`}
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
              href={`/bases/bid/pendencias?pagina=${pagina + 1}`}
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
