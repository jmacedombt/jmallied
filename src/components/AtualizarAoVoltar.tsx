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
export default function AtualizarAoVoltar({ intervaloMs = 60000 }: { intervaloMs?: number }) {
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
    const timer = window.setInterval(atualizar, intervaloMs);
    return () => {
      document.removeEventListener("visibilitychange", atualizar);
      window.removeEventListener("focus", atualizar);
      window.clearInterval(timer);
    };
  }, [router, intervaloMs]);
  return null;
}
