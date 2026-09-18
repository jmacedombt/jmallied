import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import PainelModeloRetorno from "@/components/PainelModeloRetorno";
import { podeLancarNfProdutoEntregue } from "@/lib/orcamentos";

// Novo submenu "Modelo de Retorno" dentro de Operacional (pedido
// explícito) — histórico de toda planilha "Modelo de Retorno" emitida
// em Ag. Emissão de Nota Fiscal, com data/hora, disponível por 60 dias.
// Mesma permissão de quem já lança as NFs/gera a planilha naquela tela
// (podeLancarNfProdutoEntregue — Supervisor/Gerente/is_master).
export default async function ModeloRetornoPage() {
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
      titulo="Modelo de Retorno"
      tituloInfo="Histórico das planilhas 'Modelo de Retorno' geradas em Ag. Emissão de Nota Fiscal — cada emissão fica registrada aqui com data e hora, disponível por 60 dias."
      perfil={perfil}
    >
      {podeLancarNfProdutoEntregue(perfil) ? (
        <PainelModeloRetorno />
      ) : (
        <p
          className="text-sm rounded-xl border px-4 py-3"
          style={{ color: "var(--muted)", borderColor: "var(--line)", background: "var(--surface)" }}
        >
          Seu cargo não tem permissão pra acessar o histórico de Modelo de Retorno.
        </p>
      )}
    </AppShell>
  );
}
