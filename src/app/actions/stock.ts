'use server'

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function getStockAction() {
  try {
    const { data, error } = await supabase
      .from('existencias')
      .select(`
        id,
        cantidad,
        cantidad_reservada,
        materiales (ident_code, descripcion, part_group),
        ubicaciones (zona, rack, nivel)
      `)
    
    if (error) throw error
    return { success: true, data }
  } catch (error: any) {
    console.error('Error en getStockAction:', error)
    return { success: false, error: error.message }
  }
}

export async function searchOrdersByRutAction(rut: string) {
  try {
    const cleanRut = rut.replace(/[\.-]/g, '').trim()
    const pureRut = cleanRut.length > 1 ? cleanRut.slice(0, -1) : cleanRut
    
    // 1. Buscar pedidos
    const { data: pedidos, error: pError } = await supabase
      .from('pedidos')
      .select(`
        id, estado, created_at,
        usuarios!inner(id, rut, nombre),
        isometricos(codigo),
        pedido_items(
          id, cantidad_solicitada,
          materiales(
            id, ident_code, descripcion,
            existencias(id, cantidad, ubicacion_id, ubicaciones(zona, rack, nivel))
          )
        )
      `)
      .or(`rut.eq.${rut},rut.ilike.${cleanRut}%,rut.ilike.${pureRut}%`, { foreignTable: 'usuarios' })
      .in('estado', ['pendiente', 'picking', 'listo'])
      .order('created_at', { ascending: true })

    if (pError) throw pError

    // 2. Si no hay pedidos, buscar el usuario para modo directo
    let user = null
    if (pedidos.length === 0) {
      const { data: userData } = await supabase
        .from('usuarios')
        .select('*')
        .or(`rut.eq.${rut},rut.ilike.${cleanRut}%,rut.ilike.${pureRut}%`)
        .maybeSingle()
      user = userData
    }

    return { success: true, pedidos, user }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}
