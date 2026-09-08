import { useEffect, useRef, useState } from "react";
import { MessageCircle, Loader2, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Estado = "carregando" | "desconectado" | "aguardando_qrcode" | "conectado";

export default function WhatsappVendedor() {
  const [estado, setEstado] = useState<Estado>("carregando");
  const [qrcode, setQrcode] = useState<string | null>(null);
  const [conectando, setConectando] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const pararPoll = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const verificarStatus = async () => {
    const { data, error } = await supabase.functions.invoke("crm-whatsapp-instancia", { method: "GET" });
    if (error) return null;
    return data?.estado as string | undefined;
  };

  useEffect(() => {
    (async () => {
      const est = await verificarStatus();
      setEstado(est === "open" ? "conectado" : "desconectado");
    })();
    return () => pararPoll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buscarNovoQr = async () => {
    const { data, error } = await supabase.functions.invoke("crm-whatsapp-instancia", { method: "POST" });
    if (error || data?.erro) {
      toast.error("Erro ao conectar", { description: data?.erro || error?.message });
      return false;
    }
    if (!data?.qrcodeBase64) {
      toast.error("Não recebemos o QR code. Tenta de novo em alguns segundos.");
      return false;
    }
    setQrcode(data.qrcodeBase64);
    return true;
  };

  const conectar = async () => {
    setConectando(true);
    try {
      const ok = await buscarNovoQr();
      if (!ok) return;
      setEstado("aguardando_qrcode");

      pararPoll();
      let tique = 0;
      pollRef.current = setInterval(async () => {
        tique++;
        const est = await verificarStatus();
        if (est === "open") {
          setEstado("conectado");
          setQrcode(null);
          pararPoll();
          return;
        }
        // o QR code do WhatsApp expira sozinho a cada ~40-50s - busca um novo
        // periodicamente pra tela nunca ficar mostrando um código ja expirado
        if (tique % 6 === 0) {
          await buscarNovoQr();
        }
      }, 4000);
    } finally {
      setConectando(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-bold">Meu WhatsApp</h1>
        <p className="text-sm text-muted-foreground">
          Conecte seu número de WhatsApp pra que suas conversas com clientes apareçam no CRM.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center gap-4 pt-6 text-center">
          {estado === "carregando" && <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />}

          {estado === "conectado" && (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-700">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <p className="font-semibold">WhatsApp conectado</p>
              <p className="text-sm text-muted-foreground">
                Suas mensagens já estão aparecendo no CRM de conversas.
              </p>
              <Button variant="outline" size="sm" onClick={conectar} disabled={conectando}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Reconectar / trocar número
              </Button>
            </>
          )}

          {estado === "desconectado" && (
            <>
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <MessageCircle className="h-7 w-7" />
              </div>
              <p className="font-semibold">WhatsApp não conectado</p>
              <p className="text-sm text-muted-foreground">
                Clique abaixo, escaneie o QR code com o WhatsApp do seu celular (Configurações → Aparelhos
                conectados → Conectar um aparelho).
              </p>
              <Button onClick={conectar} disabled={conectando}>
                {conectando ? "Gerando QR code..." : "Conectar WhatsApp"}
              </Button>
            </>
          )}

          {estado === "aguardando_qrcode" && (
            <>
              <p className="font-semibold">Escaneie o QR code</p>
              {qrcode && (
                <img src={qrcode} alt="QR code do WhatsApp" width={260} height={260} className="rounded-lg border" />
              )}
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Aguardando confirmação no celular...
              </p>
              <Button variant="outline" size="sm" onClick={conectar} disabled={conectando}>
                Gerar novo QR code
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
