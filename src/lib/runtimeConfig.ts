const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]']);

export class RuntimeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RuntimeConfigError';
  }
}

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function normalizeHttpUrl(raw: string): string {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new RuntimeConfigError(`Invalid VITE_API_BASE_URL: ${raw}`);
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new RuntimeConfigError('VITE_API_BASE_URL must use http:// or https://');
  }

  return trimTrailingSlash(parsed.toString());
}

export function isLocalHostname(hostname: string): boolean {
  return LOCAL_HOSTNAMES.has(hostname);
}

export function resolveApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL?.trim();
  if (configured) {
    return normalizeHttpUrl(configured);
  }

  if (typeof window !== 'undefined' && isLocalHostname(window.location.hostname)) {
    return trimTrailingSlash(window.location.origin);
  }

  throw new RuntimeConfigError(
    'VITE_API_BASE_URL is required outside local development. Set it to the LabaClaw runtime origin.',
  );
}

export function describeRuntimeTarget(): string {
  try {
    return resolveApiBaseUrl();
  } catch {
    return import.meta.env.VITE_API_BASE_URL?.trim() || '(unset)';
  }
}

export function resolveApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${resolveApiBaseUrl()}${normalizedPath}`;
}

export function resolveWsBaseUrl(): string {
  const apiBaseUrl = resolveApiBaseUrl();
  const parsed = new URL(apiBaseUrl);
  parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
  parsed.pathname = '';
  parsed.search = '';
  parsed.hash = '';
  return trimTrailingSlash(parsed.toString());
}

