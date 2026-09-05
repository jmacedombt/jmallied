import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import ImportarGspnForm from "@/components/ImportarGspnForm";
import { podeImportarGspn } from "@/lib/gspn";
import { formatarDataHoraBrasilia } from "@/lib/tempo";

export default async function BaseGspnPage() {
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

  const [{ count: totalChamados }, { data: ultimaImportacao }] = await Promise.all([
    supabase.from("gspn_chamados").select("id", { count: "exact", head: true }),
    supabase
      .from("gspn_importacoes")
      .select(
        "importado_em, chamados_novos, chamados_atualizados, pecas_casadas_orcamento, pecas_nao_casadas_orcamento, usuarios:importado_por (nome, sobrenome)"
      )
      .order("importado_em", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const usuarioImportacao = ultimaImportacao?.usuarios as
    | { nome: string; sobrenome: string }
    | { nome: string; sobrenome: string }[]
    | null
    | undefined;
  const nomeUsuarioImportacao = Array.isArray(usuarioImportacao) ? usuarioImportacao[0] : usuarioImportacao;

  return (
    <AppShell titulo="Base GSPN" perfil={perfil}>
      <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>
        Importe a exportação do sistema Samsung GSPN. O sistema casa cada chamado pela OS Reparadora e atualiza as
        peças (peça 1 a 10) da tabela de orçamentos automaticamente.
      </p>

      {podeImportarGspn(perfil) && (
        <div className="mb-6">
          <ImportarGspnForm />
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        <div
          className="rounded-xl border px-4 py-3 text-sm"
          style={{ background: "var(--surface2)", borderColor: "var(--line)", color: "var(--muted)" }}
        >
          Chamados na Base GSPN: <strong style={{ color: "var(--ink)" }}>{totalChamados ?? 0}</strong>
        </div>
        <div
          className="rounded-xl border px-4 py-3 text-sm"
          style={{ background: "var(--surface2)", borderColor: "var(--line)", color: "var(--muted)" }}
        >
          Última importação:{" "}
          <strong style={{ color: "var(--ink)" }}>
            {ultimaImportacao ? formatarDataHoraBrasilia(ultimaImportacao.importado_em) : "—"}
          </strong>{" "}
          {ultimaImportacao && (
            <>
              por{" "}
              <strong style={{ color: "var(--ink)" }}>
                {nomeUsuarioImportacao ? `${nomeUsuarioImportacao.nome} ${nomeUsuarioImportacao.sobrenome}` : "—"}
              </strong>{" "}
              ({ultimaImportacao.pecas_casadas_orcamento} casaram com orçamento
              {ultimaImportacao.pecas_nao_casadas_orcamento > 0 &&
                `, ${ultimaImportacao.pecas_nao_casadas_orcamento} não casaram`}
              )
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
