import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import PainelNotasFiscais from "@/components/PainelNotasFiscais";
import { podeLancarNfProdutoEntregue } from "@/lib/orcamentos";

// Novo submenu "Notas Fiscais" dentro de Operacional (pedido explícito)
// — relação de todo orçamento com NF Mão de Obra, NF Peças ou NF
// Retorno já lançada em Ag. Emissão de Nota Fiscal, agrupada por NF
// Remessa. Mesma permissão de quem já lança essas NFs naquela tela
// (podeLancarNfProdutoEntregue — Supervisor/Gerente/is_master); sem o
// fallback ALLIED que "Modelo de Retorno" tem, porque esse relatório
// expõe número/valor de NF que a Allied não precisa ver aqui.
export default async function NotasFiscaisPage() {
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
      titulo="Notas Fiscais"
      tituloInfo="Relação de todo orçamento com NF Mão de Obra, NF Peças ou NF Retorno já lançada em Ag. Emissão de Nota Fiscal, agrupada por NF Remessa."
      perfil={perfil}
    >
      {podeLancarNfProdutoEntregue(perfil) ? (
        <PainelNotasFiscais />
      ) : (
        <p
          className="text-sm rounded-xl border px-4 py-3"
          style={{ color: "var(--muted)", borderColor: "var(--line)", background: "var(--surface)" }}
        >
          Seu cargo não tem permissão pra acessar a Relação de Notas Fiscais.
        </p>
      )}
    </AppShell>
  );
}
