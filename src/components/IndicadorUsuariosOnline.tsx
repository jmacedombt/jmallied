"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CircleUser, Loader2 } from "lucide-react";
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
 * "Usuários Online" (pedido explícito) — não é mais item de menu: um
 * bullet verde com brilho e "pulso" de ligado, ao lado do nome do
 * usuário no cabeçalho. Clicar abre um pop-up com a lista de quem está
 * com o sistema aberto agora, cargo e data/hora do login — mesma fonte
 * de dado de antes (/api/usuarios/online, que já devolve lista vazia
 * pro cargo ALLIED — ver migration 0058_usuarios_online_e_atividade.sql
 * e lib/presenca.ts). AppShell.tsx só renderiza esse componente pra
 * quem não é ALLIED.
 */
export default function IndicadorUsuariosOnline() {
  const [aberto, setAberto] = useState(false);
  const [usuarios, setUsuarios] = useState<UsuarioOnline[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

  // busca ao montar e a cada 30s, mesmo com o pop-up fechado — assim o
  // número de usuários já está pronto assim que alguém clica no bullet.
  useEffect(() => {
    carregar();
    const intervalo = setInterval(carregar, INTERVALO_ATUALIZACAO_MS);
    return () => clearInterval(intervalo);
  }, []);

  useEffect(() => {
    if (!aberto) return;
    function aoClicarFora(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setAberto(false);
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, [aberto]);

  const quantidade = usuarios?.length ?? 0;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        title={`${quantidade} usuário(s) online agora — clique pra ver a lista`}
        aria-label="Usuários online"
        className="flex items-center justify-center w-7 h-7 rounded-full transition hover:bg-[var(--surface2)]"
      >
        <span className="relative flex h-2.5 w-2.5">
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
            style={{ background: "#22c55e" }}
          />
          <span
            className="relative inline-flex h-2.5 w-2.5 rounded-full"
            style={{ background: "#22c55e", boxShadow: "0 0 6px 1px rgba(34, 197, 94, 0.8)" }}
          />
        </span>
      </button>

      {aberto && (
        <div
          className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto rounded-xl border shadow-2xl z-30"
          style={{ background: "var(--surface)", borderColor: "var(--line)" }}
        >
          <div
            className="px-4 py-3 border-b flex items-center justify-between sticky top-0"
            style={{ borderColor: "var(--line)", background: "var(--surface)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
              Usuários online
            </p>
            <span className="text-[11px]" style={{ color: "var(--muted)" }}>
              {quantidade} agora
            </span>
          </div>

          {erro && (
            <p className="text-xs text-red-400 px-4 py-3 flex items-start gap-1.5">
              <AlertTriangle size={13} className="shrink-0 mt-0.5" />
              {erro}
            </p>
          )}

          {usuarios === null ? (
            <div className="flex items-center justify-center gap-2 py-8 text-xs" style={{ color: "var(--muted)" }}>
              <Loader2 size={14} className="animate-spin" />
              Carregando...
            </div>
          ) : usuarios.length === 0 ? (
            <p className="text-center py-8 text-xs" style={{ color: "var(--muted)" }}>
              Ninguém com o sistema aberto no momento.
            </p>
          ) : (
            usuarios.map((u, i) => (
              <div
                key={u.id}
                className="px-4 py-2.5 flex items-center gap-2"
                style={i > 0 ? { borderTop: "1px solid var(--line)" } : undefined}
              >
                <CircleUser size={16} style={{ color: "#16a34a" }} className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate" style={{ color: "var(--ink)" }}>
                    {u.nome} {u.sobrenome}
                  </p>
                  <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                    {u.cargo}
                  </p>
                </div>
                <p className="text-[11px] whitespace-nowrap text-right" style={{ color: "var(--muted)" }}>
                  {u.ultimoLoginEm ? formatarDataHoraBrasilia(u.ultimoLoginEm) : "—"}
                </p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
