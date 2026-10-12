# Shelf Sort Rush

A match-3 shelf sorting puzzle built with Phaser 4

A Phaser 4 + TypeScript prototype. Play it at https://tuandds.github.io/shelf-sort-rush/demo/ · docs and Game Design Document at https://tuandds.github.io/shelf-sort-rush/docs/.

## Run

```bash
npm install
npm run dev      # http://localhost:8080
npm run build
```

## Releases

The live site is built locally and pushed to the `gh-pages` branch. There is no CI deploy.

```bash
npm run release:latest                  # after pushing main: update https://tuandds.github.io/shelf-sort-rush/
npm version minor && npm run release    # publish a frozen copy at /shelf-sort-rush/vX.Y.0/
```

The landing page lists every version. See `docs/guide/deployment.md` for details.
