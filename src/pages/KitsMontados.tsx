// app/kits-montados/page.tsx
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Package,
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  RefreshCw,
  DollarSign,
  Boxes,
  Pencil,
  Layers,
  TrendingUp,
  TrendingDown,
  Minus,
  Wrench,
  Plus,
  Minus as MinusIcon
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

interface Produto {
  id: string;
  codigo: string;
  nome: string;
  descricao?: string | null;
  estoque: number;
  ativo: boolean;
  preco?: number;
  custo?: number;
}

interface SubKit {
  id: string;
  codigo: string;
  nome: string;
  preco_total: number;
}

interface KitItem {
  id: string;
  kit_id: string;
  produto_id: string | null;
  sub_kit_id: string | null;
  quantidade: number;
  created_at: string;
  produto?: {
    id: string;
    codigo: string;
    nome: string;
    estoque: number;
    preco?: number;
    custo?: number;
  };
  sub_kit?: {
    id: string;
    codigo: string;
    nome: string;
    preco_total: number;
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
  custo_total?: number;
  margem_lucro?: number;
  lucro_total?: number;
}

// ============================================
// FUNÇÕES DE CÁLCULO DE CUSTO MELHORADAS
// ============================================

/**
 * Busca os itens de um sub-kit do banco de dados
 */
const fetchSubKitItens = async (subKitId: string): Promise<KitItem[]> => {
  const { data: subKitItens, error } = await supabase
    .from('kit_itens')
    .select(`
      id,
      kit_id,
      produto_id,
      sub_kit_id,
      quantidade,
      created_at,
      produtos (
        id,
        codigo,
        nome,
        estoque,
        preco,
        custo
      )
    `)
    .eq('kit_id', subKitId);

  if (error || !subKitItens) return [];

  // Buscar dados dos sub-kits aninhados
  const itensComSubKits = await Promise.all(subKitItens.map(async (item) => {
    if (item.sub_kit_id) {
      const { data: subKitData } = await supabase
        .from('kits')
        .select('id, codigo, nome, preco_total')
        .eq('id', item.sub_kit_id)
        .single();
      return { ...item, sub_kit: subKitData };
    }
    return item;
  }));

  return itensComSubKits;
};

/**
 * Calcula o custo real de um kit incluindo todos os sub-kits aninhados
 * Versão recursiva que calcula o custo real baseado nos componentes
 */
const calcularCustoKitRecursivoSync = (
  itens: KitItem[],
  todosKits: Kit[],
  cache: Map<string, number> = new Map()
): number => {
  if (!itens || itens.length === 0) return 0;

  let custoTotal = 0;

  for (const item of itens) {
    let custoItem = 0;

    if (item.sub_kit_id) {
      // Verificar se já temos o custo do sub-kit em cache
      if (cache.has(item.sub_kit_id)) {
        custoItem = cache.get(item.sub_kit_id)!;
      } else {
        // Buscar o sub-kit completo na lista de todos os kits
        const subKit = todosKits.find(k => k.id === item.sub_kit_id);
        if (subKit && subKit.itens && subKit.itens.length > 0) {
          // Calcular recursivamente o custo do sub-kit
          custoItem = calcularCustoKitRecursivoSync(subKit.itens, todosKits, cache);
          cache.set(item.sub_kit_id, custoItem);
        }
      }
    } else if (item.produto) {
      // Para produtos, usar o campo custo
      custoItem = item.produto.custo || item.produto.preco || 0;
    }

    custoTotal += custoItem * item.quantidade;
  }

  return custoTotal;
};

/**
 * Calcula o custo real de um kit buscando sub-kits do banco se necessário
 */
const calcularCustoKitRecursivo = async (
  itens: KitItem[],
  todosKits: Kit[],
  cache: Map<string, number> = new Map()
): Promise<number> => {
  if (!itens || itens.length === 0) return 0;

  let custoTotal = 0;

  for (const item of itens) {
    let custoItem = 0;

    if (item.sub_kit_id) {
      if (cache.has(item.sub_kit_id)) {
        custoItem = cache.get(item.sub_kit_id)!;
      } else {
        // Buscar o sub-kit na lista primeiro
        const subKit = todosKits.find(k => k.id === item.sub_kit_id);
        if (subKit && subKit.itens && subKit.itens.length > 0) {
          custoItem = await calcularCustoKitRecursivo(subKit.itens, todosKits, cache);
          cache.set(item.sub_kit_id, custoItem);
        } else {
          // Buscar itens do sub-kit do banco
          const subKitItens = await fetchSubKitItens(item.sub_kit_id);
          if (subKitItens.length > 0) {
            custoItem = await calcularCustoKitRecursivo(subKitItens, todosKits, cache);
            cache.set(item.sub_kit_id, custoItem);
          }
        }
      }
    } else if (item.produto) {
      // Para produtos, usar o campo custo
      custoItem = item.produto.custo || item.produto.preco || 0;
    }

    custoTotal += custoItem * item.quantidade;
  }

  return custoTotal;
};

/**
 * Calcula todas as métricas de um kit (custo, lucro, margem)
 */
const calcularMetricasKit = (kit: Kit, todosKits: Kit[]): { 
  custoTotal: number; 
  lucro: number; 
  margem: number;
} => {
  // Usar cache para melhor performance
  const cache = new Map<string, number>();
  
  // Calcular custo total do kit
  const custoTotal = calcularCustoKitRecursivo(kit.itens, todosKits, cache);
  
  // Calcular lucro e margem
  const lucro = kit.preco_total - custoTotal;
  const margem = kit.preco_total > 0 ? (lucro / kit.preco_total) * 100 : 0;
  
  return { custoTotal, lucro, margem };
};

/**
 * Calcula métricas para todos os kits de uma vez (mais eficiente)
 */
const calcularMetricasTodosKits = async (kits: Kit[]): Promise<Kit[]> => {
  // Cache global para reutilizar cálculos de sub-kits
  const cacheGlobal = new Map<string, number>();

  const kitsComMetricas = await Promise.all(kits.map(async (kit) => {
    // Calcular custo total do kit (agora assíncrono)
    const custoTotal = await calcularCustoKitRecursivo(kit.itens, kits, cacheGlobal);
    const lucro = kit.preco_total - custoTotal;
    const margem = kit.preco_total > 0 ? (lucro / kit.preco_total) * 100 : 0;

    return {
      ...kit,
      custo_total: custoTotal,
      lucro_total: lucro,
      margem_lucro: margem
    };
  }));

  return kitsComMetricas;
};

// ============================================
// FUNÇÕES DE UI (CORES, ÍCONES, BADGES)
// ============================================

const getMargemColor = (margem: number) => {
  if (margem >= 40) return 'text-green-600';
  if (margem >= 20) return 'text-blue-600';
  if (margem >= 10) return 'text-yellow-600';
  if (margem >= 0) return 'text-orange-600';
  return 'text-red-600';
};

const getMargemIcon = (margem: number) => {
  if (margem >= 20) return <TrendingUp className="h-4 w-4" />;
  if (margem >= 0) return <Minus className="h-4 w-4" />;
  return <TrendingDown className="h-4 w-4" />;
};

const getMargemBadge = (margem: number) => {
  if (margem >= 40) return { label: 'Ótima', variant: 'default' };
  if (margem >= 20) return { label: 'Boa', variant: 'secondary' };
  if (margem >= 10) return { label: 'Regular', variant: 'outline' };
  if (margem >= 0) return { label: 'Baixa', variant: 'outline' };
  return { label: 'Prejuízo', variant: 'destructive' };
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export default function KitsMontados() {
  const [kits, setKits] = useState<Kit[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedKits, setExpandedKits] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);
  
  const [editingKit, setEditingKit] = useState<any>(null);
  const [isEditingDialogOpen, setIsEditingDialogOpen] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState("");
  const [filterAtivo, setFilterAtivo] = useState<string>("all");
  const [filterMargem, setFilterMargem] = useState<string>("all");

  // Estado para montar/desmontar kits
  const [isMontarDialogOpen, setIsMontarDialogOpen] = useState(false);
  const [kitParaMontar, setKitParaMontar] = useState<Kit | null>(null);
  const [quantidadeMontar, setQuantidadeMontar] = useState(1);
  const [montandoKit, setMontandoKit] = useState(false);

  // ============================================
  // CARREGAMENTO DE DADOS
  // ============================================

  const loadAllData = async () => {
    setLoading(true);
    try {
      console.log("🔍 Iniciando carregamento de dados...");

      // Buscar todos os kits
      const { data: kitsData, error: kitsError } = await supabase
        .from('kits')
        .select('*')
        .order('nome');

      if (kitsError) {
        console.error("❌ Erro ao buscar kits:", kitsError);
        throw kitsError;
      }

      console.log(`📊 Kits encontrados: ${kitsData?.length || 0}`);

      if (!kitsData || kitsData.length === 0) {
        console.log("ℹ️ Nenhum kit encontrado no banco");
        setKits([]);
        return;
      }

      // Buscar todos os itens dos kits
      let kitsComItens = await Promise.all(
        kitsData.map(async (kit) => {
          console.log(`  → Buscando itens do kit ${kit.codigo} (${kit.id})...`);

          // Buscar itens do kit com os dados dos produtos
          const { data: itensData, error: itensError } = await supabase
            .from('kit_itens')
            .select(`
              id,
              kit_id,
              produto_id,
              sub_kit_id,
              quantidade,
              created_at,
              produtos (
                id,
                codigo,
                nome,
                estoque,
                preco,
                custo
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
          const itensProcessados = await Promise.all((itensData || []).map(async (item) => {
            let produto = null;
            let subKit = null;

            // Buscar produto se existir
            if (item.produto_id) {
              const { data: produtoData } = await supabase
                .from('produtos')
                .select('id, codigo, nome, estoque, preco, custo')
                .eq('id', item.produto_id)
                .single();
              produto = produtoData;
            }

            // Buscar sub-kit se existir
            if (item.sub_kit_id) {
              const { data: subKitData } = await supabase
                .from('kits')
                .select('id, codigo, nome, preco_total')
                .eq('id', item.sub_kit_id)
                .single();
              subKit = subKitData;
            }

            return {
              ...item,
              produto: produto,
              sub_kit: subKit
            };
          }));

          // Calcular estoque disponível
          let estoque_disponivel = Infinity;

          for (const item of itensProcessados) {
            if (item.produto && item.produto_id) {
              const kitsPossiveis = Math.floor(item.produto.estoque / item.quantidade);
              if (kitsPossiveis < estoque_disponivel) {
                estoque_disponivel = kitsPossiveis;
              }
            } else if (item.sub_kit && item.sub_kit_id) {
              // Para sub-kits, buscar o estoque do sub-kit
              const { data: subKitData } = await supabase
                .from('kits')
                .select('*')
                .eq('id', item.sub_kit_id)
                .single();
              
              if (subKitData) {
                // Buscar itens do sub-kit para calcular estoque
                const { data: subKitItens } = await supabase
                  .from('kit_itens')
                  .select(`
                    id,
                    quantidade,
                    produtos (
                      estoque
                    )
                  `)
                  .eq('kit_id', item.sub_kit_id);
                
                if (subKitItens && subKitItens.length > 0) {
                  let subKitEstoque = Infinity;
                  for (const subItem of subKitItens) {
                    const subProduto = Array.isArray(subItem.produtos) ? subItem.produtos[0] : subItem.produtos;
                    if (subProduto) {
                      const possiveis = Math.floor(subProduto.estoque / subItem.quantidade);
                      if (possiveis < subKitEstoque) {
                        subKitEstoque = possiveis;
                      }
                    }
                  }
                  if (subKitEstoque !== Infinity) {
                    const kitsPossiveis = Math.floor(subKitEstoque / item.quantidade);
                    if (kitsPossiveis < estoque_disponivel) {
                      estoque_disponivel = kitsPossiveis;
                    }
                  }
                }
              }
            }
          }

          const estoqueFinal = estoque_disponivel === Infinity ? 0 : estoque_disponivel;

          return {
            ...kit,
            itens: itensProcessados,
            estoque_disponivel: estoqueFinal
          };
        })
      );

      // ============================================
      // CALCULAR CUSTOS, LUCROS E MARGENS
      // ============================================

      console.log("🧮 Calculando custos, lucros e margens...");

      // Adicionar métricas calculadas a todos os kits (agora assíncrono)
      const kitsComMetricas = await calcularMetricasTodosKits(kitsComItens);

      console.log(`✅ Cálculos concluídos para ${kitsComMetricas.length} kits`);
      
      // Log de exemplo para verificar
      if (kitsComMetricas.length > 0) {
        const primeiroKit = kitsComMetricas[0];
        console.log(`📊 Exemplo - Kit: ${primeiroKit.nome}`);
        console.log(`   Custo Total: ${formatCurrency(primeiroKit.custo_total || 0)}`);
        console.log(`   Preço Venda: ${formatCurrency(primeiroKit.preco_total)}`);
        console.log(`   Lucro: ${formatCurrency(primeiroKit.lucro_total || 0)}`);
        console.log(`   Margem: ${(primeiroKit.margem_lucro || 0).toFixed(1)}%`);
      }

      setKits(kitsComMetricas);

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

  // ============================================
  // HANDLERS
  // ============================================

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

  const openMontarDialog = (kit: Kit) => {
    setKitParaMontar(kit);
    setQuantidadeMontar(1);
    setIsMontarDialogOpen(true);
  };

  const handleMontarKit = async () => {
    if (!kitParaMontar || quantidadeMontar <= 0) return;

    setMontandoKit(true);
    try {
      // Para montar um kit, precisamos adicionar componentes ao estoque
      // Primeiro, vamos verificar quais componentes faltam e suas quantidades
      const componentesNecessarios: { produto_id: string; quantidade: number; nome: string; estoqueAtual: number }[] = [];

      for (const item of kitParaMontar.itens) {
        if (item.produto_id && item.produto) {
          componentesNecessarios.push({
            produto_id: item.produto_id,
            quantidade: item.quantidade * quantidadeMontar,
            nome: item.produto.nome,
            estoqueAtual: item.produto.estoque
          });
        }
      }

      // Atualizar o estoque de cada produto (adicionar a quantidade necessária)
      for (const comp of componentesNecessarios) {
        const novoEstoque = comp.estoqueAtual + comp.quantidade;

        const { error: updateError } = await supabase
          .from('produtos')
          .update({ estoque: novoEstoque })
          .eq('id', comp.produto_id);

        if (updateError) {
          console.error(`Erro ao atualizar estoque do produto ${comp.nome}:`, updateError);
          throw new Error(`Falha ao adicionar ${comp.nome} ao estoque`);
        }
      }

      toast({
        title: "Kit montado com sucesso!",
        description: `Adicionados os componentes necessários para montar ${quantidadeMontar} kit(s) "${kitParaMontar.nome}" ao estoque.`,
      });

      setIsMontarDialogOpen(false);
      setKitParaMontar(null);
      loadAllData();

    } catch (error: any) {
      console.error("Erro ao montar kit:", error);
      toast({
        title: "Erro ao montar kit",
        description: error.message || "Não foi possível adicionar os componentes ao estoque.",
        variant: "destructive",
      });
    } finally {
      setMontandoKit(false);
    }
  };

  const handleEditKit = async (kit: Kit) => {
    console.log("✏️ Editando kit:", kit);

    try {
      // Buscar os dados completos do kit novamente para garantir
      const { data: kitCompleto, error: kitError } = await supabase
        .from('kits')
        .select('*')
        .eq('id', kit.id)
        .single();

      if (kitError) {
        console.error("❌ Erro ao buscar kit completo:", kitError);
        throw kitError;
      }

      console.log("📦 Kit completo:", kitCompleto);

      // Buscar todos os itens com seus produtos/sub-kits
      const { data: itensCompletos, error: itensError } = await supabase
        .from('kit_itens')
        .select(`
          id,
          kit_id,
          produto_id,
          sub_kit_id,
          quantidade,
          created_at,
          produtos:produto_id (
            id,
            codigo,
            nome,
            estoque,
            preco,
            custo
          ),
          sub_kits:sub_kit_id (
            id,
            codigo,
            nome,
            preco_total
          )
        `)
        .eq('kit_id', kit.id);

      if (itensError) {
        console.error("❌ Erro ao buscar itens do kit:", itensError);
        throw itensError;
      }

      console.log("📦 Itens encontrados:", itensCompletos);

      // Formatar os itens para o diálogo
      const itensFormatados = (itensCompletos || []).map(item => {
        const produto = item.produtos as any;
        const subKit = item.sub_kits as any;
        
        return {
          id: item.id,
          produto_id: item.produto_id || undefined,
          sub_kit_id: item.sub_kit_id || undefined,
          quantidade: item.quantidade,
          produto: produto ? {
            id: produto.id,
            codigo: produto.codigo,
            nome: produto.nome,
            estoque: produto.estoque,
            preco: produto.preco || 0,
            custo: produto.custo || 0
          } : undefined,
          sub_kit: subKit ? {
            id: subKit.id,
            codigo: subKit.codigo,
            nome: subKit.nome,
            preco_total: subKit.preco_total || 0,
            ativo: true
          } : undefined
        };
      });

      const kitParaEditar = {
        id: kitCompleto.id,
        codigo: kitCompleto.codigo,
        nome: kitCompleto.nome,
        descricao: kitCompleto.descricao || null,
        preco_total: kitCompleto.preco_total,
        ativo: kitCompleto.ativo,
        itens: itensFormatados
      };

      console.log("📝 Kit para editar:", kitParaEditar);
      console.log(`📊 Total de itens: ${kitParaEditar.itens.length}`);

      setEditingKit(kitParaEditar);
      setIsEditingDialogOpen(true);

    } catch (error) {
      console.error("❌ Erro ao preparar edição:", error);
      toast({
        title: "Erro ao preparar edição",
        description: "Não foi possível carregar os dados do kit para edição.",
        variant: "destructive",
      });
    }
  };

  const handleEditComplete = () => {
    setIsEditingDialogOpen(false);
    setEditingKit(null);
    loadAllData();
  };

  // ============================================
  // FILTROS
  // ============================================

  const getStatusBadge = (kit: Kit) => {
    if (!kit.ativo) return <Badge variant="destructive">Inativo</Badge>;
    if (kit.estoque_disponivel === 0) return <Badge variant="destructive">Sem Estoque</Badge>;
    if (kit.estoque_disponivel < 5) return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">Estoque Baixo</Badge>;
    return <Badge variant="default" className="bg-green-100 text-green-800">Disponível</Badge>;
  };

  const filteredKits = kits.filter(kit => {
    const matchesSearch = kit.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         kit.codigo.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesAtivo = filterAtivo === "all" || 
                        (filterAtivo === "true" && kit.ativo) || 
                        (filterAtivo === "false" && !kit.ativo);
    
    let matchesMargem = true;
    if (filterMargem !== "all") {
      const margem = kit.margem_lucro || 0;
      if (filterMargem === "otima" && margem < 40) matchesMargem = false;
      else if (filterMargem === "boa" && (margem < 20 || margem >= 40)) matchesMargem = false;
      else if (filterMargem === "regular" && (margem < 10 || margem >= 20)) matchesMargem = false;
      else if (filterMargem === "baixa" && (margem < 0 || margem >= 10)) matchesMargem = false;
      else if (filterMargem === "prejuizo" && margem >= 0) matchesMargem = false;
    }
    
    return matchesSearch && matchesAtivo && matchesMargem;
  });

  // ============================================
  // ESTATÍSTICAS
  // ============================================

  const totalKits = kits.length;
  const kitsComEstoque = kits.filter(k => k.estoque_disponivel > 0).length;
  const totalUnidadesEstoque = kits.reduce((acc, k) => acc + k.estoque_disponivel, 0);
  const valorTotalEstoque = kits.reduce((acc, kit) => 
    acc + (kit.preco_total * kit.estoque_disponivel), 0
  );
  const custoTotalEstoque = kits.reduce((acc, kit) => 
    acc + ((kit.custo_total || 0) * kit.estoque_disponivel), 0
  );

  // ============================================
  // RENDER
  // ============================================

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

      {/* Cards de estatísticas */}
      {kits.length > 0 && (
        <div className="grid gap-4 md:grid-cols-4">
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
              <CardTitle className="text-sm font-medium">Valor em Estoque (Venda)</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(valorTotalEstoque)}</div>
              <p className="text-xs text-muted-foreground">
                valor total dos kits em estoque
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Custo Total em Estoque</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">{formatCurrency(custoTotalEstoque)}</div>
              <p className="text-xs text-muted-foreground">
                custo total dos componentes em estoque
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filtros */}
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
          <Select value={filterMargem} onValueChange={setFilterMargem}>
            <SelectTrigger className="w-[180px]">
              <TrendingUp className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Margem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas margens</SelectItem>
              <SelectItem value="otima">Ótima (≥40%)</SelectItem>
              <SelectItem value="boa">Boa (20-40%)</SelectItem>
              <SelectItem value="regular">Regular (10-20%)</SelectItem>
              <SelectItem value="baixa">Baixa (0-10%)</SelectItem>
              <SelectItem value="prejuizo">Prejuízo (&lt;0%)</SelectItem>
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
              {filteredKits.map((kit) => {
                // Usar métricas calculadas
                const custo = kit.custo_total || 0;
                const lucro = kit.lucro_total || 0;
                const margem = kit.margem_lucro || 0;
                
                const margemBadge = getMargemBadge(margem);
                const margemColor = getMargemColor(margem);
                const margemIcon = getMargemIcon(margem);
                
                return (
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
                              <Badge variant={margemBadge.variant as any}>
                                {margemIcon}
                                <span className="ml-1">{margemBadge.label}</span>
                              </Badge>
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
                              <div>
                                <p className="text-xs text-muted-foreground">Código</p>
                                <p className="text-sm font-mono">{kit.codigo}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Preço de Venda</p>
                                <p className="text-sm font-semibold text-primary">
                                  {formatCurrency(kit.preco_total)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Custo Total</p>
                                <p className="text-sm font-semibold text-orange-600">
                                  {formatCurrency(custo)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Lucro por Kit</p>
                                <p className={`text-sm font-semibold ${lucro >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {formatCurrency(lucro)}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground">Margem</p>
                                <p className={`text-sm font-semibold ${margemColor}`}>
                                  {margem.toFixed(1)}%
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

                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditKit(kit);
                              }}
                              className="gap-2"
                            >
                              <Pencil className="h-4 w-4" />
                              Editar
                            </Button>

                            <Button
                              variant="default"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                openMontarDialog(kit);
                              }}
                              className="gap-2"
                            >
                              <Plus className="h-4 w-4" />
                              Montar Kit
                            </Button>

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
                                    <TableHead>Tipo</TableHead>
                                    <TableHead>Código</TableHead>
                                    <TableHead>Nome</TableHead>
                                    <TableHead className="text-right">Qtd</TableHead>
                                    <TableHead className="text-right">Custo Unit.</TableHead>
                                    <TableHead className="text-right">Custo Total</TableHead>
                                    <TableHead className="text-right">Preço Venda Unit.</TableHead>
                                    <TableHead className="text-right">Estoque</TableHead>
                                    <TableHead className="text-right">Kits Possíveis</TableHead>
                                    <TableHead className="text-center">Status</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {kit.itens.map((item) => {
                                    const isSubKit = !!item.sub_kit_id;
                                    const codigo = isSubKit ? item.sub_kit?.codigo : item.produto?.codigo;
                                    const nome = isSubKit ? item.sub_kit?.nome : item.produto?.nome;
                                    
                                    // Calcular custo unitário real
                                    let custoUnitario = 0;
                                    if (isSubKit && item.sub_kit_id) {
                                      // Buscar o custo real do sub-kit dos dados já calculados
                                      const subKit = kits.find(k => k.id === item.sub_kit_id);
                                      if (subKit && subKit.custo_total !== undefined) {
                                        custoUnitario = subKit.custo_total;
                                      } else {
                                        custoUnitario = item.sub_kit?.preco_total || 0;
                                      }
                                    } else if (item.produto) {
                                      custoUnitario = item.produto.custo || item.produto.preco || 0;
                                    }
                                    
                                    // Preço de venda unitário
                                    const precoVendaUnitario = isSubKit 
                                      ? (item.sub_kit?.preco_total || 0)
                                      : (item.produto?.preco || 0);
                                    
                                    const custoTotalItem = custoUnitario * item.quantidade;

                                    let estoqueItem = 0;
                                    let kitsPossiveis = 0;
                                    let statusOk = false;

                                    if (isSubKit && item.sub_kit_id) {
                                      const subKitData = kits.find(k => k.id === item.sub_kit_id);
                                      estoqueItem = subKitData?.estoque_disponivel ?? 0;
                                      kitsPossiveis = Math.floor(estoqueItem / item.quantidade);
                                      statusOk = estoqueItem >= item.quantidade;
                                    } else if (item.produto) {
                                      estoqueItem = item.produto.estoque;
                                      kitsPossiveis = Math.floor(estoqueItem / item.quantidade);
                                      statusOk = estoqueItem >= item.quantidade;
                                    }

                                    return (
                                      <TableRow key={item.id}>
                                        <TableCell>
                                          <Badge variant={isSubKit ? "secondary" : "outline"} className="flex items-center gap-1 w-fit">
                                            {isSubKit ? <Layers className="h-3 w-3" /> : <Package className="h-3 w-3" />}
                                            {isSubKit ? 'Kit' : 'Produto'}
                                          </Badge>
                                        </TableCell>
                                        <TableCell className="font-mono text-sm">
                                          {codigo || 'N/A'}
                                        </TableCell>
                                        <TableCell className="font-medium">
                                          {nome || (isSubKit ? 'Kit não encontrado' : 'Produto não encontrado')}
                                        </TableCell>
                                        <TableCell className="text-right">
                                          {item.quantidade}
                                        </TableCell>
                                        <TableCell className="text-right text-orange-600 font-medium">
                                          {formatCurrency(custoUnitario)}
                                        </TableCell>
                                        <TableCell className="text-right font-medium text-orange-700">
                                          {formatCurrency(custoTotalItem)}
                                        </TableCell>
                                        <TableCell className="text-right text-muted-foreground">
                                          {formatCurrency(precoVendaUnitario)}
                                        </TableCell>
                                        <TableCell className="text-right">
                                          <Badge variant={estoqueItem === 0 ? "destructive" : "default"}>
                                            {estoqueItem}
                                          </Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                          {kitsPossiveis}
                                        </TableCell>
                                        <TableCell className="text-center">
                                          <Badge variant={statusOk ? "default" : "destructive"} className="text-xs">
                                            {statusOk ? 'OK' : 'Insuficiente'}
                                          </Badge>
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })}
                                </TableBody>
                              </Table>
                              
                              {/* Resumo de custos com valores calculados corretamente */}
                              <div className="mt-4 p-4 bg-gray-100 rounded-lg">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                  <div>
                                    <p className="text-xs text-muted-foreground">Custo dos Componentes</p>
                                    <p className="text-lg font-semibold text-orange-600">
                                      {formatCurrency(custo)}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">Preço de Venda</p>
                                    <p className="text-lg font-semibold text-primary">
                                      {formatCurrency(kit.preco_total)}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">Lucro por Kit</p>
                                    <p className={`text-lg font-semibold ${lucro >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {formatCurrency(lucro)}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground">Margem de Lucro</p>
                                    <p className={`text-lg font-semibold ${margemColor}`}>
                                      {margem.toFixed(1)}%
                                    </p>
                                  </div>
                                </div>
                                
                                {/* Barra de margem */}
                                <div className="mt-3">
                                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                                    <div 
                                      className={`h-2.5 rounded-full ${
                                        margem >= 40 ? 'bg-green-600' :
                                        margem >= 20 ? 'bg-blue-600' :
                                        margem >= 10 ? 'bg-yellow-400' :
                                        margem >= 0 ? 'bg-orange-400' :
                                        'bg-red-600'
                                      }`}
                                      style={{ width: `${Math.min(Math.max(margem, 0), 100)}%` }}
                                    ></div>
                                  </div>
                                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                    <span>0%</span>
                                    <span>20%</span>
                                    <span>40%</span>
                                    <span>60%</span>
                                    <span>80%</span>
                                    <span>100%</span>
                                  </div>
                                </div>
                              </div>
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
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Montar Kit */}
      <Dialog open={isMontarDialogOpen} onOpenChange={setIsMontarDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-5 w-5" />
              Montar Kit
            </DialogTitle>
            <DialogDescription>
              Adicione componentes ao estoque necessários para montar o kit "{kitParaMontar?.nome}".
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="quantidade">Quantidade de Kits a Montar</Label>
              <Input
                id="quantidade"
                type="number"
                min="1"
                value={quantidadeMontar}
                onChange={(e) => setQuantidadeMontar(parseInt(e.target.value) || 1)}
              />
              <p className="text-xs text-muted-foreground">
                Quantos kits você deseja montar?
              </p>
            </div>

            {kitParaMontar && (
              <div className="border rounded-lg p-4 bg-gray-50">
                <h4 className="text-sm font-semibold mb-3">Componentes que serão adicionados ao estoque:</h4>
                <div className="space-y-2">
                  {kitParaMontar.itens
                    .filter(item => item.produto_id && item.produto)
                    .map(item => (
                      <div key={item.id} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{item.produto?.nome}</span>
                        <span className="font-medium">
                          +{item.quantidade * quantidadeMontar} unidades
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                <strong>Nota:</strong> Esta operação irá ADICIONAR os componentes listados ao estoque,
                permitindo que você tenha material disponível para montar os kits posteriormente.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsMontarDialogOpen(false)}
              disabled={montandoKit}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleMontarKit}
              disabled={montandoKit || !kitParaMontar || quantidadeMontar < 1}
            >
              {montandoKit ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Montando...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Componentes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Edição */}
      {isEditingDialogOpen && editingKit && (
        <CriarKitDialog
          key={editingKit.id}
          onKitAdded={handleEditComplete}
          isEditing={true}
          kitParaEditar={editingKit}
          open={isEditingDialogOpen}
          onOpenChange={setIsEditingDialogOpen}
        />
      )}
    </div>
  );
}