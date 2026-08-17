// components/conferencia/QRCodeDialog.tsx
import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Printer, Copy, Check } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface QRCodeData {
  orcamento_id: string;
  produto_id: string;
  quantidade: number;
  codigo: string;
}

interface QRCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: QRCodeData | null;
  produtoNome?: string;
  produtoFotoUrl?: string | null;
}

export default function QRCodeDialog({ open, onOpenChange, data, produtoNome, produtoFotoUrl }: QRCodeDialogProps) {
  const [qrUrl, setQrUrl] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (data && open) {
      const payload = JSON.stringify({
        type: "conferencia",
        orcamento_id: data.orcamento_id,
        produto_id: data.produto_id,
        quantidade: data.quantidade,
        codigo: data.codigo,
        timestamp: new Date().toISOString(),
      });
      QRCode.toDataURL(payload, {
        width: 280,
        margin: 2,
        color: { dark: "#1e293b", light: "#ffffff" },
      }).then(setQrUrl);
    } else {
      setQrUrl("");
    }
  }, [data, open]);

  const handleDownload = () => {
    if (!qrUrl) return;
    const link = document.createElement("a");
    link.download = `qrcode_${data?.codigo || "item"}.png`;
    link.href = qrUrl;
    link.click();
  };

  const handleCopy = () => {
    if (!qrUrl) return;
    navigator.clipboard.writeText(qrUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Copiado!",
      description: "QR Code copiado para área de transferência",
    });
  };

  const handlePrint = () => {
    if (!qrUrl) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const fotoHtml = produtoFotoUrl
      ? `<div class="foto"><img src="${produtoFotoUrl}" alt="Foto do produto" style="max-width:180px;max-height:180px;border-radius:8px;object-fit:cover;" /></div>`
      : "";

    printWindow.document.write(`
      <html>
        <head>
          <title>QR Code - ${data?.codigo}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              padding: 20px;
            }
            .container {
              text-align: center;
              border: 1px solid #ddd;
              padding: 20px;
              border-radius: 8px;
              max-width: 400px;
            }
            .foto {
              margin-bottom: 16px;
            }
            .foto img {
              max-width: 180px;
              max-height: 180px;
              border-radius: 8px;
              object-fit: cover;
            }
            h2 { margin-bottom: 8px; }
            p { margin: 4px 0; }
            .qr img { max-width: 250px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>${produtoNome || "Item"}</h2>
            ${fotoHtml}
            <p><strong>Código:</strong> ${data?.codigo}</p>
            <p><strong>Quantidade:</strong> ${data?.quantidade}</p>
            <div class="qr"><img src="${qrUrl}" alt="QR Code" /></div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>QR Code do Item</DialogTitle>
          <DialogDescription>
            {produtoNome ? `Produto: ${produtoNome}` : "Escaneie para conferir"}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          {produtoFotoUrl && (
            <img src={produtoFotoUrl} alt="Foto do produto" className="w-32 h-32 object-cover rounded-lg border shadow-sm" />
          )}
          {qrUrl ? (
            <img src={qrUrl} alt="QR Code" className="rounded-lg border shadow-sm" />
          ) : (
            <div className="w-[280px] h-[280px] bg-muted animate-pulse rounded-lg" />
          )}
          <div className="text-center text-sm text-muted-foreground space-y-1">
            <p><span className="font-semibold text-foreground">Código:</span> {data?.codigo}</p>
            <p><span className="font-semibold text-foreground">Quantidade:</span> {data?.quantidade}</p>
          </div>
          <div className="flex gap-2 w-full">
            <Button variant="outline" onClick={handleDownload} disabled={!qrUrl} className="flex-1">
              <Download className="h-4 w-4 mr-2" />
              Baixar
            </Button>
            <Button variant="outline" onClick={handlePrint} disabled={!qrUrl} className="flex-1">
              <Printer className="h-4 w-4 mr-2" />
              Imprimir
            </Button>
            <Button variant="outline" onClick={handleCopy} disabled={!qrUrl} className="flex-1">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copiado" : "Copiar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}