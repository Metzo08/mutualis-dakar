import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isValidLanIp,
  getCachedLanIp,
  detectLanIp,
  clearLanIpCache,
  rememberLanIp
} from '../utils/lanIp';

/**
 * Un QR code de carte CSU encode une URL que le patient scanne depuis son
 * téléphone : elle doit pointer vers le PC, sur le réseau Wi-Fi du cabinet.
 * L'IP du PC change dès qu'il rejoint un autre réseau — aucune adresse ne
 * doit donc être figée dans le code : on interroge le backend, et à défaut
 * on ne renvoie rien (l'agent saisit son IP) plutôt qu'une adresse fausse.
 */
describe('Détection de l\'IP LAN pour les QR codes', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('isValidLanIp', () => {
    it('accepte les plages privées joignables depuis un smartphone', () => {
      expect(isValidLanIp('192.168.1.100')).toBe(true);
      expect(isValidLanIp('10.0.0.5')).toBe(true);
      expect(isValidLanIp('172.16.4.9')).toBe(true);
    });

    it('refuse les adresses non joignables ou mal formées', () => {
      expect(isValidLanIp('localhost')).toBe(false);
      expect(isValidLanIp('127.0.0.1')).toBe(false);
      expect(isValidLanIp('0.0.0.0')).toBe(false);
      expect(isValidLanIp('8.8.8.8')).toBe(false);      // publique : hors LAN
      expect(isValidLanIp('172.32.0.1')).toBe(false);   // hors 172.16-172.31
      expect(isValidLanIp('192.168.1.999')).toBe(false);
      expect(isValidLanIp('192.168.1')).toBe(false);
      expect(isValidLanIp('')).toBe(false);
      expect(isValidLanIp(null)).toBe(false);
      expect(isValidLanIp(undefined)).toBe(false);
    });
  });

  describe('getCachedLanIp', () => {
    it('ne renvoie aucune IP plutôt qu\'une adresse inventée', () => {
      // Régression : la fonction retournait en dur '192.168.1.42', ce qui
      // encodait dans le QR une IP inexistante sur le réseau du cabinet.
      expect(getCachedLanIp()).toBeNull();
    });

    it('ignore une IP périmée (plus d\'une heure)', () => {
      localStorage.setItem(
        'cmu-lan-ip-detected',
        JSON.stringify({ ip: '192.168.1.100', ts: Date.now() - 2 * 60 * 60 * 1000 })
      );
      expect(getCachedLanIp()).toBeNull();
    });

    it('ignore une IP mémorisée qui n\'est pas une adresse privée', () => {
      localStorage.setItem(
        'cmu-lan-ip-detected',
        JSON.stringify({ ip: 'localhost', ts: Date.now() })
      );
      expect(getCachedLanIp()).toBeNull();
    });
  });

  describe('detectLanIp', () => {
    it('interroge le backend et mémorise l\'IP détectée', async () => {
      const fetchMock = vi.fn().mockResolvedValue({
        json: async () => ({ ip: '192.168.1.100' })
      });
      vi.stubGlobal('fetch', fetchMock);

      const ip = await detectLanIp();

      expect(ip).toBe('192.168.1.100');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(String(fetchMock.mock.calls[0][0])).toContain('/api/lan-ip');
      expect(getCachedLanIp()).toBe('192.168.1.100');
    });

    it('force une nouvelle lecture du backend après un changement de réseau', async () => {
      localStorage.setItem(
        'cmu-lan-ip-detected',
        JSON.stringify({ ip: '192.168.1.42', ts: Date.now() })
      );
      const fetchMock = vi.fn().mockResolvedValue({
        json: async () => ({ ip: '192.168.1.100' })
      });
      vi.stubGlobal('fetch', fetchMock);

      const ip = await detectLanIp({ force: true });

      expect(ip).toBe('192.168.1.100');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('reste silencieux quand le backend est injoignable', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
      await expect(detectLanIp()).resolves.toBeNull();
    });

    it('rejette une réponse backend sans adresse exploitable', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        json: async () => ({ ip: null })
      }));
      await expect(detectLanIp()).resolves.toBeNull();
      expect(getCachedLanIp()).toBeNull();
    });
  });

  describe('mémorisation', () => {
    it('mémorise la même IP sous toutes les clés lues par l\'application', () => {
      rememberLanIp('192.168.1.100');
      expect(localStorage.getItem('cmu-lan-ip-detected')).toContain('192.168.1.100');
      expect(localStorage.getItem('cmu-wifi-ip')).toBe('192.168.1.100');
      expect(localStorage.getItem('cmu-server-ip')).toBe('192.168.1.100');
    });

    it('clearLanIpCache efface les trois clés', () => {
      rememberLanIp('192.168.1.100');
      clearLanIpCache();
      expect(localStorage.getItem('cmu-lan-ip-detected')).toBeNull();
      expect(localStorage.getItem('cmu-wifi-ip')).toBeNull();
      expect(localStorage.getItem('cmu-server-ip')).toBeNull();
    });
  });
});