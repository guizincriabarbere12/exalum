// @ts-nocheck - Temporary fix until Supabase types are regenerated
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Warehouse, TrendingDown, TrendingUp, Package, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface EstoqueItem {
  id: string;
  quantidade: number;
  quantidade_minima: number;
  produtos: {
    descricao: string;
    codigo: string;
    peso: number | null;
    preco_por_kg: number | null;
    preco_venda: number;
    categoria: string;
    localizacao?: string;
  } | null;
}

interface Movimentacao {
  id: string;
  tipo: string;
  quantidade: number;
  created_at: string;
  produtos: { descricao: string } | null;
}

export default function Estoque() {
  const [estoque, setEstoque] = useState<EstoqueItem[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalKg, setTotalKg] = useState(0);
  const [valorTotal, setValorTotal] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [categorias, setCategorias] = useState<string[]>([]);

  const fetchEstoque = async () => {
    try {
      const { data: produtosData, error: produtosError } = await supabase
        .from('produtos')
        .select('id, codigo, nome, descricao, estoque, estoque_minimo, peso, preco, categoria, localizacao, ativo')
        .eq('ativo', true)
        .order('estoque', { ascending: true });

      if (produtosError) throw produtosError;

      // Transformar dados para formato esperado
      const estoqueData = (produtosData || []).map(p => ({
        id: p.id,
        quantidade: p.estoque,
        quantidade_minima: p.estoque_minimo,
        produtos: {
          descricao: p.descricao || p.nome,
          codigo: p.codigo,
          peso: p.peso,
          preco_por_kg: null,
          preco_venda: p.preco,
          categoria: p.categoria || 'Outros',
          localizacao: p.localizacao
        }
      }));

      setEstoque(estoqueData);

      // Extrair categorias únicas do banco de dados
      const categoriasUnicas = [...new Set(estoqueData
        .map(item => item.produtos?.categoria)
        .filter(Boolean) as string[])];
      setCategorias(categoriasUnicas);

      // Calculate totals
      let kg = 0;
      let valor = 0;
      estoqueData.forEach(item => {
        const produto = item.produtos;
        if (produto?.peso) {
          kg += item.quantidade * produto.peso;
        }
        valor += item.quantidade * (produto?.preco_venda || 0);
      });
      setTotalKg(kg);
      setValorTotal(valor);

      // Buscar movimentações
      const { data: movData, error: movError } = await supabase
        .from('movimentacoes_estoque')
        .select(`
          id,
          tipo,
          quantidade,
          created_at,
          produtos:produto_id (descricao)
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      if (movError) {
        console.error('Erro ao carregar movimentações:', movError);
      } else {
        setMovimentacoes(movData || []);
      }
    } catch (error: any) {
      toast({
        title: "Erro ao carregar estoque",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEstoque();
  }, []);

  const estoquesFiltrados = estoque.filter(item => {
    const matchSearch = item.produtos?.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       item.produtos?.codigo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchTipo = filtroTipo === "todos" || item.produtos?.categoria === filtroTipo;
    return matchSearch && matchTipo;
  });

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="text-center py-8 text-muted-foreground">
          Carregando estoque...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-3xl font-bold text-foreground">Controle de Estoque</h2>
        <p className="text-muted-foreground">Gerencie entradas e saídas de produtos</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total em Alumínio</p>
                <h3 className="text-2xl font-bold text-foreground">
                  {totalKg.toFixed(2)} kg
                </h3>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Package className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Valor Total</p>
                <h3 className="text-2xl font-bold text-foreground">
                  R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </h3>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-success/10">
                <TrendingUp className="h-6 w-6 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Produtos</p>
                <h3 className="text-2xl font-bold text-foreground">
                  {estoque.length}
                </h3>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Warehouse className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Estoque Atual
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar no estoque..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                {categorias.map(categoria => (
                  <SelectItem key={categoria} value={categoria}>
                    {categoria}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Localização</TableHead>
                <TableHead className="text-right">Quantidade</TableHead>
                <TableHead className="text-right">Peso (kg)</TableHead>
                <TableHead className="text-right">Total (kg)</TableHead>
                <TableHead className="text-right">Preço/kg</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {estoquesFiltrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Nenhum produto encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                estoquesFiltrados.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.produtos?.codigo || '-'}
                    </TableCell>
                    <TableCell>{item.produtos?.descricao || '-'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {item.produtos?.categoria || 'Outros'}
                      </Badge>
                    </TableCell>
                    <TableCell>{item.produtos?.localizacao || '-'}</TableCell>
                    <TableCell className="text-right">{item.quantidade}</TableCell>
                    <TableCell className="text-right">
                      {item.produtos?.peso ? item.produtos.peso.toFixed(3) : '-'}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {item.produtos?.peso 
                        ? (item.quantidade * item.produtos.peso).toFixed(2)
                        : '-'
                      }
                    </TableCell>
                    <TableCell className="text-right">
                      {item.produtos?.preco_por_kg
                        ? `R$ ${item.produtos.preco_por_kg.toFixed(2)}`
                        : '-'
                      }
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          item.quantidade <= item.quantidade_minima
                            ? "destructive"
                            : "default"
                        }
                      >
                        {item.quantidade <= item.quantidade_minima
                          ? "Baixo"
                          : "OK"
                        }
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Warehouse className="h-5 w-5 text-primary" />
            Movimentações Recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {movimentacoes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhuma movimentação cadastrada.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Responsável</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movimentacoes.map((movement) => (
                  <TableRow key={movement.id}>
                    <TableCell className="font-medium">
                      {movement.produtos?.descricao || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={movement.tipo === "entrada" ? "default" : "secondary"}
                        className="gap-1"
                      >
                        {movement.tipo === "entrada" ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : (
                          <TrendingDown className="h-3 w-3" />
                        )}
                        {movement.tipo}
                      </Badge>
                    </TableCell>
                    <TableCell
                      className={`text-right font-semibold ${
                        movement.tipo === "entrada" ? "text-success" : "text-destructive"
                      }`}
                    >
                      {movement.tipo === "entrada" ? "+" : "-"}
                      {movement.quantidade}
                    </TableCell>
                    <TableCell>
                      {new Date(movement.created_at).toLocaleDateString("pt-BR")}
                    </TableCell>
                    <TableCell>Sistema</TableCell>
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