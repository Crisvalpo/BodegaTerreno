'use client'

import Link from 'next/link'
import { Database, LayoutGrid, Users, ChevronLeft, ArrowRight, Settings, FileSpreadsheet, MapPin, Map, Download, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import * as XLSX from 'xlsx'
import { toast } from 'sonner'

export default function AdminDashboard() {
  const [isExporting, setIsExporting] = useState(false)

  const handleExportAll = async () => {
    setIsExporting(true)
    const toastId = toast.loading('Preparando auditoría total...')

    try {
      // 1. Fetch de todas las tablas críticas
      const { data: materiales } = await supabase.from('materiales').select('*').order('ident_code')
      const { data: existencias } = await supabase.from('existencias').select('*, materiales(ident_code, descripcion), ubicaciones(zona, rack, nivel)')
      const { data: movimientos } = await supabase.from('movimientos').select('*, materiales(ident_code), usuarios(nombre), ubicaciones(zona, rack, nivel)')
      const { data: pedidos } = await supabase.from('pedidos').select('*, usuarios(nombre), isometricos(codigo)')

      // 2. Crear el libro de Excel
      const wb = XLSX.utils.book_new()

      // 3. Procesar hojas
      if (materiales) {
        const wsMat = XLSX.utils.json_to_sheet(materiales)
        XLSX.utils.book_append_sheet(wb, wsMat, "CATALOGO_MATERIALES")
      }

      if (existencias) {
        const stockData = existencias.map(ex => ({
          IDENT_CODE: ex.materiales?.ident_code,
          DESCRIPCION: ex.materiales?.descripcion,
          CANTIDAD: ex.cantidad,
          UBICACION: `${ex.ubicaciones?.zona}-${ex.ubicaciones?.rack}-${ex.ubicaciones?.nivel}`
        }))
        const wsStock = XLSX.utils.json_to_sheet(stockData)
        XLSX.utils.book_append_sheet(wb, wsStock, "STOCK_ACTUAL")
      }

      if (movimientos) {
        const movData = movimientos.map(m => ({
          FECHA: new Date(m.created_at).toLocaleString(),
          TIPO: m.tipo,
          IDENT_CODE: m.materiales?.ident_code,
          CANTIDAD: m.cantidad,
          USUARIO: m.usuarios?.nombre,
          UBICACION: `${m.ubicaciones?.zona}-${m.ubicaciones?.rack}-${m.ubicaciones?.nivel}`,
          REFERENCIA: m.referencia_id
        }))
        const wsMov = XLSX.utils.json_to_sheet(movData)
        XLSX.utils.book_append_sheet(wb, wsMov, "HISTORIAL_MOVIMIENTOS")
      }

      if (pedidos) {
        const pedData = pedidos.map(p => ({
          FECHA: new Date(p.created_at).toLocaleString(),
          OPERARIO: p.usuarios?.nombre,
          ISOMETRICO: p.isometricos?.codigo || 'VALE GENERAL',
          ESTADO: p.estado,
          NOTAS: p.observaciones || ''
        }))
        const wsPed = XLSX.utils.json_to_sheet(pedData)
        XLSX.utils.book_append_sheet(wb, wsPed, "PEDIDOS_HISTORICO")
      }

      // 4. Descargar
      const fileName = `AUDITORIA_BODEGA_${new Date().toISOString().split('T')[0]}.xlsx`
      XLSX.writeFile(wb, fileName)
      
      toast.success('Auditoría exportada con éxito', { id: toastId })
    } catch (error: any) {
      toast.error('Error al exportar data: ' + error.message, { id: toastId })
    } finally {
      setIsExporting(false)
    }
  }

  const adminTools = [
    {
      title: 'Catálogo de Materiales',
      desc: 'Carga masiva por Excel, edición manual y buscador maestro.',
      href: '/admin/carga-masiva',
      icon: <FileSpreadsheet className="w-8 h-8 text-emerald-400" />,
      color: 'hover:border-emerald-500/50'
    },
    {
      title: 'Mapa de Ubicaciones',
      desc: 'Gestiona los contenedores, racks y niveles físicos de la bodega.',
      href: '/admin/ubicaciones',
      icon: <MapPin className="w-8 h-8 text-blue-400" />,
      color: 'hover:border-blue-500/50'
    },
    {
      title: 'Maestro de Isométricos',
      desc: 'Base de datos oficial de planos y spools para asociar pedidos.',
      href: '/admin/isometricos',
      icon: <Map className="w-8 h-8 text-purple-400" />,
      color: 'hover:border-purple-500/50'
    },
    {
      title: 'Maestro de Usuarios',
      desc: 'Gestión de operarios y generación de tarjetas digitales con QR.',
      href: '/admin/usuarios',
      icon: <Users className="w-8 h-8 text-blue-400" />,
      color: 'hover:border-blue-500/50'
    }
  ]

  return (
    <div className="min-h-screen bg-neutral-950 p-6 md:p-12 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-neutral-600/10 blur-[120px] pointer-events-none" />
      
      <div className="max-w-4xl mx-auto relative z-10">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 transition-colors text-neutral-400 hover:text-white">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-3xl font-black text-white flex items-center gap-3">
                <Settings className="text-neutral-400" />
                Panel Maestro
              </h1>
              <p className="text-neutral-400">Herramientas de control para el administrador.</p>
            </div>
          </div>

          <button 
            onClick={handleExportAll}
            disabled={isExporting}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest flex items-center gap-3 shadow-lg shadow-emerald-900/40 transition-all active:scale-95 disabled:opacity-50"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {isExporting ? 'Exportando...' : 'Exportar Auditoría Total'}
          </button>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {adminTools.map((tool, idx) => (
            <Link key={idx} href={tool.href} className={`group block glass rounded-3xl p-8 border border-white/5 transition-all duration-300 ${tool.color}`}>
              <div className="flex items-start justify-between">
                <div className="w-16 h-16 rounded-2xl bg-neutral-900 flex items-center justify-center mb-6 group-hover:scale-105 transition-transform shadow-inner">
                  {tool.icon}
                </div>
                <ArrowRight className="w-5 h-5 text-neutral-700 group-hover:text-white transition-colors" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">{tool.title}</h2>
              <p className="text-neutral-400 text-sm leading-relaxed">{tool.desc}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
