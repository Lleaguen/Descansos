import { useEffect, useRef, useState } from 'react'

/**
 * Hook que gestiona el listener de teclado del scanner de DNI.
 * El listener se monta una sola vez y nunca se recrea.
 * procesarScanRef debe ser un ref que apunte a la función procesarScan actualizada.
 */
export function useScanner(procesarScanRef) {
  const bufferRef = useRef('')
  const timerRef  = useRef(null)
  const [buffer, setBuffer] = useState('')

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        const datos = bufferRef.current
        bufferRef.current = ''
        setBuffer('')
        clearTimeout(timerRef.current)
        if (datos.length > 10) procesarScanRef.current(datos)
        return
      }
      if (e.key.length > 1) return
      bufferRef.current += e.key
      setBuffer(bufferRef.current)
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => { bufferRef.current = ''; setBuffer('') }, 100)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, []) // sin dependencias: el listener se monta una sola vez y nunca se recrea

  return { buffer }
}
