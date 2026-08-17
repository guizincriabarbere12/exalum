// @ts-nocheck
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Building2, Plus, Search, RefreshCw, Pencil, Trash2, MapPin, Phone, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Filial {
  id: string; nome: string; codigo: string; endereco: string; cidade: string;
  estado: string; telefone: string; email: string; ativo: boolean; created_at: string;
}

export default function Filiais() {
  const [filiais, setFiliais] = useState<Filial[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogAberto, setDialogAberto] = useState(false);
  const [filialEditando, setFilialEditando] = useState<Filial | null>(null);
  const [form, setForm] = useState({ nome: "", codigo: "", endereco: "", cidade: "", estado: "", telefone: "", email: "", ativo: true });
  const [dialogExcluirAberto, setDialogExcluirAberto] = useState(false);
  const [filialParaExcluir, setFilialParaExcluir] = useState<Filial | null>(null);

  const carregarFiliais = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from("filiais").select("*").order("nome");
      if (error) throw error;
      setFiliais(data || []);
    } catch (error: any) {
      toast({ title: "Erro ao carregar filiais", description: error.message, variant: "destructive" });
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { carregarFiliais(); }, [carregarFiliais]);

  const filiaisFiltradas = filiais.filter((f) =>
    f.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.codigo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.cidade?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const abrirDialogNovo = () => {
    setFilialEditando(null);
    setForm({ nome: "", codigo: "", endereco: "", cidade: "", estado: "", telefone: "", email: "", ativo: true });
    setDialogAberto(true);
  };

  const abrirDialogEditar = (filial: Filial) => {
    setFilialEditando(filial);
    setForm({ nome: filial.nome, codigo: filial.codigo || "", endereco: filial.endereco || "", cidade: filial.cidade || "", estado: filial.estado || "", telefone: filial.telefone || "", email: filial.email || "", ativo: filial.ativo });
    setDialogAberto(true);
  };

  const handleSalvar = async () => {
    if (!form.nome.trim()) { toast({ title: "Nome é obrigatório", variant: "destructive" }); return; }
    try {
      if (filialEditando) {
        const { error } = await supabase.from("filiais").update({ ...form, updated_at: new Date().toISOString() }).eq("id", filialEditando.id);
        if (error) throw error;
        toast({ title: "Filial atualizada!", description: form.nome });
      } else {
        const { error } = await supabase.from("filiais").insert(form);
        if (error) throw error;
        toast({ title: "Filial criada!", description: form.nome });
      }
      setDialogAberto(false);
      await carregarFiliais();
    } catch (error: any) {
      toast({ title: "Erro ao salvar filial", description: error.message, variant: "destructive" });
    }
  };

  const handleExcluir = async () => {
    if (!filialParaExcluir) return;
    try {
      const { error } = await supabase.from("filiais").delete().eq("id", filialParaExcluir.id);
      if (error) throw error;
      toast({ title: "Filial excluída", description: filialParaExcluir.nome });
      setDialogExcluirAberto(false); setFilialParaExcluir(null);
      await carregarFiliais();
    } catch (error: any) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3"><Building2 className="h-8 w-8 text-primary" /> Filiais</h1>
          <p className="text-muted-foreground mt-1">Gerencie as filiais e faça transferências de estoque entre elas</p>
        </div>
        <Button onClick={abrirDialogNovo} className="bg-primary hover:bg-primary/90"><Plus className="mr-2 h-4 w-4" /> Nova Filial</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-muted-foreground">Total de Filiais</p><p className="text-2xl font-bold">{filiais.length}</p></div><div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10"><Building2 className="h-6 w-6 text-primary" /></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-muted-foreground">Ativas</p><p className="text-2xl font-bold text-green-600">{filiais.filter(f => f.ativo).length}</p></div><div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100"><Building2 className="h-6 w-6 text-green-600" /></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="flex items-center justify-between"><div><p className="text-sm font-medium text-muted-foreground">Inativas</p><p className="text-2xl font-bold text-red-600">{filiais.filter(f => !f.ativo).length}</p></div><div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-100"><Building2 className="h-6 w-6 text-red-600" /></div></div></CardContent></Card>
      </div>

      <Card><CardContent className="pt-6">
        <div className="flex justify-between items-center gap-4 mb-4">
          <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input placeholder="Buscar filiais..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" /></div>
          <Button variant="outline" onClick={carregarFiliais}><RefreshCw className="h-4 w-4" /></Button>
        </div>
        {loading ? (
          <div className="text-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div><p className="mt-4 text-muted-foreground">Carregando filiais...</p></div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="font-bold">Código</TableHead><TableHead className="font-bold">Nome</TableHead>
                <TableHead className="font-bold">Endereço</TableHead><TableHead className="font-bold">Contato</TableHead>
                <TableHead className="font-bold">Status</TableHead><TableHead className="font-bold text-right">Ações</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filiaisFiltradas.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{searchTerm ? "Nenhuma filial encontrada." : "Nenhuma filial cadastrada. Clique em 'Nova Filial' para começar."}</TableCell></TableRow>
                ) : filiaisFiltradas.map((filial) => (
                  <TableRow key={filial.id} className="hover:bg-muted/50">
                    <TableCell className="font-mono">{filial.codigo || "-"}</TableCell>
                    <TableCell className="font-medium">{filial.nome}</TableCell>
                    <TableCell>{filial.endereco || filial.cidade ? (<div className="flex items-start gap-1 text-sm"><MapPin className="h-3 w-3 text-muted-foreground mt-0.5" /><span>{[filial.endereco, filial.cidade, filial.estado].filter(Boolean).join(", ")}</span></div>) : "-"}</TableCell>
                    <TableCell><div className="flex flex-col gap-0.5 text-sm">{filial.telefone && <span className="flex items-center gap-1"><Phone className="h-3 w-3 text-muted-foreground" />{filial.telefone}</span>}{filial.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3 text-muted-foreground" />{filial.email}</span>}{!filial.telefone && !filial.email && "-"}</div></TableCell>
                    <TableCell><Badge variant="outline" className={filial.ativo ? "bg-green-100 text-green-800 border-green-200" : "bg-red-100 text-red-800 border-red-200"}>{filial.ativo ? "Ativa" : "Inativa"}</Badge></TableCell>
                    <TableCell className="text-right"><div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => abrirDialogEditar(filial)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-600 hover:text-red-700" onClick={() => { setFilialParaExcluir(filial); setDialogExcluirAberto(true); }} title="Excluir"><Trash2 className="h-4 w-4" /></Button>
                    </div></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent></Card>

      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" />{filialEditando ? "Editar Filial" : "Nova Filial"}</DialogTitle><DialogDescription>Cadastre ou edite as informações da filial.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Nome da filial" /></div>
              <div className="space-y-2"><Label>Código</Label><Input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} placeholder="Ex: FIL-01" /></div>
            </div>
            <div className="space-y-2"><Label>Endereço</Label><Input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} placeholder="Rua, número..." /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Cidade</Label><Input value={form.cidade} onChange={(e) => setForm({ ...form, cidade: e.target.value })} /></div>
              <div className="space-y-2"><Label>Estado</Label><Input value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} placeholder="UF" maxLength={2} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Telefone</Label><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></div>
              <div className="space-y-2"><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            </div>
            <div className="flex items-center gap-2"><input type="checkbox" id="ativo" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} className="rounded" /><Label htmlFor="ativo">Filial ativa</Label></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogAberto(false)}>Cancelar</Button><Button onClick={handleSalvar} className="bg-primary">{filialEditando ? "Salvar" : "Criar Filial"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={dialogExcluirAberto} onOpenChange={setDialogExcluirAberto}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Excluir Filial</AlertDialogTitle><AlertDialogDescription>Tem certeza que deseja excluir a filial "{filialParaExcluir?.nome}"? Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleExcluir} className="bg-red-600 hover:bg-red-700 text-white">Excluir</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
