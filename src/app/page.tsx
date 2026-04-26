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
    <main className="min-h-screen bg-neutral-950 text-white p-6 md:p-12 relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-600/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />

      <div className="max-w-5xl mx-auto relative z-10">
        
        {/* Header con Perfil */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-16 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-[1.5rem] bg-neutral-900 border border-white/10 flex items-center justify-center shadow-2xl relative group">
              <div className="absolute inset-0 bg-emerald-500/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <User className="w-8 h-8 text-emerald-500 relative z-10" />
            </div>
            <div>
              <h1 className="text-3xl font-black tracking-tighter leading-none mb-1.5 uppercase">
                {user.nombre}
              </h1>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-[0.1em] shadow-lg ${
                  isAdmin ? 'bg-emerald-500 text-neutral-950' : isBodeguero ? 'bg-blue-500 text-white' : 'bg-amber-500 text-neutral-950'
                }`}>
                  {user.rol}
                </span>
                <div className="h-1 w-1 rounded-full bg-neutral-700" />
                <span className="text-neutral-500 text-xs font-bold tracking-tight">{user.rut}</span>
              </div>
            </div>
          </div>
          
          <button 
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-white/5 hover:bg-red-500/10 border border-white/5 hover:border-red-500/20 text-neutral-400 hover:text-red-400 font-bold transition-all group text-sm"
          >
            <LogOut className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            Cerrar Sesión
          </button>
        </header>

        {/* Grid de Accesos */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
          
          {/* Módulos de Terreno (Para todos) */}
          <MenuCard 
            href="/pedidos/nuevo"
            title="Pre-Pedido"
            desc="Solicita materiales para tu isométrico desde terreno."
            icon={<Package className="w-7 h-7" />}
            color="amber"
          />

          {/* Módulos de Bodega (Admin y Bodeguero) */}
          {isBodeguero && (
            <>
              <MenuCard 
                href="/meson"
                title="Mesón Entregas"
                desc="Gestión de despachos y escaneo de cédulas."
                icon={<HandHeart className="w-7 h-7" />}
                color="blue"
              />
              <MenuCard 
                href="/recepcion"
                title="Recepción"
                desc="Ingreso de nuevos materiales al inventario."
                icon={<PackagePlus className="w-7 h-7" />}
                color="emerald"
              />
              <MenuCard 
                href="/dashboard"
                title="Stock & Métricas"
                desc="Vista general de existencias e historial vivo."
                icon={<LayoutDashboard className="w-7 h-7" />}
                color="purple"
              />
            </>
          )}

          {/* Módulos de Administración (Solo Admin) */}
          {isAdmin && (
            <MenuCard 
              href="/admin/usuarios"
              title="Gestión Usuarios"
              desc="Administra roles, permisos y acceso del personal."
              icon={<ShieldCheck className="w-7 h-7" />}
              color="rose"
            />
          )}
        </div>

        <footer className="mt-20 pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-[10px] text-neutral-600 font-bold uppercase tracking-[0.2em]">LukeAPP Bodega Terreno v2.5</p>
          <div className="flex gap-6">
            <span className="text-[10px] text-neutral-700 font-black uppercase tracking-widest flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
              Servidor Activo
            </span>
          </div>
        </footer>
      </div>
    </main>
  )
}

function MenuCard({ href, title, desc, icon, color }: { href: string, title: string, desc: string, icon: any, color: string }) {
  const colorMap: any = {
    emerald: 'from-emerald-500/10 to-emerald-500/0 hover:border-emerald-500/30 text-emerald-400 bg-emerald-500/5',
    blue: 'from-blue-500/10 to-blue-500/0 hover:border-blue-500/30 text-blue-400 bg-blue-500/5',
    purple: 'from-purple-500/10 to-purple-500/0 hover:border-purple-500/30 text-purple-400 bg-purple-500/5',
    amber: 'from-amber-500/10 to-amber-500/0 hover:border-amber-500/30 text-amber-400 bg-amber-500/5',
    rose: 'from-rose-500/10 to-rose-500/0 hover:border-rose-500/30 text-rose-400 bg-rose-500/5',
  }

  return (
    <Link href={href} className="group h-full">
      <div className={`relative p-8 rounded-[2rem] border border-white/5 bg-gradient-to-br ${colorMap[color]} transition-all duration-500 hover:shadow-2xl hover:shadow-black/50 h-full flex flex-col`}>
        <div className="mb-6 p-4 rounded-2xl bg-neutral-900/50 border border-white/10 w-fit group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 shadow-xl">
          {icon}
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-bold tracking-tight text-white mb-2 group-hover:text-white transition-colors">{title}</h3>
          <p className="text-neutral-500 text-xs font-medium leading-relaxed mb-6">{desc}</p>
        </div>
        <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-neutral-700 group-hover:text-white transition-colors">
          Acceder módulo <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>
    </Link>
  )
}
