import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import App from './App.jsx';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1
    }
  }
});

// Tentative silencieuse d'apprentissage IP du serveur backend pour QR Codes
try {
  const hostname = window.location.hostname;
  const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
  const apiBase = isLocal ? `${window.API_BASE_URL}` : `http://${hostname}:5000`;

  fetch(`${apiBase}/api/server-ip`)
    .then(res => (res && res.ok) ? res.json() : null)
    .then(data => {
      if (data && data.ip) {
        localStorage.setItem('cmu-server-ip', data.ip);
      }
    })
    .catch(() => {});
} catch (e) {}

// Purge du service worker de dev obsolète : les anciens caches servaient une
// version périmée de l'application (les corrections semblaient « ne rien
// changer »). Uniquement en dev — le mode hors-ligne PWA reste intact en prod.
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  (async () => {
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
      if (window.caches) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch (e) { /* silencieux */ }
  })();
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>
);
