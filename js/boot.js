// ============================================================
// KC Games — power-on boot sequence
// ============================================================
// Audio is the reason this starts on a click rather than on load:
// browsers keep an AudioContext suspended until the user interacts, so a
// self-starting intro would run silently. The power button doubles as the
// gesture that unlocks sound.

const Boot = (() => {
  const POST_LINES = [
    "KC Games BIOS  v2.8",
    "",
    "Detecting drives .......... OK",
    "Memory test ............... OK",
    "Loading desktop ........... OK"
  ];

  let running = false;
  let finished = false;
  const timers = [];

  function at(ms, fn) { timers.push(setTimeout(fn, ms)); }

  function sfx() { return window.Sound; }

  // A warm rising major arpeggio over a soft bass note — written for this
  // site rather than borrowed from anywhere.
  function chime() {
    const s = sfx();
    if (!s) return;
    s.blip({ freq: 196, dur: 1.5, vol: 0.05, type: "sine" });
    s.arp([392, 523, 659, 784], { gap: 155, dur: 0.9, vol: 0.05, type: "triangle" });
    at(560, () => s.blip({ freq: 1047, dur: 1.1, vol: 0.035, type: "triangle" }));
  }

  function powerThunk() {
    const s = sfx();
    if (!s) return;
    // Relay clunk, then the tube whining up to speed.
    s.blip({ freq: 90, to: 42, dur: 0.16, vol: 0.11, type: "square" });
    s.rasp({ dur: 0.3, vol: 0.06, from: 300, to: 90 });
    at(120, () => s.blip({ freq: 240, to: 1250, dur: 0.55, vol: 0.028, type: "sine" }));
  }

  function typePost() {
    const el = document.getElementById("boot-post");
    el.classList.add("show");

    POST_LINES.forEach((line, i) => {
      at(i * 230, () => {
        el.textContent += line + "\n";
        const s = sfx();
        if (s && line) s.blip({ freq: 1500 + i * 90, dur: 0.028, vol: 0.03, type: "square" });
      });
    });
  }

  function showSplash() {
    document.getElementById("boot-post").classList.remove("show");
    document.getElementById("boot-splash").classList.add("show");

    // Soft pulse under the marching blocks.
    [0, 420, 840, 1260].forEach((d) => {
      at(d, () => {
        const s = sfx();
        if (s) s.blip({ freq: 320, to: 430, dur: 0.09, vol: 0.022, type: "sine" });
      });
    });
  }

  function finish() {
    if (finished) return;
    finished = true;
    timers.forEach(clearTimeout);

    const boot = document.getElementById("boot");
    boot.classList.add("is-done");
    setTimeout(() => boot.remove(), 700);
  }

  function start() {
    if (running) return;
    running = true;

    document.getElementById("boot-power").classList.add("gone");
    document.getElementById("boot-skip").classList.add("show");
    powerThunk();

    at(340, typePost);
    at(1560, showSplash);
    at(2900, chime);
    at(4200, finish);
  }

  function init() {
    const boot = document.getElementById("boot");
    if (!boot) return;

    // stopPropagation matters: the power button lives inside #boot, so
    // without it this click would bubble into the skip handler below and
    // end the sequence the instant it began.
    document.getElementById("boot-power").addEventListener("click", (e) => {
      e.stopPropagation();
      start();
    });

    // Once booting, any click cuts straight to the desktop.
    boot.addEventListener("click", () => { if (running) finish(); });

    document.addEventListener("keydown", (e) => {
      if (!running) { start(); return; }
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") finish();
    });
  }

  return { init };
})();

document.addEventListener("DOMContentLoaded", Boot.init);
