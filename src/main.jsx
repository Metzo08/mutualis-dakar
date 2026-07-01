import { refreshAccessToken } from './utils/api';

const originalFetch = window.fetch;
window.fetch = async function (input, init) {
  let url = input;
  let options = init || {};

  // Rediriger les requêtes vers l'adresse du serveur d'API configurée ou détectée
  if (typeof url === 'string' && url.startsWith('http://localhost:5000')) {
    const configApiUrl = import.meta.env.VITE_API_URL;
    if (configApiUrl) {
      url = url.replace('http://localhost:5000', configApiUrl);
    } else {
      const host = window.location.hostname;
      const apiHost = (host === 'localhost' || host === '127.0.0.1') ? 'localhost' : host;
      url = url.replace('localhost', apiHost);
    }
  }

  // Injecter automatiquement le header Authorization si un token est présent en localStorage
  const token = localStorage.getItem('cmu-token');
  if (token && typeof url === 'string' && (url.includes('/api/') || url.includes('/api/auth/'))) {
    options.headers = options.headers || {};
    if (options.headers instanceof Headers) {
      if (!options.headers.has('Authorization')) {
        options.headers.set('Authorization', `Bearer ${token}`);
      }
    } else if (Array.isArray(options.headers)) {
      const hasAuth = options.headers.some(h => h[0].toLowerCase() === 'authorization');
      if (!hasAuth) {
        options.headers.push(['Authorization', `Bearer ${token}`]);
      }
    } else {
      if (!options.headers['Authorization'] && !options.headers['authorization']) {
        options.headers['Authorization'] = `Bearer ${token}`;
      }
    }
  }

  let res;
  try {
    res = await originalFetch.call(this, url, options);
  } catch (err) {
    throw err;
  }

  // Si 401 Unauthorized et qu'un refresh token est stocké, on tente le renouvellement transparent
  if (res.status === 401 && typeof url === 'string' && (url.includes('/api/') || url.includes('/api/auth/')) && localStorage.getItem('cmu-refresh-token')) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      const newToken = localStorage.getItem('cmu-token');
      if (options.headers) {
        if (options.headers instanceof Headers) {
          options.headers.set('Authorization', `Bearer ${newToken}`);
        } else if (Array.isArray(options.headers)) {
          const idx = options.headers.findIndex(h => h[0].toLowerCase() === 'authorization');
          if (idx !== -1) {
            options.headers[idx] = ['Authorization', `Bearer ${newToken}`];
          } else {
            options.headers.push(['Authorization', `Bearer ${newToken}`]);
          }
        } else {
          options.headers['Authorization'] = `Bearer ${newToken}`;
        }
      }
      res = await originalFetch.call(this, url, options);
    } else {
      window.dispatchEvent(new CustomEvent('cmu-session-expired'));
    }
  }

  return res;
};

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.jsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // Cache content stays fresh for 5 minutes
      gcTime: 10 * 60 * 1000, // Cache gcTime is 10 minutes
      refetchOnWindowFocus: false, // Prevent refetching when toggling browser window focus
      retry: 1 // Limit failed query retries
    }
  }
});

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
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
