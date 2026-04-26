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

  // Cargar ubicaciones al iniciar
  useEffect(() => {
    async function fetchUbicaciones() {
      const { data } = await supabase.from('ubicaciones').select('*').order('zona', { ascending: true })
      setUbicaciones(data || [])
    }
    fetchUbicaciones()
  }, [])

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

            <form onSubmit={handleSearch} className="space-y-6">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-neutral-500" />
                <input 
                  type="text" 
                  autoFocus
                  placeholder="Código de Material (Item Code)"
                  className="w-full bg-neutral-900 border-2 border-neutral-800 rounded-2xl pl-14 pr-4 py-5 text-xl font-bold text-white focus:outline-none focus:border-emerald-500 transition-all placeholder:text-neutral-700 uppercase"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <button 
                type="submit"
                disabled={isSearching || !searchQuery}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-5 rounded-2xl text-lg shadow-xl shadow-emerald-900/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {isSearching ? <Loader2 className="animate-spin" /> : 'Buscar Material'}
              </button>
            </form>
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
