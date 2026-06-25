// Tests du composant Footer (présentationnel + formulaire newsletter)
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Footer from '../components/Footer';

describe('Footer', () => {
  it('affiche le copyright et les liens rapides en français', () => {
    render(<Footer lang="fr" setView={() => {}} />);
    expect(screen.getByText(/MUTUALIS DAKAR - URMSCD/i)).toBeInTheDocument();
    expect(screen.getByText(/Liens rapides/i)).toBeInTheDocument();
  });

  it('affiche le contenu en Wolof quand lang="wo"', () => {
    render(<Footer lang="wo" setView={() => {}} />);
    expect(screen.getByText(/Liy Tënk/i)).toBeInTheDocument();
  });

  it('permet la saisie dans la newsletter', () => {
    render(<Footer lang="fr" setView={() => {}} />);
    const input = screen.getByPlaceholderText(/Votre adresse email/i);
    fireEvent.change(input, { target: { value: 'test@example.com' } });
    expect(input.value).toBe('test@example.com');
  });

  it('appelle setView quand on clique sur un lien de navigation', () => {
    const setView = vi.fn();
    render(<Footer lang="fr" setView={setView} />);
    const homeLink = screen.getByText('Accueil');
    fireEvent.click(homeLink);
    expect(setView).toHaveBeenCalled();
  });
});
