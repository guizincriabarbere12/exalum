// @ts-nocheck - Temporary fix until Supabase types are regenerated
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShieldCheck, User as UserIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { logActivity } from "@/lib/auditLog";
import { MODULOS, usePermissions } from "@/hooks/usePermissions";

const DEVELOPER_EMAIL = "oguidevcontato1@gmail.com";

interface Usuario {
  id: string;
  email: string;
  role: string;
}

export default function Permissoes() {
  const { podeGerenciarPermissoes, loading: permissoesCarregando } = usePermissions();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [usuarioSelecionado, setUsuarioSelecionado] = useState<string>("");
  const [negados, setNegados] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState<string | null>(null);

  useEffect(() => {
    fetchUsuarios();
  }, []);

  useEffect(() => {
    if (usuarioSelecionado) fetchPermissoesDoUsuario(usuarioSelecionado);
  }, [usuarioSelecionado]);

  const fetchUsuarios = async () => {
    try {
      const { data, error } = await supabase.rpc("get_users_with_roles");
      if (error) throw error;
      const lista = (data || []).map((u: any) => ({ id: u.user_id ?? u.id, email: u.email, role: u.role }));
      setUsuarios(lista);
      if (lista.length > 0) setUsuarioSelecionado(lista[0].id);
    } catch (error: any) {
      toast({ title: "Erro ao carregar usuários", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchPermissoesDoUsuario = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("user_permissions")
        .select("module, can_access")
        .eq("user_id", userId);

      if (error) throw error;

      const deny = new Set<string>();
      (data || []).forEach((row: { module: string; can_access: boolean }) => {
        if (row.can_access === false) deny.add(row.module);
      });
      setNegados(deny);
    } catch (error: any) {
      toast({ title: "Erro ao carregar permissões", description: error.message, variant: "destructive" });
    }
  };

  const usuarioAtual = usuarios.find((u) => u.id === usuarioSelecionado);
  const isDeveloper = usuarioAtual?.email === DEVELOPER_EMAIL;

  const alternarModulo = async (modulo: string, permitir: boolean) => {
    if (!usuarioSelecionado || isDeveloper) return;

    setSalvando(modulo);
    try {
      const { error } = await supabase
        .from("user_permissions")
        .upsert(
          { user_id: usuarioSelecionado, module: modulo, can_access: permitir },
          { onConflict: "user_id,module" }
        );

      if (error) throw error;

      setNegados((prev) => {
        const novo = new Set(prev);
        if (permitir) novo.delete(modulo);
        else novo.add(modulo);
        return novo;
      });

      await logActivity({
        acao: "atualizar",
        entidade: "permissoes",
        entidadeId: usuarioSelecionado,
        descricao: `${permitir ? "Liberou" : "Restringiu"} o acesso de ${usuarioAtual?.email} à tela "${modulo}"`,
      });
    } catch (error: any) {
      toast({ title: "Erro ao salvar permissão", description: error.message, variant: "destructive" });
    } finally {
      setSalvando(null);
    }
  };

  if (permissoesCarregando || loading) {
    return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;
  }

  if (!podeGerenciarPermissoes) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
        <ShieldCheck className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Acesso restrito</h2>
        <p className="text-muted-foreground max-w-sm">Você não tem permissão para gerenciar permissões de outros usuários.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Permissões de Tela</h2>
        <p className="text-muted-foreground">Escolha um usuário e defina quais telas ele pode acessar</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserIcon className="h-5 w-5 text-primary" />
            Usuário
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={usuarioSelecionado} onValueChange={setUsuarioSelecionado}>
            <SelectTrigger className="max-w-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {usuarios.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.email} {u.role === "admin" ? "(admin)" : u.role === "serralheiro" ? "(serralheiro)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {usuarioSelecionado && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Telas liberadas
            </CardTitle>
            <CardDescription>
              {isDeveloper
                ? "Este usuário é o desenvolvedor do sistema e sempre tem acesso a tudo, independente do que estiver marcado aqui."
                : "Desligue uma tela para escondê-la do menu e bloquear o acesso direto pela URL para este usuário."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isDeveloper && (
              <Badge variant="secondary" className="mb-4">Acesso total (desenvolvedor)</Badge>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
              {MODULOS.map((modulo) => (
                <div key={modulo.key} className="flex items-center justify-between">
                  <span className="text-sm">{modulo.label}</span>
                  <Switch
                    checked={isDeveloper || !negados.has(modulo.key)}
                    disabled={isDeveloper || salvando === modulo.key}
                    onCheckedChange={(checked) => alternarModulo(modulo.key, checked)}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
