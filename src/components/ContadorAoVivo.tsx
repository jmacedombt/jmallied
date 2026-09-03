"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type LinhaOrcamento = { status_operacional?: string | null };

// Mostra a quantidade de aparelhos parados num status_operacional
// específico, e mantém o número em dia sozinho: assina as mudanças em
// tempo real da tabela orcamentos (Supabase Realtime) e soma/subtrai
// na hora que um aparelho entra ou sai dessa etapa — sem precisar dar
// reload na página.
export default function ContadorAoVivo({
  status,
  contagemInicial,
}: {
  status: string;
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

  useEffect(() => {
    const supabase = createClient();
    const canal = supabase
      .channel(`orcamentos-contador-${status}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orcamentos" },
        (payload) => {
          const novo = (payload.new as LinhaOrcamento | null)?.status_operacional;
          const antigo = (payload.old as LinhaOrcamento | null)?.status_operacional;
          const entrou = novo === status && antigo !== status;
          const saiu = antigo === status && novo !== status;
          if (entrou) setContagem((c) => c + 1);
          else if (saiu) setContagem((c) => Math.max(0, c - 1));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, [status]);

  return <>{contagem}</>;
}
