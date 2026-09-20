import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import ConfigImpostoForm from "@/components/ConfigImpostoForm";
import GraficoLinhaGradiente from "@/components/GraficoLinhaGradiente";
import { buscarHistoricoIcms } from "@/lib/impostos";
import { formatarRotuloPeriodo } from "@/lib/metricas";
import { formatarDataHoraBrasilia } from "@/lib/tempo";

function formatarIcms(valor: number): string {
  return `${valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
}

export default async function ConfigImpostosPage() {
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

  const [{ data: config }, historico] = await Promise.all([
    supabase.from("configuracoes_impostos").select("*").eq("id", 1).single(),
    buscarHistoricoIcms(supabase),
  ]);

  const pontosGrafico = historico.map((h) => ({
    rotulo: formatarRotuloPeriodo(h.mes, "mes"),
    valor: h.icmsPercentual,
  }));

  return (
    <AppShell titulo="Imposto (ICMS)" perfil={perfil}>
      <h1 className="text-xl font-semibold mb-1" style={{ color: "var(--ink)" }}>
        Imposto (ICMS)
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
        Usado no cálculo de lucro do BID, em Bases &gt; BID.
      </p>

      <div className="flex flex-wrap items-start gap-4 mb-6">
        <ConfigImpostoForm icmsInicial={config?.icms_percentual ?? 8.45} />
      </div>

      <GraficoLinhaGradiente
        titulo="Evolução do ICMS por mês"
        pontos={pontosGrafico}
        formatarValor={formatarIcms}
        mensagemVazia="Nenhum histórico de ICMS registrado ainda — salve um valor acima pra começar."
      />

      {historico.length > 0 && (
        <div className="rounded-xl border overflow-hidden mt-4 max-w-lg" style={{ borderColor: "var(--line)" }}>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
                <th className="px-4 py-2.5 font-medium">Mês</th>
                <th className="px-4 py-2.5 font-medium text-right">ICMS</th>
                <th className="px-4 py-2.5 font-medium">Alterado por</th>
                <th className="px-4 py-2.5 font-medium">Quando</th>
              </tr>
            </thead>
            <tbody>
              {[...historico].reverse().map((h) => (
                <tr key={h.mes} className="border-t" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
                  <td className="px-4 py-2.5 font-medium" style={{ color: "var(--ink)" }}>
                    {formatarRotuloPeriodo(h.mes, "mes")}
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold" style={{ color: "var(--ink)" }}>
                    {formatarIcms(h.icmsPercentual)}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>
                    {h.atualizadoPorNome ?? "—"}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>
                    {formatarDataHoraBrasilia(h.atualizadoEm)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
