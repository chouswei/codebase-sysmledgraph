# Publishing sysmledgraph to npm

Checklist for maintainers before **`npm publish`**.

1. **Version** — Bump **`package.json`** `"version"` (and root **`package-lock.json`** name/version if not using `npm version patch`). Align **`src/mcp/server.ts`** **`SERVER_VERSION`** and **README** “Current package version”.
2. **Release notes** — Add or update **`release-notes-vX.Y.Z.md`** at repo root (not in npm **`files`** by default; optional to add to **`files`** if you want them in the tarball).
3. **Docs** — Update **README** / **docs/PLAN.md** “Released” line if the release is user-facing.
4. **Verify pack** — From a clean tree with **`dist/`** built:
   ```bash
   npm run build
   npm pack --dry-run
   ```
   Confirm **`lsp/node_modules`** does **not** appear (we ship explicit **`lsp/*.json`**, **`README`**, **`test-server.mjs`** only).
5. **Tests** — **`npm test`** and **`npm run test:daemon`** (CI runs both on Windows and Ubuntu). If **`kuzu`** fails to load locally after **`npm install --ignore-scripts`**, run **`node node_modules/kuzu/install.js`** (see **INSTALL.md**).
6. **Publish** — **`npm login`**, then **`npm publish`** (or **`npm publish --access public`** for a scoped name the first time).

**Note:** This repository does not run **`npm publish`** in CI; publishing is manual with npm credentials.
