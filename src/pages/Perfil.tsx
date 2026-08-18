import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { User, Save, Shield, Mail, Calendar, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { logActivity } from "@/lib/auditLog";

export default function Perfil() {
  const { user, isAdmin } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [criadoEm, setCriadoEm] = useState<string | null>(null);

  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [alterandoSenha, setAlterandoSenha] = useState(false);

  useEffect(() => {
    if (user) fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, created_at")
        .eq("id", user!.id)
        .maybeSingle();

      if (error) throw error;
      setFullName(data?.full_name || "");
      setCriadoEm(data?.created_at || null);
    } catch (error: any) {
      toast({ title: "Erro ao carregar perfil", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!fullName.trim()) {
      toast({ title: "Nome obrigatório", description: "Informe seu nome completo.", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName.trim() })
        .eq("id", user!.id);

      if (error) throw error;

      await logActivity({ acao: "atualizar", entidade: "perfil", entidadeId: user!.id, descricao: "Atualizou o nome do perfil" });

      toast({ title: "Perfil atualizado", description: "Suas informações foram salvas com sucesso." });
    } catch (error: any) {
      toast({ title: "Erro ao salvar perfil", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (novaSenha.length < 6) {
      toast({ title: "Senha muito curta", description: "A senha deve ter pelo menos 6 caracteres.", variant: "destructive" });
      return;
    }
    if (novaSenha !== confirmarSenha) {
      toast({ title: "Senhas não conferem", description: "As duas senhas precisam ser iguais.", variant: "destructive" });
      return;
    }

    setAlterandoSenha(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: novaSenha });
      if (error) throw error;

      await logActivity({ acao: "atualizar", entidade: "perfil", entidadeId: user!.id, descricao: "Alterou a própria senha" });

      setNovaSenha("");
      setConfirmarSenha("");
      toast({ title: "Senha alterada", description: "Sua senha foi atualizada com sucesso." });
    } catch (error: any) {
      toast({ title: "Erro ao alterar senha", description: error.message, variant: "destructive" });
    } finally {
      setAlterandoSenha(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="text-center py-8 text-muted-foreground">Carregando perfil...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Meu Perfil</h2>
        <p className="text-muted-foreground">Gerencie suas informações pessoais e senha</p>
      </div>

      <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-card to-blue-50/30">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
        <CardContent className="p-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent shadow-lg shrink-0">
              <User className="h-8 w-8 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-bold text-foreground truncate">{fullName || "Sem nome cadastrado"}</h3>
              <p className="text-sm text-muted-foreground flex items-center gap-1 truncate">
                <Mail className="h-3.5 w-3.5 shrink-0" /> {user?.email}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant={isAdmin ? "default" : "secondary"}>
                  <Shield className="h-3 w-3 mr-1" />
                  {isAdmin ? "Administrador" : "Usuário"}
                </Badge>
                {criadoEm && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Desde {new Date(criadoEm).toLocaleDateString("pt-BR")}
                  </span>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Informações Pessoais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="full_name">Nome Completo</Label>
            <Input id="full_name" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Seu nome completo" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" value={user?.email || ""} disabled className="bg-muted" />
            <p className="text-xs text-muted-foreground">O e-mail não pode ser alterado por aqui.</p>
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={handleSaveProfile} disabled={saving} className="w-full sm:w-auto">
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Salvando..." : "Salvar Perfil"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Alterar Senha
          </CardTitle>
          <CardDescription>Defina uma nova senha de acesso</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nova_senha">Nova Senha</Label>
              <Input
                id="nova_senha"
                type="password"
                value={novaSenha}
                onChange={e => setNovaSenha(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmar_senha">Confirmar Nova Senha</Label>
              <Input
                id="confirmar_senha"
                type="password"
                value={confirmarSenha}
                onChange={e => setConfirmarSenha(e.target.value)}
                placeholder="Repita a nova senha"
                minLength={6}
              />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={handleChangePassword} disabled={alterandoSenha || !novaSenha} variant="outline" className="w-full sm:w-auto">
              <KeyRound className="h-4 w-4 mr-2" />
              {alterandoSenha ? "Alterando..." : "Alterar Senha"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
