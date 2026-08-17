// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowLeftRight, Plus, Search, RefreshCw, Package, CircleCheck as CheckCircle, Circle as XCircle, Clock, Truck, Eye, History, Building2, Layers } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface Filial { id: string; nome: string; codigo: string; }
interface Produto { id: string; codigo: string; nome: string; estoque: number; unidade: string; }
interface Kit { id: string; codigo: string; nome: string; }
interface KitItem {
  produto_id: string;
  quantidade: number;
  produto?: { id: string; nome: string; codigo: string; estoque: number; };
}
interface Transferencia {
  id: string; numero: string; filial_origem_id: string | null; filial_destino_id: string | null;
  produto_id: string | null; kit_id: string | null; quantidade: number; data_transferencia: string;
  status: string; observacoes: string | null; created_at: string;
  filial_origem?: Filial; filial_destino?: Filial; produto?: Produto; kit?: Kit;
}
interface HistoricoItem { id: string; status_anterior: string | null; status_novo: string; observacoes: string | null; created_at: string; }

const MATRIZ_ID = "__MATRIZ__";
const formatDate = (d: string | null) => { if (!d) return "-"; const [a, m, di] = d.split("T")[0].split("-"); return `${di}/${m}/${a}`; };

const getStatusInfo = (s: string) => {
  switch (s) {
    case "pendente": return { label: "Pendente", className: "bg-yellow-100 text-yellow-800 border-yellow-200", icon: Clock };
    case "em_transito": return { label: "Em Trânsito", className: "bg-blue-100 text-blue-800 border-blue-200", icon: Truck };
    case "concluida": return { label: "Concluída", className: "bg-green-100 text-green-800 border-green-200", icon: CheckCircle };
    case "cancelada": return { label: "Cancelada", className: "bg-red-100 text-red-800 border-red-200", icon: XCircle };
    default: return { label: s, className: "bg-gray-100 text-gray-800 border-gray-200", icon: Package };
  }
};

const toDbFilialId = (uiId: string): string | null => (uiId === MATRIZ_ID ? null : uiId);
const getLocationName = (filial: Filial | undefined | null): string => (!filial ? "Matriz" : filial.nome);

export default function TransferenciasEstoque() {
  const { user } = useAuth();
  const [transferencias, setTransferencias] = useState<Transferencia[]>([]);
  const [filiais, setFiliais] = useState<Filial[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [kits, setKits] = useState<Kit[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [processandoId, setProcessandoId] = useState<string | null>(null);

  const [dialogNovaAberto, setDialogNovaAberto] = useState(false);
  const [filialOrigem, setFilialOrigem] = useState("");
  const [filialDestino, setFilialDestino] = useState("");
  const [tipoItem, setTipoItem] = useState<"produto" | "kit">("produto");
  const [produtoSel, setProdutoSel] = useState("");
  const [kitSel, setKitSel] = useState("");
  const [quantidade, setQuantidade] = useState(1);
  const [dataTransferencia, setDataTransferencia] = useState(new Date().toISOString().split("T")[0]);
  const [observacoes, setObservacoes] = useState("");

  const [dialogCancelarAberto, setDialogCancelarAberto] = useState(false);
  const [transParaCancelar, setTransParaCancelar] = useState<Transferencia | null>(null);

  const [dialogHistoricoAberto, setDialogHistoricoAberto] = useState(false);
  const [transHistorico, setTransHistorico] = useState<Transferencia | null>(null);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);

  const [dialogDetalhesAberto, setDialogDetalhesAberto] = useState(false);
  const [transDetalhes, setTransDetalhes] = useState<Transferencia | null>(null);

  const carregarDados = useCallback(async () => {
    try {
      setLoading(true);
      const [{ data: f, error: fe }, { data: p, error: pe }, { data: k, error: ke }, { data: t, error: te }] = await Promise.all([
        supabase.from("filiais").select("id, nome, codigo").eq("ativo", true).order("nome"),
        supabase.from("produtos").select("id, codigo, nome, estoque, unidade").eq("ativo", true).order("nome"),
        supabase.from("kits").select("id, codigo, nome").eq("ativo", true).order("nome"),
        supabase.from("transferencias_estoque").select(`*, filial_origem:filiais!transferencias_estoque_filial_origem_id_fkey(id, nome, codigo), filial_destino:filiais!transferencias_estoque_filial_destino_id_fkey(id, nome, codigo), produto:produtos(id, codigo, nome, estoque, unidade), kit:kits(id, codigo, nome)`).order("created_at", { ascending: false }),
      ]);
      if (fe) throw fe; if (pe) throw pe; if (ke) throw ke; if (te) throw te;
      setFiliais(f || []); setProdutos(p || []); setKits(k || []); setTransferencias(t || []);
    } catch (error: any) {
      toast({ title: "Erro ao carregar dados", description: error.message, variant: "destructive" });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { carregarDados(); }, [carregarDados]);

  const transFiltradas = transferencias.filter((t) => {
    const nomeItem = t.produto?.nome || t.kit?.nome || "";
    const matchSearch = t.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
      nomeItem.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getLocationName(t.filial_origem).toLowerCase().includes(searchTerm.toLowerCase()) ||
      getLocationName(t.filial_destino).toLowerCase().includes(searchTerm.toLowerCase());
    return (filtroStatus === "todos" || t.status === filtroStatus) && matchSearch;
  });

  const totalPendentes = transferencias.filter((t) => t.status === "pendente").length;
  const totalEmTransito = transferencias.filter((t) => t.status === "em_transito").length;
  const totalConcluidas = transferencias.filter((t) => t.status === "concluida").length;

  const getEstoqueLocal = async (filialId: string | null, produtoId: string): Promise<number> => {
    if (filialId === null) {
      const { data, error } = await supabase.from("produtos").select("estoque").eq("id", produtoId).maybeSingle();
      if (error) throw error;
      return data?.estoque || 0;
    }
    const { data, error } = await supabase.from("estoque_filial").select("quantidade").eq("filial_id", filialId).eq("produto_id", produtoId).maybeSingle();
    if (error) throw error;
    return data?.quantidade || 0;
  };

  const debitarEstoque = async (filialId: string | null, produtoId: string, qtd: number) => {
    const atual = await getEstoqueLocal(filialId, produtoId);
    if (atual < qtd) throw new Error(`Estoque insuficiente. Disponível: ${atual}`);
    const novo = atual - qtd;
    if (filialId === null) {
      const { error } = await supabase.from("produtos").update({ estoque: novo }).eq("id", produtoId);
      if (error) throw error;
    } else {
      const { data: ex } = await supabase.from("estoque_filial").select("id").eq("filial_id", filialId).eq("produto_id", produtoId).maybeSingle();
      if (ex) await supabase.from("estoque_filial").update({ quantidade: novo, updated_at: new Date().toISOString() }).eq("id", ex.id);
      else await supabase.from("estoque_filial").insert({ filial_id: filialId, produto_id: produtoId, quantidade: novo });
    }
    return novo;
  };

  const creditarEstoque = async (filialId: string | null, produtoId: string, qtd: number) => {
    const atual = await getEstoqueLocal(filialId, produtoId);
    const novo = atual + qtd;
    if (filialId === null) {
      const { error } = await supabase.from("produtos").update({ estoque: novo }).eq("id", produtoId);
      if (error) throw error;
    } else {
      const { data: ex } = await supabase.from("estoque_filial").select("id").eq("filial_id", filialId).eq("produto_id", produtoId).maybeSingle();
      if (ex) await supabase.from("estoque_filial").update({ quantidade: novo, updated_at: new Date().toISOString() }).eq("id", ex.id);
      else await supabase.from("estoque_filial").insert({ filial_id: filialId, produto_id: produtoId, quantidade: novo });
    }
    return novo;
  };

  const fetchKitItens = async (kitId: string): Promise<KitItem[]> => {
    const { data, error } = await supabase
      .from("kit_itens")
      .select(`
        produto_id,
        quantidade,
        produtos:produto_id (id, nome, codigo, estoque)
      `)
      .eq("kit_id", kitId);
    if (error) throw error;
    return (data || []).filter((item: any) => item.produto_id);
  };

  const debitarEstoqueKit = async (filialId: string | null, kitId: string, qtdKits: number) => {
    const itens = await fetchKitItens(kitId);
    for (const item of itens) {
      const qtdNecessaria = item.quantidade * qtdKits;
      await debitarEstoque(filialId, item.produto_id, qtdNecessaria);
    }
  };

  const creditarEstoqueKit = async (filialId: string | null, kitId: string, qtdKits: number) => {
    const itens = await fetchKitItens(kitId);
    for (const item of itens) {
      const qtdNecessaria = item.quantidade * qtdKits;
      await creditarEstoque(filialId, item.produto_id, qtdNecessaria);
    }
  };

  const verificarEstoqueKit = async (filialId: string | null, kitId: string, qtdKits: number): Promise<{ ok: boolean; faltando: string[] }> => {
    const itens = await fetchKitItens(kitId);
    const faltando: string[] = [];
    for (const item of itens) {
      const estoque = await getEstoqueLocal(filialId, item.produto_id);
      const necessario = item.quantidade * qtdKits;
      if (estoque < necessario) {
        faltando.push(`${item.produto?.nome || item.produto_id}: ${estoque} disponível, ${necessario} necessário`);
      }
    }
    return { ok: faltando.length === 0, faltando };
  };

  const handleCriarTransferencia = async () => {
    if (!filialOrigem || !filialDestino) { toast({ title: "Selecione a origem e o destino", variant: "destructive" }); return; }
    if (filialOrigem === filialDestino) { toast({ title: "Origem e destino devem ser diferentes", variant: "destructive" }); return; }
    if (tipoItem === "produto" && !produtoSel) { toast({ title: "Selecione um produto", variant: "destructive" }); return; }
    if (tipoItem === "kit" && !kitSel) { toast({ title: "Selecione um kit", variant: "destructive" }); return; }
    if (quantidade <= 0) { toast({ title: "Quantidade deve ser maior que zero", variant: "destructive" }); return; }
    try {
      setProcessandoId("nova");
      const dbOrigem = toDbFilialId(filialOrigem);
      const dbDestino = toDbFilialId(filialDestino);

      if (tipoItem === "produto") {
        const estoqueOrigem = await getEstoqueLocal(dbOrigem, produtoSel);
        if (estoqueOrigem < quantidade) { toast({ title: "Estoque insuficiente na origem", description: `Disponível: ${estoqueOrigem}`, variant: "destructive" }); return; }
      } else {
        const verificacao = await verificarEstoqueKit(dbOrigem, kitSel, quantidade);
        if (!verificacao.ok) {
          toast({ title: "Estoque insuficiente na origem para os componentes do kit", description: verificacao.faltando.join("; "), variant: "destructive" });
          return;
        }
      }

      const { data: numero, error: numError } = await supabase.rpc("gerar_numero_transferencia");
      if (numError) throw numError;

      const insertData: any = {
        numero: numero, filial_origem_id: dbOrigem, filial_destino_id: dbDestino,
        quantidade, data_transferencia: dataTransferencia,
        status: "pendente", observacoes: observacoes || null, created_by: user?.id,
      };

      if (tipoItem === "produto") {
        insertData.produto_id = produtoSel;
        insertData.kit_id = null;
      } else {
        insertData.kit_id = kitSel;
        insertData.produto_id = null;
      }

      const { data: transInsert, error: transError } = await supabase.from("transferencias_estoque").insert(insertData).select().single();
      if (transError) throw transError;

      await supabase.from("transferencias_estoque_historico").insert({
        transferencia_id: transInsert.id, status_anterior: null, status_novo: "pendente",
        observacoes: "Transferência criada", usuario_id: user?.id,
      });

      const nomeOrigem = filialOrigem === MATRIZ_ID ? "Matriz" : filiais.find(f => f.id === filialOrigem)?.nome;
      const nomeDestino = filialDestino === MATRIZ_ID ? "Matriz" : filiais.find(f => f.id === filialDestino)?.nome;
      toast({ title: "Transferência criada!", description: `${numero} - ${nomeOrigem} → ${nomeDestino}.` });
      setFilialOrigem(""); setFilialDestino(""); setProdutoSel(""); setKitSel(""); setQuantidade(1);
      setTipoItem("produto");
      setDataTransferencia(new Date().toISOString().split("T")[0]); setObservacoes("");
      setDialogNovaAberto(false);
      await carregarDados();
    } catch (error: any) {
      toast({ title: "Erro ao criar transferência", description: error.message, variant: "destructive" });
    } finally { setProcessandoId(null); }
  };

  const handleEnviarTransferencia = async (trans: Transferencia) => {
    try {
      setProcessandoId(trans.id);
      if (trans.kit_id) {
        await debitarEstoqueKit(trans.filial_origem_id, trans.kit_id, trans.quantidade);
      } else if (trans.produto_id) {
        await debitarEstoque(trans.filial_origem_id, trans.produto_id, trans.quantidade);
      }
      await supabase.from("transferencias_estoque").update({ status: "em_transito", updated_at: new Date().toISOString() }).eq("id", trans.id);
      await supabase.from("transferencias_estoque_historico").insert({
        transferencia_id: trans.id, status_anterior: "pendente", status_novo: "em_transito",
        observacoes: `${trans.kit_id ? "Kit" : "Produto"} enviado de ${getLocationName(trans.filial_origem)}`, usuario_id: user?.id,
      });
      toast({ title: "Transferência em trânsito!", description: `${trans.numero} - enviado.` });
      await carregarDados();
    } catch (error: any) {
      toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
    } finally { setProcessandoId(null); }
  };

  const handleConcluirTransferencia = async (trans: Transferencia) => {
    try {
      setProcessandoId(trans.id);
      if (trans.kit_id) {
        await creditarEstoqueKit(trans.filial_destino_id, trans.kit_id, trans.quantidade);
      } else if (trans.produto_id) {
        await creditarEstoque(trans.filial_destino_id, trans.produto_id, trans.quantidade);
      }
      await supabase.from("transferencias_estoque").update({ status: "concluida", updated_at: new Date().toISOString() }).eq("id", trans.id);
      await supabase.from("transferencias_estoque_historico").insert({
        transferencia_id: trans.id, status_anterior: "em_transito", status_novo: "concluida",
        observacoes: `${trans.kit_id ? "Kit" : "Produto"} recebido em ${getLocationName(trans.filial_destino)}`, usuario_id: user?.id,
      });
      toast({ title: "Transferência concluída!", description: `${trans.numero} - estoque atualizado.` });
      await carregarDados();
    } catch (error: any) {
      toast({ title: "Erro ao concluir", description: error.message, variant: "destructive" });
    } finally { setProcessandoId(null); }
  };

  const handleCancelarTransferencia = async () => {
    if (!transParaCancelar) return;
    try {
      setProcessandoId(transParaCancelar.id);
      if (transParaCancelar.status === "em_transito") {
        if (transParaCancelar.kit_id) {
          await creditarEstoqueKit(transParaCancelar.filial_origem_id, transParaCancelar.kit_id, transParaCancelar.quantidade);
        } else if (transParaCancelar.produto_id) {
          await creditarEstoque(transParaCancelar.filial_origem_id, transParaCancelar.produto_id, transParaCancelar.quantidade);
        }
      }
      await supabase.from("transferencias_estoque").update({ status: "cancelada", updated_at: new Date().toISOString() }).eq("id", transParaCancelar.id);
      await supabase.from("transferencias_estoque_historico").insert({
        transferencia_id: transParaCancelar.id, status_anterior: transParaCancelar.status, status_novo: "cancelada",
        observacoes: "Transferência cancelada", usuario_id: user?.id,
      });
      toast({ title: "Transferência cancelada", description: transParaCancelar.numero });
      setDialogCancelarAberto(false); setTransParaCancelar(null);
      await carregarDados();
    } catch (error: any) {
      toast({ title: "Erro ao cancelar", description: error.message, variant: "destructive" });
    } finally { setProcessandoId(null); }
  };

  const handleVerHistorico = async (trans: Transferencia) => {
    setTransHistorico(trans); setDialogHistoricoAberto(true);
    try {
      const { data, error } = await supabase.from("transferencias_estoque_historico").select("*").eq("transferencia_id", trans.id).order("created_at", { ascending: true });
      if (error) throw error;
      setHistorico(data || []);
    } catch (error: any) {
      toast({ title: "Erro ao carregar histórico", description: error.message, variant: "destructive" });
    }
  };

  const renderLocationBadge = (filial: Filial | undefined | null, color: string) => {
    if (!filial) return <Badge variant="outline" className={color === "origem" ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-green-50 text-green-700 border-green-200"}><Building2 className="h-3 w-3 mr-1" />Matriz</Badge>;
    return <Badge variant="outline" className={color === "origem" ? "bg-blue-50 text-blue-700" : "bg-green-50 text-green-700"}>{filial.nome}</Badge>;
  };

  const renderItemLabel = (t: Transferencia) => {
    if (t.kit_id) {
      return (
        <div className="flex flex-col">
          <span className="font-medium flex items-center gap-1">
            <Layers className="h-3 w-3 text-purple-500" />
            {t.kit?.nome || "Kit não encontrado"}
          </span>
          <span className="text-xs text-muted-foreground">{t.kit?.codigo || "-"}</span>
        </div>
      );
    }
    return (
      <div className="flex flex-col">
        <span className="font-medium">{t.produto?.nome || "-"}</span>
        <span className="text-xs text-muted-foreground">{t.produto?.codigo || "-"}</span>
      </div>
    );
  };

  const locs = [{ id: MATRIZ_ID, nome: "Matriz" }, ...filiais.map(f => ({ id: f.id, nome: f.nome }))];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3"><ArrowLeftRight className="h-8 w-8 text-primary" /> Transferências de Estoque</h1>
          <p className="text-muted-foreground mt-1">Transfira produtos e kits entre a Matriz e as filiais com rastreabilidade completa</p>
        </div>
        <Button onClick={() => setDialogNovaAberto(true)} className="bg-primary hover:bg-primary/90"><Plus className="mr-2 h-4 w-4" /> Nova Transferência</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-muted-foreground">Pendentes</p><p className="text-2xl font-bold text-yellow-600">{totalPendentes}</p></div><div className="flex h-12 w-12 items-center justify-center rounded-lg bg-yellow-100"><Clock className="h-6 w-6 text-yellow-600" /></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-muted-foreground">Em Trânsito</p><p className="text-2xl font-bold text-blue-600">{totalEmTransito}</p></div><div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100"><Truck className="h-6 w-6 text-blue-600" /></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-muted-foreground">Concluídas</p><p className="text-2xl font-bold text-green-600">{totalConcluidas}</p></div><div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100"><CheckCircle className="h-6 w-6 text-green-600" /></div></div></CardContent></Card>
      </div>

      <Card><CardContent className="pt-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar por número, produto, kit, Matriz ou filial..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" /></div>
          <div className="flex gap-2">
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent><SelectItem value="todos">Todos</SelectItem><SelectItem value="pendente">Pendente</SelectItem><SelectItem value="em_transito">Em Trânsito</SelectItem><SelectItem value="concluida">Concluída</SelectItem><SelectItem value="cancelada">Cancelada</SelectItem></SelectContent>
            </Select>
            <Button variant="outline" onClick={carregarDados}><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </div>
        {loading ? (
          <div className="text-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div><p className="mt-4 text-muted-foreground">Carregando transferências...</p></div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="font-bold">Número</TableHead><TableHead className="font-bold">Item</TableHead>
                <TableHead className="font-bold text-right">Qtd</TableHead><TableHead className="font-bold">Origem</TableHead>
                <TableHead className="font-bold">Destino</TableHead><TableHead className="font-bold">Data</TableHead>
                <TableHead className="font-bold">Status</TableHead><TableHead className="font-bold text-right">Ações</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {transFiltradas.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{searchTerm || filtroStatus !== "todos" ? "Nenhuma transferência encontrada." : "Nenhuma transferência cadastrada."}</TableCell></TableRow>
                ) : transFiltradas.map((t) => {
                  const si = getStatusInfo(t.status); const SIcon = si.icon;
                  return (
                    <TableRow key={t.id} className="hover:bg-muted/50">
                      <TableCell className="font-mono font-medium">{t.numero}</TableCell>
                      <TableCell>{renderItemLabel(t)}</TableCell>
                      <TableCell className="text-right font-semibold">{t.quantidade} {t.kit_id ? "kit(s)" : (t.produto?.unidade || "un")}</TableCell>
                      <TableCell>{renderLocationBadge(t.filial_origem, "origem")}</TableCell>
                      <TableCell>{renderLocationBadge(t.filial_destino, "destino")}</TableCell>
                      <TableCell>{formatDate(t.data_transferencia)}</TableCell>
                      <TableCell><Badge variant="outline" className={si.className}><SIcon className="h-3 w-3 mr-1" />{si.label}</Badge></TableCell>
                      <TableCell className="text-right"><div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => { setTransDetalhes(t); setDialogDetalhesAberto(true); }} title="Detalhes"><Eye className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleVerHistorico(t)} title="Histórico"><History className="h-4 w-4" /></Button>
                        {t.status === "pendente" && (<Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white h-8" onClick={() => handleEnviarTransferencia(t)} disabled={processandoId === t.id} title="Enviar">{processandoId === t.id ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <Truck className="h-4 w-4" />}</Button>)}
                        {t.status === "em_transito" && (<Button size="sm" className="bg-green-600 hover:bg-green-700 text-white h-8" onClick={() => handleConcluirTransferencia(t)} disabled={processandoId === t.id} title="Concluir">{processandoId === t.id ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <CheckCircle className="h-4 w-4" />}</Button>)}
                        {(t.status === "pendente" || t.status === "em_transito") && (<Button size="sm" variant="outline" className="border-red-500 text-red-600 hover:bg-red-50 h-8 w-8 p-0" onClick={() => { setTransParaCancelar(t); setDialogCancelarAberto(true); }} disabled={processandoId === t.id} title="Cancelar"><XCircle className="h-4 w-4" /></Button>)}
                      </div></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent></Card>

      {/* DIALOG NOVA */}
      <Dialog open={dialogNovaAberto} onOpenChange={setDialogNovaAberto}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ArrowLeftRight className="h-5 w-5 text-primary" />Nova Transferência</DialogTitle><DialogDescription>Transfira estoque entre a Matriz e as filiais.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Origem *</Label><Select value={filialOrigem} onValueChange={(v) => { setFilialOrigem(v); if (v === filialDestino) setFilialDestino(""); }}><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{locs.map((l) => <SelectItem key={l.id} value={l.id}>{l.id === MATRIZ_ID ? "Matriz" : l.nome}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Destino *</Label><Select value={filialDestino} onValueChange={setFilialDestino}><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{locs.filter((l) => l.id !== filialOrigem).map((l) => <SelectItem key={l.id} value={l.id}>{l.id === MATRIZ_ID ? "Matriz" : l.nome}</SelectItem>)}</SelectContent></Select></div>
            </div>
            {filialOrigem && filialDestino && (<div className="flex items-center gap-2 p-2 bg-primary/5 rounded-lg border border-primary/20 text-sm"><span className="font-medium">{filialOrigem === MATRIZ_ID ? "Matriz" : filiais.find(f => f.id === filialOrigem)?.nome}</span><ArrowLeftRight className="h-4 w-4 text-primary" /><span className="font-medium text-primary">{filialDestino === MATRIZ_ID ? "Matriz" : filiais.find(f => f.id === filialDestino)?.nome}</span></div>)}

            {/* Tipo de item: Produto ou Kit */}
            <div className="space-y-2">
              <Label>Tipo de Item *</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={tipoItem === "produto" ? "default" : "outline"}
                  onClick={() => { setTipoItem("produto"); setKitSel(""); }}
                  className="flex items-center gap-2"
                >
                  <Package className="h-4 w-4" />
                  Produto
                </Button>
                <Button
                  type="button"
                  variant={tipoItem === "kit" ? "default" : "outline"}
                  onClick={() => { setTipoItem("kit"); setProdutoSel(""); }}
                  className="flex items-center gap-2"
                >
                  <Layers className="h-4 w-4" />
                  Kit Montado
                </Button>
              </div>
            </div>

            {tipoItem === "produto" ? (
              <div className="space-y-2">
                <Label>Produto *</Label>
                <Select value={produtoSel} onValueChange={setProdutoSel}><SelectTrigger><SelectValue placeholder="Selecione o produto..." /></SelectTrigger><SelectContent className="max-h-[300px]">{produtos.map((p) => <SelectItem key={p.id} value={p.id}>{p.codigo} - {p.nome} (Est: {p.estoque})</SelectItem>)}</SelectContent></Select>
                <p className="text-xs text-muted-foreground">O estoque mostrado é da Matriz. O estoque da origem será verificado ao enviar.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Kit Montado *</Label>
                <Select value={kitSel} onValueChange={setKitSel}><SelectTrigger><SelectValue placeholder="Selecione o kit..." /></SelectTrigger><SelectContent className="max-h-[300px]">{kits.map((k) => <SelectItem key={k.id} value={k.id}>{k.codigo} - {k.nome}</SelectItem>)}</SelectContent></Select>
                <p className="text-xs text-muted-foreground">Ao transferir um kit, todos os componentes do kit serão movidos do estoque da origem para o destino.</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Quantidade *{tipoItem === "kit" ? " (kits)" : ""}</Label><Input type="number" min={1} value={quantidade} onChange={(e) => setQuantidade(parseInt(e.target.value) || 0)} /></div><div className="space-y-2"><Label>Data</Label><Input type="date" value={dataTransferencia} onChange={(e) => setDataTransferencia(e.target.value)} /></div></div>
            <div className="space-y-2"><Label>Observações</Label><Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Opcional..." rows={2} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogNovaAberto(false)}>Cancelar</Button><Button onClick={handleCriarTransferencia} disabled={processandoId === "nova"} className="bg-primary">{processandoId === "nova" ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div> : <Plus className="h-4 w-4 mr-2" />}Criar Transferência</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={dialogCancelarAberto} onOpenChange={setDialogCancelarAberto}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Cancelar Transferência {transParaCancelar?.numero}</AlertDialogTitle><AlertDialogDescription>{transParaCancelar?.status === "em_transito" ? "O estoque será devolvido à origem. Esta ação não pode ser desfeita." : "A transferência será cancelada. Esta ação não pode ser desfeita."}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Voltar</AlertDialogCancel><AlertDialogAction onClick={handleCancelarTransferencia} className="bg-red-600 hover:bg-red-700 text-white" disabled={processandoId !== null}>{processandoId ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div> : null}Sim, Cancelar</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={dialogHistoricoAberto} onOpenChange={setDialogHistoricoAberto}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><History className="h-5 w-5 text-primary" />Histórico - {transHistorico?.numero}</DialogTitle><DialogDescription>{transHistorico?.kit_id ? (transHistorico?.kit?.nome || "Kit") : (transHistorico?.produto?.nome || "-")} - {transHistorico?.quantidade} {transHistorico?.kit_id ? "kit(s)" : (transHistorico?.produto?.unidade || "un")}</DialogDescription></DialogHeader>
          <div className="space-y-3 py-4">{historico.length === 0 ? <p className="text-center text-muted-foreground py-4">Nenhum histórico.</p> : historico.map((item) => (<div key={item.id} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30"><div className="flex-1"><span className="text-sm font-medium">{item.status_anterior || "Criada"} → {item.status_novo}</span>{item.observacoes && <p className="text-xs text-muted-foreground mt-1">{item.observacoes}</p>}<p className="text-xs text-muted-foreground mt-1">{formatDate(item.created_at)}</p></div></div>))}</div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogHistoricoAberto(false)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogDetalhesAberto} onOpenChange={setDialogDetalhesAberto}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Eye className="h-5 w-5 text-primary" />Detalhes - {transDetalhes?.numero}</DialogTitle></DialogHeader>
          {transDetalhes && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{transDetalhes.kit_id ? "Kit" : "Produto"}</p>
                  {transDetalhes.kit_id ? (
                    <div><p className="font-medium flex items-center gap-1"><Layers className="h-4 w-4 text-purple-500" />{transDetalhes.kit?.nome || "-"}</p><p className="text-xs text-muted-foreground">{transDetalhes.kit?.codigo}</p></div>
                  ) : (
                    <div><p className="font-medium">{transDetalhes.produto?.nome || "-"}</p><p className="text-xs text-muted-foreground">{transDetalhes.produto?.codigo}</p></div>
                  )}
                </div>
                <div><p className="text-sm text-muted-foreground">Quantidade</p><p className="font-medium">{transDetalhes.quantidade} {transDetalhes.kit_id ? "kit(s)" : (transDetalhes.produto?.unidade || "un")}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-4"><div><p className="text-sm text-muted-foreground">Origem</p>{renderLocationBadge(transDetalhes.filial_origem, "origem")}</div><div><p className="text-sm text-muted-foreground">Destino</p>{renderLocationBadge(transDetalhes.filial_destino, "destino")}</div></div>
              <div className="grid grid-cols-2 gap-4"><div><p className="text-sm text-muted-foreground">Data</p><p className="font-medium">{formatDate(transDetalhes.data_transferencia)}</p></div><div><p className="text-sm text-muted-foreground">Status</p>{(() => { const si = getStatusInfo(transDetalhes.status); const SIcon = si.icon; return <Badge variant="outline" className={si.className}><SIcon className="h-3 w-3 mr-1" />{si.label}</Badge>; })()}</div></div>
              {transDetalhes.observacoes && <div><p className="text-sm text-muted-foreground">Observações</p><p className="text-sm bg-muted/50 p-3 rounded">{transDetalhes.observacoes}</p></div>}
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setDialogDetalhesAberto(false)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
