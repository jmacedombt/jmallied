import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import ReconhecimentoLoteForm, { type LoteReconhecimento } from "@/components/ReconhecimentoLoteForm";
import { podeImportarOrcamentos } from "@/lib/orcamentos";

export default async function ReconhecimentoLotePage() {
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

  const { data: lotes } = await supabase
    .from("orcamentos_lotes")
    .select("id, nf_remessa_allied, importado_em, aparelhos_no_arquivo, data_reconhecimento")
    .order("importado_em", { ascending: false })
    .returns<LoteReconhecimento[]>();

  return (
    <AppShell titulo="Reconhecimento Lote" perfil={perfil}>
      <p className="text-sm mb-5" style={{ color: "var(--muted)" }}>
        Escolha um lote já importado e a data em que os aparelhos chegaram na loja. Essa data — a Data
        Reconhecimento — é gravada em todos os aparelhos do lote e acompanha cada um deles em todas as etapas do
        Operacional.
      </p>

      {podeImportarOrcamentos(perfil) ? (
        <ReconhecimentoLoteForm lotes={lotes ?? []} />
      ) : (
        <p
          className="text-sm rounded-xl border px-4 py-3"
          style={{ color: "var(--muted)", borderColor: "var(--line)", background: "var(--surface)" }}
        >
          Seu cargo não tem permissão para definir a Data Reconhecimento — mesma permissão exigida pra importar a
          base de orçamentos.
        </p>
      )}
    </AppShell>
  );
}
