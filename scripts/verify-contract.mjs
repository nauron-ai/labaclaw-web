#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);
const REQUIRED_ROUTES = [
  { transport: 'http', method: 'GET', path: '/health' },
  { transport: 'http', method: 'POST', path: '/pair' },
  { transport: 'http', method: 'GET', path: '/api/status' },
  { transport: 'http', method: 'GET', path: '/api/health' },
  { transport: 'http', method: 'GET', path: '/api/config' },
  { transport: 'http', method: 'PUT', path: '/api/config' },
  { transport: 'http', method: 'GET', path: '/api/tools' },
  { transport: 'http', method: 'GET', path: '/api/cron' },
  { transport: 'http', method: 'POST', path: '/api/cron' },
  { transport: 'http', method: 'DELETE', path: '/api/cron/{id}' },
  { transport: 'http', method: 'GET', path: '/api/integrations' },
  { transport: 'http', method: 'GET', path: '/api/integrations/settings' },
  { transport: 'http', method: 'PUT', path: '/api/integrations/{integrationId}/credentials' },
  { transport: 'http', method: 'POST', path: '/api/doctor' },
  { transport: 'http', method: 'GET', path: '/api/memory' },
  { transport: 'http', method: 'POST', path: '/api/memory' },
  { transport: 'http', method: 'DELETE', path: '/api/memory/{key}' },
  { transport: 'http', method: 'GET', path: '/api/pairing/devices' },
  { transport: 'http', method: 'DELETE', path: '/api/pairing/devices/{id}' },
  { transport: 'http', method: 'GET', path: '/api/cost' },
  { transport: 'http', method: 'GET', path: '/api/cli-tools' },
  { transport: 'sse', method: 'GET', path: '/api/events' },
  { transport: 'ws', path: '/ws/chat' },
];

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultContractPath = path.resolve(
  rootDir,
  '../labaclaw/docs/reference/dashboard-api-contract.json',
);

function resolveInputPath(candidate) {
  if (!candidate) {
    return null;
  }

  return path.isAbsolute(candidate) ? candidate : path.resolve(rootDir, candidate);
}

function normalizePath(value) {
  return value
    .trim()
    .replace(/:([A-Za-z0-9_]+)/g, '{param}')
    .replace(/\{[^/]+\}/g, '{param}')
    .replace(/<([A-Za-z0-9_]+)>/g, '{param}')
    .replace(/\/+$/, '') || '/';
}

function normalizeTransport(value, fallback = 'http') {
  if (!value) {
    return fallback;
  }

  const lowered = String(value).toLowerCase();
  if (lowered === 'websocket') {
    return 'ws';
  }
  if (lowered === 'eventstream' || lowered === 'event-stream') {
    return 'sse';
  }
  return lowered;
}

function normalizeMethod(value, fallback = 'GET') {
  return String(value ?? fallback).toUpperCase();
}

function pushRoute(routes, route) {
  if (!route.path) {
    return;
  }

  const normalized = {
    transport: normalizeTransport(route.transport),
    method: route.method ? normalizeMethod(route.method) : undefined,
    path: normalizePath(route.path),
  };

  const dedupeKey = `${normalized.transport}:${normalized.method ?? ''}:${normalized.path}`;
  if (!routes.some((existing) => `${existing.transport}:${existing.method ?? ''}:${existing.path}` === dedupeKey)) {
    routes.push(normalized);
  }
}

function extractRoutes(contract) {
  const routes = [];
  const routeArrays = ['http', 'endpoints', 'routes', 'streams', 'transport', 'channels'];

  for (const key of routeArrays) {
    const value = contract[key];
    if (!Array.isArray(value)) {
      continue;
    }

    for (const entry of value) {
      if (!entry || typeof entry !== 'object') {
        continue;
      }

      pushRoute(routes, {
        transport: entry.transport ?? entry.protocol ?? entry.kind ?? entry.type,
        method: entry.method ?? entry.verb ?? entry.http_method,
        path: entry.path ?? entry.route ?? entry.url ?? entry.endpoint,
      });
    }
  }

  if (contract.paths && typeof contract.paths === 'object') {
    for (const [routePath, definition] of Object.entries(contract.paths)) {
      if (!definition || typeof definition !== 'object') {
        continue;
      }

      for (const [method, details] of Object.entries(definition)) {
        const normalizedMethod = method.toUpperCase();
        if (!HTTP_METHODS.has(normalizedMethod) || !details || typeof details !== 'object') {
          continue;
        }

        pushRoute(routes, {
          transport: 'http',
          method: normalizedMethod,
          path: routePath,
        });
      }
    }
  }

  return routes;
}

function routeMatches(required, available) {
  if (normalizePath(required.path) !== normalizePath(available.path)) {
    return false;
  }

  if (required.transport === 'ws') {
    return available.transport === 'ws';
  }

  if (required.transport === 'sse') {
    return (
      available.transport === 'sse' ||
      (available.transport === 'http' && normalizeMethod(available.method) === 'GET')
    );
  }

  if (available.transport === 'ws') {
    return false;
  }

  return normalizeMethod(required.method) === normalizeMethod(available.method);
}

function resolveContractPath() {
  const explicitPath = resolveInputPath(process.env.LABACLAW_CONTRACT_PATH ?? process.argv[2]);
  if (explicitPath) {
    return explicitPath;
  }

  if (fs.existsSync(defaultContractPath)) {
    return defaultContractPath;
  }

  throw new Error(
    `No dashboard API contract found. Set LABACLAW_CONTRACT_PATH or add ${defaultContractPath}.`,
  );
}

function main() {
  const contractPath = resolveContractPath();
  const raw = fs.readFileSync(contractPath, 'utf8');
  const contract = JSON.parse(raw);
  const availableRoutes = extractRoutes(contract);

  if (availableRoutes.length === 0) {
    throw new Error(`Contract ${contractPath} did not expose any parsable routes.`);
  }

  const missing = REQUIRED_ROUTES.filter(
    (required) => !availableRoutes.some((available) => routeMatches(required, available)),
  );

  if (missing.length > 0) {
    const summary = missing
      .map((route) => `${route.transport.toUpperCase()} ${route.method ?? ''} ${route.path}`.trim())
      .join('\n');
    throw new Error(`Dashboard contract is missing required routes:\n${summary}`);
  }

  const displayPath = path.isAbsolute(contractPath) ? path.relative(rootDir, contractPath) : contractPath;
  console.log(
    `[contract] Verified ${REQUIRED_ROUTES.length} dashboard routes against ${displayPath}.`,
  );
}

main();
