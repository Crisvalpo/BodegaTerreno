'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'
import { 
  PackagePlus, Search, MapPin, 
  ArrowLeft, X, Grid, CheckCircle2,
  Activity, Loader2, ChevronRight
} from 'lucide-react'
import Link from 'next/link'

export default function RecepcionPage() {
  const [isLoading, setIsLoading] = useState(false)
  
  // Selección y Búsqueda
  const [groups, setGroups] = useState<string[]>([])
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)
  const [materials, setMaterials] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedMaterial, setSelectedMaterial] = useState<any>(null)

  // Filtros Técnicos de Búsqueda
  const [filterD1, setFilterD1] = useState('')
  const [filterD2, setFilterD2] = useState('')
  const [filterE1, setFilterE1] = useState('')
  const [filterE2, setFilterE2] = useState('')

  // Valores Únicos para Dropdowns de Filtro
  const [uniqueD1, setUniqueD1] = useState<string[]>([])
  const [uniqueD2, setUniqueD2] = useState<string[]>([])
  const [uniqueE1, setUniqueE1] = useState<string[]>([])
  const [uniqueE2, setUniqueE2] = useState<string[]>([])

  // Recepción e Inputs Técnicos
  const [ubicaciones, setUbicaciones] = useState<any[]>([])
  const [qty, setQty] = useState('')
  const [ubicacionId, setUbicacionId] = useState('')
  const [d1, setD1] = useState('')
  const [d2, setD2] = useState('')
  const [e1, setE1] = useState('')
  const [e2, setE2] = useState('')

  // Datos Maestros para Filtros
  const [allMats, setAllMats] = useState<any[]>([])

  useEffect(() => {
    async function loadInitial() {
      const { data: ubs } = await supabase.from('ubicaciones').select('*').order('zona')
      const { data: mats } = await supabase.from('materiales').select('part_group, input_1, input_2, input_3, input_4')
      
      setAllMats(mats || [])
      setUbicaciones(ubs || [])
      
      const uniqueGroups = Array.from(new Set((mats || []).map(m => m.part_group).filter(Boolean)))
      setGroups(uniqueGroups as string[])
    }
    loadInitial()
  }, [])

  // Reset de filtros al cambiar de grupo
  useEffect(() => {
    setFilterD1('')
    setFilterD2('')
    setFilterE1('')
    setFilterE2('')
  }, [selectedGroup])

  // CÁLCULO DE FILTROS INTELIGENTES (CASCADA)
  useEffect(() => {
    let filtered = allMats

    if (selectedGroup) filtered = filtered.filter(m => m.part_group === selectedGroup)
    setUniqueD1(Array.from(new Set(filtered.map(m => m.input_1).filter(Boolean))) as string[])

    if (filterD1) filtered = filtered.filter(m => m.input_1 === filterD1)
    setUniqueD2(Array.from(new Set(filtered.map(m => m.input_2).filter(Boolean))) as string[])

    if (filterD2) filtered = filtered.filter(m => m.input_2 === filterD2)
    setUniqueE1(Array.from(new Set(filtered.map(m => m.input_3).filter(Boolean))) as string[])

    if (filterE1) filtered = filtered.filter(m => m.input_3 === filterE1)
    setUniqueE2(Array.from(new Set(filtered.map(m => m.input_4).filter(Boolean))) as string[])
  }, [allMats, selectedGroup, filterD1, filterD2, filterE1])

  useEffect(() => {
    async function fetchMaterials() {
      if (!selectedGroup && searchQuery.length < 3 && !filterD1 && !filterD2 && !filterE1 && !filterE2) {
        setMaterials([])
        return
      }
      
      let query = supabase.from('materiales').select('*, existencias(cantidad)')
      
      if (selectedGroup) query = query.eq('part_group', selectedGroup)
      if (searchQuery) query = query.or(`ident_code.ilike.%${searchQuery}%,descripcion.ilike.%${searchQuery}%`)
      if (filterD1) query = query.eq('input_1', filterD1)
      if (filterD2) query = query.eq('input_2', filterD2)
      if (filterE1) query = query.eq('input_3', filterE1)
      if (filterE2) query = query.eq('input_4', filterE2)

      const { data } = await query.limit(50)
      setMaterials(data || [])
    }
    fetchMaterials()
  }, [selectedGroup, searchQuery, filterD1, filterD2, filterE1, filterE2])

  useEffect(() => {
    if (selectedMaterial) {
      setD1(selectedMaterial.input_1 || '')
      setD2(selectedMaterial.input_2 || '')
      setE1(selectedMaterial.input_3 || '')
      setE2(selectedMaterial.input_4 || '')
    }
  }, [selectedMaterial])

  const handleReceive = async () => {
    if (!selectedMaterial || !qty || !ubicacionId) return
    setIsLoading(true)
    try {
      // 1. Actualizar Metadatos del Material
      await supabase.from('materiales').update({
        input_1: d1,
        input_2: d2,
        input_3: e1,
        input_4: e2
      }).eq('id', selectedMaterial.id)

      // 2. Registrar Movimiento
      const userData = JSON.parse(localStorage.getItem('bodega_user') || '{}')
      await supabase.from('movimientos').insert({
        material_id: selectedMaterial.id,
        cantidad: Number(qty),
        tipo: 'IN',
        ubicacion_id: ubicacionId,
        usuario_id: userData.id
      })

      // 3. Actualizar Existencia
      const { data: ext } = await supabase.from('existencias')
        .select('*')
        .eq('material_id', selectedMaterial.id)
        .eq('ubicacion_id', ubicacionId)
        .single()

      if (ext) {
        await supabase.from('existencias').update({ cantidad: Number(ext.cantidad) + Number(qty) }).eq('id', ext.id)
      } else {
        await supabase.from('existencias').insert({ material_id: selectedMaterial.id, ubicacion_id: ubicacionId, cantidad: Number(qty) })
      }

      toast.success('Material Recepcionado con Éxito')
      setSelectedMaterial(null)
      setQty('')
      setD1(''); setD2(''); setE1(''); setE2('')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#050505] flex justify-center selection:bg-emerald-500/30">
      <div className="w-full max-w-full lg:max-w-7xl bg-[#0a0a0a] min-h-screen border-x border-neutral-900 shadow-2xl flex flex-col relative overflow-hidden">
        
        {/* Header App */}
        <div className="p-4 border-b border-neutral-900 bg-black/50 backdrop-blur-md sticky top-0 z-50 flex items-center justify-between">
          <Link href="/" className="p-2 hover:bg-neutral-800 rounded-lg transition-colors">
            <ArrowLeft size={20} className="text-neutral-500" />
          </Link>
          <div className="flex flex-col items-center">
            <span className="text-[10px] font-bold text-emerald-500 tracking-widest mb-1">Entrada de Material</span>
            <span className="text-[8px] font-bold text-neutral-600 tracking-[0.2em] text-center">Bodega Piping</span>
          </div>
          <div className="w-9" />
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col gap-8">
          
          {/* SECCIÓN DE BÚSQUEDA Y FILTRO */}
          <div className="space-y-4 bg-neutral-900/30 p-6 rounded-3xl border border-neutral-800">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-700 group-focus-within:text-emerald-500" size={16} />
                <input 
                  type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Buscar código o descripción..."
                  className="w-full bg-black border border-neutral-800 rounded-xl pl-12 pr-4 py-4 text-xs font-bold text-white outline-none focus:border-emerald-500/50 transition-all tracking-widest"
                />
              </div>
              <div className="relative">
                <Grid className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-700" size={16} />
                <select 
                  value={selectedGroup || ''} 
                  onChange={e => setSelectedGroup(e.target.value || null)}
                  className="w-full bg-black border border-neutral-800 rounded-xl pl-12 pr-4 py-4 text-xs font-bold text-emerald-500 outline-none focus:border-emerald-500/50 appearance-none tracking-widest cursor-pointer"
                >
                  <option value="">Todos los Grupos</option>
                  {groups.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>

            {/* FILTROS TÉCNICOS (MATRIZ) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-neutral-800/50">
              {[
                { label: 'D1', val: filterD1, set: setFilterD1, opts: uniqueD1 },
                { label: 'D2', val: filterD2, set: setFilterD2, opts: uniqueD2 },
                { label: 'E1', val: filterE1, set: setFilterE1, opts: uniqueE1 },
                { label: 'E2', val: filterE2, set: setFilterE2, opts: uniqueE2 },
              ].map(f => (
                <select key={f.label} value={f.val} onChange={e => f.set(e.target.value)} className="bg-black border border-neutral-900 rounded-lg px-3 py-2 text-[10px] font-black text-neutral-500 outline-none focus:border-emerald-500/30">
                  <option value="">{f.label} (Todos)</option>
                  {f.opts.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1 items-start">
            {/* LISTA DE RESULTADOS */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 px-2">
                <PackagePlus size={14} className="text-neutral-700" />
                <span className="text-[10px] font-bold tracking-widest text-neutral-600">Resultados Filtrados</span>
              </div>
              <div className="grid grid-cols-1 gap-3 max-h-[700px] overflow-y-auto pr-2 custom-scrollbar">
                {materials.map(m => (
                  <button 
                    key={m.id} 
                    onClick={() => setSelectedMaterial(m)}
                    className={`w-full border rounded-2xl p-5 text-left flex items-center gap-5 transition-all group ${selectedMaterial?.id === m.id ? 'bg-emerald-500/10 border-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.15)]' : 'bg-neutral-900 border-neutral-800 hover:border-neutral-700'}`}
                  >
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center border shrink-0 transition-colors ${selectedMaterial?.id === m.id ? 'bg-emerald-500 border-emerald-400' : 'bg-black border-neutral-800'}`}>
                      <PackagePlus size={24} className={selectedMaterial?.id === m.id ? 'text-black' : 'text-neutral-500'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-base md:text-lg font-mono font-black tracking-tighter leading-none mb-1 ${selectedMaterial?.id === m.id ? 'text-emerald-500' : 'text-white'}`}>{m.ident_code}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-bold bg-neutral-950 border border-neutral-800 px-2 py-0.5 rounded text-emerald-500/80">
                          {m.input_1}{m.input_2 !== '0' && m.input_2 ? ` x ${m.input_2}` : ''} | {m.input_3}
                        </span>
                        <p className="text-[11px] text-neutral-400 font-medium truncate flex-1">{m.descripcion}</p>
                      </div>
                    </div>
                    {selectedMaterial?.id === m.id && <CheckCircle2 size={20} className="text-emerald-500 animate-in zoom-in" />}
                  </button>
                ))}
              </div>
            </div>

            {/* PANEL DE ACCIÓN */}
            <div className="sticky top-24">
              {selectedMaterial ? (
                <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 space-y-8 shadow-2xl animate-in fade-in slide-in-from-right-8">
                  <div className="border-b border-neutral-800 pb-6">
                    <div className="flex items-center justify-between mb-4">
                      <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px] font-black text-emerald-500 uppercase tracking-widest italic">
                        Detalle del Item
                      </span>
                      <button onClick={() => setSelectedMaterial(null)} className="text-neutral-600 hover:text-white transition-colors p-1">
                        <X size={20} />
                      </button>
                    </div>
                    <h2 className="text-3xl font-black text-white tracking-tighter uppercase italic mb-2 leading-none">{selectedMaterial.ident_code}</h2>
                    <p className="text-sm text-neutral-400 font-bold uppercase italic leading-relaxed">{selectedMaterial.descripcion}</p>
                    
                    <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t border-neutral-800/50">
                      <div>
                        <p className="text-[9px] font-black text-neutral-600 uppercase tracking-widest mb-1 italic">Grupo Material</p>
                        <p className="text-sm font-bold text-white uppercase">{selectedMaterial.part_group}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-neutral-600 uppercase tracking-widest mb-1 italic">Unidad</p>
                        <p className="text-sm font-bold text-white uppercase">{selectedMaterial.unidad || 'UND'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-3">
                      <label className="text-xs font-black text-neutral-500 uppercase tracking-widest ml-1 italic flex items-center gap-2">
                        <Activity size={16} className="text-emerald-500" />
                        Cantidad a Ingresar
                      </label>
                      <input 
                        type="number" value={qty} onChange={e => setQty(e.target.value)}
                        placeholder="0"
                        className="w-full bg-black border-2 border-neutral-800 rounded-2xl px-6 py-8 text-7xl font-mono text-emerald-500 text-center focus:border-emerald-500 outline-none transition-all shadow-inner"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest ml-1 italic">D1 (Pulg)</label>
                        <input 
                          type="text" value={d1} onChange={e => setD1(e.target.value)}
                          placeholder='2"'
                          className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-4 text-lg font-mono text-white focus:border-emerald-500/50 outline-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest ml-1 italic">D2 (Pulg)</label>
                        <input 
                          type="text" value={d2} onChange={e => setD2(e.target.value)}
                          placeholder='1"'
                          className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-4 text-lg font-mono text-white focus:border-emerald-500/50 outline-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest ml-1 italic">E1 (Sch)</label>
                        <input 
                          type="text" value={e1} onChange={e => setE1(e.target.value)}
                          placeholder="SCH 40"
                          className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-4 text-lg font-mono text-white focus:border-emerald-500/50 outline-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest ml-1 italic">E2 (Sch)</label>
                        <input 
                          type="text" value={e2} onChange={e => setE2(e.target.value)}
                          placeholder="SCH 40"
                          className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-4 text-lg font-mono text-white focus:border-emerald-500/50 outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between ml-1">
                        <label className="text-xs font-black text-neutral-500 uppercase tracking-widest italic flex items-center gap-2">
                          <MapPin size={16} className="text-emerald-500" />
                          Ubicación de Destino
                        </label>
                        <Link href="/admin/ubicaciones" className="text-[10px] font-black text-emerald-500 hover:text-emerald-400 flex items-center gap-1 transition-colors uppercase tracking-widest italic">
                          <span>Gestionar</span>
                          <ChevronRight size={10} />
                        </Link>
                      </div>
                      
                      {ubicaciones.length > 0 ? (
                        <div className="grid grid-cols-2 gap-3">
                          {ubicaciones.map(ub => (
                            <button 
                              key={ub.id} onClick={() => setUbicacionId(ub.id)}
                              className={`p-6 rounded-2xl border text-left transition-all group ${ubicacionId === ub.id ? 'bg-emerald-500 text-black border-emerald-400 shadow-lg shadow-emerald-500/20' : 'bg-black border-neutral-800 text-neutral-500 hover:border-neutral-600'}`}
                            >
                              <div className="flex items-center gap-2">
                                <MapPin size={16} className={ubicacionId === ub.id ? 'text-black' : 'text-neutral-700'} />
                                <span className="text-sm font-black uppercase tracking-tighter">{ub.zona}-{ub.rack}{ub.nivel}</span>
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="p-8 border-2 border-dashed border-neutral-800 rounded-2xl text-center">
                          <p className="text-[10px] font-black text-neutral-600 uppercase tracking-widest mb-4">No hay ubicaciones registradas</p>
                          <Link href="/admin/ubicaciones" className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-500 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500/20 transition-all">
                            Crear Primera Ubicación
                          </Link>
                        </div>
                      )}
                    </div>

                    <button 
                      onClick={handleReceive}
                      disabled={isLoading || !qty || !ubicacionId}
                      className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:bg-neutral-800 disabled:text-neutral-600 text-black font-black py-6 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-lg shadow-emerald-500/20 uppercase tracking-widest"
                    >
                      {isLoading ? <Loader2 className="animate-spin" /> : <><CheckCircle2 size={24} /> Confirmar Recepción</>}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="h-[600px] bg-neutral-900/20 border-2 border-dashed border-neutral-800 rounded-3xl flex flex-col items-center justify-center text-neutral-700 p-12 text-center">
                  <PackagePlus size={64} className="mb-6 opacity-20" />
                  <p className="text-sm font-black uppercase tracking-widest max-w-[200px]">Selecciona un material para iniciar el ingreso</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
