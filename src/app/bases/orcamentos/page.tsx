import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import ImportarOrcamentosForm from "@/components/ImportarOrcamentosForm";
import { podeImportarOrcamentos } from "@/lib/orcamentos";
import { formatarDataHoraBrasilia } from "@/lib/tempo";

type ResumoOrcamentos = {
  aparelhos: number;
  modelos_comerciais_unicos: number;
  skus_unicos: number;
  reincidentes: number;
};

type Lote = {
  id: string;
  nf_remessa_allied: string;
  importado_em: string;
  aparelhos_no_arquivo: number;
  aparelhos_novos_inseridos: number;
  aparelhos_duplicados_ignorados: number;
  aparelhos_reincidentes: number;
  modelos_comerciais_unicos: number;
  skus_unicos: number;
  usuarios: { nome: string; sobrenome: string } | { nome: string; sobrenome: string }[] | null;
};

export default async function OrcamentosPage() {
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

  const [{ data: resumo }, { data: lotes }] = await Promise.all([
    supabase.rpc("orcamentos_metricas_resumo").single() as unknown as Promise<{ data: ResumoOrcamentos | null }>,
    supabase
      .from("orcamentos_lotes")
      .select(
        "id, nf_remessa_allied, importado_em, aparelhos_no_arquivo, aparelhos_novos_inseridos, aparelhos_duplicados_ignorados, aparelhos_reincidentes, modelos_comerciais_unicos, skus_unicos, usuarios:importado_por (nome, sobrenome)"
      )
      .order("importado_em", { ascending: false })
      .limit(20) as unknown as Promise<{ data: Lote[] | null }>,
  ]);

  return (
    <AppShell titulo="Base Orçamentos" perfil={perfil}>
      {podeImportarOrcamentos(perfil) && (
        <div className="mb-6">
          <ImportarOrcamentosForm />
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Cartao titulo="Aparelhos recebidos" valor={resumo?.aparelhos ?? 0} />
        <Cartao titulo="Modelos comerciais únicos" valor={resumo?.modelos_comerciais_unicos ?? 0} />
        <Cartao titulo="SKUs únicos" valor={resumo?.skus_unicos ?? 0} />
        <Cartao titulo="Reincidentes (RRR)" valor={resumo?.reincidentes ?? 0} destaque />
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--line)" }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: "var(--line)", background: "var(--surface2)" }}>
          <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
            Histórico de importações
          </p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
              <th className="px-4 py-2.5 font-medium">NF Remessa</th>
              <th className="px-4 py-2.5 font-medium">Data/hora</th>
              <th className="px-4 py-2.5 font-medium">Usuário</th>
              <th className="px-4 py-2.5 font-medium">Aparelhos</th>
              <th className="px-4 py-2.5 font-medium">Novos</th>
              <th className="px-4 py-2.5 font-medium">Duplicados</th>
              <th className="px-4 py-2.5 font-medium">RRR</th>
              <th className="px-4 py-2.5 font-medium">Modelos</th>
            </tr>
          </thead>
          <tbody>
            {(lotes ?? []).map((lote) => {
              const usuario = Array.isArray(lote.usuarios) ? lote.usuarios[0] : lote.usuarios;
              return (
                <tr key={lote.id} className="border-t" style={{ borderColor: "var(--line)", background: "var(--surface)" }}>
                  <td className="px-4 py-2.5" style={{ color: "var(--ink)" }}>
                    {lote.nf_remessa_allied}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>
                    {formatarDataHoraBrasilia(lote.importado_em)}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>
                    {usuario ? `${usuario.nome} ${usuario.sobrenome}` : "—"}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>
                    {lote.aparelhos_no_arquivo}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>
                    {lote.aparelhos_novos_inseridos}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>
                    {lote.aparelhos_duplicados_ignorados}
                  </td>
                  <td className="px-4 py-2.5">
                    {lote.aparelhos_reincidentes > 0 ? (
                      <span className="text-amber-500 font-medium">{lote.aparelhos_reincidentes}</span>
                    ) : (
                      <span style={{ color: "var(--muted)" }}>0</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>
                    {lote.modelos_comerciais_unicos}
                  </td>
                </tr>
              );
            })}

            {(!lotes || lotes.length === 0) && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center" style={{ color: "var(--muted)", background: "var(--surface)" }}>
                  Nenhuma importação realizada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}

function Cartao({ titulo, valor, destaque }: { titulo: string; valor: number; destaque?: boolean }) {
  return (
    <div className="rounded-xl border p-5" style={{ background: "var(--surface)", borderColor: "var(--line)" }}>
      <p className="text-xs uppercase tracking-wide mb-1.5" style={{ color: "var(--muted)" }}>
        {titulo}
      </p>
      <p className="text-3xl font-semibold" style={{ color: destaque && valor > 0 ? "#f59e0b" : "var(--ink)" }}>
        {valor}
      </p>
    </div>
  );
}
