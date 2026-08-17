// @ts-nocheck - Temporary fix until Supabase types are regenerated
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import AddClienteDialog from "@/components/clientes/AddClienteDialog";
import EditClienteDialog from "@/components/clientes/EditClienteDialog";

interface Cliente {
  id: string;
  nome: string;
  cpf_cnpj: string;
  inscricao_estadual: string | null;
  telefone: string | null;
  email: string | null;
  cep: string | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
}

export default function Clientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const fetchClientes = async () => {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClientes(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar clientes",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientes();
  }, []);

  const handleEdit = (cliente: Cliente) => {
    setEditingCliente(cliente);
    setEditDialogOpen(true);
  };

  const formatEndereco = (cliente: Cliente) => {
    const partes = [];
    if (cliente.endereco) partes.push(cliente.endereco);
    if (cliente.bairro) partes.push(cliente.bairro);
    if (cliente.cidade && cliente.estado) {
      partes.push(`${cliente.cidade} - ${cliente.estado}`);
    } else if (cliente.cidade) {
      partes.push(cliente.cidade);
    }
    if (cliente.cep) partes.push(`CEP: ${cliente.cep}`);

    return partes.length > 0 ? partes.join(', ') : '-';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Clientes</h2>
          <p className="text-muted-foreground">Gerencie seus clientes</p>
        </div>
        <AddClienteDialog onClienteAdded={fetchClientes} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Lista de Clientes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando clientes...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>CPF/CNPJ</TableHead>
                    <TableHead>Inscrição Estadual</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead className="min-w-[300px]">Endereço</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Nenhum cliente cadastrado. Clique em "Novo Cliente" para adicionar.
                      </TableCell>
                    </TableRow>
                  ) : (
                    clientes.map((cliente) => (
                      <TableRow key={cliente.id}>
                        <TableCell className="font-medium">{cliente.nome}</TableCell>
                        <TableCell>{cliente.cpf_cnpj || "-"}</TableCell>
                        <TableCell>{cliente.inscricao_estadual || "-"}</TableCell>
                        <TableCell>{cliente.telefone || "-"}</TableCell>
                        <TableCell>{cliente.email || "-"}</TableCell>
                        <TableCell className="text-sm">
                          {formatEndereco(cliente)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(cliente)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <EditClienteDialog
        cliente={editingCliente}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onClienteUpdated={fetchClientes}
      />
    </div>
  );
}
