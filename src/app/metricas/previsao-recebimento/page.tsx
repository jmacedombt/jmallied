import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import { podeConfirmarAnaliseEmLote } from "@/lib/orcamentos";
import {
  completarPrevisaoRecebimento,
  COR_MAO_DE_OBRA,
  COR_VENDA_PECAS,
  STATUS_PREVISAO_RECEBIMENTO,
  type LinhaPrevisaoRecebimento,
} from "@/lib/metricas";
import GraficoPrevisaoRecebimento from "@/components/GraficoPrevisaoRecebimento";

function formatarReal(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function MetricasPrevisaoRecebimentoPage() {
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

  const voltar = (
    <Link
      href="/metricas"
      title="Voltar para Métricas"
      aria-label="Voltar para Métricas"
      className="botao-voltar-brilho relative inline-flex items-center justify-center w-11 h-11 rounded-full mb-3 transition-transform hover:scale-110 active:scale-100"
    >
      <ArrowLeft size={20} strokeWidth={2.5} style={{ color: "var(--accent2)", filter: "drop-shadow(0 0 5px var(--accent2))" }} />
    </Link>
  );

  if (!podeConfirmarAnaliseEmLote(perfil)) {
    return (
      <AppShell titulo="Previsão de Recebimento" perfil={perfil}>
        {voltar}
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Seu cargo não tem permissão para acessar o menu Métricas.
        </p>
      </AppShell>
    );
  }

  const { data: bruto, error } = await supabase.rpc("previsao_recebimento_resumo", { p_status: null });

  const linhas: LinhaPrevisaoRecebimento[] = (bruto ?? []).map(
    (r: { status_operacional: string; mao_de_obra: number; venda_pecas: number; quantidade: number }) => ({
      statusOperacional: r.status_operacional,
      maoDeObra: Number(r.mao_de_obra ?? 0),
      vendaPecas: Number(r.venda_pecas ?? 0),
      quantidade: Number(r.quantidade ?? 0),
    })
  );

  const itens = completarPrevisaoRecebimento(linhas).map((l, i) => ({ ...l, label: STATUS_PREVISAO_RECEBIMENTO[i].label }));

  const totalMaoDeObra = itens.reduce((soma, i) => soma + i.maoDeObra, 0);
  const totalVendaPecas = itens.reduce((soma, i) => soma + i.vendaPecas, 0);
  const totalGeral = totalMaoDeObra + totalVendaPecas;
  const totalAparelhos = itens.reduce((soma, i) => soma + i.quantidade, 0);

  return (
    <AppShell
      titulo="Previsão de Recebimento"
      tituloInfo="Mão de Obra + Venda de Peças dos aparelhos em 5 - Ag. Peças, 6 - Ag. Reparo e 7 - Reparo Finalizado — as 3 etapas em que o orçamento já foi aprovado pela Allied, então é o que vamos efetivamente receber por eles. Usa o valor vigente de cada aparelho (Reorçamento aprovado, senão Contra Proposta ajustada, senão o valor original da Validação)."
      perfil={perfil}
    >
      {voltar}

      {error ? (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
          Não foi possível carregar a métrica: {error.message}
        </p>
      ) : (
        <div className="space-y-4">
          {/* hero — o número que a tela lidera, único por tela (ver skill de dataviz) */}
          <div
            className="rounded-xl border p-5"
            style={{
              background: "linear-gradient(155deg, var(--surface2), var(--surface))",
              borderColor: "var(--line)",
            }}
          >
            <p className="text-xs font-medium mb-1.5" style={{ color: "var(--muted)" }}>
              Total previsto a receber (5 + 6 + 7)
            </p>
            <p className="text-4xl font-bold mb-3" style={{ color: "var(--ink)", fontSize: 40 }}>
              {formatarReal(totalGeral)}
            </p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-sm">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: COR_MAO_DE_OBRA }} />
                <span style={{ color: "var(--muted)" }}>Mão de Obra</span>
                <strong style={{ color: "var(--ink)" }}>{formatarReal(totalMaoDeObra)}</strong>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: COR_VENDA_PECAS }} />
                <span style={{ color: "var(--muted)" }}>Peças (venda)</span>
                <strong style={{ color: "var(--ink)" }}>{formatarReal(totalVendaPecas)}</strong>
              </span>
              <span style={{ color: "var(--muted)" }}>
                <strong style={{ color: "var(--ink)" }}>{totalAparelhos}</strong> aparelho(s) no total
              </span>
            </div>
          </div>

          <GraficoPrevisaoRecebimento itens={itens} />

          {/* tabela — mesmo dado do gráfico, sempre acessível sem precisar do hover */}
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--line)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
                  <th className="px-4 py-2.5 font-medium">Etapa</th>
                  <th className="px-4 py-2.5 font-medium text-right">Aparelhos</th>
                  <th className="px-4 py-2.5 font-medium text-right">Mão de Obra</th>
                  <th className="px-4 py-2.5 font-medium text-right">Peças (venda)</th>
                  <th className="px-4 py-2.5 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {itens.map((item) => (
                  <tr key={item.statusOperacional} className="border-t" style={{ borderColor: "var(--line)" }}>
                    <td className="px-4 py-2.5 font-medium" style={{ color: "var(--ink)" }}>
                      {item.label}
                    </td>
                    <td className="px-4 py-2.5 text-right" style={{ color: "var(--muted)" }}>
                      {item.quantidade}
                    </td>
                    <td className="px-4 py-2.5 text-right" style={{ color: "var(--ink)" }}>
                      {formatarReal(item.maoDeObra)}
                    </td>
                    <td className="px-4 py-2.5 text-right" style={{ color: "var(--ink)" }}>
                      {formatarReal(item.vendaPecas)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold" style={{ color: "var(--ink)" }}>
                      {formatarReal(item.maoDeObra + item.vendaPecas)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t" style={{ borderColor: "var(--line)", background: "var(--surface2)" }}>
                  <td className="px-4 py-2.5 font-semibold" style={{ color: "var(--ink)" }}>
                    Total
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold" style={{ color: "var(--ink)" }}>
                    {totalAparelhos}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold" style={{ color: "var(--ink)" }}>
                    {formatarReal(totalMaoDeObra)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold" style={{ color: "var(--ink)" }}>
                    {formatarReal(totalVendaPecas)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-bold" style={{ color: "var(--accent2)" }}>
                    {formatarReal(totalGeral)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </AppShell>
  );
}
