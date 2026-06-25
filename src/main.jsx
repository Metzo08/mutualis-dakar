// Intercepteur global fetch pour rediriger les requêtes vers l'adresse du serveur d'API
const originalFetch = window.fetch;
window.fetch = function (input, init) {
  if (typeof input === 'string' && input.startsWith('http://localhost:5000')) {
    const configApiUrl = import.meta.env.VITE_API_URL;
    if (configApiUrl) {
      input = input.replace('http://localhost:5000', configApiUrl);
    } else {
      const host = window.location.hostname;
      const apiHost = (host === 'localhost' || host === '127.0.0.1') ? 'localhost' : host;
      input = input.replace('localhost', apiHost);
    }
  }
  return originalFetch.call(this, input, init);
};

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Récupère l'IP du serveur pour la génération de QR codes valides sur le réseau local
window.fetch('http://localhost:5000/api/server-ip')
  .then(res => res.json())
  .then(data => {
    if (data && data.ip) {
      localStorage.setItem('cmu-server-ip', data.ip);
    }
  })
  .catch(() => {});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
