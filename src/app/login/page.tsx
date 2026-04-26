'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { Package, ShieldCheck, User as UserIcon, Loader2, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'

export default function LoginPage() {
  const [rut, setRut] = useState('')
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rut) return toast.error('Ingresa tu RUT')
    
    setIsLoading(true)
    try {
      const cleanInput = rut.replace(/[\.-]/g, '').trim()
      
      const { data: user, error } = await supabase
        .from('usuarios')
        .select('*')
        .or(`rut.eq.${rut},rut.ilike.${cleanInput}%`)
        .maybeSingle()

      if (error) throw error

      if (!user) {
        toast.info('RUT no encontrado', {
          description: '¿Eres nuevo? Completa tus datos para registrarte.'
        })
        setIsRegistering(true)
        return
      }

      localStorage.setItem('bodega_user', JSON.stringify(user))
      toast.success(`Bienvenido, ${user.nombre}`)
      router.push('/')
      
    } catch (error: any) {
      toast.error('Error al iniciar sesión', { description: error.message })
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombre || !telefono) return toast.error('Completa todos los campos')
    
    setIsLoading(true)
    try {
      const { data: newUser, error } = await supabase
        .from('usuarios')
        .insert({
          rut,
          nombre,
          telefono: `+569${telefono}`,
          rol: 'terreno' // Por defecto solo terreno
        })
        .select()
        .single()

      if (error) throw error

      localStorage.setItem('bodega_user', JSON.stringify(newUser))
      toast.success('¡Registro exitoso!', { description: 'Ahora puedes solicitar materiales.' })
      router.push('/')

    } catch (error: any) {
      toast.error('Error en el registro', { description: error.message })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] rounded-full bg-emerald-600/5 blur-[150px] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="bg-neutral-900/40 backdrop-blur-3xl rounded-[3rem] p-10 border border-white/5 shadow-2xl shadow-black/50">
          <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-8">
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-[11px] font-black text-neutral-500 uppercase tracking-[0.2em] ml-1">
                  {isRegistering ? 'Confirmar RUT' : 'Identificación de Usuario'}
                </label>
                <div className="relative group">
                  <UserIcon className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-600 group-focus-within:text-emerald-500 transition-colors" />
                  <input 
                    type="text" 
                    value={rut}
                    onChange={e => setRut(e.target.value)}
                    placeholder="12345678-1"
                    disabled={isRegistering}
                    className="w-full bg-neutral-950/50 border-2 border-neutral-800 rounded-[2rem] pl-16 pr-6 py-6 text-2xl font-black text-white focus:outline-none focus:border-emerald-500/50 transition-all placeholder:text-neutral-800 tracking-tight disabled:opacity-50"
                  />
                </div>
              </div>

              {isRegistering && (
                <div className="space-y-6 animate-in slide-in-from-top-4 duration-500">
                  <div className="space-y-3">
                    <label className="text-[11px] font-black text-neutral-500 uppercase tracking-[0.2em] ml-1">Nombre Completo</label>
                    <input 
                      type="text" 
                      value={nombre}
                      onChange={e => setNombre(e.target.value)}
                      placeholder="Juan Pérez"
                      className="w-full bg-neutral-950/50 border-2 border-neutral-800 rounded-[1.5rem] px-6 py-5 text-lg font-bold text-white focus:outline-none focus:border-emerald-500/50 transition-all"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[11px] font-black text-neutral-500 uppercase tracking-[0.2em] ml-1">WhatsApp / Teléfono</label>
                    <div className="flex gap-2">
                      <div className="bg-neutral-950/50 border-2 border-neutral-800 rounded-[1.5rem] px-5 py-5 text-lg font-black text-emerald-500 flex items-center justify-center min-w-[80px]">
                        +569
                      </div>
                      <input 
                        type="tel" 
                        value={telefono}
                        onChange={e => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 8)
                          setTelefono(val)
                        }}
                        placeholder="12345678"
                        className="flex-1 bg-neutral-950/50 border-2 border-neutral-800 rounded-[1.5rem] px-6 py-5 text-lg font-bold text-white focus:outline-none focus:border-emerald-500/50 transition-all tracking-widest"
                      />
                    </div>
                    <p className="text-[9px] text-neutral-600 font-bold uppercase ml-4">Ingresa solo los 8 dígitos restantes</p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black py-6 rounded-[2rem] text-xl shadow-2xl shadow-emerald-500/20 flex items-center justify-center gap-3 transition-all disabled:opacity-50 active:scale-[0.98]"
              >
                {isLoading ? <Loader2 className="animate-spin" /> : (
                  <>
                    {isRegistering ? 'Crear mi Cuenta' : 'Entrar al Sistema'}
                    <ArrowRight className="w-6 h-6" />
                  </>
                )}
              </button>

              {isRegistering && (
                <button 
                  type="button"
                  onClick={() => setIsRegistering(false)}
                  className="w-full text-neutral-500 text-xs font-bold uppercase tracking-widest hover:text-white transition-colors py-2"
                >
                  Volver al Login
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="mt-10 text-center flex flex-col gap-4">
          <div className="flex items-center justify-center gap-6">
            <div className="flex items-center gap-2 text-xs font-bold text-neutral-600 uppercase tracking-widest">
              <ShieldCheck className="w-4 h-4 text-emerald-500/50" />
              {isRegistering ? 'Registro Seguro' : 'Acceso Seguro'}
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
