# dgslist.com — David's List

A simple page of David's recommendations. You edit **Trello**; the site updates itself every 30 minutes.

## How to add a recommendation (in the Trello app)
| In Trello | Shows on the site as |
|---|---|
| **List** (e.g. `🛒 Products & Gear`) | A category tab. Put an emoji at the start to give it an icon. |
| **Card title** | The recommendation's name |
| **Description** | Why you like it. The first paragraph is the short preview on the card. |
| **Cover photo** | The picture |
| **Attached link** | The button (Amazon, Yelp, website…). Rename the attachment to change the button text, e.g. "Buy on Amazon". |
| **Labels** | Tags. A label named **Top pick** adds a ★ badge and puts it first. A label named **Hidden** keeps it off the site. |
| **List name starting with `_`** (e.g. `_Ideas`) | Never shown — use it for drafts. |

Drag cards to set the order. Archive a card to remove it.

## Update right now
Repo → Actions → "Sync Trello & publish" → Run workflow.

## Settings (one-time)
- Repo → Settings → Secrets and variables → Actions → secrets `TRELLO_KEY`, `TRELLO_TOKEN` (read-only), `TRELLO_BOARD`.
- Repo → Settings → Pages → Source: **GitHub Actions**; custom domain `dgslist.com`.
- DNS: four `A` records for `@` → 185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153; `CNAME` for `www` → `dgarcia891.github.io`.
- Optional affiliate disclosure: Actions → Variables → `DISCLOSURE`.

## Files
- `site/` — the website
- `scripts/sync-trello.mjs` — pulls the Trello board into `site/data/recs.json` and `site/img/`
- `.github/workflows/deploy.yml` — runs the sync every 30 min and publishes
