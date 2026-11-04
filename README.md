# VORTEX Basketball (VBA)

Browser basketball shell — menus, NBA data, courts, **MiTEAM**, and **Pyramid**.  
Live site target: **[miteam.lol](https://miteam.lol)**

**Implementation plan:** [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md)

## Decisions (locked)

- Fork and adapt GOLACO into this repo (GOLACO remains the football game).
- Phase 1: Gameplay Basketball, Street, MiTEAM, Pyramid; East/West NBA fixtures; teams/emblems/rosters; Classic; formation 5+8; three 3D courts — no match engine yet.

## Local play

```bash
npm install
npm run dev      # http://127.0.0.1:5173
npm test
npm run build    # static site → dist/ (for miteam.lol / GitHub Pages)
```

## Online deploy (GitHub Pages → miteam.lol)

Ship this project as a GitHub repo named **`VORTEX`** under your username (`github.com/<you>/VORTEX`). Pages serves the built `dist/` via [.github/workflows/pages.yml](.github/workflows/pages.yml). Custom domain is set in [`public/CNAME`](public/CNAME) → `miteam.lol`.

### 1. Create / push the repo

```bash
# from this folder (or a copy named VORTEX)
git remote add origin https://github.com/<you>/VORTEX.git
git push -u origin main
```

### 2. Enable GitHub Pages

In the repo: **Settings → Pages**

- Source: **GitHub Actions**
- Custom domain: `miteam.lol` (and `www.miteam.lol` if you use it)
- Enable **Enforce HTTPS** after DNS propagates

### 3. Point DNS at GitHub Pages

At your domain registrar for **miteam.lol**:

| Type | Host | Value |
|------|------|--------|
| `A` | `@` | `185.199.108.153` |
| `A` | `@` | `185.199.109.153` |
| `A` | `@` | `185.199.110.153` |
| `A` | `@` | `185.199.111.153` |
| `AAAA` | `@` | `2606:50c0:8000::153` |
| `AAAA` | `@` | `2606:50c0:8001::153` |
| `AAAA` | `@` | `2606:50c0:8002::153` |
| `AAAA` | `@` | `2606:50c0:8003::153` |
| `CNAME` | `www` | `<you>.github.io` |

(Optional apex `ALIAS`/`ANAME` to `<you>.github.io` if your DNS host supports it.)

### 4. Ship

Push to `main` — Actions runs tests, builds, and deploys. Confirm **Actions** is green and https://miteam.lol loads.

## Status

Phase 0–1 shell: VORTEX branding, modes BASKETBALL / STREET / MITEAM / PYRAMID, NBA + classic databases, formation court. On-court play continues to expand.
