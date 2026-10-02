import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './index.css';
import App from './App.jsx';
import { isValidLanIp, rememberLanIp } from './utils/lanIp';

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

// Apprentissage silencieux de l'IP LAN du PC (QR codes des cartes CSU).
// Tant que le backend n'a pas répondu, src/utils/lanIp.js interroge
// lui-même /api/lan-ip — cette requête est donc un simple préchauffage.
try {
  const apiBase = (typeof window !== 'undefined' && window.API_BASE_URL) || '';

  fetch(`${apiBase}/api/lan-ip`)
    .then(res => (res && res.ok) ? res.json() : null)
    .then(data => {
      // On n'écrit que si le backend renvoie une vraie adresse : y mettre
      // 'localhost' ou null produirait un QR illisible sur le téléphone.
      if (data && isValidLanIp(data.ip)) {
        rememberLanIp(data.ip);
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
