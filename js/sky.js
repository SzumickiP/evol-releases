// Powierzchnia oceanu i świat nad nią: niebo wczesnej Ziemi, wyspy wulkaniczne, burza.
const HORIZON = -40;   // linia horyzontu (odległa tafla morza)
const SKY_SPAN = 4600; // zakres zawijania obiektów nieba z paralaksą

const pmod = (a, m) => ((a % m) + m) % m;

// Kafel kaustyk: jasne krawędzie komórek Voronoi, bezszwowy
function makeCausticTile(size, count) {
  const pts = [];
  for (let i = 0; i < count; i++) pts.push([Math.random() * size, Math.random() * size]);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  const d = img.data;
  // okresowe zawirowanie współrzędnych – krawędzie stają się faliste, kafel nadal bez szwów
  const ph = [rand(0, TAU), rand(0, TAU), rand(0, TAU), rand(0, TAU)];
  const k = TAU / size;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const wx = pmod(x + Math.sin(y * k * 2 + ph[0]) * 11 + Math.sin(y * k * 5 + ph[1]) * 4, size);
      const wy = pmod(y + Math.sin(x * k * 2 + ph[2]) * 11 + Math.sin(x * k * 4 + ph[3]) * 4, size);
      let d1 = 1e9, d2 = 1e9;
      for (const [px, py] of pts) {
        let dx = Math.abs(wx - px), dy = Math.abs(wy - py);
        if (dx > size / 2) dx = size - dx;
        if (dy > size / 2) dy = size - dy;
        const dd = Math.sqrt(dx * dx + dy * dy);
        if (dd < d1) { d2 = d1; d1 = dd; } else if (dd < d2) d2 = dd;
      }
      const b = Math.pow(clamp(1 - (d2 - d1) / 12, 0, 1), 3);
      const i = (y * size + x) * 4;
      d[i] = 190; d[i + 1] = 255; d[i + 2] = 238; d[i + 3] = b * 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

class Sky {
  constructor(world) {
    this.world = world;
    this.flash = 0;
    this.bolt = null;
    this.nextStrike = rand(5, 10);

    this.spr = {
      cloudLit: makeSmokeSprite('236,178,128'),
      cloudShade: makeSmokeSprite('92,62,58'),
      cloudLitW: makeSmokeSprite('246,248,252'),
      cloudShadeW: makeSmokeSprite('128,138,156'),
      ash: makeSmokeSprite('54,44,42'),
      lava: makeGlowSprite([255, 110, 40], 5),
    };
    this.caustics = [makeCausticTile(256, 18), makeCausticTile(256, 26)];

    this.sun = { x: 420, y: -235, f: 0.04 };
    this.moon = { x: -520, y: -390, f: 0.03 };

    // Chmury: kłęby z jasnym wierzchem i ciemną podstawą
    this.clouds = [];
    for (let i = 0; i < 20; i++) {
      const blobs = [];
      const n = 5 + Math.floor(Math.random() * 7);
      const w = rand(90, 260);
      for (let k = 0; k < n; k++) {
        const u = k / (n - 1) - 0.5;
        blobs.push({ dx: u * w + rand(-15, 15), dy: -Math.cos(u * Math.PI) * rand(12, 30) + rand(-6, 6), r: rand(28, 55) });
      }
      this.clouds.push({ x: rand(0, SKY_SPAN), y: rand(-480, -210), f: rand(0.12, 0.4), v: rand(2, 7), blobs, flat: rand(0.45, 0.7) });
    }
    this.clouds.sort((a, b) => a.f - b.f);

    // Wyspy wulkaniczne na horyzoncie
    this.islands = [];
    for (let i = 0; i < 4; i++) {
      const w = rand(180, 380), h = rand(45, 120);
      const pts = [];
      const seed = Math.random() * 50;
      const peak = rand(-0.15, 0.15);
      for (let k = 0; k <= 40; k++) {
        const u = k / 40 * 2 - 1;
        const dist = u < peak ? (peak - u) / (1 + peak) : (u - peak) / (1 - peak);   // 0 na szczycie, 1 na obu końcach
        const prof = Math.max(0, 1 - Math.pow(dist, 1.3));
        const crater = Math.abs(u - peak) < 0.06 ? 0.06 : 0;
        const n = Noise.perlin(seed + u * 4, 0.3) * 0.12 * prof;
        pts.push([u * w / 2, -h * (prof - crater + n)]);
      }
      this.islands.push({
        x: i * SKY_SPAN / 4 + rand(0, 600), f: rand(0.06, 0.18), w, h, pts,
        peakX: peak * w / 2, peakY: -h * 0.94, active: Math.random() < 0.75, plume: [], acc: 0,
      });
    }
    this.islands.sort((a, b) => a.f - b.f);
  }

  // Pozycja obiektu z paralaksą (zawijana, żeby niebo było zawsze wypełnione)
  px(objX, f, camX, wrap = true) {
    const off = objX - camX * f;
    return camX + (wrap ? pmod(off + SKY_SPAN / 2, SKY_SPAN) - SKY_SPAN / 2 : off);
  }

  update(dt) {
    for (const c of this.clouds) c.x += c.v * dt;
    for (const isl of this.islands) {
      if (!isl.active) continue;
      isl.acc += dt * 3;
      while (isl.acc >= 1) {
        isl.acc--;
        isl.plume.push({ dx: isl.peakX + rand(-4, 4), dy: isl.peakY, r: rand(6, 10), age: 0, life: rand(8, 14) });
      }
      for (const p of isl.plume) {
        p.age += dt;
        p.dy -= (14 - p.age * 0.6) * dt;
        p.dx += (4 + p.age * 1.2) * dt;
        p.r += 2.6 * dt;
      }
      isl.plume = isl.plume.filter(p => p.age < p.life);
    }

    this.flash = Math.max(0, this.flash - dt * 3);
    if (this.bolt) {
      this.bolt.life -= dt;
      if (this.bolt.life <= 0) this.bolt = null;
    }
    this.nextStrike -= dt;
    if (this.nextStrike <= 0 && this.world.env.ice > 0.5) this.nextStrike = rand(4, 8);   // skuty lodem ocean – pioruny nie sięgają wody
    if (this.nextStrike <= 0) {
      this.strike();
      this.nextStrike = rand(7, 16);
    }
  }

  strike() {
    const w = this.world;
    const x = clamp((w.focusX ?? w.w / 2) + rand(-650, 650), 50, w.w - 50);
    const sy = w.waveY(x);
    const make = (x0, y0, x1, y1, steps, jit) => {
      const pts = [[x0, y0]];
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        pts.push([mix(x0, x1, t) + rand(-jit, jit), mix(y0, y1, t) + rand(-jit * 0.3, jit * 0.3)]);
      }
      pts.push([x1, y1]);
      return pts;
    };
    const main = make(x + rand(-90, 90), -330, x, sy, 16, 20);
    const branches = [];
    for (let b = 0; b < 3; b++) {
      const [bx, by] = main[1 + Math.floor(Math.random() * 9)];
      branches.push(make(bx, by, bx + rand(-90, 90), by + rand(50, 120), 6, 10));
    }
    this.bolt = { pts: main, branches, life: 0.45, x, y: sy };
    this.flash = 1;
    // Wyładowanie tworzy związki organiczne w wodzie (doświadczenie Millera–Ureya)
    for (let i = 0; i < 14; i++) w.addParticle('organic', x + rand(-60, 60), rand(8, 150));
    if (w.onLightning) w.onLightning(x);
  }

  // ---------- Rysowanie ----------

  // Kaustyki – świetlne wzory tuż pod powierzchnią
  drawCaustics(ctx, view) {
    if (view.y0 > 380) return;
    const t = this.world.time;
    if (!this.pats) this.pats = this.caustics.map(c => ctx.createPattern(c, 'repeat'));
    const layers = [
      { p: this.pats[0], ox: t * 14, oy: t * 6, s: 1.4 },
      { p: this.pats[1], ox: -t * 10, oy: t * 9 + 40, s: 1.0 },
    ];
    const x0 = Math.max(0, view.x0), x1 = Math.min(this.world.w, view.x1);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const strip = 25, n = 15;
    for (const L of layers) {
      if (L.p.setTransform) L.p.setTransform(new DOMMatrix().translateSelf(L.ox, L.oy).scaleSelf(L.s, L.s));
      ctx.fillStyle = L.p;
      for (let s = 0; s < n; s++) {
        const y = s * strip;
        if (y > view.y1 || y + strip < view.y0) continue;
        ctx.globalAlpha = 0.11 * Math.pow(1 - s / n, 2) * (1 + this.flash * 0.5) * (1 - this.world.env.ice * 0.9);
        ctx.fillRect(x0, y, x1 - x0, strip);
      }
    }
    ctx.restore();
  }

  surfacePoints(view) {
    const pts = [];
    const x0 = Math.floor(view.x0 / 8) * 8 - 16;
    const x1 = Math.min(view.x1 + 16, this.world.waterEnd + 8);
    for (let x = x0; x <= x1; x += 8) pts.push([x, this.world.waveY(x)]);
    if (pts.length < 2) pts.push([x0, this.world.waveY(x0)], [x0 + 8, this.world.waveY(x0 + 8)]);
    return pts;
  }

  // Wszystko nad wodą (rysowane pod komórkami, przycięte do obszaru nad falą)
  drawAbove(ctx, view, cam) {
    if (view.y0 > 20) return;
    const w = this.world, t = w.time;
    const pts = this.surfacePoints(view);
    const top = Math.min(view.y0, -700) - 50;

    ctx.save();
    const clip = new Path2D();
    clip.moveTo(pts[0][0], top);
    for (const [x, y] of pts) clip.lineTo(x, y);
    let R = pts[pts.length - 1][0];
    if (R < view.x1 + 16) {   // nad lądem niebo sięga aż do gruntu (grunt rysuje się później)
      clip.lineTo(R, 80);
      R = view.x1 + 16;
      clip.lineTo(R, 80);
    }
    clip.lineTo(R, top);
    clip.closePath();
    ctx.clip(clip);
    const L = pts[0][0];
    const o2 = w.env.o2, ice = w.env.ice;
    const C = (a, b) => rgb(mix3(a, b, o2));

    // Niebo: mgła metanowa zabarwia je na pomarańczowo; po Wielkim Utlenieniu robi się błękitne
    const sky = ctx.createLinearGradient(0, -760, 0, HORIZON);
    sky.addColorStop(0, C([30, 20, 32], [14, 32, 70]));
    sky.addColorStop(0.35, C([74, 44, 44], [42, 86, 146]));
    sky.addColorStop(0.75, C([162, 100, 62], [112, 160, 210]));
    sky.addColorStop(1, C([217, 160, 106], [200, 222, 236]));
    ctx.fillStyle = sky;
    ctx.fillRect(L, top, R - L, HORIZON - top + 1);

    // Słońce (słabsze niż dziś) i duży, bliski Księżyc
    const sx = this.px(this.sun.x, this.sun.f, cam.x, false), sy = this.sun.y;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 320);
    sg.addColorStop(0, rgb(mix3([255, 225, 170], [255, 250, 235], o2), 0.55 + o2 * 0.2));
    sg.addColorStop(0.12, rgb(mix3([255, 190, 120], [255, 240, 210], o2), 0.25));
    sg.addColorStop(1, 'rgba(255,200,150,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(sx - 320, sy - 320, 640, 640);
    ctx.fillStyle = 'rgba(255,240,210,0.9)';
    ctx.beginPath(); ctx.arc(sx, sy, 20, 0, TAU); ctx.fill();
    ctx.restore();

    const mx = this.px(this.moon.x, this.moon.f, cam.x, false), my = this.moon.y;
    ctx.save();
    ctx.globalAlpha = 0.5;
    const mg = ctx.createRadialGradient(mx - 14, my - 12, 4, mx, my, 50);
    mg.addColorStop(0, '#ece4da');
    mg.addColorStop(1, '#9a8e86');
    ctx.fillStyle = mg;
    ctx.beginPath(); ctx.arc(mx, my, 48, 0, TAU); ctx.fill();
    ctx.clip();
    ctx.fillStyle = 'rgba(90,80,78,0.45)';
    for (const [dx, dy, r] of [[-14, -10, 13], [10, 6, 16], [-4, 22, 9], [22, -16, 7], [-24, 12, 6]]) {
      ctx.beginPath(); ctx.arc(mx + dx, my + dy, r, 0, TAU); ctx.fill();
    }
    ctx.restore();

    // Chmury
    for (const c of this.clouds) {
      const cx = this.px(c.x, c.f, cam.x);
      if (cx + 400 < view.x0 || cx - 400 > view.x1) continue;
      const k = 0.7 + c.f;
      // dwa zestawy chmur: brunatne (mgła metanowa) i białe (atmosfera z tlenem)
      for (const [shade, lit, wgt] of [[this.spr.cloudShade, this.spr.cloudLit, 1 - o2], [this.spr.cloudShadeW, this.spr.cloudLitW, o2]]) {
        if (wgt < 0.02) continue;
        for (const b of c.blobs) {
          const r = b.r * k * 2.2;
          ctx.globalAlpha = 0.55 * wgt;
          ctx.drawImage(shade, cx + b.dx * k - r / 2, c.y + b.dy * k * c.flat + 6 - r * c.flat / 2, r, r * c.flat);
        }
        for (const b of c.blobs) {
          const r = b.r * k * 1.7;
          ctx.globalAlpha = (0.4 + this.flash * 0.4) * wgt;
          ctx.drawImage(lit, cx + b.dx * k - r / 2, c.y + b.dy * k * c.flat - 8 - r * c.flat / 2, r, r * c.flat);
        }
      }
    }
    ctx.globalAlpha = 1;

    // Mgiełka nad horyzontem
    const hz = ctx.createLinearGradient(0, HORIZON - 140, 0, HORIZON);
    hz.addColorStop(0, rgb(mix3([230, 170, 120], [210, 228, 240], o2), 0));
    hz.addColorStop(1, rgb(mix3([235, 180, 130], [215, 232, 244], o2), 0.45));
    ctx.fillStyle = hz;
    ctx.fillRect(L, HORIZON - 140, R - L, 140);

    // Wyspy wulkaniczne
    for (const isl of this.islands) {
      const ix = this.px(isl.x, isl.f, cam.x);
      if (ix + isl.w < view.x0 || ix - isl.w > view.x1) continue;
      const haze = 0.55 - isl.f * 1.5;
      const col = mix3([30, 22, 22], mix3([196, 140, 104], [150, 172, 196], o2), haze);
      for (const p of isl.plume) {
        const u = p.age / p.life;
        const r = p.r * 2.4;
        ctx.globalAlpha = 0.45 * (1 - u) * Math.min(1, p.age * 2);
        ctx.drawImage(this.spr.ash, ix + p.dx - r / 2, HORIZON + p.dy - r / 2, r, r);
      }
      ctx.globalAlpha = 1;
      // strona zwrócona do słońca jaśniejsza
      const toSun = sx > ix ? 1 : -1;
      const ig = ctx.createLinearGradient(ix - toSun * isl.w / 2, 0, ix + toSun * isl.w / 2, 0);
      ig.addColorStop(0, rgb(col.map(c => c * 0.8)));
      ig.addColorStop(0.55, rgb(col));
      ig.addColorStop(1, rgb(mix3(col, [230, 160, 110], 0.25)));
      ctx.fillStyle = ig;
      ctx.beginPath();
      ctx.moveTo(ix + isl.pts[0][0], HORIZON + 1);
      for (const [x, y] of isl.pts) ctx.lineTo(ix + x, HORIZON + y);
      ctx.lineTo(ix + isl.pts[isl.pts.length - 1][0], HORIZON + 1);
      ctx.closePath();
      ctx.fill();
      if (isl.active) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.6 + 0.4 * Math.sin(t * 3 + isl.x);
        const s = 34;
        ctx.drawImage(this.spr.lava, ix + isl.peakX - s / 2, HORIZON + isl.peakY - s / 2, s, s);
        ctx.restore();
      }
    }

    // Odległa tafla morza – odbija pomarańczowe niebo
    const sea = ctx.createLinearGradient(0, HORIZON, 0, 14);
    sea.addColorStop(0, C([179, 134, 96], [168, 198, 222]));
    sea.addColorStop(0.35, C([111, 116, 104], [84, 128, 164]));
    sea.addColorStop(1, C([44, 106, 112], [34, 94, 128]));
    ctx.fillStyle = sea;
    ctx.fillRect(L, HORIZON, R - L, 14 - HORIZON);
    // zlodowacenie: morze aż po horyzont skute lodem
    if (ice > 0.01) {
      const ig = ctx.createLinearGradient(0, HORIZON, 0, 14);
      ig.addColorStop(0, `rgba(226,236,244,${0.9 * ice})`);
      ig.addColorStop(1, `rgba(196,216,230,${0.95 * ice})`);
      ctx.fillStyle = ig;
      ctx.fillRect(L, HORIZON, R - L, 14 - HORIZON);
    }
    ctx.fillStyle = 'rgba(255,225,190,0.5)';
    ctx.fillRect(L, HORIZON, R - L, 1.2);

    // Odblask słońca na wodzie
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 70 * (1 - ice); i++) {
      const v = Math.random();
      const y = HORIZON + 2 + v * (12 - HORIZON);
      const spread = 6 + v * 70;
      const x = sx + (Math.random() + Math.random() - 1) * spread;
      ctx.fillStyle = `rgba(255,220,170,${rand(0.15, 0.55)})`;
      ctx.fillRect(x, y, rand(2, 6 + v * 10), 1);
    }
    ctx.restore();

    // Piorun
    if (this.bolt) {
      const b = this.bolt;
      const a = (b.life / 0.45) * (0.7 + 0.3 * Math.random());
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineJoin = 'round';
      const line = (p, wd, col) => {
        ctx.strokeStyle = col;
        ctx.lineWidth = wd;
        ctx.beginPath();
        p.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.stroke();
      };
      line(b.pts, 7, `rgba(190,170,255,${0.25 * a})`);
      line(b.pts, 2, `rgba(255,255,255,${a})`);
      for (const br of b.branches) line(br, 1, `rgba(230,225,255,${0.7 * a})`);
      ctx.restore();
    }

    if (this.flash > 0) {
      ctx.fillStyle = `rgba(255,235,225,${this.flash * 0.35})`;
      ctx.fillRect(L, top, R - L, 30 - top);
    }
    ctx.restore();
  }

  // Sama linia powierzchni (rysowana nad komórkami)
  drawSurface(ctx, view) {
    if (this.world.env.ice > 0.6) { this.drawIce(ctx, view); return; }
    if (view.y0 > 70) {
      if (this.flash > 0) this.flashWater(ctx, view);
      return;
    }
    const w = this.world, t = w.time;
    const pts = this.surfacePoints(view);

    // Jasny spód tafli – całkowite wewnętrzne odbicie
    const under = new Path2D();
    under.moveTo(pts[0][0], pts[0][1]);
    for (const [x, y] of pts) under.lineTo(x, y);
    under.lineTo(pts[pts.length - 1][0], 60);
    under.lineTo(pts[0][0], 60);
    under.closePath();
    const ug = ctx.createLinearGradient(0, -10, 0, 60);
    ug.addColorStop(0, 'rgba(205,245,238,0.4)');
    ug.addColorStop(0.3, 'rgba(160,225,220,0.12)');
    ug.addColorStop(1, 'rgba(160,225,220,0)');
    ctx.fillStyle = ug;
    ctx.fill(under);

    // Linia wody: ciemny brzeg od góry, jasna krawędź od spodu
    const line = (dy, wd, col) => {
      ctx.strokeStyle = col;
      ctx.lineWidth = wd;
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y + dy) : ctx.moveTo(x, y + dy)));
      ctx.stroke();
    };
    line(-1.2, 1.2, 'rgba(40,60,60,0.45)');
    line(0.6, 1.8, 'rgba(235,255,250,0.85)');

    // Piana na grzbietach fal
    for (let i = 1; i < pts.length - 1; i++) {
      const [x, y] = pts[i];
      const crest = y < pts[i - 1][1] && y <= pts[i + 1][1];
      const n = Noise.perlin(x * 0.05, t * 0.8);
      if (!crest && n < 0.25) continue;
      ctx.fillStyle = `rgba(245,250,245,${clamp(0.25 + n * 0.8, 0.1, 0.8)})`;
      ctx.beginPath();
      ctx.ellipse(x, y - 0.5, Math.max(0.6, 2 + n * 4), 1.2, 0, 0, TAU);
      ctx.fill();
    }

    // Rozbłysk w miejscu uderzenia pioruna
    if (this.bolt) {
      const b = this.bolt;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, 140);
      g.addColorStop(0, `rgba(220,220,255,${0.7 * b.life / 0.45})`);
      g.addColorStop(1, 'rgba(220,220,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(b.x - 140, b.y - 140, 280, 280);
      ctx.restore();
    }
    if (this.flash > 0) this.flashWater(ctx, view);
    this.drawIce(ctx, view);
  }

  // Pokrywa lodowa (zlodowacenia hurońskie i Ziemia-śnieżka)
  drawIce(ctx, view) {
    const ice = this.world.env.ice;
    if (ice < 0.01 || view.y0 > 90) return;
    const th = 14 + ice * 34;
    const x0 = Math.floor(view.x0 / 30) * 30 - 30, x1 = view.x1 + 30;
    const under = x => th + Noise.perlin(x * 0.012, 3.7) * 9 + Noise.perlin(x * 0.05, 1.3) * 3;
    const slab = new Path2D();
    slab.moveTo(x0, -14);
    for (let x = x0; x <= x1; x += 15) slab.lineTo(x, -6 + Noise.perlin(x * 0.02, 9.1) * 3);
    for (let x = x1; x >= x0; x -= 15) slab.lineTo(x, under(x));
    slab.closePath();
    ctx.save();
    ctx.globalAlpha = Math.min(1, ice * 1.4);
    const g = ctx.createLinearGradient(0, -10, 0, th + 10);
    g.addColorStop(0, '#f2f7fb');
    g.addColorStop(0.35, '#cfe2ee');
    g.addColorStop(1, '#7fb3cc');
    ctx.fillStyle = g;
    ctx.fill(slab);
    // pęknięcia i pęcherzyki powietrza uwięzione w lodzie
    ctx.clip(slab);
    ctx.strokeStyle = 'rgba(120,160,185,0.55)';
    ctx.lineWidth = 0.8;
    for (let x = Math.floor(x0 / 140) * 140; x < x1; x += 140) {
      const n = Noise.perlin(x * 0.01, 5.5);
      ctx.beginPath();
      ctx.moveTo(x + n * 40, -8);
      ctx.lineTo(x + n * 40 + 12, th * 0.5);
      ctx.lineTo(x + n * 40 - 6, th + 12);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    for (let x = Math.floor(x0 / 23) * 23; x < x1; x += 23) {
      const n = Noise.perlin(x * 0.3, 2.2);
      ctx.fillRect(x + n * 10, th * (0.3 + n * 0.5), 1.5, 1.5);
    }
    ctx.restore();
    ctx.strokeStyle = `rgba(200,235,250,${0.7 * ice})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = x0; x <= x1; x += 15) x === x0 ? ctx.moveTo(x, under(x)) : ctx.lineTo(x, under(x));
    ctx.stroke();
  }

  flashWater(ctx, view) {
    ctx.fillStyle = `rgba(220,235,255,${this.flash * 0.07})`;
    ctx.fillRect(view.x0, Math.max(0, view.y0), view.x1 - view.x0, view.y1 - Math.max(0, view.y0));
  }
}
