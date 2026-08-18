// @ts-nocheck - Temporary fix until Supabase types are regenerated
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";

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
  requisicao_itens: RequisicaoItem[];
}

const statusVariant = {
  pendente: "secondary",
  aprovado: "default",
  rejeitado: "destructive",
} as const;

const statusLabel = {
  pendente: "Aguardando aprovação",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
} as const;

export default function MeusPedidosSerralheiro() {
  const { user } = useAuth();
  const [requisicoes, setRequisicoes] = useState<Requisicao[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState<string | null>(null);

  useEffect(() => {
    if (user) fetchRequisicoes();
  }, [user]);

  const fetchRequisicoes = async () => {
    try {
      const { data, error } = await supabase
        .from("requisicoes_material")
        .select(`
          id, numero, status, observacoes, motivo_rejeicao, created_at,
          requisicao_itens ( id, quantidade, produtos ( nome ), kits ( nome ) )
        `)
        .eq("solicitante_id", user!.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRequisicoes(data || []);
    } catch (error: any) {
      toast({ title: "Erro ao carregar pedidos", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-muted-foreground">Carregando pedidos...</div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold text-foreground">Meus Pedidos</h2>
        <p className="text-muted-foreground">Acompanhe o status das suas requisições de material</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Histórico de Requisições
          </CardTitle>
        </CardHeader>
        <CardContent>
          {requisicoes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Você ainda não fez nenhum pedido.</div>
          ) : (
            <div className="space-y-3">
              {requisicoes.map((req) => (
                <Card key={req.id}>
                  <CardContent className="p-4">
                    <button
                      className="w-full flex items-center justify-between gap-4 text-left"
                      onClick={() => setExpandido(expandido === req.id ? null : req.id)}
                    >
                      <div className="flex items-center gap-3">
                        {expandido === req.id ? (
                          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <div>
                          <p className="font-semibold">{req.numero}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(req.created_at).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                      </div>
                      <Badge variant={statusVariant[req.status as keyof typeof statusVariant] || "secondary"}>
                        {statusLabel[req.status as keyof typeof statusLabel] || req.status}
                      </Badge>
                    </button>

                    {expandido === req.id && (
                      <div className="mt-4 pt-4 border-t space-y-2">
                        {req.requisicao_itens.map((item) => (
                          <div key={item.id} className="flex items-center justify-between text-sm">
                            <span>{item.produtos?.nome || item.kits?.nome}</span>
                            <span className="font-medium">{item.quantidade}x</span>
                          </div>
                        ))}
                        {req.observacoes && (
                          <p className="text-sm text-muted-foreground pt-2">Obs: {req.observacoes}</p>
                        )}
                        {req.status === "rejeitado" && req.motivo_rejeicao && (
                          <p className="text-sm text-destructive pt-2">Motivo: {req.motivo_rejeicao}</p>
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
    </div>
  );
}
