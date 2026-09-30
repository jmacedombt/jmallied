"use client";

/**
 * Prévia visual da etiqueta de caixa (60x40mm) — reproduz em HTML/CSS o
 * mesmo layout do ZPL gerado pelo Allied Print Agent (ver
 * AlliedPrintAgent/etiqueta.py, gerar_zpl_caixa): LOTE/VOLUME em cima,
 * NF DE RETORNO grande e em negrito, OBSERVAÇÃO em destaque (fundo
 * preto) e NF DE ENTRADA + data/hora embaixo. Não é pixel-perfect com o
 * que sai na Zebra (fonte/proporções da impressora térmica são outras),
 * mas deixa o operador conferir os dados antes de gastar etiqueta.
 *
 * Compartilhado pelo pop-up "Etiqueta Avulsa" (PopupEtiquetaCaixaAvulsa)
 * e pela confirmação do botão "Etiqueta de Caixa" de cada linha em
 * PainelAgEmissaoNf (PopupConfirmarEtiquetaCaixa).
 */
export default function PreviewEtiquetaCaixa({
  lote,
  volumeAtual,
  volumeTotal,
  nfRetorno,
  observacao,
  nfEntrada,
}: {
  lote: string;
  volumeAtual: string;
  volumeTotal: string;
  nfRetorno: string;
  observacao: "APROVADO" | "REPROVADO";
  nfEntrada: string;
}) {
  const dataHora = new Date().toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className="w-full rounded-md overflow-hidden select-none"
      style={{ aspectRatio: "3 / 2", background: "#fff", color: "#000", border: "2px solid #000" }}
    >
      <div className="flex items-start justify-between px-2.5 pt-2">
        <div className="min-w-0">
          <p className="text-[9px] font-bold tracking-wide leading-none">LOTE</p>
          <p className="text-xl font-black leading-none mt-1 truncate">{lote || "—"}</p>
        </div>
        <div className="min-w-0 text-right">
          <p className="text-[9px] font-bold tracking-wide leading-none">VOLUME</p>
          <p className="text-3xl font-black leading-none mt-1 truncate">
            {volumeAtual || "—"}/{volumeTotal || "—"}
          </p>
        </div>
      </div>

      <div className="mt-2" style={{ borderTop: "2px solid #000" }} />

      <div className="text-center px-2 pt-1.5">
        <p className="text-[9px] font-bold tracking-wide leading-none">NF DE RETORNO</p>
        <p className="text-2xl font-black leading-none mt-1 truncate">{nfRetorno || "—"}</p>
      </div>

      <div className="mt-1.5" style={{ borderTop: "2px solid #000" }} />

      <div className="text-center py-2" style={{ background: "#000", color: "#fff" }}>
        <p className="text-base font-black leading-none tracking-wide">{observacao}</p>
      </div>

      <div style={{ borderTop: "2px solid #000" }} />

      <div className="flex items-start justify-between px-2.5 pt-1.5">
        <div className="min-w-0">
          <p className="text-[8px] font-bold tracking-wide leading-none">NF DE ENTRADA</p>
          <p className="text-sm font-black leading-none mt-1 truncate">{nfEntrada || "—"}</p>
        </div>
        <p className="text-[8px] leading-none mt-0.5 shrink-0">{dataHora}</p>
      </div>
    </div>
  );
}
