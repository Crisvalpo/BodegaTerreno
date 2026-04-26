'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Wifi, WifiOff, Database, ShieldCheck } from 'lucide-react'


export default function ConnectionDebug() {
  const [status, setStatus] = useState<'testing' | 'ok' | 'error'>('testing')
  const [details, setDetails] = useState<string>('')

  useEffect(() => {
    async function check() {
      try {
        const res = await fetch(`/api/stock?t=${Date.now()}`)
        if (!res.ok) throw new Error('API Error')
        setStatus('ok')
        setDetails(`API Link OK`)
      } catch (err: any) {
        setStatus('error')
        setDetails(err.message || 'Error de API')
      }
    }
    check()
  }, [])

  return (
    <div className="fixed bottom-4 left-4 z-[200]">
      <div className={`flex items-center gap-3 px-4 py-2 rounded-2xl border backdrop-blur-md shadow-2xl transition-all ${
        status === 'testing' ? 'bg-neutral-900/80 border-neutral-700 text-neutral-400' :
        status === 'ok' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
        'bg-red-500/10 border-red-500/30 text-red-400'
      }`}>
        {status === 'testing' && <Database className="w-4 h-4 animate-pulse" />}
        {status === 'ok' && <Wifi className="w-4 h-4" />}
        {status === 'error' && <WifiOff className="w-4 h-4" />}
        
        <div className="flex flex-col">
          <span className="text-[10px] font-black uppercase tracking-widest leading-none mb-1">
            Status de Datos
          </span>
          <span className="text-xs font-medium leading-none">
            {status === 'testing' ? 'Verificando...' : details}
          </span>
        </div>
      </div>
    </div>
  )
}
