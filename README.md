# labaclaw-web

Standalone operator dashboard for `labaclaw`. This repo builds and deploys the SPA independently from the runtime binary.

## Requirements

- Node.js 22+
- npm
- A running `labaclaw` runtime for interactive development

## Environment

- `VITE_API_BASE_URL`
  - Required when the app is deployed on a non-local origin.
  - Should point at the `labaclaw` runtime origin, for example `https://claw.example.com`.
  - Local `vite` development can omit it and use the built-in proxy to `http://127.0.0.1:42617`.
- `LABACLAW_CONTRACT_PATH`
  - Optional path to the runtime-owned dashboard contract artifact.
  - If unset, contract verification falls back to `../labaclaw/docs/reference/dashboard-api-contract.json` when that sibling path exists.

## Local Development

Install dependencies:

```bash
npm ci
```

Run against a local runtime on `127.0.0.1:42617`:

```bash
npm run dev
```

Run against a separate runtime origin:

```bash
VITE_API_BASE_URL=https://claw.example.com npm run dev
```

Build for deployment:

```bash
VITE_API_BASE_URL=https://claw.example.com npm run build
```

Preview a local production build:

```bash
VITE_API_BASE_URL=http://127.0.0.1:42617 npm run build
npm run preview
```

## Verification

Run unit tests:

```bash
npm test
```

Verify the runtime contract from the sibling meta-repo artifact:

```bash
npm run contract:check
```

Verify with the bundled example artifact instead:

```bash
npm run contract:check:fixture
```

Run the standalone CI-equivalent checks:

```bash
npm run verify:standalone
```

## Deploy Notes

- The dashboard expects an API runtime reachable at `VITE_API_BASE_URL`.
- The runtime must allow the dashboard origin for HTTP, SSE, and WebSocket traffic.
- Static hosting must rewrite application routes to `/index.html`.
