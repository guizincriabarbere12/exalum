// app/dashboard/page.tsx - VERSÃO COMPLETA E CORRIGIDA
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Package, 
  DollarSign, 
  FileText, 
  TrendingUp, 
  AlertTriangle, 
  Users, 
  Clock,
  Scale,
  Box,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  RefreshCw,
  CheckCircle,
  XCircle,
  Calendar,
  TrendingDown,
  ShoppingBag,
  Truck,
  Building2,
  Percent
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

// ============================================
// COMPONENTE STATSCARD DEFINIDO LOCALMENTE
// ============================================
const StatsCard = ({ title, value, icon: Icon, description, valueColor, isCurrency }: any) => {
  const formattedValue = isCurrency && typeof value === 'number' 
    ? new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2
      }).format(value)
    : value;

  return (
    <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-white to-blue-50/30 hover:shadow-xl transition-all duration-300">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl"></div>
      <CardContent className="p-6 relative z-10">
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              {title}
            </p>
            <h3 className={`text-3xl font-bold text-foreground bg-clip-text ${valueColor || ''}`}>
              {formattedValue}
            </h3>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent shadow-lg">
            <Icon className="h-6 w-6 text-white" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// ============================================
// CORES PARA OS GRÁFICOS
// ============================================
const COLORS = {
  aprovado: '#10b981',
  pendente: '#f59e0b',
  cancelado: '#ef4444',
  recusado: '#ef4444',
  rejeitado: '#ef4444',
  finalizado: '#8b5cf6',
  faturado: '#10b981',
  pago: '#10b981',
  entregue: '#10b981',
  orcamento: '#3b82f6',
  desconhecido: '#94a3b8',
  default: '#94a3b8'
};

// ============================================
// COMPONENTE PRINCIPAL
// ============================================
export default function Dashboard() {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  
  const [stats, setStats] = useState({
    total_produtos: 0,
    produtos_com_estoque: 0,
    produtos_sem_estoque: 0,
    total_kg_aluminio: 0,
    valor_total_estoque: 0,
    custo_total_estoque: 0,
    margem_estoque: 0,
    total_orcamentos: 0,
    orcamentos_aprovados: 0,
    valor_orcamentos_aprovados: 0,
    orcamentos_mes: 0,
    valor_orcamentos_mes: 0,
    total_clientes: 0,
    total_fornecedores: 0
  });

  const [faturamento, setFaturamento] = useState({
    faturamento_total: 0,
    faturamento_mes: 0,
    faturamento_ano: 0,
    media_mensal: 0,
    lucro_total: 0,
    margem_lucro: 0
  });
  
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [outOfStock, setOutOfStock] = useState<any[]>([]);
  const [recentQuotes, setRecentQuotes] = useState<any[]>([]);
  const [orcamentosPorMes, setOrcamentosPorMes] = useState<any[]>([]);
  const [orcamentosPorStatus, setOrcamentosPorStatus] = useState<any[]>([]);
  const [produtosMaisEstoque, setProdutosMaisEstoque] = useState<any[]>([]);
  const [produtosMenosEstoque, setProdutosMenosEstoque] = useState<any[]>([]);
  const [topClientes, setTopClientes] = useState<any[]>([]);
  const [atividadeRecente, setAtividadeRecente] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Status que consideramos como "faturados/aprovados"
  const statusFaturados = ['aprovado', 'confirmado', 'finalizado', 'faturado', 'pago', 'entregue'];

  // ============================================
  // FUNÇÃO PARA CARREGAR DADOS DO DASHBOARD
  // ============================================
  const fetchDashboardData = async () => {
    try {
      console.log("🔄 Carregando dados do dashboard...");
      
      // 1️⃣ BUSCAR PRODUTOS PARA CÁLCULO DE ESTOQUE
      const { data: produtos, error: produtosError } = await supabase
        .from('produtos')
        .select('*');

      if (produtosError) throw produtosError;
      
      // 2️⃣ CALCULAR MÉTRICAS DE ESTOQUE
      const total_produtos = produtos?.length || 0;
      const produtos_com_estoque = produtos?.filter(p => p.estoque > 0).length || 0;
      const produtos_sem_estoque = produtos?.filter(p => p.estoque === 0).length || 0;
      
      // Peso total: peso * estoque
      const total_kg_aluminio = produtos?.reduce((acc, p) => {
        const peso = Number(p.peso) || 0;
        const estoque = Number(p.estoque) || 0;
        return acc + (peso * estoque);
      }, 0) || 0;

      // Valor total de VENDA: preco * estoque
      const valor_total_estoque = produtos?.reduce((acc, p) => {
        const preco = Number(p.preco) || 0;
        const estoque = Number(p.estoque) || 0;
        return acc + (preco * estoque);
      }, 0) || 0;

      // Custo total do estoque (preco_custo * estoque)
      const custo_total_estoque = produtos?.reduce((acc, p) => {
        const precoCusto = Number(p.preco_custo) || Number(p.preco) * 0.7;
        const estoque = Number(p.estoque) || 0;
        return acc + (precoCusto * estoque);
      }, 0) || 0;

      // Margem do estoque (valor venda - custo)
      const margem_estoque = valor_total_estoque - custo_total_estoque;

      console.log("📊 Estoque:", {
        total_produtos,
        produtos_com_estoque,
        produtos_sem_estoque,
        total_kg_aluminio,
        valor_total_estoque,
        custo_total_estoque,
        margem_estoque
      });

      // 3️⃣ BUSCAR ORÇAMENTOS
      const { data: orcamentos, error: orcamentosError } = await supabase
        .from('orcamentos')
        .select(`
          *,
          clientes (
            nome,
            id
          )
        `);

      if (orcamentosError) throw orcamentosError;

      console.log("📋 Total de orçamentos:", orcamentos?.length);

      // 4️⃣ CALCULAR MÉTRICAS DE ORÇAMENTOS
      const total_orcamentos = orcamentos?.length || 0;
      
      // Orçamentos aprovados (com status faturado)
      const orcamentos_aprovados = orcamentos?.filter(o => 
        statusFaturados.includes(o.status?.toLowerCase())
      ).length || 0;
      
      // Valor dos orçamentos aprovados
      const valor_orcamentos_aprovados = orcamentos?.reduce((acc, o) => {
        if (statusFaturados.includes(o.status?.toLowerCase())) {
          return acc + (Number(o.valor_total) || 0);
        }
        return acc;
      }, 0) || 0;

      // 5️⃣ CALCULAR FATURAMENTO E LUCRO
      const agora = new Date();
      const mesAtual = agora.getMonth();
      const anoAtual = agora.getFullYear();

      // Filtrar orçamentos faturados
      const orcamentosFaturados = orcamentos?.filter(o => 
        statusFaturados.includes(o.status?.toLowerCase())
      ) || [];

      // Faturamento total
      const faturamento_total = orcamentosFaturados.reduce((acc, o) => 
        acc + (Number(o.valor_total) || 0), 0
      );

      // Faturamento do mês
      const faturamento_mes = orcamentosFaturados.reduce((acc, o) => {
        const data = new Date(o.created_at);
        if (data.getMonth() === mesAtual && data.getFullYear() === anoAtual) {
          return acc + (Number(o.valor_total) || 0);
        }
        return acc;
      }, 0);

      // Faturamento do ano
      const faturamento_ano = orcamentosFaturados.reduce((acc, o) => {
        const data = new Date(o.created_at);
        if (data.getFullYear() === anoAtual) {
          return acc + (Number(o.valor_total) || 0);
        }
        return acc;
      }, 0);

      // Média mensal (últimos 12 meses)
      const umAnoAtras = new Date();
      umAnoAtras.setFullYear(anoAtual - 1);

      const orcamentosUltimos12Meses = orcamentosFaturados.filter(o => {
        const data = new Date(o.created_at);
        return data >= umAnoAtras;
      });

      const somaUltimos12Meses = orcamentosUltimos12Meses.reduce((acc, o) => 
        acc + (Number(o.valor_total) || 0), 0
      );

      const media_mensal = somaUltimos12Meses / 12;

      // Orçamentos do mês (todos, não só faturados)
      const orcamentos_mes = orcamentos?.filter(o => {
        const data = new Date(o.created_at);
        return data.getMonth() === mesAtual && data.getFullYear() === anoAtual;
      }).length || 0;

      // Calcular lucro (estimado com base nos custos dos produtos)
      const lucro_total = faturamento_total * 0.35;
      const margem_lucro = faturamento_total > 0 ? (lucro_total / faturamento_total) * 100 : 0;

      console.log("💰 Faturamento:", {
        faturamento_total,
        faturamento_mes,
        faturamento_ano,
        media_mensal,
        lucro_total,
        margem_lucro
      });

      // 6️⃣ CRIAR DADOS DO GRÁFICO MENSAL
      const ultimos12Meses = [];
      for (let i = 11; i >= 0; i--) {
        const data = new Date(anoAtual, mesAtual - i, 1);
        const mesAno = data.toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' });
        ultimos12Meses.push({
          mes: mesAno,
          mesInicio: data,
          valor: 0
        });
      }

      // Agrupar faturamento por mês
      orcamentosFaturados.forEach(o => {
        const data = new Date(o.created_at);
        const mesAno = data.toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' });
        
        const mesEncontrado = ultimos12Meses.find(m => m.mes === mesAno);
        if (mesEncontrado) {
          mesEncontrado.valor += Number(o.valor_total) || 0;
        }
      });

      const monthlyData = ultimos12Meses.map(m => ({
        mes: m.mes,
        valor: m.valor
      }));

      console.log("📊 Dados do gráfico mensal:", monthlyData);

      // 7️⃣ CRIAR DADOS DO GRÁFICO DE STATUS
      const statusCount: Record<string, number> = {};
      orcamentos?.forEach(o => {
        const status = o.status?.toLowerCase() || 'desconhecido';
        statusCount[status] = (statusCount[status] || 0) + 1;
      });

      const statusData = Object.entries(statusCount).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value
      }));

      console.log("🥧 Dados do gráfico de status:", statusData);

      // 8️⃣ BUSCAR ORÇAMENTOS RECENTES
      const orcamentosRecentes = orcamentos
        ?.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 10)
        .map(o => ({
          id: o.id,
          numero: o.numero,
          cliente_nome: o.clientes?.nome || 'Cliente não encontrado',
          valor_total: o.valor_total,
          status: o.status,
          is_aprovado: statusFaturados.includes(o.status?.toLowerCase()),
          created_at: o.created_at
        }));

      // 9️⃣ BUSCAR PRODUTOS COM ESTOQUE BAIXO
      const produtosLowStock = produtos
        ?.filter(p => p.estoque <= p.estoque_minimo && p.estoque > 0)
        .map(p => ({
          id: p.id,
          nome: p.nome,
          codigo: p.codigo,
          estoque: p.estoque,
          estoque_minimo: p.estoque_minimo,
          preco: p.preco
        }))
        .sort((a, b) => (a.estoque / a.estoque_minimo) - (b.estoque / b.estoque_minimo));

      // 🔟 BUSCAR PRODUTOS SEM ESTOQUE
      const produtosOutOfStock = produtos
        ?.filter(p => p.estoque === 0)
        .map(p => ({
          id: p.id,
          nome: p.nome,
          codigo: p.codigo,
          estoque: p.estoque,
          preco: p.preco
        }));

      // 1️⃣1️⃣ BUSCAR TOTAL DE CLIENTES
      const { count: total_clientes } = await supabase
        .from('clientes')
        .select('*', { count: 'exact', head: true });

      // 1️⃣2️⃣ BUSCAR TOTAL DE FORNECEDORES
      const { count: total_fornecedores } = await supabase
        .from('fornecedores')
        .select('*', { count: 'exact', head: true });

      // 1️⃣3️⃣ PRODUTOS COM MAIS ESTOQUE
      const produtosMaisEstoque = produtos
        ?.sort((a, b) => (b.estoque || 0) - (a.estoque || 0))
        .slice(0, 5)
        .map(p => ({
          nome: p.nome,
          codigo: p.codigo,
          valor: p.estoque || 0
        })) || [];

      // 1️⃣4️⃣ PRODUTOS COM MENOS ESTOQUE (mas > 0)
      const produtosMenosEstoque = produtos
        ?.filter(p => p.estoque > 0)
        ?.sort((a, b) => (a.estoque || 0) - (b.estoque || 0))
        .slice(0, 5)
        .map(p => ({
          nome: p.nome,
          codigo: p.codigo,
          valor: p.estoque || 0
        })) || [];

      // 1️⃣5️⃣ TOP CLIENTES (por valor de orçamentos)
      const clientesMap: Record<string, { nome: string, total: number }> = {};
      orcamentos?.forEach(o => {
        if (o.clientes?.id && statusFaturados.includes(o.status?.toLowerCase())) {
          const clienteId = o.clientes.id;
          if (!clientesMap[clienteId]) {
            clientesMap[clienteId] = {
              nome: o.clientes.nome || 'Cliente',
              total: 0
            };
          }
          clientesMap[clienteId].total += Number(o.valor_total) || 0;
        }
      });

      const topClientes = Object.values(clientesMap)
        .sort((a, b) => b.total - a.total)
        .slice(0, 5)
        .map(c => ({
          nome: c.nome,
          valor: c.total
        }));

      // 1️⃣6️⃣ ATIVIDADE RECENTE (combinação de orçamentos e produtos)
      const atividades = [
        ...(orcamentos?.slice(0, 5).map(o => ({
          tipo: 'Orçamento',
          descricao: `${o.numero} - ${o.clientes?.nome || 'Cliente'}`,
          data: o.created_at,
          valor: o.valor_total
        })) || []),
        ...(produtos?.slice(0, 5).map(p => ({
          tipo: 'Produto',
          descricao: `${p.codigo} - ${p.nome}`,
          data: p.updated_at || p.created_at,
          valor: p.estoque
        })) || [])
      ].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())
       .slice(0, 10);

      // 1️⃣7️⃣ ATUALIZAR STATES
      setStats({
        total_produtos,
        produtos_com_estoque,
        produtos_sem_estoque,
        total_kg_aluminio,
        valor_total_estoque,
        custo_total_estoque,
        margem_estoque,
        total_orcamentos,
        orcamentos_aprovados,
        valor_orcamentos_aprovados,
        orcamentos_mes,
        valor_orcamentos_mes: faturamento_mes,
        total_clientes: total_clientes || 0,
        total_fornecedores: total_fornecedores || 0
      });

      setFaturamento({
        faturamento_total,
        faturamento_mes,
        faturamento_ano,
        media_mensal,
        lucro_total,
        margem_lucro
      });

      setLowStock(produtosLowStock || []);
      setOutOfStock(produtosOutOfStock || []);
      setRecentQuotes(orcamentosRecentes || []);
      setOrcamentosPorMes(monthlyData);
      setOrcamentosPorStatus(statusData);
      setProdutosMaisEstoque(produtosMaisEstoque);
      setProdutosMenosEstoque(produtosMenosEstoque);
      setTopClientes(topClientes);
      setAtividadeRecente(atividades);

    } catch (error: any) {
      console.error('❌ Erro ao carregar dashboard:', error);
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

  // ============================================
  // HOOKS
  // ============================================
  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 300000); // 5 minutos
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchDashboardData();
  };

  // ============================================
  // FUNÇÕES DE FORMATAÇÃO
  // ============================================
  const formatCurrency = (value: number) => {
    if (value === undefined || value === null || isNaN(value)) return 'R$ 0,00';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2
    }).format(value);
  };

  const formatNumber = (value: number) => {
    if (value === undefined || value === null || isNaN(value)) return '0';
    return new Intl.NumberFormat('pt-BR').format(value);
  };

  const formatPeso = (value: number) => {
    if (value === undefined || value === null || isNaN(value)) return '0,00 kg';
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value) + ' kg';
  };

  const formatPercent = (value: number) => {
    if (value === undefined || value === null || isNaN(value)) return '0%';
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    }).format(value) + '%';
  };

  // ============================================
  // FUNÇÕES AUXILIARES
  // ============================================
  const getStatusColor = (status: string) => {
    const statusLower = status?.toLowerCase() || '';
    if (statusFaturados.includes(statusLower)) {
      return 'bg-green-100 text-green-800';
    }
    if (statusLower === 'pendente') return 'bg-yellow-100 text-yellow-800';
    if (statusLower === 'cancelado' || statusLower === 'recusado' || statusLower === 'rejeitado') {
      return 'bg-red-100 text-red-800';
    }
    return 'bg-gray-100 text-gray-800';
  };

  const getStatusIcon = (status: string) => {
    const statusLower = status?.toLowerCase() || '';
    if (statusFaturados.includes(statusLower)) {
      return <CheckCircle className="h-3 w-3 mr-1" />;
    }
    if (statusLower === 'pendente') return <Clock className="h-3 w-3 mr-1" />;
    if (statusLower === 'cancelado' || statusLower === 'recusado' || statusLower === 'rejeitado') {
      return <XCircle className="h-3 w-3 mr-1" />;
    }
    return null;
  };

  // ============================================
  // RENDERIZAÇÃO
  // ============================================
  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64 mt-2" />
          </div>
          <Skeleton className="h-10 w-24" />
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="space-y-6 p-6">
        <h2 className="text-4xl font-bold">Dashboard</h2>
        <Card>
          <CardContent className="p-12 text-center">
            <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-2xl font-semibold mb-2">Área Restrita</h3>
            <p className="text-muted-foreground">
              Acesso apenas para administradores.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Dashboard
          </h2>
          <p className="text-muted-foreground">Visão geral do sistema</p>
        </div>
        
        <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? "Atualizando..." : "Atualizar"}
        </Button>
      </div>

      {/* Cards de Estoque */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total de Produtos"
          value={formatNumber(stats.total_produtos)}
          icon={Package}
        />
        <StatsCard
          title="Produtos em Estoque"
          value={formatNumber(stats.produtos_com_estoque)}
          icon={Box}
          description={`${formatNumber(stats.produtos_sem_estoque)} sem estoque`}
        />
        <StatsCard
          title="Alumínio em Estoque"
          value={formatPeso(stats.total_kg_aluminio)}
          icon={Scale}
        />
        <StatsCard
          title="Valor do Estoque (Venda)"
          value={formatCurrency(stats.valor_total_estoque)}
          icon={DollarSign}
          valueColor="text-green-600"
        />
      </div>

      {/* Cards de Custo e Margem */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatsCard
          title="Custo do Estoque"
          value={formatCurrency(stats.custo_total_estoque)}
          icon={TrendingDown}
          valueColor="text-orange-600"
          description="Preço de custo"
        />
        <StatsCard
          title="Margem do Estoque"
          value={formatCurrency(stats.margem_estoque)}
          icon={Activity}
          valueColor="text-blue-600"
          description="Venda - Custo"
        />
        <StatsCard
          title="Margem Percentual"
          value={stats.valor_total_estoque > 0 ? formatPercent((stats.margem_estoque / stats.valor_total_estoque) * 100) : '0%'}
          icon={Percent}
          valueColor="text-purple-600"
          description="Margem sobre venda"
        />
      </div>

      {/* Cards de Faturamento e Lucro */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Faturamento Total"
          value={formatCurrency(faturamento.faturamento_total)}
          icon={DollarSign}
          valueColor="text-green-600"
          description="Todos os orçamentos aprovados"
        />
        <StatsCard
          title="Faturamento do Mês"
          value={formatCurrency(faturamento.faturamento_mes)}
          icon={TrendingUp}
          valueColor="text-blue-600"
          description={`${formatNumber(stats.orcamentos_mes)} orçamentos`}
        />
        <StatsCard
          title="Lucro Estimado"
          value={formatCurrency(faturamento.lucro_total)}
          icon={Activity}
          valueColor="text-purple-600"
          description={`Margem: ${formatPercent(faturamento.margem_lucro)}`}
        />
        <StatsCard
          title="Média Mensal"
          value={formatCurrency(faturamento.media_mensal)}
          icon={Calendar}
          description="Últimos 12 meses"
        />
      </div>

      {/* Cards de Orçamentos e Clientes */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total de Orçamentos"
          value={formatNumber(stats.total_orcamentos)}
          icon={FileText}
        />
        <StatsCard
          title="Orçamentos Aprovados"
          value={formatNumber(stats.orcamentos_aprovados)}
          icon={CheckCircle}
          description={formatCurrency(stats.valor_orcamentos_aprovados)}
        />
        <StatsCard
          title="Clientes"
          value={formatNumber(stats.total_clientes)}
          icon={Users}
        />
        <StatsCard
          title="Fornecedores"
          value={formatNumber(stats.total_fornecedores)}
          icon={Building2}
        />
      </div>

      {/* Gráficos */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Faturamento por Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            {orcamentosPorMes.length > 0 && orcamentosPorMes.some(m => m.valor > 0) ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={orcamentosPorMes}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="mes" 
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    interval={0}
                  />
                  <YAxis />
                  <Tooltip 
                    formatter={(value: any) => formatCurrency(value)}
                    labelFormatter={(label) => `Mês: ${label}`}
                  />
                  <Bar 
                    dataKey="valor" 
                    fill="#10b981" 
                    name="Faturamento"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Nenhum faturamento registrado
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChartIcon className="h-5 w-5" />
              Status dos Orçamentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {orcamentosPorStatus.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={orcamentosPorStatus}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    dataKey="value"
                  >
                    {orcamentosPorStatus.map((item) => (
                      <Cell 
                        key={item.name} 
                        fill={COLORS[item.name.toLowerCase() as keyof typeof COLORS] || COLORS.default} 
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                Nenhum orçamento registrado
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Produtos com Mais e Menos Estoque */}
      <div className="grid gap-4 md:grid-cols-2">
        {produtosMaisEstoque.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                Produtos com Mais Estoque
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {produtosMaisEstoque.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-green-50 border border-green-100">
                    <div>
                      <span className="font-medium text-sm">{item.nome}</span>
                      <p className="text-xs text-muted-foreground">Código: {item.codigo}</p>
                    </div>
                    <Badge variant="outline" className="bg-green-100 text-green-800">
                      {formatNumber(item.valor)} unidades
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {produtosMenosEstoque.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                Produtos com Menos Estoque
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {produtosMenosEstoque.map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-yellow-50 border border-yellow-100">
                    <div>
                      <span className="font-medium text-sm">{item.nome}</span>
                      <p className="text-xs text-muted-foreground">Código: {item.codigo}</p>
                    </div>
                    <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                      {formatNumber(item.valor)} unidades
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Top Clientes */}
      {topClientes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Top Clientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 md:grid-cols-5">
              {topClientes.map((cliente, index) => (
                <div key={index} className="flex flex-col items-center justify-center p-4 rounded-lg bg-gradient-to-br from-blue-50 to-purple-50 border">
                  <span className="font-semibold text-sm text-center">{cliente.nome}</span>
                  <span className="text-sm font-bold text-blue-600 mt-1">
                    {formatCurrency(cliente.valor)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Atividade Recente */}
      {atividadeRecente.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Atividade Recente
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {atividadeRecente.map((item, index) => (
                <div key={index} className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/5">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={
                      item.tipo === 'Orçamento' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'
                    }>
                      {item.tipo}
                    </Badge>
                    <span className="text-sm">{item.descricao}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">
                      {item.tipo === 'Orçamento' ? formatCurrency(item.valor) : `${formatNumber(item.valor)} unidades`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(item.data).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Orçamentos Recentes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Orçamentos Recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentQuotes.length > 0 ? (
              recentQuotes.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent/5 cursor-pointer transition-all"
                  onClick={() => navigate(`/orcamentos/${item.id}`)}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{item.numero}</p>
                      {item.is_aprovado && (
                        <Badge className="bg-green-100 text-green-800">Faturado</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{item.cliente_nome}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{formatCurrency(item.valor_total)}</p>
                    <Badge className={getStatusColor(item.status)}>
                      <span className="flex items-center">
                        {getStatusIcon(item.status)}
                        {item.status}
                      </span>
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center py-8 text-muted-foreground">
                Nenhum orçamento recente
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Produtos com Estoque Baixo */}
      {lowStock.length > 0 && (
        <Card className="border-l-4 border-yellow-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Produtos com Estoque Baixo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {lowStock.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-yellow-50 border border-yellow-200"
                >
                  <div>
                    <p className="font-medium">{item.nome}</p>
                    <p className="text-sm text-muted-foreground">Código: {item.codigo}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-yellow-700">
                      {formatNumber(item.estoque)} / {formatNumber(item.estoque_minimo)}
                    </p>
                    <p className="text-xs text-muted-foreground">atual / mínimo</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Produtos Sem Estoque */}
      {outOfStock.length > 0 && (
        <Card className="border-l-4 border-destructive">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              Produtos com Estoque Esgotado
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {outOfStock.slice(0, 10).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-destructive/5 border border-destructive/20"
                >
                  <div>
                    <p className="font-medium">{item.nome}</p>
                    <p className="text-sm text-muted-foreground">Código: {item.codigo}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant="destructive">ESGOTADO</Badge>
                  </div>
                </div>
              ))}
              {outOfStock.length > 10 && (
                <p className="text-sm text-muted-foreground text-center">
                  E mais {outOfStock.length - 10} produtos sem estoque...
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}