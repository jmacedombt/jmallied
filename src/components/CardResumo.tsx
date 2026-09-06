// Card de resumo padronizado (ícone destacado + rótulo + valor em
// destaque) — usado nas linhas de indicadores das telas de Bases (Base
// Peças, Base GSPN, ...) pra manter o mesmo visual profissional em todo
// canto que hoje é só um número ou uma frase corrida.
export default function CardResumo({
  icone: Icone,
  label,
  valor,
  sub,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icone: React.ComponentType<any>;
  label: string;
  valor: React.ReactNode;
  sub?: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl border p-5 flex items-start gap-3.5 h-full"
      style={{ background: "var(--surface)", borderColor: "var(--line)" }}
    >
      <div className="rounded-lg p-2.5 shrink-0" style={{ background: "var(--accent-glow)" }}>
        <Icone size={20} style={{ color: "var(--accent2)" }} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide font-medium mb-1" style={{ color: "var(--muted)" }}>
          {label}
        </p>
        <p className="text-xl font-semibold leading-tight truncate" style={{ color: "var(--ink)" }}>
          {valor}
        </p>
        {sub && (
          <p className="text-xs mt-1 truncate" style={{ color: "var(--muted)" }}>
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}
