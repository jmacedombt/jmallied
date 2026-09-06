import { ClipboardList, RefreshCcw } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import AppShell from "@/components/AppShell";
import CardResumo from "@/components/CardResumo";
import ImportarGspnForm from "@/components/ImportarGspnForm";
import HistoricoImportacoesGspn, { type ImportacaoGspn } from "@/components/HistoricoImportacoesGspn";
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

  type ImportacaoBruta = {
    id: string;
    arquivo_nome: string;
    importado_em: string;
    linhas_no_arquivo: number;
    linhas_invalidas: number;
    chamados_novos: number;
    chamados_atualizados: number;
    pecas_casadas_orcamento: number;
    pecas_nao_casadas_orcamento: number;
    usuarios: { nome: string; sobrenome: string } | { nome: string; sobrenome: string }[] | null;
  };

  const [{ count: totalChamados }, { data: ultimaImportacao }, { data: historicoBruto }] = await Promise.all([
    supabase.from("gspn_chamados").select("id", { count: "exact", head: true }),
    supabase
      .from("gspn_importacoes")
      .select(
        "importado_em, chamados_novos, chamados_atualizados, pecas_casadas_orcamento, pecas_nao_casadas_orcamento, usuarios:importado_por (nome, sobrenome)"
      )
      .order("importado_em", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("gspn_importacoes")
      .select(
        "id, arquivo_nome, importado_em, linhas_no_arquivo, linhas_invalidas, chamados_novos, chamados_atualizados, pecas_casadas_orcamento, pecas_nao_casadas_orcamento, usuarios:importado_por (nome, sobrenome)"
      )
      .order("importado_em", { ascending: false })
      .limit(200) as unknown as Promise<{ data: ImportacaoBruta[] | null }>,
  ]);

  const usuarioImportacao = ultimaImportacao?.usuarios as
    | { nome: string; sobrenome: string }
    | { nome: string; sobrenome: string }[]
    | null
    | undefined;
  const nomeUsuarioImportacao = Array.isArray(usuarioImportacao) ? usuarioImportacao[0] : usuarioImportacao;

  const historico: ImportacaoGspn[] = (historicoBruto ?? []).map((h) => {
    const usuario = Array.isArray(h.usuarios) ? h.usuarios[0] : h.usuarios;
    return {
      id: h.id,
      arquivo_nome: h.arquivo_nome,
      importado_em: h.importado_em,
      linhas_no_arquivo: h.linhas_no_arquivo,
      linhas_invalidas: h.linhas_invalidas,
      chamados_novos: h.chamados_novos,
      chamados_atualizados: h.chamados_atualizados,
      pecas_casadas_orcamento: h.pecas_casadas_orcamento,
      pecas_nao_casadas_orcamento: h.pecas_nao_casadas_orcamento,
      usuario: usuario ?? null,
    };
  });

  return (
    <AppShell
      titulo="Base GSPN"
      perfil={perfil}
      tituloInfo="Importe a exportação do sistema Samsung GSPN. O sistema casa cada chamado pela OS Reparadora e atualiza as peças (peça 1 a 10) da tabela de orçamentos automaticamente."
    >
      {/* Carregar base + os 2 cards de resumo, todos na mesma linha
          (quebra responsivamente em telas menores). */}
      <div className="flex flex-wrap items-start gap-4 mb-6">
        {podeImportarGspn(perfil) && (
          <div className="flex-[1.4] min-w-[320px]">
            <ImportarGspnForm />
          </div>
        )}
        <div className="flex-1 min-w-[220px]">
          <CardResumo icone={ClipboardList} label="Chamados na Base GSPN" valor={totalChamados ?? 0} />
        </div>
        <div className="flex-1 min-w-[220px]">
          <CardResumo
            icone={RefreshCcw}
            label="Última importação"
            valor={ultimaImportacao ? formatarDataHoraBrasilia(ultimaImportacao.importado_em) : "—"}
            sub={
              ultimaImportacao
                ? `${nomeUsuarioImportacao ? `por ${nomeUsuarioImportacao.nome} ${nomeUsuarioImportacao.sobrenome} · ` : ""}${ultimaImportacao.pecas_casadas_orcamento} casaram${ultimaImportacao.pecas_nao_casadas_orcamento > 0 ? `, ${ultimaImportacao.pecas_nao_casadas_orcamento} não casaram` : ""}`
                : undefined
            }
          />
        </div>
      </div>

      <HistoricoImportacoesGspn historico={historico} />
    </AppShell>
  );
}
