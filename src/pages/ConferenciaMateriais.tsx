// @ts-nocheck - Temporary fix until Supabase types are regenerated
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ClipboardCheck, Camera, Check, PackageCheck, Clock, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { logActivity } from "@/lib/auditLog";
import { SignaturePad } from "@/components/SignaturePad";

interface Orcamento {
  id: string;
  numero: string;
  valor_total: number;
  clientes: { nome: string } | null;
}

interface ConferenciaStatus {
  id: string;
  status: string;
}

interface ItemOrcamento {
  id: string;
  produto_id: string | null;
  kit_id: string | null;
  quantidade: number;
  nome: string;
}

export default function ConferenciaMateriais() {
  const [orcamentos, setOrcamentos] = useState<Orcamento[]>([]);
  const [statusPorOrcamento, setStatusPorOrcamento] = useState<Record<string, ConferenciaStatus>>({});
  const [loading, setLoading] = useState(true);

  const [orcamentoAberto, setOrcamentoAberto] = useState<Orcamento | null>(null);
  const [conferenciaId, setConferenciaId] = useState<string | null>(null);
  const [conferenciaFinalizada, setConferenciaFinalizada] = useState<any | null>(null);
  const [itens, setItens] = useState<ItemOrcamento[]>([]);
  const [conferidoPorItem, setConferidoPorItem] = useState<Record<string, number>>({});
  const [quantidades, setQuantidades] = useState<Record<string, string>>({});
  const [fotos, setFotos] = useState<Record<string, string | null>>({});
  const [salvandoItem, setSalvandoItem] = useState<string | null>(null);

  const [assinaturaBase64, setAssinaturaBase64] = useState<string | null>(null);
  const [assinaturaNome, setAssinaturaNome] = useState("");
  const [assinaturaCargo, setAssinaturaCargo] = useState("");
  const [finalizando, setFinalizando] = useState(false);

  useEffect(() => {
    fetchOrcamentos();
  }, []);

  const fetchOrcamentos = async () => {
    try {
      const { data, error } = await supabase
        .from("orcamentos")
        .select("id, numero, valor_total, clientes ( nome )")
        .eq("status", "aprovado")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrcamentos(data || []);

      const ids = (data || []).map((o: Orcamento) => o.id);
      if (ids.length > 0) {
        const { data: conferencias } = await supabase
          .from("conferencia_materiais")
          .select("id, orcamento_id, status, created_at")
          .in("orcamento_id", ids)
          .order("created_at", { ascending: false });

        const mapa: Record<string, ConferenciaStatus> = {};
        (conferencias || []).forEach((c: any) => {
          if (!mapa[c.orcamento_id]) mapa[c.orcamento_id] = { id: c.id, status: c.status };
        });
        setStatusPorOrcamento(mapa);
      }
    } catch (error: any) {
      toast({ title: "Erro ao carregar orçamentos", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const abrirConferencia = async (orcamento: Orcamento) => {
    setOrcamentoAberto(orcamento);
    setConferenciaId(null);
    setConferenciaFinalizada(null);
    setItens([]);
    setConferidoPorItem({});
    setQuantidades({});
    setFotos({});
    setAssinaturaBase64(null);
    setAssinaturaNome("");
    setAssinaturaCargo("");

    const statusAtual = statusPorOrcamento[orcamento.id];

    if (statusAtual?.status === "finalizada") {
      const { data } = await supabase
        .from("conferencia_materiais")
        .select("*")
        .eq("id", statusAtual.id)
        .single();
      setConferenciaFinalizada(data);
      setConferenciaId(statusAtual.id);
      await carregarItens(orcamento.id, statusAtual.id);
      return;
    }

    try {
      const { data, error } = await supabase.rpc("iniciar_conferencia", { orcamento_id_param: orcamento.id });
      if (error) throw error;
      if (!data.success) {
        toast({ title: "Não foi possível iniciar", description: data.message, variant: "destructive" });
        setOrcamentoAberto(null);
        return;
      }
      setConferenciaId(data.conferencia_id);
      await carregarItens(orcamento.id, data.conferencia_id);
    } catch (error: any) {
      toast({ title: "Erro ao iniciar conferência", description: error.message, variant: "destructive" });
      setOrcamentoAberto(null);
    }
  };

  const carregarItens = async (orcamentoId: string, confId: string) => {
    const { data: itensData, error } = await supabase
      .from("orcamento_itens")
      .select("id, produto_id, kit_id, quantidade, produtos ( nome ), kits ( nome )")
      .eq("orcamento_id", orcamentoId);

    if (error) {
      toast({ title: "Erro ao carregar itens", description: error.message, variant: "destructive" });
      return;
    }

    const lista: ItemOrcamento[] = (itensData || []).map((i: any) => ({
      id: i.id,
      produto_id: i.produto_id,
      kit_id: i.kit_id,
      quantidade: i.quantidade,
      nome: i.produtos?.nome || i.kits?.nome || "Item",
    }));
    setItens(lista);

    const { data: historico } = await supabase
      .from("conferencia_historico")
      .select("produto_id, kit_id, quantidade")
      .eq("conferencia_id", confId);

    const somaPorItem: Record<string, number> = {};
    lista.forEach((item) => {
      const total = (historico || [])
        .filter((h: any) =>
          (item.produto_id && h.produto_id === item.produto_id) ||
          (item.kit_id && h.kit_id === item.kit_id)
        )
        .reduce((acc: number, h: any) => acc + Number(h.quantidade), 0);
      somaPorItem[item.id] = total;
    });
    setConferidoPorItem(somaPorItem);

    const quantidadesIniciais: Record<string, string> = {};
    lista.forEach((item) => {
      const restante = Math.max(0, item.quantidade - (somaPorItem[item.id] || 0));
      quantidadesIniciais[item.id] = String(restante);
    });
    setQuantidades(quantidadesIniciais);
  };

  const handleFoto = (itemId: string, file: File | null) => {
    if (!file) {
      setFotos((prev) => ({ ...prev, [itemId]: null }));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setFotos((prev) => ({ ...prev, [itemId]: reader.result as string }));
    reader.readAsDataURL(file);
  };

  const conferirItem = async (item: ItemOrcamento) => {
    const quantidade = parseInt(quantidades[item.id] || "0", 10);
    if (!quantidade || quantidade <= 0) {
      toast({ title: "Quantidade inválida", variant: "destructive" });
      return;
    }

    setSalvandoItem(item.id);
    try {
      const { data, error } = await supabase.rpc("registrar_item_conferencia", {
        conferencia_id_param: conferenciaId,
        orcamento_item_id_param: item.id,
        quantidade_param: quantidade,
        foto_base64_param: fotos[item.id] || null,
      });
      if (error) throw error;
      if (!data.success) {
        toast({ title: "Erro", description: data.message, variant: "destructive" });
        return;
      }

      await carregarItens(orcamentoAberto!.id, conferenciaId!);
      toast({ title: "Item conferido", description: `${item.nome}: +${quantidade}` });
    } catch (error: any) {
      toast({ title: "Erro ao conferir item", description: error.message, variant: "destructive" });
    } finally {
      setSalvandoItem(null);
    }
  };

  const todosConferidos = itens.length > 0 && itens.every((item) => (conferidoPorItem[item.id] || 0) >= item.quantidade);

  const finalizarConferencia = async () => {
    setFinalizando(true);
    try {
      const { data, error } = await supabase.rpc("finalizar_conferencia", {
        conferencia_id_param: conferenciaId,
        assinatura_base64_param: assinaturaBase64,
        assinatura_nome_param: assinaturaNome || null,
        assinatura_cargo_param: assinaturaCargo || null,
      });
      if (error) throw error;

      if (!data.success) {
        toast({ title: "Não foi possível finalizar", description: data.message, variant: "destructive" });
        return;
      }

      await logActivity({
        acao: "finalizar",
        entidade: "conferencia_materiais",
        entidadeId: conferenciaId!,
        descricao: `Finalizou a conferência do orçamento ${orcamentoAberto?.numero} e baixou o estoque`,
      });

      toast({ title: "Conferência finalizada!", description: "Estoque atualizado com sucesso" });
      setOrcamentoAberto(null);
      fetchOrcamentos();
    } catch (error: any) {
      toast({ title: "Erro ao finalizar", description: error.message, variant: "destructive" });
    } finally {
      setFinalizando(false);
    }
  };

  const statusBadge = (orcamentoId: string) => {
    const s = statusPorOrcamento[orcamentoId];
    if (!s || s.status === "cancelada") {
      return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Aguardando conferência</Badge>;
    }
    if (s.status === "em_andamento") {
      return <Badge variant="default"><AlertTriangle className="h-3 w-3 mr-1" />Em conferência</Badge>;
    }
    return <Badge variant="outline" className="border-green-600 text-green-600"><Check className="h-3 w-3 mr-1" />Conferido</Badge>;
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Conferência de Materiais</h2>
        <p className="text-muted-foreground">Confira item a item antes de liberar a entrega — o estoque só sai daqui</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PackageCheck className="h-5 w-5 text-primary" />
            Orçamentos Aprovados
          </CardTitle>
        </CardHeader>
        <CardContent>
          {orcamentos.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nenhum orçamento aprovado no momento.</div>
          ) : (
            <div className="space-y-3">
              {orcamentos.map((orcamento) => (
                <Card key={orcamento.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => abrirConferencia(orcamento)}>
                  <CardContent className="p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-semibold">{orcamento.numero}</p>
                      <p className="text-sm text-muted-foreground truncate">{orcamento.clientes?.nome || "Cliente"}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-semibold hidden sm:inline">
                        R$ {Number(orcamento.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                      {statusBadge(orcamento.id)}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!orcamentoAberto} onOpenChange={(open) => !open && setOrcamentoAberto(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              Conferência — {orcamentoAberto?.numero}
            </DialogTitle>
            <DialogDescription>
              {conferenciaFinalizada ? "Conferência finalizada" : "Confira a quantidade de cada item antes de liberar a entrega"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {itens.map((item) => {
              const conferido = conferidoPorItem[item.id] || 0;
              const completo = conferido >= item.quantidade;
              return (
                <Card key={item.id} className={completo ? "border-green-600/40" : ""}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{item.nome}</p>
                        <p className="text-sm text-muted-foreground">
                          {conferido} de {item.quantidade} conferido{item.quantidade > 1 ? "s" : ""}
                        </p>
                      </div>
                      {completo && <Check className="h-5 w-5 text-green-600 shrink-0" />}
                    </div>

                    {!completo && !conferenciaFinalizada && (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          className="w-24"
                          value={quantidades[item.id] || ""}
                          onChange={(e) => setQuantidades((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        />
                        <label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="hidden"
                            onChange={(e) => handleFoto(item.id, e.target.files?.[0] || null)}
                          />
                          <Button type="button" variant="outline" size="icon" asChild>
                            <span><Camera className="h-4 w-4" /></span>
                          </Button>
                        </label>
                        {fotos[item.id] && (
                          <img src={fotos[item.id]!} alt="" className="h-9 w-9 rounded object-cover border" />
                        )}
                        <Button
                          size="sm"
                          className="ml-auto"
                          onClick={() => conferirItem(item)}
                          disabled={salvandoItem === item.id}
                        >
                          Conferir
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            {conferenciaFinalizada ? (
              <div className="space-y-2 pt-2 border-t">
                <p className="text-sm text-muted-foreground">
                  Finalizada em {new Date(conferenciaFinalizada.data_fim).toLocaleString("pt-BR")}
                </p>
                {conferenciaFinalizada.assinatura_nome && (
                  <p className="text-sm">Assinado por: <strong>{conferenciaFinalizada.assinatura_nome}</strong> {conferenciaFinalizada.assinatura_cargo && `(${conferenciaFinalizada.assinatura_cargo})`}</p>
                )}
                {conferenciaFinalizada.assinatura_base64 && (
                  <img src={conferenciaFinalizada.assinatura_base64} alt="Assinatura" className="border rounded bg-white max-h-32" />
                )}
              </div>
            ) : todosConferidos ? (
              <div className="space-y-4 pt-4 border-t">
                <p className="font-medium text-green-600 flex items-center gap-2">
                  <Check className="h-4 w-4" /> Todos os itens conferidos
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Nome de quem recebeu/conferiu</Label>
                    <Input value={assinaturaNome} onChange={(e) => setAssinaturaNome(e.target.value)} placeholder="Nome completo" />
                  </div>
                  <div className="space-y-1">
                    <Label>Cargo</Label>
                    <Input value={assinaturaCargo} onChange={(e) => setAssinaturaCargo(e.target.value)} placeholder="Ex: Motorista, Cliente" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label>Assinatura</Label>
                  <SignaturePad onChange={setAssinaturaBase64} />
                </div>
                <Button className="w-full" size="lg" onClick={finalizarConferencia} disabled={finalizando}>
                  {finalizando ? "Finalizando..." : "Finalizar Conferência e Baixar Estoque"}
                </Button>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
