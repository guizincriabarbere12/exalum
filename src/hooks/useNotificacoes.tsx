// @ts-nocheck - Temporary fix until Supabase types are regenerated
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface NotificacaoGrupo {
  label: string;
  count: number;
  url: string;
}

export function useNotificacoes() {
  const [itens, setItens] = useState<NotificacaoGrupo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotificacoes = useCallback(async () => {
    try {
      const [pedidos, requisicoes, conferencias] = await Promise.all([
        supabase.from("pedidos").select("id", { count: "exact", head: true }).eq("status", "pendente"),
        supabase.from("requisicoes_material").select("id", { count: "exact", head: true }).eq("status", "pendente"),
        // Orçamentos aprovados ainda ficam com esse status até a conferência
        // ser finalizada (aí viram "conferido"), então isso já é a fila de
        // conferência pendente.
        supabase.from("orcamentos").select("id", { count: "exact", head: true }).eq("status", "aprovado"),
      ]);

      const lista: NotificacaoGrupo[] = [];
      if ((pedidos.count || 0) > 0) {
        lista.push({ label: "Pedidos pendentes", count: pedidos.count!, url: "/pedidos" });
      }
      if ((requisicoes.count || 0) > 0) {
        lista.push({ label: "Requisições pendentes", count: requisicoes.count!, url: "/requisicoes-material" });
      }
      if ((conferencias.count || 0) > 0) {
        lista.push({ label: "Aguardando conferência", count: conferencias.count!, url: "/conferencia-materiais" });
      }
      setItens(lista);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotificacoes();
    const interval = setInterval(fetchNotificacoes, 30000);
    return () => clearInterval(interval);
  }, [fetchNotificacoes]);

  const total = itens.reduce((acc, i) => acc + i.count, 0);

  return { itens, total, loading, refetch: fetchNotificacoes };
}
