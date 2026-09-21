import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import PainelFinanceiro from "@/components/PainelFinanceiro";
import { podeAcessarFinanceiro, buscarNotasFiscaisFinanceiro, ultimosNMeses, somarValorPorMes } from "@/lib/financeiro";
import { formatarRotuloPeriodo } from "@/lib/metricas";
import type { PontoBarra } from "@/components/GraficoBarrasMensal";

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

  // 2 gráficos, sempre os últimos 12 meses (pedido explícito), cada um
  // considerando uma data diferente: emitidas → Data Emissão (todo
  // lançamento entra); recebidas → Data Recebimento (só quem já está
  // Vlr. Recebido).
  const meses = ultimosNMeses(12);

  const mapaEmitidas = somarValorPorMes(
    linhas.map((l) => ({ data: l.dataEmissao, valor: (l.nfMaoDeObraValor ?? 0) + (l.nfPecasValor ?? 0) }))
  );
  const mapaRecebidas = somarValorPorMes(
    linhas
      .filter((l) => l.status === "Vlr. Recebido" && l.dataRecebimento)
      .map((l) => ({ data: l.dataRecebimento as string, valor: (l.nfMaoDeObraValor ?? 0) + (l.nfPecasValor ?? 0) }))
  );

  const pontosEmitidas: PontoBarra[] = meses.map((mes) => ({
    rotulo: formatarRotuloPeriodo(mes, "mes"),
    valor: mapaEmitidas[mes] ?? 0,
  }));
  const pontosRecebidas: PontoBarra[] = meses.map((mes) => ({
    rotulo: formatarRotuloPeriodo(mes, "mes"),
    valor: mapaRecebidas[mes] ?? 0,
  }));

  return (
    <AppShell
      titulo="Financeiro"
      tituloInfo="NF Mão de Obra e NF Peças entram aqui sozinhas ao serem emitidas em Ag. Emissão de Nota Fiscal (mesmo dia = mesmo lançamento). Marque como Vlr. Recebido quando o pagamento cair."
      perfil={perfil}
    >
      <h1 className="text-xl font-semibold mb-1" style={{ color: "var(--ink)" }}>
        Financeiro
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
        Notas fiscais de Mão de Obra e Peças, valores em aberto e recebidos.
      </p>

      <PainelFinanceiro linhas={linhas} pontosEmitidas={pontosEmitidas} pontosRecebidas={pontosRecebidas} />
    </AppShell>
  );
}
