import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import PainelPrevisaoResultados from "@/components/PainelPrevisaoResultados";
import { podeAcessarFinanceiro, buscarPrevisaoResultadosPorLote } from "@/lib/financeiro";

// "Previsão de Resultados" (menu Financeiro, pedido explícito,
// 25/09/2026) — resumo por lote (NF Remessa) de Quantidade de
// Orçamentos, Mão de Obra, Custo de Peças, Venda de Peças, Margem de
// Peças, Margem Total e Valor Líquido, considerando só os aparelhos já
// aprovados pela Allied (ver financeiro_previsao_resultados_por_lote,
// migration 0071) — sem filtro de período, é sempre a "foto atual" do
// que está em aberto/concluído. Reprovados contam na quantidade, mas com
// R$ 0 nos valores.
export default async function PrevisaoResultadosPage() {
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

  if (!podeAcessarFinanceiro(perfil)) {
    return (
      <AppShell titulo="Previsão de Resultados" perfil={perfil}>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Seu cargo não tem permissão para acessar o menu Financeiro.
        </p>
      </AppShell>
    );
  }

  const erro = { mensagem: null as string | null };
  let linhas: Awaited<ReturnType<typeof buscarPrevisaoResultadosPorLote>> = [];
  try {
    linhas = await buscarPrevisaoResultadosPorLote(supabase);
  } catch (e) {
    erro.mensagem = e instanceof Error ? e.message : "Não foi possível carregar a previsão de resultados.";
  }

  return (
    <AppShell
      titulo="Previsão de Resultados"
      tituloInfo="Resumo por lote (NF Remessa) de tudo que já foi aprovado pela Allied — direto ou via Contra Proposta/Reorçamento — com o valor negociado mais recente de cada aparelho. Reprovados contam na quantidade, mas não entram nos valores. Sem filtro de período: é sempre a foto atual do que está em aberto ou já concluído."
      perfil={perfil}
    >
      {erro.mensagem ? (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
          Não foi possível carregar a previsão de resultados: {erro.mensagem}
        </p>
      ) : (
        <PainelPrevisaoResultados linhas={linhas} />
      )}
    </AppShell>
  );
}
