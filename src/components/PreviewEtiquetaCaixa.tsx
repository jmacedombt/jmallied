"use client";

import type { DadosEtiquetaCaixa } from "@/lib/etiquetas";

/**
 * Prévia da etiqueta de caixa (60x40mm = 480x320 dots) no padrão da
 * Allied. Desenhada em SVG com AS MESMAS coordenadas do ZPL do Allied
 * Print Agent (AlliedPrintAgent/etiqueta.py, gerar_zpl_caixa_allied) —
 * mudou lá, mudar aqui. A fonte da Zebra é condensada, então larguras de
 * texto podem variar um pouco, mas a distribuição na etiqueta é a mesma.
 */
const FONTE = "'Arial Narrow', 'Roboto Condensed', 'Helvetica Neue', Arial, sans-serif";

function IconeDocumento({ x, y }: { x: number; y: number }) {
  return (
    <g fill="none" stroke="#000" strokeWidth={2}>
      <rect x={x + 1} y={y + 1} width={16} height={22} />
      <line x1={x + 4} y1={y + 8} x2={x + 14} y2={y + 8} />
      <line x1={x + 4} y1={y + 13} x2={x + 14} y2={y + 13} />
      <line x1={x + 4} y1={y + 18} x2={x + 11} y2={y + 18} />
    </g>
  );
}

function IconeEngrenagem({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <circle cx={x + 11} cy={y + 11} r={5} fill="none" stroke="#000" strokeWidth={4} />
      <rect x={x + 9} y={y} width={4} height={5} fill="#000" />
      <rect x={x + 9} y={y + 17} width={4} height={5} fill="#000" />
      <rect x={x} y={y + 9} width={5} height={4} fill="#000" />
      <rect x={x + 17} y={y + 9} width={5} height={4} fill="#000" />
    </g>
  );
}

function IconeChave({ x, y }: { x: number; y: number }) {
  return (
    <g>
      <line x1={x + 2} y1={y + 20} x2={x + 14} y2={y + 8} stroke="#000" strokeWidth={5} strokeLinecap="round" />
      <circle cx={x + 16.5} cy={y + 5.5} r={4} fill="none" stroke="#000" strokeWidth={4} />
    </g>
  );
}

function IconeCaixa({ x, y }: { x: number; y: number }) {
  return (
    <g fill="none" stroke="#000" strokeWidth={2}>
      <rect x={x + 1} y={y + 1} width={28} height={6} />
      <rect x={x + 3} y={y + 7} width={24} height={18} />
      <rect x={x + 11} y={y + 11} width={8} height={3} fill="#000" />
    </g>
  );
}

export default function PreviewEtiquetaCaixa({ dados }: { dados: DadosEtiquetaCaixa }) {
  const m = 14;
  const largura = 480;
  const reparadora = (dados.reparadora || "J MACEDO").toUpperCase();
  const status = String(dados.status || "").toUpperCase();
  const faixa = `${dados.tipo} - ${status}`;
  const alturaTxt = faixa.length <= 19 ? 38 : 32;
  const aprovado = status === "APROVADO";
  const vazio = "__________";
  const qtde = dados.qtde === "" || dados.qtde == null ? "____" : String(dados.qtde);

  return (
    <svg
      viewBox="0 0 480 320"
      className="w-full max-w-[380px] rounded-md select-none"
      style={{ background: "#fff", border: "2px solid #000" }}
      role="img"
      aria-label="Prévia da etiqueta de caixa"
      fontFamily={FONTE}
      fontWeight={700}
    >
      {/* reparadora + caixa */}
      <text x={m} y={20 + 34} fontSize={40} fontWeight={800}>
        {reparadora}
      </text>
      <text x={largura - m} y={6 + 15} fontSize={18} textAnchor="end">
        CAIXA
      </text>
      <text x={largura - m} y={24 + 32} fontSize={38} fontWeight={800} textAnchor="end">
        {dados.caixaAtual || "_"} DE {dados.caixaTotal || "_"}
      </text>

      {/* faixa preta: ícone de status + TIPO - STATUS */}
      <rect x={0} y={68} width={largura} height={56} fill="#000" />
      <circle cx={m + 2 + 18} cy={68 + 10 + 18} r={16} fill="none" stroke="#fff" strokeWidth={4} />
      {aprovado ? (
        <polyline
          points={`${m + 11},${96} ${m + 18},${103} ${m + 29},${88}`}
          fill="none"
          stroke="#fff"
          strokeWidth={4}
          strokeLinecap="round"
        />
      ) : (
        <g stroke="#fff" strokeWidth={4} strokeLinecap="round">
          <line x1={m + 13} y1={89} x2={m + 27} y2={103} />
          <line x1={m + 27} y1={89} x2={m + 13} y2={103} />
        </g>
      )}
      {/* a fonte da Zebra é condensada; aqui reduz um pouco pra não encostar no ícone */}
      <text
        x={56 + (largura - 56 - m) / 2}
        y={68 + 28 + alturaTxt * 0.3}
        fontSize={alturaTxt * 0.86}
        fill="#fff"
        textAnchor="middle"
        fontWeight={800}
        style={{ fontStretch: "condensed" }}
      >
        {faixa}
      </text>

      {/* NFs */}
      <IconeDocumento x={m} y={140} />
      <text x={m + 30} y={136 + 32} fontSize={38} fontWeight={800}>
        NF RETORNO: {dados.nfRetorno || "______"}
      </text>
      <IconeEngrenagem x={m - 2} y={186} />
      <text x={m + 30} y={186 + 20} fontSize={24} fontWeight={600}>
        NF PEÇA: {dados.nfPeca || vazio}
      </text>
      <IconeChave x={m - 2} y={220} />
      <text x={m + 30} y={220 + 20} fontSize={24} fontWeight={600}>
        NF SERVIÇO: {dados.nfServico || vazio}
      </text>

      {/* rodapé */}
      <rect x={0} y={256} width={largura} height={3} fill="#000" />
      <IconeCaixa x={m} y={274} />
      <text x={m + 40} y={262 + 14} fontSize={16}>
        QTDE
      </text>
      <text x={m + 40} y={278 + 33} fontSize={38} fontWeight={800}>
        {qtde}
      </text>
      <text x={largura - m} y={262 + 14} fontSize={16} textAnchor="end">
        NF ENVIO
      </text>
      <text x={largura - m} y={278 + 33} fontSize={38} fontWeight={800} textAnchor="end">
        {dados.nfEnvio || "______"}
      </text>
    </svg>
  );
}
