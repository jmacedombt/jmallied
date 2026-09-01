"use client";

import { useEffect, useRef, useState } from "react";
import { Palette } from "lucide-react";
import {
  COR_PADRAO_ACCENT,
  COR_PADRAO_ACCENT2,
  TONS_PADRAO,
  corParaGlow,
  corPrincipal,
  corSecundaria,
} from "@/lib/cor";

const TAMANHO_RODA = 176;

function aplicarCores(accent: string, accent2: string) {
  const raiz = document.documentElement;
  raiz.style.setProperty("--accent", accent);
  raiz.style.setProperty("--accent2", accent2);
  raiz.style.setProperty("--accent-glow", corParaGlow(accent2));
}

function salvarPreferencia(accent: string, accent2: string, padrao: boolean) {
  try {
    localStorage.setItem("allied-cor-accent", accent);
    localStorage.setItem("allied-cor-accent2", accent2);
    localStorage.setItem("allied-cor-padrao", padrao ? "1" : "0");
  } catch {
    // localStorage indisponível — segue sem persistir
  }
}

export default function ColorPickerSistema() {
  const [aberto, setAberto] = useState(false);
  const [padraoJMacedo, setPadraoJMacedo] = useState(true);
  const [hue, setHue] = useState(219);
  const [intensidade, setIntensidade] = useState(0.5);
  const rodaRef = useRef<HTMLDivElement>(null);
  const arrastando = useRef(false);

  useEffect(() => {
    try {
      const salvo = localStorage.getItem("allied-cor-padrao");
      const accentSalvo = localStorage.getItem("allied-cor-accent");
      const accent2Salvo = localStorage.getItem("allied-cor-accent2");
      if (salvo === "0" && accentSalvo && accent2Salvo) {
        setPadraoJMacedo(false);
      }
    } catch {
      // segue com o padrão
    }
  }, []);

  function moverParaPosicao(clientX: number, clientY: number) {
    const el = rodaRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
    const y = Math.min(Math.max(clientY - rect.top, 0), rect.height);
    const novoHue = Math.round((x / rect.width) * 360);
    const novaIntensidade = 1 - y / rect.height;
    setHue(novoHue);
    setIntensidade(novaIntensidade);

    const accent = corPrincipal(novoHue, novaIntensidade);
    const accent2 = corSecundaria(novoHue, novaIntensidade);
    setPadraoJMacedo(false);
    aplicarCores(accent, accent2);
    salvarPreferencia(accent, accent2, false);
  }

  function aplicarPreset(accent: string, accent2: string) {
    setPadraoJMacedo(false);
    aplicarCores(accent, accent2);
    salvarPreferencia(accent, accent2, false);
  }

  function alternarPadrao(usarPadrao: boolean) {
    setPadraoJMacedo(usarPadrao);
    if (usarPadrao) {
      aplicarCores(COR_PADRAO_ACCENT, COR_PADRAO_ACCENT2);
      salvarPreferencia(COR_PADRAO_ACCENT, COR_PADRAO_ACCENT2, true);
    } else {
      const accent = corPrincipal(hue, intensidade);
      const accent2 = corSecundaria(hue, intensidade);
      aplicarCores(accent, accent2);
      salvarPreferencia(accent, accent2, false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-label="Cor do sistema"
        title="Cor do sistema"
        className="w-9 h-9 flex items-center justify-center rounded-full border transition"
        style={{ borderColor: "var(--line)", color: "var(--muted)" }}
      >
        <Palette size={16} />
      </button>

      {aberto && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setAberto(false)} />
          <div
            className="absolute right-0 top-11 z-40 w-80 rounded-xl border shadow-2xl p-5"
            style={{ background: "var(--surface)", borderColor: "var(--line)" }}
          >
            <p className="text-sm font-semibold mb-1" style={{ color: "var(--ink)" }}>
              Cor do sistema
            </p>
            <p className="text-xs mb-4" style={{ color: "var(--muted)" }}>
              Selecione uma família e uma tonalidade. Esquerda/direita muda a cor; cima/baixo muda a
              intensidade.
            </p>

            <div className="flex justify-center mb-4">
              <div
                ref={rodaRef}
                onPointerDown={(e) => {
                  arrastando.current = true;
                  (e.target as HTMLElement).setPointerCapture(e.pointerId);
                  moverParaPosicao(e.clientX, e.clientY);
                }}
                onPointerMove={(e) => {
                  if (arrastando.current) moverParaPosicao(e.clientX, e.clientY);
                }}
                onPointerUp={() => {
                  arrastando.current = false;
                }}
                className="relative rounded-full cursor-crosshair select-none"
                style={{
                  width: TAMANHO_RODA,
                  height: TAMANHO_RODA,
                  background:
                    "linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
                }}
              >
                <div
                  className="absolute inset-0 rounded-full pointer-events-none"
                  style={{
                    background: "linear-gradient(to bottom, rgba(255,255,255,0.85), rgba(255,255,255,0) 48%, rgba(0,0,0,0.75))",
                  }}
                />
                {!padraoJMacedo && (
                  <div
                    className="absolute w-3.5 h-3.5 rounded-full border-2 border-white pointer-events-none"
                    style={{
                      left: `${(hue / 360) * 100}%`,
                      top: `${(1 - intensidade) * 100}%`,
                      transform: "translate(-50%, -50%)",
                      boxShadow: "0 0 0 1px rgba(0,0,0,0.4)",
                    }}
                  />
                )}
              </div>
            </div>

            <div className="flex justify-center gap-1.5 mb-4">
              {TONS_PADRAO.map((tom) => (
                <button
                  key={tom.numero}
                  type="button"
                  title={`Tom ${tom.numero}`}
                  onClick={() => aplicarPreset(tom.accent, tom.accent2)}
                  className="w-6 h-6 rounded-full border-2 border-white/40 flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                  style={{ background: tom.accent }}
                >
                  {tom.numero}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => alternarPadrao(!padraoJMacedo)}
              className="w-full flex items-center gap-3 rounded-lg border px-3 py-2.5 text-left"
              style={{ borderColor: "var(--line)" }}
            >
              <span
                className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition"
                style={{ background: padraoJMacedo ? "var(--accent)" : "var(--line)" }}
              >
                <span
                  className="inline-block h-4 w-4 transform rounded-full bg-white transition"
                  style={{ transform: padraoJMacedo ? "translateX(18px)" : "translateX(2px)" }}
                />
              </span>
              <span>
                <p className="text-xs font-medium" style={{ color: "var(--ink)" }}>
                  Padrão J.Macedo
                </p>
                <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                  Azul oficial do sistema
                </p>
              </span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}
