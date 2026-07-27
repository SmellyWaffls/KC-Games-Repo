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

// Blank filler folders padding out the drawer. Purely tactile — they hover
// and click like real ones but hold nothing. Bump this to taste.
const EMPTY_SLOTS = 18;

const SCHEMES = ["blue", "olive", "silver"];
let zCounter = 10;

/* ---------------- Sound ---------------- */
// Everything is synthesized with the Web Audio API, so there are no audio
// files to ship. The context is created lazily on the first interaction
// because browsers block audio until the user has touched the page.

const Sound = (() => {
  let ctx = null;
  let muted = localStorage.getItem("kc-games-muted") === "1";

  function audio() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  // A single decaying oscillator blip.
  function blip({ freq, to, type = "square", dur = 0.06, vol = 0.05 }) {
    const a = audio();
    if (!a || muted) return;

    const osc = a.createOscillator();
    const gain = a.createGain();
    const t = a.currentTime;

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);

    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    osc.connect(gain).connect(a.destination);
    osc.start(t);
    osc.stop(t + dur);
  }

  // Band-passed white noise — used for the paper-slide rasp.
  function rasp({ dur = 0.14, vol = 0.05, from = 1400, to = 500 }) {
    const a = audio();
    if (!a || muted) return;

    const frames = Math.floor(a.sampleRate * dur);
    const buffer = a.createBuffer(1, frames, a.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    }

    const src = a.createBufferSource();
    src.buffer = buffer;

    const filter = a.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 1.2;
    filter.frequency.setValueAtTime(from, a.currentTime);
    filter.frequency.exponentialRampToValueAtTime(to, a.currentTime + dur);

    const gain = a.createGain();
    gain.gain.setValueAtTime(vol, a.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);

    src.connect(filter).connect(gain).connect(a.destination);
    src.start();
  }

  // A run of notes, used for win fanfares and save confirmations.
  function arp(freqs, { gap = 80, dur = 0.12, vol = 0.05, type = "triangle" } = {}) {
    freqs.forEach((f, i) => setTimeout(() => blip({ freq: f, dur, vol, type }), i * gap));
  }

  return {
    // Sweeping the cursor across the drawer walks up a scale, so a fast
    // pass sounds like running a thumb along the file tabs.
    tick(step = 0) {
      blip({ freq: 520 + (step % 12) * 26, dur: 0.035, vol: 0.035, type: "square" });
    },

    // --- primitives, for the built-in apps to compose with ---
    blip,
    rasp,
    arp,

    // Low noise burst plus a sub drop — the Minesweeper detonation.
    boom() {
      rasp({ dur: 0.45, vol: 0.13, from: 900, to: 60 });
      blip({ freq: 130, to: 32, dur: 0.5, vol: 0.12, type: "sine" });
    },

    // Short hollow pop for revealing a cell or committing a shape.
    pop(step = 0) {
      blip({ freq: 300 + (step % 8) * 40, to: 640, dur: 0.045, vol: 0.045, type: "square" });
    },

    // Downward whoosh for clearing or resetting.
    swipe() {
      rasp({ dur: 0.22, vol: 0.07, from: 2200, to: 300 });
    },
    slide() {
      rasp({ dur: 0.16, vol: 0.06, from: 1600, to: 420 });
    },
    open() {
      blip({ freq: 660, dur: 0.07, vol: 0.05, type: "triangle" });
      setTimeout(() => blip({ freq: 990, dur: 0.11, vol: 0.045, type: "triangle" }), 70);
    },
    close() {
      blip({ freq: 420, to: 240, dur: 0.09, vol: 0.045, type: "triangle" });
    },
    click() {
      blip({ freq: 880, to: 620, dur: 0.04, vol: 0.04, type: "square" });
    },
    thud() {
      blip({ freq: 200, to: 120, dur: 0.1, vol: 0.05, type: "sine" });
    },
    isMuted() { return muted; },
    toggleMute() {
      muted = !muted;
      localStorage.setItem("kc-games-muted", muted ? "1" : "0");
      if (!muted) Sound.click();
      return muted;
    }
  };
})();

// A top-level `const` is not a property of `window`, so apps.js could not
// see it through `window.Sound`. Publish it explicitly.
window.Sound = Sound;

/* ---------------- Filing drawer ---------------- */

const TAB_POSITIONS = ["tab-left", "tab-center", "tab-right"];

// Games can use either an image logo or an emoji icon.
function artFor(game) {
  return game.image
    ? `<img class="game-art" src="${game.image}" alt="">`
    : (game.icon || "");
}

function folderMarkup(game, i) {
  const badge = game
    ? `<span class="folder-badge" style="background: linear-gradient(135deg, ${game.accent[0]}, ${game.accent[1]});">${artFor(game)}</span>`
    : "";

  return `
    <span class="folder-face">
      <span class="folder-paper">
        <span class="paper-line"></span>
        <span class="paper-line"></span>
        <span class="paper-line"></span>
        <span class="paper-line"></span>
      </span>
      ${badge}
      <span class="folder-front">
        <span class="folder-name"></span>
        <span class="folder-status"></span>
      </span>
    </span>
    <span class="folder-tab ${TAB_POSITIONS[i % 3]}"></span>
  `;
}

function makeFolder(game, i) {
  const folder = document.createElement("button");
  folder.className = game ? "file-folder" : "file-folder is-empty";
  folder.type = "button";
  folder.innerHTML = folderMarkup(game, i);

  if (game) {
    folder.querySelector(".folder-name").textContent = game.title;
    folder.querySelector(".folder-status").textContent = game.status;
    folder.querySelector(".folder-tab").textContent = game.title;
  }

  // The whole point of the empty folders: a satisfying run of ticks as the
  // cursor sweeps the drawer.
  folder.addEventListener("mouseenter", () => Sound.tick(i));

  folder.addEventListener("click", () => {
    document.querySelectorAll(".file-folder.pulled").forEach((el) => el.classList.remove("pulled"));
    folder.classList.add("pulled");
    Sound.slide();

    const status = document.getElementById("status-text");

    if (!game) {
      status.textContent = "Empty folder";
      setTimeout(() => folder.classList.remove("pulled"), 420);
      setTimeout(() => Sound.thud(), 170);
      return;
    }

    status.textContent = `${game.title} — ${game.status}`;
    setTimeout(() => openDialog(GAMES.indexOf(game)), 200);
  });

  return folder;
}

function renderGames() {
  const drawer = document.getElementById("games-drawer");

  GAMES.forEach((game, i) => drawer.appendChild(makeFolder(game, i)));

  for (let i = 0; i < EMPTY_SLOTS; i++) {
    drawer.appendChild(makeFolder(null, GAMES.length + i));
  }

  document.getElementById("status-text").textContent =
    `${GAMES.length} file(s), ${EMPTY_SLOTS} empty`;
}

/* ---------------- Game properties dialog ---------------- */

function openDialog(index) {
  const game = GAMES[index];
  if (!game) return;

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
  Sound.open();
}

function closeDialog() {
  const overlay = document.getElementById("modal-overlay");
  if (overlay.classList.contains("open")) Sound.close();
  overlay.classList.remove("open");
  document.querySelectorAll(".file-folder.pulled").forEach((el) => el.classList.remove("pulled"));
}

/* ---------------- Window management ---------------- */

function focusWindow(id) {
  const win = document.getElementById(id);
  if (!win) return;
  win.classList.remove("is-closed", "is-minimized");
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
        } else if (action === "close") {
          Sound.close();
          win.classList.add("is-closed");
          updateTaskbar();
        } else if (action === "minimize") {
          Sound.close();
          win.classList.add("is-minimized");
          updateTaskbar();
        } else if (action === "maximize") {
          Sound.click();
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
      Sound.click();
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

  // Toolbar and menu chrome are decorative, but they should still click.
  document.querySelectorAll(".tbar-btn, .menu-bar span").forEach((el) => {
    el.addEventListener("click", () => Sound.click());
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

  // Closed windows leave the taskbar entirely; minimized ones stay so they
  // can be restored.
  const windows = [...document.querySelectorAll(".desktop .window:not(.dialog-window)")]
    .filter((w) => !w.classList.contains("is-closed"));

  const topZ = Math.max(...windows.filter((w) => !w.classList.contains("is-minimized"))
    .map((w) => parseInt(w.style.zIndex || 0, 10)), 0);

  container.innerHTML = "";

  windows.forEach((win) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "taskbar-item";

    const minimized = win.classList.contains("is-minimized");
    if (!minimized && parseInt(win.style.zIndex || 0, 10) === topZ) {
      item.classList.add("active");
    }

    item.textContent = win.querySelector(".title-bar-text").textContent;
    item.addEventListener("click", () => {
      Sound.click();
      if (minimized || parseInt(win.style.zIndex || 0, 10) !== topZ) {
        focusWindow(win.id);
      } else {
        win.classList.add("is-minimized");
        updateTaskbar();
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
  Sound.click();
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
    Sound.click();
    startMenu.classList.toggle("open");
  });

  document.addEventListener("click", (e) => {
    if (!startMenu.contains(e.target) && e.target !== startBtn) closeStartMenu();
  });

  document.querySelectorAll("[data-scheme-cycle]").forEach((el) => {
    el.addEventListener("click", () => { cycleScheme(); closeStartMenu(); });
  });

  document.getElementById("tray-scheme").addEventListener("click", cycleScheme);

  const muteBtn = document.getElementById("tray-mute");
  function paintMute() {
    muteBtn.textContent = Sound.isMuted() ? "🔇" : "🔊";
    muteBtn.title = Sound.isMuted() ? "Sound off — click to enable" : "Sound on — click to mute";
  }
  muteBtn.addEventListener("click", () => { Sound.toggleMute(); paintMute(); });
  paintMute();

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
