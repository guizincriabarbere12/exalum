// @ts-nocheck - Temporary fix until Supabase types are regenerated
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings, Save, ExternalLink, Copy, Users, Shield, Upload, Image, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { logActivity } from "@/lib/auditLog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Configuracao {
  id: string;
  nome_empresa: string;
  cnpj: string | null;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  logo_url: string | null;
}

interface Usuario {
  id: string;
  email: string;
  created_at: string;
  role: string;
}

export default function Configuracoes() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [dialogAberto, setDialogAberto] = useState(false);
  const [criandoUsuario, setCriandoUsuario] = useState(false);
  const [novoUsuario, setNovoUsuario] = useState({
    email: '',
    password: '',
    isAdmin: false,
  });
  const [config, setConfig] = useState<Configuracao>({
    id: '',
    nome_empresa: '',
    cnpj: '',
    telefone: '',
    email: '',
    endereco: '',
    logo_url: '',
  });
  const [uploadingLogo, setUploadingLogo] = useState(false);

  const catalogoUrl = `${window.location.origin}/catalogo-publico`;

  const copiarLink = () => {
    navigator.clipboard.writeText(catalogoUrl);
    toast({
      title: "Link copiado!",
      description: "O link do catálogo foi copiado para a área de transferência",
    });
  };

  useEffect(() => {
    fetchConfig();
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('configuracoes')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setConfig(data);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao carregar configurações",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase.rpc('get_users_with_roles');

      if (error) throw error;

      setUsuarios(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar usuários",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleCriarUsuario = async () => {
    if (!novoUsuario.email || !novoUsuario.password) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha email e senha",
        variant: "destructive",
      });
      return;
    }

    setCriandoUsuario(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Sessão não encontrada');
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: novoUsuario.email,
          password: novoUsuario.password,
          isAdmin: novoUsuario.isAdmin,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao criar usuário');
      }

      await logActivity({
        acao: "criar",
        entidade: "usuario",
        descricao: `Criou o usuário ${novoUsuario.email}${novoUsuario.isAdmin ? " (administrador)" : ""}`,
      });

      toast({
        title: "Usuário criado!",
        description: `Conta criada para ${novoUsuario.email}`,
      });

      setNovoUsuario({ email: '', password: '', isAdmin: false });
      setDialogAberto(false);
      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Erro ao criar usuário",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setCriandoUsuario(false);
    }
  };

  const roleLabels: Record<string, string> = {
    admin: 'administrador',
    user: 'usuário comum',
    serralheiro: 'serralheiro',
  };

  const handleAlterarRole = async (userId: string, newRole: string) => {
    if (!isAdmin) return;

    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: newRole })
        .eq('user_id', userId);

      if (error) throw error;

      await logActivity({
        acao: "atualizar",
        entidade: "usuario",
        entidadeId: userId,
        descricao: `Alterou permissão do usuário para ${roleLabels[newRole] || newRole}`,
      });

      toast({
        title: "Permissão atualizada",
        description: `Usuário agora é ${roleLabels[newRole] || newRole}`,
      });

      fetchUsers();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar permissão",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleSave = async () => {
    if (!isAdmin) {
      toast({
        title: "Sem permissão",
        description: "Apenas administradores podem alterar as configurações",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('configuracoes')
        .update({
          nome_empresa: config.nome_empresa,
          cnpj: config.cnpj,
          telefone: config.telefone,
          email: config.email,
          endereco: config.endereco,
          logo_url: config.logo_url,
        })
        .eq('id', config.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["company-config"] });

      await logActivity({ acao: "atualizar", entidade: "configuracoes", entidadeId: config.id, descricao: "Atualizou os dados da empresa" });

      toast({
        title: "Configurações salvas",
        description: "As configurações foram atualizadas com sucesso",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao salvar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleUploadLogo = async (file: File) => {
    setUploadingLogo(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `logos/${Math.random().toString(36).substring(2)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, file, { cacheControl: '3600', upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);

      setConfig((prev) => ({ ...prev, logo_url: publicUrl }));
      toast({
        title: "Logo enviada",
        description: "Clique em \"Salvar Configurações\" para aplicar.",
      });
    } catch (error: any) {
      toast({
        title: "Erro no upload da logo",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploadingLogo(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="text-center py-8 text-muted-foreground">
          Carregando configurações...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-3xl font-bold text-foreground">Configurações</h2>
        <p className="text-muted-foreground">Gerencie as informações da empresa</p>
      </div>

      {isAdmin && (
        <Card className="border-orange-200 bg-gradient-to-br from-orange-50 to-transparent">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-orange-600" />
                Gerenciar Usuários
              </div>
              <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
                <DialogTrigger asChild>
                  <Button size="sm" className="bg-gradient-to-r from-orange-500 to-orange-600">
                    <UserPlus className="h-4 w-4 mr-2" />
                    Criar Usuário
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar Novo Usuário</DialogTitle>
                    <DialogDescription>
                      Crie uma conta para um novo funcionário
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="new-email">E-mail</Label>
                      <Input
                        id="new-email"
                        type="email"
                        value={novoUsuario.email}
                        onChange={(e) => setNovoUsuario({ ...novoUsuario, email: e.target.value })}
                        placeholder="usuario@exemplo.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-password">Senha</Label>
                      <Input
                        id="new-password"
                        type="password"
                        value={novoUsuario.password}
                        onChange={(e) => setNovoUsuario({ ...novoUsuario, password: e.target.value })}
                        placeholder="Mínimo 6 caracteres"
                        minLength={6}
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="is-admin"
                        checked={novoUsuario.isAdmin}
                        onChange={(e) => setNovoUsuario({ ...novoUsuario, isAdmin: e.target.checked })}
                        className="h-4 w-4"
                      />
                      <Label htmlFor="is-admin" className="cursor-pointer">
                        Tornar administrador
                      </Label>
                    </div>
                    <Button
                      onClick={handleCriarUsuario}
                      disabled={criandoUsuario}
                      className="w-full"
                    >
                      {criandoUsuario ? 'Criando...' : 'Criar Usuário'}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loadingUsers ? (
              <div className="text-center py-4 text-muted-foreground">
                Carregando usuários...
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead>Cadastrado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usuarios.map((usuario) => (
                    <TableRow key={usuario.id}>
                      <TableCell className="font-medium">{usuario.email}</TableCell>
                      <TableCell>
                        <Badge variant={usuario.role === 'admin' ? 'default' : 'secondary'}>
                          {usuario.role === 'admin' && (
                            <>
                              <Shield className="h-3 w-3 mr-1" />
                              Administrador
                            </>
                          )}
                          {usuario.role === 'serralheiro' && 'Serralheiro'}
                          {usuario.role === 'user' && 'Usuário'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(usuario.created_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Select
                          value={usuario.role}
                          onValueChange={(value) => handleAlterarRole(usuario.id, value)}
                        >
                          <SelectTrigger className="w-[160px] ml-auto">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="user">Usuário</SelectItem>
                            <SelectItem value="admin">Administrador</SelectItem>
                            <SelectItem value="serralheiro">Serralheiro</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5 text-primary" />
            Link do Catálogo Público
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Compartilhe este link com seus clientes para fazer pedidos</Label>
            <div className="flex gap-2 mt-2">
              <Input
                value={catalogoUrl}
                readOnly
                className="font-mono text-sm bg-muted"
              />
              <Button onClick={copiarLink} variant="outline">
                <Copy className="h-4 w-4 mr-2" />
                Copiar
              </Button>
              <Button onClick={() => window.open(catalogoUrl, '_blank')}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Abrir
              </Button>
            </div>
          </div>
          
          <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
            <Badge className="mt-0.5">Dica</Badge>
            <p className="text-sm text-muted-foreground">
              Seus clientes podem acessar este link para visualizar produtos, adicionar ao carrinho e fazer pedidos diretamente pelo catálogo.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-primary" />
            Dados da Empresa
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="nome_empresa">Nome da Empresa *</Label>
              <Input
                id="nome_empresa"
                value={config.nome_empresa}
                onChange={(e) => setConfig({ ...config, nome_empresa: e.target.value })}
                disabled={!isAdmin}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input
                id="cnpj"
                value={config.cnpj || ''}
                onChange={(e) => setConfig({ ...config, cnpj: e.target.value })}
                disabled={!isAdmin}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={config.telefone || ''}
                onChange={(e) => setConfig({ ...config, telefone: e.target.value })}
                disabled={!isAdmin}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={config.email || ''}
                onChange={(e) => setConfig({ ...config, email: e.target.value })}
                disabled={!isAdmin}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="endereco">Endereço</Label>
              <Input
                id="endereco"
                value={config.endereco || ''}
                onChange={(e) => setConfig({ ...config, endereco: e.target.value })}
                disabled={!isAdmin}
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="logo_url">Logo da Empresa</Label>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  id="logo_url"
                  type="url"
                  value={config.logo_url || ''}
                  onChange={(e) => setConfig({ ...config, logo_url: e.target.value })}
                  disabled={!isAdmin}
                  placeholder="https://exemplo.com/logo.png"
                  className="flex-1"
                />
                {isAdmin && (
                  <>
                    <input
                      id="logo-file-input"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadLogo(file);
                        e.target.value = '';
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      disabled={uploadingLogo}
                      onClick={() => document.getElementById('logo-file-input')?.click()}
                      className="w-full sm:w-auto"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {uploadingLogo ? 'Enviando...' : 'Enviar arquivo'}
                    </Button>
                  </>
                )}
              </div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Image className="h-3 w-3" />
                Envie um arquivo de imagem ou cole a URL de uma logo já hospedada. Ela aparecerá no menu lateral, no topo do sistema e na tela de login.
              </p>
              {config.logo_url && (
                <div className="mt-2 p-4 border rounded-lg bg-muted/50">
                  <p className="text-sm font-medium mb-2">Pré-visualização:</p>
                  <img
                    src={config.logo_url}
                    alt="Logo Preview"
                    className="max-h-20 object-contain"
                    onError={(e) => {
                      e.currentTarget.src = '';
                      e.currentTarget.alt = 'Erro ao carregar imagem';
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {isAdmin && (
            <div className="flex justify-end pt-4">
              <Button onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Salvando...' : 'Salvar Configurações'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}