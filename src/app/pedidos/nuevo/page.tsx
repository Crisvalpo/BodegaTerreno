'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { 
  Plus, Minus, Search, ClipboardList, Database, 
  X, CheckCircle2, Loader2, User as UserIcon, ScrollText, 
  ChevronRight, ShoppingBag
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { formatRut, validateRut } from '@/lib/rutUtils'

interface Material {
  id: string
  ident_code: string
  descripcion: string
  unidad: string
  existencias: any[]
}

export default function NuevoPedido() {
  const [step, setStep] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  
  // Paso 1: Usuario
  const [rut, setRut] = useState('')
  const [nombre, setNombre] = useState('')
  const [usuario, setUsuario] = useState<any>(null)

  // Paso 2: Isométrico
  const [isometricoQuery, setIsometricoQuery] = useState('')
  const [isoSuggestions, setIsoSuggestions] = useState<any[]>([])
  const [isometrico, setIsometrico] = useState<any>(null)

  // Paso 3: Catálogo
  const [materials, setMaterials] = useState<Material[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [cart, setCart] = useState<{material: Material, cantidad: number, isometrico: any}[]>([])

  // Recuperar sesión automáticamente
  useEffect(() => {
    const storedUser = localStorage.getItem('bodega_user')
    if (storedUser) {
      const parsed = JSON.parse(storedUser)
      setUsuario(parsed)
      setStep(2)
    }
  }, [])

  // Normalización de RUT
  const handleBlur = () => {
    if (rut.length > 5) setRut(formatRut(rut))
  }

  // Carga de materiales
  useEffect(() => {
    const fetchMaterials = async () => {
      const { data } = await supabase
        .from('materiales')
        .select('*, existencias(cantidad)')
        .or(`ident_code.ilike.%${searchQuery}%,descripcion.ilike.%${searchQuery}%`)
        .limit(20)
      setMaterials(data || [])
    }
    if (step === 3) fetchMaterials()
  }, [searchQuery, step])

  // Lógica de Usuario
  const handleUsuario = async () => {
    if (rut.length < 8) return
    setIsLoading(true)
    try {
      let user = usuario
      if (!user) {
        const { data } = await supabase.from('usuarios').select('*').eq('rut', rut).single()
        if (data) { user = data } 
        else if (nombre) {
          const { data: newUser, error } = await supabase.from('usuarios').insert({ rut, nombre, rol: 'operario' }).select().single()
          if (error) throw error
          user = newUser
        } else {
          toast.error('Operario no encontrado. Ingresa el nombre para registrar.'); return
        }
      }
      setUsuario(user); setStep(2)
    } catch (e: any) { toast.error(e.message) } finally { setIsLoading(false) }
  }

  const handleIsometrico = async () => {
    if (!isometricoQuery) return
    setIsLoading(true)
    try {
      const { data } = await supabase.from('isometricos').select('*').eq('codigo', isometricoQuery.toUpperCase()).single()
      if (data) { setIsometrico(data); setStep(3) } 
      else { toast.error('Isométrico no encontrado.') }
    } finally { setIsLoading(false) }
  }

  const addToCart = (m: Material) => {
    if (!isometrico) return toast.error('Selecciona un Isométrico primero')
    setCart(prev => {
      const existing = prev.find(i => i.material.id === m.id && i.isometrico.id === isometrico.id)
      if (existing) return prev.map(i => (i.material.id === m.id && i.isometrico.id === isometrico.id) ? { ...i, cantidad: i.cantidad + 1 } : i)
      return [...prev, { material: m, cantidad: 1, isometrico }]
    })
    toast.success(`Añadido a ${isometrico.codigo}`)
  }

  const createPedido = async () => {
    if (cart.length === 0) return
    setIsLoading(true)
    try {
      const { data: pedido, error: pError } = await supabase.from('pedidos').insert({
        usuario_id: usuario.id,
        estado: 'pendiente',
        tipo: 'prepedido'
      }).select().single()
      if (pError) throw pError
      
      const items = cart.map(item => ({
        pedido_id: pedido.id,
        material_id: item.material.id,
        isometrico_id: item.isometrico.id,
        cantidad_solicitada: item.cantidad,
        cantidad_entregada: 0
      }))
      const { error: iError } = await supabase.from('pedido_items').insert(items)
      if (iError) throw iError
      setStep(4)
    } catch (e: any) { toast.error(e.message) } finally { setIsLoading(false) }
  }

  return (
    <main className="min-h-screen bg-[#050505] flex justify-center selection:bg-emerald-500/30">
      <div className="w-full max-w-md bg-[#0a0a0a] min-h-screen border-x border-neutral-900 shadow-2xl flex flex-col relative overflow-hidden">
        
        <div className="p-4 border-b border-neutral-900 bg-black/50 backdrop-blur-md sticky top-0 z-50 flex items-center justify-between">
          <Link href="/" className="p-2 hover:bg-neutral-800 rounded-lg">
            <X size={20} className="text-neutral-500" />
          </Link>
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1 italic">Nuevo Pedido</span>
            <span className="text-[8px] font-bold text-neutral-600 uppercase tracking-[0.2em]">Paso {step} de 4</span>
          </div>
          <div className="w-9" />
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {step === 1 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8">
              <div className="flex flex-col items-center text-center py-8">
                <div className="w-16 h-16 bg-neutral-900 border border-neutral-800 rounded-2xl flex items-center justify-center mb-6">
                  <UserIcon className="text-emerald-500" size={32} />
                </div>
                <h2 className="text-2xl font-black text-white tracking-tighter uppercase italic">Identidad</h2>
                <p className="text-xs text-neutral-500 uppercase tracking-widest mt-2">Valida tu RUT de operario</p>
              </div>

              <div className="space-y-4">
                <input 
                  type="text" value={rut} onChange={e => setRut(e.target.value.replace(/\./g, ''))} onBlur={handleBlur}
                  placeholder="12345678-1"
                  className="w-full bg-black border border-neutral-800 rounded-xl px-6 py-5 text-xl font-mono text-emerald-500"
                />
                {!usuario && rut.length > 7 && (
                  <input 
                    type="text" value={nombre} onChange={e => setNombre(e.target.value.toUpperCase())}
                    placeholder="NOMBRE COMPLETO"
                    className="w-full bg-black border border-neutral-800 rounded-xl px-6 py-4 text-sm font-bold text-white uppercase"
                  />
                )}
                <button onClick={handleUsuario} disabled={isLoading || !validateRut(rut)} className="w-full bg-emerald-500 text-black font-black py-5 rounded-xl uppercase text-xs tracking-widest mt-4 disabled:opacity-20">
                  {isLoading ? <Loader2 className="animate-spin mx-auto" /> : 'Continuar'}
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8">
              <div className="flex flex-col items-center text-center py-8">
                <div className="w-16 h-16 bg-neutral-900 border border-neutral-800 rounded-2xl flex items-center justify-center mb-6">
                  <ScrollText className="text-blue-500" size={32} />
                </div>
                <h2 className="text-2xl font-black text-white tracking-tighter uppercase italic">Destino</h2>
                <p className="text-xs text-neutral-500 uppercase tracking-widest mt-2">Vincular a Isométrico</p>
              </div>

              <div className="space-y-4 relative">
                <div className="relative group">
                  <ScrollText className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-700 group-focus-within:text-blue-500 transition-colors" />
                  <input 
                    type="text" 
                    value={isometricoQuery} 
                    onChange={e => {
                      setIsometricoQuery(e.target.value.toUpperCase())
                      // Búsqueda en tiempo real
                      const query = e.target.value.toUpperCase()
                      if (query.length >= 2) {
                        supabase.from('isometricos').select('*').ilike('codigo', `%${query}%`).limit(5)
                          .then(({ data }) => setIsoSuggestions(data || []))
                      } else {
                        setIsoSuggestions([])
                      }
                    }}
                    placeholder="Escribe un indicio (ej. 1002)..."
                    className="w-full bg-black border border-neutral-800 rounded-xl pl-12 pr-4 py-5 text-lg font-mono text-blue-400 focus:border-blue-500/50 outline-none shadow-2xl transition-all"
                  />
                </div>

                {isoSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 w-full mt-2 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-neutral-800 animate-in fade-in slide-in-from-top-2">
                    {isoSuggestions.map(iso => (
                      <button 
                        key={iso.id} 
                        onClick={() => {
                          setIsometrico(iso)
                          setIsometricoQuery(iso.codigo)
                          setIsoSuggestions([])
                          setStep(3)
                        }} 
                        className="w-full text-left p-4 hover:bg-blue-500/10 transition-all flex items-center justify-between group"
                      >
                        <div className="flex flex-col">
                          <span className="text-white font-black text-sm tracking-tighter uppercase italic">{iso.codigo}</span>
                          <span className="text-[8px] text-neutral-500 font-bold uppercase tracking-widest italic">{iso.descripcion || 'Sin descripción'}</span>
                        </div>
                        <ChevronRight size={14} className="text-neutral-700 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
                      </button>
                    ))}
                  </div>
                )}

                <button 
                  onClick={handleIsometrico} 
                  disabled={!isometricoQuery}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-xl uppercase text-xs tracking-widest shadow-lg shadow-blue-900/20 active:scale-[0.98] transition-all disabled:opacity-20"
                >
                  {isLoading ? <Loader2 className="animate-spin mx-auto" /> : 'Confirmar Selección'}
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-8">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-700" size={16} />
                    <input 
                      type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                      placeholder="BUSCAR MATERIAL..."
                      className="w-full bg-black border border-neutral-800 rounded-xl pl-12 pr-4 py-4 text-xs font-bold text-white outline-none"
                    />
                  </div>
                  <button 
                    onClick={() => { setIsometrico(null); setIsometricoQuery(''); setStep(2) }}
                    className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-500 flex items-center justify-center"
                    title="Añadir de otro Isométrico"
                  >
                    <Plus size={20} />
                  </button>
                </div>
                <div className="px-2">
                  <span className="text-[8px] font-black text-blue-500 uppercase tracking-widest italic">Añadiendo para: {isometrico?.codigo}</span>
                </div>

              <div className="flex flex-col gap-3 pb-32">
                {materials.map(m => {
                  const stockTotal = m.existencias?.reduce((acc: number, s: any) => acc + s.cantidad, 0) || 0
                  const isOutOfStock = stockTotal === 0

                  return (
                    <div 
                      key={m.id} 
                      className={`bg-neutral-900 border rounded-xl p-4 flex items-center gap-4 transition-all ${
                        isOutOfStock ? 'border-amber-500/30 bg-amber-500/5' : 'border-neutral-800'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-[10px] font-mono font-black text-white truncate leading-none">{m.ident_code}</p>
                          {isOutOfStock && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500 text-[7px] font-black uppercase text-black italic animate-pulse">
                              Sin Stock
                            </span>
                          )}
                        </div>
                        <p className="text-[9px] text-neutral-500 font-bold uppercase italic leading-tight truncate">{m.descripcion}</p>
                        <p className={`text-[8px] font-black uppercase mt-2 tracking-widest ${isOutOfStock ? 'text-amber-500/60' : 'text-emerald-500/40'}`}>
                          Disponible: {stockTotal} {m.unidad}
                        </p>
                      </div>
                      <button 
                        onClick={() => addToCart(m)} 
                        className={`p-3 rounded-lg transition-all active:scale-90 ${
                          isOutOfStock ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'
                        }`}
                      >
                        <Plus size={18} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="flex flex-col items-center justify-center text-center py-20">
              <CheckCircle2 className="text-emerald-500 mb-8" size={64} />
              <h2 className="text-3xl font-black text-white uppercase italic">Pedido Éxitoso</h2>
              <Link href="/" className="mt-12 px-12 py-4 bg-neutral-900 border border-neutral-800 text-white font-black rounded-xl uppercase text-[10px] italic">Volver al Inicio</Link>
            </div>
          )}
        </div>

        {step === 3 && cart.length > 0 && (
          <div className="absolute bottom-6 left-6 right-6 z-50 flex flex-col gap-3">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-4 shadow-2xl flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-neutral-500 uppercase tracking-widest leading-none mb-1">Items en Carrito</span>
                <span className="text-xl font-black text-white leading-none">{cart.length}</span>
              </div>
              <button 
                onClick={createPedido} 
                className="bg-emerald-500 text-black px-6 py-3 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center gap-2"
              >
                <CheckCircle2 size={16} /> Finalizar Pedido
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
