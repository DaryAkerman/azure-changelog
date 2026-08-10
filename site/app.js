(() => {
  "use strict";

  const PAGE_SIZE = 24;

  const state = {
    all: [],
    filtered: [],
    visible: PAGE_SIZE,
    search: "",
    status: "all",
    category: "all",
  };

  const els = {
    cards: document.getElementById("cards"),
    template: document.getElementById("card-template"),
    search: document.getElementById("search"),
    statusFilters: document.getElementById("status-filters"),
    categoryFilter: document.getElementById("category-filter"),
    loadMore: document.getElementById("load-more"),
    emptyState: document.getElementById("empty-state"),
    clearFilters: document.getElementById("clear-filters"),
    resultsMeta: document.getElementById("results-meta"),
    syncText: document.getElementById("sync-text"),
    statTotal: document.getElementById("stat-total"),
    statWeek: document.getElementById("stat-week"),
    statGa: document.getElementById("stat-ga"),
    statPreview: document.getElementById("stat-preview"),
    themeToggle: document.getElementById("theme-toggle"),
  };

  const dateFmt = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" });

  // ---------- theme ----------

  function initTheme() {
    const saved = localStorage.getItem("theme");
    if (saved === "light" || saved === "dark") {
      document.documentElement.setAttribute("data-theme", saved);
    }
  }

  function toggleTheme() {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const current = document.documentElement.getAttribute("data-theme") || (prefersDark ? "dark" : "light");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
  }

  els.themeToggle.addEventListener("click", toggleTheme);

  // ---------- data loading ----------

  async function loadData() {
    const [updatesRes, metaRes] = await Promise.all([
      fetch("data/updates.json", { cache: "no-store" }),
      fetch("data/meta.json", { cache: "no-store" }).catch(() => null),
    ]);

    state.all = updatesRes.ok ? await updatesRes.json() : [];

    if (metaRes && metaRes.ok) {
      const meta = await metaRes.json();
      renderSync(meta);
    } else {
      els.syncText.textContent = "Feed ready";
    }

    populateCategories(state.all);
    renderStats(state.all);
    applyFilters();
  }

  function renderSync(meta) {
    if (!meta?.lastRun) {
      els.syncText.textContent = "Feed ready";
      return;
    }
    const d = new Date(meta.lastRun);
    const mins = Math.round((Date.now() - d.getTime()) / 60000);
    let when;
    if (mins < 1) when = "just now";
    else if (mins < 60) when = `${mins}m ago`;
    else if (mins < 60 * 24) when = `${Math.round(mins / 60)}h ago`;
    else when = `${Math.round(mins / (60 * 24))}d ago`;
    els.syncText.textContent = `Synced ${when}`;
    els.syncText.title = d.toLocaleString();
  }

  function renderStats(items) {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const inWeek = items.filter((i) => new Date(i.created).getTime() >= weekAgo).length;
    const ga = items.filter((i) => i.statusClass === "ga").length;
    const preview = items.filter((i) => i.statusClass === "preview").length;

    els.statTotal.textContent = items.length.toLocaleString();
    els.statWeek.textContent = inWeek.toLocaleString();
    els.statGa.textContent = ga.toLocaleString();
    els.statPreview.textContent = preview.toLocaleString();
  }

  function populateCategories(items) {
    const counts = new Map();
    for (const item of items) {
      for (const cat of item.categories || []) {
        counts.set(cat, (counts.get(cat) || 0) + 1);
      }
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    for (const [cat, count] of sorted) {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = `${cat} (${count})`;
      els.categoryFilter.appendChild(opt);
    }
  }

  // ---------- filtering ----------

  function applyFilters() {
    const q = state.search.trim().toLowerCase();

    state.filtered = state.all.filter((item) => {
      if (state.status !== "all" && item.statusClass !== state.status) return false;
      if (state.category !== "all" && !(item.categories || []).includes(state.category)) return false;
      if (q) {
        const haystack = [
          item.title,
          item.summary,
          ...(item.categories || []),
          ...(item.products || []),
          ...(item.tags || []),
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    state.visible = PAGE_SIZE;
    render();
  }

  // ---------- rendering ----------

  function statusBadgeLabel(item) {
    return item.statusLabel || "Update";
  }

  function buildCard(item) {
    const node = els.template.content.firstElementChild.cloneNode(true);

    const badge = node.querySelector(".badge");
    badge.textContent = statusBadgeLabel(item);
    badge.classList.add(item.statusClass || "other");

    const date = node.querySelector(".card-date");
    const d = item.created ? new Date(item.created) : null;
    if (d && !isNaN(d)) {
      date.textContent = dateFmt.format(d);
      date.setAttribute("datetime", d.toISOString());
    } else {
      date.remove();
    }

    const titleLink = node.querySelector(".card-title a");
    titleLink.textContent = item.title;
    titleLink.href = item.url;

    const summary = node.querySelector(".card-summary");
    if (item.summary) {
      summary.textContent = item.summary;
    } else {
      summary.remove();
    }

    const points = node.querySelector(".card-points");
    if (item.keyPoints && item.keyPoints.length) {
      for (const point of item.keyPoints) {
        const li = document.createElement("li");
        li.textContent = point;
        points.appendChild(li);
      }
    } else {
      points.remove();
    }

    const tagsWrap = node.querySelector(".card-tags");
    const tagValues = [...(item.categories || []), ...(item.products || [])].slice(0, 6);
    if (tagValues.length) {
      for (const t of tagValues) {
        const span = document.createElement("span");
        span.className = "tag";
        span.textContent = t;
        tagsWrap.appendChild(span);
      }
    } else {
      tagsWrap.remove();
    }

    const linksWrap = node.querySelector(".card-links");
    const azureLink = document.createElement("a");
    azureLink.href = item.url;
    azureLink.target = "_blank";
    azureLink.rel = "noopener";
    azureLink.textContent = "View on Azure ↗";
    linksWrap.appendChild(azureLink);

    if (item.learnMoreUrl) {
      const learnLink = document.createElement("a");
      learnLink.href = item.learnMoreUrl;
      learnLink.target = "_blank";
      learnLink.rel = "noopener";
      learnLink.textContent = "Learn more ↗";
      linksWrap.appendChild(learnLink);
    }

    return node;
  }

  function render() {
    els.cards.innerHTML = "";

    const slice = state.filtered.slice(0, state.visible);
    const frag = document.createDocumentFragment();
    for (const item of slice) frag.appendChild(buildCard(item));
    els.cards.appendChild(frag);

    const total = state.filtered.length;
    els.resultsMeta.textContent = total
      ? `Showing ${Math.min(state.visible, total).toLocaleString()} of ${total.toLocaleString()} updates`
      : "";

    els.emptyState.hidden = total !== 0;
    els.cards.hidden = total === 0;
    els.loadMore.hidden = state.visible >= total;
  }

  // ---------- events ----------

  let searchTimer;
  els.search.addEventListener("input", (e) => {
    clearTimeout(searchTimer);
    const value = e.target.value;
    searchTimer = setTimeout(() => {
      state.search = value;
      applyFilters();
    }, 180);
  });

  els.statusFilters.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;
    state.status = btn.dataset.status;
    for (const chip of els.statusFilters.querySelectorAll(".chip")) {
      chip.classList.toggle("is-active", chip === btn);
    }
    applyFilters();
  });

  els.categoryFilter.addEventListener("change", (e) => {
    state.category = e.target.value;
    applyFilters();
  });

  els.loadMore.addEventListener("click", () => {
    state.visible += PAGE_SIZE;
    render();
  });

  els.clearFilters.addEventListener("click", () => {
    state.search = "";
    state.status = "all";
    state.category = "all";
    els.search.value = "";
    els.categoryFilter.value = "all";
    for (const chip of els.statusFilters.querySelectorAll(".chip")) {
      chip.classList.toggle("is-active", chip.dataset.status === "all");
    }
    applyFilters();
  });

  // ---------- init ----------

  initTheme();
  loadData().catch((err) => {
    console.error(err);
    els.resultsMeta.textContent = "Couldn't load update data.";
  });
})();
