import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import ConfigMaoDeObraForm from "@/components/ConfigMaoDeObraForm";

export default async function ConfigMaoDeObraPage() {
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

  const { data: config } = await supabase.from("configuracoes_mao_de_obra").select("*").eq("id", 1).single();

  return (
    <AppShell titulo="Mão de obra" perfil={perfil}>
      <h1 className="text-xl font-semibold mb-1" style={{ color: "var(--ink)" }}>
        Parâmetros de mão de obra
      </h1>
      <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
        Usados no cálculo automático dos orçamentos, no menu Bases &gt; Orçamentos.
      </p>
      <ConfigMaoDeObraForm
        valorSemPecaInicial={config?.valor_sem_peca ?? 0}
        valorUmaPecaInicial={config?.valor_uma_peca ?? 80}
        valorMaisDeUmaPecaInicial={config?.valor_mais_de_uma_peca ?? 150}
      />
    </AppShell>
  );
}
