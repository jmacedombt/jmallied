"use client";

import { useEffect, useState } from "react";
import { Check, Copy, KeyRound, Link2, UserRound, X } from "lucide-react";

type Props = {
  usuario: string;
  senha: string;
  aoFechar: () => void;
};

function linhaTexto(endereco: string, usuario: string, senha: string) {
  return [
    "Acesso ao Sistema Allied:",
    `Endereço: ${endereco}`,
    `Usuário: ${usuario}`,
    `Senha: ${senha}`,
    "(a senha precisa ser trocada no primeiro acesso)",
  ].join("\n");
}

// Popup exibido logo depois de cadastrar um usuário novo, com o endereço
// do site + login + senha padrão prontos pra copiar e mandar pro usuário
// (WhatsApp, e-mail etc.) — em vez do texto solto que ficava na tela.
export default function PopupNovoUsuario({ usuario, senha, aoFechar }: Props) {
  const [endereco, setEndereco] = useState("");
  const [copiadoTudo, setCopiadoTudo] = useState(false);
  const [campoCopiado, setCampoCopiado] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setEndereco(`${window.location.origin}/login`);
    }
  }, []);

  async function copiar(texto: string, identificador: string) {
    try {
      await navigator.clipboard.writeText(texto);
    } catch {
      return;
    }
    if (identificador === "tudo") {
      setCopiadoTudo(true);
      setTimeout(() => setCopiadoTudo(false), 2000);
    } else {
      setCampoCopiado(identificador);
      setTimeout(() => setCampoCopiado((atual) => (atual === identificador ? null : atual)), 2000);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)" }}>
      <div
        className="w-full max-w-md rounded-2xl border shadow-2xl p-6"
        style={{ background: "var(--surface)", borderColor: "var(--line)" }}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--ink)" }}>
            <UserRound size={18} style={{ color: "var(--accent2)" }} />
            Usuário cadastrado
          </h2>
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="w-7 h-7 flex items-center justify-center rounded-md transition hover:bg-[var(--surface2)]"
            style={{ color: "var(--muted)" }}
          >
            <X size={16} />
          </button>
        </div>
        <p className="text-xs mb-5" style={{ color: "var(--muted)" }}>
          Copie os dados abaixo e mande pro usuário. A senha é obrigatória de trocar no primeiro acesso.
        </p>

        <div className="space-y-3 mb-5">
          <CampoCopiavel
            icone={Link2}
            label="Endereço do site"
            valor={endereco}
            copiado={campoCopiado === "endereco"}
            onCopiar={() => copiar(endereco, "endereco")}
          />
          <CampoCopiavel
            icone={UserRound}
            label="Usuário"
            valor={usuario}
            copiado={campoCopiado === "usuario"}
            onCopiar={() => copiar(usuario, "usuario")}
          />
          <CampoCopiavel
            icone={KeyRound}
            label="Senha temporária"
            valor={senha}
            copiado={campoCopiado === "senha"}
            onCopiar={() => copiar(senha, "senha")}
          />
        </div>

        <button
          type="button"
          onClick={() => copiar(linhaTexto(endereco, usuario, senha), "tudo")}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-medium transition"
          style={{
            background: copiadoTudo ? "#16a34a" : "var(--accent)",
            color: "#fff",
            boxShadow: "0 0 30px var(--accent-glow)",
          }}
        >
          {copiadoTudo ? <Check size={16} /> : <Copy size={16} />}
          {copiadoTudo ? "Copiado! Pode colar e enviar" : "Copiar tudo pra enviar"}
        </button>
      </div>
    </div>
  );
}

function CampoCopiavel({
  icone: Icone,
  label,
  valor,
  copiado,
  onCopiar,
}: {
  icone: typeof Link2;
  label: string;
  valor: string;
  copiado: boolean;
  onCopiar: () => void;
}) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide mb-1 flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
        <Icone size={11} />
        {label}
      </p>
      <div
        className="flex items-center gap-2 rounded-lg border px-3.5 py-2.5"
        style={{ background: "var(--surface2)", borderColor: "var(--line)" }}
      >
        <span className="flex-1 text-sm font-mono truncate" style={{ color: "var(--ink)" }}>
          {valor || "—"}
        </span>
        <button
          type="button"
          onClick={onCopiar}
          title={`Copiar ${label.toLowerCase()}`}
          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md transition hover:bg-[var(--surface)]"
          style={{ color: copiado ? "#22c55e" : "var(--muted)" }}
        >
          {copiado ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
    </div>
  );
}
