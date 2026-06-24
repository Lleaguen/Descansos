import React from 'react'
import ReactDOM from 'react-dom/client'
import { useState } from 'react'
import App from './App.jsx'
import Supervisor from './Supervisor.jsx'
import PantallaRol from './PantallaRol.jsx'
import './index.css'

function Root() {
  const [rol, setRol] = useState(null) // null | 'implant' | 'supervisor'

  if (!rol) return <PantallaRol onSeleccion={setRol} />
  if (rol === 'supervisor') return <Supervisor onCambiarRol={() => setRol(null)} />
  return <App onCambiarRol={() => setRol(null)} />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
