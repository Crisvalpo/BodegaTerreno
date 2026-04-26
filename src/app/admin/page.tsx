'use client'

import Link from 'next/link'
import { Database, LayoutGrid, Users, ChevronLeft, ArrowRight, Settings, FileSpreadsheet, MapPin, Map } from 'lucide-react'

export default function AdminDashboard() {
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
        <header className="flex items-center gap-4 mb-12">
          <Link href="/" className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 hover:bg-neutral-800 transition-colors text-neutral-400 hover:text-white">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-3xl font-black text-white flex items-center gap-3">
              <Settings className="text-neutral-400" />
              Panel de Configuración
            </h1>
            <p className="text-neutral-400">Herramientas maestras para el administrador de LukeAPP.</p>
          </div>
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
