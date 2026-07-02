import { useState, useEffect, useRef } from 'react'
import { obtenerAutorizados } from '../services/api.js'

/**
 * Hook que gestiona la lista de autorizados.
 * - Carga inicial: se obtiene la primera carga junto al montaje del componente padre.
 * - Polling: refresca la lista cada 5 segundos para captar nuevas autorizaciones.
 * Retorna autorizados (array de DNIs | null), autorizadosRef (para acceso síncrono desde listeners)
 * y setAutorizados (para que la carga inicial pueda actualizar el estado).
 */
export function useAutorizados() {
  // null = todavía no terminó la primera carga
  const [autorizados, setAutorizados] = useState(null)
  const autorizadosRef = useRef(null)

  // Sincronizar ref con state en cada render
  autorizadosRef.current = autorizados

  // Polling cada 5 segundos
  useEffect(() => {
    const intervalo = setInterval(() => {
      obtenerAutorizados()
        .then((data) => {
          if (Array.isArray(data)) {
            const dnisActualizados = data.map((a) => String(a.dni).trim())
            setAutorizados(dnisActualizados)
          }
        })
        .catch(() => {}) // fallo silencioso
    }, 5000)
    return () => clearInterval(intervalo)
  }, [])

  return { autorizados, setAutorizados, autorizadosRef }
}
