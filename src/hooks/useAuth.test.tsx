import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from './useAuth';
import { clearToken, TOKEN_STORAGE_KEY } from '../lib/auth';
import { getPublicHealth, pair as apiPair } from '../lib/api';

vi.mock('../lib/api', () => ({
  getPublicHealth: vi.fn(),
  pair: vi.fn(),
}));

const mockedGetPublicHealth = vi.mocked(getPublicHealth);
const mockedPair = vi.mocked(apiPair);

function AuthProbe() {
  const auth = useAuth();

  return (
    <div>
      <div data-testid="loading">{String(auth.loading)}</div>
      <div data-testid="authenticated">{String(auth.isAuthenticated)}</div>
      <div data-testid="startup-error">{auth.startupError ?? 'none'}</div>
      <div data-testid="token">{auth.token ?? 'none'}</div>
      <button type="button" onClick={() => void auth.pair('500235')}>
        pair
      </button>
      <button type="button" onClick={() => void auth.retryStartupCheck()}>
        retry
      </button>
    </div>
  );
}

describe('AuthProvider', () => {
  afterEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    clearToken();
    vi.clearAllMocks();
  });

  it('boots into authenticated mode when runtime does not require pairing', async () => {
    mockedGetPublicHealth.mockResolvedValue({ require_pairing: false, paired: true });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    expect(screen.getByTestId('startup-error')).toHaveTextContent('none');
  });

  it('surfaces a startup error when runtime health is unreachable', async () => {
    mockedGetPublicHealth.mockRejectedValue(new Error('connect ECONNREFUSED'));

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    expect(screen.getByTestId('startup-error').textContent).toContain(
      'Unable to reach runtime health endpoint',
    );
  });

  it('stores the paired bearer token in sessionStorage', async () => {
    const user = userEvent.setup();
    mockedGetPublicHealth.mockResolvedValue({ require_pairing: true, paired: false });
    mockedPair.mockResolvedValue({ token: 'bearer-token-123' });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('false');
    });

    await user.click(screen.getByRole('button', { name: 'pair' }));

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    });

    expect(screen.getByTestId('token')).toHaveTextContent('bearer-token-123');
    expect(sessionStorage.getItem(TOKEN_STORAGE_KEY)).toBe('bearer-token-123');
  });
});
