import { supabase } from "@/integrations/supabase/client";

interface LogActivityParams {
  acao: string;
  entidade: string;
  entidadeId?: string;
  descricao?: string;
  metadados?: Record<string, unknown>;
}

/**
 * Registra uma ação no log de auditoria (audit_logs). Nunca lança erro —
 * uma falha ao gravar o log não pode interromper o fluxo principal do usuário.
 */
export async function logActivity({ acao, entidade, entidadeId, descricao, metadados }: LogActivityParams) {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("audit_logs").insert({
      user_id: user.id,
      user_email: user.email,
      acao,
      entidade,
      entidade_id: entidadeId ?? null,
      descricao: descricao ?? null,
      metadados: metadados ?? null,
    });
  } catch (error) {
    console.error("Erro ao registrar log de auditoria:", error);
  }
}
