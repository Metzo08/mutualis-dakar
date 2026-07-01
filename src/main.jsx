import { refreshAccessToken } from './utils/api';

// --- CONSOLE DIAGNOSTIQUE GLOBALE POUR MUTUALIS ---
const diagnosticLogs = [];
const logListeners = [];
function addLog(type, text) {
  const log = { id: Date.now() + Math.random(), type, text, time: new Date().toLocaleTimeString() };
  diagnosticLogs.push(log);
  if (diagnosticLogs.length > 100) diagnosticLogs.shift();
  logListeners.forEach(listener => listener([...diagnosticLogs]));
}
window.addLog = addLog;

// Ecouteurs d'erreurs
window.onerror = function (message, source, lineno, colno, error) {
  addLog('ERROR', `Exception JS: ${message} (${source}:${lineno})`);
};
window.addEventListener('unhandledrejection', function (event) {
  addLog('ERROR', `Promesse rejetée: ${event.reason}`);
});

// Interception console.error
const originalConsoleError = console.error;
console.error = function (...args) {
  addLog('ERROR', `console.error: ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')}`);
  originalConsoleError.apply(console, args);
};

// UI Console de diagnostic
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const consoleDiv = document.createElement('div');
    consoleDiv.id = 'diag-console-root';
    consoleDiv.style.position = 'fixed';
    consoleDiv.style.bottom = '10px';
    consoleDiv.style.left = '10px';
    consoleDiv.style.zIndex = '999999';
    consoleDiv.style.fontFamily = 'monospace';
    consoleDiv.style.fontSize = '11px';
    document.body.appendChild(consoleDiv);

    consoleDiv.innerHTML = `
      <button id="diag-toggle-btn" style="
        background: #0f172a;
        color: #38bdf8;
        border: 1px solid #334155;
        padding: 6px 10px;
        border-radius: 6px;
        cursor: pointer;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        font-weight: bold;
      ">🛠️ Diagnostics</button>
      <div id="diag-panel" style="
        display: none;
        width: 480px;
        height: 280px;
        background: rgba(15, 23, 42, 0.95);
        backdrop-filter: blur(8px);
        border: 1px solid #334155;
        border-radius: 10px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.6);
        flex-direction: column;
        margin-top: 6px;
        overflow: hidden;
      ">
        <div style="padding: 6px 10px; background: #1e293b; border-bottom: 1px solid #334155; display: flex; justify-content: space-between; align-items: center; color: #fff;">
          <span style="color: #38bdf8; font-weight: bold;">HUD Diagnostic - MUTUALIS DAKAR</span>
          <button id="diag-clear-btn" style="background: transparent; border: none; color: #94a3b8; cursor: pointer; font-size: 11px;">Effacer</button>
        </div>
        <div id="diag-logs-container" style="flex: 1; padding: 8px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; background: #0b0f19;"></div>
      </div>
    `;

    const toggleBtn = consoleDiv.querySelector('#diag-toggle-btn');
    const panel = consoleDiv.querySelector('#diag-panel');
    const clearBtn = consoleDiv.querySelector('#diag-clear-btn');
    const logsContainer = consoleDiv.querySelector('#diag-logs-container');

    toggleBtn.addEventListener('click', () => {
      panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
    });
    clearBtn.addEventListener('click', () => {
      diagnosticLogs.length = 0;
      updateLogsView();
    });

    function updateLogsView() {
      logsContainer.innerHTML = diagnosticLogs.map(log => {
        let color = '#cbd5e1';
        if (log.type === 'SUCCESS') color = '#4ade80';
        if (log.type === 'ERROR') color = '#f87171';
        if (log.type === 'WARN') color = '#fbbf24';
        if (log.type === 'INFO') color = '#38bdf8';
        return `<div style="color: ${color}; border-bottom: 1px solid #1e293b; padding-bottom: 2px; text-align: left; line-height: 1.3;">
          <span style="color: #64748b;">[${log.time}]</span> ${log.text}
        </div>`;
      }).join('');
      logsContainer.scrollTop = logsContainer.scrollHeight;
    }

    logListeners.push(updateLogsView);
    addLog('INFO', 'Console de diagnostic activée. Prête à intercepter les requêtes.');
  });
}
// ----------------------------------------------------

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

  // Logger le départ de la requête
  const method = options.method || 'GET';
  addLog('INFO', `Requête : ${method} -> ${url}`);

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
    if (res.ok) {
      addLog('SUCCESS', `Succès [${res.status}]: ${method} -> ${url}`);
    } else {
      addLog('WARN', `Échec [${res.status}]: ${method} -> ${url}`);
    }
  } catch (err) {
    addLog('ERROR', `Réseau KO: ${method} -> ${url} (${err.message})`);
    throw err;
  }

  // Si 401 Unauthorized et qu'un refresh token est stocké, on tente le renouvellement transparent
  if (res.status === 401 && typeof url === 'string' && (url.includes('/api/') || url.includes('/api/auth/')) && localStorage.getItem('cmu-refresh-token')) {
    addLog('INFO', 'Session expirée (401). Tentative de renouvellement du token...');
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      addLog('SUCCESS', 'Token renouvelé ! Re-tentative de la requête...');
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
      if (res.ok) {
        addLog('SUCCESS', `Succès après refresh [${res.status}]: ${method} -> ${url}`);
      } else {
        addLog('ERROR', `Échec après refresh [${res.status}]: ${method} -> ${url}`);
      }
    } else {
      addLog('ERROR', 'Session expirée et impossible à rafraîchir. Déconnexion...');
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
