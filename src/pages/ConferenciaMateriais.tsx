// pages/ConferenciaMateriais.tsx
import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, QrCode, Camera, Loader as Loader2, ChevronLeft, ChevronRight, CircleAlert as AlertCircle, CircleCheck as CheckCircle, Clock, Package, FileText, History, ArrowLeft, Image, PenLine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import QRCodeDialog from "@/components/conferencia/QRCodeDialog";
import { QRScannerComFoto } from "@/components/conferencia/QRScannerComFoto";
import { ListaFotosConferencia } from "@/components/conferencia/ListaFotosConferencia";
import { ProdutoQRCode } from "@/components/produtos/ProdutoQRCode";
import SignatureCanvas from "@/components/orcamentos/SignatureCanvas";

interface OrcamentoAprovado {
  id: string;
  numero: string;
  valor_total: number;
  status: string;
  created_at: string;
  clientes: { nome: string } | null;
}

interface OrcamentoItem {
  id: string;
  orcamento_id: string;
  produto_id: string | null;
  kit_id: string | null;
  quantidade: number;
  preco_unitario: number;
  desconto: number;
  subtotal: number;
  peso: number | null;
  quantidade_conferida: number;
  status_conferencia: string;
  produtos: { id: string; codigo: string; nome: string; cor: string | null; estoque: number; imagem_url: string | null } | null;
  kits: { id: string; codigo: string; nome: string } | null;
}

interface FotoConferencia {
  id: string;
  produto_codigo: string;
  produto_nome: string;
  foto_base64: string;
  created_at: string;
}

const statusConferenciaConfig: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  pendente: { label: "Pendente", className: "bg-yellow-50 text-yellow-700 border-yellow-200", icon: Clock },
  parcial: { label: "Parcial", className: "bg-blue-50 text-blue-700 border-blue-200", icon: Package },
  conferido: { label: "Conferido", className: "bg-green-50 text-green-700 border-green-200", icon: CheckCircle },
};

const orcamentoStatusConfig: Record<string, { label: string; className: string }> = {
  aprovado: { label: "Aprovado", className: "bg-green-600 text-white" },
  conferido: { label: "Conferido", className: "bg-emerald-700 text-white" },
  separado: { label: "Separado", className: "bg-teal-600 text-white" },
};

export default function ConferenciaMateriais() {
  const { user, loading: authLoading } = useAuth();
  const [orcamentos, setOrcamentos] = useState<OrcamentoAprovado[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Detail view
  const [selectedOrcamento, setSelectedOrcamento] = useState<OrcamentoAprovado | null>(null);
  const [itens, setItens] = useState<OrcamentoItem[]>([]);
  const [itensLoading, setItensLoading] = useState(false);
  const [fotos, setFotos] = useState<FotoConferencia[]>([]);
  const [fotosLoading, setFotosLoading] = useState(false);

  // QR
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrData, setQrData] = useState<{ orcamento_id: string; produto_id: string; quantidade: number; codigo: string } | null>(null);
  const [qrProdutoNome, setQrProdutoNome] = useState("");
  const [qrProdutoFotoUrl, setQrProdutoFotoUrl] = useState<string | null>(null);
  
  // Scanner com foto
  const [scannerOpen, setScannerOpen] = useState(false);
  const [produtosConferidos, setProdutosConferidos] = useState<string[]>([]);

  // Signature
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);
  const [signatureSaving, setSignatureSaving] = useState(false);
  const [assinatura, setAssinatura] = useState<{ base64: string; nome: string; cargo: string; data: string } | null>(null);

  // Active tab
  const [activeTab, setActiveTab] = useState<"itens" | "fotos" | "historico">("itens");

  const fetchOrcamentos = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: supabaseError } = await supabase
        .from("orcamentos")
        .select(
          `id, numero, valor_total, status, created_at, cliente_id,
           clientes:cliente_id (nome)`
        )
        .in("status", ["aprovado", "conferido", "separado"])
        .order("created_at", { ascending: false });

      if (supabaseError) throw supabaseError;

      const formattedData = (data || []).map((item: any) => ({
        ...item,
        clientes: !item.clientes
          ? null
          : Array.isArray(item.clientes) && item.clientes.length > 0
          ? item.clientes[0]
          : item.clientes,
      }));

      setOrcamentos(formattedData);
    } catch (err: any) {
      setError(err.message || "Erro ao carregar orçamentos");
      toast({ title: "Erro ao carregar", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) fetchOrcamentos();
  }, [authLoading]);

  const fetchItens = async (orcamentoId: string) => {
    try {
      setItensLoading(true);
      const { data, error: supabaseError } = await supabase
        .from("orcamento_itens")
        .select(
          `id, orcamento_id, produto_id, kit_id, quantidade, preco_unitario, desconto, subtotal, peso,
           quantidade_conferida, status_conferencia,
           produtos (id, codigo, nome, cor, estoque, imagem_url),
           kits (id, codigo, nome)`
        )
        .eq("orcamento_id", orcamentoId)
        .order("id");

      if (supabaseError) throw supabaseError;
      setItens(data || []);
    } catch (err: any) {
      toast({ title: "Erro ao carregar itens", description: err.message, variant: "destructive" });
    } finally {
      setItensLoading(false);
    }
  };

  const fetchFotos = async (orcamentoId: string) => {
    try {
      setFotosLoading(true);
      const { data, error: supabaseError } = await supabase
        .from("conferencia_fotos")
        .select("id, produto_codigo, produto_nome, foto_base64, created_at")
        .eq("orcamento_id", orcamentoId)
        .order("created_at", { ascending: false });

      if (supabaseError) throw supabaseError;
      setFotos(data || []);
    } catch (err: any) {
      console.error("Erro ao carregar fotos:", err);
    } finally {
      setFotosLoading(false);
    }
  };

  const handleOpenOrcamento = (orc: OrcamentoAprovado) => {
    setSelectedOrcamento(orc);
    setActiveTab("itens");
    setAssinatura(null);
    fetchItens(orc.id);
    fetchFotos(orc.id);
    fetchAssinatura(orc.id);
  };

  const handleBackToList = () => {
    setSelectedOrcamento(null);
    setItens([]);
    setFotos([]);
    setProdutosConferidos([]);
    setAssinatura(null);
    fetchOrcamentos();
  };

  const handleShowQR = (item: OrcamentoItem) => {
    if (!item.produto_id || !item.produtos) {
      toast({ title: "QR indisponível", description: "Item sem produto associado", variant: "destructive" });
      return;
    }
    setQrData({
      orcamento_id: item.orcamento_id,
      produto_id: item.produto_id,
      quantidade: item.quantidade,
      codigo: item.produtos.codigo,
    });
    setQrProdutoNome(item.produtos.nome);
    setQrProdutoFotoUrl(item.produtos.imagem_url || null);
    setQrDialogOpen(true);
  };

  const handleProdutoConferido = (produto: { codigo: string; nome: string; id: string }) => {
    setProdutosConferidos(prev => [...prev, produto.codigo]);

    // Atualizar a lista de itens para mostrar que foi conferido - marcar quantidade total
    setItens(prevItens =>
      prevItens.map(item => {
        if (item.produtos?.codigo === produto.codigo) {
          return {
            ...item,
            quantidade_conferida: item.quantidade,
            status_conferencia: "conferido" as const,
          };
        }
        return item;
      })
    );
    
    // Recarregar fotos
    if (selectedOrcamento) {
      fetchFotos(selectedOrcamento.id);
    }
    
    toast({
      title: "Produto conferido!",
      description: `${produto.nome} foi registrado com foto`,
    });
  };

  const fetchAssinatura = async (orcamentoId: string) => {
    try {
      const { data, error } = await supabase
        .from("conferencia_materiais")
        .select("assinatura_base64, assinatura_nome, assinatura_cargo, assinatura_data")
        .eq("orcamento_id", orcamentoId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Erro ao buscar assinatura:", error);
        return;
      }

      if (data && data.assinatura_base64) {
        setAssinatura({
          base64: data.assinatura_base64,
          nome: data.assinatura_nome || "",
          cargo: data.assinatura_cargo || "",
          data: data.assinatura_data || "",
        });
      }
    } catch (err) {
      console.error("Erro ao buscar assinatura:", err);
    }
  };

  const handleSaveSignature = async (sigData: { base64: string; nome: string; cargo: string }) => {
    if (!selectedOrcamento) return;
    setSignatureSaving(true);

    try {
      // Get or create conferencia session
      let conferenciaId: string | null = null;

      const { data: existing } = await supabase
        .from("conferencia_materiais")
        .select("id")
        .eq("orcamento_id", selectedOrcamento.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        conferenciaId = existing.id;
        // Update existing session with signature
        const { error } = await supabase
          .from("conferencia_materiais")
          .update({
            assinatura_base64: sigData.base64,
            assinatura_nome: sigData.nome,
            assinatura_cargo: sigData.cargo,
            assinatura_data: new Date().toISOString(),
          })
          .eq("id", conferenciaId);

        if (error) throw error;
      } else {
        // Create new session with signature
        const { data, error } = await supabase
          .from("conferencia_materiais")
          .insert({
            orcamento_id: selectedOrcamento.id,
            status: "em_andamento",
            assinatura_base64: sigData.base64,
            assinatura_nome: sigData.nome,
            assinatura_cargo: sigData.cargo,
            assinatura_data: new Date().toISOString(),
            created_by: user?.id,
          })
          .select("id")
          .single();

        if (error) throw error;
        conferenciaId = data.id;
      }

      setAssinatura({
        base64: sigData.base64,
        nome: sigData.nome,
        cargo: sigData.cargo,
        data: new Date().toISOString(),
      });

      setSignatureDialogOpen(false);
      toast({ title: "Assinatura registrada!", description: `Assinatura de ${sigData.nome} salva com sucesso` });
    } catch (err: any) {
      console.error("Erro ao salvar assinatura:", err);
      toast({ title: "Erro ao salvar assinatura", description: err.message, variant: "destructive" });
    } finally {
      setSignatureSaving(false);
    }
  };

  // Filtrar orçamentos
  const filteredOrcamentos = useMemo(() => {
    if (!searchTerm) return orcamentos;
    const search = searchTerm.toLowerCase();
    return orcamentos.filter(
      (o) => o.clientes?.nome?.toLowerCase().includes(search) || o.numero?.toLowerCase().includes(search)
    );
  }, [orcamentos, searchTerm]);

  const totalPages = Math.ceil(filteredOrcamentos.length / pageSize);
  const paginatedOrcamentos = filteredOrcamentos.slice((page - 1) * pageSize, page * pageSize);

  // Progress calculation
  const conferidosCount = itens.filter((i) => i.status_conferencia === "conferido").length;
  const progressPercent = itens.length > 0 ? Math.round((conferidosCount / itens.length) * 100) : 0;
  const todosConferidos = itens.length > 0 && conferidosCount === itens.length;

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !selectedOrcamento) {
    return (
      <div className="container mx-auto py-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Erro ao carregar</AlertTitle>
          <AlertDescription>
            <p className="mb-2">{error}</p>
            <Button variant="outline" onClick={fetchOrcamentos}>Tentar novamente</Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // ---- DETAIL VIEW ----
  if (selectedOrcamento) {
    const produtosConferidosSet = new Set(produtosConferidos);
    
    return (
      <div className="space-y-6 animate-fade-in container mx-auto py-6 px-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={handleBackToList}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar
            </Button>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Conferência de Materiais</h2>
              <p className="text-muted-foreground">
                {selectedOrcamento.numero} - {selectedOrcamento.clientes?.nome || "Sem cliente"}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setScannerOpen(true)}>
              <QrCode className="h-4 w-4 mr-2" />
              Escanear Produto
            </Button>
            {todosConferidos && !assinatura && (
              <Button variant="outline" onClick={() => setSignatureDialogOpen(true)}>
                <PenLine className="h-4 w-4 mr-2" />
                Assinatura do Cliente
              </Button>
            )}
          </div>
        </div>

        {/* Progress */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Progresso da Conferência</span>
                <span className="text-muted-foreground">
                  {conferidosCount} de {itens.length} itens conferidos ({progressPercent}%)
                </span>
              </div>
              <Progress value={progressPercent} className="h-3" />
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-yellow-400" /> Pendente: {itens.filter((i) => i.status_conferencia === "pendente").length}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-400" /> Parcial: {itens.filter((i) => i.status_conferencia === "parcial").length}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-green-400" /> Conferido: {conferidosCount}
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-purple-400" /> Fotos: {fotos.length}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Assinatura do Cliente */}
        {todosConferidos && (
          <Card className={assinatura ? "border-green-200 bg-green-50/30" : "border-amber-200 bg-amber-50/30"}>
            <CardContent className="pt-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-medium flex items-center gap-2">
                    <PenLine className="h-4 w-4" />
                    Assinatura do Cliente na Entrega
                  </span>
                  {!assinatura && (
                    <Button size="sm" onClick={() => setSignatureDialogOpen(true)}>
                      <PenLine className="h-4 w-4 mr-1" />
                      Coletar Assinatura
                    </Button>
                  )}
                </div>
                {assinatura ? (
                  <div className="space-y-3">
                    <div className="border rounded-lg overflow-hidden bg-white p-2">
                      <img src={assinatura.base64} alt="Assinatura" className="max-h-32 mx-auto" />
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm">
                      <span className="text-muted-foreground">Assinado por: <strong className="text-foreground">{assinatura.nome}</strong></span>
                      {assinatura.cargo && <span className="text-muted-foreground">Cargo: <strong className="text-foreground">{assinatura.cargo}</strong></span>}
                      <span className="text-muted-foreground">Data: <strong className="text-foreground">{new Date(assinatura.data).toLocaleString("pt-BR")}</strong></span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-amber-700">
                    Todos os itens foram conferidos. Colete a assinatura do cliente para confirmar a entrega.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="itens" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Itens
            </TabsTrigger>
            <TabsTrigger value="fotos" className="flex items-center gap-2">
              <Image className="h-4 w-4" />
              Fotos ({fotos.length})
            </TabsTrigger>
            <TabsTrigger value="historico" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="itens" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  Itens do Orçamento
                </CardTitle>
              </CardHeader>
              <CardContent>
                {itensLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                    Carregando itens...
                  </div>
                ) : itens.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">Nenhum item encontrado.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Código</TableHead>
                          <TableHead>Produto</TableHead>
                          <TableHead>Cor</TableHead>
                          <TableHead className="text-center">Qtd. Necessária</TableHead>
                          <TableHead className="text-center">Conferido</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {itens.map((item) => {
                          const config = statusConferenciaConfig[item.status_conferencia] || statusConferenciaConfig.pendente;
                          const IconComp = config.icon;
                          const jaConferido = produtosConferidosSet.has(item.produtos?.codigo || "");
                          
                          return (
                            <TableRow key={item.id} className={item.status_conferencia === "conferido" || jaConferido ? "bg-green-50/50" : ""}>
                              <TableCell className="font-mono font-medium">
                                {item.produtos?.codigo || item.kits?.codigo || "-"}
                              </TableCell>
                              <TableCell>{item.produtos?.nome || item.kits?.nome || "-"}</TableCell>
                              <TableCell>{item.produtos?.cor || "-"}</TableCell>
                              <TableCell className="text-center font-semibold">{item.quantidade}</TableCell>
                              <TableCell className="text-center">
                                <span className={item.quantidade_conferida < item.quantidade ? "text-orange-600" : "text-green-600"}>
                                  {item.quantidade_conferida}
                                </span>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={config.className}>
                                  <IconComp className="h-3 w-3 mr-1" />
                                  {config.label}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  {item.produto_id && item.produtos && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleShowQR(item)}
                                    >
                                      <QrCode className="h-4 w-4 mr-1" />
                                      QR
                                    </Button>
                                  )}
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
          </TabsContent>

          <TabsContent value="fotos" className="mt-4">
            <ListaFotosConferencia 
              orcamentoId={selectedOrcamento.id} 
              onUpdate={() => fetchFotos(selectedOrcamento.id)}
            />
          </TabsContent>

          <TabsContent value="historico" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5 text-primary" />
                  Histórico de Conferência
                </CardTitle>
              </CardHeader>
              <CardContent>
                {fotosLoading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                    Carregando histórico...
                  </div>
                ) : fotos.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum produto conferido ainda.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {fotos.map((foto) => (
                      <div key={foto.id} className="flex items-center gap-4 p-3 border rounded-lg">
                        <img src={foto.foto_base64} alt={foto.produto_nome} className="w-16 h-16 object-cover rounded" />
                        <div className="flex-1">
                          <p className="font-semibold">{foto.produto_nome}</p>
                          <p className="text-sm text-muted-foreground">Código: {foto.produto_codigo}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(foto.created_at).toLocaleString("pt-BR")}
                          </p>
                        </div>
                        <Badge variant="outline" className="bg-green-50">Conferido</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* QR Code Dialog */}
        <QRCodeDialog
          open={qrDialogOpen}
          onOpenChange={setQrDialogOpen}
          data={qrData}
          produtoNome={qrProdutoNome}
          produtoFotoUrl={qrProdutoFotoUrl}
        />

        {/* Scanner com Foto */}
        <QRScannerComFoto
          open={scannerOpen}
          onOpenChange={setScannerOpen}
          onProdutoLido={handleProdutoConferido}
          orcamentoId={selectedOrcamento.id}
          itens={itens.map(i => ({ produto_id: i.produto_id, quantidade: i.quantidade, quantidade_conferida: i.quantidade_conferida, status_conferencia: i.status_conferencia }))}
        />

        {/* Signature Dialog */}
        <Dialog open={signatureDialogOpen} onOpenChange={setSignatureDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <PenLine className="h-5 w-5" />
                Assinatura do Cliente na Entrega
              </DialogTitle>
              <DialogDescription>
                O cliente deve assinar confirmando o recebimento dos materiais conferidos.
              </DialogDescription>
            </DialogHeader>
            <SignatureCanvas
              onSave={handleSaveSignature}
              onCancel={() => setSignatureDialogOpen(false)}
              loading={signatureSaving}
            />
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ---- LIST VIEW ----
  return (
    <div className="space-y-6 animate-fade-in container mx-auto py-6 px-4">
      {/* Header */}
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Conferência de Materiais</h2>
        <p className="text-muted-foreground">Selecione um orçamento para iniciar a conferência</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Aprovados</p>
                <p className="text-2xl font-bold">{orcamentos.filter((o) => o.status === "aprovado").length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-100">
                <ClipboardCheck className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Conferidos</p>
                <p className="text-2xl font-bold">{orcamentos.filter((o) => o.status === "conferido").length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-2xl font-bold">{orcamentos.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Orcamentos list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-primary" />
            Orçamentos para Conferência
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
              Nenhum orçamento aprovado para conferência.
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
                    {paginatedOrcamentos.map((orc) => {
                      const sConfig = orcamentoStatusConfig[orc.status] || { label: orc.status, className: "" };
                      return (
                        <TableRow key={orc.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleOpenOrcamento(orc)}>
                          <TableCell className="font-medium">{orc.numero}</TableCell>
                          <TableCell>{orc.clientes?.nome || "-"}</TableCell>
                          <TableCell>{new Date(orc.created_at).toLocaleDateString("pt-BR")}</TableCell>
                          <TableCell className="text-right font-semibold">
                            {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(orc.valor_total || 0)}
                          </TableCell>
                          <TableCell>
                            <Badge className={sConfig.className}>{sConfig.label}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="outline">
                              <ClipboardCheck className="h-4 w-4 mr-1" />
                              Conferir
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile card layout */}
              <div className="md:hidden space-y-3">
                {paginatedOrcamentos.map((orc) => {
                  const sConfig = orcamentoStatusConfig[orc.status] || { label: orc.status, className: "" };
                  return (
                    <div key={orc.id} className="border rounded-lg p-4 space-y-3 cursor-pointer hover:bg-muted/50" onClick={() => handleOpenOrcamento(orc)}>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-semibold text-sm">{orc.numero}</p>
                          <p className="text-sm text-muted-foreground">{orc.clientes?.nome || "-"}</p>
                        </div>
                        <Badge className={sConfig.className}>{sConfig.label}</Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{new Date(orc.created_at).toLocaleDateString("pt-BR")}</span>
                        <span className="font-bold">
                          {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(orc.valor_total || 0)}
                        </span>
                      </div>
                      <Button size="sm" variant="outline" className="w-full">
                        <ClipboardCheck className="h-4 w-4 mr-1" />
                        Conferir Materiais
                      </Button>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <span className="text-sm text-muted-foreground">
                    {filteredOrcamentos.length} orçamento(s) - Página {page} de {totalPages}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}