// components/PhotoCapture.tsx
import { useRef, useState, useCallback, useEffect } from "react";
import { Camera, RotateCcw, Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PhotoCaptureProps {
  onPhotoCapture: (file: File) => void;
  onCancel: () => void;
  uploading?: boolean;
}

export function PhotoCapture({ onPhotoCapture, onCancel, uploading }: PhotoCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [capturedFile, setCapturedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startCamera = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch (err) {
      console.error("Camera error:", err);
      setError("Não foi possível acessar a câmera. Verifique as permissões do navegador.");
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const handleCapture = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const file = new File([blob], `conferencia_${Date.now()}.jpg`, { type: "image/jpeg" });
        setCapturedPhoto(url);
        setCapturedFile(file);
        stopCamera();
      },
      "image/jpeg",
      0.85
    );
  }, [stopCamera]);

  const handleRetake = useCallback(() => {
    if (capturedPhoto) URL.revokeObjectURL(capturedPhoto);
    setCapturedPhoto(null);
    setCapturedFile(null);
    startCamera();
  }, [capturedPhoto, startCamera]);

  const handleConfirm = useCallback(() => {
    if (capturedFile) {
      onPhotoCapture(capturedFile);
    }
  }, [capturedFile, onPhotoCapture]);

  const handleCancel = useCallback(() => {
    stopCamera();
    if (capturedPhoto) URL.revokeObjectURL(capturedPhoto);
    onCancel();
  }, [capturedPhoto, onCancel, stopCamera]);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!capturedPhoto ? (
        <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          {!cameraActive && !error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
          )}
          {cameraActive && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
              <Button
                size="lg"
                className="rounded-full h-14 w-14 p-0 bg-white text-black hover:bg-white/90 shadow-lg"
                onClick={handleCapture}
              >
                <Camera className="h-6 w-6" />
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
          <img src={capturedPhoto} alt="Foto capturada" className="w-full h-full object-cover" />
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />

      <div className="flex gap-2">
        {capturedPhoto ? (
          <>
            <Button variant="outline" className="flex-1" onClick={handleRetake} disabled={uploading}>
              <RotateCcw className="h-4 w-4 mr-2" />
              Refazer
            </Button>
            <Button className="flex-1" onClick={handleConfirm} disabled={uploading}>
              {uploading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Check className="h-4 w-4 mr-2" />
              )}
              Confirmar Foto
            </Button>
          </>
        ) : (
          <Button variant="outline" className="flex-1" onClick={handleCancel} disabled={uploading}>
            Cancelar
          </Button>
        )}
      </div>
    </div>
  );
}