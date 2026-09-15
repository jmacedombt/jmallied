"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Info, LayoutGrid, ShieldPlus } from "lucide-react";
import PopupNovoCargoCustomizado from "@/components/PopupNovoCargoCustomizado";
import { type ResumoAcessoCargo } from "@/lib/cargos";

export type CargoCustomizadoLinha = {
  id: string;
  nome: string;
  descricao: string | null;
  criado_em: string;
};

function CardCargo({
  nome,
  modulos,
  extras,
  observacao,
}: {
  nome: string;
  modulos: string[];
  extras: string[];
  observacao?: string | null;
}) {
  return (
    <div
      className="rounded-xl border p-5"
      style={{
        background: "linear-gradient(155deg, var(--surface2), var(--surface))",
        borderColor: "var(--line)",
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <LayoutGrid size={17} style={{ color: "var(--accent2)" }} />
        <span className="text-base font-bold" style={{ color: "var(--ink)" }}>
          {nome}
        </span>
      </div>

      <p className="text-[11px] font-medium uppercase tracking-wide mb-1.5" style={{ color: "var(--muted)" }}>
        Módulos
      </p>
      {modulos.length === 0 ? (
        <p className="text-sm mb-3" style={{ color: "var(--muted)" }}>
          Nenhum módulo implementado ainda.
        </p>
      ) : (
        <ul className="text-sm mb-3 space-y-1">
          {modulos.map((m) => (
            <li key={m} className="flex items-start gap-1.5" style={{ color: "var(--ink)" }}>
              <span className="mt-1.5 w-1 h-1 rounded-full shrink-0" style={{ background: "var(--accent2)" }} />
              {m}
            </li>
          ))}
        </ul>
      )}

      {extras.length > 0 && (
        <>
          <p className="text-[11px] font-medium uppercase tracking-wide mb-1.5" style={{ color: "var(--muted)" }}>
            Extras
          </p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {extras.map((e) => (
              <span
                key={e}
                className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium"
                style={{ borderColor: "var(--accent2)", color: "var(--accent2)", background: "var(--accent-glow)" }}
              >
                {e}
              </span>
            ))}
          </div>
        </>
      )}

      {observacao && (
        <p className="text-xs leading-snug flex items-start gap-1.5" style={{ color: "var(--muted)" }}>
          <Info size={12} className="shrink-0 mt-0.5" />
          {observacao}
        </p>
      )}
    </div>
  );
}

export default function PainelCargos({
  cargosFixos,
  cargosCustomizados,
  podeGerenciar,
}: {
  cargosFixos: ResumoAcessoCargo[];
  cargosCustomizados: CargoCustomizadoLinha[];
  podeGerenciar: boolean;
}) {
  const router = useRouter();
  const [abrindoNovo, setAbrindoNovo] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          {cargosFixos.length} cargo(s) em uso pelo login + {cargosCustomizados.length} cargo(s) registrado(s) aqui.
        </p>
        {podeGerenciar && (
          <button
            type="button"
            onClick={() => setAbrindoNovo(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] hover:bg-[var(--accent2)] text-white text-sm font-medium px-4 py-2.5 transition"
            style={{ boxShadow: "0 0 40px var(--accent-glow)" }}
          >
            <ShieldPlus size={15} />
            Incluir cargo
          </button>
        )}
      </div>

      <div>
        <p className="text-sm font-semibold mb-3" style={{ color: "var(--ink)" }}>
          Cargos do login
        </p>
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {cargosFixos.map((c) => (
            <CardCargo key={c.cargo} nome={c.cargo} modulos={c.modulos} extras={c.extras} observacao={c.observacao} />
          ))}
        </div>
      </div>

      {cargosCustomizados.length > 0 && (
        <div>
          <p className="text-sm font-semibold mb-3" style={{ color: "var(--ink)" }}>
            Cargos registrados (ainda sem acesso implementado)
          </p>
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--line)" }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left" style={{ background: "var(--surface2)", color: "var(--muted)" }}>
                  <th className="px-4 py-2.5 font-medium">Nome</th>
                  <th className="px-4 py-2.5 font-medium">O que deve acessar</th>
                  <th className="px-4 py-2.5 font-medium">Registrado em</th>
                </tr>
              </thead>
              <tbody>
                {cargosCustomizados.map((c) => (
                  <tr key={c.id} className="border-t" style={{ borderColor: "var(--line)" }}>
                    <td className="px-4 py-2.5 font-medium" style={{ color: "var(--ink)" }}>
                      {c.nome}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>
                      {c.descricao || "—"}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: "var(--muted)" }}>
                      {new Date(c.criado_em).toLocaleDateString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {abrindoNovo && (
        <PopupNovoCargoCustomizado
          onFechar={() => setAbrindoNovo(false)}
          onCriado={() => {
            setAbrindoNovo(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
