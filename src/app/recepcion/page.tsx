'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'
import Link from 'next/link'
import { 
  PackagePlus, 
  Search, 
  MapPin, 
  ArrowDownToLine, 
  Loader2, 
  ChevronLeft,
  Scan,
  Clock
} from 'lucide-react'

type Material = {
  id: string
  ident_code: string
  descripcion: string
  part_group: string
}

type Ubicacion = {
  id: string
  zona: string
  rack: string
  nivel: string
}

export default function RecepcionPage() {
  const [step, setStep] = useState<1 | 2>(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null)
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([])
  
  // Form para el paso 2
  const [receiveData, setReceiveData] = useState({
    cantidad: '',
    ubicacion_id: ''
  })
  const [isSaving, setIsSaving] = useState(false)
  const [groups, setGroups] = useState<string[]>([])
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  
  // Filtros de 4 niveles
  const [filters, setFilters] = useState({ i1: '', i2: '', i3: '', i4: '' })
  const [options, setOptions] = useState({ i1: [] as string[], i2: [] as string[], i3: [] as string[], i4: [] as string[] })
  
  const [groupMaterials, setGroupMaterials] = useState<any[]>([])

  // Cargar datos al iniciar
  useEffect(() => {
    async function fetchUbicaciones() {
      const { data } = await supabase.from('ubicaciones').select('*').order('zona', { ascending: true })
      setUbicaciones(data || [])
    }
    async function fetchGroups() {
      const { data } = await supabase.from('materiales').select('part_group')
      const uniqueGroups = Array.from(new Set((data || []).map(m => m.part_group).filter(Boolean)))
      setGroups(uniqueGroups as string[])
    }
    fetchUbicaciones()
    fetchGroups()
  }, [])

  async function selectGroup(group: string) {
    setSelectedGroup(group)
    setFilters({ i1: '', i2: '', i3: '', i4: '' })
    
    // Cargar opciones para Input 1 basadas en el grupo
    const { data } = await supabase
      .from('materiales')
      .select('input_1')
      .eq('part_group', group)
    
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

    // Buscar siguientes opciones o materiales finales
    let query = supabase.from('materiales').select('*').eq('part_group', selectedGroup)
    if (newFilters.i1) query = query.eq('input_1', newFilters.i1)
    if (newFilters.i2) query = query.eq('input_2', newFilters.i2)
    if (newFilters.i3) query = query.eq('input_3', newFilters.i3)
    if (newFilters.i4) query = query.eq('input_4', newFilters.i4)

    const { data } = await query.limit(100)
    
    if (key !== 'i4') {
      const nextKey = key === 'i1' ? 'input_2' : key === 'i2' ? 'input_3' : 'input_4'
      const nextOptionsKey = key === 'i1' ? 'i2' : key === 'i2' ? 'i3' : 'i4'
      const nextUnique = Array.from(new Set((data || []).map(m => m[nextKey]).filter(Boolean)))
      setOptions(prev => ({ ...prev, [nextOptionsKey]: nextUnique as string[] }))
    }

    setGroupMaterials(data || [])
  }

  async function handleSearch(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (!searchQuery.trim()) return

    setIsSearching(true)
    try {
      const { data, error } = await supabase
        .from('materiales')
        .select('id, ident_code, descripcion, part_group')
        .eq('ident_code', searchQuery.trim().toUpperCase())
        .single()

      if (error || !data) {
        toast.error('Material no encontrado', { description: 'Verifica el código o cárgalo en el catálogo primero.' })
        return
      }

      setSelectedMaterial(data)
      setStep(2)
    } catch (error) {
      console.error(error)
    } finally {
      setIsSearching(false)
    }
  }

  async function handleReceive(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedMaterial || !receiveData.cantidad || !receiveData.ubicacion_id) {
      toast.error('Completa todos los campos')
      return
    }

    const cantNum = parseFloat(receiveData.cantidad)
    if (isNaN(cantNum) || cantNum <= 0) {
      toast.error('La cantidad debe ser mayor a 0')
      return
    }

    setIsSaving(true)
    try {
      // 1. Actualizar existencias
      const { data: existingStock } = await supabase
        .from('existencias')
        .select('id, cantidad')
        .eq('material_id', selectedMaterial.id)
        .eq('ubicacion_id', receiveData.ubicacion_id)
        .maybeSingle()

      if (existingStock) {
        // Actualizar sumando
        const { error: updateError } = await supabase
          .from('existencias')
          .update({ cantidad: existingStock.cantidad + cantNum })
          .eq('id', existingStock.id)
        
        if (updateError) throw updateError
      } else {
        // Crear nuevo registro de stock
        const { error: insertError } = await supabase
          .from('existencias')
          .insert([{
            material_id: selectedMaterial.id,
            ubicacion_id: receiveData.ubicacion_id,
            cantidad: cantNum
          }])
        
        if (insertError) throw insertError
      }

      // 2. Registrar el Movimiento (Log)
      const { error: moveError } = await supabase
        .from('movimientos')
        .insert([{
          material_id: selectedMaterial.id,
          ubicacion_id: receiveData.ubicacion_id,
          tipo: 'IN',
          cantidad: cantNum,
          timestamp: new Date().toISOString()
        }])
      
      if (moveError) throw moveError

      toast.success('Material recibido correctamente', { 
        description: `+${cantNum} unidades de ${selectedMaterial.ident_code}` 
      })

      // Volver al paso 1
      setStep(1)
      setSearchQuery('')
      setSelectedMaterial(null)
      setReceiveData({ cantidad: '', ubicacion_id: '' })

    } catch (error: any) {
      toast.error('Error al procesar recepción', { description: error.message })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 p-4 md:p-12 flex flex-col items-center">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-600/10 blur-[120px] pointer-events-none" />
      
      <div className="w-full max-w-2xl relative z-10">
        <header className="flex items-center justify-between mb-8">
          <Link href="/" className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <PackagePlus className="text-emerald-500" />
            Ingreso a Bodega
          </h1>
          <div className="w-10" />
        </header>

        {step === 1 ? (
          <div className="glass rounded-3xl p-8 border border-white/5 animate-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-8">
              <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
                <Scan className="w-10 h-10 text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold text-white">Identificar Material</h2>
              <p className="text-neutral-400 text-sm">Escanea el código o ingrésalo manualmente para recibir el stock.</p>
            </div>

            <div className="space-y-8">
              {/* SELECTOR DE GRUPOS */}
              <div className="space-y-6">
                <div>
                  <p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest mb-3 ml-1">1. Grupo de Material</p>
                  <div className="relative">
                    <select 
                      onChange={(e) => selectGroup(e.target.value)}
                      value={selectedGroup || ''}
                      className="w-full bg-neutral-900 border-2 border-neutral-800 rounded-2xl px-5 py-4 text-white font-bold appearance-none outline-none focus:border-emerald-500 transition-all cursor-pointer"
                    >
                      <option value="" disabled>Selecciona familia...</option>
                      {groups.sort().map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                    <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-neutral-500">
                      <ArrowDownToLine size={18} />
                    </div>
                  </div>
                </div>

                {/* LOS 4 INPUTS DINÁMICOS */}
                {selectedGroup && (
                  <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-neutral-600 uppercase ml-1">2. Diámetro 1</label>
                      <select 
                        value={filters.i1} 
                        onChange={e => updateFilter('i1', e.target.value)}
                        className="w-full bg-neutral-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500"
                      >
                        <option value="">Cualquiera</option>
                        {options.i1.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-neutral-600 uppercase ml-1">3. Diámetro 2</label>
                      <select 
                        value={filters.i2} 
                        onChange={e => updateFilter('i2', e.target.value)}
                        disabled={!filters.i1}
                        className="w-full bg-neutral-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500 disabled:opacity-30"
                      >
                        <option value="">Cualquiera</option>
                        {options.i2.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-neutral-600 uppercase ml-1">4. Espesor/Sch</label>
                      <select 
                        value={filters.i3} 
                        onChange={e => updateFilter('i3', e.target.value)}
                        disabled={!filters.i2 && options.i3.length === 0}
                        className="w-full bg-neutral-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500 disabled:opacity-30"
                      >
                        <option value="">Cualquiera</option>
                        {options.i3.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-neutral-600 uppercase ml-1">5. Otros/Rating</label>
                      <select 
                        value={filters.i4} 
                        onChange={e => updateFilter('i4', e.target.value)}
                        disabled={!filters.i3 && options.i4.length === 0}
                        className="w-full bg-neutral-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-emerald-500 disabled:opacity-30"
                      >
                        <option value="">Cualquiera</option>
                        {options.i4.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                  </div>
                )}

                {/* LISTA DE MATERIALES RESULTANTES */}
                {groupMaterials.length > 0 && (
                  <div className="bg-neutral-950/50 rounded-2xl border border-emerald-500/30 overflow-hidden animate-in fade-in zoom-in-95 shadow-2xl shadow-emerald-500/5">
                    <div className="p-3 bg-emerald-500/10 border-b border-white/5 flex justify-between items-center">
                      <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Coincidencias: {groupMaterials.length}</span>
                    </div>
                    <div className="max-h-60 overflow-y-auto divide-y divide-white/5">
                      {groupMaterials.map(m => (
                        <button 
                          key={m.id}
                          type="button"
                          onClick={() => { setSelectedMaterial(m); setStep(2); }}
                          className="w-full text-left p-4 hover:bg-emerald-500/10 transition-colors group"
                        >
                          <p className="text-white font-bold group-hover:text-emerald-400 transition-colors">{m.ident_code}</p>
                          <p className="text-[10px] text-neutral-500 line-clamp-2">{m.descripcion}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="relative">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="h-px flex-1 bg-white/5"></div>
                    <span className="text-[10px] font-bold text-neutral-700 uppercase">o ingreso manual</span>
                    <div className="h-px flex-1 bg-white/5"></div>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-neutral-500" />
                    <input 
                      type="text" 
                      placeholder="Código de Material (Item Code)"
                      className="w-full bg-neutral-900 border-2 border-neutral-800 rounded-2xl pl-14 pr-4 py-5 text-xl font-bold text-white focus:outline-none focus:border-emerald-500 transition-all placeholder:text-neutral-700 uppercase"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>

                <button 
                  onClick={() => handleSearch()}
                  type="button"
                  disabled={isSearching || !searchQuery}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-5 rounded-2xl text-lg shadow-xl shadow-emerald-900/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {isSearching ? <Loader2 className="animate-spin" /> : 'Buscar Material'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="glass rounded-3xl p-8 border border-white/5 animate-in slide-in-from-right-4 duration-500">
            <div className="mb-8 p-4 bg-white/5 rounded-2xl border border-white/5">
              <span className="text-xs font-bold text-emerald-500 uppercase tracking-widest">{selectedMaterial?.part_group}</span>
              <h2 className="text-2xl font-black text-white">{selectedMaterial?.ident_code}</h2>
              <p className="text-neutral-400 text-sm leading-relaxed mt-1">{selectedMaterial?.descripcion}</p>
            </div>

            <form onSubmit={handleReceive} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider ml-1">Cantidad Recibida</label>
                  <input 
                    type="number" 
                    step="any"
                    required
                    placeholder="0.00"
                    className="w-full bg-neutral-900 border-2 border-neutral-800 rounded-2xl px-5 py-4 text-xl font-bold text-white focus:outline-none focus:border-emerald-500 transition-all"
                    value={receiveData.cantidad}
                    onChange={e => setReceiveData({...receiveData, cantidad: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider ml-1">Ubicación de Guardado</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
                    <select 
                      required
                      className="w-full bg-neutral-900 border-2 border-neutral-800 rounded-2xl pl-12 pr-4 py-4 text-white focus:outline-none focus:border-emerald-500 transition-all appearance-none"
                      value={receiveData.ubicacion_id}
                      onChange={e => setReceiveData({...receiveData, ubicacion_id: e.target.value})}
                    >
                      <option value="">Seleccionar Rack...</option>
                      {ubicaciones.map(u => (
                        <option key={u.id} value={u.id}>
                          {u.zona} - {u.rack} (Nivel {u.nivel})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 bg-neutral-900 hover:bg-neutral-800 text-neutral-400 font-bold py-5 rounded-2xl transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={isSaving}
                  className="flex-[2] bg-emerald-600 hover:bg-emerald-500 text-white font-black py-5 rounded-2xl shadow-xl shadow-emerald-900/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {isSaving ? <Loader2 className="animate-spin" /> : (
                    <>
                      <ArrowDownToLine className="w-5 h-5" />
                      Confirmar Ingreso
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="mt-8 flex justify-center">
          <Link href="/dashboard" className="text-neutral-600 hover:text-emerald-400 text-sm flex items-center gap-2 transition-colors">
            <Clock className="w-4 h-4" /> Ver historial de movimientos
          </Link>
        </div>
      </div>
    </div>
  )
}
