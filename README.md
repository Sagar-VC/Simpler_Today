# Simpler Today — Playwright Automation Suite

End-to-end test automation for the Simpler Today platform, built with [Playwright](https://playwright.dev/) and TypeScript. Tests run against multiple environments (dev, staging, prod) and produce an emailed HTML summary report after each run.

## Project Structure

```
Login/
├── SimplerToday/         # Test specs (*.spec.ts)
├── pages/                # Page Object Model classes (one per app page)
├── reports/              # Generated HTML test reports (git-ignored)
├── test-results/         # Raw JSON results, traces, videos (git-ignored)
├── screenshots/          # Captured screenshots
├── playwright.config.ts  # Playwright configuration (environments, reporters, timeouts)
├── send-report.js        # Builds & emails the HTML summary report after a run
├── report-server.js      # Lightweight static server for viewing the summary report
├── .env.example          # Template for required environment variables
└── package.json
```

## Prerequisites

- Node.js 18+
- npm

## Setup

1. Install dependencies:
   ```bash
   npm install
   npx playwright install
   ```
2. Copy `.env.example` to `.env` and fill in real credentials:
   ```bash
   cp .env.example .env
   ```
   `.env` is git-ignored — never commit real credentials.

## Running Tests

| Command | Description |
|---|---|
| `npm test` | Run all tests against every configured environment, then email the report |
| `npm run test:dev` | Run against the dev environment only |
| `npm run test:staging` | Run against the staging environment only |
| `npm run test:prod` | Run against the prod environment only |
| `npm run test:all` | Run dev, then staging, then prod sequentially |
| `npm run test:no-email` | Run tests without sending the email report |
| `npm run show-report` | Open the last Playwright HTML report |
| `npm run send-report` | Manually (re)send the report email from the last run |

## Configuration

- **Environments** are defined in `playwright.config.ts` (`dev`, `staging`, `prod`). Setting `BASE_URL` (as the `test:*` scripts do via `cross-env`) scopes a run to a single environment; otherwise all environments run.
- Tests run **sequentially** (`fullyParallel: false`, `workers: 1`) with tracing, screenshots, and video capture enabled on every run.
- Reports are written to `reports/` (HTML) and `test-results/results.json` (JSON).

## Environment Variables

See `.env.example` for the full list, including role-based credentials used by `RoleBase.spec.ts`. Required variables include:

- `TEST_EMAIL` / `TEST_PASSWORD` — default login credentials
- `TEST_EMAIL_PLATFORM_ADMIN` / `TEST_PASSWORD_PLATFORM_ADMIN`
- `TEST_EMAIL_FIRM_ADMIN` / `TEST_PASSWORD_FIRM_ADMIN`

## Notes

- Never commit `.env` or any file containing real credentials.
- The `reports/`, `test-results/`, and `playwright-report/` directories are git-ignored and regenerated on each run.
