// @ts-nocheck
import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { DollarSign, Landmark, CircleArrowDown as ArrowDownCircle, CircleArrowUp as ArrowUpCircle, Send, FileSpreadsheet, Percent, Receipt, ClipboardCheck, BarChart3, Search, RefreshCw, Plus, TrendingUp, TrendingDown, Wallet, Pencil, Trash2, CheckCircle2, Calendar, Filter, X, ArrowDownToLine, ArrowUpFromLine, Users, User, UserCog } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import AddTransactionDialog from "@/components/financeiro/AddTransactionDialog";

// 🔧 INTERFACE PARA A TABELA "comissoes"
interface Comissao {
  id: string;
  orcamento_id: string | null;
  vendedor_id: string | null;
  valor_orcamento: number;
  percentual_comissao: number;
  valor_comissao: number;
  status: 'pendente' | 'pago' | 'recebido' | 'cancelado';
  data_pagamento: string | null;
  created_at: string;
  updated_at: string;
  // Campos para exibição (join com vendedor)
  vendedor_nome?: string | null;
  vendedor_email?: string | null;
  observacoes?: string | null;
}

// Interface para o vendedor
interface Vendedor {
  id: string;
  user_id: string;
  nome: string;
  email: string;
  comissao_percentual: number;
  telefone: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

interface ComissaoVendedor {
  vendedor_nome: string;
  vendedor_id?: string | null;
  valor_total: number;
  valor_recebido: number;
  valor_pendente: number;
  quantidade: number;
  comissoes: Comissao[];
}

// Interface para transação
interface Transacao {
  id: string;
  descricao: string;
  valor: number;
  tipo: 'receita' | 'despesa';
  categoria: string;
  data: string;
  data_vencimento: string | null;
  data_pagamento: string | null;
  forma_pagamento: string;
  conta_bancaria: string;
  status: 'pendente' | 'pago' | 'recebido' | 'cancelado';
  observacoes?: string;
  created_at: string;
  updated_at: string;
}

const CONTAS_BANCARIAS = ["Banco", "Itaú", "Cora", "Nubank Jessica PJ", "Mercado Pago"];
const FORMAS_PAGAMENTO = ["dinheiro", "pix", "debito", "credito", "boleto", "transferencia"];

const formatCurrency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const formatDate = (d: string | null) => { 
  if (!d) return "-"; 
  try {
    const [a, m, di] = d.split("T")[0].split("-"); 
    return `${di}/${m}/${a}`;
  } catch {
    return "-";
  }
};
const todayStr = () => new Date().toISOString().split("T")[0];

const getStatusBadge = (status: string) => {
  switch (status) {
    case "pendente": return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-200">Pendente</Badge>;
    case "pago": return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">Pago</Badge>;
    case "recebido": return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">Recebido</Badge>;
    case "cancelado": return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-200">Cancelado</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
};

const pageConfig: Record<string, { title: string; icon: any; description: string; filter: (t: any) => boolean; showAdd: boolean; defaultTipo: string }> = {
  "caixas-bancos": { title: "Caixas e Bancos", icon: Landmark, description: "Saldos por conta bancária e caixa", filter: () => true, showAdd: false, defaultTipo: "receita" },
  "contas-pagar": { title: "Contas a Pagar", icon: ArrowDownCircle, description: "Despesas pendentes e pagas", filter: (t) => t.tipo === "despesa", showAdd: true, defaultTipo: "despesa" },
  "contas-receber": { title: "Contas a Receber", icon: ArrowUpCircle, description: "Receitas pendentes e recebidas", filter: (t) => t.tipo === "receita", showAdd: true, defaultTipo: "receita" },
  "remessas-retornos": { title: "Remessas e Retornos", icon: Send, description: "Remessas bancárias e retornos de pagamento", filter: (t) => t.forma_pagamento === "boleto" || t.forma_pagamento === "transferencia" || (t.origem_tipo || "").includes("remessa"), showAdd: false, defaultTipo: "despesa" },
  "ficha-financeira": { title: "Ficha Financeira", icon: FileSpreadsheet, description: "Extrato completo de movimentações", filter: () => true, showAdd: true, defaultTipo: "receita" },
  "comissoes": { title: "Comissões", icon: Percent, description: "Comissões de vendedores e representantes", filter: () => true, showAdd: true, defaultTipo: "despesa" },
  "controle-caixa": { title: "Controle de Caixa", icon: Receipt, description: "Movimentações de caixa (dinheiro, PIX)", filter: (t) => t.forma_pagamento === "dinheiro" || t.forma_pagamento === "pix" || !t.forma_pagamento, showAdd: true, defaultTipo: "receita" },
  "faturamento-agrupado": { title: "Faturamento Agrupado", icon: ClipboardCheck, description: "Faturamento agrupado por período e categoria", filter: () => true, showAdd: false, defaultTipo: "receita" },
  "relatorios": { title: "Relatórios Financeiros", icon: BarChart3, description: "Análises e relatórios detalhados", filter: () => true, showAdd: false, defaultTipo: "receita" },
};

export default function FinanceiroSub() {
  const { subpage } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const slug = subpage || location.pathname.split("/").pop() || "";
  const config = pageConfig[slug] || pageConfig["ficha-financeira"];
  const Icon = config.icon;

  // 🔧 ESTADO PARA TRANSAÇÕES
  const [transacoes, setTransacoes] = useState<Transacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [contaFilter, setContaFilter] = useState("todas");
  const [vendedorFilter, setVendedorFilter] = useState("todos");

  // 🔧 ESTADO PARA COMISSÕES
  const [comissoes, setComissoes] = useState<Comissao[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [vendedoresList, setVendedoresList] = useState<string[]>([]);

  // 🔧 ESTADO PARA EDIÇÃO DE TRANSAÇÃO (usado pelo AddTransactionDialog)
  const [transacaoEditando, setTransacaoEditando] = useState<Transacao | null>(null);

  // Dialog states
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Comissao | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Comissao | null>(null);
  const [payTarget, setPayTarget] = useState<Comissao | null>(null);
  const [saving, setSaving] = useState(false);

  // 🔧 FORM DATA PARA COMISSÕES
  const [formData, setFormData] = useState({
    vendedor_id: "",
    vendedor_nome: "",
    valor_orcamento: "",
    percentual_comissao: "",
    valor_comissao: "",
    status: "pendente",
    data_pagamento: "",
    observacoes: "",
    orcamento_id: "",
  });

  // 🔧 CARREGAR DADOS (transações)
  const carregarTransacoes = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("transacoes_financeiras")
        .select("*")
        .order("data", { ascending: false })
        .limit(1000);
      if (error) throw error;
      setTransacoes(data || []);
    } catch (error: any) {
      toast({ title: "Erro ao carregar dados", description: error.message, variant: "destructive" });
    } finally { setLoading(false); }
  }, []);

  // 🔧 CARREGAR VENDEDORES
  const carregarVendedores = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("vendedores")
        .select("*")
        .eq("ativo", true)
        .order("nome", { ascending: true });

      if (error) throw error;
      setVendedores(data || []);
      const nomes = data?.map(v => v.nome).filter(Boolean) || [];
      setVendedoresList(nomes);
      return data || [];
    } catch (error: any) {
      console.error('❌ Erro ao carregar vendedores:', error);
      return [];
    }
  }, []);

  // 🔧 CARREGAR COMISSÕES
  const carregarComissoes = useCallback(async () => {
    try {
      setLoading(true);
      
      const { data: comissoesData, error: comissoesError } = await supabase
        .from("comissoes")
        .select("*")
        .order("created_at", { ascending: false });

      if (comissoesError) throw comissoesError;

      const vendedoresData = await carregarVendedores();
      const vendedoresMap = new Map();
      vendedoresData.forEach(v => vendedoresMap.set(v.id, v));

      const comissoesComVendedor = comissoesData?.map(comissao => {
        const vendedor = comissao.vendedor_id ? vendedoresMap.get(comissao.vendedor_id) : null;
        return {
          ...comissao,
          vendedor_nome: vendedor?.nome || comissao.vendedor_nome || "Vendedor não encontrado",
          vendedor_email: vendedor?.email || null,
        };
      }) || [];

      setComissoes(comissoesComVendedor);
      
    } catch (error: any) {
      console.error('❌ Erro ao carregar comissões:', error);
      toast({ 
        title: "Erro ao carregar comissões", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally { 
      setLoading(false); 
    }
  }, [carregarVendedores]);

  // Carregar dados baseado na página
  useEffect(() => {
    if (slug === "comissoes") {
      carregarComissoes();
    } else {
      carregarTransacoes();
    }
  }, [slug, carregarComissoes, carregarTransacoes]);

  // 🔧 FILTRAR COMISSÕES
  const comissoesFiltradas = useMemo(() => {
    if (!comissoes || comissoes.length === 0) return [];
    
    return comissoes.filter((c) => {
      if (statusFilter !== "todos" && c.status !== statusFilter) return false;
      if (vendedorFilter !== "todos" && c.vendedor_nome !== vendedorFilter) return false;
      if (dataInicio) {
        const data = c.created_at?.split("T")[0];
        if (data && data < dataInicio) return false;
      }
      if (dataFim) {
        const data = c.created_at?.split("T")[0];
        if (data && data > dataFim) return false;
      }
      if (searchTerm) {
        const s = searchTerm.toLowerCase();
        const vendedor = (c.vendedor_nome || "").toLowerCase();
        const orcamento = (c.orcamento_id || "").toLowerCase();
        if (!vendedor.includes(s) && !orcamento.includes(s)) return false;
      }
      return true;
    });
  }, [comissoes, statusFilter, vendedorFilter, dataInicio, dataFim, searchTerm]);

  // 🔧 AGRUPAR COMISSÕES POR VENDEDOR
  const comissoesPorVendedor = useMemo(() => {
    const map: Record<string, ComissaoVendedor> = {};
    
    comissoesFiltradas.forEach((c) => {
      const nome = c.vendedor_nome || "Vendedor não identificado";
      
      if (!map[nome]) {
        map[nome] = {
          vendedor_nome: nome,
          vendedor_id: c.vendedor_id,
          valor_total: 0,
          valor_recebido: 0,
          valor_pendente: 0,
          quantidade: 0,
          comissoes: []
        };
      }
      
      const valor = Number(c.valor_comissao || 0);
      map[nome].valor_total += valor;
      map[nome].quantidade++;
      
      if (c.status === "recebido" || c.status === "pago") {
        map[nome].valor_recebido += valor;
      } else if (c.status === "pendente") {
        map[nome].valor_pendente += valor;
      }
      
      map[nome].comissoes.push(c);
    });
    
    return Object.values(map).sort((a, b) => b.valor_total - a.valor_total);
  }, [comissoesFiltradas]);

  // 🔧 TOTAIS DE COMISSÃO
  const totalComissoes = comissoesPorVendedor.reduce((acc, v) => acc + v.valor_total, 0);
  const totalComissoesRecebidas = comissoesPorVendedor.reduce((acc, v) => acc + v.valor_recebido, 0);
  const totalComissoesPendentes = comissoesPorVendedor.reduce((acc, v) => acc + v.valor_pendente, 0);

  // 🔧 DADOS PARA OUTRAS PÁGINAS
  const filtradas = useMemo(() => {
    return transacoes
      .filter(config.filter)
      .filter((t) => {
        if (statusFilter !== "todos" && t.status !== statusFilter) return false;
        if (contaFilter !== "todas" && (t.conta_bancaria || "Sem conta") !== contaFilter) return false;
        if (dataInicio) { const d = t.data?.split("T")[0]; if (d && d < dataInicio) return false; }
        if (dataFim) { const d = t.data?.split("T")[0]; if (d && d > dataFim) return false; }
        if (searchTerm) {
          const s = searchTerm.toLowerCase();
          if (!t.descricao?.toLowerCase().includes(s) && !(t.categoria || "").toLowerCase().includes(s)) return false;
        }
        return true;
      });
  }, [transacoes, config, statusFilter, contaFilter, dataInicio, dataFim, searchTerm]);

  // 🔧 CRUD - COMISSÕES
  const openAddComissao = () => {
    setEditTarget(null);
    setFormData({
      vendedor_id: "",
      vendedor_nome: "",
      valor_orcamento: "",
      percentual_comissao: "",
      valor_comissao: "",
      status: "pendente",
      data_pagamento: "",
      observacoes: "",
      orcamento_id: "",
    });
    setAddOpen(true);
  };

  const openEditComissao = (c: Comissao) => {
    setEditTarget(c);
    setFormData({
      vendedor_id: c.vendedor_id || "",
      vendedor_nome: c.vendedor_nome || "",
      valor_orcamento: c.valor_orcamento?.toString() || "",
      percentual_comissao: c.percentual_comissao?.toString() || "",
      valor_comissao: c.valor_comissao?.toString() || "",
      status: c.status || "pendente",
      data_pagamento: c.data_pagamento?.split("T")[0] || "",
      observacoes: c.observacoes || "",
      orcamento_id: c.orcamento_id || "",
    });
    setAddOpen(true);
  };

  // 🔧 CALCULAR COMISSÃO AUTOMATICAMENTE
  const calcularComissao = (valorOrcamento: string, percentual: string) => {
    const v = parseFloat(valorOrcamento);
    const p = parseFloat(percentual);
    if (!isNaN(v) && !isNaN(p) && v > 0 && p > 0) {
      const resultado = (v * p) / 100;
      setFormData(prev => ({ ...prev, valor_comissao: resultado.toFixed(2) }));
    } else if (v > 0 && p === 0) {
      setFormData(prev => ({ ...prev, valor_comissao: "0" }));
    }
  };

  // 🔧 SALVAR COMISSÃO
  const handleSaveComissao = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const valorComissao = parseFloat(formData.valor_comissao);
    if (isNaN(valorComissao) || valorComissao <= 0) {
      toast({ 
        title: "Valor inválido", 
        description: "O valor da comissão deve ser maior que zero.", 
        variant: "destructive" 
      });
      return;
    }
    
    if (!formData.vendedor_id && !formData.vendedor_nome) {
      toast({ 
        title: "Campo obrigatório", 
        description: "Selecione um vendedor.", 
        variant: "destructive" 
      });
      return;
    }
    
    setSaving(true);
    try {
      let vendedorId = formData.vendedor_id;
      let vendedorNome = formData.vendedor_nome;
      
      if (formData.vendedor_id) {
        const vendedor = vendedores.find(v => v.id === formData.vendedor_id);
        if (vendedor) {
          vendedorNome = vendedor.nome;
        }
      }
      
      const dados = {
        vendedor_id: vendedorId || null,
        vendedor_nome: vendedorNome,
        valor_orcamento: parseFloat(formData.valor_orcamento) || 0,
        percentual_comissao: parseFloat(formData.percentual_comissao) || 0,
        valor_comissao: valorComissao,
        status: formData.status,
        data_pagamento: formData.data_pagamento || null,
        orcamento_id: formData.orcamento_id || null,
        observacoes: formData.observacoes || null,
        updated_at: new Date().toISOString(),
      };

      let result;
      if (editTarget) {
        result = await supabase
          .from("comissoes")
          .update(dados)
          .eq("id", editTarget.id);
        
        if (result.error) throw result.error;
        toast({ title: "✅ Comissão atualizada!" });
      } else {
        result = await supabase
          .from("comissoes")
          .insert({ 
            ...dados, 
            created_at: new Date().toISOString() 
          });
        
        if (result.error) throw result.error;
        toast({ title: "✅ Comissão registrada!" });
      }
      
      setAddOpen(false);
      setEditTarget(null);
      await carregarComissoes();
      
    } catch (error: any) {
      console.error('❌ Erro ao salvar:', error);
      toast({ 
        title: "Erro ao salvar", 
        description: error.message || "Não foi possível salvar a comissão", 
        variant: "destructive" 
      });
    } finally { 
      setSaving(false); 
    }
  };

  // 🔧 EXCLUIR COMISSÃO
  const handleDeleteComissao = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("comissoes")
        .delete()
        .eq("id", deleteTarget.id);
      
      if (error) throw error;
      
      toast({ title: "✅ Comissão excluída!" });
      setDeleteTarget(null);
      await carregarComissoes();
      
    } catch (error: any) {
      console.error('❌ Erro ao excluir:', error);
      toast({ 
        title: "Erro ao excluir", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally { 
      setSaving(false); 
    }
  };

  // 🔧 EXCLUIR TRANSAÇÃO
  const handleDeleteTransacao = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta transação?")) return;
    
    try {
      const { error } = await supabase
        .from("transacoes_financeiras")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
      
      toast({ title: "✅ Transação excluída!" });
      await carregarTransacoes();
      
    } catch (error: any) {
      console.error('❌ Erro ao excluir:', error);
      toast({ 
        title: "Erro ao excluir", 
        description: error.message, 
        variant: "destructive" 
      });
    }
  };

  // 🔧 MARCAR COMISSÃO COMO PAGO/RECEBIDO
  const handleQuickPay = async () => {
    if (!payTarget) return;
    setSaving(true);
    try {
      const newStatus = payTarget.status === "pendente" ? "pago" : "recebido";
      
      const updateData: any = {
        status: newStatus,
        updated_at: new Date().toISOString()
      };
      
      if (newStatus === "pago" || newStatus === "recebido") {
        updateData.data_pagamento = new Date().toISOString();
      }
      
      const { error } = await supabase
        .from("comissoes")
        .update(updateData)
        .eq("id", payTarget.id);
      
      if (error) throw error;
      
      toast({ 
        title: "✅ Status atualizado!", 
        description: `Comissão marcada como ${newStatus === "pago" ? "Paga" : "Recebida"}` 
      });
      setPayTarget(null);
      await carregarComissoes();
      
    } catch (error: any) {
      console.error('❌ Erro ao atualizar:', error);
      toast({ 
        title: "Erro ao atualizar", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally { 
      setSaving(false); 
    }
  };

  // 🔧 LIMPAR FILTROS
  const limparFiltros = () => {
    setSearchTerm("");
    setStatusFilter("todos");
    setVendedorFilter("todos");
    setDataInicio("");
    setDataFim("");
  };

  const contasDisponiveis = Array.from(new Set(transacoes.map((t) => t.conta_bancaria || "Sem conta")));

  // 🔧 RENDERIZAR TABELA DE COMISSÕES
  const renderComissoesTable = (rows: Comissao[]) => (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="font-bold">Vendedor</TableHead>
            <TableHead className="font-bold text-right">Valor Orçamento</TableHead>
            <TableHead className="font-bold text-center">% Comissão</TableHead>
            <TableHead className="font-bold text-right">Valor Comissão</TableHead>
            <TableHead className="font-bold">Data Criação</TableHead>
            <TableHead className="font-bold">Data Pagamento</TableHead>
            <TableHead className="font-bold text-center">Status</TableHead>
            <TableHead className="font-bold text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                {loading ? "Carregando..." : "Nenhuma comissão encontrada."}
              </TableCell>
            </TableRow>
          ) : rows.map((c) => (
            <TableRow key={c.id} className="hover:bg-muted/50">
              <TableCell className="font-medium flex items-center gap-2">
                <User className="h-4 w-4 text-blue-600" />
                {c.vendedor_nome || "Vendedor não identificado"}
              </TableCell>
              <TableCell className="text-right">{formatCurrency(c.valor_orcamento || 0)}</TableCell>
              <TableCell className="text-center">{c.percentual_comissao || 0}%</TableCell>
              <TableCell className="text-right font-bold text-primary">
                {formatCurrency(c.valor_comissao || 0)}
              </TableCell>
              <TableCell>{formatDate(c.created_at)}</TableCell>
              <TableCell>{formatDate(c.data_pagamento)}</TableCell>
              <TableCell className="text-center">{getStatusBadge(c.status)}</TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-1">
                  {c.status === "pendente" && (
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      className="h-8 w-8 p-0 text-green-600 hover:bg-green-50"
                      title="Marcar como Pago/Recebido"
                      onClick={() => setPayTarget(c)}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                  )}
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-8 w-8 p-0" 
                    title="Editar"
                    onClick={() => openEditComissao(c)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-8 w-8 p-0 text-red-600 hover:bg-red-50" 
                    title="Excluir"
                    onClick={() => setDeleteTarget(c)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  // 🔧 RENDERIZAR TABELA PARA TRANSAÇÕES
  const renderTransacoesTable = (rows: Transacao[], showConta = true) => (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader><TableRow>
          <TableHead className="font-bold">Descrição</TableHead>
          <TableHead className="font-bold">Categoria</TableHead>
          <TableHead className="font-bold text-right">Valor</TableHead>
          <TableHead className="font-bold">Data</TableHead>
          <TableHead className="font-bold">Vencimento</TableHead>
          <TableHead className="font-bold">Pagamento</TableHead>
          <TableHead className="font-bold">Forma</TableHead>
          {showConta && <TableHead className="font-bold">Conta</TableHead>}
          <TableHead className="font-bold text-center">Status</TableHead>
          <TableHead className="font-bold text-right">Ações</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow><TableCell colSpan={showConta ? 10 : 9} className="text-center py-8 text-muted-foreground">Nenhuma transação encontrada.</TableCell></TableRow>
          ) : rows.map((t) => (
            <TableRow key={t.id} className="hover:bg-muted/50">
              <TableCell className="font-medium">{t.descricao}</TableCell>
              <TableCell>{t.categoria || "-"}</TableCell>
              <TableCell className={`text-right font-bold ${t.tipo === "receita" ? "text-green-600" : "text-red-600"}`}>{formatCurrency(Number(t.valor))}</TableCell>
              <TableCell>{formatDate(t.data)}</TableCell>
              <TableCell>{formatDate(t.data_vencimento)}</TableCell>
              <TableCell>{formatDate(t.data_pagamento)}</TableCell>
              <TableCell className="capitalize">{t.forma_pagamento || "-"}</TableCell>
              {showConta && <TableCell>{t.conta_bancaria || "-"}</TableCell>}
              <TableCell className="text-center">{getStatusBadge(t.status)}</TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-1">
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-8 w-8 p-0" 
                    title="Editar"
                    onClick={() => setTransacaoEditando(t)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button 
                    size="sm" 
                    variant="ghost" 
                    className="h-8 w-8 p-0 text-red-600 hover:bg-red-50" 
                    title="Excluir"
                    onClick={() => handleDeleteTransacao(t.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  // 🔧 RENDERIZAÇÃO ESPECÍFICA PARA COMISSÕES
  if (slug === "comissoes") {
    return (
      <div className="container mx-auto p-4 sm:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-3">
              <Percent className="h-7 w-7 sm:h-8 sm:w-8 text-primary shrink-0" /> Comissões
            </h1>
            <p className="text-muted-foreground mt-1">Gerenciamento de comissões de vendedores</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => carregarComissoes()} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
            <Button className="bg-primary hover:bg-primary/90" onClick={openAddComissao}>
              <Plus className="mr-2 h-4 w-4" /> Nova Comissão
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-card to-blue-50/30 hover:shadow-xl transition-all duration-300">
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl" />
            <CardContent className="pt-6 relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Comissões</p>
                  <p className="text-2xl font-bold text-primary">{formatCurrency(totalComissoes)}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent shadow-lg">
                  <Percent className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-card to-green-50/30 hover:shadow-xl transition-all duration-300">
            <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/5 rounded-full blur-2xl" />
            <CardContent className="pt-6 relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Recebidas</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(totalComissoesRecebidas)}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-success shadow-lg">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-card to-yellow-50/30 hover:shadow-xl transition-all duration-300">
            <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-500/5 rounded-full blur-2xl" />
            <CardContent className="pt-6 relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pendentes</p>
                  <p className="text-2xl font-bold text-yellow-600">{formatCurrency(totalComissoesPendentes)}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-400 to-amber-500 shadow-lg">
                  <Wallet className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-card to-blue-50/30 hover:shadow-xl transition-all duration-300">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl" />
            <CardContent className="pt-6 relative z-10">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Vendedores</p>
                  <p className="text-2xl font-bold text-blue-600">{comissoesPorVendedor.length}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 shadow-lg">
                  <Users className="h-6 w-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Resumo por Vendedor */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" /> Resumo por Vendedor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {comissoesPorVendedor.map((vendedor) => (
                <Card 
                  key={vendedor.vendedor_nome} 
                  className="hover:shadow-md transition-shadow cursor-pointer" 
                  onClick={() => setVendedorFilter(vendedor.vendedor_nome)}
                >
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold text-lg flex items-center gap-2">
                          <User className="h-4 w-4 text-blue-600" />
                          {vendedor.vendedor_nome}
                        </p>
                        <p className="text-sm text-muted-foreground">{vendedor.quantidade} comissões</p>
                      </div>
                      <Badge 
                        variant={vendedor.valor_pendente > 0 ? "outline" : "secondary"} 
                        className={vendedor.valor_pendente > 0 ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"}
                      >
                        {vendedor.valor_pendente > 0 ? `${formatCurrency(vendedor.valor_pendente)} pendente` : 'Quitado'}
                      </Badge>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                      <div className="p-2 rounded bg-gray-50">
                        <p className="text-xs text-muted-foreground">Total</p>
                        <p className="font-bold text-primary">{formatCurrency(vendedor.valor_total)}</p>
                      </div>
                      <div className="p-2 rounded bg-green-50">
                        <p className="text-xs text-muted-foreground">Recebido</p>
                        <p className="font-bold text-green-600">{formatCurrency(vendedor.valor_recebido)}</p>
                      </div>
                      <div className="p-2 rounded bg-yellow-50">
                        <p className="text-xs text-muted-foreground">Pendente</p>
                        <p className="font-bold text-yellow-600">{formatCurrency(vendedor.valor_pendente)}</p>
                      </div>
                    </div>
                    {vendedor.valor_total > 0 && (
                      <div className="mt-2">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-green-600 h-2 rounded-full transition-all" 
                            style={{ width: `${(vendedor.valor_recebido / vendedor.valor_total) * 100}%` }} 
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 text-right">
                          {((vendedor.valor_recebido / vendedor.valor_total) * 100).toFixed(0)}% recebido
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
              {comissoesPorVendedor.length === 0 && (
                <div className="col-span-3 text-center py-8 text-muted-foreground">
                  {loading ? "Carregando comissões..." : "Nenhuma comissão registrada."}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Tabela de Comissões */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            {/* Filtros */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Buscar vendedor ou orçamento..." 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                  className="pl-10" 
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="pago">Pago</SelectItem>
                  <SelectItem value="recebido">Recebido</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
              <Select value={vendedorFilter} onValueChange={setVendedorFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Vendedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os vendedores</SelectItem>
                  {vendedoresList.map((v) => (
                    <SelectItem key={v} value={v}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input 
                type="date" 
                value={dataInicio} 
                onChange={(e) => setDataInicio(e.target.value)} 
                className="w-[150px]" 
                placeholder="Data início"
              />
              <Input 
                type="date" 
                value={dataFim} 
                onChange={(e) => setDataFim(e.target.value)} 
                className="w-[150px]" 
                placeholder="Data fim"
              />
              <Button variant="ghost" size="sm" onClick={limparFiltros}>
                <X className="h-4 w-4" /> Limpar
              </Button>
            </div>

            {/* Tabela */}
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                <p className="mt-4 text-muted-foreground">Carregando comissões...</p>
              </div>
            ) : (
              renderComissoesTable(comissoesFiltradas)
            )}
          </CardContent>
        </Card>

        {/* Dialog: Adicionar/Editar Comissão */}
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editTarget ? "Editar Comissão" : "Nova Comissão"}</DialogTitle>
              <DialogDescription>
                {editTarget ? "Altere os dados da comissão." : "Registre uma nova comissão de vendedor."}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSaveComissao} className="space-y-4">
              {/* Vendedor */}
              <div className="space-y-2">
                <Label htmlFor="vendedor">Vendedor *</Label>
                <Select 
                  value={formData.vendedor_id} 
                  onValueChange={(v) => {
                    const vendedor = vendedores.find(vend => vend.id === v);
                    setFormData({ 
                      ...formData, 
                      vendedor_id: v,
                      vendedor_nome: vendedor?.nome || "",
                      percentual_comissao: vendedor?.comissao_percentual?.toString() || formData.percentual_comissao
                    });
                    if (formData.valor_orcamento) {
                      calcularComissao(
                        formData.valor_orcamento, 
                        vendedor?.comissao_percentual?.toString() || formData.percentual_comissao
                      );
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o vendedor" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendedores.length === 0 ? (
                      <SelectItem value="" disabled>Nenhum vendedor encontrado</SelectItem>
                    ) : (
                      vendedores.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.nome} {v.comissao_percentual ? `(${v.comissao_percentual}%)` : ''}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {formData.vendedor_nome && (
                  <p className="text-xs text-muted-foreground">
                    Vendedor selecionado: {formData.vendedor_nome}
                  </p>
                )}
              </div>

              {/* Valor Orçamento e Percentual */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="valor_orcamento">Valor do Orçamento *</Label>
                  <Input 
                    id="valor_orcamento"
                    type="number" 
                    step="0.01"
                    required 
                    value={formData.valor_orcamento} 
                    onChange={(e) => {
                      setFormData({ ...formData, valor_orcamento: e.target.value });
                      calcularComissao(e.target.value, formData.percentual_comissao);
                    }}
                    placeholder="0,00" 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="percentual">Percentual de Comissão (%) *</Label>
                  <Input 
                    id="percentual"
                    type="number" 
                    step="0.1"
                    required 
                    value={formData.percentual_comissao} 
                    onChange={(e) => {
                      setFormData({ ...formData, percentual_comissao: e.target.value });
                      calcularComissao(formData.valor_orcamento, e.target.value);
                    }}
                    placeholder="Ex: 5" 
                  />
                </div>
              </div>

              {/* Valor da Comissão */}
              <div className="space-y-2">
                <Label htmlFor="valor_comissao">Valor da Comissão *</Label>
                <Input 
                  id="valor_comissao"
                  type="number" 
                  step="0.01"
                  required 
                  value={formData.valor_comissao} 
                  onChange={(e) => setFormData({ ...formData, valor_comissao: e.target.value })}
                  placeholder="Calculado automaticamente" 
                  className="bg-gray-50"
                />
                <p className="text-xs text-muted-foreground">
                  Calculado: {formData.valor_orcamento || '0'} × {formData.percentual_comissao || '0'}% = {formData.valor_comissao || '0'}
                </p>
              </div>

              {/* Status e Data */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select 
                    value={formData.status} 
                    onValueChange={(v) => setFormData({ ...formData, status: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pendente">Pendente</SelectItem>
                      <SelectItem value="pago">Pago</SelectItem>
                      <SelectItem value="recebido">Recebido</SelectItem>
                      <SelectItem value="cancelado">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="data_pagamento">Data de Pagamento</Label>
                  <Input 
                    id="data_pagamento"
                    type="date" 
                    value={formData.data_pagamento} 
                    onChange={(e) => setFormData({ ...formData, data_pagamento: e.target.value })}
                  />
                </div>
              </div>

              {/* Orçamento ID */}
              <div className="space-y-2">
                <Label htmlFor="orcamento_id">ID do Orçamento</Label>
                <Input 
                  id="orcamento_id"
                  value={formData.orcamento_id} 
                  onChange={(e) => setFormData({ ...formData, orcamento_id: e.target.value })}
                  placeholder="Opcional" 
                />
              </div>

              {/* Observações */}
              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea 
                  id="observacoes"
                  value={formData.observacoes} 
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Observações sobre a comissão..."
                  rows={2}
                />
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? "Salvando..." : editTarget ? "Atualizar" : "Salvar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Dialog: Confirmar Pagamento */}
        <AlertDialog open={!!payTarget} onOpenChange={(v) => !v && setPayTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Marcar como Pago/Recebido</AlertDialogTitle>
              <AlertDialogDescription>
                Confirmar a comissão de <strong>{payTarget?.vendedor_nome}</strong> 
                no valor de {formatCurrency(Number(payTarget?.valor_comissao || 0))}?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleQuickPay} disabled={saving}>
                Confirmar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Dialog: Confirmar Exclusão */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Comissão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir a comissão de <strong>{deleteTarget?.vendedor_nome}</strong>?
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteComissao} disabled={saving} className="bg-red-600 hover:bg-red-700">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  // 🔧 RENDERIZAÇÃO PARA OUTRAS PÁGINAS
  const totalEntradas = filtradas.filter((t) => t.tipo === "receita" && t.status === "recebido").reduce((a, t) => a + Number(t.valor), 0);
  const totalSaidas = filtradas.filter((t) => t.tipo === "despesa" && t.status === "pago").reduce((a, t) => a + Number(t.valor), 0);
  const totalPendente = filtradas.filter((t) => t.status === "pendente").reduce((a, t) => a + Number(t.valor), 0);
  const saldo = totalEntradas - totalSaidas;

  const porConta = useMemo(() => {
    const map: Record<string, { entradas: number; saidas: number; transacoes: Transacao[] }> = {};
    filtradas.forEach((t) => {
      const c = t.conta_bancaria || "Sem conta";
      if (!map[c]) map[c] = { entradas: 0, saidas: 0, transacoes: [] };
      if (t.tipo === "receita" && t.status === "recebido") map[c].entradas += Number(t.valor);
      if (t.tipo === "despesa" && t.status === "pago") map[c].saidas += Number(t.valor);
      map[c].transacoes.push(t);
    });
    return map;
  }, [filtradas]);

  const porCategoria = useMemo(() => {
    const map: Record<string, { entradas: number; saidas: number; count: number }> = {};
    filtradas.forEach((t) => {
      const cat = t.categoria || "Sem categoria";
      if (!map[cat]) map[cat] = { entradas: 0, saidas: 0, count: 0 };
      if (t.tipo === "receita") map[cat].entradas += Number(t.valor);
      else map[cat].saidas += Number(t.valor);
      map[cat].count++;
    });
    return map;
  }, [filtradas]);

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-3">
            <Icon className="h-7 w-7 sm:h-8 sm:w-8 text-primary" /> {config.title}
          </h1>
          <p className="text-muted-foreground mt-1">{config.description}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={carregarTransacoes} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          {config.showAdd && (
            <AddTransactionDialog 
              onTransactionAdded={carregarTransacoes}
              transactionToEdit={transacaoEditando}
              onEditComplete={() => setTransacaoEditando(null)}
            />
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-card to-green-50/30 hover:shadow-xl transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/5 rounded-full blur-2xl" />
          <CardContent className="pt-6 relative z-10">
            <div className="flex items-center justify-between">
              <div><p className="text-sm font-medium text-muted-foreground">Entradas</p><p className="text-2xl font-bold text-green-600">{formatCurrency(totalEntradas)}</p></div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-success shadow-lg"><TrendingUp className="h-6 w-6 text-white" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-card to-red-50/30 hover:shadow-xl transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full blur-2xl" />
          <CardContent className="pt-6 relative z-10">
            <div className="flex items-center justify-between">
              <div><p className="text-sm font-medium text-muted-foreground">Saídas</p><p className="text-2xl font-bold text-red-600">{formatCurrency(totalSaidas)}</p></div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-rose-600 shadow-lg"><TrendingDown className="h-6 w-6 text-white" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-card to-yellow-50/30 hover:shadow-xl transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-500/5 rounded-full blur-2xl" />
          <CardContent className="pt-6 relative z-10">
            <div className="flex items-center justify-between">
              <div><p className="text-sm font-medium text-muted-foreground">Pendente</p><p className="text-2xl font-bold text-yellow-600">{formatCurrency(totalPendente)}</p></div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-400 to-amber-500 shadow-lg"><Wallet className="h-6 w-6 text-white" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-card to-blue-50/30 hover:shadow-xl transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl" />
          <CardContent className="pt-6 relative z-10">
            <div className="flex items-center justify-between">
              <div><p className="text-sm font-medium text-muted-foreground">Saldo</p><p className={`text-2xl font-bold ${saldo >= 0 ? "text-primary" : "text-red-600"}`}>{formatCurrency(saldo)}</p></div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent shadow-lg"><DollarSign className="h-6 w-6 text-white" /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Caixas e Bancos */}
      {slug === "caixas-bancos" && (
        <div className="space-y-4">
          {Object.entries(porConta).map(([conta, dados]) => (
            <Card key={conta}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Landmark className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{conta}</CardTitle>
                  </div>
                  <div className="flex gap-4 text-sm">
                    <span><span className="text-muted-foreground">Entradas:</span> <span className="font-bold text-green-600">{formatCurrency(dados.entradas)}</span></span>
                    <span><span className="text-muted-foreground">Saídas:</span> <span className="font-bold text-red-600">{formatCurrency(dados.saidas)}</span></span>
                    <span><span className="text-muted-foreground">Saldo:</span> <span className={`font-bold ${dados.entradas - dados.saidas >= 0 ? "text-primary" : "text-red-600"}`}>{formatCurrency(dados.entradas - dados.saidas)}</span></span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {renderTransacoesTable(dados.transacoes, false)}
              </CardContent>
            </Card>
          ))}
          {Object.keys(porConta).length === 0 && (
            <Card><CardContent className="pt-6 text-center text-muted-foreground py-8">Nenhuma transação encontrada.</CardContent></Card>
          )}
        </div>
      )}

      {/* Faturamento Agrupado */}
      {slug === "faturamento-agrupado" && (
        <Card><CardContent className="pt-6">
          <h3 className="text-lg font-bold mb-4">Faturamento por Categoria</h3>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="font-bold">Categoria</TableHead>
                <TableHead className="font-bold text-right">Transações</TableHead>
                <TableHead className="font-bold text-right">Entradas</TableHead>
                <TableHead className="font-bold text-right">Saídas</TableHead>
                <TableHead className="font-bold text-right">Saldo</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {Object.entries(porCategoria).length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum dado encontrado.</TableCell></TableRow>
                ) : Object.entries(porCategoria).map(([cat, d]) => (
                  <TableRow key={cat} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{cat}</TableCell>
                    <TableCell className="text-right">{d.count}</TableCell>
                    <TableCell className="text-right text-green-600 font-medium">{formatCurrency(d.entradas)}</TableCell>
                    <TableCell className="text-right text-red-600 font-medium">{formatCurrency(d.saidas)}</TableCell>
                    <TableCell className={`text-right font-bold ${d.entradas - d.saidas >= 0 ? "text-primary" : "text-red-600"}`}>{formatCurrency(d.entradas - d.saidas)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent></Card>
      )}

      {/* Relatórios Financeiros */}
      {slug === "relatorios" && (
        <div className="space-y-4">
          <Card><CardContent className="pt-6">
            <h3 className="text-lg font-bold mb-4">Resumo por Forma de Pagamento</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Array.from(new Set(filtradas.map((t) => t.forma_pagamento || "Não definido"))).map((forma) => {
                const items = filtradas.filter((t) => (t.forma_pagamento || "Não definido") === forma);
                const total = items.reduce((a, t) => a + Number(t.valor), 0);
                return (
                  <div key={forma} className="p-4 rounded-lg border bg-muted/30">
                    <p className="text-sm font-medium text-muted-foreground capitalize">{forma}</p>
                    <p className="text-xl font-bold text-primary">{formatCurrency(total)}</p>
                    <p className="text-xs text-muted-foreground">{items.length} transação(ões)</p>
                  </div>
                );
              })}
            </div>
          </CardContent></Card>
          <Card><CardContent className="pt-6">
            <h3 className="text-lg font-bold mb-4">Resumo por Status</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {["pendente", "pago", "recebido", "cancelado"].map((status) => {
                const items = filtradas.filter((t) => t.status === status);
                const total = items.reduce((a, t) => a + Number(t.valor), 0);
                return (
                  <div key={status} className="p-4 rounded-lg border bg-muted/30">
                    <p className="text-sm font-medium text-muted-foreground capitalize">{status}</p>
                    <p className="text-xl font-bold text-primary">{formatCurrency(total)}</p>
                    <p className="text-xs text-muted-foreground">{items.length} transação(ões)</p>
                  </div>
                );
              })}
            </div>
          </CardContent></Card>
          <Card><CardContent className="pt-6">
            <h3 className="text-lg font-bold mb-4">Resumo por Conta Bancária</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Object.entries(porConta).map(([conta, d]) => (
                <div key={conta} className="p-4 rounded-lg border bg-muted/30">
                  <p className="text-sm font-medium text-muted-foreground">{conta}</p>
                  <p className="text-xl font-bold text-primary">{formatCurrency(d.entradas - d.saidas)}</p>
                  <p className="text-xs text-muted-foreground">{d.transacoes.length} transação(ões)</p>
                </div>
              ))}
            </div>
          </CardContent></Card>
        </div>
      )}

      {/* Default table view */}
      {slug !== "caixas-bancos" && slug !== "faturamento-agrupado" && slug !== "relatorios" && slug !== "comissoes" && (
        <Card><CardContent className="pt-6 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="pendente">Pendente</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="recebido">Recebido</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={contaFilter} onValueChange={setContaFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Conta" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as contas</SelectItem>
                {contasDisponiveis.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="w-[150px]" />
            <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-[150px]" />
            <Button variant="ghost" size="sm" onClick={limparFiltros}><X className="h-4 w-4" /> Limpar</Button>
          </div>

          {loading ? (
            <div className="text-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div><p className="mt-4 text-muted-foreground">Carregando...</p></div>
          ) : renderTransacoesTable(filtradas)}
        </CardContent></Card>
      )}
    </div>
  );
}