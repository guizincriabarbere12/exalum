// @ts-nocheck - Temporary fix until Supabase types are regenerated
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Search, Package, CheckCircle2, Clock, XCircle, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface Resultado {
  numero: string;
  status: string;
  orcamento_status: string | null;
  data_pedido: string;
  valor_total: number;
  observacoes: string | null;
  itens: { nome: string; quantidade: number }[];
}

function statusInfo(resultado: Resultado): { label: string; descricao: string; icon: any; variant: "secondary" | "default" | "destructive" } {
  if (resultado.status === "cancelado") {
    return { label: "Não aprovado", descricao: "Este pedido não pôde ser atendido.", icon: XCircle, variant: "destructive" };
  }
  if (resultado.status === "entregue") {
    return { label: "Entregue", descricao: "Seu pedido foi entregue.", icon: CheckCircle2, variant: "default" };
  }
  if (resultado.status === "enviado") {
    return { label: "Enviado", descricao: "Seu pedido está a caminho.", icon: Truck, variant: "default" };
  }
  if (resultado.status === "em_separacao") {
    return { label: "Em separação", descricao: "Seu pedido está sendo preparado.", icon: Package, variant: "default" };
  }
  if (resultado.status === "confirmado") {
    if (resultado.orcamento_status === "aprovado") {
      return { label: "Aprovado", descricao: "Seu pedido foi aprovado e está sendo preparado.", icon: CheckCircle2, variant: "default" };
    }
    if (resultado.orcamento_status === "rejeitado") {
      return { label: "Não aprovado", descricao: "Este pedido não pôde ser atendido.", icon: XCircle, variant: "destructive" };
    }
    return { label: "Em análise", descricao: "Estamos preparando o orçamento do seu pedido.", icon: Clock, variant: "secondary" };
  }
  return { label: "Recebido", descricao: "Seu pedido foi recebido e está aguardando análise.", icon: Clock, variant: "secondary" };
}

export default function AcompanharPedido() {
  const [searchParams] = useSearchParams();
  const [numero, setNumero] = useState(searchParams.get("numero") || "");
  const [telefone, setTelefone] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [naoEncontrado, setNaoEncontrado] = useState(false);

  const buscar = async () => {
    if (!numero || !telefone) {
      toast({ title: "Preencha os campos", description: "Informe o número do pedido e o telefone", variant: "destructive" });
      return;
    }

    setBuscando(true);
    setResultado(null);
    setNaoEncontrado(false);

    try {
      const { data, error } = await supabase.rpc("consultar_pedido_publico", {
        numero_param: numero.trim(),
        telefone_param: telefone.trim(),
      });

      if (error) throw error;

      if (!data.success) {
        setNaoEncontrado(true);
        return;
      }

      setResultado(data);
    } catch (error: any) {
      toast({ title: "Erro ao consultar pedido", description: error.message, variant: "destructive" });
    } finally {
      setBuscando(false);
    }
  };

  const info = resultado ? statusInfo(resultado) : null;
  const Icon = info?.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 py-8 px-4">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Acompanhar Pedido</h1>
          <p className="text-muted-foreground">Digite o número do pedido e o telefone usado na compra</p>
        </div>

        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="numero">Número do Pedido</Label>
              <Input id="numero" value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="PED-00000" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefone">Telefone</Label>
              <Input id="telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(00) 00000-0000" />
            </div>
            <Button className="w-full" onClick={buscar} disabled={buscando}>
              <Search className="h-4 w-4 mr-2" />
              {buscando ? "Buscando..." : "Consultar"}
            </Button>
          </CardContent>
        </Card>

        {naoEncontrado && (
          <Card className="border-destructive/30">
            <CardContent className="p-6 text-center text-muted-foreground">
              Pedido não encontrado. Confira o número e o telefone informados.
            </CardContent>
          </Card>
        )}

        {resultado && info && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{resultado.numero}</CardTitle>
                <Badge variant={info.variant} className="flex items-center gap-1">
                  <Icon className="h-3.5 w-3.5" />
                  {info.label}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{info.descricao}</p>

              <div className="space-y-2 pt-2 border-t">
                {resultado.itens.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span>{item.nome}</span>
                    <span className="font-medium">{item.quantidade}x</span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2 border-t font-semibold">
                <span>Total</span>
                <span>R$ {Number(resultado.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
              </div>

              {resultado.observacoes && (
                <p className="text-xs text-muted-foreground">Obs: {resultado.observacoes}</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
