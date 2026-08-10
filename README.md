# Azure Changelog

A clean, always up-to-date feed of Microsoft Azure service updates — summarized, with key points pulled out, tagged by category/status, searchable, and refreshed automatically every 6 hours. No backend, no database, no build framework: static HTML/CSS/JS + a small data-fetching script, deployed to GitHub Pages via GitHub Actions.

**How it stays current:** a scheduled GitHub Actions workflow calls Microsoft's public Azure Updates API, turns each new/changed entry into a clean summary + key-point bullets (rule-based text extraction — no AI API key required), commits the data, and redeploys the site. It also runs on every push to `main` and can be triggered manually.

## Project layout

```
scripts/fetch-updates.js   # pulls updates from Azure's API, writes site/data/*.json (zero dependencies)
scripts/serve.js           # tiny local static server for previewing site/ (zero dependencies)
site/                      # the deployed site: index.html, styles.css, app.js, data/
.github/workflows/update.yml  # scheduled fetch -> commit -> deploy to GitHub Pages
```

## One-time setup (GitHub)

1. Create a new **empty** GitHub repository named `azure-changelog` under your account (`DaryAkerman`) — don't initialize it with a README/license, this folder already has one.
2. From this folder:
   ```sh
   git remote add origin https://github.com/DaryAkerman/azure-changelog.git
   git push -u origin main
   ```
3. In the repo on GitHub: **Settings → Actions → General → Workflow permissions** → select **"Read and write permissions"**, then Save.
   (Needed so the scheduled workflow can commit the refreshed data back to the repo.)
4. In the repo on GitHub: **Settings → Pages → Build and deployment → Source** → select **"GitHub Actions"**.
5. Go to the **Actions** tab and run the **"Update Azure Changelog"** workflow once manually (`Run workflow`), or just wait — it also runs automatically on the push from step 2.
   - The **first** run has no existing data file, so it automatically does a deep backfill (a few hundred to ~2000 historical entries) instead of just the last few. This may take a bit longer than later runs.
6. Once it finishes, your site is live at `https://DaryAkerman.github.io/azure-changelog/`.

After that, it updates itself — no further action needed. It checks for new/changed Azure updates every 6 hours (`.github/workflows/update.yml`); edit the cron expression there to change the cadence.

## Local preview

Requires [Node.js](https://nodejs.org) 18+ (not currently installed on this machine — install it if you want to run these locally; everything above works via GitHub Actions regardless).

```sh
npm run backfill   # first time: pull a deep history of updates into site/data/
npm run serve      # serve site/ at http://localhost:4321
```

Later, `npm run fetch` does a lighter incremental pull (same thing the scheduled workflow runs).

## How summaries are generated

`scripts/fetch-updates.js` has no AI/API-key dependency by design. For each Azure update it:

- Strips HTML from Microsoft's own update description and decodes entities.
- Uses the first sentence(s) as the **summary** (a second short sentence is folded in if the first is very short).
- Pulls out `<li>` bullet points as **key points** when the source has a list; otherwise falls back to the next few sentences.
- Grabs the first outbound link in the description as a **"Learn more"** link.
- Normalizes `status` into a badge: Generally Available / Public Preview / In Development / Retirement.

If you'd rather have an LLM write punchier summaries, that's a natural upgrade: swap `buildSummary`/`extractKeyPoints` in `scripts/fetch-updates.js` for a call to the Claude API, gated behind an `ANTHROPIC_API_KEY` repo secret.

## Data source

[Microsoft's public Azure Updates](https://azure.microsoft.com/en-us/updates) API (`https://www.microsoft.com/releasecommunications/api/v2/azure`), unauthenticated, no API key required. This project is not affiliated with or endorsed by Microsoft.
