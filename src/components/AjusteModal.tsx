'use client'

import { useState, useEffect } from 'react'
import { X, Search, PackageMinus, PackagePlus, AlertTriangle, Check, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  userRole: string | null
  userId?: string | null // Id del usuario que hace el ajuste
}

export default function AjusteModal({ isOpen, onClose, onSuccess, userRole, userId }: Props) {
  const [step, setStep] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [materials, setMaterials] = useState<any[]>([])
  const [selectedMaterial, setSelectedMaterial] = useState<any>(null)
  
  const [existencias, setExistencias] = useState<any[]>([])
  const [selectedExistencia, setSelectedExistencia] = useState<any>(null)
  
  const [ajusteTipo, setAjusteTipo] = useState<'IN' | 'OUT'>('IN')
  const [cantidad, setCantidad] = useState<number | ''>('')
  const [observacion, setObservacion] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Opcional: para agregar a nueva ubicación si no existe
  const [isNewLocation, setIsNewLocation] = useState(false)
  const [allUbicaciones, setAllUbicaciones] = useState<any[]>([])
  const [selectedNewUbicacion, setSelectedNewUbicacion] = useState<string>('')

  useEffect(() => {
    if (isOpen) {
      setStep(1)
      setSearchQuery('')
      setSelectedMaterial(null)
      setExistencias([])
      setSelectedExistencia(null)
      setCantidad('')
      setObservacion('')
      setIsNewLocation(false)
      setSelectedNewUbicacion('')
      fetchAllUbicaciones()
    }
  }, [isOpen])

  useEffect(() => {
    const searchMaterials = async () => {
      if (searchQuery.length < 3) {
        setMaterials([])
        return
      }
      const { data } = await supabase
        .from('materiales')
        .select('*')
        .or(`ident_code.ilike.%${searchQuery}%,descripcion.ilike.%${searchQuery}%`)
        .limit(10)
      setMaterials(data || [])
    }
    
    const timeoutId = setTimeout(searchMaterials, 300)
    return () => clearTimeout(timeoutId)
  }, [searchQuery])

  const fetchAllUbicaciones = async () => {
    const { data } = await supabase.from('ubicaciones').select('id, zona, rack, nivel').order('zona').order('rack')
    setAllUbicaciones(data || [])
  }

  const handleSelectMaterial = async (mat: any) => {
    setSelectedMaterial(mat)
    // Cargar existencias actuales para este material
    const { data } = await supabase
      .from('existencias')
      .select('id, cantidad, ubicacion_id, ubicaciones(zona, rack, nivel)')
      .eq('material_id', mat.id)
    
    setExistencias(data || [])
    setStep(2)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cantidad || cantidad <= 0 || !observacion || (!selectedExistencia && !selectedNewUbicacion)) return

    setIsSubmitting(true)
    try {
      let currentUbicacionId = selectedExistencia ? selectedExistencia.ubicacion_id : selectedNewUbicacion
      let currentCantidad = selectedExistencia ? selectedExistencia.cantidad : 0
      let existenciaId = selectedExistencia ? selectedExistencia.id : null

      // Validar si es salida y hay suficiente stock
      if (ajusteTipo === 'OUT' && currentCantidad < Number(cantidad)) {
        throw new Error('No puedes descontar más stock del que existe en esta ubicación.')
      }

      const nuevaCantidad = ajusteTipo === 'IN' 
        ? currentCantidad + Number(cantidad) 
        : currentCantidad - Number(cantidad)

      // 1. Actualizar o Crear Existencia
      if (existenciaId) {
        const { error: updErr } = await supabase
          .from('existencias')
          .update({ cantidad: nuevaCantidad })
          .eq('id', existenciaId)
        if (updErr) throw updErr
      } else {
        // Verificar si mágicamente alguien ya la creó en lo que tardamos
        const { data: checkData } = await supabase
          .from('existencias')
          .select('id, cantidad')
          .eq('material_id', selectedMaterial.id)
          .eq('ubicacion_id', currentUbicacionId)
          .single()
        
        if (checkData) {
          const { error: updErr } = await supabase
            .from('existencias')
            .update({ cantidad: checkData.cantidad + Number(cantidad) })
            .eq('id', checkData.id)
          if (updErr) throw updErr
        } else {
          const { error: insErr } = await supabase
            .from('existencias')
            .insert({
              material_id: selectedMaterial.id,
              ubicacion_id: currentUbicacionId,
              cantidad: nuevaCantidad
            })
          if (insErr) throw insErr
        }
      }

      // 2. Registrar Movimiento
      const { error: movErr } = await supabase
        .from('movimientos')
        .insert({
          material_id: selectedMaterial.id,
          ubicacion_id: currentUbicacionId,
          cantidad: Number(cantidad),
          tipo: ajusteTipo === 'IN' ? 'AJUSTE_IN' : 'AJUSTE_OUT',
          usuario_id: userId || null,
          observacion: `[AJUSTE MANUAL] ${observacion}`
        })
      if (movErr) throw movErr

      toast.success('Ajuste de stock realizado correctamente')
      onSuccess()
      onClose()
    } catch (err: any) {
      toast.error(err.message || 'Error al procesar el ajuste')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  // Restricción dura de interfaz, aunque debería validarse en layout/page
  if (userRole !== 'admin' && userRole !== 'bodeguero') {
    return null
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#111] border border-neutral-800 rounded-3xl w-full max-w-2xl p-6 md:p-8 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-6 right-6 p-2 text-neutral-500 hover:text-white transition-colors">
          <X size={24} />
        </button>

        <div className="mb-8">
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic flex items-center gap-3">
            <AlertTriangle className="text-rose-500" />
            Ajuste Manual de Stock
          </h2>
          <p className="text-sm text-neutral-500">
            Esta herramienta ajusta el inventario sin pasar por Recepción o Mesón. <strong className="text-rose-400">Todo ajuste queda auditado.</strong>
          </p>
        </div>

        {/* PASO 1: SELECCIONAR MATERIAL */}
        {step === 1 && (
          <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
            <h3 className="text-sm font-bold text-neutral-400 uppercase tracking-widest">Paso 1: Seleccionar Material</h3>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por Ident Code o Descripción..."
                className="w-full bg-black border border-neutral-800 rounded-xl pl-12 pr-4 py-4 text-white focus:border-rose-500/50 outline-none transition-colors"
                autoFocus
              />
            </div>
            {materials.length > 0 && (
              <div className="mt-4 border border-neutral-800 rounded-xl overflow-hidden divide-y divide-neutral-800">
                {materials.map(mat => (
                  <button
                    key={mat.id}
                    onClick={() => handleSelectMaterial(mat)}
                    className="w-full text-left p-4 bg-black hover:bg-neutral-900 transition-colors flex items-center justify-between group"
                  >
                    <div>
                      <p className="text-white font-black italic text-lg group-hover:text-rose-400 transition-colors">{mat.ident_code}</p>
                      <p className="text-xs text-neutral-500 line-clamp-1">{mat.descripcion}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PASO 2: EJECUTAR AJUSTE */}
        {step === 2 && selectedMaterial && (
          <form onSubmit={handleSubmit} className="space-y-6 animate-in fade-in slide-in-from-right-4">
            {/* Cabecera del Material */}
            <div className="p-4 bg-black border border-neutral-800 rounded-2xl flex items-start justify-between">
              <div>
                <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1 block">Material a Ajustar</span>
                <p className="text-xl font-black text-white uppercase italic tracking-tighter">{selectedMaterial.ident_code}</p>
                <p className="text-sm text-neutral-400">{selectedMaterial.descripcion}</p>
              </div>
              <button type="button" onClick={() => setStep(1)} className="text-xs text-neutral-500 hover:text-white underline">
                Cambiar
              </button>
            </div>

            {/* Ubicación y Stock Actual */}
            <div>
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-3 block">Ubicación a Afectar</label>
              
              {!isNewLocation ? (
                <div className="space-y-2 mb-3">
                  {existencias.length > 0 ? existencias.map(ex => (
                    <button
                      key={ex.id}
                      type="button"
                      onClick={() => setSelectedExistencia(ex)}
                      className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${selectedExistencia?.id === ex.id ? 'bg-rose-500/10 border-rose-500 text-rose-400' : 'bg-black border-neutral-800 text-neutral-300 hover:border-neutral-700'}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-bold">Rack: {ex.ubicaciones?.rack} - Nivel: {ex.ubicaciones?.nivel}</span>
                      </div>
                      <span className="text-sm">Stock Actual: <strong className="text-lg ml-1">{ex.cantidad}</strong></span>
                    </button>
                  )) : (
                    <p className="text-sm text-amber-500 italic p-3 bg-amber-500/10 rounded-xl">Este material no tiene stock en ninguna ubicación actualmente.</p>
                  )}
                  <button type="button" onClick={() => { setIsNewLocation(true); setSelectedExistencia(null) }} className="text-xs text-rose-500 hover:text-rose-400 font-bold uppercase tracking-widest mt-2 ml-1">
                    + Registrar en una nueva ubicación
                  </button>
                </div>
              ) : (
                <div className="space-y-3 mb-3">
                  <select 
                    value={selectedNewUbicacion}
                    onChange={(e) => setSelectedNewUbicacion(e.target.value)}
                    className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-white outline-none"
                    required
                  >
                    <option value="">Selecciona Rack Destino...</option>
                    {allUbicaciones.map(u => (
                      <option key={u.id} value={u.id}>{u.zona} - {u.rack}{u.nivel}</option>
                    ))}
                  </select>
                  {existencias.length > 0 && (
                    <button type="button" onClick={() => { setIsNewLocation(false); setSelectedNewUbicacion('') }} className="text-xs text-neutral-500 hover:text-white underline ml-1">
                      Volver a ubicaciones existentes
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Formulario de Ajuste */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-3 block">Tipo de Ajuste</label>
                <div className="flex bg-black rounded-xl border border-neutral-800 p-1">
                  <button
                    type="button"
                    onClick={() => setAjusteTipo('IN')}
                    className={`flex-1 py-3 flex items-center justify-center gap-2 text-sm font-black uppercase tracking-widest rounded-lg transition-colors ${ajusteTipo === 'IN' ? 'bg-emerald-500/20 text-emerald-400' : 'text-neutral-500 hover:text-white'}`}
                  >
                    <PackagePlus size={16} /> Sumar
                  </button>
                  <button
                    type="button"
                    onClick={() => setAjusteTipo('OUT')}
                    className={`flex-1 py-3 flex items-center justify-center gap-2 text-sm font-black uppercase tracking-widest rounded-lg transition-colors ${ajusteTipo === 'OUT' ? 'bg-rose-500/20 text-rose-400' : 'text-neutral-500 hover:text-white'}`}
                  >
                    <PackageMinus size={16} /> Restar
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-3 block">Cantidad</label>
                <input
                  type="number"
                  min="1"
                  value={cantidad}
                  onChange={(e) => setCantidad(Number(e.target.value) || '')}
                  required
                  placeholder="0"
                  className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-2xl font-black text-white text-center focus:border-rose-500/50 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest mb-3 block">Motivo / Observación (Obligatorio)</label>
              <textarea
                value={observacion}
                onChange={(e) => setObservacion(e.target.value)}
                required
                placeholder="Ej: Material encontrado en inventario físico..."
                className="w-full bg-black border border-neutral-800 rounded-xl px-4 py-3 text-sm text-white focus:border-rose-500/50 outline-none min-h-[100px] resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !cantidad || !observacion || (!selectedExistencia && !selectedNewUbicacion)}
              className="w-full bg-rose-500 hover:bg-rose-600 disabled:bg-neutral-800 disabled:text-neutral-500 text-white font-black uppercase tracking-widest py-4 rounded-xl flex items-center justify-center gap-2 transition-all"
            >
              {isSubmitting ? <Loader2 className="animate-spin" /> : <><Check size={20} /> Confirmar Ajuste de Stock</>}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
