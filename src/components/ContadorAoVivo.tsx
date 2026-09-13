"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type LinhaOrcamento = { status_operacional?: string | null };

// Mostra a quantidade de aparelhos parados num status_operacional
// específico, e mantém o número em dia sozinho: assina as mudanças em
// tempo real da tabela orcamentos (Supabase Realtime) e soma/subtrai
// na hora que um aparelho entra ou sai dessa etapa — sem precisar dar
// reload na página.
//
// `status` também aceita uma LISTA de status (ex: o card "Ag. Emissão
// de Nota Fiscal", que agrupa 2 status_operacional reais numa tela só —
// ver GRUPO_STATUS_AG_EMISSAO_NF em lib/orcamentos.ts) — conta como
// "entrou/saiu do grupo" qualquer mudança que cruze a fronteira entre
// "está em algum item da lista" e "não está em nenhum".
export default function ContadorAoVivo({
  status,
  contagemInicial,
}: {
  status: string | readonly string[];
  contagemInicial: number;
}) {
  const [contagem, setContagem] = useState(contagemInicial);
  const primeiraRenderizacao = useRef(true);

  // se o servidor mandar um novo valor inicial (ex: navegou pra outra
  // etapa), realinha — mas não na primeira renderização, senão
  // descartaria incrementos que já chegaram via realtime antes disso.
  useEffect(() => {
    if (primeiraRenderizacao.current) {
      primeiraRenderizacao.current = false;
      return;
    }
    setContagem(contagemInicial);
  }, [contagemInicial]);

  // chave estável pro canal/efeito, independente de ser 1 status ou uma
  // lista (evita reassinar o canal a cada render por causa de um array
  // novo com o mesmo conteúdo).
  const chaveStatus = Array.isArray(status) ? status.join("|") : (status as string);

  useEffect(() => {
    const pertenceAoGrupo = (valor?: string | null) =>
      Array.isArray(status) ? status.includes(valor ?? "") : valor === status;

    const supabase = createClient();
    const canal = supabase
      .channel(`orcamentos-contador-${chaveStatus}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orcamentos" },
        (payload) => {
          const novo = (payload.new as LinhaOrcamento | null)?.status_operacional;
          const antigo = (payload.old as LinhaOrcamento | null)?.status_operacional;
          const entrou = pertenceAoGrupo(novo) && !pertenceAoGrupo(antigo);
          const saiu = pertenceAoGrupo(antigo) && !pertenceAoGrupo(novo);
          if (entrou) setContagem((c) => c + 1);
          else if (saiu) setContagem((c) => Math.max(0, c - 1));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveStatus]);

  return <>{contagem}</>;
}
