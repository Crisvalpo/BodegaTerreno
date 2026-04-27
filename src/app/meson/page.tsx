'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'
import Link from 'next/link'
import { 
  ScanLine, Search, PackageOpen, CheckCircle2, 
  ChevronRight, User, Users, ArrowRight, AlertCircle, Loader2, 
  MapPin, Plus, Minus, Trash2, ShoppingBag, X, Map, Camera,
  Database, ClipboardList, Package
} from 'lucide-react'
import ScannerModal from '@/components/ScannerModal'
import { useRouter, useSearchParams } from 'next/navigation'
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
      unidad: string
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
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <Loader2 className="text-emerald-500 animate-spin" size={32} />
      </div>
    }>
      <MesonContent />
    </Suspense>
  )
}

function MesonContent() {
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
  const searchParams = useSearchParams()
  const orderId = searchParams.get('id')
  const [allPendientes, setAllPendientes] = useState<Pedido[]>([])
  const [isScannerOpen, setIsScannerOpen] = useState(false)
  const [rutSuggestions, setRutSuggestions] = useState<any[]>([])
  const [observaciones, setObservaciones] = useState('')

  const finalizarConFaltantes = async () => {
    if (!pedidoSeleccionado) return
    if (!observaciones.trim()) return toast.error('Debes indicar el motivo del cierre (ej: Sin Stock)')
    
    setIsLoading(true)
    try {
      const { error } = await supabase
        .from('pedidos')
        .update({ 
          estado: 'entregado', 
          delivered_at: new Date().toISOString(),
          observaciones: observaciones.trim()
        })
        .eq('id', pedidoSeleccionado.id)
      
      if (error) throw error
      toast.success('Pedido cerrado administrativamente')
      setAllPendientes(prev => prev.filter(p => p.id !== pedidoSeleccionado.id))
      resetAll()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (orderId) {
      const fetchDirectOrder = async () => {
        setIsLoading(true)
        const { data, error } = await supabase
          .from('pedidos')
          .select('*, usuarios(id, rut, nombre), isometricos(codigo), pedido_items(*, materiales(id, ident_code, descripcion, unidad, existencias(id, cantidad, ubicacion_id, ubicaciones(zona, rack, nivel))))')
          .eq('id', orderId)
          .single()
        
        if (data && !error) {
          setPedidoSeleccionado(data as any)
        }
        setIsLoading(false)
      }
      fetchDirectOrder()
    }
  }, [orderId])

  // DERIVADOS
  const itemsToProcess = isDirectMode ? directItems : (pedidoSeleccionado?.pedido_items || [])

  const handleUpdateQty = (id: string, delta: number) => {
    const item = itemsToProcess.find(i => i.id === id)
    const material = item?.materiales || item
    const totalStock = material?.existencias?.reduce((acc: number, ex: any) => acc + Number(ex.cantidad), 0) || 0

    setQuantitiesToDeliver(prev => {
      const current = prev[id] || 0
      const next = current + delta
      
      // Si hay stock, el mínimo es 1. Solo permitimos 0 si el stock es 0 (quiebre real).
      const minQty = totalStock > 0 ? 1 : 0
      if (next < minQty) return { ...prev, [id]: minQty }
      
      if (delta > 0 && next > totalStock) {
        toast.error('Stock insuficiente', { 
          description: `Solo hay ${totalStock} unidades en bodega para este material.` 
        })
        return prev
      }

      return { ...prev, [id]: next }
    })
  }

  const removeItem = (id: string) => {
    setDirectItems(prev => prev.filter(i => i.id !== id))
    setQuantitiesToDeliver(prev => {
      const { [id]: _, ...rest } = prev
      return rest
    })
  }

  const handleDespachar = () => {
    procesarDespacho(pedidoSeleccionado, itemsToProcess)
  }

  const inputRef = useRef<HTMLInputElement>(null)
  const isoInputRef = useRef<HTMLInputElement>(null)

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
        .in('estado', ['pendiente', 'picking', 'listo'])
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
        setActiveTab('entrega')
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
    
    const totalStock = mat.existencias?.reduce((acc: number, ex: any) => acc + Number(ex.cantidad), 0) || 0
    const hasStock = totalStock > 0

    const exists = directItems.find(i => i.id === mat.id)
    if (exists) {
      setQuantitiesToDeliver(prev => {
        const current = prev[mat.id] || 0
        if (current + 1 > totalStock && hasStock) {
          toast.error('Límite de stock alcanzado')
          return prev
        }
        return { ...prev, [mat.id]: current + (hasStock ? 1 : 0) }
      })
    } else {
      setDirectItems([...directItems, { ...mat, iso: selectedIso }])
      setQuantitiesToDeliver(prev => ({ ...prev, [mat.id]: hasStock ? 1 : 0 }))
      if (!hasStock) {
        toast.warning('Material sin stock', { description: 'Se añadirá al pedido con cantidad 0 para registrar la falta.' })
      }
    }
    setItemSearch(''); setFoundItems([])
  }

  const procesarDespacho = async (pedidoInfo: any, items: any[]) => {
    if (items.length === 0) return toast.error('No hay materiales para entregar')

    setIsLoading(true)
    try {
      let userId = isDirectMode ? directUser.id : pedidoInfo?.usuarios?.id
      
      if (isDirectMode) {
        // Validaciones de Registro
        if (!directUser.nombre || directUser.nombre.length < 3 || directUser.nombre === 'NUEVO OPERARIO') {
          throw new Error('Debe ingresar un nombre válido para el operario')
        }
        const phoneDigits = directUser.telefono.replace('+569', '')
        if (phoneDigits.length !== 8) {
          throw new Error('El teléfono debe tener exactamente 8 dígitos (después del +569)')
        }

        if (!userId) {
          const { data: newUser, error } = await supabase.from('usuarios').insert({ 
            rut: directUser.rut.replace(/[\.-]/g, '').trim(), 
            nombre: directUser.nombre, 
            telefono: directUser.telefono 
          }).select().single()
          if (error) throw error
          userId = newUser.id
        } else {
          // Actualizar datos por si el bodeguero corrigió nombre/teléfono
          await supabase.from('usuarios').update({ 
            nombre: directUser.nombre, 
            telefono: directUser.telefono 
          }).eq('id', userId)
        }
      }

      let activePedidoId = pedidoInfo?.id

      // Si es entrega directa, creamos un pedido "fantasma" ya entregado para la trazabilidad
      if (isDirectMode) {
        const { data: newPed, error: pErr } = await supabase.from('pedidos').insert({
          usuario_id: userId,
          isometrico_id: selectedIso?.id,
          estado: 'entregado',
          delivered_at: new Date().toISOString()
        }).select().single()
        if (pErr) throw pErr
        activePedidoId = newPed.id
      }

      for (const item of items) {
        let aEntregarTotal = quantitiesToDeliver[item.id] || 0
        const materialId = item.materiales ? item.materiales.id : item.id
        
        // 1. Registrar el Item en el Pedido (Solicitado vs Entregado)
        if (isDirectMode) {
          await supabase.from('pedido_items').insert({
            pedido_id: activePedidoId,
            material_id: materialId,
            cantidad_solicitada: aEntregarTotal > 0 ? aEntregarTotal : 1, // Si es 0, marcamos que pidió 1 para el quiebre
            cantidad_entregada: aEntregarTotal,
            isometrico_id: selectedIso?.id
          })
        } else {
          // Si no es directo, el item ya existe, solo actualizamos lo entregado
          await supabase.from('pedido_items').update({
            cantidad_entregada: (item.cantidad_entregada || 0) + aEntregarTotal
          }).eq('id', item.id)
        }

        // 2. Descontar Stock y Crear Movimientos (Solo si se entregó algo > 0)
        if (aEntregarTotal > 0) {
          let restante = aEntregarTotal
          const existencias = item.materiales ? item.materiales.existencias : item.existencias
          const sortedStock = [...(existencias || [])].sort((a, b) => b.cantidad - a.cantidad)

          for (const stock of sortedStock) {
            if (restante <= 0) break
            const aDescontar = Math.min(restante, stock.cantidad)
            
            await supabase.from('existencias').update({ cantidad: stock.cantidad - aDescontar }).eq('id', stock.id)
            await supabase.from('movimientos').insert({
              material_id: materialId, 
              ubicacion_id: stock.ubicacion_id, 
              tipo: 'OUT', 
              cantidad: aDescontar,
              referencia_id: activePedidoId, 
              usuario_id: userId
            })
            
            restante -= aDescontar
          }
        }
      }

      if (!isDirectMode && pedidoSeleccionado) {
        const { data: updated } = await supabase.from('pedido_items').select('cantidad_solicitada, cantidad_entregada').eq('pedido_id', pedidoSeleccionado.id)
        const allDone = updated?.every(i => Number(i.cantidad_entregada) >= Number(i.cantidad_solicitada))

        if (allDone) {
          await supabase.from('pedidos').update({ estado: 'entregado', delivered_at: new Date().toISOString() }).eq('id', pedidoSeleccionado.id)
          setAllPendientes(prev => prev.filter(p => p.id !== pedidoSeleccionado.id))
        } else {
          await supabase.from('pedidos').update({ estado: 'picking' }).eq('id', pedidoSeleccionado.id)
          // Forzar cambio a 'picking' en el estado local para que el botón cambie a "Ir al Despacho"
          setAllPendientes(prev => prev.map(p => p.id === pedidoSeleccionado.id ? { ...p, estado: 'picking' } : p))
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
                {[...pedidos]
                  .sort((a, b) => (a.estado === 'listo' ? -1 : (b.estado === 'listo' ? 1 : 0)))
                  .map(p => {
                    const isReady = p.estado === 'listo'
                    const isPicking = p.estado === 'picking'
                    
                    return (
                      <button 
                        key={p.id}
                        onClick={() => handleSelectPedido(p)}
                        className={`w-full text-left p-5 rounded-2xl border transition-all active:scale-[0.98] flex flex-col gap-3 ${
                          pedidoSeleccionado?.id === p.id 
                            ? 'bg-emerald-500/10 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.1)]' 
                            : isReady 
                              ? 'bg-neutral-900 border-emerald-500/30' 
                              : 'bg-neutral-900 border-neutral-800'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
                                isReady ? 'bg-emerald-500 text-black' : isPicking ? 'bg-blue-600 text-white' : 'bg-neutral-800 text-neutral-500'
                              }`}>
                                {isReady ? 'LISTO PARA RETIRO' : isPicking ? 'EN PREPARACIÓN' : 'PENDIENTE'}
                              </span>
                              {isReady && <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
                            </div>
                            <span className="text-sm font-black text-white uppercase italic tracking-tighter">
                              Plano: {(() => {
                                const isos = new Set(p.pedido_items.map((i: any) => i.isometrico_id).filter(Boolean))
                                return isos.size > 1 ? 'MÚLTIPLES PLANOS' : (p.isometricos?.codigo || 'VALE GENERAL')
                              })()}
                            </span>
                          </div>
                          <ChevronRight size={14} className={isReady ? 'text-emerald-500' : 'text-neutral-700'} />
                        </div>
                        
                        <div className="flex flex-col gap-1 px-1">
                          {p.pedido_items.slice(0, 3).map((item: any) => (
                            <div key={item.id} className="flex justify-between items-center text-[9px] font-bold text-neutral-500">
                              <span className="truncate mr-4">{item.materiales?.descripcion}</span>
                              <span className="shrink-0">{item.cantidad_solicitada - (item.cantidad_entregada || 0)} {item.materiales?.unidad}</span>
                            </div>
                          ))}
                          {p.pedido_items.length > 3 && (
                            <span className="text-[7px] text-neutral-700 italic">+{p.pedido_items.length - 3} más...</span>
                          )}
                        </div>

                        {isReady && (
                          <div className="mt-2 w-full bg-emerald-500 text-black py-2.5 rounded-xl text-center text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20">
                            Entregar Ahora
                          </div>
                        )}
                      </button>
                    )
                  })}
              </div>
            )}

            {isDirectMode && directUser && (
              <div className="flex flex-col gap-5 animate-in slide-in-from-top-4 py-2">
                {/* Tarjeta Maestra de Entrega Directa */}
                <div 
                  onClick={() => !selectedIso && isoInputRef.current?.focus()}
                  className={`relative border-2 transition-all duration-500 rounded-3xl p-6 shadow-2xl ${
                    (!directUser.id || directUser.nombre === 'NUEVO OPERARIO' || !directUser.telefono || directUser.telefono === '+569') ? 'bg-amber-500/10 border-amber-500/50' : selectedIso ? 'bg-blue-500/10 border-blue-500/50' : 'bg-emerald-500/5 border-emerald-500/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border shadow-inner transition-colors duration-500 ${
                        (!directUser.id || directUser.nombre === 'NUEVO OPERARIO') ? 'bg-amber-500 text-black border-amber-400' : selectedIso ? 'bg-blue-500 text-black border-blue-400' : 'bg-black text-emerald-500 border-emerald-500/20'
                      }`}>
                        {(!directUser.id || directUser.nombre === 'NUEVO OPERARIO') ? <Users size={24} /> : <User size={24} />}
                      </div>
                      <div>
                        <h4 className={`text-[10px] font-bold tracking-[0.2em] mb-1 ${(!directUser.id || directUser.nombre === 'NUEVO OPERARIO' || !directUser.telefono || directUser.telefono === '+569') ? 'text-amber-500' : selectedIso ? 'text-blue-400' : 'text-emerald-500'}`}>
                          {(!directUser.id || directUser.nombre === 'NUEVO OPERARIO') ? 'Registro de nuevo trabajador' : (!directUser.telefono || directUser.telefono === '+569') ? 'Falta teléfono de contacto' : selectedIso ? 'Plano Seleccionado' : 'Entrega Directa'}
                        </h4>
                        <p className="text-sm font-bold text-white tracking-tight">{directUser.nombre || 'Nombre no registrado'}</p>
                        <p className="text-[9px] font-mono text-neutral-500">{directUser.rut}</p>
                      </div>
                    </div>
                    {selectedIso && (
                      <div className="flex flex-col items-end animate-in zoom-in">
                        <span className="text-[8px] font-bold text-blue-500 tracking-widest mb-1">ISO</span>
                        <span className="text-xl font-bold text-white font-mono leading-none">{selectedIso.codigo}</span>
                      </div>
                    )}
                  </div>

                  {/* Formulario de Registro Exprés o Datos Faltantes */}
                  {(!directUser.id || directUser.nombre === 'NUEVO OPERARIO' || !directUser.nombre || !directUser.telefono || directUser.telefono === '+569') && (
                    <div 
                      onClick={e => e.stopPropagation()} // <-- Evita que el clic en el formulario active el foco del Plano
                      className="mb-6 space-y-3 bg-black/50 p-4 rounded-2xl border border-amber-500/20 animate-in slide-in-from-top-2 relative z-50"
                    >
                      <input 
                        type="text" 
                        value={directUser.nombre === 'NUEVO OPERARIO' ? '' : directUser.nombre} 
                        onChange={e => setDirectUser({...directUser, nombre: e.target.value.toUpperCase()})}
                        placeholder="Nombre Completo" 
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-xs text-white outline-none focus:border-amber-500/50"
                      />
                      <div className="flex gap-2">
                        <div className="bg-neutral-800 px-3 py-3 rounded-xl text-[10px] font-black text-neutral-500 flex items-center">+569</div>
                        <input 
                          type="tel" 
                          maxLength={8}
                          value={(directUser.telefono || '').replace('+569', '')} 
                          onChange={e => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 8);
                            setDirectUser({...directUser, telefono: '+569' + val});
                          }}
                          placeholder="8 DÍGITOS" 
                          className="flex-1 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-xs text-white font-mono outline-none focus:border-amber-500/50"
                        />
                      </div>
                    </div>
                  )}

                  {/* Paso 1: Buscador de Isométricos (Integrado en tarjeta si no hay selección) */}
                  {!selectedIso ? (
                    <div className="relative group animate-in fade-in slide-in-from-bottom-2">
                      <div className="flex items-center gap-2 mb-3">
                        <Map size={14} className="text-blue-500 animate-pulse" />
                        <span className="text-[10px] font-bold text-blue-500/80 tracking-widest">Toca aquí para asignar Isométrico</span>
                      </div>
                      <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-700 group-focus-within:text-blue-500 transition-colors" />
                        <input 
                          ref={isoInputRef}
                          type="text"
                          value={directIsoSearch}
                          onChange={e => setDirectIsoSearch(e.target.value)}
                          placeholder="Busca el Plano (ej: 3900)..."
                          className="w-full bg-black/50 border border-neutral-800 rounded-2xl pl-12 pr-4 py-5 text-sm text-white outline-none focus:border-blue-500/50 shadow-inner transition-all"
                        />
                      </div>
                      {foundIsos.length > 0 && (
                        <div className="absolute top-full left-0 w-full mt-2 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl z-[60] overflow-hidden divide-y divide-neutral-800 animate-in fade-in zoom-in-95">
                          {foundIsos.map(iso => (
                            <button key={iso.id} onClick={() => { setSelectedIso(iso); setDirectIsoSearch(iso.codigo); setFoundIsos([]) }} className="w-full text-left p-5 hover:bg-blue-500/10 transition-colors flex justify-between items-center group/item">
                              <p className="text-xs text-white font-black uppercase italic">{iso.codigo}</p>
                              <ChevronRight size={16} className="text-neutral-700 group-hover/item:text-blue-500 transition-transform group-hover/item:translate-x-1" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <button 
                      onClick={() => { setSelectedIso(null); setDirectIsoSearch('') }}
                      className="w-full py-2 border border-blue-500/20 rounded-xl text-[8px] font-black text-blue-500/50 uppercase tracking-widest hover:bg-blue-500/5 transition-all"
                    >
                      Cambiar Isométrico
                    </button>
                  )}
                </div>

                {/* Paso 2: Buscador de Materiales (Foco principal tras seleccionar ISO) */}
                {selectedIso && (
                  <div className="relative animate-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center justify-between mb-3 px-2">
                      <div className="flex items-center gap-2">
                        <Plus size={14} className="text-emerald-500" />
                        <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Añadir Material al Carro</span>
                      </div>
                      <span className="text-[8px] font-bold text-neutral-700 uppercase italic">Busca por Ident Code o Nombre</span>
                    </div>
                    <div className="relative group">
                      <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-700 group-focus-within:text-emerald-500 transition-colors" />
                      <input 
                        type="text"
                        value={itemSearch}
                        onChange={e => setItemSearch(e.target.value)}
                        placeholder="Busca el material a entregar..."
                        className="w-full bg-neutral-900 border border-neutral-800 rounded-2xl pl-14 pr-4 py-5 text-sm text-white outline-none focus:border-emerald-500/50 shadow-2xl transition-all"
                      />
                    </div>
                    {foundItems.length > 0 && (
                      <div className="absolute top-full left-0 w-full mt-2 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl z-[60] overflow-hidden divide-y divide-neutral-800 animate-in fade-in zoom-in-95">
                        {foundItems.map(mat => {
                          const totalStock = mat.existencias?.reduce((acc: number, ex: any) => acc + Number(ex.cantidad), 0) || 0
                          const hasStock = totalStock > 0

                          return (
                            <button 
                              key={mat.id} 
                              onClick={() => addToDirect(mat)} 
                              className={`w-full text-left p-5 transition-colors flex justify-between items-center group/mat ${
                                hasStock ? 'hover:bg-emerald-500/10' : 'hover:bg-rose-500/5'
                              }`}
                            >
                              <div className="flex-1 min-w-0 pr-4">
                                <div className="flex items-center gap-3 mb-1">
                                  <span className="text-sm font-mono font-black text-white tracking-tighter">{mat.ident_code}</span>
                                  {hasStock ? (
                                    <span className="text-[9px] font-black bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded border border-emerald-500/20">
                                      STOCK: {totalStock}
                                    </span>
                                  ) : (
                                    <span className="text-[9px] font-black bg-rose-500/10 text-rose-500 px-2 py-0.5 rounded border border-rose-500/20">
                                      SIN STOCK
                                    </span>
                                  )}
                                </div>
                                <p className="text-[10px] text-neutral-500 font-bold uppercase italic truncate mb-1">{mat.descripcion}</p>
                                {hasStock && (
                                  <div className="flex items-center gap-1.5 text-[9px] font-black text-neutral-600 uppercase">
                                    <MapPin size={10} className="text-emerald-500" />
                                    {mat.existencias?.map((ex: any) => `${ex.ubicaciones?.zona}${ex.ubicaciones?.rack}${ex.ubicaciones?.nivel}`).join(' | ')}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-lg ${
                                  hasStock ? 'bg-emerald-500/10 text-emerald-500 group-hover/mat:bg-emerald-500 group-hover/mat:text-black' : 'bg-rose-500/10 text-rose-500 group-hover/mat:bg-rose-500 group-hover/mat:text-white'
                                }`}>
                                  <Plus size={20} />
                                </div>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Detalle de Entrega (Panel Principal Móvil) */}
          {(pedidoSeleccionado || isDirectMode) && (
            <>
            <div className="flex flex-col gap-4 pb-24 animate-in slide-in-from-bottom-6">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Detalle de Suministros</h3>
                <span className="text-[8px] font-bold text-neutral-600 uppercase italic">Items: {itemsToProcess.length}</span>
              </div>

              {itemsToProcess.map(item => {
                const material = item.materiales || item
                const requested = isDirectMode ? 1 : (item.cantidad_solicitada || item.cantidad || 0)
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
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-[7px] font-black text-emerald-500 uppercase tracking-tighter">IDENT:</span>
                          <span className="text-xs font-mono font-black text-white tracking-tighter leading-none">{material.ident_code}</span>
                        </div>
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
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => removeItem(item.id)}
                          className="p-2 text-neutral-700 hover:text-rose-500 transition-colors"
                          title="Quitar del carro"
                        >
                          <Trash2 size={16} />
                        </button>
                        <p className="text-[9px] font-black text-emerald-500/80 uppercase tracking-widest italic">A DESPACHAR:</p>
                      </div>
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

            {/* Sección de Cierre por Falta de Stock */}
            {!isDirectMode && pedidoSeleccionado && (
              <div className="bg-rose-500/5 border border-rose-500/10 rounded-2xl p-5 flex flex-col gap-4 mt-4 mb-24 animate-in fade-in slide-in-from-bottom-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/20 flex items-center justify-center text-rose-500">
                    <AlertCircle size={18} />
                  </div>
                  <div>
                    <h4 className="text-[10px] font-black text-white uppercase italic tracking-widest leading-none">Cierre por Stock</h4>
                    <p className="text-[8px] text-rose-500/60 font-bold uppercase mt-1">Acción Administrativa</p>
                  </div>
                </div>
                
                <p className="text-[9px] text-neutral-500 font-medium leading-relaxed">
                  Usa esta opción si confirmas que NO hay más stock físico. El pedido se cerrará definitivamente y se guardará este motivo.
                </p>

                <textarea 
                  value={observaciones}
                  onChange={e => setObservaciones(e.target.value)}
                  placeholder="Escribe el motivo del cierre (ej: Sin stock físico en estantería)..."
                  className="bg-black border border-neutral-800 rounded-xl p-4 text-xs text-rose-500 outline-none focus:border-rose-500/50 min-h-[100px] shadow-inner placeholder:text-neutral-800"
                />

                <button 
                  onClick={finalizarConFaltantes}
                  disabled={isLoading || !observaciones.trim()}
                  className="w-full bg-rose-600 text-white py-4 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-20 shadow-lg shadow-rose-900/40"
                >
                  {isLoading ? <Loader2 size={16} className="animate-spin" /> : 'Finalizar Pedido con Notas'}
                </button>
                </div>
              )}
            </>
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
                        <p className="text-[10px] font-mono text-neutral-500 mt-1">
                          {(() => {
                            const isos = new Set(p.pedido_items.map((i: any) => i.isometrico_id).filter(Boolean))
                            return isos.size > 1 ? 'MÚLTIPLES PLANOS' : (p.isometricos?.codigo || 'VALE GENERAL / MISCELÁNEO')
                          })()}
                        </p>
                      </div>
                      <span className="text-[8px] font-bold text-neutral-700 uppercase">{new Date(p.created_at).toLocaleTimeString()}</span>
                    </div>
                    
                    <div className="flex flex-col gap-2 bg-black/40 rounded-xl p-3">
                      {p.pedido_items.slice(0, 5).map(item => {
                        const locs = item.materiales?.existencias
                          ?.filter((ex: any) => ex.cantidad > 0)
                          .map((ex: any) => `${ex.ubicaciones.zona}-${ex.ubicaciones.rack}${ex.ubicaciones.nivel}`)
                          .join(' | ') || 'Sin ubicación'
                        
                        const stockTotal = item.materiales?.existencias?.reduce((acc: number, ex: any) => acc + Number(ex.cantidad), 0) || 0
                        const isOutOfStock = stockTotal <= 0
                        const isInsufficient = !isOutOfStock && stockTotal < (Number(item.cantidad_solicitada) - Number(item.cantidad_entregada || 0))

                        return (
                          <div key={item.id} className="flex flex-col gap-0.5 border-b border-white/5 pb-2 last:border-0 last:pb-0">
                            <div className="flex justify-between items-center text-[10px] font-bold">
                              <div className="flex items-center gap-2 truncate mr-4">
                                <span className={`truncate ${isOutOfStock ? 'text-rose-500' : isInsufficient ? 'text-amber-500' : 'text-neutral-500'}`}>
                                  <span className="font-mono opacity-60 mr-1">[{item.materiales?.ident_code}]</span>
                                  {item.materiales?.descripcion || 'Material no encontrado'}
                                </span>
                                {isOutOfStock ? (
                                  <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-500 text-[6px] font-black uppercase italic border border-rose-500/20">Sin Stock</span>
                                ) : isInsufficient ? (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-500 text-[6px] font-black uppercase italic border border-amber-500/20">Parcial (Stock: {stockTotal})</span>
                                ) : null}
                              </div>
                              <span className={`shrink-0 ${isOutOfStock ? 'text-rose-400' : isInsufficient ? 'text-amber-400' : 'text-white'}`}>
                                {item.cantidad_solicitada} {item.materiales?.unidad || ''}
                              </span>
                            </div>
                            <div className={`flex items-center gap-1 text-[8px] font-black uppercase italic ${isOutOfStock ? 'text-rose-500/50' : isInsufficient ? 'text-amber-500/50' : 'text-amber-500/60'}`}>
                              <MapPin size={8} /> {isOutOfStock ? 'REVISAR DISPONIBILIDAD' : locs}
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
        {(pedidoSeleccionado || isDirectMode) && itemsToProcess.length > 0 && (
          <div className="absolute bottom-6 left-6 right-6 z-50">
            {(() => {
              const totalToDeliver = itemsToProcess.reduce((acc, i) => acc + (quantitiesToDeliver[i.id] || 0), 0)
              const isQuiebre = totalToDeliver === 0
              
              return (
                <button 
                  onClick={handleDespachar}
                  disabled={isLoading}
                  className={`w-full ${
                    isQuiebre 
                      ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-900/40' 
                      : (isDirectMode ? 'bg-cyan-500 hover:bg-cyan-400 shadow-cyan-900/40' : 'bg-emerald-500 hover:bg-emerald-400 shadow-emerald-900/40')
                  } text-black font-black py-5 rounded-2xl flex items-center justify-center gap-3 shadow-2xl active:scale-95 transition-all uppercase tracking-widest text-xs`}
                >
                  {isLoading ? <Loader2 className="animate-spin" /> : (
                    <>
                      {isQuiebre ? <AlertCircle size={18} /> : <Package size={18} />}
                      <span>
                        {isQuiebre 
                          ? 'Confirmar Quiebre de Stock' 
                          : (isDirectMode ? 'Confirmar Entrega Directa' : 'Confirmar Despacho')
                        }
                      </span>
                    </>
                  )}
                </button>
              )
            })()}
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
