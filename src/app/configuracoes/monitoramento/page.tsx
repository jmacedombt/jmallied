import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import { podeManutencaoBanco } from "@/lib/manutencao";
import PainelMonitoramento from "@/components/PainelMonitoramento";

// Configurações > Monitoramento (pedido explícito, 07/11/2026): Vercel,
// Supabase e GitHub — limites dos planos gratuitos e o que acompanhar.
export default async function MonitoramentoPage() {
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

  return (
    <AppShell
      titulo="Monitoramento"
      tituloInfo="Uso do sistema nos 3 serviços que mantêm o Allied no ar (Vercel, Supabase e GitHub) comparado com os limites dos planos gratuitos."
      perfil={perfil}
    >
      {podeManutencaoBanco(perfil) ? (
        <PainelMonitoramento />
      ) : (
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Só um Administrador pode acessar o Monitoramento.
        </p>
      )}
    </AppShell>
  );
}
