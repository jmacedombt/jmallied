"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Recarrega os dados da página (router.refresh, sem perder o que está na
 * tela) quando a pessoa volta pra aba/janela e a cada `intervaloMs`
 * enquanto a aba estiver visível (pedido explícito, 04/11/2026 — uma
 * correção de NF feita numa máquina tem que aparecer nas outras sem
 * precisar apertar F5).
 */
// 07/11/2026: sem o relógio de 1 min (consumia CPU na Vercel o dia todo);
// atualiza só quando a pessoa volta pra aba/janela. intervaloMs=0 = desligado.
export default function AtualizarAoVoltar({ intervaloMs = 0 }: { intervaloMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    let ultima = Date.now();
    function atualizar() {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - ultima < 5000) return;
      ultima = Date.now();
      router.refresh();
    }
    document.addEventListener("visibilitychange", atualizar);
    window.addEventListener("focus", atualizar);
    const timer = intervaloMs > 0 ? window.setInterval(atualizar, intervaloMs) : undefined;
    return () => {
      document.removeEventListener("visibilitychange", atualizar);
      window.removeEventListener("focus", atualizar);
      window.clearInterval(timer);
    };
  }, [router, intervaloMs]);
  return null;
}
