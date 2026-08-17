// @ts-nocheck
import React, { useState, useEffect, lazy, Suspense, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, Phone, Loader as Loader2, ChevronLeft, ChevronRight, CircleAlert as AlertCircle, PenLine, CircleCheck as CheckCircle, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { gerarPDFOrcamento, downloadPDF } from "@/utils/pdfGenerator";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import SignatureCanvas from "@/components/orcamentos/SignatureCanvas";
import { useLocation } from "react-router-dom";

// Importações lazy - REMOVIDO O .catch() que causava problemas
const AddOrcamentoDialog = lazy(() => import("@/components/orcamentos/AddOrcamentoDialog"));
const EditOrcamentoDialog = lazy(() => import("@/components/orcamentos/EditOrcamentoDialog"));

interface Orcamento {
  id: string;
  numero: string;
  valor_total: number;
  status: string;
  created_at: string;
  clientes: { nome: string } | null;
  assinatura_base64?: string | null;
  assinatura_nome?: string | null;
  assinatura_cargo?: string | null;
  assinatura_data?: string | null;
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className: string }> = {
  pendente: { label: "Pendente", variant: "outline", className: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  aprovado: { label: "Aprovado", variant: "default", className: "bg-green-600 text-white" },
  rejeitado: { label: "Rejeitado", variant: "destructive", className: "" },
  cancelado: { label: "Cancelado", variant: "secondary", className: "" },
  conferido: { label: "Conferido", variant: "default", className: "bg-blue-600 text-white" },
};

// Componente de Error Boundary melhorado
class ErrorBoundary extends React.Component<{ children: React.ReactNode; fallback?: React.ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    
    // Tratamento específico para erro de removeChild
    if (error.message?.includes('removeChild')) {
      console.warn('Erro de reconciliação do React detectado. Tentando recuperar...');
      // Limpa o cache do módulo para forçar recarregamento
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <Alert variant="destructive" className="m-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro ao carregar página</AlertTitle>
          <AlertDescription>
            <p className="mb-2">{this.state.error?.message || "Ocorreu um erro inesperado"}</p>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Recarregar página
            </Button>
          </AlertDescription>
        </Alert>
      );
    }

    return this.props.children;
  }
}

// Componente de fallback consistente para Suspense
const ButtonFallback = () => (
  <Button disabled variant="outline">
    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
    Carregando...
  </Button>
);

const SmallButtonFallback = () => (
  <Button size="sm" variant="outline" disabled>
    <Loader2 className="h-4 w-4 animate-spin" />
  </Button>
);

export default function Orcamentos() {
  const { isAdmin, loading: authLoading } = useAuth();
  const location = useLocation();
  const [sobraPendente, setSobraPendente] = useState<any | null>(null);
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [generatingPdf, setGeneratingPdf] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [refreshKey, setRefreshKey] = useState(0);
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);
  const [signatureOrcamentoId, setSignatureOrcamentoId] = useState<string | null>(null);
  const [savingSignature, setSavingSignature] = useState(false);

  // Dialog de localização de sobras
  const [sobrasDialogOpen, setSobrasDialogOpen] = useState(false);
  const [sobrasOrcamentoId, setSobrasOrcamentoId] = useState<string | null>(null);
  const [sobrasItens, setSobrasItens] = useState<Array<{
    produto_id: string; codigo: string; nome: string; comprimento_barra: number;
    comprimento_solicitado_mm: number; quantidade: number; localizacao: string;
  }>>([]);
  const [sobrasApproving, setSobrasApproving] = useState(false);

  const fetchOrcamentos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔍 Buscando orçamentos...');
      
      const { data, error: supabaseError } = await supabase
        .from('orcamentos')
        .select(`
          id,
          numero,
          valor_total,
          status,
          created_at,
          cliente_id,
          assinatura_base64,
          assinatura_nome,
          assinatura_cargo,
          assinatura_data,
          clientes:cliente_id (
            nome
          )
        `)
        .order('created_at', { ascending: false });

      if (supabaseError) {
        console.error('❌ Erro na query:', supabaseError);
        throw supabaseError;
      }
      
      console.log('✅ Dados recebidos:', data?.length || 0, 'registros');
      
      if (!data || data.length === 0) {
        setOrcamentos([]);
        return;
      }
      
      // Mapeamento simplificado sem loops complexos
      const formattedData = data.map(item => ({
        ...item,
        clientes: !item.clientes ? null : (Array.isArray(item.clientes) && item.clientes.length > 0 ? item.clientes[0] : item.clientes)
      }));
      
      setOrcamentos(formattedData);
      
    } catch (err: any) {
      console.error('❌ Erro ao carregar orçamentos:', err);
      setError(err.message || "Erro ao carregar orçamentos");
      toast({
        title: "Erro ao carregar orçamentos",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchOrcamentos();
    }
  }, [refreshKey, authLoading]);

  useEffect(() => {
    if (location.state?.sobra) {
      setSobraPendente(location.state.sobra);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const handleOrcamentoChanged = () => {
    setRefreshKey(prev => prev + 1);
  };

  const handleOpenSignature = (orcamentoId: string) => {
    setSignatureOrcamentoId(orcamentoId);
    setSignatureDialogOpen(true);
  };

  const handleSaveSignature = async (data: { base64: string; nome: string; cargo: string }) => {
    if (!signatureOrcamentoId) return;
    setSavingSignature(true);
    try {
      const { error } = await supabase
        .from('orcamentos')
        .update({
          assinatura_base64: data.base64,
          assinatura_nome: data.nome,
          assinatura_cargo: data.cargo,
          assinatura_data: new Date().toISOString(),
        })
        .eq('id', signatureOrcamentoId);

      if (error) throw error;

      toast({ title: "Assinatura registrada!", description: "O orçamento foi assinado eletronicamente." });
      setSignatureDialogOpen(false);
      setSignatureOrcamentoId(null);
      fetchOrcamentos();
    } catch (err: any) {
      toast({ title: "Erro ao salvar assinatura", description: err.message, variant: "destructive" });
    } finally {
      setSavingSignature(false);
    }
  };

  const handleGerarPDF = async (orcamentoId: string) => {
    setGeneratingPdf(orcamentoId);
    try {
      const { data: orcamento, error: orcError } = await supabase
        .from('orcamentos')
        .select('*, clientes(*), orcamento_itens(*, produtos(id, codigo, nome, localizacao, peso, imagem_url), kits(*))')
        .eq('id', orcamentoId)
        .single();

      if (orcError) throw orcError;

      let config = null;
      try {
        const { data: configData, error: confError } = await supabase
          .from('configuracoes')
          .select('*')
          .limit(1)
          .single();
        
        if (!confError) {
          config = configData;
        }
      } catch (err) {
        console.warn('Configurações não encontradas, usando padrão');
      }

      const dataAtual = new Date(orcamento.created_at).toLocaleDateString('pt-BR');
      const dataValidade = new Date(orcamento.created_at);
      dataValidade.setDate(dataValidade.getDate() + 7);

      const dadosOrcamento = {
        numero: orcamento.numero,
        data: dataAtual,
        validade: dataValidade.toLocaleDateString('pt-BR'),
        cliente: orcamento.clientes,
        itens: (orcamento.orcamento_itens || []).map((item: any) => ({
          codigo: item.produtos?.codigo || item.kits?.id || '-',
          nome: item.produtos?.nome || item.kits?.nome || '-',
          localizacao: item.produtos?.localizacao || '-',
          quantidade: item.quantidade,
          preco_unitario: item.preco_unitario,
          subtotal: item.subtotal,
          peso: item.produtos?.peso || null,
          imagem_url: item.produtos?.imagem_url || null,
        })),
        valor_total: orcamento.valor_total,
        observacoes: orcamento.observacoes,
        assinatura: orcamento.assinatura_base64 ? {
          base64: orcamento.assinatura_base64,
          nome: orcamento.assinatura_nome || '',
          cargo: orcamento.assinatura_cargo || undefined,
          data: orcamento.assinatura_data || '',
        } : null,
      };

      const pdfBlob = await gerarPDFOrcamento(dadosOrcamento, config);
      downloadPDF(pdfBlob, `orcamento_${orcamento.numero}.pdf`);

      toast({ title: "✅ PDF gerado!", description: "O arquivo foi baixado com sucesso" });
    } catch (error: any) {
      console.error('Erro ao gerar PDF:', error);
      toast({ title: "❌ Erro ao gerar PDF", description: error.message, variant: "destructive" });
    } finally {
      setGeneratingPdf(null);
    }
  };

  const handleWhatsApp = async (orcamentoId: string) => {
    try {
      const { data: orcamento, error } = await supabase
        .from('orcamentos')
        .select('numero, clientes(nome, telefone)')
        .eq('id', orcamentoId)
        .single();

      if (error) throw error;
      
      if (!orcamento?.clientes?.telefone) {
        toast({ title: "⚠️ Telefone não cadastrado", description: "Este cliente não possui telefone cadastrado", variant: "destructive" });
        return;
      }

      const telefone = orcamento.clientes.telefone.replace(/\D/g, '');
      const mensagem = encodeURIComponent(`Olá ${orcamento.clientes.nome}! Segue o orçamento ${orcamento.numero}.`);
      window.open(`https://wa.me/55${telefone}?text=${mensagem}`, '_blank');
    } catch (error: any) {
      toast({ title: "❌ Erro", description: error.message, variant: "destructive" });
    }
  };

  // Verifica se o orçamento tem itens de perfil com comprimento solicitado → abre dialog
  const iniciarAprovacao = async (orcamentoId: string) => {
    const { data: itensData } = await supabase
      .from('orcamento_itens')
      .select('produto_id, quantidade, comprimento_solicitado_mm, produto:produtos(codigo, nome, comprimento_barra, peso_kg_m)')
      .eq('orcamento_id', orcamentoId)
      .not('comprimento_solicitado_mm', 'is', null)
      .gt('comprimento_solicitado_mm', 0);

    const itensSobra = (itensData || []).filter(
      (i: any) => i.produto?.peso_kg_m > 0 && i.comprimento_solicitado_mm < (i.produto?.comprimento_barra || 6) * 1000
    ).map((i: any) => ({
      produto_id: i.produto_id,
      codigo: i.produto?.codigo || '',
      nome: i.produto?.nome || '',
      comprimento_barra: i.produto?.comprimento_barra || 6,
      comprimento_solicitado_mm: i.comprimento_solicitado_mm,
      quantidade: i.quantidade,
      localizacao: '',
    }));

    if (itensSobra.length > 0) {
      setSobrasItens(itensSobra);
      setSobrasOrcamentoId(orcamentoId);
      setSobrasDialogOpen(true);
    } else {
      await executarAprovacao(orcamentoId, null);
    }
  };

  const executarAprovacao = async (orcamentoId: string, localizacoes: Record<string, string> | null) => {
    setSobrasApproving(true);
    try {
      const { data, error } = await supabase.rpc('aprovar_orcamento_simples', { orcamento_id_param: orcamentoId });
      if (error) throw error;
      if (data && !data.success) {
        toast({ title: "Erro ao aprovar orçamento", description: data.message || "Não foi possível aprovar o orçamento", variant: "destructive" });
        return;
      }

      // Se o usuário informou localizações, atualiza as sobras recém-geradas pela função SQL
      if (localizacoes && Object.keys(localizacoes).length > 0) {
        for (const [produtoId, localizacao] of Object.entries(localizacoes)) {
          if (localizacao) {
            await supabase
              .from('sobras_perfis')
              .update({ localizacao })
              .eq('orcamento_id', orcamentoId)
              .eq('codigo_perfil', sobrasItens.find(i => i.produto_id === produtoId)?.codigo || '');
          }
        }
      }

      const sobrasGeradas = data?.sobras_geradas ?? 0;
      const descricao = sobrasGeradas > 0
        ? `Venda ${data.numero_venda} criada · ${sobrasGeradas} sobra(s) registradas`
        : `Venda ${data.numero_venda} criada`;
      toast({ title: "✅ Orçamento aprovado!", description: descricao });

      setSobrasDialogOpen(false);
      fetchOrcamentos();
    } catch (error: any) {
      toast({ title: "❌ Erro ao aprovar", description: error.message, variant: "destructive" });
    } finally {
      setSobrasApproving(false);
    }
  };

  const handleStatusChange = async (orcamentoId: string, newStatus: string) => {
    try {
      if (newStatus === 'aprovado') {
        await iniciarAprovacao(orcamentoId);
        return;
      } else if (newStatus === 'rejeitado') {
        try {
          const { data, error } = await supabase.rpc('rejeitar_orcamento', { orcamento_id_param: orcamentoId });
          if (error) throw error;
          if (data && !data.success) {
            toast({ title: "Erro ao rejeitar orçamento", description: data.message || "Não foi possível rejeitar o orçamento", variant: "destructive" });
            return;
          }
        } catch (rpcError) {
          console.warn('RPC não disponível, fazendo update direto');
          await supabase.from('orcamentos').update({ status: newStatus }).eq('id', orcamentoId);
        }
        toast({ title: "✅ Orçamento rejeitado", description: "Orçamento rejeitado com sucesso" });
      } else {
        const { error } = await supabase.from('orcamentos').update({ status: newStatus }).eq('id', orcamentoId);
        if (error) throw error;
        toast({ title: "✅ Status atualizado!", description: "O status do orçamento foi alterado com sucesso" });
      }
      
      fetchOrcamentos();
      
    } catch (error: any) {
      console.error('Erro ao atualizar status:', error);
      toast({ title: "❌ Erro ao atualizar status", description: error.message, variant: "destructive" });
    }
  };

  const filteredOrcamentos = useMemo(() => {
    if (!searchTerm) return orcamentos;
    const search = searchTerm.toLowerCase();
    return orcamentos.filter((orcamento) =>
      orcamento.clientes?.nome?.toLowerCase().includes(search) ||
      orcamento.numero?.toLowerCase().includes(search)
    );
  }, [orcamentos, searchTerm]);

  const totalPages = Math.ceil(filteredOrcamentos.length / pageSize);
  const paginatedOrcamentos = filteredOrcamentos.slice((page - 1) * pageSize, page * pageSize);

  const renderStatusBadge = (status: string) => {
    const config = statusConfig[status] || { label: status, variant: "secondary" as const, className: "" };
    return <Badge variant={config.variant} className={config.className}>{config.label}</Badge>;
  };

  // Tela de loading do auth
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Tela de erro
  if (error) {
    return (
      <div className="container mx-auto py-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro ao carregar orçamentos</AlertTitle>
          <AlertDescription>
            <p className="mb-2">{error}</p>
            <Button variant="outline" onClick={fetchOrcamentos}>
              Tentar novamente
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="space-y-6 animate-fade-in container mx-auto py-6 px-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Orçamentos</h2>
            <p className="text-muted-foreground">Gerencie orçamentos e propostas</p>
          </div>
          {isAdmin && (
            <Suspense fallback={<ButtonFallback />}>
              <AddOrcamentoDialog onOrcamentoAdded={handleOrcamentoChanged} />
            </Suspense>
          )}
        </div>

        {/* Banner de sobra vinda de Sobras de Perfis */}
        {sobraPendente && (
          <Alert className="border-amber-300 bg-amber-50">
            <MapPin className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-800">Sobra para venda: {sobraPendente.nome_perfil}</AlertTitle>
            <AlertDescription className="text-amber-700 flex items-center justify-between flex-wrap gap-2">
              <span>
                {sobraPendente.codigo_perfil} — {(sobraPendente.comprimento_mm / 1000).toFixed(3)} m
                {sobraPendente.valor_calculado > 0 && ` — ${sobraPendente.valor_calculado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`}
              </span>
              <div className="flex gap-2">
                {isAdmin && (
                  <Suspense fallback={<ButtonFallback />}>
                    <AddOrcamentoDialog onOrcamentoAdded={handleOrcamentoChanged} />
                  </Suspense>
                )}
                <Button variant="ghost" size="sm" className="text-amber-700" onClick={() => setSobraPendente(null)}>
                  Dispensar
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Lista de Orçamentos */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Lista de Orçamentos
            </CardTitle>
            <div className="mt-4">
              <Input
                placeholder="Buscar por cliente ou número..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                className="max-w-sm"
              />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                Carregando orçamentos...
              </div>
            ) : filteredOrcamentos.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                {searchTerm ? "Nenhum orçamento encontrado." : `Nenhum orçamento cadastrado. ${isAdmin ? "Clique em 'Novo Orçamento' para criar." : ""}`}
              </div>
            ) : (
              <>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Número</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-right">Valor Total</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedOrcamentos.map((orcamento) => (
                        <TableRow key={orcamento.id}>
                          <TableCell className="font-medium">{orcamento.numero}</TableCell>
                          <TableCell>{orcamento.clientes?.nome || "-"}</TableCell>
                          <TableCell>
                            {new Date(orcamento.created_at).toLocaleDateString("pt-BR")}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(orcamento.valor_total || 0)}
                          </TableCell>
                          <TableCell>
                            {isAdmin ? (
                              <Select
                                value={orcamento.status}
                                onValueChange={(value) => handleStatusChange(orcamento.id, value)}
                              >
                                <SelectTrigger className="w-32">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pendente">Pendente</SelectItem>
                                  <SelectItem value="aprovado">Aprovado</SelectItem>
                                  <SelectItem value="rejeitado">Rejeitado</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              renderStatusBadge(orcamento.status)
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {orcamento.status === 'pendente' && isAdmin && (
                                <Suspense fallback={<SmallButtonFallback />}>
                                  <EditOrcamentoDialog
                                    orcamentoId={orcamento.id}
                                    onOrcamentoUpdated={handleOrcamentoChanged}
                                  />
                                </Suspense>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleGerarPDF(orcamento.id)}
                                disabled={generatingPdf === orcamento.id}
                              >
                                {generatingPdf === orcamento.id ? (
                                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                ) : (
                                  <Download className="h-4 w-4 mr-1" />
                                )}
                                PDF
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleWhatsApp(orcamento.id)}
                              >
                                <Phone className="h-4 w-4 mr-1" />
                                WhatsApp
                              </Button>
                              {orcamento.assinatura_base64 ? (
                                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Assinado
                                </Badge>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleOpenSignature(orcamento.id)}
                                >
                                  <PenLine className="h-4 w-4 mr-1" />
                                  Assinar
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile card layout */}
                <div className="md:hidden space-y-3">
                  {paginatedOrcamentos.map((orcamento) => (
                    <div key={orcamento.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-sm">{orcamento.numero}</p>
                          <p className="text-sm text-muted-foreground">{orcamento.clientes?.nome || "-"}</p>
                        </div>
                        {renderStatusBadge(orcamento.status)}
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">
                          {new Date(orcamento.created_at).toLocaleDateString("pt-BR")}
                        </span>
                        <span className="font-bold">
                          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(orcamento.valor_total || 0)}
                        </span>
                      </div>
                      {isAdmin && (
                        <div className="pt-2 border-t">
                          <Select
                            value={orcamento.status}
                            onValueChange={(value) => handleStatusChange(orcamento.id, value)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pendente">Pendente</SelectItem>
                              <SelectItem value="aprovado">Aprovado</SelectItem>
                              <SelectItem value="rejeitado">Rejeitado</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2 pt-2 border-t">
                        {orcamento.status === 'pendente' && isAdmin && (
                          <Suspense fallback={<SmallButtonFallback />}>
                            <EditOrcamentoDialog
                              orcamentoId={orcamento.id}
                              onOrcamentoUpdated={handleOrcamentoChanged}
                            />
                          </Suspense>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleGerarPDF(orcamento.id)}
                          disabled={generatingPdf === orcamento.id}
                          className="flex-1"
                        >
                          {generatingPdf === orcamento.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                          PDF
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleWhatsApp(orcamento.id)}
                          className="flex-1"
                        >
                          <Phone className="h-4 w-4" />
                          WhatsApp
                        </Button>
                        {orcamento.assinatura_base64 ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs w-full text-center py-1.5">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Assinado por {orcamento.assinatura_nome}
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleOpenSignature(orcamento.id)}
                            className="flex-1"
                          >
                            <PenLine className="h-4 w-4 mr-1" />
                            Assinar
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Paginação */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <span className="text-sm text-muted-foreground">
                      {filteredOrcamentos.length} orçamento(s) - Página {page} de {totalPages}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Dialog de Assinatura Eletronica */}
        <Dialog open={signatureDialogOpen} onOpenChange={setSignatureDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PenLine className="h-5 w-5" />
                Assinatura Eletronica
              </DialogTitle>
              <DialogDescription>
                Assine para confirmar o recebimento do orçamento.
              </DialogDescription>
            </DialogHeader>
            <SignatureCanvas
              onSave={handleSaveSignature}
              onCancel={() => { setSignatureDialogOpen(false); setSignatureOrcamentoId(null); }}
              loading={savingSignature}
            />
          </DialogContent>
        </Dialog>

        {/* Dialog de Localização das Sobras */}
        <Dialog open={sobrasDialogOpen} onOpenChange={(open) => { if (!sobrasApproving) setSobrasDialogOpen(open); }}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-amber-600" />
                Localização das Sobras
              </DialogTitle>
              <DialogDescription>
                Informe onde cada sobra de perfil será armazenada. As sobras serão registradas automaticamente ao aprovar.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2 max-h-[50vh] overflow-y-auto pr-1">
              {sobrasItens.map((item, idx) => {
                const sobraM = ((item.comprimento_barra * 1000 - item.comprimento_solicitado_mm) / 1000).toFixed(3);
                return (
                  <div key={item.produto_id + idx} className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-sm">{item.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          Código: {item.codigo} | Sobra: <strong>{sobraM} m</strong> × {item.quantidade} pc
                        </p>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Localização física</Label>
                      <Input
                        placeholder="ex: Prateleira A3, Box 12"
                        className="h-8 text-sm"
                        value={item.localizacao}
                        onChange={(e) => {
                          setSobrasItens(prev => prev.map((it, i) =>
                            i === idx ? { ...it, localizacao: e.target.value } : it
                          ));
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  // Aprovar sem gerar sobras
                  setSobrasDialogOpen(false);
                  if (sobrasOrcamentoId) executarAprovacao(sobrasOrcamentoId, null);
                }}
                disabled={sobrasApproving}
              >
                Aprovar sem registrar sobras
              </Button>
              <Button
                onClick={() => {
                  if (!sobrasOrcamentoId) return;
                  const localizacoes: Record<string, string> = {};
                  sobrasItens.forEach(it => {
                    localizacoes[it.produto_id] = it.localizacao || '';
                  });
                  executarAprovacao(sobrasOrcamentoId, localizacoes);
                }}
                disabled={sobrasApproving}
                className="bg-amber-600 hover:bg-amber-700"
              >
                {sobrasApproving ? "Aprovando..." : "Aprovar e Registrar Sobras"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ErrorBoundary>
  );
}