import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import PainelOrcamentosEnviados from "@/components/PainelOrcamentosEnviados";
import { podeConfirmarAnaliseEmLote } from "@/lib/orcamentos";
import { isAllied } from "@/lib/usuarios";

// Novo submenu "Orçamentos Enviados" dentro de Operacional (pedido
// explícito) — mesmo histórico que já existia só como pop-up dentro de
// Validação de Orçamentos ("Histórico de Envios"), agora também como
// página própria. Mesma permissão de quem confirma o envio naquela tela
// (podeConfirmarAnaliseEmLote) — e também o login ALLIED (pedido
// explícito): é o mesmo arquivo que a Allied já recebe pra aprovar os
// orçamentos, sem custo/BID.
export default async function OrcamentosEnviadosPage() {
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
      titulo="Orçamentos Enviados"
      tituloInfo="Toda vez que 'Confirmar Envio' é confirmado em Validação de Orçamentos, a planilha final fica registrada aqui com data e hora — dá pra baixar de novo quando precisar."
      perfil={perfil}
    >
      {podeConfirmarAnaliseEmLote(perfil) || isAllied(perfil) ? (
        <PainelOrcamentosEnviados />
      ) : (
        <p
          className="text-sm rounded-xl border px-4 py-3"
          style={{ color: "var(--muted)", borderColor: "var(--line)", background: "var(--surface)" }}
        >
          Seu cargo não tem permissão pra acessar o histórico de Orçamentos Enviados.
        </p>
      )}
    </AppShell>
  );
}
