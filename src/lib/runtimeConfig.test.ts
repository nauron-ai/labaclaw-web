import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isLocalHostname,
  resolveApiBaseUrl,
  resolveApiUrl,
  resolveWsBaseUrl,
} from './runtimeConfig';

const originalHref = window.location.href;

describe('runtimeConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    window.history.replaceState({}, '', originalHref);
  });

  it('uses VITE_API_BASE_URL when provided', () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://runtime.example.com/');

    expect(resolveApiBaseUrl()).toBe('https://runtime.example.com');
    expect(resolveApiUrl('/api/status')).toBe('https://runtime.example.com/api/status');
    expect(resolveWsBaseUrl()).toBe('wss://runtime.example.com');
  });

  it('falls back to same-origin for local hostnames', () => {
    vi.stubEnv('VITE_API_BASE_URL', '');

    expect(isLocalHostname(window.location.hostname)).toBe(true);
    expect(resolveApiBaseUrl()).toBe(window.location.origin);
  });

  it('derives ws:// for local http origins', () => {
    vi.stubEnv('VITE_API_BASE_URL', '');
    window.history.replaceState({}, '', '/dashboard');

    expect(resolveWsBaseUrl()).toBe(`ws://${window.location.host}`);
  });
});
