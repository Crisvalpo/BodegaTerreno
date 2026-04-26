'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  LayoutDashboard, 
  PackagePlus, 
  HandHeart, 
  Package, 
  LogOut,
  User,
  ShieldCheck,
  ChevronRight,
  ScanLine,
  Container
} from 'lucide-react'

export default function Home() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const storedUser = localStorage.getItem('bodega_user')
    if (!storedUser) {
      router.push('/login')
    } else {
      setUser(JSON.parse(storedUser))
    }
    setIsLoading(false)
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem('bodega_user')
    router.push('/login')
  }

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <Container className="w-12 h-12 text-emerald-500" />
          <p className="text-neutral-500 font-bold uppercase tracking-widest text-[10px]">Cargando Sistema...</p>
        </div>
      </div>
    )
  }

  const isAdmin = user.rol === 'admin'
  const isBodeguero = user.rol === 'bodeguero' || isAdmin

  return (
    <main className="min-h-screen bg-[#050505] text-white p-6 md:p-12 relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-600/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-blue-600/5 blur-[120px] pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10">
        
        {/* Header Superior Premium */}
        <header className="flex items-start justify-between mb-12 animate-in fade-in slide-in-from-top-6 duration-700">
          <div className="flex items-center gap-6">
            <div className="relative group">
              <div className="absolute inset-0 bg-emerald-500/20 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="w-20 h-20 rounded-[2.2rem] bg-neutral-900/50 backdrop-blur-xl border border-white/10 flex items-center justify-center shadow-2xl relative z-10">
                <User className="w-10 h-10 text-emerald-500" />
              </div>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-3 mb-1">
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] shadow-lg ${
                  isAdmin ? 'bg-emerald-500 text-neutral-950 shadow-emerald-500/20' : isBodeguero ? 'bg-blue-600 text-white shadow-blue-600/20' : 'bg-amber-500 text-neutral-950 shadow-amber-500/20'
                }`}>
                  {user.rol}
                </span>
                <span className="text-neutral-600 text-[10px] font-black uppercase tracking-widest">{user.rut}</span>
              </div>
              <h1 className="text-4xl font-black tracking-tighter leading-none italic">
                {user.nombre.split(' ')[0]} <span className="text-neutral-500 not-italic">{user.nombre.split(' ')[1] || ''}</span>
              </h1>
            </div>
          </div>
          
          <button 
            onClick={handleLogout}
            className="p-4 rounded-2.5xl bg-neutral-900/50 border border-white/5 text-neutral-500 hover:text-red-400 hover:border-red-500/20 hover:bg-red-500/5 transition-all shadow-xl group"
            title="Cerrar Sesión"
          >
            <LogOut className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
          </button>
        </header>

        {/* Quick Stats / KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12 animate-in fade-in slide-in-from-top-8 duration-700 delay-100">
          <StatCard label="Pedidos Hoy" value="12" color="emerald" />
          <StatCard label="Pendientes" value="04" color="amber" />
          <StatCard label="En Tránsito" value="08" color="blue" />
          <StatCard label="Stock Crítico" value="02" color="rose" />
        </div>

        {/* Action Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-200">
          <MenuCard 
            href="/pedidos/nuevo"
            title="Pre-Pedido"
            desc="Solicitud de materiales desde terreno."
            icon={<Package className="w-8 h-8" />}
            color="amber"
          />

          <MenuCard 
            href="/dashboard"
            title="Stock & Métricas"
            desc="Consulta de existencias en tiempo real."
            icon={<LayoutDashboard className="w-8 h-8" />}
            color="purple"
          />

          {isBodeguero && (
            <>
              <MenuCard 
                href="/meson"
                title="Mesón Bodega"
                desc="Gestión de despachos y entregas."
                icon={<HandHeart className="w-8 h-8" />}
                color="blue"
              />
              <MenuCard 
                href="/recepcion"
                title="Recepción"
                desc="Ingreso masivo de materiales."
                icon={<PackagePlus className="w-8 h-8" />}
                color="emerald"
              />
            </>
          )}

          {isAdmin && (
            <MenuCard 
              href="/admin/usuarios"
              title="Admin Usuarios"
              desc="Control total de personal y roles."
              icon={<ShieldCheck className="w-8 h-8" />}
              color="rose"
            />
          )}
        </div>

        <footer className="mt-20 pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-col gap-1">
            <p className="text-[10px] text-neutral-700 font-black uppercase tracking-[0.4em]">BODEGA TERRENO PREMIMUM v2.5</p>
            <p className="text-[8px] text-neutral-800 font-bold uppercase tracking-widest">Desarrollado para Control de Obras Piping</p>
          </div>
          <div className="flex gap-8">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,1)] animate-pulse" />
              <span className="text-[10px] text-neutral-600 font-black uppercase tracking-widest">En Línea</span>
            </div>
          </div>
        </footer>
      </div>
    </main>
  )
}

function StatCard({ label, value, color }: { label: string, value: string, color: string }) {
  const colors: any = {
    emerald: 'text-emerald-400 border-emerald-500/10 bg-emerald-500/5',
    amber: 'text-amber-400 border-amber-500/10 bg-amber-500/5',
    blue: 'text-blue-400 border-blue-500/10 bg-blue-500/5',
    rose: 'text-rose-400 border-rose-500/10 bg-rose-500/5'
  }
  return (
    <div className={`p-6 rounded-[2rem] border backdrop-blur-xl ${colors[color]} flex flex-col items-center shadow-2xl`}>
      <span className="text-3xl font-black tracking-tighter mb-1">{value}</span>
      <span className="text-[9px] font-black uppercase tracking-widest opacity-60 text-center">{label}</span>
    </div>
  )
}

function MenuCard({ href, title, desc, icon, color }: { href: string, title: string, desc: string, icon: any, color: string }) {
  const colors: any = {
    amber: 'text-amber-500 bg-amber-500/10 group-hover:bg-amber-500/20 group-hover:shadow-[0_0_30px_rgba(245,158,11,0.15)]',
    blue: 'text-blue-500 bg-blue-500/10 group-hover:bg-blue-500/20 group-hover:shadow-[0_0_30px_rgba(59,130,246,0.15)]',
    emerald: 'text-emerald-500 bg-emerald-500/10 group-hover:bg-emerald-500/20 group-hover:shadow-[0_0_30px_rgba(16,185,129,0.15)]',
    purple: 'text-purple-500 bg-purple-500/10 group-hover:bg-purple-500/20 group-hover:shadow-[0_0_30px_rgba(168,85,247,0.15)]',
    rose: 'text-rose-500 bg-rose-500/10 group-hover:bg-rose-500/20 group-hover:shadow-[0_0_30px_rgba(244,63,94,0.15)]',
  }
  
  return (
    <Link href={href} className="group relative">
      <div className={`h-full p-8 bg-neutral-900/40 backdrop-blur-3xl rounded-[3rem] border border-white/5 transition-all duration-500 flex flex-col ${colors[color]}`}>
        <div className="w-16 h-16 rounded-2.5xl flex items-center justify-center mb-8 bg-neutral-950 border border-white/5 shadow-inner">
          {icon}
        </div>
        <h3 className="text-2xl font-black text-white mb-2 tracking-tight group-hover:translate-x-1 transition-transform italic">{title}</h3>
        <p className="text-sm text-neutral-500 font-medium leading-relaxed mb-6">{desc}</p>
        <div className="mt-auto flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-neutral-400 group-hover:text-white transition-colors">
          Entrar Módulo <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </Link>
  )
}
