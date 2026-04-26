'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Package, ShieldCheck, User as UserIcon, Loader2, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'

export default function LoginPage() {
  const [rut, setRut] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rut) return toast.error('Ingresa tu RUT')
    
    setIsLoading(true)
    try {
      const { data: user, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('rut', rut)
        .maybeSingle()

      if (error) throw error

      if (!user) {
        toast.error('Usuario no encontrado', {
          description: 'El RUT ingresado no está registrado en el sistema.'
        })
        return
      }

      // Guardar sesión simple en LocalStorage (puedes mejorar esto con cookies/auth real luego)
      localStorage.setItem('bodega_user', JSON.stringify(user))
      
      toast.success(`Bienvenido, ${user.nombre}`)
      
      // Redirección según rol
      if (user.rol === 'admin' || user.rol === 'bodeguero') {
        router.push('/dashboard')
      } else {
        router.push('/pedidos/nuevo')
      }
      
    } catch (error: any) {
      toast.error('Error al iniciar sesión', { description: error.message })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
      {/* Background Glow */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-emerald-600/10 blur-[150px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] rounded-full bg-blue-600/10 blur-[150px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-10">
          <div className="inline-flex p-4 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 mb-6">
            <Package className="w-12 h-12 text-emerald-400" />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tighter mb-2">BODEGA TERRENO</h1>
          <p className="text-neutral-500 font-medium">Control de Inventario y Piping</p>
        </div>

        <div className="glass rounded-[2.5rem] p-8 border border-white/5 shadow-2xl relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
          
          <form onSubmit={handleLogin} className="space-y-6 relative z-10">
            <div className="space-y-2">
              <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest ml-1">Identificación de Usuario</label>
              <div className="relative">
                <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
                <input 
                  type="text" 
                  value={rut}
                  onChange={e => setRut(e.target.value)}
                  placeholder="Ingresa tu RUT (ej: 123456789)"
                  className="w-full bg-neutral-900/50 border-2 border-neutral-800 rounded-2xl pl-12 pr-4 py-5 text-lg font-bold text-white focus:outline-none focus:border-emerald-500 transition-all placeholder:text-neutral-700"
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-5 rounded-2xl text-lg shadow-xl shadow-emerald-900/40 flex items-center justify-center gap-3 transition-all disabled:opacity-50 active:scale-95"
            >
              {isLoading ? <Loader2 className="animate-spin" /> : (
                <>
                  Entrar al Sistema
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        </div>

        <div className="mt-10 text-center flex flex-col gap-4">
          <div className="flex items-center justify-center gap-6">
            <div className="flex items-center gap-2 text-xs font-bold text-neutral-600 uppercase tracking-widest">
              <ShieldCheck className="w-4 h-4 text-emerald-500/50" />
              Acceso Seguro
            </div>
          </div>
          <p className="text-[10px] text-neutral-700 font-bold uppercase tracking-[0.2em]">
            Desarrollado para Control de Obras Piping
          </p>
        </div>
      </div>
    </div>
  )
}
