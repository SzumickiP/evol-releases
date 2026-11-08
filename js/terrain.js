// Teren: szczegółowy, statyczny obraz dna i kominów – rysowany raz do bufora.
const TERRAIN_SCALE = 1.5;   // rozdzielczość bufora (px na jednostkę świata)

function fbm(x, y, oct = 4) {
  let a = 0.5, f = 1, s = 0;
  for (let i = 0; i < oct; i++) { s += a * Noise.perlin(x * f, y * f); f *= 2.03; a *= 0.5; }
  return s;
}
const mix = (a, b, t) => a + (b - a) * t;
const mix3 = (c1, c2, t) => [mix(c1[0], c2[0], t), mix(c1[1], c2[1], t), mix(c1[2], c2[2], t)];
const rgb = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

// ---------- Kształt kominów ----------

// Kolumna komina: linia środkowa z lekkim przechyłem i nieregularnymi brzegami
function makeColumn(bx, by, h, w0, w1, lean, type) {
  const steps = Math.max(6, Math.ceil(h / 7));
  const seed = Math.random() * 100;
  const c = [], rl = [], rr = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const cx = bx + lean * h * t + Noise.perlin(seed, t * 2.5) * w0 * 0.5;
    const cy = by - h * t;
    const rad = Math.max(1.5, mix(w0, w1, Math.pow(t, 0.7)) * (1 + 0.22 * Noise.perlin(seed + 7, t * 7)));
    c.push([cx, cy]);
    rl.push(rad * (1 + 0.12 * Noise.perlin(seed + 20, t * 13)));
    rr.push(rad * (1 + 0.12 * Noise.perlin(seed + 40, t * 13)));
  }
  // Półki (flanges) – typowe dla kominów, pod którymi gromadzi się gorący płyn
  const flanges = [];
  const nf = type === 'alkaline' ? Math.floor(rand(1, 3.5)) : Math.floor(rand(0, 1.6));
  for (let k = 0; k < nf; k++) {
    flanges.push({ idx: Math.round(rand(0.15, 0.85) * steps), ext: rand(1.2, 1.65), seed: Math.random() * 100, tilt: rand(-0.08, 0.08) });
  }
  return { c, rl, rr, flanges, type };
}

function planChimney(v) {
  const black = v.type === 'black';
  const main = makeColumn(v.x, v.y + 12, v.h + 12, v.w, v.w * (black ? 0.38 : 0.28), rand(-0.1, 0.1), v.type);
  const cols = [];
  const nSp = black ? 1 + Math.floor(Math.random() * 2) : 2 + Math.floor(Math.random() * 2);
  let side = Math.random() < 0.5 ? -1 : 1;
  for (let i = 0; i < nSp; i++) {
    const idx = Math.floor(rand(0.2, 0.65) * (main.c.length - 1));
    const [cx, cy] = main.c[idx];
    const r = (main.rl[idx] + main.rr[idx]) / 2;
    const h = rand(35, 80) * (black ? 1 : 1.35);
    cols.push(makeColumn(cx + side * r * 0.45, cy + 8, h, r * 0.55, r * 0.22, side * rand(0.25, 0.6), v.type));
    side = -side;
  }
  cols.push(main);  // główna kolumna na wierzchu
  v.cols = cols;
  v.mouths = cols.map(col => {
    const n = col.c.length - 1;
    return { x: col.c[n][0], y: col.c[n][1], r: (col.rl[n] + col.rr[n]) / 2, main: col === main, acc: Math.random(), bub: Math.random() };
  });
  const m = v.mouths[v.mouths.length - 1];
  v.mx = m.x;
  v.top = m.y;
}

const CHIMNEY_PAL = {
  black:    { base: [34, 30, 28], lit: [92, 84, 76], dark: [8, 7, 6], band: 'rgba(0,0,0,0.35)', line: 'rgba(0,0,0,0.65)',
              stains: [[138, 74, 34], [176, 138, 58], [201, 180, 74], [205, 198, 184], [96, 42, 20], [150, 120, 70]] },
  alkaline: { base: [108, 112, 108], lit: [158, 162, 152], dark: [46, 50, 52], band: 'rgba(40,40,36,0.3)', line: 'rgba(30,32,30,0.6)',
              stains: [[196, 194, 178], [120, 132, 112], [150, 142, 120], [88, 86, 80], [168, 172, 156]] },
};

function drawColumn(g, col) {
  const { c, rl, rr, type } = col;
  const pal = CHIMNEY_PAL[type];
  const n = c.length - 1;
  const path = new Path2D();
  path.moveTo(c[0][0] - rl[0], c[0][1]);
  for (let i = 1; i <= n; i++) path.lineTo(c[i][0] - rl[i], c[i][1]);
  for (let i = n; i >= 0; i--) path.lineTo(c[i][0] + rr[i], c[i][1]);
  path.closePath();

  g.fillStyle = rgb(pal.base);
  g.fill(path);
  g.save();
  g.clip(path);

  // Cieniowanie walca – każdy plaster osobno, bo kolumna jest pochylona
  for (let i = 0; i < n; i++) {
    const [cx, cy] = c[i];
    const [nx, ny] = c[i + 1];
    const l = Math.max(rl[i], rl[i + 1]) + 2, r = Math.max(rr[i], rr[i + 1]) + 2;
    const mx = (cx + nx) / 2;
    const gr = g.createLinearGradient(mx - l, 0, mx + r, 0);
    gr.addColorStop(0, rgb(pal.base));
    gr.addColorStop(0.28, rgb(pal.lit));
    gr.addColorStop(0.62, rgb(pal.base));
    gr.addColorStop(1, rgb(pal.dark));
    g.fillStyle = gr;
    g.fillRect(mx - l, ny - 0.6, l + r, cy - ny + 1.2);
  }

  // Pierścienie przyrostu
  g.strokeStyle = pal.band;
  for (let i = 1; i < n; i++) {
    if (Math.random() < 0.45) continue;
    const [cx, cy] = c[i];
    g.lineWidth = rand(0.6, 1.6);
    g.beginPath();
    g.ellipse(cx, cy, (rl[i] + rr[i]) / 2 + 1, rand(1, 2.6), 0, 0, Math.PI);
    g.stroke();
  }

  // Wieże alkaliczne: pionowe żłobienia
  if (type === 'alkaline') {
    for (let f = -0.9; f <= 0.9; f += rand(0.12, 0.25)) {
      g.strokeStyle = Math.random() < 0.5 ? 'rgba(255,255,245,0.18)' : 'rgba(60,58,52,0.18)';
      g.lineWidth = rand(0.6, 1.4);
      g.beginPath();
      for (let i = 0; i <= n; i++) {
        const r = f < 0 ? rl[i] : rr[i];
        const x = c[i][0] + f * r, y = c[i][1];
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
  }

  // Zacieki minerałów spływające w dół (siarczki, rdza, siarka / węglany)
  const count = Math.ceil(n * 1.3);
  g.lineCap = 'round';
  for (let k = 0; k < count; k++) {
    const i = Math.min(n, Math.floor(Math.pow(Math.random(), 0.7) * n) + 1);
    const f = rand(-0.8, 0.8);
    const s = pal.stains[Math.floor(Math.random() * pal.stains.length)];
    g.strokeStyle = rgb(s, rand(0.15, 0.38));
    g.lineWidth = rand(0.8, 2.6);
    g.beginPath();
    const len = Math.floor(rand(2, 7));
    for (let j = 0; j <= len && i - j >= 0; j++) {
      const q = i - j;
      const x = c[q][0] + f * (f < 0 ? rl[q] : rr[q]) + rand(-0.6, 0.6);
      if (j === 0) g.moveTo(x, c[q][1]); else g.lineTo(x, c[q][1]);
    }
    g.stroke();
  }
  // Porowata faktura
  for (let k = 0; k < n * 6; k++) {
    const i = Math.floor(Math.random() * (n + 1));
    g.fillStyle = Math.random() < 0.6 ? 'rgba(0,0,0,0.22)' : rgb(pal.lit, 0.15);
    g.fillRect(c[i][0] + rand(-1, 1) * rl[i], c[i][1] + rand(-4, 4), rand(0.6, 1.8), rand(0.6, 1.4));
  }
  // Świeże, mosiężne siarczki miedzi przy samym wylocie czarnego komina
  if (type === 'black') {
    for (let k = 0; k < 6; k++) {
      const i = n - Math.floor(rand(0, 3));
      g.fillStyle = rgb([196, 160, 72], rand(0.25, 0.5));
      g.beginPath();
      g.ellipse(c[i][0] + rand(-0.7, 0.7) * rl[i], c[i][1] + rand(0, 3), rand(1, 2.5), rand(0.8, 1.6), 0, 0, TAU);
      g.fill();
    }
  }
  g.restore();

  g.strokeStyle = pal.line;
  g.lineWidth = 1;
  g.stroke(path);

  // Półki
  for (const f of col.flanges) {
    const [cx, cy] = c[f.idx];
    const rad = (rl[f.idx] + rr[f.idx]) / 2 * f.ext;
    // nieregularny obrys półki
    const shelf = (dy, sq) => {
      const p = new Path2D();
      for (let a = 0; a <= 24; a++) {
        const t = a / 24 * TAU;
        const r2 = rad * (1 + 0.22 * Noise.perlin(f.seed + Math.cos(t), Math.sin(t)));
        const x = cx + Math.cos(t) * r2;
        const y = cy + dy + Math.sin(t) * r2 * sq + Math.cos(t) * r2 * f.tilt;
        if (a === 0) p.moveTo(x, y); else p.lineTo(x, y);
      }
      p.closePath();
      return p;
    };
    g.fillStyle = rgb(pal.dark, 0.95);
    g.fill(shelf(2.2, 0.22));
    const fg = g.createLinearGradient(cx - rad, 0, cx + rad, 0);
    fg.addColorStop(0, rgb(pal.base));
    fg.addColorStop(0.3, rgb(pal.lit));
    fg.addColorStop(1, rgb(pal.dark));
    g.fillStyle = fg;
    g.fill(shelf(0, 0.14));
  }

  // Wylot
  const [tx, ty] = c[n];
  const tr = (rl[n] + rr[n]) / 2;
  g.fillStyle = type === 'black' ? '#040302' : '#4a4740';
  g.beginPath(); g.ellipse(tx, ty, tr * 0.9, Math.max(1.2, tr * 0.28), 0, 0, TAU); g.fill();
  g.strokeStyle = rgb(pal.lit, 0.6);
  g.lineWidth = 0.8;
  g.stroke();
}

// Gruz u podstawy komina (odłamane fragmenty)
function drawTalus(g, world, v) {
  const pal = CHIMNEY_PAL[v.type];
  for (let k = 0; k < 16; k++) {
    const x = v.x + rand(-1, 1) * v.w * 3.2;
    const y = world.floorAt(x) + rand(-2, 5);
    const s = rand(3, 9);
    g.fillStyle = rgb(mix3(pal.base, pal.dark, rand(0, 0.6)));
    g.beginPath();
    const sides = 5 + Math.floor(Math.random() * 3);
    for (let i = 0; i < sides; i++) {
      const a = i / sides * TAU + rand(-0.3, 0.3);
      const r = s * rand(0.6, 1.1);
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r * 0.7;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.closePath();
    g.fill();
    g.strokeStyle = rgb(pal.lit, 0.25);
    g.lineWidth = 0.6;
    g.stroke();
  }
}

// ---------- Dno ----------

function ridgePath(world, top, lift, amp, seed) {
  const p = new Path2D();
  p.moveTo(-50, world.h + 10);
  for (let x = -40; x <= world.w + 40; x += 20) {
    let y = world.floorAt(x) - lift - (fbm(x * 0.0025 + seed, seed * 0.7, 3) * 0.5 + 0.5) * amp;
    if (world.shelf) y = Math.max(y, world.floorAt(x) * 0.6 + 12);   // na płyciźnie grzbiety łagodnie znikają
    p.lineTo(x, Math.max(top + 4, y));
  }
  p.lineTo(world.w + 50, world.h + 10);
  p.closePath();
  return p;
}

function drawRidges(g, world, top) {
  // Dalekie grzbiety we mgle – dają głębię (na szelfie tylko pod wodą)
  g.save();
  if (world.shelf) { g.beginPath(); g.rect(0, 4, world.w, world.h); g.clip(); }
  const far = ridgePath(world, top, 150, 170, 3.1);
  const gf = g.createLinearGradient(0, top, 0, world.h);
  gf.addColorStop(0, 'rgba(24,64,84,0.55)');
  gf.addColorStop(1, 'rgba(10,30,44,0.8)');
  g.fillStyle = gf;
  g.fill(far);

  const mid = ridgePath(world, top, 55, 110, 8.7);
  const gm = g.createLinearGradient(0, top, 0, world.h);
  gm.addColorStop(0, 'rgba(16,44,60,0.9)');
  gm.addColorStop(1, 'rgba(8,22,32,1)');
  g.fillStyle = gm;
  g.fill(mid);

  // Sylwetki odległych kominów
  g.fillStyle = 'rgba(18,48,64,0.7)';
  for (let k = 0; k < (world.shelf ? 0 : 9); k++) {
    const x0 = rand(100, world.w - 100);
    const base = world.floorAt(x0) - 70 - rand(20, 90);
    const h = rand(40, 110), w = rand(4, 8), lean = rand(-0.15, 0.15);
    const L = [], Rt = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      const x = x0 + lean * h * t, y = base + 30 - (h + 30) * t;
      const r = w * mix(1, 0.3, t) * rand(0.75, 1.25);
      L.push([x - r, y]);
      Rt.push([x + r, y]);
    }
    g.beginPath();
    L.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    Rt.reverse().forEach(([x, y]) => g.lineTo(x, y));
    g.closePath();
    g.fill();
  }
  g.restore();
}

function drawRockBody(g, world, top) {
  // Tekstura skały w niskiej rozdzielczości: bazalt, warstwy osadów, naloty przy kominach
  const R = 4;
  const H = world.h - top;
  const tw = Math.ceil(world.w / R) + 1, th = Math.ceil(H / R) + 1;
  const tex = document.createElement('canvas');
  tex.width = tw; tex.height = th;
  const tg = tex.getContext('2d');
  const img = tg.createImageData(tw, th);
  const d = img.data;

  const basalt = [44, 47, 50], sediment = [88, 86, 76], water = [16, 38, 54];
  const rust = [128, 64, 30], sulfur = [160, 132, 46], carbonate = [150, 152, 140];
  const sand = [176, 156, 112], soil = [96, 74, 52], shelfSed = [112, 104, 84];

  for (let ty = 0; ty < th; ty++) {
    for (let tx = 0; tx < tw; tx++) {
      const x = tx * R, y = top + ty * R;
      const depth = y - world.floorAt(x);
      if (depth < -14) continue;
      const n = fbm(x * 0.01, y * 0.01, 4);
      const n2 = fbm(x * 0.045 + 50, y * 0.045, 2);
      const band = Math.sin(depth * 0.09 + n * 5);
      const sed = clamp(1 - depth / 20, 0, 1) * (0.6 + 0.4 * n2 + 0.4);
      let col = mix3(basalt, sediment, clamp(sed, 0, 1));
      let shade = (1 + n * 0.6 + band * 0.12 + n2 * 0.25) * (1 - clamp(depth / 300, 0, 1) * 0.7);
      col = col.map(v => v * shade);

      for (const v of world.vents) {
        const dist = Math.hypot(x - v.x, (y - v.y) * 1.6);
        const reach = v.type === 'black' ? 240 : 280;
        const s = Math.pow(clamp(1 - dist / reach, 0, 1), 1.4) * (0.55 + 0.45 * n2);
        if (s <= 0) continue;
        const st = v.type === 'black' ? mix3(rust, sulfur, clamp(0.5 + n * 1.5, 0, 1)) : carbonate;
        col = mix3(col, st.map(c => c * (0.7 + shade * 0.3)), s * 0.75);
      }
      if (world.shelf) {
        // piasek przy brzegu, gleba w głębi lądu, jasny osad na szelfie
        const surfY = world.floorAt(x);
        const landK = smooth01((60 - surfY) / 140);   // skała lądu – brązowa, płynne przejście od brzegu
        if (landK > 0) col = mix3(col, [92, 74, 54].map(c => c * (0.75 + n * 0.5) * (1 - clamp(depth / 700, 0, 0.5))), 0.7 * landK);
        const top = surfY < -50 ? soil : surfY < 140 ? sand : shelfSed;
        col = mix3(col, top.map(c => c * (0.85 + n2 * 0.3)), clamp(1 - depth / 45, 0, 1) * 0.85);
      }
      if (!world.shelf || y > 0) col = mix3(col, water, world.shelf ? clamp(y / 1500, 0.1, 0.32) : 0.32);
      const i = (ty * tw + tx) * 4;
      d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
    }
  }
  tg.putImageData(img, 0, 0);

  g.save();
  g.clip(world.floorPath);
  g.drawImage(tex, 0, top, tw * R, th * R);

  // Szczeliny w skale
  for (let k = 0; k < 70; k++) {
    let x = rand(0, world.w), y = world.floorAt(x) + rand(0, 30);
    g.strokeStyle = `rgba(0,0,0,${rand(0.25, 0.5)})`;
    g.lineWidth = rand(0.6, 1.8);
    g.beginPath();
    g.moveTo(x, y);
    const len = Math.floor(rand(4, 14));
    for (let s = 0; s < len; s++) {
      x += rand(-8, 8); y += rand(4, 12);
      g.lineTo(x, y);
    }
    g.stroke();
  }

  // Cień pod krawędzią dna
  g.strokeStyle = 'rgba(0,0,0,0.14)';
  g.lineWidth = 6;
  g.beginPath();
  for (let i = 0; i < world.floor.length; i++) {
    const y = world.floor[i] + 7;
    if (i === 0) g.moveTo(i * world.floorStep, y); else g.lineTo(i * world.floorStep, y);
  }
  g.stroke();
  g.restore();

  // Jasna krawędź osadu na powierzchni dna
  g.strokeStyle = 'rgba(150,146,128,0.22)';
  g.lineWidth = 2;
  g.beginPath();
  for (let i = 0; i < world.floor.length; i++) {
    const y = world.floor[i];
    if (i === 0) g.moveTo(0, y); else g.lineTo(i * world.floorStep, y);
  }
  g.stroke();
}

// Lawa poduszkowa – zaokrąglone bryły typowe dla dna oceanicznego
function drawPillows(g, world) {
  const pillows = [];
  for (let k = 0; k < (world.shelf ? 6 : 34); k++) {
    const cx = rand(0, world.shelf ? 1500 : world.w);
    if (world.vents.some(v => Math.abs(v.x - cx) < v.w * 2.5)) continue;
    const cnt = 3 + Math.floor(Math.random() * 6);
    for (let i = 0; i < cnt; i++) {
      const x = cx + rand(-45, 45);
      const rx = rand(9, 24);
      pillows.push({ x, y: world.floorAt(x) + rand(-rx * 0.3, rx * 0.45), rx, ry: rx * rand(0.5, 0.75), rot: rand(-0.3, 0.3), l: rand(11, 19) });
    }
  }
  pillows.sort((a, b) => a.y - b.y);
  for (const p of pillows) {
    const gr = g.createRadialGradient(p.x - p.rx * 0.35, p.y - p.ry * 0.5, p.rx * 0.1, p.x, p.y, p.rx * 1.1);
    gr.addColorStop(0, 'hsl(200, 6%, ' + (p.l + 12) + '%)');
    gr.addColorStop(0.55, 'hsl(200, 8%, ' + p.l + '%)');
    gr.addColorStop(1, '#0c0f10');
    g.fillStyle = gr;
    g.beginPath();
    g.ellipse(p.x, p.y, p.rx, p.ry, p.rot, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.5)';
    g.lineWidth = 1;
    g.stroke();
    g.strokeStyle = 'rgba(170,180,175,0.12)';
    g.lineWidth = 1;
    g.beginPath();
    g.ellipse(p.x, p.y, p.rx * 0.85, p.ry * 0.8, p.rot, Math.PI * 1.15, Math.PI * 1.7);
    g.stroke();
    // pęknięcie skorupy
    if (Math.random() < 0.5) {
      g.strokeStyle = 'rgba(0,0,0,0.45)';
      g.lineWidth = 0.7;
      g.beginPath();
      g.moveTo(p.x - p.rx * 0.3, p.y - p.ry * 0.6);
      g.lineTo(p.x + rand(-3, 3), p.y);
      g.lineTo(p.x + p.rx * 0.4, p.y + p.ry * 0.5);
      g.stroke();
    }
    // osad przysypujący dolną część bryły
    const fl = world.floorAt(p.x);
    if (p.y + p.ry * 0.3 > fl) {
      const sg = g.createLinearGradient(0, fl - 2, 0, p.y + p.ry);
      sg.addColorStop(0, 'rgba(60,64,62,0)');
      sg.addColorStop(0.4, 'rgba(58,62,60,0.85)');
      sg.addColorStop(1, 'rgba(40,44,44,1)');
      g.fillStyle = sg;
      g.beginPath();
      g.ellipse(p.x, p.y, p.rx + 1, p.ry + 1, p.rot, 0, TAU);
      g.fill();
    }
  }

  // Drobne kamyki i ziarna osadu
  for (let k = 0; k < 900; k++) {
    const x = rand(0, world.w);
    const y = world.floorAt(x) + rand(-1, 7);
    const l = rand(18, 42);
    g.fillStyle = `hsla(${rand(20, 200)}, 6%, ${l}%, ${rand(0.4, 0.9)})`;
    g.beginPath();
    g.ellipse(x, y, rand(0.6, 2.6), rand(0.5, 1.6), 0, 0, TAU);
    g.fill();
  }
}

function buildTerrain(world) {
  const S = world.shelf ? 1 : TERRAIN_SCALE;
  let minFloor = Infinity;
  for (const f of world.floor) minFloor = Math.min(minFloor, f);
  let maxTop = Infinity;
  for (const v of world.vents) for (const m of v.mouths) maxTop = Math.min(maxTop, m.y);
  const top = Math.floor(Math.min(minFloor - 340, maxTop - 40));
  const H = world.h - top;

  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(world.w * S);
  canvas.height = Math.ceil(H * S);
  const g = canvas.getContext('2d');
  g.setTransform(S, 0, 0, S, 0, -top * S);

  drawRidges(g, world, top);
  drawRockBody(g, world, top);
  drawPillows(g, world);
  for (const v of world.vents) {
    drawTalus(g, world, v);
    for (const col of v.cols) drawColumn(g, col);
  }
  return { canvas, top, scale: S };
}
