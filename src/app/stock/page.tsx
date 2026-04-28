'use client'

import { useState, useEffect, Suspense } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { 
  LayoutDashboard, 
  Search, 
  Package, 
  MapPin, 
  ArrowUpRight, 
  Loader2, 
  ChevronLeft,
  Filter,
  ArrowDownToLine,
  ArrowUpFromLine,
  History,
  Clock,
  Map,
  Download
} from 'lucide-react'
import * as XLSX from 'xlsx'
import Cookies from 'js-cookie'
import ImagePromptModal from '@/components/ImagePromptModal'
import { getStockAction } from '../actions/stock'

type StockItem = {
  id: string
  cantidad: number
  cantidad_reservada: number
  materiales: {
    ident_code: string
    descripcion: string
    part_group: string
    input_1?: string
    input_2?: string
    input_3?: string
    input_4?: string
    image_url?: string
  }
  ubicaciones: {
    zona: string
    rack: string
    nivel: string
  }
}

function StockContent() {
  const searchParams = useSearchParams()
  const [stock, setStock] = useState<StockItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedGroup, setSelectedGroup] = useState('')
  const [groups, setGroups] = useState<string[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [isometricConsumption, setIsometricConsumption] = useState<any[]>([])
  const [shortages, setShortages] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState<'stock' | 'history' | 'isos' | 'shortages'>('stock')
  const [userRole, setUserRole] = useState<string | null>(null)
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
      setStock(prev => prev.map(item => 
        item.materiales?.ident_code === promptModal.identCode 
          ? { ...item, materiales: { ...item.materiales, image_url: url } } 
          : item
      ))
      
      toast.success('Imagen actualizada correctamente')
    } catch (error: any) {
      toast.error('Error al actualizar imagen', { description: error.message })
    } finally {
      setUpdatingImage(null)
    }
  }

  useEffect(() => {
    // Obtener rol del usuario desde la sesión o cookies (Sistema Nativo)
    const fetchUser = async () => {
      try {
        const storedUser = Cookies.get('user') || localStorage.getItem('bodega_user')
        if (storedUser) {
          const user = JSON.parse(storedUser)
          console.log('Sesión detectada:', user.nombre, 'Rol:', user.rol)
          setUserRole(user.rol || null)
        } else {
          console.log('No se encontró sesión activa en cookies ni localStorage')
        }
      } catch (err) {
        console.error('Error al leer sesión:', err)
      }
    }
    fetchUser()

    const tab = searchParams.get('tab')
    if (tab === 'history') setActiveTab('history')
    if (tab === 'isos') setActiveTab('isos')
    if (tab === 'shortages') setActiveTab('shortages')
    
    fetchStock()
    fetchHistory()
    fetchIsometricConsumption()
    fetchShortages()
  }, [searchParams])

  async function fetchShortages() {
    try {
      // Solo contamos quiebres de pedidos que ya fueron FINALIZADOS (entregado)
      // para no confundir pedidos en cola con quiebres reales.
      const { data, error } = await supabase
        .from('pedido_items')
        .select(`
          cantidad_solicitada,
          cantidad_entregada,
          materiales!inner(ident_code, descripcion),
          pedidos!inner(id, observaciones, usuarios(nombre), estado),
          isometricos(codigo)
        `)
        .eq('pedidos.estado', 'entregado')
      
      if (error) throw error
      if (!data) return

      // Agrupar por material, solo si hubo faltante real
      const agg: any = {}
      data.forEach((item: any) => {
        const solicitado = Number(item.cantidad_solicitada)
        const entregado = Number(item.cantidad_entregada || 0)
        
        if (entregado < solicitado) {
          const ident = item.materiales?.ident_code
          if (!agg[ident]) {
            agg[ident] = {
              descripcion: item.materiales?.descripcion,
              totalFaltante: 0,
              casos: []
            }
          }
          const faltante = solicitado - entregado
          agg[ident].totalFaltante += faltante
          agg[ident].casos.push({
            usuario: item.pedidos?.usuarios?.nombre,
            isometrico: item.isometricos?.codigo || 'VALE GENERAL',
            faltante,
            observacion: item.pedidos?.observaciones
          })
        }
      })

      const result = Object.entries(agg).map(([ident, details]: [string, any]) => ({
        ident,
        ...details
      })).sort((a, b) => b.totalFaltante - a.totalFaltante)

      setShortages(result)
    } catch (err) {
      console.error('Error en quiebres:', err)
    }
  }

  async function fetchHistory() {
    const { data } = await supabase
      .from('movimientos')
      .select(`
        id, tipo, cantidad, timestamp,
        materiales(ident_code, descripcion),
        usuarios(nombre),
        ubicaciones(rack, nivel)
      `)
      .order('timestamp', { ascending: false })
      .limit(5000)
    setHistory(data || [])
  }

  async function fetchIsometricConsumption() {
    try {
      // 1. Obtener movimientos OUT
      const { data: movs } = await supabase
        .from('movimientos')
        .select(`
          cantidad,
          material_id,
          referencia_id,
          materiales(ident_code, descripcion)
        `)
        .eq('tipo', 'OUT')

      if (!movs) return

      // 2. Obtener todos los pedidos con sus isométricos para cruzar
      const { data: peds } = await supabase
        .from('pedidos')
        .select(`
          id,
          isometricos(codigo)
        `)

      const pedidosMap = (peds || []).reduce((acc: any, p: any) => {
        acc[p.id] = p.isometricos?.codigo
        return acc
      }, {})

      // 3. Agrupar manualmente
      const agg: any = {}
      movs.forEach((mov: any) => {
        const isoCode = pedidosMap[mov.referencia_id] || 'VALES GENERALES / MISCELÁNEOS'
        const ident = mov.materiales?.ident_code
        
        if (!agg[isoCode]) agg[isoCode] = {}
        if (!agg[isoCode][ident]) {
          agg[isoCode][ident] = {
            descripcion: mov.materiales?.descripcion,
            total: 0
          }
        }
        agg[isoCode][ident].total += Number(mov.cantidad)
      })

      // 4. Convertir a array para renderizar
      const result = Object.entries(agg).map(([iso, materials]: [string, any]) => ({
        iso,
        materials: Object.entries(materials).map(([ident, details]: [string, any]) => ({
          ident,
          ...details
        }))
      }))

      setIsometricConsumption(result)
    } catch (err) {
      console.error('Error en consumo:', err)
    }
  }

  async function fetchStock() {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/stock?t=${Date.now()}`)
      const data = await response.json()
      
      if (data.error) throw new Error(data.error)
      
      const formattedData = data as any[]
      setStock(formattedData)

      // Extraer grupos únicos para el filtro
      const uniqueGroups = Array.from(new Set(formattedData.map(item => item.materiales?.part_group).filter(Boolean))) as string[]
      setGroups(uniqueGroups.sort())

    } catch (error: any) {
      toast.error('Error al cargar inventario', { description: error.message })
    } finally {
      setIsLoading(false)
    }
  }

  // 1. Filtrar
  const filteredStock = stock.filter(item => {
    const matchesSearch = 
      item.materiales?.ident_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.materiales?.descripcion.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesGroup = selectedGroup === '' || item.materiales?.part_group === selectedGroup

    return matchesSearch && matchesGroup
  })

  // 2. Agrupar por Ident Code
  const groupedStock = filteredStock.reduce((acc: any[], current) => {
    const existing = acc.find(item => item.materiales?.ident_code === current.materiales?.ident_code)
    
    if (existing) {
      existing.cantidad += current.cantidad
      existing.cantidad_reservada += current.cantidad_reservada
      // Añadir ubicación a la lista si no existe
      const locStr = `${current.ubicaciones?.rack}-${current.ubicaciones?.nivel}`
      if (!existing.ubicaciones_list.includes(locStr)) {
        existing.ubicaciones_list.push(locStr)
      }
    } else {
      acc.push({
        ...current,
        ubicaciones_list: [`${current.ubicaciones?.rack}-${current.ubicaciones?.nivel}`]
      })
    }
    return acc
  }, [])

  // 3. Filtrar Consumo por Isométrico
  const filteredIsos = isometricConsumption.map(isoGroup => ({
    ...isoGroup,
    materials: isoGroup.materials.filter((m: any) => 
      isoGroup.iso.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.ident.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.descripcion.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(isoGroup => isoGroup.materials.length > 0)

  // Cálculos rápidos
  const totalItems = groupedStock.length
  const totalQuantity = groupedStock.reduce((acc, curr) => acc + curr.cantidad, 0)

  const handleExport = () => {
    const wb = XLSX.utils.book_new()
    const dateStr = new Date().toLocaleDateString('es-CL').replace(/\//g, '-')
    
    // 1. HOJA: EXISTENCIAS
    const stockData = groupedStock.map(item => ({
      'Ident Code': item.materiales?.ident_code,
      'Descripción': item.materiales?.descripcion,
      'Familia': item.materiales?.part_group,
      'Ubicaciones': item.ubicaciones_list.join(', '),
      'Stock Actual': item.cantidad,
      'Reservado': item.cantidad_reservada
    }))
    const wsStock = XLSX.utils.json_to_sheet(stockData)
    XLSX.utils.book_append_sheet(wb, wsStock, "Existencias")

    // 2. HOJA: CONSUMO POR ISOMÉTRICOS
    const isoData = filteredIsos.flatMap(isoGroup => 
      isoGroup.materials.map((m: any) => ({
        'Isométrico': isoGroup.iso,
        'Ident Code': m.ident,
        'Descripción': m.descripcion,
        'Total Entregado': m.total
      }))
    )
    if (isoData.length > 0) {
      const wsIso = XLSX.utils.json_to_sheet(isoData)
      XLSX.utils.book_append_sheet(wb, wsIso, "Consumo Isométricos")
    }

    // 3. HOJA: QUIEBRES DE STOCK
    const shortageData = shortages.flatMap(s => 
      s.casos.map((c: any) => ({
        'Ident Code': s.ident,
        'Descripción': s.descripcion,
        'Faltante Total Material': s.totalFaltante,
        'Trabajador': c.usuario,
        'Isométrico': c.isometrico,
        'Cant. Faltante Caso': c.faltante,
        'Observación Bodega': c.observacion
      }))
    )
    if (shortageData.length > 0) {
      const wsShortage = XLSX.utils.json_to_sheet(shortageData)
      XLSX.utils.book_append_sheet(wb, wsShortage, "Quiebres de Stock")
    }

    // 4. HOJA: HISTORIAL
    const historyData = history.map(mov => ({
      'Fecha/Hora': new Date(mov.timestamp).toLocaleString('es-CL'),
      'Tipo': mov.tipo,
      'Ident Code': mov.materiales?.ident_code,
      'Descripción': mov.materiales?.descripcion,
      'Cantidad': mov.cantidad,
      'Operario': mov.usuarios?.nombre || 'SISTEMA',
      'Ubicación': mov.ubicaciones ? `${mov.ubicaciones.rack}-${mov.ubicaciones.nivel}` : '--'
    }))
    const wsHistory = XLSX.utils.json_to_sheet(historyData)
    XLSX.utils.book_append_sheet(wb, wsHistory, "Historial Reciente")

    // Descargar Archivo Maestro
    XLSX.writeFile(wb, `Reporte_Maestro_Bodega_${dateStr}.xlsx`)
    toast.success('Reporte Maestro Generado', { description: 'Se ha descargado un archivo Excel con todas las pestañas de control.' })
  }

  return (
    <div className="min-h-screen bg-neutral-950 p-4 md:p-12 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-purple-600/10 blur-[120px] pointer-events-none" />
      
      <div className="max-w-7xl mx-auto relative z-10">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white transition-colors">
              <ChevronLeft className="w-6 h-6" />
            </Link>
            <div>
              <h1 className="text-3xl font-black text-white flex items-center gap-3">
                <LayoutDashboard className="text-purple-400" />
                Control de Stock
              </h1>
              <p className="text-neutral-400 text-sm">Monitoreo de existencias por rack y familia de materiales.</p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
              <input 
                type="text" 
                placeholder="Buscar material..."
                className="w-full md:w-64 bg-neutral-900 border border-neutral-800 rounded-xl pl-12 pr-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-all"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
              <select 
                className="w-full md:w-56 bg-neutral-900 border border-neutral-800 rounded-xl pl-12 pr-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-all appearance-none"
                value={selectedGroup}
                onChange={e => setSelectedGroup(e.target.value)}
              >
                <option value="">Todas las Familias</option>
                {groups.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
            {userRole === 'admin' && (
              <button 
                onClick={handleExport}
                className="flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg shadow-emerald-900/20 active:scale-95"
              >
                <Download size={16} />
                Exportar Excel
              </button>
            )}
          </div>
        </header>

        {/* TABS DE NAVEGACIÓN */}
        <div className="flex gap-2 mb-8 bg-neutral-900/50 p-1 rounded-2xl border border-white/5 w-fit">
          <button 
            onClick={() => setActiveTab('stock')}
            className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all ${activeTab === 'stock' ? 'bg-purple-600 text-white' : 'text-neutral-500 hover:text-white'}`}
          >
            Existencias
          </button>
          <button 
            onClick={() => setActiveTab('isos')}
            className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all ${activeTab === 'isos' ? 'bg-blue-600 text-white' : 'text-neutral-500 hover:text-white'}`}
          >
            Consumo por Isométrico
          </button>
          <button 
            onClick={() => setActiveTab('shortages')}
            className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all flex items-center gap-2 ${activeTab === 'shortages' ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/20' : 'text-neutral-500 hover:text-white'}`}
          >
            Quiebres de Stock
            {shortages.length > 0 && (
              <span className="flex h-5 min-w-[20px] px-1.5 items-center justify-center rounded-full bg-white text-rose-600 text-[10px] font-black animate-pulse shadow-sm">
                {shortages.length}
              </span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all ${activeTab === 'history' ? 'bg-neutral-800 text-white' : 'text-neutral-500 hover:text-white'}`}
          >
            Historial Vivo
          </button>
        </div>

        {/* KPIs Rápidos */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="glass rounded-2xl p-6 border border-white/5">
            <p className="text-neutral-500 text-xs font-bold uppercase tracking-widest mb-1">Ítems Únicos</p>
            <p className="text-2xl font-black text-white">{totalItems}</p>
          </div>
          <div className="glass rounded-2xl p-6 border border-white/5">
            <p className="text-neutral-500 text-xs font-bold uppercase tracking-widest mb-1">Cant. Total</p>
            <p className="text-2xl font-black text-emerald-400">{totalQuantity.toLocaleString()}</p>
          </div>
          <div className="glass rounded-2xl p-6 border border-white/5">
            <p className="text-neutral-500 text-xs font-bold uppercase tracking-widest mb-1">Movimientos Hoy</p>
            <p className="text-2xl font-black text-blue-400">{history.filter(m => new Date(m.timestamp).toDateString() === new Date().toDateString()).length}</p>
          </div>
          <div className="glass rounded-2xl p-6 border border-white/5">
            <p className="text-neutral-500 text-xs font-bold uppercase tracking-widest mb-1">Alertas Stock</p>
            <p className="text-2xl font-black text-amber-400">0</p>
          </div>
        </div>

        {/* CONTENIDO SEGÚN TAB */}
        {activeTab === 'stock' && (
          <div className="glass rounded-3xl border border-white/5 overflow-hidden">
            {isLoading ? (
              <div className="p-20 flex flex-col items-center justify-center gap-4">
                <Loader2 className="w-10 h-10 text-purple-500 animate-spin" />
                <p className="text-neutral-500 font-medium">Consolidando existencias...</p>
              </div>
            ) : groupedStock.length > 0 ? (
              <>
                {/* VISTA DESKTOP: TABLA */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/5 text-neutral-500 text-xs uppercase tracking-widest font-bold">
                        <th className="px-6 py-5">Material</th>
                        <th className="px-6 py-5">Familia / Part Group</th>
                        <th className="px-6 py-5">Ubicaciones (Racks)</th>
                        <th className="px-6 py-5 text-right">Existencia Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {groupedStock.map((item, idx) => (
                        <tr key={idx} className="hover:bg-white/5 transition-colors group">
                          <td className="px-6 py-5">
                            <div className="flex flex-col">
                              <div className="flex items-start gap-4">
                                {item.materiales?.image_url ? (
                                  <div className="w-16 h-16 rounded-xl overflow-hidden bg-neutral-900 border border-neutral-800 flex-shrink-0 relative group">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={item.materiales.image_url} alt={item.materiales.ident_code} className="w-full h-full object-cover" />
                                    {(userRole === 'admin' || userRole === 'bodeguero') && (
                                      <button 
                                        onClick={() => handleUpdateImage(item.materiales.ident_code, item.materiales.descripcion)}
                                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] font-black text-white uppercase tracking-widest"
                                      >
                                        Cambiar
                                      </button>
                                    )}
                                  </div>
                                ) : (userRole === 'admin' || userRole === 'bodeguero') ? (
                                  <button 
                                    onClick={() => handleUpdateImage(item.materiales.ident_code, item.materiales.descripcion)}
                                    disabled={updatingImage === item.materiales.ident_code}
                                    className="w-16 h-16 rounded-xl bg-neutral-900/50 border border-dashed border-neutral-700 flex flex-col items-center justify-center gap-1 text-neutral-500 hover:text-purple-400 hover:border-purple-500/50 hover:bg-purple-500/10 transition-all flex-shrink-0 disabled:opacity-50"
                                  >
                                    {updatingImage === item.materiales.ident_code ? (
                                      <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                      <>
                                        <ArrowUpRight className="w-4 h-4" />
                                        <span className="text-[8px] font-black uppercase tracking-widest text-center px-1">Agregar<br/>Imagen</span>
                                      </>
                                    )}
                                  </button>
                                ) : (
                                  <div className="w-16 h-16 rounded-xl bg-neutral-900/50 border border-neutral-800 flex items-center justify-center flex-shrink-0">
                                    <Package className="w-6 h-6 text-neutral-700" />
                                  </div>
                                )}
                                <div>
                                  <div className="flex items-center gap-3 mb-1">
                                    <span className="text-white font-black text-lg tracking-tighter uppercase italic">{item.materiales?.ident_code}</span>
                                    {(item.materiales?.input_1 || item.materiales?.input_3) && (
                                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-black uppercase italic">
                                        {item.materiales.input_1} {item.materiales.input_2 !== '0' && item.materiales.input_2 ? `x ${item.materiales.input_2}` : ''} | {item.materiales.input_3}
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-neutral-500 text-xs font-bold uppercase italic line-clamp-2">{item.materiales?.descripcion}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <span className="px-3 py-1 rounded-full bg-purple-500/10 text-purple-400 text-xs font-bold border border-purple-500/20">
                              {item.materiales?.part_group || 'SIN GRUPO'}
                            </span>
                          </td>
                          <td className="px-6 py-5">
                            <div className="flex flex-wrap gap-2">
                              {item.ubicaciones_list.map((loc: string) => (
                                <div key={loc} className="flex items-center gap-1.5 px-2 py-1 rounded bg-neutral-900 border border-neutral-800 text-xs font-medium text-neutral-300">
                                  <MapPin className="w-3 h-3 text-neutral-600" />
                                  {loc}
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="px-6 py-5 text-right">
                            <div className="flex flex-col items-end">
                              <span className="text-2xl font-black text-white">{item.cantidad}</span>
                              {item.cantidad_reservada > 0 && (
                                <span className="text-[10px] text-amber-500 font-bold uppercase">
                                  {item.cantidad_reservada} Reservados
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* VISTA MÓVIL: TARJETAS */}
                <div className="md:hidden divide-y divide-white/5">
                  {groupedStock.map((item, idx) => (
                    <div key={idx} className="p-5 active:bg-white/5 transition-colors">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-xl font-black text-white tracking-tighter uppercase italic">{item.materiales?.ident_code}</h3>
                            {(item.materiales?.input_1 || item.materiales?.input_3) && (
                              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[9px] font-black uppercase italic border border-emerald-500/20">
                                {item.materiales.input_1} | {item.materiales.input_3}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-neutral-500 uppercase font-black tracking-widest">{item.materiales?.part_group}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-black text-emerald-400">{item.cantidad}</p>
                          <p className="text-[10px] text-neutral-500 font-bold uppercase">Unidades</p>
                        </div>
                      </div>
                      
                      <div className="flex gap-4 mb-4">
                        {item.materiales?.image_url ? (
                          <div className="w-20 h-20 rounded-xl overflow-hidden bg-neutral-900 border border-neutral-800 flex-shrink-0 relative group">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={item.materiales.image_url} alt={item.materiales.ident_code} className="w-full h-full object-cover" />
                            {(userRole === 'admin' || userRole === 'bodeguero') && (
                              <button 
                                onClick={() => handleUpdateImage(item.materiales.ident_code, item.materiales.descripcion)}
                                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] font-black text-white uppercase tracking-widest"
                              >
                                Cambiar
                              </button>
                            )}
                          </div>
                        ) : (userRole === 'admin' || userRole === 'bodeguero') ? (
                          <button 
                            onClick={() => handleUpdateImage(item.materiales.ident_code, item.materiales.descripcion)}
                            disabled={updatingImage === item.materiales.ident_code}
                            className="w-20 h-20 rounded-xl bg-neutral-900/50 border border-dashed border-neutral-700 flex flex-col items-center justify-center gap-1 text-neutral-500 hover:text-purple-400 hover:border-purple-500/50 hover:bg-purple-500/10 transition-all flex-shrink-0 disabled:opacity-50"
                          >
                            {updatingImage === item.materiales.ident_code ? (
                              <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                              <>
                                <ArrowUpRight className="w-5 h-5" />
                                <span className="text-[9px] font-black uppercase tracking-widest text-center px-1">Agregar<br/>Imagen</span>
                              </>
                            )}
                          </button>
                        ) : (
                          <div className="w-20 h-20 rounded-xl bg-neutral-900/50 border border-neutral-800 flex items-center justify-center flex-shrink-0">
                            <Package className="w-8 h-8 text-neutral-700" />
                          </div>
                        )}
                        <p className="text-sm text-neutral-400 line-clamp-4 leading-relaxed flex-1">
                          {item.materiales?.descripcion}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {item.ubicaciones_list.map((loc: string) => (
                          <div key={loc} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-neutral-900 border border-neutral-800 text-[10px] font-bold text-indigo-400">
                            <MapPin className="w-3 h-3" />
                            {loc}
                          </div>
                        ))}
                      </div>
                      {item.cantidad_reservada > 0 && (
                        <div className="mt-3 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-[10px] font-bold text-amber-500 text-center uppercase">
                          {item.cantidad_reservada} Unidades Reservadas
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="p-20 text-center flex flex-col items-center">
                <Package className="w-16 h-16 text-neutral-800 mb-4" />
                <p className="text-neutral-500 text-lg">No se encontraron existencias con los filtros aplicados.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'isos' && (
          <div className="space-y-6">
            {filteredIsos.length > 0 ? (
              filteredIsos.map((isoGroup, idx) => (
                <div key={idx} className="glass rounded-3xl border border-white/5 overflow-hidden shadow-xl">
                  <div className="bg-white/5 px-8 py-4 flex items-center justify-between border-b border-white/5">
                    <h3 className={`text-xl font-black flex items-center gap-3 italic ${
                      isoGroup.iso === 'VALES GENERALES / MISCELÁNEOS' ? 'text-neutral-500' : 'text-blue-400'
                    }`}>
                      <Map size={20} /> {isoGroup.iso}
                    </h3>
                    <span className="text-[10px] font-black text-neutral-500 uppercase tracking-widest">Resumen de Consumo</span>
                  </div>
                  <div className="p-0">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-neutral-600 text-[10px] uppercase font-black tracking-widest border-b border-white/5">
                          <th className="px-8 py-4">Ident Code</th>
                          <th className="px-8 py-4">Descripción</th>
                          <th className="px-8 py-4 text-right">Cantidad Entregada</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {isoGroup.materials.map((m: any, midx: number) => (
                          <tr key={midx} className="hover:bg-white/[0.02] transition-colors">
                            <td className="px-8 py-4 font-black text-white">{m.ident}</td>
                            <td className="px-8 py-4 text-neutral-500 text-xs">{m.descripcion}</td>
                            <td className="px-8 py-4 text-right font-black text-emerald-400 text-lg">{m.total}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-24 text-center glass rounded-3xl border border-dashed border-white/10">
                <p className="text-neutral-600 italic">Aún no hay entregas registradas vinculadas a isométricos.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <div className="glass rounded-3xl border border-white/5 overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 bg-white/5 text-neutral-500 text-[10px] uppercase tracking-widest font-black">
                    <th className="px-6 py-4">Fecha / Hora</th>
                    <th className="px-6 py-4">Tipo</th>
                    <th className="px-6 py-4">Material</th>
                    <th className="px-6 py-4 text-center">Cant.</th>
                    <th className="px-6 py-4">Operario</th>
                    <th className="px-6 py-4">Origen/Destino</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {history.map((mov, idx) => (
                    <tr key={idx} className="hover:bg-white/5 transition-colors text-sm">
                      <td className="px-6 py-4 text-neutral-400 font-medium">
                        {new Date(mov.timestamp).toLocaleString('es-CL', { 
                          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' 
                        })}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-[10px] font-black uppercase ${
                          mov.tipo === 'IN' ? 'bg-emerald-500/10 text-emerald-400' : 
                          mov.tipo === 'OUT' ? 'bg-red-500/10 text-red-400' : 'bg-blue-500/10 text-blue-400'
                        }`}>
                          {mov.tipo}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-white font-bold">{mov.materiales?.ident_code}</p>
                        <p className="text-[10px] text-neutral-500 line-clamp-1">{mov.materiales?.descripcion}</p>
                      </td>
                      <td className="px-6 py-4 text-center font-black text-white">
                        {mov.cantidad}
                      </td>
                      <td className="px-6 py-4 text-neutral-400 font-bold uppercase text-xs">
                        {mov.usuarios?.nombre || 'SISTEMA'}
                      </td>
                      <td className="px-6 py-4 text-neutral-500 text-xs">
                        {mov.ubicaciones ? `${mov.ubicaciones.rack}-${mov.ubicaciones.nivel}` : '--'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'shortages' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-6">
            <div className="bg-rose-500/10 border border-rose-500/20 p-6 rounded-3xl mb-8 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-rose-500 uppercase italic tracking-tighter">Reporte de Demanda Insatisfecha</h2>
                <p className="text-neutral-400 text-sm">Materiales solicitados en terreno que no pudieron ser entregados por falta de stock.</p>
              </div>
              <div className="text-right">
                <p className="text-4xl font-black text-rose-500">{shortages.length}</p>
                <p className="text-[10px] text-neutral-500 font-black uppercase">Quiebres Detectados</p>
              </div>
            </div>

            <div className="glass rounded-3xl border border-white/5 overflow-hidden shadow-2xl">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-white/5 text-neutral-500 text-[10px] font-black uppercase tracking-widest border-b border-white/5">
                    <th className="px-8 py-4">Ident Code / Descripción</th>
                    <th className="px-8 py-4">Casos & Observaciones de Bodega</th>
                    <th className="px-8 py-4 text-right">Cant. Faltante Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {shortages.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-8 py-20 text-center">
                        <p className="text-neutral-600 italic">No hay quiebres registrados. ¡Bodega al día!</p>
                      </td>
                    </tr>
                  ) : (
                    shortages.map((s, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="px-8 py-6">
                          <p className="text-white font-black text-lg tracking-tighter uppercase italic mb-1 group-hover:text-rose-400 transition-colors">{s.ident}</p>
                          <p className="text-[10px] text-neutral-500 font-bold uppercase line-clamp-1 leading-none">{s.descripcion}</p>
                        </td>
                        <td className="px-8 py-6">
                          <div className="flex flex-col gap-3">
                            {s.casos.map((c: any, cidx: number) => (
                              <div key={cidx} className="flex flex-col border-l-2 border-rose-500/30 pl-3">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[10px] text-white font-black uppercase italic leading-none">{c.usuario}</span>
                                  <span className="text-[8px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-black border border-blue-500/10 uppercase tracking-tighter">
                                    ISO: {c.isometrico}
                                  </span>
                                </div>
                                {c.observacion && (
                                  <p className="text-[9px] text-rose-500/50 italic font-medium leading-relaxed">"{c.observacion}"</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-8 py-6 text-right">
                          <div className="flex flex-col items-end">
                            <span className="text-3xl font-black text-rose-500 italic leading-none">
                              {s.totalFaltante}
                            </span>
                            <span className="text-[8px] text-neutral-600 font-black uppercase mt-1">Unidades Pendientes</span>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
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

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 text-purple-500 animate-spin" />
          <p className="text-neutral-700 font-black uppercase tracking-[0.4em] text-[10px]">Cargando Inventario...</p>
        </div>
      </div>
    }>
      <StockContent />
    </Suspense>
  )
}
