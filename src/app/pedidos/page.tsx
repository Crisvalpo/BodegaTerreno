'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { 
  Package, Clock, CheckCircle2, ChevronRight, 
  X, ShoppingBag, Loader2, User as UserIcon,
  ArrowLeft, AlertCircle, Plus, Activity
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
      fetchPedidos(parsed)
    }
  }, [])

  const fetchPedidos = async (currentUser: any) => {
    try {
      let query = supabase
        .from('pedidos')
        .select('*, usuarios(id, rut, nombre), isometricos(codigo), pedido_items(*, materiales(descripcion, unidad))')
        .order('created_at', { ascending: false })
      
      // Si no es admin ni bodeguero, solo ve los suyos
      if (currentUser.rol !== 'admin' && currentUser.rol !== 'bodeguero') {
        query = query.eq('usuario_id', currentUser.id)
      }

      const { data } = await query
      setPedidos(data || [])
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusInfo = (pedido: any) => {
    const status = pedido.estado
    if (status === 'entregado') {
      const items = pedido.pedido_items || []
      const totalRequested = items.reduce((acc: number, i: any) => acc + Number(i.cantidad_solicitada), 0)
      const totalDelivered = items.reduce((acc: number, i: any) => acc + Number(i.cantidad_entregada || 0), 0)
      
      if (totalDelivered === 0) {
        return { label: 'Cerrado / Sin Stock', color: 'text-rose-500', bg: 'bg-rose-500/10', icon: <AlertCircle size={14} /> }
      }
      if (totalDelivered < totalRequested) {
        return { label: 'Finalizado Parcial', color: 'text-amber-500', bg: 'bg-amber-500/10', icon: <Clock size={14} /> }
      }
      return { label: 'Entregado', color: 'text-emerald-500', bg: 'bg-emerald-500/10', icon: <CheckCircle2 size={14} /> }
    }

    switch (status) {
      case 'pendiente': return { label: 'En Cola', color: 'text-amber-500', bg: 'bg-amber-500/10', icon: <Clock size={14} /> }
      case 'picking': return { label: 'En Preparación', color: 'text-blue-500', bg: 'bg-blue-500/10', icon: <Loader2 size={14} className="animate-spin" /> }
      case 'listo': return { label: 'Listo para Retiro', color: 'text-emerald-400', bg: 'bg-emerald-500/20', icon: <CheckCircle2 size={14} className="animate-pulse" /> }
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
            <h1 className="text-sm font-black text-white uppercase italic leading-none">
              {user?.rol === 'admin' || user?.rol === 'bodeguero' ? 'Gestión Global' : 'Mis Pedidos'}
            </h1>
          </div>
          <Link 
            href="/pedidos/nuevo" 
            className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-500 hover:bg-emerald-500/20 transition-all active:scale-90"
          >
            <Plus size={18} />
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {pedidos.length === 0 ? (
            <div className="py-20 flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-neutral-900 border border-neutral-800 rounded-3xl flex items-center justify-center mb-6 opacity-20">
                <ShoppingBag size={40} />
              </div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-neutral-500 mb-8">No has realizado pedidos aún</p>
              <Link 
                href="/pedidos/nuevo"
                className="bg-emerald-500 text-black px-8 py-4 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 transition-all"
              >
                Solicitar Material
              </Link>
            </div>
          ) : (
            pedidos.map(p => {
              const status = getStatusInfo(p)
              
              const calcularAvance = (pedido: any) => {
                const items = pedido.pedido_items || []
                const total = items.reduce((acc: number, i: any) => acc + Number(i.cantidad_solicitada), 0)
                const entregado = items.reduce((acc: number, i: any) => acc + Number(i.cantidad_entregada || 0), 0)
                
                if (pedido.estado === 'listo') return 100
                if (pedido.estado === 'entregado' && total > 0 && entregado === 0) return 100 // Para que la barra se llene si se cerró, o mejor, que refleje el 0?
                // Decidimos que refleje la realidad física:
                return total > 0 ? Math.round((entregado / total) * 100) : 0
              }

              const progress = calcularAvance(p)
              const steps = ['pendiente', 'picking', 'listo', 'entregado']
              const currentStepIndex = steps.indexOf(p.estado)

              return (
                <div key={p.id} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-4">
                  {/* Header y Estado */}
                  <div className="flex justify-between items-start">
                    <div className="flex flex-col gap-1">
                      <div className={`flex items-center gap-2 px-2 py-1 rounded-full ${status.bg} ${status.color} w-fit mb-1`}>
                        {status.icon}
                        <span className="text-[8px] font-black uppercase tracking-widest">{status.label}</span>
                      </div>
                      {(() => {
                        const isos = new Set(p.pedido_items.map((i: any) => i.isometrico_id).filter(Boolean))
                        const label = isos.size > 1 ? 'MÚLTIPLES PLANOS' : (p.isometricos?.codigo || 'VALE GENERAL / MISCELÁNEO')
                        const isStaff = user?.rol === 'admin' || user?.rol === 'bodeguero'
                        
                        return (
                          <div className="flex flex-col gap-1">
                            <h4 className={`text-sm font-black leading-none uppercase italic ${isStaff ? 'text-emerald-500' : 'text-white'}`}>
                              {isStaff ? (
                                <div className="flex items-center gap-2">
                                  <UserIcon size={14} className="shrink-0" />
                                  <span>{p.usuarios?.nombre}</span>
                                </div>
                              ) : (
                                `Plano: ${label}`
                              )}
                            </h4>
                            <p className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">
                              {isStaff ? `Plano: ${label}` : `Ticket: #${p.id.slice(0, 5)}`}
                            </p>
                          </div>
                        )
                      })()}
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[14px] font-black text-white italic">{progress}%</span>
                      <span className="text-[7px] font-black text-neutral-600 uppercase tracking-widest">Avance</span>
                    </div>
                  </div>

                  {/* Barra de Progreso */}
                  <div className="w-full h-1 bg-neutral-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-1000 ease-out shadow-lg ${
                        p.estado === 'entregado' && progress === 0 ? 'bg-rose-500 shadow-rose-500/50' :
                        p.estado === 'entregado' && progress < 100 ? 'bg-amber-500 shadow-amber-500/50' :
                        'bg-emerald-500 shadow-emerald-500/50'
                      }`} 
                      style={{ width: `${p.estado === 'entregado' && progress === 0 ? 100 : progress}%` }}
                    />
                  </div>

                  {/* Stepper Visual */}
                  <div className="flex justify-between items-center px-2 py-1">
                    {steps.map((s, idx) => (
                      <div key={s} className="flex flex-col items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full transition-all duration-500 ${
                          idx <= currentStepIndex 
                            ? (p.estado === 'entregado' && progress === 0 ? 'bg-rose-500 shadow-[0_0_5px_rgba(244,63,94,0.8)]' : 
                               p.estado === 'entregado' && progress < 100 ? 'bg-amber-500 shadow-[0_0_5px_rgba(245,158,11,0.8)]' :
                               'bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.8)]')
                            : 'bg-neutral-800'
                        }`} />
                        <span className={`text-[6px] font-black uppercase tracking-tighter ${
                          idx <= currentStepIndex ? 'text-neutral-400' : 'text-neutral-700'
                        }`}>
                          {s === 'pendiente' ? 'Cola' : s === 'picking' ? 'Prep' : s === 'listo' ? 'Listo' : 'Fin'}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Detalle de Items */}
                  <div className="flex flex-col gap-2 bg-black/40 rounded-xl p-3 border border-neutral-800/50">
                    {p.pedido_items.map((item: any) => {
                      const isComplete = Number(item.cantidad_entregada) >= Number(item.cantidad_solicitada)
                      return (
                        <div key={item.id} className="flex justify-between items-center text-[10px] font-bold group">
                          <div className="flex flex-col">
                            <span className={`text-white uppercase truncate max-w-[180px] transition-colors ${isComplete ? 'text-neutral-500' : ''}`}>
                              {item.materiales?.descripcion || 'Material no encontrado'}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="text-[8px] text-neutral-600 font-mono">Ped: {item.cantidad_solicitada}</span>
                              <span className={`text-[8px] font-mono ${isComplete ? 'text-emerald-500' : 'text-amber-500/50'}`}>
                                Ent: {item.cantidad_entregada}
                              </span>
                            </div>
                          </div>
                          {isComplete && <CheckCircle2 size={12} className="text-emerald-500/40" />}
                        </div>
                      )
                    })}
                  </div>

                  <div className="flex justify-between items-center px-1">
                    <p className="text-[7px] text-neutral-600 font-bold uppercase tracking-widest">
                      {new Date(p.created_at).toLocaleDateString()} · {new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {p.estado === 'entregado' && (
                      <span className="text-[7px] font-black text-emerald-500/40 uppercase italic flex items-center gap-1">
                        <CheckCircle2 size={10} /> Completado
                      </span>
                    )}
                  </div>

                  {p.observaciones && (
                    <div className="mt-2 p-3 bg-rose-500/5 border border-rose-500/10 rounded-xl animate-in fade-in zoom-in-95">
                      <p className="text-[8px] font-black text-rose-500 uppercase italic mb-1 flex items-center gap-2">
                        <AlertCircle size={10} /> Nota de Bodega
                      </p>
                      <p className="text-[10px] text-neutral-400 italic font-medium leading-relaxed">
                        "{p.observaciones}"
                      </p>
                    </div>
                  )}

                  {(user?.rol === 'admin' || user?.rol === 'bodeguero') && p.estado !== 'entregado' && (
                    <Link 
                      href={`/meson?id=${p.id}`}
                      className="mt-4 w-full bg-emerald-600 text-black py-4 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-emerald-600/20"
                    >
                      <Activity size={16} />
                      Comenzar Preparación
                    </Link>
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
