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
    
    // Pequeño delay para asegurar que el elemento DOM existe
    await new Promise(r => setTimeout(r, 300))

    try {
      const html5QrCode = new Html5Qrcode("reader")
      qrCodeInstance.current = html5QrCode

      const config = {
        fps: 25,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const qrboxSize = Math.floor(minEdge * 0.75);
          return { width: qrboxSize, height: qrboxSize };
        },
        aspectRatio: 1.0,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.PDF_417,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.DATA_MATRIX
        ]
      }

      await html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText) => {
          onScan(decodedText)
          stopScanner()
          onClose()
        },
        (errorMessage) => {
          // Errores de escaneo ignorados (no se encontró código en este frame)
        }
      )
      
      setIsInitializing(false)
    } catch (err: any) {
      console.error("Error al iniciar el escáner:", err)
      setError("No pudimos acceder a tu cámara. Asegúrate de dar permisos.")
      setIsInitializing(false)
    }
  }

  const stopScanner = async () => {
    if (qrCodeInstance.current && qrCodeInstance.current.isScanning) {
      try {
        await qrCodeInstance.current.stop()
        qrCodeInstance.current = null
      } catch (err) {
        console.error("Error al detener el escáner:", err)
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
        <div className="p-4 flex-1 relative min-h-[350px] bg-black flex items-center justify-center">
          <div id="reader" className="w-full h-full overflow-hidden rounded-2xl"></div>
          
          {/* Overlays */}
          {isInitializing && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950 z-10 gap-3">
              <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
              <p className="text-sm text-neutral-400 font-medium">Iniciando cámara trasera...</p>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950 z-20 p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                <X className="text-red-500 w-8 h-8" />
              </div>
              <p className="text-white font-bold mb-2">Permiso de Cámara Denegado</p>
              <p className="text-neutral-500 text-sm mb-6">{error}</p>
              <button 
                onClick={startScanner}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-all"
              >
                <RefreshCw size={18} />
                Reintentar
              </button>
            </div>
          )}

          {/* Scan UI Overlay (Solo se ve cuando está escaneando) */}
          {!isInitializing && !error && (
            <div className="absolute inset-0 pointer-events-none border-[40px] border-black/40">
              <div className="w-full h-full border-2 border-emerald-500/50 rounded-xl relative">
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-500 rounded-tl-lg"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-500 rounded-tr-lg"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-500 rounded-bl-lg"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-500 rounded-br-lg"></div>
                
                <div className="absolute top-1/2 left-0 w-full h-[2px] bg-emerald-500/30 animate-pulse"></div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 text-center bg-white/5">
          <p className="text-[10px] text-emerald-500 uppercase font-black tracking-widest mb-1">
            Modo: Cámara Trasera
          </p>
          <p className="text-xs text-neutral-500">
            Apunta directamente al código QR o PDF417 de la cédula.
          </p>
        </div>
      </div>
    </div>
  )
}
