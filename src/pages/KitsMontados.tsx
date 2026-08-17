// app/kits-montados/page.tsx
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Package, 
  AlertCircle, 
  ChevronDown, 
  ChevronUp, 
  Search,
  Filter,
  RefreshCw,
  DollarSign,
  Boxes
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import CriarKitDialog from "@/components/produtos/CriarKitDialog";

interface Produto {
  id: string;
  codigo: string;
  nome: string;
  descricao?: string | null;
  estoque: number;
  ativo: boolean;
}

interface KitItem {
  id: string;
  kit_id: string;
  produto_id: string;
  quantidade: number;
  created_at: string;
  produto?: {
    codigo: string;
    nome: string;
    estoque: number;
  };
}

interface Kit {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  preco_total: number;
  ativo: boolean;
  itens: KitItem[];
  estoque_disponivel: number;
}

export default function KitsMontados() {
  const [kits, setKits] = useState<Kit[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedKits, setExpandedKits] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [filterAtivo, setFilterAtivo] = useState<string>("all");

  const loadAllData = async () => {
    setLoading(true);
    try {
      console.log("🔍 Iniciando carregamento de dados...");
      
      // 1. Buscar todos os kits
      console.log("📦 Buscando kits...");
      const { data: kitsData, error: kitsError } = await supabase
        .from('kits')
        .select('*')
        .order('nome');

      if (kitsError) {
        console.error("❌ Erro ao buscar kits:", kitsError);
        throw kitsError;
      }

      console.log(`📊 Kits encontrados: ${kitsData?.length || 0}`);
      console.log("Dados dos kits:", kitsData);

      if (!kitsData || kitsData.length === 0) {
        console.log("ℹ️ Nenhum kit encontrado no banco");
        setKits([]);
        return;
      }

      // 2. Para cada kit, buscar seus itens
      console.log("🔍 Buscando itens dos kits...");
      const kitsComItens = await Promise.all(
        kitsData.map(async (kit) => {
          console.log(`  → Buscando itens do kit ${kit.codigo} (${kit.id})...`);
          
          const { data: itensData, error: itensError } = await supabase
            .from('kit_itens')
            .select(`
              id,
              kit_id,
              produto_id,
              quantidade,
              created_at,
              produto:produtos (
                codigo,
                nome,
                estoque
              )
            `)
            .eq('kit_id', kit.id);

          if (itensError) {
            console.error(`  ❌ Erro ao buscar itens do kit ${kit.id}:`, itensError);
            return {
              ...kit,
              itens: [],
              estoque_disponivel: 0
            };
          }

          console.log(`  ✅ Itens encontrados: ${itensData?.length || 0}`);

          // Processar os itens
          const itensProcessados = (itensData || []).map(item => ({
            ...item,
            produto: Array.isArray(item.produto) ? item.produto[0] : item.produto
          }));

          // Calcular estoque disponível do kit
          let estoque_disponivel = Infinity;
          itensProcessados.forEach(item => {
            if (item.produto) {
              const kitsPossiveis = Math.floor(item.produto.estoque / item.quantidade);
              console.log(`    → Produto ${item.produto.codigo}: estoque=${item.produto.estoque}, necessário=${item.quantidade}, kits=${kitsPossiveis}`);
              if (kitsPossiveis < estoque_disponivel) {
                estoque_disponivel = kitsPossiveis;
              }
            }
          });

          const estoqueFinal = estoque_disponivel === Infinity ? 0 : estoque_disponivel;
          console.log(`  📊 Estoque disponível do kit: ${estoqueFinal}`);

          return {
            ...kit,
            itens: itensProcessados,
            estoque_disponivel: estoqueFinal
          };
        })
      );

      console.log("✅ Todos os kits processados:", kitsComItens);
      setKits(kitsComItens);
      
    } catch (error: any) {
      console.error("❌ Erro ao carregar dados:", error);
      toast({
        title: "Erro ao carregar dados",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadAllData();
    toast({
      title: "Dados atualizados",
      description: "Lista de kits recarregada com sucesso",
    });
  };

  const toggleKit = (kitId: string) => {
    setExpandedKits(prev => {
      const newSet = new Set(prev);
      if (newSet.has(kitId)) {
        newSet.delete(kitId);
      } else {
        newSet.add(kitId);
      }
      return newSet;
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getStatusBadge = (kit: Kit) => {
    if (!kit.ativo) return <Badge variant="destructive">Inativo</Badge>;
    if (kit.estoque_disponivel === 0) return <Badge variant="destructive">Sem Estoque</Badge>;
    if (kit.estoque_disponivel < 5) return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Estoque Baixo</Badge>;
    return <Badge variant="default" className="bg-green-100 text-green-800">Disponível</Badge>;
  };

  const getItemStatus = (item: KitItem) => {
    const estoque = item.produto?.estoque || 0;
    if (estoque === 0) return "destructive";
    if (estoque < item.quantidade) return "destructive";
    return "default";
  };

  const filteredKits = kits.filter(kit => {
    const matchesSearch = kit.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         kit.codigo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAtivo = filterAtivo === "all" || 
                        (filterAtivo === "true" && kit.ativo) || 
                        (filterAtivo === "false" && !kit.ativo);
    return matchesSearch && matchesAtivo;
  });

  // Estatísticas
  const totalKits = kits.length;
  const kitsComEstoque = kits.filter(k => k.estoque_disponivel > 0).length;
  const totalUnidadesEstoque = kits.reduce((acc, k) => acc + k.estoque_disponivel, 0);
  const valorTotalEstoque = kits.reduce((acc, kit) => 
    acc + (kit.preco_total * kit.estoque_disponivel), 0
  );

  return (
    <div className="space-y-6 p-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Kits Montados</h1>
          <p className="text-muted-foreground">
            Gerencie kits de produtos com controle automático de estoque
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="default"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <CriarKitDialog onKitAdded={loadAllData} />
        </div>
      </div>

      {/* Cards de estatísticas - só mostra se houver kits */}
      {kits.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Kits</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalKits}</div>
              <p className="text-xs text-muted-foreground">
                {kitsComEstoque} com estoque disponível
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Kits em Estoque</CardTitle>
              <Boxes className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalUnidadesEstoque}</div>
              <p className="text-xs text-muted-foreground">
                unidades disponíveis para venda
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor em Estoque</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(valorTotalEstoque)}</div>
              <p className="text-xs text-muted-foreground">
                valor total dos kits em estoque
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filtros - só mostra se houver kits */}
      {kits.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar kit por nome ou código..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterAtivo} onValueChange={setFilterAtivo}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os kits</SelectItem>
              <SelectItem value="true">Apenas ativos</SelectItem>
              <SelectItem value="false">Apenas inativos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Lista de Kits */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Kits Disponíveis
            {kits.length > 0 && (
              <Badge variant="outline" className="ml-2">
                {filteredKits.length} {filteredKits.length === 1 ? 'kit' : 'kits'}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : kits.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg">Nenhum kit encontrado</p>
              <p className="text-sm mt-2">
                Clique no botão "Novo Kit" para começar a cadastrar seus kits.
              </p>
            </div>
          ) : filteredKits.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg">Nenhum kit corresponde aos filtros</p>
              <p className="text-sm mt-2">
                Tente ajustar os termos de busca ou o filtro de status.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredKits.map((kit) => (
                <Card key={kit.id} className="overflow-hidden border">
                  <Collapsible 
                    open={expandedKits.has(kit.id)}
                    onOpenChange={() => toggleKit(kit.id)}
                  >
                    {/* Cabeçalho do Kit */}
                    <div className="p-4 bg-white">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 flex-wrap">
                            <h3 className="text-lg font-semibold">{kit.nome}</h3>
                            {getStatusBadge(kit)}
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-3">
                            <div>
                              <p className="text-xs text-muted-foreground">Código</p>
                              <p className="text-sm font-mono">{kit.codigo}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Preço</p>
                              <p className="text-sm font-semibold text-primary">
                                {formatCurrency(kit.preco_total)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Kits Disponíveis</p>
                              <p className="text-sm font-semibold">{kit.estoque_disponivel}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Componentes</p>
                              <p className="text-sm">{kit.itens?.length || 0}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Valor em Estoque</p>
                              <p className="text-sm font-semibold">
                                {formatCurrency(kit.preco_total * kit.estoque_disponivel)}
                              </p>
                            </div>
                          </div>
                          
                          {kit.descricao && (
                            <p className="text-sm text-muted-foreground mt-2 italic">
                              {kit.descricao}
                            </p>
                          )}
                        </div>

                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="gap-2">
                            {expandedKits.has(kit.id) ? (
                              <>Esconder <ChevronUp className="h-4 w-4" /></>
                            ) : (
                              <>Ver componentes <ChevronDown className="h-4 w-4" /></>
                            )}
                          </Button>
                        </CollapsibleTrigger>
                      </div>
                    </div>

                    {/* Itens do Kit */}
                    <CollapsibleContent>
                      <div className="border-t bg-gray-50 p-4">
                        <h4 className="text-sm font-semibold mb-4 flex items-center gap-2">
                          <Package className="h-4 w-4" />
                          Componentes do Kit
                        </h4>
                        
                        {kit.itens && kit.itens.length > 0 ? (
                          <div className="rounded-md border bg-white">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Código</TableHead>
                                  <TableHead>Produto</TableHead>
                                  <TableHead className="text-right">Qtd Necessária</TableHead>
                                  <TableHead className="text-right">Estoque</TableHead>
                                  <TableHead className="text-right">Kits Possíveis</TableHead>
                                  <TableHead className="text-center">Status</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {kit.itens.map((item) => {
                                  const kitsPossiveis = item.produto 
                                    ? Math.floor(item.produto.estoque / item.quantidade)
                                    : 0;
                                  
                                  return (
                                    <TableRow key={item.id}>
                                      <TableCell className="font-mono text-sm">
                                        {item.produto?.codigo || 'N/A'}
                                      </TableCell>
                                      <TableCell className="font-medium">
                                        {item.produto?.nome || 'Produto não encontrado'}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        {item.quantidade}
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <Badge variant={getItemStatus(item)}>
                                          {item.produto?.estoque || 0}
                                        </Badge>
                                      </TableCell>
                                      <TableCell className="text-right font-medium">
                                        {kitsPossiveis}
                                      </TableCell>
                                      <TableCell className="text-center">
                                        <Badge 
                                          variant={getItemStatus(item)}
                                          className="text-xs"
                                        >
                                          {item.produto?.estoque >= item.quantidade ? 'OK' : 'Insuficiente'}
                                        </Badge>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        ) : (
                          <div className="text-center py-8 bg-white rounded-lg border">
                            <Package className="h-8 w-8 mx-auto mb-2 opacity-30" />
                            <p className="text-muted-foreground">
                              Este kit não possui componentes cadastrados
                            </p>
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}