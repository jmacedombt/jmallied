"use client";

/**
 * Sons do chat interno (pedido explícito) — gerados na hora com a Web
 * Audio API (sem arquivo de áudio nenhum pra carregar/hospedar): um
 * "ping" suave de 2 tons pra mensagem normal, e um alerta mais forte
 * (3 bipes) pra "chamar atenção" (nudge estilo MSN). Silencioso se o
 * navegador não suportar ou bloquear áudio sem interação do usuário —
 * nunca quebra a tela por causa disso.
 */

let contextoAudio: AudioContext | null = null;

function obterContexto(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!contextoAudio) {
      const AudioContextClasse = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClasse) return null;
      contextoAudio = new AudioContextClasse();
    }
    if (contextoAudio.state === "suspended") {
      contextoAudio.resume().catch(() => {});
    }
    return contextoAudio;
  } catch {
    return null;
  }
}

function tocarTom(frequencia: number, inicioSegundos: number, duracaoSegundos: number, volume: number) {
  const ctx = obterContexto();
  if (!ctx) return;
  try {
    const oscilador = ctx.createOscillator();
    const ganho = ctx.createGain();
    oscilador.type = "sine";
    oscilador.frequency.value = frequencia;
    const inicio = ctx.currentTime + inicioSegundos;
    ganho.gain.setValueAtTime(0, inicio);
    ganho.gain.linearRampToValueAtTime(volume, inicio + 0.01);
    ganho.gain.exponentialRampToValueAtTime(0.001, inicio + duracaoSegundos);
    oscilador.connect(ganho);
    ganho.connect(ctx.destination);
    oscilador.start(inicio);
    oscilador.stop(inicio + duracaoSegundos + 0.05);
  } catch {
    // silencioso — som nunca pode quebrar a tela
  }
}

/** Ping suave de 2 tons — mensagem direta normal. */
export function tocarSomMensagem() {
  tocarTom(740, 0, 0.14, 0.16);
  tocarTom(988, 0.1, 0.16, 0.16);
}

/** 3 bipes mais fortes e agudos — "chamar atenção" (nudge). */
export function tocarSomChamarAtencao() {
  tocarTom(880, 0, 0.11, 0.22);
  tocarTom(880, 0.14, 0.11, 0.22);
  tocarTom(880, 0.28, 0.16, 0.22);
}
