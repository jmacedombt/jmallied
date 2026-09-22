"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const LIMITE_INATIVIDADE_MS = 60 * 60 * 1000; // 1 hora (pedido explícito)
const INTERVALO_HEARTBEAT_MS = 60 * 1000; // manda "está aberto" a cada 1 min
const INTERVALO_VERIFICACAO_MS = 30 * 1000; // confere a inatividade a cada 30s

const CHAVE_ULTIMA_ATIVIDADE = "allied-ultima-atividade";
export const CHAVE_AVISO_LOGOUT_INATIVIDADE = "allied-logout-por-inatividade";

function agora() {
  return Date.now();
}

function lerUltimaAtividade(): number {
  try {
    const valor = localStorage.getItem(CHAVE_ULTIMA_ATIVIDADE);
    return valor ? Number(valor) : agora();
  } catch {
    return agora();
  }
}

function gravarUltimaAtividade(ts: number) {
  try {
    localStorage.setItem(CHAVE_ULTIMA_ATIVIDADE, String(ts));
  } catch {
    // sem localStorage não dá pra persistir entre abas/reloads, mas não quebra a tela
  }
}

const EVENTOS_DE_INTERACAO: (keyof WindowEventMap)[] = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"];

/**
 * Encerra a sessão sozinho depois de 1 hora sem NENHUMA interação
 * (mouse, teclado, clique, rolagem ou toque) — pedido explícito, vale
 * pra qualquer login, inclusive ALLIED. Montado uma vez dentro do
 * AppShell (presente em toda tela autenticada).
 *
 * O relógio da inatividade fica em localStorage, não em estado do
 * componente — o AppShell remonta a cada navegação entre páginas (cada
 * page.tsx renderiza o seu próprio <AppShell>), então guardar só em
 * memória reiniciaria a contagem a cada clique num link do menu. Usando
 * localStorage a contagem segue corrida "por trás" e, de brinde, fica
 * sincronizada entre abas abertas do mesmo navegador (mexeu em
 * qualquer uma, todas resetam).
 *
 * Em paralelo, manda um "heartbeat" pro banco a cada 1 minuto — é só
 * isso que alimenta "Usuários Online" (ver PainelUsuariosOnline.tsx);
 * continua batendo mesmo se a pessoa só estiver lendo a tela sem mexer
 * o mouse, então "online" aqui quer dizer "com o sistema aberto", não
 * "digitando neste exato segundo" — o corte de 1h de inatividade é um
 * conceito separado, tratado só pelos eventos de interação acima.
 */
export default function InactivityGuard() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    gravarUltimaAtividade(agora());
    fetch("/api/auth/heartbeat", { method: "POST" }).catch(() => {});

    function registrarInteracao() {
      gravarUltimaAtividade(agora());
    }

    EVENTOS_DE_INTERACAO.forEach((evento) => window.addEventListener(evento, registrarInteracao, { passive: true }));

    const heartbeat = setInterval(() => {
      fetch("/api/auth/heartbeat", { method: "POST" }).catch(() => {});
    }, INTERVALO_HEARTBEAT_MS);

    const verificacao = setInterval(async () => {
      if (agora() - lerUltimaAtividade() < LIMITE_INATIVIDADE_MS) return;

      try {
        sessionStorage.setItem(CHAVE_AVISO_LOGOUT_INATIVIDADE, "1");
      } catch {
        // segue mesmo sem conseguir gravar o aviso — só não mostra a mensagem na tela de login
      }
      await supabase.auth.signOut();
      router.push("/login");
    }, INTERVALO_VERIFICACAO_MS);

    return () => {
      EVENTOS_DE_INTERACAO.forEach((evento) => window.removeEventListener(evento, registrarInteracao));
      clearInterval(heartbeat);
      clearInterval(verificacao);
    };
  }, [router]);

  return null;
}
