import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import PainelFinanceiro from "@/components/PainelFinanceiro";
import AtualizarAoVoltar from "@/components/AtualizarAoVoltar";
import { podeAcessarFinanceiro, buscarNotasFiscaisFinanceiro, expandirNotas } from "@/lib/financeiro";

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

  // os 2 gráficos (mês/semana) são montados no PainelFinanceiro a partir das notas

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

      <AtualizarAoVoltar />
      <PainelFinanceiro linhas={linhas} notas={notas} />
    </AppShell>
  );
}
