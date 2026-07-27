// ============================================================
// KC Games — game data, window management, taskbar, start menu
// ============================================================

// Edit this array to add/remove/update your games.
const GAMES = [
  {
    title: "Corrupted Reality",
    description: "Add your description here — what the game is about, how it plays, and what makes it yours.",
    tags: ["Horror", "Retro"],
    status: "In Progress",
    image: "assets/corrupted-reality.png",
    accent: ["#f2a900", "#c07f00"],
    link: "#"
  }
];

const SCHEMES = ["blue", "olive", "silver"];
let zCounter = 10;

/* ---------------- Filing drawer ---------------- */

const TAB_POSITIONS = ["tab-left", "tab-center", "tab-right"];

// Games can use either an image logo or an emoji icon.
function artFor(game) {
  return game.image
    ? `<img class="game-art" src="${game.image}" alt="">`
    : game.icon;
}

function renderGames() {
  const drawer = document.getElementById("games-drawer");

  GAMES.forEach((game, i) => {
    const folder = document.createElement("button");
    folder.className = "file-folder";
    folder.type = "button";
    folder.innerHTML = `
      <span class="folder-face">
        <span class="folder-paper">
          <span class="paper-line"></span>
          <span class="paper-line"></span>
          <span class="paper-line"></span>
          <span class="paper-line"></span>
        </span>
        <span class="folder-badge" style="background: linear-gradient(135deg, ${game.accent[0]}, ${game.accent[1]});">${artFor(game)}</span>
        <span class="folder-front">
          <span class="folder-name"></span>
          <span class="folder-status"></span>
        </span>
      </span>
      <span class="folder-tab ${TAB_POSITIONS[i % 3]}"></span>
    `;
    folder.querySelector(".folder-name").textContent = game.title;
    folder.querySelector(".folder-status").textContent = game.status;
    folder.querySelector(".folder-tab").textContent = game.title;

    folder.addEventListener("click", () => {
      document.querySelectorAll(".file-folder.pulled").forEach((el) => el.classList.remove("pulled"));
      folder.classList.add("pulled");
      document.getElementById("status-text").textContent = `${game.title} — ${game.status}`;
      setTimeout(() => openDialog(i), 200);
    });

    drawer.appendChild(folder);
  });

  document.getElementById("status-text").textContent = `${GAMES.length} file(s)`;
}

/* ---------------- Game properties dialog ---------------- */

function openDialog(index) {
  const game = GAMES[index];
  document.getElementById("dialog-title").textContent = `${game.title} Properties`;
  document.getElementById("dialog-icon").innerHTML = artFor(game);

  const bigIcon = document.getElementById("dialog-icon-large");
  bigIcon.innerHTML = artFor(game);
  bigIcon.style.background = `linear-gradient(135deg, ${game.accent[0]}, ${game.accent[1]})`;
  document.getElementById("dialog-name").textContent = game.title;
  document.getElementById("dialog-desc").textContent = game.description;
  document.getElementById("dialog-status").textContent = game.status;
  document.getElementById("dialog-tags").textContent = game.tags.join(", ");
  document.getElementById("dialog-link").href = game.link;
  document.getElementById("modal-overlay").classList.add("open");
}

function closeDialog() {
  document.getElementById("modal-overlay").classList.remove("open");
  document.querySelectorAll(".file-folder.pulled").forEach((el) => el.classList.remove("pulled"));
}

/* ---------------- Window management ---------------- */

function focusWindow(id) {
  const win = document.getElementById(id);
  if (!win) return;
  win.classList.remove("is-hidden");
  win.style.zIndex = ++zCounter;
  updateTaskbar();
}

function initWindows() {
  document.querySelectorAll(".window").forEach((win) => {
    win.addEventListener("mousedown", () => {
      win.style.zIndex = ++zCounter;
      updateTaskbar();
    });

    makeDraggable(win);

    win.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const action = btn.dataset.action;

        if (action === "dialog-close") {
          closeDialog();
        } else if (action === "close" || action === "minimize") {
          win.classList.add("is-hidden");
          updateTaskbar();
        } else if (action === "maximize") {
          win.classList.toggle("maximized");
          if (win.classList.contains("maximized")) {
            win.dataset.prev = JSON.stringify({
              left: win.style.left, top: win.style.top, width: win.style.width
            });
            win.style.left = "0px";
            win.style.top = "0px";
            win.style.width = "100%";
          } else {
            const prev = JSON.parse(win.dataset.prev || "{}");
            win.style.left = prev.left || "60px";
            win.style.top = prev.top || "40px";
            win.style.width = prev.width || "700px";
          }
        }
      });
    });
  });

  document.querySelectorAll("[data-focus]").forEach((el) => {
    el.addEventListener("click", () => {
      focusWindow(el.dataset.focus);
      closeStartMenu();
    });
  });

  document.getElementById("modal-overlay").addEventListener("click", (e) => {
    if (e.target.id === "modal-overlay") closeDialog();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { closeDialog(); closeStartMenu(); }
  });
}

function makeDraggable(win) {
  const bar = win.querySelector(".title-bar");
  if (!bar) return;

  bar.addEventListener("mousedown", (e) => {
    if (e.target.closest(".tb-btn")) return;
    if (win.classList.contains("maximized")) return;

    const rect = win.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    function onMove(ev) {
      win.style.left = Math.max(0, ev.clientX - offsetX) + "px";
      win.style.top = Math.max(0, ev.clientY - offsetY) + "px";
    }

    function onUp() {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    e.preventDefault();
  });
}

/* ---------------- Taskbar ---------------- */

function updateTaskbar() {
  const container = document.getElementById("taskbar-items");
  const windows = [...document.querySelectorAll(".desktop .window:not(.dialog-window)")];
  const topZ = Math.max(...windows.filter((w) => !w.classList.contains("is-hidden"))
    .map((w) => parseInt(w.style.zIndex || 0, 10)), 0);

  container.innerHTML = "";

  windows.forEach((win) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "taskbar-item";
    if (!win.classList.contains("is-hidden") && parseInt(win.style.zIndex || 0, 10) === topZ) {
      item.classList.add("active");
    }
    item.textContent = win.querySelector(".title-bar-text").textContent;
    item.addEventListener("click", () => {
      if (win.classList.contains("is-hidden")) {
        focusWindow(win.id);
      } else if (parseInt(win.style.zIndex || 0, 10) === topZ) {
        win.classList.add("is-hidden");
        updateTaskbar();
      } else {
        focusWindow(win.id);
      }
    });
    container.appendChild(item);
  });
}

/* ---------------- Start menu + tray ---------------- */

function closeStartMenu() {
  document.getElementById("start-menu").classList.remove("open");
}

function cycleScheme() {
  const root = document.documentElement;
  const current = root.getAttribute("data-scheme") || "blue";
  const next = SCHEMES[(SCHEMES.indexOf(current) + 1) % SCHEMES.length];
  root.setAttribute("data-scheme", next);
  localStorage.setItem("kc-games-scheme", next);
}

function initShell() {
  const stored = localStorage.getItem("kc-games-scheme");
  if (stored && SCHEMES.includes(stored)) {
    document.documentElement.setAttribute("data-scheme", stored);
  }

  const startBtn = document.getElementById("start-button");
  const startMenu = document.getElementById("start-menu");

  startBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    startMenu.classList.toggle("open");
  });

  document.addEventListener("click", (e) => {
    if (!startMenu.contains(e.target) && e.target !== startBtn) closeStartMenu();
  });

  document.querySelectorAll("[data-scheme-cycle]").forEach((el) => {
    el.addEventListener("click", () => { cycleScheme(); closeStartMenu(); });
  });

  document.getElementById("tray-scheme").addEventListener("click", cycleScheme);

  function tick() {
    const now = new Date();
    document.getElementById("tray-clock").textContent =
      now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  }
  tick();
  setInterval(tick, 10000);
}

/* ---------------- Boot ---------------- */

document.addEventListener("DOMContentLoaded", () => {
  renderGames();
  initWindows();
  initShell();
  updateTaskbar();
});
