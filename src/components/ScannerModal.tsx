'use client'

import { useEffect, useState } from 'react'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { X, Camera } from 'lucide-react'

type ScannerModalProps = {
  isOpen: boolean
  onClose: () => void
  onScan: (decodedText: string) => void
  title?: string
}

export default function ScannerModal({ isOpen, onClose, onScan, title = 'Escanear Código' }: ScannerModalProps) {
  const [scanner, setScanner] = useState<Html5QrcodeScanner | null>(null)

  useEffect(() => {
    if (isOpen) {
      const newScanner = new Html5QrcodeScanner(
        "reader",
        { 
          fps: 10, 
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0
        },
        /* verbose= */ false
      )

      newScanner.render(
        (decodedText) => {
          onScan(decodedText)
          newScanner.clear()
          onClose()
        },
        (error) => {
          // console.warn(error)
        }
      )

      setScanner(newScanner)
    }

    return () => {
      if (scanner) {
        scanner.clear().catch(err => console.error("Failed to clear scanner", err))
      }
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-neutral-950/90 backdrop-blur-md">
      <div className="bg-neutral-900 border border-white/10 w-full max-w-md rounded-[2.5rem] overflow-hidden relative shadow-2xl">
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
          <div className="flex items-center gap-3">
            <Camera className="text-emerald-400 w-5 h-5" />
            <h3 className="text-white font-bold">{title}</h3>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
            <X className="text-neutral-500 hover:text-white" />
          </button>
        </div>
        
        <div className="p-4">
          <div id="reader" className="overflow-hidden rounded-2xl border-0 bg-black"></div>
        </div>

        <div className="p-6 text-center">
          <p className="text-xs text-neutral-500 uppercase font-black tracking-widest">
            Enfoca el código QR o PDF417
          </p>
        </div>
      </div>
    </div>
  )
}
