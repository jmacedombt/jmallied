import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import ConfigImpostoForm from "@/components/ConfigImpostoForm";
import GraficoEvolucaoIcms from "@/components/GraficoEvolucaoIcms";
import { buscarHistoricoIcms, formatarIcms } from "@/lib/impostos";
import { formatarRotuloPeriodo } from "@/lib/metricas";
import { formatarDataHoraBrasilia } from "@/lib/tempo";

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

  const [{ data: config }, { pontos: historico, erro: erroHistorico }] = await Promise.all([
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

      {erroHistorico ? (
        <p className="text-sm text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 mb-4 max-w-lg">
          Não foi possível carregar o histórico de ICMS ({erroHistorico}). Se a migration 0054 ainda não foi rodada no
          Supabase, rode-a e recarregue essa página.
        </p>
      ) : (
        <GraficoEvolucaoIcms pontos={pontosGrafico} />
      )}

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
