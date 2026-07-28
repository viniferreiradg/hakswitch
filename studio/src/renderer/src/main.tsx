import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

// Sem isso, um drag que solta fora exatamente da caixinha de import (por
// pouco que seja) cai no comportamento padrão do Chromium/Electron, que é
// tentar navegar a janela pra abrir o arquivo solto - o drop nem chega no
// onDrop do React, e o app parece simplesmente ignorar o arraste.
window.addEventListener('dragover', (event) => event.preventDefault())
window.addEventListener('drop', (event) => event.preventDefault())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
