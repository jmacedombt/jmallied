export function iniciaisNome(nome: string): string {
  const partes = String(nome || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (partes.length === 0) return "?";
  if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

export default function Avatar({
  nome,
  tamanho = 36,
  className = "",
}: {
  nome: string;
  tamanho?: number;
  className?: string;
}) {
  const estilo = { width: tamanho, height: tamanho, fontSize: tamanho * 0.4 };

  return (
    <div
      style={estilo}
      className={`rounded-full flex items-center justify-center text-white font-semibold shrink-0 bg-allied-accent ${className}`}
    >
      {iniciaisNome(nome)}
    </div>
  );
}
