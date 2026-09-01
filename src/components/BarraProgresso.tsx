export default function BarraProgresso({ percentual, rotulo }: { percentual: number; rotulo: string }) {
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          {rotulo}
        </span>
        <span className="text-xs font-medium" style={{ color: "var(--ink)" }}>
          {percentual}%
        </span>
      </div>
      <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "var(--surface2)" }}>
        <div
          className="h-full rounded-full transition-[width] duration-150 ease-out"
          style={{ width: `${percentual}%`, background: "var(--accent)" }}
        />
      </div>
    </div>
  );
}
