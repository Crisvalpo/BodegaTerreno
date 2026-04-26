'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'
import { Container, ShieldCheck, User as UserIcon, Loader2, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { cleanRut, formatRut, validateRut } from '@/lib/rutUtils'
import Cookies from 'js-cookie'

export default function LoginPage() {
  const [rut, setRut] = useState('')
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleBlur = () => {
    if (rut) setRut(formatRut(rut))
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rut) return toast.error('Ingresa tu RUT')
    
    setIsLoading(true)
    try {
      const cleaned = cleanRut(rut)
      const formatted = formatRut(cleaned)
      
      const { data: user, error } = await supabase
        .from('usuarios')
        .select('*')
        .or(`rut.eq.${cleaned},rut.eq.${formatted}`)
        .maybeSingle()

      if (error) throw error

      if (!user) {
        toast.info('RUT no encontrado. Completa los datos para el registro técnico.')
        setRut(formatted) // Asegurar que el registro use el formato con guión
        setIsRegistering(true)
        return
      }

      Cookies.set('user', JSON.stringify(user), { expires: 7 })
      localStorage.setItem('bodega_user', JSON.stringify(user))
      toast.success(`Sistema validado: ${user.nombre}`)
      router.push('/')
      
    } catch (error: any) {
      toast.error('Falla en la autenticación', { description: error.message })
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nombre || !telefono) return toast.error('Parámetros incompletos')
    
    setIsLoading(true)
    try {
      const { data: newUser, error } = await supabase
        .from('usuarios')
        .insert({
          rut,
          nombre: nombre.toUpperCase(),
          telefono: `+569${telefono}`,
          rol: 'terreno'
        })
        .select()
        .single()

      if (error) throw error

      Cookies.set('user', JSON.stringify(newUser), { expires: 7 })
      localStorage.setItem('bodega_user', JSON.stringify(newUser))
      toast.success('Usuario registrado en el nodo central.')
      router.push('/')

    } catch (error: any) {
      toast.error('Error en el registro', { description: error.message })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#050505] flex justify-center selection:bg-emerald-500/30">
      
      {/* Contenedor Fijo de App Móvil */}
      <div className="w-full max-w-md bg-[#0a0a0a] min-h-screen border-x border-neutral-900 shadow-2xl flex flex-col items-center justify-center p-8 relative">
        
        <div className="w-full animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="flex flex-col items-center mb-12">
            <div className="w-16 h-16 bg-black border border-neutral-800 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
              <Container className="w-8 h-8 text-emerald-500" />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tighter uppercase italic leading-none">Acceso</h1>
            <p className="text-neutral-700 text-[10px] font-black uppercase tracking-[0.4em] mt-2">Bodega Terreno Piping</p>
          </div>

          <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-8">
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest ml-1 italic">
                  {isRegistering ? 'Confirmar ID' : 'Identificación'}
                </label>
                <div className="relative group">
                  <UserIcon className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-800 group-focus-within:text-emerald-500 transition-colors" />
                  <input 
                    type="text" 
                    value={rut}
                    onChange={e => setRut(e.target.value.replace(/\./g, ''))}
                    onBlur={handleBlur}
                    placeholder="12345678-1"
                    disabled={isRegistering}
                    className="w-full bg-black border border-neutral-800 rounded-xl pl-12 pr-6 py-5 text-xl font-mono text-emerald-500 focus:outline-none focus:border-emerald-500/50 transition-all placeholder:text-neutral-900 tracking-tighter disabled:opacity-50"
                  />
                </div>
              </div>

              {isRegistering && (
                <div className="space-y-6 animate-in slide-in-from-top-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest ml-1 italic">Nombre Completo</label>
                    <input 
                      type="text" 
                      value={nombre}
                      onChange={e => setNombre(e.target.value)}
                      placeholder="Nombre Apellido"
                      className="w-full bg-black border border-neutral-800 rounded-xl px-6 py-4 text-sm font-bold text-white focus:outline-none focus:border-emerald-500/50 uppercase"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-neutral-600 uppercase tracking-widest ml-1 italic">WhatsApp (+569)</label>
                    <div className="flex gap-2">
                      <div className="bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-4 text-xs font-black text-neutral-500 flex items-center">
                        +569
                      </div>
                      <input 
                        type="tel" 
                        value={telefono}
                        onChange={e => setTelefono(e.target.value.replace(/\D/g, '').slice(0, 8))}
                        placeholder="12345678"
                        className="flex-1 bg-black border border-neutral-800 rounded-xl px-6 py-4 text-sm font-mono text-white focus:outline-none focus:border-emerald-500/50 tracking-widest"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <button 
                type="submit"
                disabled={isLoading || !validateRut(rut)}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-black font-black py-5 rounded-lg text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-3 shadow-lg shadow-emerald-900/10 disabled:opacity-20 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                {isLoading ? <Loader2 className="animate-spin w-5 h-5" /> : (
                  <>
                    <span>{isRegistering ? 'Registrar' : 'Ingresar'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>

              {isRegistering && (
                <button 
                  type="button"
                  onClick={() => setIsRegistering(false)}
                  className="w-full py-2 text-neutral-700 hover:text-white text-[9px] font-black uppercase tracking-widest transition-colors"
                >
                  Volver al Inicio
                </button>
              )}
            </div>
          </form>

          <div className="mt-12 pt-10 border-t border-neutral-900 flex flex-col items-center gap-4 text-center">
            <div className="flex items-center gap-2 text-neutral-800">
              <ShieldCheck size={14} />
              <span className="text-[9px] font-black uppercase tracking-widest">Acceso Protegido</span>
            </div>
            <p className="text-[9px] text-neutral-800 font-bold uppercase tracking-[0.3em]">
              Control de Obras Piping
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
