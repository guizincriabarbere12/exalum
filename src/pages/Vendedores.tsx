import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserPlus, Users, Pencil, Trash2 } from "lucide-react";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

interface Vendedor {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
  comissao_percentual: number;
  ativo: boolean | null;
}

export default function Vendedores() {
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedVendedor, setSelectedVendedor] = useState<Vendedor | null>(null);
  const { isAdmin } = useAuth();

  // Form state
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    telefone: "",
    comissao_percentual: 5,
    ativo: true,
  });

  const fetchVendedores = async () => {
    try {
      const { data, error } = await supabase
        .from('vendedores')
        .select('id, nome, email, telefone, comissao_percentual, ativo')
        .order('nome');

      if (error) throw error;
      setVendedores(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar vendedores",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendedores();
  }, []);

  const resetForm = () => {
    setFormData({
      nome: "",
      email: "",
      telefone: "",
      comissao_percentual: 5,
      ativo: true,
    });
  };

  const handleAdd = async () => {
    try {
      const { error } = await supabase
        .from('vendedores')
        .insert([{
          nome: formData.nome,
          email: formData.email,
          telefone: formData.telefone || null,
          comissao_percentual: formData.comissao_percentual,
          ativo: formData.ativo,
        }]);

      if (error) throw error;

      toast({
        title: "Vendedor adicionado",
        description: "Vendedor cadastrado com sucesso.",
      });

      setIsAddDialogOpen(false);
      resetForm();
      fetchVendedores();
    } catch (error: any) {
      toast({
        title: "Erro ao adicionar vendedor",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEdit = async () => {
    if (!selectedVendedor) return;

    try {
      const { error } = await supabase
        .from('vendedores')
        .update({
          nome: formData.nome,
          email: formData.email,
          telefone: formData.telefone || null,
          comissao_percentual: formData.comissao_percentual,
          ativo: formData.ativo,
        })
        .eq('id', selectedVendedor.id);

      if (error) throw error;

      toast({
        title: "Vendedor atualizado",
        description: "Dados do vendedor atualizados com sucesso.",
      });

      setIsEditDialogOpen(false);
      setSelectedVendedor(null);
      resetForm();
      fetchVendedores();
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar vendedor",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!selectedVendedor) return;

    try {
      const { error } = await supabase
        .from('vendedores')
        .delete()
        .eq('id', selectedVendedor.id);

      if (error) throw error;

      toast({
        title: "Vendedor excluído",
        description: "Vendedor removido com sucesso.",
      });

      setIsDeleteDialogOpen(false);
      setSelectedVendedor(null);
      fetchVendedores();
    } catch (error: any) {
      toast({
        title: "Erro ao excluir vendedor",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (vendedor: Vendedor) => {
    setSelectedVendedor(vendedor);
    setFormData({
      nome: vendedor.nome,
      email: vendedor.email,
      telefone: vendedor.telefone || "",
      comissao_percentual: vendedor.comissao_percentual,
      ativo: vendedor.ativo ?? true,
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (vendedor: Vendedor) => {
    setSelectedVendedor(vendedor);
    setIsDeleteDialogOpen(true);
  };

  const vendedorFormContent = (
    <div className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="nome">Nome</Label>
        <Input
          id="nome"
          value={formData.nome}
          onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
          placeholder="Nome do vendedor"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          placeholder="email@exemplo.com"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="telefone">Telefone</Label>
        <Input
          id="telefone"
          value={formData.telefone}
          onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
          placeholder="(00) 00000-0000"
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="comissao">Comissão (%)</Label>
        <Input
          id="comissao"
          type="number"
          step="0.1"
          min="0"
          max="100"
          value={formData.comissao_percentual}
          onChange={(e) => setFormData({ ...formData, comissao_percentual: parseFloat(e.target.value) || 0 })}
        />
      </div>
      <div className="flex items-center gap-2">
        <Switch
          id="ativo"
          checked={formData.ativo}
          onCheckedChange={(checked) => setFormData({ ...formData, ativo: checked })}
        />
        <Label htmlFor="ativo">Ativo</Label>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Vendedores</h2>
          <p className="text-muted-foreground">Gerencie seus vendedores e comissões</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <UserPlus className="h-4 w-4 mr-2" />
            Novo Vendedor
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Lista de Vendedores
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando vendedores...
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead className="text-right">Comissão</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  {isAdmin && <TableHead className="text-center">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendedores.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? 6 : 5} className="text-center py-8 text-muted-foreground">
                      Nenhum vendedor cadastrado. {isAdmin && "Clique em 'Novo Vendedor' para adicionar."}
                    </TableCell>
                  </TableRow>
                ) : (
                  vendedores.map((vendedor) => (
                    <TableRow key={vendedor.id}>
                      <TableCell className="font-medium">{vendedor.nome}</TableCell>
                      <TableCell>{vendedor.email}</TableCell>
                      <TableCell>{vendedor.telefone || "-"}</TableCell>
                      <TableCell className="text-right">{vendedor.comissao_percentual}%</TableCell>
                      <TableCell className="text-center">
                        <Badge variant={vendedor.ativo ? "default" : "secondary"}>
                          {vendedor.ativo ? "Ativo" : "Inativo"}
                        </Badge>
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-center">
                          <div className="flex justify-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(vendedor)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openDeleteDialog(vendedor)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Vendedor</DialogTitle>
            <DialogDescription>
              Cadastre um novo vendedor no sistema.
            </DialogDescription>
          </DialogHeader>
          {vendedorFormContent}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsAddDialogOpen(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button onClick={handleAdd} disabled={!formData.nome || !formData.email}>
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Vendedor</DialogTitle>
            <DialogDescription>
              Atualize os dados do vendedor.
            </DialogDescription>
          </DialogHeader>
          {vendedorFormContent}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsEditDialogOpen(false); setSelectedVendedor(null); resetForm(); }}>
              Cancelar
            </Button>
            <Button onClick={handleEdit} disabled={!formData.nome || !formData.email}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Vendedor</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o vendedor "{selectedVendedor?.nome}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedVendedor(null)}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
