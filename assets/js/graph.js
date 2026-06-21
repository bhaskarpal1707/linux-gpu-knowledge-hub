/**
 * ============================================================
 *  Linux GPU & AI/ML Knowledge Hub — Interactive Graph View
 *  Command relationship graph powered by vis-network.
 *  Only loaded on pages/graph.html.
 * ============================================================
 */

'use strict';

/* ─────────────────────────────────────────────
   GRAPH STATE
   ───────────────────────────────────────────── */

/** @type {vis.Network|null} */
let network = null;

/** @type {vis.DataSet|null} */
let graphNodes = null;

/** @type {vis.DataSet|null} */
let graphEdges = null;

/** @type {Set<string>} Currently visible category IDs */
let visibleCategories = new Set();

/* ─────────────────────────────────────────────
   COLOR UTILITIES
   ───────────────────────────────────────────── */

/**
 * Lighten a hex colour by a given amount.
 * @param {string} hex — e.g. "#3b82f6"
 * @param {number} amount — 0-100
 * @returns {string} lightened hex colour
 */
function lightenColor(hex, amount = 30) {
  const clamp = (v) => Math.min(255, Math.max(0, v));
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map((ch) => ch + ch).join('');
  const r = clamp(parseInt(c.substring(0, 2), 16) + amount);
  const g = clamp(parseInt(c.substring(2, 4), 16) + amount);
  const b = clamp(parseInt(c.substring(4, 6), 16) + amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Convert hex to rgba string.
 * @param {string} hex
 * @param {number} alpha
 * @returns {string}
 */
function hexToRgba(hex, alpha) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map((ch) => ch + ch).join('');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/* ─────────────────────────────────────────────
   GRAPH INITIALIZATION
   ───────────────────────────────────────────── */

/**
 * Build and render the command relationship graph.
 * Must be called after commandsData is loaded.
 */
function initGraph() {
  if (typeof vis === 'undefined') {
    console.error('[graph] vis-network is not loaded.');
    return;
  }

  const canvas = document.getElementById('graph-canvas');
  if (!canvas) {
    console.error('[graph] #graph-canvas element not found.');
    return;
  }

  showLoadingIndicator();

  // Build category colour map
  const catColors = {};
  commandsData.categories.forEach((cat) => {
    catColors[cat.id] = cat.color || '#71717a';
    visibleCategories.add(cat.id);
  });

  // ── NODES ──
  const nodesArray = commandsData.commands.map((cmd) => {
    const color = catColors[cmd.categoryId] || '#71717a';
    return {
      id: cmd.id,
      label: cmd.command.length > 25 ? cmd.command.slice(0, 22) + '…' : cmd.command,
      title: `${cmd.name}\n${cmd.purpose}`,
      group: cmd.categoryId,
      color: {
        background: color,
        border: color,
        highlight: {
          background: lightenColor(color, 40),
          border: color,
        },
        hover: {
          background: lightenColor(color, 20),
          border: color,
        },
      },
      font: {
        color: '#e4e4e7',
        size: 12,
        face: 'Inter, system-ui, sans-serif',
      },
      shape: 'dot',
      size: 20,
      borderWidth: 2,
      shadow: {
        enabled: true,
        color: hexToRgba(color, 0.3),
        size: 10,
        x: 0,
        y: 2,
      },
    };
  });

  graphNodes = new vis.DataSet(nodesArray);

  // ── EDGES ──
  const edgeSet = new Set();
  const edgesArray = [];

  commandsData.commands.forEach((cmd) => {
    if (!cmd.relatedCommands) return;
    cmd.relatedCommands.forEach((relId) => {
      // Deduplicate: only keep one direction
      const edgeKey = [cmd.id, relId].sort().join('::');
      if (edgeSet.has(edgeKey)) return;
      // Only add if the related command exists
      if (!getCommandById(relId)) return;
      edgeSet.add(edgeKey);
      edgesArray.push({
        from: cmd.id,
        to: relId,
        color: {
          color: 'rgba(255,255,255,0.08)',
          highlight: '#3b82f6',
          hover: 'rgba(255,255,255,0.2)',
        },
        smooth: {
          type: 'continuous',
        },
        width: 1,
        hoverWidth: 2,
      });
    });
  });

  graphEdges = new vis.DataSet(edgesArray);

  // ── GROUP COLOURS (for legend) ──
  const groups = {};
  commandsData.categories.forEach((cat) => {
    groups[cat.id] = {
      color: {
        background: cat.color,
        border: cat.color,
      },
    };
  });

  // ── NETWORK OPTIONS ──
  const options = {
    nodes: {
      borderWidth: 2,
      shadow: true,
    },
    edges: {
      smooth: { type: 'continuous' },
      width: 1,
    },
    physics: {
      barnesHut: {
        gravitationalConstant: -3000,
        springLength: 200,
        springConstant: 0.04,
        damping: 0.09,
        avoidOverlap: 0.1,
      },
      stabilization: {
        iterations: 150,
        updateInterval: 25,
      },
    },
    interaction: {
      hover: true,
      tooltipDelay: 200,
      zoomView: true,
      dragView: true,
      navigationButtons: false,
      keyboard: {
        enabled: false,
      },
    },
    groups,
  };

  // ── CREATE NETWORK ──
  network = new vis.Network(canvas, { nodes: graphNodes, edges: graphEdges }, options);

  // ── EVENTS ──
  bindGraphEvents();

  // ── BUILD LEGEND ──
  renderCategoryLegend();

  // ── BIND CONTROLS ──
  bindGraphControls();
}

/* ─────────────────────────────────────────────
   GRAPH EVENTS
   ───────────────────────────────────────────── */

function bindGraphEvents() {
  if (!network) return;

  // Click → show detail in info panel
  network.on('click', (params) => {
    if (params.nodes.length) {
      const nodeId = params.nodes[0];
      showGraphInfoPanel(nodeId);
      highlightConnected(nodeId);
    } else {
      hideGraphInfoPanel();
      resetHighlights();
    }
  });

  // Hover → subtle highlight
  network.on('hoverNode', (params) => {
    document.getElementById('graph-canvas').style.cursor = 'pointer';
  });

  network.on('blurNode', () => {
    document.getElementById('graph-canvas').style.cursor = 'default';
  });

  // Stabilization progress → loading bar
  network.on('stabilizationProgress', (params) => {
    const progress = Math.round((params.iterations / params.total) * 100);
    updateLoadingProgress(progress);
  });

  network.on('stabilizationIterationsDone', () => {
    hideLoadingIndicator();
    network.fit({ animation: { duration: 500, easingFunction: 'easeInOutQuad' } });
  });
}

/* ─────────────────────────────────────────────
   HIGHLIGHT CONNECTED NODES
   ───────────────────────────────────────────── */

/**
 * Highlight nodes and edges connected to the selected node.
 * @param {string} nodeId
 */
function highlightConnected(nodeId) {
  const connectedNodes = network.getConnectedNodes(nodeId);
  const connectedEdges = network.getConnectedEdges(nodeId);
  const allNodeIds = graphNodes.getIds();

  // Dim all nodes not connected
  const updatedNodes = allNodeIds.map((id) => {
    if (id === nodeId || connectedNodes.includes(id)) {
      return { id, opacity: 1.0 };
    }
    return { id, opacity: 0.15 };
  });
  graphNodes.update(updatedNodes);

  // Highlight connected edges
  const allEdgeIds = graphEdges.getIds();
  const updatedEdges = allEdgeIds.map((id) => {
    if (connectedEdges.includes(id)) {
      return { id, color: { color: '#3b82f6' }, width: 2 };
    }
    return { id, color: { color: 'rgba(255,255,255,0.03)' }, width: 0.5 };
  });
  graphEdges.update(updatedEdges);
}

/** Reset all node and edge highlights to default. */
function resetHighlights() {
  const allNodeIds = graphNodes.getIds();
  const resetNodes = allNodeIds.map((id) => ({ id, opacity: 1.0 }));
  graphNodes.update(resetNodes);

  const allEdgeIds = graphEdges.getIds();
  const resetEdges = allEdgeIds.map((id) => ({
    id,
    color: { color: 'rgba(255,255,255,0.08)', highlight: '#3b82f6', hover: 'rgba(255,255,255,0.2)' },
    width: 1,
  }));
  graphEdges.update(resetEdges);
}

/* ─────────────────────────────────────────────
   INFO PANEL
   ───────────────────────────────────────────── */

/**
 * Show command detail in the graph info panel.
 * Renders content into the panel body and manages hidden/aria attributes.
 * @param {string} commandId
 */
function showGraphInfoPanel(commandId) {
  const panel = document.getElementById('graph-info-panel');
  const panelBody = document.getElementById('graph-info-panel-body');
  const panelTitle = document.getElementById('graph-info-panel-title');
  if (!panel || !panelBody) return;

  const command = getCommandById(commandId);
  if (!command) return;

  addToRecentlyViewed(commandId);

  const cat = getCategoryById(command.categoryId);
  const related = getRelatedCommands(command);

  // Update panel title
  if (panelTitle) panelTitle.textContent = command.name;

  let html = `
    <div class="graph-info-content">
      <div class="graph-info-command">
        <code>${escapeHtml(command.command)}</code>
        <button class="btn btn--icon copy-btn" data-copy="${escapeAttr(command.command)}" title="Copy">
          <i class="bi bi-clipboard"></i>
        </button>
      </div>

      <div class="graph-info-badges">
        ${cat ? `<span class="badge" style="background:${cat.color}20;color:${cat.color}"><i class="bi ${cat.icon}"></i> ${escapeHtml(cat.name)}</span>` : ''}
        <span class="badge badge--${command.complexity}">${command.complexity}</span>
      </div>

      <p class="graph-info-purpose">${escapeHtml(command.purpose)}</p>`;

  if (command.syntax) {
    html += `
      <div class="graph-info-section">
        <h4>Syntax</h4>
        <code class="graph-info-code-block">${escapeHtml(command.syntax)}</code>
      </div>`;
  }

  if (command.example) {
    html += `
      <div class="graph-info-section">
        <h4>Example</h4>
        <code class="graph-info-code-block">${escapeHtml(command.example)}</code>
      </div>`;
  }

  if (command.usefulWhen && command.usefulWhen.length) {
    html += `
      <div class="graph-info-section">
        <h4>Useful When</h4>
        <ul class="graph-info-list">
          ${command.usefulWhen.map((u) => `<li>${escapeHtml(u)}</li>`).join('')}
        </ul>
      </div>`;
  }

  if (command.notes) {
    html += `
      <div class="graph-info-section">
        <h4>Notes</h4>
        <p class="graph-info-notes">${escapeHtml(command.notes)}</p>
      </div>`;
  }

  if (related.length) {
    html += `
      <div class="graph-info-section">
        <h4>Related Commands</h4>
        <div class="graph-info-related">
          ${related.map((r) => `
            <button class="btn btn--outline btn--sm graph-related-btn" data-command-id="${r.id}">
              ${escapeHtml(r.command)}
            </button>`).join('')}
        </div>
      </div>`;
  }

  html += '</div>';
  panelBody.innerHTML = html;

  // Show panel with animation
  panel.hidden = false;
  panel.setAttribute('aria-hidden', 'false');
  // Trigger reflow to enable CSS transition
  panel.offsetHeight;
  panel.classList.add('open');

  // Bind close button in header
  const headerCloseBtn = document.getElementById('graph-info-panel-close');
  if (headerCloseBtn) {
    // Remove previous listener by replacing the element
    const newCloseBtn = headerCloseBtn.cloneNode(true);
    headerCloseBtn.parentNode.replaceChild(newCloseBtn, headerCloseBtn);
    newCloseBtn.addEventListener('click', () => {
      hideGraphInfoPanel();
      resetHighlights();
    });
  }

  // Bind copy buttons
  panelBody.querySelectorAll('.copy-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const text = btn.dataset.copy;
      if (text && navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
          const icon = btn.querySelector('i');
          if (icon) {
            icon.className = 'bi bi-check-lg';
            setTimeout(() => { icon.className = 'bi bi-clipboard'; }, 1500);
          }
        });
      }
    });
  });

  // Bind related command buttons
  panelBody.querySelectorAll('.graph-related-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const relId = btn.dataset.commandId;
      network.selectNodes([relId]);
      network.focus(relId, { scale: 1.2, animation: { duration: 500 } });
      showGraphInfoPanel(relId);
      highlightConnected(relId);
    });
  });
}

/** Hide the graph info panel with smooth animation. */
function hideGraphInfoPanel() {
  const panel = document.getElementById('graph-info-panel');
  if (!panel) return;

  panel.classList.remove('open');
  panel.setAttribute('aria-hidden', 'true');

  // Wait for CSS transition to finish before setting hidden
  const onTransitionEnd = () => {
    panel.hidden = true;
    panel.removeEventListener('transitionend', onTransitionEnd);
  };
  panel.addEventListener('transitionend', onTransitionEnd);

  // Fallback: hide after 400ms if transitionend doesn't fire
  setTimeout(() => { panel.hidden = true; }, 400);
}

/* ─────────────────────────────────────────────
   GRAPH CONTROLS
   ───────────────────────────────────────────── */

function bindGraphControls() {
  const zoomInBtn     = document.getElementById('graph-zoom-in');
  const zoomOutBtn    = document.getElementById('graph-zoom-out');
  const resetBtn      = document.getElementById('graph-reset-view');
  const stabilizeBtn  = document.getElementById('graph-stabilize');
  const searchInput   = document.getElementById('graph-search-input');

  if (zoomInBtn)    zoomInBtn.addEventListener('click', graphZoomIn);
  if (zoomOutBtn)   zoomOutBtn.addEventListener('click', graphZoomOut);
  if (resetBtn)     resetBtn.addEventListener('click', graphResetView);
  if (stabilizeBtn) stabilizeBtn.addEventListener('click', graphStabilize);

  if (searchInput) {
    searchInput.addEventListener('input', debounce((e) => {
      searchGraphNode(e.target.value);
    }, 200));
  }
}

/** Zoom in by increasing the scale. */
function graphZoomIn() {
  if (!network) return;
  const scale = network.getScale();
  network.moveTo({ scale: scale * 1.3, animation: { duration: 300 } });
}

/** Zoom out by decreasing the scale. */
function graphZoomOut() {
  if (!network) return;
  const scale = network.getScale();
  network.moveTo({ scale: scale / 1.3, animation: { duration: 300 } });
}

/** Reset view to fit all nodes. */
function graphResetView() {
  if (!network) return;
  resetHighlights();
  hideGraphInfoPanel();
  network.fit({ animation: { duration: 500, easingFunction: 'easeInOutQuad' } });
}

/** Re-stabilize the graph physics. */
function graphStabilize() {
  if (!network) return;
  showLoadingIndicator();
  network.stabilize(150);
}

/**
 * Search for a node by query and focus the graph on matching nodes.
 * @param {string} query
 */
function searchGraphNode(query) {
  if (!network || !graphNodes) return;

  const trimmed = query.trim().toLowerCase();
  if (!trimmed) {
    resetHighlights();
    return;
  }

  const matchingIds = [];
  commandsData.commands.forEach((cmd) => {
    if (
      cmd.command.toLowerCase().includes(trimmed) ||
      cmd.name.toLowerCase().includes(trimmed) ||
      (cmd.tags && cmd.tags.some((t) => t.toLowerCase().includes(trimmed)))
    ) {
      matchingIds.push(cmd.id);
    }
  });

  if (!matchingIds.length) {
    resetHighlights();
    return;
  }

  // Highlight matching nodes, dim others
  const allNodeIds = graphNodes.getIds();
  const updatedNodes = allNodeIds.map((id) => ({
    id,
    opacity: matchingIds.includes(id) ? 1.0 : 0.1,
  }));
  graphNodes.update(updatedNodes);

  // Focus on the first match
  if (matchingIds.length === 1) {
    network.focus(matchingIds[0], { scale: 1.2, animation: { duration: 500 } });
    network.selectNodes(matchingIds);
  } else {
    network.fit({ nodes: matchingIds, animation: { duration: 500 } });
    network.selectNodes(matchingIds);
  }
}

/* ─────────────────────────────────────────────
   CATEGORY LEGEND & FILTER
   ───────────────────────────────────────────── */

/**
 * Render the category legend with filter checkboxes.
 * Renders into #graph-legend-list, which is the container inside the legend panel.
 */
function renderCategoryLegend() {
  const container = document.getElementById('graph-legend-list') || document.getElementById('graph-legend');
  if (!container) return;

  let html = '';

  commandsData.categories.forEach((cat) => {
    const count = getCommandsByCategory(cat.id).length;
    html += `
      <label class="graph-legend-item" data-category="${cat.id}" role="listitem">
        <input type="checkbox" checked data-category-id="${cat.id}">
        <span class="graph-legend-dot" style="background:${cat.color}"></span>
        <span class="graph-legend-label">${escapeHtml(cat.name)}</span>
        <span class="graph-legend-count">${count}</span>
      </label>`;
  });

  container.innerHTML = html;

  // Bind filter checkboxes
  container.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener('change', (e) => {
      const catId = e.target.dataset.categoryId;
      if (e.target.checked) {
        visibleCategories.add(catId);
      } else {
        visibleCategories.delete(catId);
      }
      applyGraphCategoryFilter();
    });
  });

  // Bind "Toggle All" button
  const toggleAllBtn = document.getElementById('graph-legend-toggle-all');
  if (toggleAllBtn) {
    toggleAllBtn.addEventListener('click', () => {
      const allChecked = visibleCategories.size === commandsData.categories.length;
      container.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
        cb.checked = !allChecked;
        const catId = cb.dataset.categoryId;
        if (!allChecked) {
          visibleCategories.add(catId);
        } else {
          visibleCategories.delete(catId);
        }
      });
      applyGraphCategoryFilter();
    });
  }
}

/**
 * Show/hide nodes based on the visible categories set.
 */
function applyGraphCategoryFilter() {
  if (!graphNodes) return;

  const updates = [];
  commandsData.commands.forEach((cmd) => {
    updates.push({
      id: cmd.id,
      hidden: !visibleCategories.has(cmd.categoryId),
    });
  });
  graphNodes.update(updates);
}

/* ─────────────────────────────────────────────
   LOADING INDICATOR
   ───────────────────────────────────────────── */

/**
 * Show the graph loading overlay.
 * The loading element is visible by default in HTML (display:flex via CSS).
 * This function ensures it's visible and resets opacity for re-use.
 */
function showLoadingIndicator() {
  const el = document.getElementById('graph-loading');
  if (el) {
    el.style.display = 'flex';
    el.style.opacity = '1';
  }
}

/**
 * Hide the graph loading overlay with a smooth fade-out.
 */
function hideLoadingIndicator() {
  const el = document.getElementById('graph-loading');
  if (el) {
    el.style.opacity = '0';
    setTimeout(() => { el.style.display = 'none'; }, 500);
  }
}

/**
 * Update the loading progress text.
 * Uses the subtitle element from graph.html structure.
 * @param {number} percent — 0–100
 */
function updateLoadingProgress(percent) {
  const subtitle = document.getElementById('graph-loading-subtitle');
  if (subtitle) subtitle.textContent = `Stabilizing nodes… ${percent}%`;

  const text = document.querySelector('#graph-loading .graph-loading-text');
  if (text && percent >= 100) text.textContent = 'Almost ready…';
}

/* ─────────────────────────────────────────────
   AUTO-INIT — Register as page initializer
   ───────────────────────────────────────────── */

window.initPage = function () {
  initGraph();
};
