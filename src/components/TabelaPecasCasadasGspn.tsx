import FiltroRemessaGspn, { type RemessaCasada } from "@/components/FiltroRemessaGspn";

export type PecaCasada = { peca: string; quantidade: number; percentual: number };

// Relação das peças usadas nos chamados que casaram pela OS Reparadora
// (Base GSPN x Base de Orçamentos) — vem da RPC gspn_pecas_casadas
// (migration 0024), opcionalmente filtrada por NF Remessa Allied.
export default function TabelaPecasCasadasGspn({
  linhas,
  remessas,
  remessaSelecionada,
}: {
  linhas: PecaCasada[];
  remessas: RemessaCasada[];
  remessaSelecionada: string | null;
}) {
  const maiorPercentual = Math.max(1, ...linhas.map((l) => l.percentual));

  return (
    <div
      className="rounded-xl border overflow-hidden mt-6"
      style={{ borderColor: "var(--line)", background: "var(--surface)" }}
    >
      <div
        className="flex items-center justify-between gap-3 flex-wrap px-5 py-4 border-b"
        style={{ borderColor: "var(--line)" }}
      >
        <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
          Peças usadas nos chamados casados
        </p>
        <FiltroRemessaGspn remessas={remessas} selecionada={remessaSelecionada} />
      </div>

      {linhas.length === 0 ? (
        <p className="text-sm py-10 text-center" style={{ color: "var(--muted)" }}>
          Nenhum chamado casado com essa OS Reparadora ainda
          {remessaSelecionada ? " nessa remessa." : "."}
        </p>
      ) : (
        <div className="overflow-auto max-h-[480px]">
          <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr className="text-left">
                {["Part Number", "Quantidade", "% de uso"].map((titulo) => (
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
              {linhas.map((l) => (
                <tr key={l.peca} className="border-t" style={{ borderColor: "var(--line)" }}>
                  <td className="px-4 py-2.5 font-mono whitespace-nowrap" style={{ color: "var(--ink)" }}>
                    {l.peca}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "var(--ink)" }}>
                    {l.quantidade}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="h-1.5 flex-1 rounded-full overflow-hidden max-w-[160px]"
                        style={{ background: "var(--surface2)" }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(l.percentual / maiorPercentual) * 100}%`,
                            background: "var(--accent2)",
                          }}
                        />
                      </div>
                      <span className="text-xs font-medium whitespace-nowrap" style={{ color: "var(--muted)" }}>
                        {l.percentual.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                      </span>
                    </div>
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
