import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import PainelUsuariosOnline from "@/components/PainelUsuariosOnline";
import { isAllied } from "@/lib/usuarios";

// "Usuários Online" (pedido explícito) — item avulso no menu, ao lado
// de "Início", visível pra QUALQUER login que não seja ALLIED
// (inclusive os cargos restritos por etapa — Operacional, Triagem/OQC
// — e o cargo Financeiro, que hoje não veem o grupo "Sistema"). Por
// isso essa rota fica FORA de "/sistema" e de qualquer prefixo
// bloqueado pra esses cargos (ver PREFIXOS_BLOQUEADOS_OPERACIONAL/
// FINANCEIRO em lib/usuarios.ts) — e fora da lista de rotas liberadas
// pro ALLIED no middleware.ts, então esse cargo já cai fora antes de
// chegar aqui. A checagem abaixo é só uma segunda camada, pro caso de
// alguém digitar a URL direto.
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
      tituloInfo="Quem está com o sistema aberto neste momento, com a data e hora do login. Não fica visível pro login ALLIED."
      perfil={perfil}
    >
      {isAllied(perfil) ? (
        <p
          className="text-sm rounded-xl border px-4 py-3"
          style={{ color: "var(--muted)", borderColor: "var(--line)", background: "var(--surface)" }}
        >
          Seu cargo não tem permissão pra acessar essa tela.
        </p>
      ) : (
        <PainelUsuariosOnline />
      )}
    </AppShell>
  );
}
