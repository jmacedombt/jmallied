"use client";

import type { DadosEtiquetaCaixa } from "@/lib/etiquetas";

/**
 * Prévia visual da etiqueta de caixa (60x40mm) no padrão da Allied
 * (25/11/2026) — reproduz em HTML/CSS o mesmo layout do ZPL do Allied
 * Print Agent (AlliedPrintAgent/etiqueta.py, gerar_zpl_caixa_allied):
 * reparadora + "Caixa X de Y", faixa preta "TIPO - STATUS", NF Retorno
 * grande, NF Peça / NF Serviço (linha em branco quando vazias) e
 * Qtde + NF envio embaixo. Não é pixel-perfect com a Zebra, mas deixa
 * conferir os dados antes de gastar etiqueta.
 */
export default function PreviewEtiquetaCaixa({ dados }: { dados: DadosEtiquetaCaixa }) {
  const vazio = "________";
  return (
    <div
      className="w-full max-w-[360px] rounded-md overflow-hidden select-none font-sans"
      style={{ aspectRatio: "3 / 2", background: "#fff", color: "#000", border: "2px solid #000" }}
    >
      <div className="flex items-start justify-between px-2.5 pt-1.5">
        <p className="text-lg font-black leading-tight truncate mt-1.5">{(dados.reparadora || "J MACEDO").toUpperCase()}</p>
        <div className="text-right shrink-0">
          <p className="text-[8px] font-bold leading-none">CAIXA</p>
          <p className="text-lg font-black leading-tight">
            {dados.caixaAtual || "_"} DE {dados.caixaTotal || "_"}
          </p>
        </div>
      </div>

      <div className="text-center py-1 mt-1" style={{ background: "#000", color: "#fff" }}>
        <p className="text-sm font-black leading-none tracking-wide">
          {dados.tipo} - {dados.status}
        </p>
      </div>

      <div className="px-2.5 pt-1.5 space-y-0.5">
        <p className="text-base font-black leading-tight truncate">NF RETORNO: {dados.nfRetorno || "______"}</p>
        <p className="text-xs font-semibold leading-tight truncate">NF PEÇA: {dados.nfPeca || vazio}</p>
        <p className="text-xs font-semibold leading-tight truncate">NF SERVIÇO: {dados.nfServico || vazio}</p>
      </div>

      <div className="mt-1" style={{ borderTop: "2px solid #000" }} />

      <div className="flex items-start justify-between px-2.5 pt-0.5">
        <div>
          <p className="text-[8px] font-bold leading-none">QTDE</p>
          <p className="text-xl font-black leading-tight">{dados.qtde === "" ? "____" : dados.qtde}</p>
        </div>
        <div className="text-right">
          <p className="text-[8px] font-bold leading-none">NF ENVIO</p>
          <p className="text-base font-black leading-tight">{dados.nfEnvio || "______"}</p>
        </div>
      </div>
    </div>
  );
}
