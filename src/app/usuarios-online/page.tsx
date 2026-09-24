import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import PainelUsuariosOnline from "@/components/PainelUsuariosOnline";

// "Usuários Online" (pedido explícito) — item avulso no menu, ao lado
// de "Início", visível pra QUALQUER login, inclusive ALLIED desde a
// migration 0068 (antes era escondido desse cargo, ver migration 0058)
// — e os cargos restritos por etapa (Operacional, Triagem/OQC) e o
// cargo Financeiro (que hoje não veem o grupo "Sistema"). Por isso essa
// rota fica FORA de "/sistema" e de qualquer prefixo bloqueado pra
// esses cargos (ver PREFIXOS_BLOQUEADOS_OPERACIONAL/FINANCEIRO em
// lib/usuarios.ts).
export default async function UsuariosOnlinePage() {
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
      titulo="Usuários Online"
      tituloInfo="Quem está com o sistema aberto neste momento, com a data e hora do login."
      perfil={perfil}
    >
      <PainelUsuariosOnline />
    </AppShell>
  );
}
