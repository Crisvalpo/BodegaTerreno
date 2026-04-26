'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'
import Link from 'next/link'
import { 
  ScanLine, Search, PackageOpen, CheckCircle2, 
  ChevronRight, User, AlertCircle, Loader2, 
  MapPin, Plus, Trash2, ShoppingBag, X, Map, Camera
} from 'lucide-react'
import ScannerModal from '@/components/ScannerModal'
import { searchOrdersByRutAction } from '../actions/stock'

type Pedido = {
  id: string
  estado: string
  created_at: string
  usuarios: { id: string; rut: string; nombre: string }
  isometricos: { codigo: string }
  pedido_items: {
    id: string
    cantidad_solicitada: number
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

  const [rutSuggestions, setRutSuggestions] = useState<any[]>([])

  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Inicializar cantidades a entregar según stock disponible
  useEffect(() => {
    if (pedidoSeleccionado) {
      const initial: Record<string, number> = {}
      pedidoSeleccionado.pedido_items.forEach(item => {
        const totalDisp = item.materiales.existencias?.reduce((acc: number, ex: any) => acc + Number(ex.cantidad), 0) || 0
        // Sugerir el máximo posible (el menor entre lo solicitado y lo disponible)
        initial[item.id] = Math.min(item.cantidad_solicitada, totalDisp)
      })
      setQuantitiesToDeliver(initial)
    }
  }, [pedidoSeleccionado])

  // Sugerencias de RUT
  useEffect(() => {
    const fetchSuggestions = async () => {
      const clean = rutBusqueda.replace(/[\.-]/g, '').trim()
      if (clean.length < 3) {
        setRutSuggestions([])
        return
      }
      const { data } = await supabase
        .from('usuarios')
        .select('id, rut, nombre')
        .or(`rut.ilike.${clean}%,nombre.ilike.%${clean}%`)
        .limit(5)
      setRutSuggestions(data || [])
    }
    const timer = setTimeout(fetchSuggestions, 300)
    return () => clearTimeout(timer)
  }, [rutBusqueda])

  // Utilidad para extraer el RUT de un escaneo (soporta texto plano o URL de Cédula)
  const parseRut = (input: string): string => {
    // 1. Intentar buscar patrón de URL de Registro Civil (RUN=... o P4_RUT=...)
    const runMatch = input.match(/RUN=([\dkK.-]+)/i)
    if (runMatch) {
      return runMatch[1].replace(/\./g, '') // Extraer lo que sigue a RUN= y limpiar puntos
    }

    const urlMatch = input.match(/RUT=(\d+)/i) || input.match(/P4_RUT,P4_DV:(\d+),([\dkK])/i)
    if (urlMatch) {
      if (urlMatch[2]) return `${urlMatch[1]}-${urlMatch[2]}`
      return urlMatch[1]
    }

    // 2. Buscar patrón estándar de RUT en el texto
    const rutMatch = input.match(/(\d{1,2}\.?\d{3}\.?\d{3}-?[\dkK])/i)
    if (rutMatch) {
      return rutMatch[0].replace(/\./g, '')
    }

    return input.trim()
  }

  // Buscar Pedidos Pendientes
  const buscarPedidos = async (input: string) => {
    if (!input) return
    setIsLoading(true)
    setRutSuggestions([]) // Limpiar sugerencias al buscar
    try {
      const cleanRut = parseRut(input)
      setRutBusqueda(cleanRut) 
      
      const res = await searchOrdersByRutAction(cleanRut)
      
      if (!res.success) throw new Error(res.error)

      const pedidos = res.pedidos || []
      
      if (pedidos.length === 0) {
        if (res.user) {
          setDirectUser(res.user)
          setIsDirectMode(true)
          toast.info('Sin pedidos pendientes', { description: 'Iniciando Entrega Directa.' })
        } else {
          setDirectUser({ rut: cleanRut, nombre: '', telefono: '+569' })
          setIsDirectMode(true)
          toast('Trabajador Nuevo', { description: 'Ingresa su nombre y teléfono para registrarlo.' })
        }
      } else {
        setPedidos(pedidos as any)
        setIsDirectMode(false)
      }
      setRutBusqueda('')
    } catch (error: any) {
      toast.error('Error al buscar', { description: error.message })
    } finally {
      setIsLoading(false)
    }
  }

  // Sugerencias de RUT mientras escribe
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (rutBusqueda.length < 3 || rutBusqueda.includes('http')) {
        setRutSuggestions([])
        return
      }
      const { data } = await supabase
        .from('usuarios')
        .select('id, rut, nombre')
        .ilike('rut', `%${rutBusqueda}%`)
        .limit(5)
      setRutSuggestions(data || [])
    }
    const timer = setTimeout(fetchSuggestions, 300)
    return () => clearTimeout(timer)
  }, [rutBusqueda])

  // Autocomplete de Isométricos
  useEffect(() => {
    const searchIso = async () => {
      if (directIsoSearch.length < 2) {
        setFoundIsos([])
        return
      }
      const { data } = await supabase.from('isometricos').select('*').ilike('codigo', `%${directIsoSearch}%`).limit(5)
      setFoundIsos(data || [])
    }
    const timer = setTimeout(searchIso, 300)
    return () => clearTimeout(timer)
  }, [directIsoSearch])

  // Autocomplete de Materiales
  useEffect(() => {
    const searchItems = async () => {
      if (itemSearch.length < 3) {
        setFoundItems([])
        return
      }
      const { data } = await supabase
        .from('materiales')
        .select(`
          id, ident_code, descripcion,
          existencias(id, cantidad, ubicacion_id, ubicaciones(zona, rack, nivel))
        `)
        .or(`ident_code.ilike.%${itemSearch}%,descripcion.ilike.%${itemSearch}%`)
        .limit(5)
      setFoundItems(data || [])
    }
    const timer = setTimeout(searchItems, 300)
    return () => clearTimeout(timer)
  }, [itemSearch])

  const addToDirect = (mat: any) => {
    if (!selectedIso) {
      toast.error('Selecciona primero un Isométrico de destino')
      return
    }
    const exists = directItems.find(i => i.id === mat.id && i.iso?.id === selectedIso.id)
    if (exists) {
      setDirectItems(directItems.map(i => (i.id === mat.id && i.iso?.id === selectedIso.id) ? {...i, cantidad: i.cantidad + 1} : i))
    } else {
      setDirectItems([...directItems, {...mat, cantidad: 1, iso: selectedIso}])
    }
    setItemSearch('')
    setFoundItems([])
  }

  const procesarDespacho = async (pedidoInfo: any, items: any[]) => {
    if (items.length === 0) return toast.error('No hay items para despachar')
    
    // Validar que hay algo que entregar
    const totalAEntregar = items.reduce((acc, item) => {
      const q = isDirectMode ? item.cantidad : (quantitiesToDeliver[item.id] || 0)
      return acc + q
    }, 0)

    if (totalAEntregar <= 0) return toast.error('No has definido cantidades para entregar')

    setIsLoading(true)
    try {
      let currentUserId = isDirectMode ? directUser.id : pedidoInfo?.usuarios?.id
      
      if (isDirectMode && !currentUserId) {
        const { data: newUser, error: uError } = await supabase.from('usuarios').insert({ 
          rut: directUser.rut, nombre: directUser.nombre, telefono: directUser.telefono 
        }).select().single()
        if (uError) throw uError
        currentUserId = newUser.id
      }

      // Agrupar items por Isométrico
      const itemsPorIso: any = {}
      items.forEach(item => {
        const isoId = isDirectMode ? item.iso?.id : (pedidoInfo?.isometrico_id || 'SIN_ISO')
        if (!itemsPorIso[isoId]) itemsPorIso[isoId] = []
        itemsPorIso[isoId].push(item)
      })

      for (const [isoId, isoItems] of Object.entries(itemsPorIso)) {
        let currentIsoId = isoId === 'SIN_ISO' ? null : isoId
        let currentPedidoId = pedidoInfo?.id

        if (isDirectMode) {
          const { data: newPedido, error: pError } = await supabase.from('pedidos').insert({
            usuario_id: currentUserId, isometrico_id: currentIsoId, tipo: 'meson', estado: 'entregado', delivered_at: new Date().toISOString()
          }).select().single()
          if (pError) throw pError
          currentPedidoId = newPedido.id
        }

        for (const item of (isoItems as any[])) {
          let aEntregar = isDirectMode ? item.cantidad : (quantitiesToDeliver[item.id] || 0)
          if (aEntregar <= 0) continue

          const existencias = item.materiales ? item.materiales.existencias : item.existencias
          const materialId = item.materiales ? item.materiales.id : item.id
          const sortedStock = [...(existencias || [])].sort((a, b) => b.cantidad - a.cantidad)

          for (const stock of sortedStock) {
            if (aEntregar <= 0) break
            const aDescontar = Math.min(aEntregar, stock.cantidad)
            
            // 1. Descontar de existencias
            await supabase.from('existencias').update({ cantidad: stock.cantidad - aDescontar }).eq('id', stock.id)
            
            // 2. Registrar movimiento
            await supabase.from('movimientos').insert({
              material_id: materialId,
              ubicacion_id: stock.ubicacion_id,
              tipo: 'OUT',
              cantidad: aDescontar,
              referencia_id: currentPedidoId,
              usuario_id: currentUserId
            })
            
            // 3. Si no es directo, actualizar el item del pedido
            if (!isDirectMode) {
              const { data: currentItem } = await supabase.from('pedido_items').select('cantidad_entregada').eq('id', item.id).single()
              const nuevaCantidad = (currentItem?.cantidad_entregada || 0) + aDescontar
              await supabase.from('pedido_items').update({ cantidad_entregada: nuevaCantidad }).eq('id', item.id)
            }

            aEntregar -= aDescontar
          }
        }
      }

      // Cerrar pedido si todo está completo
      if (!isDirectMode && pedidoSeleccionado) {
        const { data: updatedItems } = await supabase.from('pedido_items').select('cantidad_solicitada, cantidad_entregada').eq('pedido_id', pedidoSeleccionado.id)
        const todoEntregado = updatedItems?.every(i => Number(i.cantidad_entregada) >= Number(i.cantidad_solicitada))
        
        if (todoEntregado) {
          await supabase.from('pedidos').update({ estado: 'entregado', delivered_at: new Date().toISOString() }).eq('id', pedidoSeleccionado.id)
        } else {
          await supabase.from('pedidos').update({ estado: 'picking' }).eq('id', pedidoSeleccionado.id)
          toast('Entrega parcial registrada', { description: 'El pedido permanecerá abierto para los items faltantes.' })
        }
      }

      toast.success('Despacho completado con éxito')
      resetAll()
    } catch (error: any) {
      toast.error('Error en despacho')
    } finally {
      setIsLoading(false)
    }
  }

  const resetAll = () => {
    setPedidoSeleccionado(null)
    setPedidos([])
    setIsDirectMode(false)
    setDirectUser(null)
    setDirectItems([])
    setSelectedIso(null)
    setDirectIsoSearch('')
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const [isScannerOpen, setIsScannerOpen] = useState(false)

  return (
    <div className="min-h-screen bg-neutral-950 p-4 md:p-8 flex flex-col items-center">
      <header className="w-full max-w-6xl flex items-center justify-between mb-8">
        <h1 className="text-3xl font-black text-white flex items-center gap-3">
          <ScanLine className="text-blue-500" />
          Mesón de Bodega
        </h1>
        <div className="flex gap-2">
          <button 
            onClick={() => { setIsDirectMode(!isDirectMode); setPedidoSeleccionado(null); }}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${isDirectMode ? 'bg-amber-500 text-neutral-950 shadow-lg shadow-amber-500/20' : 'bg-neutral-900 text-neutral-400 border border-neutral-800'}`}
          >
            {isDirectMode ? 'Modo: Entrega Directa' : 'Cambiar a Directo'}
          </button>
          <Link href="/" className="p-2 bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-500 hover:text-white transition-colors"><X /></Link>
        </div>
      </header>

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* SIDEBAR */}
        <div className="lg:col-span-4 space-y-6">
          <div className="glass rounded-3xl p-6 border border-blue-500/20 shadow-xl shadow-blue-500/5">
            <label className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2 block">Identificación Operario</label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600 w-5 h-5" />
                <input 
                  ref={inputRef}
                  type="text" 
                  value={rutBusqueda}
                  onChange={e => {
                    const val = e.target.value
                    setRutBusqueda(val)
                    // Si parece una URL de escaneo (muy larga), parsear al vuelo
                    if (val.length > 20 && val.includes('http')) {
                      const clean = parseRut(val)
                      if (clean !== val) {
                        setRutBusqueda(clean)
                        buscarPedidos(clean)
                      }
                    }
                  }}
                  onKeyDown={e => e.key === 'Enter' && buscarPedidos(rutBusqueda)}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-2xl pl-11 pr-14 py-4 text-white font-bold focus:outline-none focus:border-blue-500"
                  placeholder="Escribe RUT o escanea..."
                />
                <button 
                  onClick={() => setIsScannerOpen(true)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-blue-600/20 text-blue-400 rounded-xl hover:bg-blue-600 hover:text-white transition-all"
                >
                  <Camera size={20} />
                </button>
              </div>

              {rutSuggestions.length > 0 && (
                <div className="absolute top-full left-0 w-full mt-2 bg-neutral-900 border border-neutral-800 rounded-3xl shadow-2xl z-50 overflow-hidden divide-y divide-white/5 animate-in fade-in zoom-in-95">
                  {rutSuggestions.map(u => (
                    <button 
                      key={u.id} 
                      onClick={() => {
                        setRutBusqueda(u.rut);
                        buscarPedidos(u.rut);
                      }}
                      className="w-full text-left p-5 hover:bg-blue-600/10 border-b border-white/5 last:border-0 group flex flex-col gap-1 transition-all"
                    >
                      <span className="text-white font-black text-lg group-hover:text-blue-400 transition-colors">{u.rut}</span>
                      <span className="text-xs text-neutral-500 font-bold uppercase tracking-widest">{u.nombre}</span>
                    </button>
                  ))}
                </div>
              )}
          </div>

          {!isDirectMode && pedidos.length > 0 && (
            <div className="space-y-3 animate-in slide-in-from-left-4 duration-300">
              <p className="text-[10px] font-black text-neutral-500 uppercase px-2">Pedidos Pendientes ({pedidos.length})</p>
              {pedidos.map(p => (
                <button key={p.id} onClick={() => setPedidoSeleccionado(p)} className={`w-full text-left p-5 rounded-3xl border transition-all ${pedidoSeleccionado?.id === p.id ? 'bg-blue-600 border-blue-400 text-white shadow-lg' : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:bg-neutral-800'}`}>
                  <div className="flex justify-between items-center">
                    <span className="font-black text-xl">{p.isometricos?.codigo || 'S/I'}</span>
                    <ChevronRight size={18} />
                  </div>
                  <p className="text-xs opacity-60 mt-1">{p.usuarios.nombre}</p>
                </button>
              ))}
            </div>
          )}

          {isDirectMode && directUser && (
            <div className="glass rounded-3xl p-6 border border-amber-500/20 bg-amber-500/5 animate-in zoom-in duration-300">
              <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Operario</p>
              {directUser.id ? (
                <h3 className="text-xl font-black text-white mb-6">{directUser.nombre}</h3>
              ) : (
                  <div className="space-y-3 mb-6">
                    <input 
                      type="text"
                      placeholder="Nombre Completo..."
                      value={directUser.nombre}
                      onChange={e => setDirectUser({...directUser, nombre: e.target.value})}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white text-sm focus:border-amber-500 outline-none"
                    />
                    <input 
                      type="tel"
                      placeholder="Teléfono (Ej: +569...)"
                      value={directUser.telefono}
                      onChange={e => setDirectUser({...directUser, telefono: e.target.value})}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white text-sm focus:border-amber-500 outline-none"
                    />
                    <p className="text-[10px] text-neutral-600 mt-1 uppercase font-bold">Registro de nuevo trabajador</p>
                  </div>
              )}
              
              <div className="relative">
                <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-1 block">Vincular Isométrico</label>
                <div className="relative">
                  <Map className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600 w-4 h-4" />
                  <input 
                    type="text"
                    placeholder="Escribe el código..."
                    value={selectedIso ? selectedIso.codigo : directIsoSearch}
                    onChange={e => { setDirectIsoSearch(e.target.value); setSelectedIso(null); }}
                    className={`w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-10 pr-4 py-3 text-sm focus:border-amber-500 outline-none uppercase ${selectedIso ? 'text-amber-400 font-bold' : 'text-white'}`}
                  />
                  {selectedIso && (
                    <button onClick={() => setSelectedIso(null)} className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600 hover:text-white"><X size={14}/></button>
                  )}
                </div>
                {foundIsos.length > 0 && !selectedIso && (
                  <div className="absolute top-full left-0 w-full mt-1 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl z-50 overflow-hidden">
                    {foundIsos.map(iso => (
                      <button key={iso.id} onClick={() => { setSelectedIso(iso); setFoundIsos([]); }} className="w-full text-left p-3 hover:bg-white/5 border-b border-white/5 text-sm text-neutral-300">
                        {iso.codigo}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* MAIN AREA */}
        <div className="lg:col-span-8">
          {isDirectMode ? (
            <div className="glass rounded-3xl border border-white/5 flex flex-col h-full min-h-[600px] overflow-hidden">
              <div className="p-6 bg-white/5 border-b border-white/5 flex justify-between items-center">
                <h2 className="text-2xl font-black text-white flex items-center gap-2">
                  <ShoppingBag className="text-amber-500" />
                  Carga de Materiales
                </h2>
                <span className="bg-amber-500 text-neutral-950 px-3 py-1 rounded-full text-[10px] font-black uppercase">Entrega en Vivo</span>
              </div>
              
              <div className="p-6 flex-1 flex flex-col">
                <div className="relative mb-6">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" />
                  <input 
                    type="text"
                    placeholder="Busca por Item Code o Descripción..."
                    value={itemSearch}
                    onChange={e => setItemSearch(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-2xl pl-12 pr-4 py-4 text-white focus:border-amber-500 outline-none"
                  />
                  {foundItems.length > 0 && (
                    <div className="absolute top-full left-0 w-full mt-2 bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl z-50 overflow-hidden">
                      {foundItems.map(mat => (
                        <button key={mat.id} onClick={() => addToDirect(mat)} className="w-full text-left p-4 hover:bg-white/5 border-b border-white/5 last:border-0 group">
                          <div className="flex justify-between items-center">
                            <p className="text-white font-bold group-hover:text-amber-400">{mat.ident_code}</p>
                            <span className="text-[10px] text-neutral-600 uppercase font-black">Stock: {mat.existencias?.reduce((a:any,b:any)=>a+b.cantidad,0) || 0}</span>
                          </div>
                          <p className="text-xs text-neutral-500 line-clamp-1">{mat.descripcion}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto pr-2">
                  {directItems.map((item, idx) => (
                    <div key={idx} className="bg-neutral-900/50 rounded-2xl p-5 border border-white/5 flex items-center justify-between group hover:border-amber-500/30 transition-all">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded font-black uppercase tracking-widest border border-blue-500/20 flex items-center gap-1">
                            <Map size={10} /> {item.iso?.codigo || 'SIN DESTINO'}
                          </span>
                        </div>
                        <p className="text-white font-bold text-lg leading-tight">{item.ident_code}</p>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {item.existencias?.map((s: any) => (
                            <span key={s.id} className="text-[10px] bg-neutral-800 text-indigo-400 px-2 py-1 rounded-lg border border-white/5 font-bold">
                              {s.ubicaciones.rack}-{s.ubicaciones.nivel}: <span className="text-white">{s.cantidad}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col items-center">
                          <label className="text-[8px] font-black text-neutral-600 uppercase mb-1">Cantidad</label>
                          <input 
                            type="number" 
                            value={item.cantidad}
                            onChange={e => {
                              const val = parseFloat(e.target.value)
                              const stock = item.existencias?.reduce((a:any,b:any)=>a+b.cantidad,0) || 0
                              if (val > stock) toast.warning(`¡Atención! Solo hay ${stock} disponibles`)
                              setDirectItems(directItems.map(i => (i.id === item.id && i.iso?.id === item.iso?.id) ? {...i, cantidad: val} : i))
                            }}
                            className={`w-20 bg-neutral-950 border ${item.cantidad > (item.existencias?.reduce((a:any,b:any)=>a+b.cantidad,0) || 0) ? 'border-red-500 text-red-500 animate-pulse' : 'border-neutral-800 text-white'} rounded-xl py-3 text-center font-black text-lg focus:border-amber-500 outline-none`}
                          />
                        </div>
                        <button onClick={() => setDirectItems(directItems.filter(i => !(i.id === item.id && i.iso?.id === item.iso?.id)))} className="p-2 text-neutral-700 hover:text-red-500 transition-colors"><Trash2 size={20}/></button>
                      </div>
                    </div>
                  ))}
                  {directItems.length === 0 && (
                    <div className="flex-1 flex flex-col items-center justify-center text-neutral-700 py-20 opacity-30">
                      <ShoppingBag size={64} className="mb-4" />
                      <p className="font-bold">Agrega materiales para iniciar el despacho</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 bg-neutral-900 border-t border-white/5 shadow-2xl">
                <button 
                  onClick={() => procesarDespacho(null, directItems)}
                  disabled={isLoading || directItems.length === 0 || !directUser}
                  className="w-full bg-amber-500 hover:bg-amber-400 text-neutral-950 font-black py-5 rounded-2xl text-xl shadow-xl shadow-amber-500/20 transition-all disabled:opacity-50 active:scale-[0.98]"
                >
                  {isLoading ? <Loader2 className="animate-spin mx-auto" /> : 'CONFIRMAR ENTREGA DIRECTA'}
                </button>
              </div>
            </div>
          ) : pedidoSeleccionado ? (
            <div className="glass rounded-3xl border border-white/10 flex flex-col h-full min-h-[600px] overflow-hidden animate-in fade-in slide-in-from-right-4 duration-500">
              <div className="p-6 bg-white/5 border-b border-white/5 flex justify-between items-center">
                <div>
                  <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest mb-1">Solicitante</p>
                  <h2 className="text-2xl font-black text-white">{pedidoSeleccionado.usuarios.nombre}</h2>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Isométrico</p>
                  <h2 className="text-xl font-black text-emerald-400">{pedidoSeleccionado.isometricos?.codigo || 'S/I'}</h2>
                </div>
              </div>

              <div className="p-6 flex-1 overflow-y-auto space-y-4 pr-2">
                {pedidoSeleccionado.pedido_items.map((item, idx) => (
                  <div key={idx} className="bg-neutral-900 rounded-3xl p-6 border border-white/5">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <p className="text-2xl font-black text-white leading-none">{item.materiales.ident_code}</p>
                        <p className="text-xs text-neutral-500 mt-2 leading-relaxed">{item.materiales.descripcion}</p>
                      </div>
                      <div className="flex gap-4 items-center">
                        <div className="bg-neutral-800 px-4 py-2 rounded-2xl text-center">
                          <p className="text-[8px] font-black text-neutral-500 uppercase mb-1">Solicitado</p>
                          <p className="text-xl font-black text-white leading-none">{item.cantidad_solicitada}</p>
                        </div>

                        {(item.cantidad_entregada || 0) > 0 && (
                          <div className="bg-emerald-500/10 border border-emerald-500/20 px-4 py-2 rounded-2xl text-center">
                            <p className="text-[8px] font-black text-emerald-500 uppercase mb-1">Entregado</p>
                            <p className="text-xl font-black text-emerald-500 leading-none">{item.cantidad_entregada}</p>
                          </div>
                        )}

                        <div className="bg-blue-600 px-4 py-2 rounded-2xl text-center shadow-lg shadow-blue-900/20 border border-blue-400/30">
                          <p className="text-[8px] font-black text-blue-100 uppercase mb-1">A Entregar</p>
                          <input 
                            type="number"
                            value={quantitiesToDeliver[item.id] || 0}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0
                              const totalDisp = item.materiales.existencias?.reduce((acc: number, ex: any) => acc + Number(ex.cantidad), 0) || 0
                              const faltante = item.cantidad_solicitada - (item.cantidad_entregada || 0)
                              const maxPosible = Math.min(faltante, totalDisp)
                              
                              if (val > maxPosible) {
                                toast.warning(`Máximo sugerido: ${maxPosible}`, { description: 'Excederías lo solicitado o el stock disponible.' })
                              }
                              
                              setQuantitiesToDeliver(prev => ({ ...prev, [item.id]: val }))
                            }}
                            className="w-12 bg-transparent text-center text-xl font-black text-white outline-none"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {item.materiales.existencias?.length > 0 ? (
                        item.materiales.existencias.map(stock => (
                          <div key={stock.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                            <MapPin size={14} />
                            <span className="text-xs font-black">{stock.ubicaciones.rack}-{stock.ubicaciones.nivel}</span>
                            <span className="text-[10px] opacity-60">({stock.cantidad} disp.)</span>
                          </div>
                        ))
                      ) : (
                        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
                           <AlertCircle size={14} />
                           <span className="text-xs font-black italic uppercase">Sin Stock en Bodega</span>
                        </div>
                      )}
                      
                      {/* Badge de estado del item */}
                      {(() => {
                        const q = quantitiesToDeliver[item.id] || 0
                        const totalDisp = item.materiales.existencias?.reduce((acc: number, ex: any) => acc + Number(ex.cantidad), 0) || 0
                        const faltante = item.cantidad_solicitada - (item.cantidad_entregada || 0)
                        
                        if (faltante <= 0) return <span className="ml-auto text-[10px] font-black text-emerald-500 uppercase">Completado</span>
                        if (totalDisp <= 0) return <span className="ml-auto text-[10px] font-black text-red-500 uppercase">Agotado</span>
                        if (totalDisp < faltante) return <span className="ml-auto text-[10px] font-black text-amber-500 uppercase">Stock Parcial</span>
                        return <span className="ml-auto text-[10px] font-black text-blue-500 uppercase">Listo</span>
                      })()}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-6 bg-neutral-900 border-t border-white/5">
                <button 
                  onClick={() => procesarDespacho(pedidoSeleccionado, pedidoSeleccionado.pedido_items)} 
                  disabled={isLoading || Object.values(quantitiesToDeliver).reduce((a,b)=>a+b,0) <= 0} 
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-2xl text-xl shadow-xl shadow-blue-500/20 transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {isLoading ? <Loader2 className="animate-spin" /> : (
                    <>
                      <CheckCircle2 size={24} />
                      CONFIRMAR DESPACHO
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[600px] glass rounded-3xl border border-white/5 flex flex-col items-center justify-center text-neutral-600 text-center p-12">
              <PackageOpen className="w-20 h-20 mb-4 opacity-10" />
              <p className="text-lg font-medium max-w-xs">Busca un RUT para procesar pedidos o usa el modo directo para entregas inmediatas.</p>
            </div>
          )}
        </div>
      </div>

      <ScannerModal 
        isOpen={isScannerOpen} 
        onClose={() => setIsScannerOpen(false)}
        onScan={(text) => {
          buscarPedidos(text)
        }}
        title="Escanear Cédula de Identidad"
      />
    </div>
  )
}
