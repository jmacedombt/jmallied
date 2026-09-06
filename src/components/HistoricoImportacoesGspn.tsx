import { formatarDataHoraBrasilia } from "@/lib/tempo";

export type ImportacaoGspn = {
  id: string;
  arquivo_nome: string;
  importado_em: string;
  linhas_no_arquivo: number;
  linhas_invalidas: number;
  chamados_novos: number;
  chamados_atualizados: number;
  pecas_casadas_orcamento: number;
  pecas_nao_casadas_orcamento: number;
  usuario: { nome: string; sobrenome: string } | null;
};

const CABECALHOS = [
  "Arquivo",
  "Importado em",
  "Por",
  "Novos",
  "Atualizados",
  "Casaram",
  "Não casaram",
  "Inválidas",
];

// Histórico de todas as importações já feitas na Base GSPN (tabela
// gspn_importacoes, migration 0011) — antes só a última aparecia num
// card resumido; agora dá pra ver a relação inteira.
export default function HistoricoImportacoesGspn({ historico }: { historico: ImportacaoGspn[] }) {
  return (
    <div
      className="rounded-xl border overflow-hidden mt-6"
      style={{ borderColor: "var(--line)", background: "var(--surface)" }}
    >
      <div className="px-5 py-4 border-b" style={{ borderColor: "var(--line)" }}>
        <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
          Histórico de importações
        </p>
      </div>

      {historico.length === 0 ? (
        <p className="text-sm py-10 text-center" style={{ color: "var(--muted)" }}>
          Nenhuma importação registrada ainda.
        </p>
      ) : (
        <div className="overflow-auto max-h-[480px]">
          <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr className="text-left">
                {CABECALHOS.map((titulo) => (
                  <th
                    key={titulo}
                    className="sticky top-0 z-10 px-4 py-2.5 font-medium whitespace-nowrap"
                    style={{ background: "var(--surface2)", color: "var(--muted)" }}
                  >
                    {titulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {historico.map((imp) => (
                <tr key={imp.id} className="border-t" style={{ borderColor: "var(--line)" }}>
                  <td
                    className="px-4 py-2.5 max-w-[240px] truncate"
                    style={{ color: "var(--ink)" }}
                    title={imp.arquivo_nome}
                  >
                    {imp.arquivo_nome}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "var(--ink)" }}>
                    {formatarDataHoraBrasilia(imp.importado_em)}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "var(--muted)" }}>
                    {imp.usuario ? `${imp.usuario.nome} ${imp.usuario.sobrenome}` : "—"}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "var(--ink)" }}>
                    {imp.chamados_novos}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "var(--ink)" }}>
                    {imp.chamados_atualizados}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap font-medium" style={{ color: "#22c55e" }}>
                    {imp.pecas_casadas_orcamento}
                  </td>
                  <td
                    className="px-4 py-2.5 whitespace-nowrap font-medium"
                    style={{ color: imp.pecas_nao_casadas_orcamento > 0 ? "#f59e0b" : "var(--muted)" }}
                  >
                    {imp.pecas_nao_casadas_orcamento}
                  </td>
                  <td
                    className="px-4 py-2.5 whitespace-nowrap"
                    style={{ color: imp.linhas_invalidas > 0 ? "#ef4444" : "var(--muted)" }}
                  >
                    {imp.linhas_invalidas}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
