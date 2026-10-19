// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { FileText, Search, RefreshCw, Eye, Printer, CircleCheck as CheckCircle, Circle as XCircle, Clock, TriangleAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { gerarPDFDanfe, downloadPDF } from "@/utils/pdfGenerator";

interface NotaFiscal {
  id: string;
  numero: number;
  serie: number;
  ambiente: string;
  status: string;
  chave_acesso: string | null;
  protocolo_autorizacao: string | null;
  motivo_status: string | null;
  valor_total: number;
  data_emissao: string | null;
  data_autorizacao: string | null;
  informacoes_adicionais: string | null;
  created_at: string;
  cliente_id: string;
  clientes?: {
    nome: string;
    cpf_cnpj: string;
    endereco: string | null;
    bairro: string | null;
    cidade: string | null;
    estado: string | null;
    cep: string | null;
    telefone: string | null;
    email: string | null;
    inscricao_estadual: string | null;
  } | null;
}

interface NotaItem {
  id: string;
  numero_item: number;
  codigo: string;
  descricao: string;
  ncm: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
}

const formatDate = (d: string | null) => {
  if (!d) return "-";
  return new Date(d).toLocaleString("pt-BR");
};

const getStatusInfo = (s: string) => {
  switch (s) {
    case "autorizada": return { label: "Autorizada", className: "bg-green-100 text-green-800 border-green-200", icon: CheckCircle };
    case "rejeitada": return { label: "Rejeitada", className: "bg-red-100 text-red-800 border-red-200", icon: XCircle };
    case "erro": return { label: "Erro", className: "bg-red-100 text-red-800 border-red-200", icon: TriangleAlert };
    case "cancelada": return { label: "Cancelada", className: "bg-gray-100 text-gray-800 border-gray-200", icon: XCircle };
    case "enviando": return { label: "Enviando", className: "bg-blue-100 text-blue-800 border-blue-200", icon: Clock };
    default: return { label: s, className: "bg-gray-100 text-gray-800 border-gray-200", icon: Clock };
  }
};

export default function NotasFiscais() {
  const [notas, setNotas] = useState<NotaFiscal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [processandoId, setProcessandoId] = useState<string | null>(null);

  const [dialogDetalhesAberto, setDialogDetalhesAberto] = useState(false);
  const [notaDetalhes, setNotaDetalhes] = useState<NotaFiscal | null>(null);
  const [itensDetalhes, setItensDetalhes] = useState<NotaItem[]>([]);

  const carregarNotas = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("notas_fiscais")
        .select("*, clientes(nome, cpf_cnpj, endereco, bairro, cidade, estado, cep, telefone, email, inscricao_estadual)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setNotas(data || []);
    } catch (error: any) {
      toast({ title: "Erro ao carregar notas fiscais", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { carregarNotas(); }, [carregarNotas]);

  const notasFiltradas = notas.filter((n) => {
    const matchSearch =
      String(n.numero).includes(searchTerm) ||
      (n.chave_acesso || "").includes(searchTerm) ||
      (n.clientes?.nome || "").toLowerCase().includes(searchTerm.toLowerCase());
    return (filtroStatus === "todos" || n.status === filtroStatus) && matchSearch;
  });

  const totalAutorizadas = notas.filter((n) => n.status === "autorizada").length;
  const totalRejeitadas = notas.filter((n) => n.status === "rejeitada" || n.status === "erro").length;
  const valorTotalAutorizado = notas.filter((n) => n.status === "autorizada").reduce((soma, n) => soma + Number(n.valor_total || 0), 0);

  const handleVerDetalhes = async (nota: NotaFiscal) => {
    setNotaDetalhes(nota);
    setDialogDetalhesAberto(true);
    try {
      const { data, error } = await supabase
        .from("notas_fiscais_itens")
        .select("*")
        .eq("nota_fiscal_id", nota.id)
        .order("numero_item");
      if (error) throw error;
      setItensDetalhes(data || []);
    } catch (error: any) {
      toast({ title: "Erro ao carregar itens", description: error.message, variant: "destructive" });
    }
  };

  const handleImprimirDanfe = async (nota: NotaFiscal) => {
    setProcessandoId(nota.id);
    try {
      const [{ data: config, error: configError }, { data: itens, error: itensError }] = await Promise.all([
        supabase.from("configuracoes").select("*").limit(1).single(),
        supabase.from("notas_fiscais_itens").select("*").eq("nota_fiscal_id", nota.id).order("numero_item"),
      ]);
      if (configError) throw configError;
      if (itensError) throw itensError;
      if (!nota.chave_acesso) throw new Error("Esta nota ainda não tem chave de acesso");

      const pdfBlob = await gerarPDFDanfe({
        numero: nota.numero,
        serie: nota.serie,
        chaveAcesso: nota.chave_acesso,
        protocoloAutorizacao: nota.protocolo_autorizacao,
        dataAutorizacao: formatDate(nota.data_autorizacao),
        dataEmissao: formatDate(nota.data_emissao),
        ambiente: nota.ambiente as "homologacao" | "producao",
        status: nota.status,
        emitente: {
          nome_empresa: config.nome_empresa,
          cnpj: config.cnpj,
          telefone: config.telefone,
          email: config.email,
          endereco: config.endereco,
          logo_url: config.logo_url,
          inscricaoEstadual: config.inscricao_estadual,
        },
        destinatario: {
          nome: nota.clientes?.nome || "-",
          cpfCnpj: nota.clientes?.cpf_cnpj || "-",
          inscricaoEstadual: nota.clientes?.inscricao_estadual || null,
          endereco: nota.clientes?.endereco || null,
          bairro: nota.clientes?.bairro || null,
          cidade: nota.clientes?.cidade || null,
          estado: nota.clientes?.estado || null,
          cep: nota.clientes?.cep || null,
          telefone: nota.clientes?.telefone || null,
          email: nota.clientes?.email || null,
        },
        itens: (itens || []).map((item: NotaItem) => ({
          codigo: item.codigo,
          descricao: item.descricao,
          ncm: item.ncm,
          cfop: item.cfop,
          unidade: item.unidade,
          quantidade: item.quantidade,
          valorUnitario: item.valor_unitario,
          valorTotal: item.valor_total,
        })),
        valorTotalProdutos: Number(nota.valor_total),
        valorTotalNota: Number(nota.valor_total),
        informacoesAdicionais: nota.informacoes_adicionais || null,
      });

      downloadPDF(pdfBlob, `danfe_${nota.numero}_${nota.serie}.pdf`);
    } catch (error: any) {
      toast({ title: "Erro ao gerar DANFE", description: error.message, variant: "destructive" });
    } finally {
      setProcessandoId(null);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" /> Notas Fiscais
          </h2>
          <p className="text-muted-foreground text-lg">NF-e emitidas — consulte, veja detalhes e imprima o DANFE</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-0 shadow-lg">
          <CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-muted-foreground">Autorizadas</p><p className="text-2xl font-bold text-green-600">{totalAutorizadas}</p></div><CheckCircle className="h-8 w-8 text-green-500" /></div></CardContent>
        </Card>
        <Card className="border-0 shadow-lg">
          <CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-muted-foreground">Rejeitadas/Erro</p><p className="text-2xl font-bold text-red-600">{totalRejeitadas}</p></div><XCircle className="h-8 w-8 text-red-500" /></div></CardContent>
        </Card>
        <Card className="border-0 shadow-lg">
          <CardContent className="pt-6"><div><p className="text-sm font-medium text-muted-foreground">Valor Autorizado</p><p className="text-2xl font-bold text-primary">R$ {valorTotalAutorizado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p></div></CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-lg">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por número, chave de acesso ou cliente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
            <div className="flex gap-2">
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="autorizada">Autorizada</SelectItem>
                  <SelectItem value="rejeitada">Rejeitada</SelectItem>
                  <SelectItem value="erro">Erro</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={carregarNotas}><RefreshCw className="h-4 w-4" /></Button>
            </div>
          </div>

          {loading ? (
            <div className="text-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Número</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Ambiente</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {notasFiltradas.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhuma nota fiscal encontrada.</TableCell></TableRow>
                  ) : notasFiltradas.map((n) => {
                    const si = getStatusInfo(n.status);
                    const SIcon = si.icon;
                    return (
                      <TableRow key={n.id} className="hover:bg-muted/50">
                        <TableCell className="font-mono font-medium">{n.numero}/{n.serie}</TableCell>
                        <TableCell>{n.clientes?.nome || "-"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={n.ambiente === "producao" ? "bg-primary/10 text-primary" : "bg-amber-50 text-amber-700 border-amber-200"}>
                            {n.ambiente === "producao" ? "Produção" : "Homologação"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold">R$ {Number(n.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</TableCell>
                        <TableCell>{formatDate(n.data_emissao)}</TableCell>
                        <TableCell><Badge variant="outline" className={si.className}><SIcon className="h-3 w-3 mr-1" />{si.label}</Badge></TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleVerDetalhes(n)} title="Detalhes"><Eye className="h-4 w-4" /></Button>
                            {n.status === "autorizada" && (
                              <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleImprimirDanfe(n)} disabled={processandoId === n.id} title="Imprimir DANFE">
                                {processandoId === n.id ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div> : <Printer className="h-4 w-4" />}
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

      <Dialog open={dialogDetalhesAberto} onOpenChange={setDialogDetalhesAberto}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Eye className="h-5 w-5 text-primary" />Nota Fiscal {notaDetalhes?.numero}/{notaDetalhes?.serie}</DialogTitle>
            <DialogDescription>{notaDetalhes?.clientes?.nome}</DialogDescription>
          </DialogHeader>
          {notaDetalhes && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-sm text-muted-foreground">Status</p>{(() => { const si = getStatusInfo(notaDetalhes.status); const SIcon = si.icon; return <Badge variant="outline" className={si.className}><SIcon className="h-3 w-3 mr-1" />{si.label}</Badge>; })()}</div>
                <div><p className="text-sm text-muted-foreground">Ambiente</p><p className="font-medium">{notaDetalhes.ambiente === "producao" ? "Produção" : "Homologação"}</p></div>
              </div>
              {notaDetalhes.chave_acesso && (
                <div><p className="text-sm text-muted-foreground">Chave de Acesso</p><p className="font-mono text-xs bg-muted/50 p-2 rounded break-all">{notaDetalhes.chave_acesso}</p></div>
              )}
              {notaDetalhes.protocolo_autorizacao && (
                <div><p className="text-sm text-muted-foreground">Protocolo de Autorização</p><p className="font-medium">{notaDetalhes.protocolo_autorizacao}</p></div>
              )}
              {notaDetalhes.motivo_status && (
                <div><p className="text-sm text-muted-foreground">Motivo</p><p className="text-sm bg-muted/50 p-2 rounded">{notaDetalhes.motivo_status}</p></div>
              )}
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Itens ({itensDetalhes.length})</p>
                <div className="border rounded-lg divide-y max-h-[200px] overflow-y-auto">
                  {itensDetalhes.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-2 text-sm">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{item.descricao}</p>
                        <p className="text-xs text-muted-foreground">{item.codigo} · NCM {item.ncm} · CFOP {item.cfop}</p>
                      </div>
                      <span className="font-semibold shrink-0">{item.quantidade} {item.unidade} — R$ {Number(item.valor_total).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-between items-center text-lg font-bold border-t pt-3">
                <span>Total:</span>
                <span className="text-primary">R$ {Number(notaDetalhes.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogDetalhesAberto(false)}>Fechar</Button>
            {notaDetalhes?.status === "autorizada" && (
              <Button onClick={() => handleImprimirDanfe(notaDetalhes)} disabled={processandoId === notaDetalhes.id}>
                {processandoId === notaDetalhes.id ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div> : <Printer className="h-4 w-4 mr-2" />}
                Imprimir DANFE
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
