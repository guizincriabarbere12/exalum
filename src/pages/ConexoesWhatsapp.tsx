import { useEffect, useState } from "react";
import { Plus, Loader2, CheckCircle2, MessageCircle, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Vendedor {
  id: string;
  nome: string;
  email: string;
}

export default function ConexoesWhatsapp() {
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [estados, setEstados] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [conectandoId, setConectandoId] = useState<string | null>(null);
  const [qrPorVendedor, setQrPorVendedor] = useState<Record<string, string>>({});

  const [nomeNovo, setNomeNovo] = useState("");
  const [emailNovo, setEmailNovo] = useState("");
  const [salvandoNovo, setSalvandoNovo] = useState(false);

  useEffect(() => {
    carregar();
  }, []);

  const carregar = async () => {
    setCarregando(true);
    const { data } = await supabase.from("vendedores").select("id, nome, email").order("nome");
    const lista = (data as Vendedor[]) || [];
    setVendedores(lista);

    const novosEstados: Record<string, string> = {};
    await Promise.all(
      lista.map(async (v) => {
        const { data: statusData } = await supabase.functions.invoke(`crm-whatsapp-instancia?vendedorId=${v.id}`, {
          method: "GET",
        });
        novosEstados[v.id] = statusData?.estado || "desconhecido";
      })
    );
    setEstados(novosEstados);
    setCarregando(false);
  };

  const adicionarVendedor = async () => {
    if (!nomeNovo.trim() || !emailNovo.trim()) {
      toast.error("Preencha nome e e-mail");
      return;
    }
    setSalvandoNovo(true);
    const { error } = await supabase.from("vendedores").insert({
      nome: nomeNovo.trim(),
      email: emailNovo.trim(),
      comissao_percentual: 0,
      ativo: true,
    });
    setSalvandoNovo(false);
    if (error) {
      toast.error("Erro ao adicionar vendedor", { description: error.message });
      return;
    }
    setNomeNovo("");
    setEmailNovo("");
    toast.success("Vendedor adicionado!");
    carregar();
  };

  const conectar = async (vendedorId: string) => {
    setConectandoId(vendedorId);
    try {
      const buscarNovoQr = async () => {
        const { data, error } = await supabase.functions.invoke("crm-whatsapp-instancia", {
          method: "POST",
          body: { vendedorId },
        });
        if (error || data?.erro) {
          toast.error("Erro ao conectar", { description: data?.erro || error?.message });
          return false;
        }
        if (data?.qrcodeBase64) {
          setQrPorVendedor((prev) => ({ ...prev, [vendedorId]: data.qrcodeBase64 }));
        }
        return true;
      };

      const ok = await buscarNovoQr();
      if (!ok) return;
      setEstados((prev) => ({ ...prev, [vendedorId]: "connecting" }));

      let tique = 0;
      const intervalo = setInterval(async () => {
        tique++;
        const { data: statusData } = await supabase.functions.invoke(`crm-whatsapp-instancia?vendedorId=${vendedorId}`, {
          method: "GET",
        });
        if (statusData?.estado === "open") {
          setEstados((prev) => ({ ...prev, [vendedorId]: "open" }));
          setQrPorVendedor((prev) => {
            const { [vendedorId]: _remover, ...resto } = prev;
            return resto;
          });
          clearInterval(intervalo);
          return;
        }
        // o QR code do WhatsApp expira sozinho a cada ~40-50s - busca um novo
        // periodicamente pra tela nunca ficar mostrando um código já expirado
        if (tique % 6 === 0) {
          await buscarNovoQr();
        }
      }, 4000);
    } finally {
      setConectandoId(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold">Conexões de WhatsApp</h1>
        <p className="text-sm text-muted-foreground">
          Cadastre vendedores e conecte o WhatsApp de cada um — tudo aqui, numa tela só.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-3 pt-6">
          <p className="text-sm font-semibold">Novo vendedor</p>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={nomeNovo} onChange={(e) => setNomeNovo(e.target.value)} placeholder="Nome do vendedor" />
            </div>
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input value={emailNovo} onChange={(e) => setEmailNovo(e.target.value)} placeholder="email@exemplo.com" />
            </div>
            <div className="flex items-end">
              <Button onClick={adicionarVendedor} disabled={salvandoNovo} className="w-full sm:w-auto">
                <Plus className="mr-1.5 h-4 w-4" /> Adicionar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {carregando ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : vendedores.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">Nenhum vendedor cadastrado ainda.</p>
          ) : (
            <div className="space-y-3">
              {vendedores.map((v) => {
                const estado = estados[v.id];
                const conectado = estado === "open";
                const qr = qrPorVendedor[v.id];
                return (
                  <div key={v.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{v.nome}</p>
                        <p className="text-xs text-muted-foreground">{v.email}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {conectado && (
                          <Badge className="gap-1 bg-green-100 text-green-800 hover:bg-green-100">
                            <CheckCircle2 className="h-3 w-3" /> Conectado
                          </Badge>
                        )}
                        <Button size="sm" variant="outline" onClick={() => conectar(v.id)} disabled={conectandoId === v.id}>
                          {conectado ? <RefreshCw className="mr-1 h-3.5 w-3.5" /> : <MessageCircle className="mr-1 h-3.5 w-3.5" />}
                          {conectandoId === v.id
                            ? "Gerando..."
                            : conectado
                              ? "Gerar novo QR code"
                              : "Conectar"}
                        </Button>
                      </div>
                    </div>
                    {qr && (
                      <div className="mt-3 flex flex-col items-center gap-1.5">
                        <img src={qr} alt={`QR code de ${v.nome}`} width={220} height={220} className="rounded border" />
                        <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Loader2 className="h-3 w-3 animate-spin" /> Aguardando {v.nome} escanear...
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
