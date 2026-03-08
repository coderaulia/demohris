# Dashboard Module

Phase-1 modularized layout.

- `core.js`: current implementation source of truth.
- Feature files re-export public APIs and define extraction boundaries.
- `../dashboard.js` is the stable entry facade.

When changing behavior now:
1. Preserve public exports in `../dashboard.js`.
2. Implement safely in `core.js` first.
3. Move function blocks into feature files incrementally.
