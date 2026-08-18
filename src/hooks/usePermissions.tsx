// @ts-nocheck - Temporary fix until Supabase types are regenerated
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// Este e-mail nunca é restringido por nenhuma permissão de tela,
// mesmo que alguém configure uma restrição para ele por engano.
const DEVELOPER_EMAIL = "oguidevcontato1@gmail.com";

export const MODULOS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "produtos", label: "Produtos" },
  { key: "kits", label: "Kits Acessórios" },
  { key: "kits-montados", label: "Kits Montados" },
  { key: "estoque", label: "Estoque" },
  { key: "ordens-producao", label: "Ordens de Produção" },
  { key: "filiais", label: "Filiais" },
  { key: "transferencias-estoque", label: "Transferências" },
  { key: "clientes", label: "Clientes" },
  { key: "saldo-clientes", label: "Saldo Clientes" },
  { key: "orcamentos", label: "Orçamentos" },
  { key: "vendas", label: "Vendas" },
  { key: "pedidos", label: "Pedidos" },
  { key: "requisicoes-material", label: "Requisições" },
  { key: "compras", label: "Compras" },
  { key: "fornecedores", label: "Fornecedores" },
  { key: "vendedores", label: "Vendedores" },
  { key: "financeiro", label: "Financeiro" },
  { key: "relatorios", label: "Relatórios" },
  { key: "configuracoes", label: "Configurações" },
  { key: "auditoria", label: "Auditoria" },
] as const;

export function moduloDaRota(pathname: string): string | null {
  if (pathname.startsWith("/financeiro")) return "financeiro";
  const modulo = MODULOS.find((m) => pathname === `/${m.key}`);
  return modulo?.key ?? null;
}

export function usePermissions() {
  const { user, isAdmin } = useAuth();
  const [negados, setNegados] = useState<Set<string>>(new Set());
  const [podeGerenciarPermissoesProprio, setPodeGerenciarPermissoesProprio] = useState(false);
  const [loading, setLoading] = useState(true);

  const isDeveloper = user?.email === DEVELOPER_EMAIL;

  useEffect(() => {
    if (!user) {
      setNegados(new Set());
      setPodeGerenciarPermissoesProprio(false);
      setLoading(false);
      return;
    }

    supabase
      .from("user_permissions")
      .select("module, can_access")
      .eq("user_id", user.id)
      .then(({ data }) => {
        const deny = new Set<string>();
        let gerenciar = false;
        (data || []).forEach((row: { module: string; can_access: boolean }) => {
          if (row.module === "gerenciar_permissoes") {
            gerenciar = row.can_access;
          } else if (row.can_access === false) {
            deny.add(row.module);
          }
        });
        setNegados(deny);
        setPodeGerenciarPermissoesProprio(gerenciar);
        setLoading(false);
      });
  }, [user?.id]);

  const canAccess = (modulo: string | null) => {
    if (!modulo) return true;
    if (isDeveloper) return true;
    return !negados.has(modulo);
  };

  return {
    canAccess,
    isDeveloper,
    podeGerenciarPermissoes: isDeveloper || isAdmin || podeGerenciarPermissoesProprio,
    loading,
  };
}
