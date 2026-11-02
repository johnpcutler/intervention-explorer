/* ── Intervention Explorer ─────────────────────────────── */

const STORAGE_KEY = "intervention-explorer-sessions";

let taxonomy = null;
let catById = {};
let state = null; // { activeSessionId, sessions: [] }
let activeDomains = new Set();
let activeBcw = new Set();
let searchQuery = "";
let activeConsiderId = null; // currently viewed consider card

// ── Persistence ──────────────────────────────────────────

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return null;
}

function saveState() {
  // Update timestamp on active session
  const session = getActiveSession();
  if (session) session.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getActiveSession() {
  if (!state) return null;
  return state.sessions.find(s => s.id === state.activeSessionId) || null;
}

function createSession() {
  return {
    id: crypto.randomUUID(),
    problem: "",
    considered: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function initState() {
  state = loadState();
  if (!state || !state.sessions || state.sessions.length === 0) {
    const session = createSession();
    state = { activeSessionId: session.id, sessions: [session] };
    saveState();
  }
  if (!getActiveSession()) {
    state.activeSessionId = state.sessions[0].id;
    saveState();
  }
}

// ── Domain labels ────────────────────────────────────────

const DOMAIN_SHORT = {
  "authority-governance": "Authority",
  "communication-information": "Communication",
  "culture-norms": "Culture",
  "work-design-delivery": "Work Design",
  "people-talent": "People",
  "capability-development": "Capability",
  "relationships-connection": "Relationships",
  "customer-external": "Customer",
  "environment-tools": "Environment",
  "manager-self": "Manager Self",
};

const DOMAINS = Object.keys(DOMAIN_SHORT);

const BCW_SHORT = {
  ED: "Education",
  TR: "Training",
  PE: "Persuasion",
  IN: "Incentivisation",
  CO: "Coercion",
  RE: "Restriction",
  ER: "Env. Restructuring",
  MO: "Modelling",
  EN: "Enablement",
};

const BCW_CODES = Object.keys(BCW_SHORT);

// ── Rendering helpers ────────────────────────────────────

function el(tag, attrs, ...children) {
  const e = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "className") e.className = v;
      else if (k === "style" && typeof v === "object") Object.assign(e.style, v);
      else if (k.startsWith("on")) e.addEventListener(k.slice(2).toLowerCase(), v);
      else e.setAttribute(k, v);
    }
  }
  for (const c of children) {
    if (c == null) continue;
    if (typeof c === "string" || typeof c === "number") e.appendChild(document.createTextNode(c));
    else if (Array.isArray(c)) c.forEach(x => x && e.appendChild(x));
    else e.appendChild(c);
  }
  return e;
}

// ── Search matching ──────────────────────────────────────

function matchesSearch(cat, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  const bcwFields = (cat.bcw_functions || []).flatMap(f => [f.code, f.name]);
  const fields = [
    cat.category,
    ...(cat.aliases || []),
    ...(cat.observations || []),
    cat.description,
    cat.assumption || "",
    ...bcwFields,
  ];
  return fields.some(f => f.toLowerCase().includes(q));
}

function matchesDomain(cat) {
  if (activeDomains.size === 0) return true;
  return activeDomains.has(cat.domain.primary);
}

function matchesBcw(cat) {
  if (activeBcw.size === 0) return true;
  return (cat.bcw_functions || []).some(f => activeBcw.has(f.code));
}

// ── Browse card ──────────────────────────────────────────

function renderBrowseCard(cat) {
  const session = getActiveSession();
  const isConsidered = session && session.considered[cat.id] != null;
  const preview = (cat.description || "").slice(0, 120) + ((cat.description || "").length > 120 ? "…" : "");
  const domainLabel = DOMAIN_SHORT[cat.domain.primary] || cat.domain.primary;

  const card = el("div", { className: `browse-card${isConsidered ? " in-consideration" : ""}` },
    el("div", { className: "browse-card-header" },
      el("span", { className: "browse-card-name" }, cat.category),
      el("span", { className: "browse-card-domain" }, domainLabel),
    ),
    preview ? el("div", { className: "browse-card-preview" }, preview) : null,
    el("div", { className: "browse-card-actions" },
      isConsidered
        ? el("button", { className: "small", disabled: "true" }, "Considering")
        : el("button", { className: "small primary", onClick: () => addToConsideration(cat.id) }, "+ Consider"),
    ),
  );
  card.dataset.id = cat.id;
  return card;
}

// ── Consider card ────────────────────────────────────────

function renderConsiderCard(cat) {
  const session = getActiveSession();
  const data = session.considered[cat.id] || { rating: null, notes: "" };

  // Rating pills
  const ratingBtns = [1, 2, 3, 4, 5].map(n =>
    el("button", {
      className: `rating-btn${data.rating === n ? " active" : ""}`,
      onClick: () => {
        data.rating = data.rating === n ? null : n;
        session.considered[cat.id] = data;
        saveState();
        renderAll();
      },
    }, String(n))
  );

  // Notes
  const notesArea = el("textarea", {
    placeholder: "Why this rating? What are you thinking?",
    rows: "2",
    value: data.notes || "",
    onInput: (e) => {
      data.notes = e.target.value;
      session.considered[cat.id] = data;
      saveState();
    },
  });
  notesArea.value = data.notes || "";

  // Challenges
  const challengeEls = (cat.challenges || []).map(ch =>
    el("div", {
      className: "ref-link",
      onClick: () => navigateTo(ch.explore_id),
    },
      el("div", { className: "ref-what-if" }, ch.what_if),
      el("div", { className: "ref-target" }, `→ #${ch.explore_id} ${ch.explore_category}`),
    )
  );

  // Clarifications
  const clarifyEls = (cat.clarifications || []).map(cl =>
    el("div", {
      className: "ref-link",
      onClick: () => navigateTo(cl.id),
    },
      el("span", { className: "ref-for" }, `For ${cl.for}, refer to `),
      el("span", { className: "ref-target" }, `#${cl.id} ${cl.category}`),
    )
  );

  // Examples (collapsible, 3-column grid — open by default)
  let examplesOpen = true;
  const examplesGrid = el("div", { className: "examples-grid" });
  (cat.examples || []).forEach(ex => {
    examplesGrid.appendChild(el("div", { className: `example-quote ${ex.outcome}` },
      el("div", { className: `example-label ${ex.outcome}` },
        ex.outcome === "worked" ? "Worked" :
        ex.outcome === "informative_miss" ? "Informative Miss" : "Dampened"
      ),
      el("div", null, ex.quote),
    ));
  });
  const examplesBody = el("div", null, examplesGrid);

  const examplesToggle = el("button", {
    className: "examples-toggle",
    onClick: () => {
      examplesOpen = !examplesOpen;
      examplesBody.style.display = examplesOpen ? "block" : "none";
      examplesToggle.textContent = examplesOpen ? "Hide examples" : "Show examples";
    },
  }, "Hide examples");

  // BCW pills
  const bcwPills = (cat.bcw_functions || []).map(f =>
    el("span", { className: "bcw-pill" }, `${f.code} ${f.name}`)
  );

  // Observations
  const obsList = el("ul", { className: "consider-observations" });
  (cat.observations || []).forEach(o =>
    obsList.appendChild(el("li", null, o))
  );

  const card = el("div", { className: "consider-card", id: `consider-${cat.id}` },
    el("div", { className: "consider-card-header" },
      el("div", { className: "consider-card-title" },
        el("h3", null, cat.category),
        el("div", { className: "consider-card-aliases" }, (cat.aliases || []).join(" · ")),
      ),
      el("button", {
        className: "small danger",
        onClick: () => removeFromConsideration(cat.id),
      }, "Remove"),
    ),
    el("div", { className: "consider-card-body" },
      // Rating & Notes — at the top for quick access
      el("div", { className: "consider-section consider-rating-notes" },
        el("div", { className: "rating-notes-row" },
          el("div", { className: "rating-inline" },
            el("span", { className: "consider-section-label" }, "Fit "),
            ...ratingBtns,
          ),
          el("div", { className: "notes-inline" },
            notesArea,
          ),
        ),
      ),

      // Description
      el("div", { className: "consider-section" },
        el("div", { className: "consider-description" }, cat.description),
      ),

      // Change mechanisms (BCW)
      bcwPills.length > 0 ? el("div", { className: "consider-section" },
        el("div", { className: "consider-section-label" }, "Change mechanisms"),
        el("div", { className: "bcw-pills" }, bcwPills),
      ) : null,

      // Assumption
      el("div", { className: "consider-section" },
        el("div", { className: "consider-section-label" }, "You are betting that..."),
        el("div", { className: "consider-assumption" }, cat.assumption || ""),
      ),

      // Observations
      el("div", { className: "consider-section" },
        el("div", { className: "consider-section-label" }, "Observable signals"),
        obsList,
      ),

      // Examples — right after observations
      el("div", { className: "consider-section" },
        examplesToggle,
        examplesBody,
      ),

      // Challenges
      challengeEls.length > 0 ? el("div", { className: "consider-section" },
        el("div", { className: "consider-section-label" }, "What if..."),
        ...challengeEls,
      ) : null,

      // Clarifications
      clarifyEls.length > 0 ? el("div", { className: "consider-section" },
        el("div", { className: "consider-section-label" }, "Related"),
        ...clarifyEls,
      ) : null,
    ),
  );
  return card;
}

// ── Actions ──────────────────────────────────────────────

function scrollConsiderTo(cardEl) {
  const list = document.getElementById("consider-list");
  const nav = document.getElementById("consider-nav");
  const navHeight = nav ? nav.offsetHeight : 0;
  const listRect = list.getBoundingClientRect();
  const cardRect = cardEl.getBoundingClientRect();
  const offset = cardRect.top - listRect.top + list.scrollTop - navHeight - 4;
  list.scrollTo({ top: offset, behavior: "smooth" });
}

function addToConsideration(id) {
  const session = getActiveSession();
  if (!session) return;
  session.considered[id] = { rating: null, notes: "" };
  activeConsiderId = id;
  saveState();
  renderAll();
}

function removeFromConsideration(id) {
  const session = getActiveSession();
  if (!session) return;
  delete session.considered[id];
  saveState();
  renderAll();
}

function navigateTo(id) {
  const session = getActiveSession();
  const cat = catById[id];
  if (!cat) return;

  // If already in consideration, select it
  if (session && session.considered[id] != null) {
    activeConsiderId = id;
    renderConsideration();
    return;
  }

  // Otherwise find in browse and highlight
  const browseList = document.getElementById("browse-list");
  const browseCard = browseList.querySelector(`[data-id="${id}"]`);
  if (browseCard) {
    browseCard.scrollIntoView({ behavior: "smooth", block: "center" });
    browseCard.style.background = "var(--accent-dim)";
    setTimeout(() => browseCard.style.background = "", 1500);
  } else {
    // Item is filtered out — clear all filters to show it
    searchQuery = "";
    activeDomains.clear();
    activeBcw.clear();
    document.getElementById("search-input").value = "";
    renderAll();
    setTimeout(() => {
      const card = browseList.querySelector(`[data-id="${id}"]`);
      if (card) {
        card.scrollIntoView({ behavior: "smooth", block: "center" });
        card.style.background = "var(--accent-dim)";
        setTimeout(() => card.style.background = "", 1500);
      }
    }, 50);
  }
}

// ── Export ────────────────────────────────────────────────

function exportToClipboard() {
  const session = getActiveSession();
  if (!session) return;

  let text = `Problem: ${session.problem || "(not defined)"}\n\n`;
  text += `Interventions under consideration:\n\n`;

  const entries = Object.entries(session.considered)
    .map(([id, data]) => ({ cat: catById[id], data, id: Number(id) }))
    .filter(e => e.cat)
    .sort((a, b) => (b.data.rating || 0) - (a.data.rating || 0));

  entries.forEach((e, i) => {
    const rating = e.data.rating ? `Rating: ${e.data.rating}/5` : "Unrated";
    text += `${i + 1}. [${rating}] ${e.cat.category}\n`;
    if (e.data.notes) text += `   Notes: ${e.data.notes}\n`;
    text += `   Assumption: ${e.cat.assumption || ""}\n\n`;
  });

  navigator.clipboard.writeText(text).then(() => {
    const btn = document.getElementById("btn-export");
    const orig = btn.textContent;
    btn.textContent = "Copied!";
    setTimeout(() => btn.textContent = orig, 1500);
  });
}

// ── Session management ───────────────────────────────────

function handleNewSession() {
  const session = createSession();
  state.sessions.push(session);
  state.activeSessionId = session.id;
  saveState();
  renderAll();
  document.getElementById("problem-input").focus();
}

function handleDeleteSession() {
  if (state.sessions.length <= 1) {
    if (confirm("This is your only session. Clear it and start fresh?")) {
      const session = createSession();
      state.sessions = [session];
      state.activeSessionId = session.id;
      saveState();
      renderAll();
    }
    return;
  }
  const session = getActiveSession();
  const preview = (session.problem || "Untitled").slice(0, 40);
  if (!confirm(`Delete session "${preview}"?`)) return;
  state.sessions = state.sessions.filter(s => s.id !== session.id);
  state.activeSessionId = state.sessions[0].id;
  saveState();
  renderAll();
}

function handleClearAll() {
  if (!confirm("Delete ALL sessions? This cannot be undone.")) return;
  const session = createSession();
  state = { activeSessionId: session.id, sessions: [session] };
  saveState();
  renderAll();
}

function handleSessionSwitch(e) {
  state.activeSessionId = e.target.value;
  saveState();
  renderAll();
}

// ── Render ───────────────────────────────────────────────

function renderSessionSelect() {
  const select = document.getElementById("session-select");
  select.innerHTML = "";
  state.sessions.forEach(s => {
    const preview = (s.problem || "New session").slice(0, 50) || "New session";
    const date = new Date(s.updatedAt).toLocaleDateString();
    const opt = el("option", { value: s.id }, `${preview} (${date})`);
    if (s.id === state.activeSessionId) opt.selected = true;
    select.appendChild(opt);
  });
}

function renderDomainFilters() {
  const container = document.getElementById("domain-filters");
  container.innerHTML = "";
  DOMAINS.forEach(d => {
    const pill = el("button", {
      className: `domain-pill${activeDomains.has(d) ? " active" : ""}`,
      onClick: () => {
        if (activeDomains.has(d)) activeDomains.delete(d);
        else activeDomains.add(d);
        renderBrowse();
        renderDomainFilters();
      },
    }, DOMAIN_SHORT[d]);
    container.appendChild(pill);
  });
}

function renderBcwFilters() {
  const container = document.getElementById("bcw-filters");
  container.innerHTML = "";
  BCW_CODES.forEach(code => {
    const pill = el("button", {
      className: `bcw-filter-pill${activeBcw.has(code) ? " active" : ""}`,
      title: BCW_SHORT[code],
      onClick: () => {
        if (activeBcw.has(code)) activeBcw.delete(code);
        else activeBcw.add(code);
        renderBrowse();
        renderBcwFilters();
      },
    }, `${code}`);
    container.appendChild(pill);
  });
}

function renderBrowse() {
  const list = document.getElementById("browse-list");
  list.innerHTML = "";
  const session = getActiveSession();
  let count = 0;

  const cats = taxonomy.categories.filter(c =>
    matchesSearch(c, searchQuery) && matchesDomain(c) && matchesBcw(c)
  );

  cats.forEach(cat => {
    list.appendChild(renderBrowseCard(cat));
    count++;
  });

  document.getElementById("browse-count").textContent = `(${count})`;
}

function renderConsideration() {
  const list = document.getElementById("consider-list");
  const empty = document.getElementById("consider-empty");
  const navContainer = document.getElementById("consider-nav");
  list.innerHTML = "";
  navContainer.innerHTML = "";

  const session = getActiveSession();
  if (!session) return;

  const entries = Object.keys(session.considered)
    .map(id => ({ cat: catById[Number(id)], id: Number(id) }))
    .filter(e => e.cat)
    .sort((a, b) => {
      const ra = session.considered[a.id]?.rating || 0;
      const rb = session.considered[b.id]?.rating || 0;
      return rb - ra;
    });

  if (entries.length === 0) {
    empty.style.display = "block";
    navContainer.style.display = "none";
    activeConsiderId = null;
    document.getElementById("consider-count").textContent = "(0)";
    return;
  }

  empty.style.display = "none";
  navContainer.style.display = "flex";
  document.getElementById("consider-count").textContent = `(${entries.length})`;

  // If no active selection or active was removed, select first
  if (!activeConsiderId || !session.considered[activeConsiderId]) {
    activeConsiderId = entries[0].id;
  }

  // Build nav pills
  entries.forEach(e => {
    const data = session.considered[e.id] || {};
    const ratingLabel = data.rating ? `${data.rating}` : "–";
    const ratingClass = data.rating ? ` rated-${data.rating}` : "";
    const isActive = e.id === activeConsiderId;
    const navItem = el("button", {
      className: `consider-nav-item${isActive ? " selected" : ""}`,
      onClick: () => {
        activeConsiderId = e.id;
        renderConsideration();
      },
    },
      el("span", { className: `nav-rating${ratingClass}` }, ratingLabel),
      el("span", { className: "nav-name" }, e.cat.category),
    );
    navContainer.appendChild(navItem);
  });

  // Show only the active card
  const activeEntry = entries.find(e => e.id === activeConsiderId);
  if (activeEntry) {
    list.appendChild(renderConsiderCard(activeEntry.cat));
  }
}

function renderAll() {
  renderSessionSelect();
  renderDomainFilters();
  renderBcwFilters();

  const session = getActiveSession();
  document.getElementById("problem-input").value = session ? session.problem : "";

  renderBrowse();
  renderConsideration();
}

// ── Init ─────────────────────────────────────────────────

async function init() {
  const resp = await fetch("taxonomy.json");
  taxonomy = await resp.json();
  taxonomy.categories.forEach(c => catById[c.id] = c);

  initState();

  // Wire events
  document.getElementById("problem-input").addEventListener("input", e => {
    const session = getActiveSession();
    if (session) {
      session.problem = e.target.value;
      saveState();
      // Update session select preview
      renderSessionSelect();
    }
  });

  document.getElementById("search-input").addEventListener("input", e => {
    searchQuery = e.target.value;
    renderBrowse();
  });

  document.getElementById("btn-new-session").addEventListener("click", handleNewSession);
  document.getElementById("btn-delete-session").addEventListener("click", handleDeleteSession);
  document.getElementById("btn-clear-all").addEventListener("click", handleClearAll);
  document.getElementById("session-select").addEventListener("change", handleSessionSwitch);
  document.getElementById("btn-export").addEventListener("click", exportToClipboard);

  // Help overlay
  const helpOverlay = document.getElementById("help-overlay");
  document.getElementById("btn-help").addEventListener("click", () => {
    helpOverlay.style.display = "flex";
  });
  document.getElementById("help-close").addEventListener("click", () => {
    helpOverlay.style.display = "none";
  });
  helpOverlay.addEventListener("click", (e) => {
    if (e.target === helpOverlay) helpOverlay.style.display = "none";
  });

  renderAll();
}

init();
