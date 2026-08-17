import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Plus, Search, Pencil, Trash2, ShoppingCart, Package, Weight,
  DollarSign, TrendingUp, Scissors, Filter,
} from "lucide-react";

interface SobraPerfil {
  id: string;
  codigo_perfil: string;
  nome_perfil: string;
  categoria: string | null;
  cor: string | null;
  comprimento_mm: number;
  peso_kg_m: number | null;
  peso_total_kg: number | null;
  valor_por_kg: number;
  valor_calculado: number;
  data_geracao: string;
  origem: string;
  orcamento_id: string | null;
  observacoes: string | null;
  localizacao: string | null;
  status: string;
  created_at: string;
}

interface SobraVenda {
  id: string;
  sobra_id: string;
  cliente_nome: string | null;
  valor_venda: number;
  data_venda: string;
  observacoes: string | null;
}

interface Cliente {
  id: string;
  nome: string;
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  disponivel: { label: "Disponível", variant: "default" },
  vendido: { label: "Vendido", variant: "secondary" },
  reservado: { label: "Reservado", variant: "outline" },
  descartado: { label: "Descartado", variant: "destructive" },
};

const ORIGENS = ["Manual", "Orçamento", "Produção"];
const CATEGORIAS = ["Perfil Estrutural", "Perfil Decorativo", "Tubo", "Barra", "Chapa", "Cantoneira", "Outro"];
const STATUS_LIST = ["disponivel", "vendido", "reservado", "descartado"];

const emptyForm = {
  codigo_perfil: "",
  nome_perfil: "",
  categoria: "",
  cor: "",
  comprimento_mm: "",
  peso_kg_m: "",
  valor_por_kg: "",
  data_geracao: new Date().toISOString().split("T")[0],
  origem: "Manual",
  observacoes: "",
  localizacao: "",
  status: "disponivel",
};

function calcularPeso(comprimento_m: number, peso_kg_m: number) {
  return parseFloat((comprimento_m * peso_kg_m).toFixed(4));
}

function calcularValor(comprimento_m: number, peso_kg_m: number, valor_por_kg: number) {
  return parseFloat((comprimento_m * peso_kg_m * valor_por_kg).toFixed(2));
}

export default function SobrasPerfis() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [sobras, setSobras] = useState<SobraPerfil[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroCategoria, setFiltroCategoria] = useState("todos");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSobra, setEditingSobra] = useState<SobraPerfil | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [vendaDialogOpen, setVendaDialogOpen] = useState(false);
  const [vendaSobra, setVendaSobra] = useState<SobraPerfil | null>(null);
  const [vendaForm, setVendaForm] = useState({ cliente_id: "", cliente_nome: "", valor_venda: "", observacoes: "" });
  const [vendaSaving, setVendaSaving] = useState(false);

  const [historicoDialogOpen, setHistoricoDialogOpen] = useState(false);
  const [historico, setHistorico] = useState<SobraVenda[]>([]);
  const [historicoLoading, setHistoricoLoading] = useState(false);

  useEffect(() => {
    fetchSobras();
    fetchClientes();
  }, []);

  const fetchSobras = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("sobras_perfis")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setSobras(data || []);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchClientes = async () => {
    const { data } = await supabase.from("clientes").select("id, nome").order("nome");
    setClientes(data || []);
  };

  const fetchHistorico = async (sobraId: string) => {
    setHistoricoLoading(true);
    const { data } = await supabase
      .from("sobras_vendas")
      .select("*")
      .eq("sobra_id", sobraId)
      .order("data_venda", { ascending: false });
    setHistorico(data || []);
    setHistoricoLoading(false);
  };

  const openNew = () => {
    setEditingSobra(null);
    setForm({ ...emptyForm });
    setDialogOpen(true);
  };

  const openEdit = (s: SobraPerfil) => {
    setEditingSobra(s);
    setForm({
      codigo_perfil: s.codigo_perfil,
      nome_perfil: s.nome_perfil,
      categoria: s.categoria || "",
      cor: s.cor || "",
      comprimento_mm: String(s.comprimento_mm / 1000),
      peso_kg_m: s.peso_kg_m != null ? String(s.peso_kg_m) : "",
      valor_por_kg: String(s.valor_por_kg),
      data_geracao: s.data_geracao,
      origem: s.origem,
      observacoes: s.observacoes || "",
      localizacao: s.localizacao || "",
      status: s.status,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.codigo_perfil.trim() || !form.nome_perfil.trim() || !form.comprimento_mm) {
      toast({ title: "Preencha os campos obrigatórios", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        codigo_perfil: form.codigo_perfil.trim().toUpperCase(),
        nome_perfil: form.nome_perfil.trim(),
        categoria: form.categoria || null,
        cor: form.cor || null,
        comprimento_mm: parseFloat(form.comprimento_mm) * 1000,
        peso_kg_m: form.peso_kg_m ? parseFloat(form.peso_kg_m) : null,
        valor_por_kg: form.valor_por_kg ? parseFloat(form.valor_por_kg) : 0,
        data_geracao: form.data_geracao,
        origem: form.origem,
        observacoes: form.observacoes || null,
        localizacao: form.localizacao || null,
        status: form.status,
      };

      if (editingSobra) {
        const { error } = await supabase.from("sobras_perfis").update(payload).eq("id", editingSobra.id);
        if (error) throw error;
        toast({ title: "Sobra atualizada com sucesso" });
      } else {
        payload.created_by = user?.id;
        const { error } = await supabase.from("sobras_perfis").insert(payload);
        if (error) throw error;
        toast({ title: "Sobra cadastrada com sucesso" });
      }

      setDialogOpen(false);
      fetchSobras();
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("sobras_perfis").delete().eq("id", deleteId);
      if (error) throw error;
      toast({ title: "Sobra excluída" });
      setDeleteId(null);
      fetchSobras();
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const openVenda = (s: SobraPerfil) => {
    navigate('/orcamentos', {
      state: {
        sobra: {
          id: s.id,
          codigo_perfil: s.codigo_perfil,
          nome_perfil: s.nome_perfil,
          comprimento_mm: s.comprimento_mm,
          peso_kg_m: s.peso_kg_m,
          valor_calculado: s.valor_calculado,
          categoria: s.categoria,
          cor: s.cor,
        }
      }
    });
  };

  const handleVender = async () => {
    if (!vendaSobra || !vendaForm.valor_venda) {
      toast({ title: "Informe o valor da venda", variant: "destructive" });
      return;
    }
    setVendaSaving(true);
    try {
      const clienteSelecionado = clientes.find(c => c.id === vendaForm.cliente_id);
      const clienteNome = clienteSelecionado ? clienteSelecionado.nome : vendaForm.cliente_nome || null;

      const { error: vendaError } = await supabase.from("sobras_vendas").insert({
        sobra_id: vendaSobra.id,
        cliente_id: vendaForm.cliente_id || null,
        cliente_nome: clienteNome,
        valor_venda: parseFloat(vendaForm.valor_venda),
        observacoes: vendaForm.observacoes || null,
        created_by: user?.id,
      });
      if (vendaError) throw vendaError;

      const { error: statusError } = await supabase
        .from("sobras_perfis")
        .update({ status: "vendido" })
        .eq("id", vendaSobra.id);
      if (statusError) throw statusError;

      toast({ title: "Venda registrada com sucesso!" });
      setVendaDialogOpen(false);
      fetchSobras();
    } catch (err: any) {
      toast({ title: "Erro ao registrar venda", description: err.message, variant: "destructive" });
    } finally {
      setVendaSaving(false);
    }
  };

  const openHistorico = (s: SobraPerfil) => {
    setVendaSobra(s);
    fetchHistorico(s.id);
    setHistoricoDialogOpen(true);
  };

  const filtered = useMemo(() => {
    return sobras.filter((s) => {
      const matchSearch =
        !searchTerm ||
        s.codigo_perfil.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.nome_perfil.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.localizacao || "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = filtroStatus === "todos" || s.status === filtroStatus;
      const matchCat = filtroCategoria === "todos" || s.categoria === filtroCategoria;
      return matchSearch && matchStatus && matchCat;
    });
  }, [sobras, searchTerm, filtroStatus, filtroCategoria]);

  const stats = useMemo(() => {
    const disponiveis = sobras.filter(s => s.status === "disponivel");
    const totalPeso = disponiveis.reduce((acc, s) => acc + (s.peso_total_kg || 0), 0);
    const totalValor = disponiveis.reduce((acc, s) => acc + (s.valor_calculado || 0), 0);
    const vendidas = sobras.filter(s => s.status === "vendido").length;
    return { disponiveis: disponiveis.length, totalPeso, totalValor, vendidas };
  }, [sobras]);

  const pesoPreview = form.comprimento_mm && form.peso_kg_m
    ? calcularPeso(parseFloat(form.comprimento_mm), parseFloat(form.peso_kg_m))
    : null;
  const valorPreview = form.comprimento_mm && form.peso_kg_m && form.valor_por_kg
    ? calcularValor(parseFloat(form.comprimento_mm), parseFloat(form.peso_kg_m), parseFloat(form.valor_por_kg))
    : null;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100">
            <Scissors className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Sobras de Perfis</h1>
            <p className="text-sm text-muted-foreground">Gerencie retalhos e sobras de alumínio</p>
          </div>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Sobra
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100">
              <Package className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Disponíveis</p>
              <p className="text-2xl font-bold">{stats.disponiveis}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-100">
              <Weight className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Peso Total</p>
              <p className="text-2xl font-bold">{stats.totalPeso.toFixed(2)} kg</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-100">
              <DollarSign className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Valor Total</p>
              <p className="text-xl font-bold">
                {stats.totalValor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-100">
              <TrendingUp className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Vendidas</p>
              <p className="text-2xl font-bold">{stats.vendidas}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por código, nome ou localização..."
                className="pl-9"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={filtroStatus} onValueChange={setFiltroStatus}>
              <SelectTrigger className="w-full md:w-44">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                {STATUS_LIST.map(s => (
                  <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas as categorias</SelectItem>
                {CATEGORIAS.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardHeader className="py-3 px-6">
          <CardTitle className="text-base">
            {filtered.length} sobra{filtered.length !== 1 ? "s" : ""} encontrada{filtered.length !== 1 ? "s" : ""}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <Scissors className="h-10 w-10 opacity-30" />
              <p>Nenhuma sobra encontrada</p>
              <Button variant="outline" size="sm" onClick={openNew}>Cadastrar primeira sobra</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Perfil</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Cor</TableHead>
                    <TableHead className="text-right">Comprimento (m)</TableHead>
                    <TableHead className="text-right">Peso</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Origem</TableHead>
                    <TableHead>Localização</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((s) => (
                    <TableRow key={s.id} className="hover:bg-muted/40">
                      <TableCell className="font-mono font-semibold text-sm">{s.codigo_perfil}</TableCell>
                      <TableCell className="max-w-[160px] truncate font-medium">{s.nome_perfil}</TableCell>
                      <TableCell>
                        {s.categoria ? (
                          <span className="text-sm text-muted-foreground">{s.categoria}</span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {s.cor ? (
                          <span className="text-sm">{s.cor}</span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {(s.comprimento_mm / 1000).toFixed(3)} m
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {s.peso_total_kg != null
                          ? `${s.peso_total_kg.toFixed(3)} kg`
                          : <span className="text-muted-foreground/40">—</span>}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {s.valor_calculado > 0
                          ? s.valor_calculado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                          : <span className="text-muted-foreground/40">—</span>}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">{s.origem}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-xs text-muted-foreground">{s.localizacao || "—"}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_CONFIG[s.status]?.variant ?? "outline"}>
                          {STATUS_CONFIG[s.status]?.label ?? s.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          {s.status === "disponivel" && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-green-700 border-green-200 hover:bg-green-50"
                              onClick={() => openVenda(s)}
                            >
                              <ShoppingCart className="h-3 w-3 mr-1" />
                              Vender
                            </Button>
                          )}
                          {s.status === "vendido" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-muted-foreground"
                              onClick={() => openHistorico(s)}
                            >
                              Ver venda
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(s.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog Cadastro / Edição */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSobra ? "Editar Sobra" : "Nova Sobra de Perfil"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
            <div className="space-y-1">
              <Label htmlFor="codigo_perfil">Código do Perfil <span className="text-destructive">*</span></Label>
              <Input
                id="codigo_perfil"
                placeholder="ex: AL6063"
                value={form.codigo_perfil}
                onChange={(e) => setForm(f => ({ ...f, codigo_perfil: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="nome_perfil">Nome do Perfil <span className="text-destructive">*</span></Label>
              <Input
                id="nome_perfil"
                placeholder="ex: Perfil T 40x40"
                value={form.nome_perfil}
                onChange={(e) => setForm(f => ({ ...f, nome_perfil: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Categoria</Label>
              <Select value={form.categoria} onValueChange={(v) => setForm(f => ({ ...f, categoria: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="cor">Cor</Label>
              <Input
                id="cor"
                placeholder="ex: Natural, Anodizado Preto"
                value={form.cor}
                onChange={(e) => setForm(f => ({ ...f, cor: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="comprimento_mm">Comprimento (m) <span className="text-destructive">*</span></Label>
              <Input
                id="comprimento_mm"
                type="number"
                min="0.001"
                step="0.001"
                placeholder="ex: 1.200"
                value={form.comprimento_mm}
                onChange={(e) => setForm(f => ({ ...f, comprimento_mm: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="peso_kg_m">Peso por Metro (kg/m)</Label>
              <Input
                id="peso_kg_m"
                type="number"
                step="0.0001"
                min="0"
                placeholder="ex: 1.2500"
                value={form.peso_kg_m}
                onChange={(e) => setForm(f => ({ ...f, peso_kg_m: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="valor_por_kg">Valor por kg (R$)</Label>
              <Input
                id="valor_por_kg"
                type="number"
                step="0.01"
                min="0"
                placeholder="ex: 28.50"
                value={form.valor_por_kg}
                onChange={(e) => setForm(f => ({ ...f, valor_por_kg: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="data_geracao">Data de Geração</Label>
              <Input
                id="data_geracao"
                type="date"
                value={form.data_geracao}
                onChange={(e) => setForm(f => ({ ...f, data_geracao: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Origem</Label>
              <Select value={form.origem} onValueChange={(v) => setForm(f => ({ ...f, origem: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ORIGENS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_LIST.map(s => (
                    <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="localizacao">Localização Física</Label>
              <Input
                id="localizacao"
                placeholder="ex: Prateleira A3, Box 12"
                value={form.localizacao}
                onChange={(e) => setForm(f => ({ ...f, localizacao: e.target.value }))}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                placeholder="Informações adicionais sobre a sobra..."
                rows={2}
                value={form.observacoes}
                onChange={(e) => setForm(f => ({ ...f, observacoes: e.target.value }))}
              />
            </div>

            {/* Preview de cálculo */}
            {(pesoPreview != null || valorPreview != null) && (
              <div className="md:col-span-2 rounded-lg bg-amber-50 border border-amber-200 p-3 grid grid-cols-2 gap-3">
                <div className="text-center">
                  <p className="text-xs text-amber-700 font-medium">Peso Total Calculado</p>
                  <p className="text-lg font-bold text-amber-800">{pesoPreview?.toFixed(4)} kg</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-amber-700 font-medium">Valor Calculado</p>
                  <p className="text-lg font-bold text-amber-800">
                    {valorPreview?.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) ?? "—"}
                  </p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : editingSobra ? "Salvar Alterações" : "Cadastrar Sobra"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Venda */}
      <Dialog open={vendaDialogOpen} onOpenChange={setVendaDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Venda de Sobra</DialogTitle>
          </DialogHeader>
          {vendaSobra && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-muted p-3 space-y-1 text-sm">
                <p><span className="font-medium">Perfil:</span> {vendaSobra.nome_perfil}</p>
                <p><span className="font-medium">Código:</span> {vendaSobra.codigo_perfil}</p>
                <p><span className="font-medium">Comprimento:</span> {(vendaSobra.comprimento_mm / 1000).toFixed(3)} m</p>
                {vendaSobra.peso_total_kg != null && (
                  <p><span className="font-medium">Peso:</span> {vendaSobra.peso_total_kg.toFixed(3)} kg</p>
                )}
                {vendaSobra.valor_calculado > 0 && (
                  <p><span className="font-medium">Valor sugerido:</span> {vendaSobra.valor_calculado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Cliente (opcional)</Label>
                <Select
                  value={vendaForm.cliente_id}
                  onValueChange={(v) => setVendaForm(f => ({ ...f, cliente_id: v, cliente_nome: "" }))}
                >
                  <SelectTrigger><SelectValue placeholder="Selecionar cliente cadastrado..." /></SelectTrigger>
                  <SelectContent>
                    {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {!vendaForm.cliente_id && (
                <div className="space-y-1">
                  <Label htmlFor="cliente_avulso">Ou informe o nome do cliente</Label>
                  <Input
                    id="cliente_avulso"
                    placeholder="Nome do comprador..."
                    value={vendaForm.cliente_nome}
                    onChange={(e) => setVendaForm(f => ({ ...f, cliente_nome: e.target.value }))}
                  />
                </div>
              )}
              <div className="space-y-1">
                <Label htmlFor="valor_venda">Valor da Venda (R$) <span className="text-destructive">*</span></Label>
                <Input
                  id="valor_venda"
                  type="number"
                  step="0.01"
                  min="0"
                  value={vendaForm.valor_venda}
                  onChange={(e) => setVendaForm(f => ({ ...f, valor_venda: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="obs_venda">Observações</Label>
                <Textarea
                  id="obs_venda"
                  placeholder="Informações adicionais..."
                  rows={2}
                  value={vendaForm.observacoes}
                  onChange={(e) => setVendaForm(f => ({ ...f, observacoes: e.target.value }))}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setVendaDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleVender} disabled={vendaSaving} className="bg-green-600 hover:bg-green-700">
              {vendaSaving ? "Registrando..." : "Confirmar Venda"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Histórico */}
      <Dialog open={historicoDialogOpen} onOpenChange={setHistoricoDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Histórico de Venda</DialogTitle>
          </DialogHeader>
          {historicoLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
            </div>
          ) : historico.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma venda registrada</p>
          ) : (
            <div className="space-y-3">
              {historico.map((v) => (
                <div key={v.id} className="rounded-lg border p-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="font-medium">{v.cliente_nome || "Cliente avulso"}</span>
                    <span className="font-bold text-green-700">
                      {parseFloat(String(v.valor_venda)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {new Date(v.data_venda).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </p>
                  {v.observacoes && <p className="text-muted-foreground">{v.observacoes}</p>}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Alert Delete */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir sobra?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. A sobra e todo o seu histórico serão excluídos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
