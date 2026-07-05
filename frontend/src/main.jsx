import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { getAccessToken } from './lib/auth'
import { refreshAuthToken, setAuthToken } from './lib/api'
import '@fontsource/plus-jakarta-sans/index.css'
import './index.css'

setAuthToken(getAccessToken())
refreshAuthToken()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
