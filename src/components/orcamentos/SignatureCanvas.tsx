import { useRef, useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eraser, Check } from "lucide-react";

interface SignatureCanvasProps {
  onSave: (data: { base64: string; nome: string; cargo: string }) => void;
  onCancel: () => void;
  loading?: boolean;
}

export default function SignatureCanvas({ onSave, onCancel, loading }: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [nome, setNome] = useState("");
  const [cargo, setCargo] = useState("");

  // Inicializar o canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
      
      // Fundo branco
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, rect.width, rect.height);
      
      // Configurar estilo do traço
      ctx.strokeStyle = "#1a1a1a";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  const getPos = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    let clientX, clientY;
    
    if ("touches" in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }
    
    return {
      x: (clientX - rect.left) * (rect.width / canvas.width) * scaleX,
      y: (clientY - rect.top) * (rect.height / canvas.height) * scaleY,
    };
  }, []);

  const startDrawing = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
  }, [getPos]);

  const draw = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;
    
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasSignature(true);
  }, [isDrawing, getPos]);

  const stopDrawing = useCallback(() => {
    setIsDrawing(false);
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, rect.width * dpr, rect.height * dpr);
    
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    
    setHasSignature(false);
  }, []);

  const handleSave = useCallback(() => {
    if (!hasSignature || !nome.trim()) {
      return;
    }
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const base64 = canvas.toDataURL("image/png");
    onSave({ 
      base64, 
      nome: nome.trim(), 
      cargo: cargo.trim() 
    });
  }, [hasSignature, nome, cargo, onSave]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="sig-nome" className="text-sm font-medium">
            Nome completo <span className="text-red-500">*</span>
          </Label>
          <Input
            id="sig-nome"
            placeholder="Nome de quem está assinando"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            disabled={loading}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sig-cargo" className="text-sm font-medium">
            Cargo/Função
          </Label>
          <Input
            id="sig-cargo"
            placeholder="Ex: Representante, Gerente..."
            value={cargo}
            onChange={(e) => setCargo(e.target.value)}
            disabled={loading}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm font-medium">
          Assinatura <span className="text-red-500">*</span>
        </Label>
        <div className="border-2 border-dashed border-gray-300 rounded-lg overflow-hidden bg-white">
          <canvas
            ref={canvasRef}
            className="w-full touch-none cursor-crosshair"
            style={{ height: 180, display: 'block' }}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Desenhe sua assinatura no campo acima usando o mouse ou toque na tela.
        </p>
      </div>

      <div className="flex items-center justify-between gap-2 pt-2">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={clearCanvas} 
          type="button"
          disabled={loading || !hasSignature}
        >
          <Eraser className="h-4 w-4 mr-1" />
          Limpar
        </Button>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={onCancel} 
            disabled={loading} 
            type="button"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasSignature || !nome.trim() || loading}
            type="button"
            className="min-w-[140px]"
          >
            {loading ? (
              <>
                <span className="h-4 w-4 mr-1 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                Salvando...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-1" />
                Confirmar Assinatura
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}