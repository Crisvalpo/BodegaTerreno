import Link from 'next/link'
import { Package, ScanLine, LayoutDashboard, Database, Container, Settings, PackagePlus } from 'lucide-react'

export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-950 p-6 flex flex-col items-center justify-center relative overflow-hidden">
      
      {/* Top right Settings */}
      <div className="absolute top-6 right-6 z-50">
        <Link href="/admin" className="p-3 bg-neutral-900/50 hover:bg-white/10 rounded-2xl border border-white/5 text-neutral-400 hover:text-white transition-all flex items-center justify-center shadow-lg" title="Ajustes de Administración">
          <Settings className="w-6 h-6" />
        </Link>
      </div>

      {/* Luces y brillos de fondo */}
      <div className="absolute top-1/4 left-1/4 w-[50vw] h-[50vw] rounded-full bg-emerald-600/10 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[40vw] h-[40vw] rounded-full bg-blue-600/10 blur-[150px] pointer-events-none" />

      <div className="text-center z-10 max-w-4xl mb-12">
        <div className="inline-flex items-center justify-center px-4 py-1.5 rounded-full glass mb-6 text-sm font-medium text-emerald-400">
          <span className="relative flex h-2 w-2 mr-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          Sistema en Línea
        </div>
        <div className="flex flex-col md:flex-row items-center justify-center gap-4 mb-6">
          <div className="p-3 bg-white/5 rounded-2xl border border-white/10 shadow-inner">
            <Container className="w-10 h-10 text-emerald-400" strokeWidth={1.5} />
          </div>
          <h1 className="text-5xl md:text-6xl font-black text-white tracking-tight">
            LukeAPP <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-blue-500">Bodega Terreno</span>
          </h1>
        </div>
        <p className="text-lg md:text-xl text-neutral-400 font-light">
          Plataforma logística en terreno para la trazabilidad y entrega de materiales piping. Selecciona un módulo para comenzar.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 z-10 w-full max-w-7xl px-4">
        
        {/* Card 1: Recepción */}
        <Link href="/recepcion" className="group block h-full">
          <div className="glass rounded-3xl p-8 h-full border border-white/5 hover:border-emerald-500/30 hover:bg-white/10 transition-all duration-300">
            <div className="w-14 h-14 rounded-2xl bg-neutral-900 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-inner">
              <PackagePlus className="w-7 h-7 text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-3">Recepción de Material</h2>
            <p className="text-neutral-400 text-sm leading-relaxed">
              Ingresa stock al contenedor. Escanea el material y asígnale un rack físico.
            </p>
          </div>
        </Link>

        {/* Card 2: Pre-Pedido */}
        <Link href="/pedidos/nuevo" className="group block h-full">
          <div className="glass rounded-3xl p-8 h-full border border-white/5 hover:border-amber-500/30 hover:bg-white/10 transition-all duration-300">
            <div className="w-14 h-14 rounded-2xl bg-neutral-900 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-inner">
              <Package className="w-7 h-7 text-amber-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-3">Pre-Pedido Terreno</h2>
            <p className="text-neutral-400 text-sm leading-relaxed">
              Solicita materiales para tu isométrico. Genera un carrito de reserva rápida.
            </p>
          </div>
        </Link>

        {/* Card 3: Mesón Bodeguero */}
        <Link href="/meson" className="group block h-full">
          <div className="glass rounded-3xl p-8 h-full border border-white/5 hover:border-blue-500/30 hover:bg-white/10 transition-all duration-300">
            <div className="w-14 h-14 rounded-2xl bg-neutral-900 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-inner">
              <ScanLine className="w-7 h-7 text-blue-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-3">Mesón de Entregas</h2>
            <p className="text-neutral-400 text-sm leading-relaxed">
              Escanea cédulas, gestiona pedidos pendientes y registra el despacho final.
            </p>
          </div>
        </Link>

        {/* Card 4: Dashboard General */}
        <Link href="/dashboard" className="group block h-full">
          <div className="glass rounded-3xl p-8 h-full border border-white/5 hover:border-purple-500/30 hover:bg-white/10 transition-all duration-300">
            <div className="w-14 h-14 rounded-2xl bg-neutral-900 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform shadow-inner">
              <LayoutDashboard className="w-7 h-7 text-purple-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-3">Stock y Métricas</h2>
            <p className="text-neutral-400 text-sm leading-relaxed">
              Control general de existencias por rack y métricas de movimiento.
            </p>
          </div>
        </Link>

      </div>
    </main>
  )
}
