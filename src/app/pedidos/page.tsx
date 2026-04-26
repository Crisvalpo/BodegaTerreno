'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { 
  Package, Clock, CheckCircle2, ChevronRight, 
  X, ShoppingBag, Loader2, User as UserIcon,
  ArrowLeft, AlertCircle
} from 'lucide-react'
import Link from 'next/link'

export default function MisPedidos() {
  const [user, setUser] = useState<any>(null)
  const [pedidos, setPedidos] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const storedUser = localStorage.getItem('bodega_user')
    if (storedUser) {
      const parsed = JSON.parse(storedUser)
      setUser(parsed)
      fetchPedidos(parsed.id)
    }
  }, [])

  const fetchPedidos = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('pedidos')
        .select('*, isometricos(codigo), pedido_items(*, materiales(descripcion, unidad))')
        .eq('usuario_id', userId)
        .order('created_at', { ascending: false })
      setPedidos(data || [])
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pendiente': return { label: 'En Cola', color: 'text-amber-500', bg: 'bg-amber-500/10', icon: <Clock size={14} /> }
      case 'picking': return { label: 'En Preparación', color: 'text-blue-500', bg: 'bg-blue-500/10', icon: <Loader2 size={14} className="animate-spin" /> }
      case 'entregado': return { label: 'Entregado', color: 'text-emerald-500', bg: 'bg-emerald-500/10', icon: <CheckCircle2 size={14} /> }
      default: return { label: status, color: 'text-neutral-500', bg: 'bg-neutral-500/10', icon: <Package size={14} /> }
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="text-emerald-500 animate-spin" size={32} />
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-[#050505] flex justify-center selection:bg-emerald-500/30">
      <div className="w-full max-w-md bg-[#0a0a0a] min-h-screen border-x border-neutral-900 shadow-2xl flex flex-col relative overflow-hidden">
        
        <div className="p-4 border-b border-neutral-900 bg-black/50 backdrop-blur-md sticky top-0 z-50 flex items-center justify-between">
          <Link href="/" className="p-2 hover:bg-neutral-800 rounded-lg transition-colors">
            <ArrowLeft size={20} className="text-neutral-500" />
          </Link>
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1 italic">Gestión de Campo</span>
            <h1 className="text-sm font-black text-white uppercase italic leading-none">Mis Pedidos</h1>
          </div>
          <div className="w-9" />
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {pedidos.length === 0 ? (
            <div className="py-20 flex flex-col items-center text-center opacity-20">
              <ShoppingBag size={48} className="mb-4" />
              <p className="text-[10px] font-black uppercase tracking-widest">No has realizado pedidos aún</p>
            </div>
          ) : (
            pedidos.map(p => {
              const status = getStatusInfo(p.estado)
              return (
                <div key={p.id} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4">
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col">
                      <div className={`flex items-center gap-2 px-2 py-1 rounded-full ${status.bg} ${status.color} w-fit mb-2`}>
                        {status.icon}
                        <span className="text-[8px] font-black uppercase tracking-widest">{status.label}</span>
                      </div>
                      <h4 className="text-xs font-black text-white leading-none uppercase italic">Isométrico: {p.isometricos?.codigo || 'Varios'}</h4>
                      <p className="text-[8px] text-neutral-500 font-bold uppercase tracking-widest mt-1">
                        {new Date(p.created_at).toLocaleDateString()} · {new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 bg-black/40 rounded-xl p-3 border border-neutral-800/50">
                    {p.pedido_items.map((item: any) => (
                      <div key={item.id} className="flex justify-between items-center text-[10px] font-bold">
                        <div className="flex flex-col">
                          <span className="text-white uppercase truncate max-w-[180px]">{item.materiales.descripcion}</span>
                          <span className="text-[8px] text-neutral-600 font-mono">Solicitado: {item.cantidad_solicitada} {item.materiales.unidad}</span>
                        </div>
                        <div className="flex flex-col items-end">
                          <span className={`text-[10px] ${item.cantidad_entregada >= item.cantidad_solicitada ? 'text-emerald-500' : 'text-neutral-500'}`}>
                            {item.cantidad_entregada} Entregado
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {p.estado === 'entregado' && (
                    <div className="flex items-center gap-2 text-[9px] font-black text-emerald-500/60 uppercase italic mt-1">
                      <CheckCircle2 size={12} />
                      Pedido completado y retirado
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        <div className="p-6 bg-black/50 border-t border-neutral-900">
          <Link href="/pedidos/nuevo" className="w-full bg-emerald-500 text-black font-black py-4 rounded-xl flex items-center justify-center gap-3 uppercase text-xs tracking-widest">
            <Package size={18} /> Nuevo Pedido
          </Link>
        </div>
      </div>
    </main>
  )
}
