// components/conferencia/QRScannerDialog.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, X, Loader2, AlertCircle, CheckCircle, QrCode } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";

interface QRScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (data: { orcamento_id?: string; produto_id?: string; quantidade?: number; codigo: string; type?: string }) => void;
}

export default function QRScannerDialog({ open, onOpenChange, onScan }: QRScannerDialogProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);

  useEffect(() => {
    if (open && !showManualInput) {
      startScanner();
    } else {
      stopScanner();
    }
    return () => stopScanner();
  }, [open, showManualInput]);

  const startScanner = async () => {
    setError(null);
    setScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      scanFrame();
    } catch (err: any) {
      console.error("Camera error:", err);
      setError("Não foi possível acessar a câmera. Verifique as permissões.");
      setScanning(false);
    }
  };

  const stopScanner = () => {
    setScanning(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  const scanFrame = () => {
    if (!scanning || !videoRef.current || videoRef.current.readyState !== 4) {
      if (scanning) setTimeout(scanFrame, 200);
      return;
    }
    
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      if (scanning) setTimeout(scanFrame, 200);
      return;
    }
    
    ctx.drawImage(video, 0, 0);

    // Usar BarcodeDetector se disponível
    if ("BarcodeDetector" in window) {
      const detector = new (window as any).BarcodeDetector({ formats: ["qr_code"] });
      detector
        .detect(canvas)
        .then((results: any[]) => {
          if (results.length > 0) {
            const raw = results[0].rawValue;
            handleScanResult(raw);
            return;
          }
          if (scanning) requestAnimationFrame(scanFrame);
        })
        .catch(() => {
          if (scanning) setTimeout(scanFrame, 200);
        });
    } else {
      // Fallback
      if (scanning) setTimeout(scanFrame, 300);
    }
  };

  const handleScanResult = (raw: string) => {
    if (raw === lastResult) {
      if (scanning) setTimeout(scanFrame, 500);
      return;
    }
    setLastResult(raw);
    
    try {
      const parsed = JSON.parse(raw);
      
      // Verificar se é QR Code de produto
      if (parsed.type === "produto") {
        onScan({
          type: "produto",
          codigo: parsed.codigo,
          produto_id: parsed.id,
          quantidade: 1
        });
        onOpenChange(false);
        return;
      }
      
      // Verificar se é QR Code de conferência (legado)
      if (parsed.orcamento_id && parsed.produto_id) {
        onScan(parsed);
        onOpenChange(false);
        return;
      }
      
      // Se tiver código mas não for JSON estruturado
      if (parsed.codigo) {
        onScan({ codigo: parsed.codigo });
        onOpenChange(false);
        return;
      }
      
      setError("QR Code não reconhecido para conferência.");
      if (scanning) setTimeout(scanFrame, 1000);
    } catch {
      // Se não for JSON, pode ser texto puro (código do produto)
      if (raw.trim().length > 0) {
        onScan({ codigo: raw.trim() });
        onOpenChange(false);
      } else {
        setError("QR Code não reconhecido. Tente novamente.");
        if (scanning) setTimeout(scanFrame, 1000);
      }
    }
  };

  const handleManualSubmit = () => {
    if (manualCode.trim()) {
      onScan({ codigo: manualCode.trim() });
      setManualCode("");
      setShowManualInput(false);
      onOpenChange(false);
    }
  };

  const handleManualInput = () => {
    stopScanner();
    setShowManualInput(true);
  };

  const handleBackToScanner = () => {
    setShowManualInput(false);
    setError(null);
    startScanner();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            {showManualInput ? "Entrada Manual" : "Scanner QR Code"}
          </DialogTitle>
          <DialogDescription>
            {showManualInput 
              ? "Digite o código do produto manualmente"
              : "Aponte a câmera para o QR Code do produto"}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          {showManualInput ? (
            <div className="space-y-4">
              <Input
                placeholder="Digite o código do produto"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                onKeyPress={(e) => e.key === "Enter" && handleManualSubmit()}
                autoFocus
              />
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={handleBackToScanner}>
                  <Camera className="h-4 w-4 mr-2" />
                  Voltar ao Scanner
                </Button>
                <Button className="flex-1" onClick={handleManualSubmit}>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirmar
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                />
                {!scanning && !error && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-white/60" />
                  </div>
                )}
                {scanning && (
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute inset-8 border-2 border-white/50 rounded-lg" />
                    <div className="absolute top-8 left-8 w-6 h-6 border-t-2 border-l-2 border-green-400" />
                    <div className="absolute top-8 right-8 w-6 h-6 border-t-2 border-r-2 border-green-400" />
                    <div className="absolute bottom-8 left-8 w-6 h-6 border-b-2 border-l-2 border-green-400" />
                    <div className="absolute bottom-8 right-8 w-6 h-6 border-b-2 border-r-2 border-green-400" />
                  </div>
                )}
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={handleManualInput}>
                  <X className="h-4 w-4 mr-2" />
                  Entrada Manual
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    stopScanner();
                    onOpenChange(false);
                  }}
                >
                  <X className="h-4 w-4 mr-2" />
                  Fechar
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}