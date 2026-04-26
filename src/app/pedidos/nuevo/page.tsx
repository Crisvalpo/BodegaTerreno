'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'
import Link from 'next/link'
import { 
  ArrowRight, ArrowLeft, Search, ShoppingCart, 
  UserSquare2, Map, CheckCircle2, Plus, Minus, Trash2
} from 'lucide-react'

// Tipos
type Material = {
  id: string
  ident_code: string
  descripcion: string
  peso: number
  grupo: string
  stock?: number // Stock calculado
}

type CartItem = {
  material: Material
  cantidad: number
}

export default function NuevoPedidoPage() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [isLoading, setIsLoading] = useState(false)

  // Step 1: Usuario
  const [rut, setRut] = useState('')
  const [nombre, setNombre] = useState('')
  const [usuario, setUsuario] = useState<any>(null)
  const [rutSuggestions, setRutSuggestions] = useState<any[]>([])

  // Step 2: Isométrico
  const [isometricoQuery, setIsometricoQuery] = useState('')
  const [isometrico, setIsometrico] = useState<any>(null)
  const [isoSuggestions, setIsoSuggestions] = useState<any[]>([])

  // Sugerencias de Isométricos
  useEffect(() => {
    const fetchIsos = async () => {
      if (isometricoQuery.length < 2) {
        setIsoSuggestions([])
        return
      }
      const { data } = await supabase
        .from('isometricos')
        .select('*')
        .ilike('codigo', `%${isometricoQuery}%`)
        .limit(5)
      setIsoSuggestions(data || [])
    }
    const timer = setTimeout(fetchIsos, 300)
    return () => clearTimeout(timer)
  }, [isometricoQuery])

  // Step 3: Materiales
  const [materialQuery, setMaterialQuery] = useState('')
  const [materialesEncontrados, setMaterialesEncontrados] = useState<Material[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [groups, setGroups] = useState<string[]>([])
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [groupMaterials, setGroupMaterials] = useState<Material[]>([])
  
  // Filtros de 4 niveles
  const [filters, setFilters] = useState({ i1: '', i2: '', i3: '', i4: '' })
  const [options, setOptions] = useState({ i1: [] as string[], i2: [] as string[], i3: [] as string[], i4: [] as string[] })

  useEffect(() => {
    const storedUser = localStorage.getItem('bodega_user')
    if (storedUser) {
      const u = JSON.parse(storedUser)
      setUsuario(u)
      setRut(u.rut)
      setNombre(u.nombre)
      setStep(2) // Ir directo a Isométrico
    }
  }, [])

  useEffect(() => {
    async function fetchGroups() {
      const { data } = await supabase.from('materiales').select('part_group')
      const uniqueGroups = Array.from(new Set((data || []).map(m => m.part_group).filter(Boolean)))
      setGroups(uniqueGroups as string[])
    }
    fetchGroups()
  }, [])

  async function selectGroup(group: string) {
    setSelectedGroup(group)
    setFilters({ i1: '', i2: '', i3: '', i4: '' })
    const { data } = await supabase.from('materiales').select('input_1').eq('part_group', group)
    const unique = Array.from(new Set((data || []).map(m => m.input_1).filter(Boolean)))
    setOptions(prev => ({ ...prev, i1: unique as string[], i2: [], i3: [], i4: [] }))
    setGroupMaterials([])
  }

  async function updateFilter(key: 'i1' | 'i2' | 'i3' | 'i4', value: string) {
    const newFilters = { ...filters, [key]: value }
    if (key === 'i1') newFilters.i2 = newFilters.i3 = newFilters.i4 = ''
    if (key === 'i2') newFilters.i3 = newFilters.i4 = ''
    if (key === 'i3') newFilters.i4 = ''
    setFilters(newFilters)

    let query = supabase.from('materiales').select('*, existencias(cantidad)').eq('part_group', selectedGroup)
    if (newFilters.i1) query = query.eq('input_1', newFilters.i1)
    if (newFilters.i2) query = query.eq('input_2', newFilters.i2)
    if (newFilters.i3) query = query.eq('input_3', newFilters.i3)
    if (newFilters.i4) query = query.eq('input_4', newFilters.i4)

    const { data } = await query.limit(50)
    
    // Calcular stock total por material
    const materialsWithStock = (data || []).map((m: any) => ({
      ...m,
      stock: m.existencias?.reduce((acc: number, ex: any) => acc + Number(ex.cantidad), 0) || 0
    }))

    if (key !== 'i4') {
      const nextKey = key === 'i1' ? 'input_2' : key === 'i2' ? 'input_3' : 'input_4'
      const nextOptionsKey = key === 'i1' ? 'i2' : key === 'i2' ? 'i3' : 'i4'
      const nextUnique = Array.from(new Set((data || []).map(m => m[nextKey] as string).filter(Boolean)))
      setOptions(prev => ({ ...prev, [nextOptionsKey]: nextUnique as string[] }))
    }
    setGroupMaterials(materialsWithStock as Material[] || [])
  }

  // Sugerencias de RUT
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (rut.length < 3) {
        setRutSuggestions([])
        return
      }
      const { data } = await supabase
        .from('usuarios')
        .select('id, rut, nombre, telefono')
        .ilike('rut', `%${rut}%`)
        .limit(5)
      setRutSuggestions(data || [])
    }
    const timer = setTimeout(fetchSuggestions, 300)
    return () => clearTimeout(timer)
  }, [rut])

  const selectUser = (u: any) => {
    setUsuario(u)
    setRut(u.rut)
    setNombre(u.nombre)
    setRutSuggestions([])
    toast.success(`Bienvenido, ${u.nombre}`)
    setStep(2)
  }

  // Buscar o crear usuario (manual)
  const handleIdentificacion = async () => {
    if (!rut) return toast.error('Debes ingresar tu RUT')
    setIsLoading(true)
    try {
      let { data: user } = await supabase.from('usuarios').select('*').eq('rut', rut).single()
      
      if (!user) {
        if (!nombre) {
          toast('Usuario no encontrado', { description: 'Por favor, ingresa tu nombre para registrarte.' })
          setIsLoading(false)
          return
        }
        // Crear usuario
        const { data: newUser, error: createError } = await supabase
          .from('usuarios')
          .insert({ rut, nombre })
          .select().single()
          
        if (createError) throw createError
        user = newUser
      }
      
      setUsuario(user)
      toast.success(`Bienvenido, ${user.nombre || 'Usuario'}`)
      setStep(2)
    } catch (error: any) {
      toast.error('Error al identificar usuario', { description: error.message })
    } finally {
      setIsLoading(false)
    }
  }

  // Buscar o crear isométrico
  const handleIsometrico = async () => {
    if (!isometricoQuery) return toast.error('Ingresa un código de isométrico')
    setIsLoading(true)
    try {
      const codigo = isometricoQuery.toUpperCase().trim()
      let { data: iso } = await supabase.from('isometricos').select('*').eq('codigo', codigo).single()
      
      if (!iso) {
        // Para simplificar la demo, lo creamos al vuelo
        const { data: newIso, error } = await supabase
          .from('isometricos')
          .insert({ codigo, proyecto: 'ANDINA' })
          .select().single()
          
        if (error) throw error
        iso = newIso
        toast.success(`Isométrico ${codigo} creado`)
      }
      
      setIsometrico(iso)
      setStep(3)
    } catch (error: any) {
      toast.error('Error con el isométrico', { description: error.message })
    } finally {
      setIsLoading(false)
    }
  }

  // Buscar Materiales
  useEffect(() => {
    const searchMateriales = async () => {
      if (materialQuery.length < 3) {
        setMaterialesEncontrados([])
        return
      }
      const { data } = await supabase
        .from('materiales')
        .select('*, existencias(cantidad)')
        .or(`ident_code.ilike.%${materialQuery}%,descripcion.ilike.%${materialQuery}%`)
        .limit(15)
      
      if (data) {
        const withStock = data.map((m: any) => ({
          ...m,
          stock: m.existencias?.reduce((acc: number, ex: any) => acc + Number(ex.cantidad), 0) || 0
        }))
        setMaterialesEncontrados(withStock as Material[])
      }
    }
    
    const debounce = setTimeout(searchMateriales, 300)
    return () => clearTimeout(debounce)
  }, [materialQuery])

  // Manejo del Carrito
  const addToCart = (material: Material) => {
    if ((material.stock || 0) <= 0) {
      toast.warning('Material sin stock', {
        description: 'Este material no tiene existencias actuales, pero puedes solicitarlo si es urgente.'
      })
    }

    setCart(prev => {
      const exists = prev.find(item => item.material.id === material.id)
      if (exists) {
        return prev.map(item => item.material.id === material.id ? { ...item, cantidad: item.cantidad + 1 } : item)
      }
      toast.success('Material agregado')
      return [...prev, { material, cantidad: 1 }]
    })
  }

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.material.id === id) {
        const newQ = Math.max(1, item.cantidad + delta)
        return { ...item, cantidad: newQ }
      }
      return item
    }))
  }

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.material.id !== id))
  }

  // Finalizar Pedido
  const handleFinalizar = async () => {
    if (cart.length === 0) return toast.error('El carrito está vacío')
    setIsLoading(true)
    try {
      // 1. Crear Pedido
      const { data: pedido, error: pedidoError } = await supabase
        .from('pedidos')
        .insert({
          usuario_id: usuario.id,
          isometrico_id: isometrico.id,
          tipo: 'prepedido',
          estado: 'pendiente'
        })
        .select().single()
        
      if (pedidoError) throw pedidoError

      // 2. Crear Items
      const items = cart.map(item => ({
        pedido_id: pedido.id,
        material_id: item.material.id,
        cantidad_solicitada: item.cantidad,
        cantidad_entregada: 0
      }))

      const { error: itemsError } = await supabase.from('pedido_items').insert(items)
      if (itemsError) throw itemsError

      setStep(4) // Éxito
    } catch (error: any) {
      toast.error('Error al generar el pedido', { description: error.message })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 pb-20 md:py-10 px-4 flex flex-col items-center">
      
      {/* Progreso */}
      {step < 4 && (
        <div className="w-full max-w-md flex justify-between items-center mb-8 px-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-colors ${step >= i ? 'bg-emerald-500 text-neutral-950' : 'bg-neutral-800 text-neutral-500'}`}>
                {i}
              </div>
            </div>
          ))}
          <div className="absolute top-6 left-10 right-10 h-[2px] bg-neutral-800 -z-10" />
        </div>
      )}

      {/* Contenedor Principal */}
      <div className="w-full max-w-md">
        
        {/* STEP 1: RUT */}
        {step === 1 && (
          <div className="glass rounded-3xl p-6 border border-white/10 animate-in fade-in slide-in-from-bottom-4">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center mb-6">
              <UserSquare2 size={24} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Identificación</h2>
            <p className="text-neutral-400 text-sm mb-6">Ingresa tu RUT para comenzar el pedido.</p>
            
            <div className="space-y-4 relative">
              <div>
                <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">RUT (sin guión)</label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={rut}
                    onChange={e => setRut(e.target.value)}
                    className="w-full mt-1 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                    placeholder="Ej: 123456789"
                  />
                  {rutSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 w-full mt-1 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-white/5 animate-in fade-in zoom-in-95">
                      {rutSuggestions.map(u => (
                        <button 
                          key={u.id} 
                          onClick={() => selectUser(u)}
                          className="w-full text-left p-4 hover:bg-emerald-500/10 transition-colors group"
                        >
                          <p className="text-white font-bold group-hover:text-emerald-400">{u.nombre}</p>
                          <p className="text-xs text-neutral-500">RUT: {u.rut}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {!usuario && rut.length >= 8 && rutSuggestions.length === 0 && (
                <div className="animate-in fade-in">
                  <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Nombre Completo (Nuevo Usuario)</label>
                  <input 
                    type="text" 
                    value={nombre}
                    onChange={e => setNombre(e.target.value)}
                    className="w-full mt-1 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors"
                    placeholder="Tu nombre y apellido"
                  />
                </div>
              )}
              
              <button 
                onClick={handleIdentificacion}
                disabled={isLoading || !rut}
                className="w-full mt-4 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold rounded-xl px-4 py-4 flex items-center justify-center transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Verificando...' : 'Continuar'} <ArrowRight className="ml-2 w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: ISOMÉTRICO */}
        {step === 2 && (
          <div className="glass rounded-3xl p-6 border border-white/10 animate-in fade-in slide-in-from-right-8">
            <button onClick={() => setStep(1)} className="text-neutral-500 hover:text-white flex items-center text-sm mb-4">
              <ArrowLeft className="w-4 h-4 mr-1" /> Volver
            </button>
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center mb-6">
              <Map size={24} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Isométrico</h2>
            <p className="text-neutral-400 text-sm mb-6">¿Para qué plano o línea necesitas los materiales?</p>
            
            <div className="space-y-4 relative">
              <div>
                <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Código Isométrico / Spool</label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={isometricoQuery}
                    onChange={e => setIsometricoQuery(e.target.value)}
                    className="w-full mt-1 bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-emerald-500 transition-colors uppercase"
                    placeholder="Ej: AH-380"
                  />
                  {isoSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 w-full mt-1 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-white/5 animate-in fade-in zoom-in-95">
                      {isoSuggestions.map(iso => (
                        <button 
                          key={iso.id} 
                          onClick={() => { setIsometrico(iso); setStep(3); }}
                          className="w-full text-left p-4 hover:bg-emerald-500/10 transition-colors group"
                        >
                          <p className="text-white font-bold group-hover:text-emerald-400">{iso.codigo}</p>
                          <p className="text-[10px] text-neutral-500 uppercase">{iso.proyecto}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <button 
                onClick={handleIsometrico}
                disabled={isLoading || !isometricoQuery}
                className="w-full mt-4 bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold rounded-xl px-4 py-4 flex items-center justify-center transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Verificando...' : 'Continuar'} <ArrowRight className="ml-2 w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: CARRITO */}
        {step === 3 && (
          <div className="w-full animate-in fade-in slide-in-from-right-8">
            <header className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-white">Catálogo</h2>
                <p className="text-neutral-400 text-xs">Iso: <span className="text-emerald-400">{isometrico?.codigo}</span></p>
              </div>
              <div className="relative">
                <ShoppingCart className="text-neutral-300 w-6 h-6" />
                {cart.length > 0 && (
                  <span className="absolute -top-2 -right-2 bg-emerald-500 text-neutral-950 text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
                    {cart.reduce((acc, i) => acc + i.cantidad, 0)}
                  </span>
                )}
              </div>
            </header>

            {/* SELECTOR DE GRUPOS */}
            <div className="mb-6">
              <p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest mb-3 ml-1 text-center">1. Seleccionar Grupo</p>
              <div className="relative">
                <select 
                  onChange={(e) => selectGroup(e.target.value)}
                  value={selectedGroup || ''}
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-2xl px-5 py-4 text-white font-bold appearance-none outline-none focus:border-emerald-500 transition-all cursor-pointer shadow-lg"
                >
                  <option value="" disabled>Selecciona una categoría...</option>
                  {groups.sort().map(g => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
                <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-500">
                  <Plus size={18} />
                </div>
              </div>
            </div>

            {/* LOS 4 INPUTS DINÁMICOS - LIMPIEZA DE DUPLICADOS */}
            {selectedGroup && (
              <div className="grid grid-cols-2 gap-3 mb-8 animate-in fade-in slide-in-from-top-2">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-neutral-600 uppercase ml-1">2. Diám 1</label>
                  <select value={filters.i1} onChange={e => updateFilter('i1', e.target.value)} className="w-full bg-neutral-900 border border-white/5 rounded-xl px-3 py-2 text-xs text-white outline-none">
                    <option value="">Todos</option>
                    {options.i1.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-neutral-600 uppercase ml-1">3. Diám 2</label>
                  <select value={filters.i2} onChange={e => updateFilter('i2', e.target.value)} disabled={!filters.i1} className="w-full bg-neutral-900 border border-white/5 rounded-xl px-3 py-2 text-xs text-white outline-none disabled:opacity-30">
                    <option value="">Todos</option>
                    {options.i2.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-neutral-600 uppercase ml-1">4. Esp/Sch</label>
                  <select value={filters.i3} onChange={e => updateFilter('i3', e.target.value)} disabled={!filters.i2 && options.i3.length === 0} className="w-full bg-neutral-900 border border-white/5 rounded-xl px-3 py-2 text-xs text-white outline-none disabled:opacity-30">
                    <option value="">Todos</option>
                    {options.i3.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-neutral-600 uppercase ml-1">5. Rating</label>
                  <select value={filters.i4} onChange={e => updateFilter('i4', e.target.value)} disabled={!filters.i3 && options.i4.length === 0} className="w-full bg-neutral-900 border border-white/5 rounded-xl px-3 py-2 text-xs text-white outline-none disabled:opacity-30">
                    <option value="">Todos</option>
                    {options.i4.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>
            )}

            {/* LISTA DE MATERIALES RESULTANTES */}
            {groupMaterials.length > 0 && (
              <div className="mb-8 bg-neutral-900/50 rounded-2xl border border-emerald-500/30 overflow-hidden animate-in fade-in zoom-in-95">
                <div className="p-3 bg-emerald-500/10 border-b border-white/5 flex justify-between items-center">
                  <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Coincidencias: {groupMaterials.length}</span>
                </div>
                <div className="max-h-60 overflow-y-auto divide-y divide-white/5">
                  {groupMaterials.map(m => (
                    <button 
                      key={m.id}
                      onClick={() => addToCart(m)}
                      className="w-full text-left p-4 hover:bg-emerald-500/10 transition-colors group flex justify-between items-center"
                    >
                      <div className="flex-1 pr-4">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-white font-bold group-hover:text-emerald-400 transition-colors leading-none">{m.ident_code}</p>
                          {(m.stock || 0) > 0 ? (
                            <span className="text-[9px] bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded font-black uppercase">Stock: {m.stock}</span>
                          ) : (
                            <span className="text-[9px] bg-red-500/10 text-red-500 px-1.5 py-0.5 rounded font-black uppercase tracking-tighter text-nowrap">Sin Stock</span>
                          )}
                        </div>
                        <p className="text-[10px] text-neutral-500 line-clamp-1">{m.descripcion}</p>
                      </div>
                      <Plus className="text-neutral-700 group-hover:text-emerald-500 flex-shrink-0" size={16} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="relative group mb-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-px flex-1 bg-white/5"></div>
                <span className="text-[10px] font-bold text-neutral-700 uppercase">o búsqueda directa</span>
                <div className="h-px flex-1 bg-white/5"></div>
              </div>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 w-5 h-5" />
                <input 
                  type="text" 
                  value={materialQuery}
                  onChange={e => setMaterialQuery(e.target.value)}
                  placeholder="Escribe código o descripción..."
                  className="w-full bg-neutral-900 border border-neutral-800 rounded-2xl pl-12 pr-4 py-4 text-white focus:outline-none focus:border-emerald-500 transition-all shadow-lg"
                />
              </div>
            </div>

            {/* Resultados */}
            {materialQuery.length >= 3 && materialesEncontrados.length > 0 && (
              <div className="mb-8 space-y-3">
                <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">Resultados de búsqueda</h3>
                {materialesEncontrados.map(mat => (
                  <div key={mat.id} className="glass rounded-2xl p-4 border border-white/5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-emerald-400 font-bold text-lg leading-tight">{mat.ident_code}</p>
                        {(mat.stock || 0) > 0 ? (
                          <span className="text-[10px] bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded-lg font-black uppercase">Stock: {mat.stock}</span>
                        ) : (
                          <span className="text-[10px] bg-red-500/10 text-red-500 px-2 py-0.5 rounded-lg font-black uppercase">Sin Stock</span>
                        )}
                      </div>
                      <p className="text-neutral-300 text-sm line-clamp-2 mt-1">{mat.descripcion}</p>
                      <span className="inline-block mt-2 text-[10px] bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded-full">
                        {mat.grupo}
                      </span>
                    </div>
                    <button 
                      onClick={() => addToCart(mat)}
                      className="bg-white/10 hover:bg-emerald-500/20 hover:text-emerald-400 text-white rounded-xl px-4 py-2 text-sm font-medium transition-colors w-full sm:w-auto"
                    >
                      Agregar
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Carrito Actual */}
            <div className="mt-8 pb-32">
              <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-4 border-b border-neutral-800 pb-2">Tu Pedido</h3>
              
              {cart.length === 0 ? (
                <div className="text-center py-12 text-neutral-600">
                  <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>Aún no has agregado materiales.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map(item => (
                    <div key={item.material.id} className="bg-neutral-900 rounded-2xl p-4 border border-neutral-800 flex justify-between items-center">
                      <div className="flex-1 pr-4">
                        <p className="text-white font-bold">{item.material.ident_code}</p>
                        <p className="text-neutral-500 text-xs truncate">{item.material.descripcion}</p>
                      </div>
                      <div className="flex items-center gap-3 bg-neutral-950 rounded-xl p-1 border border-neutral-800">
                        <button onClick={() => updateQuantity(item.material.id, -1)} className="w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-white bg-neutral-900 rounded-lg">
                          <Minus size={16} />
                        </button>
                        <span className="w-6 text-center font-bold text-white">{item.cantidad}</span>
                        <button onClick={() => updateQuantity(item.material.id, 1)} className="w-8 h-8 flex items-center justify-center text-neutral-400 hover:text-white bg-neutral-900 rounded-lg">
                          <Plus size={16} />
                        </button>
                      </div>
                      <button onClick={() => removeFromCart(item.material.id)} className="ml-3 text-neutral-600 hover:text-red-400 p-2">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Fixed Bottom Action */}
            {cart.length > 0 && (
              <div className="fixed bottom-0 left-0 w-full bg-neutral-950/80 backdrop-blur-xl border-t border-neutral-800 p-4 z-50">
                <button 
                  onClick={handleFinalizar}
                  disabled={isLoading}
                  className="w-full max-w-md mx-auto bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-bold rounded-2xl px-4 py-4 flex items-center justify-center transition-colors shadow-xl shadow-emerald-500/20"
                >
                  {isLoading ? 'Enviando...' : `Confirmar Pedido (${cart.length} items)`}
                </button>
              </div>
            )}
          </div>
        )}

        {/* STEP 4: ÉXITO */}
        {step === 4 && (
          <div className="glass rounded-3xl p-8 text-center animate-in zoom-in duration-500">
            <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-12 h-12 text-emerald-400" />
            </div>
            <h2 className="text-3xl font-black text-white mb-2">¡Pedido Enviado!</h2>
            <p className="text-neutral-400 mb-8">
              Tu solicitud ha sido ingresada al sistema. Acércate al mesón de bodega con tu carnet de identidad para retirar.
            </p>
            <div className="space-y-3">
              <Link href="/" className="block w-full bg-neutral-800 hover:bg-neutral-700 text-white font-bold rounded-xl px-4 py-4 transition-colors">
                Volver al Menú Principal
              </Link>
              <button onClick={() => window.location.reload()} className="block w-full bg-transparent hover:bg-white/5 text-neutral-300 font-medium rounded-xl px-4 py-4 transition-colors border border-transparent">
                Crear Otro Pedido
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
