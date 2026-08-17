// components/conferencia/QRCodeItem.tsx
import { QRCodeSVG } from "qrcode.react";
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
import { useState } from "react";

interface QRCodeItemProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orcamentoId: string;
  produtoId: string;
  quantidade: number;
  codigo: string;
  nome: string;
}

export function QRCodeItem({
  open,
  onOpenChange,
  orcamentoId,
  produtoId,
  quantidade,
  codigo,
  nome,
}: QRCodeItemProps) {
  const [copied, setCopied] = useState(false);
  
  const qrData = JSON.stringify({
    type: "conferencia",
    orcamento_id: orcamentoId,
    produto_id: produtoId,
    quantidade,
    codigo,
    nome,
    timestamp: new Date().toISOString(),
  });

  const handleDownload = () => {
    const svg = document.getElementById("qrcode-item-svg");
    if (!svg) return;
    
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `qrcode_${codigo}_orcamento_${orcamentoId}.png`;
      link.href = pngUrl;
      link.click();
    };
    
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgString)));
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(qrData);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({
      title: "Copiado!",
      description: "Dados do QR Code copiados",
    });
  };

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    
    printWindow.document.write(`
      <html>
        <head>
          <title>QR Code - ${codigo}</title>
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
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h2>${nome}</h2>
            <p>Código: ${codigo}</p>
            <p>Quantidade: ${quantidade}</p>
            <div>
              ${document.getElementById("qrcode-item-svg")?.outerHTML || ""}
            </div>
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
          <DialogTitle className="text-center">QR Code do Item</DialogTitle>
          <DialogDescription className="text-center">
            Escaneie para conferir este item
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="bg-white p-4 rounded-lg border shadow-sm">
            <QRCodeSVG
              id="qrcode-item-svg"
              value={qrData}
              size={220}
              level="H"
              includeMargin={true}
            />
          </div>
          <div className="text-center space-y-1">
            <p className="font-bold text-lg">{nome}</p>
            <p className="text-sm text-muted-foreground">
              Código: {codigo} | Qtd: {quantidade}
            </p>
            <p className="text-xs text-muted-foreground">
              Orçamento: #{orcamentoId}
            </p>
          </div>
          <div className="flex gap-2 w-full pt-2">
            <Button variant="outline" size="sm" onClick={handleDownload} className="flex-1">
              <Download className="h-4 w-4 mr-1" />
              Baixar
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint} className="flex-1">
              <Printer className="h-4 w-4 mr-1" />
              Imprimir
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopy} className="flex-1">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copiado" : "Copiar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}