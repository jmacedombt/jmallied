/** Helpers de cor pro seletor "Cor do sistema". */

export function hslParaHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const paraHex = (x: number) =>
    Math.round(255 * x)
      .toString(16)
      .padStart(2, "0");
  return `#${paraHex(f(0))}${paraHex(f(8))}${paraHex(f(4))}`;
}

/** Deriva um segundo tom (mais claro, usado em hovers) a partir do hue escolhido. */
export function corSecundaria(h: number, intensidade: number): string {
  const l = Math.min(78, 45 + intensidade * 30);
  return hslParaHex(h, 78, l);
}

export function corPrincipal(h: number, intensidade: number): string {
  const l = Math.max(22, 20 + intensidade * 45);
  return hslParaHex(h, 72, l);
}

function hexParaRgb(hex: string): [number, number, number] {
  const limpo = hex.replace("#", "");
  const n = parseInt(limpo, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function corParaGlow(hex: string, alpha = 0.28): string {
  const [r, g, b] = hexParaRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// 10 tons pré-definidos da família azul J.Macedo (do escuro pro claro)
export const TONS_PADRAO = Array.from({ length: 10 }, (_, i) => {
  const intensidade = i / 9; // 0 (escuro) .. 1 (claro)
  return {
    numero: i + 1,
    accent: corPrincipal(219, intensidade),
    accent2: corSecundaria(219, intensidade),
  };
});

export const COR_PADRAO_ACCENT = "#2f6fed";
export const COR_PADRAO_ACCENT2 = "#5aa9ff";
