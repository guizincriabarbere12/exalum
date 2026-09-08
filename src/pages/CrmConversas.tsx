import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Send, Loader2, MessageCircle, Settings } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Mensagem {
  id: string;
  vendedor_id: string;
  numero_cliente: string;
  nome_contato: string | null;
  papel: "cliente" | "vendedor";
  tipo: "texto" | "audio" | "imagem" | "video" | "documento";
  mensagem: string;
  midia_base64: string | null;
  created_at: string;
}

interface Thread {
  vendedorId: string;
  vendedorNome: string;
  numeroCliente: string;
  nomeContato: string | null;
  ultimaMensagem: string;
  ultimaData: string;
}

export default function CrmConversas() {
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [vendedoresNomes, setVendedoresNomes] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [selecionada, setSelecionada] = useState<{ vendedorId: string; numeroCliente: string } | null>(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const fimRef = useRef<HTMLDivElement>(null);

  const carregar = useCallback(async () => {
    const [{ data: msgs }, { data: vendedores }] = await Promise.all([
      supabase.from("crm_mensagens").select("*").order("created_at", { ascending: true }),
      supabase.from("vendedores").select("id, nome"),
    ]);
    setMensagens((msgs as Mensagem[]) || []);
    const mapa: Record<string, string> = {};
    (vendedores || []).forEach((v: any) => (mapa[v.id] = v.nome));
    setVendedoresNomes(mapa);
    setCarregando(false);
  }, []);

  useEffect(() => {
    carregar();
    const canal = supabase
      .channel("crm-mensagens-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "crm_mensagens" }, (payload) => {
        setMensagens((prev) => [...prev, payload.new as Mensagem]);
      })
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [carregar]);

  useEffect(() => {
    fimRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensagens, selecionada]);

  const threads: Thread[] = (() => {
    const mapa = new Map<string, Thread>();
    mensagens.forEach((m) => {
      const chave = `${m.vendedor_id}::${m.numero_cliente}`;
      mapa.set(chave, {
        vendedorId: m.vendedor_id,
        vendedorNome: vendedoresNomes[m.vendedor_id] || "Vendedor",
        numeroCliente: m.numero_cliente,
        nomeContato: m.nome_contato,
        ultimaMensagem: m.mensagem,
        ultimaData: m.created_at,
      });
    });
    return Array.from(mapa.values()).sort((a, b) => new Date(b.ultimaData).getTime() - new Date(a.ultimaData).getTime());
  })();

  const mensagensDaThread = selecionada
    ? mensagens.filter((m) => m.vendedor_id === selecionada.vendedorId && m.numero_cliente === selecionada.numeroCliente)
    : [];

  const enviar = async () => {
    if (!selecionada || !texto.trim()) return;
    setEnviando(true);
    const { data, error } = await supabase.functions.invoke("crm-whatsapp-send", {
      body: { vendedorId: selecionada.vendedorId, numero: selecionada.numeroCliente, texto: texto.trim() },
    });
    setEnviando(false);
    if (error || data?.erro) {
      toast.error("Erro ao enviar", { description: data?.erro || error?.message });
      return;
    }
    setTexto("");
  };

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      <div className="w-80 shrink-0 overflow-y-auto border-r">
        <div className="space-y-2 border-b p-4">
          <h1 className="text-lg font-bold">Conversas WhatsApp</h1>
          <p className="text-xs text-muted-foreground">Todos os vendedores, num só lugar</p>
          <Link to="/conexoes-whatsapp">
            <Button size="sm" variant="outline">
              <Settings className="mr-1.5 h-3.5 w-3.5" /> Conexões e vendedores
            </Button>
          </Link>
        </div>
        {carregando ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : threads.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Nenhuma conversa ainda.</p>
        ) : (
          threads.map((t) => {
            const ativa = selecionada?.vendedorId === t.vendedorId && selecionada?.numeroCliente === t.numeroCliente;
            return (
              <button
                key={`${t.vendedorId}::${t.numeroCliente}`}
                onClick={() => setSelecionada({ vendedorId: t.vendedorId, numeroCliente: t.numeroCliente })}
                className={`flex w-full flex-col gap-0.5 border-b px-4 py-3 text-left hover:bg-muted/50 ${ativa ? "bg-muted" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{t.nomeContato || t.numeroCliente}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(t.ultimaData).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                <p className="truncate text-xs text-muted-foreground">{t.ultimaMensagem}</p>
                <Badge variant="outline" className="mt-1 w-fit text-[10px]">
                  {t.vendedorNome}
                </Badge>
              </button>
            );
          })
        )}
      </div>

      <div className="flex flex-1 flex-col">
        {!selecionada ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-muted-foreground">
            <MessageCircle className="h-10 w-10" />
            <p className="text-sm">Selecione uma conversa</p>
          </div>
        ) : (
          <>
            <div className="border-b px-4 py-3">
              <p className="text-sm font-semibold">{selecionada.numeroCliente}</p>
              <p className="text-xs text-muted-foreground">
                Vendedor: {vendedoresNomes[selecionada.vendedorId] || "-"}
              </p>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-4">
              {mensagensDaThread.map((m) => (
                <div key={m.id} className={`flex ${m.papel === "vendedor" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${
                      m.papel === "vendedor" ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}
                  >
                    {m.tipo === "audio" && m.midia_base64 && (
                      <audio controls src={m.midia_base64} className="mb-1 max-w-full" />
                    )}
                    {m.tipo === "imagem" && m.midia_base64 && (
                      <img src={m.midia_base64} alt="Imagem enviada" className="mb-1 max-w-full rounded" />
                    )}
                    {m.mensagem}
                    <p className="mt-1 text-[10px] opacity-70">
                      {new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={fimRef} />
            </div>
            <div className="flex gap-2 border-t p-3">
              <Input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !enviando && enviar()}
                placeholder="Digite uma mensagem..."
              />
              <Button onClick={enviar} disabled={enviando || !texto.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
