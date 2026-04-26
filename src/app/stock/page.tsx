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
  Map
} from 'lucide-react'
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
  const [activeTab, setActiveTab] = useState<'stock' | 'history' | 'isos'>('stock')

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab === 'history') setActiveTab('history')
    if (tab === 'isos') setActiveTab('isos')
    
    fetchStock()
    fetchHistory()
    fetchIsometricConsumption()
  }, [searchParams])

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
      .limit(20)
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

  // Cálculos rápidos
  const totalItems = groupedStock.length
  const totalQuantity = groupedStock.reduce((acc, curr) => acc + curr.cantidad, 0)

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
                              <div className="flex items-center gap-3 mb-1">
                                <span className="text-white font-black text-lg tracking-tighter uppercase italic">{item.materiales?.ident_code}</span>
                                {(item.materiales?.input_1 || item.materiales?.input_3) && (
                                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-black uppercase italic">
                                    {item.materiales.input_1} {item.materiales.input_2 !== '0' && item.materiales.input_2 ? `x ${item.materiales.input_2}` : ''} | {item.materiales.input_3}
                                  </span>
                                )}
                              </div>
                              <span className="text-neutral-500 text-xs font-bold uppercase italic line-clamp-1">{item.materiales?.descripcion}</span>
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
                      <p className="text-sm text-neutral-400 mb-4 line-clamp-2 leading-relaxed">
                        {item.materiales?.descripcion}
                      </p>
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
            {isometricConsumption.length > 0 ? (
              isometricConsumption.map((isoGroup, idx) => (
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
      </div>
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
