/* =========================================================
   THE STACKS — app.js
   No backend. Reads PDFs straight out of a GitHub repo.

   HOW IT FINDS YOUR REPO
   -----------------------
   1. If you fill in CONFIG.owner / CONFIG.repo below, that wins.
   2. Otherwise, if this site is served from GitHub Pages
      (something.github.io), it guesses the owner/repo from the URL.
   3. Branch defaults to "main" and falls back to "master".

   Just drop PDFs anywhere in the repo and refresh — no build step.
========================================================= */

const CONFIG = {
  owner: null,   // e.g. "octocat"  — leave null to auto-detect from GitHub Pages URL
  repo: null,    // e.g. "my-books" — leave null to auto-detect
  branch: null,  // e.g. "main"     — leave null to auto-detect (tries main, then master)
};

const STORAGE_KEY = "stacks:reading-state:v1";
const SPINES = ["spine-1", "spine-2", "spine-3", "spine-4", "spine-5", "spine-6", "spine-7"];

let allBooks = [];
let activeFilter = "all";
let searchTerm = "";

/* ---------------- boot ---------------- */

init();

async function init() {
  const { owner, repo } = resolveTarget();

  if (!owner || !repo) {
    renderConfigNeeded();
    return;
  }

  try {
    const { branch, tree } = await fetchRepoTree(owner, repo);
    const pdfs = tree.filter(
      (item) => item.type === "blob" && /\.pdf$/i.test(item.path)
    );

    if (pdfs.length === 0) {
      renderEmpty(owner, repo);
      return;
    }

    allBooks = pdfs.map((item) => buildBook(owner, repo, branch, item.path));
    renderStats(owner, repo, allBooks.length);
    document.getElementById("controls").hidden = false;
    wireControls();
    renderShelves();
  } catch (err) {
    console.error(err);
    renderError(owner, repo, err);
  }
}

/* ---------------- resolving owner/repo ---------------- */

function resolveTarget() {
  if (CONFIG.owner && CONFIG.repo) {
    return { owner: CONFIG.owner, repo: CONFIG.repo };
  }

  const host = window.location.hostname; // e.g. octocat.github.io
  const match = host.match(/^([^.]+)\.github\.io$/i);
  if (!match) return { owner: null, repo: null };

  const owner = match[1];
  const segments = window.location.pathname.split("/").filter(Boolean);
  const repo = segments.length > 0 ? segments[0] : `${owner}.github.io`;

  return { owner, repo };
}

/* ---------------- GitHub fetch ---------------- */

async function fetchRepoTree(owner, repo) {
  const branchesToTry = CONFIG.branch ? [CONFIG.branch] : ["main", "master"];

  let lastError = null;
  for (const branch of branchesToTry) {
    try {
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`,
        { headers: { Accept: "application/vnd.github+json" } }
      );
      if (res.status === 404) {
        lastError = new Error("not-found");
        continue;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `GitHub API error (${res.status})`);
      }
      const data = await res.json();
      return { branch, tree: data.tree || [] };
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError || new Error("Could not read repository");
}

function buildBook(owner, repo, branch, path) {
  const fileName = path.split("/").pop().replace(/\.pdf$/i, "");
  const title = fileName
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

  const folderSegments = path.split("/").slice(0, -1);
  const shelf = folderSegments.length > 0 ? folderSegments.join(" / ") : "General";

  const url = `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${branch}/${path
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;

  return {
    id: path,
    title: title || fileName,
    shelf,
    path,
    url,
    spine: SPINES[hashString(path) % SPINES.length],
  };
}

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/* ---------------- reading state (localStorage) ---------------- */

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getStatus(path) {
  const state = loadState();
  return state[path]?.status || "unread";
}

function setStatus(path, status) {
  const state = loadState();
  state[path] = { ...(state[path] || {}), status, updatedAt: Date.now() };
  saveState(state);
}

/* ---------------- rendering ---------------- */

function renderStats(owner, repo, count) {
  const el = document.getElementById("head-stats");
  el.innerHTML = `<strong>${count}</strong> book${count === 1 ? "" : "s"} · ${owner}/${repo}`;
}

function renderShelves() {
  const area = document.getElementById("shelf-area");
  const filtered = allBooks.filter((book) => {
    const matchesSearch =
      !searchTerm || book.title.toLowerCase().includes(searchTerm) || book.shelf.toLowerCase().includes(searchTerm);
    const matchesFilter = activeFilter === "all" || getStatus(book.path) === activeFilter;
    return matchesSearch && matchesFilter;
  });

  if (filtered.length === 0) {
    area.innerHTML = "";
    const panel = document.createElement("div");
    panel.className = "state-panel";
    panel.innerHTML = `
      <h2>No books here</h2>
      <p>Nothing on this shelf matches. Try a different search or filter.</p>
    `;
    area.appendChild(panel);
    return;
  }

  const groups = groupBy(filtered, (b) => b.shelf);
  area.innerHTML = "";

  Object.keys(groups)
    .sort((a, b) => a.localeCompare(b))
    .forEach((shelfName) => {
      const books = groups[shelfName].sort((a, b) => a.title.localeCompare(b.title));

      const section = document.createElement("section");
      section.className = "shelf-group";

      const label = document.createElement("div");
      label.className = "shelf-label";
      label.textContent = shelfName;
      section.appendChild(label);

      const grid = document.createElement("div");
      grid.className = "shelf-grid";

      books.forEach((book) => grid.appendChild(renderCard(book)));

      section.appendChild(grid);
      area.appendChild(section);
    });
}

function renderCard(book) {
  const status = getStatus(book.path);

  const card = document.createElement("button");
  card.className = "book-card";
  card.style.setProperty("--spine-color", `var(--${book.spine})`);
  card.setAttribute("aria-label", `Open ${book.title}`);

  card.innerHTML = `
    <span class="book-status" data-status="${status}"></span>
    <span class="book-cover">
      <span class="book-title">${escapeHtml(book.title)}</span>
      <span class="book-meta">PDF</span>
    </span>
  `;

  card.addEventListener("click", () => openReader(book));
  return card;
}

function groupBy(items, keyFn) {
  return items.reduce((acc, item) => {
    const key = keyFn(item);
    (acc[key] = acc[key] || []).push(item);
    return acc;
  }, {});
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ---------------- empty / error / config states ---------------- */

function renderConfigNeeded() {
  const area = document.getElementById("shelf-area");
  area.innerHTML = `
    <div class="state-panel">
      <h2>Point this at your repo</h2>
      <p>
        Open <code>js/app.js</code> and set <code>CONFIG.owner</code> and <code>CONFIG.repo</code> to your
        GitHub username and repository name. If you're hosting this on GitHub Pages
        (<code>username.github.io</code>), it'll be detected automatically — no edit needed.
      </p>
    </div>
  `;
}

function renderEmpty(owner, repo) {
  const area = document.getElementById("shelf-area");
  document.getElementById("head-stats").innerHTML = `${owner}/${repo}`;
  area.innerHTML = `
    <div class="state-panel">
      <h2>The shelves are empty</h2>
      <p>No PDFs found in <code>${escapeHtml(owner)}/${escapeHtml(repo)}</code> yet. Add a <code>.pdf</code> file
      anywhere in the repo and refresh this page — it'll show up here automatically.</p>
    </div>
  `;
}

function renderError(owner, repo, err) {
  const area = document.getElementById("shelf-area");
  area.innerHTML = `
    <div class="state-panel">
      <h2>Couldn't reach the shelves</h2>
      <p>
        ${escapeHtml(err.message || "Something went wrong talking to GitHub.")}<br>
        Check that <code>${escapeHtml(owner)}/${escapeHtml(repo)}</code> exists and is public. If you've made a
        lot of requests recently, GitHub's API may be rate-limiting this browser — wait a bit and refresh.
      </p>
    </div>
  `;
}

/* ---------------- controls ---------------- */

function wireControls() {
  const search = document.getElementById("search");
  search.addEventListener("input", (e) => {
    searchTerm = e.target.value.trim().toLowerCase();
    renderShelves();
  });

  document.querySelectorAll(".chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      document.querySelectorAll(".chip").forEach((c) => c.classList.remove("is-active"));
      chip.classList.add("is-active");
      activeFilter = chip.dataset.filter;
      renderShelves();
    });
  });
}

/* ---------------- reader modal ---------------- */

let currentBook = null;

function openReader(book) {
  currentBook = book;

  if (getStatus(book.path) === "unread") {
    setStatus(book.path, "reading");
  }

  document.getElementById("reader-title").textContent = book.title;
  document.getElementById("reader-path").textContent = book.path;
  document.getElementById("download-link").href = book.url;

  const finishedBtn = document.getElementById("mark-finished-btn");
  updateFinishedBtn(finishedBtn, book.path);

  const frame = document.getElementById("reader-frame");
  const viewerUrl = `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(book.url)}`;
  frame.src = viewerUrl;

  document.getElementById("reader-overlay").hidden = false;
  document.body.style.overflow = "hidden";

  renderShelves();
}

function updateFinishedBtn(btn, path) {
  const status = getStatus(path);
  btn.textContent = status === "finished" ? "Finished ✓" : "Mark as finished";
}

function closeReader() {
  document.getElementById("reader-overlay").hidden = true;
  document.getElementById("reader-frame").src = "about:blank";
  document.body.style.overflow = "";
  currentBook = null;
}

document.getElementById("close-reader").addEventListener("click", closeReader);
document.getElementById("reader-overlay").addEventListener("click", (e) => {
  if (e.target.id === "reader-overlay") closeReader();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !document.getElementById("reader-overlay").hidden) closeReader();
});

document.getElementById("mark-finished-btn").addEventListener("click", () => {
  if (!currentBook) return;
  const status = getStatus(currentBook.path);
  setStatus(currentBook.path, status === "finished" ? "reading" : "finished");
  updateFinishedBtn(document.getElementById("mark-finished-btn"), currentBook.path);
  renderShelves();
});
