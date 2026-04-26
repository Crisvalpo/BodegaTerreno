'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { 
  User, 
  LogOut, 
  Package, 
  ClipboardList, 
  History, 
  ChevronRight, 
  Database, 
  PackagePlus, 
  ShieldCheck,
  Activity,
  Settings
} from 'lucide-react'
import Cookies from 'js-cookie'
import Link from 'next/link'

export default function Home() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [stats, setStats] = useState({
    hoy: 0,
    pendientes: 0,
    transito: 0,
    critico: 0
  })

  useEffect(() => {
    const storedUser = localStorage.getItem('bodega_user')
    if (!storedUser) {
      router.push('/login')
      return
    }
    setUser(JSON.parse(storedUser))
    setIsLoading(false)
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      const today = new Date().toISOString().split('T')[0]
      
      const { count: pedidosHoy } = await supabase.from('pedidos').select('*', { count: 'exact', head: true }).gte('created_at', today)
      const { count: pendientes } = await supabase.from('pedidos').select('*', { count: 'exact', head: true }).eq('estado', 'pendiente')
      const { count: transito } = await supabase.from('pedidos').select('*', { count: 'exact', head: true }).eq('estado', 'parcial')
      
      // Simulación de crítico basada en existencias bajas
      const { data: existencias } = await supabase.from('existencias').select('cantidad')
      const criticoCount = existencias?.filter(e => e.cantidad < 5).length || 0

      setStats({
        hoy: pedidosHoy || 0,
        pendientes: pendientes || 0,
        transito: transito || 0,
        critico: criticoCount
      })
    } catch (e) {
      console.error('Error fetching stats:', e)
    }
  }

  const handleLogout = () => {
    Cookies.remove('user')
    localStorage.removeItem('bodega_user')
    router.push('/login')
  }

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Database className="w-12 h-12 text-emerald-500 animate-pulse" />
          <p className="text-neutral-700 font-black uppercase tracking-[0.4em] text-[10px]">Cargando Sistema...</p>
        </div>
      </div>
    )
  }

  const isAdmin = user.rol === 'admin'
  const isBodeguero = user.rol === 'bodeguero' || isAdmin

  return (
    <main className="min-h-screen bg-[#050505] text-neutral-200 font-sans selection:bg-emerald-500/30 flex justify-center">
      {/* Contenedor Fijo de App Móvil / Desktop Adaptado */}
      <div className="w-full max-w-md md:max-w-2xl bg-[#0a0a0a] min-h-screen border-x border-neutral-900 shadow-[0_0_100px_rgba(0,0,0,0.5)] flex flex-col p-6 relative">
        
        {/* Header de la App */}
        <header className="flex items-center justify-between mb-10 pt-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-neutral-900 border border-neutral-800 rounded-2xl flex items-center justify-center shadow-xl">
              <User className="w-7 h-7 text-emerald-500" />
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500/60 leading-none mb-1">{user.rol}</span>
              <h1 className="text-2xl font-black tracking-tighter text-white leading-none uppercase italic">
                {user.nombre.split(' ')[0]}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Link 
                href="/admin"
                className="w-12 h-12 bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-600 flex items-center justify-center hover:text-emerald-500 hover:bg-emerald-500/10 transition-all active:scale-90"
              >
                <Settings size={20} />
              </Link>
            )}
            <button 
              onClick={handleLogout}
              className="w-12 h-12 bg-neutral-900 border border-neutral-800 rounded-xl text-neutral-600 flex items-center justify-center hover:text-white hover:bg-rose-500/10 transition-all active:scale-90"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>

        {/* Stats de App (Grid Adaptativo) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <StatCard label="Pedidos Hoy" value={stats.hoy.toString().padStart(2, '0')} accent="emerald" />
          <StatCard label="Pendientes" value={stats.pendientes.toString().padStart(2, '0')} accent="blue" />
          <StatCard label="En Tránsito" value={stats.transito.toString().padStart(2, '0')} accent="neutral" />
          <StatCard label="Crítico" value={stats.critico.toString().padStart(2, '0')} accent="rose" />
        </div>

        {/* Menú de App (Grid 1 o 2 columnas) */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 content-start overflow-y-auto custom-scrollbar pb-10">
          
          {/* PRIORIDAD 1: RECEPCIÓN */}
          <MenuCard 
            href="/recepcion"
            title="Recepción"
            desc="Ingreso de materiales."
            icon={<PackagePlus size={22} />}
            accent="blue"
          />

          <MenuCard 
            href="/pedidos/nuevo"
            title="Pre-Pedido"
            desc="Solicitud de operarios."
            icon={<Package size={22} />}
            accent="emerald"
          />

          {isBodeguero && (
            <MenuCard 
              href="/meson"
              title="Mesón Bodega"
              desc="Terminal de despacho."
              icon={<Activity size={22} />}
              accent="emerald"
            />
          )}

          <MenuCard 
            href="/stock"
            title="Stock & KPI"
            desc="Consulta de existencias."
            icon={<Database size={22} />}
            accent="neutral"
          />

          <MenuCard 
            href="/stock?tab=history"
            title="Historial"
            desc="Registro de movimientos."
            icon={<History size={22} />}
            accent="neutral"
          />
        </div>

        {/* Footer de App */}
        <footer className="pt-6 border-t border-neutral-900 flex flex-col items-center gap-2 opacity-20">
          <p className="text-[9px] text-neutral-500 font-black uppercase tracking-[0.3em]">Bodega Terreno</p>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-[8px] font-bold text-neutral-700 uppercase italic">Conectado</span>
          </div>
        </footer>
      </div>
    </main>
  )
}

function StatCard({ label, value, accent }: { label: string, value: string, accent: 'emerald' | 'blue' | 'rose' | 'neutral' }) {
  const accents = {
    emerald: 'text-emerald-500 border-emerald-500/10 bg-emerald-500/5',
    blue: 'text-blue-500 border-blue-500/10 bg-blue-500/5',
    rose: 'text-rose-500 border-rose-500/10 bg-rose-500/5',
    neutral: 'text-neutral-500 border-neutral-800 bg-neutral-900/40'
  }
  return (
    <div className={`p-5 rounded-xl border flex flex-col items-center justify-center ${accents[accent]}`}>
      <span className="text-2xl font-mono font-black italic">{value}</span>
      <span className="text-[8px] font-black uppercase tracking-widest opacity-40">{label}</span>
    </div>
  )
}

function MenuCard({ href, title, desc, icon, accent }: { href: string, title: string, desc: string, icon: any, accent: 'emerald' | 'blue' | 'rose' | 'neutral' }) {
  const accents = {
    emerald: 'hover:border-emerald-500/30 active:bg-emerald-500/5',
    blue: 'hover:border-blue-500/30 active:bg-blue-500/5',
    rose: 'hover:border-rose-500/30 active:bg-rose-500/5',
    neutral: 'hover:border-neutral-500/30 active:bg-neutral-500/5'
  }
  
  const iconColors = {
    emerald: 'text-emerald-500',
    blue: 'text-blue-500',
    rose: 'text-rose-500',
    neutral: 'text-neutral-500'
  }

  return (
    <Link href={href} className="group">
      <div className={`bg-neutral-900 border border-neutral-800 rounded-xl p-5 h-full transition-all flex items-center gap-5 ${accents[accent]}`}>
        <div className={`w-12 h-12 bg-black border border-neutral-800 rounded-lg flex items-center justify-center shrink-0 ${iconColors[accent]}`}>
          {icon}
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-black text-white tracking-tighter uppercase italic leading-none mb-1">
            {title}
          </h3>
          <p className="text-[10px] text-neutral-500 font-medium leading-none uppercase italic">
            {desc}
          </p>
        </div>
        <ChevronRight size={14} className="text-neutral-800 group-hover:text-neutral-400 group-hover:translate-x-1 transition-all" />
      </div>
    </Link>
  )
}
