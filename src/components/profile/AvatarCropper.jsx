import React, { useState, useRef, useCallback, useEffect } from "react";
import { ZoomIn, ZoomOut, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

export default function AvatarCropper({ file, open, onClose, onCropped }) {
  const [imageSrc, setImageSrc] = useState(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const offsetStart = useRef({ x: 0, y: 0 });
  const imgRef = useRef(null);
  const containerSize = 280;

  useEffect(() => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => setImageSrc(e.target.result);
    reader.readAsDataURL(file);
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, [file]);

  const handlePointerDown = useCallback((e) => {
    e.preventDefault();
    setDragging(true);
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    dragStart.current = { x: clientX, y: clientY };
    offsetStart.current = { ...offset };
  }, [offset]);

  const handlePointerMove = useCallback((e) => {
    if (!dragging) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    setOffset({
      x: offsetStart.current.x + (clientX - dragStart.current.x),
      y: offsetStart.current.y + (clientY - dragStart.current.y),
    });
  }, [dragging]);

  const handlePointerUp = useCallback(() => setDragging(false), []);

  const handleCrop = () => {
    if (!imgRef.current) return;
    const canvas = document.createElement("canvas");
    const outputSize = 400;
    canvas.width = outputSize;
    canvas.height = outputSize;
    const ctx = canvas.getContext("2d");

    const img = imgRef.current;
    const natW = img.naturalWidth;
    const natH = img.naturalHeight;

    const displayScale = containerSize / Math.max(natW, natH);
    const drawW = natW * displayScale * scale;
    const drawH = natH * displayScale * scale;

    const ratioX = outputSize / containerSize;
    const ratioY = outputSize / containerSize;

    const drawX = ((containerSize - drawW) / 2 + offset.x) * ratioX;
    const drawY = ((containerSize - drawH) / 2 + offset.y) * ratioY;

    ctx.beginPath();
    ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();

    ctx.drawImage(img, drawX, drawY, drawW * ratioX, drawH * ratioY);

    canvas.toBlob((blob) => {
      if (blob) {
        const croppedFile = new File([blob], "avatar.png", { type: "image/png" });
        onCropped(croppedFile);
      }
    }, "image/png");
  };

  if (!imageSrc) return null;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md p-0 gap-0 bg-card border-border overflow-hidden">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold text-center">Ajustar foto de perfil</h3>
          <p className="text-xs text-muted-foreground text-center mt-1">Arraste para reposicionar e use o zoom</p>
        </div>

        <div className="flex items-center justify-center p-6 bg-background/50">
          <div
            className="relative overflow-hidden rounded-full cursor-grab active:cursor-grabbing"
            style={{ width: containerSize, height: containerSize }}
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
          >
            <div
              className="absolute inset-0 flex items-center justify-center select-none"
              style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }}
            >
              <img
                ref={imgRef}
                src={imageSrc}
                alt="crop"
                className="max-w-none pointer-events-none"
                style={{ width: containerSize, height: containerSize, objectFit: "contain" }}
                draggable={false}
              />
            </div>
            <div className="absolute inset-0 rounded-full ring-4 ring-primary/30 pointer-events-none" />
          </div>
        </div>

        <div className="flex items-center justify-center gap-4 px-6 py-3 border-t border-border">
          <Button variant="ghost" size="icon" onClick={() => setScale(s => Math.max(0.5, s - 0.1))}>
            <ZoomOut className="w-4 h-4" />
          </Button>
          <input
            type="range"
            min="0.5"
            max="3"
            step="0.05"
            value={scale}
            onChange={(e) => setScale(parseFloat(e.target.value))}
            className="w-40 accent-primary"
          />
          <Button variant="ghost" size="icon" onClick={() => setScale(s => Math.min(3, s + 0.1))}>
            <ZoomIn className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex gap-2 p-4 border-t border-border">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            <X className="w-4 h-4 mr-1" /> Cancelar
          </Button>
          <Button className="flex-1 bg-gradient-to-r from-purple-500 to-indigo-600" onClick={handleCrop}>
            <Check className="w-4 h-4 mr-1" /> Aplicar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}