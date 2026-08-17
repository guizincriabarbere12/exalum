// app/financeiro/page.tsx - VERSÃO COMPLETA CORRIGIDA
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, TrendingUp, TrendingDown, RotateCcw, TriangleAlert as AlertTriangle, Calendar, Clock, FileText, Pencil, Filter, X, CreditCard, History, Info, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import AddTransactionDialog from "@/components/financeiro/AddTransactionDialog";

interface Transaction {
  id: string;
  descricao: string;
  tipo: string;
  valor: number;
  data: string;
  status: string;
  data_vencimento?: string;
  data_pagamento?: string;
  forma_pagamento?: string;
  conta_bancaria?: string;
  categoria?: string;
  origem_tipo?: string;
  orcamento_id?: string;
  parcela_numero?: number;
  total_parcelas?: number;
  numero_parcela?: string;
  observacoes?: string;
  credito_id?: string;
  tipo_pagamento?: string;
  forma_pagamento_original?: string;
  valor_credito_utilizado?: number;
  observacoes_adicionais?: string;
}

interface TransacaoVencimento {
  id: string;
  descricao: string;
  tipo: string;
  valor: number;
  data_vencimento: string;
  dias_restantes?: number;
  dias_atraso?: number;
  origem_tipo?: string;
  orcamento_id?: string;
  parcela_numero?: number;
  total_parcelas?: number;
  credito_id?: string;
}

interface OrcamentoInfo {
  id: string;
  numero: string;
  cliente_nome: string;
  valor_total: number;
  pagamento_misto?: boolean;
  valor_credito_utilizado?: number;
  forma_pagamento_restante?: string;
  tipo_pagamento?: string;
}

interface CreditoInfo {
  id: string;
  cliente_nome: string;
  valor_original: number;
  valor_utilizado: number;
  saldo: number;
  data_criacao: string;
}

interface CreditoUtilizado {
  id: string;
  cliente_id: string;
  cliente_nome: string;
  orcamento_id: string;
  orcamento_numero: string;
  valor_utilizado: number;
  data_utilizacao: string;
  tipo_operacao: string;
  saldo_anterior: number;
  saldo_posterior: number;
  observacao: string;
}

interface Filtros {
  tipo: 'todos' | 'receita' | 'despesa' | 'credito';
  status: 'todos' | 'pendente' | 'pago' | 'recebido' | 'atrasado' | 'utilizado' | 'disponivel';
  origem: 'todos' | 'orcamento' | 'credito' | 'manual';
  periodo: {
    inicio: string;
    fim: string;
  };
}

// ========== FUNÇÃO AUXILIAR PARA NORMALIZAR DATAS ==========
const normalizarData = (dataStr: string): Date => {
  if (!dataStr) return new Date();
  const [ano, mes, dia] = dataStr.split('T')[0].split('-').map(Number);
  return new Date(ano, mes - 1, dia, 12, 0, 0);
};

const formatarDataParaExibicao = (dataStr: string): string => {
  if (!dataStr) return '';
  const data = normalizarData(dataStr);
  return data.toLocaleDateString('pt-BR');
};

const compararDatas = (data1Str: string, data2Str: string): number => {
  const data1 = normalizarData(data1Str);
  const data2 = normalizarData(data2Str);
  return data1.getTime() - data2.getTime();
};

// Função para verificar se é transação manual
const isTransacaoManual = (transacao: Transaction): boolean => {
  return !transacao.orcamento_id && !transacao.credito_id && !transacao.origem_tipo?.includes('credito');
};

// Função para formatar data
const formatDate = (dateStr: string) => {
  if (!dateStr) return '';
  const [ano, mes, dia] = dateStr.split('T')[0].split('-');
  return `${dia}/${mes}/${ano}`;
};

export default function Financeiro() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [transacoesVencidas, setTransacoesVencidas] = useState<TransacaoVencimento[]>([]);
  const [transacoesAVencer, setTransacoesAVencer] = useState<TransacaoVencimento[]>([]);
  const [saldoTotal, setSaldoTotal] = useState(0);
  const [receitas, setReceitas] = useState(0);
  const [despesas, setDespesas] = useState(0);
  const [creditos, setCreditos] = useState(0);
  const [creditosUtilizados, setCreditosUtilizados] = useState<CreditoUtilizado[]>([]);
  const [loading, setLoading] = useState(true);
  const [orcamentosInfo, setOrcamentosInfo] = useState<Record<string, OrcamentoInfo>>({});
  const [creditosInfo, setCreditosInfo] = useState<Record<string, CreditoInfo>>({});
  const [transacaoEditando, setTransacaoEditando] = useState<Transaction | null>(null);
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [mostrarHistoricoCreditos, setMostrarHistoricoCreditos] = useState(false);
  const [creditoSelecionado, setCreditoSelecionado] = useState<CreditoUtilizado | null>(null);
  const { isAdmin } = useAuth();

  // Estados para os filtros
  const [filtros, setFiltros] = useState<Filtros>({
    tipo: 'todos',
    status: 'todos',
    origem: 'todos',
    periodo: {
      inicio: '',
      fim: ''
    }
  });

  // Estados para os somatórios filtrados
  const [totalReceitasFiltradas, setTotalReceitasFiltradas] = useState(0);
  const [totalDespesasFiltradas, setTotalDespesasFiltradas] = useState(0);
  const [totalCreditosFiltrados, setTotalCreditosFiltrados] = useState(0);
  const [saldoFiltrado, setSaldoFiltrado] = useState(0);
  const [totalAReceber, setTotalAReceber] = useState(0);
  const [totalAPagar, setTotalAPagar] = useState(0);

  useEffect(() => {
    fetchTransactions();
    fetchCreditosUtilizados();
    verificarTransacoes();
  }, []);

  useEffect(() => {
    if (transactions.some(t => t.orcamento_id)) {
      fetchOrcamentosInfo();
    }
    if (transactions.some(t => t.credito_id)) {
      fetchCreditosInfo();
    }
  }, [transactions]);

  // Efeito para aplicar filtros sempre que transactions ou filtros mudarem
  useEffect(() => {
    aplicarFiltros();
  }, [transactions, filtros]);

  const verificarTransacoes = async () => {
    try {
      const { count, error } = await supabase
        .from('transacoes_financeiras')
        .select('*', { count: 'exact', head: true });
      
      if (error) throw error;
      console.log(`📊 Total de transações no banco: ${count}`);
      
      if (count === 0) {
        console.warn('⚠️ Nenhuma transação encontrada no banco de dados.');
      }
    } catch (error) {
      console.error('Erro ao contar transações:', error);
    }
  };

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      console.log('🔄 Buscando transações financeiras...');

      const { data, error } = await supabase
        .from('transacoes_financeiras')
        .select('*')
        .order('data', { ascending: false })
        .limit(500);

      if (error) {
        console.error('❌ Erro ao buscar transações:', error);
        toast({
          title: "Erro ao carregar transações",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      console.log('✅ Transações encontradas:', data?.length || 0);
      
      // Log para depuração
      const despesasManuais = data?.filter(t => t.tipo === 'despesa' && !t.orcamento_id && !t.origem_tipo?.includes('credito')) || [];
      const receitasManuais = data?.filter(t => t.tipo === 'receita' && !t.orcamento_id && !t.origem_tipo?.includes('credito')) || [];
      
      console.log(`📊 Despesas manuais encontradas: ${despesasManuais.length}`, despesasManuais);
      console.log(`📊 Receitas manuais encontradas: ${receitasManuais.length}`, receitasManuais);
      console.log('📋 Todas as transações:', data);

      setTransactions(data || []);

      // 🔧 CORREÇÃO: Calcular totais considerando TODAS as transações
      let receitasTotal = 0;
      let despesasTotal = 0;
      let creditosTotal = 0;

      (data || []).forEach(t => {
        const valor = Number(t.valor) || 0;
        
        // Créditos
        if (t.origem_tipo?.includes('credito')) {
          creditosTotal += valor;
        } 
        // Receitas (todas - tanto recebidas quanto pendentes)
        else if (t.tipo === 'receita') {
          receitasTotal += valor;
        } 
        // Despesas (todas - tanto pagas quanto pendentes)
        else if (t.tipo === 'despesa') {
          despesasTotal += valor;
        }
      });

      console.log(`📊 Totais calculados - Receitas: R$ ${receitasTotal.toFixed(2)}, Despesas: R$ ${despesasTotal.toFixed(2)}, Créditos: R$ ${creditosTotal.toFixed(2)}`);

      setReceitas(receitasTotal);
      setDespesas(despesasTotal);
      setCreditos(creditosTotal);
      setSaldoTotal(receitasTotal - despesasTotal);

      await fetchAlertas(data || []);

    } catch (error: any) {
      console.error('❌ Erro completo:', error);
      toast({
        title: "Erro ao carregar transações",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCreditosUtilizados = async () => {
    try {
      console.log('🔄 Buscando créditos utilizados em orçamentos...');
      
      const { data, error } = await supabase
        .from('view_creditos_utilizados')
        .select('*')
        .order('data_utilizacao', { ascending: false })
        .limit(100);

      if (error) {
        console.error('❌ Erro ao buscar créditos utilizados:', error);
        return;
      }

      console.log('✅ Créditos utilizados encontrados:', data?.length || 0);
      setCreditosUtilizados(data || []);
      
    } catch (error) {
      console.error('❌ Erro ao buscar créditos utilizados:', error);
    }
  };

  const fetchAlertas = async (transacoes: Transaction[]) => {
    try {
      const hoje = new Date();
      hoje.setHours(0, 0, 0, 0);
      
      const transacoesPendentes = transacoes.filter(t => 
        t.status === 'pendente' && !t.origem_tipo?.includes('credito')
      );

      const vencidas = transacoesPendentes
        .filter(t => {
          if (!t.data_vencimento) return false;
          if (t.tipo !== 'despesa') return false;
          const dataVencimento = normalizarData(t.data_vencimento);
          dataVencimento.setHours(0, 0, 0, 0);
          return dataVencimento < hoje;
        })
        .map(t => {
          const dataVencimento = normalizarData(t.data_vencimento!);
          dataVencimento.setHours(0, 0, 0, 0);
          const diasAtraso = Math.floor((hoje.getTime() - dataVencimento.getTime()) / (1000 * 60 * 60 * 24));
          
          return {
            ...t,
            dias_atraso: diasAtraso
          };
        });

      setTransacoesVencidas(vencidas);

      const aVencer = transacoesPendentes
        .filter(t => {
          if (!t.data_vencimento) return false;
          if (t.tipo !== 'despesa') return false;
          const dataVencimento = normalizarData(t.data_vencimento);
          dataVencimento.setHours(0, 0, 0, 0);
          const diasRestantes = Math.floor((dataVencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
          return diasRestantes >= 0 && diasRestantes <= 7;
        })
        .map(t => {
          const dataVencimento = normalizarData(t.data_vencimento!);
          dataVencimento.setHours(0, 0, 0, 0);
          const diasRestantes = Math.floor((dataVencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
          
          return {
            ...t,
            dias_restantes: diasRestantes
          };
        });

      setTransacoesAVencer(aVencer);

    } catch (error: any) {
      console.error("Erro ao carregar alertas:", error);
    }
  };

  const fetchOrcamentosInfo = async () => {
    try {
      const orcamentoIds = [...new Set(transactions
        .filter(t => t.orcamento_id)
        .map(t => t.orcamento_id))] as string[];

      if (orcamentoIds.length === 0) return;

      const { data, error } = await supabase
        .from('orcamentos')
        .select(`
          id, 
          numero, 
          valor_total,
          pagamento_misto,
          valor_credito_utilizado,
          forma_pagamento_restante,
          tipo_pagamento,
          cliente:clientes(nome)
        `)
        .in('id', orcamentoIds);

      if (error) throw error;

      const infoMap: Record<string, OrcamentoInfo> = {};
      data?.forEach((orc: any) => {
        infoMap[orc.id] = {
          id: orc.id,
          numero: orc.numero,
          cliente_nome: orc.cliente?.nome || 'Cliente não encontrado',
          valor_total: Number(orc.valor_total) || 0,
          pagamento_misto: orc.pagamento_misto || false,
          valor_credito_utilizado: Number(orc.valor_credito_utilizado) || 0,
          forma_pagamento_restante: orc.forma_pagamento_restante,
          tipo_pagamento: orc.tipo_pagamento
        };
      });

      setOrcamentosInfo(infoMap);
    } catch (error) {
      console.error('Erro ao buscar informações dos orçamentos:', error);
    }
  };

  const fetchCreditosInfo = async () => {
    try {
      const creditoIds = [...new Set(transactions
        .filter(t => t.credito_id)
        .map(t => t.credito_id))] as string[];

      if (creditoIds.length === 0) return;

      const { data, error } = await supabase
        .from('creditos_utilizados')
        .select(`
          id, 
          cliente_id,
          valor_utilizado,
          data_utilizacao,
          tipo_operacao,
          saldo_anterior,
          saldo_posterior,
          observacao,
          cliente:clientes(nome)
        `)
        .in('id', creditoIds);

      if (error) throw error;

      const infoMap: Record<string, CreditoInfo> = {};
      data?.forEach((cred: any) => {
        infoMap[cred.id] = {
          id: cred.id,
          cliente_nome: cred.cliente?.nome || 'Cliente não encontrado',
          valor_original: cred.saldo_anterior + cred.valor_utilizado,
          valor_utilizado: cred.valor_utilizado,
          saldo: cred.saldo_posterior,
          data_criacao: cred.data_utilizacao
        };
      });

      setCreditosInfo(infoMap);
    } catch (error) {
      console.error('Erro ao buscar informações dos créditos:', error);
    }
  };

  const aplicarFiltros = () => {
    console.log('🔄 Aplicando filtros... Estado atual dos filtros:', filtros);
    
    let filtradas = [...transactions];
    console.log(`📊 Total de transações antes do filtro: ${filtradas.length}`);

    // Filtro por tipo (receita/despesa/credito)
    if (filtros.tipo !== 'todos') {
      if (filtros.tipo === 'credito') {
        filtradas = filtradas.filter(t => t.origem_tipo?.includes('credito'));
      } else {
        filtradas = filtradas.filter(t => 
          t.tipo === filtros.tipo && !t.origem_tipo?.includes('credito')
        );
      }
      console.log(`📊 Após filtro de tipo (${filtros.tipo}): ${filtradas.length}`);
    }

    // Filtro por origem
    if (filtros.origem !== 'todos') {
      if (filtros.origem === 'credito') {
        filtradas = filtradas.filter(t => t.origem_tipo?.includes('credito'));
      } else if (filtros.origem === 'orcamento') {
        filtradas = filtradas.filter(t => 
          t.orcamento_id !== null && t.orcamento_id !== undefined
        );
      } else if (filtros.origem === 'manual') {
        filtradas = filtradas.filter(t => isTransacaoManual(t));
      }
      console.log(`📊 Após filtro de origem (${filtros.origem}): ${filtradas.length}`);
    }

    // Filtro por status
    if (filtros.status !== 'todos') {
      filtradas = filtradas.filter(t => t.status === filtros.status);
      console.log(`📊 Após filtro de status (${filtros.status}): ${filtradas.length}`);
    }

    // Filtro por período (data de vencimento)
    if (filtros.periodo.inicio) {
      filtradas = filtradas.filter(t => 
        t.data_vencimento && compararDatas(t.data_vencimento, filtros.periodo.inicio) >= 0
      );
      console.log(`📊 Após filtro de período inicio: ${filtradas.length}`);
    }
    if (filtros.periodo.fim) {
      filtradas = filtradas.filter(t => 
        t.data_vencimento && compararDatas(t.data_vencimento, filtros.periodo.fim) <= 0
      );
      console.log(`📊 Após filtro de período fim: ${filtradas.length}`);
    }

    setFilteredTransactions(filtradas);
    console.log(`✅ Total de transações filtradas: ${filtradas.length}`);

    // 🔧 CORREÇÃO: Calcular somatórios das transações filtradas considerando TODAS
    let receitasFiltradas = 0;
    let despesasFiltradas = 0;
    let creditosFiltrados = 0;

    filtradas.forEach(t => {
      const valor = Number(t.valor) || 0;
      
      if (t.origem_tipo?.includes('credito')) {
        creditosFiltrados += valor;
      } else if (t.tipo === 'receita') {
        receitasFiltradas += valor;
      } else if (t.tipo === 'despesa') {
        despesasFiltradas += valor;
      }
    });

    setTotalReceitasFiltradas(receitasFiltradas);
    setTotalDespesasFiltradas(despesasFiltradas);
    setTotalCreditosFiltrados(creditosFiltrados);
    setSaldoFiltrado(receitasFiltradas - despesasFiltradas);

    // Calcular total a receber (pendentes)
    const aReceber = filtradas
      .filter(t => t.tipo === 'receita' && t.status === 'pendente' && !t.origem_tipo?.includes('credito'))
      .reduce((sum, t) => sum + Number(t.valor), 0);
    setTotalAReceber(aReceber);

    // Calcular total a pagar (pendentes)
    const aPagar = filtradas
      .filter(t => t.tipo === 'despesa' && t.status === 'pendente' && !t.origem_tipo?.includes('credito'))
      .reduce((sum, t) => sum + Number(t.valor), 0);
    setTotalAPagar(aPagar);
  };

  const limparFiltros = () => {
    setFiltros({
      tipo: 'todos',
      status: 'todos',
      origem: 'todos',
      periodo: {
        inicio: '',
        fim: ''
      }
    });
  };

  const marcarComoPago = async (id: string, tipo: string) => {
    try {
      const novoStatus = tipo === 'receita' ? 'recebido' : 'pago';
      const hoje = new Date();
      hoje.setHours(12, 0, 0, 0);
      
      const { error } = await supabase
        .from('transacoes_financeiras')
        .update({
          status: novoStatus,
          data_pagamento: hoje.toISOString().split('T')[0]
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: `Transação marcada como ${novoStatus}`,
      });

      fetchTransactions();
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const pagarParcela = async (transacaoId: string, parcelaNumero?: number, totalParcelas?: number) => {
    try {
      const { data: transacao } = await supabase
        .from('transacoes_financeiras')
        .select('tipo')
        .eq('id', transacaoId)
        .single();

      if (!transacao) throw new Error('Transação não encontrada');

      const novoStatus = transacao.tipo === 'receita' ? 'recebido' : 'pago';
      const hoje = new Date();
      hoje.setHours(12, 0, 0, 0);

      const { error } = await supabase
        .from('transacoes_financeiras')
        .update({
          status: novoStatus,
          data_pagamento: hoje.toISOString().split('T')[0]
        })
        .eq('id', transacaoId);

      if (error) throw error;

      toast({
        title: "Sucesso!",
        description: parcelaNumero 
          ? `Parcela ${parcelaNumero}/${totalParcelas} marcada como ${novoStatus}.`
          : `Transação marcada como ${novoStatus}.`,
      });

      fetchTransactions();
    } catch (error: any) {
      toast({
        title: "Erro ao marcar como pago",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEdit = (transacao: Transaction) => {
    setTransacaoEditando(transacao);
  };

  const [dialogExcluirAberto, setDialogExcluirAberto] = useState(false);
  const [transParaExcluir, setTransParaExcluir] = useState<Transaction | null>(null);

  const handleExcluir = async () => {
    if (!transParaExcluir) return;
    try {
      const { error } = await supabase
        .from('transacoes_financeiras')
        .delete()
        .eq('id', transParaExcluir.id);
      if (error) throw error;
      toast({ title: "Transação excluída", description: transParaExcluir.descricao });
      setDialogExcluirAberto(false); setTransParaExcluir(null);
      fetchTransactions();
    } catch (error: any) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    }
  };

  const handleEditComplete = () => {
    setTransacaoEditando(null);
    fetchTransactions();
  };

  const handleReset = async () => {
    try {
      const { error: transError } = await supabase
        .from('transacoes_financeiras')
        .delete()
        .not('orcamento_id', 'is', null);

      if (transError) throw transError;

      toast({
        title: "Dados resetados",
        description: "Transações financeiras de orçamentos foram removidas.",
      });

      fetchTransactions();
    } catch (error: any) {
      toast({
        title: "Erro ao resetar dados",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const visualizarDetalhesCredito = (credito: CreditoUtilizado) => {
    setCreditoSelecionado(credito);
  };

  const getOrigemBadge = (transacao: Transaction) => {
    const { origem_tipo, parcela_numero, total_parcelas, credito_id, orcamento_id } = transacao;
    
    if (credito_id) {
      return (
        <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
          <CreditCard className="h-3 w-3 mr-1" />
          Crédito
        </Badge>
      );
    }
    
    if (orcamento_id) {
      if (origem_tipo === 'orcamento_avista') {
        return (
          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
            <FileText className="h-3 w-3 mr-1" />
            Orçamento À Vista
          </Badge>
        );
      } else if (origem_tipo === 'orcamento_parcelado') {
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            <FileText className="h-3 w-3 mr-1" />
            Orçamento Parcelado
            {parcela_numero && total_parcelas && ` (${parcela_numero}/${total_parcelas})`}
          </Badge>
        );
      } else if (origem_tipo === 'orcamento_misto_avista') {
        return (
          <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
            <CreditCard className="h-3 w-3 mr-1" />
            Pagamento Misto (à vista)
          </Badge>
        );
      } else if (origem_tipo === 'orcamento_misto_parcelado') {
        return (
          <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
            <CreditCard className="h-3 w-3 mr-1" />
            Pagamento Misto (parcelado)
            {parcela_numero && total_parcelas && ` (${parcela_numero}/${total_parcelas})`}
          </Badge>
        );
      }
    }
    
    // Manual (sem orcamento_id e sem credito_id)
    if (isTransacaoManual(transacao)) {
      return (
        <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
          Manual
        </Badge>
      );
    }
    
    return (
      <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
        Manual
      </Badge>
    );
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      'pendente': 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
      'recebido': 'bg-green-100 text-green-800 hover:bg-green-100',
      'pago': 'bg-green-100 text-green-800 hover:bg-green-100',
      'cancelado': 'bg-gray-100 text-gray-800 hover:bg-gray-100',
      'atrasado': 'bg-red-100 text-red-800 hover:bg-red-100',
      'utilizado': 'bg-purple-100 text-purple-800 hover:bg-purple-100',
      'disponivel': 'bg-blue-100 text-blue-800 hover:bg-blue-100',
    };
    return (
      <Badge className={variants[status] || 'bg-gray-100 text-gray-800'}>
        {status}
      </Badge>
    );
  };

  const formatarValor = (valor: number, tipo: string, origem_tipo?: string) => {
    const valorNumerico = Number(valor) || 0;
    
    if (origem_tipo?.includes('credito')) {
      return (
        <span className="text-purple-600 font-semibold">
          R$ {valorNumerico.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </span>
      );
    }
    
    if (tipo === 'receita') {
      return (
        <span className="text-green-600 font-semibold">
          + R$ {valorNumerico.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </span>
      );
    } else {
      return (
        <span className="text-red-600 font-semibold">
          - R$ {valorNumerico.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </span>
      );
    }
  };

  const getResumoCredito = () => {
    const totalCreditosUtilizados = creditosUtilizados.reduce((sum, c) => sum + c.valor_utilizado, 0);
    const saldoCreditos = creditos - totalCreditosUtilizados;
    
    return { totalCreditosUtilizados, saldoCreditos };
  };

  const { totalCreditosUtilizados, saldoCreditos } = getResumoCredito();

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in p-6">
        <div className="text-center py-8 text-muted-foreground">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          Carregando dados financeiros...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Financeiro</h2>
          <p className="text-muted-foreground">Gerencie todas as transações financeiras</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMostrarHistoricoCreditos(!mostrarHistoricoCreditos)}
          >
            <History className="h-4 w-4 mr-2" />
            Histórico de Créditos
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setMostrarFiltros(!mostrarFiltros)}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filtros
            {(filtros.tipo !== 'todos' || filtros.status !== 'todos' || filtros.origem !== 'todos' || filtros.periodo.inicio || filtros.periodo.fim) && (
              <Badge variant="secondary" className="ml-2">Ativos</Badge>
            )}
          </Button>
          <AddTransactionDialog 
            onTransactionAdded={fetchTransactions}
            transactionToEdit={transacaoEditando}
            onEditComplete={handleEditComplete}
          />
          {isAdmin && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Resetar Dados
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar Reset</AlertDialogTitle>
                  <AlertDialogDescription>
                    Esta ação irá remover todas as transações financeiras de orçamentos do sistema.
                    Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleReset}>Confirmar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* PAINEL DE FILTROS */}
      {mostrarFiltros && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Filtros</CardTitle>
              <Button variant="ghost" size="sm" onClick={limparFiltros}>
                <X className="h-4 w-4 mr-2" />
                Limpar Filtros
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-5">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={filtros.tipo}
                  onValueChange={(value: 'todos' | 'receita' | 'despesa' | 'credito') => 
                    setFiltros({ ...filtros, tipo: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="receita">Receitas</SelectItem>
                    <SelectItem value="despesa">Despesas</SelectItem>
                    <SelectItem value="credito">Créditos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Origem</Label>
                <Select
                  value={filtros.origem}
                  onValueChange={(value: 'todos' | 'orcamento' | 'credito' | 'manual') => 
                    setFiltros({ ...filtros, origem: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas</SelectItem>
                    <SelectItem value="orcamento">Orçamentos</SelectItem>
                    <SelectItem value="credito">Créditos</SelectItem>
                    <SelectItem value="manual">Manuais</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={filtros.status}
                  onValueChange={(value: 'todos' | 'pendente' | 'pago' | 'recebido' | 'atrasado' | 'utilizado' | 'disponivel') => 
                    setFiltros({ ...filtros, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="pendente">Pendente</SelectItem>
                    <SelectItem value="pago">Pago</SelectItem>
                    <SelectItem value="recebido">Recebido</SelectItem>
                    <SelectItem value="atrasado">Atrasado</SelectItem>
                    <SelectItem value="utilizado">Utilizado</SelectItem>
                    <SelectItem value="disponivel">Disponível</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Período Início</Label>
                <Input
                  type="date"
                  value={filtros.periodo.inicio}
                  onChange={(e) => setFiltros({
                    ...filtros,
                    periodo: { ...filtros.periodo, inicio: e.target.value }
                  })}
                />
              </div>

              <div className="space-y-2">
                <Label>Período Fim</Label>
                <Input
                  type="date"
                  value={filtros.periodo.fim}
                  onChange={(e) => setFiltros({
                    ...filtros,
                    periodo: { ...filtros.periodo, fim: e.target.value }
                  })}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* HISTÓRICO DE CRÉDITOS */}
      {mostrarHistoricoCreditos && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-purple-600" />
                Histórico de Utilização de Créditos em Orçamentos
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setMostrarHistoricoCreditos(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {creditosUtilizados.length === 0 ? (
              <div className="text-center py-8">
                <CreditCard className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Nenhum crédito utilizado em orçamentos ainda.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Orçamento</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Saldo Anterior</TableHead>
                      <TableHead>Saldo Posterior</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {creditosUtilizados.map((credito) => (
                      <TableRow key={credito.id}>
                        <TableCell>{formatDate(credito.data_utilizacao)}</TableCell>
                        <TableCell className="font-medium">{credito.cliente_nome}</TableCell>
                        <TableCell>{credito.orcamento_numero || '-'}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-purple-50 text-purple-700">
                            {credito.tipo_operacao === 'orcamento_credito_total' ? 'Uso Total' :
                             credito.tipo_operacao === 'orcamento_credito_parcial' ? 'Uso Parcial' :
                             'Outro'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-bold text-purple-600">
                          R$ {credito.valor_utilizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          R$ {credito.saldo_anterior.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell>
                          R$ {credito.saldo_posterior.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => visualizarDetalhesCredito(credito)}
                            title="Ver detalhes"
                          >
                            <Info className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ALERTAS DE VENCIMENTO */}
      {transacoesVencidas.length > 0 && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Contas a Pagar Vencidas - Atenção Urgente!</AlertTitle>
          <AlertDescription>
            <div className="mt-2 space-y-2">
              <p className="font-semibold">Você tem {transacoesVencidas.length} conta(s) vencida(s):</p>
              {transacoesVencidas.slice(0, 3).map((t) => (
                <div key={t.id} className="flex items-center justify-between bg-background/50 p-2 rounded">
                  <div>
                    <p className="font-medium">{t.descricao}</p>
                    <p className="text-sm">
                      Venceu há {t.dias_atraso} dia(s) - {formatarDataParaExibicao(t.data_vencimento)}
                      {t.origem_tipo && (
                        <span className="ml-2">
                          {getOrigemBadge(t as Transaction)}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">R$ {Number(t.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    <Button size="sm" onClick={() => pagarParcela(t.id, t.parcela_numero, t.total_parcelas)}>
                      Pagar
                    </Button>
                  </div>
                </div>
              ))}
              {transacoesVencidas.length > 3 && (
                <p className="text-sm">E mais {transacoesVencidas.length - 3} conta(s)...</p>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {transacoesAVencer.length > 0 && (
        <Alert>
          <Clock className="h-4 w-4" />
          <AlertTitle>Contas a Pagar nos Próximos 7 Dias</AlertTitle>
          <AlertDescription>
            <div className="mt-2 space-y-2">
              <p className="font-semibold">Você tem {transacoesAVencer.length} conta(s) a pagar próximas do vencimento:</p>
              {transacoesAVencer.slice(0, 5).map((t) => (
                <div key={t.id} className="flex items-center justify-between bg-background/50 p-2 rounded">
                  <div>
                    <p className="font-medium">{t.descricao}</p>
                    <p className="text-sm">
                      Vence em {t.dias_restantes} dia(s) - {formatarDataParaExibicao(t.data_vencimento)}
                      {t.origem_tipo && (
                        <span className="ml-2">
                          {getOrigemBadge(t as Transaction)}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">R$ {Number(t.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    <Button size="sm" variant="outline" onClick={() => pagarParcela(t.id, t.parcela_numero, t.total_parcelas)}>
                      Pagar
                    </Button>
                  </div>
                </div>
              ))}
              {transacoesAVencer.length > 5 && (
                <p className="text-sm">E mais {transacoesAVencer.length - 5} conta(s)...</p>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* RESUMO FINANCEIRO GERAL */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Saldo Total</p>
                <h3 className="text-2xl font-bold text-foreground">
                  R$ {saldoTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Receitas - Despesas
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Receitas</p>
                <h3 className="text-2xl font-bold text-green-600">
                  R$ {receitas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Total de receitas
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Despesas</p>
                <h3 className="text-2xl font-bold text-red-600">
                  R$ {despesas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Total de despesas
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-100">
                <TrendingDown className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Créditos em Orçamentos</p>
                <h3 className="text-2xl font-bold text-purple-600">
                  R$ {creditos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Créditos totais utilizados
                </p>
                <div className="text-xs text-purple-600 mt-1">
                  Utilizado: R$ {totalCreditosUtilizados.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  <br />
                  Saldo: R$ {saldoCreditos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100">
                <CreditCard className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* RESUMO DOS FILTROS ATUAIS */}
      {(filtros.tipo !== 'todos' || filtros.status !== 'todos' || filtros.origem !== 'todos' || filtros.periodo.inicio || filtros.periodo.fim) && (
        <Card className="bg-muted/50">
          <CardContent className="p-4">
            <div className="grid gap-4 md:grid-cols-6">
              <div>
                <p className="text-xs text-muted-foreground">Saldo do Período</p>
                <p className={`text-lg font-bold ${saldoFiltrado >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  R$ {saldoFiltrado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Receitas do Período</p>
                <p className="text-lg font-bold text-green-600">
                  R$ {totalReceitasFiltradas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Despesas do Período</p>
                <p className="text-lg font-bold text-red-600">
                  R$ {totalDespesasFiltradas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Créditos do Período</p>
                <p className="text-lg font-bold text-purple-600">
                  R$ {totalCreditosFiltrados.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">A Receber</p>
                <p className="text-lg font-bold text-yellow-600">
                  R$ {totalAReceber.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">A Pagar</p>
                <p className="text-lg font-bold text-orange-600">
                  R$ {totalAPagar.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* LISTA DE TRANSAÇÕES */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Transações {filteredTransactions.length < transactions.length 
              ? `(${filteredTransactions.length} de ${transactions.length})` 
              : `(${transactions.length})`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma transação encontrada</h3>
              <p className="text-gray-500 mb-6">
                {transactions.length > 0 
                  ? "Nenhuma transação corresponde aos filtros selecionados." 
                  : "Não há transações cadastradas."}
              </p>
              {transactions.length > 0 && (
                <Button variant="outline" onClick={limparFiltros}>
                  Limpar Filtros
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descrição</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((transacao) => {
                    const hoje = new Date();
                    hoje.setHours(0, 0, 0, 0);
                    
                    let isVencida = false;
                    let isProximoVencimento = false;
                    
                    if (transacao.data_vencimento && transacao.status === 'pendente' && !transacao.origem_tipo?.includes('credito')) {
                      const dataVencimento = normalizarData(transacao.data_vencimento);
                      dataVencimento.setHours(0, 0, 0, 0);
                      
                      isVencida = dataVencimento < hoje;
                      
                      const diasRestantes = Math.floor((dataVencimento.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
                      isProximoVencimento = !isVencida && diasRestantes >= 0 && diasRestantes <= 7;
                    }

                    const orcamentoInfo = transacao.orcamento_id ? orcamentosInfo[transacao.orcamento_id] : null;
                    const creditoInfo = transacao.credito_id ? creditosInfo[transacao.credito_id] : null;

                    return (
                      <TableRow 
                        key={transacao.id} 
                        className={`
                          ${isVencida ? 'bg-red-50 hover:bg-red-100' : ''}
                          ${isProximoVencimento ? 'bg-yellow-50 hover:bg-yellow-100' : ''}
                          ${transacao.origem_tipo?.includes('credito') ? 'bg-purple-50 hover:bg-purple-100' : ''}
                          ${transacao.tipo_pagamento === 'misto_restante' ? 'bg-indigo-50 hover:bg-indigo-100' : ''}
                          ${isTransacaoManual(transacao) ? 'bg-gray-50 hover:bg-gray-100' : ''}
                        `}
                      >
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {isVencida && <AlertTriangle className="h-4 w-4 text-red-500" />}
                            {isProximoVencimento && <Clock className="h-4 w-4 text-yellow-600" />}
                            {transacao.origem_tipo?.includes('credito') && <CreditCard className="h-4 w-4 text-purple-500" />}
                            {transacao.tipo_pagamento === 'misto_restante' && <CreditCard className="h-4 w-4 text-indigo-500" />}
                            {isTransacaoManual(transacao) && <FileText className="h-4 w-4 text-gray-400" />}
                            <div className="flex flex-col">
                              <span>{transacao.descricao}</span>
                              {orcamentoInfo && (
                                <div className="flex flex-col gap-0.5">
                                  <span className="text-xs text-blue-600 flex items-center gap-1">
                                    <FileText className="h-3 w-3" />
                                    Orçamento: {orcamentoInfo.numero} - {orcamentoInfo.cliente_nome}
                                  </span>
                                  {orcamentoInfo.pagamento_misto && (
                                    <span className="text-xs text-indigo-600 flex items-center gap-1">
                                      <CreditCard className="h-3 w-3" />
                                      Pagamento Misto: R$ {orcamentoInfo.valor_credito_utilizado?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} do crédito
                                      {orcamentoInfo.forma_pagamento_restante && ` + ${orcamentoInfo.forma_pagamento_restante}`}
                                    </span>
                                  )}
                                </div>
                              )}
                              {creditoInfo && (
                                <span className="text-xs text-purple-600 flex items-center gap-1">
                                  <CreditCard className="h-3 w-3" />
                                  Cliente: {creditoInfo.cliente_nome}
                                </span>
                              )}
                              {transacao.observacoes && (
                                <span className="text-xs text-gray-500 mt-1">
                                  {transacao.observacoes}
                                </span>
                              )}
                              {transacao.observacoes_adicionais && (
                                <span className="text-xs text-gray-400 mt-0.5">
                                  {transacao.observacoes_adicionais}
                                </span>
                              )}
                              {transacao.valor_credito_utilizado && transacao.valor_credito_utilizado > 0 && (
                                <span className="text-xs text-purple-500 mt-0.5">
                                  Crédito utilizado na origem: R$ {transacao.valor_credito_utilizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getOrigemBadge(transacao)}
                        </TableCell>
                        <TableCell>
                          {transacao.origem_tipo?.includes('credito') ? (
                            <Badge variant="outline" className="bg-purple-50 text-purple-700">
                              Crédito
                            </Badge>
                          ) : (
                            <Badge variant={transacao.tipo === "receita" ? "default" : "secondary"}>
                              {transacao.tipo === "receita" ? "Receita" : "Despesa"}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{transacao.categoria || '-'}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          {formatarValor(transacao.valor, transacao.tipo, transacao.origem_tipo)}
                        </TableCell>
                        <TableCell>
                          {transacao.data_vencimento ? (
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatarDataParaExibicao(transacao.data_vencimento)}
                            </div>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(transacao.status)}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            {/* Botão Editar - só para transações não-crédito */}
                            {!transacao.origem_tipo?.includes('credito') && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                onClick={() => handleEdit(transacao)}
                                title="Editar"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}

                            {/* Botão Pagar/Receber - só para pendentes não-crédito */}
                            {transacao.status === 'pendente' && !transacao.origem_tipo?.includes('credito') && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => pagarParcela(transacao.id, transacao.parcela_numero, transacao.total_parcelas)}
                              >
                                {transacao.tipo === 'despesa' ? 'Pagar' : 'Receber'}
                              </Button>
                            )}

                            {/* Botão Excluir */}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                              onClick={() => { setTransParaExcluir(transacao); setDialogExcluirAberto(true); }}
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Excluir Transação */}
      <AlertDialog open={dialogExcluirAberto} onOpenChange={setDialogExcluirAberto}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Transação</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a transação "{transParaExcluir?.descricao}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleExcluir} className="bg-red-600 hover:bg-red-700 text-white">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de Detalhes do Crédito */}
      {creditoSelecionado && (
        <Dialog open={!!creditoSelecionado} onOpenChange={() => setCreditoSelecionado(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Detalhes da Utilização de Crédito em Orçamento</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Cliente</p>
                  <p className="font-medium">{creditoSelecionado.cliente_nome}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Data</p>
                  <p className="font-medium">{formatDate(creditoSelecionado.data_utilizacao)}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Orçamento</p>
                  <p className="font-medium">{creditoSelecionado.orcamento_numero || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tipo de Operação</p>
                  <Badge variant="outline" className="bg-purple-50 text-purple-700">
                    {creditoSelecionado.tipo_operacao === 'orcamento_credito_total' ? 'Uso Total do Crédito' :
                     creditoSelecionado.tipo_operacao === 'orcamento_credito_parcial' ? 'Uso Parcial do Crédito' :
                     creditoSelecionado.tipo_operacao}
                  </Badge>
                </div>
              </div>

              <div className="bg-purple-50 p-4 rounded-lg space-y-2">
                <p className="text-sm font-medium text-purple-800">Movimentação do Crédito</p>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-xs text-purple-600">Saldo Anterior</p>
                    <p className="font-bold">R$ {creditoSelecionado.saldo_anterior.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="text-purple-400">→</div>
                  <div>
                    <p className="text-xs text-purple-600">Valor Utilizado</p>
                    <p className="font-bold text-red-600">- R$ {creditoSelecionado.valor_utilizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                  <div className="text-purple-400">→</div>
                  <div>
                    <p className="text-xs text-purple-600">Saldo Posterior</p>
                    <p className="font-bold">R$ {creditoSelecionado.saldo_posterior.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                  </div>
                </div>
              </div>

              {creditoSelecionado.observacao && (
                <div>
                  <p className="text-sm text-muted-foreground">Observação</p>
                  <p className="text-sm bg-gray-50 p-3 rounded">{creditoSelecionado.observacao}</p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={() => setCreditoSelecionado(null)}>Fechar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}