# Azure Changelog

A clean, always-current feed of Microsoft Azure service updates — every entry gets a short summary and key points pulled out, tagged by category and status, searchable and filterable. No backend, no database, no AI, no API keys. Just a static site that refreshes itself.

**Live site:** [daryakerman.github.io/azure-changelog](https://daryakerman.github.io/azure-changelog/)

## Why this exists

Azure ships changes constantly — new features, GA announcements, previews, retirements — and the official updates page makes it hard to quickly see what's new and what actually matters to you. This project pulls the same official data and presents it as a fast, readable, filterable feed: search by service, filter by status, and get the gist of each update in a few bullet points instead of a wall of text.

## Features

- 🔄 **Always current** — refreshes automatically every 6 hours, no manual steps
- 📝 **Summary + key points** for every update, extracted straight from Microsoft's own text
- 🔍 **Search and filtering** by service, category, and status (Generally Available / Public Preview / In Development / Retirement)
- 🧠 **No AI, no API keys, no cost** — summaries are built with plain, transparent text-processing logic, not a language model
- 🌐 **Fully open source** — MIT licensed, free to use, fork, or self-host
- ⚡ **Static and lightweight** — plain HTML/CSS/JS, no framework, loads fast

## How it works

A scheduled GitHub Actions workflow:

1. Calls Microsoft's public Azure Updates API directly (no key required).
2. Converts each new or changed entry into a clean summary, bullet key points, a normalized status badge, and category/product tags.
3. Commits the updated data back to the repo.
4. Redeploys the static site to GitHub Pages.

It also runs on every push to `main`, and can be triggered manually from the Actions tab.

## Tech stack

- **Frontend:** plain HTML, CSS, and JavaScript — no framework, no build step
- **Data ingestion:** a small, dependency-free Node.js script (`scripts/fetch-updates.js`)
- **Hosting & automation:** GitHub Pages + GitHub Actions

## Project structure

```
scripts/fetch-updates.js   # pulls updates from Azure's API, writes site/data/*.json
scripts/serve.js           # tiny local static server for previewing site/
site/                      # the deployed site: index.html, styles.css, app.js, data/
.github/workflows/update.yml  # scheduled fetch -> commit -> deploy to GitHub Pages
```

## Running your own copy

1. Fork or clone this repository.
2. In your repo's settings: **Settings → Actions → General → Workflow permissions** → "Read and write permissions" (lets the scheduled workflow commit refreshed data).
3. **Settings → Pages → Build and deployment → Source** → "GitHub Actions".
4. Push to `main`, or run the **"Update Azure Changelog"** workflow manually from the Actions tab.
   - The first run has no existing data yet, so it automatically does a deep backfill (up to ~2000 historical entries) instead of just the latest ones — it takes a little longer than later runs.
5. Once it finishes, your site is live at `https://<your-username>.github.io/<repo-name>/`.

From there it maintains itself. Edit the cron expression in `.github/workflows/update.yml` to change the refresh cadence (defaults to every 6 hours).

## Local development

Requires [Node.js](https://nodejs.org) 18+.

```sh
npm run backfill   # first time: pull a deep history of updates into site/data/
npm run serve      # serve site/ at http://localhost:4321
```

`npm run fetch` does a lighter incremental pull — the same thing the scheduled workflow runs.

## How summaries are generated

`scripts/fetch-updates.js` has no AI or API-key dependency, by design. For each Azure update it:

- Strips HTML from Microsoft's own update description and decodes entities.
- Uses the first sentence(s) as the **summary** (a short second sentence gets folded in if the first is very brief).
- Pulls out `<li>` bullet points as **key points** when the source has a list; otherwise falls back to the next few sentences.
- Grabs the first outbound link in the description as a **"Learn more"** link.
- Normalizes `status` into a badge: Generally Available / Public Preview / In Development / Retirement.

## Contributing

Issues and pull requests are welcome — better summary heuristics, design tweaks, new filters, whatever's useful. It's a small, dependency-free codebase, so it's easy to jump into.

## Data source & disclaimer

Data comes from Microsoft's public [Azure Updates](https://azure.microsoft.com/en-us/updates) API (`https://www.microsoft.com/releasecommunications/api/v2/azure`), unauthenticated and free to query. This project is an independent, community-built tool and is **not affiliated with or endorsed by Microsoft**.

## License

[MIT](LICENSE)
