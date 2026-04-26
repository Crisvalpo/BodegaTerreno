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
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 overflow-hidden relative">
      {/* Orbes de luz de fondo */}
      <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-emerald-600/10 blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] rounded-full bg-blue-600/5 blur-[100px]" />
      
      <div className="w-full max-w-md relative z-10 animate-in fade-in zoom-in duration-700">
        <div className="bg-neutral-900/40 backdrop-blur-3xl rounded-[3.5rem] p-12 border border-white/10 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.8)]">
          <div className="flex flex-col items-center mb-10 text-center">
            <div className="w-20 h-20 bg-emerald-500/10 rounded-[2rem] border border-emerald-500/20 flex items-center justify-center mb-6 shadow-inner">
              <ShieldCheck className="w-10 h-10 text-emerald-500" />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tighter mb-2 italic">BODEGA TERRENO</h1>
            <p className="text-neutral-500 text-xs font-bold uppercase tracking-[0.3em]">Acceso de Personal</p>
          </div>

          <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-10">
            <div className="space-y-8">
              <div className="space-y-4">
                <label className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.25em] ml-2">
                  {isRegistering ? 'Confirmar RUT' : 'Identificación'}
                </label>
                <div className="relative group">
                  <UserIcon className="absolute left-7 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-700 group-focus-within:text-emerald-500 transition-all duration-300" />
                  <input 
                    type="text" 
                    value={rut}
                    onChange={e => setRut(e.target.value.replace(/\./g, ''))}
                    placeholder="12345678-1"
                    disabled={isRegistering}
                    className="w-full bg-black/40 border-2 border-white/5 rounded-[2.2rem] pl-16 pr-8 py-7 text-2xl font-black text-white focus:outline-none focus:border-emerald-500/40 focus:bg-black/60 transition-all placeholder:text-neutral-800 tracking-tight disabled:opacity-50 shadow-inner"
                  />
                </div>
              </div>

              {isRegistering && (
                <div className="space-y-8 animate-in slide-in-from-bottom-6 duration-700">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.25em] ml-2">Nombre Completo</label>
                    <input 
                      type="text" 
                      value={nombre}
                      onChange={e => setNombre(e.target.value)}
                      placeholder="Nombre y Apellido"
                      className="w-full bg-black/40 border-2 border-white/5 rounded-[1.8rem] px-8 py-6 text-xl font-bold text-white focus:outline-none focus:border-emerald-500/40 focus:bg-black/60 transition-all placeholder:text-neutral-800"
                    />
                  </div>
                  
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-neutral-600 uppercase tracking-[0.25em] ml-2">WhatsApp / Teléfono</label>
                    <div className="flex gap-3">
                      <div className="bg-black/60 border-2 border-white/5 rounded-[1.8rem] px-6 py-6 text-xl font-black text-emerald-500 flex items-center justify-center min-w-[90px] shadow-inner">
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
                        className="flex-1 bg-black/40 border-2 border-white/5 rounded-[1.8rem] px-8 py-6 text-xl font-bold text-white focus:outline-none focus:border-emerald-500/40 focus:bg-black/60 transition-all tracking-[0.2em]"
                      />
                    </div>
                    <p className="text-[9px] text-neutral-700 font-bold uppercase ml-6 tracking-widest">Ingresa 8 dígitos</p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-6 pt-4">
              <button 
                type="submit"
                disabled={isLoading}
                className="w-full bg-emerald-500 hover:bg-emerald-400 text-neutral-950 font-black py-7 rounded-[2.2rem] text-xl shadow-[0_20px_40px_-10px_rgba(16,185,129,0.3)] flex items-center justify-center gap-4 transition-all duration-300 disabled:opacity-50 active:scale-[0.97] group"
              >
                {isLoading ? <Loader2 className="animate-spin w-8 h-8" /> : (
                  <>
                    <span className="tracking-tight">{isRegistering ? 'CREAR CUENTA' : 'INGRESAR'}</span>
                    <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>

              {isRegistering ? (
                <button 
                  type="button"
                  onClick={() => setIsRegistering(false)}
                  className="w-full py-4 text-neutral-500 hover:text-white text-[10px] font-black uppercase tracking-[0.3em] transition-colors"
                >
                  Volver al Login
                </button>
              ) : (
                <div className="pt-6 border-t border-white/5 flex flex-col items-center gap-6">
                  <div className="flex items-center gap-3 text-neutral-600">
                    <ShieldCheck size={16} className="text-emerald-500/30" />
                    <span className="text-[9px] font-black uppercase tracking-[0.3em]">Registro Seguro de Obras</span>
                  </div>
                  <p className="text-[8px] text-neutral-700 font-bold uppercase text-center leading-loose tracking-[0.2em]">
                    Desarrollado para Control de Obras Piping<br/>
                    <span className="text-emerald-500/20">V 2.0 Premium Edition</span>
                  </p>
                </div>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
