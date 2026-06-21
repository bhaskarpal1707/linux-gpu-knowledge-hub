# CmdHub — Linux GPU & AI/ML Command Center ⚡

CmdHub is a premium, cinematic, dark-mode static web application designed as a developer-focused command explorer and interactive knowledge hub. It parses the complete library of process, network, port, memory, Docker, disk, and GPU debugging commands (inspired by the *Linux GPU Debugging Cheatsheet*), presenting them in a beautiful, obsidian-style layout.

Developed by [Bhaskar Pal](https://github.com/bhaskarpal1707).

---

## 🚀 Key Features

* **⚡ Lightning-Fast Search**: Fuzzy search (powered by weighted indexing) with a custom, offline-capable, lightweight fallback matching engine if CDNs fail to load. Fully keyboard navigable.
* **📂 13 Category Divisions**: Command groups covering Process Monitoring, GPU monitoring, Log Debugging, Memory, Disk, Network, Docker, and specific AI/ML tasks (e.g. `PyTorch CUDA` checks).
* **🕸️ Interactive Vis-Network Graph**: Visualizes connections and pipelines between related commands (e.g. `ps aux | grep` linked with `pgrep`, `pidof`, and `kill`) in a force-directed interactive node canvas.
* **💻 Interactive macOS Terminal Emulator**: macOS-style terminal console containing custom shell utilities (`help`, `ls`, `search`, `cat <id>`, `favorites`, `recent`, `clear`) allowing direct command lookups and query fallbacks.
* **❤️ LocalStorage Favorites & Recents**: Toggle and bookmark favorites or browse your recently viewed history in real-time.
* **📱 Cinematic Responsive Design**: Premium glassmorphism effects, aurora backgrounds, customizable themes, and layout support for mobile, tablet, and desktop viewports.

---

## 🛠️ Technology Stack

* **HTML5** — Semantic, accessible
* **Vanilla CSS** — Custom properties, glassmorphism, animations (no Bootstrap)
* **Vanilla JS (ES6+)** — Async/await, template literals, event delegation
* **Fuse.js** — Fuzzy search (CDN)
* **vis-network** — Graph visualization (CDN)
* **Bootstrap Icons** — Icon set (CDN)
* **Google Fonts** — Inter typeface

---

## 🔍 Under the Hood: Core Systems

### 1. Robust Search Fallback Engine
CmdHub is engineered to run seamlessly in any environment. The main search is powered by **Fuse.js**, but if the CDN fails to load (offline environments, strict proxy rules, or secure setups), search automatically falls back to an internal class `FallbackFuse` implemented in `assets/js/search.js`.

* **Weighted Matching**: It searches across keys like `command`, `name`, `purpose`, and `tags`, calculating scores based on weights.
* **Sub-string Scoring**:
  * Exact matches: Highest score multiplier ($5\times$ weight).
  * Prefix matches: Medium score multiplier ($3\times$ weight).
  * Sub-string matches: Standard multiplier ($1\times$ weight).
* **Clean Fallback Highlight**: Text results degrade gracefully to plain highlights if Fuse match ranges are missing.

### 2. Force-Directed Graph Layout
The Command Graph (`pages/graph.html`) uses **vis-network** to draw relationships:
* **Nodes**: Represent command objects colored by category.
* **Edges**: Represent pipelines and references (e.g., `nvidia-smi` connected to `watch -n 1 nvidia-smi` or `fuser -v /dev/nvidia*`).
* **Physics Settings**: Configured with a stabilized Barnes-Hut gravitational layout to balance high performance and readability:
  ```javascript
  physics: {
    barnesHut: {
      gravitationalConstant: -3000,
      springLength: 200,
      springConstant: 0.04
    },
    stabilization: { iterations: 150 }
  }
  ```

### 3. Terminal Emulator Mode
The terminal mode (`pages/terminal.html`) recreates a developer shell:
* **Commands**: Supports shell utilities including fuzzy searching via CLI: `search <query>`.
* **Tab-Completion**: Pressing <kbd>Tab</kbd> searches matching commands and autocompletes them.
* **Command History**: Arrow up/down loops through historical inputs using memory arrays.

---

## 📊 Command Schema (`commands.json`)
All commands are defined in a clean JSON format under `assets/data/commands.json`.

```json
{
  "id": "nvidia-smi",
  "name": "NVIDIA System Management Interface",
  "command": "nvidia-smi",
  "categoryId": "gpu-monitoring",
  "purpose": "Query and monitor NVIDIA GPU devices.",
  "example": "nvidia-smi",
  "usefulWhen": [
    "Checking GPU temperature and wattage usage",
    "Monitoring VRAM consumption",
    "Verifying active CUDA processes"
  ],
  "syntax": "nvidia-smi [options]",
  "tags": ["gpu", "nvidia", "cuda", "monitoring"],
  "complexity": "beginner",
  "relatedCommands": [
    "watch-nvidia-smi",
    "nvidia-smi-pmon",
    "fuser-nvidia"
  ]
}
```

---

## 📂 Project Directory Structure

```text
linux-gpu-knowledge-hub/
├── README.md                  # This file
├── index.html                 # Dashboard (Hero search, category cards, quick-access panels)
├── pages/
│   ├── explorer.html          # Command Explorer (Filtering, sorting, and pill filters)
│   ├── graph.html             # Graph View (Force-directed network and selected details)
│   └── terminal.html          # Terminal Mode (Decorative chrome and shell interface)
└── assets/
    ├── css/
    │   └── styles.css         # Cinematic Design System (Glassmorphic surfaces, spring animations)
    ├── js/
    │   ├── app.js             # Core Application State, LocalStorage, Modals & Navigation
    │   ├── search.js          # Fuse.js configuration and local fallback fuzzy matching
    │   ├── graph.js           # Vis-Network graph settings, filtering and legends
    │   └── terminal.js        # Command shell, completion logic, and index lookups
    └── data/
        └── commands.json      # Structured Command Library (Categories & Commands)
```

---

## 🚀 Quick Start / Local Setup

Since CmdHub is built entirely as a **static web application**, it runs directly in the browser and requires no compile steps, npm pipelines, or backend databases.

### Option 1: Double-Click
Simply open `index.html` directly in any modern web browser.

### Option 2: Run a Local Development Server
To ensure correct resource path resolutions and fast rendering of Vis-Network and Fuse, run a simple HTTP server from the root of the project folder:

**Using Python:**
```bash
python -m http.server 8080
```
Open **[http://localhost:8080](http://localhost:8080)** in your browser.

**Using Node.js (npx):**
```bash
npx serve
```

---

## ⚙️ Keyboard Shortcuts

* <kbd>Ctrl</kbd> + <kbd>K</kbd> or <kbd>/</kbd> — Focus the global search bar from anywhere on any page.
* <kbd>Esc</kbd> — Close active modal dialog overlays, details panels, or search results.
* <kbd>Tab</kbd> — Autocomplete commands inside the interactive Terminal Mode.

---

## 📦 Deploying to GitHub (Upload Instructions)

To upload this repository to your GitHub account, follow these commands:

1. **Initialize Git**:
   ```bash
   git init
   ```
2. **Add all files**:
   ```bash
   git add .
   ```
3. **Commit changes**:
   ```bash
   git commit -m "feat: initial release of CmdHub Linux GPU Command Center"
   ```
4. **Link remote repository** (Replace with your actual GitHub username and repo name):
   ```bash
   git remote add origin https://github.com/bhaskarpal1707/linux-gpu-knowledge-hub.git
   ```
5. **Rename branch to main**:
   ```bash
   git branch -M main
   ```
6. **Push to GitHub**:
   ```bash
   git push -u origin main
   ```

---

## 🌐 Publishing to GitHub Pages (Live Demo)
You can host this project **for free** using GitHub Pages:
1. Go to your repository on GitHub.
2. Click on **Settings** (gear icon) -> **Pages** (in the left sidebar under *Code and automation*).
3. Under **Build and deployment**, select **Deploy from a branch**.
4. Choose the `main` branch and `/ (root)` folder, then click **Save**.
5. After a few minutes, your site will be live at: `https://bhaskarpal1707.github.io/linux-gpu-knowledge-hub/`

---

## 📝 License

This project is open-source. Feel free to clone, customize, and extend it as you see fit.

Developed with ❤️ by [Bhaskar Pal](https://github.com/bhaskarpal1707).
