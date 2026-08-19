"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Download, Eye, FileText, ChevronDown, CircleAlert as AlertCircle, Trash2, Loader as Loader2, DollarSign, Calculator, X, Zap, UserCheck, TrendingUp, CreditCard as Edit, CreditCard, History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { gerarPDFOrcamento, downloadPDF } from "@/utils/pdfGenerator";
import AddClienteInlineDialog from "@/components/clientes/AddClienteInlineDialog";
import {
  MATRIZ_SENTINEL,
  verificarEstoqueSuficiente,
  baixarEstoqueOrcamento,
  voltarEstoqueOrcamento,
} from "@/lib/orcamentoEstoque";
import { logActivity } from "@/lib/auditLog";

// ========== INTERFACES ==========
interface Orcamento {
  id: string;
  numero: string;
  created_at: string;
  cliente_id: string;
  valor_total: number;
  status: string;
  observacoes: string | null;
  forma_pagamento?: string;
  condicao_pagamento?: string;
  entrada_percentual?: number;
  entrada_valor?: number;
  parcelas?: number;
  valor_parcela?: number;
  parcelado?: boolean;
  numero_parcelas?: number;
  vendedor_id?: string | null;
  pagamento_misto?: boolean;
  valor_credito_utilizado?: number;
  forma_pagamento_restante?: string;
  condicao_pagamento_restante?: string;
  parcelas_restante?: number;
  filial_id?: string | null;
}

interface Cliente {
  id: string;
  nome: string;
  cpf_cnpj: string;
  email?: string;
  telefone?: string;
  limite_credito: number;
}

interface Vendedor {
  id: string;
  user_id: string;
  nome: string;
  email: string;
  comissao_percentual: number;
  telefone: string | null;
  ativo: boolean;
  created_at: string;
}

interface Filial {
  id: string;
  nome: string;
  codigo?: string;
}

interface Comissao {
  id: string;
  orcamento_id: string;
  vendedor_id: string;
  valor_orcamento: number;
  percentual_comissao: number;
  valor_comissao: number;
  status: 'pendente' | 'pago' | 'cancelado';
  data_pagamento?: string;
  created_at: string;
}

interface Produto {
  id: string;
  codigo: string;
  nome: string;
  descricao: string;
  cor: string | null;
  preco: number;
  peso: number | null;
  estoque: number;
  localizacao: string | null;
  categoria: string | null;
  peso_kg_m?: number;
  comprimento_barra?: number;
  ativo?: boolean;
}

interface Kit {
  id: string;
  codigo: string;
  nome: string;
  preco_total: number;
  descricao: string | null;
  estoque_disponivel?: number;
  ativo?: boolean;
}

interface ItemOrcamento {
  id: string;
  produto_id?: string;
  kit_id?: string;
  codigo: string;
  nome: string;
  descricao: string;
  localizacao: string;
  quantidade: number;
  preco_unitario: number;
  peso: number | null;
  desconto: number;
  tipo: 'produto' | 'kit';
  estoque_disponivel?: number;
  categoria?: string | null;
  cor?: string | null;
  preco_por_kg_calculado?: number;
}

interface OrcamentoWithRelations extends Orcamento {
  clientes: Cliente | null;
  vendedor: Vendedor | null;
  comissoes: Comissao[];
}

interface OrcamentoComItens extends OrcamentoWithRelations {
  orcamento_itens: Array<{
    id: string;
    produto_id?: string;
    kit_id?: string;
    quantidade: number;
    preco_unitario: number;
    desconto: number;
    peso: number | null;
    subtotal: number;
    produto?: Produto;
    kit?: Kit;
  }>;
}

interface PagamentoMisto {
  usarCredito: boolean;
  valorCredito: number;
  formaPagamentoRestante: string;
  condicaoPagamentoRestante?: string;
  parcelasRestante?: number;
}

// ========== FUNÇÕES AUXILIARES ==========
const getStatusLabel = (status: string) => {
  const statusMap: Record<string, string> = {
    'pendente': 'Pendente',
    'aprovado': 'Aprovado',
    'recusado': 'Recusado',
    'rejeitado': 'Rejeitado',
    'cancelado': 'Cancelado',
  };
  return statusMap[status] || status;
};

const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    'pendente': 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
    'aprovado': 'bg-green-100 text-green-800 hover:bg-green-100',
    'recusado': 'bg-red-100 text-red-800 hover:bg-red-100',
    'rejeitado': 'bg-red-100 text-red-800 hover:bg-red-100',
    'cancelado': 'bg-gray-100 text-gray-800 hover:bg-gray-100',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
};

const getFormaPagamentoLabel = (forma: string) => {
  const formas: Record<string, string> = {
    'avista': 'À Vista',
    'boleto': 'Boleto',
    'credito': 'Cartão de Crédito',
    'debito': 'Cartão de Débito',
    'credito_cliente': 'Cliente com Crédito',
  };
  return formas[forma] || forma;
};

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('pt-BR');
};

const getDescricaoCondicao = (condicao: string): string => {
  const descricoes: Record<string, string> = {
    "28": "1 parcela em 28 dias",
    "28/56": "1ª parcela em 28 dias, 2ª parcela em 56 dias",
    "0/28/56": "1ª parcela à vista, 2ª em 28 dias, 3ª em 56 dias",
    "15": "1 parcela em 15 dias",
    "15/30": "1ª parcela em 15 dias, 2ª parcela em 30 dias",
    "0/15/30": "1ª parcela à vista, 2ª em 15 dias, 3ª em 30 dias",
  };
  return descricoes[condicao] || condicao;
};

// ========== FUNÇÃO PARA CRIAR TRANSAÇÕES FINANCEIRAS ==========
const criarTransacoesFinanceiras = async (
  orcamento: Orcamento, 
  clienteNome?: string,
  pagamentoMisto?: PagamentoMisto
) => {
  try {
    console.log('💰 ===== CRIANDO TRANSAÇÕES FINANCEIRAS =====');
    console.log('📄 Orçamento:', orcamento.numero);
    console.log('💵 Valor Total:', orcamento.valor_total);
    console.log('💰 Pagamento Misto:', pagamentoMisto || 'Não');
    
    const transacoes = [];
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    
    if (pagamentoMisto) {
      console.log('💰 Processando pagamento misto...');
      console.log('💳 Valor do crédito:', pagamentoMisto.valorCredito);
      console.log('💵 Forma restante:', pagamentoMisto.formaPagamentoRestante);
      
      const valorRestante = orcamento.valor_total - pagamentoMisto.valorCredito;
      
      transacoes.push({
        descricao: `Crédito utilizado - Orçamento ${orcamento.numero} - ${clienteNome || 'Cliente'}`,
        tipo: 'receita',
        valor: Number(pagamentoMisto.valorCredito.toFixed(2)),
        data: hoje.toISOString().split('T')[0],
        data_vencimento: hoje.toISOString().split('T')[0],
        status: 'pendente',
        forma_pagamento: 'credito_cliente',
        origem_tipo: 'credito_utilizado',
        orcamento_id: orcamento.id,
        parcela_numero: 1,
        total_parcelas: 1,
        numero_parcela: '1/1',
        categoria: 'Crédito de Cliente',
        observacoes: `Cliente utilizou R$ ${pagamentoMisto.valorCredito.toFixed(2)} do limite de crédito`
      });
      
      if (valorRestante > 0) {
        if (pagamentoMisto.formaPagamentoRestante === 'avista' || !pagamentoMisto.parcelasRestante || pagamentoMisto.parcelasRestante <= 1) {
          transacoes.push({
            descricao: `Restante do pagamento - Orçamento ${orcamento.numero} - ${clienteNome || 'Cliente'}`,
            tipo: 'receita',
            valor: Number(valorRestante.toFixed(2)),
            data: hoje.toISOString().split('T')[0],
            data_vencimento: hoje.toISOString().split('T')[0],
            status: 'pendente',
            forma_pagamento: pagamentoMisto.formaPagamentoRestante,
            origem_tipo: 'orcamento_misto_avista',
            orcamento_id: orcamento.id,
            parcela_numero: 1,
            total_parcelas: 1,
            numero_parcela: '1/1',
            categoria: pagamentoMisto.formaPagamentoRestante === 'credito' ? 'Cartão de Crédito' : 
                       pagamentoMisto.formaPagamentoRestante === 'debito' ? 'Cartão de Débito' :
                       pagamentoMisto.formaPagamentoRestante === 'boleto' ? 'Boleto' : 'À Vista',
            observacoes: `Valor restante do pagamento misto - Orçamento ${orcamento.numero} (Total: R$ ${orcamento.valor_total.toFixed(2)} - Crédito: R$ ${pagamentoMisto.valorCredito.toFixed(2)})`
          });
        } else {
          const diasParaVencimento: Record<string, number[]> = {
            '28': [28],
            '28/56': [28, 56],
            '0/28/56': [0, 28, 56],
            '15': [15],
            '15/30': [15, 30],
            '0/15/30': [0, 15, 30],
          };

          let diasVencimentos: number[] = [];
          
          if (pagamentoMisto.condicaoPagamentoRestante && diasParaVencimento[pagamentoMisto.condicaoPagamentoRestante]) {
            diasVencimentos = diasParaVencimento[pagamentoMisto.condicaoPagamentoRestante];
          } else {
            diasVencimentos = Array.from(
              { length: pagamentoMisto.parcelasRestante || 1 }, 
              (_, i) => (i + 1) * 30
            );
          }

          const valorPorParcela = Number((valorRestante / (diasVencimentos.length || 1)).toFixed(2));
          
          for (let i = 0; i < diasVencimentos.length; i++) {
            const vencimento = new Date();
            vencimento.setDate(vencimento.getDate() + diasVencimentos[i]);
            vencimento.setHours(0, 0, 0, 0);
            
            let valorParcelaAtual = valorPorParcela;
            
            if (i === diasVencimentos.length - 1) {
              const somaParcelasAnteriores = valorPorParcela * i;
              valorParcelaAtual = Number((valorRestante - somaParcelasAnteriores).toFixed(2));
            }
            
            transacoes.push({
              descricao: `Restante do pagamento - Orçamento ${orcamento.numero} - PARCELA ${i+1}/${pagamentoMisto.parcelasRestante}`,
              tipo: 'receita',
              valor: Number(valorParcelaAtual.toFixed(2)),
              data: hoje.toISOString().split('T')[0],
              data_vencimento: vencimento.toISOString().split('T')[0],
              status: 'pendente',
              forma_pagamento: pagamentoMisto.formaPagamentoRestante,
              origem_tipo: 'orcamento_misto_parcelado',
              orcamento_id: orcamento.id,
              parcela_numero: i + 1,
              total_parcelas: pagamentoMisto.parcelasRestante || diasVencimentos.length,
              numero_parcela: `${i+1}/${pagamentoMisto.parcelasRestante || diasVencimentos.length}`,
              categoria: pagamentoMisto.formaPagamentoRestante === 'credito' ? 'Cartão de Crédito' : 
                       pagamentoMisto.formaPagamentoRestante === 'debito' ? 'Cartão de Débito' :
                       pagamentoMisto.formaPagamentoRestante === 'boleto' ? 'Boleto' : 'Parcelado',
              observacoes: `Parcela ${i+1}/${pagamentoMisto.parcelasRestante} do restante - Orçamento ${orcamento.numero} (Total: R$ ${orcamento.valor_total.toFixed(2)} - Crédito: R$ ${pagamentoMisto.valorCredito.toFixed(2)})`
            });
          }
        }
      }
      
    } else if (!orcamento.parcelado || orcamento.forma_pagamento === 'avista') {
      transacoes.push({
        descricao: `Orçamento ${orcamento.numero} - ${clienteNome || 'Cliente'}`,
        tipo: 'receita',
        valor: Number(orcamento.valor_total.toFixed(2)),
        data: hoje.toISOString().split('T')[0],
        data_vencimento: hoje.toISOString().split('T')[0],
        status: 'pendente',
        forma_pagamento: orcamento.forma_pagamento || 'avista',
        origem_tipo: 'orcamento_avista',
        orcamento_id: orcamento.id,
        parcela_numero: 1,
        total_parcelas: 1,
        numero_parcela: '1/1',
        categoria: orcamento.forma_pagamento === 'avista' ? 'À Vista' : 
                   orcamento.forma_pagamento === 'boleto' ? 'Boleto' :
                   orcamento.forma_pagamento === 'credito' ? 'Cartão de Crédito' :
                   orcamento.forma_pagamento === 'debito' ? 'Cartão de Débito' : 'Outros',
        observacoes: `Pagamento à vista - Orçamento ${orcamento.numero}`
      });
      
    } else {
      let diasVencimentos: number[] = [];
      const diasParaVencimento: Record<string, number[]> = {
        '28': [28],
        '28/56': [28, 56],
        '0/28/56': [0, 28, 56],
        '15': [15],
        '15/30': [15, 30],
        '0/15/30': [0, 15, 30],
      };
      
      if (orcamento.condicao_pagamento && diasParaVencimento[orcamento.condicao_pagamento]) {
        diasVencimentos = diasParaVencimento[orcamento.condicao_pagamento];
      } else {
        diasVencimentos = Array.from(
          { length: orcamento.parcelas || 1 }, 
          (_, i) => (i + 1) * 30
        );
      }
      
      if (orcamento.entrada_valor && orcamento.entrada_valor > 0) {
        const temVencimentoZero = diasVencimentos[0] === 0;
        
        transacoes.push({
          descricao: `Orçamento ${orcamento.numero} - ENTRADA - ${clienteNome || 'Cliente'}`,
          tipo: 'receita',
          valor: Number(orcamento.entrada_valor.toFixed(2)),
          data: hoje.toISOString().split('T')[0],
          data_vencimento: hoje.toISOString().split('T')[0],
          status: 'pendente',
          forma_pagamento: orcamento.forma_pagamento || '',
          origem_tipo: 'orcamento_parcelado',
          orcamento_id: orcamento.id,
          parcela_numero: 1,
          total_parcelas: orcamento.parcelas || 1,
          numero_parcela: `1/${orcamento.parcelas}`,
          categoria: 'Entrada',
          observacoes: `ENTRADA - R$ ${orcamento.entrada_valor.toFixed(2)} - ${orcamento.condicao_pagamento || ''}`
        });

        const diasParcelas = temVencimentoZero 
          ? diasVencimentos.slice(1)
          : diasVencimentos;
        
        const totalParcelasFuturas = diasParcelas.length;
        const valorRestante = orcamento.valor_total - (orcamento.entrada_valor || 0);
        let valorBaseParcela = Number((valorRestante / totalParcelasFuturas).toFixed(2));
        
        for (let i = 0; i < diasParcelas.length; i++) {
          const vencimento = new Date();
          vencimento.setDate(vencimento.getDate() + diasParcelas[i]);
          vencimento.setHours(0, 0, 0, 0);
          
          const numeroParcela = i + 2;
          const totalParcelas = orcamento.parcelas || (diasParcelas.length + 1);
          
          let valorParcelaAtual = valorBaseParcela;
          
          if (i === diasParcelas.length - 1) {
            const somaParcelasAnteriores = valorBaseParcela * i;
            valorParcelaAtual = Number((valorRestante - somaParcelasAnteriores).toFixed(2));
          }
          
          transacoes.push({
            descricao: `Orçamento ${orcamento.numero} - PARCELA ${numeroParcela}/${totalParcelas} - ${clienteNome || 'Cliente'}`,
            tipo: 'receita',
            valor: Number(valorParcelaAtual.toFixed(2)),
            data: hoje.toISOString().split('T')[0],
            data_vencimento: vencimento.toISOString().split('T')[0],
            status: 'pendente',
            forma_pagamento: orcamento.forma_pagamento || '',
            origem_tipo: 'orcamento_parcelado',
            orcamento_id: orcamento.id,
            parcela_numero: numeroParcela,
            total_parcelas: totalParcelas,
            numero_parcela: `${numeroParcela}/${totalParcelas}`,
            categoria: 'Parcelado',
            observacoes: `Parcela ${numeroParcela}/${totalParcelas} - R$ ${valorParcelaAtual.toFixed(2)} - ${orcamento.condicao_pagamento || ''}`
          });
        }
      } else {
        const valorPorParcela = orcamento.valor_parcela || 
          Number((orcamento.valor_total / (diasVencimentos.length || 1)).toFixed(2));
        
        for (let i = 0; i < diasVencimentos.length; i++) {
          const vencimento = new Date();
          vencimento.setDate(vencimento.getDate() + diasVencimentos[i]);
          vencimento.setHours(0, 0, 0, 0);
          
          let valorParcelaAtual = valorPorParcela;
          
          if (i === diasVencimentos.length - 1) {
            const somaParcelasAnteriores = valorPorParcela * i;
            valorParcelaAtual = Number((orcamento.valor_total - somaParcelasAnteriores).toFixed(2));
          }
          
          transacoes.push({
            descricao: `Orçamento ${orcamento.numero} - PARCELA ${i+1}/${orcamento.parcelas} - ${clienteNome || 'Cliente'}`,
            tipo: 'receita',
            valor: Number(valorParcelaAtual.toFixed(2)),
            data: hoje.toISOString().split('T')[0],
            data_vencimento: vencimento.toISOString().split('T')[0],
            status: 'pendente',
            forma_pagamento: orcamento.forma_pagamento || '',
            origem_tipo: 'orcamento_parcelado',
            orcamento_id: orcamento.id,
            parcela_numero: i + 1,
            total_parcelas: orcamento.parcelas || diasVencimentos.length,
            numero_parcela: `${i+1}/${orcamento.parcelas || diasVencimentos.length}`,
            categoria: 'Parcelado',
            observacoes: `Parcela ${i+1}/${orcamento.parcelas || diasVencimentos.length} - R$ ${valorParcelaAtual.toFixed(2)} - ${orcamento.condicao_pagamento || ''}`
          });
        }
      }
      
      const somaTransacoes = transacoes.reduce((sum, t) => sum + t.valor, 0);
      const diferenca = Number((orcamento.valor_total - somaTransacoes).toFixed(2));
      
      if (Math.abs(diferenca) > 0.01 && transacoes.length > 0) {
        transacoes[transacoes.length - 1].valor = Number(
          (transacoes[transacoes.length - 1].valor + diferenca).toFixed(2)
        );
      }
    }

    if (transacoes.length > 0) {
      await supabase
        .from('transacoes_financeiras')
        .delete()
        .eq('orcamento_id', orcamento.id);

      const { error } = await supabase
        .from('transacoes_financeiras')
        .insert(transacoes);

      if (error) throw error;
      
      let mensagem = `${transacoes.length} parcela(s) gerada(s)`;
      if (pagamentoMisto) {
        mensagem += `: R$ ${pagamentoMisto.valorCredito.toFixed(2)} (Crédito) + R$ ${(orcamento.valor_total - pagamentoMisto.valorCredito).toFixed(2)} (${pagamentoMisto.formaPagamentoRestante})`;
      }
      
      toast({
        title: "💰 Transações financeiras criadas",
        description: mensagem,
      });
    }
    
    return transacoes;
    
  } catch (error: any) {
    console.error('❌ Erro ao criar transações:', error);
    throw error;
  }
};

// ========== FUNÇÃO PARA CRIAR COMISSÃO DO VENDEDOR ==========
const criarComissaoVendedor = async (orcamento: Orcamento, vendedor: Vendedor) => {
  try {
    console.log('💰 ===== CRIANDO COMISSÃO DO VENDEDOR =====');
    console.log('👤 Vendedor:', vendedor.nome);
    console.log('📄 Orçamento:', orcamento.numero);
    console.log('💵 Valor Total:', orcamento.valor_total);
    console.log('📊 Percentual de Comissão:', vendedor.comissao_percentual + '%');

    const valorComissao = (orcamento.valor_total * vendedor.comissao_percentual) / 100;

    console.log('💰 Valor da Comissão:', valorComissao);

    const { data: comissao, error } = await supabase
      .from('comissoes')
      .insert({
        orcamento_id: orcamento.id,
        vendedor_id: vendedor.id,
        valor_orcamento: orcamento.valor_total,
        percentual_comissao: vendedor.comissao_percentual,
        valor_comissao: Number(valorComissao.toFixed(2)),
        status: 'pendente',
      })
      .select()
      .single();

    if (error) throw error;

    toast({
      title: "💰 Comissão registrada!",
      description: `${vendedor.nome} receberá ${formatCurrency(valorComissao)} (${vendedor.comissao_percentual}%) por este orçamento.`,
    });

    return comissao;
  } catch (error: any) {
    console.error('❌ Erro ao criar comissão:', error);
    throw error;
  }
};

// ========== COMPONENTE DE DIALOG PARA ESCOLHA DO TIPO DE PDF ==========
const DialogEscolhaPDF = ({ 
  open, 
  onOpenChange, 
  orcamento, 
  onGerar,
  gerando
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  orcamento: OrcamentoWithRelations;
  onGerar: (tipo: 'comKg' | 'semKg') => void;
  gerando: boolean;
}) => {
  const [tipoSelecionado, setTipoSelecionado] = useState<'comKg' | 'semKg'>('comKg');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Gerar Orçamento</DialogTitle>
          <DialogDescription>
            Escolha o formato do orçamento para o documento {orcamento?.numero}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Formato do Orçamento</label>
            <Select value={tipoSelecionado} onValueChange={(value: any) => setTipoSelecionado(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o formato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="comKg">
                  <div className="flex flex-col">
                    <span>Com informações de kg</span>
                    <span className="text-xs text-muted-foreground">
                      Mostra peso total e preço por kg para produtos que utilizam a fórmula
                    </span>
                  </div>
                </SelectItem>
                <SelectItem value="semKg">
                  <div className="flex flex-col">
                    <span>Sem informações de kg</span>
                    <span className="text-xs text-muted-foreground">
                      Formato simplificado sem cálculos de peso
                    </span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Alert>
            <FileText className="h-4 w-4" />
            <AlertTitle>Informação</AlertTitle>
            <AlertDescription className="text-xs">
              {tipoSelecionado === 'comKg' 
                ? 'O PDF incluirá coluna de peso total e preço por kg para produtos com peso cadastrado.'
                : 'O PDF será gerado no formato padrão, sem informações de peso ou preço por kg.'}
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={gerando}>
            Cancelar
          </Button>
          <Button onClick={() => onGerar(tipoSelecionado)} disabled={gerando}>
            {gerando ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Gerar PDF
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ========== COMPONENTE DE PAGAMENTO MISTO ==========
const PagamentoMistoDialog = ({ 
  open, 
  onOpenChange, 
  valorTotal, 
  limiteCliente,
  clienteNome,
  onConfirm,
  modo
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  valorTotal: number;
  limiteCliente: number;
  clienteNome: string;
  onConfirm: (pagamento: PagamentoMisto) => void;
  modo: 'criacao' | 'aprovacao';
}) => {
  const [valorCredito, setValorCredito] = useState(limiteCliente);
  const [formaPagamentoRestante, setFormaPagamentoRestante] = useState("");
  const [condicaoPagamentoRestante, setCondicaoPagamentoRestante] = useState("");
  const [parcelasRestante, setParcelasRestante] = useState(1);
  const [parcelado, setParcelado] = useState(false);

  const valorRestante = valorTotal - valorCredito;

  const handleConfirm = () => {
    if (valorCredito <= 0) {
      toast({
        title: "Valor inválido",
        description: "O valor do crédito deve ser maior que zero",
        variant: "destructive",
      });
      return;
    }

    if (valorCredito > limiteCliente) {
      toast({
        title: "Valor inválido",
        description: `O valor do crédito não pode ser maior que R$ ${limiteCliente.toFixed(2)}`,
        variant: "destructive",
      });
      return;
    }

    if (valorRestante > 0 && !formaPagamentoRestante) {
      toast({
        title: "Forma de pagamento obrigatória",
        description: "Selecione uma forma de pagamento para o valor restante",
        variant: "destructive",
      });
      return;
    }

    onConfirm({
      usarCredito: true,
      valorCredito,
      formaPagamentoRestante: valorRestante > 0 ? formaPagamentoRestante : "",
      condicaoPagamentoRestante: valorRestante > 0 ? condicaoPagamentoRestante : undefined,
      parcelasRestante: valorRestante > 0 ? parcelasRestante : 1,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {modo === 'criacao' ? 'Pagamento Misto na Criação' : 'Pagamento Misto na Aprovação'}
          </DialogTitle>
          <DialogDescription>
            <p className="text-orange-600">
              O cliente tem crédito de R$ {limiteCliente.toFixed(2)}, mas a compra é de R$ {valorTotal.toFixed(2)}.
              Será necessário pagar R$ {(valorTotal - limiteCliente).toFixed(2)} de outra forma.
            </p>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-muted p-3 rounded-lg space-y-1">
            <p className="text-sm">
              <span className="font-medium">Cliente:</span> {clienteNome}
            </p>
            <p className="text-sm">
              <span className="font-medium">Limite disponível:</span> R$ {limiteCliente.toFixed(2)}
            </p>
            <p className="text-sm">
              <span className="font-medium">Valor total:</span> R$ {valorTotal.toFixed(2)}
            </p>
            <p className="text-sm font-semibold text-orange-600">
              <span className="font-medium">Valor a pagar de outra forma:</span> R$ {(valorTotal - limiteCliente).toFixed(2)}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Valor a usar do crédito</label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              max={limiteCliente}
              value={valorCredito}
              onChange={(e) => setValorCredito(parseFloat(e.target.value) || 0)}
            />
            <p className="text-xs text-muted-foreground">
              Valor máximo: R$ {limiteCliente.toFixed(2)} (limite total do cliente)
            </p>
          </div>

          {valorRestante > 0 && (
            <>
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Pagamento do valor restante: R$ {valorRestante.toFixed(2)}</h4>
                
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="parceladoRestante"
                      checked={parcelado}
                      onChange={(e) => setParcelado(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <label htmlFor="parceladoRestante" className="text-sm font-medium">
                      Parcelar valor restante?
                    </label>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Forma de Pagamento</label>
                    <Select value={formaPagamentoRestante} onValueChange={setFormaPagamentoRestante}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="avista">À Vista</SelectItem>
                        <SelectItem value="boleto">Boleto</SelectItem>
                        <SelectItem value="credito">Cartão de Crédito</SelectItem>
                        <SelectItem value="debito">Cartão de Débito</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {parcelado && formaPagamentoRestante && (
                    <>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Condição de Pagamento</label>
                        <Select value={condicaoPagamentoRestante} onValueChange={setCondicaoPagamentoRestante}>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="28">28 dias</SelectItem>
                            <SelectItem value="28/56">28/56 dias</SelectItem>
                            <SelectItem value="0/28/56">0/28/56 dias</SelectItem>
                            <SelectItem value="15">15 dias</SelectItem>
                            <SelectItem value="15/30">15/30 dias</SelectItem>
                            <SelectItem value="0/15/30">0/15/30 dias</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium">Número de Parcelas</label>
                        <Input
                          type="number"
                          min="1"
                          max="12"
                          value={parcelasRestante}
                          onChange={(e) => setParcelasRestante(parseInt(e.target.value) || 1)}
                        />
                      </div>
                    </>
                  )}

                  {formaPagamentoRestante && (
                    <div className="bg-gray-50 p-3 rounded-lg text-sm space-y-1">
                      <div className="flex justify-between">
                        <span>Usando crédito:</span>
                        <span className="font-medium text-purple-600">R$ {valorCredito.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Forma de pagamento:</span>
                        <span className="font-medium">{getFormaPagamentoLabel(formaPagamentoRestante)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Valor restante:</span>
                        <span className="font-medium">R$ {valorRestante.toFixed(2)}</span>
                      </div>
                      {parcelado && condicaoPagamentoRestante && (
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>Condição:</span>
                          <span>{getDescricaoCondicao(condicaoPagamentoRestante)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm}>
            Confirmar Pagamento Misto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ========== FUNÇÃO VISUALIZAR CRÉDITOS UTILIZADOS ==========
const visualizarCreditosUtilizados = async (clienteId: string, clienteNome: string) => {
  try {
    const { data: creditos, error } = await supabase
      .from('creditos_utilizados')
      .select(`
        *,
        orcamentos (
          numero,
          valor_total
        )
      `)
      .eq('cliente_id', clienteId)
      .order('data_utilizacao', { ascending: false });

    if (error) throw error;

    if (creditos && creditos.length > 0) {
      const totalUtilizado = creditos.reduce((sum, c) => sum + c.valor_utilizado, 0);
      
      toast({
        title: `💰 Histórico de Créditos - ${clienteNome}`,
        description: (
          <div className="space-y-3 mt-2 max-h-60 overflow-y-auto">
            <div className="bg-purple-50 p-2 rounded text-sm mb-2">
              <strong>Total utilizado: {formatCurrency(totalUtilizado)}</strong>
              <br />
              <span className="text-xs">Saldo atual: {formatCurrency(creditos[0]?.saldo_posterior || 0)}</span>
            </div>
            
            {creditos.map((c: any) => (
              <div key={c.id} className="p-2 bg-gray-50 rounded border text-xs">
                <div className="flex justify-between">
                  <span className="font-medium">
                    {c.tipo_operacao === 'orcamento_credito_total' ? '💳 Uso total do crédito' : 
                     c.tipo_operacao === 'orcamento_credito_parcial' ? '💳 Uso parcial do crédito' : 
                     '💳 Operação de crédito'}
                  </span>
                  <span className="font-bold text-purple-600">
                    {formatCurrency(c.valor_utilizado)}
                  </span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Data: {formatDate(c.data_utilizacao)}</span>
                  <span>Orçamento: {c.orcamentos?.numero || '-'}</span>
                </div>
                <div className="flex justify-between text-xs mt-1 bg-white p-1 rounded">
                  <span>Saldo anterior: {formatCurrency(c.saldo_anterior)}</span>
                  <span>→</span>
                  <span>Saldo posterior: {formatCurrency(c.saldo_posterior)}</span>
                </div>
                {c.observacao && (
                  <p className="text-gray-500 mt-1 border-t pt-1 italic">{c.observacao}</p>
                )}
              </div>
            ))}
          </div>
        ),
        duration: 10000,
      });
    } else {
      toast({
        title: "ℹ️ Sem histórico",
        description: "Este cliente ainda não utilizou crédito.",
      });
    }
  } catch (error: any) {
    console.error('Erro ao buscar histórico:', error);
    toast({
      title: "❌ Erro ao carregar histórico",
      description: error.message,
      variant: "destructive",
    });
  }
};

// ========== COMPONENTE PRINCIPAL ==========
export default function OrcamentosPage() {
  const [orcamentos, setOrcamentos] = useState<OrcamentoWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [orcamentoEditando, setOrcamentoEditando] = useState<OrcamentoComItens | null>(null);
  
  const [pagamentoMistoOpen, setPagamentoMistoOpen] = useState(false);
  const [orcamentoParaAprovar, setOrcamentoParaAprovar] = useState<{
    id: string;
    numero: string;
    orcamento: any;
  } | null>(null);

  // Estados para geração de PDF com opções
  const [pdfDialogOpen, setPdfDialogOpen] = useState(false);
  const [orcamentoSelecionado, setOrcamentoSelecionado] = useState<OrcamentoWithRelations | null>(null);
  const [gerandoPDF, setGerandoPDF] = useState(false);

  const fetchOrcamentos = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('orcamentos')
        .select(`
          *,
          clientes!orcamentos_cliente_id_fkey(
            id,
            nome,
            cpf_cnpj,
            email,
            telefone,
            limite_credito
          ),
          vendedor:vendedores!orcamentos_vendedor_id_fkey(
            id,
            nome,
            email,
            comissao_percentual,
            telefone,
            ativo
          ),
          comissoes (*)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro detalhado:', error);
        throw error;
      }
      
      setOrcamentos((data as OrcamentoWithRelations[]) || []);
    } catch (error: any) {
      console.error('Erro ao buscar orçamentos:', error);
      toast({
        title: "Erro ao carregar orçamentos",
        description: error.message || "Verifique a conexão com o banco de dados",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrcamentos();
  }, []);

  const fetchOrcamentoCompleto = async (orcamentoId: string) => {
    try {
      const { data, error } = await supabase
        .from('orcamentos')
        .select(`
          *,
          clientes!orcamentos_cliente_id_fkey(
            id,
            nome,
            cpf_cnpj,
            email,
            telefone,
            limite_credito
          ),
          vendedor:vendedores!orcamentos_vendedor_id_fkey(
            id,
            nome,
            email,
            comissao_percentual,
            telefone,
            ativo
          ),
          comissoes (*),
          orcamento_itens(
            id,
            produto_id,
            kit_id,
            quantidade,
            preco_unitario,
            desconto,
            peso,
            subtotal,
            produto:produtos(id, codigo, nome, localizacao, peso, peso_kg_m, comprimento_barra, preco, estoque, cor, descricao, unidade, preco_por_kg, custo),
            kit:kits(*)
          )
        `)
        .eq('id', orcamentoId)
        .single();

      if (error) throw error;
      
      return data as OrcamentoComItens;
    } catch (error: any) {
      console.error('Erro ao buscar orçamento completo:', error);
      toast({
        title: "Erro ao carregar orçamento",
        description: error.message,
        variant: "destructive",
      });
      return null;
    }
  };

  const handleEditClick = async (orcamento: OrcamentoWithRelations) => {
    const orcamentoCompleto = await fetchOrcamentoCompleto(orcamento.id);
    if (orcamentoCompleto) {
      setOrcamentoEditando(orcamentoCompleto);
      setEditDialogOpen(true);
    }
  };

  const confirmarPagamentoMisto = async (pagamento: PagamentoMisto) => {
    if (!orcamentoParaAprovar) return;

    try {
      console.log('💰 Processando pagamento misto na aprovação...');
      console.log('📄 Orçamento:', orcamentoParaAprovar.numero);
      console.log('💳 Valor do crédito:', pagamento.valorCredito);
      console.log('💵 Forma restante:', pagamento.formaPagamentoRestante);
      
      const valorRestante = orcamentoParaAprovar.orcamento.valor_total - pagamento.valorCredito;
      
      const { data: cliente } = await supabase
        .from('clientes')
        .select('limite_credito')
        .eq('id', orcamentoParaAprovar.orcamento.cliente_id)
        .single();

      if (!cliente) throw new Error('Cliente não encontrado');

      const saldoAnterior = cliente.limite_credito;
      const saldoPosterior = saldoAnterior - pagamento.valorCredito;
      
      const { error: updateError } = await supabase
        .from('orcamentos')
        .update({ 
          status: 'aprovado',
          updated_at: new Date().toISOString(),
          data_aprovacao: new Date().toISOString(),
          pagamento_misto: true,
          valor_credito_utilizado: pagamento.valorCredito,
          forma_pagamento_restante: pagamento.formaPagamentoRestante,
          condicao_pagamento_restante: pagamento.condicaoPagamentoRestante || null,
          parcelas_restante: pagamento.parcelasRestante || 1,
          observacoes: `${orcamentoParaAprovar.orcamento.observacoes || ''}\n\n💰 PAGAMENTO MISTO NA APROVAÇÃO:\n- Crédito utilizado: R$ ${pagamento.valorCredito.toFixed(2)}\n- Restante: R$ ${valorRestante.toFixed(2)} com ${getFormaPagamentoLabel(pagamento.formaPagamentoRestante)}${pagamento.parcelasRestante && pagamento.parcelasRestante > 1 ? ` em ${pagamento.parcelasRestante}x` : ''}`
        })
        .eq('id', orcamentoParaAprovar.id);

      if (updateError) throw updateError;

      await supabase
        .from('creditos_utilizados')
        .insert({
          cliente_id: orcamentoParaAprovar.orcamento.cliente_id,
          orcamento_id: orcamentoParaAprovar.id,
          valor_utilizado: pagamento.valorCredito,
          data_utilizacao: new Date().toISOString().split('T')[0],
          tipo_operacao: 'orcamento_credito_parcial',
          saldo_anterior: saldoAnterior,
          saldo_posterior: saldoPosterior,
          observacao: `Orçamento ${orcamentoParaAprovar.numero} - Usado R$ ${pagamento.valorCredito.toFixed(2)} do crédito + R$ ${valorRestante.toFixed(2)} com ${pagamento.formaPagamentoRestante}`
        });

      await criarTransacoesFinanceiras(
        {
          ...orcamentoParaAprovar.orcamento,
          valor_total: orcamentoParaAprovar.orcamento.valor_total,
        }, 
        orcamentoParaAprovar.orcamento.clientes?.nome, 
        pagamento
      );

      // Estoque não é mais baixado aqui: agora sai na Conferência de Materiais.

      toast({
        title: "✅ Orçamento aprovado!",
        description: `Pagamento processado: R$ ${pagamento.valorCredito.toFixed(2)} do crédito + R$ ${valorRestante.toFixed(2)} com ${getFormaPagamentoLabel(pagamento.formaPagamentoRestante)}`,
      });

      await fetchOrcamentos();
      
    } catch (error: any) {
      console.error('❌ Erro no pagamento misto:', error);
      toast({
        title: "❌ Erro ao processar pagamento misto",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setPagamentoMistoOpen(false);
      setOrcamentoParaAprovar(null);
    }
  };

  const atualizarStatusOrcamento = async (orcamentoId: string, numero: string, statusAtual: string, novoStatus: string) => {
    try {
      console.log('=== INÍCIO DA ATUALIZAÇÃO DE STATUS ===');
      console.log(`Orçamento: ${numero}`);
      console.log(`Status atual: ${statusAtual}`);
      console.log(`Novo status: ${novoStatus}`);
      
      const { data: orcamento, error: orcamentoError } = await supabase
        .from('orcamentos')
        .select('*, filial_id, clientes(*)')
        .eq('id', orcamentoId)
        .single();

      if (orcamentoError) throw orcamentoError;

      const filialId: string | null = orcamento.filial_id ?? null;

      if (novoStatus === 'aprovado' && statusAtual !== 'aprovado') {
        const verificacao = await verificarEstoqueSuficiente(orcamentoId, filialId);

        if (!verificacao.suficiente) {
          const mensagemErro = verificacao.produtosSemEstoque
            .map(p => `${p.nome} (estoque: ${p.estoque}, necessário: ${p.quantidade}, faltando: ${p.faltando})`)
            .join(', ');

          toast({
            title: "❌ Estoque insuficiente",
            description: `Itens sem estoque na unidade ${verificacao.unidadeNome}: ${mensagemErro}`,
            variant: "destructive",
          });
          return;
        }

        if (orcamento.forma_pagamento === 'credito_cliente') {
          const { data: cliente } = await supabase
            .from('clientes')
            .select('limite_credito')
            .eq('id', orcamento.cliente_id)
            .single();

          if (cliente) {
            if (cliente.limite_credito >= orcamento.valor_total) {
              const saldoAnterior = cliente.limite_credito;
              const saldoPosterior = saldoAnterior - orcamento.valor_total;
              
              await supabase
                .from('creditos_utilizados')
                .insert({
                  cliente_id: orcamento.cliente_id,
                  orcamento_id: orcamentoId,
                  valor_utilizado: orcamento.valor_total,
                  data_utilizacao: new Date().toISOString().split('T')[0],
                  tipo_operacao: 'orcamento_credito_total',
                  saldo_anterior: saldoAnterior,
                  saldo_posterior: saldoPosterior,
                  observacao: `Orçamento ${numero} - Usado todo o crédito disponível`
                });

              toast({
                title: "💰 Crédito utilizado!",
                description: `R$ ${orcamento.valor_total.toFixed(2)} debitado do limite do cliente. Novo limite: R$ ${saldoPosterior.toFixed(2)}`,
              });
              
            } else {
              setPagamentoMistoOpen(true);
              setOrcamentoParaAprovar({ 
                id: orcamentoId, 
                numero, 
                orcamento: {
                  ...orcamento,
                  clientes: orcamento.clientes
                }
              });
              return;
            }
          }
        } else {
          console.log('💰 Criando transações financeiras...');
          await criarTransacoesFinanceiras(orcamento, orcamento.clientes?.nome);
        }
        
        // Estoque não é mais baixado na aprovação: sai na Conferência de Materiais.
      }

      if (statusAtual === 'aprovado' && novoStatus !== 'aprovado') {
        console.log('🔙 Revertendo conferência (se houver) e devolvendo estoque...');
        const { data: conferenciaFinalizada } = await supabase
          .from('conferencia_materiais')
          .select('id')
          .eq('orcamento_id', orcamentoId)
          .eq('status', 'finalizada')
          .maybeSingle();

        if (conferenciaFinalizada) {
          await supabase.rpc('reverter_conferencia', { conferencia_id_param: conferenciaFinalizada.id });
        }

        console.log('💰 Cancelando transações pendentes...');
        
        const { data: transacoesExistentes, error: checkError } = await supabase
          .from('transacoes_financeiras')
          .select('id')
          .eq('orcamento_id', orcamentoId)
          .eq('status', 'pendente')
          .limit(1);
        
        if (checkError) {
          console.error('❌ Erro ao verificar transações:', checkError);
        } else if (transacoesExistentes && transacoesExistentes.length > 0) {
          const { error: updateError } = await supabase
            .from('transacoes_financeiras')
            .update({ status: 'cancelado' })
            .eq('orcamento_id', orcamentoId)
            .eq('status', 'pendente');
          
          if (updateError) {
            console.error('❌ Erro ao cancelar transações:', updateError);
          } else {
            console.log('✅ Transações canceladas com sucesso');
          }
        } else {
          console.log('ℹ️ Nenhuma transação pendente encontrada');
        }

        await supabase
          .from('comissoes')
          .update({ status: 'cancelado' })
          .eq('orcamento_id', orcamentoId)
          .eq('status', 'pendente');
      }

      if (!orcamentoParaAprovar) {
        const { error } = await supabase
          .from('orcamentos')
          .update({ 
            status: novoStatus,
            updated_at: new Date().toISOString(),
            ...(novoStatus === 'aprovado' ? {
              data_aprovacao: new Date().toISOString(),
            } : {}),
          })
          .eq('id', orcamentoId);

        if (error) throw error;

        await logActivity({
          acao: novoStatus === 'aprovado' ? 'aprovar' : novoStatus === 'rejeitado' || novoStatus === 'recusado' ? 'rejeitar' : 'atualizar',
          entidade: 'orcamento',
          entidadeId: orcamentoId,
          descricao: `Orçamento ${numero}: status alterado de ${getStatusLabel(statusAtual)} para ${getStatusLabel(novoStatus)}`,
        });

        toast({
          title: "✅ Status atualizado!",
          description: `Orçamento ${numero} agora está ${getStatusLabel(novoStatus)}`,
        });

        await fetchOrcamentos();
      }

    } catch (error: any) {
      console.error('❌ Erro:', error);
      toast({
        title: "❌ Erro ao atualizar status",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const visualizarTransacoes = async (orcamento: OrcamentoWithRelations) => {
    try {
      const { data: transacoes, error } = await supabase
        .from('transacoes_financeiras')
        .select('*')
        .eq('orcamento_id', orcamento.id)
        .order('data_vencimento', { ascending: true });

      if (error) throw error;

      if (transacoes && transacoes.length > 0) {
        const total = transacoes.reduce((sum, t) => sum + t.valor, 0);
        
        const creditoUtilizado = transacoes.find(t => t.origem_tipo === 'credito_utilizado');
        const restante = transacoes.filter(t => t.origem_tipo !== 'credito_utilizado');
        
        toast({
          title: `💰 Transações - Orçamento ${orcamento.numero}`,
          description: (
            <div className="space-y-2 mt-2 max-h-60 overflow-y-auto">
              <div className="bg-blue-50 p-2 rounded text-sm mb-2">
                <strong>Total: {formatCurrency(total)}</strong>
              </div>
              
              {creditoUtilizado && (
                <div key={creditoUtilizado.id} className="p-2 bg-purple-50 rounded border text-xs">
                  <div className="flex justify-between">
                    <span className="font-medium">Crédito Utilizado</span>
                    <span className="font-bold text-purple-600">
                      {formatCurrency(creditoUtilizado.valor)}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Venc: {formatDate(creditoUtilizado.data_vencimento)}</span>
                    <Badge variant="outline" className="text-[10px] h-5 bg-purple-100">
                      {creditoUtilizado.status}
                    </Badge>
                  </div>
                </div>
              )}
              
              {restante.map((t: any) => (
                <div key={t.id} className="p-2 bg-gray-50 rounded border text-xs">
                  <div className="flex justify-between">
                    <span className="font-medium">{t.numero_parcela || 'Restante'}</span>
                    <span className="font-bold text-green-600">
                      {formatCurrency(t.valor)}
                    </span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Venc: {formatDate(t.data_vencimento)}</span>
                    <Badge variant={t.status === 'recebido' ? 'default' : 'secondary'} className="text-[10px] h-5">
                      {t.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ),
          duration: 8000,
        });
      } else {
        toast({
          title: "ℹ️ Sem transações",
          description: "Este orçamento não possui transações financeiras.",
        });
      }
    } catch (error: any) {
      toast({
        title: "❌ Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const visualizarComissao = async (orcamento: OrcamentoWithRelations) => {
    try {
      const { data: comissoes, error } = await supabase
        .from('comissoes')
        .select(`
          *,
          vendedor:vendedores (
            nome,
            email,
            comissao_percentual
          )
        `)
        .eq('orcamento_id', orcamento.id);

      if (error) throw error;

      if (comissoes && comissoes.length > 0) {
        const comissao = comissoes[0];
        toast({
          title: `💰 Comissão - Orçamento ${orcamento.numero}`,
          description: (
            <div className="space-y-3 mt-2">
              <div className="bg-green-50 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <UserCheck className="h-4 w-4 text-green-600" />
                  <span className="font-medium">{comissao.vendedor.nome}</span>
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>Valor do Orçamento:</span>
                    <span className="font-medium">{formatCurrency(comissao.valor_orcamento)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Percentual:</span>
                    <span className="font-medium">{comissao.percentual_comissao}%</span>
                  </div>
                  <div className="flex justify-between border-t pt-1 mt-1">
                    <span className="font-bold">Valor da Comissão:</span>
                    <span className="font-bold text-green-600">{formatCurrency(comissao.valor_comissao)}</span>
                  </div>
                  <div className="flex justify-between mt-2">
                    <Badge variant={comissao.status === 'pago' ? 'default' : 'secondary'}>
                      {comissao.status === 'pago' ? 'Pago' : comissao.status === 'pendente' ? 'Pendente' : 'Cancelado'}
                    </Badge>
                    {comissao.data_pagamento && (
                      <span className="text-xs text-muted-foreground">
                        Pago em: {formatDate(comissao.data_pagamento)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ),
          duration: 8000,
        });
      } else {
        toast({
          title: "ℹ️ Sem comissão",
          description: "Este orçamento não possui comissão registrada.",
        });
      }
    } catch (error: any) {
      toast({
        title: "❌ Erro",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const gerarPDFTipo = async (orcamento: OrcamentoWithRelations, tipo: 'comKg' | 'semKg') => {
    setGerandoPDF(true);
    try {
      const { data: orcamentoCompleto, error } = await supabase
        .from('orcamentos')
        .select(`
          *,
          clientes(*),
          vendedor:vendedores(*),
          filial:filiais(nome),
          orcamento_itens(
            *,
            produto:produtos(id, codigo, nome, localizacao, unidade, peso, peso_kg_m, comprimento_barra, imagem_url),
            kit:kits(*)
          )
        `)
        .eq('id', orcamento.id)
        .single();

      if (error) throw error;

      const { data: config } = await supabase
        .from('configuracoes')
        .select('*')
        .limit(1)
        .single();

      const dataValidade = new Date(orcamento.created_at);
      dataValidade.setDate(dataValidade.getDate() + 7);

      // Calcular informações de kg para cada item
      const itensComKg = (orcamentoCompleto?.orcamento_itens || []).map((item: any) => {
        let pesoKgM = null;
        let comprimentoBarra = null;
        let pesoTotalKg = null;
        let precoPorKg = null;
        
        if (item.produto) {
          pesoKgM = item.produto.peso_kg_m;
          comprimentoBarra = item.produto.comprimento_barra || 6;
          
          if (pesoKgM && pesoKgM > 0) {
            pesoTotalKg = pesoKgM * comprimentoBarra * item.quantidade;
            precoPorKg = item.preco_unitario / (pesoKgM * comprimentoBarra);
          }
        }
        
        return {
          codigo: item.produto?.codigo || item.kit?.codigo || '-',
          nome: item.produto?.nome || item.kit?.nome || '-',
          localizacao: item.produto?.localizacao || '-',
          unidade: item.produto?.unidade || 'Un',
          quantidade: item.quantidade,
          preco_unitario: item.preco_unitario,
          desconto: item.desconto || 0,
          subtotal: item.subtotal,
          peso_kg_m: pesoKgM,
          comprimento_barra: comprimentoBarra,
          peso_total_kg: pesoTotalKg,
          preco_por_kg: precoPorKg,
          imagem_url: item.produto?.imagem_url || null,
        };
      });

      const dadosOrcamento = {
        numero: orcamento.numero,
        data: formatDate(orcamento.created_at),
        validade: formatDate(dataValidade.toISOString()),
        cliente: orcamentoCompleto?.clientes,
        vendedor: orcamentoCompleto?.vendedor,
        loja: orcamentoCompleto?.filial?.nome || 'Matriz',
        itens: itensComKg,
        valor_total: orcamento.valor_total,
        observacoes: orcamento.observacoes,
        pagamento: {
          forma: getFormaPagamentoLabel(orcamento.forma_pagamento || ''),
          condicao: orcamento.condicao_pagamento,
          entrada: orcamento.entrada_valor,
          parcelas: orcamento.parcelas,
          valor_parcela: orcamento.valor_parcela,
          descricao_condicao: orcamento.condicao_pagamento ? getDescricaoCondicao(orcamento.condicao_pagamento) : "",
          pagamento_misto: orcamento.pagamento_misto,
          valor_credito_utilizado: orcamento.valor_credito_utilizado,
          forma_pagamento_restante: orcamento.forma_pagamento_restante
        }
      };

      const mostrarKg = tipo === 'comKg';
      const pdfBlob = await gerarPDFOrcamento(dadosOrcamento, config, mostrarKg);
      const nomeArquivo = `orcamento_${orcamento.numero}${mostrarKg ? '_com_kg' : '_sem_kg'}.pdf`;
      downloadPDF(pdfBlob, nomeArquivo);

      toast({
        title: "✅ PDF gerado!",
        description: `Orçamento gerado ${mostrarKg ? 'com' : 'sem'} informações de kg.`,
      });
    } catch (error: any) {
      console.error('Erro ao gerar PDF:', error);
      toast({
        title: "❌ Erro ao gerar PDF",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setGerandoPDF(false);
    }
  };

  const pagarComissao = async (comissaoId: string) => {
    try {
      const { error } = await supabase
        .from('comissoes')
        .update({
          status: 'pago',
          data_pagamento: new Date().toISOString()
        })
        .eq('id', comissaoId);

      if (error) throw error;

      toast({
        title: "💰 Comissão paga!",
        description: "A comissão foi marcada como paga.",
      });

      fetchOrcamentos();
    } catch (error: any) {
      toast({
        title: "❌ Erro ao pagar comissão",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const formatarPagamento = (orcamento: OrcamentoWithRelations) => {
    if (orcamento.pagamento_misto) {
      return (
        <div className="flex flex-col">
          <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 w-fit">
            <CreditCard className="h-3 w-3 mr-1" />
            Pagamento Misto
          </Badge>
          <span className="text-xs text-indigo-600 mt-1">
            Crédito: {formatCurrency(orcamento.valor_credito_utilizado || 0)}
          </span>
          <span className="text-xs text-gray-600">
            + {getFormaPagamentoLabel(orcamento.forma_pagamento_restante || '')}
          </span>
        </div>
      );
    }

    if (orcamento.forma_pagamento === 'credito_cliente') {
      return (
        <div className="flex flex-col">
          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 w-fit">
            <CreditCard className="h-3 w-3 mr-1" />
            Crédito do Cliente
          </Badge>
          <span className="text-xs text-purple-600 mt-1">
            Usa limite do cliente
          </span>
        </div>
      );
    }

    if (!orcamento.parcelado || orcamento.forma_pagamento === 'avista') {
      return (
        <div className="flex flex-col">
          <span className="text-sm">{getFormaPagamentoLabel(orcamento.forma_pagamento || '')}</span>
          <span className="text-xs font-medium">Total: {formatCurrency(orcamento.valor_total)}</span>
        </div>
      );
    }

    return (
      <div className="flex flex-col">
        <span className="text-sm">{getFormaPagamentoLabel(orcamento.forma_pagamento || '')}</span>
        
        {orcamento.entrada_valor ? (
          <span className="text-xs text-green-600 font-medium">
            Entrada: {formatCurrency(orcamento.entrada_valor)} (hoje)
          </span>
        ) : null}
        
        <span className="text-xs">
          {orcamento.condicao_pagamento?.startsWith('0/') 
            ? `${orcamento.parcelas! - 1}x ${formatCurrency(orcamento.valor_parcela || 0)}`
            : `${orcamento.parcelas}x ${formatCurrency(orcamento.valor_parcela || 0)}`
          }
        </span>
        
        <span className="text-xs text-gray-500">
          {orcamento.condicao_pagamento ? getDescricaoCondicao(orcamento.condicao_pagamento) : ''}
        </span>
      </div>
    );
  };

  const StatusDropdown = ({ orcamento }: { orcamento: OrcamentoWithRelations }) => {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-auto p-0 hover:bg-transparent">
            <div className="flex items-center gap-1">
              <Badge className={getStatusColor(orcamento.status)}>
                {getStatusLabel(orcamento.status)}
              </Badge>
              <ChevronDown className="h-3 w-3" />
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem 
            onClick={() => atualizarStatusOrcamento(orcamento.id, orcamento.numero, orcamento.status, 'pendente')}
            className="text-yellow-600"
          >
            Pendente
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => atualizarStatusOrcamento(orcamento.id, orcamento.numero, orcamento.status, 'aprovado')}
            className="text-green-600"
          >
            Aprovado
          </DropdownMenuItem>
          <DropdownMenuItem 
            onClick={() => atualizarStatusOrcamento(orcamento.id, orcamento.numero, orcamento.status, 'cancelado')}
            className="text-gray-600"
          >
            Cancelado
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const StatusDialog = ({ orcamento }: { orcamento: OrcamentoWithRelations }) => {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [novoStatus, setNovoStatus] = useState(orcamento.status);

    const handleUpdate = async () => {
      setLoading(true);
      await atualizarStatusOrcamento(orcamento.id, orcamento.numero, orcamento.status, novoStatus);
      setLoading(false);
      setOpen(false);
    };

    return (
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Eye className="h-4 w-4 mr-2" />
            Detalhes
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Alterar Status do Orçamento</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Orçamento: {orcamento.numero}
            </p>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Status Atual</label>
              <div className="p-2 bg-muted rounded-md">
                <Badge className={getStatusColor(orcamento.status)}>
                  {getStatusLabel(orcamento.status)}
                </Badge>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Novo Status</label>
              <Select value={novoStatus} onValueChange={setNovoStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="aprovado">Aprovado</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {orcamento.forma_pagamento === 'credito_cliente' && novoStatus === 'aprovado' && (
              <Alert className="bg-purple-50 border-purple-200">
                <CreditCard className="h-4 w-4 text-purple-600" />
                <AlertTitle className="text-purple-800">
                  Pagamento com Crédito
                </AlertTitle>
                <AlertDescription className="text-purple-700 text-xs">
                  Ao aprovar, o valor de {formatCurrency(orcamento.valor_total)} será debitado do limite de crédito do cliente.
                </AlertDescription>
              </Alert>
            )}

            {orcamento.pagamento_misto && (
              <Alert className="bg-indigo-50 border-indigo-200">
                <CreditCard className="h-4 w-4 text-indigo-600" />
                <AlertTitle className="text-indigo-800">
                  Pagamento Misto
                </AlertTitle>
                <AlertDescription className="text-indigo-700 text-xs">
                  <p>Crédito utilizado: {formatCurrency(orcamento.valor_credito_utilizado || 0)}</p>
                  <p>Forma restante: {getFormaPagamentoLabel(orcamento.forma_pagamento_restante || '')}</p>
                </AlertDescription>
              </Alert>
            )}

            {orcamento.entrada_valor && orcamento.entrada_valor > 0 && orcamento.forma_pagamento !== 'credito_cliente' && (
              <Alert className="bg-blue-50 border-blue-200">
                <DollarSign className="h-4 w-4 text-blue-600" />
                <AlertTitle className="text-blue-800">
                  Entrada de {formatCurrency(orcamento.entrada_valor)}
                </AlertTitle>
                <AlertDescription className="text-blue-700 text-xs">
                  Ao aprovar, será criada uma transação com vencimento HOJE.
                </AlertDescription>
              </Alert>
            )}

            {orcamento.vendedor && (
              <Alert className="bg-green-50 border-green-200">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <AlertTitle className="text-green-800">
                  Comissão do Vendedor
                </AlertTitle>
                <AlertDescription className="text-green-700 text-xs">
                  <div className="flex justify-between">
                    <span>{orcamento.vendedor.nome}:</span>
                    <span className="font-medium">
                      {orcamento.vendedor.comissao_percentual}% = {formatCurrency((orcamento.valor_total * orcamento.vendedor.comissao_percentual) / 100)}
                    </span>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {orcamento.status === 'aprovado' && novoStatus !== 'aprovado' && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Atenção!</AlertTitle>
                <AlertDescription className="text-xs">
                  O estoque será devolvido, as transações pendentes e a comissão serão canceladas.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                Cancelar
              </Button>
              <Button onClick={handleUpdate} disabled={loading || novoStatus === orcamento.status}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Atualizando...
                  </>
                ) : (
                  "Confirmar"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  };

  const orcamentosFiltrados = orcamentos.filter(orcamento => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      orcamento.numero?.toLowerCase().includes(search) ||
      orcamento.clientes?.nome?.toLowerCase().includes(search) ||
      orcamento.clientes?.cpf_cnpj?.toLowerCase().includes(search) ||
      orcamento.vendedor?.nome?.toLowerCase().includes(search)
    );
  });

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Orçamentos</h1>
          <p className="text-muted-foreground">
            Gerencie os orçamentos da sua empresa
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Orçamento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Criar Novo Orçamento</DialogTitle>
              </DialogHeader>
              <AddOrcamentoContent onClose={() => {
                setAddDialogOpen(false);
                fetchOrcamentos();
              }} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <CardTitle>Todos os Orçamentos</CardTitle>
            <div className="relative w-full md:w-auto">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar por número, cliente, vendedor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 w-full md:w-[350px]"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
              <p>Carregando orçamentos...</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Valor Total</TableHead>
                    <TableHead>Pagamento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orcamentosFiltrados.length > 0 ? (
                    orcamentosFiltrados.map((orcamento) => (
                      <TableRow key={orcamento.id}>
                        <TableCell className="font-medium">
                          {orcamento.numero}
                        </TableCell>
                        <TableCell>{formatDate(orcamento.created_at)}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{orcamento.clientes?.nome || 'Cliente não encontrado'}</p>
                            <p className="text-xs text-muted-foreground">
                              {orcamento.clientes?.cpf_cnpj || ''}
                            </p>
                            {orcamento.clientes?.limite_credito > 0 && (
                              <div className="flex items-center gap-1 mt-1">
                                <Badge variant="outline" className="bg-blue-50 text-blue-700">
                                  <CreditCard className="h-3 w-3 mr-1" />
                                  Limite: {formatCurrency(orcamento.clientes.limite_credito)}
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-5 w-5 p-0"
                                  onClick={() => visualizarCreditosUtilizados(orcamento.clientes!.id, orcamento.clientes!.nome)}
                                  title="Ver histórico de créditos"
                                >
                                  <History className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {orcamento.vendedor ? (
                            <div className="flex flex-col">
                              <span className="font-medium">{orcamento.vendedor.nome}</span>
                              <span className="text-xs text-green-600">
                                Comissão: {orcamento.vendedor.comissao_percentual}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>{formatCurrency(orcamento.valor_total)}</TableCell>
                        <TableCell>
                          {formatarPagamento(orcamento)}
                        </TableCell>
                        <TableCell>
                          <StatusDropdown orcamento={orcamento} />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {orcamento.status === 'aprovado' && orcamento.forma_pagamento !== 'credito_cliente' && (
                              <>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => visualizarTransacoes(orcamento)}
                                  title="Ver transações"
                                >
                                  <DollarSign className="h-4 w-4" />
                                </Button>
                                
                                {orcamento.comissoes && orcamento.comissoes.length > 0 && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => visualizarComissao(orcamento)}
                                    title="Ver comissão"
                                    className="text-green-600"
                                  >
                                    <TrendingUp className="h-4 w-4" />
                                  </Button>
                                )}
                              </>
                            )}
                            
                            {orcamento.forma_pagamento === 'credito_cliente' && orcamento.status === 'aprovado' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => visualizarComissao(orcamento)}
                                title="Ver comissão"
                                className="text-green-600"
                              >
                                <TrendingUp className="h-4 w-4" />
                              </Button>
                            )}
                            
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setOrcamentoSelecionado(orcamento);
                                setPdfDialogOpen(true);
                              }}
                              title="Gerar PDF"
                            >
                              <FileText className="h-4 w-4" />
                            </Button>
                            
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditClick(orcamento)}
                              title="Editar orçamento"
                              className="text-blue-600"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            
                            <StatusDialog orcamento={orcamento} />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8">
                        {searchTerm ? "Nenhum orçamento encontrado" : "Nenhum orçamento cadastrado"}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Edição */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Orçamento {orcamentoEditando?.numero}</DialogTitle>
          </DialogHeader>
          {orcamentoEditando && (
            <EditOrcamentoContent 
              orcamento={orcamentoEditando} 
              onClose={() => {
                setEditDialogOpen(false);
                setOrcamentoEditando(null);
                fetchOrcamentos();
              }} 
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de Pagamento Misto na Aprovação */}
      {orcamentoParaAprovar && (
        <PagamentoMistoDialog
          open={pagamentoMistoOpen}
          onOpenChange={setPagamentoMistoOpen}
          valorTotal={orcamentoParaAprovar.orcamento.valor_total}
          limiteCliente={orcamentoParaAprovar.orcamento.clientes?.limite_credito || 0}
          clienteNome={orcamentoParaAprovar.orcamento.clientes?.nome || ''}
          onConfirm={confirmarPagamentoMisto}
          modo="aprovacao"
        />
      )}

      {/* Dialog para escolha do tipo de PDF */}
      {orcamentoSelecionado && (
        <DialogEscolhaPDF
          open={pdfDialogOpen}
          onOpenChange={setPdfDialogOpen}
          orcamento={orcamentoSelecionado}
          onGerar={(tipo) => gerarPDFTipo(orcamentoSelecionado, tipo)}
          gerando={gerandoPDF}
        />
      )}
    </div>
  );
}

// ========== COMPONENTE DE ADICIONAR ORÇAMENTO ==========
const AddOrcamentoContent = ({ onClose }: { onClose: () => void }) => {
  const [loading, setLoading] = useState(false);
  const [clientes, setClientes] = useState<any[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [kits, setKits] = useState<any[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [vendedorId, setVendedorId] = useState<string>("");
  const [filiais, setFiliais] = useState<Filial[]>([]);
  const [filialId, setFilialId] = useState<string>(MATRIZ_SENTINEL);
  const [observacoes, setObservacoes] = useState("");
  const [itens, setItens] = useState<ItemOrcamento[]>([]);
  const [tipoItem, setTipoItem] = useState<'produto' | 'kit'>('produto');
  const [itemSelecionado, setItemSelecionado] = useState("");
  const [quantidade, setQuantidade] = useState(1);
  const [desconto, setDesconto] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [formaPagamento, setFormaPagamento] = useState<string>("");
  const [condicaoPagamento, setCondicaoPagamento] = useState<string>("");
  const [entradaValor, setEntradaValor] = useState<number>(0);
  const [parcelas, setParcelas] = useState<number>(1);
  const [valorEntrada, setValorEntrada] = useState<number>(0);
  const [valorParcela, setValorParcela] = useState<number>(0);
  const [parcelado, setParcelado] = useState<boolean>(false);
  const [clienteLimite, setClienteLimite] = useState<number>(0);
  
  const [mostrarCalculoReverso, setMostrarCalculoReverso] = useState<number | null>(null);
  const [novoPrecoPorKg, setNovoPrecoPorKg] = useState<string>("");
  const [mostrarAplicarTodos, setMostrarAplicarTodos] = useState(false);
  const [precoPorKgTodos, setPrecoPorKgTodos] = useState<string>("");

  const calcularPrecoPorKgReverso = (precoVenda: number, pesoKgM: number, comprimentoBarra: number = 6) => {
    const pesoTotal = pesoKgM * comprimentoBarra;
    if (pesoTotal <= 0) return 0;
    return precoVenda / pesoTotal;
  };

  const calcularPrecoVenda = (precoPorKg: number, pesoKgM: number, comprimentoBarra: number = 6) => {
    const pesoTotal = pesoKgM * comprimentoBarra;
    return pesoTotal * precoPorKg;
  };

  const produtoUsaFormula = (item: ItemOrcamento) => {
    if (item.tipo !== 'produto') return false;
    const produto = produtos.find(p => p.id === item.produto_id);
    return produto && produto.peso_kg_m && produto.peso_kg_m > 0;
  };

  const contarItensComFormula = () => {
    return itens.filter(item => produtoUsaFormula(item)).length;
  };

  const handlePrecoUnitarioChange = (index: number, novoPrecoUnitario: number) => {
    const newItens = [...itens];
    const item = newItens[index];
    
    if (item.tipo === 'produto') {
      const produtoOriginal = produtos.find(p => p.id === item.produto_id);
      if (produtoOriginal?.peso_kg_m && produtoOriginal.peso_kg_m > 0) {
        const precoPorKgCalculado = calcularPrecoPorKgReverso(
          novoPrecoUnitario, 
          produtoOriginal.peso_kg_m, 
          produtoOriginal.comprimento_barra || 6
        );
        
        newItens[index] = {
          ...item,
          preco_unitario: novoPrecoUnitario,
          preco_por_kg_calculado: precoPorKgCalculado
        };
      } else {
        newItens[index].preco_unitario = novoPrecoUnitario;
      }
    } else {
      newItens[index].preco_unitario = novoPrecoUnitario;
    }
    
    setItens(newItens);
  };

  const aplicarPrecoPorKg = (index: number, precoPorKg: number) => {
    const newItens = [...itens];
    const item = newItens[index];
    
    if (item.tipo === 'produto') {
      const produtoOriginal = produtos.find(p => p.id === item.produto_id);
      if (produtoOriginal?.peso_kg_m && produtoOriginal.peso_kg_m > 0) {
        const novoPrecoVenda = calcularPrecoVenda(
          precoPorKg,
          produtoOriginal.peso_kg_m,
          produtoOriginal.comprimento_barra || 6
        );
        
        newItens[index] = {
          ...item,
          preco_unitario: parseFloat(novoPrecoVenda.toFixed(2)),
          preco_por_kg_calculado: precoPorKg
        };
        
        setItens(newItens);
        setNovoPrecoPorKg("");
        setMostrarCalculoReverso(null);
        
        toast({
          title: "Preço atualizado!",
          description: `Preço por kg aplicado: R$ ${precoPorKg.toFixed(2)} | Novo preço: R$ ${novoPrecoVenda.toFixed(2)}`,
        });
      }
    }
  };

  const aplicarDescontoPrecoPorKg = (index: number, percentualDesconto: number) => {
    const item = itens[index];
    if (item.preco_por_kg_calculado && percentualDesconto > 0) {
      const novoPrecoPorKg = item.preco_por_kg_calculado * (1 - percentualDesconto / 100);
      aplicarPrecoPorKg(index, parseFloat(novoPrecoPorKg.toFixed(2)));
    }
  };

  const abrirModalCalculoReverso = (index: number) => {
    setMostrarCalculoReverso(index);
    const item = itens[index];
    if (item.preco_por_kg_calculado) {
      setNovoPrecoPorKg(item.preco_por_kg_calculado.toFixed(2));
    } else {
      setNovoPrecoPorKg("");
    }
  };

  const aplicarPrecoPorKgTodos = (precoPorKg: number) => {
    const newItens = [...itens];
    let itensAtualizados = 0;
    
    newItens.forEach((item, index) => {
      if (item.tipo === 'produto') {
        const produtoOriginal = produtos.find(p => p.id === item.produto_id);
        if (produtoOriginal?.peso_kg_m && produtoOriginal.peso_kg_m > 0) {
          const novoPrecoVenda = calcularPrecoVenda(
            precoPorKg,
            produtoOriginal.peso_kg_m,
            produtoOriginal.comprimento_barra || 6
          );
          
          newItens[index] = {
            ...item,
            preco_unitario: parseFloat(novoPrecoVenda.toFixed(2)),
            preco_por_kg_calculado: precoPorKg
          };
          itensAtualizados++;
        }
      }
    });
    
    setItens(newItens);
    setPrecoPorKgTodos("");
    setMostrarAplicarTodos(false);
    
    toast({
      title: "Preço aplicado para todos!",
      description: `Preço por kg R$ ${precoPorKg.toFixed(2)} aplicado em ${itensAtualizados} itens do orçamento`,
    });
  };

  const aplicarDescontoPrecoPorKgTodos = (percentualDesconto: number) => {
    const newItens = [...itens];
    let itensAtualizados = 0;
    
    newItens.forEach((item, index) => {
      if (item.tipo === 'produto' && item.preco_por_kg_calculado) {
        const produtoOriginal = produtos.find(p => p.id === item.produto_id);
        if (produtoOriginal?.peso_kg_m && produtoOriginal.peso_kg_m > 0) {
          const novoPrecoPorKg = item.preco_por_kg_calculado * (1 - percentualDesconto / 100);
          const novoPrecoVenda = calcularPrecoVenda(
            novoPrecoPorKg,
            produtoOriginal.peso_kg_m,
            produtoOriginal.comprimento_barra || 6
          );
          
          newItens[index] = {
            ...item,
            preco_unitario: parseFloat(novoPrecoVenda.toFixed(2)),
            preco_por_kg_calculado: parseFloat(novoPrecoPorKg.toFixed(2))
          };
          itensAtualizados++;
        }
      }
    });
    
    setItens(newItens);
    
    toast({
      title: "Desconto aplicado para todos!",
      description: `Desconto de ${percentualDesconto}% aplicado em ${itensAtualizados} itens do orçamento`,
    });
  };

  const calcularSubtotalComDesconto = (item: ItemOrcamento) => {
    const subtotal = item.quantidade * item.preco_unitario;
    const valorDesconto = (subtotal * item.desconto) / 100;
    return subtotal - valorDesconto;
  };

  const calcularValorTotal = () => {
    return itens.reduce((sum, item) => sum + calcularSubtotalComDesconto(item), 0);
  };

  const valorTotal = calcularValorTotal();

  useEffect(() => {
    fetchClientes();
    fetchVendedores();
    fetchFiliais();
    fetchProdutos();
    fetchKits();
  }, []);

  useEffect(() => {
    if (valorTotal > 0) {
      calcularPagamento();
    }
  }, [formaPagamento, condicaoPagamento, entradaValor, parcelas, valorTotal, parcelado]);

  useEffect(() => {
    if (clienteId) {
      fetchClienteLimite();
    } else {
      setClienteLimite(0);
    }
  }, [clienteId]);

  const fetchClienteLimite = async () => {
    const { data } = await supabase
      .from('clientes')
      .select('limite_credito')
      .eq('id', clienteId)
      .single();
    
    if (data) {
      setClienteLimite(data.limite_credito || 0);
    }
  };

  const fetchClientes = async () => {
    const { data } = await supabase
      .from('clientes')
      .select('*')
      .order('nome');
    if (data) setClientes(data);
  };

  const fetchVendedores = async () => {
    const { data } = await supabase
      .from('vendedores')
      .select('*')
      .eq('ativo', true)
      .order('nome');
    if (data) setVendedores(data as Vendedor[]);
  };

  const fetchFiliais = async () => {
    const { data } = await supabase
      .from('filiais')
      .select('id, nome, codigo')
      .eq('ativo', true)
      .order('nome');
    if (data) setFiliais(data as Filial[]);
  };

  const fetchProdutos = async () => {
    const { data } = await supabase
      .from('produtos')
      .select('id, codigo, nome, descricao, cor, preco, peso, estoque, localizacao, categoria, peso_kg_m, comprimento_barra, ativo, unidade, preco_por_kg, custo')
      .eq('ativo', true)
      .order('nome');
    if (data) setProdutos(data as Produto[]);
  };

  const fetchKits = async () => {
    try {
      console.log('🔍 Buscando kits com estoque...');

      const { data: kitsData, error: kitsError } = await supabase
        .from('kits')
        .select('id, codigo, nome, preco_total, descricao, ativo')
        .eq('ativo', true)
        .order('nome');

      if (kitsError) {
        console.error('❌ Erro ao buscar kits:', kitsError);
        setKits([]);
        return;
      }

      if (!kitsData || kitsData.length === 0) {
        console.log('📦 Nenhum kit encontrado');
        setKits([]);
        return;
      }

      // Buscar todos os itens dos kits
      const kitIds = kitsData.map(k => k.id);

      const { data: kitItensData, error: kitItensError } = await supabase
        .from('kit_itens')
        .select('id, kit_id, produto_id, sub_kit_id, quantidade')
        .in('kit_id', kitIds);

      if (kitItensError) {
        console.error('❌ Erro ao buscar itens dos kits:', kitItensError);
        setKits([]);
        return;
      }

      // Buscar estoque dos produtos
      const produtoIds = kitItensData?.filter(i => i.produto_id).map(i => i.produto_id) || [];
      
      // Só fazer a consulta se houver produtoIds
      const estoqueProdutos: Record<string, number> = {};
      if (produtoIds.length > 0) {
        const { data: produtosEstoque } = await supabase
          .from('produtos')
          .select('id, estoque')
          .in('id', produtoIds);

        (produtosEstoque || []).forEach(p => {
          estoqueProdutos[p.id] = p.estoque || 0;
        });
      }

      // Calcular estoque disponível para cada kit
      const kitEstoqueMap: Record<string, number> = {};

      for (const kit of kitsData) {
        const itensDoKit = kitItensData?.filter(i => i.kit_id === kit.id) || [];

        if (itensDoKit.length === 0) {
          kitEstoqueMap[kit.id] = 999;
          continue;
        }

        let minEstoque = Infinity;

        for (const item of itensDoKit) {
          if (item.produto_id) {
            const estoqueDisponivel = estoqueProdutos[item.produto_id] || 0;
            const kitsPossiveis = Math.floor(estoqueDisponivel / item.quantidade);
            if (kitsPossiveis < minEstoque) {
              minEstoque = kitsPossiveis;
            }
          }
          // Para sub-kits, simplificamos considerando 999 (ou poderia fazer recursão)
          if (item.sub_kit_id) {
            // Buscar estoque do sub-kit
            const { data: subKitItens } = await supabase
              .from('kit_itens')
              .select('produto_id, quantidade')
              .eq('kit_id', item.sub_kit_id);

            if (subKitItens && subKitItens.length > 0) {
              let subKitMinEstoque = Infinity;
              for (const subItem of subKitItens) {
                if (subItem.produto_id) {
                  const subEstoque = estoqueProdutos[subItem.produto_id] || 0;
                  const subPossiveis = Math.floor(subEstoque / subItem.quantidade);
                  if (subPossiveis < subKitMinEstoque) {
                    subKitMinEstoque = subPossiveis;
                  }
                }
              }
              const kitsComSubKit = subKitMinEstoque !== Infinity ? Math.floor(subKitMinEstoque / item.quantidade) : 0;
              if (kitsComSubKit < minEstoque) {
                minEstoque = kitsComSubKit;
              }
            }
          }
        }

        kitEstoqueMap[kit.id] = minEstoque === Infinity ? 999 : minEstoque;
      }

      const kitsFormatados = kitsData.map(kit => ({
        id: kit.id,
        codigo: kit.codigo,
        nome: kit.nome,
        preco_total: kit.preco_total,
        descricao: kit.descricao,
        estoque_disponivel: kitEstoqueMap[kit.id] || 0
      }));

      setKits(kitsFormatados);
      console.log('✅ Kits carregados:', kitsFormatados);

    } catch (error) {
      console.error('❌ Erro ao buscar kits:', error);
      setKits([]);
    }
  };

  const produtosFiltrados = produtos.filter(produto => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase().trim();
    return (
      produto.nome?.toLowerCase().includes(search) ||
      produto.codigo?.toLowerCase().includes(search) ||
      produto.cor?.toLowerCase().includes(search) ||
      produto.descricao?.toLowerCase().includes(search) ||
      produto.categoria?.toLowerCase().includes(search)
    );
  });

  const kitsFiltrados = kits.filter(kit => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase().trim();
    return (
      kit.nome?.toLowerCase().includes(search) ||
      kit.codigo?.toLowerCase().includes(search) ||
      kit.descricao?.toLowerCase().includes(search)
    );
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getFormaPagamentoLabel = (forma: string) => {
    const formas: Record<string, string> = {
      'avista': 'À Vista',
      'boleto': 'Boleto',
      'credito': 'Cartão de Crédito',
      'debito': 'Cartão de Débito',
      'credito_cliente': 'Cliente com Crédito',
    };
    return formas[forma] || forma;
  };

  const getDescricaoCondicao = (condicao: string): string => {
    const descricoes: Record<string, string> = {
      "28": "1 parcela em 28 dias",
      "28/56": "1ª parcela em 28 dias, 2ª parcela em 56 dias",
      "0/28/56": "1ª parcela à vista, 2ª em 28 dias, 3ª em 56 dias",
      "15": "1 parcela em 15 dias",
      "15/30": "1ª parcela em 15 dias, 2ª parcela em 30 dias",
      "0/15/30": "1ª parcela à vista, 2ª em 15 dias, 3ª em 30 dias",
    };
    return descricoes[condicao] || condicao;
  };

  const formatarProdutoSelect = (produto: Produto) => {
    const nomeCurto = produto.nome.length > 40 
      ? produto.nome.substring(0, 40) + '...' 
      : produto.nome;
    
    let corInfo = produto.cor ? ` - ${produto.cor}` : '';
    let estoqueInfo = '';
    let estoqueColor = '';
    
    if (produto.estoque <= 0) {
      estoqueInfo = ` ⚠️ SEM ESTOQUE`;
      estoqueColor = 'text-red-600';
    } else if (produto.estoque < 10) {
      estoqueInfo = ` 📦 ${produto.estoque} und (baixo)`;
      estoqueColor = 'text-yellow-600';
    } else {
      estoqueInfo = ` 📦 ${produto.estoque} und`;
      estoqueColor = 'text-green-600';
    }
    
    return {
      text: `${produto.codigo} - ${nomeCurto}${corInfo} - ${formatCurrency(produto.preco)}`,
      estoqueInfo,
      estoqueColor
    };
  };

  const formatarKitSelect = (kit: any) => {
    const nomeCurto = kit.nome.length > 40 
      ? kit.nome.substring(0, 40) + '...' 
      : kit.nome;
    
    const estoque = kit.estoque_disponivel || 0;
    
    let estoqueInfo = '';
    let estoqueColor = '';
    
    if (estoque <= 0) {
      estoqueInfo = ` ⚠️ SEM ESTOQUE`;
      estoqueColor = 'text-red-600';
    } else if (estoque < 10) {
      estoqueInfo = ` 📦 ${estoque} und (baixo)`;
      estoqueColor = 'text-yellow-600';
    } else {
      estoqueInfo = ` 📦 ${estoque} und`;
      estoqueColor = 'text-green-600';
    }
    
    return {
      text: `${kit.codigo} - ${nomeCurto} - ${formatCurrency(kit.preco_total)}`,
      estoqueInfo,
      estoqueColor
    };
  };

  const addItem = () => {
    if (!itemSelecionado || quantidade <= 0) return;

    if (tipoItem === 'produto') {
      const produto = produtos.find(p => p.id === itemSelecionado);
      if (!produto) return;
      
      let precoPorKgCalculado = 0;
      if (produto.peso_kg_m && produto.peso_kg_m > 0) {
        precoPorKgCalculado = calcularPrecoPorKgReverso(
          produto.preco,
          produto.peso_kg_m,
          produto.comprimento_barra || 6
        );
      }
      
      if (produto.estoque < quantidade) {
        toast({
          title: "⚠️ Estoque insuficiente",
          description: `${produto.nome} - Estoque: ${produto.estoque}, Solicitado: ${quantidade}`,
          variant: "default",
        });
      }

      const itemId = `temp-${Date.now()}-${Math.random()}`;
      
      setItens([...itens, {
        id: itemId,
        produto_id: produto.id,
        codigo: produto.codigo,
        nome: produto.nome,
        descricao: produto.descricao || produto.nome,
        localizacao: produto.localizacao || '-',
        quantidade,
        preco_unitario: produto.preco,
        peso: produto.peso,
        desconto: desconto,
        tipo: 'produto',
        estoque_disponivel: produto.estoque,
        categoria: produto.categoria,
        cor: produto.cor,
        preco_por_kg_calculado: precoPorKgCalculado
      }]);
      
    } else {
      const kit = kits.find(k => k.id === itemSelecionado);
      if (!kit) return;

      const estoqueKit = kit.estoque_disponivel || 0;
      
      if (estoqueKit < quantidade) {
        toast({
          title: "⚠️ Estoque insuficiente",
          description: `${kit.nome} - Estoque: ${estoqueKit}, Solicitado: ${quantidade}`,
          variant: "default",
        });
      }

      const itemId = `temp-${Date.now()}-${Math.random()}`;

      setItens([...itens, {
        id: itemId,
        kit_id: kit.id,
        codigo: kit.codigo,
        nome: kit.nome,
        descricao: kit.descricao || kit.nome,
        localizacao: '-',
        quantidade,
        preco_unitario: kit.preco_total,
        peso: null,
        desconto: desconto,
        tipo: 'kit',
        estoque_disponivel: estoqueKit
      }]);
    }

    setItemSelecionado("");
    setQuantidade(1);
    setDesconto(0);
    setSearchTerm("");
  };

  const removeItem = (index: number) => {
    setItens(itens.filter((_, i) => i !== index));
    if (mostrarCalculoReverso === index) {
      setMostrarCalculoReverso(null);
    }
  };

  const calcularPagamento = () => {
    if (valorTotal <= 0) {
      setValorEntrada(0);
      setValorParcela(0);
      return;
    }

    if (formaPagamento === "avista" || !parcelado || formaPagamento === "credito_cliente") {
      setValorEntrada(valorTotal);
      setValorParcela(0);
      setParcelas(1);
      setEntradaValor(0);
      setCondicaoPagamento("");
      return;
    }

    if (formaPagamento === "boleto" || formaPagamento === "credito" || formaPagamento === "debito") {

      const totalParcelas = parcelas;
      const temEntradaHoje = condicaoPagamento?.startsWith('0/') || false;
      
      let valorCalculadoEntrada = entradaValor || 0;
      
      if (valorCalculadoEntrada > valorTotal) {
        valorCalculadoEntrada = valorTotal;
        setEntradaValor(valorTotal);
      }
      
      if (temEntradaHoje && valorCalculadoEntrada === 0) {
        valorCalculadoEntrada = Number((valorTotal * 0.5).toFixed(2));
        setEntradaValor(valorCalculadoEntrada);
      }
      
      let valorCalculadoParcela = 0;
      
      if (temEntradaHoje) {
        const valorRestante = valorTotal - valorCalculadoEntrada;
        const parcelasFuturas = totalParcelas - 1;
        
        if (parcelasFuturas > 0) {
          valorCalculadoParcela = Number((valorRestante / parcelasFuturas).toFixed(2));
        } else {
          valorCalculadoParcela = 0;
        }
      } else if (valorCalculadoEntrada > 0) {
        const valorRestante = valorTotal - valorCalculadoEntrada;
        valorCalculadoParcela = totalParcelas > 0 ? Number((valorRestante / totalParcelas).toFixed(2)) : 0;
      } else {
        valorCalculadoParcela = totalParcelas > 0 ? Number((valorTotal / totalParcelas).toFixed(2)) : 0;
      }
      
      valorCalculadoEntrada = Math.round(valorCalculadoEntrada * 100) / 100;
      valorCalculadoParcela = Math.round(valorCalculadoParcela * 100) / 100;
      
      setValorEntrada(valorCalculadoEntrada);
      setValorParcela(valorCalculadoParcela);
    }
  };

  const validarCalculoParcelas = (): boolean => {
    if (!parcelado || formaPagamento === "avista" || formaPagamento === "credito_cliente") {
      return true;
    }
    
    const temEntradaHoje = condicaoPagamento?.startsWith('0/') || false;
    const parcelasFuturas = temEntradaHoje ? parcelas - 1 : parcelas;
    const entradaNum = entradaValor || 0;
    
    const totalCalculado = Number((entradaNum + (valorParcela * parcelasFuturas)).toFixed(2));
    const diferenca = Math.abs(totalCalculado - Number(valorTotal.toFixed(2)));
    
    // Tolerância generosa para arredondamentos de centavos
    const tolerancia = Math.max(0.05, parcelas * 0.01);
    
    if (diferenca > tolerancia) {
      toast({
        title: "❌ Erro no cálculo",
        description: `Diferença de R$ ${diferenca.toFixed(2)}. Ajuste os valores.`,
        variant: "destructive",
      });
      return false;
    }
    
    return true;
  };

  const mostrarCampoEntrada = () => {
    return parcelado && formaPagamento !== "avista" && formaPagamento !== "credito_cliente";
  };

  const salvarOrcamento = async (gerarPDF: boolean = false) => {
    setLoading(true);
    
    try {
      const { data: numeroOrcamento } = await supabase.rpc('gerar_numero_orcamento');

      let totalParcelas = parcelas;
      if (condicaoPagamento?.startsWith('0/')) {
        totalParcelas = parcelas;
      }
      
      const entradaPercentual = valorEntrada > 0 ? (valorEntrada / valorTotal) * 100 : 0;
      
      let obsPagamento = "";
      
      if (formaPagamento === "avista" || !parcelado) {
        obsPagamento = `Pagamento à vista - Total: ${formatCurrency(valorTotal)}`;
      } else if (formaPagamento === "credito_cliente") {
        obsPagamento = `Pagamento com crédito do cliente - Total: ${formatCurrency(valorTotal)} - Limite do cliente: R$ ${clienteLimite.toFixed(2)}`;
      } else {
        obsPagamento = `Pagamento: ${getFormaPagamentoLabel(formaPagamento)}`;
        if (condicaoPagamento) {
          obsPagamento += ` - ${getDescricaoCondicao(condicaoPagamento)}`;
        }
        if (valorEntrada > 0) {
          obsPagamento += ` - Entrada: ${formatCurrency(valorEntrada)} (hoje)`;
        }
        if (valorParcela > 0) {
          if (condicaoPagamento?.startsWith('0/')) {
            obsPagamento += ` - ${totalParcelas - 1}x ${formatCurrency(valorParcela)}`;
          } else {
            obsPagamento += ` - ${totalParcelas}x ${formatCurrency(valorParcela)}`;
          }
        }
      }

      const observacoesCompletas = observacoes 
        ? `${obsPagamento}\n\n${observacoes}`
        : obsPagamento;

      const { data: orcamento, error: orcError } = await supabase
        .from('orcamentos')
        .insert({
          numero: numeroOrcamento,
          cliente_id: clienteId,
          vendedor_id: vendedorId || null,
          filial_id: filialId === MATRIZ_SENTINEL ? null : filialId,
          valor_total: Number(valorTotal.toFixed(2)),
          observacoes: observacoesCompletas.substring(0, 500),
          status: 'pendente',
          forma_pagamento: formaPagamento,
          condicao_pagamento: condicaoPagamento || null,
          entrada_percentual: entradaPercentual > 0 ? Number(entradaPercentual.toFixed(2)) : null,
          entrada_valor: valorEntrada > 0 ? Number(valorEntrada.toFixed(2)) : null,
          parcelas: totalParcelas || null,
          valor_parcela: valorParcela > 0 ? Number(valorParcela.toFixed(2)) : null,
          parcelado: parcelado,
          numero_parcelas: parcelado ? totalParcelas : 1,
          pagamento_misto: false,
          valor_credito_utilizado: null,
          forma_pagamento_restante: null,
          condicao_pagamento_restante: null,
          parcelas_restante: null
        })
        .select()
        .single();

      if (orcError) throw orcError;

      const orcamentoItens = itens.map(item => {
        const subtotalComDesconto = calcularSubtotalComDesconto(item);
        
        return {
          orcamento_id: orcamento.id,
          produto_id: item.tipo === 'produto' ? item.produto_id : null,
          kit_id: item.tipo === 'kit' ? item.kit_id : null,
          quantidade: item.quantidade,
          preco_unitario: Number(item.preco_unitario.toFixed(2)),
          desconto: item.desconto,
          peso: item.peso,
          subtotal: Number(subtotalComDesconto.toFixed(2))
        };
      });

      const { error: itensError } = await supabase
        .from('orcamento_itens')
        .insert(orcamentoItens);

      if (itensError) throw itensError;

      if (vendedorId) {
        const vendedorSelecionado = vendedores.find(v => v.id === vendedorId);
        if (vendedorSelecionado) {
          const valorComissao = (valorTotal * vendedorSelecionado.comissao_percentual) / 100;
          
          await supabase
            .from('comissoes')
            .insert({
              orcamento_id: orcamento.id,
              vendedor_id: vendedorId,
              valor_orcamento: valorTotal,
              percentual_comissao: vendedorSelecionado.comissao_percentual,
              valor_comissao: Number(valorComissao.toFixed(2)),
              status: 'pendente',
            });
        }
      }

      await logActivity({
        acao: "criar",
        entidade: "orcamento",
        entidadeId: orcamento.id,
        descricao: `Criou o orçamento ${numeroOrcamento} - R$ ${valorTotal.toFixed(2)}`,
      });

      toast({
        title: "✅ Orçamento criado!",
        description: `Orçamento ${numeroOrcamento} criado com sucesso.`,
      });

      if (gerarPDF) {
        setTimeout(() => {
          toast({
            title: "📄 PDF gerado!",
            description: "O arquivo será baixado em instantes.",
          });
        }, 500);
      }

      onClose();
      
    } catch (error: any) {
      console.error('❌ Erro:', error);
      toast({
        title: "❌ Erro ao criar orçamento",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (gerarPDF: boolean = false) => {
    if (!clienteId || itens.length === 0) {
      toast({
        title: "Dados incompletos",
        description: "Selecione um cliente e adicione produtos",
        variant: "destructive",
      });
      return;
    }

    if (!formaPagamento) {
      toast({
        title: "Forma de pagamento obrigatória",
        description: "Selecione uma forma de pagamento",
        variant: "destructive",
      });
      return;
    }

    const formasPagamentoOpcionais = ["credito", "debito", "credito_cliente"];
    
    if (parcelado && !formasPagamentoOpcionais.includes(formaPagamento) && !condicaoPagamento) {
      toast({
        title: "Condição de pagamento obrigatória",
        description: "Selecione uma condição de pagamento",
        variant: "destructive",
      });
      return;
    }

    if (parcelado && !validarCalculoParcelas()) {
      return;
    }

    await salvarOrcamento(gerarPDF);
  };

  const itensComFormula = contarItensComFormula();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Cliente *</label>
          <AddClienteInlineDialog
            onClienteAdded={(novoCliente) => {
              setClientes(prev => [...prev, novoCliente]);
              setClienteId(novoCliente.id);
            }}
          />
        </div>
        <Select value={clienteId || "sem_cliente"} onValueChange={(value) => {
          setClienteId(value === "sem_cliente" ? "" : value);
        }}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione um cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sem_cliente">Selecione um cliente</SelectItem>
            {clientes.map(cliente => (
              <SelectItem key={cliente.id} value={cliente.id}>
                {cliente.nome} - {cliente.cpf_cnpj}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {clienteLimite > 0 && (
          <p className="text-xs text-blue-600">
            Limite de crédito disponível: {formatCurrency(clienteLimite)}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Vendedor (opcional)</label>
        <Select value={vendedorId || "sem_vendedor"} onValueChange={(value) => {
          setVendedorId(value === "sem_vendedor" ? "" : value);
        }}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione um vendedor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sem_vendedor">Sem vendedor</SelectItem>
            {vendedores.map(vendedor => (
              <SelectItem key={vendedor.id} value={vendedor.id}>
                <div className="flex items-center justify-between w-full">
                  <span>{vendedor.nome}</span>
                  <Badge variant="outline" className="ml-2 text-xs">
                    {vendedor.comissao_percentual}%
                  </Badge>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {vendedorId && (
          <p className="text-xs text-green-600 mt-1">
            Comissão de {vendedores.find(v => v.id === vendedorId)?.comissao_percentual}% será calculada automaticamente
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Unidade</label>
        <Select value={filialId} onValueChange={setFilialId}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione a unidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={MATRIZ_SENTINEL}>Matriz</SelectItem>
            {filiais.map(filial => (
              <SelectItem key={filial.id} value={filial.id}>{filial.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground mt-1">
          Ao aprovar, o estoque será baixado a partir desta unidade.
        </p>
      </div>

      <div className="border rounded-lg p-4 space-y-4">
        <h3 className="font-semibold">Condições de Pagamento</h3>
        
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="parcelado"
              checked={parcelado}
              onChange={(e) => {
                setParcelado(e.target.checked);
                if (!e.target.checked) {
                  setFormaPagamento("avista");
                  setCondicaoPagamento("");
                  setEntradaValor(0);
                }
              }}
              className="h-4 w-4 rounded border-gray-300"
              disabled={formaPagamento === "credito_cliente"}
            />
            <label htmlFor="parcelado" className="text-sm font-medium">
              Pagamento Parcelado?
            </label>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Forma de Pagamento *</label>
              <Select value={formaPagamento || "sem_forma"} onValueChange={(value) => {
                const novaForma = value === "sem_forma" ? "" : value;
                setFormaPagamento(novaForma);
                
                if (novaForma === "credito_cliente") {
                  setParcelado(false);
                  setCondicaoPagamento("");
                  setEntradaValor(0);
                  setParcelas(1);
                } else if (novaForma === "avista") {
                  setParcelado(false);
                  setCondicaoPagamento("");
                  setEntradaValor(0);
                  setParcelas(1);
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sem_forma">Selecione uma forma</SelectItem>
                  <SelectItem value="avista">À Vista</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="credito">Cartão de Crédito</SelectItem>
                  <SelectItem value="debito">Cartão de Débito</SelectItem>
                  <SelectItem value="credito_cliente">Cliente com Crédito</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {parcelado && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Condição de Pagamento 
                    {formaPagamento !== "credito" && formaPagamento !== "debito" && " *"}
                  </label>
                  <Select 
                    value={condicaoPagamento || "sem_condicao"} 
                    onValueChange={(value) => {
                      setCondicaoPagamento(value === "sem_condicao" ? "" : value);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={
                        formaPagamento === "credito" || formaPagamento === "debito"
                          ? "Opcional - pode selecionar se desejar" 
                          : "Selecione"
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sem_condicao">
                        {formaPagamento === "credito" || formaPagamento === "debito" 
                          ? "Sem condição especial" 
                          : "Selecione uma condição"}
                      </SelectItem>
                      <SelectItem value="28">28 dias</SelectItem>
                      <SelectItem value="28/56">28/56 dias</SelectItem>
                      <SelectItem value="0/28/56">0/28/56 dias</SelectItem>
                      <SelectItem value="15">15 dias</SelectItem>
                      <SelectItem value="15/30">15/30 dias</SelectItem>
                      <SelectItem value="0/15/30">0/15/30 dias</SelectItem>
                    </SelectContent>
                  </Select>
                  {(formaPagamento === "credito" || formaPagamento === "debito") && (
                    <p className="text-xs text-muted-foreground mt-1">
                      A condição de pagamento é opcional para cartão de crédito e débito
                    </p>
                  )}
                </div>

                {mostrarCampoEntrada() && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Valor da Entrada (R$)</label>
                    <Input
                      type="number"
                      min="0"
                      max={valorTotal}
                      step="0.01"
                      value={entradaValor === 0 ? "" : entradaValor}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === "" || raw === "-") {
                          setEntradaValor(0);
                        } else {
                          const parsed = parseFloat(raw);
                          if (!isNaN(parsed)) setEntradaValor(parsed);
                        }
                      }}
                      placeholder="Sem entrada (opcional)"
                    />
                    <p className="text-xs text-muted-foreground">
                      {condicaoPagamento?.startsWith('0/') 
                        ? "Entrada obrigatória - vencimento hoje"
                        : "Deixe em branco para não ter entrada"}
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium">Número de Parcelas</label>
                  <Input
                    type="number"
                    min="1"
                    max="60"
                    value={parcelas}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val) && val >= 1) setParcelas(val);
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    {condicaoPagamento
                      ? "Condição especial selecionada - ajuste livremente o número de parcelas"
                      : "Informe quantas parcelas"}
                  </p>
                </div>
              </>
            )}
          </div>

          {valorTotal > 0 && formaPagamento && (
            <div className="pt-4 border-t">
              <h4 className="font-medium mb-2">Resumo do Pagamento:</h4>
              <div className="bg-gray-50 p-3 rounded-lg text-sm space-y-1">
                <div className="flex justify-between">
                  <span>Valor Total:</span>
                  <span className="font-bold">{formatCurrency(valorTotal)}</span>
                </div>
                
                {formaPagamento === "credito_cliente" ? (
                  <div className="flex justify-between text-purple-600">
                    <span>Pagamento:</span>
                    <span className="font-medium">Crédito do Cliente</span>
                  </div>
                ) : !parcelado || formaPagamento === "avista" ? (
                  <div className="flex justify-between text-green-600">
                    <span>Pagamento:</span>
                    <span className="font-medium">À Vista</span>
                  </div>
                ) : (
                  <>
                    {valorEntrada > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Entrada (hoje):</span>
                        <span className="font-medium">{formatCurrency(valorEntrada)}</span>
                      </div>
                    )}
                    
                    {valorParcela > 0 && (
                      <>
                        <div className="flex justify-between">
                          <span>
                            {condicaoPagamento?.startsWith('0/') 
                              ? `${parcelas - 1}x de:`
                              : `${parcelas}x de:`}
                          </span>
                          <span className="font-medium">{formatCurrency(valorParcela)}</span>
                        </div>
                        
                        <div className="flex justify-between text-xs text-gray-500 pt-1 border-t border-gray-200 mt-1">
                          <span>Total parcelado:</span>
                          <span>
                            {formatCurrency(
                              condicaoPagamento?.startsWith('0/')
                                ? valorParcela * (parcelas - 1)
                                : valorParcela * parcelas
                            )}
                          </span>
                        </div>
                      </>
                    )}
                    
                    {condicaoPagamento && (
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Condição:</span>
                        <span>{getDescricaoCondicao(condicaoPagamento)}</span>
                      </div>
                    )}
                  </>
                )}
                
                {valorEntrada > 0 && valorEntrada < valorTotal && (
                  <div className="flex justify-between text-xs text-blue-600 pt-1 border-t border-blue-200 mt-1">
                    <span>Saldo após entrada:</span>
                    <span className="font-medium">{formatCurrency(valorTotal - valorEntrada)}</span>
                  </div>
                )}

                {vendedorId && (
                  <div className="flex justify-between text-xs text-green-600 pt-1 border-t border-green-200 mt-1">
                    <span>Comissão do vendedor:</span>
                    <span className="font-medium">
                      {formatCurrency((valorTotal * (vendedores.find(v => v.id === vendedorId)?.comissao_percentual || 0)) / 100)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border rounded-lg p-4 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold">Adicionar Itens</h3>
          {itensComFormula > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMostrarAplicarTodos(true)}
              className="gap-2"
            >
              <Zap className="h-4 w-4" />
              Aplicar Preço por Kg para Todos
            </Button>
          )}
        </div>

        {mostrarAplicarTodos && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h5 className="font-medium text-sm text-green-800">
                Aplicar Preço por Kg para Todos os Itens
              </h5>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setMostrarAplicarTodos(false);
                  setPrecoPorKgTodos("");
                }}
                className="h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="text-xs">Preço por Kg para Todos os Itens</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Digite o preço por kg para todos"
                    value={precoPorKgTodos}
                    onChange={(e) => setPrecoPorKgTodos(e.target.value)}
                    className="h-8 flex-1"
                  />
                  <Button 
                    size="sm" 
                    onClick={() => {
                      const precoPorKg = parseFloat(precoPorKgTodos) || 0;
                      if (precoPorKg > 0) {
                        aplicarPrecoPorKgTodos(precoPorKg);
                      } else {
                        toast({
                          title: "Valor inválido",
                          description: "Digite um preço por kg válido",
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    Aplicar para Todos
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => aplicarDescontoPrecoPorKgTodos(5)}
                  className="text-xs"
                >
                  -5% Todos
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => aplicarDescontoPrecoPorKgTodos(10)}
                  className="text-xs"
                >
                  -10% Todos
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => aplicarDescontoPrecoPorKgTodos(15)}
                  className="text-xs"
                >
                  -15% Todos
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Esta ação aplicará o mesmo preço por kg para todos os {itensComFormula} itens que usam a fórmula de cálculo.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium">Pesquisar</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por nome, código ou cor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
          <div className="space-y-2">
            <label className="text-sm font-medium">Tipo</label>
            <Select value={tipoItem} onValueChange={(value: 'produto' | 'kit') => {
              setTipoItem(value);
              setItemSelecionado("");
            }}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="produto">Produto</SelectItem>
                <SelectItem value="kit">Kit</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="md:sm:col-span-2 space-y-2">
            <label className="text-sm font-medium">{tipoItem === 'produto' ? 'Produto' : 'Kit'}</label>
            <Select value={itemSelecionado || "sem_item"} onValueChange={(value) => {
              setItemSelecionado(value === "sem_item" ? "" : value);
            }}>
              <SelectTrigger>
                <SelectValue placeholder={`Selecione um ${tipoItem}`} />
              </SelectTrigger>
              <SelectContent className="max-w-[500px]">
                <SelectItem value="sem_item">Selecione um {tipoItem}</SelectItem>
                {tipoItem === 'produto' ? (
                  produtosFiltrados.length > 0 ? (
                    produtosFiltrados.map(produto => {
                      const formatted = formatarProdutoSelect(produto);
                      return (
                        <SelectItem key={produto.id} value={produto.id} className="py-2">
                          <div className="flex flex-col">
                            <span className="font-medium">{formatted.text}</span>
                            <span className={`text-xs ${formatted.estoqueColor}`}>
                              {formatted.estoqueInfo}
                              {produto.peso_kg_m && ` | ${produto.peso_kg_m}kg/m`}
                            </span>
                          </div>
                        </SelectItem>
                      );
                    })
                  ) : (
                    <SelectItem value="sem_item" disabled>
                      Nenhum produto encontrado
                    </SelectItem>
                  )
                ) : (
                  kitsFiltrados.length > 0 ? (
                    kitsFiltrados.map(kit => {
                      const formatted = formatarKitSelect(kit);
                      return (
                        <SelectItem key={kit.id} value={kit.id} className="py-2">
                          <div className="flex flex-col">
                            <span className="font-medium">{formatted.text}</span>
                            <span className={`text-xs ${formatted.estoqueColor}`}>
                              {formatted.estoqueInfo}
                            </span>
                          </div>
                        </SelectItem>
                      );
                    })
                  ) : (
                    <SelectItem value="sem_item" disabled>
                      Nenhum kit com estoque disponível
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Qtd</label>
            <Input
              type="number"
              min="1"
              value={quantidade}
              onChange={(e) => setQuantidade(parseInt(e.target.value) || 1)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Desc. %</label>
            <div className="flex gap-2">
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={desconto}
                onChange={(e) => setDesconto(parseFloat(e.target.value) || 0)}
              />
              <Button 
                onClick={addItem} 
                type="button" 
                size="icon"
                disabled={!itemSelecionado || quantidade <= 0}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {itens.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium">Itens do Orçamento:</h4>
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {itens.map((item, index) => {
                const subtotalBruto = item.quantidade * item.preco_unitario;
                const valorDesconto = (subtotalBruto * item.desconto) / 100;
                const subtotalLiquido = subtotalBruto - valorDesconto;
                const usaFormula = produtoUsaFormula(item);
                const produtoOriginal = produtos.find(p => p.id === item.produto_id);
                const semEstoque = item.estoque_disponivel !== undefined && item.quantidade > item.estoque_disponivel;
                
                return (
                  <div key={item.id} className={`grid grid-cols-1 sm:grid-cols-12 gap-2 items-start sm:items-center p-3 rounded-lg ${semEstoque ? 'bg-yellow-100 border border-yellow-300' : 'bg-secondary'}`}>
                    <div className="sm:col-span-4">
                      <p className="font-medium text-sm">{item.descricao}</p>
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        <span>Cód: {item.codigo}</span>
                        <span>| {item.tipo}</span>
                        {item.cor && <span>| Cor: {item.cor}</span>}
                        {semEstoque && (
                          <span className="text-yellow-700 font-medium">
                            ⚠️ Estoque: {item.estoque_disponivel}
                          </span>
                        )}
                      </div>
                      {usaFormula && produtoOriginal && (
                        <div className="flex gap-2 text-xs text-blue-700">
                          <span>Peso: {produtoOriginal.peso_kg_m}kg/m</span>
                          {item.preco_por_kg_calculado && (
                            <span>R$ {item.preco_por_kg_calculado.toFixed(2)}/kg</span>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="sm:col-span-1">
                      <label className="text-xs">Qtd</label>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantidade}
                        onChange={(e) => {
                          const newItens = [...itens];
                          newItens[index].quantidade = parseInt(e.target.value) || 1;
                          setItens(newItens);
                        }}
                        className="h-8"
                      />
                    </div>
                    
                    <div className="sm:col-span-2">
                      <label className="text-xs">Preço Unit.</label>
                      <div className="flex gap-1">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.preco_unitario}
                          onChange={(e) => {
                            handlePrecoUnitarioChange(index, parseFloat(e.target.value) || 0);
                          }}
                          className="h-8 flex-1"
                        />
                        {usaFormula && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => abrirModalCalculoReverso(index)}
                            className="h-8 w-8"
                            title="Calcular preço por kg"
                          >
                            <Calculator className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    <div className="sm:col-span-1">
                      <label className="text-xs">Desc. %</label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={item.desconto}
                        onChange={(e) => {
                          const newItens = [...itens];
                          newItens[index].desconto = parseFloat(e.target.value) || 0;
                          setItens(newItens);
                        }}
                        className="h-8"
                      />
                    </div>
                    
                    <div className="sm:col-span-3 text-right">
                      <p className="text-xs text-muted-foreground">R$ {subtotalBruto.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">-{item.desconto}% = R$ {valorDesconto.toFixed(2)}</p>
                      <p className="font-semibold text-sm">R$ {subtotalLiquido.toFixed(2)}</p>
                    </div>
                    
                    <div className="sm:col-span-1 text-right">
                      <Button
                        size="icon"
                        variant="destructive"
                        onClick={() => removeItem(index)}
                        className="h-8 w-8"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {mostrarCalculoReverso === index && usaFormula && produtoOriginal && (
                      <div className="sm:sm:col-span-12 mt-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="font-medium text-sm text-blue-800">Cálculo do Preço por Kg</h5>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setMostrarCalculoReverso(null);
                              setNovoPrecoPorKg("");
                            }}
                            className="h-6 w-6 p-0"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                          <div>
                            <label className="text-xs">Peso kg/m</label>
                            <Input value={produtoOriginal.peso_kg_m} disabled className="h-8" />
                          </div>
                          <div>
                            <label className="text-xs">Comprimento (m)</label>
                            <Input value={produtoOriginal.comprimento_barra || 6} disabled className="h-8" />
                          </div>
                          <div>
                            <label className="text-xs">Peso Total (kg)</label>
                            <Input 
                              value={((produtoOriginal.peso_kg_m || 0) * (produtoOriginal.comprimento_barra || 6)).toFixed(3)} 
                              disabled 
                              className="h-8" 
                            />
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                          <div>
                            <label className="text-xs">Preço de Venda Atual</label>
                            <Input value={item.preco_unitario.toFixed(2)} disabled className="h-8" />
                          </div>
                          <div>
                            <label className="text-xs">Preço por Kg Calculado</label>
                            <Input 
                              value={item.preco_por_kg_calculado?.toFixed(2) || '0.00'} 
                              disabled 
                              className="h-8" 
                            />
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <label className="text-xs">Definir Novo Preço por Kg</label>
                            <div className="flex gap-2">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="Digite o preço por kg"
                                value={novoPrecoPorKg}
                                onChange={(e) => setNovoPrecoPorKg(e.target.value)}
                                className="h-8 flex-1"
                              />
                              <Button 
                                size="sm" 
                                onClick={() => {
                                  const precoPorKg = parseFloat(novoPrecoPorKg) || 0;
                                  if (precoPorKg > 0) {
                                    aplicarPrecoPorKg(index, precoPorKg);
                                  } else {
                                    toast({
                                      title: "Valor inválido",
                                      description: "Digite um preço por kg válido",
                                      variant: "destructive",
                                    });
                                  }
                                }}
                              >
                                Aplicar
                              </Button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => aplicarDescontoPrecoPorKg(index, 5)}
                              className="text-xs"
                            >
                              -5%
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => aplicarDescontoPrecoPorKg(index, 10)}
                              className="text-xs"
                            >
                              -10%
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => aplicarDescontoPrecoPorKg(index, 15)}
                              className="text-xs"
                            >
                              -15%
                            </Button>
                          </div>

                          <p className="text-xs text-muted-foreground mt-2">
                            <strong>Fórmula:</strong> Preço por Kg = Preço de Venda ÷ (Peso kg/m × Comprimento)
                            <br />
                            <strong>Exemplo:</strong> R$ {item.preco_unitario.toFixed(2)} ÷ ({produtoOriginal.peso_kg_m} × {produtoOriginal.comprimento_barra || 6}) = R$ {item.preco_por_kg_calculado?.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="pt-2 border-t text-right">
              <p className="text-xl font-bold">
                Total: {formatCurrency(valorTotal)}
              </p>
              <p className="text-xs text-muted-foreground">
                {itens.length} item(ns) adicionado(s) | {itensComFormula} com fórmula de cálculo
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Observações</label>
        <textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="Informações adicionais..."
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button 
          onClick={() => handleSubmit(false)} 
          disabled={loading || !formaPagamento || itens.length === 0 || !clienteId}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
        </Button>
        <Button 
          onClick={() => handleSubmit(true)} 
          disabled={loading || !formaPagamento || itens.length === 0 || !clienteId} 
          variant="outline"
        >
          <Download className="h-4 w-4 mr-2" />
          Salvar e PDF
        </Button>
      </div>
    </div>
  );
};

// ========== COMPONENTE DE EDITAR ORÇAMENTO ==========
const EditOrcamentoContent = ({ orcamento, onClose }: { orcamento: OrcamentoComItens, onClose: () => void }) => {
  const [loading, setLoading] = useState(false);
  const [clientes, setClientes] = useState<any[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [kits, setKits] = useState<any[]>([]);
  
  const [clienteId, setClienteId] = useState(orcamento.cliente_id);
  const [vendedorId, setVendedorId] = useState<string>(orcamento.vendedor_id || "");
  const [filiais, setFiliais] = useState<Filial[]>([]);
  const [filialId, setFilialId] = useState<string>(orcamento.filial_id || MATRIZ_SENTINEL);
  const [observacoes, setObservacoes] = useState(orcamento.observacoes || "");
  const [itens, setItens] = useState<ItemOrcamento[]>([]);
  
  const [formaPagamento, setFormaPagamento] = useState<string>(orcamento.forma_pagamento || "");
  const [condicaoPagamento, setCondicaoPagamento] = useState<string>(orcamento.condicao_pagamento || "");
  const [entradaValor, setEntradaValor] = useState<number>(orcamento.entrada_valor || 0);
  const [parcelas, setParcelas] = useState<number>(orcamento.parcelas || 1);
  const [valorEntrada, setValorEntrada] = useState<number>(orcamento.entrada_valor || 0);
  const [valorParcela, setValorParcela] = useState<number>(orcamento.valor_parcela || 0);
  const [parcelado, setParcelado] = useState<boolean>(orcamento.parcelado || false);
  const [clienteLimite, setClienteLimite] = useState<number>(0);
  
  const [tipoItem, setTipoItem] = useState<'produto' | 'kit'>('produto');
  const [itemSelecionado, setItemSelecionado] = useState("");
  const [quantidade, setQuantidade] = useState(1);
  const [desconto, setDesconto] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  
  const [mostrarCalculoReverso, setMostrarCalculoReverso] = useState<number | null>(null);
  const [novoPrecoPorKg, setNovoPrecoPorKg] = useState<string>("");
  const [mostrarAplicarTodos, setMostrarAplicarTodos] = useState(false);
  const [precoPorKgTodos, setPrecoPorKgTodos] = useState<string>("");

  const calcularPrecoPorKgReverso = (precoVenda: number, pesoKgM: number, comprimentoBarra: number = 6) => {
    const pesoTotal = pesoKgM * comprimentoBarra;
    if (pesoTotal <= 0) return 0;
    return precoVenda / pesoTotal;
  };

  const calcularPrecoVenda = (precoPorKg: number, pesoKgM: number, comprimentoBarra: number = 6) => {
    const pesoTotal = pesoKgM * comprimentoBarra;
    return pesoTotal * precoPorKg;
  };

  const produtoUsaFormula = (item: ItemOrcamento) => {
    if (item.tipo !== 'produto') return false;
    const produto = produtos.find(p => p.id === item.produto_id);
    return produto && produto.peso_kg_m && produto.peso_kg_m > 0;
  };

  const contarItensComFormula = () => {
    return itens.filter(item => produtoUsaFormula(item)).length;
  };

  const handlePrecoUnitarioChange = (index: number, novoPrecoUnitario: number) => {
    const newItens = [...itens];
    const item = newItens[index];
    
    if (item.tipo === 'produto') {
      const produtoOriginal = produtos.find(p => p.id === item.produto_id);
      if (produtoOriginal?.peso_kg_m && produtoOriginal.peso_kg_m > 0) {
        const precoPorKgCalculado = calcularPrecoPorKgReverso(
          novoPrecoUnitario, 
          produtoOriginal.peso_kg_m, 
          produtoOriginal.comprimento_barra || 6
        );
        
        newItens[index] = {
          ...item,
          preco_unitario: novoPrecoUnitario,
          preco_por_kg_calculado: precoPorKgCalculado
        };
      } else {
        newItens[index].preco_unitario = novoPrecoUnitario;
      }
    } else {
      newItens[index].preco_unitario = novoPrecoUnitario;
    }
    
    setItens(newItens);
  };

  const aplicarPrecoPorKg = (index: number, precoPorKg: number) => {
    const newItens = [...itens];
    const item = newItens[index];
    
    if (item.tipo === 'produto') {
      const produtoOriginal = produtos.find(p => p.id === item.produto_id);
      if (produtoOriginal?.peso_kg_m && produtoOriginal.peso_kg_m > 0) {
        const novoPrecoVenda = calcularPrecoVenda(
          precoPorKg,
          produtoOriginal.peso_kg_m,
          produtoOriginal.comprimento_barra || 6
        );
        
        newItens[index] = {
          ...item,
          preco_unitario: parseFloat(novoPrecoVenda.toFixed(2)),
          preco_por_kg_calculado: precoPorKg
        };
        
        setItens(newItens);
        setNovoPrecoPorKg("");
        setMostrarCalculoReverso(null);
        
        toast({
          title: "Preço atualizado!",
          description: `Preço por kg aplicado: R$ ${precoPorKg.toFixed(2)} | Novo preço: R$ ${novoPrecoVenda.toFixed(2)}`,
        });
      }
    }
  };

  const aplicarDescontoPrecoPorKg = (index: number, percentualDesconto: number) => {
    const item = itens[index];
    if (item.preco_por_kg_calculado && percentualDesconto > 0) {
      const novoPrecoPorKg = item.preco_por_kg_calculado * (1 - percentualDesconto / 100);
      aplicarPrecoPorKg(index, parseFloat(novoPrecoPorKg.toFixed(2)));
    }
  };

  const abrirModalCalculoReverso = (index: number) => {
    setMostrarCalculoReverso(index);
    const item = itens[index];
    if (item.preco_por_kg_calculado) {
      setNovoPrecoPorKg(item.preco_por_kg_calculado.toFixed(2));
    } else {
      setNovoPrecoPorKg("");
    }
  };

  const aplicarPrecoPorKgTodos = (precoPorKg: number) => {
    const newItens = [...itens];
    let itensAtualizados = 0;
    
    newItens.forEach((item, index) => {
      if (item.tipo === 'produto') {
        const produtoOriginal = produtos.find(p => p.id === item.produto_id);
        if (produtoOriginal?.peso_kg_m && produtoOriginal.peso_kg_m > 0) {
          const novoPrecoVenda = calcularPrecoVenda(
            precoPorKg,
            produtoOriginal.peso_kg_m,
            produtoOriginal.comprimento_barra || 6
          );
          
          newItens[index] = {
            ...item,
            preco_unitario: parseFloat(novoPrecoVenda.toFixed(2)),
            preco_por_kg_calculado: precoPorKg
          };
          itensAtualizados++;
        }
      }
    });
    
    setItens(newItens);
    setPrecoPorKgTodos("");
    setMostrarAplicarTodos(false);
    
    toast({
      title: "Preço aplicado para todos!",
      description: `Preço por kg R$ ${precoPorKg.toFixed(2)} aplicado em ${itensAtualizados} itens do orçamento`,
    });
  };

  const aplicarDescontoPrecoPorKgTodos = (percentualDesconto: number) => {
    const newItens = [...itens];
    let itensAtualizados = 0;
    
    newItens.forEach((item, index) => {
      if (item.tipo === 'produto' && item.preco_por_kg_calculado) {
        const produtoOriginal = produtos.find(p => p.id === item.produto_id);
        if (produtoOriginal?.peso_kg_m && produtoOriginal.peso_kg_m > 0) {
          const novoPrecoPorKg = item.preco_por_kg_calculado * (1 - percentualDesconto / 100);
          const novoPrecoVenda = calcularPrecoVenda(
            novoPrecoPorKg,
            produtoOriginal.peso_kg_m,
            produtoOriginal.comprimento_barra || 6
          );
          
          newItens[index] = {
            ...item,
            preco_unitario: parseFloat(novoPrecoVenda.toFixed(2)),
            preco_por_kg_calculado: parseFloat(novoPrecoPorKg.toFixed(2))
          };
          itensAtualizados++;
        }
      }
    });
    
    setItens(newItens);
    
    toast({
      title: "Desconto aplicado para todos!",
      description: `Desconto de ${percentualDesconto}% aplicado em ${itensAtualizados} itens do orçamento`,
    });
  };

  const calcularSubtotalComDesconto = (item: ItemOrcamento) => {
    const subtotal = item.quantidade * item.preco_unitario;
    const valorDesconto = (subtotal * item.desconto) / 100;
    return subtotal - valorDesconto;
  };

  const calcularValorTotal = () => {
    return itens.reduce((sum, item) => sum + calcularSubtotalComDesconto(item), 0);
  };

  const valorTotal = calcularValorTotal();

  useEffect(() => {
    fetchClientes();
    fetchVendedores();
    fetchFiliais();
    fetchProdutos();
    fetchKits();
  }, []);

  useEffect(() => {
    if (valorTotal > 0) {
      calcularPagamento();
    }
  }, [formaPagamento, condicaoPagamento, entradaValor, parcelas, valorTotal, parcelado]);

  useEffect(() => {
    if (clienteId) {
      fetchClienteLimite();
    } else {
      setClienteLimite(0);
    }
  }, [clienteId]);

  useEffect(() => {
    // Converter itens do orçamento para o formato do componente
    if (orcamento.orcamento_itens && produtos.length > 0 && kits.length > 0) {
      const itensConvertidos: ItemOrcamento[] = orcamento.orcamento_itens.map(item => {
        // Verifica se é um produto
        if (item.produto_id && typeof item.produto_id === 'string' && item.produto_id.trim() !== '') {
          const produto = produtos.find(p => p.id === item.produto_id);
          
          let precoPorKgCalculado = 0;
          if (produto?.peso_kg_m && produto.peso_kg_m > 0) {
            precoPorKgCalculado = calcularPrecoPorKgReverso(
              item.preco_unitario,
              produto.peso_kg_m,
              produto.comprimento_barra || 6
            );
          }
          
          return {
            id: item.id,
            produto_id: item.produto_id,
            codigo: produto?.codigo || '',
            nome: produto?.nome || 'Produto não encontrado',
            descricao: produto?.descricao || produto?.nome || 'Produto não encontrado',
            localizacao: produto?.localizacao || '-',
            quantidade: item.quantidade,
            preco_unitario: item.preco_unitario,
            peso: item.peso,
            desconto: item.desconto || 0,
            tipo: 'produto' as const,
            estoque_disponivel: produto?.estoque,
            categoria: produto?.categoria,
            cor: produto?.cor,
            preco_por_kg_calculado: precoPorKgCalculado
          };
        } 
        // Verifica se é um kit
        else if (item.kit_id && typeof item.kit_id === 'string' && item.kit_id.trim() !== '') {
          const kit = kits.find(k => k.id === item.kit_id);
          return {
            id: item.id,
            kit_id: item.kit_id,
            codigo: kit?.codigo || '',
            nome: kit?.nome || 'Kit não encontrado',
            descricao: kit?.descricao || kit?.nome || 'Kit não encontrado',
            localizacao: '-',
            quantidade: item.quantidade,
            preco_unitario: item.preco_unitario,
            peso: null,
            desconto: item.desconto || 0,
            tipo: 'kit' as const,
            estoque_disponivel: kit?.estoque_disponivel
          };
        }
        // Fallback para itens sem produto_id e sem kit_id
        else {
          console.warn('Item sem produto_id e sem kit_id:', item);
          return {
            id: item.id,
            codigo: 'N/A',
            nome: 'Item inválido',
            descricao: 'Item inválido',
            localizacao: '-',
            quantidade: item.quantidade,
            preco_unitario: item.preco_unitario,
            peso: null,
            desconto: item.desconto || 0,
            tipo: 'produto' as const,
          };
        }
      });
      
      console.log('Itens convertidos:', itensConvertidos);
      setItens(itensConvertidos);
    }
  }, [orcamento, produtos, kits]);

  const fetchClienteLimite = async () => {
    const { data } = await supabase
      .from('clientes')
      .select('limite_credito')
      .eq('id', clienteId)
      .single();
    
    if (data) {
      setClienteLimite(data.limite_credito || 0);
    }
  };

  const fetchClientes = async () => {
    const { data } = await supabase
      .from('clientes')
      .select('*')
      .order('nome');
    if (data) setClientes(data);
  };

  const fetchVendedores = async () => {
    const { data } = await supabase
      .from('vendedores')
      .select('*')
      .eq('ativo', true)
      .order('nome');
    if (data) setVendedores(data as Vendedor[]);
  };

  const fetchFiliais = async () => {
    const { data } = await supabase
      .from('filiais')
      .select('id, nome, codigo')
      .eq('ativo', true)
      .order('nome');
    if (data) setFiliais(data as Filial[]);
  };

  const fetchProdutos = async () => {
    const { data } = await supabase
      .from('produtos')
      .select('id, codigo, nome, descricao, cor, preco, peso, estoque, localizacao, categoria, peso_kg_m, comprimento_barra, ativo, unidade, preco_por_kg, custo')
      .eq('ativo', true)
      .order('nome');
    if (data) setProdutos(data as Produto[]);
  };

  const fetchKits = async () => {
    try {
      console.log('🔍 Buscando kits com estoque...');

      const { data: kitsData, error: kitsError } = await supabase
        .from('kits')
        .select('id, codigo, nome, preco_total, descricao, ativo')
        .eq('ativo', true)
        .order('nome');

      if (kitsError) {
        console.error('❌ Erro ao buscar kits:', kitsError);
        setKits([]);
        return;
      }

      if (!kitsData || kitsData.length === 0) {
        console.log('📦 Nenhum kit encontrado');
        setKits([]);
        return;
      }

      // Buscar todos os itens dos kits
      const kitIds = kitsData.map(k => k.id);

      const { data: kitItensData, error: kitItensError } = await supabase
        .from('kit_itens')
        .select('id, kit_id, produto_id, sub_kit_id, quantidade')
        .in('kit_id', kitIds);

      if (kitItensError) {
        console.error('❌ Erro ao buscar itens dos kits:', kitItensError);
        setKits([]);
        return;
      }

      // Buscar estoque dos produtos
      const produtoIds = kitItensData?.filter(i => i.produto_id).map(i => i.produto_id) || [];
      
      // Só fazer a consulta se houver produtoIds
      const estoqueProdutos: Record<string, number> = {};
      if (produtoIds.length > 0) {
        const { data: produtosEstoque } = await supabase
          .from('produtos')
          .select('id, estoque')
          .in('id', produtoIds);

        (produtosEstoque || []).forEach(p => {
          estoqueProdutos[p.id] = p.estoque || 0;
        });
      }

      // Calcular estoque disponível para cada kit
      const kitEstoqueMap: Record<string, number> = {};

      for (const kit of kitsData) {
        const itensDoKit = kitItensData?.filter(i => i.kit_id === kit.id) || [];

        if (itensDoKit.length === 0) {
          kitEstoqueMap[kit.id] = 999;
          continue;
        }

        let minEstoque = Infinity;

        for (const item of itensDoKit) {
          if (item.produto_id) {
            const estoqueDisponivel = estoqueProdutos[item.produto_id] || 0;
            const kitsPossiveis = Math.floor(estoqueDisponivel / item.quantidade);
            if (kitsPossiveis < minEstoque) {
              minEstoque = kitsPossiveis;
            }
          }
          // Para sub-kits
          if (item.sub_kit_id) {
            const { data: subKitItens } = await supabase
              .from('kit_itens')
              .select('produto_id, quantidade')
              .eq('kit_id', item.sub_kit_id);

            if (subKitItens && subKitItens.length > 0) {
              let subKitMinEstoque = Infinity;
              for (const subItem of subKitItens) {
                if (subItem.produto_id) {
                  const subEstoque = estoqueProdutos[subItem.produto_id] || 0;
                  const subPossiveis = Math.floor(subEstoque / subItem.quantidade);
                  if (subPossiveis < subKitMinEstoque) {
                    subKitMinEstoque = subPossiveis;
                  }
                }
              }
              const kitsComSubKit = subKitMinEstoque !== Infinity ? Math.floor(subKitMinEstoque / item.quantidade) : 0;
              if (kitsComSubKit < minEstoque) {
                minEstoque = kitsComSubKit;
              }
            }
          }
        }

        kitEstoqueMap[kit.id] = minEstoque === Infinity ? 999 : minEstoque;
      }

      const kitsFormatados = kitsData.map(kit => ({
        id: kit.id,
        codigo: kit.codigo,
        nome: kit.nome,
        preco_total: kit.preco_total,
        descricao: kit.descricao,
        estoque_disponivel: kitEstoqueMap[kit.id] || 0
      }));

      setKits(kitsFormatados);
      console.log('✅ Kits carregados:', kitsFormatados);

    } catch (error) {
      console.error('❌ Erro ao buscar kits:', error);
      setKits([]);
    }
  };

  const produtosFiltrados = produtos.filter(produto => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase().trim();
    return (
      produto.nome?.toLowerCase().includes(search) ||
      produto.codigo?.toLowerCase().includes(search) ||
      produto.cor?.toLowerCase().includes(search) ||
      produto.descricao?.toLowerCase().includes(search) ||
      produto.categoria?.toLowerCase().includes(search)
    );
  });

  const kitsFiltrados = kits.filter(kit => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase().trim();
    return (
      kit.nome?.toLowerCase().includes(search) ||
      kit.codigo?.toLowerCase().includes(search) ||
      kit.descricao?.toLowerCase().includes(search)
    );
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const getFormaPagamentoLabel = (forma: string) => {
    const formas: Record<string, string> = {
      'avista': 'À Vista',
      'boleto': 'Boleto',
      'credito': 'Cartão de Crédito',
      'debito': 'Cartão de Débito',
      'credito_cliente': 'Cliente com Crédito',
    };
    return formas[forma] || forma;
  };

  const getDescricaoCondicao = (condicao: string): string => {
    const descricoes: Record<string, string> = {
      "28": "1 parcela em 28 dias",
      "28/56": "1ª parcela em 28 dias, 2ª parcela em 56 dias",
      "0/28/56": "1ª parcela à vista, 2ª em 28 dias, 3ª em 56 dias",
      "15": "1 parcela em 15 dias",
      "15/30": "1ª parcela em 15 dias, 2ª parcela em 30 dias",
      "0/15/30": "1ª parcela à vista, 2ª em 15 dias, 3ª em 30 dias",
    };
    return descricoes[condicao] || condicao;
  };

  const formatarProdutoSelect = (produto: Produto) => {
    const nomeCurto = produto.nome.length > 40 
      ? produto.nome.substring(0, 40) + '...' 
      : produto.nome;
    
    let corInfo = produto.cor ? ` - ${produto.cor}` : '';
    let estoqueInfo = '';
    let estoqueColor = '';
    
    if (produto.estoque <= 0) {
      estoqueInfo = ` ⚠️ SEM ESTOQUE`;
      estoqueColor = 'text-red-600';
    } else if (produto.estoque < 10) {
      estoqueInfo = ` 📦 ${produto.estoque} und (baixo)`;
      estoqueColor = 'text-yellow-600';
    } else {
      estoqueInfo = ` 📦 ${produto.estoque} und`;
      estoqueColor = 'text-green-600';
    }
    
    return {
      text: `${produto.codigo} - ${nomeCurto}${corInfo} - ${formatCurrency(produto.preco)}`,
      estoqueInfo,
      estoqueColor
    };
  };

  const formatarKitSelect = (kit: any) => {
    const nomeCurto = kit.nome.length > 40 
      ? kit.nome.substring(0, 40) + '...' 
      : kit.nome;
    
    const estoque = kit.estoque_disponivel || 0;
    
    let estoqueInfo = '';
    let estoqueColor = '';
    
    if (estoque <= 0) {
      estoqueInfo = ` ⚠️ SEM ESTOQUE`;
      estoqueColor = 'text-red-600';
    } else if (estoque < 10) {
      estoqueInfo = ` 📦 ${estoque} und (baixo)`;
      estoqueColor = 'text-yellow-600';
    } else {
      estoqueInfo = ` 📦 ${estoque} und`;
      estoqueColor = 'text-green-600';
    }
    
    return {
      text: `${kit.codigo} - ${nomeCurto} - ${formatCurrency(kit.preco_total)}`,
      estoqueInfo,
      estoqueColor
    };
  };

  const addItem = () => {
    if (!itemSelecionado || quantidade <= 0) return;

    if (tipoItem === 'produto') {
      const produto = produtos.find(p => p.id === itemSelecionado);
      if (!produto) return;
      
      let precoPorKgCalculado = 0;
      if (produto.peso_kg_m && produto.peso_kg_m > 0) {
        precoPorKgCalculado = calcularPrecoPorKgReverso(
          produto.preco,
          produto.peso_kg_m,
          produto.comprimento_barra || 6
        );
      }
      
      if (produto.estoque < quantidade) {
        toast({
          title: "⚠️ Estoque insuficiente",
          description: `${produto.nome} - Estoque: ${produto.estoque}, Solicitado: ${quantidade}`,
          variant: "default",
        });
      }

      const itemId = `temp-${Date.now()}-${Math.random()}`;

      setItens([...itens, {
        id: itemId,
        produto_id: produto.id,
        codigo: produto.codigo,
        nome: produto.nome,
        descricao: produto.descricao || produto.nome,
        localizacao: produto.localizacao || '-',
        quantidade,
        preco_unitario: produto.preco,
        peso: produto.peso,
        desconto: desconto,
        tipo: 'produto',
        estoque_disponivel: produto.estoque,
        categoria: produto.categoria,
        cor: produto.cor,
        preco_por_kg_calculado: precoPorKgCalculado
      }]);
      
    } else {
      const kit = kits.find(k => k.id === itemSelecionado);
      if (!kit) return;

      const estoqueKit = kit.estoque_disponivel || 0;
      
      if (estoqueKit < quantidade) {
        toast({
          title: "⚠️ Estoque insuficiente",
          description: `${kit.nome} - Estoque: ${estoqueKit}, Solicitado: ${quantidade}`,
          variant: "default",
        });
      }

      const itemId = `temp-${Date.now()}-${Math.random()}`;

      setItens([...itens, {
        id: itemId,
        kit_id: kit.id,
        codigo: kit.codigo,
        nome: kit.nome,
        descricao: kit.descricao || kit.nome,
        localizacao: '-',
        quantidade,
        preco_unitario: kit.preco_total,
        peso: null,
        desconto: desconto,
        tipo: 'kit',
        estoque_disponivel: estoqueKit
      }]);
    }

    setItemSelecionado("");
    setQuantidade(1);
    setDesconto(0);
    setSearchTerm("");
  };

  const removeItem = (index: number) => {
    setItens(itens.filter((_, i) => i !== index));
    if (mostrarCalculoReverso === index) {
      setMostrarCalculoReverso(null);
    }
  };

  const calcularPagamento = () => {
    if (valorTotal <= 0) {
      setValorEntrada(0);
      setValorParcela(0);
      return;
    }

    if (formaPagamento === "avista" || !parcelado || formaPagamento === "credito_cliente") {
      setValorEntrada(valorTotal);
      setValorParcela(0);
      setParcelas(1);
      setEntradaValor(0);
      setCondicaoPagamento("");
      return;
    }

    if (formaPagamento === "boleto" || formaPagamento === "credito" || formaPagamento === "debito") {

      const totalParcelas = parcelas;
      const temEntradaHoje = condicaoPagamento?.startsWith('0/') || false;
      
      let valorCalculadoEntrada = entradaValor || 0;
      
      if (valorCalculadoEntrada > valorTotal) {
        valorCalculadoEntrada = valorTotal;
        setEntradaValor(valorTotal);
      }
      
      if (temEntradaHoje && valorCalculadoEntrada === 0) {
        valorCalculadoEntrada = Number((valorTotal * 0.5).toFixed(2));
        setEntradaValor(valorCalculadoEntrada);
      }
      
      let valorCalculadoParcela = 0;
      
      if (temEntradaHoje) {
        const valorRestante = valorTotal - valorCalculadoEntrada;
        const parcelasFuturas = totalParcelas - 1;
        
        if (parcelasFuturas > 0) {
          valorCalculadoParcela = Number((valorRestante / parcelasFuturas).toFixed(2));
        } else {
          valorCalculadoParcela = 0;
        }
      } else if (valorCalculadoEntrada > 0) {
        const valorRestante = valorTotal - valorCalculadoEntrada;
        valorCalculadoParcela = totalParcelas > 0 ? Number((valorRestante / totalParcelas).toFixed(2)) : 0;
      } else {
        valorCalculadoParcela = totalParcelas > 0 ? Number((valorTotal / totalParcelas).toFixed(2)) : 0;
      }
      
      valorCalculadoEntrada = Math.round(valorCalculadoEntrada * 100) / 100;
      valorCalculadoParcela = Math.round(valorCalculadoParcela * 100) / 100;
      
      setValorEntrada(valorCalculadoEntrada);
      setValorParcela(valorCalculadoParcela);
    }
  };

  const validarCalculoParcelas = (): boolean => {
    if (!parcelado || formaPagamento === "avista" || formaPagamento === "credito_cliente") {
      return true;
    }
    
    const temEntradaHoje = condicaoPagamento?.startsWith('0/') || false;
    const parcelasFuturas = temEntradaHoje ? parcelas - 1 : parcelas;
    const entradaNum = entradaValor || 0;
    
    const totalCalculado = Number((entradaNum + (valorParcela * parcelasFuturas)).toFixed(2));
    const diferenca = Math.abs(totalCalculado - Number(valorTotal.toFixed(2)));
    
    // Tolerância generosa para arredondamentos de centavos
    const tolerancia = Math.max(0.05, parcelas * 0.01);
    
    if (diferenca > tolerancia) {
      toast({
        title: "❌ Erro no cálculo",
        description: `Diferença de R$ ${diferenca.toFixed(2)}. Ajuste os valores.`,
        variant: "destructive",
      });
      return false;
    }
    
    return true;
  };

  const mostrarCampoEntrada = () => {
    return parcelado && formaPagamento !== "avista" && formaPagamento !== "credito_cliente";
  };

  const salvarOrcamento = async (gerarPDF: boolean = false) => {
    setLoading(true);
    
    try {
      let totalParcelas = parcelas;
      if (condicaoPagamento?.startsWith('0/')) {
        totalParcelas = parcelas;
      }
      
      const entradaPercentual = valorEntrada > 0 ? (valorEntrada / valorTotal) * 100 : 0;
      
      let obsPagamento = "";
      
      if (formaPagamento === "avista" || !parcelado) {
        obsPagamento = `Pagamento à vista - Total: ${formatCurrency(valorTotal)}`;
      } else if (formaPagamento === "credito_cliente") {
        obsPagamento = `Pagamento com crédito do cliente - Total: ${formatCurrency(valorTotal)} - Limite do cliente: R$ ${clienteLimite.toFixed(2)}`;
      } else {
        obsPagamento = `Pagamento: ${getFormaPagamentoLabel(formaPagamento)}`;
        if (condicaoPagamento) {
          obsPagamento += ` - ${getDescricaoCondicao(condicaoPagamento)}`;
        }
        if (valorEntrada > 0) {
          obsPagamento += ` - Entrada: ${formatCurrency(valorEntrada)} (hoje)`;
        }
        if (valorParcela > 0) {
          if (condicaoPagamento?.startsWith('0/')) {
            obsPagamento += ` - ${totalParcelas - 1}x ${formatCurrency(valorParcela)}`;
          } else {
            obsPagamento += ` - ${totalParcelas}x ${formatCurrency(valorParcela)}`;
          }
        }
      }

      const observacoesCompletas = observacoes 
        ? `${obsPagamento}\n\n${observacoes}`
        : obsPagamento;

      const { error: orcError } = await supabase
        .from('orcamentos')
        .update({
          cliente_id: clienteId,
          vendedor_id: vendedorId || null,
          filial_id: filialId === MATRIZ_SENTINEL ? null : filialId,
          valor_total: Number(valorTotal.toFixed(2)),
          observacoes: observacoesCompletas.substring(0, 500),
          forma_pagamento: formaPagamento,
          condicao_pagamento: condicaoPagamento || null,
          entrada_percentual: entradaPercentual > 0 ? Number(entradaPercentual.toFixed(2)) : null,
          entrada_valor: valorEntrada > 0 ? Number(valorEntrada.toFixed(2)) : null,
          parcelas: totalParcelas || null,
          valor_parcela: valorParcela > 0 ? Number(valorParcela.toFixed(2)) : null,
          parcelado: parcelado,
          numero_parcelas: parcelado ? totalParcelas : 1,
          pagamento_misto: orcamento.pagamento_misto || false,
          valor_credito_utilizado: orcamento.valor_credito_utilizado,
          forma_pagamento_restante: orcamento.forma_pagamento_restante,
          condicao_pagamento_restante: orcamento.condicao_pagamento_restante,
          parcelas_restante: orcamento.parcelas_restante,
          updated_at: new Date().toISOString()
        })
        .eq('id', orcamento.id);

      if (orcError) throw orcError;

      const { error: deleteError } = await supabase
        .from('orcamento_itens')
        .delete()
        .eq('orcamento_id', orcamento.id);

      if (deleteError) throw deleteError;

      const orcamentoItens = itens.map(item => {
        const subtotalComDesconto = calcularSubtotalComDesconto(item);
        
        return {
          orcamento_id: orcamento.id,
          produto_id: item.tipo === 'produto' ? item.produto_id : null,
          kit_id: item.tipo === 'kit' ? item.kit_id : null,
          quantidade: item.quantidade,
          preco_unitario: Number(item.preco_unitario.toFixed(2)),
          desconto: item.desconto,
          peso: item.peso,
          subtotal: Number(subtotalComDesconto.toFixed(2))
        };
      });

      const { error: itensError } = await supabase
        .from('orcamento_itens')
        .insert(orcamentoItens);

      if (itensError) throw itensError;

      await supabase
        .from('comissoes')
        .delete()
        .eq('orcamento_id', orcamento.id);

      if (vendedorId) {
        const vendedorSelecionado = vendedores.find(v => v.id === vendedorId);
        if (vendedorSelecionado) {
          const valorComissao = (valorTotal * vendedorSelecionado.comissao_percentual) / 100;
          
          await supabase
            .from('comissoes')
            .insert({
              orcamento_id: orcamento.id,
              vendedor_id: vendedorId,
              valor_orcamento: valorTotal,
              percentual_comissao: vendedorSelecionado.comissao_percentual,
              valor_comissao: Number(valorComissao.toFixed(2)),
              status: 'pendente',
            });
        }
      }

      toast({
        title: "✅ Orçamento atualizado!",
        description: `Orçamento ${orcamento.numero} atualizado com sucesso.`,
      });

      if (gerarPDF) {
        setTimeout(() => {
          toast({
            title: "📄 PDF gerado!",
            description: "O arquivo será baixado em instantes.",
          });
        }, 500);
      }

      onClose();
      
    } catch (error: any) {
      console.error('❌ Erro:', error);
      toast({
        title: "❌ Erro ao atualizar orçamento",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (gerarPDF: boolean = false) => {
    if (!clienteId || itens.length === 0) {
      toast({
        title: "Dados incompletos",
        description: "Selecione um cliente e adicione produtos",
        variant: "destructive",
      });
      return;
    }

    if (!formaPagamento) {
      toast({
        title: "Forma de pagamento obrigatória",
        description: "Selecione uma forma de pagamento",
        variant: "destructive",
      });
      return;
    }

    const formasPagamentoOpcionais = ["credito", "debito", "credito_cliente"];
    
    if (parcelado && !formasPagamentoOpcionais.includes(formaPagamento) && !condicaoPagamento) {
      toast({
        title: "Condição de pagamento obrigatória",
        description: "Selecione uma condição de pagamento",
        variant: "destructive",
      });
      return;
    }

    if (parcelado && !validarCalculoParcelas()) {
      return;
    }

    await salvarOrcamento(gerarPDF);
  };

  const itensComFormula = contarItensComFormula();

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Cliente *</label>
          <AddClienteInlineDialog
            onClienteAdded={(novoCliente) => {
              setClientes(prev => [...prev, novoCliente]);
              setClienteId(novoCliente.id);
            }}
          />
        </div>
        <Select value={clienteId || "sem_cliente"} onValueChange={(value) => {
          setClienteId(value === "sem_cliente" ? "" : value);
        }}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione um cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sem_cliente">Selecione um cliente</SelectItem>
            {clientes.map(cliente => (
              <SelectItem key={cliente.id} value={cliente.id}>
                {cliente.nome} - {cliente.cpf_cnpj}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {clienteLimite > 0 && (
          <p className="text-xs text-blue-600">
            Limite de crédito disponível: {formatCurrency(clienteLimite)}
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Vendedor (opcional)</label>
        <Select value={vendedorId || "sem_vendedor"} onValueChange={(value) => {
          setVendedorId(value === "sem_vendedor" ? "" : value);
        }}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione um vendedor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sem_vendedor">Sem vendedor</SelectItem>
            {vendedores.map(vendedor => (
              <SelectItem key={vendedor.id} value={vendedor.id}>
                <div className="flex items-center justify-between w-full">
                  <span>{vendedor.nome}</span>
                  <Badge variant="outline" className="ml-2 text-xs">
                    {vendedor.comissao_percentual}%
                  </Badge>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {vendedorId && (
          <p className="text-xs text-green-600 mt-1">
            Comissão de {vendedores.find(v => v.id === vendedorId)?.comissao_percentual}% será calculada automaticamente
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Unidade</label>
        <Select value={filialId} onValueChange={setFilialId}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione a unidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={MATRIZ_SENTINEL}>Matriz</SelectItem>
            {filiais.map(filial => (
              <SelectItem key={filial.id} value={filial.id}>{filial.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground mt-1">
          Ao aprovar, o estoque será baixado a partir desta unidade.
        </p>
      </div>

      <div className="border rounded-lg p-4 space-y-4">
        <h3 className="font-semibold">Condições de Pagamento</h3>
        
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="parcelado"
              checked={parcelado}
              onChange={(e) => {
                setParcelado(e.target.checked);
                if (!e.target.checked) {
                  setFormaPagamento("avista");
                  setCondicaoPagamento("");
                  setEntradaValor(0);
                }
              }}
              className="h-4 w-4 rounded border-gray-300"
              disabled={formaPagamento === "credito_cliente"}
            />
            <label htmlFor="parcelado" className="text-sm font-medium">
              Pagamento Parcelado?
            </label>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Forma de Pagamento *</label>
              <Select value={formaPagamento || "sem_forma"} onValueChange={(value) => {
                const novaForma = value === "sem_forma" ? "" : value;
                setFormaPagamento(novaForma);
                
                if (novaForma === "credito_cliente") {
                  setParcelado(false);
                  setCondicaoPagamento("");
                  setEntradaValor(0);
                  setParcelas(1);
                } else if (novaForma === "avista") {
                  setParcelado(false);
                  setCondicaoPagamento("");
                  setEntradaValor(0);
                  setParcelas(1);
                }
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sem_forma">Selecione uma forma</SelectItem>
                  <SelectItem value="avista">À Vista</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="credito">Cartão de Crédito</SelectItem>
                  <SelectItem value="debito">Cartão de Débito</SelectItem>
                  <SelectItem value="credito_cliente">Cliente com Crédito</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {parcelado && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Condição de Pagamento 
                    {formaPagamento !== "credito" && formaPagamento !== "debito" && " *"}
                  </label>
                  <Select 
                    value={condicaoPagamento || "sem_condicao"} 
                    onValueChange={(value) => {
                      setCondicaoPagamento(value === "sem_condicao" ? "" : value);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={
                        formaPagamento === "credito" || formaPagamento === "debito"
                          ? "Opcional - pode selecionar se desejar" 
                          : "Selecione"
                      } />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sem_condicao">
                        {formaPagamento === "credito" || formaPagamento === "debito" 
                          ? "Sem condição especial" 
                          : "Selecione uma condição"}
                      </SelectItem>
                      <SelectItem value="28">28 dias</SelectItem>
                      <SelectItem value="28/56">28/56 dias</SelectItem>
                      <SelectItem value="0/28/56">0/28/56 dias</SelectItem>
                      <SelectItem value="15">15 dias</SelectItem>
                      <SelectItem value="15/30">15/30 dias</SelectItem>
                      <SelectItem value="0/15/30">0/15/30 dias</SelectItem>
                    </SelectContent>
                  </Select>
                  {(formaPagamento === "credito" || formaPagamento === "debito") && (
                    <p className="text-xs text-muted-foreground mt-1">
                      A condição de pagamento é opcional para cartão de crédito e débito
                    </p>
                  )}
                </div>

                {mostrarCampoEntrada() && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Valor da Entrada (R$)</label>
                    <Input
                      type="number"
                      min="0"
                      max={valorTotal}
                      step="0.01"
                      value={entradaValor === 0 ? "" : entradaValor}
                      onChange={(e) => {
                        const raw = e.target.value;
                        if (raw === "" || raw === "-") {
                          setEntradaValor(0);
                        } else {
                          const parsed = parseFloat(raw);
                          if (!isNaN(parsed)) setEntradaValor(parsed);
                        }
                      }}
                      placeholder="Sem entrada (opcional)"
                    />
                    <p className="text-xs text-muted-foreground">
                      {condicaoPagamento?.startsWith('0/') 
                        ? "Entrada obrigatória - vencimento hoje"
                        : "Deixe em branco para não ter entrada"}
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-sm font-medium">Número de Parcelas</label>
                  <Input
                    type="number"
                    min="1"
                    max="60"
                    value={parcelas}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val) && val >= 1) setParcelas(val);
                    }}
                  />
                  <p className="text-xs text-muted-foreground">
                    {condicaoPagamento
                      ? "Condição especial selecionada - ajuste livremente o número de parcelas"
                      : "Informe quantas parcelas"}
                  </p>
                </div>
              </>
            )}
          </div>

          {valorTotal > 0 && formaPagamento && (
            <div className="pt-4 border-t">
              <h4 className="font-medium mb-2">Resumo do Pagamento:</h4>
              <div className="bg-gray-50 p-3 rounded-lg text-sm space-y-1">
                <div className="flex justify-between">
                  <span>Valor Total:</span>
                  <span className="font-bold">{formatCurrency(valorTotal)}</span>
                </div>
                
                {formaPagamento === "credito_cliente" ? (
                  <div className="flex justify-between text-purple-600">
                    <span>Pagamento:</span>
                    <span className="font-medium">Crédito do Cliente</span>
                  </div>
                ) : !parcelado || formaPagamento === "avista" ? (
                  <div className="flex justify-between text-green-600">
                    <span>Pagamento:</span>
                    <span className="font-medium">À Vista</span>
                  </div>
                ) : (
                  <>
                    {valorEntrada > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Entrada (hoje):</span>
                        <span className="font-medium">{formatCurrency(valorEntrada)}</span>
                      </div>
                    )}
                    
                    {valorParcela > 0 && (
                      <>
                        <div className="flex justify-between">
                          <span>
                            {condicaoPagamento?.startsWith('0/') 
                              ? `${parcelas - 1}x de:`
                              : `${parcelas}x de:`}
                          </span>
                          <span className="font-medium">{formatCurrency(valorParcela)}</span>
                        </div>
                        
                        <div className="flex justify-between text-xs text-gray-500 pt-1 border-t border-gray-200 mt-1">
                          <span>Total parcelado:</span>
                          <span>
                            {formatCurrency(
                              condicaoPagamento?.startsWith('0/')
                                ? valorParcela * (parcelas - 1)
                                : valorParcela * parcelas
                            )}
                          </span>
                        </div>
                      </>
                    )}
                    
                    {condicaoPagamento && (
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Condição:</span>
                        <span>{getDescricaoCondicao(condicaoPagamento)}</span>
                      </div>
                    )}
                  </>
                )}
                
                {valorEntrada > 0 && valorEntrada < valorTotal && (
                  <div className="flex justify-between text-xs text-blue-600 pt-1 border-t border-blue-200 mt-1">
                    <span>Saldo após entrada:</span>
                    <span className="font-medium">{formatCurrency(valorTotal - valorEntrada)}</span>
                  </div>
                )}

                {vendedorId && (
                  <div className="flex justify-between text-xs text-green-600 pt-1 border-t border-green-200 mt-1">
                    <span>Comissão do vendedor:</span>
                    <span className="font-medium">
                      {formatCurrency((valorTotal * (vendedores.find(v => v.id === vendedorId)?.comissao_percentual || 0)) / 100)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border rounded-lg p-4 space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold">Itens do Orçamento</h3>
          {itensComFormula > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMostrarAplicarTodos(true)}
              className="gap-2"
            >
              <Zap className="h-4 w-4" />
              Aplicar Preço por Kg para Todos
            </Button>
          )}
        </div>

        {mostrarAplicarTodos && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h5 className="font-medium text-sm text-green-800">
                Aplicar Preço por Kg para Todos os Itens
              </h5>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setMostrarAplicarTodos(false);
                  setPrecoPorKgTodos("");
                }}
                className="h-6 w-6 p-0"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="text-xs">Preço por Kg para Todos os Itens</label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Digite o preço por kg para todos"
                    value={precoPorKgTodos}
                    onChange={(e) => setPrecoPorKgTodos(e.target.value)}
                    className="h-8 flex-1"
                  />
                  <Button 
                    size="sm" 
                    onClick={() => {
                      const precoPorKg = parseFloat(precoPorKgTodos) || 0;
                      if (precoPorKg > 0) {
                        aplicarPrecoPorKgTodos(precoPorKg);
                      } else {
                        toast({
                          title: "Valor inválido",
                          description: "Digite um preço por kg válido",
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    Aplicar para Todos
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => aplicarDescontoPrecoPorKgTodos(5)}
                  className="text-xs"
                >
                  -5% Todos
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => aplicarDescontoPrecoPorKgTodos(10)}
                  className="text-xs"
                >
                  -10% Todos
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => aplicarDescontoPrecoPorKgTodos(15)}
                  className="text-xs"
                >
                  -15% Todos
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Esta ação aplicará o mesmo preço por kg para todos os {itensComFormula} itens que usam a fórmula de cálculo.
              </p>
            </div>
          </div>
        )}

        {itens.length > 0 && (
          <div className="space-y-2">
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {itens.map((item, index) => {
                const subtotalBruto = item.quantidade * item.preco_unitario;
                const valorDesconto = (subtotalBruto * item.desconto) / 100;
                const subtotalLiquido = subtotalBruto - valorDesconto;
                const usaFormula = produtoUsaFormula(item);
                const produtoOriginal = produtos.find(p => p.id === item.produto_id);
                const semEstoque = item.estoque_disponivel !== undefined && item.quantidade > item.estoque_disponivel;
                
                return (
                  <div key={item.id} className={`grid grid-cols-1 sm:grid-cols-12 gap-2 items-start sm:items-center p-3 rounded-lg ${semEstoque ? 'bg-yellow-100 border border-yellow-300' : 'bg-secondary'}`}>
                    <div className="sm:col-span-4">
                      <p className="font-medium text-sm">{item.descricao}</p>
                      <div className="flex gap-2 text-xs text-muted-foreground">
                        <span>Cód: {item.codigo}</span>
                        <span>| {item.tipo}</span>
                        {item.cor && <span>| Cor: {item.cor}</span>}
                        {semEstoque && (
                          <span className="text-yellow-700 font-medium">
                            ⚠️ Estoque: {item.estoque_disponivel}
                          </span>
                        )}
                      </div>
                      {usaFormula && produtoOriginal && (
                        <div className="flex gap-2 text-xs text-blue-700">
                          <span>Peso: {produtoOriginal.peso_kg_m}kg/m</span>
                          {item.preco_por_kg_calculado && (
                            <span>R$ {item.preco_por_kg_calculado.toFixed(2)}/kg</span>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="sm:col-span-1">
                      <label className="text-xs">Qtd</label>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantidade}
                        onChange={(e) => {
                          const newItens = [...itens];
                          newItens[index].quantidade = parseInt(e.target.value) || 1;
                          setItens(newItens);
                        }}
                        className="h-8"
                      />
                    </div>
                    
                    <div className="sm:col-span-2">
                      <label className="text-xs">Preço Unit.</label>
                      <div className="flex gap-1">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.preco_unitario}
                          onChange={(e) => {
                            handlePrecoUnitarioChange(index, parseFloat(e.target.value) || 0);
                          }}
                          className="h-8 flex-1"
                        />
                        {usaFormula && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => abrirModalCalculoReverso(index)}
                            className="h-8 w-8"
                            title="Calcular preço por kg"
                          >
                            <Calculator className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                    
                    <div className="sm:col-span-1">
                      <label className="text-xs">Desc. %</label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={item.desconto}
                        onChange={(e) => {
                          const newItens = [...itens];
                          newItens[index].desconto = parseFloat(e.target.value) || 0;
                          setItens(newItens);
                        }}
                        className="h-8"
                      />
                    </div>
                    
                    <div className="sm:col-span-3 text-right">
                      <p className="text-xs text-muted-foreground">R$ {subtotalBruto.toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">-{item.desconto}% = R$ {valorDesconto.toFixed(2)}</p>
                      <p className="font-semibold text-sm">R$ {subtotalLiquido.toFixed(2)}</p>
                    </div>
                    
                    <div className="sm:col-span-1 text-right">
                      <Button
                        size="icon"
                        variant="destructive"
                        onClick={() => removeItem(index)}
                        className="h-8 w-8"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {mostrarCalculoReverso === index && usaFormula && produtoOriginal && (
                      <div className="sm:sm:col-span-12 mt-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center justify-between mb-3">
                          <h5 className="font-medium text-sm text-blue-800">Cálculo do Preço por Kg</h5>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setMostrarCalculoReverso(null);
                              setNovoPrecoPorKg("");
                            }}
                            className="h-6 w-6 p-0"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                          <div>
                            <label className="text-xs">Peso kg/m</label>
                            <Input value={produtoOriginal.peso_kg_m} disabled className="h-8" />
                          </div>
                          <div>
                            <label className="text-xs">Comprimento (m)</label>
                            <Input value={produtoOriginal.comprimento_barra || 6} disabled className="h-8" />
                          </div>
                          <div>
                            <label className="text-xs">Peso Total (kg)</label>
                            <Input 
                              value={((produtoOriginal.peso_kg_m || 0) * (produtoOriginal.comprimento_barra || 6)).toFixed(3)} 
                              disabled 
                              className="h-8" 
                            />
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                          <div>
                            <label className="text-xs">Preço de Venda Atual</label>
                            <Input value={item.preco_unitario.toFixed(2)} disabled className="h-8" />
                          </div>
                          <div>
                            <label className="text-xs">Preço por Kg Calculado</label>
                            <Input 
                              value={item.preco_por_kg_calculado?.toFixed(2) || '0.00'} 
                              disabled 
                              className="h-8" 
                            />
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div>
                            <label className="text-xs">Definir Novo Preço por Kg</label>
                            <div className="flex gap-2">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="Digite o preço por kg"
                                value={novoPrecoPorKg}
                                onChange={(e) => setNovoPrecoPorKg(e.target.value)}
                                className="h-8 flex-1"
                              />
                              <Button 
                                size="sm" 
                                onClick={() => {
                                  const precoPorKg = parseFloat(novoPrecoPorKg) || 0;
                                  if (precoPorKg > 0) {
                                    aplicarPrecoPorKg(index, precoPorKg);
                                  } else {
                                    toast({
                                      title: "Valor inválido",
                                      description: "Digite um preço por kg válido",
                                      variant: "destructive",
                                    });
                                  }
                                }}
                              >
                                Aplicar
                              </Button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => aplicarDescontoPrecoPorKg(index, 5)}
                              className="text-xs"
                            >
                              -5%
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => aplicarDescontoPrecoPorKg(index, 10)}
                              className="text-xs"
                            >
                              -10%
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => aplicarDescontoPrecoPorKg(index, 15)}
                              className="text-xs"
                            >
                              -15%
                            </Button>
                          </div>

                          <p className="text-xs text-muted-foreground mt-2">
                            <strong>Fórmula:</strong> Preço por Kg = Preço de Venda ÷ (Peso kg/m × Comprimento)
                            <br />
                            <strong>Exemplo:</strong> R$ {item.preco_unitario.toFixed(2)} ÷ ({produtoOriginal.peso_kg_m} × {produtoOriginal.comprimento_barra || 6}) = R$ {item.preco_por_kg_calculado?.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="pt-2 border-t text-right">
              <p className="text-xl font-bold">
                Total: {formatCurrency(valorTotal)}
              </p>
              <p className="text-xs text-muted-foreground">
                {itens.length} item(ns) | {itensComFormula} com fórmula de cálculo
              </p>
            </div>
          </div>
        )}

        <div className="border-t pt-4">
          <h4 className="font-medium mb-3">Adicionar Novo Item</h4>
          <div className="space-y-2">
            <label className="text-sm font-medium">Pesquisar</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar por nome, código ou cor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-5 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo</label>
              <Select value={tipoItem} onValueChange={(value: 'produto' | 'kit') => {
                setTipoItem(value);
                setItemSelecionado("");
              }}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="produto">Produto</SelectItem>
                  <SelectItem value="kit">Kit</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:sm:col-span-2 space-y-2">
              <label className="text-sm font-medium">{tipoItem === 'produto' ? 'Produto' : 'Kit'}</label>
              <Select value={itemSelecionado || "sem_item"} onValueChange={(value) => {
                setItemSelecionado(value === "sem_item" ? "" : value);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder={`Selecione um ${tipoItem}`} />
                </SelectTrigger>
                <SelectContent className="max-w-[500px]">
                  <SelectItem value="sem_item">Selecione um {tipoItem}</SelectItem>
                  {tipoItem === 'produto' ? (
                    produtosFiltrados.length > 0 ? (
                      produtosFiltrados.map(produto => {
                        const formatted = formatarProdutoSelect(produto);
                        return (
                          <SelectItem key={produto.id} value={produto.id} className="py-2">
                            <div className="flex flex-col">
                              <span className="font-medium">{formatted.text}</span>
                              <span className={`text-xs ${formatted.estoqueColor}`}>
                                {formatted.estoqueInfo}
                                {produto.peso_kg_m && ` | ${produto.peso_kg_m}kg/m`}
                              </span>
                            </div>
                          </SelectItem>
                        );
                      })
                    ) : (
                      <SelectItem value="sem_item" disabled>
                        Nenhum produto encontrado
                      </SelectItem>
                    )
                  ) : (
                    kitsFiltrados.length > 0 ? (
                      kitsFiltrados.map(kit => {
                        const formatted = formatarKitSelect(kit);
                        return (
                          <SelectItem key={kit.id} value={kit.id} className="py-2">
                            <div className="flex flex-col">
                              <span className="font-medium">{formatted.text}</span>
                              <span className={`text-xs ${formatted.estoqueColor}`}>
                                {formatted.estoqueInfo}
                              </span>
                            </div>
                          </SelectItem>
                        );
                      })
                    ) : (
                      <SelectItem value="sem_item" disabled>
                        Nenhum kit com estoque disponível
                      </SelectItem>
                    )
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Qtd</label>
              <Input
                type="number"
                min="1"
                value={quantidade}
                onChange={(e) => setQuantidade(parseInt(e.target.value) || 1)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Desc. %</label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={desconto}
                  onChange={(e) => setDesconto(parseFloat(e.target.value) || 0)}
                />
                <Button 
                  onClick={addItem} 
                  type="button" 
                  size="icon"
                  disabled={!itemSelecionado || quantidade <= 0}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Observações</label>
        <textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="Informações adicionais..."
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
        <Button 
          onClick={() => handleSubmit(false)} 
          disabled={loading || !formaPagamento || itens.length === 0 || !clienteId}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Atualizar"}
        </Button>
        <Button 
          onClick={() => handleSubmit(true)} 
          disabled={loading || !formaPagamento || itens.length === 0 || !clienteId} 
          variant="outline"
        >
          <Download className="h-4 w-4 mr-2" />
          Atualizar e PDF
        </Button>
      </div>
    </div>
  );
};