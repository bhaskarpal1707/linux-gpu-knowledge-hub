/**
 * ============================================================
 *  Linux GPU & AI/ML Knowledge Hub — Core Application Logic
 *  Loaded on every page. Provides data management, sidebar,
 *  rendering helpers, clipboard, modals, and keyboard shortcuts.
 * ============================================================
 */

'use strict';

/* ─────────────────────────────────────────────
   GLOBAL STATE
   ───────────────────────────────────────────── */

/** @type {{ categories: Array, commands: Array }} */
let commandsData = { categories: [], commands: [] };

/** @type {string[]} Array of favourited command IDs */
let favorites = [];

/** @type {string[]} Array of recently-viewed command IDs (max 10) */
let recentlyViewed = [];

/** Page context flags — set once during init */
const pageCtx = {
  isIndex: false,
  isExplorer: false,
  isGraph: false,
  isTerminal: false,
  /** Prefix for links pointing *to* pages/ from root, or '' from pages/ */
  pagesPrefix: '',
  /** Prefix for links pointing back to root from pages/ */
  rootPrefix: '',
  /** Path to commands.json relative to the current page */
  jsonPath: '',
};

/* ─────────────────────────────────────────────
   PAGE DETECTION
   ───────────────────────────────────────────── */

/**
 * Determine which page we're on and set path prefixes accordingly.
 */
function detectPageContext() {
  const path = window.location.pathname.toLowerCase();

  pageCtx.isIndex    = /\/(index\.html)?$/.test(path) || path.endsWith('/');
  pageCtx.isExplorer = path.includes('explorer.html');
  pageCtx.isGraph    = path.includes('graph.html');
  pageCtx.isTerminal = path.includes('terminal.html');

  const isInPagesDir = path.includes('/pages/');

  if (isInPagesDir) {
    pageCtx.pagesPrefix = '';          // sibling pages — no prefix
    pageCtx.rootPrefix  = '../';       // back to root
    pageCtx.jsonPath    = '../assets/data/commands.json';
  } else {
    pageCtx.pagesPrefix = 'pages/';    // into pages/ dir
    pageCtx.rootPrefix  = '';          // already at root
    pageCtx.jsonPath    = 'assets/data/commands.json';
  }
}

/* ─────────────────────────────────────────────
   DATA MANAGEMENT
   ───────────────────────────────────────────── */

/**
 * Fetch and parse commands.json.
 * @param {string} [jsonPath] – override path to JSON file
 * @returns {Promise<{categories: Array, commands: Array}>}
 */
async function loadData(jsonPath) {
  const url = jsonPath || pageCtx.jsonPath;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    commandsData = await res.json();
    return commandsData;
  } catch (err) {
    console.error('[app] Failed to load commands data:', err);
    commandsData = { categories: [], commands: [] };
    return commandsData;
  }
}

/* ─────────────────────────────────────────────
   LOOKUP HELPERS
   ───────────────────────────────────────────── */

/**
 * @param {string} id
 * @returns {object|undefined}
 */
const getCommandById = (id) => commandsData.commands.find((c) => c.id === id);

/**
 * @param {string} id
 * @returns {object|undefined}
 */
const getCategoryById = (id) => commandsData.categories.find((c) => c.id === id);

/**
 * @param {string} categoryId
 * @returns {object[]}
 */
const getCommandsByCategory = (categoryId) =>
  commandsData.commands.filter((c) => c.categoryId === categoryId);

/**
 * Resolve a command's relatedCommands IDs to full objects.
 * @param {object} command
 * @returns {object[]}
 */
const getRelatedCommands = (command) =>
  (command.relatedCommands || [])
    .map((id) => getCommandById(id))
    .filter(Boolean);

/* ─────────────────────────────────────────────
   LOCALSTORAGE — FAVORITES
   ───────────────────────────────────────────── */

const LS_FAVORITES = 'cmdHub_favorites';
const LS_RECENT    = 'cmdHub_recent';
const LS_SIDEBAR   = 'cmdHub_sidebar';

/**
 * Load favourites from localStorage.
 * @returns {string[]}
 */
function loadFavorites() {
  try {
    favorites = JSON.parse(localStorage.getItem(LS_FAVORITES)) || [];
  } catch {
    favorites = [];
  }
  return favorites;
}

/** Persist favourites to localStorage. */
function saveFavorites() {
  localStorage.setItem(LS_FAVORITES, JSON.stringify(favorites));
}

/**
 * Toggle a command's favourite status.
 * @param {string} commandId
 */
function toggleFavorite(commandId) {
  const idx = favorites.indexOf(commandId);
  if (idx === -1) {
    favorites.push(commandId);
  } else {
    favorites.splice(idx, 1);
  }
  saveFavorites();
  updateFavoritesUI();
}

/**
 * @param {string} commandId
 * @returns {boolean}
 */
const isFavorite = (commandId) => favorites.includes(commandId);

/** Refresh all visible favourite-related UI (buttons, sidebar count). */
function updateFavoritesUI() {
  // Update all favourite toggle buttons on the page
  document.querySelectorAll('.favorite-btn').forEach((btn) => {
    const id = btn.dataset.commandId;
    const icon = btn.querySelector('i');
    if (isFavorite(id)) {
      btn.classList.add('active');
      if (icon) { icon.className = 'bi bi-star-fill'; }
    } else {
      btn.classList.remove('active');
      if (icon) { icon.className = 'bi bi-star'; }
    }
  });

  // Update sidebar favourites count
  const countEl = document.getElementById('favorites-count');
  if (countEl) countEl.textContent = favorites.length;
}

/* ─────────────────────────────────────────────
   LOCALSTORAGE — RECENTLY VIEWED
   ───────────────────────────────────────────── */

/**
 * Load recently-viewed list from localStorage.
 * @returns {string[]}
 */
function loadRecentlyViewed() {
  try {
    recentlyViewed = JSON.parse(localStorage.getItem(LS_RECENT)) || [];
  } catch {
    recentlyViewed = [];
  }
  return recentlyViewed;
}

/** Persist recently-viewed to localStorage. */
function saveRecentlyViewed() {
  localStorage.setItem(LS_RECENT, JSON.stringify(recentlyViewed));
}

/**
 * Add a command to the front of the recently-viewed list (max 10).
 * @param {string} commandId
 */
function addToRecentlyViewed(commandId) {
  recentlyViewed = recentlyViewed.filter((id) => id !== commandId);
  recentlyViewed.unshift(commandId);
  if (recentlyViewed.length > 10) recentlyViewed.length = 10;
  saveRecentlyViewed();

  const countEl = document.getElementById('recent-count');
  if (countEl) countEl.textContent = recentlyViewed.length;
}

/* ─────────────────────────────────────────────
   SIDEBAR
   ───────────────────────────────────────────── */

/**
 * Build and populate the sidebar navigation.
 */
function initSidebar() {
  const nav = document.getElementById('sidebar-nav');
  if (!nav) return;

  const { pagesPrefix, rootPrefix } = pageCtx;

  // Determine active page for highlighting
  const currentPage = (() => {
    if (pageCtx.isIndex)    return 'dashboard';
    if (pageCtx.isExplorer) return 'explorer';
    if (pageCtx.isGraph)    return 'graph';
    if (pageCtx.isTerminal) return 'terminal';
    return '';
  })();

  let html = '';

  // ── Primary Nav ──
  html += navItem('dashboard', `${rootPrefix}index.html`, 'bi-grid-1x2', 'Dashboard', currentPage);
  html += navItem('graph',     `${pagesPrefix}graph.html`, 'bi-diagram-3', 'Graph View', currentPage);
  html += navItem('terminal',  `${pagesPrefix}terminal.html`, 'bi-terminal', 'Terminal', currentPage);

  // ── Divider ──
  html += '<div class="sidebar-divider"></div>';
  html += '<div class="sidebar-section-title">CATEGORIES</div>';

  // ── Categories ──
  for (const cat of commandsData.categories) {
    const href = `${pagesPrefix}explorer.html?cat=${cat.id}`;
    const isActive = pageCtx.isExplorer && new URLSearchParams(window.location.search).get('cat') === cat.id;
    html += `
      <a href="${href}" class="sidebar-nav-item${isActive ? ' active' : ''}" data-page="cat-${cat.id}">
        <i class="bi ${cat.icon}"></i>
        <span class="sidebar-nav-label">${cat.name}</span>
      </a>`;
  }

  // ── Quick Access ──
  html += '<div class="sidebar-divider"></div>';
  html += '<div class="sidebar-section-title">QUICK ACCESS</div>';
  html += `
    <a href="${pagesPrefix}explorer.html?view=favorites" class="sidebar-nav-item" data-page="favorites">
      <i class="bi bi-star"></i>
      <span class="sidebar-nav-label">Favorites</span>
      <span class="sidebar-badge" id="favorites-count">${favorites.length}</span>
    </a>
    <a href="${pagesPrefix}explorer.html?view=recent" class="sidebar-nav-item" data-page="recent">
      <i class="bi bi-clock-history"></i>
      <span class="sidebar-nav-label">Recently Viewed</span>
      <span class="sidebar-badge" id="recent-count">${recentlyViewed.length}</span>
    </a>`;

  nav.innerHTML = html;

  // ── Mobile overlay ──
  const overlay = document.getElementById('sidebar-overlay');
  if (overlay) {
    overlay.addEventListener('click', () => closeSidebarMobile());
  }

  // ── Collapse toggle ──
  const toggleBtn = document.getElementById('sidebar-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', toggleSidebar);
  }

  // Restore collapse state
  const sidebar = document.getElementById('sidebar');
  if (sidebar && localStorage.getItem(LS_SIDEBAR) === 'collapsed') {
    sidebar.classList.add('sidebar--collapsed');
  }
}

/**
 * Generate HTML for a single sidebar nav item.
 */
function navItem(page, href, icon, label, currentPage) {
  const active = page === currentPage ? ' active' : '';
  return `
    <a href="${href}" class="sidebar-nav-item${active}" data-page="${page}">
      <i class="bi ${icon}"></i>
      <span class="sidebar-nav-label">${label}</span>
    </a>`;
}

/** Toggle sidebar collapsed state and persist. */
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  sidebar.classList.toggle('sidebar--collapsed');
  localStorage.setItem(
    LS_SIDEBAR,
    sidebar.classList.contains('sidebar--collapsed') ? 'collapsed' : 'expanded'
  );
}

/** Close sidebar on mobile (remove open class, hide overlay). */
function closeSidebarMobile() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) sidebar.classList.remove('sidebar--open');
  if (overlay) overlay.classList.remove('active');
}

/** Open sidebar on mobile. */
function openSidebarMobile() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (sidebar) sidebar.classList.add('sidebar--open');
  if (overlay) overlay.classList.add('active');
}

/* ─────────────────────────────────────────────
   RENDERING — COMMAND CARD
   ───────────────────────────────────────────── */

/**
 * Render a compact command card.
 * @param {object} command
 * @returns {string} HTML
 */
function renderCommandCard(command) {
  const cat = getCategoryById(command.categoryId);
  const favClass = isFavorite(command.id) ? 'active' : '';
  const favIcon  = isFavorite(command.id) ? 'bi-star-fill' : 'bi-star';

  const tagsHtml = (command.tags || [])
    .slice(0, 3)
    .map((t) => `<span class="command-tag">${escapeHtml(t)}</span>`)
    .join('');

  return `
    <div class="command-card" data-command-id="${command.id}" tabindex="0">
      <div class="command-card-header">
        <span class="command-name">${escapeHtml(command.command)}</span>
        <div class="command-card-actions">
          <button class="btn btn--icon favorite-btn ${favClass}" data-command-id="${command.id}" title="Toggle favourite">
            <i class="bi ${favIcon}"></i>
          </button>
          <button class="btn btn--icon copy-btn" data-copy="${escapeAttr(command.command)}" title="Copy command">
            <i class="bi bi-clipboard"></i>
          </button>
        </div>
      </div>
      <p class="command-purpose">${escapeHtml(command.purpose)}</p>
      <div class="command-card-footer">
        <span class="command-complexity badge badge--${command.complexity}">${command.complexity}</span>
        ${cat ? `<span class="command-category-dot" style="background:${cat.color}" title="${escapeAttr(cat.name)}"></span>` : ''}
        <div class="command-tags">${tagsHtml}</div>
      </div>
    </div>`;
}

/* ─────────────────────────────────────────────
   RENDERING — COMMAND DETAIL
   ───────────────────────────────────────────── */

/**
 * Render a full command detail view.
 * @param {object} command
 * @returns {string} HTML
 */
function renderCommandDetail(command) {
  const cat = getCategoryById(command.categoryId);
  const favIcon = isFavorite(command.id) ? 'bi-star-fill' : 'bi-star';
  const favClass = isFavorite(command.id) ? 'active' : '';

  let html = `
    <div class="command-detail">
      <div class="command-detail-header">
        <div class="command-detail-title-row">
          <h2 class="command-detail-name">${escapeHtml(command.name)}</h2>
          <div class="command-detail-actions">
            <button class="btn btn--icon favorite-btn ${favClass}" data-command-id="${command.id}" title="Toggle favourite">
              <i class="bi ${favIcon}"></i>
            </button>
            <button class="btn btn--icon copy-btn" data-copy="${escapeAttr(command.command)}" title="Copy command">
              <i class="bi bi-clipboard"></i>
            </button>
            <button class="btn btn--icon detail-close-btn" title="Close" onclick="hideCommandDetail()">
              <i class="bi bi-x-lg"></i>
            </button>
          </div>
        </div>
        ${cat ? `<span class="badge" style="background:${cat.color}20;color:${cat.color}"><i class="bi ${cat.icon}"></i> ${escapeHtml(cat.name)}</span>` : ''}
        <span class="badge badge--${command.complexity}">${command.complexity}</span>
      </div>

      <div class="command-detail-section">
        <h4>Command</h4>
        <div class="command-detail-code">
          <code>${escapeHtml(command.command)}</code>
          <button class="btn btn--icon copy-btn" data-copy="${escapeAttr(command.command)}" title="Copy">
            <i class="bi bi-clipboard"></i>
          </button>
        </div>
      </div>

      <div class="command-detail-section">
        <h4>Purpose</h4>
        <p>${escapeHtml(command.purpose)}</p>
      </div>`;

  if (command.syntax) {
    html += `
      <div class="command-detail-section">
        <h4>Syntax</h4>
        <div class="command-detail-code">
          <code>${escapeHtml(command.syntax)}</code>
        </div>
      </div>`;
  }

  if (command.example) {
    html += `
      <div class="command-detail-section">
        <h4>Example</h4>
        <div class="command-detail-code">
          <code>${escapeHtml(command.example)}</code>
          <button class="btn btn--icon copy-btn" data-copy="${escapeAttr(command.example)}" title="Copy">
            <i class="bi bi-clipboard"></i>
          </button>
        </div>
      </div>`;
  }

  if (command.usefulWhen && command.usefulWhen.length) {
    html += `
      <div class="command-detail-section">
        <h4>Useful When</h4>
        <ul class="command-detail-list">
          ${command.usefulWhen.map((u) => `<li>${escapeHtml(u)}</li>`).join('')}
        </ul>
      </div>`;
  }

  if (command.installation) {
    html += `
      <div class="command-detail-section">
        <h4>Installation</h4>
        <div class="command-detail-code">
          <code>${escapeHtml(command.installation)}</code>
          <button class="btn btn--icon copy-btn" data-copy="${escapeAttr(command.installation)}" title="Copy">
            <i class="bi bi-clipboard"></i>
          </button>
        </div>
      </div>`;
  }

  if (command.notes) {
    html += `
      <div class="command-detail-section">
        <h4>Notes</h4>
        <p>${escapeHtml(command.notes)}</p>
      </div>`;
  }

  // Related commands
  const related = getRelatedCommands(command);
  if (related.length) {
    html += `
      <div class="command-detail-section">
        <h4>Related Commands</h4>
        <div class="command-detail-related">
          ${related.map((r) => `
            <button class="btn btn--outline related-cmd-btn" data-command-id="${r.id}">
              <i class="bi bi-link-45deg"></i> ${escapeHtml(r.command)}
            </button>`).join('')}
        </div>
      </div>`;
  }

  // Tags
  if (command.tags && command.tags.length) {
    html += `
      <div class="command-detail-section">
        <h4>Tags</h4>
        <div class="command-tags">
          ${command.tags.map((t) => `<span class="command-tag">${escapeHtml(t)}</span>`).join('')}
        </div>
      </div>`;
  }

  html += '</div>';
  return html;
}

/* ─────────────────────────────────────────────
   RENDERING — CATEGORY CARD
   ───────────────────────────────────────────── */

/**
 * Render a category overview card.
 * @param {object} category
 * @param {number} commandCount
 * @returns {string} HTML
 */
function renderCategoryCard(category, commandCount) {
  return `
    <div class="category-card" data-category-id="${category.id}" tabindex="0">
      <div class="category-card-icon" style="background:${category.color}20;color:${category.color}">
        <i class="bi ${category.icon}"></i>
      </div>
      <h3 class="category-card-title">${escapeHtml(category.name)}</h3>
      <p class="category-card-description">${escapeHtml(category.description)}</p>
      <span class="category-card-count">${commandCount} command${commandCount !== 1 ? 's' : ''}</span>
    </div>`;
}

/* ─────────────────────────────────────────────
   CLIPBOARD
   ───────────────────────────────────────────── */

/**
 * Copy text to clipboard and flash a success indicator.
 * @param {string} text
 * @param {HTMLElement} [triggerBtn] – the button that was clicked
 */
async function copyToClipboard(text, triggerBtn) {
  try {
    await navigator.clipboard.writeText(text);
    if (triggerBtn) {
      const icon = triggerBtn.querySelector('i');
      if (icon) {
        icon.className = 'bi bi-check-lg';
        triggerBtn.classList.add('copy-success');
        setTimeout(() => {
          icon.className = 'bi bi-clipboard';
          triggerBtn.classList.remove('copy-success');
        }, 1500);
      }
    }
  } catch (err) {
    console.warn('[app] Clipboard write failed:', err);
    // Fallback for older browsers / non-HTTPS
    fallbackCopy(text);
  }
}

/**
 * Fallback clipboard copy using a hidden textarea.
 * @param {string} text
 */
function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;left:-9999px;top:-9999px';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch { /* noop */ }
  document.body.removeChild(ta);
}

/* ─────────────────────────────────────────────
   COMMAND DETAIL MODAL / PANEL
   ───────────────────────────────────────────── */

/**
 * Show the command detail panel for the given command.
 * @param {string} commandId
 */
function showCommandDetail(commandId) {
  const command = getCommandById(commandId);
  if (!command) return;

  addToRecentlyViewed(commandId);

  const panel = document.getElementById('command-detail-panel');
  const overlay = document.getElementById('command-modal-overlay');
  if (!panel) return;

  // Render content
  const contentEl = document.getElementById('command-detail-content');
  if (contentEl) {
    contentEl.innerHTML = renderCommandDetail(command);
  } else {
    panel.innerHTML = renderCommandDetail(command);
  }

  // Show overlay and panel
  if (overlay) overlay.removeAttribute('hidden');
  panel.classList.add('open');
  document.body.classList.add('detail-open');

  // Wire up related-cmd buttons inside the panel
  const container = contentEl || panel;
  container.querySelectorAll('.related-cmd-btn').forEach((btn) => {
    btn.addEventListener('click', () => showCommandDetail(btn.dataset.commandId));
  });
}

/**
 * Hide the command detail panel.
 */
function hideCommandDetail() {
  const panel = document.getElementById('command-detail-panel');
  const overlay = document.getElementById('command-modal-overlay');
  if (panel) {
    panel.classList.remove('open');
    document.body.classList.remove('detail-open');
  }
  if (overlay) overlay.setAttribute('hidden', '');
}

/* ─────────────────────────────────────────────
   KEYBOARD SHORTCUTS
   ───────────────────────────────────────────── */

function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);

    // Ctrl/Cmd + K → focus search
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'k' || e.code === 'KeyK')) {
      e.preventDefault();
      const searchInput = document.getElementById('global-search') || 
                          document.getElementById('explorer-search-input') || 
                          document.getElementById('graph-search-input') || 
                          document.getElementById('terminal-input');
      if (searchInput) {
        searchInput.focus();
        if (searchInput.select) searchInput.select();
      }
      return;
    }

    // "/" → focus search (when not in input)
    if (e.key === '/' && !isInput) {
      e.preventDefault();
      const searchInput = document.getElementById('global-search') || 
                          document.getElementById('explorer-search-input') || 
                          document.getElementById('graph-search-input') || 
                          document.getElementById('terminal-input');
      if (searchInput) searchInput.focus();
      return;
    }

    // Escape → close things
    if (e.key === 'Escape') {
      hideCommandDetail();

      if (typeof hideSearchResults === 'function') {
        hideSearchResults();
      } else {
        const searchResults = document.getElementById('search-results');
        if (searchResults) {
          searchResults.classList.remove('active');
          searchResults.hidden = true;
        }
      }

      const searchInput = document.getElementById('global-search') || 
                          document.getElementById('explorer-search-input') || 
                          document.getElementById('graph-search-input') || 
                          document.getElementById('terminal-input');
      if (searchInput && document.activeElement === searchInput) {
        searchInput.blur();
      }

      closeSidebarMobile();
    }
  });
}

/* ─────────────────────────────────────────────
   EVENT DELEGATION
   ───────────────────────────────────────────── */

function initEventDelegation() {
  document.addEventListener('click', (e) => {
    // ── Copy buttons ──
    const copyBtn = e.target.closest('.copy-btn');
    if (copyBtn) {
      e.preventDefault();
      e.stopPropagation();
      const text = copyBtn.dataset.copy;
      if (text) copyToClipboard(text, copyBtn);
      return;
    }

    // ── Favourite buttons ──
    const favBtn = e.target.closest('.favorite-btn');
    if (favBtn) {
      e.preventDefault();
      e.stopPropagation();
      const id = favBtn.dataset.commandId;
      if (id) toggleFavorite(id);
      return;
    }

    // ── Command cards → open detail ──
    const card = e.target.closest('.command-card');
    if (card && !e.target.closest('.btn')) {
      const id = card.dataset.commandId;
      if (id) showCommandDetail(id);
      return;
    }

    // ── Category cards → navigate ──
    const catCard = e.target.closest('.category-card');
    if (catCard) {
      const catId = catCard.dataset.categoryId;
      if (catId) {
        window.location.href = `${pageCtx.pagesPrefix}explorer.html?cat=${catId}`;
      }
      return;
    }

    // ── Mobile menu toggle ──
    const menuToggle = e.target.closest('#mobile-menu-toggle');
    if (menuToggle) {
      openSidebarMobile();
      return;
    }

    // ── Modal overlay close ──
    const modalOverlay = e.target.closest('#command-modal-overlay');
    if (modalOverlay && e.target === modalOverlay) {
      hideCommandDetail();
      return;
    }

    // ── Modal close button ──
    const modalClose = e.target.closest('#modal-close');
    if (modalClose) {
      hideCommandDetail();
      return;
    }
  });
}

/* ─────────────────────────────────────────────
   UTILITY HELPERS
   ───────────────────────────────────────────── */

/**
 * Escape HTML special characters.
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
  if (!str) return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(str).replace(/[&<>"']/g, (c) => map[c]);
}

/**
 * Escape a string for use inside an HTML attribute.
 * @param {string} str
 * @returns {string}
 */
function escapeAttr(str) {
  return escapeHtml(str);
}

/**
 * Simple debounce utility.
 * @param {Function} fn
 * @param {number} ms
 * @returns {Function}
 */
function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/* ─────────────────────────────────────────────
   THEME TOGGLE (bonus)
   ───────────────────────────────────────────── */

function initThemeToggle() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  btn.addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
    const icon = btn.querySelector('i');
    if (document.body.classList.contains('light-mode')) {
      if (icon) icon.className = 'bi bi-moon-stars';
      localStorage.setItem('cmdHub_theme', 'light');
    } else {
      if (icon) icon.className = 'bi bi-sun';
      localStorage.setItem('cmdHub_theme', 'dark');
    }
  });

  // Restore saved theme
  if (localStorage.getItem('cmdHub_theme') === 'light') {
    document.body.classList.add('light-mode');
    const icon = btn.querySelector('i');
    if (icon) icon.className = 'bi bi-moon-stars';
  }
}

/* ─────────────────────────────────────────────
   DASHBOARD INITIALIZATION
   ───────────────────────────────────────────── */

/**
 * Populate the dashboard: category grid, stats bar, and quick access panels.
 */
function initDashboard() {
  // ── Category Grid ──
  const catGrid = document.getElementById('category-grid');
  if (catGrid) {
    const html = commandsData.categories
      .filter(c => c.id !== 'important-commands')
      .map(cat => {
        const count = getCommandsByCategory(cat.id).length;
        return renderCategoryCard(cat, count);
      })
      .join('');
    catGrid.innerHTML = html;
  }

  // ── Stats Bar ──
  const statsBar = document.getElementById('stats-bar');
  if (statsBar) {
    const totalCmds = commandsData.commands.length;
    const totalCats = commandsData.categories.filter(c => c.id !== 'important-commands').length;
    statsBar.innerHTML = `
      <div class="stat-item">
        <i class="bi bi-terminal"></i>
        <span class="stat-value">${totalCmds}</span>
        <span class="stat-label">Commands</span>
      </div>
      <div class="stat-item">
        <i class="bi bi-grid-1x2"></i>
        <span class="stat-value">${totalCats}</span>
        <span class="stat-label">Categories</span>
      </div>
      <div class="stat-item">
        <i class="bi bi-keyboard"></i>
        <span class="stat-value">Ctrl+K</span>
        <span class="stat-label">Quick Search</span>
      </div>
      <div class="stat-item">
        <i class="bi bi-lightning"></i>
        <span class="stat-value">/</span>
        <span class="stat-label">Focus Search</span>
      </div>
    `;
  }

  // ── Favorites Panel ──
  renderQuickPanel('favorites-list', favorites);

  // ── Recently Viewed Panel ──
  renderQuickPanel('recently-viewed-list', recentlyViewed);

  // ── Most Used Panel ──
  const mostUsedIds = ['nvidia-smi', 'htop', 'ps-aux-grep', 'tail-f', 'ss-tulpn', 'docker-ps', 'free-h', 'kill-9'];
  renderQuickPanel('most-used-list', mostUsedIds);
}

/**
 * Render a quick-access panel list with command links.
 * @param {string} containerId
 * @param {string[]} commandIds
 */
function renderQuickPanel(containerId, commandIds) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (!commandIds || !commandIds.length) {
    container.innerHTML = '<div class="quick-panel-empty">No commands yet</div>';
    return;
  }

  const html = commandIds
    .map(id => {
      const cmd = getCommandById(id);
      if (!cmd) return '';
      return `
        <div class="quick-panel-item" data-command-id="${cmd.id}" tabindex="0">
          <span class="quick-panel-cmd">${escapeHtml(cmd.command)}</span>
          <button class="btn btn--icon copy-btn" data-copy="${escapeAttr(cmd.command)}" title="Copy">
            <i class="bi bi-clipboard"></i>
          </button>
        </div>`;
    })
    .filter(Boolean)
    .join('');

  container.innerHTML = html || '<div class="quick-panel-empty">No commands yet</div>';

  // Click on quick panel items to show detail
  container.querySelectorAll('.quick-panel-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.copy-btn')) return;
      const id = item.dataset.commandId;
      if (id) showCommandDetail(id);
    });
  });
}

/* ─────────────────────────────────────────────
   EXPLORER INITIALIZATION
   ───────────────────────────────────────────── */

/**
 * Populate the explorer page with command cards.
 */
function initExplorer() {
  const params = new URLSearchParams(window.location.search);
  const catId = params.get('cat');
  const view = params.get('view');

  // HTML element references (matching explorer.html IDs)
  const cmdGrid = document.getElementById('explorer-grid');
  const titleEl = document.getElementById('explorer-title');
  const descEl = document.getElementById('explorer-description');
  const iconEl = document.getElementById('explorer-header-icon');
  const countEl = document.getElementById('explorer-command-count');
  const breadcrumbEl = document.getElementById('breadcrumb-current');
  const resultsInfo = document.getElementById('explorer-results-info');
  const emptyState = document.getElementById('explorer-empty');

  let commands = [];
  let headerTitle = 'All Commands';
  let headerDesc = 'Browse the complete command library across all categories.';
  let headerIcon = 'bi-collection';
  let headerColor = '#3b82f6';

  if (view === 'favorites') {
    commands = favorites.map(id => getCommandById(id)).filter(Boolean);
    headerTitle = 'Favorites';
    headerDesc = 'Your bookmarked commands';
    headerIcon = 'bi-star-fill';
    headerColor = '#eab308';
  } else if (view === 'recent') {
    commands = recentlyViewed.map(id => getCommandById(id)).filter(Boolean);
    headerTitle = 'Recently Viewed';
    headerDesc = 'Commands you recently looked at';
    headerIcon = 'bi-clock-history';
    headerColor = '#8b5cf6';
  } else if (catId) {
    const cat = getCategoryById(catId);
    if (cat) {
      commands = getCommandsByCategory(catId);
      headerTitle = cat.name;
      headerDesc = cat.description;
      headerIcon = cat.icon;
      headerColor = cat.color;
    }
  } else {
    commands = [...commandsData.commands];
  }

  // Update header elements
  if (titleEl) titleEl.textContent = headerTitle;
  if (descEl) descEl.textContent = headerDesc;
  if (iconEl) {
    iconEl.style.background = `${headerColor}20`;
    iconEl.style.color = headerColor;
    iconEl.innerHTML = `<i class="bi ${headerIcon}"></i>`;
  }
  if (countEl) {
    countEl.innerHTML = `<i class="bi bi-terminal" aria-hidden="true"></i> <span>${commands.length} command${commands.length !== 1 ? 's' : ''}</span>`;
  }

  // Update breadcrumb
  if (breadcrumbEl) {
    breadcrumbEl.textContent = headerTitle;
  }

  // Results info
  if (resultsInfo) {
    resultsInfo.textContent = `Showing ${commands.length} command${commands.length !== 1 ? 's' : ''}`;
  }

  // Render commands
  if (cmdGrid) {
    if (commands.length) {
      cmdGrid.innerHTML = commands.map(cmd => renderCommandCard(cmd)).join('');
      if (emptyState) emptyState.setAttribute('hidden', '');
    } else {
      cmdGrid.innerHTML = '';
      if (emptyState) emptyState.removeAttribute('hidden');
    }
  }

  // Explorer filter controls
  initExplorerFilters(commands);
}

/**
 * Initialize filter/sort controls on the explorer page.
 * @param {Array} allCommands — the full unfiltered set for this view
 */
function initExplorerFilters(allCommands) {
  // Match actual HTML element IDs from explorer.html
  const searchInput = document.getElementById('explorer-search-input');
  const complexityBtns = document.querySelectorAll('.filter-pill');
  const sortSelect = document.getElementById('sort-select');
  const cmdGrid = document.getElementById('explorer-grid');
  const resultsInfo = document.getElementById('explorer-results-info');
  const emptyState = document.getElementById('explorer-empty');

  if (!cmdGrid) return;

  let currentComplexity = 'all';
  let currentSort = 'alphabetical';
  let currentSearch = '';

  function applyFilters() {
    let filtered = [...allCommands];

    // Text filter
    if (currentSearch) {
      const q = currentSearch.toLowerCase();
      filtered = filtered.filter(cmd =>
        cmd.command.toLowerCase().includes(q) ||
        cmd.name.toLowerCase().includes(q) ||
        cmd.purpose.toLowerCase().includes(q) ||
        (cmd.tags && cmd.tags.some(t => t.toLowerCase().includes(q)))
      );
    }

    // Complexity filter
    if (currentComplexity !== 'all') {
      filtered = filtered.filter(cmd => cmd.complexity === currentComplexity);
    }

    // Sort
    const order = { beginner: 0, intermediate: 1, advanced: 2 };
    switch (currentSort) {
      case 'alphabetical':
        filtered.sort((a, b) => a.command.localeCompare(b.command));
        break;
      case 'alphabetical-desc':
        filtered.sort((a, b) => b.command.localeCompare(a.command));
        break;
      case 'complexity-asc':
        filtered.sort((a, b) => (order[a.complexity] || 0) - (order[b.complexity] || 0));
        break;
      case 'complexity-desc':
        filtered.sort((a, b) => (order[b.complexity] || 0) - (order[a.complexity] || 0));
        break;
    }

    // Update results info
    if (resultsInfo) {
      resultsInfo.textContent = `Showing ${filtered.length} command${filtered.length !== 1 ? 's' : ''}`;
    }

    // Render
    if (filtered.length) {
      cmdGrid.innerHTML = filtered.map(cmd => renderCommandCard(cmd)).join('');
      if (emptyState) emptyState.setAttribute('hidden', '');
    } else {
      cmdGrid.innerHTML = '';
      if (emptyState) emptyState.removeAttribute('hidden');
    }
  }

  // Bind search
  if (searchInput) {
    searchInput.addEventListener('input', debounce((e) => {
      currentSearch = e.target.value.trim();
      applyFilters();
    }, 200));
  }

  // Bind complexity pills
  complexityBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      complexityBtns.forEach(b => {
        b.classList.remove('filter-pill--active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('filter-pill--active');
      btn.setAttribute('aria-pressed', 'true');
      currentComplexity = btn.dataset.complexity || 'all';
      applyFilters();
    });
  });

  // Bind sort
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      currentSort = sortSelect.value;
      applyFilters();
    });
  }
}

/* ─────────────────────────────────────────────
   INITIALIZATION
   ───────────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Detect page context
  detectPageContext();

  // 2. Load persisted data
  loadFavorites();
  loadRecentlyViewed();

  // 3. Fetch command data
  await loadData();

  // 4. Build sidebar
  initSidebar();

  // 5. Create sidebar overlay for mobile if not present
  if (!document.getElementById('sidebar-overlay')) {
    const overlay = document.createElement('div');
    overlay.id = 'sidebar-overlay';
    overlay.className = 'sidebar-overlay';
    overlay.addEventListener('click', closeSidebarMobile);
    document.body.appendChild(overlay);
  }

  // 6. Global event delegation
  initEventDelegation();

  // 7. Keyboard shortcuts
  initKeyboardShortcuts();

  // 8. Theme toggle
  initThemeToggle();

  // 9. Update favourites UI
  updateFavoritesUI();

  // 10. Dashboard-specific init
  if (pageCtx.isIndex) {
    initDashboard();
  }

  // 11. Explorer-specific init
  if (pageCtx.isExplorer) {
    initExplorer();
  }

  // 12. Call page-specific initializer if registered (search, graph, terminal)
  if (typeof window.initPage === 'function') {
    window.initPage();
  }
});
