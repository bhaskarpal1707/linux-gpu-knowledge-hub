/**
 * ============================================================
 *  Linux GPU & AI/ML Knowledge Hub — Terminal Interface
 *  A CLI-style command explorer. Only loaded on pages/terminal.html.
 * ============================================================
 */

'use strict';

/* ─────────────────────────────────────────────
   TERMINAL STATE
   ───────────────────────────────────────────── */

/** @type {string[]} Command history for up/down arrow navigation */
let terminalHistory = [];

/** @type {number} Current position in history (-1 = new input) */
let historyIndex = -1;

/** @type {Array|null} Last search results for numbered selection */
let lastSearchResults = null;

/** @type {Fuse|null} Fuse.js instance for fuzzy searching, if available */
let terminalFuse = null;

/* ─────────────────────────────────────────────
   TERMINAL INITIALIZATION
   ───────────────────────────────────────────── */

/**
 * Initialize the terminal interface.
 * Must be called after commandsData is loaded.
 */
function initTerminal() {
  const input = document.getElementById('terminal-input');
  const body  = document.getElementById('terminal-body');
  if (!input || !body) {
    console.error('[terminal] Required elements not found.');
    return;
  }

  // Initialize Fuse.js if available for fuzzy search
  initTerminalFuse();

  // Print welcome message
  printWelcome();

  // Focus input
  input.focus();

  // Bind events
  bindTerminalEvents(input);

  // Click anywhere on terminal container focuses input
  const container = document.getElementById('terminal-container') || body;
  container.addEventListener('click', () => input.focus());
}

/**
 * Initialize Fuse.js for fuzzy search if the library is loaded.
 * Falls back to simple text matching if Fuse is not available.
 */
function initTerminalFuse() {
  if (typeof Fuse !== 'undefined' && commandsData && commandsData.commands) {
    try {
      terminalFuse = new Fuse(commandsData.commands, {
        keys: [
          { name: 'command', weight: 0.3 },
          { name: 'name', weight: 0.25 },
          { name: 'purpose', weight: 0.2 },
          { name: 'tags', weight: 0.15 },
          { name: 'id', weight: 0.1 },
        ],
        threshold: 0.4,
        includeScore: true,
        minMatchCharLength: 2,
      });
    } catch (e) {
      console.warn('[terminal] Fuse.js init failed, using simple search:', e);
      terminalFuse = null;
    }
  }
}

/* ─────────────────────────────────────────────
   WELCOME MESSAGE
   ───────────────────────────────────────────── */

function printWelcome() {
  addLine('╔══════════════════════════════════════════════════════╗', 'terminal-ascii');
  addLine('║  Linux GPU & AI/ML Knowledge Hub — Terminal Mode    ║', 'terminal-ascii');
  addLine('║  Type \'help\' for available commands                 ║', 'terminal-ascii');
  addLine('╚══════════════════════════════════════════════════════╝', 'terminal-ascii');
  addLine('');
  addLine('Welcome, engineer. Type a command to begin.', 'terminal-info');
  addLine('');
}

/* ─────────────────────────────────────────────
   EVENT BINDING
   ───────────────────────────────────────────── */

/**
 * Bind keyboard and input events on the terminal input.
 * @param {HTMLInputElement} input
 */
function bindTerminalEvents(input) {
  input.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        const value = input.value.trim();
        if (!value) return;
        terminalHistory.push(value);
        historyIndex = terminalHistory.length;
        addPromptLine(value);
        processCommand(value);
        input.value = '';
        break;

      case 'ArrowUp':
        e.preventDefault();
        if (terminalHistory.length === 0) return;
        historyIndex = Math.max(0, historyIndex - 1);
        input.value = terminalHistory[historyIndex] || '';
        break;

      case 'ArrowDown':
        e.preventDefault();
        historyIndex = Math.min(terminalHistory.length, historyIndex + 1);
        input.value = terminalHistory[historyIndex] || '';
        break;

      case 'Tab':
        e.preventDefault();
        autoComplete(input);
        break;

      case 'l':
        // Ctrl+L → clear
        if (e.ctrlKey) {
          e.preventDefault();
          clearTerminal();
        }
        break;
    }
  });
}

/* ─────────────────────────────────────────────
   COMMAND PROCESSING
   ───────────────────────────────────────────── */

/**
 * Parse user input and dispatch to the appropriate handler.
 * @param {string} input — raw user input
 */
function processCommand(input) {
  const parts = input.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const args = parts.slice(1).join(' ');

  // Check if user typed a number to select from last search results
  if (lastSearchResults && /^\d+$/.test(cmd)) {
    const idx = parseInt(cmd, 10) - 1;
    if (idx >= 0 && idx < lastSearchResults.length) {
      cmdCat(lastSearchResults[idx].id);
      lastSearchResults = null;
      return;
    }
  }

  // Reset last search results when executing a non-number command
  lastSearchResults = null;

  // 1. Check if the input corresponds directly to a command ID or command string
  const cleanInput = input.trim().toLowerCase();
  const directCmd = commandsData.commands.find(
    (c) => c.id.toLowerCase() === cmd || 
           c.command.toLowerCase() === cleanInput || 
           c.command.toLowerCase().replace(/\s+/g, '') === cleanInput.replace(/\s+/g, '')
  );

  if (directCmd) {
    cmdCat(directCmd.id);
    return;
  }

  // 2. Fall back to standard shell command dispatch
  switch (cmd) {
    case 'help':
      cmdHelp();
      break;
    case 'search':
      cmdSearch(args);
      break;
    case 'ls':
      cmdLs(args);
      break;
    case 'cat':
      cmdCat(args);
      break;
    case 'clear':
      clearTerminal();
      break;
    case 'favorites':
    case 'favs':
      cmdFavorites();
      break;
    case 'recent':
      cmdRecent();
      break;
    case 'about':
      cmdAbout();
      break;
    case 'exit':
    case 'quit':
      addLine('Redirecting to dashboard…', 'terminal-info');
      setTimeout(() => {
        window.location.href = '../index.html';
      }, 600);
      break;
    default:
      // Fallback: automatically fuzzy search if they typed something else
      if (input.trim().length >= 2) {
        addLine(`Command '${escapeHtml(cmd)}' not found. Searching cheatsheet for '${escapeHtml(input)}'...`, 'terminal-info');
        addLine('');
        cmdSearch(input);
      } else {
        addLine(`Command not found: ${escapeHtml(cmd)}. Type 'help' for available commands.`, 'terminal-error');
      }
  }

  addLine('');
}

/* ─────────────────────────────────────────────
   COMMAND HANDLERS
   ───────────────────────────────────────────── */

/** Display available commands. */
function cmdHelp() {
  addLine('Available commands:', 'terminal-heading');
  addLine('');
  const commands = [
    ['help',                'Show this help message'],
    ['search <query>',      'Fuzzy search for commands'],
    ['ls',                  'List all categories'],
    ['ls <category>',       'List commands in a category'],
    ['cat <command-id>',    'Show full command details'],
    ['favorites',           'Show your favourited commands'],
    ['recent',              'Show recently viewed commands'],
    ['clear',               'Clear the terminal'],
    ['about',               'About this application'],
    ['exit',                'Return to dashboard'],
  ];

  commands.forEach(([name, desc]) => {
    addLine(`  ${padRight(name, 22)} ${desc}`, 'terminal-help-line');
  });

  addLine('');
  addLine('Tip: After a search, type a result number to see details.', 'terminal-info');
  addLine('Tip: Use Tab for auto-completion, ↑/↓ for history.', 'terminal-info');
}

/**
 * Search for commands using Fuse.js (fuzzy) if available, or simple text matching.
 * @param {string} query
 */
function cmdSearch(query) {
  if (!query.trim()) {
    addLine('Usage: search <query>', 'terminal-warning');
    return;
  }

  let results;

  if (terminalFuse) {
    // Use Fuse.js fuzzy search
    const fuseResults = terminalFuse.search(query.trim());
    results = fuseResults.map((r) => r.item);
  } else {
    // Fallback: simple text matching
    const q = query.toLowerCase();
    results = commandsData.commands.filter((cmd) =>
      cmd.command.toLowerCase().includes(q) ||
      cmd.name.toLowerCase().includes(q) ||
      cmd.purpose.toLowerCase().includes(q) ||
      (cmd.tags && cmd.tags.some((t) => t.toLowerCase().includes(q)))
    );
  }

  if (!results.length) {
    addLine(`No results found for "${escapeHtml(query)}".`, 'terminal-warning');
    return;
  }

  addLine(`Found ${results.length} result${results.length !== 1 ? 's' : ''}:`, 'terminal-heading');
  addLine('');

  const displayResults = results.slice(0, 20);
  displayResults.forEach((cmd, idx) => {
    const num = `[${idx + 1}]`.padEnd(5);
    const name = padRight(cmd.command, 30);
    const cat = getCategoryById(cmd.categoryId);
    const catName = cat ? cat.name : '';
    addLine(`  ${num} ${name} — ${cmd.purpose}`, 'terminal-result');
  });

  if (results.length > 20) {
    addLine(`  … and ${results.length - 20} more results`, 'terminal-info');
  }

  addLine('');
  addLine('Type a number to see details.', 'terminal-info');

  lastSearchResults = displayResults;
}

/**
 * List categories or commands in a category.
 * @param {string} args — optional category ID or partial name
 */
function cmdLs(args) {
  if (!args.trim()) {
    // List all categories
    addLine('Categories:', 'terminal-heading');
    addLine('');
    commandsData.categories.forEach((cat) => {
      const count = getCommandsByCategory(cat.id).length;
      addLine(`  ${padRight(cat.id, 20)} ${padRight(cat.name, 25)} (${count} commands)`, 'terminal-result');
    });
    addLine('');
    addLine('Usage: ls <category-id> to list commands in a category.', 'terminal-info');
    return;
  }

  // Find category by ID or partial name match
  const q = args.toLowerCase().trim();
  const cat = commandsData.categories.find(
    (c) => c.id.toLowerCase() === q || c.name.toLowerCase().includes(q)
  );

  if (!cat) {
    addLine(`Category not found: "${escapeHtml(args)}". Use 'ls' to see all categories.`, 'terminal-error');
    return;
  }

  const cmds = getCommandsByCategory(cat.id);
  addLine(`${cat.name} (${cmds.length} commands):`, 'terminal-heading');
  addLine('');

  cmds.forEach((cmd, idx) => {
    const num = `[${idx + 1}]`.padEnd(5);
    const name = padRight(cmd.command, 30);
    addLine(`  ${num} ${name} — ${cmd.purpose}`, 'terminal-result');
  });

  lastSearchResults = cmds;
  addLine('');
  addLine('Type a number to see details.', 'terminal-info');
}

/**
 * Show full details for a command.
 * @param {string} idOrQuery — command ID or search term
 */
function cmdCat(idOrQuery) {
  if (!idOrQuery.trim()) {
    addLine('Usage: cat <command-id>', 'terminal-warning');
    return;
  }

  let targetId = idOrQuery.trim();
  // Check if it's a number and we have last search results
  if (lastSearchResults && /^\d+$/.test(targetId)) {
    const idx = parseInt(targetId, 10) - 1;
    if (idx >= 0 && idx < lastSearchResults.length) {
      targetId = lastSearchResults[idx].id;
    }
  }

  // Find by ID first, then by command name
  let cmd = getCommandById(targetId);
  if (!cmd) {
    const q = targetId.toLowerCase();
    cmd = commandsData.commands.find(
      (c) => c.command.toLowerCase() === q || c.name.toLowerCase() === q
    );
  }

  if (!cmd) {
    addLine(`Command not found: "${escapeHtml(idOrQuery)}". Use 'search' to find commands.`, 'terminal-error');
    return;
  }

  addToRecentlyViewed(cmd.id);

  const cat = getCategoryById(cmd.categoryId);
  const border = '─'.repeat(50);

  addLine(`┌─ ${cmd.command} ${'─'.repeat(Math.max(0, 47 - cmd.command.length))}┐`, 'terminal-box');
  addLine(`│ Name:       ${padRight(cmd.name, 37)}│`, 'terminal-box');
  addLine(`│ Category:   ${padRight(cat ? cat.name : 'Unknown', 37)}│`, 'terminal-box');
  addLine(`│ Complexity: ${padRight(cmd.complexity, 37)}│`, 'terminal-box');
  addLine(`├${border}┤`, 'terminal-box');
  addLine(`│ Purpose:`, 'terminal-box');
  wrapText(cmd.purpose, 48).forEach((line) => {
    addLine(`│   ${padRight(line, 47)}│`, 'terminal-box');
  });

  if (cmd.syntax) {
    addLine(`├${border}┤`, 'terminal-box');
    addLine(`│ Syntax:`, 'terminal-box');
    addLine(`│   ${padRight(cmd.syntax, 47)}│`, 'terminal-box');
  }

  if (cmd.example) {
    addLine(`├${border}┤`, 'terminal-box');
    addLine(`│ Example:`, 'terminal-box');
    wrapText(cmd.example, 47).forEach((line) => {
      addLine(`│   ${padRight(line, 47)}│`, 'terminal-box');
    });
  }

  if (cmd.usefulWhen && cmd.usefulWhen.length) {
    addLine(`├${border}┤`, 'terminal-box');
    addLine(`│ Useful When:`, 'terminal-box');
    cmd.usefulWhen.forEach((u) => {
      addLine(`│   • ${padRight(u, 45)}│`, 'terminal-box');
    });
  }

  if (cmd.installation) {
    addLine(`├${border}┤`, 'terminal-box');
    addLine(`│ Installation:`, 'terminal-box');
    addLine(`│   ${padRight(cmd.installation, 47)}│`, 'terminal-box');
  }

  if (cmd.notes) {
    addLine(`├${border}┤`, 'terminal-box');
    addLine(`│ Notes:`, 'terminal-box');
    wrapText(cmd.notes, 47).forEach((line) => {
      addLine(`│   ${padRight(line, 47)}│`, 'terminal-box');
    });
  }

  if (cmd.tags && cmd.tags.length) {
    addLine(`├${border}┤`, 'terminal-box');
    addLine(`│ Tags: ${padRight(cmd.tags.join(', '), 43)}│`, 'terminal-box');
  }

  const related = getRelatedCommands(cmd);
  if (related.length) {
    addLine(`├${border}┤`, 'terminal-box');
    addLine(`│ Related Commands:`, 'terminal-box');
    related.forEach((r) => {
      addLine(`│   → ${padRight(r.command, 45)}│`, 'terminal-box');
    });
  }

  addLine(`└${border}┘`, 'terminal-box');
}

/** List favourited commands. */
function cmdFavorites() {
  if (!favorites.length) {
    addLine('No favourites saved yet.', 'terminal-warning');
    addLine('Use the web interface to favourite commands.', 'terminal-info');
    return;
  }

  addLine(`Favourites (${favorites.length}):`, 'terminal-heading');
  addLine('');

  const results = [];
  favorites.forEach((id, idx) => {
    const cmd = getCommandById(id);
    if (!cmd) return;
    results.push(cmd);
    const num = `[${idx + 1}]`.padEnd(5);
    const name = padRight(cmd.command, 30);
    addLine(`  ${num} ${name} — ${cmd.purpose}`, 'terminal-result');
  });

  lastSearchResults = results;
  addLine('');
  addLine('Type a number to see details.', 'terminal-info');
}

/** List recently viewed commands. */
function cmdRecent() {
  if (!recentlyViewed.length) {
    addLine('No recently viewed commands.', 'terminal-warning');
    return;
  }

  addLine(`Recently Viewed (${recentlyViewed.length}):`, 'terminal-heading');
  addLine('');

  const results = [];
  recentlyViewed.forEach((id, idx) => {
    const cmd = getCommandById(id);
    if (!cmd) return;
    results.push(cmd);
    const num = `[${idx + 1}]`.padEnd(5);
    const name = padRight(cmd.command, 30);
    addLine(`  ${num} ${name} — ${cmd.purpose}`, 'terminal-result');
  });

  lastSearchResults = results;
  addLine('');
  addLine('Type a number to see details.', 'terminal-info');
}

/** Show application info. */
function cmdAbout() {
  addLine('Linux GPU & AI/ML Knowledge Hub', 'terminal-heading');
  addLine('');
  addLine('  A comprehensive command reference for Linux GPU computing,', 'terminal-info');
  addLine('  AI/ML workflows, system administration, and more.', 'terminal-info');
  addLine('');
  addLine(`  Total Commands:   ${commandsData.commands.length}`, 'terminal-info');
  addLine(`  Categories:       ${commandsData.categories.length}`, 'terminal-info');
  addLine(`  Favourites:       ${favorites.length}`, 'terminal-info');
  addLine(`  Search Engine:    ${terminalFuse ? 'Fuse.js (fuzzy)' : 'Basic text match'}`, 'terminal-info');
  addLine('');
  addLine('  Built with ❤️  for the engineering community.', 'terminal-info');
}

/* ─────────────────────────────────────────────
   TERMINAL OUTPUT
   ───────────────────────────────────────────── */

/**
 * Append a line of output to the terminal body.
 * @param {string} content — text content (may contain HTML)
 * @param {string} [className=''] — CSS class(es) for the line
 */
function addLine(content, className = '') {
  const body = document.getElementById('terminal-body');
  if (!body) return;

  const line = document.createElement('div');
  line.className = `terminal-line ${className}`.trim();

  // Use textContent for plain lines, innerHTML for styled ones
  if (className.includes('terminal-box') || className.includes('terminal-ascii')) {
    // Box-drawing and ASCII art needs to preserve exact spacing
    const pre = document.createElement('pre');
    pre.className = 'terminal-pre';
    pre.textContent = content;
    line.appendChild(pre);
  } else {
    line.innerHTML = content || '&nbsp;';
  }

  body.appendChild(line);

  // Auto-scroll to bottom
  body.scrollTop = body.scrollHeight;
}

/**
 * Show the typed command with a prompt prefix.
 * @param {string} command
 */
function addPromptLine(command) {
  const body = document.getElementById('terminal-body');
  if (!body) return;

  const line = document.createElement('div');
  line.className = 'terminal-line terminal-prompt-line';
  line.innerHTML = `<span class="terminal-prompt">user@hub:~$</span> <span class="terminal-command-text">${escapeHtml(command)}</span>`;
  body.appendChild(line);
  body.scrollTop = body.scrollHeight;
}

/** Clear all terminal output. */
function clearTerminal() {
  const body = document.getElementById('terminal-body');
  if (body) body.innerHTML = '';
}

/* ─────────────────────────────────────────────
   AUTO-COMPLETE
   ───────────────────────────────────────────── */

/**
 * Basic auto-completion for command names and built-in commands.
 * @param {HTMLInputElement} input
 */
function autoComplete(input) {
  const value = input.value.trim().toLowerCase();
  if (!value) return;

  const builtins = ['help', 'search', 'ls', 'cat', 'clear', 'favorites', 'recent', 'about', 'exit'];
  const parts = value.split(/\s+/);
  const base = parts[0];

  // If user is typing a builtin command
  if (parts.length === 1) {
    const matches = builtins.filter((b) => b.startsWith(base));
    if (matches.length === 1) {
      input.value = matches[0] + ' ';
    } else if (matches.length > 1) {
      addLine('');
      addLine(`Completions: ${matches.join('  ')}`, 'terminal-info');
    }
    return;
  }

  // If completing an argument for 'cat' or 'ls'
  if (base === 'cat' && parts.length === 2) {
    const q = parts[1];
    const matches = commandsData.commands
      .filter((c) => c.id.toLowerCase().startsWith(q) || c.command.toLowerCase().startsWith(q))
      .slice(0, 10);

    if (matches.length === 1) {
      input.value = `cat ${matches[0].id}`;
    } else if (matches.length > 1) {
      addLine('');
      addLine(`Completions: ${matches.map((m) => m.command).join('  ')}`, 'terminal-info');
    }
    return;
  }

  if (base === 'ls' && parts.length === 2) {
    const q = parts[1];
    const matches = commandsData.categories
      .filter((c) => c.id.toLowerCase().startsWith(q) || c.name.toLowerCase().startsWith(q));

    if (matches.length === 1) {
      input.value = `ls ${matches[0].id}`;
    } else if (matches.length > 1) {
      addLine('');
      addLine(`Completions: ${matches.map((m) => m.id).join('  ')}`, 'terminal-info');
    }
  }
}

/* ─────────────────────────────────────────────
   TEXT UTILITIES
   ───────────────────────────────────────────── */

/**
 * Pad a string to the right with spaces.
 * @param {string} str
 * @param {number} width
 * @returns {string}
 */
function padRight(str, width) {
  if (!str) str = '';
  if (str.length >= width) return str.slice(0, width);
  return str + ' '.repeat(width - str.length);
}

/**
 * Wrap text to a maximum line width.
 * @param {string} text
 * @param {number} maxWidth
 * @returns {string[]}
 */
function wrapText(text, maxWidth) {
  if (!text) return [''];
  const words = text.split(/\s+/);
  const lines = [];
  let current = '';

  for (const word of words) {
    if (current.length + word.length + 1 > maxWidth && current.length > 0) {
      lines.push(current);
      current = word;
    } else {
      current = current ? current + ' ' + word : word;
    }
  }

  if (current) lines.push(current);
  return lines.length ? lines : [''];
}

/* ─────────────────────────────────────────────
   AUTO-INIT — Register as page initializer
   ───────────────────────────────────────────── */

window.initPage = function () {
  initTerminal();
};
