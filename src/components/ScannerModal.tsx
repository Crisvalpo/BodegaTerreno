'use client'

import { useEffect, useState, useRef } from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import { X, Camera, RefreshCw, Loader2 } from 'lucide-react'

type ScannerModalProps = {
  isOpen: boolean
  onClose: () => void
  onScan: (decodedText: string) => void
  title?: string
}

export default function ScannerModal({ isOpen, onClose, onScan, title = 'Escanear Código' }: ScannerModalProps) {
  const [isInitializing, setIsInitializing] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [zoomCaps, setZoomCaps] = useState<{ min: number, max: number, step: number } | null>(null)
  const [hasTorch, setHasTorch] = useState(false)
  const [isTorchOn, setIsTorchOn] = useState(false)
  
  const qrCodeInstance = useRef<Html5Qrcode | null>(null)

  useEffect(() => {
    if (isOpen) {
      startScanner()
    }

    return () => {
      stopScanner()
    }
  }, [isOpen])

  const startScanner = async () => {
    setIsInitializing(true)
    setError(null)
    setZoom(1)
    
    await new Promise(r => setTimeout(r, 300))

    try {
      const html5QrCode = new Html5Qrcode("reader")
      qrCodeInstance.current = html5QrCode

      const config = {
        fps: 30,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const qrboxSize = Math.floor(minEdge * 0.85); 
          return { width: qrboxSize, height: qrboxSize };
        },
        aspectRatio: 1.0,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.PDF_417,
          Html5QrcodeSupportedFormats.CODE_128
        ],
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        }
      }

      await html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          onScan(decodedText)
          stopScanner()
          onClose()
        },
        () => {} // Ignorar errores de frame
      )
      
      // Detectar capacidades de Zoom y Antorcha
      const track = (html5QrCode as any).getRunningTrack();
      const capabilities = track.getCapabilities() as any;
      
      if (capabilities.zoom) {
        setZoomCaps({
          min: capabilities.zoom.min,
          max: capabilities.zoom.max,
          step: capabilities.zoom.step
        });
        setZoom(capabilities.zoom.min);
      }

      if (capabilities.torch) {
        setHasTorch(true);
      }

      setIsInitializing(false)
    } catch (err: any) {
      console.error("Error scanner:", err)
      setError("No pudimos acceder a tu cámara. Asegúrate de dar permisos.")
      setIsInitializing(false)
    }
  }

  const handleZoomChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setZoom(value);
    if (qrCodeInstance.current) {
      try {
        await qrCodeInstance.current.applyVideoConstraints({
          advanced: [{ zoom: value }] as any
        });
      } catch (err) {
        console.error("Error applying zoom:", err);
      }
    }
  };

  const toggleTorch = async () => {
    if (qrCodeInstance.current) {
      try {
        const nextState = !isTorchOn;
        await qrCodeInstance.current.applyVideoConstraints({
          advanced: [{ torch: nextState }] as any
        });
        setIsTorchOn(nextState);
      } catch (err) {
        console.error("Error toggling torch:", err);
      }
    }
  };

  const stopScanner = async () => {
    if (qrCodeInstance.current && qrCodeInstance.current.isScanning) {
      try {
        await qrCodeInstance.current.stop()
        qrCodeInstance.current = null
      } catch (err) {
        console.error("Error stop:", err)
      }
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-neutral-950/90 backdrop-blur-xl animate-in fade-in duration-300">
      <div className="bg-neutral-900 border border-white/10 w-full max-w-md rounded-[2.5rem] overflow-hidden relative shadow-2xl flex flex-col">
        
        {/* Header */}
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <Camera className="text-emerald-400 w-4 h-4" />
            </div>
            <h3 className="text-white font-bold">{title}</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="text-neutral-500 hover:text-white" />
          </button>
        </div>
        
        {/* Scanner Area */}
        <div className="p-4 flex-1 relative min-h-[400px] bg-black flex items-center justify-center">
          <div id="reader" className="w-full h-full overflow-hidden rounded-2xl"></div>
          
          {isInitializing && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950 z-10 gap-3">
              <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
              <p className="text-sm text-neutral-400 font-medium">Optimizando lente...</p>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950 z-20 p-8 text-center">
              <X className="text-red-500 w-12 h-12 mb-4" />
              <p className="text-white font-bold mb-2">Error de Cámara</p>
              <p className="text-neutral-500 text-sm mb-6">{error}</p>
              <button onClick={startScanner} className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl flex items-center gap-2">
                <RefreshCw size={18} /> Reintentar
              </button>
            </div>
          )}

          {!isInitializing && !error && (
            <div className="absolute inset-0 pointer-events-none border-[30px] border-black/40 flex items-center justify-center">
              <div className="w-full h-full border-2 border-emerald-500/30 rounded-xl relative">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-500 rounded-tl-lg"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-500 rounded-tr-lg"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-500 rounded-bl-lg"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-500 rounded-br-lg"></div>
                <div className="absolute top-1/2 left-0 w-full h-[1px] bg-emerald-500/50 animate-pulse"></div>
              </div>
            </div>
          )}
        </div>

        {/* CONTROLES: ZOOM Y LUZ */}
        {!isInitializing && !error && (
          <div className="px-8 py-6 bg-white/5 border-t border-white/5 space-y-6">
            {zoomCaps && (
              <div className="space-y-3">
                <div className="flex justify-between items-center text-[10px] text-neutral-500 font-black uppercase tracking-widest">
                  <span>Zoom Digital</span>
                  <span className="text-emerald-400">{zoom.toFixed(1)}x</span>
                </div>
                <input 
                  type="range"
                  min={zoomCaps.min}
                  max={zoomCaps.max}
                  step={zoomCaps.step}
                  value={zoom}
                  onChange={handleZoomChange}
                  className="w-full h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>
            )}
            
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <p className="text-[10px] text-emerald-500 uppercase font-black tracking-widest">Cédula Detectada</p>
                <p className="text-xs text-neutral-500">Usa el zoom si el QR es muy pequeño.</p>
              </div>
              
              {hasTorch && (
                <button 
                  onClick={toggleTorch}
                  className={`p-4 rounded-2xl transition-all ${isTorchOn ? 'bg-amber-500 text-white' : 'bg-neutral-800 text-neutral-400'}`}
                >
                  <RefreshCw className={isTorchOn ? 'animate-spin' : ''} size={20} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
