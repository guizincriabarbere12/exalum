// @ts-nocheck - Temporary fix until Supabase types are regenerated
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

interface Venda {
  id: string;
  numero: string;
  valor_total: number;
  status: string;
  created_at: string;
  tipo: 'venda' | 'orcamento' | 'pedido';
  clientes: { nome: string } | null;
}

const statusColors = {
  pendente: "secondary",
  pago: "default",
  entregue: "default",
  cancelado: "destructive",
  aprovado: "default",
  confirmado: "default",
} as const;

export default function Vendas() {
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchVendas = async () => {
    try {
      const { data: vendasData, error: vendasError } = await supabase
        .from('vendas')
        .select('id, numero, valor_total, status, created_at, clientes(nome)')
        .order('created_at', { ascending: false });

      if (vendasError) throw vendasError;

      const { data: orcamentosData, error: orcamentosError } = await supabase
        .from('orcamentos')
        .select('id, numero, valor_total, status, created_at, clientes(nome)')
        .eq('status', 'aprovado')
        .order('created_at', { ascending: false });

      if (orcamentosError) throw orcamentosError;

      const { data: pedidosData, error: pedidosError } = await supabase
        .from('pedidos')
        .select('id, numero, valor_total, status, created_at, clientes(nome)')
        .eq('status', 'confirmado')
        .order('created_at', { ascending: false });

      if (pedidosError) throw pedidosError;

      const vendasFormatadas: Venda[] = (vendasData || []).map(v => ({
        ...v,
        tipo: 'venda' as const
      }));

      const orcamentosFormatados: Venda[] = (orcamentosData || []).map(o => ({
        ...o,
        tipo: 'orcamento' as const
      }));

      const pedidosFormatados: Venda[] = (pedidosData || []).map(p => ({
        ...p,
        tipo: 'pedido' as const
      }));

      const todasVendas = [...vendasFormatadas, ...orcamentosFormatados, ...pedidosFormatados]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setVendas(todasVendas);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar vendas",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendas();
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-3xl font-bold text-foreground">Vendas</h2>
        <p className="text-muted-foreground">Gerencie suas vendas e pedidos</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            Pedidos Recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando vendas...
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendas.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhuma venda cadastrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  vendas.map((venda) => (
                    <TableRow key={`${venda.tipo}-${venda.id}`}>
                      <TableCell className="font-medium">{venda.numero}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {venda.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell>{venda.clientes?.nome || "-"}</TableCell>
                      <TableCell>
                        {new Date(venda.created_at).toLocaleDateString("pt-BR")}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        R$ {venda.valor_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusColors[venda.status as keyof typeof statusColors]}>
                          {venda.status}
                        </Badge>
                      </TableCell>
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
