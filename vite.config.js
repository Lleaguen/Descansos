import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Cambiá 'Descansos' por el nombre exacto de tu repo en GitHub si es diferente
  base: '/Descansos/',
})
