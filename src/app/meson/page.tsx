'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'
import Link from 'next/link'
import { 
  ScanLine, Search, PackageOpen, CheckCircle2, 
  ChevronRight, User, AlertCircle, Loader2, 
  MapPin, Plus, Minus, Trash2, ShoppingBag, X, Map, Camera,
  Database, ClipboardList, Package
} from 'lucide-react'
import ScannerModal from '@/components/ScannerModal'
import { searchOrdersByRutAction } from '../actions/stock'
import { cleanRut, formatRut, parseRutFromScan, validateRut } from '@/lib/rutUtils'

type Pedido = {
  id: string
  estado: string
  created_at: string
  usuarios: { id: string; rut: string; nombre: string }
  isometricos: { codigo: string }
  pedido_items: {
    id: string
    cantidad_solicitada: number
    cantidad_entregada: number
    materiales: { 
      id: string
      ident_code: string
      descripcion: string
      existencias: {
        id: string
        cantidad: number
        ubicacion_id: string
        ubicaciones: { zona: string; rack: string; nivel: string }
      }[]
    }
  }[]
}

export default function MesonPage() {
  const [rutBusqueda, setRutBusqueda] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [pedidoSeleccionado, setPedidoSeleccionado] = useState<Pedido | null>(null)
  const [quantitiesToDeliver, setQuantitiesToDeliver] = useState<Record<string, number>>({})
  
  // MODO ENTREGA DIRECTA
  const [isDirectMode, setIsDirectMode] = useState(false)
  const [directUser, setDirectUser] = useState<any>(null)
  const [directIsoSearch, setDirectIsoSearch] = useState('')
  const [foundIsos, setFoundIsos] = useState<any[]>([])
  const [selectedIso, setSelectedIso] = useState<any>(null)
  const [directItems, setDirectItems] = useState<any[]>([])
  const [itemSearch, setItemSearch] = useState('')
  const [foundItems, setFoundItems] = useState<any[]>([])

  const [activeTab, setActiveTab] = useState<'entrega' | 'pendientes'>('entrega')
  const [allPendientes, setAllPendientes] = useState<Pedido[]>([])
  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const [rutSuggestions, setRutSuggestions] = useState<any[]>([])

  // DERIVADOS
  const itemsToProcess = isDirectMode ? directItems : (pedidoSeleccionado?.pedido_items || [])

  const handleUpdateQty = (id: string, delta: number) => {
    setQuantitiesToDeliver(prev => ({
      ...prev,
      [id]: Math.max(0, (prev[id] || 0) + delta)
    }))
  }

  const handleDespachar = () => {
    procesarDespacho(pedidoSeleccionado, itemsToProcess)
  }

  const inputRef = useRef<HTMLInputElement>(null)

  const handleBlur = () => {
    if (rutBusqueda && !rutBusqueda.includes('http')) {
      setRutBusqueda(formatRut(rutBusqueda))
    }
  }

  useEffect(() => { inputRef.current?.focus() }, [])

  // Inicializar cantidades
  useEffect(() => {
    if (pedidoSeleccionado) {
      const initial: Record<string, number> = {}
      pedidoSeleccionado.pedido_items.forEach(item => {
        const totalDisp = item.materiales.existencias?.reduce((acc: number, ex: any) => acc + Number(ex.cantidad), 0) || 0
        initial[item.id] = Math.min(Math.max(0, item.cantidad_solicitada - item.cantidad_entregada), totalDisp)
      })
      setQuantitiesToDeliver(initial)
    }
  }, [pedidoSeleccionado])

  // Cargar todos los pendientes
  useEffect(() => {
    const fetchAllPendientes = async () => {
      const { data } = await supabase
        .from('pedidos')
        .select('*, usuarios(id, rut, nombre), isometricos(codigo), pedido_items(*, materiales(*, existencias(*, ubicaciones(*))))')
        .in('estado', ['pendiente', 'picking'])
        .order('created_at', { ascending: false })
      setAllPendientes(data as any || [])
    }
    if (activeTab === 'pendientes') fetchAllPendientes()
  }, [activeTab])

  // Sugerencias de RUT
  useEffect(() => {
    const fetchSuggestions = async () => {
      const clean = rutBusqueda.replace(/[\.-]/g, '').trim()
      if (clean.length < 3 || clean.includes('http')) { setRutSuggestions([]); return }
      const { data } = await supabase.from('usuarios').select('id, rut, nombre').or(`rut.ilike.${clean}%,nombre.ilike.%${clean}%`).limit(5)
      setRutSuggestions(data || [])
    }
    const timer = setTimeout(fetchSuggestions, 300)
    return () => clearTimeout(timer)
  }, [rutBusqueda])

  const buscarPedidos = async (input: string) => {
    if (!input) return
    setIsLoading(true)
    setRutSuggestions([])
    try {
      const clean = parseRutFromScan(input)
      const formatted = formatRut(clean)
      setRutBusqueda(formatted) 
      
      const res = await searchOrdersByRutAction(clean)
      
      if (!res.success) throw new Error(res.error)

      const pedidos = res.pedidos || []
      
      if (pedidos.length === 0) {
        if (res.user) {
          setDirectUser(res.user)
          setIsDirectMode(true)
          toast.info('Sin pedidos pendientes', { description: 'Iniciando Entrega Directa.' })
        } else {
          setDirectUser({ rut: formatted, nombre: '', telefono: '+569' })
          setIsDirectMode(true)
          toast('Trabajador Nuevo', { description: 'Ingresa su nombre y teléfono para registrarlo.' })
        }
      } else {
        setPedidos(pedidos as any)
        setIsDirectMode(false)
        setActiveTab('entrega')
      }
    } catch (error: any) {
      toast.error('Error al buscar', { description: error.message })
    } finally {
      setIsLoading(false)
    }
  }

  const startPicking = async (pedidoId: string) => {
    const { error } = await supabase.from('pedidos').update({ estado: 'picking' }).eq('id', pedidoId)
    if (error) toast.error('Error al iniciar picking')
    else {
      toast.success('Pedido en preparación')
      setAllPendientes(prev => prev.map(p => p.id === pedidoId ? { ...p, estado: 'picking' } : p))
    }
  }

  const finalizarPicking = async (pedidoId: string) => {
    const { error } = await supabase.from('pedidos').update({ estado: 'listo' }).eq('id', pedidoId)
    if (error) toast.error('Error al marcar como listo')
    else {
      toast.success('Pedido listo para retiro')
      setAllPendientes(prev => prev.map(p => p.id === pedidoId ? { ...p, estado: 'listo' } : p))
    }
  }

  const handleSelectPedido = (p: Pedido) => {
    setPedidoSeleccionado(p)
  }

  // Autocomplete Isométricos y Materiales (Direct Mode)
  useEffect(() => {
    const searchIso = async () => {
      if (directIsoSearch.length < 2) { setFoundIsos([]); return }
      const { data } = await supabase.from('isometricos').select('*').ilike('codigo', `%${directIsoSearch}%`).limit(5)
      setFoundIsos(data || [])
    }
    const timer = setTimeout(searchIso, 300); return () => clearTimeout(timer)
  }, [directIsoSearch])

  useEffect(() => {
    const searchItems = async () => {
      if (itemSearch.length < 3) { setFoundItems([]); return }
      const { data } = await supabase.from('materiales').select('id, ident_code, descripcion, existencias(id, cantidad, ubicacion_id, ubicaciones(zona, rack, nivel))').or(`ident_code.ilike.%${itemSearch}%,descripcion.ilike.%${itemSearch}%`).limit(5)
      setFoundItems(data || [])
    }
    const timer = setTimeout(searchItems, 300); return () => clearTimeout(timer)
  }, [itemSearch])

  const addToDirect = (mat: any) => {
    if (!selectedIso) return toast.error('Selecciona primero un Isométrico')
    const exists = directItems.find(i => i.id === mat.id && i.iso?.id === selectedIso.id)
    if (exists) setDirectItems(directItems.map(i => (i.id === mat.id && i.iso?.id === selectedIso.id) ? {...i, cantidad: i.cantidad + 1} : i))
    else setDirectItems([...directItems, {...mat, cantidad: 1, iso: selectedIso}])
    setItemSearch(''); setFoundItems([])
  }

  const procesarDespacho = async (pedidoInfo: any, items: any[]) => {
    const total = items.reduce((acc, i) => acc + (isDirectMode ? i.cantidad : (quantitiesToDeliver[i.id] || 0)), 0)
    if (total <= 0) return toast.error('No hay cantidades para entregar')

    setIsLoading(true)
    try {
      let userId = isDirectMode ? directUser.id : pedidoInfo?.usuarios?.id
      if (isDirectMode && !userId) {
        const { data: newUser, error } = await supabase.from('usuarios').insert({ rut: directUser.rut, nombre: directUser.nombre, telefono: directUser.telefono }).select().single()
        if (error) throw error
        userId = newUser.id
      }

      for (const item of items) {
        let aEntregar = isDirectMode ? item.cantidad : (quantitiesToDeliver[item.id] || 0)
        if (aEntregar <= 0) continue

        const existencias = item.materiales ? item.materiales.existencias : item.existencias
        const materialId = item.materiales ? item.materiales.id : item.id
        const sortedStock = [...(existencias || [])].sort((a, b) => b.cantidad - a.cantidad)

        for (const stock of sortedStock) {
          if (aEntregar <= 0) break
          const aDescontar = Math.min(aEntregar, stock.cantidad)
          await supabase.from('existencias').update({ cantidad: stock.cantidad - aDescontar }).eq('id', stock.id)
          await supabase.from('movimientos').insert({
            material_id: materialId, ubicacion_id: stock.ubicacion_id, tipo: 'OUT', cantidad: aDescontar,
            referencia_id: isDirectMode ? null : pedidoInfo.id, usuario_id: userId
          })
          if (!isDirectMode) {
            const nuevaCantidad = (item.cantidad_entregada || 0) + aDescontar
            await supabase.from('pedido_items').update({ cantidad_entregada: nuevaCantidad }).eq('id', item.id)
          }
          aEntregar -= aDescontar
        }
      }

      if (!isDirectMode && pedidoSeleccionado) {
        const { data: updated } = await supabase.from('pedido_items').select('cantidad_solicitada, cantidad_entregada').eq('pedido_id', pedidoSeleccionado.id)
        if (updated?.every(i => Number(i.cantidad_entregada) >= Number(i.cantidad_solicitada))) {
          await supabase.from('pedidos').update({ estado: 'entregado', delivered_at: new Date().toISOString() }).eq('id', pedidoSeleccionado.id)
        } else {
          await supabase.from('pedidos').update({ estado: 'picking' }).eq('id', pedidoSeleccionado.id)
        }
      }

      toast.success('Despacho completado')
      resetAll()
    } catch (e: any) { toast.error(e.message) } finally { setIsLoading(false) }
  }

  const resetAll = () => {
    setPedidoSeleccionado(null); setPedidos([]); setIsDirectMode(false); setDirectUser(null); setDirectItems([]); setRutBusqueda('')
  }

  return (
    <main className="min-h-screen bg-[#050505] flex justify-center selection:bg-emerald-500/30">
      {/* Contenedor Fijo de App Móvil */}
      <div className="w-full max-w-md bg-[#0a0a0a] min-h-screen border-x border-neutral-900 shadow-2xl flex flex-col relative overflow-hidden">
        
        {/* Header Compacto App */}
        <div className="p-4 border-b border-neutral-900 bg-black/50 backdrop-blur-md sticky top-0 z-50 flex items-center justify-between">
          <Link href="/" className="p-2 hover:bg-neutral-800 rounded-lg transition-colors">
            <X size={20} className="text-neutral-500" />
          </Link>
          <div className="flex flex-col items-center text-center">
            <div className="flex gap-1 bg-neutral-900 p-1 rounded-xl">
              <button 
                onClick={() => setActiveTab('entrega')}
                className={`flex-1 py-2 px-3 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'entrega' ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20' : 'text-neutral-500'}`}
              >
                Entrega
              </button>
              <button 
                onClick={() => setActiveTab('pendientes')}
                className={`flex-1 py-2 px-3 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all ${activeTab === 'pendientes' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'text-neutral-500'}`}
              >
                Pendientes ({allPendientes.length})
              </button>
            </div>
          </div>
          <button 
            onClick={() => setIsScannerOpen(true)}
            className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-500"
          >
            <ScanLine size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar flex flex-col gap-6">
          {activeTab === 'entrega' ? (
            <>
          {/* Barra de Búsqueda Móvil */}
          <div className="sticky top-2 z-40">
            <div className="relative group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-700 group-focus-within:text-emerald-500 transition-colors" />
              <input 
                ref={inputRef}
                type="text"
                value={rutBusqueda}
                onChange={e => setRutBusqueda(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={e => e.key === 'Enter' && validateRut(rutBusqueda) && buscarPedidos(rutBusqueda)}
                placeholder="Escanea Cédula o RUT..."
                className="w-full bg-black border border-neutral-800 rounded-xl pl-12 pr-4 py-4 text-sm font-mono text-emerald-400 focus:border-emerald-500/50 outline-none shadow-2xl"
              />
              
              {rutSuggestions.length > 0 && (
                <div className="absolute top-full left-0 w-full mt-2 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-neutral-800 animate-in fade-in">
                  {rutSuggestions.map(u => (
                    <button key={u.id} onClick={() => buscarPedidos(u.rut)} className="w-full text-left p-4 hover:bg-emerald-500/10 transition-all flex items-center justify-between group">
                      <div>
                        <p className="text-white font-bold text-xs uppercase italic">{u.nombre}</p>
                        <p className="text-[10px] text-neutral-500 font-mono">{u.rut}</p>
                      </div>
                      <ChevronRight size={14} className="text-neutral-700 group-hover:text-emerald-500" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Estado de Trabajador y Selección de Pedido */}
          <div className="flex flex-col gap-4">
            {!isDirectMode && pedidos.length > 0 && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 px-2">
                  <User size={14} className="text-emerald-500" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">Pedidos de: {pedidos[0].usuarios.nombre}</span>
                </div>
                {pedidos.map(p => (
                  <button 
                    key={p.id}
                    onClick={() => handleSelectPedido(p)}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${pedidoSeleccionado?.id === p.id ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-neutral-900 border-neutral-800'}`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-mono font-black text-white">{p.isometricos?.codigo}</span>
                      <ChevronRight size={14} className="text-neutral-700" />
                    </div>
                    <p className="text-[8px] text-neutral-500 uppercase tracking-widest italic">{new Date(p.created_at).toLocaleString()}</p>
                  </button>
                ))}
              </div>
            )}

            {isDirectMode && directUser && (
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-5 animate-in slide-in-from-top-4">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 bg-black rounded-lg flex items-center justify-center border border-emerald-500/20">
                    <User className="text-emerald-500" size={20} />
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Entrega Directa</h4>
                    <p className="text-xs font-bold text-white uppercase italic">{directUser.nombre || 'Nuevo Operario'}</p>
                    <p className="text-[8px] font-mono text-neutral-500">{directUser.rut}</p>
                  </div>
                </div>
                {!directUser.nombre && (
                  <div className="space-y-3">
                    <input 
                      type="text" value={directUser.nombre} onChange={e => setDirectUser({...directUser, nombre: e.target.value.toUpperCase()})}
                      placeholder="Nombre Completo" className="w-full bg-black border border-neutral-800 rounded-lg px-4 py-3 text-xs text-white"
                    />
                    <div className="flex gap-2">
                      <div className="bg-neutral-800 px-3 py-3 rounded-lg text-[10px] font-black text-neutral-500 flex items-center">+569</div>
                      <input 
                        type="tel" value={directUser.telefono.replace('+569', '')} onChange={e => setDirectUser({...directUser, telefono: '+569' + e.target.value})}
                        placeholder="12345678" className="flex-1 bg-black border border-neutral-800 rounded-lg px-4 py-3 text-xs text-white font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Detalle de Entrega (Panel Principal Móvil) */}
          {(pedidoSeleccionado || isDirectMode) && (
            <div className="flex flex-col gap-4 pb-24 animate-in slide-in-from-bottom-6">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Detalle de Suministros</h3>
                <span className="text-[8px] font-bold text-neutral-600 uppercase italic">Items: {itemsToProcess.length}</span>
              </div>

              {itemsToProcess.map(item => {
                const material = item.materiales || item
                const requested = item.cantidad_solicitada || item.cantidad
                const delivered = item.cantidad_entregada || 0
                const toDeliver = quantitiesToDeliver[item.id] || 0
                const stockTotal = material.existencias?.reduce((acc: number, s: any) => acc + s.cantidad, 0) || 0

                return (
                  <div key={item.id} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col gap-4">
                    <div className="flex gap-4">
                      <div className="w-14 h-14 bg-black rounded-lg border border-neutral-800 flex flex-col items-center justify-center shrink-0">
                        <span className="text-[8px] font-black text-neutral-700 uppercase leading-none mb-1">STOCK</span>
                        <span className={`text-lg font-mono font-black italic leading-none ${stockTotal > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>{stockTotal}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-mono font-black text-white truncate leading-none mb-1">{material.ident_code}</p>
                        <p className="text-[10px] text-neutral-500 font-bold uppercase italic leading-tight truncate">{material.descripcion}</p>
                        <div className="flex gap-4 mt-2">
                          <div className="flex flex-col">
                            <span className="text-[7px] font-black text-neutral-700 uppercase">Solicitado</span>
                            <span className="text-[10px] font-mono font-bold text-neutral-300">{requested}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[7px] font-black text-neutral-700 uppercase">Entregado</span>
                            <span className="text-[10px] font-mono font-bold text-emerald-600">{delivered}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-neutral-800/50">
                      <p className="text-[9px] font-black text-emerald-500/80 uppercase tracking-widest italic">A DESPACHAR:</p>
                      <div className="flex items-center gap-6">
                        <button 
                          onClick={() => handleUpdateQty(item.id, -1)}
                          className="w-10 h-10 rounded-lg bg-neutral-800 flex items-center justify-center text-neutral-500 active:bg-rose-500/20 active:text-rose-500 transition-colors"
                        >
                          <Minus size={18} />
                        </button>
                        <span className="text-2xl font-mono font-black italic text-white w-8 text-center">{toDeliver}</span>
                        <button 
                          onClick={() => handleUpdateQty(item.id, 1)}
                          className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center text-black active:scale-95 transition-all shadow-lg shadow-emerald-900/20"
                        >
                          <Plus size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          </>
          ) : (
            <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-right-4">
              {allPendientes.length === 0 ? (
                <div className="py-20 flex flex-col items-center opacity-20">
                  <PackageOpen size={48} className="mb-4" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-center">No hay pedidos pendientes</p>
                </div>
              ) : (
                allPendientes.map(p => (
                  <div key={p.id} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-5 flex flex-col gap-4">
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest italic mb-1">
                          {p.estado === 'listo' ? '🟢 LISTO' : p.estado === 'picking' ? '🔵 EN PREPARACIÓN' : '🟡 PENDIENTE'}
                        </span>
                        <h4 className="text-sm font-black text-white leading-none uppercase italic">{p.usuarios?.nombre || 'Usuario Desconocido'}</h4>
                        <p className="text-[10px] font-mono text-neutral-500 mt-1">{p.isometricos?.codigo || 'Sin Isométrico'}</p>
                      </div>
                      <span className="text-[8px] font-bold text-neutral-700 uppercase">{new Date(p.created_at).toLocaleTimeString()}</span>
                    </div>
                    
                    <div className="flex flex-col gap-2 bg-black/40 rounded-xl p-3">
                      {p.pedido_items.slice(0, 5).map(item => {
                        const locs = item.materiales?.existencias
                          ?.filter((ex: any) => ex.cantidad > 0)
                          .map((ex: any) => `${ex.ubicaciones.zona}-${ex.ubicaciones.rack}${ex.ubicaciones.nivel}`)
                          .join(' | ') || 'Sin ubicación'

                        return (
                          <div key={item.id} className="flex flex-col gap-0.5 border-b border-white/5 pb-2 last:border-0 last:pb-0">
                            <div className="flex justify-between items-center text-[10px] font-bold">
                              <span className="text-neutral-500 truncate mr-4">{item.materiales?.descripcion || 'Material no encontrado'}</span>
                              <span className="text-white shrink-0">{item.cantidad_solicitada} {item.materiales?.unidad || ''}</span>
                            </div>
                            <div className="flex items-center gap-1 text-[8px] font-black text-amber-500/60 uppercase italic">
                              <MapPin size={8} /> {locs}
                            </div>
                          </div>
                        )
                      })}
                      {p.pedido_items.length > 5 && (
                        <span className="text-[8px] text-neutral-600 italic">+{p.pedido_items.length - 5} items más...</span>
                      )}
                    </div>

                    <div className="flex gap-2 pt-2">
                      {p.estado === 'pendiente' && (
                        <button 
                          onClick={() => startPicking(p.id)}
                          className="flex-1 bg-blue-600 text-white font-black py-3 rounded-xl uppercase text-[9px] tracking-widest shadow-lg shadow-blue-900/20"
                        >
                          Comenzar Picking
                        </button>
                      )}
                      {p.estado === 'picking' && (
                        <button 
                          onClick={() => finalizarPicking(p.id)}
                          className="flex-1 bg-amber-500 text-black font-black py-3 rounded-xl uppercase text-[9px] tracking-widest shadow-lg shadow-amber-500/20"
                        >
                          Marcar como Listo
                        </button>
                      )}
                      {(p.estado === 'picking' || p.estado === 'listo') && (
                        <button 
                          onClick={() => handleSelectPedido(p)}
                          className="flex-1 bg-emerald-500 text-black font-black py-3 rounded-xl uppercase text-[9px] tracking-widest shadow-lg shadow-emerald-500/20"
                        >
                          {p.estado === 'listo' ? 'Entregar Ahora' : 'Ir al Despacho'}
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Botón de Acción Flotante App */}
        {(pedidoSeleccionado || isDirectMode) && itemsToProcess.some(i => (quantitiesToDeliver[i.id] || 0) > 0) && (
          <div className="absolute bottom-6 left-6 right-6 z-50">
            <button 
              onClick={handleDespachar}
              disabled={isLoading}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-black font-black py-5 rounded-2xl flex items-center justify-center gap-3 shadow-2xl shadow-emerald-900/40 active:scale-95 transition-all uppercase tracking-widest text-xs"
            >
              {isLoading ? <Loader2 className="animate-spin" /> : (
                <>
                  <Package size={18} />
                  <span>Confirmar Despacho</span>
                </>
              )}
            </button>
          </div>
        )}

        <ScannerModal 
          isOpen={isScannerOpen} 
          onClose={() => setIsScannerOpen(false)} 
          onScan={(val) => { buscarPedidos(val); setIsScannerOpen(false) }} 
        />
      </div>
    </main>
  )
}
