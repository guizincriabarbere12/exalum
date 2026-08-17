// @ts-nocheck - Temporary fix until Supabase types are regenerated
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package } from "lucide-react";
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

interface Pedido {
  id: string;
  numero: string;
  status: string;
  valor_total: number;
  data: string;
}

const statusColors = {
  pendente: "secondary",
  confirmado: "default",
  em_separacao: "default",
  enviado: "default",
  entregue: "default",
  cancelado: "destructive",
} as const;

export default function MeusPedidos() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPedidos();
  }, []);

  const fetchPedidos = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Buscar cliente do usuário
      const { data: cliente } = await supabase
        .from('clientes')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!cliente) {
        setPedidos([]);
        setLoading(false);
        return;
      }

      // Buscar pedidos do cliente
      const { data, error } = await supabase
        .from('pedidos')
        .select('id, numero, status, valor_total, data')
        .eq('cliente_id', cliente.id)
        .order('data', { ascending: false });

      if (error) throw error;
      setPedidos(data || []);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar pedidos",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="text-center py-8 text-muted-foreground">
          Carregando pedidos...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-3xl font-bold text-foreground">Meus Pedidos</h2>
        <p className="text-muted-foreground">Acompanhe o status dos seus pedidos</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Histórico de Pedidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pedidos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Você ainda não fez nenhum pedido.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pedidos.map((pedido) => (
                  <TableRow key={pedido.id}>
                    <TableCell className="font-medium">{pedido.numero}</TableCell>
                    <TableCell>
                      {new Date(pedido.data).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      R$ {pedido.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusColors[pedido.status as keyof typeof statusColors] || "secondary"}>
                        {pedido.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}