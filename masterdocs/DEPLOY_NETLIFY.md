# Deploy Masterdocs to Netlify

This deploys the VitePress site in `masterdocs/`.

## Option A (recommended): Netlify reads repo config

This repo includes a root `netlify.toml` configured to:

- Base directory: `masterdocs`
- Build command: `npm ci && npm run docs:build`
- Publish directory: `.vitepress/dist`
- Node: 20

### Steps
1. Netlify → **Add new site** → **Import an existing project**
2. Pick GitHub repo
3. Keep defaults (Netlify should auto-detect `netlify.toml`)
4. Deploy

## Option B: set settings manually in Netlify UI

- **Base directory:** `masterdocs`
- **Build command:** `npm ci && npm run docs:build`
- **Publish directory:** `masterdocs/.vitepress/dist`
- **Environment:** set `NODE_VERSION=20`

## Local check

From `b:\hajri\masterdocs`:

```powershell
npm install
npm run docs:build
npm run docs:preview
```
