/**
 * Utilidades de normalización de RUT para el sistema de Bodega Terreno.
 */

/**
 * Limpia el RUT de puntos, guiones y espacios.
 * @param rut RUT sucio (ej: "15.717.681-1" o "157176811")
 * @returns RUT limpio (ej: "157176811")
 */
export const cleanRut = (rut: string): string => {
  if (!rut) return ''
  return rut.replace(/[^0-9kK]/g, '').toUpperCase()
}

/**
 * Valida si el RUT tiene un largo correcto (8 o 9 dígitos).
 * @param rut RUT limpio o sucio
 * @returns booleano indicando si es válido
 */
export const validateRut = (rut: string): boolean => {
  const clean = cleanRut(rut)
  return clean.length >= 8 && clean.length <= 9
}

/**
 * Formatea un RUT con guion antes del dígito verificador.
 * @param rut RUT limpio o sucio
 * @returns RUT formateado (ej: "15717681-1")
 */
export function formatRut(rut: string): string {
  const cleaned = cleanRut(rut)
  if (cleaned.length < 2) return cleaned
  
  const body = cleaned.slice(0, -1)
  const dv = cleaned.slice(-1)
  return `${body}-${dv}`
}

/**
 * Extrae el RUT de un escaneo de cédula (URL o texto plano).
 */
export function parseRutFromScan(input: string): string {
  // Patrones de URL de Registro Civil
  const runMatch = input.match(/RUN=([\dkK.-]+)/i)
  if (runMatch) return cleanRut(runMatch[1])

  const urlMatch = input.match(/RUT=(\d+)/i) || input.match(/P4_RUT,P4_DV:(\d+),([\dkK])/i)
  if (urlMatch) {
    if (urlMatch[2]) return cleanRut(`${urlMatch[1]}${urlMatch[2]}`)
    return cleanRut(urlMatch[1])
  }

  // Patrón estándar en texto
  const rutMatch = input.match(/(\d{1,2}\.?\d{3}\.?\d{3}-?[\dkK])/i)
  if (rutMatch) return cleanRut(rutMatch[0])

  return cleanRut(input)
}
