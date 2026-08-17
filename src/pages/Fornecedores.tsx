// @ts-nocheck - Temporary fix until Supabase types are regenerated
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Truck } from "lucide-react";
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
import AddFornecedorDialog from "@/components/fornecedores/AddFornecedorDialog";
import { useAuth } from "@/hooks/useAuth";

interface Fornecedor {
  id: string;
  nome: string;
  cnpj: string;
  telefone: string | null;
  email: string | null;
}

export default function Fornecedores() {
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const { isAdmin } = useAuth();

  const fetchFornecedores = async () => {
    try {
      const { data, error } = await supabase
        .from('fornecedores')
        .select('id, nome, cnpj, telefone, email')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFornecedores(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar fornecedores",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFornecedores();
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Fornecedores</h2>
          <p className="text-muted-foreground">Gerencie seus fornecedores</p>
        </div>
        {isAdmin && <AddFornecedorDialog onFornecedorAdded={fetchFornecedores} />}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-primary" />
            Lista de Fornecedores
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando fornecedores...
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>E-mail</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fornecedores.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                      Nenhum fornecedor cadastrado. {isAdmin && "Clique em 'Novo Fornecedor' para adicionar."}
                    </TableCell>
                  </TableRow>
                ) : (
                  fornecedores.map((fornecedor) => (
                    <TableRow key={fornecedor.id}>
                      <TableCell className="font-medium">{fornecedor.nome}</TableCell>
                      <TableCell>{fornecedor.cnpj}</TableCell>
                      <TableCell>{fornecedor.telefone || "-"}</TableCell>
                      <TableCell>{fornecedor.email || "-"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
