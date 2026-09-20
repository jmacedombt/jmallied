import Link from "next/link";
import { ArrowLeft, Gauge, ClipboardList, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import { STATUS_OPERACIONAL } from "@/lib/orcamentos";
import { formatarDias } from "@/lib/metricas";
import { buscarBacklogPorLote } from "@/lib/allied";
import CelulaBacklogEtapa from "@/components/CelulaBacklogEtapa";

// só as etapas numeradas (1 a 8) — as "oficiais" (pedido explícito: "os
// oficiais são os que tem Numeração") — igual ao card R-TAT ao vivo de
// cada etapa (ver operacional/[slug]/page.tsx). Sem nenhum valor de
// custo, então essa tela é igual pra equipe interna e pro cargo ALLIED.
const ETAPAS_NUMERADAS = STATUS_OPERACIONAL.filter((s) => /^\d/.test(s.valor));

// cor fixa por etapa/coluna — só pra diferenciar visualmente uma coluna
// da outra na matriz (pedido explícito: "cada um com uma cor pra
// diferenciar"), sem nenhum outro significado (não é a mesma escala de
// cor de lucro/margem usada em outras telas).
const CORES_ETAPAS_BACKLOG: Record<string, string> = {
  "1-ag-triagem": "#60a5fa",
  "2-ag-analise": "#a78bfa",
  "3-ag-resposta-orcamento": "#f472b6",
  "4-ag-resposta-reorcamento": "#fb923c",
  "5-ag-pecas": "#facc15",
  "6-ag-reparo": "#4ade80",
  "7-reparo-finalizado": "#22d3ee",
  "8-orcamento-reprovado": "#f87171",
};

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

  const linhas = await buscarBacklogPorLote(supabase);

  // reagrupa por lote: cada linha da matriz é um nf_remessa_allied, com
  // a quantidade de cada etapa numerada (0 quando não tem nenhum aparelho
  // ali) e o R-TAT médio do lote inteiro (mesmo valor pras 8 colunas,
  // vem pronto da RPC — ver migration 0051).
  type LinhaMatriz = {
    nfRemessa: string;
    porEtapa: Record<string, number>;
    total: number;
    mediaRtatLote: number | null;
  };

  const mapaLotes = new Map<string, LinhaMatriz>();
  for (const l of linhas) {
    const atual = mapaLotes.get(l.nf_remessa_allied) ?? {
      nfRemessa: l.nf_remessa_allied,
      porEtapa: {},
      total: 0,
      mediaRtatLote: l.media_rtat_lote_dias,
    };
    atual.porEtapa[l.status_operacional] = l.quantidade;
    atual.total += l.quantidade;
    mapaLotes.set(l.nf_remessa_allied, atual);
  }

  const matriz = Array.from(mapaLotes.values()).sort((a, b) => a.nfRemessa.localeCompare(b.nfRemessa, "pt-BR", { numeric: true }));

  const totalGeral = matriz.reduce((soma, l) => soma + l.total, 0);
  const totalPorEtapa: Record<string, number> = {};
  for (const s of ETAPAS_NUMERADAS) {
    totalPorEtapa[s.valor] = matriz.reduce((soma, l) => soma + (l.porEtapa[s.valor] ?? 0), 0);
  }

  return (
    <AppShell
      titulo="Backlog"
      tituloInfo="Matriz do pipeline: cada linha é um lote (NF Remessa), cada coluna uma das 8 etapas numeradas (as oficiais). Mostra quantidade e percentual (sobre o total daquele lote) com barra colorida por etapa, além do R-TAT médio do lote inteiro (dias desde a Data Reconhecimento até hoje, de quem está parado nas etapas numeradas)."
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
          <strong>{totalGeral}</strong> aparelho(s) em <strong>{matriz.length}</strong> lote(s) nas etapas numeradas
        </span>

        <a
          href="/api/operacional/backlog/exportar-allied"
          className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium mb-3 ml-auto transition hover:border-[var(--accent2)]"
          style={{ borderColor: "var(--line)", color: "var(--ink)" }}
          title="Baixar o backlog em Excel, no layout usado pela Allied"
        >
          <Download size={14} style={{ color: "var(--accent2)" }} />
          Exportar backlog
        </a>
      </div>

      <div className="rounded-xl border overflow-x-auto" style={{ borderColor: "var(--line)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
              <th className="px-4 py-2.5 font-medium sticky left-0" style={{ background: "var(--surface2)" }}>
                Lote (NF Remessa)
              </th>
              {ETAPAS_NUMERADAS.map((s) => (
                <th key={s.slug} className="px-3 py-2.5 font-medium whitespace-nowrap">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full" style={{ background: CORES_ETAPAS_BACKLOG[s.slug] }} />
                    {s.label}
                  </span>
                </th>
              ))}
              <th className="px-4 py-2.5 font-medium text-right">Total</th>
              <th className="px-4 py-2.5 font-medium text-right">R-TAT médio do lote</th>
            </tr>
          </thead>
          <tbody>
            {matriz.map((l) => (
              <tr key={l.nfRemessa} className="border-t" style={{ borderColor: "var(--line)" }}>
                <td
                  className="px-4 py-2.5 font-medium whitespace-nowrap sticky left-0"
                  style={{ color: "var(--ink)", background: "var(--surface)" }}
                >
                  {l.nfRemessa}
                </td>
                {ETAPAS_NUMERADAS.map((s) => {
                  const quantidade = l.porEtapa[s.valor] ?? 0;
                  const percentual = l.total > 0 ? (quantidade / l.total) * 100 : 0;
                  return (
                    <td key={s.slug} className="px-3 py-2.5">
                      <CelulaBacklogEtapa quantidade={quantidade} percentual={percentual} cor={CORES_ETAPAS_BACKLOG[s.slug]} />
                    </td>
                  );
                })}
                <td className="px-4 py-2.5 text-right font-semibold" style={{ color: "var(--ink)" }}>
                  {l.total}
                </td>
                <td className="px-4 py-2.5 text-right" style={{ color: "var(--ink)" }}>
                  {l.mediaRtatLote != null ? (
                    <span className="inline-flex items-center gap-1 justify-end">
                      <Gauge size={12} style={{ color: "var(--accent2)" }} />
                      {formatarDias(l.mediaRtatLote)}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
            {matriz.length === 0 && (
              <tr>
                <td colSpan={ETAPAS_NUMERADAS.length + 3} className="px-4 py-8 text-center" style={{ color: "var(--muted)" }}>
                  Nenhum aparelho nas etapas numeradas no momento.
                </td>
              </tr>
            )}
          </tbody>
          {matriz.length > 0 && (
            <tfoot>
              <tr className="border-t font-semibold" style={{ borderColor: "var(--line)", background: "var(--surface2)" }}>
                <td className="px-4 py-2.5 sticky left-0" style={{ color: "var(--ink)", background: "var(--surface2)" }}>
                  Total
                </td>
                {ETAPAS_NUMERADAS.map((s) => (
                  <td key={s.slug} className="px-3 py-2.5" style={{ color: "var(--ink)" }}>
                    {totalPorEtapa[s.valor]}
                  </td>
                ))}
                <td className="px-4 py-2.5 text-right" style={{ color: "var(--ink)" }}>
                  {totalGeral}
                </td>
                <td className="px-4 py-2.5" />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <p className="text-xs mt-3 flex items-center gap-3 flex-wrap" style={{ color: "var(--muted)" }}>
        Percentual de cada célula é sobre o total de aparelhos daquele lote (soma das 8 etapas numeradas dessa linha).
      </p>
    </AppShell>
  );
}
