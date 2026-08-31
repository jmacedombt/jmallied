"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export default function BotaoTema({ className = "" }: { className?: string }) {
  const [claro, setClaro] = useState(false);

  useEffect(() => {
    setClaro(document.documentElement.classList.contains("light"));
  }, []);

  function alternar() {
    const novo = !claro;
    setClaro(novo);
    document.documentElement.classList.toggle("light", novo);
    try {
      localStorage.setItem("allied-tema", novo ? "light" : "dark");
    } catch {
      // localStorage indisponível, segue sem persistir a preferência
    }
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-label={claro ? "Ativar modo escuro" : "Ativar modo claro"}
      title={claro ? "Modo escuro" : "Modo claro"}
      className={`w-9 h-9 flex items-center justify-center rounded-full border border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)] hover:border-allied-accent2 transition ${className}`}
    >
      {claro ? <Moon size={16} /> : <Sun size={16} />}
    </button>
  );
}
