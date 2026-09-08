// @ts-nocheck - Temporary fix until Supabase types are regenerated
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCircle2, Loader as Loader2, FileSignature, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { SignaturePad } from "@/components/SignaturePad";

interface Item {
  nome: string;
  quantidade: number;
  preco_unitario: number;
  subtotal: number;
}

interface Pedido {
  numero: string;
  valor_total: number;
  observacoes: string | null;
  cliente_nome: string;
  empresa: string;
  ja_assinado: boolean;
  assinatura_nome: string | null;
  assinatura_data: string | null;
  itens: Item[];
}

const formatCurrency = (v: number) =>
  `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export default function AssinarPedido() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [pedido, setPedido] = useState<Pedido | null>(null);

  const [nome, setNome] = useState("");
  const [cargo, setCargo] = useState("");
  const [modoDesenho, setModoDesenho] = useState(true);
  const [assinaturaBase64, setAssinaturaBase64] = useState<string | null>(null);
  const [confirmaDigital, setConfirmaDigital] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [assinado, setAssinado] = useState(false);

  useEffect(() => {
    if (!token) {
      setErro("Link inválido. Solicite um novo link à empresa.");
      setCarregando(false);
      return;
    }

    (async () => {
      try {
        const { data, error } = await supabase.rpc("buscar_pedido_assinatura", {
          token_param: token,
        });
        if (error) throw error;

        if (!data?.success) {
          setErro(data?.message || "Não foi possível carregar o pedido.");
          return;
        }

        setPedido(data);
        if (data.ja_assinado) setAssinado(true);
      } catch (e: any) {
        setErro(e.message || "Erro ao carregar o pedido.");
      } finally {
        setCarregando(false);
      }
    })();
  }, [token]);

  const enviar = async () => {
    if (nome.trim().length < 3) {
      toast({ title: "Informe seu nome completo", variant: "destructive" });
      return;
    }
    if (modoDesenho && !assinaturaBase64) {
      toast({ title: "Desenhe sua assinatura na área indicada", variant: "destructive" });
      return;
    }
    if (!modoDesenho && !confirmaDigital) {
      toast({ title: "Marque a confirmação para assinar digitalmente", variant: "destructive" });
      return;
    }

    setEnviando(true);
    try {
      const { data, error } = await supabase.rpc("assinar_pedido", {
        token_param: token,
        nome_param: nome.trim(),
        tipo_param: modoDesenho ? "manuscrita" : "digital",
        cargo_param: cargo.trim() || null,
        imagem_param: modoDesenho ? assinaturaBase64 : null,
      });
      if (error) throw error;

      if (!data?.success) {
        toast({ title: "Não foi possível assinar", description: data?.message, variant: "destructive" });
        return;
      }

      setAssinado(true);
      toast({ title: "✅ Pedido assinado!", description: "Obrigado. A empresa foi notificada." });
    } catch (e: any) {
      toast({ title: "Erro ao assinar", description: e.message, variant: "destructive" });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10 py-8 px-4">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground flex items-center justify-center gap-2">
            <FileSignature className="h-7 w-7" />
            Assinatura do Pedido
          </h1>
          {pedido && <p className="text-muted-foreground">{pedido.empresa}</p>}
        </div>

        {carregando && (
          <Card>
            <CardContent className="p-10 flex flex-col items-center gap-3 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              Carregando pedido...
            </CardContent>
          </Card>
        )}

        {!carregando && erro && (
          <Card className="border-destructive/30">
            <CardContent className="p-6 text-center text-muted-foreground flex flex-col items-center gap-2">
              <XCircle className="h-8 w-8 text-destructive" />
              {erro}
            </CardContent>
          </Card>
        )}

        {!carregando && pedido && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{pedido.numero}</span>
                <span className="text-base font-semibold">{formatCurrency(pedido.valor_total)}</span>
              </CardTitle>
              <p className="text-sm text-muted-foreground">Cliente: {pedido.cliente_nome}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 border-t pt-3">
                {pedido.itens.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span className="pr-2">{item.nome}</span>
                    <span className="text-muted-foreground whitespace-nowrap">
                      {item.quantidade}x &middot; {formatCurrency(item.subtotal)}
                    </span>
                  </div>
                ))}
              </div>

              {pedido.observacoes && (
                <p className="text-xs text-muted-foreground border-t pt-2">Obs: {pedido.observacoes}</p>
              )}

              {assinado ? (
                <div className="border-t pt-4 flex flex-col items-center gap-2 text-center">
                  <CheckCircle2 className="h-10 w-10 text-green-600" />
                  <p className="font-medium text-green-700">Pedido assinado</p>
                  <p className="text-sm text-muted-foreground">
                    {pedido.assinatura_nome
                      ? `Assinado por ${pedido.assinatura_nome}`
                      : `Assinado por ${nome}`}
                    {pedido.assinatura_data
                      ? ` em ${new Date(pedido.assinatura_data).toLocaleString("pt-BR")}`
                      : ""}
                  </p>
                </div>
              ) : (
                <div className="space-y-4 border-t pt-4">
                  <div className="space-y-1">
                    <Label>Seu nome completo</Label>
                    <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome de quem assina" />
                  </div>
                  <div className="space-y-1">
                    <Label>Cargo / documento (opcional)</Label>
                    <Input value={cargo} onChange={(e) => setCargo(e.target.value)} placeholder="Ex: Responsável, CPF..." />
                  </div>

                  <div className="flex rounded-lg border overflow-hidden text-sm">
                    <button
                      type="button"
                      className={`flex-1 py-2 ${modoDesenho ? "bg-primary text-primary-foreground" : "bg-background"}`}
                      onClick={() => setModoDesenho(true)}
                    >
                      Desenhar assinatura
                    </button>
                    <button
                      type="button"
                      className={`flex-1 py-2 ${!modoDesenho ? "bg-primary text-primary-foreground" : "bg-background"}`}
                      onClick={() => setModoDesenho(false)}
                    >
                      Assinar digitalmente
                    </button>
                  </div>

                  {modoDesenho ? (
                    <div className="space-y-1">
                      <Label>Assinatura</Label>
                      <SignaturePad onChange={setAssinaturaBase64} />
                    </div>
                  ) : (
                    <label className="flex items-start gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={confirmaDigital}
                        onCheckedChange={(v) => setConfirmaDigital(v === true)}
                        className="mt-0.5"
                      />
                      <span>
                        Declaro que li e concordo com o pedido <strong>{pedido.numero}</strong> no valor de{" "}
                        <strong>{formatCurrency(pedido.valor_total)}</strong>, e assino digitalmente com meu nome.
                      </span>
                    </label>
                  )}

                  <Button className="w-full" size="lg" onClick={enviar} disabled={enviando}>
                    {enviando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSignature className="h-4 w-4 mr-2" />}
                    {enviando ? "Enviando..." : "Assinar pedido"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
