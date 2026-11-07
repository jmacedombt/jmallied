"use client";

import { useEffect, useRef } from "react";

/**
 * Executa `fn` periodicamente, mas economizando processamento na Vercel:
 * usa `visivelMs` enquanto a aba está na tela e `ocultaMs` quando está
 * escondida/minimizada (`null` = para de consultar). Ao voltar pra aba,
 * consulta na hora (se a última foi há mais de 5s). Ver lib/consumo.ts.
 */
export function useIntervaloVisivel(
  fn: () => void | Promise<void>,
  visivelMs: number,
  ocultaMs: number | null,
  ativo = true,
  executarAoMontar = true
) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!ativo) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let ultima = 0;
    let cancelado = false;

    function executar() {
      ultima = Date.now();
      try {
        void fnRef.current();
      } catch {
        // silencioso — tenta de novo no próximo ciclo
      }
    }

    function agendar() {
      if (cancelado) return;
      if (timer) clearTimeout(timer);
      const ms = document.visibilityState === "visible" ? visivelMs : ocultaMs;
      if (ms == null) return;
      timer = setTimeout(() => {
        executar();
        agendar();
      }, ms);
    }

    function aoMudarVisibilidade() {
      if (document.visibilityState === "visible" && Date.now() - ultima > 5000) executar();
      agendar();
    }

    if (executarAoMontar) executar();
    agendar();
    document.addEventListener("visibilitychange", aoMudarVisibilidade);
    return () => {
      cancelado = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", aoMudarVisibilidade);
    };
  }, [visivelMs, ocultaMs, ativo, executarAoMontar]);
}
