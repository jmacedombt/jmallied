"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, History, Loader2 } from "lucide-react";
import { formatarDataHoraBrasilia } from "@/lib/tempo";

type Usuario = { nome: string; sobrenome: string } | { nome: string; sobrenome: string }[] | null;

function nomeUsuario(usuarios: Usuario): string {
  const u = Array.isArray(usuarios) ? usuarios[0] : usuarios;
  return u ? `${u.nome} ${u.sobrenome}` : "—";
}

type Registro = {
  id: string;
  orcamento_id: string | null;
  trade_allied: string;
  os_care_allied: string | null;
  os_reparadora_anterior: string | null;
  os_reparadora_nova: string;
  alterado_em: string;
  usuarios: Usuario;
};

// Tela "Auditoria" (menu Sistema, migration 0070) — histórico de toda
// correção de OS Reparadora feita em Operacional > Consulta/Alteração,
// mais recente primeiro. Só os últimos 60 dias (retenção — ver a rota de
// API, que já filtra por data). Só pro Administrador (is_master).
export default function PainelAuditoria() {
  const [registros, setRegistros] = useState<Registro[] | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch("/api/sistema/auditoria");
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErro(data?.error || "Não foi possível carregar a auditoria.");
      } else {
        setRegistros(data.registros);
      }
    } catch {
      setErro("Falha de conexão. Tente novamente.");
    }
    setCarregando(false);
  }

  useEffect(() => {
    carregar();
  }, []);

  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        Toda correção de OS Reparadora feita em Operacional &gt; Consulta/Alteração fica registrada aqui, com quem
        alterou e quando. Os registros ficam disponíveis por 60 dias.
      </p>

      {erro && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 flex items-start gap-2">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          {erro}
        </p>
      )}

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--line)" }}>
        {carregando ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm" style={{ color: "var(--muted)" }}>
            <Loader2 size={16} className="animate-spin" />
            Carregando...
          </div>
        ) : !registros || registros.length === 0 ? (
          <p className="text-center py-10 text-sm" style={{ color: "var(--muted)" }}>
            Nenhuma alteração registrada nos últimos 60 dias.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
                <th className="px-4 py-2.5 font-medium">Data/hora</th>
                <th className="px-4 py-2.5 font-medium">Quem alterou</th>
                <th className="px-4 py-2.5 font-medium">Trade Allied</th>
                <th className="px-4 py-2.5 font-medium">OS Care</th>
                <th className="px-4 py-2.5 font-medium">OS Reparadora anterior</th>
                <th className="px-4 py-2.5 font-medium">OS Reparadora nova</th>
              </tr>
            </thead>
            <tbody>
              {registros.map((r) => (
                <tr key={r.id} className="border-t" style={{ borderColor: "var(--line)" }}>
                  <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "var(--ink)" }}>
                    {formatarDataHoraBrasilia(r.alterado_em)}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>
                    {nomeUsuario(r.usuarios)}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: "var(--ink)" }}>
                    {r.trade_allied}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: "var(--ink)" }}>
                    {r.os_care_allied || "—"}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: "var(--ink)" }}>
                    {r.os_reparadora_anterior || "—"}
                  </td>
                  <td className="px-4 py-2.5 font-medium" style={{ color: "var(--ink)" }}>
                    {r.os_reparadora_nova}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {registros && registros.length > 0 && (
        <p className="text-xs flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
          <History size={12} />
          {registros.length} alteração(ões) nos últimos 60 dias.
        </p>
      )}
    </div>
  );
}
