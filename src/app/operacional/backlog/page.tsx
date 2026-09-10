import Link from "next/link";
import { ArrowLeft, Gauge, ClipboardList, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import { STATUS_OPERACIONAL } from "@/lib/orcamentos";
import { formatarDias } from "@/lib/metricas";
import { buscarBacklog } from "@/lib/allied";

// só as etapas numeradas (1 a 8) — igual ao card R-TAT ao vivo de cada
// etapa (ver operacional/[slug]/page.tsx), aqui em forma de resumo geral
// do pipeline inteiro numa tela só. Sem nenhum valor de custo, então
// essa tela é igual pra equipe interna e pro cargo ALLIED.
const ETAPAS_NUMERADAS = STATUS_OPERACIONAL.filter((s) => /^\d/.test(s.valor));

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

  const linhas = await buscarBacklog(supabase);
  const mapa = new Map(linhas.map((l) => [l.status_operacional, l]));

  const totalQuantidade = ETAPAS_NUMERADAS.reduce((soma, s) => soma + (mapa.get(s.valor)?.quantidade ?? 0), 0);

  return (
    <AppShell
      titulo="Backlog"
      tituloInfo="Resumo do pipeline por etapa numerada (1 a 8): quantidade parada em cada uma e o R-TAT médio (dias desde a Data Reconhecimento até hoje) de quem está parado ali agora."
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
          <strong>{totalQuantidade}</strong> aparelho(s) nas etapas numeradas
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

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--line)" }}>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
              <th className="px-4 py-2.5 font-medium">Etapa</th>
              <th className="px-4 py-2.5 font-medium text-right">Quantidade</th>
              <th className="px-4 py-2.5 font-medium text-right">R-TAT médio</th>
            </tr>
          </thead>
          <tbody>
            {ETAPAS_NUMERADAS.map((s) => {
              const linha = mapa.get(s.valor);
              const quantidade = linha?.quantidade ?? 0;
              return (
                <tr key={s.slug} className="border-t" style={{ borderColor: "var(--line)" }}>
                  <td className="px-4 py-2.5">
                    <Link href={`/operacional/${s.slug}`} className="font-medium hover:underline" style={{ color: "var(--ink)" }}>
                      {s.label}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-right" style={{ color: "var(--ink)" }}>
                    {quantidade}
                  </td>
                  <td className="px-4 py-2.5 text-right" style={{ color: "var(--ink)" }}>
                    {linha?.media_rtat_dias != null ? (
                      <span className="inline-flex items-center gap-1 justify-end">
                        <Gauge size={12} style={{ color: "var(--accent2)" }} />
                        {formatarDias(linha.media_rtat_dias)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
