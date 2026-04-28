'use client'

import { useState, useEffect } from 'react'
import { X, Check, Image as ImageIcon } from 'lucide-react'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSubmit: (url: string) => void
  identCode: string
  descripcion: string
}

export default function ImagePromptModal({ isOpen, onClose, onSubmit, identCode, descripcion }: Props) {
  const [url, setUrl] = useState('')

  useEffect(() => {
    if (isOpen) setUrl('')
  }, [isOpen])

  if (!isOpen) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return
    onSubmit(url.trim())
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <ImageIcon size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Vincular Imagen</h3>
              <p className="text-xs text-neutral-500 font-mono">{identCode}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-neutral-500 hover:bg-neutral-800 rounded-lg transition-colors">
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-neutral-300 mb-6 line-clamp-2">
          Pega aquí la URL de la imagen que copiaste para: <strong className="text-white">{descripcion}</strong>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="url"
            autoFocus
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://..."
            className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500/50 transition-colors"
          />
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-neutral-400 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl flex items-center gap-2 transition-colors active:scale-95"
            >
              <Check size={16} />
              Guardar Imagen
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
