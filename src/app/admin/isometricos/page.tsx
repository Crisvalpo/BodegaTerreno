'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'
import Link from 'next/link'
import { Map, Plus, Trash2, Loader2, ChevronLeft, Search, FileUp, Hash } from 'lucide-react'
import * as XLSX from 'xlsx'

type Isometrico = {
  id: string
  codigo: string
  revision: string
  proyecto: string
  linea: string
}

export default function IsometricosAdminPage() {
  const [isometricos, setIsometricos] = useState<Isometrico[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [search, setSearch] = useState('')

  const [formData, setFormData] = useState({
    codigo: '',
    revision: '0',
    proyecto: 'ANDINA',
    linea: ''
  })

  useEffect(() => {
    fetchIsometricos()
  }, [])

  async function fetchIsometricos() {
    setIsLoading(true)
    const { data } = await supabase.from('isometricos').select('*').order('codigo', { ascending: true })
    setIsometricos(data || [])
    setIsLoading(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formData.codigo) return
    setIsSaving(true)
    try {
      const { data, error } = await supabase.from('isometricos').insert([formData]).select()
      if (error) throw error
      setIsometricos([data[0], ...isometricos])
      setFormData({ codigo: '', revision: '0', proyecto: 'ANDINA', linea: '' })
      toast.success('Isométrico registrado correctamente')
    } catch (error: any) {
      toast.error('Error al guardar', { description: error.message })
    } finally {
      setIsSaving(false)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        const wsname = wb.SheetNames[0]
        const ws = wb.Sheets[wsname]
        const data = XLSX.utils.sheet_to_json(ws)

        setIsSaving(true)
        const toInsert = data.map((row: any) => ({
          codigo: String(row.isometrico || row.codigo || row.ISO || '').toUpperCase(),
          revision: String(row.revision || row.rev || '0'),
          proyecto: String(row.proyecto || 'ANDINA'),
          linea: String(row.linea || '')
        })).filter(i => i.codigo)

        const { error } = await supabase.from('isometricos').upsert(toInsert, { onConflict: 'codigo' })
        if (error) throw error

        toast.success(`Carga masiva completada: ${toInsert.length} registros`)
        fetchIsometricos()
      } catch (err: any) {
        toast.error('Error en Excel', { description: err.message })
      } finally {
        setIsSaving(false)
      }
    }
    reader.readAsBinaryString(file)
  }

  const deleteIso = async (id: string) => {
    if (!confirm('¿Eliminar isométrico?')) return
    const { error } = await supabase.from('isometricos').delete().eq('id', id)
    if (!error) setIsometricos(isometricos.filter(i => i.id !== id))
  }

  const filtered = isometricos.filter(i => i.codigo.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="min-h-screen bg-neutral-950 p-6 md:p-12 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-600/10 blur-[120px] pointer-events-none" />
      
      <div className="max-w-6xl mx-auto relative z-10">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white transition-colors">
              <ChevronLeft size={20} />
            </Link>
            <div>
              <h1 className="text-3xl font-black text-white flex items-center gap-3">
                <Map className="text-purple-400" />
                Maestro de Isométricos
              </h1>
              <p className="text-neutral-400 text-sm italic">Base de datos centralizada de Planos y Revisiones.</p>
            </div>
          </div>
          
          <div className="flex gap-4">
            <label className="flex items-center gap-3 px-6 py-3 bg-neutral-900 border border-neutral-800 rounded-2xl text-white hover:bg-white/5 cursor-pointer transition-all shadow-xl">
              <FileUp size={20} className="text-purple-400" />
              <div className="flex flex-col items-start">
                <span className="text-sm font-bold leading-none">Carga Masiva</span>
                <span className="text-[10px] text-neutral-500 uppercase font-black mt-1">Excel (.xlsx)</span>
              </div>
              <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
            </label>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* FORMULARIO INDIVIDUAL */}
          <div className="lg:col-span-4">
            <div className="glass rounded-3xl p-8 border border-white/10 sticky top-8">
              <h2 className="text-xl font-bold text-white mb-8 flex items-center gap-2">
                <Plus size={20} className="text-purple-400" />
                Ingreso Individual
              </h2>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-2 block">Código Isométrico</label>
                  <input 
                    type="text" 
                    required
                    value={formData.codigo}
                    onChange={e => setFormData({...formData, codigo: e.target.value.toUpperCase()})}
                    className="w-full bg-neutral-900 border-2 border-neutral-800 rounded-2xl px-5 py-4 text-white font-bold focus:border-purple-500 outline-none uppercase transition-all"
                    placeholder="AH-380-..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-2 block">Revisión</label>
                    <div className="relative">
                      <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-600 w-4 h-4" />
                      <input 
                        type="text" 
                        value={formData.revision}
                        onChange={e => setFormData({...formData, revision: e.target.value})}
                        className="w-full bg-neutral-900 border-2 border-neutral-800 rounded-2xl pl-10 pr-4 py-4 text-white font-bold focus:border-purple-500 outline-none"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-neutral-500 uppercase tracking-widest mb-2 block">Línea</label>
                    <input 
                      type="text" 
                      value={formData.linea}
                      onChange={e => setFormData({...formData, linea: e.target.value})}
                      className="w-full bg-neutral-900 border-2 border-neutral-800 rounded-2xl px-5 py-4 text-white font-bold focus:border-purple-500 outline-none"
                      placeholder="Line"
                    />
                  </div>
                </div>
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className="w-full bg-purple-600 hover:bg-purple-500 text-white font-black py-5 rounded-2xl transition-all shadow-xl shadow-purple-900/30 flex items-center justify-center gap-2"
                >
                  {isSaving ? <Loader2 className="animate-spin" /> : 'Registrar Plano'}
                </button>
              </form>
            </div>
          </div>

          {/* TABLA DE RESULTADOS */}
          <div className="lg:col-span-8 space-y-6">
            <div className="relative">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-neutral-600" />
              <input 
                type="text"
                placeholder="Buscar por código de isométrico..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-3xl pl-14 pr-6 py-5 text-white focus:border-purple-500 outline-none shadow-2xl"
              />
            </div>

            <div className="glass rounded-[2rem] border border-white/5 overflow-hidden shadow-2xl">
              {isLoading ? (
                <div className="p-24 flex flex-col items-center justify-center">
                  <Loader2 className="animate-spin text-purple-500 w-12 h-12 mb-4" />
                  <p className="text-neutral-500 font-medium">Sincronizando maestro...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-white/5 text-neutral-500 text-[10px] font-black uppercase tracking-widest">
                      <tr>
                        <th className="px-8 py-6">Código (ID)</th>
                        <th className="px-8 py-6 text-center">Rev</th>
                        <th className="px-8 py-6">Línea</th>
                        <th className="px-8 py-6 text-right">Acción</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filtered.map(iso => (
                        <tr key={iso.id} className="hover:bg-white/5 transition-colors group">
                          <td className="px-8 py-6 font-black text-white text-lg uppercase tracking-tight tracking-wide">{iso.codigo}</td>
                          <td className="px-8 py-6 text-center">
                            <span className="bg-neutral-800 text-purple-400 px-3 py-1 rounded-lg font-black text-xs border border-purple-400/20">
                              REV {iso.revision}
                            </span>
                          </td>
                          <td className="px-8 py-6 text-neutral-400 font-medium">{iso.linea || '--'}</td>
                          <td className="px-8 py-6 text-right">
                            <button onClick={() => deleteIso(iso.id)} className="p-2 text-neutral-700 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                              <Trash2 size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filtered.length === 0 && (
                    <div className="p-20 text-center text-neutral-600">
                      <Map size={48} className="mx-auto mb-4 opacity-10" />
                      <p>No se encontraron isométricos.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
