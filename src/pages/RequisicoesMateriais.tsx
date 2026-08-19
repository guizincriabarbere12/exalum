// @ts-nocheck - Temporary fix until Supabase types are regenerated
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ClipboardList, Check, X, ChevronDown, ChevronRight, Hammer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { logActivity } from "@/lib/auditLog";

interface RequisicaoItem {
  id: string;
  quantidade: number;
  produtos: { nome: string } | null;
  kits: { nome: string } | null;
}

interface Requisicao {
  id: string;
  numero: string;
  status: string;
  observacoes: string | null;
  motivo_rejeicao: string | null;
  created_at: string;
  solicitante_id: string;
  requisicao_itens: RequisicaoItem[];
}

const statusVariant = {
  pendente: "secondary",
  aprovado: "default",
  rejeitado: "destructive",
} as const;

const statusLabel = {
  pendente: "Pendente",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
} as const;

export default function RequisicoesMateriais() {
  const [requisicoes, setRequisicoes] = useState<Requisicao[]>([]);
  const [solicitantes, setSolicitantes] = useState<Record<string, string>>({});
  const [clientes, setClientes] = useState<{ id: string; nome: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState<string | null>(null);
  const [processando, setProcessando] = useState<string | null>(null);
  const [rejeicaoAlvo, setRejeicaoAlvo] = useState<Requisicao | null>(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState("");

  const [aprovacaoAlvo, setAprovacaoAlvo] = useState<Requisicao | null>(null);
  const [cobrar, setCobrar] = useState(false);
  const [clienteSelecionado, setClienteSelecionado] = useState("");

  useEffect(() => {
    fetchRequisicoes();
    fetchClientes();
  }, []);

  const fetchClientes = async () => {
    const { data } = await supabase.from("clientes").select("id, nome").order("nome");
    setClientes(data || []);
  };

  const fetchRequisicoes = async () => {
    try {
      const { data, error } = await supabase
        .from("requisicoes_material")
        .select(`
          id, numero, status, observacoes, motivo_rejeicao, created_at, solicitante_id,
          requisicao_itens ( id, quantidade, produtos ( nome ), kits ( nome ) )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRequisicoes(data || []);

      const { data: usuarios } = await supabase.rpc("get_users_with_roles");
      if (usuarios) {
        const map: Record<string, string> = {};
        usuarios.forEach((u: any) => { map[u.id] = u.email; });
        setSolicitantes(map);
      }
    } catch (error: any) {
      toast({ title: "Erro ao carregar requisições", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const abrirAprovacao = (req: Requisicao) => {
    setAprovacaoAlvo(req);
    setCobrar(false);
    setClienteSelecionado("");
  };

  const confirmarAprovacao = async () => {
    if (!aprovacaoAlvo) return;

    if (cobrar && !clienteSelecionado) {
      toast({ title: "Escolha um cliente", variant: "destructive" });
      return;
    }

    setProcessando(aprovacaoAlvo.id);
    try {
      if (cobrar) {
        const { data, error } = await supabase.rpc("converter_requisicao_em_orcamento", {
          requisicao_id_param: aprovacaoAlvo.id,
          cliente_id_param: clienteSelecionado,
        });
        if (error) throw error;

        if (!data.success) {
          toast({ title: "Não foi possível converter", description: data.message, variant: "destructive" });
          return;
        }

        await logActivity({
          acao: "aprovar",
          entidade: "requisicao_material",
          entidadeId: aprovacaoAlvo.id,
          descricao: `Converteu a requisição ${aprovacaoAlvo.numero} no orçamento ${data.orcamento_numero} para cobrança`,
        });

        toast({
          title: "Orçamento criado!",
          description: `Requisição virou o orçamento ${data.orcamento_numero}, agora segue o fluxo normal de aprovação`,
        });
      } else {
        const { data, error } = await supabase.rpc("aprovar_requisicao_material", {
          requisicao_id_param: aprovacaoAlvo.id,
        });
        if (error) throw error;

        if (!data.success) {
          toast({ title: "Não foi possível aprovar", description: data.message, variant: "destructive" });
          return;
        }

        await logActivity({
          acao: "aprovar",
          entidade: "requisicao_material",
          entidadeId: aprovacaoAlvo.id,
          descricao: `Aprovou a requisição de material ${aprovacaoAlvo.numero} (uso interno)`,
        });

        toast({ title: "Requisição aprovada", description: "Estoque atualizado com sucesso" });
      }

      setAprovacaoAlvo(null);
      fetchRequisicoes();
    } catch (error: any) {
      toast({ title: "Erro ao processar", description: error.message, variant: "destructive" });
    } finally {
      setProcessando(null);
    }
  };

  const confirmarRejeicao = async () => {
    if (!rejeicaoAlvo) return;
    setProcessando(rejeicaoAlvo.id);
    try {
      const { data, error } = await supabase.rpc("rejeitar_requisicao_material", {
        requisicao_id_param: rejeicaoAlvo.id,
        motivo_param: motivoRejeicao || null,
      });
      if (error) throw error;

      if (!data.success) {
        toast({ title: "Não foi possível rejeitar", description: data.message, variant: "destructive" });
        return;
      }

      await logActivity({
        acao: "rejeitar",
        entidade: "requisicao_material",
        entidadeId: rejeicaoAlvo.id,
        descricao: `Rejeitou a requisição de material ${rejeicaoAlvo.numero}`,
      });

      toast({ title: "Requisição rejeitada" });
      setRejeicaoAlvo(null);
      setMotivoRejeicao("");
      fetchRequisicoes();
    } catch (error: any) {
      toast({ title: "Erro ao rejeitar", description: error.message, variant: "destructive" });
    } finally {
      setProcessando(null);
    }
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Carregando requisições...</div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Requisições de Material</h2>
        <p className="text-muted-foreground">Pedidos internos (ex: serralheiro) aguardando aprovação</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Solicitações
          </CardTitle>
        </CardHeader>
        <CardContent>
          {requisicoes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nenhuma requisição registrada.</div>
          ) : (
            <div className="space-y-3">
              {requisicoes.map((req) => (
                <Card key={req.id}>
                  <CardContent className="p-4">
                    <button
                      className="w-full flex items-center justify-between gap-4 text-left"
                      onClick={() => setExpandido(expandido === req.id ? null : req.id)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {expandido === req.id ? (
                          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <Hammer className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="font-semibold">{req.numero}</p>
                          <p className="text-sm text-muted-foreground truncate">
                            {solicitantes[req.solicitante_id] || "Usuário"} · {new Date(req.created_at).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                      </div>
                      <Badge variant={statusVariant[req.status as keyof typeof statusVariant] || "secondary"}>
                        {statusLabel[req.status as keyof typeof statusLabel] || req.status}
                      </Badge>
                    </button>

                    {expandido === req.id && (
                      <div className="mt-4 pt-4 border-t space-y-3">
                        <div className="space-y-2">
                          {req.requisicao_itens.map((item) => (
                            <div key={item.id} className="flex items-center justify-between text-sm">
                              <span>{item.produtos?.nome || item.kits?.nome}</span>
                              <span className="font-medium">{item.quantidade}x</span>
                            </div>
                          ))}
                        </div>
                        {req.observacoes && (
                          <p className="text-sm text-muted-foreground">Obs: {req.observacoes}</p>
                        )}
                        {req.status === "rejeitado" && req.motivo_rejeicao && (
                          <p className="text-sm text-destructive">Motivo da rejeição: {req.motivo_rejeicao}</p>
                        )}

                        {req.status === "pendente" && (
                          <div className="flex gap-2 pt-2">
                            <Button
                              size="sm"
                              onClick={() => abrirAprovacao(req)}
                              disabled={processando === req.id}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              Aprovar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => setRejeicaoAlvo(req)}
                              disabled={processando === req.id}
                            >
                              <X className="h-4 w-4 mr-1" />
                              Rejeitar
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!aprovacaoAlvo} onOpenChange={(open) => !open && setAprovacaoAlvo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprovar requisição {aprovacaoAlvo?.numero}</DialogTitle>
            <DialogDescription>Escolha se esse material é uso interno ou deve ser cobrado de um cliente</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                type="button"
                variant={!cobrar ? "default" : "outline"}
                className="flex-1"
                onClick={() => setCobrar(false)}
              >
                Uso interno
              </Button>
              <Button
                type="button"
                variant={cobrar ? "default" : "outline"}
                className="flex-1"
                onClick={() => setCobrar(true)}
              >
                Cobrar do cliente
              </Button>
            </div>

            {cobrar && (
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Select value={clienteSelecionado} onValueChange={setClienteSelecionado}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Vai gerar um orçamento com os itens da requisição, para você aprovar normalmente. O estoque só sai quando esse orçamento for aprovado.
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAprovacaoAlvo(null)}>Cancelar</Button>
            <Button onClick={confirmarAprovacao} disabled={processando === aprovacaoAlvo?.id}>
              {cobrar ? "Criar Orçamento" : "Aprovar (uso interno)"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejeicaoAlvo} onOpenChange={(open) => !open && setRejeicaoAlvo(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar requisição {rejeicaoAlvo?.numero}</DialogTitle>
          </DialogHeader>
          <Textarea
            placeholder="Motivo da rejeição (opcional)"
            value={motivoRejeicao}
            onChange={(e) => setMotivoRejeicao(e.target.value)}
            rows={3}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejeicaoAlvo(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmarRejeicao} disabled={processando === rejeicaoAlvo?.id}>
              Confirmar Rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
