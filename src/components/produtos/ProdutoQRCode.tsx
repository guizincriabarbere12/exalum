// components/produtos/ProdutoQRCode.tsx
import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QRCodeCanvas } from "qrcode.react";
import { Download, Printer, Copy, Check, QrCode } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface ProdutoQRCodeProps {
  produto: {
    id: string;
    codigo: string;
    nome: string;
  };
  children?: React.ReactNode;
}

interface ProdutoCompleto {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  cor: string | null;
  localizacao: string | null;
  tipo: string | null;
  unidade: string | null;
  imagem_url: string | null;
}

export function ProdutoQRCode({ produto, children }: ProdutoQRCodeProps) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [produtoCompleto, setProdutoCompleto] = useState<ProdutoCompleto | null>(null);
  const [loading, setLoading] = useState(false);
  const [qrImageUrl, setQrImageUrl] = useState<string>("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // URL DA LOGO
  const LOGO_URL = "https://i.imgur.com/wT7iw7X.png";

  useEffect(() => {
    if (open && produto.id) {
      buscarProdutoCompleto();
    }
  }, [open, produto.id]);

  useEffect(() => {
    if (open && canvasRef.current) {
      setTimeout(() => {
        const canvas = canvasRef.current;
        if (canvas) {
          const imageUrl = canvas.toDataURL("image/png");
          setQrImageUrl(imageUrl);
        }
      }, 500);
    }
  }, [open, loading]);

  const buscarProdutoCompleto = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("produtos")
        .select("*")
        .eq("id", produto.id)
        .single();

      if (error) throw error;
      
      setProdutoCompleto({
        id: data.id,
        codigo: data.codigo,
        nome: data.nome || data.descricao || produto.nome,
        descricao: data.descricao,
        cor: data.cor,
        localizacao: data.localizacao,
        tipo: data.tipo,
        unidade: data.unidade,
        imagem_url: data.imagem_url,
      });
    } catch (error) {
      console.error("Erro ao buscar produto:", error);
      setProdutoCompleto({
        id: produto.id,
        codigo: produto.codigo,
        nome: produto.nome,
        descricao: null,
        cor: null,
        localizacao: null,
        tipo: null,
        unidade: null,
        imagem_url: null,
      });
    } finally {
      setLoading(false);
    }
  };

  const qrValue = produto.codigo;

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      toast({ title: "Erro", description: "QR Code não encontrado", variant: "destructive" });
      return;
    }
    
    try {
      const link = document.createElement("a");
      link.download = `qrcode_${produto.codigo}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast({ title: "Sucesso", description: "QR Code baixado com sucesso" });
    } catch (error) {
      toast({ title: "Erro", description: "Não foi possível baixar", variant: "destructive" });
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(produto.codigo);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Copiado!", description: "Código do produto copiado" });
  };

  const gerarHTMLImpressao = () => {
    const dados = produtoCompleto || {
      codigo: produto.codigo,
      nome: produto.nome,
      descricao: null,
      cor: null,
      localizacao: null,
      tipo: null,
      unidade: null,
      imagem_url: null,
    };
    
    const descricaoDisplay = dados.descricao && dados.descricao.trim() !== "" 
      ? dados.descricao 
      : "";
    
    const localizacaoDisplay = dados.localizacao && dados.localizacao.trim() !== "" 
      ? dados.localizacao 
      : "—";
    
    const corDisplay = dados.cor && dados.cor.trim() !== "" ? dados.cor : "—";
    const tipoDisplay = dados.tipo && dados.tipo.trim() !== "" ? dados.tipo : "—";
    const unidadeDisplay = dados.unidade && dados.unidade.trim() !== "" ? dados.unidade : "UN";
    const imagemProduto = dados.imagem_url || "";
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Code - ${dados.codigo}</title>
          <meta charset="UTF-8">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: Arial, Helvetica, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              background: #f0f0f0;
              margin: 0;
              padding: 20px;
            }
            .card {
              background: white;
              border-radius: 12px;
              box-shadow: 0 4px 12px rgba(0,0,0,0.1);
              max-width: 380px;
              width: 100%;
              overflow: hidden;
              page-break-inside: avoid;
            }
            .header-logo {
              background: #f5f5f5;
              padding: 10px;
              text-align: center;
              border-bottom: 1px solid #eee;
            }
            .header-logo img {
              max-height: 50px;
              width: auto;
            }
            .produto-imagem {
              width: 100%;
              height: 150px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              display: flex;
              align-items: center;
              justify-content: center;
              overflow: hidden;
            }
            .produto-imagem img {
              width: 100%;
              height: 100%;
              object-fit: cover;
            }
            .produto-imagem .sem-imagem {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              color: white;
              text-align: center;
              font-size: 12px;
            }
            .produto-imagem .sem-imagem svg {
              width: 40px;
              height: 40px;
              margin-bottom: 5px;
            }
            .produto-info {
              padding: 15px;
            }
            h2 {
              color: #333;
              font-size: 16px;
              font-weight: bold;
              margin-bottom: 5px;
              text-align: center;
            }
            .descricao {
              font-size: 11px;
              color: #666;
              text-align: center;
              margin-bottom: 10px;
              font-style: italic;
            }
            .codigo {
              font-family: monospace;
              font-size: 12px;
              font-weight: bold;
              color: #0066cc;
              margin: 8px 0;
              background: #f5f5f5;
              padding: 3px 6px;
              border-radius: 4px;
              display: inline-block;
              width: 100%;
              text-align: center;
            }
            .qr-code-container {
              display: flex;
              justify-content: center;
              margin: 10px 0;
              padding: 10px;
              background: #f9f9f9;
              border-radius: 8px;
            }
            .qr-code-container img {
              width: 140px;
              height: 140px;
            }
            .detalhes {
              margin-top: 10px;
              border-top: 1px solid #eee;
              padding-top: 10px;
            }
            .detalhes-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 6px;
              font-size: 11px;
            }
            .detalhes-label {
              font-weight: bold;
              color: #555;
            }
            .detalhes-value {
              color: #333;
            }
            .cor-badge {
              display: inline-block;
              width: 12px;
              height: 12px;
              border-radius: 50%;
              margin-right: 4px;
              vertical-align: middle;
              border: 1px solid #ddd;
            }
            .footer {
              margin-top: 10px;
              border-top: 1px solid #eee;
              padding-top: 8px;
              font-size: 9px;
              color: #999;
              text-align: center;
            }
            @media print {
              body {
                background: white;
                padding: 0;
              }
              .card {
                box-shadow: none;
                border: 1px solid #ddd;
                page-break-inside: avoid;
              }
            }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="header-logo">
              <img src="${LOGO_URL}" alt="Logo" />
            </div>
            
            <div class="produto-imagem">
              ${imagemProduto ? `
                <img src="${imagemProduto}" alt="${dados.nome}" />
              ` : `
                <div class="sem-imagem">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <rect x="2" y="2" width="20" height="20" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="2.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                  </svg>
                  <span>Sem imagem</span>
                </div>
              `}
            </div>
            
            <div class="produto-info">
              <h2>${dados.nome}</h2>
              ${descricaoDisplay ? `<div class="descricao">${descricaoDisplay}</div>` : ''}
              <div class="codigo">${dados.codigo}</div>
              
              <div class="qr-code-container">
                <img src="${qrImageUrl}" alt="QR Code" />
              </div>
              
              <div class="detalhes">
                <div class="detalhes-row">
                  <span class="detalhes-label">Tipo:</span>
                  <span class="detalhes-value">${tipoDisplay}</span>
                </div>
                <div class="detalhes-row">
                  <span class="detalhes-label">Cor:</span>
                  <span class="detalhes-value">
                    ${dados.cor ? `<span class="cor-badge" style="background-color: ${dados.cor.toLowerCase()}"></span>` : ""}
                    ${corDisplay}
                  </span>
                </div>
                <div class="detalhes-row">
                  <span class="detalhes-label">Box:</span>
                  <span class="detalhes-value">${localizacaoDisplay}</span>
                </div>
                <div class="detalhes-row">
                  <span class="detalhes-label">Unidade:</span>
                  <span class="detalhes-value">${unidadeDisplay}</span>
                </div>
              </div>
              
              <div class="footer">
                Escaneie o QR Code
              </div>
            </div>
          </div>
        </body>
      </html>
    `;
  };

  const handlePrint = () => {
    if (!qrImageUrl) {
      toast({ title: "Erro", description: "Aguarde o QR Code carregar", variant: "destructive" });
      return;
    }
    
    const printContent = gerarHTMLImpressao();
    const printWindow = window.open();
    
    if (!printWindow) {
      toast({ title: "Erro", description: "Bloqueador de popup ativado. Permita popups para este site.", variant: "destructive" });
      return;
    }
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    printWindow.onload = function() {
      printWindow.print();
    };
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm">
            <QrCode className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center">QR Code do Produto</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="bg-white p-4 rounded-lg border text-center w-full">
            {loading ? (
              <div className="w-[180px] h-[180px] flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <>
                {produtoCompleto?.imagem_url && (
                  <div className="mb-3">
                    <img 
                      src={produtoCompleto.imagem_url} 
                      alt={produto.nome}
                      className="w-16 h-16 object-cover rounded-lg mx-auto border"
                    />
                  </div>
                )}
                <QRCodeCanvas
                  ref={canvasRef}
                  value={qrValue}
                  size={180}
                  level="H"
                  includeMargin={true}
                />
              </>
            )}
            <p className="text-xs text-muted-foreground mt-2 font-mono">{produto.codigo}</p>
          </div>
          
          {produtoCompleto && (
            <div className="w-full text-left border-t pt-3 mt-2">
              <div className="text-xs space-y-1">
                <p><span className="font-semibold">Produto:</span> {produtoCompleto.nome}</p>
                {produtoCompleto.descricao && produtoCompleto.descricao.trim() !== "" && (
                  <p><span className="font-semibold">Descrição:</span> {produtoCompleto.descricao}</p>
                )}
                {produtoCompleto.cor && produtoCompleto.cor.trim() !== "" && (
                  <p><span className="font-semibold">Cor:</span> {produtoCompleto.cor}</p>
                )}
                {produtoCompleto.localizacao && produtoCompleto.localizacao.trim() !== "" && (
                  <p><span className="font-semibold">Box:</span> {produtoCompleto.localizacao}</p>
                )}
              </div>
            </div>
          )}
          
          <div className="flex gap-2 w-full">
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
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}