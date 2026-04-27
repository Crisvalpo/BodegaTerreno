'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'
import Link from 'next/link'
import { 
  Users, Plus, Trash2, Loader2, ChevronLeft, 
  Search, QrCode, Download, Share2, User as UserIcon,
  Smartphone, Box, Edit, MessageCircle
} from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'

import { toPng } from 'html-to-image'

type Usuario = {
  id: string
  rut: string
  nombre: string
  telefono?: string
  created_at: string
}

export default function UsuariosAdminPage() {
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState<Usuario | null>(null)
  
  // Nuevo/Editar Usuario Modal
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newUser, setNewUser] = useState<Partial<Usuario>>({ rut: '', nombre: '', telefono: '+569' })
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    fetchUsuarios()
  }, [])

  async function fetchUsuarios() {
    setIsLoading(true)
    const { data } = await supabase.from('usuarios').select('*').order('nombre', { ascending: true })
    setUsuarios(data || [])
    setIsLoading(false)
  }

  const deleteUser = async (id: string) => {
    if (!confirm('¿Eliminar usuario? Se perderá su historial de registros.')) return
    const { error } = await supabase.from('usuarios').delete().eq('id', id)
    if (!error) {
      setUsuarios(usuarios.filter(u => u.id !== id))
      toast.success('Usuario eliminado')
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newUser.rut || !newUser.nombre) {
      toast.error('RUT y Nombre son obligatorios')
      return
    }

    const phoneDigits = (newUser.telefono || '').replace('+569', '')
    if (phoneDigits.length !== 8) {
      toast.error('El teléfono debe tener exactamente 8 dígitos (después del +569)')
      return
    }

    setIsSaving(true)
    
    let res;
    if (newUser.id) {
      res = await supabase
        .from('usuarios')
        .update({
          rut: newUser.rut,
          nombre: newUser.nombre,
          telefono: newUser.telefono
        })
        .eq('id', newUser.id)
        .select()
        .single()
    } else {
      res = await supabase
        .from('usuarios')
        .insert([newUser])
        .select()
        .single()
    }

    const { data, error } = res

    if (error) {
      toast.error('Error: ' + error.message)
    } else {
      if (newUser.id) {
        setUsuarios(usuarios.map(u => u.id === data.id ? data : u))
        toast.success('Usuario actualizado')
      } else {
        setUsuarios([...usuarios, data])
        toast.success('Usuario creado con éxito')
      }
      setIsModalOpen(false)
      setNewUser({ rut: '', nombre: '', telefono: '+569' })
    }
    setIsSaving(false)
  }

  const openEditModal = (user: Usuario) => {
    setNewUser(user)
    setIsModalOpen(true)
  }

  const shareCard = async (userName: string) => {
    const node = document.getElementById('user-card')
    if (!node) return
    
    try {
      const dataUrl = await toPng(node, { cacheBust: true, backgroundColor: '#0a0a0a' })
      const blob = await (await fetch(dataUrl)).blob()
      const file = new File([blob], `Tarjeta_${userName}.png`, { type: 'image/png' })

      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Tarjeta de Acceso Bodega',
          text: `Hola ${userName}, aquí tienes tu tarjeta de acceso.`
        })
      } else {
        // Fallback: Descargar si el navegador no soporta compartir archivos (ej: desktop)
        downloadCard(userName)
        toast.info('Compartir no soportado. Se ha descargado la imagen.')
      }
    } catch (err) {
      toast.error('Error al intentar compartir')
    }
  }

  const downloadCard = async (userName: string) => {
    const node = document.getElementById('user-card')
    if (!node) return
    
    try {
      const dataUrl = await toPng(node, { 
        cacheBust: true,
        backgroundColor: '#0a0a0a', // Forzar fondo oscuro para la captura
        style: {
          borderRadius: '2.5rem'
        }
      })
      const link = document.createElement('a')
      link.download = `Tarjeta_LukeAPP_${userName.replace(/\s+/g, '_')}.png`
      link.href = dataUrl
      link.click()
      toast.success('Tarjeta generada con éxito')
    } catch (err) {
      toast.error('Error al generar la imagen')
    }
  }

  const filtered = usuarios.filter(u => 
    u.nombre?.toLowerCase().includes(search.toLowerCase()) || 
    u.rut.includes(search)
  )

  return (
    <div className="min-h-screen bg-neutral-950 p-6 md:p-12 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />
      
      <div className="max-w-6xl mx-auto relative z-10">
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
          <div className="flex items-center gap-4">
            <Link href="/admin" className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white transition-colors">
              <ChevronLeft size={20} />
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <Users className="text-blue-400" />
                Maestro de Usuarios
              </h1>
              <p className="text-neutral-400 text-sm">Gestión de operarios y generación de tarjetas QR.</p>
            </div>
          </div>

          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-2xl font-black transition-all shadow-lg shadow-blue-600/20"
          >
            <Plus size={20} /> Nuevo Usuario
          </button>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* BUSCADOR Y LISTA */}
          <div className="lg:col-span-8 space-y-6">
            <div className="relative">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-neutral-600" />
              <input 
                type="text"
                placeholder="Buscar por nombre o RUT..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-neutral-900 border border-neutral-800 rounded-3xl pl-14 pr-6 py-5 text-white focus:border-blue-500 outline-none shadow-2xl"
              />
            </div>

            <div className="glass rounded-[2rem] border border-white/5 overflow-hidden shadow-2xl bg-white/[0.02]">
              {isLoading ? (
                <div className="p-24 flex flex-col items-center justify-center">
                  <Loader2 className="animate-spin text-blue-500 w-12 h-12 mb-4" />
                  <p className="text-neutral-500 font-medium">Cargando personal...</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-white/5 text-neutral-500 text-[10px] font-bold tracking-widest">
                      <tr>
                        <th className="px-6 py-6">Nombre del Trabajador</th>
                        <th className="px-6 py-6">RUT</th>
                        <th className="px-6 py-6">Teléfono</th>
                        <th className="px-6 py-6 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filtered.map(user => (
                        <tr key={user.id} className="hover:bg-white/5 transition-colors group">
                          <td className="px-6 py-5">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-400 font-bold">
                                {user.nombre?.charAt(0) || '?'}
                              </div>
                              <span className="font-bold text-white uppercase">{user.nombre || 'Sin Nombre'}</span>
                            </div>
                          </td>
                          <td className="px-6 py-5 text-neutral-400 font-mono">{user.rut}</td>
                          <td className="px-6 py-5">
                            {user.telefono ? (
                              <a 
                                href={`https://wa.me/${user.telefono.replace(/\+/g, '')}`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center w-10 h-10 bg-[#25D366]/10 text-[#25D366] rounded-xl hover:bg-[#25D366] hover:text-white transition-all border border-[#25D366]/20"
                                title="Abrir WhatsApp"
                              >
                                <MessageCircle size={18} />
                              </a>
                            ) : (
                              <span className="text-neutral-700 font-mono text-xs">--</span>
                            )}
                          </td>
                          <td className="px-6 py-5 text-right">
                            <div className="flex items-center justify-end gap-3">
                              <button 
                                onClick={() => openEditModal(user)}
                                className="p-2.5 bg-white/5 text-neutral-400 hover:text-white rounded-xl transition-all border border-white/5 hover:border-white/10"
                                title="Editar datos"
                              >
                                <Edit size={18} />
                              </button>
                              <button 
                                onClick={() => setSelectedUser(user)}
                                className="p-2.5 bg-blue-600/10 text-blue-400 rounded-xl hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center border border-blue-500/10 hover:border-blue-500/20"
                                title="Ver Tarjeta QR"
                              >
                                <QrCode size={18} />
                              </button>
                              <button 
                                onClick={() => deleteUser(user.id)} 
                                className="p-2.5 text-neutral-600 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* VISTA PREVIA TARJETA */}
          <div className="lg:col-span-4">
            {selectedUser ? (
              <div className="sticky top-8 space-y-6">
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-[2.5rem] blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                  
                  {/* CARD DESIGN */}
                  <div id="user-card" className="relative bg-neutral-900 border border-white/10 rounded-[2.5rem] p-10 flex flex-col items-center text-center shadow-2xl overflow-hidden min-h-[450px] justify-center">
                    {/* Sutil background decor */}
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                      <Box size={120} />
                    </div>
                    
                    <div className="mb-4">
                      <p className="text-[10px] font-bold text-neutral-600 tracking-[0.3em]">LukeAPP Bodega Terreno</p>
                    </div>

                    <div className="relative mb-8 group-hover:scale-105 transition-transform duration-500">
                      <div className="p-4 bg-white rounded-3xl shadow-[0_0_50px_rgba(59,130,246,0.2)]">
                        <QRCodeCanvas 
                          id="user-qr-canvas"
                          value={selectedUser.rut}
                          size={220}
                          level="H"
                          includeMargin={false}
                        />
                      </div>
                    </div>

                    <h2 className="text-2xl font-bold text-white tracking-tight mb-1">{selectedUser.nombre}</h2>
                    <p className="text-blue-400 font-mono font-bold tracking-widest text-sm mb-2">{selectedUser.rut}</p>
                    <p className="text-neutral-500 font-mono text-xs mb-8">{selectedUser.telefono || 'Sin teléfono'}</p>

                    <div className="w-full pt-6 border-t border-white/5 flex items-center justify-center gap-2">
                      <Box size={14} className="text-neutral-700" />
                      <span className="text-[10px] font-bold text-neutral-700 tracking-widest">Digital ID System</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => downloadCard(selectedUser.nombre)}
                    className="flex items-center justify-center gap-2 bg-white text-neutral-950 font-black py-4 rounded-2xl hover:bg-neutral-200 transition-all"
                  >
                    <Download size={18} /> Descargar
                  </button>
                  <button 
                    onClick={() => shareCard(selectedUser.nombre)}
                    className="flex items-center justify-center gap-2 bg-[#25D366] text-white font-black py-4 rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-[#25D366]/20"
                  >
                    <Share2 size={18} /> Enviar a WhatsApp
                  </button>
                </div>
                <p className="text-center text-xs text-neutral-600">Al descargar la imagen, puedes enviarla por WhatsApp para que el operario la guarde.</p>
              </div>
            ) : (
              <div className="glass rounded-[2.5rem] border border-white/5 p-12 text-center text-neutral-600 h-full flex flex-col items-center justify-center border-dashed">
                <UserIcon size={48} className="mb-4 opacity-10" />
                <p className="font-medium">Selecciona un usuario de la lista para generar su tarjeta digital.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL NUEVO USUARIO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-neutral-900 border border-white/10 w-full max-w-md rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col p-8">
            <h2 className="text-2xl font-bold text-white mb-6">{newUser.id ? 'Editar Trabajador' : 'Nuevo Trabajador'}</h2>
            
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-neutral-500 tracking-widest ml-2">RUT</label>
                <input 
                  type="text"
                  placeholder="12.345.678-9"
                  value={newUser.rut}
                  onChange={e => setNewUser({...newUser, rut: e.target.value})}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-4 text-white outline-none focus:border-blue-500 transition-colors"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-neutral-500 tracking-widest ml-2">Nombre Completo</label>
                <input 
                  type="text"
                  placeholder="Ej: Juan Perez"
                  value={newUser.nombre}
                  onChange={e => setNewUser({...newUser, nombre: e.target.value})}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-4 text-white outline-none focus:border-blue-500 transition-colors"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-bold text-neutral-500 tracking-widest ml-2">Teléfono</label>
                <div className="flex gap-2">
                  <div className="bg-neutral-800 px-4 py-4 rounded-xl text-[10px] font-bold text-neutral-500 flex items-center">+569</div>
                  <input 
                    type="tel"
                    maxLength={8}
                    placeholder="8 DÍGITOS"
                    value={(newUser.telefono || '').replace('+569', '')}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '').slice(0, 8);
                      setNewUser({...newUser, telefono: '+569' + val});
                    }}
                    className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-4 text-white outline-none focus:border-blue-500 transition-colors font-mono"
                  />
                </div>
              </div>

              <div className="flex gap-4 mt-8">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-6 py-4 rounded-xl text-neutral-500 font-bold hover:bg-white/5 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
                >
                  {isSaving ? <Loader2 className="animate-spin" size={20} /> : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
