'use client'

import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabaseClient'
import { UploadCloud, FileSpreadsheet, Loader2, Database, AlertCircle, Edit3, PlusCircle, Search, Filter } from 'lucide-react'
import Link from 'next/link'
import ImagePromptModal from '@/components/ImagePromptModal'

type MaterialRow = {
  id?: string
  ident: string
  ident_code: string
  peso: number
  input_1: string
  input_2: string
  input_3: string
  input_4: string
  commodity_code: string
  spec_code: string
  descripcion: string
  short_code: string
  sap_mat_grp: string
  grupo: string
  part_group: string
  image_url?: string
}

export default function CargaMasivaPage() {
  const [activeTab, setActiveTab] = useState<'excel' | 'manual' | 'buscar'>('excel')
  const [isProcessing, setIsProcessing] = useState(false)
  const [stats, setStats] = useState<{ total: number; uploaded: number } | null>(null)
  const [isDragActive, setIsDragActive] = useState(false)

  // Opciones precargadas de la Base de Datos
  const [gruposDisponibles, setGruposDisponibles] = useState<string[]>([])

  // ESTADO PARA FORMULARIO MANUAL
  const [manualForm, setManualForm] = useState({
    grupo: '',
    ident_code: '',
    spec_code: '',
    descripcion: '',
    peso: '0',
    unidad: 'EA',
    input_1: '',
    input_2: '',
    input_3: '',
    input_4: '',
    commodity_code: '',
    short_code: '',
    sap_mat_grp: '',
    part_group: ''
  })

  // ESTADO PARA BUSCADOR
  const [searchQuery, setSearchQuery] = useState('')
  const [searchGroup, setSearchGroup] = useState('')
  const [searchResults, setSearchResults] = useState<MaterialRow[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [updatingImage, setUpdatingImage] = useState<string | null>(null)
  const [promptModal, setPromptModal] = useState<{ isOpen: boolean, identCode: string, descripcion: string }>({ isOpen: false, identCode: '', descripcion: '' })

  const handleUpdateImage = (identCode: string, descripcion: string) => {
    // Buscar imagen en Google y luego abrir modal
    const query = encodeURIComponent(descripcion)
    window.open(`https://www.google.com/search?tbm=isch&q=${query}`, '_blank')
    setPromptModal({ isOpen: true, identCode, descripcion })
  }

  const handleImagePromptSubmit = async (url: string) => {
    setPromptModal({ isOpen: false, identCode: '', descripcion: '' })
    
    try {
      setUpdatingImage(promptModal.identCode)
      const { error } = await supabase
        .from('materiales')
        .update({ image_url: url })
        .eq('ident_code', promptModal.identCode)

      if (error) throw error
      
      // Actualizar estado local
      setSearchResults(prev => prev.map(item => 
        item.ident_code === promptModal.identCode 
          ? { ...item, image_url: url } 
          : item
      ))
      
      toast.success('Imagen actualizada correctamente')
    } catch (error: any) {
      toast.error('Error al actualizar imagen', { description: error.message })
    } finally {
      setUpdatingImage(null)
    }
  }

  // Cargar grupos existentes al abrir pestañas
  useEffect(() => {
    if (activeTab === 'manual' || activeTab === 'buscar') {
      const loadGrupos = async () => {
        const { data, error } = await supabase.from('materiales').select('part_group').not('part_group', 'is', null)
        if (!error && data) {
          const uniqueGroups = Array.from(new Set(data.map(d => d.part_group).filter(Boolean))) as string[]
          setGruposDisponibles(uniqueGroups.sort())
        }
      }
      loadGrupos()
    }
  }, [activeTab])

  // Ejecutar búsqueda cuando cambian los filtros
  useEffect(() => {
    if (activeTab !== 'buscar') return
    
    const fetchResults = async () => {
      setIsSearching(true)
      try {
        let query = supabase.from('materiales').select('*').limit(50)

        if (searchQuery) {
          // Búsqueda en Ident Code o Descripción
          query = query.or(`ident_code.ilike.%${searchQuery}%,descripcion.ilike.%${searchQuery}%`)
        }
        
        if (searchGroup) {
          query = query.eq('part_group', searchGroup)
        }

        const { data, error } = await query
        if (error) throw error
        setSearchResults(data as MaterialRow[])
      } catch (error) {
        console.error("Error buscando:", error)
      } finally {
        setIsSearching(false)
      }
    }

    // Debounce simple
    const timeout = setTimeout(fetchResults, 300)
    return () => clearTimeout(timeout)
  }, [searchQuery, searchGroup, activeTab])


  // === LÓGICA DE EXCEL ===
  const processFile = async (file: File) => {
    setIsProcessing(true)
    setStats(null)
    await new Promise(resolve => setTimeout(resolve, 100))

    const reader = new FileReader()

    reader.onload = async (e) => {
      try {
        const data = e.target?.result
        const workbook = XLSX.read(data, { type: 'binary' })
        const firstSheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[firstSheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' })

        if (!jsonData || jsonData.length === 0) {
          toast.error('El archivo está vacío o no se pudo leer')
          setIsProcessing(false)
          return
        }

        const uniqueDataMap = new Map<string, MaterialRow>()

        jsonData.forEach((row: any) => {
          const normalizedRow: any = {}
          for (const key in row) {
            normalizedRow[key.trim().toLowerCase()] = row[key]
          }

          const ident_code = String(normalizedRow['ident code'] || '').trim()
          const spec_code = String(normalizedRow['spec code'] || '').trim()
          
          if (ident_code) {
            if (uniqueDataMap.has(ident_code)) {
              const existingRow = uniqueDataMap.get(ident_code)!
              if (spec_code && !existingRow.spec_code.includes(spec_code)) {
                existingRow.spec_code = existingRow.spec_code 
                  ? `${existingRow.spec_code}, ${spec_code}` 
                  : spec_code
              }
            } else {
              uniqueDataMap.set(ident_code, {
                ident: String(normalizedRow['ident'] || '').trim(),
                ident_code,
                peso: parseFloat(String(normalizedRow['unit weight'] || '0').replace(',', '.')) || 0,
                input_1: String(normalizedRow['input 1'] || '').trim(),
                input_2: String(normalizedRow['input 2'] || '').trim(),
                input_3: String(normalizedRow['input 3'] || '').trim(),
                input_4: String(normalizedRow['input 4'] || '').trim(),
                commodity_code: String(normalizedRow['commodity code'] || '').trim(),
                spec_code: spec_code,
                descripcion: String(normalizedRow['short desc'] || '').trim(),
                short_code: String(normalizedRow['short code'] || '').trim(),
                sap_mat_grp: String(normalizedRow['sap mat grp'] || '').trim(),
                grupo: String(normalizedRow['commodity group'] || '').trim(),
                part_group: String(normalizedRow['part group'] || '').trim(),
              })
            }
          }
        })

        const mappedData = Array.from(uniqueDataMap.values())

        if (mappedData.length === 0) {
          toast.error('No se encontraron registros válidos')
          setIsProcessing(false)
          return
        }

        setStats({ total: mappedData.length, uploaded: 0 })

        const CHUNK_SIZE = 500
        let uploadedCount = 0

        for (let i = 0; i < mappedData.length; i += CHUNK_SIZE) {
          const chunk = mappedData.slice(i, i + CHUNK_SIZE)
          const { error } = await supabase.from('materiales').upsert(chunk, { onConflict: 'ident_code' })
          if (error) throw error
          
          uploadedCount += chunk.length
          setStats({ total: mappedData.length, uploaded: uploadedCount })
        }

        toast.success(`¡Éxito! ${uploadedCount} materiales cargados/actualizados correctamente.`)
        
        const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
        if (fileInput) fileInput.value = '';

      } catch (error) {
        toast.error('Hubo un problema procesando el archivo.')
      } finally {
        setIsProcessing(false)
      }
    }
    reader.readAsBinaryString(file)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) processFile(e.target.files[0])
  }

  const handleDrop = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault()
    setIsDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) processFile(e.dataTransfer.files[0])
  }

  // === LÓGICA DE FORMULARIO MANUAL ===
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualForm.ident_code || !manualForm.descripcion) {
      toast.error('El código y la descripción son obligatorios.')
      return
    }

    setIsProcessing(true)
    try {
      const { error } = await supabase.from('materiales').upsert({
        grupo: manualForm.grupo.trim(),
        ident_code: manualForm.ident_code.trim(),
        ident: manualForm.ident_code.trim(),
        descripcion: manualForm.descripcion.trim(),
        spec_code: manualForm.spec_code.trim(),
        peso: parseFloat(manualForm.peso) || 0,
        unidad: manualForm.unidad.trim(),
        input_1: manualForm.input_1.trim(),
        input_2: manualForm.input_2.trim(),
        input_3: manualForm.input_3.trim(),
        input_4: manualForm.input_4.trim(),
        commodity_code: manualForm.commodity_code.trim(),
        short_code: manualForm.short_code.trim(),
        sap_mat_grp: manualForm.sap_mat_grp.trim(),
        part_group: manualForm.part_group.trim()
      }, { onConflict: 'ident_code' })

      if (error) throw error

      toast.success(`Material ${manualForm.ident_code} guardado correctamente.`)
      
      // Limpiar formulario excepto Part Group
      setManualForm(prev => ({ 
        ...prev, 
        ident_code: '', descripcion: '', spec_code: '', 
        input_1: '', input_2: '', input_3: '', input_4: '',
        commodity_code: '', short_code: '', sap_mat_grp: '', grupo: ''
      }))
    } catch (error: any) {
      toast.error('Error al guardar material', { description: error.message })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 p-6 md:p-12 relative overflow-hidden flex flex-col">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-600/20 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/20 blur-[120px] pointer-events-none" />

      <div className="max-w-6xl w-full mx-auto relative z-10 flex-1 flex flex-col">
        <header className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-white mb-2">
              Catálogo de Materiales
            </h1>
            <p className="text-neutral-400">
              Administra y consulta el inventario maestro de la bodega.
            </p>
          </div>
          <Link href="/" className="px-4 py-2 rounded-xl glass text-sm font-medium hover:bg-white/10 transition-colors">
            Volver al inicio
          </Link>
        </header>

        {/* TABS - Mejorados para móvil */}
        <div className="relative z-30 mb-8">
          <div className="grid grid-cols-1 sm:flex sm:flex-wrap gap-3">
            <button 
              onClick={() => setActiveTab('excel')}
              className={`flex items-center justify-center sm:justify-start gap-3 px-6 py-4 rounded-2xl font-bold transition-all shadow-lg ${activeTab === 'excel' ? 'bg-emerald-500 text-neutral-950 scale-[1.02]' : 'bg-neutral-900 text-neutral-400 border border-neutral-800 hover:bg-neutral-800'}`}
            >
              <FileSpreadsheet className="w-5 h-5" /> 
              <span>Carga Masiva</span>
            </button>
            <button 
              onClick={() => setActiveTab('manual')}
              className={`flex items-center justify-center sm:justify-start gap-3 px-6 py-4 rounded-2xl font-bold transition-all shadow-lg ${activeTab === 'manual' ? 'bg-blue-500 text-neutral-950 scale-[1.02]' : 'bg-neutral-900 text-neutral-400 border border-neutral-800 hover:bg-neutral-800'}`}
            >
              <Edit3 className="w-5 h-5" /> 
              <span>Registro Manual</span>
            </button>
            <button 
              onClick={() => setActiveTab('buscar')}
              className={`flex items-center justify-center sm:justify-start gap-3 px-6 py-4 rounded-2xl font-bold transition-all shadow-lg ${activeTab === 'buscar' ? 'bg-indigo-500 text-white scale-[1.02]' : 'bg-neutral-900 text-neutral-400 border border-neutral-800 hover:bg-neutral-800'}`}
            >
              <Search className="w-5 h-5" /> 
              <span>Consulta Catálogo</span>
            </button>
          </div>
        </div>

        {/* CONTENEDOR PRINCIPAL */}
        <div className="glass rounded-3xl p-8 border border-white/10 shadow-2xl relative overflow-hidden flex-1 flex flex-col">
          
          {/* TAB 1: EXCEL */}
          {activeTab === 'excel' && (
            <div className="animate-in fade-in duration-300">
              {/* Contenido Excel (mantenido igual) */}
              <label 
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setIsDragActive(true) }}
                onDragLeave={(e) => { e.preventDefault(); setIsDragActive(false) }}
                className={`
                  border-2 border-dashed rounded-2xl p-12 transition-all duration-300 flex flex-col items-center justify-center text-center cursor-pointer relative w-full block
                  ${isDragActive ? 'border-emerald-500 bg-emerald-500/10' : 'border-neutral-700 hover:border-emerald-500/50 hover:bg-white/5'}
                  ${isProcessing ? 'opacity-50 pointer-events-none' : ''}
                `}
              >
                <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" disabled={isProcessing} />
                <div className="h-20 w-20 rounded-full bg-neutral-900 shadow-inner flex items-center justify-center mb-6 pointer-events-none relative z-0">
                  {isProcessing ? <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" /> : <FileSpreadsheet className="w-10 h-10 text-emerald-400" />}
                </div>
                <h3 className="text-xl font-bold text-white mb-2 pointer-events-none relative z-10">
                  {isDragActive ? 'Suelta el archivo aquí' : 'Haz clic o arrastra un archivo'}
                </h3>
                <p className="text-neutral-400 max-w-sm pointer-events-none relative z-10">
                  Soporta archivos .xlsx, .xls y .csv con el formato estándar de ingeniería.
                </p>
                {isProcessing && (
                  <div className="mt-8 w-full max-w-md pointer-events-none relative z-10">
                    <div className="flex justify-between text-sm mb-2 font-medium">
                      <span className="text-emerald-400 animate-pulse">Sincronizando con Supabase...</span>
                      {stats && <span className="text-neutral-300">{stats.uploaded} / {stats.total}</span>}
                    </div>
                    <div className="w-full bg-neutral-800 rounded-full h-3 overflow-hidden">
                      <div className="bg-emerald-500 h-3 rounded-full transition-all duration-500 ease-out" style={{ width: stats ? `${(stats.uploaded / stats.total) * 100}%` : '0%' }} />
                    </div>
                  </div>
                )}
              </label>

              <div className="mt-8 bg-neutral-900/50 rounded-2xl p-6 border border-neutral-800 flex gap-4">
                <AlertCircle className="w-6 h-6 text-amber-500 flex-shrink-0" />
                <div>
                  <h4 className="text-sm font-semibold text-neutral-200 mb-1">Estructura requerida</h4>
                  <p className="text-sm text-neutral-400 leading-relaxed">
                    El sistema insertará o actualizará basándose en la columna <strong>Ident code</strong>. Asegúrate de que las cabeceras coincidan con: <span className="text-emerald-400">Ident code</span>, <span className="text-emerald-400">Spec Code</span>, <span className="text-emerald-400">Short Desc</span>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: MANUAL */}
          {activeTab === 'manual' && (
            <div className="animate-in fade-in duration-300">
              <form onSubmit={handleManualSubmit} className="space-y-6">
                
                <div className="bg-blue-600/10 border border-blue-500/30 p-6 rounded-2xl mb-6">
                  <label className="text-sm font-bold text-blue-400 mb-2 block uppercase tracking-wider">Part Group (Familia de Material)</label>
                  <input 
                    list="grupos-existentes"
                    required
                    value={manualForm.part_group}
                    onChange={e => setManualForm({...manualForm, part_group: e.target.value})}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                    placeholder="Selecciona un Part Group existente o escribe uno nuevo..."
                  />
                  <datalist id="grupos-existentes">
                    {gruposDisponibles.map(g => <option key={g} value={g} />)}
                  </datalist>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-300">Ident Code (Obligatorio)</label>
                    <input type="text" required value={manualForm.ident_code} onChange={e => setManualForm({...manualForm, ident_code: e.target.value})} className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors uppercase" placeholder="Ej. 63242229" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-neutral-300">Spec Code</label>
                    <input type="text" value={manualForm.spec_code} onChange={e => setManualForm({...manualForm, spec_code: e.target.value})} className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors uppercase" placeholder="Ej. F24, G24" />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-medium text-neutral-300">Descripción Corta (Short Desc)</label>
                    <input type="text" required value={manualForm.descripcion} onChange={e => setManualForm({...manualForm, descripcion: e.target.value})} className="w-full bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors" />
                  </div>
                </div>

                <div className="pt-6 border-t border-white/5">
                  <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-4">Atributos Técnicos</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="space-y-2"><label className="text-xs text-neutral-400">Input 1</label><input type="text" value={manualForm.input_1} onChange={e => setManualForm({...manualForm, input_1: e.target.value})} className="w-full bg-neutral-900 rounded-lg px-3 py-2 text-sm text-white" /></div>
                    <div className="space-y-2"><label className="text-xs text-neutral-400">Input 2</label><input type="text" value={manualForm.input_2} onChange={e => setManualForm({...manualForm, input_2: e.target.value})} className="w-full bg-neutral-900 rounded-lg px-3 py-2 text-sm text-white" /></div>
                    <div className="space-y-2"><label className="text-xs text-neutral-400">Input 3</label><input type="text" value={manualForm.input_3} onChange={e => setManualForm({...manualForm, input_3: e.target.value})} className="w-full bg-neutral-900 rounded-lg px-3 py-2 text-sm text-white" /></div>
                    <div className="space-y-2"><label className="text-xs text-neutral-400">Input 4</label><input type="text" value={manualForm.input_4} onChange={e => setManualForm({...manualForm, input_4: e.target.value})} className="w-full bg-neutral-900 rounded-lg px-3 py-2 text-sm text-white" /></div>
                    
                    <div className="space-y-2"><label className="text-xs text-neutral-400">Commodity Code</label><input type="text" value={manualForm.commodity_code} onChange={e => setManualForm({...manualForm, commodity_code: e.target.value})} className="w-full bg-neutral-900 rounded-lg px-3 py-2 text-sm text-white" /></div>
                    <div className="space-y-2"><label className="text-xs text-neutral-400">Short Code</label><input type="text" value={manualForm.short_code} onChange={e => setManualForm({...manualForm, short_code: e.target.value})} className="w-full bg-neutral-900 rounded-lg px-3 py-2 text-sm text-white" /></div>
                    <div className="space-y-2"><label className="text-xs text-neutral-400">SAP Mat Grp</label><input type="text" value={manualForm.sap_mat_grp} onChange={e => setManualForm({...manualForm, sap_mat_grp: e.target.value})} className="w-full bg-neutral-900 rounded-lg px-3 py-2 text-sm text-white" /></div>
                    <div className="space-y-2"><label className="text-xs text-neutral-400">Commodity Group</label><input type="text" value={manualForm.grupo} onChange={e => setManualForm({...manualForm, grupo: e.target.value})} className="w-full bg-neutral-900 rounded-lg px-3 py-2 text-sm text-white" /></div>
                  </div>
                </div>

                <div className="pt-6 border-t border-white/5 flex justify-end">
                  <button type="submit" disabled={isProcessing} className="flex items-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors disabled:opacity-50">
                    {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : <PlusCircle className="w-5 h-5" />}
                    Guardar Material
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: CONSULTAR CATÁLOGO */}
          {activeTab === 'buscar' && (
            <div className="animate-in fade-in duration-300 flex flex-col h-full">
              
              {/* Barra de Filtros */}
              <div className="flex flex-col md:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar por Ident Code o Descripción..."
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-12 pr-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
                <div className="relative w-full md:w-64">
                  <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
                  <select
                    value={searchGroup}
                    onChange={(e) => setSearchGroup(e.target.value)}
                    className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-12 pr-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-colors appearance-none"
                  >
                    <option value="">Todos los Part Groups</option>
                    {gruposDisponibles.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Resultados */}
              <div className="flex-1 overflow-y-auto bg-neutral-900/30 border border-neutral-800 rounded-2xl p-2 relative min-h-[400px]">
                {isSearching ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="space-y-2">
                    {searchResults.map((item, idx) => (
                      <div key={idx} className="bg-neutral-900 border border-neutral-800 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between hover:border-indigo-500/50 transition-colors gap-4">
                        <div className="flex items-center gap-4 flex-1">
                          {item.image_url ? (
                            <div className="w-16 h-16 rounded-lg overflow-hidden bg-black shrink-0 border border-neutral-800 relative group">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={item.image_url} alt={item.ident_code} className="w-full h-full object-cover" />
                              <button 
                                onClick={() => handleUpdateImage(item.ident_code, item.descripcion)}
                                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] font-black text-white uppercase tracking-widest"
                              >
                                Cambiar
                              </button>
                            </div>
                          ) : (
                            <button 
                              onClick={() => handleUpdateImage(item.ident_code, item.descripcion)}
                              disabled={updatingImage === item.ident_code}
                              className="w-16 h-16 rounded-lg bg-black border border-dashed border-neutral-800 flex flex-col items-center justify-center gap-1 text-neutral-500 hover:text-indigo-400 hover:border-indigo-500/50 hover:bg-indigo-500/10 transition-all shrink-0 disabled:opacity-50"
                            >
                              {updatingImage === item.ident_code ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <span className="text-[8px] font-black uppercase tracking-widest text-center px-1">Agregar<br/>Imagen</span>
                              )}
                            </button>
                          )}
                          <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <span className="text-lg font-black text-white">{item.ident_code}</span>
                            <span className="text-xs font-bold px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-400">
                              {item.part_group || 'SIN GRUPO'}
                            </span>
                          </div>
                          <p className="text-sm text-neutral-400 line-clamp-1">{item.descripcion}</p>
                        </div>
                        </div>
                        <div className="text-left md:text-right">
                          <p className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Spec Code(s)</p>
                          <p className="text-sm font-medium text-emerald-400 max-w-[200px] truncate" title={item.spec_code}>
                            {item.spec_code || '-'}
                          </p>
                        </div>
                      </div>
                    ))}
                    {searchResults.length === 50 && (
                      <div className="text-center p-4 text-xs text-neutral-500">
                        Mostrando los primeros 50 resultados. Usa la búsqueda para refinar.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-500">
                    <Database className="w-12 h-12 mb-4 opacity-20" />
                    <p>No se encontraron materiales.</p>
                  </div>
                )}
              </div>

            </div>
          )}

        </div>
      </div>
      <ImagePromptModal 
        isOpen={promptModal.isOpen}
        onClose={() => setPromptModal({ isOpen: false, identCode: '', descripcion: '' })}
        onSubmit={handleImagePromptSubmit}
        identCode={promptModal.identCode}
        descripcion={promptModal.descripcion}
      />
    </div>
  )
}
