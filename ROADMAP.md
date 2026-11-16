# Moneyleh Development Roadmap

This roadmap tracks prioritized fixes and enhancements identified during the architectural review. AI agents and developers should work through these phases systematically.

---

## 🎯 Phase 1: Security & Stability (Immediate Priority)

- [ ] **Backend Auth Guard Middleware**
  - Implement an `authGuard` middleware using `better-auth` (`auth.api.getSession({ headers: c.req.raw.headers })`).
  - Attach the guard to all sensitive routes (`/api/account`, `/api/card`, `/api/transaction`, `/api/ui`, `/api/admin/statement`).
  - Verify that the authenticated session user ID matches the requested `userId`.
- [ ] **API 404 Isolation**
  - In `src/index.ts`, ensure unhandled `/api/*` requests return a JSON 404 response (`{ error: "Endpoint not found" }`) instead of falling through to the SPA `index.html`.
- [ ] **Graceful Duplicate Transaction Handling**
  - In `src/routes/transaction.ts`, replace the hard error (`throw new Error("Found X similar transaction")`) with a non-fatal duplicate check.
  - In the upload review UI, flag potential duplicate transactions with a badge and allow users to toggle *"Skip duplicate"* or *"Import anyway"*.

---

## ⚡ Phase 2: Database & Worker Optimization

- [ ] **SQLite Concurrency Settings**
  - In `src/db/db.ts`, execute `PRAGMA journal_mode = WAL;` and `PRAGMA busy_timeout = 5000;`.
  - Verify that concurrent reads do not fail while background worker threads write model checkpoints.
- [ ] **Selective Classifier Retraining**
  - In `classifier-trainer-worker.ts`, add an environment variable / option to only train the active classifier (`default-bayes`).
  - Gate the heavy Universal Sentence Encoder KNN classifier (`@tensorflow/tfjs-node`, 102MB file) behind a flag (e.g. `ENABLE_KNN_TRAINING=true`).
- [ ] **Atomic Model Checkpoint Writes**
  - In `BaseClassifier.saveAndTrain()`, write JSON to a temporary file (`.tmp`) and use atomic file replacement to prevent corrupt reads if an inference request overlaps with a save.

---

## 🚀 Phase 3: UX & Feature Enhancements

- [ ] **Dashboard Overview Metrics**
  - Replace the placeholder text in `src/frontend/src/routes/_authenticated/dashboard.tsx` with:
    - Net worth and total balance summary across accounts and cards.
    - Monthly spending breakdown by category / tag (Chart.js donut or bar chart).
    - Split expense balances (net amount owed or to receive).
    - Recent transactions list.
- [ ] **Transaction Table Pagination & Filtering**
  - Add pagination controls (page size, next/previous buttons) or virtual scrolling to `inventory.$type.$id.tsx` to display transactions beyond the initial 100 records.
  - Add text search and date range filtering to transaction tables.
- [ ] **Original Statement PDF Vault**
  - Store uploaded PDF files under `/data/statements/<statementId>.pdf`.
  - Provide a download link in the statement admin viewer and allow re-parsing existing statements with updated bank format extractors.
- [ ] **CSV / Spreadsheet Export**
  - Implement a direct CSV export endpoint (`GET /api/transaction/:userId/export`) and UI button to download filtered transactions for tax or spreadsheet budgeting.
