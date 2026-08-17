// components/conferencia/QRScannerComFoto.tsx
import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, X, Loader as Loader2, CircleCheck as CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface ItemConferencia {
  produto_id: string | null;
  quantidade: number;
  quantidade_conferida: number;
  status_conferencia: string;
}

interface QRScannerComFotoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProdutoLido: (produto: { codigo: string; nome: string; id: string }) => void;
  orcamentoId: string;
  userId?: string;
  itens?: ItemConferencia[];
}

export function QRScannerComFoto({ open, onOpenChange, onProdutoLido, orcamentoId, userId, itens }: QRScannerComFotoProps) {
  const [modoFoto, setModoFoto] = useState(false);
  const [produtoAtual, setProdutoAtual] = useState<{ codigo: string; nome: string; id: string } | null>(null);
  const [fotoCapturada, setFotoCapturada] = useState<string | null>(null);
  const [fotoBase64, setFotoBase64] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [scannerReady, setScannerReady] = useState(false);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const containerId = "qr-reader-conferencia";

  const beep = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioContext();
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.frequency.value = 880;
      gain.gain.value = 0.2;
      oscillator.start();
      gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.3);
      oscillator.stop(ctx.currentTime + 0.3);
      setTimeout(() => ctx.close(), 400);
    } catch(e) {
      console.log("beep");
    }
  };

  useEffect(() => {
    if (!open) {
      resetar();
      stopScanner();
      stopCamera();
    }
  }, [open]);

  useEffect(() => {
    if (open && !modoFoto) {
      setTimeout(() => startScanner(), 500);
    }
  }, [open, modoFoto]);

  const resetar = () => {
    if (fotoCapturada) URL.revokeObjectURL(fotoCapturada);
    setModoFoto(false);
    setProdutoAtual(null);
    setFotoCapturada(null);
    setFotoBase64(null);
    setScannerReady(false);
  };

  const startScanner = async () => {
    const element = document.getElementById(containerId);
    if (!element) return;

    try {
      const testStream = await navigator.mediaDevices.getUserMedia({ video: true });
      testStream.getTracks().forEach(track => track.stop());
    } catch (err) {
      toast({ title: "Erro", description: "Permissão da câmera negada", variant: "destructive" });
      return;
    }

    try {
      if (scannerRef.current) {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      }

      const scanner = new Html5Qrcode(containerId);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 280, height: 280 } },
        (decodedText) => {
          console.log("✅ QR Code detectado:", decodedText);
          beep();
          stopScanner();
          buscarProduto(decodedText);
        },
        () => {}
      );
      
      setScannerReady(true);
    } catch (err) {
      console.error(err);
      toast({ title: "Erro", description: "Não foi possível iniciar o scanner", variant: "destructive" });
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        await scannerRef.current.clear();
      } catch(e) {}
      scannerRef.current = null;
    }
    setScannerReady(false);
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch(e) {
      console.error(e);
      toast({ title: "Erro", description: "Não foi possível abrir a câmera", variant: "destructive" });
    }
  };

  const buscarProduto = async (codigo: string) => {
    let codigoLimpo = codigo;
    try {
      const parsed = JSON.parse(codigo);
      codigoLimpo = parsed.codigo || parsed.produto_codigo || codigo;
    } catch(e) {}

    codigoLimpo = codigoLimpo.trim();

    const { data, error } = await supabase
      .from("produtos")
      .select("id, codigo, nome")
      .ilike("codigo", codigoLimpo)
      .maybeSingle();

    if (error || !data) {
      toast({ title: "Produto não encontrado", description: `Código: ${codigoLimpo}`, variant: "destructive" });
      setTimeout(() => startScanner(), 2000);
      return;
    }

    setProdutoAtual({ codigo: data.codigo, nome: data.nome, id: data.id });

    // Check if this product is already fully conferido
    const itemCorrespondente = itens?.find(i => i.produto_id === data.id);
    if (itemCorrespondente && itemCorrespondente.status_conferencia === 'conferido') {
      toast({ title: "Produto já conferido", description: `${data.nome} já foi conferido anteriormente`, variant: "destructive" });
      setTimeout(() => startScanner(), 2000);
      return;
    }

    // Check if photo already exists for this product in this orcamento
    const { data: fotosExistentes } = await supabase
      .from("conferencia_fotos")
      .select("id")
      .eq("orcamento_id", orcamentoId)
      .eq("produto_codigo", data.codigo)
      .limit(1);

    if (fotosExistentes && fotosExistentes.length > 0) {
      toast({ title: "Produto já conferido", description: `${data.nome} já possui foto de conferência`, variant: "destructive" });
      setTimeout(() => startScanner(), 2000);
      return;
    }

    setModoFoto(true);
    startCamera();
  };

  const capturarFoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    
    const base64 = canvas.toDataURL("image/jpeg", 0.8);
    setFotoBase64(base64);
    setFotoCapturada(base64);
    stopCamera();
  };

  const confirmarFoto = async () => {
    if (!fotoBase64 || !produtoAtual) return;
    setUploading(true);
    
    try {
      // 1. Salvar a foto
      const { error: fotoError } = await supabase
        .from("conferencia_fotos")
        .insert({
          orcamento_id: orcamentoId,
          produto_codigo: produtoAtual.codigo,
          produto_nome: produtoAtual.nome,
          foto_base64: fotoBase64
        });

      if (fotoError) {
        console.error("Erro ao salvar foto:", fotoError);
        throw new Error(fotoError.message);
      }

      // 2. Processar a conferência do item - usar a quantidade total do item
      const itemCorrespondente = itens?.find(i => i.produto_id === produtoAtual.id);
      const quantidadeTotal = itemCorrespondente
        ? itemCorrespondente.quantidade - (itemCorrespondente.quantidade_conferida || 0)
        : 1;

      const { data: conferenciaData, error: conferenciaError } = await supabase.rpc('processar_conferencia_item', {
        p_orcamento_id: orcamentoId,
        p_produto_id: produtoAtual.id,
        p_quantidade: quantidadeTotal,
        p_user_id: userId || "00000000-0000-0000-0000-000000000000"
      });

      if (conferenciaError) {
        console.error("Erro na conferência:", conferenciaError);
        throw new Error(conferenciaError.message);
      }

      if (!conferenciaData.success) {
        throw new Error(conferenciaData.error || "Erro ao processar conferência");
      }

      const itemConf = itens?.find(i => i.produto_id === produtoAtual.id);
      const qtdConf = itemConf ? itemConf.quantidade - (itemConf.quantidade_conferida || 0) : 1;

      toast({
        title: "✅ Sucesso!",
        description: qtdConf > 1
          ? `${produtoAtual.nome} - ${qtdConf} unidades conferidas com 1 foto`
          : `${produtoAtual.nome} foi registrado com foto`
      });
      
      onProdutoLido(produtoAtual);
      
      setTimeout(() => {
        onOpenChange(false);
        resetar();
      }, 1500);
      
    } catch(err: any) {
      console.error("Erro completo:", err);
      toast({ 
        title: "Erro", 
        description: err.message || "Não foi possível salvar", 
        variant: "destructive" 
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{modoFoto ? "Tirar Foto" : "Escanear QR Code"}</DialogTitle>
        </DialogHeader>
        
        {!modoFoto ? (
          <div className="space-y-4">
            <div id={containerId} className="w-full min-h-[300px] bg-black rounded-lg overflow-hidden" />
            {!scannerReady && (
              <div className="flex items-center justify-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin" />
                Iniciando câmera...
              </div>
            )}
            {scannerReady && (
              <div className="text-center text-sm text-green-600 flex items-center justify-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Scanner pronto! Aponte para o QR Code
              </div>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full">
              <X className="h-4 w-4 mr-2" /> Cancelar
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
              {!fotoCapturada ? (
                <>
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                    <Button size="lg" className="rounded-full h-14 w-14 bg-white text-black" onClick={capturarFoto}>
                      <Camera className="h-6 w-6" />
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <img src={fotoCapturada} alt="Foto" className="w-full h-full object-cover" />
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => { setFotoCapturada(null); setFotoBase64(null); startCamera(); }}>
                      Refazer
                    </Button>
                    <Button size="sm" onClick={confirmarFoto} disabled={uploading} className="bg-green-600">
                      {uploading ? "Salvando..." : "Confirmar"}
                    </Button>
                  </div>
                </>
              )}
            </div>
            {produtoAtual && (() => {
              const itemCorrespondente = itens?.find(i => i.produto_id === produtoAtual.id);
              const qtd = itemCorrespondente ? itemCorrespondente.quantidade - (itemCorrespondente.quantidade_conferida || 0) : 1;
              return (
                <div className="text-center p-3 bg-green-50 rounded">
                  <p className="font-bold">{produtoAtual.nome}</p>
                  <p className="text-sm">Código: {produtoAtual.codigo}</p>
                  {qtd > 1 && (
                    <p className="text-sm font-semibold text-green-700 mt-1">
                      Fotografe o pacote com {qtd} unidades juntas
                    </p>
                  )}
                </div>
              );
            })()}
            <Button variant="outline" onClick={() => { setModoFoto(false); setProdutoAtual(null); setFotoCapturada(null); startScanner(); }} className="w-full">
              <X className="h-4 w-4 mr-2" /> Voltar
            </Button>
          </div>
        )}
        
        <canvas ref={canvasRef} className="hidden" />
      </DialogContent>
    </Dialog>
  );
}