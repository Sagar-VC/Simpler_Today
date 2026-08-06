# Security Review — Pending Changes

**Date:** 2026-08-06
**Branch:** main
**Scope:** `pages/DashboardPage.ts`, `pages/LoginPage.ts`, `send-report.js`, `.env`

## Result: No HIGH or MEDIUM confidence vulnerabilities found.

| File | Change | Assessment |
|---|---|---|
| `pages/DashboardPage.ts` | Hardcoded dashboard URL removed; assertion now uses `/\/dashboard/` regex against whatever `baseURL` is active | No security implication — test-only, env-agnostic assertion |
| `pages/LoginPage.ts` | Hardcoded login URL removed in favor of relative `/login` resolved against `playwright.config.ts` `baseURL` | No security implication — standard Playwright pattern |
| `send-report.js` | Report path changed from `playwright-report/index.html` to `reports/index.html` | Static, hardcoded path — no injection surface, no user input involved |
| `.env` | `BASE_URL` value updated | Value change only, no new key added |

No injection points, auth/authorization logic, crypto, or data-exposure paths were touched by this diff. The `spawn()` call and `nodemailer` auth block in `send-report.js` (~line 542, ~569–578) are unchanged by this diff and were out of scope for this review.

---

## Separate note — repo hygiene (not a diff finding)

`.env` is tracked in git (committed since `51068e6`) and currently holds real values for:

- `EMAIL_PASSWORD`
- `TEST_PASSWORD`
- `TEST_PASSWORD_PLATFORM_ADMIN`
- `TEST_PASSWORD_FIRM_ADMIN`

`.gitignore` now excludes `.env` going forward, but the file was tracked before that rule was added, so these credentials remain in git history. If this repo has ever been pushed to a shared or public remote, that history exposure persists even after removing `.env` from future commits.

**Recommended remediation (if this repo has ever been pushed anywhere):**
1. Rotate all credentials listed above.
2. Remove `.env` from version control: `git rm --cached .env`.
3. Scrub it from git history (e.g. `git filter-repo` or BFG Repo-Cleaner) if the repo has remote history containing it.
4. Confirm `.env` is `.gitignore`d going forward (already done) and that only `.env.example` (placeholders, no real values) is committed.

This is a decision for you to make and execute — no history-rewriting or credential rotation has been performed as part of this review.
