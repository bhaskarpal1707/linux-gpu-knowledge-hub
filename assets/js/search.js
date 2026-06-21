/**
 * ============================================================
 *  Linux GPU & AI/ML Knowledge Hub — Search Engine
 *  Fuzzy search powered by Fuse.js. Loaded on pages with a
 *  search bar (index.html, explorer.html).
 * ============================================================
 */

'use strict';

/* ─────────────────────────────────────────────
   SEARCH STATE
   ───────────────────────────────────────────── */

/** @type {Fuse|null} */
let fuse = null;

/** @type {Array} Current search results */
let searchResults = [];

/** @type {number} Index of the currently selected result (-1 = none) */
let selectedResultIndex = -1;

/** @type {number|null} Debounce timer handle */
let _searchTimer = null;

/* ─────────────────────────────────────────────
   INITIALIZATION
   ───────────────────────────────────────────── */

/**
 * Simple offline/local fallback matching engine when Fuse.js is unavailable.
 */
class FallbackFuse {
  constructor(list, options) {
    this.list = list;
    this.keys = options.keys || [];
  }

  search(query) {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    
    const results = [];

    for (const item of this.list) {
      let score = 0;
      let matched = false;

      for (const keyObj of this.keys) {
        const keyName = typeof keyObj === 'string' ? keyObj : keyObj.name;
        const keyWeight = typeof keyObj === 'string' ? 1 : (keyObj.weight || 1);
        const val = item[keyName];

        if (!val) continue;

        if (Array.isArray(val)) {
          for (const valItem of val) {
            const lowerValItem = valItem.toLowerCase();
            if (lowerValItem.includes(q)) {
              matched = true;
              if (lowerValItem === q) {
                score += keyWeight * 3;
              } else if (lowerValItem.startsWith(q)) {
                score += keyWeight * 2;
              } else {
                score += keyWeight;
              }
            }
          }
        } else if (typeof val === 'string') {
          const lowerVal = val.toLowerCase();
          if (lowerVal.includes(q)) {
            matched = true;
            if (lowerVal === q) {
              score += keyWeight * 5;
            } else if (lowerVal.startsWith(q)) {
              score += keyWeight * 3;
            } else {
              score += keyWeight;
            }
          }
        }
      }

      if (matched) {
        results.push({ item, score });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);
    return results;
  }
}

/**
 * Initialize the search instance (Fuse.js or FallbackFuse).
 * Call this after `commandsData` has been loaded.
 */
function initSearch() {
  if (!commandsData || !commandsData.commands.length) {
    console.warn('[search] No commands data available for search.');
    return;
  }

  if (typeof Fuse === 'undefined') {
    console.warn('[search] Fuse.js not loaded — using local fallback fuzzy matching.');
    fuse = new FallbackFuse(commandsData.commands, {
      keys: [
        { name: 'command',    weight: 0.4  },
        { name: 'name',       weight: 0.25 },
        { name: 'purpose',    weight: 0.2  },
        { name: 'tags',       weight: 0.1  },
        { name: 'categoryId', weight: 0.05 },
      ]
    });
  } else {
    fuse = new Fuse(commandsData.commands, {
      keys: [
        { name: 'command',    weight: 0.4  },
        { name: 'name',       weight: 0.25 },
        { name: 'purpose',    weight: 0.2  },
        { name: 'tags',       weight: 0.1  },
        { name: 'categoryId', weight: 0.05 },
      ],
      threshold: 0.4,
      includeMatches: true,
      includeScore: true,
      minMatchCharLength: 2,
    });
  }

  bindSearchEvents();
}

/* ─────────────────────────────────────────────
   SEARCH EXECUTION
   ───────────────────────────────────────────── */

/**
 * Perform a fuzzy search and render results.
 * @param {string} query — user input
 */
function performSearch(query) {
  const container = document.getElementById('search-results');
  if (!container) return;

  const trimmed = query.trim();

  if (!trimmed || trimmed.length < 2 || !fuse) {
    hideSearchResults();
    searchResults = [];
    selectedResultIndex = -1;
    return;
  }

  const raw = fuse.search(trimmed);
  searchResults = raw.slice(0, 15);
  selectedResultIndex = searchResults.length ? 0 : -1;

  renderSearchResults(searchResults, container);
  container.hidden = false;
  container.classList.add('active');
}

/* ─────────────────────────────────────────────
   RENDERING
   ───────────────────────────────────────────── */

/**
 * Generate and inject HTML for the search results dropdown.
 * @param {Array} results – Fuse search results
 * @param {HTMLElement} container
 */
function renderSearchResults(results, container) {
  if (!results.length) {
    container.innerHTML = `
      <div class="search-empty">
        <i class="bi bi-search"></i>
        <p>No commands found</p>
      </div>`;
    return;
  }

  let html = '';

  results.forEach((result, idx) => {
    const cmd = result.item;
    const cat = getCategoryById(cmd.categoryId);
    const catName  = cat ? cat.name  : 'Unknown';
    const catColor = cat ? cat.color : '#71717a';

    // Highlight matched text for the 'command' key if available
    const commandDisplay = highlightFuseMatch(result, 'command', cmd.command);
    const purposeDisplay = truncate(cmd.purpose, 80);

    const activeClass = idx === selectedResultIndex ? ' search-result-item--active' : '';

    html += `
      <div class="search-result-item${activeClass}" data-command-id="${cmd.id}" data-index="${idx}">
        <div class="search-result-left">
          <span class="search-result-command">${commandDisplay}</span>
          <span class="search-result-purpose">${escapeHtml(purposeDisplay)}</span>
        </div>
        <span class="search-result-category badge" style="--cat-color:${catColor};background:${catColor}20;color:${catColor}">
          ${escapeHtml(catName)}
        </span>
      </div>`;
  });

  container.innerHTML = html;
}

/* ─────────────────────────────────────────────
   MATCH HIGHLIGHTING
   ───────────────────────────────────────────── */

/**
 * Highlight matched characters from Fuse.js match data.
 * @param {object} fuseResult — a single Fuse result
 * @param {string} key — the key to highlight (e.g., 'command')
 * @param {string} fallback — plain text fallback
 * @returns {string} HTML with <mark> tags
 */
function highlightFuseMatch(fuseResult, key, fallback) {
  if (!fuseResult.matches) return escapeHtml(fallback);

  const match = fuseResult.matches.find((m) => m.key === key);
  if (!match || !match.indices || !match.indices.length) {
    return escapeHtml(fallback);
  }

  return highlightMatch(match.value || fallback, match.indices);
}

/**
 * Wrap matched character ranges in <mark> tags.
 * @param {string} text — original text
 * @param {number[][]} indices — array of [start, end] pairs (inclusive)
 * @returns {string} HTML string
 */
function highlightMatch(text, indices) {
  if (!indices || !indices.length) return escapeHtml(text);

  // Sort indices by start position
  const sorted = [...indices].sort((a, b) => a[0] - b[0]);

  let result = '';
  let lastIdx = 0;

  for (const [start, end] of sorted) {
    // Add non-highlighted segment
    if (start > lastIdx) {
      result += escapeHtml(text.slice(lastIdx, start));
    }
    // Add highlighted segment
    result += `<mark class="search-highlight">${escapeHtml(text.slice(start, end + 1))}</mark>`;
    lastIdx = end + 1;
  }

  // Remaining text
  if (lastIdx < text.length) {
    result += escapeHtml(text.slice(lastIdx));
  }

  return result;
}

/* ─────────────────────────────────────────────
   KEYBOARD NAVIGATION
   ───────────────────────────────────────────── */

/**
 * Handle keyboard events while the search input is focused.
 * @param {KeyboardEvent} e
 */
function handleSearchKeydown(e) {
  const container = document.getElementById('search-results');
  if (!container || !searchResults.length) return;

  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault();
      selectedResultIndex = Math.min(selectedResultIndex + 1, searchResults.length - 1);
      updateActiveResult(container);
      break;

    case 'ArrowUp':
      e.preventDefault();
      selectedResultIndex = Math.max(selectedResultIndex - 1, 0);
      updateActiveResult(container);
      break;

    case 'Enter':
      e.preventDefault();
      console.log('DEBUG_ENTER: selectedResultIndex =', selectedResultIndex);
      console.log('DEBUG_ENTER: searchResults =', JSON.stringify(searchResults));
      if (selectedResultIndex >= 0 && selectedResultIndex < searchResults.length) {
        const selected = searchResults[selectedResultIndex];
        if (selected && selected.item) {
          hideSearchResults();
          const searchInput = document.getElementById('global-search');
          if (searchInput) searchInput.blur();
          showCommandDetail(selected.item.id);
        }
      }
      break;

    case 'Escape':
      hideSearchResults();
      const searchInput = document.getElementById('global-search');
      if (searchInput) searchInput.blur();
      break;
  }
}

/**
 * Update the visual active state of results based on `selectedResultIndex`.
 * @param {HTMLElement} container
 */
function updateActiveResult(container) {
  const items = container.querySelectorAll('.search-result-item');
  items.forEach((item, idx) => {
    item.classList.toggle('search-result-item--active', idx === selectedResultIndex);
  });

  // Scroll active item into view
  const active = items[selectedResultIndex];
  if (active) {
    active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

/* ─────────────────────────────────────────────
   UI HELPERS
   ───────────────────────────────────────────── */

/** Hide the search results dropdown. */
function hideSearchResults() {
  const container = document.getElementById('search-results');
  if (container) {
    container.classList.remove('active');
    container.hidden = true;
  }
  selectedResultIndex = -1;
}

/**
 * Truncate a string to a max length, appending "…" if needed.
 * @param {string} str
 * @param {number} max
 * @returns {string}
 */
function truncate(str, max) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max) + '…' : str;
}

/* ─────────────────────────────────────────────
   EVENT BINDING
   ───────────────────────────────────────────── */

/**
 * Bind all search-related event listeners.
 */
function bindSearchEvents() {
  const searchInput = document.getElementById('global-search');
  if (!searchInput) return;

  // Debounced input handler
  searchInput.addEventListener('input', (e) => {
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(() => {
      performSearch(e.target.value);
    }, 150);
  });

  // Show results when re-focusing if query exists
  searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim().length >= 2 && searchResults.length) {
      const container = document.getElementById('search-results');
      if (container) {
        container.hidden = false;
        container.classList.add('active');
      }
    }
  });

  // Keyboard navigation
  searchInput.addEventListener('keydown', handleSearchKeydown);

  // Click outside → close results
  document.addEventListener('click', (e) => {
    const searchWrapper = e.target.closest('#search-container') || e.target.closest('.search-container') || e.target.closest('#search-results');
    if (!searchWrapper) {
      hideSearchResults();
    }
  });

  // Click on a result item
  const resultsContainer = document.getElementById('search-results');
  if (resultsContainer) {
    resultsContainer.addEventListener('click', (e) => {
      const item = e.target.closest('.search-result-item');
      if (item) {
        const id = item.dataset.commandId;
        hideSearchResults();
        searchInput.blur();
        if (id) showCommandDetail(id);
      }
    });
  }
}

/* ─────────────────────────────────────────────
   AUTO-INIT
   ───────────────────────────────────────────── */

// Register as the page initializer (called from app.js after data loads)
// If search.js is loaded, we hook into initPage or call initSearch directly.
(function () {
  const originalInitPage = window.initPage;
  window.initPage = function () {
    initSearch();
    if (typeof originalInitPage === 'function') {
      originalInitPage();
    }
  };
})();
