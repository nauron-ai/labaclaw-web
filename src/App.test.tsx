import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { clearToken } from './lib/auth';

describe('App startup error screen', () => {
  afterEach(() => {
    clearToken();
    sessionStorage.clear();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('renders the startup error screen when the runtime health check fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:42617')),
    );

    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Runtime startup check failed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry connection' })).toBeInTheDocument();
  });
});
