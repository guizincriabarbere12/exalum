import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formasPagamentoCustomCache } from "@/lib/formasPagamento";

export interface FormaPagamentoCustom {
  id: string;
  nome: string;
  chave: string | null;
  ativo: boolean;
  ordem: number;
}

export function useFormasPagamentoCustom(somenteAtivas = true) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["formas-pagamento-custom"],
    queryFn: async (): Promise<FormaPagamentoCustom[]> => {
      const { data, error } = await supabase
        .from("formas_pagamento")
        .select("id, nome, chave, ativo, ordem")
        .order("ordem", { ascending: true })
        .order("nome", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    staleTime: 60 * 1000,
  });

  const todas = data || [];
  const formas = somenteAtivas ? todas.filter((f) => f.ativo) : todas;

  useEffect(() => {
    todas.forEach((f) => {
      formasPagamentoCustomCache.set(f.id, f.chave ? `${f.nome} — Chave: ${f.chave}` : f.nome);
    });
  }, [todas]);

  return { formas, isLoading, refetch };
}
