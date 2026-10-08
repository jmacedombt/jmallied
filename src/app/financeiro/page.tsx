import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import PainelFinanceiro from "@/components/PainelFinanceiro";
import { podeAcessarFinanceiro, buscarNotasFiscaisFinanceiro, expandirNotas, ultimosNMeses, somarValorPorMes } from "@/lib/financeiro";
import { formatarRotuloPeriodo } from "@/lib/metricas";
import type { PontoGrafico } from "@/components/GraficoLinhaGradiente";

export default async function FinanceiroPage() {
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
      <AppShell titulo="Financeiro" perfil={perfil}>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Seu cargo não tem permissão para acessar o menu Financeiro.
        </p>
      </AppShell>
    );
  }

  const linhas = await buscarNotasFiscaisFinanceiro(supabase);

  const notas = expandirNotas(linhas);

  // 2 gráficos, cada um considerando uma data diferente: emitidas →
  // Data Emissão (toda NF entra); recebidas → Data Recebimento de cada
  // NF (só as que já estão Vlr. Recebido — baixa é por nota, migration
  // 0075). Os dois mostram os últimos 6 meses (pedido explícito,
  // 07/10/2026 — antes Recebidos mostrava 12).
  const meses = ultimosNMeses(6);

  const mapaEmitidas = somarValorPorMes(notas.map((n) => ({ data: n.dataEmissao, valor: n.valor ?? 0 })));
  const mapaRecebidas = somarValorPorMes(
    notas
      .filter((n) => n.status === "Vlr. Recebido" && n.dataRecebimento)
      .map((n) => ({ data: n.dataRecebimento as string, valor: n.valor ?? 0 }))
  );

  const pontosEmitidas: PontoGrafico[] = meses.map((mes) => ({
    rotulo: formatarRotuloPeriodo(mes, "mes"),
    valor: mapaEmitidas[mes] ?? 0,
  }));
  const pontosRecebidas: PontoGrafico[] = meses.map((mes) => ({
    rotulo: formatarRotuloPeriodo(mes, "mes"),
    valor: mapaRecebidas[mes] ?? 0,
  }));

  return (
    <AppShell
      titulo="Financeiro"
      tituloInfo="NF Mão de Obra e NF Peças entram aqui sozinhas ao serem emitidas em Ag. Emissão de Nota Fiscal. A baixa (Vlr. Recebido) é feita por nota fiscal: clique no status de cada nota, ou selecione várias para dar baixa em massa."
      perfil={perfil}
    >
      <h1 className="text-xl font-semibold mb-1" style={{ color: "var(--ink)" }}>
        Financeiro
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
        Notas fiscais de Mão de Obra e Peças, valores em aberto e recebidos.
      </p>

      <PainelFinanceiro linhas={linhas} notas={notas} pontosEmitidas={pontosEmitidas} pontosRecebidas={pontosRecebidas} />
    </AppShell>
  );
}
