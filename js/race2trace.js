(() => {
  const TRACK_HALF = 18;
  const MAX_SPEED = 380;
  const AI_SPEED = 300;
  const WIN = 0.98;

  const DIGITS = {
    "0": [[50,12],[78,22],[84,50],[78,78],[50,88],[22,78],[16,50],[22,22],[50,12]],
    "1": [[38,22],[50,12],[50,88]],
    "2": [[18,28],[28,14],[62,12],[80,24],[76,42],[48,58],[22,74],[20,88],[82,88]],
    "3": [[20,20],[58,12],[80,24],[74,42],[46,48],[76,58],[80,76],[56,88],[20,80]],
    "4": [[[66,12],[22,58],[84,58]],[[66,12],[66,88]]],
    "5": [[78,12],[24,12],[22,44],[60,40],[82,54],[78,78],[48,88],[18,78]],
    "6": [[62,16],[28,28],[18,54],[24,80],[50,88],[78,76],[80,56],[48,48],[24,56]],
    "7": [[16,16],[84,16],[40,88]],
    "8": [[[50,12],[76,20],[80,34],[64,46],[36,46],[20,34],[24,20],[50,12]],
         [[50,50],[78,58],[80,74],[64,86],[36,86],[20,74],[22,58],[50,50]]],
    "9": [[50,12],[78,22],[82,40],[58,50],[22,40],[28,18],[50,12],[78,22],[62,88]]
  };

  const youStage = document.getElementById("youStage");
  const carStage = document.getElementById("carStage");
  const startBtn = document.getElementById("startBtn");
  const nEl = document.getElementById("n");
  const statusEl = document.getElementById("status");

  let n = Number(localStorage.getItem("race2trace-next") || 1);
  let carSrc = null;
  let racing = false;
  let startTime = 0;
  let youDone = false;
  let aiDone = false;
  let youTime = 0;
  let aiTime = 0;
  let youS = 0;
  let aiS = 0;
  let pathLen = 1;
  let samples = [];
  let youCar = { x: 0, y: 0, a: 0 };
  let pointer = { down: false, x: 0, y: 0 };
  let lastTs = 0;
  let youImg = new Image();
  let aiImg = new Image();

  const you = makeStage(youStage);
  const ai = makeStage(carStage);
  nEl.textContent = n;
  if (startBtn) startBtn.disabled = true;

  document.querySelectorAll(".garage [data-car]").forEach((btn) => {
    btn.addEventListener("click", () => {
      carSrc = btn.dataset.car;
      youImg.src = carSrc;
      aiImg.src = carSrc;
      document.querySelectorAll(".garage [data-car]").forEach((b) => b.classList.remove("picked"));
      btn.classList.add("picked");
      if (startBtn) startBtn.disabled = false;
      statusEl.textContent = "Ready";
    });
  });

  startBtn?.addEventListener("click", () => {
  if (carSrc) startRace();
    });

  window.addEventListener("resize", () => { if (!racing) layoutBoth(); });

  you.canvas.addEventListener("pointerdown", (e) => {
  pointer.down = true;
  you.canvas.setPointerCapture(e.pointerId);
  setPointer(e);
  if (carSrc && !racing && !youDone) startRace();
});

you.canvas.addEventListener("pointermove", (e) => {
  setPointer(e);
  if (carSrc && pointer.down && !racing && !youDone) startRace();
});

you.canvas.addEventListener("pointerup", () => {
  pointer.down = false;
});

you.canvas.addEventListener("pointercancel", () => {
  pointer.down = false;
});

  layoutBoth();

  function makeStage(el) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const outline = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const progress = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const canvas = document.createElement("canvas");
    outline.setAttribute("fill", "none");
    outline.setAttribute("stroke", "#3a3a3a");
    outline.setAttribute("stroke-width", String(TRACK_HALF * 2));
    outline.setAttribute("stroke-linecap", "round");
    outline.setAttribute("stroke-linejoin", "round");
    progress.setAttribute("fill", "none");
    progress.setAttribute("stroke", "#2ecc40");
    progress.setAttribute("stroke-width", String(TRACK_HALF * 2 - 6));
    progress.setAttribute("stroke-linecap", "round");
    progress.setAttribute("stroke-linejoin", "round");
    svg.append(outline, progress);
    el.append(svg, canvas);
    el.style.position = "relative";
    canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;touch-action:none;cursor:crosshair";
    svg.style.cssText = "position:absolute;inset:0;width:100%;height:100%";
    return { el, svg, outline, progress, canvas, ctx: canvas.getContext("2d") };
  }

  function layoutBoth() {
    sizeStage(you);
    sizeStage(ai);
    const d = pathD(n, you.canvas.width, you.canvas.height);
    you.outline.setAttribute("d", d);
    you.progress.setAttribute("d", d);
    ai.outline.setAttribute("d", d);
    ai.progress.setAttribute("d", d);
    samples = samplePath(you.outline);
    pathLen = you.outline.getTotalLength() || 1;
    resetDashes();
    const p = you.outline.getPointAtLength(0);
    youCar = { x: p.x, y: p.y, a: 0 };
    drawCars();
    you.progress.style.display = "none";
    ai.progress.style.display = "none";
  }

  function sizeStage(stage) {
    const r = stage.el.getBoundingClientRect();
    const w = Math.max(200, r.width);
    const h = Math.max(240, r.height);
    stage.svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    stage.canvas.width = w;
    stage.canvas.height = h;
  }

function strokesOf(d) {
  const raw = DIGITS[d] || DIGITS["1"];
  return Array.isArray(raw[0][0]) ? raw : [raw];
}

function pathD(num, w, h) {
  const digits = String(num).split("");
  const cellW = w / digits.length;
  const cmds = [];
  digits.forEach((d, i) => {
    strokesOf(d).forEach((stroke) => {
      stroke.forEach((pt, j) => {
        const x = i * cellW + cellW * 0.18 + (pt[0] / 100) * cellW * 0.64;
        const y = h * 0.14 + (pt[1] / 100) * h * 0.72;
        cmds.push(`${j ? "L" : "M"} ${x.toFixed(1)} ${y.toFixed(1)}`);
      });
    });
  });
  return cmds.join(" ");
}

function samplePath(path) {
  const raw = path.getPathData ? null : null;
  const len = path.getTotalLength();
  const out = [];
  const step = Math.max(3, len / 300);
  let prev = null;
  for (let s = 0; s <= len; s += step) {
    const p = path.getPointAtLength(s);
    const jump = prev && Math.hypot(p.x - prev.x, p.y - prev.y) > TRACK_HALF * 2;
    out.push({ s, x: p.x, y: p.y, gap: !!jump });
    prev = p;
  }
  return out;
}

  function resetDashes() {
    [you, ai].forEach((st) => {
      st.progress.style.strokeDasharray = String(pathLen);
      st.progress.style.strokeDashoffset = String(pathLen);
    });
  }

    function startRace() {
        if (!carSrc || racing) return;
        layoutBoth();
        racing = true;
        youDone = aiDone = false;
        youS = aiS = 0;
        startTime = performance.now();
        lastTs = startTime;
        statusEl.textContent = "Go!";
        requestAnimationFrame(tick);
    }

  function setPointer(e) {
    const r = you.canvas.getBoundingClientRect();
    const sx = you.canvas.width / r.width;
    const sy = you.canvas.height / r.height;
    pointer.x = (e.clientX - r.left) * sx;
    pointer.y = (e.clientY - r.top) * sy;
  }

  function tick(now) {
    if (!racing) return;
    const dt = Math.min(0.05, (now - lastTs) / 1000);
    lastTs = now;

    if (!youDone && pointer.down) stepStudent(dt);
    if (!aiDone) stepAI(dt);

    you.ctx.clearRect(0, 0, you.canvas.width, you.canvas.height);
    ai.ctx.clearRect(0, 0, ai.canvas.width, ai.canvas.height);
    paintDriven(you.ctx, youS);
    paintDriven(ai.ctx, aiS);
    drawCars();

    if (!youDone) {
        you.ctx.save();
        you.ctx.fillStyle = "#fff";
        you.ctx.beginPath();
        you.ctx.arc(pointer.x || youCar.x, pointer.y || youCar.y, 4, 0, Math.PI * 2);
        you.ctx.fill();
        you.ctx.restore();
    }

    if (youS / pathLen >= WIN && !youDone) finish("you", now);
    if (aiS / pathLen >= WIN && !aiDone) finish("ai", now);
    if (youDone && aiDone) return showResult();
    requestAnimationFrame(tick);
  }

  function stepStudent(dt) {
    const near = nearest(pointer.x, pointer.y);
    const factor = laneFactor(near.dist);
    const speed = MAX_SPEED * factor;
    const want = Math.hypot(pointer.x - youCar.x, pointer.y - youCar.y);
    const step = Math.min(want, speed * dt);
    if (near.s >= youS - 12) youS = Math.min(pathLen, youS + step);
    const p = you.outline.getPointAtLength(youS);
    const q = you.outline.getPointAtLength(Math.min(pathLen, youS + 6));
    youCar.x = p.x;
    youCar.y = p.y;
    youCar.a = Math.atan2(q.y - p.y, q.x - p.x);
  }

  function stepAI(dt) {
  if (youDone) {
    aiS = Math.min(pathLen, aiS + AI_SPEED * dt);
    return;
  }
  const lead = 40;
  if (aiS > youS + lead) return;
  const room = (youS + lead) - aiS;
  const step = Math.min(AI_SPEED * dt, room);
  aiS = Math.min(pathLen, aiS + step);
}

  function nearest(x, y) {
    let best = samples[0], dBest = 1e9;
    for (const p of samples) {
      const d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < dBest) { dBest = d; best = p; }
    }
    return { s: best.s, dist: Math.sqrt(dBest) };
  }

  function laneFactor(dist) {
    const groove = TRACK_HALF * 0.6;
    if (dist <= groove) return 1;
    if (dist >= TRACK_HALF) return 0.15;
    const t = (dist - groove) / (TRACK_HALF - groove);
    return 1 - t * 0.85;
  }

  function paintDriven(ctx, sNow) {
  ctx.lineWidth = TRACK_HALF * 2 - 6;
  ctx.strokeStyle = "#2ecc40";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  let drawing = false;
  for (const p of samples) {
    if (p.s > sNow) break;
    if (p.gap) { drawing = false; continue; }
    if (!drawing) { ctx.moveTo(p.x, p.y); drawing = true; }
    else ctx.lineTo(p.x, p.y);
  }
  ctx.stroke();
}

  function drawCars() {
    you.ctx.clearRect(0, 0, you.canvas.width, you.canvas.height);
    ai.ctx.clearRect(0, 0, ai.canvas.width, ai.canvas.height);
    blit(you.ctx, youImg, youCar.x, youCar.y, youCar.a);
    const p = ai.outline.getPointAtLength(aiS);
    const q = ai.outline.getPointAtLength(Math.min(pathLen, aiS + 6));
    blit(ai.ctx, aiImg, p.x, p.y, Math.atan2(q.y - p.y, q.x - p.x));
  }

  function blit(ctx, img, x, y, a) {
    if (!img.complete || !img.naturalWidth) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a);
      ctx.fillStyle = "#2ecc40";
      ctx.fillRect(-16, -8, 32, 16);
      ctx.restore();
      return;
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.drawImage(img, -18, -10, 36, 20);
    ctx.restore();
  }

  function finish(who, now) {
    const t = now - startTime;
    if (who === "you") { youDone = true; youTime = t; youS = pathLen; }
    else { aiDone = true; aiTime = t; aiS = pathLen; }
    if (!youDone || !aiDone) {
      statusEl.textContent = who === "you" ? "You finished!" : "Car finished!";
    }
  }

  function showResult() {
    racing = false;
    const youWin = youTime <= aiTime;
    statusEl.textContent = youWin ? "You win!" : "Car wins!";
    let box = document.getElementById("result");
    if (!box) {
      box = document.createElement("div");
      box.id = "result";
      box.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.65);display:grid;place-items:center";
      box.innerHTML = `<div style="background:#222;color:#fff;padding:20px 24px;border-radius:12px;text-align:center;min-width:260px">
        <h3 id="winner"></h3>
        <p id="times"></p>
        <button class="glossy-btn" id="nextBtn">Next number</button>
      </div>`;
      document.body.appendChild(box);
      box.querySelector("#nextBtn").onclick = nextNumber;
    }
    box.style.display = "grid";
    box.querySelector("#winner").textContent = youWin ? "You win!" : "Car wins!";
    box.querySelector("#times").textContent =
      `You ${(youTime / 1000).toFixed(2)}s  ·  Car ${(aiTime / 1000).toFixed(2)}s`;
  }

  function nextNumber() {
    const box = document.getElementById("result");
    if (box) box.style.display = "none";
    n = n >= 100 ? 1 : n + 1;
    localStorage.setItem("race2trace-next", String(n));
    nEl.textContent = n;
    statusEl.textContent = "Ready";
    layoutBoth();
  }
})();