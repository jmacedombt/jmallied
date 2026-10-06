"use client";

/**
 * Prévia visual da etiqueta de OS (60x40mm) — reproduz em HTML/CSS o
 * mesmo layout do ZPL gerado pelo Allied Print Agent (ver
 * AlliedPrintAgent/etiqueta.py, gerar_zpl): cabeçalho J MACEDO/ESC
 * SANTOS, MODELO à esquerda + NF à direita, OS bem grande no centro e
 * UM código de barras (Code128) da OS, centralizado (pedido explícito,
 * 06/10/2026: tirar o código de barras da NF Remessa — não imprime mais
 * — e centralizar o da OS). Não é pixel-perfect com o que sai na Zebra
 * (a "barra" abaixo é só um desenho ilustrativo, não um Code128 de
 * verdade), mas deixa o operador conferir os dados antes de gastar
 * etiqueta — mesmo princípio de PreviewEtiquetaCaixa.
 *
 * Usada só pela Impressão Avulsa (PainelBipagem, modo="avulsa") — Ag.
 * Triagem continua sem prévia, imprime direto (bipagem rápida em
 * sequência, pedido explícito de não mudar esse fluxo).
 */
export default function PreviewEtiquetaOs({
  osReparadora,
  nfRemessaAllied,
  modeloComercial,
}: {
  osReparadora: string;
  nfRemessaAllied: string;
  modeloComercial: string | null;
}) {
  const dataHora = new Date().toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  // Larguras de barra "falsas", só pra parecer um Code128 — derivadas
  // dos dígitos da OS, pra cada prévia ficar com um desenho diferente
  // (não é uma leitura real, só ilustrativo).
  const barras = Array.from(osReparadora || "0").map((c, i) => {
    const n = c.charCodeAt(0);
    return 1 + ((n + i) % 4);
  });

  return (
    <div
      className="w-full rounded-md overflow-hidden select-none"
      style={{ aspectRatio: "3 / 2", background: "#fff", color: "#000", border: "2px solid #000" }}
    >
      <div className="flex items-start justify-between px-2.5 pt-2">
        <p className="text-[9px] font-bold tracking-wide leading-none">J MACEDO ELETRONICA</p>
        <p className="text-[8px] font-bold tracking-wide leading-none">ESC SANTOS</p>
      </div>

      <div className="mt-1.5" style={{ borderTop: "2px solid #000" }} />

      <div className="flex items-start justify-between px-2.5 pt-1.5">
        <div className="min-w-0">
          <p className="text-[7px] font-bold tracking-wide leading-none">MODELO DO APARELHO</p>
          <p className="text-xs font-black leading-none mt-1 truncate max-w-[32vw]">{modeloComercial || "—"}</p>
        </div>
        <div className="min-w-0 text-right">
          <p className="text-[7px] font-bold tracking-wide leading-none">NF</p>
          <p className="text-xs font-black leading-none mt-1 truncate">{nfRemessaAllied || "—"}</p>
        </div>
      </div>

      <div className="mt-1.5" style={{ borderTop: "2px solid #000" }} />

      <div className="text-center px-2 pt-1.5">
        <p className="text-[8px] font-bold tracking-wide leading-none">ORDEM DE SERVIÇO</p>
        <p className="text-2xl font-black leading-none mt-1 truncate">{osReparadora || "—"}</p>
      </div>

      <div className="mt-1.5" style={{ borderTop: "2px solid #000" }} />

      <div className="flex flex-col items-center justify-center px-4 py-2">
        <div className="flex items-end gap-[1.5px] h-7">
          {barras.map((w, i) => (
            <div key={i} style={{ width: `${w}px`, height: "100%", background: "#000" }} />
          ))}
        </div>
        <p className="text-[9px] font-mono tracking-widest leading-none mt-1">{osReparadora || "—"}</p>
      </div>

      <div style={{ borderTop: "2px solid #000" }} />

      <div className="flex items-center justify-between px-2.5 pt-1">
        <p className="text-[7px] leading-none">DATA: {dataHora}</p>
        <p className="text-[7px] leading-none">SAMSUNG ESC SANTOS</p>
      </div>
    </div>
  );
}
