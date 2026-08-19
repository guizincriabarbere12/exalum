// app/pedidos/page.tsx - CORREÇÃO PARA MOSTRAR APENAS ORÇAMENTOS APROVADOS
"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  ShoppingCart, 
  Phone, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Package, 
  Eye, 
  Check, 
  FileText, 
  ArrowRight, 
  Filter,
  Loader2,
  AlertTriangle
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

// ========== DEFINIÇÃO DE TIPOS ==========
interface ProdutoInfo {
  codigo: string;
  nome: string;
  descricao: string;
  unidade: string;
}

interface KitInfo {
  codigo: string;
  nome: string;
}

interface PedidoItem {
  id: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
  peso?: number;
  produto_id?: string;
  kit_id?: string;
  produtos?: ProdutoInfo | null;
  kit?: KitInfo | null;
}

interface ClienteInfo {
  nome: string;
  telefone: string | null;
}

interface Pedido {
  id: string;
  numero: string;
  status: string;
  valor_total: number;
  created_at: string;
  observacoes: string | null;
  origem: string | null;
  orcamento_id?: string | null;
  clientes: ClienteInfo | null;
}

interface OrcamentoAprovado {
  id: string;
  numero: string;
  created_at: string;
  cliente_id: string;
  valor_total: number;
  observacoes: string | null;
  status: string;
  cliente_nome: string;
  cliente_telefone: string | null;
  ja_convertido: boolean;
  numero_pedido_convertido?: string;
}

// ========== CONFIGURAÇÕES DE STATUS ==========
const statusConfig = {
  pendente: { 
    color: "bg-yellow-100 text-yellow-800 hover:bg-yellow-100",
    icon: Clock 
  },
  confirmado: { 
    color: "bg-green-100 text-green-800 hover:bg-green-100",
    icon: CheckCircle 
  },
  em_separacao: { 
    color: "bg-blue-100 text-blue-800 hover:bg-blue-100",
    icon: Package 
  },
  enviado: { 
    color: "bg-indigo-100 text-indigo-800 hover:bg-indigo-100",
    icon: Package 
  },
  entregue: { 
    color: "bg-purple-100 text-purple-800 hover:bg-purple-100",
    icon: CheckCircle 
  },
  cancelado: { 
    color: "bg-red-100 text-red-800 hover:bg-red-100",
    icon: XCircle 
  },
  aprovado: { 
    color: "bg-green-100 text-green-800 hover:bg-green-100",
    icon: CheckCircle 
  },
} as const;

const statusLabels: Record<string, string> = {
  pendente: "Pendente",
  confirmado: "Confirmado",
  em_separacao: "Em Separação",
  enviado: "Enviado",
  entregue: "Entregue",
  cancelado: "Cancelado",
  aprovado: "Aprovado",
};

// ========== FUNÇÕES AUXILIARES ==========
const statusPermiteConversao = (status: string): boolean => {
  // Agora apenas 'aprovado' é considerado para conversão
  return status.toLowerCase() === 'aprovado';
};

// ========== COMPONENTE PRINCIPAL ==========
export default function PedidosPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [orcamentosAprovados, setOrcamentosAprovados] = useState<OrcamentoAprovado[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPedidoItens, setSelectedPedidoItens] = useState<PedidoItem[]>([]);
  const [loadingItens, setLoadingItens] = useState(false);
  const [selectedPedidoNumero, setSelectedPedidoNumero] = useState("");
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null);
  const [convertendoOrcamento, setConvertendoOrcamento] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<'todos' | 'nao_convertidos' | 'convertidos'>('todos');
  const [debugInfo, setDebugInfo] = useState('');
  
  const { user, isLoading: authLoading } = useAuth();

  // ========== EFFECTS ==========
  useEffect(() => {
    if (!authLoading) {
      fetchPedidos();
      fetchOrcamentosAprovados();
    }
  }, [authLoading]);

  // ========== FUNÇÕES DE BUSCA CORRIGIDAS ==========
  
  const fetchPedidos = async () => {
    try {
      console.log("🔄 Buscando pedidos...");
      
      // Buscar pedidos primeiro
      const { data: pedidosData, error: pedidosError } = await supabase
        .from('pedidos')
        .select(`
          id,
          numero,
          status,
          valor_total,
          created_at,
          observacoes,
          origem,
          orcamento_id,
          cliente_id
        `)
        .order('created_at', { ascending: false });

      if (pedidosError) throw pedidosError;

      // Buscar informações dos clientes separadamente
      const pedidosComClientes = await Promise.all(
        (pedidosData || []).map(async (pedido) => {
          if (pedido.cliente_id) {
            const { data: clienteData } = await supabase
              .from('clientes')
              .select('nome, telefone')
              .eq('id', pedido.cliente_id)
              .single();
            
            return {
              ...pedido,
              clientes: clienteData || null
            };
          }
          return {
            ...pedido,
            clientes: null
          };
        })
      );

      console.log(`✅ ${pedidosComClientes.length} pedidos carregados`);
      setPedidos(pedidosComClientes as Pedido[]);
      
    } catch (error: any) {
      console.error("❌ Erro ao buscar pedidos:", error);
      toast.error("Erro ao carregar pedidos", {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchOrcamentosAprovados = async () => {
    try {
      console.log("🔄 Buscando orçamentos aprovados...");
      
      // Buscar APENAS orçamentos com status 'aprovado'
      const { data: orcamentos, error } = await supabase
        .from('orcamentos')
        .select(`
          id,
          numero,
          created_at,
          cliente_id,
          valor_total,
          observacoes,
          status
        `)
        .eq('status', 'aprovado')  // ← MUDEI AQUI: filtra apenas status = 'aprovado'
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Buscar informações dos clientes separadamente
      const orcamentosComClientes = await Promise.all(
        (orcamentos || []).map(async (orcamento) => {
          let clienteData = { nome: 'Cliente não informado', telefone: null };
          
          if (orcamento.cliente_id) {
            const { data } = await supabase
              .from('clientes')
              .select('nome, telefone')
              .eq('id', orcamento.cliente_id)
              .single();
            
            if (data) {
              clienteData = data;
            }
          }
          
          return {
            ...orcamento,
            cliente_nome: clienteData.nome,
            cliente_telefone: clienteData.telefone
          };
        })
      );

      // CORREÇÃO: Buscar pedidos convertidos - filtrar por orcamento_id NOT NULL
      const { data: pedidosConvertidos, error: errorPedidos } = await supabase
        .from('pedidos')
        .select('id, numero, orcamento_id')
        .not('orcamento_id', 'is', null);

      if (errorPedidos) {
        console.warn("⚠️ Aviso ao buscar pedidos:", errorPedidos);
      }

      console.log("📦 Pedidos convertidos encontrados:", pedidosConvertidos?.length || 0);

      // Processar orçamentos
      const orcamentosFormatados: OrcamentoAprovado[] = (orcamentosComClientes || []).map(orcamento => {
        const pedidoConvertido = (pedidosConvertidos || []).find(
          pedido => pedido.orcamento_id === orcamento.id
        );
        
        return {
          id: orcamento.id,
          numero: orcamento.numero,
          created_at: orcamento.created_at,
          cliente_id: orcamento.cliente_id,
          valor_total: orcamento.valor_total,
          observacoes: orcamento.observacoes,
          status: orcamento.status,
          cliente_nome: orcamento.cliente_nome,
          cliente_telefone: orcamento.cliente_telefone,
          ja_convertido: !!pedidoConvertido,
          numero_pedido_convertido: pedidoConvertido?.numero
        };
      });

      console.log(`✅ ${orcamentosFormatados.length} orçamentos aprovados carregados`);
      console.log(`📊 Já convertidos: ${orcamentosFormatados.filter(o => o.ja_convertido).length}`);
      
      // Debug: mostrar status encontrados (agora só 'aprovado')
      if (orcamentosFormatados.length > 0) {
        const statusUnicos = [...new Set(orcamentosFormatados.map(o => o.status))];
        const debugMsg = `
          Total de orçamentos aprovados: ${orcamentosFormatados.length}
          Status: ${statusUnicos.join(', ')}
          Já convertidos: ${orcamentosFormatados.filter(o => o.ja_convertido).length}
        `;
        setDebugInfo(debugMsg);
        console.log(`📊 Status encontrados: ${statusUnicos.join(', ')}`);
      }
      
      setOrcamentosAprovados(orcamentosFormatados);
      
    } catch (error: any) {
      console.error("❌ Erro ao buscar orçamentos:", error);
      toast.error("Erro ao carregar orçamentos", {
        description: error.message
      });
    }
  };

  // ========== FUNÇÃO PARA BUSCAR ITENS DO PEDIDO ==========
  const fetchPedidoItens = async (pedidoId: string, pedidoNumero: string) => {
    setLoadingItens(true);
    setSelectedPedidoNumero(pedidoNumero);
    
    try {
      console.log(`🔍 Buscando itens do pedido ${pedidoNumero}...`);
      
      // Buscar itens básicos primeiro
      const { data: itensBasicos, error } = await supabase
        .from('pedido_itens')
        .select('*')
        .eq('pedido_id', pedidoId)
        .order('created_at');

      if (error) throw error;

      if (!itensBasicos || itensBasicos.length === 0) {
        setSelectedPedidoItens([]);
        return;
      }

      // Buscar informações de produtos e kits separadamente
      const itensCompletos = await Promise.all(
        itensBasicos.map(async (item: any) => {
          let produtoInfo: ProdutoInfo | null = null;
          let kitInfo: KitInfo | null = null;

          if (item.produto_id) {
            const { data: produtoData } = await supabase
              .from('produtos')
              .select('codigo, nome, descricao, unidade')
              .eq('id', item.produto_id)
              .single();
            
            if (produtoData) {
              produtoInfo = produtoData;
            }
          }

          if (item.kit_id) {
            const { data: kitData } = await supabase
              .from('kits')
              .select('codigo, nome')
              .eq('id', item.kit_id)
              .single();
            
            if (kitData) {
              kitInfo = kitData;
            }
          }

          return {
            ...item,
            produtos: produtoInfo,
            kit: kitInfo
          };
        })
      );

      console.log(`✅ ${itensCompletos.length} itens encontrados`);
      setSelectedPedidoItens(itensCompletos);
      
    } catch (error: any) {
      console.error("❌ Erro ao buscar itens:", error);
      toast.error("Erro ao carregar itens", {
        description: error.message
      });
    } finally {
      setLoadingItens(false);
    }
  };

  // ========== FUNÇÃO PARA ABRIR MODAL DE ITENS ==========
  const handleAbrirModalItens = async (pedido: Pedido) => {
    setSelectedPedido(pedido);
    setSelectedPedidoNumero(pedido.numero);
    await fetchPedidoItens(pedido.id, pedido.numero);
  };

  // ========== FUNÇÃO PARA CONVERTER ORÇAMENTO ==========
  const converterOrcamentoParaPedido = async (orcamento: OrcamentoAprovado) => {
    if (!user) {
      toast.error("Acesso negado", {
        description: "Você precisa estar logado para executar esta ação"
      });
      return;
    }

    // Verificar se o status permite conversão (agora só 'aprovado' passa)
    if (!statusPermiteConversao(orcamento.status)) {
      toast.error("Orçamento não pode ser convertido", {
        description: `Status "${orcamento.status}" não permite conversão para pedido`
      });
      return;
    }

    setConvertendoOrcamento(orcamento.id);
    
    try {
      console.log(`🔄 Convertendo orçamento ${orcamento.numero}...`);

      // 1. Gerar número do pedido
      const { data: ultimoPedido } = await supabase
        .from('pedidos')
        .select('numero')
        .order('numero', { ascending: false })
        .limit(1);

      let proximoNumero = 1;
      if (ultimoPedido && ultimoPedido.length > 0) {
        const match = ultimoPedido[0].numero.match(/PED(\d+)/);
        if (match && match[1]) {
          proximoNumero = parseInt(match[1]) + 1;
        }
      }

      const numeroPedido = `PED${proximoNumero.toString().padStart(6, '0')}`;

      // 2. Criar pedido com status 'confirmado'
      const { data: novoPedido, error: pedidoError } = await supabase
        .from('pedidos')
        .insert({
          numero: numeroPedido,
          cliente_id: orcamento.cliente_id,
          status: 'confirmado',
          valor_total: orcamento.valor_total,
          observacoes: `${orcamento.observacoes || ''}\n\nOrigem: Orçamento ${orcamento.numero}\nConvertido automaticamente em: ${new Date().toLocaleDateString('pt-BR')}`,
          orcamento_id: orcamento.id
        })
        .select()
        .single();

      if (pedidoError) {
        console.log("⚠️ Erro ao criar pedido com orcamento_id, tentando sem...");
        
        // Tentar sem orcamento_id se a primeira tentativa falhar
        const { data: pedidoSemOrcamento, error: error2 } = await supabase
          .from('pedidos')
          .insert({
            numero: numeroPedido,
            cliente_id: orcamento.cliente_id,
            status: 'confirmado',
            valor_total: orcamento.valor_total,
            observacoes: `${orcamento.observacoes || ''}\n\nOrigem: Orçamento ${orcamento.numero}\nConvertido automaticamente em: ${new Date().toLocaleDateString('pt-BR')}`
          })
          .select()
          .single();

        if (error2) throw error2;
        if (!pedidoSemOrcamento) throw new Error("Falha ao criar pedido");

        await copiarItensDoOrcamento(orcamento.id, pedidoSemOrcamento.id);
        
        // Tentar atualizar o status do orçamento
        await atualizarStatusOrcamento(orcamento.id);

        toast.success("Orçamento convertido!", {
          description: `Pedido ${numeroPedido} criado com sucesso (status: confirmado).`
        });

        fetchPedidos();
        fetchOrcamentosAprovados();
        return;
      }

      if (!novoPedido) throw new Error("Falha ao criar pedido");

      // 3. Copiar itens
      await copiarItensDoOrcamento(orcamento.id, novoPedido.id);
      
      // 4. Atualizar status do orçamento
      await atualizarStatusOrcamento(orcamento.id);

      toast.success("Orçamento convertido!", {
        description: `Pedido ${numeroPedido} criado com sucesso (status: confirmado).`
      });

      fetchPedidos();
      fetchOrcamentosAprovados();

    } catch (error: any) {
      console.error("❌ Erro ao converter orçamento:", error);
      toast.error("Erro ao converter orçamento", {
        description: error.message
      });
    } finally {
      setConvertendoOrcamento(null);
    }
  };

  const copiarItensDoOrcamento = async (orcamentoId: string, pedidoId: string) => {
    try {
      const { data: itensOrcamento, error } = await supabase
        .from('orcamento_itens')
        .select('*')
        .eq('orcamento_id', orcamentoId);

      if (error) throw error;

      if (!itensOrcamento || itensOrcamento.length === 0) {
        console.log("ℹ️ Orçamento não possui itens");
        return;
      }

      const itensPedido = itensOrcamento.map(item => ({
        pedido_id: pedidoId,
        produto_id: item.produto_id,
        kit_id: item.kit_id,
        quantidade: item.quantidade,
        preco_unitario: item.preco_unitario,
        // subtotal é calculado automaticamente pelo banco (coluna gerada)
        peso: item.peso || 0
      }));

      const { error: insertError } = await supabase
        .from('pedido_itens')
        .insert(itensPedido);

      if (insertError) throw insertError;
      
    } catch (error: any) {
      console.error("❌ Erro ao copiar itens:", error);
      throw error;
    }
  };

  const atualizarStatusOrcamento = async (orcamentoId: string) => {
    try {
      console.log(`🔄 Tentando atualizar status do orçamento ${orcamentoId}...`);
      
      // Primeiro, vamos tentar descobrir quais status são permitidos
      const statusPossiveis = ['concluido', 'finalizado', 'faturado', 'entregue'];
      
      for (const status of statusPossiveis) {
        try {
          console.log(`Tentando status: ${status}`);
          const { error } = await supabase
            .from('orcamentos')
            .update({ 
              status: status,
              updated_at: new Date().toISOString()
            })
            .eq('id', orcamentoId);

          if (!error) {
            console.log(`✅ Status atualizado para: ${status}`);
            return;
          }
          
          console.log(`❌ Status '${status}' não permitido, tentando próximo...`);
        } catch (e) {
          console.log(`❌ Erro com status '${status}':`, e);
        }
      }
      
      // Se nenhum status funcionar, vamos manter como 'aprovado' e adicionar um campo de observação
      console.log("⚠️ Nenhum status alternativo funcionou, mantendo como 'aprovado'");
      
      // Adicionar uma observação indicando que foi convertido
      const { data: orcamentoAtual } = await supabase
        .from('orcamentos')
        .select('observacoes')
        .eq('id', orcamentoId)
        .single();
      
      if (orcamentoAtual) {
        const novasObservacoes = `${orcamentoAtual.observacoes || ''}\n\n[CONVERTIDO EM PEDIDO - ${new Date().toLocaleDateString('pt-BR')}]`;
        
        await supabase
          .from('orcamentos')
          .update({ 
            observacoes: novasObservacoes,
            updated_at: new Date().toISOString()
          })
          .eq('id', orcamentoId);
          
        console.log("✅ Observação atualizada para indicar conversão");
      }
      
    } catch (error: any) {
      console.error("⚠️ Erro ao atualizar status do orçamento:", error);
      // Não lançamos erro aqui para não interromper o fluxo principal
    }
  };

  // ========== OUTRAS FUNÇÕES ==========
  const handleConverterEmOrcamento = async (pedidoId: string) => {
    try {
      const { data, error } = await supabase.rpc('converter_pedido_em_orcamento', {
        pedido_id_param: pedidoId
      });

      if (error) throw error;

      const result = data as { success: boolean; message: string; orcamento_numero?: string };
      
      if (!result.success) {
        toast.error("Erro ao converter", {
          description: result.message
        });
        return;
      }

      toast.success("Pedido convertido!", {
        description: `Orçamento ${result.orcamento_numero} criado com sucesso`
      });

      fetchPedidos();
      
    } catch (error: any) {
      toast.error("Erro ao converter pedido", {
        description: error.message
      });
    }
  };

  const handleWhatsApp = (telefone: string | null, nomePedido: string) => {
    if (!telefone) {
      toast.error("Telefone não disponível", {
        description: "Este cliente não possui telefone cadastrado"
      });
      return;
    }

    const cleanPhone = telefone.replace(/\D/g, '');
    const message = encodeURIComponent(`Olá! Entrando em contato sobre o pedido ${nomePedido}.`);
    window.open(`https://wa.me/55${cleanPhone}?text=${message}`, '_blank');
  };

  // ========== FUNÇÕES AUXILIARES ==========
  const getOrcamentosFiltrados = () => {
    // Agora todos os orçamentos são aprovados, mas mantemos a verificação
    const orcamentosFiltradosPorStatus = orcamentosAprovados.filter(o => 
      statusPermiteConversao(o.status)
    );

    switch (filtro) {
      case 'nao_convertidos':
        return orcamentosFiltradosPorStatus.filter(o => !o.ja_convertido);
      case 'convertidos':
        return orcamentosFiltradosPorStatus.filter(o => o.ja_convertido);
      default:
        return orcamentosFiltradosPorStatus;
    }
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

  const getItemInfo = (item: PedidoItem) => {
    if (item.produtos) {
      return {
        tipo: 'Produto',
        codigo: item.produtos.codigo || 'N/A',
        nome: item.produtos.nome || item.produtos.descricao || 'Produto',
        unidade: item.produtos.unidade || 'UN'
      };
    }
    
    if (item.kit) {
      return {
        tipo: 'Kit',
        codigo: item.kit.codigo || 'N/A',
        nome: item.kit.nome || 'Kit',
        unidade: 'UN'
      };
    }
    
    return {
      tipo: 'Item',
      codigo: 'N/A',
      nome: 'Item',
      unidade: 'UN'
    };
  };

  // ========== MODAL DE ITENS ==========
  const ItensModal = () => {
    return (
      <Dialog open={!!selectedPedido} onOpenChange={(open) => !open && setSelectedPedido(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Itens do Pedido {selectedPedidoNumero || selectedPedido?.numero}</DialogTitle>
            <DialogDescription>
              Detalhes dos produtos e kits incluídos no pedido
            </DialogDescription>
          </DialogHeader>

          {loadingItens ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <p>Carregando itens...</p>
            </div>
          ) : selectedPedidoItens.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum item encontrado para este pedido
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Código</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Quantidade</TableHead>
                      <TableHead className="text-right">Preço Unit.</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedPedidoItens.map((item) => {
                      const info = getItemInfo(item);
                      
                      return (
                        <TableRow key={item.id}>
                          <TableCell>
                            <Badge variant={info.tipo === 'Produto' ? "default" : "secondary"}>
                              {info.tipo}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">
                            {info.codigo}
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{info.nome}</p>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-col items-end">
                              <span>{item.quantidade}</span>
                              <span className="text-xs text-muted-foreground">
                                {info.unidade}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(item.preco_unitario)}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(item.subtotal)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div className="mt-4 p-4 bg-muted rounded-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-semibold">Resumo do Pedido</h4>
                    <p className="text-sm text-muted-foreground">
                      Total de itens: {selectedPedidoItens.length}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold">
                      {selectedPedido && formatCurrency(selectedPedido.valor_total)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Valor total do pedido
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    );
  };

  // ========== RENDERIZAÇÃO ==========
  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  const orcamentosFiltrados = getOrcamentosFiltrados();

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Cabeçalho */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">Pedidos</h1>
        <p className="text-muted-foreground">Gerencie os pedidos dos clientes</p>
      </div>

      {/* DEBUG: Informações sobre orçamentos filtrados */}
      {debugInfo && (
        <div className="mt-4 p-3 bg-blue-50 rounded-md text-sm">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-medium">Informações:</span>
              <span className="ml-2 text-blue-700">
                {orcamentosAprovados.length} orçamentos aprovados carregados
                ({orcamentosFiltrados.length} após filtros)
              </span>
            </div>
            <Button 
              size="sm" 
              variant="ghost"
              onClick={() => {
                const statusList = orcamentosAprovados.map(o => o.status);
                const uniqueStatus = [...new Set(statusList)];
                toast.info("Status encontrados", {
                  description: uniqueStatus.join(', ')
                });
              }}
            >
              Ver Status
            </Button>
          </div>
        </div>
      )}

      {/* Seção de Orçamentos Aprovados */}
      {orcamentosAprovados.length > 0 && (
        <Card className="border-green-200">
          <CardHeader>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <CardTitle className="flex items-center gap-2 text-green-700">
                <FileText className="h-5 w-5" />
                Orçamentos Aprovados
                <Badge variant="outline" className="bg-green-100 text-green-800">
                  {orcamentosAprovados.length} total
                </Badge>
              </CardTitle>
              
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={filtro === 'todos' ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFiltro('todos')}
                >
                  <Filter className="h-4 w-4 mr-1" />
                  Todos
                </Button>
                <Button
                  variant={filtro === 'nao_convertidos' ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFiltro('nao_convertidos')}
                  className="bg-amber-100 hover:bg-amber-200 text-amber-800"
                >
                  <Clock className="h-4 w-4 mr-1" />
                  Não Convertidos
                </Button>
                <Button
                  variant={filtro === 'convertidos' ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFiltro('convertidos')}
                  className="bg-blue-100 hover:bg-blue-200 text-blue-800"
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Convertidos
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Pedido</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orcamentosFiltrados.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Nenhum orçamento encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    orcamentosFiltrados.map((orcamento) => {
                      const StatusIcon = statusConfig[orcamento.status as keyof typeof statusConfig]?.icon || FileText;
                      const permiteConversao = statusPermiteConversao(orcamento.status);
                      
                      return (
                        <TableRow key={orcamento.id} className="hover:bg-green-50">
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-green-600" />
                              {orcamento.numero}
                            </div>
                          </TableCell>
                          <TableCell>{orcamento.cliente_nome}</TableCell>
                          <TableCell>{formatDate(orcamento.created_at)}</TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(orcamento.valor_total)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge className={statusConfig[orcamento.status as keyof typeof statusConfig]?.color || "bg-gray-100"}>
                                <StatusIcon className="h-3 w-3 mr-1" />
                                {statusLabels[orcamento.status] || orcamento.status}
                              </Badge>
                              {!permiteConversao && (
                                <Badge variant="outline" className="text-xs bg-red-100 text-red-800">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Não conversível
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {orcamento.ja_convertido ? (
                              <div className="flex items-center gap-2">
                                <ShoppingCart className="h-4 w-4 text-blue-600" />
                                <span className="font-medium text-blue-700">
                                  {orcamento.numero_pedido_convertido || 'Criado'}
                                </span>
                                <Badge variant="outline" className="text-xs bg-green-100 text-green-800">
                                  Confirmado
                                </Badge>
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">
                                Aguardando conversão
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {!orcamento.ja_convertido && permiteConversao ? (
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => converterOrcamentoParaPedido(orcamento)}
                                disabled={convertendoOrcamento === orcamento.id}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                {convertendoOrcamento === orcamento.id ? (
                                  <>
                                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    Convertendo...
                                  </>
                                ) : (
                                  <>
                                    <ArrowRight className="h-4 w-4 mr-1" />
                                    Converter
                                  </>
                                )}
                              </Button>
                            ) : (
                              <span className="text-muted-foreground text-sm">
                                {orcamento.ja_convertido ? 'Convertido' : 'Não conversível'}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Seção de Pedidos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            Lista de Pedidos
            <Badge variant="outline" className="ml-2">
              {pedidos.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pedidos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum pedido encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  pedidos.map((pedido) => {
                    const statusKey = pedido.status as keyof typeof statusConfig;
                    const StatusIcon = statusConfig[statusKey]?.icon || Clock;
                    const isDeOrcamento = pedido.orcamento_id != null;
                    
                    return (
                      <TableRow key={pedido.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {isDeOrcamento ? (
                              <FileText className="h-3 w-3 text-green-600" title="Convertido de orçamento" />
                            ) : (
                              <ShoppingCart className="h-3 w-3 text-blue-600" title="Pedido direto" />
                            )}
                            {pedido.numero}
                          </div>
                        </TableCell>
                        <TableCell>{pedido.clientes?.nome || '-'}</TableCell>
                        <TableCell>{formatDate(pedido.created_at)}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(pedido.valor_total)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Badge className={statusConfig[statusKey]?.color || "bg-gray-100"}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {statusLabels[pedido.status] || pedido.status}
                            </Badge>
                            {isDeOrcamento && (
                              <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                                De Orçamento
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {/* Ações para pedidos pendentes do catálogo */}
                            {pedido.status === 'pendente' && !isDeOrcamento && (
                              <>
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => handleConverterEmOrcamento(pedido.id)}
                                >
                                  <Check className="h-4 w-4 mr-1" />
                                  Orçamento
                                </Button>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button size="sm" variant="destructive">
                                      <XCircle className="h-4 w-4 mr-1" />
                                      Rejeitar
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Rejeitar pedido?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        Esta ação não pode ser desfeita.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={async () => {
                                          const { error } = await supabase
                                            .from('pedidos')
                                            .update({ status: 'cancelado' })
                                            .eq('id', pedido.id);

                                          if (error) throw error;

                                          toast.success("Pedido rejeitado!");
                                          fetchPedidos();
                                        }}
                                      >
                                        Confirmar
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </>
                            )}

                            {/* Botão para ver itens */}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAbrirModalItens(pedido)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Ver Itens
                            </Button>

                            {/* Botão WhatsApp */}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleWhatsApp(pedido.clientes?.telefone || null, pedido.numero)}
                            >
                              <Phone className="h-4 w-4 mr-1" />
                              WhatsApp
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Itens */}
      {selectedPedido && <ItensModal />}
    </div>
  );
}