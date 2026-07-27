// ============================================================
// KC Games — built-in desktop apps (Minesweeper, Paint)
// Original implementations of two classic app types.
// ============================================================

/* ---------------- Minesweeper ---------------- */

const Minesweeper = (() => {
  const ROWS = 9;
  const COLS = 9;
  const MINES = 10;

  // Classic per-number colouring for the adjacency counts.
  const NUM_COLORS = ["", "#0000ff", "#008000", "#ff0000", "#000080",
                      "#800000", "#008080", "#000000", "#808080"];

  let cells = [];
  let started = false;
  let over = false;
  let seconds = 0;
  let timerId = null;

  function idx(r, c) { return r * COLS + c; }
  function inBounds(r, c) { return r >= 0 && r < ROWS && c >= 0 && c < COLS; }

  function neighbours(r, c) {
    const out = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        if (inBounds(r + dr, c + dc)) out.push([r + dr, c + dc]);
      }
    }
    return out;
  }

  function reset() {
    cells = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        cells.push({ r, c, mine: false, adj: 0, revealed: false, flagged: false });
      }
    }
    started = false;
    over = false;
    seconds = 0;
    stopTimer();
    if (window.Sound) Sound.swipe();
    setFace("🙂");
    setStatus("Left-click to clear · right-click to flag");
    paint();
  }

  // Mines are placed after the first click so the opening move is always safe.
  function layMines(safeR, safeC) {
    const forbidden = new Set([idx(safeR, safeC)]);
    neighbours(safeR, safeC).forEach(([r, c]) => forbidden.add(idx(r, c)));

    let placed = 0;
    while (placed < MINES) {
      const i = Math.floor(Math.random() * cells.length);
      if (cells[i].mine || forbidden.has(i)) continue;
      cells[i].mine = true;
      placed++;
    }

    cells.forEach((cell) => {
      cell.adj = neighbours(cell.r, cell.c)
        .filter(([r, c]) => cells[idx(r, c)].mine).length;
    });
  }

  function startTimer() {
    stopTimer();
    timerId = setInterval(() => {
      seconds = Math.min(999, seconds + 1);
      paintLcds();
    }, 1000);
  }

  function stopTimer() {
    if (timerId) clearInterval(timerId);
    timerId = null;
  }

  // Iterative flood fill outward from any revealed blank cell.
  // Returns how many cells opened, so the sound can match the size of the run.
  function reveal(cell) {
    if (cell.revealed || cell.flagged) return 0;

    let opened = 0;
    const stack = [cell];
    while (stack.length) {
      const cur = stack.pop();
      if (cur.revealed || cur.flagged) continue;
      cur.revealed = true;
      opened++;
      if (cur.adj === 0 && !cur.mine) {
        neighbours(cur.r, cur.c).forEach(([r, c]) => {
          const n = cells[idx(r, c)];
          if (!n.revealed && !n.flagged) stack.push(n);
        });
      }
    }
    return opened;
  }

  // One pop for a single cell; a short rising cascade when a blank region
  // unfurls, so a big opening actually sounds big.
  function revealSound(opened, adj) {
    if (!window.Sound) return;
    if (opened <= 1) {
      Sound.pop(adj);
      return;
    }
    const notes = Math.min(6, Math.ceil(opened / 3));
    for (let i = 0; i < notes; i++) {
      setTimeout(() => Sound.pop(i + 1), i * 45);
    }
  }

  function checkWin() {
    const safeLeft = cells.filter((c) => !c.mine && !c.revealed).length;
    if (safeLeft > 0) return;

    over = true;
    stopTimer();
    setFace("😎");
    setStatus("Cleared! " + seconds + "s");
    cells.forEach((c) => { if (c.mine) c.flagged = true; });
    if (window.Sound) Sound.arp([523, 659, 784, 1047], { gap: 95, dur: 0.16, vol: 0.055 });
  }

  function loseAt(cell) {
    over = true;
    stopTimer();
    cell.exploded = true;
    cells.forEach((c) => { if (c.mine) c.revealed = true; });
    setFace("😵");
    setStatus("Boom. Click the face to try again.");
    if (window.Sound) Sound.boom();
  }

  function onLeft(cell) {
    if (over || cell.flagged || cell.revealed) return;

    if (!started) {
      layMines(cell.r, cell.c);
      started = true;
      startTimer();
    }

    if (cell.mine) {
      loseAt(cell);
    } else {
      revealSound(reveal(cell), cell.adj);
      checkWin();
    }
    paint();
  }

  function onRight(cell) {
    if (over || cell.revealed) return;
    cell.flagged = !cell.flagged;
    if (window.Sound) {
      // Planting a flag pins upward; pulling one out drops back down.
      cell.flagged
        ? Sound.blip({ freq: 700, to: 1150, dur: 0.06, vol: 0.05, type: "square" })
        : Sound.blip({ freq: 900, to: 480, dur: 0.06, vol: 0.04, type: "square" });
    }
    paint();
  }

  function setFace(f) {
    const el = document.getElementById("ms-face");
    if (el) el.textContent = f;
  }

  function setStatus(t) {
    const el = document.getElementById("ms-status");
    if (el) el.textContent = t;
  }

  function pad(n) { return String(Math.max(0, n)).padStart(3, "0"); }

  function paintLcds() {
    const flags = cells.filter((c) => c.flagged).length;
    document.getElementById("ms-mines").textContent = pad(MINES - flags);
    document.getElementById("ms-time").textContent = pad(seconds);
  }

  function paint() {
    const grid = document.getElementById("ms-grid");
    if (!grid) return;

    grid.innerHTML = "";
    cells.forEach((cell) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "ms-cell";

      if (cell.revealed) {
        b.classList.add("open");
        if (cell.mine) {
          b.classList.add("mine");
          if (cell.exploded) b.classList.add("boom");
          b.textContent = "💣";
        } else if (cell.adj > 0) {
          b.textContent = cell.adj;
          b.style.color = NUM_COLORS[cell.adj];
        }
      } else if (cell.flagged) {
        b.textContent = "🚩";
      }

      b.addEventListener("click", () => onLeft(cell));
      b.addEventListener("contextmenu", (e) => { e.preventDefault(); onRight(cell); });
      grid.appendChild(b);
    });

    paintLcds();
  }

  function init() {
    const face = document.getElementById("ms-face");
    if (!face) return;
    face.addEventListener("click", reset);
    const menu = document.getElementById("ms-new");
    if (menu) menu.addEventListener("click", reset);
    reset();
  }

  return { init, reset };
})();

/* ---------------- Paint ---------------- */

const Paint = (() => {
  const TOOLS = [
    { id: "pencil", label: "✏️", name: "Pencil" },
    { id: "eraser", label: "🩹", name: "Eraser" },
    { id: "line", label: "╲", name: "Line" },
    { id: "rect", label: "▭", name: "Rectangle" },
    { id: "ellipse", label: "◯", name: "Ellipse" },
    { id: "fill", label: "🪣", name: "Fill" }
  ];

  const PALETTE = [
    "#000000", "#7f7f7f", "#880015", "#ed1c24", "#ff7f27", "#fff200", "#22b14c",
    "#00a2e8", "#3f48cc", "#a349a4", "#b97a57", "#ffaec9", "#c8bfe7", "#ffffff",
    "#404040", "#c3c3c3", "#b5e61d", "#99d9ea", "#7092be", "#efe4b0", "#ffc90e",
    "#c0c0c0", "#e0e0e0", "#00ffff", "#ff00ff", "#800080", "#008080", "#004000"
  ];

  let canvas, ctx;
  let tool = "pencil";
  let color = "#000000";
  let size = 2;
  let drawing = false;
  let startPt = null;
  let snapshot = null;
  let lastScratch = 0;

  // Freehand strokes get a throttled rasp so dragging sounds like the nib
  // dragging on paper, without spawning a node per mousemove event.
  function scratch() {
    if (!window.Sound) return;
    const now = performance.now();
    if (now - lastScratch < 55) return;
    lastScratch = now;
    Sound.rasp({
      dur: 0.05,
      vol: 0.022,
      from: 2600 + Math.random() * 900,
      to: 1500
    });
  }

  function pos(e) {
    const r = canvas.getBoundingClientRect();
    return {
      x: Math.round((e.clientX - r.left) * (canvas.width / r.width)),
      y: Math.round((e.clientY - r.top) * (canvas.height / r.height))
    };
  }

  function strokeStyle() {
    ctx.strokeStyle = tool === "eraser" ? "#ffffff" : color;
    ctx.fillStyle = tool === "eraser" ? "#ffffff" : color;
    ctx.lineWidth = size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }

  function down(e) {
    startPt = pos(e);
    drawing = true;
    strokeStyle();

    if (tool === "fill") {
      floodFill(startPt.x, startPt.y, color);
      drawing = false;
      // A downward glug as the paint floods out.
      if (window.Sound) {
        Sound.rasp({ dur: 0.3, vol: 0.07, from: 1100, to: 180 });
        Sound.blip({ freq: 420, to: 170, dur: 0.28, vol: 0.05, type: "sine" });
      }
      return;
    }

    if (tool === "pencil" || tool === "eraser") {
      ctx.beginPath();
      ctx.moveTo(startPt.x, startPt.y);
      ctx.lineTo(startPt.x, startPt.y);
      ctx.stroke();
    } else {
      // Shape tools need the untouched canvas to redraw the preview against.
      snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }
  }

  function move(e) {
    if (!drawing) return;
    const p = pos(e);
    strokeStyle();

    if (tool === "pencil" || tool === "eraser") {
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
      scratch();
      return;
    }

    if (snapshot) ctx.putImageData(snapshot, 0, 0);
    drawShape(startPt, p);
  }

  function up(e) {
    if (!drawing) return;
    drawing = false;
    if (tool === "pencil" || tool === "eraser") {
      ctx.closePath();
      return;
    }

    if (snapshot) {
      ctx.putImageData(snapshot, 0, 0);
      drawShape(startPt, pos(e));
      snapshot = null;
    }
    // Shapes land with a snap; bigger brushes read lower.
    if (window.Sound) Sound.pop(Math.max(0, 8 - size));
  }

  function drawShape(a, b) {
    ctx.beginPath();
    if (tool === "line") {
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    } else if (tool === "rect") {
      ctx.rect(a.x, a.y, b.x - a.x, b.y - a.y);
    } else if (tool === "ellipse") {
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      ctx.ellipse(cx, cy, Math.abs(b.x - a.x) / 2, Math.abs(b.y - a.y) / 2, 0, 0, Math.PI * 2);
    }
    ctx.stroke();
  }

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255];
  }

  // Scanline-free queue flood fill; good enough for a canvas this size.
  function floodFill(sx, sy, hex) {
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = img.data;
    const target = (sy * canvas.width + sx) * 4;
    const from = [data[target], data[target + 1], data[target + 2], data[target + 3]];
    const to = hexToRgb(hex);

    if (from.every((v, i) => v === to[i])) return;

    const stack = [[sx, sy]];
    while (stack.length) {
      const [x, y] = stack.pop();
      if (x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) continue;
      const i = (y * canvas.width + x) * 4;
      if (data[i] !== from[0] || data[i + 1] !== from[1] ||
          data[i + 2] !== from[2] || data[i + 3] !== from[3]) continue;

      data[i] = to[0]; data[i + 1] = to[1]; data[i + 2] = to[2]; data[i + 3] = to[3];
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    ctx.putImageData(img, 0, 0);
  }

  function clear() {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (window.Sound) Sound.swipe();
  }

  function setStatus(t) {
    const el = document.getElementById("pt-status");
    if (el) el.textContent = t;
  }

  function buildTools() {
    const wrap = document.getElementById("paint-tools");
    TOOLS.forEach((t) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "paint-tool" + (t.id === tool ? " active" : "");
      b.textContent = t.label;
      b.title = t.name;
      b.addEventListener("click", () => {
        tool = t.id;
        wrap.querySelectorAll(".paint-tool").forEach((x) => x.classList.remove("active"));
        b.classList.add("active");
        setStatus(t.name);
        if (window.Sound) Sound.click();
      });
      wrap.appendChild(b);
    });
  }

  function buildPalette() {
    const wrap = document.getElementById("paint-palette");
    const current = document.getElementById("pt-current");
    current.style.background = color;

    PALETTE.forEach((hex, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "paint-swatch";
      b.style.background = hex;
      b.title = hex;
      b.addEventListener("click", () => {
        color = hex;
        current.style.background = hex;
        // Each swatch has its own pitch, so the palette plays like a keyboard.
        if (window.Sound) {
          Sound.blip({ freq: 440 + i * 22, dur: 0.05, vol: 0.04, type: "triangle" });
        }
      });
      wrap.appendChild(b);
    });
  }

  function init() {
    canvas = document.getElementById("paint-canvas");
    if (!canvas) return;
    ctx = canvas.getContext("2d", { willReadFrequently: true });

    clear();
    buildTools();
    buildPalette();

    canvas.addEventListener("mousedown", down);
    canvas.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());

    document.getElementById("pt-size").addEventListener("input", (e) => {
      size = Number(e.target.value);
      setStatus("Size " + size);
    });

    document.getElementById("pt-clear").addEventListener("click", clear);

    document.getElementById("pt-save").addEventListener("click", () => {
      const a = document.createElement("a");
      a.download = "painting.png";
      a.href = canvas.toDataURL("image/png");
      a.click();
      if (window.Sound) Sound.arp([784, 1047], { gap: 90, dur: 0.14, vol: 0.05 });
    });
  }

  return { init, clear };
})();

/* ---------------- Boot ---------------- */

document.addEventListener("DOMContentLoaded", () => {
  Minesweeper.init();
  Paint.init();
});
