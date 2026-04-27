'use client'

import { useEffect, useState, useRef } from 'react'
import { Html5Qrcode, Html5QrcodeSupportedFormats, CameraDevice } from 'html5-qrcode'
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
  const [cameras, setCameras] = useState<CameraDevice[]>([])
  const [activeCameraId, setActiveCameraId] = useState<string | null>(null)
  const qrCodeInstance = useRef<Html5Qrcode | null>(null)

  useEffect(() => {
    if (isOpen) {
      initCamerasAndStart()
    }

    return () => {
      stopScanner()
    }
  }, [isOpen])

  const initCamerasAndStart = async () => {
    setIsInitializing(true)
    setError(null)
    
    try {
      // 1. Obtener todas las cámaras
      const allCameras = await Html5Qrcode.getCameras()
      
      // 2. Filtrar solo las traseras (excluyendo 'front', 'selfie', 'user')
      const backCameras = allCameras.filter(cam => {
        const label = cam.label.toLowerCase()
        return !label.includes('front') && !label.includes('selfie') && !label.includes('user')
      })

      const availableCameras = backCameras.length > 0 ? backCameras : allCameras
      setCameras(availableCameras)

      // 3. Iniciar con la primera disponible (o 'environment' si no hay IDs)
      const initialId = availableCameras[0]?.id || null
      setActiveCameraId(initialId)
      
      await startScanner(initialId)
    } catch (err: any) {
      console.error("Error init cameras:", err)
      setError("No pudimos acceder a tu cámara. Asegúrate de dar permisos.")
      setIsInitializing(false)
    }
  }

  const startScanner = async (cameraId: string | null) => {
    setIsInitializing(true)
    
    // Pequeño delay para asegurar que el DOM esté listo y evitar colisiones
    await new Promise(r => setTimeout(r, 400))

    try {
      if (qrCodeInstance.current) {
        await stopScanner()
      }

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
          Html5QrcodeSupportedFormats.CODE_128
        ]
      }

      const cameraParam = cameraId ? cameraId : { facingMode: "environment" }

      await html5QrCode.start(
        cameraParam as any,
        config,
        (decodedText) => {
          onScan(decodedText)
          stopScanner()
          onClose()
        },
        () => {} 
      )
      
      setIsInitializing(false)
    } catch (err: any) {
      console.error("Error scanner start:", err)
      setError("Error al iniciar el lente seleccionado.")
      setIsInitializing(false)
    }
  }

  const handleSwitchCamera = async (cameraId: string) => {
    if (cameraId === activeCameraId || isInitializing) return
    setActiveCameraId(cameraId)
    await startScanner(cameraId)
  }

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
        <div className="p-4 flex-1 relative min-h-[350px] bg-black flex items-center justify-center">
          <div id="reader" className="w-full h-full overflow-hidden rounded-2xl"></div>
          
          {/* Cámara Selector (Estilo Switch) */}
          {!error && cameras.length > 1 && (
            <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-30">
              <div className="bg-neutral-900/80 backdrop-blur-md border border-white/10 rounded-full p-1.5 flex gap-1 shadow-2xl">
                {cameras.map((cam, idx) => (
                  <button
                    key={cam.id}
                    onClick={() => handleSwitchCamera(cam.id)}
                    className={`
                      w-10 h-10 rounded-full flex items-center justify-center text-xs font-black transition-all
                      ${activeCameraId === cam.id 
                        ? 'bg-emerald-500 text-black scale-110 shadow-lg shadow-emerald-500/20' 
                        : 'text-neutral-500 hover:text-white hover:bg-white/5'}
                    `}
                  >
                    {idx + 1}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isInitializing && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950 z-10 gap-3">
              <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
              <p className="text-sm text-neutral-400 font-medium">Cambiando lente...</p>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950 z-20 p-8 text-center">
              <X className="text-red-500 w-12 h-12 mb-4" />
              <p className="text-white font-bold mb-2">Error de Cámara</p>
              <p className="text-neutral-500 text-sm mb-6">{error}</p>
              <button onClick={initCamerasAndStart} className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl flex items-center gap-2">
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

        <div className="p-6 text-center bg-white/5">
          <p className="text-[10px] text-emerald-500 uppercase font-black tracking-widest mb-1">
            Lente Activo: {cameras.findIndex(c => c.id === activeCameraId) + 1}
          </p>
          <p className="text-xs text-neutral-500">
            Enfoca el código QR o PDF417 de la cédula.
          </p>
        </div>
      </div>
    </div>
  )
}
