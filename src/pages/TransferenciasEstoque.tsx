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
import { ArrowLeftRight, Plus, Search, RefreshCw, Package, CircleCheck as CheckCircle, Circle as XCircle, Clock, Truck, Eye, History, Building2, Layers, Printer, X, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { gerarPDFTransferencia, downloadPDF } from "@/utils/pdfGenerator";
import { expandirKitProdutos } from "@/lib/orcamentoEstoque";

interface Filial { id: string; nome: string; codigo: string; }
interface Produto { id: string; codigo: string; nome: string; estoque: number; unidade: string; }
interface Kit { id: string; codigo: string; nome: string; }
interface TransferenciaItemRow {
  id: string;
  produto_id: string | null;
  kit_id: string | null;
  quantidade: number;
  produto?: Produto;
  kit?: Kit;
}
interface Transferencia {
  id: string; numero: string; filial_origem_id: string | null; filial_destino_id: string | null;
  data_transferencia: string;
  status: string; observacoes: string | null; transportadora: string | null; created_at: string;
  filial_origem?: Filial; filial_destino?: Filial; itens: TransferenciaItemRow[];
}
interface HistoricoItem { id: string; status_anterior: string | null; status_novo: string; observacoes: string | null; created_at: string; }
interface ItemNovaTransferencia { tipo: "produto" | "kit"; id: string; codigo: string; nome: string; unidade: string; quantidade: number; }

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

// Some transferencias_estoque_itens rows got saved duplicated in the past
// (mesmo produto/kit gravado em 2-3 linhas identicas, com a MESMA quantidade
// cada, por causa de uma race condition de salvamento ja corrigida). Cada
// linha duplicada e' uma copia acidental da mesma adicao (a UI ja impede
// adicionar o mesmo produto/kit duas vezes de proposito com quantidades
// diferentes) - por isso a correcao e' descartar as copias extras e manter so
// a primeira ocorrencia, nunca somar as quantidades. Somar inflaria a
// quantidade real pretendida pelo usuario (2-3x maior) e faria o sistema
// continuar acusando "estoque insuficiente" mesmo com saldo real disponivel.
const dedupeTransferenciaItens = (itens: TransferenciaItemRow[]): TransferenciaItemRow[] => {
  const result: TransferenciaItemRow[] = [];
  for (const item of itens) {
    const jaExiste = result.some((i) => (i.kit_id || null) === (item.kit_id || null) && (i.produto_id || null) === (item.produto_id || null));
    if (!jaExiste) result.push({ ...item });
  }
  return result;
};

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
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [filialOrigem, setFilialOrigem] = useState("");
  const [filialDestino, setFilialDestino] = useState("");
  const [tipoItemAtual, setTipoItemAtual] = useState<"produto" | "kit">("produto");
  const [produtoAtual, setProdutoAtual] = useState("");
  const [kitAtual, setKitAtual] = useState("");
  const [quantidadeAtual, setQuantidadeAtual] = useState(1);
  const [itensNovos, setItensNovos] = useState<ItemNovaTransferencia[]>([]);
  const [dataTransferencia, setDataTransferencia] = useState(new Date().toISOString().split("T")[0]);
  const [observacoes, setObservacoes] = useState("");
  const [transportadora, setTransportadora] = useState("");

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
        supabase.from("transferencias_estoque").select(`*, filial_origem:filiais!transferencias_estoque_filial_origem_id_fkey(id, nome, codigo), filial_destino:filiais!transferencias_estoque_filial_destino_id_fkey(id, nome, codigo), itens:transferencias_estoque_itens(id, produto_id, kit_id, quantidade, produto:produtos(id, codigo, nome, estoque, unidade), kit:kits(id, codigo, nome))`).order("created_at", { ascending: false }),
      ]);
      if (fe) throw fe; if (pe) throw pe; if (ke) throw ke; if (te) throw te;
      setFiliais(f || []); setProdutos(p || []); setKits(k || []); setTransferencias((t || []).map((row: any) => ({ ...row, itens: dedupeTransferenciaItens(row.itens || []) })));
    } catch (error: any) {
      toast({ title: "Erro ao carregar dados", description: error.message, variant: "destructive" });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { carregarDados(); }, [carregarDados]);

  const transFiltradas = transferencias.filter((t) => {
    const nomesItens = (t.itens || []).map((i) => i.produto?.nome || i.kit?.nome || "").join(" ");
    const matchSearch = t.numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
      nomesItens.toLowerCase().includes(searchTerm.toLowerCase()) ||
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

  // Expande o kit em produtos, incluindo sub-kits (ex.: CAIXA BASICA dentro do
  // KIT SEM ROLDANAS). Retorna [produto_id, quantidade total] ja somados.
  const expandirKit = async (kitId: string, qtdKits: number): Promise<[string, number][]> => {
    const produtosKit = Object.entries(await expandirKitProdutos(kitId, qtdKits));
    if (produtosKit.length === 0) throw new Error("Não foi possível carregar os itens do kit");
    return produtosKit;
  };

  const debitarEstoqueKit = async (filialId: string | null, kitId: string, qtdKits: number) => {
    for (const [produtoId, qtd] of await expandirKit(kitId, qtdKits)) {
      await debitarEstoque(filialId, produtoId, qtd);
    }
  };

  const creditarEstoqueKit = async (filialId: string | null, kitId: string, qtdKits: number) => {
    for (const [produtoId, qtd] of await expandirKit(kitId, qtdKits)) {
      await creditarEstoque(filialId, produtoId, qtd);
    }
  };

  const verificarEstoqueKit = async (filialId: string | null, kitId: string, qtdKits: number): Promise<{ ok: boolean; faltando: string[] }> => {
    const faltando: string[] = [];
    for (const [produtoId, necessario] of await expandirKit(kitId, qtdKits)) {
      const estoque = await getEstoqueLocal(filialId, produtoId);
      if (estoque < necessario) {
        const nome = produtos.find((p) => p.id === produtoId)?.nome || produtoId;
        faltando.push(`${nome}: ${estoque} disponível, ${necessario} necessário`);
      }
    }
    return { ok: faltando.length === 0, faltando };
  };

  const handleAdicionarItemNovo = () => {
    if (tipoItemAtual === "produto") {
      if (!produtoAtual) { toast({ title: "Selecione um produto", variant: "destructive" }); return; }
      const p = produtos.find((x) => x.id === produtoAtual);
      if (!p) return;
      setItensNovos((prev) => {
        if (prev.some((i) => i.tipo === "produto" && i.id === p.id)) {
          toast({ title: "Esse produto já foi adicionado", variant: "destructive" });
          return prev;
        }
        return [...prev, { tipo: "produto", id: p.id, codigo: p.codigo, nome: p.nome, unidade: p.unidade || "un", quantidade: quantidadeAtual }];
      });
      setProdutoAtual("");
    } else {
      if (!kitAtual) { toast({ title: "Selecione um kit", variant: "destructive" }); return; }
      const k = kits.find((x) => x.id === kitAtual);
      if (!k) return;
      setItensNovos((prev) => {
        if (prev.some((i) => i.tipo === "kit" && i.id === k.id)) {
          toast({ title: "Esse kit já foi adicionado", variant: "destructive" });
          return prev;
        }
        return [...prev, { tipo: "kit", id: k.id, codigo: k.codigo, nome: k.nome, unidade: "kit(s)", quantidade: quantidadeAtual }];
      });
      setKitAtual("");
    }
    setQuantidadeAtual(1);
  };

  // Remove por tipo+id (nao por indice) porque indice capturado no closure do
  // onClick podia ficar desatualizado em cliques rapidos (remover/adicionar em
  // sequencia), fazendo o item errado sumir ou um item removido "reaparecer"
  // quando dois setState concorrentes partiam do mesmo estado antigo.
  const handleRemoverItemNovo = (tipo: "produto" | "kit", id: string) =>
    setItensNovos((prev) => prev.filter((i) => !(i.tipo === tipo && i.id === id)));

  // Editar a quantidade de um item ja adicionado direto na lista (mesma logica
  // por tipo+id do remover, para nao depender de indice em closure).
  const handleAlterarQuantidadeItemNovo = (tipo: "produto" | "kit", id: string, quantidade: number) =>
    setItensNovos((prev) => prev.map((i) => (i.tipo === tipo && i.id === id ? { ...i, quantidade } : i)));

  const resetFormNovaTransferencia = () => {
    setEditandoId(null);
    setFilialOrigem(""); setFilialDestino(""); setItensNovos([]);
    setTipoItemAtual("produto"); setProdutoAtual(""); setKitAtual(""); setQuantidadeAtual(1);
    setDataTransferencia(new Date().toISOString().split("T")[0]); setObservacoes(""); setTransportadora("");
  };

  const handleAbrirEdicao = (trans: Transferencia) => {
    setEditandoId(trans.id);
    setFilialOrigem(trans.filial_origem_id ?? MATRIZ_ID);
    setFilialDestino(trans.filial_destino_id ?? MATRIZ_ID);

    const itensMapeados = trans.itens.map((item) => ({
      tipo: (item.kit_id ? "kit" : "produto") as "produto" | "kit",
      id: item.kit_id ? item.kit_id : item.produto_id!,
      codigo: item.kit_id ? (item.kit?.codigo || "-") : (item.produto?.codigo || "-"),
      nome: item.kit_id ? (item.kit?.nome || "-") : (item.produto?.nome || "-"),
      unidade: item.kit_id ? "kit(s)" : (item.produto?.unidade || "un"),
      quantidade: item.quantidade,
    }));
    // Defesa contra linhas duplicadas que possam ter ficado no banco (mesmo
    // tipo+id gravado em mais de uma linha) - sem isso, duas linhas com a
    // mesma chave "tipo-id" quebram a lista (o React nao consegue distinguir
    // qual é qual) e remover uma tira as duas ou a errada. Mantem so a
    // primeira ocorrencia (nao soma): cada linha duplicada e' copia acidental
    // da mesma adicao, entao somar inflaria a quantidade real pretendida.
    const itensSemDuplicata: typeof itensMapeados = [];
    for (const item of itensMapeados) {
      const jaExiste = itensSemDuplicata.some((i) => i.tipo === item.tipo && i.id === item.id);
      if (!jaExiste) itensSemDuplicata.push({ ...item });
    }
    setItensNovos(itensSemDuplicata);
    setDataTransferencia(trans.data_transferencia.split("T")[0]);
    setObservacoes(trans.observacoes || "");
    setTransportadora(trans.transportadora || "");
    setDialogNovaAberto(true);
  };

  const handleSalvarTransferencia = async () => {
    // Guarda contra clique duplo: o botao ja desabilita via processandoId, mas
    // dois cliques bem proximos podem disparar essa funcao duas vezes antes do
    // React aplicar o novo estado - isso ja causou itens duplicados no banco
    // (edicao salva 2x seguidas apaga e reinsere os itens 2x, concorrentemente).
    if (processandoId) return;
    if (!filialOrigem || !filialDestino) { toast({ title: "Selecione a origem e o destino", variant: "destructive" }); return; }
    if (filialOrigem === filialDestino) { toast({ title: "Origem e destino devem ser diferentes", variant: "destructive" }); return; }
    if (itensNovos.length === 0) { toast({ title: "Adicione ao menos um item à transferência", variant: "destructive" }); return; }
    if (itensNovos.some((i) => !i.quantidade || i.quantidade < 1)) { toast({ title: "Todos os itens devem ter quantidade maior que zero", variant: "destructive" }); return; }
    try {
      setProcessandoId("nova");
      const dbOrigem = toDbFilialId(filialOrigem);
      const dbDestino = toDbFilialId(filialDestino);

      for (const item of itensNovos) {
        if (item.tipo === "produto") {
          const estoqueOrigem = await getEstoqueLocal(dbOrigem, item.id);
          if (estoqueOrigem < item.quantidade) {
            toast({ title: `Estoque insuficiente na origem: ${item.nome}`, description: `Disponível: ${estoqueOrigem}`, variant: "destructive" });
            return;
          }
        } else {
          const verificacao = await verificarEstoqueKit(dbOrigem, item.id, item.quantidade);
          if (!verificacao.ok) {
            toast({ title: `Estoque insuficiente na origem para o kit ${item.nome}`, description: verificacao.faltando.join("; "), variant: "destructive" });
            return;
          }
        }
      }

      if (editandoId) {
        const { error: updateError } = await supabase.from("transferencias_estoque").update({
          filial_origem_id: dbOrigem, filial_destino_id: dbDestino,
          data_transferencia: dataTransferencia,
          observacoes: observacoes || null, transportadora: transportadora || null,
          updated_at: new Date().toISOString(),
        }).eq("id", editandoId);
        if (updateError) throw updateError;

        const { error: deleteError } = await supabase.from("transferencias_estoque_itens").delete().eq("transferencia_id", editandoId);
        if (deleteError) throw deleteError;

        const { error: itensError } = await supabase.from("transferencias_estoque_itens").insert(
          itensNovos.map((item) => ({
            transferencia_id: editandoId,
            produto_id: item.tipo === "produto" ? item.id : null,
            kit_id: item.tipo === "kit" ? item.id : null,
            quantidade: item.quantidade,
          }))
        );
        if (itensError) throw itensError;

        await supabase.from("transferencias_estoque_historico").insert({
          transferencia_id: editandoId, status_anterior: "pendente", status_novo: "pendente",
          observacoes: `Transferência editada - ${itensNovos.length} ${itensNovos.length === 1 ? "item" : "itens"}`, usuario_id: user?.id,
        });

        toast({ title: "Transferência atualizada!" });
      } else {
        const { data: numero, error: numError } = await supabase.rpc("gerar_numero_transferencia");
        if (numError) throw numError;

        const { data: transInsert, error: transError } = await supabase.from("transferencias_estoque").insert({
          numero, filial_origem_id: dbOrigem, filial_destino_id: dbDestino,
          data_transferencia: dataTransferencia, status: "pendente",
          observacoes: observacoes || null, transportadora: transportadora || null, created_by: user?.id,
        }).select().single();
        if (transError) throw transError;

        const { error: itensError } = await supabase.from("transferencias_estoque_itens").insert(
          itensNovos.map((item) => ({
            transferencia_id: transInsert.id,
            produto_id: item.tipo === "produto" ? item.id : null,
            kit_id: item.tipo === "kit" ? item.id : null,
            quantidade: item.quantidade,
          }))
        );
        if (itensError) throw itensError;

        await supabase.from("transferencias_estoque_historico").insert({
          transferencia_id: transInsert.id, status_anterior: null, status_novo: "pendente",
          observacoes: `Transferência criada com ${itensNovos.length} ${itensNovos.length === 1 ? "item" : "itens"}`, usuario_id: user?.id,
        });

        const nomeOrigem = filialOrigem === MATRIZ_ID ? "Matriz" : filiais.find(f => f.id === filialOrigem)?.nome;
        const nomeDestino = filialDestino === MATRIZ_ID ? "Matriz" : filiais.find(f => f.id === filialDestino)?.nome;
        toast({ title: "Transferência criada!", description: `${numero} - ${nomeOrigem} → ${nomeDestino}.` });
      }

      resetFormNovaTransferencia();
      setDialogNovaAberto(false);
      await carregarDados();
    } catch (error: any) {
      toast({ title: editandoId ? "Erro ao salvar transferência" : "Erro ao criar transferência", description: error.message, variant: "destructive" });
    } finally { setProcessandoId(null); }
  };

  const handleEnviarTransferencia = async (trans: Transferencia) => {
    try {
      setProcessandoId(trans.id);
      for (const item of trans.itens) {
        if (item.kit_id) await debitarEstoqueKit(trans.filial_origem_id, item.kit_id, item.quantidade);
        else if (item.produto_id) await debitarEstoque(trans.filial_origem_id, item.produto_id, item.quantidade);
      }
      await supabase.from("transferencias_estoque").update({ status: "em_transito", updated_at: new Date().toISOString() }).eq("id", trans.id);
      await supabase.from("transferencias_estoque_historico").insert({
        transferencia_id: trans.id, status_anterior: "pendente", status_novo: "em_transito",
        observacoes: `${trans.itens.length} ${trans.itens.length === 1 ? "item enviado" : "itens enviados"} de ${getLocationName(trans.filial_origem)}`, usuario_id: user?.id,
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
      for (const item of trans.itens) {
        if (item.kit_id) await creditarEstoqueKit(trans.filial_destino_id, item.kit_id, item.quantidade);
        else if (item.produto_id) await creditarEstoque(trans.filial_destino_id, item.produto_id, item.quantidade);
      }
      await supabase.from("transferencias_estoque").update({ status: "concluida", updated_at: new Date().toISOString() }).eq("id", trans.id);
      await supabase.from("transferencias_estoque_historico").insert({
        transferencia_id: trans.id, status_anterior: "em_transito", status_novo: "concluida",
        observacoes: `${trans.itens.length} ${trans.itens.length === 1 ? "item recebido" : "itens recebidos"} em ${getLocationName(trans.filial_destino)}`, usuario_id: user?.id,
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
        for (const item of transParaCancelar.itens) {
          if (item.kit_id) await creditarEstoqueKit(transParaCancelar.filial_origem_id, item.kit_id, item.quantidade);
          else if (item.produto_id) await creditarEstoque(transParaCancelar.filial_origem_id, item.produto_id, item.quantidade);
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

  const handleImprimirTransferencia = async (trans: Transferencia) => {
    try {
      setProcessandoId(`print-${trans.id}`);
      const { data: config, error: configError } = await supabase.from("configuracoes").select("*").limit(1).single();
      if (configError) throw configError;

      const itensPdf: { codigo: string; nome: string; unidade: string; quantidade: number }[] = trans.itens.map((item) =>
        item.kit_id
          ? { codigo: item.kit?.codigo || "-", nome: item.kit?.nome || "-", unidade: "kit(s)", quantidade: item.quantidade }
          : { codigo: item.produto?.codigo || "-", nome: item.produto?.nome || "-", unidade: item.produto?.unidade || "un", quantidade: item.quantidade }
      );

      const pdfBlob = await gerarPDFTransferencia(
        {
          numero: trans.numero,
          data: formatDate(trans.data_transferencia),
          status: getStatusInfo(trans.status).label,
          origem: getLocationName(trans.filial_origem),
          destino: getLocationName(trans.filial_destino),
          transportadora: trans.transportadora,
          observacoes: trans.observacoes,
          itens: itensPdf,
        },
        config
      );
      downloadPDF(pdfBlob, `transferencia_${trans.numero}.pdf`);
    } catch (error: any) {
      toast({ title: "Erro ao gerar documento", description: error.message, variant: "destructive" });
    } finally {
      setProcessandoId(null);
    }
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
    const itens = t.itens || [];
    if (itens.length === 0) return <span className="text-sm text-muted-foreground">-</span>;
    const primeiro = itens[0];
    const isKit = !!primeiro.kit_id;
    const nome = isKit ? (primeiro.kit?.nome || "Kit não encontrado") : (primeiro.produto?.nome || "-");
    const codigo = isKit ? primeiro.kit?.codigo : primeiro.produto?.codigo;
    return (
      <div className="flex flex-col">
        <span className="font-medium flex items-center gap-1">
          {isKit && <Layers className="h-3 w-3 text-purple-500" />}
          {nome}
        </span>
        <span className="text-xs text-muted-foreground">
          {codigo || "-"}{itens.length > 1 && ` · +${itens.length - 1} ${itens.length - 1 === 1 ? "item" : "itens"}`}
        </span>
      </div>
    );
  };

  const locs = [{ id: MATRIZ_ID, nome: "Matriz" }, ...filiais.map(f => ({ id: f.id, nome: f.nome }))];

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-3"><ArrowLeftRight className="h-7 w-7 sm:h-8 sm:w-8 text-primary shrink-0" /> Transferências de Estoque</h1>
          <p className="text-muted-foreground mt-1">Transfira produtos e kits entre a Matriz e as filiais com rastreabilidade completa</p>
        </div>
        <Button onClick={() => setDialogNovaAberto(true)} className="bg-primary hover:bg-primary/90 w-full sm:w-auto"><Plus className="mr-2 h-4 w-4" /> Nova Transferência</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-card to-yellow-50/30 hover:shadow-xl transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-500/5 rounded-full blur-2xl" />
          <CardContent className="pt-6 relative z-10"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-muted-foreground">Pendentes</p><p className="text-2xl font-bold text-yellow-600">{totalPendentes}</p></div><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-400 to-amber-500 shadow-lg"><Clock className="h-6 w-6 text-white" /></div></div></CardContent>
        </Card>
        <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-card to-blue-50/30 hover:shadow-xl transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl" />
          <CardContent className="pt-6 relative z-10"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-muted-foreground">Em Trânsito</p><p className="text-2xl font-bold text-blue-600">{totalEmTransito}</p></div><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 shadow-lg"><Truck className="h-6 w-6 text-white" /></div></div></CardContent>
        </Card>
        <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-card to-green-50/30 hover:shadow-xl transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/5 rounded-full blur-2xl" />
          <CardContent className="pt-6 relative z-10"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-muted-foreground">Concluídas</p><p className="text-2xl font-bold text-green-600">{totalConcluidas}</p></div><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-success shadow-lg"><CheckCircle className="h-6 w-6 text-white" /></div></div></CardContent>
        </Card>
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
                <TableHead className="font-bold text-right">Itens</TableHead><TableHead className="font-bold">Origem</TableHead>
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
                      <TableCell className="text-right font-semibold">{t.itens.length}</TableCell>
                      <TableCell>{renderLocationBadge(t.filial_origem, "origem")}</TableCell>
                      <TableCell>{renderLocationBadge(t.filial_destino, "destino")}</TableCell>
                      <TableCell>{formatDate(t.data_transferencia)}</TableCell>
                      <TableCell><Badge variant="outline" className={si.className}><SIcon className="h-3 w-3 mr-1" />{si.label}</Badge></TableCell>
                      <TableCell className="text-right"><div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => { setTransDetalhes(t); setDialogDetalhesAberto(true); }} title="Detalhes"><Eye className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleVerHistorico(t)} title="Histórico"><History className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleImprimirTransferencia(t)} disabled={processandoId === `print-${t.id}`} title="Imprimir documento para transportadora">{processandoId === `print-${t.id}` ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div> : <Printer className="h-4 w-4" />}</Button>
                        {t.status === "pendente" && (<Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleAbrirEdicao(t)} disabled={processandoId === t.id} title="Editar"><Pencil className="h-4 w-4" /></Button>)}
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
      <Dialog open={dialogNovaAberto} onOpenChange={(open) => { setDialogNovaAberto(open); if (!open) resetFormNovaTransferencia(); }}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><ArrowLeftRight className="h-5 w-5 text-primary" />{editandoId ? "Editar Transferência" : "Nova Transferência"}</DialogTitle><DialogDescription>{editandoId ? "Altere os itens, origem/destino ou dados da transferência ainda pendente." : "Transfira um ou mais produtos/kits entre a Matriz e as filiais."}</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Origem *</Label><Select value={filialOrigem} onValueChange={(v) => { setFilialOrigem(v); if (v === filialDestino) setFilialDestino(""); }}><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{locs.map((l) => <SelectItem key={l.id} value={l.id}>{l.id === MATRIZ_ID ? "Matriz" : l.nome}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Destino *</Label><Select value={filialDestino} onValueChange={setFilialDestino}><SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger><SelectContent>{locs.filter((l) => l.id !== filialOrigem).map((l) => <SelectItem key={l.id} value={l.id}>{l.id === MATRIZ_ID ? "Matriz" : l.nome}</SelectItem>)}</SelectContent></Select></div>
            </div>
            {filialOrigem && filialDestino && (<div className="flex items-center gap-2 p-2 bg-primary/5 rounded-lg border border-primary/20 text-sm"><span className="font-medium">{filialOrigem === MATRIZ_ID ? "Matriz" : filiais.find(f => f.id === filialOrigem)?.nome}</span><ArrowLeftRight className="h-4 w-4 text-primary" /><span className="font-medium text-primary">{filialDestino === MATRIZ_ID ? "Matriz" : filiais.find(f => f.id === filialDestino)?.nome}</span></div>)}

            {/* Itens já adicionados */}
            {itensNovos.length > 0 && (
              <div className="space-y-2">
                <Label>Itens da Transferência ({itensNovos.length})</Label>
                <div className="border rounded-lg divide-y">
                  {itensNovos.map((item) => (
                    <div key={`${item.tipo}-${item.id}`} className="flex items-center justify-between p-2 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        {item.tipo === "kit" && <Layers className="h-3.5 w-3.5 text-purple-500 shrink-0" />}
                        <div className="min-w-0">
                          <p className="font-medium truncate">{item.nome}</p>
                          <p className="text-xs text-muted-foreground">{item.codigo}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Input
                          type="number"
                          min={1}
                          value={item.quantidade}
                          onChange={(e) => handleAlterarQuantidadeItemNovo(item.tipo, item.id, parseInt(e.target.value) || 0)}
                          className="h-8 w-20 text-right"
                        />
                        <span className="text-xs text-muted-foreground w-10">{item.unidade}</span>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleRemoverItemNovo(item.tipo, item.id)}><X className="h-4 w-4" /></Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Formulário de adicionar item */}
            <div className="space-y-3 border rounded-lg p-3 bg-muted/20">
              <Label className="text-sm">Adicionar Item</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" size="sm" variant={tipoItemAtual === "produto" ? "default" : "outline"} onClick={() => { setTipoItemAtual("produto"); setKitAtual(""); }} className="flex items-center gap-2">
                  <Package className="h-4 w-4" /> Produto
                </Button>
                <Button type="button" size="sm" variant={tipoItemAtual === "kit" ? "default" : "outline"} onClick={() => { setTipoItemAtual("kit"); setProdutoAtual(""); }} className="flex items-center gap-2">
                  <Layers className="h-4 w-4" /> Kit Montado
                </Button>
              </div>

              {tipoItemAtual === "produto" ? (
                <Select value={produtoAtual} onValueChange={setProdutoAtual}><SelectTrigger><SelectValue placeholder="Selecione o produto..." /></SelectTrigger><SelectContent className="max-h-[300px]">{produtos.map((p) => <SelectItem key={p.id} value={p.id}>{p.codigo} - {p.nome} (Est: {p.estoque})</SelectItem>)}</SelectContent></Select>
              ) : (
                <Select value={kitAtual} onValueChange={setKitAtual}><SelectTrigger><SelectValue placeholder="Selecione o kit..." /></SelectTrigger><SelectContent className="max-h-[300px]">{kits.map((k) => <SelectItem key={k.id} value={k.id}>{k.codigo} - {k.nome}</SelectItem>)}</SelectContent></Select>
              )}

              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Quantidade{tipoItemAtual === "kit" ? " (kits)" : ""}</Label>
                  <Input type="number" min={1} value={quantidadeAtual} onChange={(e) => setQuantidadeAtual(parseInt(e.target.value) || 0)} />
                </div>
                <Button type="button" onClick={handleAdicionarItemNovo}><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
              </div>
              <p className="text-xs text-muted-foreground">O estoque mostrado é da Matriz. O estoque da origem é verificado ao criar a transferência.</p>
            </div>

            <div className="grid grid-cols-2 gap-4"><div className="space-y-2"><Label>Data</Label><Input type="date" value={dataTransferencia} onChange={(e) => setDataTransferencia(e.target.value)} /></div><div className="space-y-2"><Label>Transportadora</Label><Input value={transportadora} onChange={(e) => setTransportadora(e.target.value)} placeholder="Opcional" /></div></div>
            <div className="space-y-2"><Label>Observações</Label><Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Opcional..." rows={2} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogNovaAberto(false)}>Cancelar</Button><Button onClick={handleSalvarTransferencia} disabled={processandoId === "nova"} className="bg-primary">{processandoId === "nova" ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div> : editandoId ? <Pencil className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}{editandoId ? "Salvar Alterações" : "Criar Transferência"}</Button></DialogFooter>
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
          <DialogHeader><DialogTitle className="flex items-center gap-2"><History className="h-5 w-5 text-primary" />Histórico - {transHistorico?.numero}</DialogTitle><DialogDescription>{transHistorico?.itens.length || 0} {transHistorico?.itens.length === 1 ? "item" : "itens"} nesta transferência</DialogDescription></DialogHeader>
          <div className="space-y-3 py-4">{historico.length === 0 ? <p className="text-center text-muted-foreground py-4">Nenhum histórico.</p> : historico.map((item) => (<div key={item.id} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30"><div className="flex-1"><span className="text-sm font-medium">{item.status_anterior || "Criada"} → {item.status_novo}</span>{item.observacoes && <p className="text-xs text-muted-foreground mt-1">{item.observacoes}</p>}<p className="text-xs text-muted-foreground mt-1">{formatDate(item.created_at)}</p></div></div>))}</div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogHistoricoAberto(false)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogDetalhesAberto} onOpenChange={setDialogDetalhesAberto}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Eye className="h-5 w-5 text-primary" />Detalhes - {transDetalhes?.numero}</DialogTitle></DialogHeader>
          {transDetalhes && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Itens ({transDetalhes.itens.length})</p>
                <div className="border rounded-lg divide-y">
                  {transDetalhes.itens.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-2 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        {item.kit_id && <Layers className="h-3.5 w-3.5 text-purple-500 shrink-0" />}
                        <div className="min-w-0">
                          <p className="font-medium truncate">{item.kit_id ? (item.kit?.nome || "-") : (item.produto?.nome || "-")}</p>
                          <p className="text-xs text-muted-foreground">{item.kit_id ? item.kit?.codigo : item.produto?.codigo}</p>
                        </div>
                      </div>
                      <span className="font-semibold shrink-0">{item.quantidade} {item.kit_id ? "kit(s)" : (item.produto?.unidade || "un")}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4"><div><p className="text-sm text-muted-foreground">Origem</p>{renderLocationBadge(transDetalhes.filial_origem, "origem")}</div><div><p className="text-sm text-muted-foreground">Destino</p>{renderLocationBadge(transDetalhes.filial_destino, "destino")}</div></div>
              <div className="grid grid-cols-2 gap-4"><div><p className="text-sm text-muted-foreground">Data</p><p className="font-medium">{formatDate(transDetalhes.data_transferencia)}</p></div><div><p className="text-sm text-muted-foreground">Status</p>{(() => { const si = getStatusInfo(transDetalhes.status); const SIcon = si.icon; return <Badge variant="outline" className={si.className}><SIcon className="h-3 w-3 mr-1" />{si.label}</Badge>; })()}</div></div>
              <div><p className="text-sm text-muted-foreground">Transportadora</p><p className="font-medium">{transDetalhes.transportadora || "-"}</p></div>
              {transDetalhes.observacoes && <div><p className="text-sm text-muted-foreground">Observações</p><p className="text-sm bg-muted/50 p-3 rounded">{transDetalhes.observacoes}</p></div>}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogDetalhesAberto(false)}>Fechar</Button>
            {transDetalhes && (
              <Button onClick={() => handleImprimirTransferencia(transDetalhes)} disabled={processandoId === `print-${transDetalhes.id}`}>
                {processandoId === `print-${transDetalhes.id}` ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div> : <Printer className="h-4 w-4 mr-2" />}
                Imprimir para transportadora
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
