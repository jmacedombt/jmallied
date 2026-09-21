import Link from "next/link";
import { ArrowLeft, ClipboardList, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import { buscarBacklogPorLote, buscarBacklogResumoPorLote } from "@/lib/allied";
import PainelBacklogPorLote, { type LinhaBacklogResumo } from "@/components/PainelBacklogPorLote";

export default async function BacklogPage() {
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

  const [resumoPorLote, detalheBruto] = await Promise.all([
    buscarBacklogResumoPorLote(supabase),
    buscarBacklogPorLote(supabase),
  ]);

  const linhas: LinhaBacklogResumo[] = resumoPorLote
    .map((l) => ({
      nfRemessa: l.nf_remessa_allied,
      totalLote: l.totalLote,
      quantidadePendente: l.quantidadePendente,
      quantidadeEntregue: l.quantidadeEntregue,
      quantidadeReprovada: l.quantidadeReprovada,
      mediaRtatPendenteDias: l.mediaRtatPendenteDias,
    }))
    .sort((a, b) => a.nfRemessa.localeCompare(b.nfRemessa, "pt-BR", { numeric: true }));

  // detalhe por status/card de CADA lote (todos os status, não só os
  // numerados) — usado só pelo pop-up ao clicar numa linha (ver
  // PainelBacklogPorLote.tsx e migration 0053).
  const detalhePorLote: Record<string, Record<string, number>> = {};
  for (const d of detalheBruto) {
    (detalhePorLote[d.nf_remessa_allied] ??= {})[d.status_operacional] = d.quantidade;
  }

  const totalPendenteGeral = linhas.reduce((soma, l) => soma + l.quantidadePendente, 0);

  return (
    <AppShell
      titulo="Backlog"
      tituloInfo="Uma linha por lote (NF Remessa) que ainda tem algo pendente: total de orçamentos já importados com essa NF, quantos ainda estão pendentes (não entregues e não reprovados) e o R-TAT médio de quem está pendente. Clique numa linha pra ver a quantidade em cada status/card desse lote."
      perfil={perfil}
    >
      <div className="flex items-center flex-wrap mb-4">
        <Link
          href="/operacional"
          title="Voltar para Operacional"
          aria-label="Voltar para Operacional"
          className="botao-voltar-brilho relative inline-flex items-center justify-center w-11 h-11 rounded-full mb-3 transition-transform hover:scale-110 active:scale-100"
        >
          <ArrowLeft
            size={20}
            strokeWidth={2.5}
            style={{ color: "var(--accent2)", filter: "drop-shadow(0 0 5px var(--accent2))" }}
          />
        </Link>
        <span
          className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium mb-3 ml-2"
          style={{ borderColor: "var(--line)", background: "var(--surface2)", color: "var(--ink)" }}
        >
          <ClipboardList size={12} style={{ color: "var(--accent2)" }} />
          <strong>{totalPendenteGeral}</strong> pendente(s) em <strong>{linhas.length}</strong> lote(s)
        </span>

        <a
          href="/api/operacional/backlog/exportar-allied"
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium mb-3 ml-auto transition hover:border-[var(--accent2)]"
          style={{ borderColor: "var(--line)", color: "var(--ink)" }}
          title="Baixar o backlog em Excel — 2 abas: uma só com os status numerados (layout usado pela Allied) e outra com todas as pendências"
        >
          <Download size={14} style={{ color: "var(--accent2)" }} />
          Exportar backlog
        </a>
      </div>

      <PainelBacklogPorLote linhas={linhas} detalhePorLote={detalhePorLote} mensagemVazia="Nenhum lote com pendência no momento." />

      <p className="text-xs mt-3" style={{ color: "var(--muted)" }}>
        "Pendente" não conta quem já está em Produto Entregue nem quem já foi reprovado (8 - Orçamento Reprovado). O
        Excel exportado sai com 2 abas: a primeira só com os status com numeração (1 a 8, regra vigente), a segunda
        com todas as pendências, numeradas ou não.
      </p>
    </AppShell>
  );
}
