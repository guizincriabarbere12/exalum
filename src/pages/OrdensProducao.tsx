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
import { PaintBucket, Plus, Search, RefreshCw, Package, ArrowLeftRight, CircleCheck as CheckCircle, Circle as XCircle, Clock, DollarSign, Eye, History, TrendingDown, TrendingUp, ArrowRight, Filter, Pencil, Printer, Trash2 } from "lucide-react";
import { gerarPDFOrdemProducao, downloadPDF } from "@/utils/pdfGenerator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

interface Produto {
  id: string; codigo: string; nome: string; descricao: string;
  estoque: number; unidade: string; custo: number | null; preco: number; cor: string | null;
  peso?: number | null; peso_kg_m?: number | null; comprimento_barra?: number | null;
}
interface ItemOp {
  id?: string;
  produto_id: string;
  produto_destino_id: string | null;
  quantidade: number;
  produto?: Produto;
  produto_destino?: Produto | null;
}
interface OrdemProducao {
  id: string; numero: string; produto_id: string; produto_destino_id: string | null;
  quantidade: number; data_saida: string; data_retorno: string | null;
  custo_pintura: number; status: string; observacoes: string | null; created_at: string;
  fornecedor_id: string | null; cor_destino: string | null;
  fornecedor?: Fornecedor | null;
  itens: ItemOp[];
}
interface Fornecedor { id: string; nome: string; }
interface HistoricoItem {
  id: string; status_anterior: string | null; status_novo: string;
  observacoes: string | null; created_at: string;
}

const CAMPOS_PRODUTO = "id, codigo, nome, descricao, estoque, unidade, custo, preco, cor, peso, peso_kg_m, comprimento_barra";

const formatCurrency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);
const formatDate = (d: string | null) => { if (!d) return "-"; const [a, m, di] = d.split("T")[0].split("-"); return `${di}/${m}/${a}`; };

const getStatusInfo = (s: string) => {
  switch (s) {
    case "em_pintura": return { label: "Em Pintura", className: "bg-amber-100 text-amber-800 border-amber-200", icon: Clock };
    case "retornado": return { label: "Retornado", className: "bg-green-100 text-green-800 border-green-200", icon: CheckCircle };
    case "cancelada": return { label: "Cancelada", className: "bg-red-100 text-red-800 border-red-200", icon: XCircle };
    default: return { label: s, className: "bg-gray-100 text-gray-800 border-gray-200", icon: Package };
  }
};

const formatKg = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg`;

// Peso de uma peca/barra: peso cadastrado ou kg/m x comprimento da barra.
const pesoUnitario = (p?: Produto | null) =>
  Number(p?.peso) || (Number(p?.peso_kg_m) || 0) * (Number(p?.comprimento_barra) || 6);

// Totais de uma lista de itens: peso (kg) e material (kg x custo por kg do
// produto de origem).
const totaisItens = (itens: ItemOp[]) => itens.reduce((acc, i) => {
  const kgUnit = pesoUnitario(i.produto);
  const kg = kgUnit * (Number(i.quantidade) || 0);
  const custoKg = kgUnit > 0 && i.produto?.custo != null ? Number(i.produto.custo) / kgUnit : 0;
  return {
    kg: acc.kg + kg,
    material: acc.material + custoKg * kg,
    qtd: acc.qtd + (Number(i.quantidade) || 0),
    semPeso: acc.semPeso || (kgUnit === 0),
  };
}, { kg: 0, material: 0, qtd: 0, semPeso: false });

// Mesmo perfil em outra cor: o codigo segue o padrao <perfil>.<cor>
// (ex.: TR.3001.NTA -> TR.3001.9007); se nao bater, tenta pelo nome.
const baseSemCor = (texto: string, cor: string | null) => {
  let t = (texto || "").toUpperCase();
  if (cor) t = t.replace(cor.toUpperCase(), "");
  return t.replace(/[.\s]+/g, " ").trim();
};
const baseCodigo = (codigo: string) => (codigo || "").toUpperCase().split(".").slice(0, -1).join(".");
const sugerirDestino = (origem: Produto | undefined, cor: string, produtos: Produto[]) => {
  if (!origem || !cor) return null;
  if (origem.cor === cor) return null;
  const naCor = produtos.filter((p) => p.cor === cor && p.id !== origem.id);
  const bc = baseCodigo(origem.codigo);
  return (bc && naCor.find((p) => baseCodigo(p.codigo) === bc))
    || naCor.find((p) => baseSemCor(p.nome, p.cor) === baseSemCor(origem.nome, origem.cor))
    || null;
};

const nomeComCor = (p?: Produto | null) => (p ? `${p.nome}${p.cor ? ` (${p.cor})` : ""}` : "-");

// Valor da OP calculado pelo KG: material = kg total x custo por kg de cada
// produto de origem; pintura = custo informado (cobrado por kg).
function ResumoValorOp({ itens, custoPintura }: { itens: ItemOp[]; custoPintura: number }) {
  const t = totaisItens(itens);
  const pintura = Number(custoPintura) || 0;
  return (
    <div className="border rounded-lg p-3 bg-primary/5 border-primary/20 space-y-1 text-sm">
      <div className="flex justify-between">
        <span className="text-muted-foreground">Peso total ({itens.length} {itens.length === 1 ? "item" : "itens"}, {t.qtd} peças)</span>
        <span className="font-medium">{formatKg(t.kg)}{t.semPeso ? " *" : ""}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">Material (kg × custo/kg de cada produto)</span>
        <span className="font-medium">{formatCurrency(t.material)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">
          Pintura{t.kg > 0 ? ` (${formatKg(t.kg)} × ${formatCurrency(pintura / t.kg)}/kg)` : ""}
        </span>
        <span className="font-medium">{formatCurrency(pintura)}</span>
      </div>
      <div className="flex justify-between border-t pt-1 mt-1">
        <span className="font-semibold">Valor da OP</span>
        <span className="font-bold text-primary text-base">{formatCurrency(t.material + pintura)}</span>
      </div>
      {t.semPeso && <p className="text-xs text-muted-foreground">* algum produto está sem peso cadastrado e não entra no peso/material.</p>}
    </div>
  );
}

function TabelaItensLeitura({ itens }: { itens: ItemOp[] }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader><TableRow>
          <TableHead>Produto enviado</TableHead>
          <TableHead>Pintar para</TableHead>
          <TableHead className="text-right">Qtd</TableHead>
          <TableHead className="text-right">Peso</TableHead>
        </TableRow></TableHeader>
        <TableBody>
          {itens.map((i, idx) => (
            <TableRow key={i.id || idx}>
              <TableCell className="text-sm">{nomeComCor(i.produto)}</TableCell>
              <TableCell className="text-sm text-primary">{i.produto_destino ? nomeComCor(i.produto_destino) : <span className="text-muted-foreground">Mesmo produto</span>}</TableCell>
              <TableCell className="text-right text-sm">{i.quantidade} {i.produto?.unidade || "un"}</TableCell>
              <TableCell className="text-right text-sm">{formatKg(pesoUnitario(i.produto) * (Number(i.quantidade) || 0))}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function OrdensProducao() {
  const { user } = useAuth();
  const [ordens, setOrdens] = useState<OrdemProducao[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroProduto, setFiltroProduto] = useState("todos");
  const [processandoId, setProcessandoId] = useState<string | null>(null);

  // Estados para busca de produtos
  const [buscaProduto, setBuscaProduto] = useState("");
  const [produtosFiltrados, setProdutosFiltrados] = useState<Produto[]>([]);

  // Nova OP
  const [dialogNovaOpAberto, setDialogNovaOpAberto] = useState(false);
  const [corDestino, setCorDestino] = useState("");
  const [novosItens, setNovosItens] = useState<ItemOp[]>([]);
  const [produtoParaAdicionar, setProdutoParaAdicionar] = useState("");
  const [quantidadeParaAdicionar, setQuantidadeParaAdicionar] = useState(1);
  const [custoPintura, setCustoPintura] = useState(0);
  const [precoKgPintura, setPrecoKgPintura] = useState(0);
  const [dataSaida, setDataSaida] = useState(new Date().toISOString().split("T")[0]);
  const [observacoes, setObservacoes] = useState("");
  const [fornecedorSelecionado, setFornecedorSelecionado] = useState("");

  const [dialogRetornoAberto, setDialogRetornoAberto] = useState(false);
  const [opParaRetornar, setOpParaRetornar] = useState<OrdemProducao | null>(null);
  const [dataRetorno, setDataRetorno] = useState(new Date().toISOString().split("T")[0]);

  const [dialogCancelarAberto, setDialogCancelarAberto] = useState(false);
  const [opParaCancelar, setOpParaCancelar] = useState<OrdemProducao | null>(null);

  const [dialogHistoricoAberto, setDialogHistoricoAberto] = useState(false);
  const [opHistorico, setOpHistorico] = useState<OrdemProducao | null>(null);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);

  const [dialogDetalhesAberto, setDialogDetalhesAberto] = useState(false);
  const [opDetalhes, setOpDetalhes] = useState<OrdemProducao | null>(null);

  const [dialogEditarAberto, setDialogEditarAberto] = useState(false);
  const [opEditando, setOpEditando] = useState<OrdemProducao | null>(null);
  const [editItens, setEditItens] = useState<ItemOp[]>([]);
  const [editDataSaida, setEditDataSaida] = useState("");
  const [editDataRetorno, setEditDataRetorno] = useState("");
  const [editCusto, setEditCusto] = useState(0);
  const [editPrecoKg, setEditPrecoKg] = useState(0);
  const [editObservacoes, setEditObservacoes] = useState("");
  const [editFornecedor, setEditFornecedor] = useState("");

  const carregarDados = useCallback(async () => {
    try {
      setLoading(true);
      const { data: produtosData, error: produtosError } = await supabase
        .from("produtos").select(CAMPOS_PRODUTO)
        .eq("ativo", true).order("nome");
      if (produtosError) throw produtosError;
      setProdutos(produtosData || []);
      setProdutosFiltrados(produtosData || []);

      const { data: fornecedoresData } = await supabase.from("fornecedores").select("id, nome").order("nome");
      setFornecedores(fornecedoresData || []);

      const { data: ordensData, error: ordensError } = await supabase
        .from("ordens_producao").select(`*,
          fornecedor:fornecedores!ordens_producao_fornecedor_id_fkey(id, nome),
          itens:ordens_producao_itens(id, produto_id, produto_destino_id, quantidade, created_at,
            produto:produtos!ordens_producao_itens_produto_id_fkey(${CAMPOS_PRODUTO}),
            produto_destino:produtos!ordens_producao_itens_produto_destino_id_fkey(${CAMPOS_PRODUTO}))`)
        .order("created_at", { ascending: false });
      if (ordensError) throw ordensError;
      setOrdens((ordensData || []).map((o) => ({
        ...o,
        itens: [...(o.itens || [])]
          .sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""))
          .map((i) => ({ ...i, quantidade: Number(i.quantidade) })),
      })));
    } catch (error: any) {
      toast({ title: "Erro ao carregar dados", description: error.message, variant: "destructive" });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { carregarDados(); }, [carregarDados]);

  // Filtrar produtos para exibição
  useEffect(() => {
    if (!buscaProduto.trim()) {
      setProdutosFiltrados(produtos);
    } else {
      const term = buscaProduto.toLowerCase().trim();
      const filtered = produtos.filter(p =>
        p.nome.toLowerCase().includes(term) ||
        p.codigo.toLowerCase().includes(term) ||
        (p.descricao && p.descricao.toLowerCase().includes(term)) ||
        (p.cor && p.cor.toLowerCase().includes(term))
      );
      setProdutosFiltrados(filtered);
    }
  }, [buscaProduto, produtos]);

  const cores = Array.from(new Set(produtos.map((p) => p.cor).filter(Boolean))).sort();

  const ordensFiltradas = ordens.filter((op) => {
    const termo = searchTerm.toLowerCase();
    const matchSearch = !termo ||
      op.numero.toLowerCase().includes(termo) ||
      (op.cor_destino || "").toLowerCase().includes(termo) ||
      (op.fornecedor?.nome || "").toLowerCase().includes(termo) ||
      op.itens.some((i) =>
        (i.produto?.nome || "").toLowerCase().includes(termo) ||
        (i.produto?.codigo || "").toLowerCase().includes(termo) ||
        (i.produto_destino?.nome || "").toLowerCase().includes(termo) ||
        (i.produto_destino?.codigo || "").toLowerCase().includes(termo));
    const matchStatus = filtroStatus === "todos" || op.status === filtroStatus;
    const matchProduto = filtroProduto === "todos" ||
      op.itens.some((i) => i.produto_id === filtroProduto || i.produto_destino_id === filtroProduto);
    return matchSearch && matchStatus && matchProduto;
  });

  const totalEmPintura = ordens.filter((o) => o.status === "em_pintura").length;
  const totalRetornados = ordens.filter((o) => o.status === "retornado").length;
  const custoTotalPintura = ordens.filter((o) => o.status !== "cancelada").reduce((acc, o) => acc + (Number(o.custo_pintura) || 0), 0);

  const registrarMovimentacao = (produtoId: string, tipo: "entrada" | "saida", quantidade: number, anterior: number, atual: number, obs: string) =>
    supabase.from("movimentacoes_estoque").insert({
      produto_id: produtoId, tipo, quantidade,
      quantidade_anterior: anterior, quantidade_atual: atual,
      origem: "ordem_producao", usuario_id: user?.id, observacoes: obs,
    });

  // Soma (ou subtrai) do estoque lendo o valor atual do banco na hora.
  const ajustarEstoque = async (produtoId: string, delta: number, obs: string) => {
    const { data: prod, error } = await supabase.from("produtos").select("estoque").eq("id", produtoId).single();
    if (error) throw error;
    const anterior = Number(prod?.estoque) || 0;
    const atual = anterior + delta;
    const { error: upError } = await supabase.from("produtos").update({ estoque: atual }).eq("id", produtoId);
    if (upError) throw upError;
    await registrarMovimentacao(produtoId, delta >= 0 ? "entrada" : "saida", Math.abs(delta), anterior, atual, obs);
  };

  // ========== NOVA OP ==========
  const resetNovaOp = () => {
    setCorDestino(""); setNovosItens([]); setProdutoParaAdicionar(""); setQuantidadeParaAdicionar(1);
    setFornecedorSelecionado(""); setCustoPintura(0); setPrecoKgPintura(0);
    setDataSaida(new Date().toISOString().split("T")[0]); setObservacoes(""); setBuscaProduto("");
  };

  const alterarCorDestino = (cor: string) => {
    setCorDestino(cor);
    // re-sugere o destino de cada item para a nova cor
    setNovosItens((itens) => itens.map((i) => {
      const destino = sugerirDestino(i.produto, cor, produtos);
      return { ...i, produto_destino_id: destino?.id || null, produto_destino: destino };
    }));
  };

  const adicionarItem = () => {
    const produto = produtos.find((p) => p.id === produtoParaAdicionar);
    if (!produto) { toast({ title: "Selecione um produto", variant: "destructive" }); return; }
    if (!(quantidadeParaAdicionar > 0)) { toast({ title: "Quantidade deve ser maior que zero", variant: "destructive" }); return; }
    const existente = novosItens.find((i) => i.produto_id === produto.id);
    if (existente) {
      setNovosItens((itens) => itens.map((i) => i.produto_id === produto.id ? { ...i, quantidade: i.quantidade + quantidadeParaAdicionar } : i));
    } else {
      const destino = sugerirDestino(produto, corDestino, produtos);
      setNovosItens((itens) => [...itens, { produto_id: produto.id, produto, quantidade: quantidadeParaAdicionar, produto_destino_id: destino?.id || null, produto_destino: destino }]);
    }
    setProdutoParaAdicionar(""); setQuantidadeParaAdicionar(1);
  };

  const alterarNovoItem = (idx: number, patch: Partial<ItemOp>) =>
    setNovosItens((itens) => itens.map((i, k) => (k === idx ? { ...i, ...patch } : i)));

  // Pintura cobrada por kg: o custo total da OP = kg total x R$/kg.
  const kgNovaOp = totaisItens(novosItens).kg;
  useEffect(() => {
    if (kgNovaOp > 0) setCustoPintura(Math.round(kgNovaOp * precoKgPintura * 100) / 100);
  }, [kgNovaOp, precoKgPintura]);

  const handleCriarOp = async () => {
    if (novosItens.length === 0) { toast({ title: "Adicione pelo menos um item", variant: "destructive" }); return; }
    if (novosItens.some((i) => !(i.quantidade > 0))) { toast({ title: "Todas as quantidades devem ser maiores que zero", variant: "destructive" }); return; }
    try {
      setProcessandoId("nova");
      // confere estoque com o valor atual do banco
      const ids = novosItens.map((i) => i.produto_id);
      const { data: estoques, error: estError } = await supabase.from("produtos").select("id, nome, estoque, unidade").in("id", ids);
      if (estError) throw estError;
      const faltando = novosItens.filter((i) => {
        const p = (estoques || []).find((e) => e.id === i.produto_id);
        return (Number(p?.estoque) || 0) < i.quantidade;
      });
      if (faltando.length) {
        toast({
          title: "Estoque insuficiente",
          description: faltando.map((i) => {
            const p = (estoques || []).find((e) => e.id === i.produto_id);
            return `${p?.nome}: tem ${p?.estoque}, precisa ${i.quantidade}`;
          }).join("; "),
          variant: "destructive",
        });
        return;
      }

      const { data: numeroOp, error: numeroError } = await supabase.rpc("gerar_numero_op");
      if (numeroError) throw numeroError;
      const primeiro = novosItens[0];
      const qtdTotal = novosItens.reduce((s, i) => s + i.quantidade, 0);

      const { data: opInsert, error: opError } = await supabase
        .from("ordens_producao").insert({
          numero: numeroOp, produto_id: primeiro.produto_id,
          produto_destino_id: primeiro.produto_destino_id || null,
          cor_destino: corDestino || null,
          fornecedor_id: fornecedorSelecionado || null,
          quantidade: qtdTotal, data_saida: dataSaida, custo_pintura: custoPintura,
          status: "em_pintura", observacoes: observacoes || null, created_by: user?.id,
        }).select().single();
      if (opError) throw opError;

      const { error: itensError } = await supabase.from("ordens_producao_itens").insert(
        novosItens.map((i) => ({ op_id: opInsert.id, produto_id: i.produto_id, produto_destino_id: i.produto_destino_id || null, quantidade: i.quantidade }))
      );
      if (itensError) throw itensError;

      for (const i of novosItens) {
        await ajustarEstoque(i.produto_id, -i.quantidade, `Saída para pintura - OP ${numeroOp}`);
      }

      await supabase.from("ordens_producao_historico").insert({
        op_id: opInsert.id, status_anterior: null, status_novo: "em_pintura",
        observacoes: `OP criada com ${novosItens.length} ${novosItens.length === 1 ? "item" : "itens"}${corDestino ? ` para a cor ${corDestino}` : ""}: ` +
          novosItens.map((i) => `${i.quantidade}x ${i.produto?.nome}${i.produto_destino ? ` → ${i.produto_destino.nome}` : ""}`).join("; "),
        usuario_id: user?.id,
      });

      if (custoPintura > 0) {
        const descricaoItens = novosItens.length === 1 ? primeiro.produto?.nome : `${novosItens.length} itens${corDestino ? ` - cor ${corDestino}` : ""}`;
        const { error: transError } = await supabase.from("transacoes_financeiras").insert({
          descricao: `Custo de Pintura - OP ${numeroOp} (${descricaoItens})`,
          tipo: "despesa", valor: custoPintura, data: dataSaida, status: "pendente",
          categoria: "Pintura", origem_tipo: "ordem_producao",
          observacoes: `OP ${numeroOp} - ` + novosItens.map((i) => `${i.quantidade} un de ${i.produto?.nome}`).join(", "),
          data_vencimento: dataSaida, created_by: user?.id,
        });
        if (transError) throw transError;
      }

      toast({ title: "OP criada com sucesso!", description: `OP ${numeroOp} - ${novosItens.length} ${novosItens.length === 1 ? "item enviado" : "itens enviados"} para pintura. Estoque debitado.` });
      resetNovaOp(); setDialogNovaOpAberto(false);
      await carregarDados();
    } catch (error: any) {
      toast({ title: "Erro ao criar OP", description: error.message, variant: "destructive" });
    } finally { setProcessandoId(null); }
  };

  // ========== RETORNO / CANCELAMENTO ==========
  const handleRetornarOp = async () => {
    const op = opParaRetornar;
    if (!op) return;
    try {
      setProcessandoId(op.id);
      for (const i of op.itens) {
        const destinoId = i.produto_destino_id || i.produto_id;
        await ajustarEstoque(destinoId, i.quantidade,
          i.produto_destino_id
            ? `Retorno da pintura com transformação - OP ${op.numero} (${i.produto?.nome} → ${i.produto_destino?.nome})`
            : `Retorno da pintura - OP ${op.numero}`);
      }

      const { error: opError } = await supabase.from("ordens_producao").update({
        status: "retornado", data_retorno: dataRetorno, updated_at: new Date().toISOString(),
      }).eq("id", op.id);
      if (opError) throw opError;

      await supabase.from("ordens_producao_historico").insert({
        op_id: op.id, status_anterior: "em_pintura", status_novo: "retornado",
        observacoes: "Retorno da pintura: " + op.itens.map((i) => `${i.quantidade}x ${(i.produto_destino || i.produto)?.nome}`).join("; "),
        usuario_id: user?.id,
      });

      toast({ title: "Produtos retornados com sucesso!", description: `OP ${op.numero} - ${op.itens.length} ${op.itens.length === 1 ? "item voltou" : "itens voltaram"} ao estoque.` });
      setDialogRetornoAberto(false); setOpParaRetornar(null);
      await carregarDados();
    } catch (error: any) {
      toast({ title: "Erro ao retornar OP", description: error.message, variant: "destructive" });
    } finally { setProcessandoId(null); }
  };

  const handleCancelarOp = async () => {
    const op = opParaCancelar;
    if (!op) return;
    try {
      setProcessandoId(op.id);
      if (op.status === "em_pintura") {
        for (const i of op.itens) {
          await ajustarEstoque(i.produto_id, i.quantidade, `Cancelamento da OP ${op.numero} - devolução ao estoque`);
        }
      }
      const { error: opError } = await supabase.from("ordens_producao").update({
        status: "cancelada", updated_at: new Date().toISOString(),
      }).eq("id", op.id);
      if (opError) throw opError;
      await supabase.from("ordens_producao_historico").insert({
        op_id: op.id, status_anterior: op.status, status_novo: "cancelada",
        observacoes: "OP cancelada", usuario_id: user?.id,
      });
      toast({ title: "OP cancelada", description: `OP ${op.numero} foi cancelada.` });
      setDialogCancelarAberto(false); setOpParaCancelar(null);
      await carregarDados();
    } catch (error: any) {
      toast({ title: "Erro ao cancelar OP", description: error.message, variant: "destructive" });
    } finally { setProcessandoId(null); }
  };

  // ========== EDIÇÃO ==========
  const abrirEdicao = (op: OrdemProducao) => {
    setOpEditando(op);
    setEditItens(op.itens.map((i) => ({ ...i })));
    setEditDataSaida((op.data_saida || "").split("T")[0]);
    setEditDataRetorno((op.data_retorno || "").split("T")[0]);
    setEditCusto(Number(op.custo_pintura) || 0);
    const kgOp = totaisItens(op.itens).kg;
    setEditPrecoKg(kgOp > 0 ? Math.round(((Number(op.custo_pintura) || 0) / kgOp) * 100) / 100 : 0);
    setEditObservacoes(op.observacoes || "");
    setEditFornecedor(op.fornecedor_id || "");
    setDialogEditarAberto(true);
  };

  // Na edicao so recalcula a pintura quando a pessoa mexe no R$/kg ou nas
  // quantidades - abrir o modal nao pode alterar o custo ja gravado.
  const recalcularCustoEdit = (itens: ItemOp[], precoKg: number) => {
    const kg = totaisItens(itens).kg;
    if (kg > 0) setEditCusto(Math.round(kg * precoKg * 100) / 100);
  };
  const alterarEditPrecoKg = (v: number) => { setEditPrecoKg(v); recalcularCustoEdit(editItens, v); };
  const alterarEditItem = (idx: number, patch: Partial<ItemOp>) => {
    const novos = editItens.map((i, k) => (k === idx ? { ...i, ...patch } : i));
    setEditItens(novos);
    if ("quantidade" in patch) recalcularCustoEdit(novos, editPrecoKg);
  };

  // Em pintura: quantidades e destinos editaveis (quantidade ajusta o estoque
  // da origem pela diferenca). Retornada: so datas, custo, fornecedor e
  // observacoes, pois o estoque do destino ja recebeu as quantidades.
  const handleSalvarEdicao = async () => {
    const op = opEditando;
    if (!op) return;
    const emPintura = op.status === "em_pintura";
    if (emPintura && editItens.some((i) => !(i.quantidade > 0))) { toast({ title: "Quantidades devem ser maiores que zero", variant: "destructive" }); return; }
    try {
      setProcessandoId(op.id);
      const alteracoes: string[] = [];

      if (emPintura) {
        // confere estoque para os aumentos antes de mexer em qualquer coisa
        for (const novo of editItens) {
          const antigo = op.itens.find((i) => i.id === novo.id);
          const diferenca = novo.quantidade - (antigo?.quantidade || 0);
          if (diferenca > 0) {
            const { data: prod } = await supabase.from("produtos").select("estoque, nome, unidade").eq("id", novo.produto_id).single();
            if ((Number(prod?.estoque) || 0) < diferenca) {
              toast({ title: "Estoque insuficiente", description: `${prod?.nome}: para aumentar ${diferenca} ${prod?.unidade || "un"} é preciso ter estoque. Atual: ${prod?.estoque}`, variant: "destructive" });
              return;
            }
          }
        }
        for (const novo of editItens) {
          const antigo = op.itens.find((i) => i.id === novo.id);
          if (!antigo) continue;
          const diferenca = novo.quantidade - antigo.quantidade;
          const destinoMudou = (novo.produto_destino_id || null) !== (antigo.produto_destino_id || null);
          if (diferenca !== 0) {
            await ajustarEstoque(novo.produto_id, -diferenca, `Edição da OP ${op.numero} - ${antigo.produto?.nome}: quantidade ${antigo.quantidade} → ${novo.quantidade}`);
            alteracoes.push(`${antigo.produto?.nome}: quantidade ${antigo.quantidade} → ${novo.quantidade}`);
          }
          if (destinoMudou) {
            const nomeDestino = novo.produto_destino_id ? produtos.find((p) => p.id === novo.produto_destino_id)?.nome || "produto destino" : "mesmo produto";
            alteracoes.push(`${antigo.produto?.nome}: destino → ${nomeDestino}`);
          }
          if (diferenca !== 0 || destinoMudou) {
            const { error: itError } = await supabase.from("ordens_producao_itens")
              .update({ quantidade: novo.quantidade, produto_destino_id: novo.produto_destino_id || null }).eq("id", novo.id);
            if (itError) throw itError;
          }
        }
      }

      const custoAnterior = Number(op.custo_pintura) || 0;
      let avisoFinanceiro = "";
      if (editCusto !== custoAnterior) {
        const { data: transacoes } = await supabase.from("transacoes_financeiras").select("id, status")
          .eq("origem_tipo", "ordem_producao").ilike("descricao", `%OP ${op.numero} (%`);
        const pendente = (transacoes || []).find((t) => t.status === "pendente");
        if (pendente) {
          const { error: tError } = await supabase.from("transacoes_financeiras")
            .update(editCusto > 0 ? { valor: editCusto } : { status: "cancelado" }).eq("id", pendente.id);
          if (tError) throw tError;
        } else if ((transacoes || []).some((t) => t.status === "pago")) {
          avisoFinanceiro = " A despesa no financeiro já foi paga e não foi alterada.";
        } else if (editCusto > 0) {
          const descricaoItens = op.itens.length === 1 ? op.itens[0].produto?.nome : `${op.itens.length} itens${op.cor_destino ? ` - cor ${op.cor_destino}` : ""}`;
          const { error: tError } = await supabase.from("transacoes_financeiras").insert({
            descricao: `Custo de Pintura - OP ${op.numero} (${descricaoItens})`,
            tipo: "despesa", valor: editCusto, data: editDataSaida || op.data_saida, status: "pendente",
            categoria: "Pintura", origem_tipo: "ordem_producao",
            observacoes: `OP ${op.numero} - ` + editItens.map((i) => `${i.quantidade} un de ${i.produto?.nome}`).join(", "),
            data_vencimento: editDataSaida || op.data_saida, created_by: user?.id,
          });
          if (tError) throw tError;
        }
        alteracoes.push(`custo ${formatCurrency(custoAnterior)} → ${formatCurrency(editCusto)}`);
      }

      if (editDataSaida !== (op.data_saida || "").split("T")[0]) alteracoes.push(`saída → ${formatDate(editDataSaida)}`);
      if (!emPintura && editDataRetorno !== (op.data_retorno || "").split("T")[0]) alteracoes.push(`retorno → ${formatDate(editDataRetorno)}`);
      if ((editObservacoes || "") !== (op.observacoes || "")) alteracoes.push("observações");
      const fornecedorNovo = editFornecedor || null;
      if (fornecedorNovo !== (op.fornecedor_id || null)) {
        alteracoes.push(`fornecedor → ${fornecedorNovo ? fornecedores.find((f) => f.id === fornecedorNovo)?.nome || "fornecedor" : "nenhum"}`);
      }

      if (alteracoes.length === 0) { setDialogEditarAberto(false); return; }

      const primeiro = emPintura ? editItens[0] : op.itens[0];
      const { error: opError } = await supabase.from("ordens_producao").update({
        ...(emPintura
          ? { quantidade: editItens.reduce((s, i) => s + i.quantidade, 0), produto_destino_id: primeiro?.produto_destino_id || null }
          : { data_retorno: editDataRetorno || null }),
        data_saida: editDataSaida, custo_pintura: editCusto, observacoes: editObservacoes || null,
        fornecedor_id: fornecedorNovo,
        updated_at: new Date().toISOString(),
      }).eq("id", op.id);
      if (opError) throw opError;

      await supabase.from("ordens_producao_historico").insert({
        op_id: op.id, status_anterior: op.status, status_novo: op.status,
        observacoes: `OP editada: ${alteracoes.join("; ")}`, usuario_id: user?.id,
      });

      toast({ title: "OP atualizada!", description: `OP ${op.numero}: ${alteracoes.join("; ")}.${avisoFinanceiro}` });
      setDialogEditarAberto(false); setOpEditando(null);
      await carregarDados();
    } catch (error: any) {
      toast({ title: "Erro ao editar OP", description: error.message, variant: "destructive" });
    } finally { setProcessandoId(null); }
  };

  // ========== IMPRESSÃO / HISTÓRICO ==========
  const handleImprimirOp = async (op: OrdemProducao) => {
    try {
      setProcessandoId(`print-${op.id}`);
      const { data: config, error: configError } = await supabase.from("configuracoes").select("*").limit(1).single();
      if (configError) throw configError;
      const t = totaisItens(op.itens);
      const pdfBlob = await gerarPDFOrdemProducao({
        numero: op.numero,
        status: getStatusInfo(op.status).label,
        dataSaida: formatDate(op.data_saida),
        dataRetorno: op.data_retorno ? formatDate(op.data_retorno) : null,
        fornecedor: op.fornecedor?.nome || null,
        corDestino: op.cor_destino,
        itens: op.itens.map((i) => {
          const kgUnit = pesoUnitario(i.produto);
          return {
            codigo: i.produto?.codigo || "-",
            nome: i.produto?.nome || "-",
            cor: i.produto?.cor,
            unidade: i.produto?.unidade || "un",
            destino: i.produto_destino ? { nome: i.produto_destino.nome, cor: i.produto_destino.cor } : null,
            quantidade: i.quantidade,
            pesoUnitarioKg: kgUnit,
            pesoTotalKg: kgUnit * i.quantidade,
          };
        }),
        pesoTotalKg: t.kg,
        valorMaterial: t.material,
        custoPintura: Number(op.custo_pintura) || 0,
        observacoes: op.observacoes,
      }, config);
      downloadPDF(pdfBlob, `ordem_producao_${op.numero}.pdf`);
    } catch (error: any) {
      toast({ title: "Erro ao gerar impressão", description: error.message, variant: "destructive" });
    } finally { setProcessandoId(null); }
  };

  const handleVerHistorico = async (op: OrdemProducao) => {
    setOpHistorico(op); setDialogHistoricoAberto(true);
    try {
      const { data, error } = await supabase.from("ordens_producao_historico")
        .select("*").eq("op_id", op.id).order("created_at", { ascending: true });
      if (error) throw error;
      setHistorico(data || []);
    } catch (error: any) {
      toast({ title: "Erro ao carregar histórico", description: error.message, variant: "destructive" });
    }
  };

  const limparFiltros = () => {
    setSearchTerm("");
    setFiltroStatus("todos");
    setFiltroProduto("todos");
    setBuscaProduto("");
  };

  const temFiltrosAtivos = searchTerm !== "" || filtroStatus !== "todos" || filtroProduto !== "todos" || buscaProduto !== "";
  const kgEditOp = totaisItens(opEditando?.status === "em_pintura" ? editItens : (opEditando?.itens || [])).kg;
  const produtosDestinoPossiveis = (origemId: string, cor: string) =>
    produtos.filter((p) => p.id !== origemId && (!cor || p.cor === cor));

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center gap-3">
            <PaintBucket className="h-7 w-7 sm:h-8 sm:w-8 text-primary shrink-0" /> Ordens de Produção
          </h1>
          <p className="text-muted-foreground mt-1">Controle de produtos enviados para pintura, transformação de cor e retorno ao estoque</p>
        </div>
        <Button onClick={() => { resetNovaOp(); setDialogNovaOpAberto(true); }} className="bg-primary hover:bg-primary/90 w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" /> Nova OP
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-card to-amber-50/30 hover:shadow-xl transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl" />
          <CardContent className="pt-6 relative z-10">
            <div className="flex items-center justify-between">
              <div><p className="text-sm font-medium text-muted-foreground">Em Pintura</p><p className="text-2xl font-bold text-amber-600">{totalEmPintura}</p></div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg"><Clock className="h-6 w-6 text-white" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-card to-green-50/30 hover:shadow-xl transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/5 rounded-full blur-2xl" />
          <CardContent className="pt-6 relative z-10">
            <div className="flex items-center justify-between">
              <div><p className="text-sm font-medium text-muted-foreground">Retornados</p><p className="text-2xl font-bold text-green-600">{totalRetornados}</p></div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-success shadow-lg"><CheckCircle className="h-6 w-6 text-white" /></div>
            </div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-br from-card to-blue-50/30 hover:shadow-xl transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl" />
          <CardContent className="pt-6 relative z-10">
            <div className="flex items-center justify-between">
              <div><p className="text-sm font-medium text-muted-foreground">Custo Total Pintura</p><p className="text-2xl font-bold text-primary">{formatCurrency(custoTotalPintura)}</p></div>
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent shadow-lg"><DollarSign className="h-6 w-6 text-white" /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card><CardContent className="pt-6">
        <div className="flex flex-col space-y-4">
          {/* Linha de filtros */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por OP, produto, código, cor, fornecedor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos Status</SelectItem>
                  <SelectItem value="em_pintura">Em Pintura</SelectItem>
                  <SelectItem value="retornado">Retornado</SelectItem>
                  <SelectItem value="cancelada">Cancelada</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filtroProduto} onValueChange={setFiltroProduto}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filtrar por produto" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="todos">Todos os produtos</SelectItem>
                  {produtos.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome} {p.cor ? `(${p.cor})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button variant="outline" onClick={carregarDados} title="Atualizar">
                <RefreshCw className="h-4 w-4" />
              </Button>

              {temFiltrosAtivos && (
                <Button variant="ghost" onClick={limparFiltros} className="text-muted-foreground">
                  <Filter className="h-4 w-4 mr-1" /> Limpar
                </Button>
              )}
            </div>
          </div>

          {/* Segunda linha - Busca de produtos */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Package className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar produtos no estoque..."
                value={buscaProduto}
                onChange={(e) => setBuscaProduto(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="text-sm text-muted-foreground flex items-center">
              {buscaProduto ? `${produtosFiltrados.length} produtos encontrados` : `${produtos.length} produtos no estoque`}
            </div>
          </div>

          {/* Indicador de filtros ativos */}
          {temFiltrosAtivos && (
            <div className="flex flex-wrap gap-2 items-center text-sm text-muted-foreground">
              <span className="font-medium">Filtros ativos:</span>
              {searchTerm && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Busca: "{searchTerm}"
                  <button onClick={() => setSearchTerm("")} className="ml-1 hover:text-foreground">×</button>
                </Badge>
              )}
              {buscaProduto && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Produtos: "{buscaProduto}"
                  <button onClick={() => setBuscaProduto("")} className="ml-1 hover:text-foreground">×</button>
                </Badge>
              )}
              {filtroStatus !== "todos" && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Status: {filtroStatus === "em_pintura" ? "Em Pintura" : filtroStatus === "retornado" ? "Retornado" : "Cancelada"}
                  <button onClick={() => setFiltroStatus("todos")} className="ml-1 hover:text-foreground">×</button>
                </Badge>
              )}
              {filtroProduto !== "todos" && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  Produto: {produtos.find(p => p.id === filtroProduto)?.nome || filtroProduto}
                  <button onClick={() => setFiltroProduto("todos")} className="ml-1 hover:text-foreground">×</button>
                </Badge>
              )}
              <span className="text-xs">
                ({ordensFiltradas.length} {ordensFiltradas.length === 1 ? "resultado" : "resultados"})
              </span>
            </div>
          )}

          {/* Lista de produtos encontrados */}
          {buscaProduto && !dialogNovaOpAberto && produtosFiltrados.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 mt-2">
              {produtosFiltrados.slice(0, 8).map((produto) => (
                <div key={produto.id} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg border">
                  <div>
                    <p className="font-medium text-sm">{produto.nome}</p>
                    <p className="text-xs text-muted-foreground">{produto.codigo} {produto.cor ? `· ${produto.cor}` : ""}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Est: {produto.estoque} {produto.unidade || "un"}
                  </Badge>
                </div>
              ))}
              {produtosFiltrados.length > 8 && (
                <div className="flex items-center justify-center p-2 text-muted-foreground text-sm">
                  + {produtosFiltrados.length - 8} produtos
                </div>
              )}
            </div>
          )}

          {buscaProduto && !dialogNovaOpAberto && produtosFiltrados.length === 0 && (
            <div className="text-center py-4 text-muted-foreground">
              <Package className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              Nenhum produto encontrado com "{buscaProduto}"
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div><p className="mt-4 text-muted-foreground">Carregando ordens de produção...</p></div>
        ) : (
          <div className="mt-4 max-h-[70vh] overflow-auto rounded-md border">
            {/* Altura limitada com rolagem propria: a barra horizontal fica sempre
                na tela (nao so no fim da lista), o cabecalho fica no topo e a
                coluna Acoes fica fixa a direita. */}
            <table className="w-full caption-bottom text-sm">
              <TableHeader className="sticky top-0 z-20 bg-background shadow-sm"><TableRow>
                <TableHead className="font-bold">Número</TableHead>
                <TableHead className="font-bold">Itens</TableHead>
                <TableHead className="font-bold">Pintar para</TableHead>
                <TableHead className="font-bold">Fornecedor</TableHead>
                <TableHead className="font-bold text-right">Qtd</TableHead>
                <TableHead className="font-bold">Saída</TableHead>
                <TableHead className="font-bold">Retorno</TableHead>
                <TableHead className="font-bold text-right">Custo</TableHead>
                <TableHead className="font-bold">Status</TableHead>
                <TableHead className="font-bold text-right sticky right-0 z-30 bg-background border-l">Ações</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {ordensFiltradas.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                    {temFiltrosAtivos ? "Nenhuma OP encontrada com os filtros aplicados." : "Nenhuma OP cadastrada. Clique em 'Nova OP' para começar."}
                  </TableCell></TableRow>
                ) : ordensFiltradas.map((op) => {
                  const si = getStatusInfo(op.status); const SIcon = si.icon;
                  const qtdTotal = op.itens.reduce((s, i) => s + (Number(i.quantidade) || 0), 0);
                  const unicoDestino = op.itens.length === 1 ? op.itens[0].produto_destino : null;
                  return (
                    <TableRow key={op.id} className="group hover:bg-muted/50">
                      <TableCell className="font-mono font-medium">{op.numero}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          {op.itens.slice(0, 3).map((i, k) => (
                            <span key={i.id || k} className="text-sm">
                              <span className="font-medium">{i.quantidade}x</span> {i.produto?.nome || "-"}
                            </span>
                          ))}
                          {op.itens.length > 3 && <span className="text-xs text-muted-foreground">+ {op.itens.length - 3} itens</span>}
                        </div>
                      </TableCell>
                      <TableCell>
                        {op.cor_destino ? (
                          <div className="flex items-center gap-2">
                            <ArrowRight className="h-3 w-3 text-primary" />
                            <span className="font-medium text-primary">{op.cor_destino}</span>
                          </div>
                        ) : unicoDestino ? (
                          <div className="flex items-center gap-2">
                            <ArrowRight className="h-3 w-3 text-primary" />
                            <span className="font-medium text-primary">{unicoDestino.nome}</span>
                          </div>
                        ) : <span className="text-muted-foreground text-sm">Sem transformação</span>}
                      </TableCell>
                      <TableCell>{op.fornecedor?.nome || <span className="text-muted-foreground text-sm">-</span>}</TableCell>
                      <TableCell className="text-right font-semibold">{qtdTotal}</TableCell>
                      <TableCell>{formatDate(op.data_saida)}</TableCell>
                      <TableCell>{formatDate(op.data_retorno)}</TableCell>
                      <TableCell className="text-right font-bold text-primary">{formatCurrency(op.custo_pintura)}</TableCell>
                      <TableCell><Badge variant="outline" className={si.className}><SIcon className="h-3 w-3 mr-1" />{si.label}</Badge></TableCell>
                      <TableCell className="text-right sticky right-0 z-10 bg-background group-hover:bg-muted border-l">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => { setOpDetalhes(op); setDialogDetalhesAberto(true); }} title="Detalhes"><Eye className="h-4 w-4" /></Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleVerHistorico(op)} title="Histórico"><History className="h-4 w-4" /></Button>
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => handleImprimirOp(op)} disabled={processandoId === `print-${op.id}`} title="Imprimir OP">
                            {processandoId === `print-${op.id}` ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div> : <Printer className="h-4 w-4" />}
                          </Button>
                          {op.status !== "cancelada" && (
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-blue-600" onClick={() => abrirEdicao(op)} disabled={processandoId === op.id} title="Editar"><Pencil className="h-4 w-4" /></Button>
                          )}
                          {op.status === "em_pintura" && (
                            <>
                              <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white h-8"
                                onClick={() => { setOpParaRetornar(op); setDataRetorno(new Date().toISOString().split("T")[0]); setDialogRetornoAberto(true); }}
                                disabled={processandoId === op.id} title="Retornar">
                                {processandoId === op.id ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : <ArrowLeftRight className="h-4 w-4" />}
                              </Button>
                              <Button size="sm" variant="outline" className="border-red-500 text-red-600 hover:bg-red-50 h-8 w-8 p-0"
                                onClick={() => { setOpParaCancelar(op); setDialogCancelarAberto(true); }}
                                disabled={processandoId === op.id} title="Cancelar"><XCircle className="h-4 w-4" /></Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </table>
          </div>
        )}
      </CardContent></Card>

      {/* DIALOG NOVA OP - varios itens para a mesma cor */}
      <Dialog open={dialogNovaOpAberto} onOpenChange={setDialogNovaOpAberto}>
        <DialogContent className="sm:max-w-[820px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><PaintBucket className="h-5 w-5 text-primary" />Nova Ordem de Produção</DialogTitle>
            <DialogDescription>Escolha a cor e adicione os itens que vão para a pintura. O estoque de cada item será debitado e o custo será registrado no financeiro.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Pintar para a cor</Label>
                <Select value={corDestino || "__mesma__"} onValueChange={(v) => alterarCorDestino(v === "__mesma__" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione a cor..." /></SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="__mesma__">Sem transformação (mesma cor)</SelectItem>
                    {cores.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">O produto equivalente nessa cor é sugerido para cada item; dá para trocar.</p>
              </div>
              <div className="space-y-2">
                <Label>Fornecedor (pintura)</Label>
                <Select value={fornecedorSelecionado || "__nenhum__"} onValueChange={(v) => setFornecedorSelecionado(v === "__nenhum__" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione o fornecedor..." /></SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="__nenhum__">Não informado</SelectItem>
                    {fornecedores.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Adicionar item */}
            <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
              <Label>Adicionar item (será debitado do estoque)</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar produto por nome, código ou cor..." value={buscaProduto} onChange={(e) => setBuscaProduto(e.target.value)} className="pl-10" />
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Select value={produtoParaAdicionar} onValueChange={setProdutoParaAdicionar}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Selecione o produto..." /></SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {produtosFiltrados.length === 0 ? (
                      <SelectItem value="__vazio__" disabled>Nenhum produto encontrado</SelectItem>
                    ) : produtosFiltrados.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.codigo} - {p.nome} {p.cor ? `(${p.cor})` : ""} (Est: {p.estoque} {p.unidade || "un"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input type="number" min={1} className="sm:w-28" value={quantidadeParaAdicionar} onChange={(e) => setQuantidadeParaAdicionar(parseInt(e.target.value) || 0)} placeholder="Qtd" />
                <Button type="button" onClick={adicionarItem}><Plus className="h-4 w-4 mr-1" />Adicionar</Button>
              </div>
            </div>

            {/* Itens da OP */}
            {novosItens.length > 0 ? (
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Produto enviado</TableHead>
                    <TableHead className="w-24">Qtd</TableHead>
                    <TableHead>Pintar para</TableHead>
                    <TableHead className="text-right">Peso</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {novosItens.map((i, idx) => {
                      const estoque = Number(i.produto?.estoque) || 0;
                      return (
                        <TableRow key={i.produto_id}>
                          <TableCell className="text-sm">
                            <div className="font-medium">{nomeComCor(i.produto)}</div>
                            <div className={`text-xs ${estoque < i.quantidade ? "text-red-600" : "text-muted-foreground"}`}>Estoque: {estoque}</div>
                          </TableCell>
                          <TableCell>
                            <Input type="number" min={1} className="h-8" value={i.quantidade} onChange={(e) => alterarNovoItem(idx, { quantidade: parseInt(e.target.value) || 0 })} />
                          </TableCell>
                          <TableCell>
                            <Select value={i.produto_destino_id || "__mesmo__"} onValueChange={(v) => {
                              const destino = v === "__mesmo__" ? null : produtos.find((p) => p.id === v) || null;
                              alterarNovoItem(idx, { produto_destino_id: destino?.id || null, produto_destino: destino });
                            }}>
                              <SelectTrigger className="h-8 min-w-[180px]"><SelectValue placeholder="Mesmo produto" /></SelectTrigger>
                              <SelectContent className="max-h-[300px]">
                                <SelectItem value="__mesmo__">Mesmo produto (sem transformação)</SelectItem>
                                {produtosDestinoPossiveis(i.produto_id, corDestino).map((p) => (
                                  <SelectItem key={p.id} value={p.id}>{p.codigo} - {p.nome}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {corDestino && !i.produto_destino_id && <p className="text-xs text-amber-600 mt-1">Sem equivalente na cor {corDestino} - escolha o produto.</p>}
                          </TableCell>
                          <TableCell className="text-right text-sm">{formatKg(pesoUnitario(i.produto) * (i.quantidade || 0))}</TableCell>
                          <TableCell>
                            <Button type="button" size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-600" onClick={() => setNovosItens((itens) => itens.filter((_, k) => k !== idx))} title="Remover item"><Trash2 className="h-4 w-4" /></Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-3 border rounded-lg border-dashed">Nenhum item adicionado ainda.</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Data de Saída</Label><Input type="date" value={dataSaida} onChange={(e) => setDataSaida(e.target.value)} /></div>
              <div className="space-y-2">
                {kgNovaOp > 0 ? (
                  <>
                    <Label>Pintura - R$ por kg</Label>
                    <Input type="number" min={0} step="0.01" value={precoKgPintura} onChange={(e) => setPrecoKgPintura(parseFloat(e.target.value) || 0)} placeholder="0,00" />
                    <p className="text-xs text-muted-foreground">
                      {formatKg(kgNovaOp)} × {formatCurrency(precoKgPintura)}/kg = <span className="font-medium">{formatCurrency(custoPintura)}</span>
                    </p>
                  </>
                ) : (
                  <>
                    <Label>Custo de Pintura (R$)</Label>
                    <Input type="number" min={0} step="0.01" value={custoPintura} onChange={(e) => setCustoPintura(parseFloat(e.target.value) || 0)} placeholder="0,00" />
                    <p className="text-xs text-muted-foreground">{novosItens.length ? "Itens sem peso cadastrado - informe o custo total. " : ""}Registrado como despesa no financeiro.</p>
                  </>
                )}
              </div>
            </div>
            {novosItens.length > 0 && <ResumoValorOp itens={novosItens} custoPintura={custoPintura} />}
            <div className="space-y-2"><Label>Observações</Label><Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Observações opcionais..." rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogNovaOpAberto(false)}>Cancelar</Button>
            <Button onClick={handleCriarOp} disabled={processandoId === "nova" || novosItens.length === 0} className="bg-primary">
              {processandoId === "nova" ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div> : <Plus className="h-4 w-4 mr-2" />}Criar OP
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG EDITAR OP */}
      <Dialog open={dialogEditarAberto} onOpenChange={setDialogEditarAberto}>
        <DialogContent className="sm:max-w-[760px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Pencil className="h-5 w-5 text-primary" />Editar OP {opEditando?.numero}</DialogTitle>
            <DialogDescription>
              {opEditando?.status === "em_pintura"
                ? "Alterar a quantidade de um item ajusta o estoque do produto de origem pela diferença."
                : "OP já retornada: só datas, custo, fornecedor e observações podem ser alterados."}
            </DialogDescription>
          </DialogHeader>
          {opEditando && (
            <div className="space-y-4 py-2">
              {opEditando.cor_destino && (
                <div className="p-2 bg-muted/50 rounded-lg border text-sm">
                  <span className="text-muted-foreground">Pintar para a cor: </span><span className="font-medium text-primary">{opEditando.cor_destino}</span>
                </div>
              )}
              {opEditando.status === "em_pintura" ? (
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow>
                      <TableHead>Produto enviado</TableHead>
                      <TableHead className="w-24">Qtd</TableHead>
                      <TableHead>Pintar para</TableHead>
                    </TableRow></TableHeader>
                    <TableBody>
                      {editItens.map((i, idx) => (
                        <TableRow key={i.id || idx}>
                          <TableCell className="text-sm font-medium">{nomeComCor(i.produto)}</TableCell>
                          <TableCell><Input type="number" min={1} className="h-8" value={i.quantidade} onChange={(e) => alterarEditItem(idx, { quantidade: parseInt(e.target.value) || 0 })} /></TableCell>
                          <TableCell>
                            <Select value={i.produto_destino_id || "__mesmo__"} onValueChange={(v) => {
                              const destino = v === "__mesmo__" ? null : produtos.find((p) => p.id === v) || null;
                              alterarEditItem(idx, { produto_destino_id: destino?.id || null, produto_destino: destino });
                            }}>
                              <SelectTrigger className="h-8 min-w-[180px]"><SelectValue placeholder="Mesmo produto" /></SelectTrigger>
                              <SelectContent className="max-h-[300px]">
                                <SelectItem value="__mesmo__">Mesmo produto (sem transformação)</SelectItem>
                                {produtosDestinoPossiveis(i.produto_id, opEditando.cor_destino || "").map((p) => (
                                  <SelectItem key={p.id} value={p.id}>{p.codigo} - {p.nome}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <TabelaItensLeitura itens={opEditando.itens} />
              )}
              <div className="space-y-2">
                <Label>Fornecedor (pintura)</Label>
                <Select value={editFornecedor || "__nenhum__"} onValueChange={(v) => setEditFornecedor(v === "__nenhum__" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione o fornecedor..." /></SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="__nenhum__">Não informado</SelectItem>
                    {fornecedores.map((f) => <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Data de Saída</Label><Input type="date" value={editDataSaida} onChange={(e) => setEditDataSaida(e.target.value)} /></div>
                {opEditando.status === "retornado" && (
                  <div className="space-y-2"><Label>Data de Retorno</Label><Input type="date" value={editDataRetorno} onChange={(e) => setEditDataRetorno(e.target.value)} /></div>
                )}
              </div>
              <div className="space-y-2">
                {kgEditOp > 0 ? (
                  <>
                    <Label>Pintura - R$ por kg</Label>
                    <Input type="number" min={0} step="0.01" value={editPrecoKg} onChange={(e) => alterarEditPrecoKg(parseFloat(e.target.value) || 0)} />
                    <p className="text-xs text-muted-foreground">
                      {formatKg(kgEditOp)} × {formatCurrency(editPrecoKg)}/kg = <span className="font-medium">{formatCurrency(editCusto)}</span> — a despesa pendente no financeiro é atualizada junto.
                    </p>
                  </>
                ) : (
                  <>
                    <Label>Custo de Pintura (R$)</Label>
                    <Input type="number" min={0} step="0.01" value={editCusto} onChange={(e) => setEditCusto(parseFloat(e.target.value) || 0)} />
                    <p className="text-xs text-muted-foreground">A despesa pendente no financeiro é atualizada junto.</p>
                  </>
                )}
              </div>
              <ResumoValorOp itens={opEditando.status === "em_pintura" ? editItens : opEditando.itens} custoPintura={editCusto} />
              <div className="space-y-2"><Label>Observações</Label><Textarea value={editObservacoes} onChange={(e) => setEditObservacoes(e.target.value)} rows={2} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogEditarAberto(false)}>Cancelar</Button>
            <Button onClick={handleSalvarEdicao} disabled={processandoId !== null} className="bg-primary">
              {processandoId ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div> : null}Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG RETORNO */}
      <Dialog open={dialogRetornoAberto} onOpenChange={setDialogRetornoAberto}>
        <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ArrowLeftRight className="h-5 w-5 text-green-600" />Confirmar Retorno da Pintura</DialogTitle>
            <DialogDescription>Os itens voltarão ao estoque (no produto de destino, quando houver). Confirme a data de retorno.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>Data de Retorno</Label><Input type="date" value={dataRetorno} onChange={(e) => setDataRetorno(e.target.value)} /></div>
            {opParaRetornar && (
              <>
                <p className="text-sm font-medium">OP {opParaRetornar.numero}{opParaRetornar.cor_destino ? ` — cor ${opParaRetornar.cor_destino}` : ""}</p>
                <TabelaItensLeitura itens={opParaRetornar.itens} />
                <ResumoValorOp itens={opParaRetornar.itens} custoPintura={opParaRetornar.custo_pintura} />
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogRetornoAberto(false)}>Cancelar</Button>
            <Button onClick={handleRetornarOp} disabled={processandoId !== null} className="bg-green-600 hover:bg-green-700">
              {processandoId ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div> : null}Confirmar Retorno
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG CANCELAR */}
      <AlertDialog open={dialogCancelarAberto} onOpenChange={setDialogCancelarAberto}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><XCircle className="h-5 w-5 text-red-600" />Cancelar OP {opParaCancelar?.numero}</AlertDialogTitle>
            <AlertDialogDescription>{opParaCancelar?.status === "em_pintura" ? "A OP será cancelada e os itens serão devolvidos ao estoque. Esta ação não pode ser desfeita." : "A OP será cancelada. Esta ação não pode ser desfeita."}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelarOp} className="bg-red-600 hover:bg-red-700 text-white" disabled={processandoId !== null}>
              {processandoId ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div> : null}Sim, Cancelar OP
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* DIALOG HISTÓRICO */}
      <Dialog open={dialogHistoricoAberto} onOpenChange={setDialogHistoricoAberto}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><History className="h-5 w-5 text-primary" />Histórico da OP {opHistorico?.numero}</DialogTitle>
            <DialogDescription>
              {opHistorico ? `${opHistorico.itens.length} ${opHistorico.itens.length === 1 ? "item" : "itens"}${opHistorico.cor_destino ? ` — cor ${opHistorico.cor_destino}` : ""}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {historico.length === 0 ? <p className="text-center text-muted-foreground py-4">Nenhum histórico encontrado.</p> : historico.map((item) => (
              <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg border bg-muted/30">
                <div className="flex-shrink-0 mt-0.5">
                  {item.status_novo === "em_pintura" && <TrendingDown className="h-4 w-4 text-amber-600" />}
                  {item.status_novo === "retornado" && <TrendingUp className="h-4 w-4 text-green-600" />}
                  {item.status_novo === "cancelada" && <XCircle className="h-4 w-4 text-red-600" />}
                </div>
                <div className="flex-1">
                  <span className="text-sm font-medium">{item.status_anterior || "Criada"} → {item.status_novo}</span>
                  {item.observacoes && <p className="text-xs text-muted-foreground mt-1">{item.observacoes}</p>}
                  <p className="text-xs text-muted-foreground mt-1">{formatDate(item.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogHistoricoAberto(false)}>Fechar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG DETALHES */}
      <Dialog open={dialogDetalhesAberto} onOpenChange={setDialogDetalhesAberto}>
        <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Eye className="h-5 w-5 text-primary" />Detalhes da OP {opDetalhes?.numero}</DialogTitle></DialogHeader>
          {opDetalhes && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-sm text-muted-foreground">Pintar para a cor</p><p className="font-medium text-primary">{opDetalhes.cor_destino || "Sem transformação"}</p></div>
                <div><p className="text-sm text-muted-foreground">Status</p>{(() => { const si = getStatusInfo(opDetalhes.status); const SIcon = si.icon; return <Badge variant="outline" className={si.className}><SIcon className="h-3 w-3 mr-1" />{si.label}</Badge>; })()}</div>
              </div>
              <TabelaItensLeitura itens={opDetalhes.itens} />
              <div className="grid grid-cols-3 gap-4">
                <div><p className="text-sm text-muted-foreground">Data de Saída</p><p className="font-medium">{formatDate(opDetalhes.data_saida)}</p></div>
                <div><p className="text-sm text-muted-foreground">Data de Retorno</p><p className="font-medium">{formatDate(opDetalhes.data_retorno)}</p></div>
                <div><p className="text-sm text-muted-foreground">Fornecedor</p><p className="font-medium">{opDetalhes.fornecedor?.nome || "Não informado"}</p></div>
              </div>
              <ResumoValorOp itens={opDetalhes.itens} custoPintura={opDetalhes.custo_pintura} />
              {opDetalhes.observacoes && <div><p className="text-sm text-muted-foreground">Observações</p><p className="text-sm bg-muted/50 p-3 rounded">{opDetalhes.observacoes}</p></div>}
            </div>
          )}
          <DialogFooter>
            {opDetalhes && (
              <Button variant="outline" onClick={() => handleImprimirOp(opDetalhes)} disabled={processandoId === `print-${opDetalhes.id}`}>
                {processandoId === `print-${opDetalhes.id}` ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div> : <Printer className="h-4 w-4 mr-2" />}Imprimir
              </Button>
            )}
            <Button variant="outline" onClick={() => setDialogDetalhesAberto(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
