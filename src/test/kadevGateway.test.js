import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// Les variables d'environnement sont lues au chargement du module :
// on les positionne AVANT le require pour tester le routage par MSD.
process.env.KADEV_PUBLIC_KEY = 'kdvp_live_public_test';
process.env.KADEV_SECRET_AGG = 'secret-agg';
process.env.KADEV_SECRET_DKR = 'secret-dkr';
process.env.KADEV_PUBLIC_DKR = 'kdvp_live_dkr';

const kadev = require('../../backend/kadevGateway');

describe('Passerelle Kadev — clés et secrets par MSD', () => {
  it('considère l\'agrégateur configuré quand ses deux clés sont présentes', () => {
    expect(kadev.isAggregatorConfigured()).toBe(true);
  });

  it('isole le secret de chaque MSD', () => {
    expect(kadev.resolveUnionSecret('DKR')).toBe('secret-dkr');
    expect(kadev.resolveUnionSecret('AGG')).toBe('secret-agg');
  });

  it('retombe sur le secret de l\'agrégateur pour une MSD sans compte', () => {
    expect(kadev.resolveUnionSecret('DRB')).toBe('');
  });

  it('ne renvoie pas de clé publique pour une MSD inconnue', () => {
    // Pas de fuite de la clé d'une autre MSD.
    expect(kadev.resolveUnionPublicKey('DRB')).toBe('kdvp_live_public_test');
    expect(kadev.resolveUnionPublicKey('DKR')).toBe('kdvp_live_dkr');
  });

  it('normalise le code d\'union (casse et séparateurs)', () => {
    expect(kadev.resolveUnionPublicKey('dkr')).toBe('kdvp_live_dkr');
  });
});

describe('Passerelle Kadev — répartition des fonds', () => {
  it('ne prélève rien sans commission', () => {
    expect(kadev.splitAmount(10000, 0)).toEqual({ gross: 10000, platformFee: 0, net: 10000 });
  });

  it('sépare commission plateforme et reversement MSD', () => {
    // 1 % de 10 000 = 100 FCFA pour la plateforme, 9 900 pour la MSD.
    const r = kadev.splitAmount(10000, 100);
    expect(r.gross).toBe(10000);
    expect(r.platformFee).toBe(100);
    expect(r.net).toBe(9900);
    // La conservation des fonds doit être exacte.
    expect(r.platformFee + r.net).toBe(r.gross);
  });

  it('arrondit la commission au franc inférieur (la MSD ne perd rien)', () => {
    const r = kadev.splitAmount(999, 150); // 1,5 % → 14,985 → 14
    expect(r.platformFee).toBe(14);
    expect(r.net).toBe(985);
  });

  it('borne une commission aberrante', () => {
    expect(kadev.splitAmount(1000, 99999).platformFee).toBe(1000);
    expect(kadev.splitAmount(1000, -50).platformFee).toBe(0);
  });

  it('neutralise un montant négatif ou absent', () => {
    expect(kadev.splitAmount(-500, 100).gross).toBe(0);
    expect(kadev.splitAmount(undefined, 100).net).toBe(0);
  });
});

describe('Passerelle Kadev — signature HMAC', () => {
  it('produit une signature déterministe', () => {
    const a = kadev.signPayload('reference=KDV-DKR-1', 'secret-dkr');
    const b = kadev.signPayload('reference=KDV-DKR-1', 'secret-dkr');
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it('change avec le secret (un secret MSD ne vaut pas pour l\'autre)', () => {
    expect(kadev.signPayload('x', 'secret-dkr')).not.toBe(kadev.signPayload('x', 'secret-agg'));
  });

  it('sérialise les clés de façon canonique (ordre indépendant)', () => {
    const a = kadev.canonicalize({ b: 2, a: 1 });
    const b = kadev.canonicalize({ a: 1, b: 2 });
    expect(a).toBe(b);
    expect(a).toBe('{"a":1,"b":2}');
  });

  it('accepte une signature valide et refuse une signature falsifiée', () => {
    const payload = JSON.stringify({ reference: 'KDV-DKR-1', status: 'success' });
    const signature = kadev.signPayload(payload, 'secret-dkr');
    expect(kadev.verifyWebhookSignature(payload, signature, 'secret-dkr')).toBe(true);
    // Signature forgée avec le mauvais secret → rejetée.
    expect(kadev.verifyWebhookSignature(payload, signature, 'secret-agg')).toBe(false);
  });

  it('tolère le préfixe sha256= et refuse une charge utile modifiée', () => {
    const payload = JSON.stringify({ reference: 'KDV-DKR-1', status: 'success' });
    const signature = kadev.signPayload(payload, 'secret-dkr');
    expect(kadev.verifyWebhookSignature(payload, `sha256=${signature}`, 'secret-dkr')).toBe(true);
    // Un attaquant ne peut pas changer le montant en gardant la signature.
    const tampered = JSON.stringify({ reference: 'KDV-DKR-1', status: 'success', amount: 999999 });
    expect(kadev.verifyWebhookSignature(tampered, signature, 'secret-dkr')).toBe(false);
  });

  it('refuse une signature absente ou une longueur incohérente', () => {
    expect(kadev.verifyWebhookSignature('{}', '', 'secret-dkr')).toBe(false);
    expect(kadev.verifyWebhookSignature('{}', 'abc', 'secret-dkr')).toBe(false);
    expect(kadev.verifyWebhookSignature('{}', 'abc', '')).toBe(false);
  });
});
