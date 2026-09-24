"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  BellRing,
  ChevronLeft,
  Circle,
  Loader2,
  MessageCircle,
  Plus,
  Send,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatarDataHoraBrasilia, formatarHoraBrasilia } from "@/lib/tempo";
import { tocarSomChamarAtencao, tocarSomMensagem } from "@/lib/somNotificacao";

/**
 * Chat interno (pedido explícito, 23/09/2026) — mensagem direta entre
 * qualquer 2 logins (inclusive ALLIED), online ou não, com histórico
 * guardado (some sozinho depois de 60 dias — ver lib/chat.ts) +
 * "chamar atenção" (nudge estilo MSN: som mais forte, balão treme,
 * título da aba pisca e notificação nativa do navegador, se permitida).
 *
 * Ícone fica no cabeçalho (AppShell.tsx), do lado do sininho de
 * notificações e do indicador de "Usuários Online" — visível pra QUALQUER
 * login, sem exceção.
 *
 * Sem Supabase Realtime: atualiza por polling (a cada poucos segundos,
 * ver INTERVALO_POLL_MS) — mais simples de manter e já dá a sensação de
 * "quase instantâneo" pro uso interno do sistema.
 */

type StatusPresenca = "Disponivel" | "Ausente" | "Ocupado";

type UsuarioChat = { id: string; nome: string; sobrenome: string; cargo: string };
type UsuarioOnlineChat = UsuarioChat & { statusManual: StatusPresenca };

type MensagemChat = {
  id: string;
  remetenteId: string;
  destinatarioId: string;
  tipo: "mensagem" | "chamar_atencao";
  texto: string | null;
  enviadoEm: string;
  lidaEm: string | null;
};

type ConversaResumo = { usuario: UsuarioChat; ultimaMensagem: MensagemChat; naoLidas: number };

type Balao = MensagemChat & { balaoId: string; remetenteNome: string };

const INTERVALO_POLL_MS = 4000;
const INTERVALO_ONLINE_MS = 15000;
const TITULO_PISCANDO = "🔴 Nova mensagem";

const ROTULO_STATUS: Record<StatusPresenca, string> = {
  Disponivel: "Disponível",
  Ausente: "Ausente",
  Ocupado: "Ocupado",
};
const COR_STATUS: Record<StatusPresenca, string> = {
  Disponivel: "#22c55e",
  Ausente: "#94a3b8",
  Ocupado: "#ef4444",
};

function nomeCompleto(u: UsuarioChat | undefined): string {
  return u ? `${u.nome} ${u.sobrenome}` : "Alguém";
}

export default function ChatWidget() {
  const [meuId, setMeuId] = useState<string | null>(null);
  const [painelAberto, setPainelAberto] = useState(false);
  const [conversas, setConversas] = useState<ConversaResumo[] | null>(null);
  const [usuarios, setUsuarios] = useState<UsuarioChat[] | null>(null);
  const [onlineMap, setOnlineMap] = useState<Map<string, UsuarioOnlineChat>>(new Map());
  const [meuStatus, setMeuStatus] = useState<StatusPresenca>("Disponivel");
  const [conversaAtivaId, setConversaAtivaId] = useState<string | null>(null);
  const [mensagens, setMensagens] = useState<MensagemChat[] | null>(null);
  const [mostrarNovaConversa, setMostrarNovaConversa] = useState(false);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [totalNaoLidas, setTotalNaoLidas] = useState(0);
  const [baloes, setBaloes] = useState<Balao[]>([]);
  const [permissaoNotificacao, setPermissaoNotificacao] = useState<NotificationPermission | "indisponivel">(
    "default"
  );

  const desdeRef = useRef<string>(new Date().toISOString());
  const conversaAtivaRef = useRef<string | null>(null);
  const painelAbertoRef = useRef(false);
  const rosterRef = useRef<UsuarioChat[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const tituloOriginalRef = useRef<string>("");
  const piscaIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mensagensFimRef = useRef<HTMLDivElement>(null);

  conversaAtivaRef.current = conversaAtivaId;
  painelAbertoRef.current = painelAberto;

  const supabase = createClient();

  function pararPiscaTitulo() {
    if (piscaIntervalRef.current) {
      clearInterval(piscaIntervalRef.current);
      piscaIntervalRef.current = null;
    }
    if (typeof document !== "undefined" && tituloOriginalRef.current) {
      document.title = tituloOriginalRef.current;
    }
  }

  function iniciarPiscaTitulo() {
    if (piscaIntervalRef.current || typeof document === "undefined") return;
    let mostrandoAlerta = false;
    piscaIntervalRef.current = setInterval(() => {
      mostrandoAlerta = !mostrandoAlerta;
      document.title = mostrandoAlerta ? TITULO_PISCANDO : tituloOriginalRef.current;
    }, 1000);
  }

  // identidade + título original da aba + permissão de notificação atual
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setMeuId(data.user.id);
    });
    if (typeof document !== "undefined") tituloOriginalRef.current = document.title;
    if (typeof window !== "undefined" && "Notification" in window) {
      setPermissaoNotificacao(Notification.permission);
    } else {
      setPermissaoNotificacao("indisponivel");
    }
    function aoVisibilidadeMudar() {
      if (!document.hidden) pararPiscaTitulo();
    }
    document.addEventListener("visibilitychange", aoVisibilidadeMudar);
    return () => {
      document.removeEventListener("visibilitychange", aoVisibilidadeMudar);
      pararPiscaTitulo();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // fecha o painel ao clicar fora
  useEffect(() => {
    if (!painelAberto) return;
    function aoClicarFora(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setPainelAberto(false);
    }
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, [painelAberto]);

  const carregarConversas = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/conversas");
      const data = await res.json().catch(() => null);
      if (res.ok) setConversas(data.conversas);
    } catch {
      // silencioso — o painel só fica sem atualizar dessa vez
    }
  }, []);

  const carregarUsuarios = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/usuarios");
      const data = await res.json().catch(() => null);
      if (res.ok) setUsuarios(data.usuarios);
    } catch {
      // silencioso
    }
  }, []);

  const carregarOnline = useCallback(async () => {
    try {
      const res = await fetch("/api/usuarios/online");
      const data = await res.json().catch(() => null);
      if (res.ok) {
        const mapa = new Map<string, UsuarioOnlineChat>();
        for (const u of (data.usuarios ?? []) as UsuarioOnlineChat[]) mapa.set(u.id, u);
        setOnlineMap(mapa);
      }
    } catch {
      // silencioso
    }
  }, []);

  // status manual de quem está usando o chat agora (aparece na própria
  // lista de "online", já que a pessoa está com o sistema aberto).
  useEffect(() => {
    if (!meuId) return;
    const eu = onlineMap.get(meuId);
    if (eu) setMeuStatus(eu.statusManual);
  }, [onlineMap, meuId]);

  useEffect(() => {
    rosterRef.current = [...(usuarios ?? []), ...Array.from(onlineMap.values())];
  }, [usuarios, onlineMap]);

  const abrirConversa = useCallback(
    async (outroId: string) => {
      setConversaAtivaId(outroId);
      setMostrarNovaConversa(false);
      setErro(null);
      try {
        const res = await fetch(`/api/chat/mensagens?com=${outroId}`);
        const data = await res.json().catch(() => null);
        if (res.ok) {
          setMensagens(data.mensagens);
          carregarConversas();
        } else {
          setErro(data?.error || "Não foi possível abrir essa conversa.");
        }
      } catch {
        setErro("Falha de conexão. Tente novamente.");
      }
    },
    [carregarConversas]
  );

  function dispararAlertasExternos(novos: Balao[]) {
    if (typeof document === "undefined" || !document.hidden) return;
    iniciarPiscaTitulo();
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      for (const b of novos) {
        try {
          new Notification(
            b.tipo === "chamar_atencao" ? `${b.remetenteNome} está te chamando!` : `Nova mensagem de ${b.remetenteNome}`,
            { body: b.texto ?? "", tag: "chat-allied-interno" }
          );
        } catch {
          // silencioso — notificação nativa nunca pode quebrar o chat
        }
      }
    }
  }

  // carrega tudo assim que sabe quem é o usuário logado
  useEffect(() => {
    if (!meuId) return;
    carregarConversas();
    carregarUsuarios();
    carregarOnline();
    const intervaloOnline = setInterval(carregarOnline, INTERVALO_ONLINE_MS);
    return () => clearInterval(intervaloOnline);
  }, [meuId, carregarConversas, carregarUsuarios, carregarOnline]);

  // polling principal — mensagens recebidas desde o último tick (balão +
  // som + badge). Usa refs (não estado) pra ler conversa ativa/painel
  // aberto/lista de nomes na hora certa, sem precisar recriar o
  // intervalo a cada mudança dessas coisas.
  useEffect(() => {
    if (!meuId) return;
    let cancelado = false;

    async function tick() {
      try {
        const res = await fetch(`/api/chat/atualizacoes?desde=${encodeURIComponent(desdeRef.current)}`);
        const data = await res.json().catch(() => null);
        if (!res.ok || cancelado) return;

        setTotalNaoLidas(data.totalNaoLidas ?? 0);
        desdeRef.current = data.agora ?? desdeRef.current;

        const recebidas = (data.recebidas ?? []) as MensagemChat[];
        if (recebidas.length === 0) return;

        // se a conversa de quem mandou já está aberta E o painel está
        // visível na tela, não precisa de balão — só atualiza a thread.
        const conversaJaAbertaEVisivel = (remetenteId: string) =>
          conversaAtivaRef.current === remetenteId && painelAbertoRef.current;

        const novosBaloes: Balao[] = recebidas
          .filter((m) => !conversaJaAbertaEVisivel(m.remetenteId))
          .map((m) => ({
            ...m,
            balaoId: `${m.id}-${Math.random().toString(36).slice(2)}`,
            remetenteNome: nomeCompleto(rosterRef.current.find((u) => u.id === m.remetenteId)),
          }));

        if (novosBaloes.length > 0) {
          setBaloes((atual) => [...atual, ...novosBaloes]);
          if (novosBaloes.some((b) => b.tipo === "chamar_atencao")) tocarSomChamarAtencao();
          else tocarSomMensagem();
          dispararAlertasExternos(novosBaloes);
        }

        if (conversaAtivaRef.current && recebidas.some((m) => m.remetenteId === conversaAtivaRef.current)) {
          abrirConversa(conversaAtivaRef.current);
        }
        carregarConversas();
      } catch {
        // silencioso — só tenta de novo no próximo tick
      }
    }

    tick();
    const intervalo = setInterval(tick, INTERVALO_POLL_MS);
    return () => {
      cancelado = true;
      clearInterval(intervalo);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meuId]);

  useEffect(() => {
    mensagensFimRef.current?.scrollIntoView({ block: "end" });
  }, [mensagens]);

  function fecharBalao(balaoId: string) {
    setBaloes((atual) => atual.filter((b) => b.balaoId !== balaoId));
  }

  function abrirDoBalao(balao: Balao) {
    fecharBalao(balao.balaoId);
    setPainelAberto(true);
    setMostrarNovaConversa(false);
    abrirConversa(balao.remetenteId);
  }

  async function enviarMensagemPara(destinatarioId: string, textoMsg: string) {
    if (!textoMsg.trim()) return;
    setEnviando(true);
    setErro(null);
    try {
      const res = await fetch("/api/chat/mensagens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destinatarioId, texto: textoMsg.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErro(data?.error || "Não foi possível enviar a mensagem.");
      } else {
        if (conversaAtivaRef.current === destinatarioId) {
          setMensagens((atual) => [...(atual ?? []), data.mensagem]);
        }
        carregarConversas();
      }
    } catch {
      setErro("Falha de conexão ao enviar a mensagem.");
    }
    setEnviando(false);
  }

  async function respostaRapidaDoBalao(balao: Balao, textoRapido: string) {
    fecharBalao(balao.balaoId);
    await enviarMensagemPara(balao.remetenteId, textoRapido);
  }

  async function aoEnviarFormulario(e: React.FormEvent) {
    e.preventDefault();
    if (!conversaAtivaId || !texto.trim() || enviando) return;
    const textoAtual = texto;
    setTexto("");
    await enviarMensagemPara(conversaAtivaId, textoAtual);
  }

  async function chamarAtencao() {
    if (!conversaAtivaId || enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      const res = await fetch("/api/chat/chamar-atencao", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destinatarioId: conversaAtivaId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setErro(data?.error || "Não foi possível chamar atenção dessa pessoa.");
      } else {
        setMensagens((atual) => [...(atual ?? []), data.mensagem]);
        carregarConversas();
      }
    } catch {
      setErro("Falha de conexão.");
    }
    setEnviando(false);
  }

  async function mudarStatus(novo: StatusPresenca) {
    setMeuStatus(novo);
    try {
      await fetch("/api/usuarios/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: novo }),
      });
    } catch {
      // silencioso
    }
  }

  async function pedirPermissaoNotificacao() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    try {
      const resultado = await Notification.requestPermission();
      setPermissaoNotificacao(resultado);
    } catch {
      // silencioso
    }
  }

  function statusDe(usuarioId: string): StatusPresenca {
    return onlineMap.get(usuarioId)?.statusManual ?? "Ausente";
  }

  function estaOnline(usuarioId: string): boolean {
    return onlineMap.has(usuarioId);
  }

  const conversaAtivaUsuario =
    conversas?.find((c) => c.usuario.id === conversaAtivaId)?.usuario ??
    usuarios?.find((u) => u.id === conversaAtivaId) ??
    (conversaAtivaId ? onlineMap.get(conversaAtivaId) : undefined);

  return (
    <>
      <div ref={containerRef} className="relative">
        <button
          type="button"
          onClick={() => setPainelAberto((v) => !v)}
          title="Chat interno"
          aria-label="Chat interno"
          className="relative flex items-center justify-center w-8 h-8 rounded-full transition hover:bg-[var(--surface2)]"
        >
          <MessageCircle size={18} style={{ color: "var(--muted)" }} />
          {totalNaoLidas > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-1 rounded-full text-[10px] font-semibold flex items-center justify-center text-white"
              style={{ background: "#ef4444" }}
            >
              {totalNaoLidas > 99 ? "99+" : totalNaoLidas}
            </span>
          )}
        </button>

        {painelAberto && (
          <div
            className="absolute left-0 top-full mt-2 w-96 max-h-[32rem] flex flex-col rounded-xl border shadow-2xl z-40"
            style={{ background: "var(--surface)", borderColor: "var(--line)" }}
          >
            {/* cabeçalho: título + status + nova conversa */}
            <div
              className="px-4 py-3 border-b flex items-center gap-2 shrink-0"
              style={{ borderColor: "var(--line)" }}
            >
              {conversaAtivaId ? (
                <button
                  type="button"
                  onClick={() => {
                    setConversaAtivaId(null);
                    setMensagens(null);
                  }}
                  className="text-[var(--muted)] hover:text-[var(--ink)]"
                  aria-label="Voltar"
                >
                  <ChevronLeft size={18} />
                </button>
              ) : (
                <p className="text-xs font-semibold uppercase tracking-wide flex-1" style={{ color: "var(--muted)" }}>
                  Chat interno
                </p>
              )}

              {conversaAtivaId && conversaAtivaUsuario && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--ink)" }}>
                    {nomeCompleto(conversaAtivaUsuario)}
                  </p>
                  <p className="text-[11px] flex items-center gap-1" style={{ color: "var(--muted)" }}>
                    <Circle size={7} fill={COR_STATUS[statusDe(conversaAtivaId)]} color={COR_STATUS[statusDe(conversaAtivaId)]} />
                    {estaOnline(conversaAtivaId) ? ROTULO_STATUS[statusDe(conversaAtivaId)] : "Offline"}
                  </p>
                </div>
              )}

              {!conversaAtivaId && (
                <button
                  type="button"
                  onClick={() => setMostrarNovaConversa((v) => !v)}
                  title="Nova conversa"
                  aria-label="Nova conversa"
                  className="w-7 h-7 flex items-center justify-center rounded-full transition hover:bg-[var(--surface2)]"
                  style={{ color: "var(--accent2)" }}
                >
                  <Plus size={16} />
                </button>
              )}
            </div>

            {/* meu status (só na lista de conversas, não dentro de uma janela aberta) */}
            {!conversaAtivaId && (
              <div className="px-4 py-2 border-b flex items-center gap-2 shrink-0" style={{ borderColor: "var(--line)" }}>
                <span className="text-[11px]" style={{ color: "var(--muted)" }}>
                  Seu status:
                </span>
                {(Object.keys(ROTULO_STATUS) as StatusPresenca[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => mudarStatus(s)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] transition"
                    style={
                      meuStatus === s
                        ? { background: "var(--accent-glow)", color: "var(--accent2)", fontWeight: 500 }
                        : { color: "var(--muted)" }
                    }
                  >
                    <Circle size={7} fill={COR_STATUS[s]} color={COR_STATUS[s]} />
                    {ROTULO_STATUS[s]}
                  </button>
                ))}
              </div>
            )}

            {permissaoNotificacao === "default" && (
              <button
                type="button"
                onClick={pedirPermissaoNotificacao}
                className="px-4 py-2 text-[11px] text-left border-b shrink-0 hover:bg-[var(--surface2)] transition"
                style={{ borderColor: "var(--line)", color: "var(--accent2)" }}
              >
                Ativar notificações do navegador (avisa mesmo com o sistema em segundo plano)
              </button>
            )}

            {erro && (
              <p className="text-xs text-red-400 px-4 py-2 flex items-start gap-1.5 shrink-0">
                <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                {erro}
              </p>
            )}

            {/* corpo */}
            <div className="flex-1 overflow-y-auto min-h-[16rem]">
              {conversaAtivaId ? (
                mensagens === null ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-xs" style={{ color: "var(--muted)" }}>
                    <Loader2 size={14} className="animate-spin" />
                    Carregando...
                  </div>
                ) : mensagens.length === 0 ? (
                  <p className="text-center py-8 text-xs" style={{ color: "var(--muted)" }}>
                    Nenhuma mensagem ainda — diga oi!
                  </p>
                ) : (
                  <div className="px-3 py-3 space-y-2">
                    {mensagens.map((m) => {
                      const souEu = m.remetenteId === meuId;
                      if (m.tipo === "chamar_atencao") {
                        return (
                          <div key={m.id} className="flex justify-center">
                            <span
                              className="text-[11px] px-3 py-1 rounded-full"
                              style={{ background: "var(--surface2)", color: "#f59e0b" }}
                            >
                              <BellRing size={11} className="inline mr-1 -mt-0.5" />
                              {souEu ? "Você chamou atenção" : `${nomeCompleto(conversaAtivaUsuario)} chamou sua atenção`} —{" "}
                              {formatarHoraBrasilia(m.enviadoEm)}
                            </span>
                          </div>
                        );
                      }
                      return (
                        <div key={m.id} className={`flex ${souEu ? "justify-end" : "justify-start"}`}>
                          <div
                            className="max-w-[75%] rounded-2xl px-3 py-2 text-sm"
                            style={
                              souEu
                                ? { background: "var(--accent)", color: "#fff", borderBottomRightRadius: 4 }
                                : { background: "var(--surface2)", color: "var(--ink)", borderBottomLeftRadius: 4 }
                            }
                          >
                            <p className="whitespace-pre-wrap break-words">{m.texto}</p>
                            <p
                              className="text-[10px] mt-1 text-right"
                              style={{ color: souEu ? "rgba(255,255,255,0.75)" : "var(--muted)" }}
                            >
                              {formatarHoraBrasilia(m.enviadoEm)}
                              {souEu && (m.lidaEm ? " · Visto" : " · Enviado")}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={mensagensFimRef} />
                  </div>
                )
              ) : mostrarNovaConversa ? (
                <div>
                  <p className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
                    Iniciar conversa
                  </p>
                  {usuarios === null ? (
                    <div className="flex items-center justify-center gap-2 py-8 text-xs" style={{ color: "var(--muted)" }}>
                      <Loader2 size={14} className="animate-spin" />
                      Carregando...
                    </div>
                  ) : usuarios.length === 0 ? (
                    <p className="text-center py-8 text-xs" style={{ color: "var(--muted)" }}>
                      Nenhum outro usuário cadastrado.
                    </p>
                  ) : (
                    usuarios.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => abrirConversa(u.id)}
                        className="w-full text-left px-4 py-2.5 flex items-center gap-2 hover:bg-[var(--surface2)] transition"
                      >
                        <Circle size={9} fill={COR_STATUS[statusDe(u.id)]} color={COR_STATUS[statusDe(u.id)]} className="shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium truncate" style={{ color: "var(--ink)" }}>
                            {nomeCompleto(u)}
                          </p>
                          <p className="text-[11px]" style={{ color: "var(--muted)" }}>
                            {u.cargo}
                          </p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              ) : conversas === null ? (
                <div className="flex items-center justify-center gap-2 py-8 text-xs" style={{ color: "var(--muted)" }}>
                  <Loader2 size={14} className="animate-spin" />
                  Carregando...
                </div>
              ) : conversas.length === 0 ? (
                <p className="text-center py-8 text-xs px-4" style={{ color: "var(--muted)" }}>
                  Nenhuma conversa ainda. Clique no{" "}
                  <Plus size={11} className="inline -mt-0.5" /> pra mandar uma mensagem pra alguém.
                </p>
              ) : (
                conversas.map((c) => (
                  <button
                    key={c.usuario.id}
                    type="button"
                    onClick={() => abrirConversa(c.usuario.id)}
                    className="w-full text-left px-4 py-2.5 flex items-center gap-2 border-t first:border-t-0 hover:bg-[var(--surface2)] transition"
                    style={{ borderColor: "var(--line)" }}
                  >
                    <Circle size={9} fill={COR_STATUS[statusDe(c.usuario.id)]} color={COR_STATUS[statusDe(c.usuario.id)]} className="shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-medium truncate" style={{ color: "var(--ink)" }}>
                          {nomeCompleto(c.usuario)}
                        </p>
                        <p className="text-[10px] shrink-0" style={{ color: "var(--muted)" }}>
                          {formatarHoraBrasilia(c.ultimaMensagem.enviadoEm)}
                        </p>
                      </div>
                      <p className="text-[11px] truncate" style={{ color: "var(--muted)" }}>
                        {c.ultimaMensagem.tipo === "chamar_atencao" ? "🔔 chamou sua atenção" : c.ultimaMensagem.texto}
                      </p>
                    </div>
                    {c.naoLidas > 0 && (
                      <span
                        className="min-w-[16px] h-[16px] px-1 rounded-full text-[10px] font-semibold flex items-center justify-center text-white shrink-0"
                        style={{ background: "#ef4444" }}
                      >
                        {c.naoLidas}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>

            {/* rodapé: input + chamar atenção, só dentro de uma conversa */}
            {conversaAtivaId && (
              <div className="border-t p-2.5 shrink-0" style={{ borderColor: "var(--line)" }}>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={chamarAtencao}
                    disabled={enviando}
                    title="Chamar atenção (estilo MSN) — avisa com som mais forte e destaque na tela"
                    className="w-8 h-8 flex items-center justify-center rounded-full transition hover:bg-[var(--surface2)] disabled:opacity-50 shrink-0"
                    style={{ color: "#f59e0b" }}
                  >
                    <BellRing size={16} />
                  </button>
                  <form onSubmit={aoEnviarFormulario} className="flex-1 flex items-center gap-1.5">
                    <input
                      type="text"
                      value={texto}
                      onChange={(e) => setTexto(e.target.value)}
                      placeholder="Escreva uma mensagem..."
                      disabled={enviando}
                      className="flex-1 rounded-full border px-3.5 py-2 text-sm outline-none focus:border-[var(--accent2)] transition disabled:opacity-60"
                      style={{ borderColor: "var(--line)", background: "var(--surface2)", color: "var(--ink)" }}
                    />
                    <button
                      type="submit"
                      disabled={enviando || !texto.trim()}
                      className="w-8 h-8 flex items-center justify-center rounded-full transition disabled:opacity-40 shrink-0"
                      style={{ background: "var(--accent)", color: "#fff" }}
                      aria-label="Enviar"
                    >
                      {enviando ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* balões flutuantes — ficam abertos até serem lidos (clicar) ou
          fechados (X); "chamar atenção" treme e some só no X/clique */}
      {baloes.length > 0 && (
        <div className="fixed bottom-4 right-4 z-[60] flex flex-col-reverse gap-2.5 w-[22rem] max-w-[92vw] pointer-events-none">
          {baloes.map((b) => {
            const chamarAtencaoBalao = b.tipo === "chamar_atencao";
            return (
              <div
                key={b.balaoId}
                className={`pointer-events-auto rounded-xl border shadow-2xl overflow-hidden ${
                  chamarAtencaoBalao ? "chat-chamar-atencao-tremer" : ""
                }`}
                style={{
                  background: "var(--surface)",
                  borderColor: chamarAtencaoBalao ? "#f59e0b" : "var(--line)",
                }}
              >
                <button
                  type="button"
                  onClick={() => abrirDoBalao(b)}
                  className="w-full text-left px-4 py-3 flex items-start gap-2.5 hover:bg-[var(--surface2)] transition"
                >
                  {chamarAtencaoBalao ? (
                    <BellRing size={18} className="shrink-0 mt-0.5" style={{ color: "#f59e0b" }} />
                  ) : (
                    <MessageCircle size={18} className="shrink-0 mt-0.5" style={{ color: "var(--accent2)" }} />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate" style={{ color: "var(--ink)" }}>
                      {chamarAtencaoBalao ? `${b.remetenteNome} quer falar com você` : b.remetenteNome}
                    </p>
                    <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "var(--muted)" }}>
                      {b.texto}
                    </p>
                    <p className="text-[10px] mt-1" style={{ color: "var(--muted)" }}>
                      {formatarDataHoraBrasilia(b.enviadoEm)}
                    </p>
                  </div>
                  <span
                    role="button"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.stopPropagation();
                      fecharBalao(b.balaoId);
                    }}
                    className="shrink-0 -mt-1 -mr-1 p-1 rounded-full hover:bg-[var(--surface2)] transition"
                    style={{ color: "var(--muted)" }}
                    aria-label="Fechar"
                  >
                    <X size={14} />
                  </span>
                </button>
                <div className="px-4 pb-3 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => abrirDoBalao(b)}
                    className="text-xs font-medium px-2.5 py-1 rounded-md transition hover:opacity-90"
                    style={{ background: "var(--accent)", color: "#fff" }}
                  >
                    Responder
                  </button>
                  {chamarAtencaoBalao && (
                    <button
                      type="button"
                      onClick={() => respostaRapidaDoBalao(b, "Já vi, um minuto!")}
                      className="text-xs font-medium px-2.5 py-1 rounded-md transition hover:bg-[var(--surface2)]"
                      style={{ color: "var(--muted)", border: "1px solid var(--line)" }}
                    >
                      Já vi, um minuto
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
