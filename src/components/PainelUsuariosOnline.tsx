"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CircleUser, Loader2, Users } from "lucide-react";
import { formatarDataHoraBrasilia } from "@/lib/tempo";

type UsuarioOnline = {
  id: string;
  nome: string;
  sobrenome: string;
  cargo: string;
  ultimoLoginEm: string | null;
  ultimaAtividadeEm: string | null;
};

const INTERVALO_ATUALIZACAO_MS = 30 * 1000;

/**
 * Tela "Usuários Online" (menu, item avulso ao lado de "Início" —
 * pedido explícito, visível pra todo login, menos ALLIED — ver
 * AppShell.tsx e migration 0058): quem está com o sistema aberto agora
 * (heartbeat nos últimos 5 minutos), com data/hora do login. Atualiza
 * sozinha a cada 30s, sem precisar recarregar a página.
 */
export default function PainelUsuariosOnline() {
  const [usuarios, setUsuarios] = useState<UsuarioOnline[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function carregar() {
    try {
      const res = await fetch("/api/usuarios/online");
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErro(data?.error || "Não foi possível carregar os usuários online.");
        return;
      }
      setErro(null);
      setUsuarios(data.usuarios);
    } catch {
      setErro("Falha de conexão. Tente novamente.");
    }
  }

  useEffect(() => {
    carregar();
    const intervalo = setInterval(carregar, INTERVALO_ATUALIZACAO_MS);
    return () => clearInterval(intervalo);
  }, []);

  return (
    <div className="space-y-4">
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        Quem está com o sistema aberto neste momento, com a data e hora em que entrou. A lista se atualiza sozinha a
        cada 30 segundos.
      </p>

      {erro && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 flex items-start gap-2">
          <AlertTriangle size={15} className="shrink-0 mt-0.5" />
          {erro}
        </p>
      )}

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--line)" }}>
        {usuarios === null ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm" style={{ color: "var(--muted)" }}>
            <Loader2 size={16} className="animate-spin" />
            Carregando...
          </div>
        ) : usuarios.length === 0 ? (
          <p className="text-center py-10 text-sm" style={{ color: "var(--muted)" }}>
            Ninguém com o sistema aberto no momento.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
                <th className="px-4 py-2.5 font-medium">Usuário</th>
                <th className="px-4 py-2.5 font-medium">Cargo</th>
                <th className="px-4 py-2.5 font-medium">Login em</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.id} className="border-t" style={{ borderColor: "var(--line)" }}>
                  <td className="px-4 py-2.5 font-medium flex items-center gap-1.5" style={{ color: "var(--ink)" }}>
                    <CircleUser size={14} style={{ color: "#16a34a" }} />
                    {u.nome} {u.sobrenome}
                  </td>
                  <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>
                    {u.cargo}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap" style={{ color: "var(--muted)" }}>
                    {u.ultimoLoginEm ? formatarDataHoraBrasilia(u.ultimoLoginEm) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {usuarios && usuarios.length > 0 && (
        <p className="text-xs flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
          <Users size={12} />
          {usuarios.length} usuário(s) online agora.
        </p>
      )}
    </div>
  );
}
