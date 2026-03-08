# Records Module

Phase-1 modularized layout.

- `core.js`: current implementation source of truth.
- Feature files re-export public APIs and are the target destination for incremental extraction.
- `../records.js` is the stable public facade consumed by the app.

When changing behavior now:
1. Keep public signatures in `../records.js` unchanged.
2. Update `core.js` first for safety.
3. Extract touched functions into feature files in small batches.
