import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QrCode, X } from "lucide-react";

interface QRCodeScannerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (data: string) => void;
}

export function QRCodeScanner({ open, onOpenChange, onScan }: QRCodeScannerProps) {
  const [scanning, setScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => {
    if (open) {
      startScanner();
    } else {
      stopScanner();
    }
    return () => {
      stopScanner();
    };
  }, [open]);

  const startScanner = async () => {
    try {
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          onScan(decodedText);
          stopScanner();
          onOpenChange(false);
        },
        () => {}
      );
      setScanning(true);
    } catch (err) {
      console.error("Erro ao iniciar scanner:", err);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {}
      scannerRef.current = null;
    }
    setScanning(false);
  };

  const handleClose = () => {
    stopScanner();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Scanner QR Code
          </DialogTitle>
          <DialogDescription>
            Aponte a camera para o QR Code do item para conferencia
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-2">
          <div
            id="qr-reader"
            className="w-full max-w-[350px] min-h-[300px] rounded-lg overflow-hidden border"
          />
          {!scanning && (
            <p className="text-sm text-muted-foreground text-center">
              Iniciando camera...
            </p>
          )}
          <Button variant="outline" onClick={handleClose} className="w-full">
            <X className="h-4 w-4 mr-2" />
            Fechar Scanner
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
