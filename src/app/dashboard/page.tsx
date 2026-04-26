'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'
import Link from 'next/link'
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
  ArrowUpFromLine
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
  }
  ubicaciones: {
    zona: string
    rack: string
    nivel: string
  }
}

export default function DashboardPage() {
  const [stock, setStock] = useState<StockItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedGroup, setSelectedGroup] = useState('')
  const [groups, setGroups] = useState<string[]>([])

  useEffect(() => {
    fetchStock()
  }, [])

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
            <p className="text-2xl font-black text-blue-400">--</p>
          </div>
          <div className="glass rounded-2xl p-6 border border-white/5">
            <p className="text-neutral-500 text-xs font-bold uppercase tracking-widest mb-1">Alertas Stock</p>
            <p className="text-2xl font-black text-amber-400">0</p>
          </div>
        </div>

        {/* Visualización de Inventario */}
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
                            <span className="text-white font-black text-lg">{item.materiales?.ident_code}</span>
                            <span className="text-neutral-500 text-xs line-clamp-1">{item.materiales?.descripcion}</span>
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
                        <h3 className="text-xl font-black text-white">{item.materiales?.ident_code}</h3>
                        <p className="text-xs text-neutral-500 uppercase font-bold tracking-wider">{item.materiales?.part_group}</p>
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
      </div>
    </div>
  )
}
