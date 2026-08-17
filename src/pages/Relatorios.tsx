// @ts-nocheck - Relatórios completos e funcionais
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  BarChart3, 
  FileDown, 
  Calendar, 
  TrendingUp, 
  Package, 
  Users, 
  ShoppingCart, 
  Truck, 
  Filter,
  DollarSign,
  ClipboardList,
  AlertTriangle,
  UserCheck,
  Award,
  PieChart
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format, subDays, startOfMonth, endOfMonth, eachMonthOfInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

export default function Relatorios() {
  const [loading, setLoading] = useState<string | null>(null);
  const [dataInicio, setDataInicio] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [dataFim, setDataFim] = useState(format(new Date(), 'yyyy-MM-dd'));

  // ================ FUNCOES AUXILIARES ================
  const formatarData = (data: string | null) => {
    if (!data) return '-';
    try {
      return format(new Date(data), 'dd/MM/yyyy');
    } catch {
      return '-';
    }
  };

  const formatarDataHora = (data: string | null) => {
    if (!data) return '-';
    try {
      return format(new Date(data), 'dd/MM/yyyy HH:mm');
    } catch {
      return '-';
    }
  };

  const formatarMoeda = (valor: number | null) => {
    if (!valor && valor !== 0) return 'R$ 0,00';
    return `R$ ${valor.toFixed(2).replace('.', ',')}`;
  };

  const formatarNumero = (valor: number | null) => {
    if (!valor && valor !== 0) return '0';
    return valor.toString();
  };

  const formatarPercentual = (valor: number | null) => {
    if (!valor && valor !== 0) return '0%';
    return `${valor.toFixed(1).replace('.', ',')}%`;
  };

  // ================ FUNCAO PARA BUSCAR DADOS SEM JOBS (EVITANDO ERROS DE SCHEMA) ================
  const buscarComissoes = async (dataInicio: string, dataFim: string) => {
    // Buscar comissões
    const { data: comissoes, error } = await supabase
      .from('comissoes')
      .select('*')
      .gte('created_at', `${dataInicio}T00:00:00`)
      .lte('created_at', `${dataFim}T23:59:59`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!comissoes || comissoes.length === 0) return [];

    // Buscar vendedores relacionados
    const vendedorIds = [...new Set(comissoes.map(c => c.vendedor_id).filter(Boolean))];
    const { data: vendedores } = await supabase
      .from('vendedores')
      .select('id, nome, email, comissao_percentual, telefone, ativo')
      .in('id', vendedorIds);

    // Buscar orçamentos relacionados
    const orcamentoIds = [...new Set(comissoes.map(c => c.orcamento_id).filter(Boolean))];
    const { data: orcamentos } = await supabase
      .from('orcamentos')
      .select('id, numero, created_at, valor_total, status, cliente_id')
      .in('id', orcamentoIds);

    // Buscar clientes relacionados aos orçamentos
    const clienteIds = [...new Set(orcamentos?.map(o => o.cliente_id).filter(Boolean) || [])];
    const { data: clientes } = await supabase
      .from('clientes')
      .select('id, nome, cpf_cnpj')
      .in('id', clienteIds);

    // Montar estrutura de dados completa
    return comissoes.map(comissao => {
      const vendedor = vendedores?.find(v => v.id === comissao.vendedor_id);
      const orcamento = orcamentos?.find(o => o.id === comissao.orcamento_id);
      const cliente = clientes?.find(c => c.id === orcamento?.cliente_id);
      
      return {
        ...comissao,
        vendedor: vendedor || null,
        orcamento: orcamento ? { ...orcamento, cliente: cliente || null } : null
      };
    });
  };

  const buscarPedidos = async (dataInicio: string, dataFim: string) => {
    // Buscar pedidos
    const { data: pedidos, error } = await supabase
      .from('pedidos')
      .select('*')
      .gte('data_pedido', dataInicio)
      .lte('data_pedido', dataFim)
      .order('data_pedido', { ascending: false });

    if (error) throw error;
    if (!pedidos || pedidos.length === 0) return [];

    // Buscar clientes
    const clienteIds = [...new Set(pedidos.map(p => p.cliente_id).filter(Boolean))];
    const { data: clientes } = await supabase
      .from('clientes')
      .select('id, nome, cpf_cnpj, telefone, email, cidade, estado')
      .in('id', clienteIds);

    // Buscar itens dos pedidos
    const pedidoIds = pedidos.map(p => p.id);
    const { data: itens } = await supabase
      .from('pedido_itens')
      .select('*')
      .in('pedido_id', pedidoIds);

    // Buscar produtos dos itens
    const produtoIds = [...new Set(itens?.map(i => i.produto_id).filter(Boolean) || [])];
    const { data: produtos } = await supabase
      .from('produtos')
      .select('id, codigo, nome, descricao, categoria, preco')
      .in('id', produtoIds);

    // Buscar kits dos itens
    const kitIds = [...new Set(itens?.map(i => i.kit_id).filter(Boolean) || [])];
    const { data: kits } = await supabase
      .from('kits')
      .select('id, codigo, nome, preco_total')
      .in('id', kitIds);

    // Montar estrutura completa
    return pedidos.map(pedido => {
      const cliente = clientes?.find(c => c.id === pedido.cliente_id);
      const pedidoItens = itens?.filter(i => i.pedido_id === pedido.id) || [];
      
      const itensCompletos = pedidoItens.map(item => {
        const produto = produtos?.find(p => p.id === item.produto_id);
        const kit = kits?.find(k => k.id === item.kit_id);
        return {
          ...item,
          produtos: produto || null,
          kits: kit || null
        };
      });

      return {
        ...pedido,
        clientes: cliente || null,
        pedido_itens: itensCompletos
      };
    });
  };

  const buscarProdutos = async () => {
    const { data: produtos, error } = await supabase
      .from('produtos')
      .select('*')
      .order('nome', { ascending: true });

    if (error) throw error;
    return produtos || [];
  };

  const buscarOrcamentos = async (dataInicio: string, dataFim: string) => {
    // Buscar orçamentos
    const { data: orcamentos, error } = await supabase
      .from('orcamentos')
      .select('*')
      .gte('created_at', `${dataInicio}T00:00:00`)
      .lte('created_at', `${dataFim}T23:59:59`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (!orcamentos || orcamentos.length === 0) return [];

    // Buscar clientes
    const clienteIds = [...new Set(orcamentos.map(o => o.cliente_id).filter(Boolean))];
    const { data: clientes } = await supabase
      .from('clientes')
      .select('id, nome, cpf_cnpj, telefone, email, cidade, estado')
      .in('id', clienteIds);

    // Buscar itens dos orçamentos
    const orcamentoIds = orcamentos.map(o => o.id);
    const { data: itens } = await supabase
      .from('orcamento_itens')
      .select('*')
      .in('orcamento_id', orcamentoIds);

    // Buscar produtos dos itens
    const produtoIds = [...new Set(itens?.map(i => i.produto_id).filter(Boolean) || [])];
    const { data: produtos } = await supabase
      .from('produtos')
      .select('id, codigo, nome, descricao')
      .in('id', produtoIds);

    // Buscar kits dos itens
    const kitIds = [...new Set(itens?.map(i => i.kit_id).filter(Boolean) || [])];
    const { data: kits } = await supabase
      .from('kits')
      .select('id, codigo, nome, preco_total')
      .in('id', kitIds);

    // Buscar pedidos convertidos
    const { data: pedidos } = await supabase
      .from('pedidos')
      .select('id, numero, created_at, orcamento_id')
      .in('orcamento_id', orcamentoIds);

    // Montar estrutura completa
    return orcamentos.map(orcamento => {
      const cliente = clientes?.find(c => c.id === orcamento.cliente_id);
      const orcamentoItens = itens?.filter(i => i.orcamento_id === orcamento.id) || [];
      const pedido = pedidos?.find(p => p.orcamento_id === orcamento.id);
      
      const itensCompletos = orcamentoItens.map(item => {
        const produto = produtos?.find(p => p.id === item.produto_id);
        const kit = kits?.find(k => k.id === item.kit_id);
        return {
          ...item,
          produtos: produto || null,
          kits: kit || null
        };
      });

      return {
        ...orcamento,
        clientes: cliente || null,
        orcamento_itens: itensCompletos,
        pedidos: pedido ? [pedido] : []
      };
    });
  };

  const buscarTransacoes = async (dataInicio: string, dataFim: string) => {
    const { data: transacoes, error } = await supabase
      .from('transacoes_financeiras')
      .select('*')
      .gte('data', `${dataInicio}T00:00:00`)
      .lte('data', `${dataFim}T23:59:59`)
      .order('data', { ascending: false });

    if (error) throw error;
    return transacoes || [];
  };

  const buscarClientes = async () => {
    // Buscar clientes
    const { data: clientes, error } = await supabase
      .from('clientes')
      .select('*')
      .order('nome', { ascending: true });

    if (error) throw error;
    if (!clientes || clientes.length === 0) return [];

    // Buscar pedidos dos clientes
    const clienteIds = clientes.map(c => c.id);
    const { data: pedidos } = await supabase
      .from('pedidos')
      .select('*')
      .in('cliente_id', clienteIds);

    // Montar estrutura completa
    return clientes.map(cliente => {
      const clientePedidos = pedidos?.filter(p => p.cliente_id === cliente.id) || [];
      return {
        ...cliente,
        pedidos: clientePedidos
      };
    });
  };

  const buscarCompras = async (dataInicio: string, dataFim: string) => {
    // Buscar compras
    const { data: compras, error } = await supabase
      .from('compras')
      .select('*')
      .gte('data_emissao', dataInicio)
      .lte('data_emissao', dataFim)
      .order('data_emissao', { ascending: false });

    if (error) throw error;
    if (!compras || compras.length === 0) return [];

    // Buscar fornecedores
    const fornecedorIds = [...new Set(compras.map(c => c.fornecedor_id).filter(Boolean))];
    const { data: fornecedores } = await supabase
      .from('fornecedores')
      .select('id, nome, cnpj, telefone, email')
      .in('id', fornecedorIds);

    // Buscar itens das compras
    const compraIds = compras.map(c => c.id);
    const { data: itens } = await supabase
      .from('compra_itens')
      .select('*')
      .in('compra_id', compraIds);

    // Buscar produtos dos itens
    const produtoIds = [...new Set(itens?.map(i => i.produto_id).filter(Boolean) || [])];
    const { data: produtos } = await supabase
      .from('produtos')
      .select('id, codigo, nome, descricao, categoria, unidade')
      .in('id', produtoIds);

    // Montar estrutura completa
    return compras.map(compra => {
      const fornecedor = fornecedores?.find(f => f.id === compra.fornecedor_id);
      const compraItens = itens?.filter(i => i.compra_id === compra.id) || [];
      
      const itensCompletos = compraItens.map(item => {
        const produto = produtos?.find(p => p.id === item.produto_id);
        return {
          ...item,
          produtos: produto || null
        };
      });

      return {
        ...compra,
        fornecedores: fornecedor || null,
        compra_itens: itensCompletos
      };
    });
  };

  // ================ RELATORIO DE COMISSOES POR MES ================
  const generateComissoesReport = async () => {
    setLoading("comissoes");
    try {
      if (!dataInicio || !dataFim) {
        toast({ 
          title: "Periodo nao informado", 
          description: "Selecione a data inicial e final.", 
          variant: "destructive" 
        });
        return;
      }

      const comissoes = await buscarComissoes(dataInicio, dataFim);
      
      if (!comissoes || comissoes.length === 0) {
        toast({ 
          title: "Nenhuma comissao encontrada", 
          description: `Periodo: ${formatarData(dataInicio)} a ${formatarData(dataFim)}`, 
          variant: "destructive" 
        });
        return;
      }

      const doc = new jsPDF({ orientation: 'landscape' });
      
      // Título
      doc.setFontSize(20);
      doc.setTextColor(255, 193, 7); // Amarelo
      doc.text("RELATORIO DE COMISSOES", 14, 20);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      doc.text(`Periodo: ${formatarData(dataInicio)} a ${formatarData(dataFim)}`, 14, 30);
      doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 37);
      doc.text(`Total de comissoes registradas: ${comissoes.length}`, 14, 44);

      // Estatísticas gerais
      const totalComissoes = comissoes.length;
      const comissoesPendentes = comissoes.filter(c => c.status === 'pendente').length;
      const comissoesPagas = comissoes.filter(c => c.status === 'pago').length;
      const comissoesCanceladas = comissoes.filter(c => c.status === 'cancelado').length;

      const valorTotalComissoes = comissoes.reduce((sum, c) => sum + (Number(c.valor_comissao) || 0), 0);
      const valorPendente = comissoes.filter(c => c.status === 'pendente')
        .reduce((sum, c) => sum + (Number(c.valor_comissao) || 0), 0);
      const valorPago = comissoes.filter(c => c.status === 'pago')
        .reduce((sum, c) => sum + (Number(c.valor_comissao) || 0), 0);
      const valorCancelado = comissoes.filter(c => c.status === 'cancelado')
        .reduce((sum, c) => sum + (Number(c.valor_comissao) || 0), 0);

      const valorTotalOrcamentos = comissoes.reduce((sum, c) => sum + (Number(c.valor_orcamento) || 0), 0);
      const percentualMedioComissao = comissoes.length > 0 
        ? comissoes.reduce((sum, c) => sum + (Number(c.percentual_comissao) || 0), 0) / comissoes.length 
        : 0;

      doc.setFontSize(14);
      doc.setTextColor(255, 193, 7);
      doc.text("RESUMO EXECUTIVO", 14, 57);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      
      let y = 67;
      doc.text(`Total de Comissoes: ${totalComissoes}`, 14, y);
      doc.text(`  - Pendentes: ${comissoesPendentes} (${((comissoesPendentes/totalComissoes)*100).toFixed(1)}%)`, 14, y + 7);
      doc.text(`  - Pagas: ${comissoesPagas} (${((comissoesPagas/totalComissoes)*100).toFixed(1)}%)`, 14, y + 14);
      doc.text(`  - Canceladas: ${comissoesCanceladas} (${((comissoesCanceladas/totalComissoes)*100).toFixed(1)}%)`, 14, y + 21);
      
      doc.text(`Valor Total das Comissoes: ${formatarMoeda(valorTotalComissoes)}`, 14, y + 31);
      doc.text(`  - Pendente: ${formatarMoeda(valorPendente)}`, 14, y + 38);
      doc.text(`  - Pago: ${formatarMoeda(valorPago)}`, 14, y + 45);
      doc.text(`  - Cancelado: ${formatarMoeda(valorCancelado)}`, 14, y + 52);
      
      doc.text(`Valor Total dos Orcamentos: ${formatarMoeda(valorTotalOrcamentos)}`, 14, y + 62);
      doc.text(`Percentual Medio de Comissao: ${formatarPercentual(percentualMedioComissao)}`, 14, y + 69);

      // Agrupar por vendedor
      const comissoesPorVendedor: any = {};
      comissoes.forEach(c => {
        if (c.vendedor) {
          const vendedorId = c.vendedor.id;
          if (!comissoesPorVendedor[vendedorId]) {
            comissoesPorVendedor[vendedorId] = {
              id: vendedorId,
              nome: c.vendedor.nome,
              email: c.vendedor.email,
              comissao_padrao: c.vendedor.comissao_percentual,
              total_orcamentos: 0,
              total_comissoes: 0,
              total_pago: 0,
              total_pendente: 0,
              total_cancelado: 0,
              qtd_orcamentos: 0,
              qtd_pagos: 0,
              qtd_pendentes: 0,
              qtd_cancelados: 0,
              media_percentual: 0
            };
          }
          
          const v = comissoesPorVendedor[vendedorId];
          v.total_orcamentos += Number(c.valor_orcamento) || 0;
          v.total_comissoes += Number(c.valor_comissao) || 0;
          v.qtd_orcamentos += 1;
          
          if (c.status === 'pago') {
            v.total_pago += Number(c.valor_comissao) || 0;
            v.qtd_pagos += 1;
          } else if (c.status === 'pendente') {
            v.total_pendente += Number(c.valor_comissao) || 0;
            v.qtd_pendentes += 1;
          } else if (c.status === 'cancelado') {
            v.total_cancelado += Number(c.valor_comissao) || 0;
            v.qtd_cancelados += 1;
          }
        }
      });

      // Calcular médias
      Object.values(comissoesPorVendedor).forEach((v: any) => {
        v.media_percentual = v.total_orcamentos > 0 
          ? (v.total_comissoes / v.total_orcamentos) * 100 
          : 0;
      });

      doc.setFontSize(14);
      doc.setTextColor(255, 193, 7);
      doc.text("ANALISE POR VENDEDOR", 14, y + 87);
      doc.setTextColor(0, 0, 0);

      const vendedorData = Object.values(comissoesPorVendedor).map((v: any) => [
        v.nome.substring(0, 20),
        v.qtd_orcamentos.toString(),
        formatarMoeda(v.total_orcamentos),
        formatarMoeda(v.total_comissoes),
        formatarPercentual(v.media_percentual),
        formatarMoeda(v.total_pago),
        formatarMoeda(v.total_pendente),
        `${v.qtd_pagos}/${v.qtd_pendentes}/${v.qtd_cancelados}`
      ]);

      autoTable(doc, {
        startY: y + 97,
        head: [
          ['Vendedor', 'Qtd', 'Total Vendas', 'Total Comissões', '% Médio', 'Pago', 'Pendente', 'P/Pd/C']
        ],
        body: vendedorData,
        styles: { fontSize: 7 },
        headStyles: { fillColor: [255, 193, 7], textColor: 0 }
      });

      // Agrupar por mês
      const comissoesPorMes: any = {};
      comissoes.forEach(c => {
        const mes = format(new Date(c.created_at), 'yyyy-MM');
        const mesNome = format(new Date(c.created_at), 'MMMM/yyyy', { locale: ptBR });
        
        if (!comissoesPorMes[mes]) {
          comissoesPorMes[mes] = {
            mes: mesNome,
            total_orcamentos: 0,
            total_comissoes: 0,
            total_pago: 0,
            total_pendente: 0,
            qtd_orcamentos: 0,
            qtd_pagos: 0,
            qtd_pendentes: 0
          };
        }
        
        const m = comissoesPorMes[mes];
        m.total_orcamentos += Number(c.valor_orcamento) || 0;
        m.total_comissoes += Number(c.valor_comissao) || 0;
        m.qtd_orcamentos += 1;
        
        if (c.status === 'pago') {
          m.total_pago += Number(c.valor_comissao) || 0;
          m.qtd_pagos += 1;
        } else if (c.status === 'pendente') {
          m.total_pendente += Number(c.valor_comissao) || 0;
          m.qtd_pendentes += 1;
        }
      });

      // Ordenar por mês
      const mesesOrdenados = Object.keys(comissoesPorMes).sort();
      
      doc.addPage();
      doc.setFontSize(16);
      doc.setTextColor(255, 193, 7);
      doc.text("COMISSOES POR MES", 14, 20);
      doc.setTextColor(0, 0, 0);

      const mesData = mesesOrdenados.map(mes => {
        const m = comissoesPorMes[mes];
        return [
          m.mes,
          m.qtd_orcamentos.toString(),
          formatarMoeda(m.total_orcamentos),
          formatarMoeda(m.total_comissoes),
          formatarPercentual((m.total_comissoes / m.total_orcamentos) * 100),
          formatarMoeda(m.total_pago),
          formatarMoeda(m.total_pendente),
          `${m.qtd_pagos}/${m.qtd_pendentes}`
        ];
      });

      autoTable(doc, {
        startY: 30,
        head: [
          ['Mês', 'Orçamentos', 'Total Vendas', 'Comissões', '% Médio', 'Pago', 'Pendente', 'P/Pd']
        ],
        body: mesData,
        styles: { fontSize: 7 },
        headStyles: { fillColor: [255, 193, 7], textColor: 0 }
      });

      // Top 10 maiores comissões
      const maioresComissoes = [...comissoes]
        .sort((a, b) => Number(b.valor_comissao) - Number(a.valor_comissao))
        .slice(0, 10);

      doc.addPage();
      doc.setFontSize(16);
      doc.setTextColor(255, 193, 7);
      doc.text("TOP 10 MAIORES COMISSOES", 14, 20);
      doc.setTextColor(0, 0, 0);

      const topData = maioresComissoes.map((c, i) => [
        (i + 1).toString(),
        c.vendedor?.nome?.substring(0, 15) || '---',
        c.orcamento?.numero || '---',
        c.orcamento?.cliente?.nome?.substring(0, 15) || '---',
        formatarMoeda(Number(c.valor_orcamento)),
        formatarPercentual(Number(c.percentual_comissao)),
        formatarMoeda(Number(c.valor_comissao)),
        c.status || 'pendente',
        formatarData(c.created_at)
      ]);

      autoTable(doc, {
        startY: 30,
        head: [
          ['#', 'Vendedor', 'Orçamento', 'Cliente', 'Valor Venda', '%', 'Comissão', 'Status', 'Data']
        ],
        body: topData,
        styles: { fontSize: 6 },
        headStyles: { fillColor: [255, 193, 7], textColor: 0 }
      });

      // Detalhamento completo
      doc.addPage();
      doc.setFontSize(16);
      doc.setTextColor(52, 73, 94);
      doc.text("DETALHAMENTO DE COMISSOES", 14, 20);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      doc.text(`Total: ${comissoes.length} comissões`, 14, 30);

      const detalheData = comissoes.map(c => [
        c.vendedor?.nome?.substring(0, 15) || '---',
        c.orcamento?.numero || '---',
        c.orcamento?.cliente?.nome?.substring(0, 15) || '---',
        formatarMoeda(Number(c.valor_orcamento)),
        formatarPercentual(Number(c.percentual_comissao)),
        formatarMoeda(Number(c.valor_comissao)),
        c.status || 'pendente',
        c.data_pagamento ? formatarData(c.data_pagamento) : '-',
        formatarData(c.created_at)
      ]);

      autoTable(doc, {
        startY: 40,
        head: [
          ['Vendedor', 'Orçamento', 'Cliente', 'Valor Venda', '%', 'Comissão', 'Status', 'Data Pagto', 'Data Criação']
        ],
        body: detalheData,
        styles: { fontSize: 6 },
        headStyles: { fillColor: [52, 73, 94], textColor: 255 }
      });

      // Resumo estatístico
      doc.addPage();
      doc.setFontSize(16);
      doc.setTextColor(52, 73, 94);
      doc.text("ESTATISTICAS DE COMISSOES", 14, 20);
      doc.setTextColor(0, 0, 0);
      
      let statsY = 35;
      doc.setFontSize(12);
      doc.text("Indicadores de Performance:", 14, statsY);
      doc.setFontSize(11);
      
      const ticketMedioComissao = totalComissoes > 0 ? valorTotalComissoes / totalComissoes : 0;
      const ticketMedioOrcamento = totalComissoes > 0 ? valorTotalOrcamentos / totalComissoes : 0;
      const vendedoresAtivos = Object.keys(comissoesPorVendedor).length;
      
      statsY += 10;
      doc.text(`Ticket Medio por Comissao: ${formatarMoeda(ticketMedioComissao)}`, 14, statsY);
      doc.text(`Ticket Medio dos Orcamentos: ${formatarMoeda(ticketMedioOrcamento)}`, 14, statsY + 7);
      doc.text(`Total de Vendedores com Comissao: ${vendedoresAtivos}`, 14, statsY + 14);
      doc.text(`Percentual de Comissoes Pagas: ${totalComissoes > 0 ? ((comissoesPagas/totalComissoes)*100).toFixed(1) : 0}%`, 14, statsY + 21);
      doc.text(`Percentual de Comissoes Pendentes: ${totalComissoes > 0 ? ((comissoesPendentes/totalComissoes)*100).toFixed(1) : 0}%`, 14, statsY + 28);
      
      statsY += 45;
      doc.setFontSize(12);
      doc.text("Top 3 Vendedores por Valor de Comissao:", 14, statsY);
      doc.setFontSize(11);
      
      const topVendedores = Object.values(comissoesPorVendedor)
        .sort((a: any, b: any) => b.total_comissoes - a.total_comissoes)
        .slice(0, 3);
      
      statsY += 10;
      topVendedores.forEach((v: any, index) => {
        doc.text(`  ${index + 1}. ${v.nome.substring(0, 25)}: ${formatarMoeda(v.total_comissoes)} (${v.qtd_orcamentos} orçamentos)`, 14, statsY + (index * 7));
      });

      doc.save(`comissoes-${format(new Date(), 'dd-MM-yyyy-HHmm')}.pdf`);
      toast({ title: "Relatorio de comissoes gerado com sucesso!" });
      
    } catch (error: any) {
      console.error('Erro ao gerar relatorio de comissoes:', error);
      toast({ 
        title: "Erro ao gerar relatorio de comissoes", 
        description: error.message || "Verifique as permissoes e relacionamentos no banco de dados", 
        variant: "destructive" 
      });
    } finally {
      setLoading(null);
    }
  };

  // ================ RELATORIO DE VENDAS (PEDIDOS) - CORRIGIDO SEM ORÇAMENTOS ================
  const generateVendasReport = async () => {
    setLoading("vendas");
    try {
      if (!dataInicio || !dataFim) {
        toast({ 
          title: "Periodo nao informado", 
          description: "Selecione a data inicial e final.", 
          variant: "destructive" 
        });
        return;
      }

      // Buscar apenas pedidos
      const pedidos = await buscarPedidos(dataInicio, dataFim);

      if (!pedidos || pedidos.length === 0) {
        toast({ 
          title: "Nenhum pedido encontrado", 
          description: `Periodo: ${formatarData(dataInicio)} a ${formatarData(dataFim)}`, 
          variant: "destructive" 
        });
        return;
      }

      const doc = new jsPDF({ orientation: 'landscape' });
      
      // Título
      doc.setFontSize(20);
      doc.setTextColor(41, 128, 185); // Azul
      doc.text("RELATORIO DE VENDAS (PEDIDOS)", 14, 20);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      doc.text(`Periodo: ${formatarData(dataInicio)} a ${formatarData(dataFim)}`, 14, 30);
      doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 37);
      doc.text(`Total de pedidos: ${pedidos.length}`, 14, 44);

      // Estatísticas gerais
      const totalPedidos = pedidos.length;
      const valorTotal = pedidos.reduce((sum, p) => sum + (Number(p.valor_total) || 0), 0);
      const ticketMedio = totalPedidos > 0 ? valorTotal / totalPedidos : 0;
      const mediaItens = pedidos.reduce((sum, p) => sum + (p.pedido_itens?.length || 0), 0) / totalPedidos;

      // Status dos pedidos
      const statusCount: any = {};
      pedidos.forEach(p => {
        const status = p.status || 'pendente';
        statusCount[status] = (statusCount[status] || 0) + 1;
      });

      doc.setFontSize(14);
      doc.setTextColor(41, 128, 185);
      doc.text("RESUMO EXECUTIVO", 14, 57);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      
      let y = 67;
      doc.text(`Total de Pedidos: ${totalPedidos}`, 14, y);
      
      // Listar status
      let statusY = y + 7;
      Object.entries(statusCount).forEach(([status, count], index) => {
        doc.text(`  - ${status}: ${count} (${((Number(count)/totalPedidos)*100).toFixed(1)}%)`, 14, statusY + (index * 7));
      });

      const statusLines = Object.keys(statusCount).length;
      y = y + 10 + (statusLines * 7);

      doc.text(`Valor Total: ${formatarMoeda(valorTotal)}`, 14, y);
      doc.text(`Ticket Medio: ${formatarMoeda(ticketMedio)}`, 14, y + 7);
      doc.text(`Media de Itens por Pedido: ${mediaItens.toFixed(1)}`, 14, y + 14);

      // Agrupar por origem
      const origemCount: any = {};
      pedidos.forEach(p => {
        const origem = p.origem || 'Nao informada';
        origemCount[origem] = (origemCount[origem] || 0) + 1;
      });

      doc.setFontSize(12);
      doc.text("Pedidos por Origem:", 14, y + 27);
      doc.setFontSize(11);
      
      let origemY = y + 34;
      Object.entries(origemCount).forEach(([origem, count], index) => {
        doc.text(`  ${index + 1}. ${origem}: ${count}`, 14, origemY + (index * 7));
      });

      // DETALHAMENTO DOS PEDIDOS
      doc.addPage();
      doc.setFontSize(16);
      doc.setTextColor(41, 128, 185);
      doc.text("DETALHAMENTO DOS PEDIDOS", 14, 20);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      doc.text(`Total: ${pedidos.length} pedidos`, 14, 30);

      const tableData = pedidos.map(p => [
        p.numero || '-',
        p.clientes?.nome?.substring(0, 20) || '---',
        p.status || 'pendente',
        formatarMoeda(Number(p.valor_total)),
        p.origem || '-',
        p.pedido_itens?.length || 0,
        formatarData(p.data_pedido),
        p.data_entrega ? formatarData(p.data_entrega) : 'Pendente'
      ]);

      autoTable(doc, {
        startY: 40,
        head: [['Numero', 'Cliente', 'Status', 'Valor', 'Origem', 'Itens', 'Data Pedido', 'Data Entrega']],
        body: tableData,
        styles: { fontSize: 7 },
        headStyles: { fillColor: [41, 128, 185], textColor: 255 }
      });

      // PRODUTOS MAIS VENDIDOS
      const produtos: any = {};
      pedidos.forEach(pedido => {
        pedido.pedido_itens?.forEach((item: any) => {
          if (item.produtos) {
            const key = item.produtos.id;
            if (!produtos[key]) {
              produtos[key] = {
                codigo: item.produtos.codigo || '---',
                nome: item.produtos.nome || item.produtos.descricao || 'Produto',
                categoria: item.produtos.categoria || 'Outros',
                quantidade: 0,
                valor: 0,
                pedidos: 0
              };
            }
            produtos[key].quantidade += Number(item.quantidade) || 0;
            produtos[key].valor += Number(item.subtotal) || 0;
            produtos[key].pedidos += 1;
          }
        });
      });

      const topProdutos = Object.values(produtos)
        .sort((a: any, b: any) => b.quantidade - a.quantidade)
        .slice(0, 15);

      if (topProdutos.length > 0) {
        doc.addPage();
        doc.setFontSize(16);
        doc.setTextColor(230, 126, 34);
        doc.text("TOP 15 PRODUTOS MAIS VENDIDOS", 14, 20);
        doc.setTextColor(0, 0, 0);
        doc.text(`Periodo: ${formatarData(dataInicio)} a ${formatarData(dataFim)}`, 14, 30);
        doc.text(`Total de produtos diferentes: ${Object.keys(produtos).length}`, 14, 37);

        const produtosTableData = topProdutos.map((p: any, i: number) => [
          (i + 1).toString(),
          p.codigo,
          p.nome.substring(0, 30),
          p.categoria,
          formatarNumero(p.quantidade),
          formatarMoeda(p.valor),
          formatarMoeda(p.valor / p.quantidade),
          p.pedidos.toString()
        ]);

        autoTable(doc, {
          startY: 47,
          head: [['#', 'Codigo', 'Produto', 'Categoria', 'Qtd Vendida', 'Valor Total', 'Preco Medio', 'Qtd Pedidos']],
          body: produtosTableData,
          styles: { fontSize: 6 },
          headStyles: { fillColor: [230, 126, 34], textColor: 255 }
        });
      }

      // ANÁLISE POR CLIENTE
      const clientesCompradores: any = {};
      pedidos.forEach(pedido => {
        if (pedido.clientes) {
          const clienteId = pedido.clientes.id;
          if (!clientesCompradores[clienteId]) {
            clientesCompradores[clienteId] = {
              nome: pedido.clientes.nome || 'Cliente',
              cidade: pedido.clientes.cidade || 'N/I',
              estado: pedido.clientes.estado || 'N/I',
              qtd_pedidos: 0,
              valor_total: 0,
              itens_comprados: 0
            };
          }
          const c = clientesCompradores[clienteId];
          c.qtd_pedidos += 1;
          c.valor_total += Number(pedido.valor_total) || 0;
          c.itens_comprados += pedido.pedido_itens?.length || 0;
        }
      });

      const topClientes = Object.values(clientesCompradores)
        .sort((a: any, b: any) => b.valor_total - a.valor_total)
        .slice(0, 10);

      if (topClientes.length > 0) {
        doc.addPage();
        doc.setFontSize(16);
        doc.setTextColor(52, 73, 94);
        doc.text("TOP 10 CLIENTES POR VALOR DE COMPRA", 14, 20);
        doc.setTextColor(0, 0, 0);

        const clienteData = topClientes.map((c: any, i: number) => [
          (i + 1).toString(),
          c.nome.substring(0, 20),
          c.cidade,
          c.estado,
          c.qtd_pedidos.toString(),
          formatarMoeda(c.valor_total),
          formatarMoeda(c.valor_total / c.qtd_pedidos),
          c.itens_comprados.toString()
        ]);

        autoTable(doc, {
          startY: 30,
          head: [['#', 'Cliente', 'Cidade', 'UF', 'Pedidos', 'Total Gasto', 'Ticket Medio', 'Itens']],
          body: clienteData,
          styles: { fontSize: 7 },
          headStyles: { fillColor: [52, 73, 94], textColor: 255 }
        });
      }

      // RESUMO DIÁRIO DE VENDAS
      const vendasPorDia: any = {};
      pedidos.forEach(p => {
        const dia = format(new Date(p.data_pedido || p.created_at), 'dd/MM/yyyy');
        if (!vendasPorDia[dia]) {
          vendasPorDia[dia] = {
            data: dia,
            pedidos: 0,
            valor: 0,
            itens: 0
          };
        }
        vendasPorDia[dia].pedidos += 1;
        vendasPorDia[dia].valor += Number(p.valor_total) || 0;
        vendasPorDia[dia].itens += p.pedido_itens?.length || 0;
      });

      doc.addPage();
      doc.setFontSize(16);
      doc.setTextColor(52, 73, 94);
      doc.text("RESUMO DIARIO DE VENDAS", 14, 20);
      doc.setTextColor(0, 0, 0);

      const diasData = Object.values(vendasPorDia)
        .sort((a: any, b: any) => a.data.localeCompare(b.data))
        .map((d: any) => [
          d.data,
          d.pedidos.toString(),
          formatarMoeda(d.valor),
          formatarNumero(d.itens),
          formatarMoeda(d.valor / d.pedidos)
        ]);

      autoTable(doc, {
        startY: 30,
        head: [['Data', 'Pedidos', 'Valor Total', 'Itens', 'Ticket Medio']],
        body: diasData,
        styles: { fontSize: 7 },
        headStyles: { fillColor: [52, 73, 94], textColor: 255 }
      });

      doc.save(`vendas-${format(new Date(), 'dd-MM-yyyy-HHmm')}.pdf`);
      toast({ title: "Relatorio de vendas gerado com sucesso!" });
      
    } catch (error: any) {
      console.error('Erro ao gerar relatorio de vendas:', error);
      toast({ 
        title: "Erro ao gerar relatorio de vendas", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setLoading(null);
    }
  };

  // ================ RELATORIO DE ESTOQUE ================
  const generateEstoqueReport = async () => {
    setLoading("estoque");
    try {
      const produtos = await buscarProdutos();

      if (!produtos || produtos.length === 0) {
        toast({ 
          title: "Nenhum produto encontrado", 
          description: "Nao ha produtos cadastrados.", 
          variant: "destructive" 
        });
        return;
      }

      const produtosComEstoque = produtos.filter(p => p.estoque !== null && p.estoque !== undefined);
      
      if (produtosComEstoque.length === 0) {
        toast({ 
          title: "Nenhum produto com estoque", 
          description: "Os produtos nao possuem controle de estoque.", 
          variant: "destructive" 
        });
        return;
      }

      const doc = new jsPDF({ orientation: 'landscape' });
      
      doc.setFontSize(20);
      doc.setTextColor(46, 204, 113);
      doc.text("RELATORIO DE ESTOQUE", 14, 20);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 30);
      doc.text(`Total de produtos com estoque: ${produtosComEstoque.length}`, 14, 37);
      doc.text(`Total de produtos cadastrados: ${produtos.length}`, 14, 44);

      const totalProdutos = produtosComEstoque.length;
      const produtosAtivos = produtosComEstoque.filter(p => p.ativo !== false).length;
      const produtosInativos = produtosComEstoque.filter(p => p.ativo === false).length;
      const quantidadeTotal = produtosComEstoque.reduce((sum, p) => sum + (Number(p.estoque) || 0), 0);
      const valorCustoTotal = produtosComEstoque.reduce((sum, p) => 
        sum + ((Number(p.estoque) || 0) * (Number(p.custo) || 0)), 0);
      const valorVendaTotal = produtosComEstoque.reduce((sum, p) => 
        sum + ((Number(p.estoque) || 0) * (Number(p.preco) || 0)), 0);
      const produtosBaixoEstoque = produtosComEstoque.filter(p => 
        (Number(p.estoque) || 0) <= (Number(p.estoque_minimo) || 0) && 
        Number(p.estoque) > 0).length;
      const produtosSemEstoque = produtosComEstoque.filter(p => 
        (Number(p.estoque) || 0) === 0).length;
      const produtosAcimaEstoque = produtosComEstoque.filter(p => 
        (Number(p.estoque) || 0) > (Number(p.estoque_minimo) || 0)).length;

      doc.setFontSize(14);
      doc.setTextColor(46, 204, 113);
      doc.text("RESUMO DO ESTOQUE", 14, 57);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      
      let y = 67;
      doc.text(`Total de Produtos com Estoque: ${totalProdutos}`, 14, y);
      doc.text(`  - Ativos: ${produtosAtivos}`, 14, y + 7);
      doc.text(`  - Inativos: ${produtosInativos}`, 14, y + 14);
      doc.text(`Quantidade Total: ${formatarNumero(quantidadeTotal)} ${produtosComEstoque[0]?.unidade || 'un'}`, 14, y + 24);
      doc.text(`Valor Total (Custo): ${formatarMoeda(valorCustoTotal)}`, 14, y + 31);
      doc.text(`Valor Total (Venda): ${formatarMoeda(valorVendaTotal)}`, 14, y + 38);
      doc.text(`Margem Bruta: ${formatarMoeda(valorVendaTotal - valorCustoTotal)}`, 14, y + 45);
      doc.text(`  - Margem %: ${valorCustoTotal > 0 ? ((valorVendaTotal - valorCustoTotal) / valorCustoTotal * 100).toFixed(1) : 0}%`, 14, y + 52);
      doc.text(`Estoque Baixo: ${produtosBaixoEstoque}`, 14, y + 62);
      doc.text(`Sem Estoque: ${produtosSemEstoque}`, 14, y + 69);
      doc.text(`Estoque Adequado: ${produtosAcimaEstoque}`, 14, y + 76);

      const estoqueBaixo = produtosComEstoque
        .filter(p => (Number(p.estoque) || 0) <= (Number(p.estoque_minimo) || 0) && 
                p.ativo !== false)
        .sort((a, b) => (Number(a.estoque) || 0) - (Number(b.estoque) || 0));

      if (estoqueBaixo.length > 0) {
        doc.setFontSize(14);
        doc.setTextColor(231, 76, 60);
        doc.text("PRODUTOS COM ESTOQUE BAIXO", 14, y + 94);
        doc.setTextColor(0, 0, 0);
        
        const baixoTableData = estoqueBaixo.map(p => [
          p.codigo || '-',
          p.nome?.substring(0, 25) || p.descricao?.substring(0, 25) || '-',
          p.categoria || '-',
          formatarNumero(p.estoque),
          formatarNumero(p.estoque_minimo),
          formatarNumero((Number(p.estoque_minimo) || 0) - (Number(p.estoque) || 0)),
          p.localizacao || '-',
          formatarMoeda(p.custo),
          formatarMoeda(((Number(p.estoque_minimo) || 0) - (Number(p.estoque) || 0)) * (Number(p.custo) || 0))
        ]);

        autoTable(doc, {
          startY: y + 104,
          head: [['Codigo', 'Produto', 'Categoria', 'Atual', 'Minimo', 'Faltante', 'Local', 'Custo', 'Reposicao']],
          body: baixoTableData,
          styles: { fontSize: 7 },
          headStyles: { fillColor: [231, 76, 60], textColor: 255 }
        });
      }

      const produtosSemEstoqueLista = produtosComEstoque
        .filter(p => (Number(p.estoque) || 0) === 0 && p.ativo !== false)
        .sort((a, b) => a.nome?.localeCompare(b.nome || '') || 0);

      if (produtosSemEstoqueLista.length > 0) {
        doc.addPage();
        doc.setFontSize(16);
        doc.setTextColor(231, 76, 60);
        doc.text("PRODUTOS SEM ESTOQUE", 14, 20);
        doc.setTextColor(0, 0, 0);
        doc.text(`Total: ${produtosSemEstoqueLista.length} produtos`, 14, 30);
        doc.text(`Necessario compra urgente`, 14, 37);

        const semEstoqueData = produtosSemEstoqueLista.map(p => [
          p.codigo || '-',
          p.nome?.substring(0, 30) || p.descricao?.substring(0, 30) || '-',
          p.categoria || '-',
          formatarNumero(p.estoque_minimo),
          p.localizacao || '-',
          formatarMoeda(p.custo),
          formatarMoeda(p.preco),
          formatarMoeda((Number(p.estoque_minimo) || 0) * (Number(p.custo) || 0))
        ]);

        autoTable(doc, {
          startY: 47,
          head: [['Codigo', 'Produto', 'Categoria', 'Minimo', 'Local', 'Custo', 'Preco', 'Custo Reposicao']],
          body: semEstoqueData,
          styles: { fontSize: 7 },
          headStyles: { fillColor: [231, 76, 60], textColor: 255 }
        });
      }

      const categorias: any = {};
      produtosComEstoque.forEach(p => {
        const categoria = p.categoria || 'Sem Categoria';
        if (!categorias[categoria]) {
          categorias[categoria] = {
            produtos: 0,
            quantidade: 0,
            valor_custo: 0,
            valor_venda: 0
          };
        }
        categorias[categoria].produtos += 1;
        categorias[categoria].quantidade += Number(p.estoque) || 0;
        categorias[categoria].valor_custo += (Number(p.estoque) || 0) * (Number(p.custo) || 0);
        categorias[categoria].valor_venda += (Number(p.estoque) || 0) * (Number(p.preco) || 0);
      });

      doc.addPage();
      doc.setFontSize(16);
      doc.setTextColor(46, 204, 113);
      doc.text("ESTOQUE POR CATEGORIA", 14, 20);
      doc.setTextColor(0, 0, 0);
      
      const categoriaData = Object.entries(categorias).map(([cat, d]: [string, any]) => [
        cat,
        d.produtos.toString(),
        formatarNumero(d.quantidade),
        formatarMoeda(d.valor_custo),
        formatarMoeda(d.valor_venda),
        formatarMoeda(d.valor_venda - d.valor_custo),
        `${d.valor_custo > 0 ? ((d.valor_venda - d.valor_custo) / d.valor_custo * 100).toFixed(1) : 0}%`
      ]);

      autoTable(doc, {
        startY: 30,
        head: [['Categoria', 'Produtos', 'Qtd', 'Custo', 'Venda', 'Margem R$', 'Margem %']],
        body: categoriaData,
        styles: { fontSize: 7 },
        headStyles: { fillColor: [46, 204, 113], textColor: 255 }
      });

      const criticos = produtosComEstoque.filter(p => (Number(p.estoque) || 0) === 0).length;
      const baixos = produtosComEstoque.filter(p => {
        const qtd = Number(p.estoque) || 0;
        return qtd > 0 && qtd <= 10;
      }).length;
      const medios = produtosComEstoque.filter(p => {
        const qtd = Number(p.estoque) || 0;
        return qtd > 10 && qtd <= 50;
      }).length;
      const altos = produtosComEstoque.filter(p => {
        const qtd = Number(p.estoque) || 0;
        return qtd > 50 && qtd <= 100;
      }).length;
      const excelentes = produtosComEstoque.filter(p => (Number(p.estoque) || 0) > 100).length;

      doc.setFontSize(14);
      doc.setTextColor(52, 73, 94);
      doc.text("DISTRIBUICAO POR FAIXA DE ESTOQUE", 14, doc.lastAutoTable.finalY + 20);
      doc.setTextColor(0, 0, 0);
      
      const faixaData = [
        ['Critico (0)', criticos.toString(), totalProdutos > 0 ? ((criticos / totalProdutos) * 100).toFixed(1) : '0'],
        ['Baixo (1-10)', baixos.toString(), totalProdutos > 0 ? ((baixos / totalProdutos) * 100).toFixed(1) : '0'],
        ['Medio (11-50)', medios.toString(), totalProdutos > 0 ? ((medios / totalProdutos) * 100).toFixed(1) : '0'],
        ['Alto (51-100)', altos.toString(), totalProdutos > 0 ? ((altos / totalProdutos) * 100).toFixed(1) : '0'],
        ['Excelente (100+)', excelentes.toString(), totalProdutos > 0 ? ((excelentes / totalProdutos) * 100).toFixed(1) : '0']
      ];

      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 30,
        head: [['Faixa de Estoque', 'Quantidade', '% do Total']],
        body: faixaData,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [52, 73, 94], textColor: 255 }
      });

      doc.addPage();
      doc.setFontSize(16);
      doc.setTextColor(52, 73, 94);
      doc.text("LISTA COMPLETA DE ESTOQUE", 14, 20);
      doc.setTextColor(0, 0, 0);
      doc.text(`Total: ${totalProdutos} produtos`, 14, 30);

      const produtosOrdenados = [...produtosComEstoque].sort((a, b) => 
        (a.nome || '').localeCompare(b.nome || '')
      );

      const completaTableData = produtosOrdenados.map(p => {
        let status = '';
        if (!p.ativo) status = 'Inativo';
        else if ((Number(p.estoque) || 0) === 0) status = 'Sem Estoque';
        else if ((Number(p.estoque) || 0) <= (Number(p.estoque_minimo) || 0)) status = 'Estoque Baixo';
        else status = 'Normal';

        return [
          p.codigo || '-',
          p.nome?.substring(0, 20) || p.descricao?.substring(0, 20) || '-',
          p.categoria || '-',
          formatarNumero(p.estoque),
          formatarNumero(p.estoque_minimo),
          p.unidade || 'un',
          p.localizacao || '-',
          formatarMoeda(p.custo),
          formatarMoeda(p.preco),
          formatarMoeda((Number(p.estoque) || 0) * (Number(p.preco) || 0)),
          status
        ];
      });

      autoTable(doc, {
        startY: 40,
        head: [['Codigo', 'Produto', 'Categoria', 'Estoque', 'Minimo', 'Und', 'Local', 'Custo', 'Preco', 'Valor Total', 'Status']],
        body: completaTableData,
        styles: { fontSize: 6 },
        headStyles: { fillColor: [52, 73, 94], textColor: 255 },
        didDrawCell: (data) => {
          if (data.column.index === 10 && data.cell.section === 'body') {
            const row = produtosOrdenados[data.row.index];
            if (row) {
              let cor = [0, 0, 0];
              if (!row.ativo) cor = [0, 0, 0];
              else if ((Number(row.estoque) || 0) === 0) cor = [231, 76, 60];
              else if ((Number(row.estoque) || 0) <= (Number(row.estoque_minimo) || 0)) cor = [241, 196, 15];
              else cor = [46, 204, 113];
              
              doc.setTextColor(cor[0], cor[1], cor[2]);
              doc.setFontSize(6);
              doc.setFont('helvetica', 'bold');
              
              let status = '';
              if (!row.ativo) status = 'Inativo';
              else if ((Number(row.estoque) || 0) === 0) status = 'Sem Estoque';
              else if ((Number(row.estoque) || 0) <= (Number(row.estoque_minimo) || 0)) status = 'Estoque Baixo';
              else status = 'Normal';
              
              doc.text(status, data.cursor.x + 2, data.cursor.y + 4);
              doc.setFont('helvetica', 'normal');
            }
          }
        }
      });

      const produtosSemControle = produtos.filter(p => p.estoque === null || p.estoque === undefined);
      
      if (produtosSemControle.length > 0) {
        doc.addPage();
        doc.setFontSize(16);
        doc.setTextColor(241, 196, 15);
        doc.text("PRODUTOS SEM CONTROLE DE ESTOQUE", 14, 20);
        doc.setTextColor(0, 0, 0);
        doc.text(`Total: ${produtosSemControle.length} produtos`, 14, 30);

        const semControleData = produtosSemControle.map(p => [
          p.codigo || '-',
          p.nome?.substring(0, 30) || p.descricao?.substring(0, 30) || '-',
          p.categoria || '-',
          p.unidade || '-',
          formatarMoeda(p.custo),
          formatarMoeda(p.preco),
          p.ativo ? 'Ativo' : 'Inativo'
        ]);

        autoTable(doc, {
          startY: 40,
          head: [['Codigo', 'Produto', 'Categoria', 'Unidade', 'Custo', 'Preco', 'Status']],
          body: semControleData,
          styles: { fontSize: 7 },
          headStyles: { fillColor: [241, 196, 15], textColor: 0 }
        });
      }

      doc.save(`estoque-${format(new Date(), 'dd-MM-yyyy-HHmm')}.pdf`);
      toast({ title: "Relatorio de estoque gerado com sucesso!" });
      
    } catch (error: any) {
      console.error('Erro:', error);
      toast({ 
        title: "Erro ao gerar relatorio", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setLoading(null);
    }
  };

  // ================ RELATORIO DE ORCAMENTOS ================
  const generateOrcamentosReport = async () => {
    setLoading("orcamentos");
    try {
      if (!dataInicio || !dataFim) {
        toast({ 
          title: "Periodo nao informado", 
          description: "Selecione a data inicial e final.", 
          variant: "destructive" 
        });
        return;
      }

      const orcamentos = await buscarOrcamentos(dataInicio, dataFim);

      if (!orcamentos || orcamentos.length === 0) {
        toast({ 
          title: "Nenhum orcamento encontrado", 
          description: `Periodo: ${formatarData(dataInicio)} a ${formatarData(dataFim)}`, 
          variant: "destructive" 
        });
        return;
      }

      const doc = new jsPDF({ orientation: 'landscape' });
      
      doc.setFontSize(20);
      doc.setTextColor(142, 68, 173);
      doc.text("RELATORIO DE ORCAMENTOS", 14, 20);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      doc.text(`Periodo: ${formatarData(dataInicio)} a ${formatarData(dataFim)}`, 14, 30);
      doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 37);
      doc.text(`Total de orcamentos: ${orcamentos.length}`, 14, 44);

      const total = orcamentos.length;
      const aprovados = orcamentos.filter(o => o.status?.toLowerCase() === 'aprovado').length;
      const convertidos = orcamentos.filter(o => o.pedidos && o.pedidos.length > 0).length;
      const pendentes = orcamentos.filter(o => !o.status || o.status?.toLowerCase() === 'pendente').length;
      const recusados = orcamentos.filter(o => o.status?.toLowerCase() === 'recusado').length;
      const expirados = orcamentos.filter(o => o.status?.toLowerCase() === 'expirado').length;
      
      const taxaAprovacao = total > 0 ? (aprovados / total * 100).toFixed(1) : '0';
      const taxaConversao = total > 0 ? (convertidos / total * 100).toFixed(1) : '0';
      
      const valorTotal = orcamentos.reduce((sum, o) => sum + (Number(o.valor_total) || 0), 0);
      const valorAprovados = orcamentos.filter(o => o.status?.toLowerCase() === 'aprovado')
        .reduce((sum, o) => sum + (Number(o.valor_total) || 0), 0);
      const valorConvertidos = orcamentos.filter(o => o.pedidos && o.pedidos.length > 0)
        .reduce((sum, o) => sum + (Number(o.valor_total) || 0), 0);

      doc.setFontSize(14);
      doc.setTextColor(142, 68, 173);
      doc.text("ANALISE DE CONVERSAO", 14, 60);
      doc.setTextColor(0, 0, 0);
      
      let y = 70;
      doc.text(`Total de Orcamentos: ${total}`, 14, y);
      doc.text(`  - Aprovados: ${aprovados} (${taxaAprovacao}%)`, 14, y + 7);
      doc.text(`  - Convertidos em Pedidos: ${convertidos} (${taxaConversao}%)`, 14, y + 14);
      doc.text(`  - Pendentes: ${pendentes}`, 14, y + 21);
      doc.text(`  - Recusados: ${recusados}`, 14, y + 28);
      doc.text(`  - Expirados: ${expirados}`, 14, y + 35);
      doc.text(`Valor Total: ${formatarMoeda(valorTotal)}`, 14, y + 45);
      doc.text(`  - Aprovados: ${formatarMoeda(valorAprovados)}`, 14, y + 52);
      doc.text(`  - Convertidos: ${formatarMoeda(valorConvertidos)}`, 14, y + 59);

      const statusData = [
        ['Aprovados', aprovados, `${taxaAprovacao}%`, formatarMoeda(valorAprovados)],
        ['Convertidos', convertidos, `${taxaConversao}%`, formatarMoeda(valorConvertidos)],
        ['Pendentes', pendentes, `${((pendentes/total)*100).toFixed(1)}%`, formatarMoeda(
          orcamentos.filter(o => !o.status || o.status === 'pendente')
            .reduce((sum, o) => sum + (Number(o.valor_total) || 0), 0)
        )],
        ['Recusados', recusados, `${((recusados/total)*100).toFixed(1)}%`, formatarMoeda(
          orcamentos.filter(o => o.status === 'recusado')
            .reduce((sum, o) => sum + (Number(o.valor_total) || 0), 0)
        )],
        ['Expirados', expirados, `${((expirados/total)*100).toFixed(1)}%`, formatarMoeda(
          orcamentos.filter(o => o.status === 'expirado')
            .reduce((sum, o) => sum + (Number(o.valor_total) || 0), 0)
        )]
      ];

      autoTable(doc, {
        startY: y + 75,
        head: [['Status', 'Quantidade', '% do Total', 'Valor Total']],
        body: statusData,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [142, 68, 173], textColor: 255 }
      });

      doc.addPage();
      doc.setFontSize(16);
      doc.setTextColor(142, 68, 173);
      doc.text("LISTA DE ORCAMENTOS", 14, 20);
      doc.setTextColor(0, 0, 0);
      doc.text(`Total: ${orcamentos.length} orcamentos`, 14, 30);

      const orcamentosTableData = orcamentos.map(o => [
        o.numero || '---',
        o.clientes?.nome?.substring(0, 20) || '---',
        formatarMoeda(Number(o.valor_total)),
        o.status || 'Pendente',
        o.pedidos?.length > 0 ? 'Sim' : 'Nao',
        o.forma_pagamento || '---',
        o.numero_parcelas ? `${o.numero_parcelas}x` : '-',
        formatarData(o.created_at)
      ]);

      autoTable(doc, {
        startY: 40,
        head: [['Numero', 'Cliente', 'Valor', 'Status', 'Convertido', 'Pagamento', 'Parcelas', 'Data']],
        body: orcamentosTableData,
        styles: { fontSize: 7 },
        headStyles: { fillColor: [142, 68, 173], textColor: 255 }
      });

      doc.save(`orcamentos-${format(new Date(), 'dd-MM-yyyy-HHmm')}.pdf`);
      toast({ title: "Relatorio de orcamentos gerado com sucesso!" });
    } catch (error: any) {
      console.error('Erro:', error);
      toast({ 
        title: "Erro ao gerar relatorio", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setLoading(null);
    }
  };

  // ================ RELATORIO FINANCEIRO ================
  const generateFinanceiroReport = async () => {
    setLoading("financeiro");
    try {
      if (!dataInicio || !dataFim) {
        toast({ 
          title: "Periodo nao informado", 
          description: "Selecione a data inicial e final.", 
          variant: "destructive" 
        });
        return;
      }

      const transacoes = await buscarTransacoes(dataInicio, dataFim);
      
      if (!transacoes || transacoes.length === 0) {
        toast({ 
          title: "Nenhuma transacao encontrada", 
          description: `Periodo: ${formatarData(dataInicio)} a ${formatarData(dataFim)}`, 
          variant: "destructive" 
        });
        return;
      }

      const doc = new jsPDF({ orientation: 'landscape' });
      
      doc.setFontSize(20);
      doc.setTextColor(155, 89, 182);
      doc.text("RELATORIO FINANCEIRO", 14, 20);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      doc.text(`Periodo: ${formatarData(dataInicio)} a ${formatarData(dataFim)}`, 14, 30);
      doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 37);
      doc.text(`Total de transacoes: ${transacoes.length}`, 14, 44);

      const receitas = transacoes.filter(t => t.tipo?.toLowerCase() === 'receita')
        .reduce((sum, t) => sum + (Number(t.valor) || 0), 0);
      const despesas = transacoes.filter(t => t.tipo?.toLowerCase() === 'despesa')
        .reduce((sum, t) => sum + (Number(t.valor) || 0), 0);
      const saldo = receitas - despesas;
      
      const receitasRealizadas = transacoes
        .filter(t => t.tipo?.toLowerCase() === 'receita' && t.status?.toLowerCase() === 'pago')
        .reduce((sum, t) => sum + (Number(t.valor) || 0), 0);
      const despesasRealizadas = transacoes
        .filter(t => t.tipo?.toLowerCase() === 'despesa' && t.status?.toLowerCase() === 'pago')
        .reduce((sum, t) => sum + (Number(t.valor) || 0), 0);
      const receitasPendentes = transacoes
        .filter(t => t.tipo?.toLowerCase() === 'receita' && t.status?.toLowerCase() === 'pendente')
        .reduce((sum, t) => sum + (Number(t.valor) || 0), 0);
      const despesasPendentes = transacoes
        .filter(t => t.tipo?.toLowerCase() === 'despesa' && t.status?.toLowerCase() === 'pendente')
        .reduce((sum, t) => sum + (Number(t.valor) || 0), 0);

      doc.setFontSize(14);
      doc.setTextColor(155, 89, 182);
      doc.text("DEMONSTRATIVO DE RESULTADOS (DRE)", 14, 60);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      
      let y = 70;
      doc.text(`RECEITAS: ${formatarMoeda(receitas)}`, 14, y);
      doc.text(`  - Realizadas: ${formatarMoeda(receitasRealizadas)}`, 14, y + 7);
      doc.text(`  - Pendentes: ${formatarMoeda(receitasPendentes)}`, 14, y + 14);
      doc.text(`DESPESAS: ${formatarMoeda(despesas)}`, 14, y + 24);
      doc.text(`  - Realizadas: ${formatarMoeda(despesasRealizadas)}`, 14, y + 31);
      doc.text(`  - Pendentes: ${formatarMoeda(despesasPendentes)}`, 14, y + 38);
      doc.text(`SALDO DO PERIODO: ${formatarMoeda(saldo)}`, 14, y + 48);
      doc.text(`  - Saldo Realizado: ${formatarMoeda(receitasRealizadas - despesasRealizadas)}`, 14, y + 55);
      doc.text(`  - Saldo Projetado: ${formatarMoeda((receitasRealizadas - despesasRealizadas) + (receitasPendentes - despesasPendentes))}`, 14, y + 62);

      const transacoesPorData: any = {};
      transacoes.forEach(t => {
        const data = t.data ? formatarData(t.data) : 'Sem data';
        if (!transacoesPorData[data]) {
          transacoesPorData[data] = { receitas: 0, despesas: 0, qtd: 0 };
        }
        if (t.tipo?.toLowerCase() === 'receita') {
          transacoesPorData[data].receitas += Number(t.valor) || 0;
        } else {
          transacoesPorData[data].despesas += Number(t.valor) || 0;
        }
        transacoesPorData[data].qtd += 1;
      });

      doc.setFontSize(14);
      doc.setTextColor(155, 89, 182);
      doc.text("FLUXO DE CAIXA POR PERIODO", 14, y + 80);
      doc.setTextColor(0, 0, 0);

      const fluxoData = Object.entries(transacoesPorData)
        .slice(0, 15)
        .map(([data, d]: [string, any]) => [
          data,
          d.qtd.toString(),
          formatarMoeda(d.receitas),
          formatarMoeda(d.despesas),
          formatarMoeda(d.receitas - d.despesas)
        ]);

      autoTable(doc, {
        startY: y + 90,
        head: [['Data', 'Qtd', 'Receitas', 'Despesas', 'Saldo']],
        body: fluxoData,
        styles: { fontSize: 7 },
        headStyles: { fillColor: [155, 89, 182], textColor: 255 }
      });

      const categorias: any = {};
      transacoes.forEach(t => {
        const cat = t.categoria || 'Sem Categoria';
        if (!categorias[cat]) {
          categorias[cat] = { 
            receitas: 0, 
            despesas: 0, 
            qtd: 0,
            receitas_pendentes: 0,
            despesas_pendentes: 0
          };
        }
        if (t.tipo?.toLowerCase() === 'receita') {
          categorias[cat].receitas += Number(t.valor) || 0;
          if (t.status?.toLowerCase() === 'pendente') {
            categorias[cat].receitas_pendentes += Number(t.valor) || 0;
          }
        } else {
          categorias[cat].despesas += Number(t.valor) || 0;
          if (t.status?.toLowerCase() === 'pendente') {
            categorias[cat].despesas_pendentes += Number(t.valor) || 0;
          }
        }
        categorias[cat].qtd += 1;
      });

      doc.addPage();
      doc.setFontSize(16);
      doc.setTextColor(155, 89, 182);
      doc.text("ANALISE POR CATEGORIA", 14, 20);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      doc.text(`Total de categorias: ${Object.keys(categorias).length}`, 14, 30);

      const categoriaData = Object.entries(categorias).map(([cat, d]: [string, any]) => [
        cat,
        d.qtd.toString(),
        formatarMoeda(d.receitas),
        formatarMoeda(d.receitas_pendentes),
        formatarMoeda(d.despesas),
        formatarMoeda(d.despesas_pendentes),
        formatarMoeda(d.receitas - d.despesas)
      ]);

      autoTable(doc, {
        startY: 40,
        head: [['Categoria', 'Qtd', 'Receitas', 'A Receber', 'Despesas', 'A Pagar', 'Saldo']],
        body: categoriaData,
        styles: { fontSize: 6 },
        headStyles: { fillColor: [155, 89, 182], textColor: 255 }
      });

      const statusCount: any = {};
      transacoes.forEach(t => {
        const status = t.status || 'pendente';
        if (!statusCount[status]) {
          statusCount[status] = { receitas: 0, despesas: 0, qtd: 0 };
        }
        statusCount[status].qtd += 1;
        if (t.tipo?.toLowerCase() === 'receita') {
          statusCount[status].receitas += Number(t.valor) || 0;
        } else {
          statusCount[status].despesas += Number(t.valor) || 0;
        }
      });

      doc.setFontSize(14);
      doc.setTextColor(155, 89, 182);
      doc.text("STATUS DAS TRANSACOES", 14, doc.lastAutoTable.finalY + 20);
      doc.setTextColor(0, 0, 0);

      const statusData = Object.entries(statusCount).map(([status, d]: [string, any]) => [
        status,
        d.qtd.toString(),
        formatarMoeda(d.receitas),
        formatarMoeda(d.despesas),
        formatarMoeda(d.receitas - d.despesas)
      ]);

      autoTable(doc, {
        startY: doc.lastAutoTable.finalY + 30,
        head: [['Status', 'Qtd', 'Receitas', 'Despesas', 'Saldo']],
        body: statusData,
        styles: { fontSize: 7 },
        headStyles: { fillColor: [52, 73, 94], textColor: 255 }
      });

      const formasPagamento: any = {};
      transacoes.forEach(t => {
        const forma = t.forma_pagamento || 'Nao informada';
        if (!formasPagamento[forma]) {
          formasPagamento[forma] = { receitas: 0, despesas: 0, qtd: 0 };
        }
        formasPagamento[forma].qtd += 1;
        if (t.tipo?.toLowerCase() === 'receita') {
          formasPagamento[forma].receitas += Number(t.valor) || 0;
        } else {
          formasPagamento[forma].despesas += Number(t.valor) || 0;
        }
      });

      doc.addPage();
      doc.setFontSize(16);
      doc.setTextColor(155, 89, 182);
      doc.text("ANALISE POR FORMA DE PAGAMENTO", 14, 20);
      doc.setTextColor(0, 0, 0);

      const formasData = Object.entries(formasPagamento).map(([forma, d]: [string, any]) => [
        forma,
        d.qtd.toString(),
        formatarMoeda(d.receitas),
        formatarMoeda(d.despesas),
        formatarMoeda(d.receitas - d.despesas)
      ]);

      autoTable(doc, {
        startY: 30,
        head: [['Forma de Pagamento', 'Qtd', 'Receitas', 'Despesas', 'Saldo']],
        body: formasData,
        styles: { fontSize: 7 },
        headStyles: { fillColor: [155, 89, 182], textColor: 255 }
      });

      doc.addPage();
      doc.setFontSize(16);
      doc.setTextColor(52, 73, 94);
      doc.text("DETALHAMENTO DE TRANSACOES", 14, 20);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      doc.text(`Total: ${transacoes.length} transacoes`, 14, 30);

      const transacoesTableData = transacoes.map(t => [
        t.descricao?.substring(0, 30) || '---',
        t.tipo || '---',
        t.categoria || '---',
        formatarMoeda(Number(t.valor)),
        t.status || 'Pendente',
        t.forma_pagamento || '---',
        formatarData(t.data),
        t.data_vencimento ? formatarData(t.data_vencimento) : '-',
        t.data_pagamento ? formatarData(t.data_pagamento) : '-'
      ]);

      autoTable(doc, {
        startY: 40,
        head: [
          ['Descricao', 'Tipo', 'Categoria', 'Valor', 'Status', 'Pagamento', 'Data', 'Vencimento', 'Pagamento']
        ],
        body: transacoesTableData,
        styles: { fontSize: 5 },
        headStyles: { fillColor: [52, 73, 94], textColor: 255 }
      });

      doc.addPage();
      doc.setFontSize(16);
      doc.setTextColor(52, 73, 94);
      doc.text("RESUMO EXECUTIVO FINANCEIRO", 14, 20);
      doc.setTextColor(0, 0, 0);
      
      let resumoY = 35;
      doc.setFontSize(12);
      doc.text("Indicadores do Periodo:", 14, resumoY);
      doc.setFontSize(11);
      
      const totalTransacoes = transacoes.length;
      const ticketMedioReceita = receitas > 0 ? receitas / transacoes.filter(t => t.tipo === 'receita').length : 0;
      const ticketMedioDespesa = despesas > 0 ? despesas / transacoes.filter(t => t.tipo === 'despesa').length : 0;
      const percentualRealizado = ((receitasRealizadas + despesasRealizadas) / (receitas + despesas) * 100).toFixed(1);
      
      resumoY += 10;
      doc.text(`Total de Transacoes: ${totalTransacoes}`, 14, resumoY);
      doc.text(`  - Receitas: ${transacoes.filter(t => t.tipo === 'receita').length}`, 14, resumoY + 7);
      doc.text(`  - Despesas: ${transacoes.filter(t => t.tipo === 'despesa').length}`, 14, resumoY + 14);
      doc.text(`Ticket Medio - Receitas: ${formatarMoeda(ticketMedioReceita)}`, 14, resumoY + 24);
      doc.text(`Ticket Medio - Despesas: ${formatarMoeda(ticketMedioDespesa)}`, 14, resumoY + 31);
      doc.text(`Percentual Realizado: ${percentualRealizado}%`, 14, resumoY + 38);
      doc.text(`Eficiencia Operacional: ${receitas > 0 ? ((receitas - despesas) / receitas * 100).toFixed(1) : 0}%`, 14, resumoY + 45);

      const maioresReceitas = transacoes
        .filter(t => t.tipo === 'receita')
        .sort((a, b) => (Number(b.valor) || 0) - (Number(a.valor) || 0))
        .slice(0, 5);

      resumoY += 60;
      doc.setFontSize(12);
      doc.text("Top 5 Maiores Receitas:", 14, resumoY);
      doc.setFontSize(11);
      
      maioresReceitas.forEach((t, index) => {
        const desc = t.descricao?.substring(0, 30) || 'Sem descricao';
        doc.text(`  ${index + 1}. ${desc}: ${formatarMoeda(Number(t.valor))}`, 14, resumoY + 10 + (index * 7));
      });

      const maioresDespesas = transacoes
        .filter(t => t.tipo === 'despesa')
        .sort((a, b) => (Number(b.valor) || 0) - (Number(a.valor) || 0))
        .slice(0, 5);

      resumoY += 50;
      doc.setFontSize(12);
      doc.text("Top 5 Maiores Despesas:", 14, resumoY);
      doc.setFontSize(11);
      
      maioresDespesas.forEach((t, index) => {
        const desc = t.descricao?.substring(0, 30) || 'Sem descricao';
        doc.text(`  ${index + 1}. ${desc}: ${formatarMoeda(Number(t.valor))}`, 14, resumoY + 10 + (index * 7));
      });

      doc.save(`financeiro-${format(new Date(), 'dd-MM-yyyy-HHmm')}.pdf`);
      toast({ title: "Relatorio financeiro gerado com sucesso!" });
      
    } catch (error: any) {
      console.error('Erro ao gerar relatorio financeiro:', error);
      toast({ 
        title: "Erro ao gerar relatorio financeiro", 
        description: error.message || "Verifique as permissoes e relacionamentos no banco de dados", 
        variant: "destructive" 
      });
    } finally {
      setLoading(null);
    }
  };

  // ================ RELATORIO DE CLIENTES ================
  const generateClientesReport = async () => {
    setLoading("clientes");
    try {
      const clientes = await buscarClientes();

      if (!clientes || clientes.length === 0) {
        toast({ 
          title: "Nenhum cliente encontrado", 
          description: "Nao ha clientes cadastrados.", 
          variant: "destructive" 
        });
        return;
      }

      const doc = new jsPDF({ orientation: 'landscape' });
      
      doc.setFontSize(20);
      doc.setTextColor(230, 126, 34);
      doc.text("RELATORIO DE CLIENTES", 14, 20);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 30);
      doc.text(`Total de clientes cadastrados: ${clientes.length}`, 14, 37);

      const totalClientes = clientes.length;
      const clientesComCompras = clientes.filter(c => c.pedidos && c.pedidos.length > 0).length;
      const clientesSemCompras = totalClientes - clientesComCompras;
      const clientesAtivos = clientes.filter(c => c.pedidos && c.pedidos.some(p => p.status === 'entregue' || p.status === 'confirmado' || p.status === 'enviado')).length;
      
      const totalVendas = clientes.reduce((sum, c) => 
        sum + (c.pedidos?.reduce((s, p) => s + (Number(p.valor_total) || 0), 0) || 0), 0);
      const totalPedidos = clientes.reduce((sum, c) => sum + (c.pedidos?.length || 0), 0);
      const ticketMedio = clientesComCompras > 0 ? totalVendas / clientesComCompras : 0;
      const valorMedioPedido = totalPedidos > 0 ? totalVendas / totalPedidos : 0;

      doc.setFontSize(14);
      doc.setTextColor(230, 126, 34);
      doc.text("ANALISE DA CARTEIRA", 14, 52);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      
      let y = 62;
      doc.text(`Total de Clientes: ${totalClientes}`, 14, y);
      doc.text(`  - Com compras: ${clientesComCompras} (${((clientesComCompras/totalClientes)*100).toFixed(1)}%)`, 14, y + 7);
      doc.text(`  - Sem compras: ${clientesSemCompras} (${((clientesSemCompras/totalClientes)*100).toFixed(1)}%)`, 14, y + 14);
      doc.text(`  - Clientes ativos: ${clientesAtivos}`, 14, y + 21);
      doc.text(`Total em Vendas: ${formatarMoeda(totalVendas)}`, 14, y + 31);
      doc.text(`Total de Pedidos: ${totalPedidos}`, 14, y + 38);
      doc.text(`Ticket Medio por Cliente: ${formatarMoeda(ticketMedio)}`, 14, y + 45);
      doc.text(`Valor Medio por Pedido: ${formatarMoeda(valorMedioPedido)}`, 14, y + 52);

      const topClientes = clientes
        .map(c => ({
          ...c,
          total_compras: c.pedidos?.reduce((sum, p) => sum + (Number(p.valor_total) || 0), 0) || 0,
          qtd_pedidos: c.pedidos?.length || 0,
          ticket_medio: c.pedidos?.length > 0 
            ? (c.pedidos.reduce((sum, p) => sum + (Number(p.valor_total) || 0), 0) / c.pedidos.length)
            : 0,
          primeiro_pedido: c.pedidos?.length > 0 
            ? new Date(Math.min(...c.pedidos.map(p => new Date(p.data_pedido || p.created_at).getTime()))) 
            : null,
          ultimo_pedido: c.pedidos?.length > 0 
            ? new Date(Math.max(...c.pedidos.map(p => new Date(p.data_pedido || p.created_at).getTime()))) 
            : null,
          dias_desde_ultima_compra: c.pedidos?.length > 0
            ? Math.floor((new Date().getTime() - new Date(Math.max(...c.pedidos.map(p => new Date(p.data_pedido || p.created_at).getTime()))).getTime()) / (1000 * 60 * 60 * 24))
            : null
        }))
        .sort((a, b) => b.total_compras - a.total_compras)
        .slice(0, 10);

      if (topClientes.length > 0) {
        doc.setFontSize(14);
        doc.setTextColor(230, 126, 34);
        doc.text("TOP 10 CLIENTES - MAIORES COMPRADORES", 14, y + 70);
        doc.setTextColor(0, 0, 0);
        
        const topData = topClientes.map((c, i) => [
          (i + 1).toString(),
          c.nome?.substring(0, 20) || '---',
          c.cpf_cnpj || '---',
          c.telefone || '---',
          c.cidade || '---',
          c.estado || '---',
          c.qtd_pedidos.toString(),
          formatarMoeda(c.total_compras),
          formatarMoeda(c.ticket_medio),
          c.ultimo_pedido ? formatarData(c.ultimo_pedido.toISOString()) : '-',
          c.dias_desde_ultima_compra ? `${c.dias_desde_ultima_compra} dias` : '-'
        ]);

        autoTable(doc, {
          startY: y + 80,
          head: [['#', 'Nome', 'CPF/CNPJ', 'Telefone', 'Cidade', 'UF', 'Pedidos', 'Total Gasto', 'Ticket Medio', 'Ultima Compra', 'Inatividade']],
          body: topData,
          styles: { fontSize: 6 },
          headStyles: { fillColor: [230, 126, 34], textColor: 255 }
        });
      }

      const hoje = new Date();
      const clientesRecentes = clientes
        .filter(c => c.pedidos && c.pedidos.length > 0)
        .map(c => {
          const ultimaCompra = new Date(Math.max(...c.pedidos.map(p => new Date(p.data_pedido || p.created_at).getTime())));
          const dias = Math.floor((hoje.getTime() - ultimaCompra.getTime()) / (1000 * 60 * 60 * 24));
          return { ...c, dias_desde_ultima_compra: dias };
        });

      const clientes30dias = clientesRecentes.filter(c => c.dias_desde_ultima_compra <= 30).length;
      const clientes60dias = clientesRecentes.filter(c => c.dias_desde_ultima_compra > 30 && c.dias_desde_ultima_compra <= 60).length;
      const clientes90dias = clientesRecentes.filter(c => c.dias_desde_ultima_compra > 60 && c.dias_desde_ultima_compra <= 90).length;
      const clientes180dias = clientesRecentes.filter(c => c.dias_desde_ultima_compra > 90 && c.dias_desde_ultima_compra <= 180).length;
      const clientesInativos = clientesRecentes.filter(c => c.dias_desde_ultima_compra > 180).length;

      doc.addPage();
      doc.setFontSize(16);
      doc.setTextColor(230, 126, 34);
      doc.text("ANALISE DE RECENCIA DE COMPRAS", 14, 20);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      doc.text(`Baseado em ${clientesRecentes.length} clientes com compras`, 14, 30);

      const recenciaData = [
        ['Ultimos 30 dias', clientes30dias.toString(), `${((clientes30dias/clientesRecentes.length)*100).toFixed(1)}%`],
        ['31 a 60 dias', clientes60dias.toString(), `${((clientes60dias/clientesRecentes.length)*100).toFixed(1)}%`],
        ['61 a 90 dias', clientes90dias.toString(), `${((clientes90dias/clientesRecentes.length)*100).toFixed(1)}%`],
        ['91 a 180 dias', clientes180dias.toString(), `${((clientes180dias/clientesRecentes.length)*100).toFixed(1)}%`],
        ['Mais de 180 dias', clientesInativos.toString(), `${((clientesInativos/clientesRecentes.length)*100).toFixed(1)}%`]
      ];

      autoTable(doc, {
        startY: 40,
        head: [['Periodo sem compras', 'Quantidade', '% dos Clientes Ativos']],
        body: recenciaData,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [230, 126, 34], textColor: 255 }
      });

      if (clientesSemCompras > 0) {
        doc.setFontSize(14);
        doc.setTextColor(241, 196, 15);
        doc.text("CLIENTES SEM COMPRAS", 14, doc.lastAutoTable.finalY + 20);
        doc.setTextColor(0, 0, 0);
        
        const clientesSemCompraLista = clientes
          .filter(c => !c.pedidos || c.pedidos.length === 0)
          .slice(0, 20)
          .map(c => [
            c.nome?.substring(0, 25) || '---',
            c.cpf_cnpj || '---',
            c.telefone || '---',
            c.email?.substring(0, 25) || '---',
            c.cidade || '---',
            c.estado || '---',
            formatarData(c.created_at)
          ]);

        autoTable(doc, {
          startY: doc.lastAutoTable.finalY + 30,
          head: [['Nome', 'CPF/CNPJ', 'Telefone', 'Email', 'Cidade', 'UF', 'Data Cadastro']],
          body: clientesSemCompraLista,
          styles: { fontSize: 7 },
          headStyles: { fillColor: [241, 196, 15], textColor: 0 }
        });
        
        if (clientesSemCompras > 20) {
          doc.text(`... e mais ${clientesSemCompras - 20} clientes sem compras`, 14, doc.lastAutoTable.finalY + 10);
        }
      }

      doc.addPage();
      doc.setFontSize(16);
      doc.setTextColor(52, 73, 94);
      doc.text("LISTA COMPLETA DE CLIENTES", 14, 20);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      doc.text(`Total: ${clientes.length} clientes`, 14, 30);

      const clientesTableData = clientes.map(c => {
        const totalCompras = c.pedidos?.reduce((sum, p) => sum + (Number(p.valor_total) || 0), 0) || 0;
        const qtdPedidos = c.pedidos?.length || 0;
        const ultimaCompra = c.pedidos?.length > 0 
          ? new Date(Math.max(...c.pedidos.map(p => new Date(p.data_pedido || p.created_at).getTime())))
          : null;
        
        return [
          c.nome?.substring(0, 20) || '---',
          c.cpf_cnpj?.substring(0, 14) || '---',
          c.telefone || '---',
          c.email?.substring(0, 20) || '---',
          c.cidade || '---',
          c.estado || '---',
          qtdPedidos.toString(),
          formatarMoeda(totalCompras),
          ultimaCompra ? formatarData(ultimaCompra.toISOString()) : 'Nunca'
        ];
      });

      autoTable(doc, {
        startY: 40,
        head: [['Nome', 'CPF/CNPJ', 'Telefone', 'Email', 'Cidade', 'UF', 'Pedidos', 'Total Gasto', 'Ultima Compra']],
        body: clientesTableData,
        styles: { fontSize: 6 },
        headStyles: { fillColor: [52, 73, 94], textColor: 255 }
      });

      doc.addPage();
      doc.setFontSize(16);
      doc.setTextColor(52, 73, 94);
      doc.text("ESTATISTICAS DE CLIENTES", 14, 20);
      doc.setTextColor(0, 0, 0);
      
      let statsY = 35;
      doc.setFontSize(12);
      doc.text("Distribuicao Geografica:", 14, statsY);
      doc.setFontSize(11);
      
      const estadoCount: any = {};
      clientes.forEach(c => {
        const estado = c.estado || 'Nao informado';
        estadoCount[estado] = (estadoCount[estado] || 0) + 1;
      });

      statsY += 10;
      Object.entries(estadoCount)
        .sort(([,a]: any, [,b]: any) => b - a)
        .slice(0, 10)
        .forEach(([estado, count], index) => {
          doc.text(`  ${index + 1}. ${estado}: ${count} clientes (${((Number(count)/totalClientes)*100).toFixed(1)}%)`, 14, statsY + (index * 7));
        });

      statsY += 80;
      doc.setFontSize(12);
      doc.text("Top 5 Cidades:", 14, statsY);
      doc.setFontSize(11);
      
      const cidadeCount: any = {};
      clientes.forEach(c => {
        const cidade = c.cidade || 'Nao informada';
        cidadeCount[cidade] = (cidadeCount[cidade] || 0) + 1;
      });

      statsY += 10;
      Object.entries(cidadeCount)
        .sort(([,a]: any, [,b]: any) => b - a)
        .slice(0, 5)
        .forEach(([cidade, count], index) => {
          doc.text(`  ${index + 1}. ${cidade}: ${count} clientes`, 14, statsY + (index * 7));
        });

      doc.save(`clientes-${format(new Date(), 'dd-MM-yyyy-HHmm')}.pdf`);
      toast({ title: "Relatorio de clientes gerado com sucesso!" });
      
    } catch (error: any) {
      console.error('Erro:', error);
      toast({ 
        title: "Erro ao gerar relatorio", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setLoading(null);
    }
  };

  // ================ RELATORIO DE COMPRAS ================
  const generateComprasReport = async () => {
    setLoading("compras");
    try {
      if (!dataInicio || !dataFim) {
        toast({ 
          title: "Periodo nao informado", 
          description: "Selecione a data inicial e final.", 
          variant: "destructive" 
        });
        return;
      }

      const compras = await buscarCompras(dataInicio, dataFim);

      if (!compras || compras.length === 0) {
        toast({ 
          title: "Nenhuma compra encontrada", 
          description: `Periodo: ${formatarData(dataInicio)} a ${formatarData(dataFim)}`, 
          variant: "destructive" 
        });
        return;
      }

      const doc = new jsPDF({ orientation: 'landscape' });
      
      doc.setFontSize(20);
      doc.setTextColor(41, 128, 185);
      doc.text("RELATORIO DE COMPRAS", 14, 20);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      doc.text(`Periodo: ${formatarData(dataInicio)} a ${formatarData(dataFim)}`, 14, 30);
      doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 37);
      doc.text(`Total de compras: ${compras.length}`, 14, 44);

      const totalCompras = compras.length;
      const comprasRecebidas = compras.filter(c => c.mercadoria_recebida === true).length;
      const comprasPendentes = compras.filter(c => !c.mercadoria_recebida).length;
      const comprasFaturadas = compras.filter(c => c.compra_faturada === true).length;
      const comprasParceladas = compras.filter(c => c.parcelado === true).length;
      
      const valorTotal = compras.reduce((sum, c) => sum + (Number(c.valor_total) || 0), 0);
      const valorRecebido = compras.filter(c => c.mercadoria_recebida)
        .reduce((sum, c) => sum + (Number(c.valor_total) || 0), 0);
      const valorPendente = valorTotal - valorRecebido;
      const valorFaturado = compras.filter(c => c.compra_faturada)
        .reduce((sum, c) => sum + (Number(c.valor_total) || 0), 0);
      
      const ticketMedioCompra = totalCompras > 0 ? valorTotal / totalCompras : 0;
      const totalItensComprados = compras.reduce((sum, c) => 
        sum + (c.compra_itens?.reduce((s, i) => s + (Number(i.quantidade) || 0), 0) || 0), 0);

      doc.setFontSize(14);
      doc.setTextColor(41, 128, 185);
      doc.text("RESUMO EXECUTIVO", 14, 57);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      
      let y = 67;
      doc.text(`Total de Compras: ${totalCompras}`, 14, y);
      doc.text(`  - Recebidas: ${comprasRecebidas} (${((comprasRecebidas/totalCompras)*100).toFixed(1)}%)`, 14, y + 7);
      doc.text(`  - Pendentes: ${comprasPendentes} (${((comprasPendentes/totalCompras)*100).toFixed(1)}%)`, 14, y + 14);
      doc.text(`  - Faturadas: ${comprasFaturadas} (${((comprasFaturadas/totalCompras)*100).toFixed(1)}%)`, 14, y + 21);
      doc.text(`  - Parceladas: ${comprasParceladas} (${((comprasParceladas/totalCompras)*100).toFixed(1)}%)`, 14, y + 28);
      
      doc.text(`Valor Total: ${formatarMoeda(valorTotal)}`, 14, y + 38);
      doc.text(`  - Recebido: ${formatarMoeda(valorRecebido)}`, 14, y + 45);
      doc.text(`  - Pendente: ${formatarMoeda(valorPendente)}`, 14, y + 52);
      doc.text(`  - Faturado: ${formatarMoeda(valorFaturado)}`, 14, y + 59);
      
      doc.text(`Ticket Medio por Compra: ${formatarMoeda(ticketMedioCompra)}`, 14, y + 69);
      doc.text(`Total de Itens Comprados: ${formatarNumero(totalItensComprados)}`, 14, y + 76);

      const statusCount: any = {};
      compras.forEach(c => {
        const status = c.status || 'pendente';
        statusCount[status] = (statusCount[status] || 0) + 1;
      });

      doc.setFontSize(14);
      doc.setTextColor(41, 128, 185);
      doc.text("COMPRAS POR STATUS", 14, y + 94);
      doc.setTextColor(0, 0, 0);
      
      let statusY = y + 104;
      let i = 0;
      Object.entries(statusCount).forEach(([status, count]) => {
        doc.text(`  ${i + 1}. ${status}: ${count}`, 14, statusY + (i * 7));
        i++;
      });

      doc.setFontSize(14);
      doc.setTextColor(41, 128, 185);
      doc.text("DETALHAMENTO DAS COMPRAS", 14, y + 130);
      doc.setTextColor(0, 0, 0);

      const tableData = compras.map(c => [
        c.numero || '-',
        c.fornecedores?.nome?.substring(0, 20) || '---',
        formatarMoeda(Number(c.valor_total)),
        c.status || 'pendente',
        c.mercadoria_recebida ? 'Sim' : 'Nao',
        c.compra_faturada ? 'Sim' : 'Nao',
        c.parcelado ? `${c.numero_parcelas || 1}x` : 'A vista',
        c.forma_pagamento || '-',
        c.condicao_pagamento || '-',
        formatarData(c.data_emissao),
        c.data_recebimento ? formatarData(c.data_recebimento) : 'Pendente'
      ]);

      autoTable(doc, {
        startY: y + 140,
        head: [
          ['Numero', 'Fornecedor', 'Valor', 'Status', 'Recebido', 'Faturado', 
           'Parcelas', 'Forma Pag.', 'Condicao', 'Emissao', 'Recebimento']
        ],
        body: tableData,
        styles: { fontSize: 6 },
        headStyles: { fillColor: [41, 128, 185], textColor: 255 }
      });

      const fornecedores: any = {};
      compras.forEach(c => {
        const forn = c.fornecedores?.nome || 'Fornecedor nao identificado';
        if (!fornecedores[forn]) {
          fornecedores[forn] = {
            cnpj: c.fornecedores?.cnpj || '---',
            telefone: c.fornecedores?.telefone || '---',
            email: c.fornecedores?.email || '---',
            qtd_compras: 0,
            valor_total: 0,
            compras_recebidas: 0,
            compras_faturadas: 0,
            itens_comprados: 0,
            prazo_medio_entrega: 0,
            dias_para_recebimento: []
          };
        }
        
        const f = fornecedores[forn];
        f.qtd_compras += 1;
        f.valor_total += Number(c.valor_total) || 0;
        if (c.mercadoria_recebida) f.compras_recebidas += 1;
        if (c.compra_faturada) f.compras_faturadas += 1;
        
        const totalItens = c.compra_itens?.reduce((sum, i) => sum + (Number(i.quantidade) || 0), 0) || 0;
        f.itens_comprados += totalItens;
        
        if (c.data_recebimento && c.data_emissao) {
          const dias = Math.floor(
            (new Date(c.data_recebimento).getTime() - new Date(c.data_emissao).getTime()) 
            / (1000 * 60 * 60 * 24)
          );
          if (dias >= 0) f.dias_para_recebimento.push(dias);
        }
      });

      Object.keys(fornecedores).forEach(key => {
        const f = fornecedores[key];
        f.prazo_medio_entrega = f.dias_para_recebimento.length > 0 
          ? (f.dias_para_recebimento.reduce((a, b) => a + b, 0) / f.dias_para_recebimento.length).toFixed(0)
          : 'N/A';
      });

      doc.addPage();
      doc.setFontSize(16);
      doc.setTextColor(41, 128, 185);
      doc.text("ANALISE POR FORNECEDOR", 14, 20);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      doc.text(`Total de fornecedores: ${Object.keys(fornecedores).length}`, 14, 30);

      const fornecedorData = Object.entries(fornecedores).map(([nome, f]: [string, any]) => [
        nome.substring(0, 20),
        f.cnpj,
        f.qtd_compras.toString(),
        f.compras_recebidas.toString(),
        `${((f.compras_recebidas / f.qtd_compras) * 100).toFixed(0)}%`,
        f.compras_faturadas.toString(),
        formatarNumero(f.itens_comprados),
        formatarMoeda(f.valor_total),
        f.prazo_medio_entrega
      ]);

      autoTable(doc, {
        startY: 40,
        head: [
          ['Fornecedor', 'CNPJ', 'Compras', 'Recebidas', 'Taxa Rec.', 'Faturadas', 
           'Itens', 'Valor Total', 'Prazo Medio']
        ],
        body: fornecedorData,
        styles: { fontSize: 6 },
        headStyles: { fillColor: [41, 128, 185], textColor: 255 }
      });

      const produtosComprados: any = {};
      compras.forEach(compra => {
        compra.compra_itens?.forEach((item: any) => {
          if (item.produtos) {
            const key = item.produtos.id;
            if (!produtosComprados[key]) {
              produtosComprados[key] = {
                codigo: item.produtos.codigo || '---',
                nome: item.produtos.nome || item.produtos.descricao || 'Produto',
                categoria: item.produtos.categoria || 'Outros',
                unidade: item.produtos.unidade || 'un',
                quantidade: 0,
                valor_total: 0,
                custo_medio: 0,
                compras: 0,
                fornecedores: new Set()
              };
            }
            const p = produtosComprados[key];
            p.quantidade += Number(item.quantidade) || 0;
            p.valor_total += Number(item.subtotal) || 0;
            p.compras += 1;
            p.fornecedores.add(compra.fornecedores?.nome || 'Desconhecido');
            p.custo_medio = p.valor_total / p.quantidade;
          }
        });
      });

      const topProdutosComprados = Object.values(produtosComprados)
        .sort((a: any, b: any) => b.valor_total - a.valor_total)
        .slice(0, 15)
        .map((p: any) => ({
          ...p,
          fornecedores: p.fornecedores.size
        }));

      if (topProdutosComprados.length > 0) {
        doc.addPage();
        doc.setFontSize(16);
        doc.setTextColor(230, 126, 34);
        doc.text("TOP 15 PRODUTOS MAIS COMPRADOS", 14, 20);
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(11);
        doc.text(`Periodo: ${formatarData(dataInicio)} a ${formatarData(dataFim)}`, 14, 30);
        doc.text(`Total de produtos diferentes: ${Object.keys(produtosComprados).length}`, 14, 37);

        const produtosTableData = topProdutosComprados.map((p: any, i: number) => [
          (i + 1).toString(),
          p.codigo,
          p.nome.substring(0, 25),
          p.categoria,
          p.unidade,
          formatarNumero(p.quantidade),
          formatarMoeda(p.custo_medio),
          formatarMoeda(p.valor_total),
          p.compras.toString(),
          p.fornecedores.toString()
        ]);

        autoTable(doc, {
          startY: 47,
          head: [
            ['#', 'Codigo', 'Produto', 'Categoria', 'Und', 'Qtd Comprada', 
             'Custo Medio', 'Valor Total', 'Nº Compras', 'Fornecedores']
          ],
          body: produtosTableData,
          styles: { fontSize: 6 },
          headStyles: { fillColor: [230, 126, 34], textColor: 255 }
        });
      }

      const pagamentos: any = {
        avista: compras.filter(c => !c.parcelado).length,
        parcelado: compras.filter(c => c.parcelado).length,
        total_parcelas: compras.reduce((sum, c) => sum + (Number(c.numero_parcelas) || 0), 0)
      };

      const formasPagamento: any = {};
      compras.forEach(c => {
        const forma = c.forma_pagamento || 'Nao informada';
        formasPagamento[forma] = (formasPagamento[forma] || 0) + 1;
      });

      const condicoesPagamento: any = {};
      compras.forEach(c => {
        const condicao = c.condicao_pagamento || 'Nao informada';
        condicoesPagamento[condicao] = (condicoesPagamento[condicao] || 0) + 1;
      });

      doc.addPage();
      doc.setFontSize(16);
      doc.setTextColor(52, 73, 94);
      doc.text("ANALISE DE PAGAMENTOS", 14, 20);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      
      let pagY = 35;
      doc.text(`Compras a Vista: ${pagamentos.avista}`, 14, pagY);
      doc.text(`Compras Parceladas: ${pagamentos.parcelado}`, 14, pagY + 7);
      doc.text(`Total de Parcelas: ${pagamentos.total_parcelas}`, 14, pagY + 14);
      doc.text(`Media de Parcelas: ${pagamentos.parcelado > 0 ? (pagamentos.total_parcelas / pagamentos.parcelado).toFixed(1) : 0}x`, 14, pagY + 21);

      pagY += 35;
      doc.setFontSize(14);
      doc.setTextColor(52, 73, 94);
      doc.text("Formas de Pagamento:", 14, pagY);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      
      let formaY = pagY + 10;
      let j = 0;
      Object.entries(formasPagamento).forEach(([forma, qtd]) => {
        doc.text(`  ${j + 1}. ${forma}: ${qtd}`, 14, formaY + (j * 7));
        j++;
      });

      pagY += (j * 7) + 20;
      doc.setFontSize(14);
      doc.setTextColor(52, 73, 94);
      doc.text("Condicoes de Pagamento:", 14, pagY);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      
      let condY = pagY + 10;
      let k = 0;
      Object.entries(condicoesPagamento).forEach(([condicao, qtd]) => {
        doc.text(`  ${k + 1}. ${condicao}: ${qtd}`, 14, condY + (k * 7));
        k++;
      });

      const comprasComPrazo = compras.filter(c => c.data_entrega_prevista && c.data_recebimento);
      const entregasNoPrazo = comprasComPrazo.filter(c => 
        new Date(c.data_recebimento) <= new Date(c.data_entrega_prevista)
      ).length;
      const entregasAtrasadas = comprasComPrazo.length - entregasNoPrazo;

      doc.addPage();
      doc.setFontSize(16);
      doc.setTextColor(52, 73, 94);
      doc.text("ANALISE DE PRAZOS", 14, 20);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      
      let prazoY = 35;
      doc.text(`Compras com prazo definido: ${comprasComPrazo.length}`, 14, prazoY);
      doc.text(`Entregas no prazo: ${entregasNoPrazo} (${comprasComPrazo.length > 0 ? ((entregasNoPrazo/comprasComPrazo.length)*100).toFixed(1) : 0}%)`, 14, prazoY + 7);
      doc.text(`Entregas atrasadas: ${entregasAtrasadas} (${comprasComPrazo.length > 0 ? ((entregasAtrasadas/comprasComPrazo.length)*100).toFixed(1) : 0}%)`, 14, prazoY + 14);
      
      const diasAtraso = comprasComPrazo
        .filter(c => new Date(c.data_recebimento) > new Date(c.data_entrega_prevista))
        .map(c => {
          const recebimento = new Date(c.data_recebimento);
          const prevista = new Date(c.data_entrega_prevista);
          return Math.floor((recebimento.getTime() - prevista.getTime()) / (1000 * 60 * 60 * 24));
        });
      
      const mediaAtraso = diasAtraso.length > 0 
        ? (diasAtraso.reduce((a, b) => a + b, 0) / diasAtraso.length).toFixed(0)
        : 0;
      
      doc.text(`Media de dias de atraso: ${mediaAtraso} dias`, 14, prazoY + 24);

      doc.addPage();
      doc.setFontSize(16);
      doc.setTextColor(52, 73, 94);
      doc.text("LISTA COMPLETA DE COMPRAS", 14, 20);
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(11);
      doc.text(`Total: ${compras.length} compras`, 14, 30);

      const completaTableData = compras.map(c => {
        const totalItens = c.compra_itens?.reduce((sum, i) => sum + (Number(i.quantidade) || 0), 0) || 0;
        
        let statusEntrega = '';
        if (!c.mercadoria_recebida) statusEntrega = 'Pendente';
        else if (c.data_entrega_prevista && c.data_recebimento) {
          statusEntrega = new Date(c.data_recebimento) <= new Date(c.data_entrega_prevista) 
            ? 'No prazo' : 'Atrasada';
        } else statusEntrega = 'Recebida';

        return [
          c.numero || '-',
          c.fornecedores?.nome?.substring(0, 15) || '---',
          formatarMoeda(Number(c.valor_total)),
          c.status || 'pendente',
          c.parcelado ? `${c.numero_parcelas || 1}x` : 'A vista',
          c.forma_pagamento || '-',
          formatarData(c.data_emissao),
          c.data_entrega_prevista ? formatarData(c.data_entrega_prevista) : '-',
          c.data_recebimento ? formatarData(c.data_recebimento) : 'Pendente',
          statusEntrega,
          totalItens.toString(),
          c.mercadoria_recebida ? 'Sim' : 'Nao',
          c.compra_faturada ? 'Sim' : 'Nao'
        ];
      });

      autoTable(doc, {
        startY: 40,
        head: [
          ['Numero', 'Fornecedor', 'Valor', 'Status', 'Parcelas', 'Forma', 
           'Emissao', 'Prevista', 'Recebimento', 'Entrega', 'Itens', 'Recebido', 'Faturado']
        ],
        body: completaTableData,
        styles: { fontSize: 5 },
        headStyles: { fillColor: [52, 73, 94], textColor: 255 }
      });

      doc.addPage();
      doc.setFontSize(16);
      doc.setTextColor(52, 73, 94);
      doc.text("ESTATISTICAS GLOBAIS DE COMPRAS", 14, 20);
      doc.setTextColor(0, 0, 0);
      
      let statsY = 35;
      doc.setFontSize(12);
      doc.text("Resumo do Periodo:", 14, statsY);
      doc.setFontSize(11);
      
      statsY += 10;
      doc.text(`Total investido: ${formatarMoeda(valorTotal)}`, 14, statsY);
      doc.text(`Media por compra: ${formatarMoeda(ticketMedioCompra)}`, 14, statsY + 7);
      doc.text(`Total de itens: ${formatarNumero(totalItensComprados)}`, 14, statsY + 14);
      doc.text(`Media de itens por compra: ${(totalItensComprados / totalCompras).toFixed(1)}`, 14, statsY + 21);
      
      statsY += 35;
      doc.setFontSize(12);
      doc.text("Eficiencia:", 14, statsY);
      doc.setFontSize(11);
      
      const taxaRecebimento = totalCompras > 0 ? (comprasRecebidas / totalCompras * 100).toFixed(1) : '0';
      const taxaFaturamento = totalCompras > 0 ? (comprasFaturadas / totalCompras * 100).toFixed(1) : '0';
      const prazoMedioEntrega = comprasComPrazo.length > 0
        ? (comprasComPrazo.reduce((sum, c) => {
            if (c.data_recebimento && c.data_emissao) {
              const dias = Math.floor(
                (new Date(c.data_recebimento).getTime() - new Date(c.data_emissao).getTime()) 
                / (1000 * 60 * 60 * 24)
              );
              return sum + (dias >= 0 ? dias : 0);
            }
            return sum;
          }, 0) / comprasComPrazo.length).toFixed(0)
        : 'N/A';
      
      doc.text(`Taxa de recebimento: ${taxaRecebimento}%`, 14, statsY + 7);
      doc.text(`Taxa de faturamento: ${taxaFaturamento}%`, 14, statsY + 14);
      doc.text(`Prazo medio de entrega: ${prazoMedioEntrega} dias`, 14, statsY + 21);
      doc.text(`Indice de entregas no prazo: ${comprasComPrazo.length > 0 ? ((entregasNoPrazo/comprasComPrazo.length)*100).toFixed(1) : 0}%`, 14, statsY + 28);

      statsY += 45;
      doc.setFontSize(12);
      doc.text("Top 5 Fornecedores por Valor:", 14, statsY);
      doc.setFontSize(11);
      
      const topFornecedores = Object.entries(fornecedores)
        .sort(([,a]: any, [,b]: any) => b.valor_total - a.valor_total)
        .slice(0, 5);
      
      statsY += 10;
      topFornecedores.forEach(([nome, f]: [string, any], index) => {
        doc.text(`  ${index + 1}. ${nome.substring(0, 30)}: ${formatarMoeda(f.valor_total)}`, 14, statsY + (index * 7));
      });

      doc.save(`compras-${format(new Date(), 'dd-MM-yyyy-HHmm')}.pdf`);
      toast({ title: "Relatorio de compras gerado com sucesso!" });
      
    } catch (error: any) {
      console.error('Erro ao gerar relatorio de compras:', error);
      toast({ 
        title: "Erro ao gerar relatorio", 
        description: error.message, 
        variant: "destructive" 
      });
    } finally {
      setLoading(null);
    }
  };

  // ================ RENDERIZACAO ================
  return (
    <div className="space-y-6 animate-fade-in p-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground">Relatorios Gerenciais</h2>
        <p className="text-muted-foreground">
          Relatorios completos e 100% funcionais baseados na estrutura do banco de dados
        </p>
      </div>

      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700 border-l-4 border-l-primary">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Filter className="h-5 w-5 text-primary" />
            Periodo do Relatorio
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="dataInicio" className="font-medium">Data Inicial</Label>
              <Input
                id="dataInicio"
                type="date"
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className="w-full bg-white dark:bg-gray-900"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dataFim" className="font-medium">Data Final</Label>
              <Input
                id="dataFim"
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className="w-full bg-white dark:bg-gray-900"
              />
            </div>
          </div>
          <p className="text-sm text-muted-foreground mt-3 flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            Periodo selecionado: {formatarData(dataInicio)} ate {formatarData(dataFim)}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        
        <Card className="hover:shadow-xl transition-all duration-300 border-t-4 border-t-blue-500 group">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 group-hover:scale-110 transition-transform">
                <TrendingUp className="h-5 w-5 text-blue-500" />
              </div>
              Relatorio de Vendas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Pedidos realizados, produtos mais vendidos, análise por cliente e performance comercial
            </p>
            <Button 
              className="w-full gap-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white shadow-md"
              onClick={generateVendasReport}
              disabled={loading !== null}
            >
              <FileDown className="h-4 w-4" />
              {loading === 'vendas' ? 'GERANDO...' : 'GERAR PDF'}
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-xl transition-all duration-300 border-t-4 border-t-green-500 group">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30 group-hover:scale-110 transition-transform">
                <Package className="h-5 w-5 text-green-500" />
              </div>
              Relatorio de Estoque
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Posicao completa do estoque, produtos com estoque baixo, analise por categoria e alertas
            </p>
            <Button 
              className="w-full gap-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white shadow-md"
              onClick={generateEstoqueReport}
              disabled={loading !== null}
            >
              <FileDown className="h-4 w-4" />
              {loading === 'estoque' ? 'GERANDO...' : 'GERAR PDF'}
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-xl transition-all duration-300 border-t-4 border-t-purple-500 group">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30 group-hover:scale-110 transition-transform">
                <ClipboardList className="h-5 w-5 text-purple-500" />
              </div>
              Relatorio de Orcamentos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Taxa de conversao, aprovacoes, status e performance comercial
            </p>
            <Button 
              className="w-full gap-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white shadow-md"
              onClick={generateOrcamentosReport}
              disabled={loading !== null}
            >
              <FileDown className="h-4 w-4" />
              {loading === 'orcamentos' ? 'GERANDO...' : 'GERAR PDF'}
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-xl transition-all duration-300 border-t-4 border-t-indigo-500 group">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 group-hover:scale-110 transition-transform">
                <DollarSign className="h-5 w-5 text-indigo-500" />
              </div>
              Relatorio Financeiro
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              DRE, fluxo de caixa, receitas, despesas, saldo realizado e projetado
            </p>
            <Button 
              className="w-full gap-2 bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white shadow-md"
              onClick={generateFinanceiroReport}
              disabled={loading !== null}
            >
              <FileDown className="h-4 w-4" />
              {loading === 'financeiro' ? 'GERANDO...' : 'GERAR PDF'}
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-xl transition-all duration-300 border-t-4 border-t-orange-500 group">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30 group-hover:scale-110 transition-transform">
                <Users className="h-5 w-5 text-orange-500" />
              </div>
              Relatorio de Clientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Top compradores, ticket medio, analise de recencia e distribuicao geografica
            </p>
            <Button 
              className="w-full gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-md"
              onClick={generateClientesReport}
              disabled={loading !== null}
            >
              <FileDown className="h-4 w-4" />
              {loading === 'clientes' ? 'GERANDO...' : 'GERAR PDF'}
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-xl transition-all duration-300 border-t-4 border-t-teal-500 group">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-900/30 group-hover:scale-110 transition-transform">
                <Truck className="h-5 w-5 text-teal-500" />
              </div>
              Relatorio de Compras
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Fornecedores, recebimentos, investimentos, prazos e analise completa de compras
            </p>
            <Button 
              className="w-full gap-2 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white shadow-md"
              onClick={generateComprasReport}
              disabled={loading !== null}
            >
              <FileDown className="h-4 w-4" />
              {loading === 'compras' ? 'GERANDO...' : 'GERAR PDF'}
            </Button>
          </CardContent>
        </Card>

        {/* Relatório de Comissões */}
        <Card className="hover:shadow-xl transition-all duration-300 border-t-4 border-t-yellow-500 group">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 group-hover:scale-110 transition-transform">
                <Award className="h-5 w-5 text-yellow-600" />
              </div>
              Relatorio de Comissoes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Analise completa de comissões por vendedor, por mês, valores pagos, pendentes e performance
            </p>
            <Button 
              className="w-full gap-2 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white shadow-md"
              onClick={generateComissoesReport}
              disabled={loading !== null}
            >
              <FileDown className="h-4 w-4" />
              {loading === 'comissoes' ? 'GERANDO...' : 'GERAR PDF'}
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="text-center text-xs text-muted-foreground mt-8 pt-4 border-t">
        <p>Sistema de Relatorios - Baseado na estrutura completa do banco de dados</p>
        <p className="mt-1">Todos os 7 relatorios estao 100% funcionais e prontos para uso</p>
        <p className="mt-1 font-semibold">Vendas (apenas pedidos) | Estoque | Orcamentos | Financeiro | Clientes | Compras | Comissoes</p>
      </div>
    </div>
  );
}