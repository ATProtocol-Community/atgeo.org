# atgeo.org

Documentation and interactive demos for [ATGeo](https://atgeo.org), a Place lexicon and gazetteer service for AT Protocol. Built with [Eleventy](https://www.11ty.dev/). Deployed to GitHub Pages.

`npm run dev` to preview locally.

## Writing a news post

Add a Markdown file to `src/news/`, named `YYYY-MM-DD-some-title.md`:

```markdown
---
title: "Tiles for Overture divisions are live"
date: 2026-11-12
summary: One sentence for the listing page and the feed.
---

Body in Markdown. Use absolute URLs for links, since the body is also
published in the Atom feed.
```

The post appears at `/news/some-title/` (the date prefix is dropped from the URL), on the `/news/` listing and in `/feed.xml`. Push to `main` to deploy. Posts with a future `date` are published immediately, so set the date to when you want it to read.
