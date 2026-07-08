# The Stacks

A tiny, good-looking personal library for reading your own PDFs from any device — straight out of a GitHub repo. No backend, no build step, no database.

## How it works

- `js/app.js` asks GitHub's API for every file in your repo, keeps the ones ending in `.pdf`, and turns each one into a "book" on a shelf.
- Files are read through `cdn.jsdelivr.net` (a free CDN mirror of GitHub repos), so PDFs load fast and reliably.
- Reading them happens in an embedded [PDF.js](https://mozilla.github.io/pdf.js/) viewer — works the same on desktop and phone.
- "Reading" / "Finished" status is remembered per-browser using `localStorage`. Nothing is sent anywhere.

Add a PDF anywhere in your repo, refresh the page, and it appears on the shelf automatically — grouped by the folder it lives in.

## Setup (2 minutes)

1. Put these files (`index.html`, `css/`, `js/`) at the root of the GitHub repo where you keep your PDFs — or wherever you like, PDFs don't need to be in the same folder.
2. Turn on **GitHub Pages** for that repo: repo → Settings → Pages → Deploy from branch → pick `main` (or `master`) → Save.
3. Open the URL GitHub gives you (something like `https://yourname.github.io/your-repo/`).

That's it — if you're serving from `yourname.github.io`, the site figures out your username and repo from the URL by itself.

**Only need to edit something if:**
- Your repo is private (see note below), or
- You want the site to point at a *different* repo than the one it's hosted in.

In that case, open `js/app.js` and fill in the top of the file:

```js
const CONFIG = {
  owner: "yourname",     // your GitHub username
  repo: "your-repo",     // the repo your PDFs live in
  branch: "main",        // usually "main" or "master"
};
```

## A note on private repos

This reads your repo through GitHub's public API and jsDelivr's public CDN, which only works for **public** repositories (no API key is used or stored anywhere). If your books repo is private, either make it public, or keep a separate public repo just for the PDFs and point `CONFIG` at that one.

## File structure

```
index.html       the page
css/style.css     the look — bookshelf theme, spine-colored cards
js/app.js         all the logic: fetch, search, filters, reader, memory
```

Nothing to install, nothing to run — it's three static files.
