// @ts-nocheck - Temporary fix until Supabase types are regenerated
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShoppingCart, Search, Building2, DollarSign, Package, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Filial { id: string; nome: string; codigo: string; }
interface Venda {
  id: string;
  numero: string;
  valor_total: number;
  status: string;
  created_at: string;
  tipo: 'venda' | 'orcamento' | 'pedido';
  filial_id: string | null;
  clientes: { nome: string } | null;
  filiais: { nome: string } | null;
}

const MATRIZ_ID = "__MATRIZ__";

const statusColors: Record<string, string> = {
  pendente: "bg-yellow-100 text-yellow-800 border-yellow-200",
  pago: "bg-green-100 text-green-800 border-green-200",
  entregue: "bg-blue-100 text-blue-800 border-blue-200",
  cancelado: "bg-red-100 text-red-800 border-red-200",
  aprovado: "bg-green-100 text-green-800 border-green-200",
  confirmado: "bg-blue-100 text-blue-800 border-blue-200",
  em_separacao: "bg-orange-100 text-orange-800 border-orange-200",
  enviado: "bg-purple-100 text-purple-800 border-purple-200",
  rejeitado: "bg-red-100 text-red-800 border-red-200",
};

const tipoColors: Record<string, string> = {
  venda: "bg-primary/10 text-primary border-primary/20",
  orcamento: "bg-blue-50 text-blue-700 border-blue-200",
  pedido: "bg-purple-50 text-purple-700 border-purple-200",
};

export default function Vendas() {
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [filiais, setFiliais] = useState<Filial[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroFilial, setFiltroFilial] = useState<string>("todos");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");

  const fetchVendas = useCallback(async () => {
    try {
      setLoading(true);
      const [{ data: filiaisData, error: filiaisError }] = await Promise.all([
        supabase.from("filiais").select("id, nome, codigo").eq("ativo", true).order("nome"),
      ]);
      if (filiaisError) throw filiaisError;
      setFiliais(filiaisData || []);

      const [vRes, oRes, pRes] = await Promise.all([
        supabase.from("vendas").select("id, numero, valor_total, status, created_at, filial_id, clientes(nome), filiais:filial_id(nome)").order("created_at", { ascending: false }),
        supabase.from("orcamentos").select("id, numero, valor_total, status, created_at, clientes(nome)").eq("status", "aprovado").order("created_at", { ascending: false }),
        supabase.from("pedidos").select("id, numero, valor_total, status, created_at, filial_id, clientes(nome), filiais:filial_id(nome)").eq("status", "confirmado").order("created_at", { ascending: false }),
      ]);
      if (vRes.error) throw vRes.error;
      if (oRes.error) throw oRes.error;
      if (pRes.error) throw pRes.error;

      const vendasFormatadas: Venda[] = (vRes.data || []).map((v: any) => ({ ...v, tipo: "venda" as const }));
      const orcamentosFormatados: Venda[] = (oRes.data || []).map((o: any) => ({ ...o, tipo: "orcamento" as const, filial_id: null, filiais: null }));
      const pedidosFormatados: Venda[] = (pRes.data || []).map((p: any) => ({ ...p, tipo: "pedido" as const }));

      const todas = [...vendasFormatadas, ...orcamentosFormatados, ...pedidosFormatados]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setVendas(todas);
    } catch (error: any) {
      toast({ title: "Erro ao carregar vendas", description: error.message, variant: "destructive" });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchVendas(); }, [fetchVendas]);

  const vendasFiltradas = vendas.filter(v => {
    const matchSearch = v.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v.clientes?.nome || "").toLowerCase().includes(searchTerm.toLowerCase());
    const matchFilial = filtroFilial === "todos" ||
      (filtroFilial === MATRIZ_ID && !v.filial_id) ||
      v.filial_id === filtroFilial;
    const matchTipo = filtroTipo === "todos" || v.tipo === filtroTipo;
    return matchSearch && matchFilial && matchTipo;
  });

  const totalVendas = vendasFiltradas.length;
  const valorTotal = vendasFiltradas.reduce((acc, v) => acc + (Number(v.valor_total) || 0), 0);
  const valorPendente = vendasFiltradas.filter(v => v.status === "pendente" || v.status === "aprovado" || v.status === "confirmado").reduce((acc, v) => acc + (Number(v.valor_total) || 0), 0);
  const valorPago = vendasFiltradas.filter(v => v.status === "pago" || v.status === "entregue").reduce((acc, v) => acc + (Number(v.valor_total) || 0), 0);

  const locs = [{ id: MATRIZ_ID, nome: "Matriz" }, ...filiais.map(f => ({ id: f.id, nome: f.nome }))];

  const getFilialNome = (v: Venda) => {
    if (!v.filial_id) return "Matriz";
    return v.filiais?.nome || "Filial";
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Vendas</h2>
          <p className="text-muted-foreground">Gerencie suas vendas e pedidos por filial</p>
        </div>
        <Button variant="outline" onClick={fetchVendas} disabled={loading} className="w-full sm:w-auto">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-card to-blue-50/30 hover:shadow-xl transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl" />
          <CardContent className="p-6 relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total de Vendas</p>
                <h3 className="text-2xl font-bold">{totalVendas}</h3>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent shadow-lg"><ShoppingCart className="h-6 w-6 text-white" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-card to-green-50/30 hover:shadow-xl transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/5 rounded-full blur-2xl" />
          <CardContent className="p-6 relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Valor Total</p>
                <h3 className="text-2xl font-bold">R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-success shadow-lg"><DollarSign className="h-6 w-6 text-white" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-card to-yellow-50/30 hover:shadow-xl transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-500/5 rounded-full blur-2xl" />
          <CardContent className="p-6 relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pendente</p>
                <h3 className="text-2xl font-bold text-yellow-600">R$ {valorPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-400 to-amber-500 shadow-lg"><Package className="h-6 w-6 text-white" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-card to-green-50/30 hover:shadow-xl transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/5 rounded-full blur-2xl" />
          <CardContent className="p-6 relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Recebido</p>
                <h3 className="text-2xl font-bold text-green-600">R$ {valorPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-success shadow-lg"><DollarSign className="h-6 w-6 text-white" /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShoppingCart className="h-5 w-5 text-primary" />Vendas e Pedidos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Buscar por número ou cliente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
            <Select value={filtroFilial} onValueChange={setFiltroFilial}>
              <SelectTrigger className="w-[180px]"><Building2 className="h-4 w-4 mr-2" /><SelectValue placeholder="Filial" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as Filiais</SelectItem>
                {locs.map(l => <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os Tipos</SelectItem>
                <SelectItem value="venda">Vendas</SelectItem>
                <SelectItem value="orcamento">Orçamentos</SelectItem>
                <SelectItem value="pedido">Pedidos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando vendas...</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Filial</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Valor Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vendasFiltradas.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma venda encontrada.</TableCell></TableRow>
                  ) : vendasFiltradas.map((venda) => (
                    <TableRow key={`${venda.tipo}-${venda.id}`}>
                      <TableCell className="font-mono font-medium">{venda.numero}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={tipoColors[venda.tipo] || ""}>
                          <span className="capitalize">{venda.tipo}</span>
                        </Badge>
                      </TableCell>
                      <TableCell>{venda.clientes?.nome || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="bg-muted/50">
                          <Building2 className="h-3 w-3 mr-1" />
                          {getFilialNome(venda)}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(venda.created_at).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="text-right font-semibold">R$ {(Number(venda.valor_total) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusColors[venda.status] || "bg-gray-100 text-gray-800 border-gray-200"}>
                          <span className="capitalize">{venda.status}</span>
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
