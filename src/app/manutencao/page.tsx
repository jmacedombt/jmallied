import AppShell from "@/components/AppShell";
import PainelManutencaoBanco from "@/components/PainelManutencaoBanco";
import { createClient } from "@/lib/supabase/server";
import { podeManutencaoBanco } from "@/lib/manutencao";

export default async function ManutencaoPage() {
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

  if (!podeManutencaoBanco(perfil)) {
    return (
      <AppShell titulo="Manutenção do Banco" perfil={perfil}>
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          Só um Administrador pode acessar a Manutenção do Banco.
        </p>
      </AppShell>
    );
  }

  return (
    <AppShell
      titulo="Manutenção do Banco"
      tituloInfo="Espaço em disco de cada tabela, zerar dados de implantação e compactar histórico antigo — tudo restrito a Administrador."
      perfil={perfil}
    >
      <PainelManutencaoBanco />
    </AppShell>
  );
}
