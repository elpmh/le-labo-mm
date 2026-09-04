# Martin Martin Lab

Two free, fan-made tools built on Martin Martin's own **public** Shopify catalogue
(`/products.json`) — no API keys, no server, no tracking, nothing to pay, at build
time *or* at use time.

> Unofficial and not affiliated with Martin Martin. Every look and character is
> assembled from real pieces; every card links back to the boutique.

## The tools

**The Stylist** — describe a moment ("a chic dinner in Paris in October, effortless
but sharp") and it assembles a head-to-toe look from real pieces and explains why.
Matching runs a **multilingual** sentence-embedding model
(`Xenova/paraphrase-multilingual-MiniLM-L12-v2`) **in your browser** via
[transformers.js] — so French queries match the French product copy. Lazy-loaded once
(~120 MB, then cached), no keys, no server. If the model can't load, it falls back to
French keyword/facet matching.

The whole interface is in French — the target audience is Parisian women.

**The MM Girls** — Martin Martin names every design after a woman. Each named piece
becomes a character with a personality generated from its own cut, colour and mood.
A four-question quiz matches you to your girl.

## How it stays free

| Concern            | Choice                                                        |
|--------------------|---------------------------------------------------------------|
| Data               | The store's public `products.json` — no scraping, no keys     |
| "AI"               | Embeddings run client-side (transformers.js); zero inference cost |
| Personas           | Templated deterministically at build; baked as static JSON    |
| Hosting            | Static files → GitHub Pages                                   |
| Freshness          | GitHub Action re-pulls the feed daily (free minutes)          |

## Layout

```
data/products_raw.json     raw feed (fetched)
scripts/build_dataset.py   → site/data/products.json  (cleaned catalogue)
scripts/build_girls.py     → site/data/girls.json      (personas)
scripts/refresh.sh         fetch + rebuild both
site/                      the static site (index / stylist / girls)
.github/workflows/         daily refresh + Pages deploy
```

## Run locally

```bash
bash scripts/refresh.sh          # pull latest data + rebuild
cd site && python3 -m http.server 8137
# open http://localhost:8137
```

## Deploy

Push to GitHub, enable **Pages → Source: GitHub Actions**. The included workflow
refreshes data daily and redeploys. That's it.

[transformers.js]: https://github.com/xenova/transformers.js
