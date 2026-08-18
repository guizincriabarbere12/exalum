import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CompanyConfig {
  nome_empresa: string;
  logo_url: string | null;
}

export function useCompanyConfig() {
  const { data } = useQuery({
    queryKey: ["company-config"],
    queryFn: async (): Promise<CompanyConfig> => {
      const { data, error } = await supabase
        .from("configuracoes")
        .select("nome_empresa, logo_url")
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return { nome_empresa: data?.nome_empresa || "Exalum", logo_url: data?.logo_url || null };
    },
    staleTime: 5 * 60 * 1000,
  });

  return { nomeEmpresa: data?.nome_empresa || "Exalum", logoUrl: data?.logo_url || null };
}
