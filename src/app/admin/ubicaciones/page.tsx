'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'
import Link from 'next/link'
import { LayoutGrid, Plus, Trash2, MapPin, Loader2, ChevronLeft } from 'lucide-react'

type Ubicacion = {
  id: string
  zona: string
  rack: string
  nivel: string
}

export default function UbicacionesPage() {
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    zona: '',
    rack: '',
    nivel: ''
  })

  useEffect(() => {
    fetchUbicaciones()
  }, [])

  async function fetchUbicaciones() {
    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('ubicaciones')
        .select('*')
        .order('zona', { ascending: true })
        .order('rack', { ascending: true })
        .order('nivel', { ascending: true })

      if (error) throw error
      setUbicaciones(data || [])
    } catch (error: any) {
      toast.error('Error al cargar ubicaciones', { description: error.message })
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.zona || !formData.rack) {
      toast.error('Zona y Rack son campos obligatorios')
      return
    }

    setIsSaving(true)
    try {
      const { data, error } = await supabase
        .from('ubicaciones')
        .insert([formData])
        .select()

      if (error) throw error

      toast.success('Ubicación creada', { description: `${formData.zona} - Rack ${formData.rack} - Nivel ${formData.nivel}` })
      setUbicaciones([...ubicaciones, data[0]])
      setFormData({ zona: formData.zona, rack: '', nivel: '' }) // Mantiene la zona para carga rápida
    } catch (error: any) {
      toast.error('Error al guardar', { description: error.message })
    } finally {
      setIsSaving(false)
    }
  }

  async function deleteUbicacion(id: string) {
    if (!confirm('¿Estás seguro de eliminar esta ubicación? Si tiene stock asociado podría haber errores.')) return

    try {
      const { error } = await supabase
        .from('ubicaciones')
        .delete()
        .eq('id', id)

      if (error) throw error

      setUbicaciones(ubicaciones.filter(u => u.id !== id))
      toast.success('Ubicación eliminada')
    } catch (error: any) {
      toast.error('Error al eliminar', { description: 'Es probable que esta ubicación tenga existencias vinculadas.' })
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 p-6 md:p-12 relative overflow-hidden">
      {/* Fondos decorativos */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none" />

      <div className="max-w-5xl mx-auto relative z-10">
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 transition-colors text-neutral-400 hover:text-white">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-3xl font-black text-white flex items-center gap-3">
                <LayoutGrid className="text-indigo-400" />
                Gestión de Espacios
              </h1>
              <p className="text-neutral-400 text-sm">Define las ubicaciones físicas de tu contenedor (Racks/Niveles)</p>
            </div>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* FORMULARIO DE CREACIÓN */}
          <div className="lg:col-span-1">
            <div className="glass rounded-3xl p-6 border border-white/10 sticky top-8">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-400" />
                Nueva Ubicación
              </h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1 block">Zona / Contenedor</label>
                  <input 
                    type="text" 
                    placeholder="Ej: Contenedor 1"
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                    value={formData.zona}
                    onChange={e => setFormData({...formData, zona: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1 block">Rack / Estante</label>
                  <input 
                    type="text" 
                    placeholder="Ej: A"
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                    value={formData.rack}
                    onChange={e => setFormData({...formData, rack: e.target.value})}
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-1 block">Nivel / Altura</label>
                  <input 
                    type="text" 
                    placeholder="Ej: 1"
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                    value={formData.nivel}
                    onChange={e => setFormData({...formData, nivel: e.target.value})}
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
                >
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Crear Ubicación'}
                </button>
              </form>
            </div>
          </div>

          {/* LISTADO DE UBICACIONES */}
          <div className="lg:col-span-2">
            <div className="glass rounded-3xl border border-white/10 overflow-hidden">
              <div className="p-6 border-b border-white/5 bg-white/5">
                <h2 className="text-lg font-bold text-white">Mapa de Ubicaciones Actual</h2>
              </div>
              
              {isLoading ? (
                <div className="p-12 flex flex-col items-center justify-center gap-4">
                  <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                  <p className="text-neutral-500">Cargando mapa físico...</p>
                </div>
              ) : ubicaciones.length > 0 ? (
                <div>
                  {/* VISTA MÓVIL (CARDS) */}
                  <div className="md:hidden divide-y divide-white/5">
                    {ubicaciones.map(u => (
                      <div key={u.id} className="p-4 flex items-center justify-between bg-neutral-900/50">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                            <MapPin size={20} />
                          </div>
                          <div>
                            <p className="text-white font-bold text-sm">{u.zona}</p>
                            <p className="text-[10px] text-neutral-500 uppercase font-black">Rack {u.rack} • Nivel {u.nivel}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => deleteUbicacion(u.id)}
                          className="p-3 text-neutral-600 active:text-red-500"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* VISTA DESKTOP (TABLA) */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-white/5 text-neutral-500 text-xs uppercase tracking-widest font-bold">
                          <th className="px-6 py-4">Zona</th>
                          <th className="px-6 py-4">Rack</th>
                          <th className="px-6 py-4">Nivel</th>
                          <th className="px-6 py-4 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {ubicaciones.map(u => (
                          <tr key={u.id} className="hover:bg-white/5 transition-colors group">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-neutral-600" />
                                <span className="text-white font-medium">{u.zona}</span>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="bg-neutral-800 text-indigo-400 px-2 py-1 rounded-md text-xs font-bold border border-indigo-400/20">
                                {u.rack}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-neutral-300">
                              {u.nivel}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button 
                                onClick={() => deleteUbicacion(u.id)}
                                className="p-2 text-neutral-600 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center">
                  <LayoutGrid className="w-12 h-12 text-neutral-800 mx-auto mb-4" />
                  <p className="text-neutral-500 italic">No hay ubicaciones registradas aún.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
