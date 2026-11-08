// Środowisko: pierwotny ocean z kominami hydrotermalnymi, strefą UV i prądami.
const WORLD_W = 4000;
const WORLD_H = 2600;
const UV_DEPTH = 450;          // do tej głębokości dociera zabójcze UV (brak warstwy ozonowej)
const TAU = Math.PI * 2;

// Rodzaje pożywienia
const FOOD = {
  organic: { name: 'Związki organiczne', energy: 6,  biomass: 4,  health: 0, color: [150, 255, 140], size: 3.2, life: Infinity },
  mineral: { name: 'Minerały z komina',  energy: 12, biomass: 0,  health: 0, color: [255, 160, 70],  size: 2.6, life: 45 },
  lipid:   { name: 'Lipidy',             energy: 2,  biomass: 10, health: 4, color: [255, 240, 190], size: 4.2, life: Infinity },
  // Era 2: nukleotydy zagęszczają się w porach kominów alkalicznych (budulec DNA)
  nucleotide: { name: 'Nukleotydy',      energy: 2,  biomass: 3,  health: 0, color: [150, 165, 255], size: 2.8, life: 70 },
  // Ery organizmów: pożywienie leżące w miejscu (nie dryfuje)
  mat:      { name: 'Maty mikrobiologiczne', energy: 6, biomass: 5, health: 1, color: [150, 170, 80], size: 4, life: Infinity, static: true },
  detritus: { name: 'Szczątki roślin',      energy: 7, biomass: 5, health: 1, color: [150, 118, 70], size: 4, life: Infinity, static: true },
};
const smooth01 = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };

function makeGlowSprite(rgb, size) {
  const s = Math.ceil(size * 6);
  const c = document.createElement('canvas');
  c.width = c.height = s * 2;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(s, s, 0, s, s, s);
  const [r, gr, b] = rgb;
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.12, `rgba(${r},${gr},${b},1)`);
  grad.addColorStop(0.35, `rgba(${r},${gr},${b},0.35)`);
  grad.addColorStop(1, `rgba(${r},${gr},${b},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, s * 2, s * 2);
  return c;
}

// Miękki kłąb dymu
function makeSmokeSprite(rgb) {
  const s = 32;
  const c = document.createElement('canvas');
  c.width = c.height = s * 2;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(s, s, 0, s, s, s);
  grad.addColorStop(0, `rgba(${rgb},1)`);
  grad.addColorStop(0.45, `rgba(${rgb},0.6)`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, s * 2, s * 2);
  return c;
}

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

class World {
  // opts.shelf – płytkie morze szelfowe przechodzące w plażę i ląd (ery organizmów wielokomórkowych)
  constructor(opts = {}) {
    this.shelf = !!opts.shelf;
    this.w = WORLD_W;
    this.h = this.shelf ? 2000 : WORLD_H;
    this.time = 0;
    this.acc = { org: 0, lip: 0 };

    // Kominy: czarne (siarczkowe, bardzo gorące) i alkaliczne (węglanowe, łagodne)
    this.vents = [];
    const types = this.shelf ? ['black', 'alkaline'] : ['black', 'alkaline', 'black', 'alkaline'];
    (this.shelf ? [380, 1150] : [550, 1550, 2500, 3450]).forEach((bx, i) => {
      const black = types[i] === 'black';
      this.vents.push({
        type: types[i],
        x: bx + rand(-125, 125),
        w: black ? rand(20, 28) : rand(26, 34),
        h: black ? rand(150, 210) : rand(190, 260),
        mound: black ? rand(30, 45) : rand(45, 65),
        heat: black ? 1 : 0.72,       // maks. "ciepło" przy wylocie
        heatR: black ? 380 : 420,     // zasięg ciepła
      });
    });

    // Dno oceanu z kopcami osadów wokół kominów
    this.floorStep = 20;
    this.floor = [];
    const seed = Math.random() * 100;
    for (let x = 0; x <= this.w + this.floorStep; x += this.floorStep) {
      if (this.shelf) {
        // głęboki stok po lewej, szelf, plaża i ląd po prawej
        const base = x < 1700 ? mix(1720, 620, smooth01(x / 1700))
          : x < 3050 ? mix(620, -6, smooth01((x - 1700) / 1350))
          : mix(-6, -170, smooth01((x - 3050) / 550));
        const k = clamp(base / 600, 0.12, 1);
        let n = Noise.perlin(x * 0.0018 + seed, 0.5) * 90 * k + Noise.perlin(x * 0.012 + seed, 7.3) * 20 * k
              + Noise.perlin(x * 0.05, 1.1) * 4;
        for (const v of this.vents) n -= v.mound * Math.exp(-Math.pow((x - v.x) / 150, 2));
        this.floor.push(base + n);
        continue;
      }
      let n = Noise.perlin(x * 0.0018 + seed, 0.5) * 140
            + Noise.perlin(x * 0.012 + seed, 7.3) * 28
            + Noise.perlin(x * 0.05, 1.1) * 6;
      for (const v of this.vents) n -= v.mound * Math.exp(-Math.pow((x - v.x) / 150, 2));
      this.floor.push(this.h - 260 + n);
    }
    // linia brzegowa: od tego miejsca w prawo jest ląd
    this.waterEnd = this.w;
    if (this.shelf) {
      for (let x = 0; x < this.w; x += 5) if (this.floorAt(x) < 3) { this.waterEnd = x; break; }
      // roślinność lądowa (pokazywana zależnie od epoki: env.flora)
      this.flora = [];
      for (let x = this.waterEnd + 30; x < this.w - 10; x += rand(9, 26)) {
        const r = Math.random();
        this.flora.push({ x, tier: r < 0.55 ? 1 : 2, kind: r < 0.3 ? 'moss' : r < 0.55 ? 'cooksonia' : r < 0.8 ? 'fern' : r < 0.9 ? 'horsetail' : 'tree',
          s: rand(0.7, 1.3), seed: Math.random() * 100 });
      }
    }
    for (const v of this.vents) {
      v.y = this.floorAt(v.x);
      planChimney(v);
    }

    this.floorPath = new Path2D();
    this.floorPath.moveTo(-50, this.h + 400);
    for (let i = 0; i < this.floor.length; i++) this.floorPath.lineTo(i * this.floorStep, this.floor[i]);
    this.floorPath.lineTo(this.w + 50, this.h + 400);
    this.floorPath.closePath();

    this.terrain = buildTerrain(this);
    // Stan planety zmienia się z erami: tlen, ozon, zlodowacenia
    this.env = { era: 1, o2: 0, ozone: 0, ice: 0, iceTarget: 0, bands: this.shelf ? 5 : 0, flora: 0, mats: false, detritus: false };
    this.flakes = [];   // tlenki żelaza opadające na dno (Wielkie Utlenienie)
    this.focusX = this.w / 2;   // gdzie patrzy gracz (np. miejsce uderzeń piorunów)
    this.cam = null;
    this.onLightning = null;
    this.sky = new Sky(this);

    this.particles = [];
    this.bubbles = [];
    this.smoke = [];
    this.sprites = {};
    for (const k in FOOD) this.sprites[k] = makeGlowSprite(FOOD[k].color, FOOD[k].size);
    this.smokeDark = makeSmokeSprite('14,12,10');
    this.smokeLight = makeSmokeSprite('215,225,222');
    this.ember = makeGlowSprite([255, 120, 50], 6);

    for (let i = 0; i < 450; i++) this.spawnOrganic();
    for (let i = 0; i < 40; i++) this.spawnLipid();
    for (const v of this.vents) for (let i = 0; i < 25; i++) this.spawnMineral(v, true);
    // dym od razu w powietrzu, żeby nie startować od zera
    for (let i = 0; i < 300; i++) this.updateSmoke(1 / 30);

    // "Śnieg" w wodzie – dekoracyjne drobiny z paralaksą
    this.snow = [];
    for (let i = 0; i < 220; i++) {
      this.snow.push({ x: Math.random(), y: Math.random(), f: rand(0.3, 1.4), s: rand(0.6, 2.2), a: rand(0.08, 0.35) });
    }
  }

  floorAt(x) {
    const fx = clamp(x, 0, this.w) / this.floorStep;
    const i = Math.floor(fx);
    const t = fx - i;
    const a = this.floor[i];
    const b = this.floor[Math.min(i + 1, this.floor.length - 1)];
    return a + (b - a) * t;
  }

  // Ozon (powstaje z tlenu) pochłania większość UV
  uvAt(y) { return clamp(1 - y / UV_DEPTH, 0, 1) * (1 - 0.88 * this.env.ozone); }

  // Czy punkt jest pod wodą (na lądzie i w powietrzu – nie)
  isWater(x, y) {
    const wy = this.waveY(x);
    return y > wy + 1 && this.floorAt(x) > wy + 1;
  }

  // Tlen: najwięcej przy powierzchni, głęboka toń i dno długo pozostają beztlenowe
  o2At(x, y) { return this.env.o2 * clamp(1.15 - y / 1900, 0, 1); }

  // Światło słoneczne gaśnie z głębokością, lód zasłania je prawie całkiem
  lightAt(y) { return Math.exp(-Math.max(0, y) / 520) * (1 - this.env.ice * 0.8); }

  // Wysokość fali na powierzchni (kilka nałożonych sinusoid)
  waveY(x) {
    const t = this.time;
    return Math.sin(x * 0.011 - t * 1.3) * 4
         + Math.sin(x * 0.027 + t * 1.9) * 2.2
         + Math.sin(x * 0.004 - t * 0.6) * 5
         + Math.sin(x * 0.061 - t * 3.1) * 0.8;
  }

  ventHeat(v, x, y) {
    const dx = x - v.mx, dy = y - v.top;
    const d = Math.sqrt(dx * dx + (dy < 0 ? dy * dy * 0.25 : dy * dy));
    return v.heat * (1 - d / v.heatR);
  }

  // 0 = zimno, 1 = wylot czarnego komina. Ciepło sięga wyżej nad kominem (pióropusz).
  heatAt(x, y) {
    let heat = 0;
    for (const v of this.vents) heat = Math.max(heat, this.ventHeat(v, x, y));
    return clamp(heat, 0, 1);
  }

  temperatureAt(x, y) { return 18 - this.env.ice * 15 + this.heatAt(x, y) * 102; }

  nearestVent(x) {
    let best = this.vents[0];
    for (const v of this.vents) if (Math.abs(v.x - x) < Math.abs(best.x - x)) best = v;
    return best;
  }

  zoneAt(x, y) {
    if (this.shelf) {
      if (!this.isWater(x, y)) return 'Ląd';
      const fl = this.floorAt(x);
      if (fl < 260) return 'Strefa pływów';
      if (fl < 520) return 'Płycizna';
      if (fl < 1000) return 'Szelf';
      return 'Głęboki stok';
    }
    if (this.env.ice > 0.5 && y < 120) return 'Pod lodem';
    if (this.uvAt(y) > 0.05) return 'Strefa UV';
    let best = null, bh = 0;
    for (const v of this.vents) {
      const h = this.ventHeat(v, x, y);
      if (h > bh) { bh = h; best = v; }
    }
    if (bh > 0.62) return 'Komin – wrzątek';
    if (bh > 0.2) return best.type === 'black' ? 'Czarny komin' : 'Źródło alkaliczne';
    if (y > this.floorAt(x) - 250) return 'Dno oceanu';
    return 'Otwarty ocean';
  }

  // Prąd wody w danym punkcie
  flow(x, y) {
    if (this.shelf && !this.isWater(x, y)) return [0, 0];
    const t = this.time, s = 0.0012;
    const ang = Noise.perlin(x * s + t * 0.015, y * s - t * 0.01) * TAU * 1.1;
    let vx = Math.cos(ang) * 14;
    let vy = Math.sin(ang) * 9;
    for (const v of this.vents) {
      const dy = v.top - y;
      if (dy > -30 && dy < 900) {
        const dx = x - v.mx;
        const width = 40 + Math.max(0, dy) * 0.25;
        const ax = Math.abs(dx);
        if (ax < width) {
          const f = (1 - ax / width) * (1 - Math.max(0, dy) / 900) * (v.type === 'black' ? 1 : 0.6);
          vy -= 75 * f;
          vx -= (dx / width) * 8 * f;
        }
      }
    }
    return [vx, vy];
  }

  spawnOrganic() {
    // Związki organiczne powstają głównie bliżej powierzchni (UV + wyładowania)
    const x = rand(20, this.waterEnd - 40);
    const y = 20 + Math.pow(Math.random(), 1.5) * Math.max(10, this.floorAt(x) - 60);
    this.addParticle('organic', x, y);
  }

  spawnLipid() {
    const x = rand(20, this.waterEnd - 40);
    const y = rand(Math.min(UV_DEPTH * 0.6, this.floorAt(x) - 70), this.floorAt(x) - 60);
    this.addParticle('lipid', x, y);
  }

  spawnMineral(v, scatter = false) {
    const m = v.mouths[Math.random() < 0.6 ? v.mouths.length - 1 : Math.floor(Math.random() * v.mouths.length)];
    const p = this.addParticle('mineral', m.x + rand(-m.r, m.r) * 0.5, m.y - rand(0, 10));
    p.vy = -40;
    if (scatter) {
      p.y -= rand(0, 600);
      p.x += rand(-120, 120);
      p.age = rand(0, 30);
    }
  }

  // Nukleotydy uwalniane z porów kominów alkalicznych
  spawnNucleotide(v) {
    const m = v.mouths[Math.floor(Math.random() * v.mouths.length)];
    const p = this.addParticle('nucleotide', m.x + rand(-60, 60), m.y + rand(-30, 40));
    p.vy = -15;
    return p;
  }

  // Tlen utlenia rozpuszczone żelazo – rdzawe płatki opadają i tworzą wstęgowe rudy żelaza
  paintIronBand(k) {
    const T = this.terrain, S = T.scale;
    const g = T.canvas.getContext('2d');
    g.setTransform(S, 0, 0, S, 0, -T.top * S);
    const off = 3 + (5 - k) * 4, th = 2.6;
    g.beginPath();
    for (let i = 0; i < this.floor.length; i++) g.lineTo(i * this.floorStep, this.floor[i] + off);
    for (let i = this.floor.length - 1; i >= 0; i--) g.lineTo(i * this.floorStep, this.floor[i] + off + th);
    g.closePath();
    g.fillStyle = k % 2 ? 'rgba(150,62,32,0.55)' : 'rgba(120,48,30,0.45)';
    g.fill();
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  // Maty mikrobiologiczne na dnie płytkiego morza i szczątki roślin na lądzie
  spawnMat() {
    const x = rand(Math.max(300, this.waterEnd - 2300), this.waterEnd - 60);
    this.addParticle('mat', x, this.floorAt(x) - 3);
  }
  spawnDetritus() {
    const x = rand(this.waterEnd + 20, this.w - 30);
    this.addParticle('detritus', x, this.floorAt(x) - 3);
  }

  addParticle(type, x, y) {
    const p = { type, x, y, vx: 0, vy: 0, age: 0, phase: Math.random() * TAU, dead: false };
    this.particles.push(p);
    return p;
  }

  // Szczątki martwej komórki wracają do ekosystemu
  spawnRemains(x, y) {
    for (let i = 0; i < 2; i++) this.addParticle('lipid', x + rand(-10, 10), y + rand(-10, 10));
    for (let i = 0; i < 3; i++) this.addParticle('organic', x + rand(-12, 12), y + rand(-12, 12));
  }

  // Dym z kominów: czarny (siarczki) lub mleczny (węglany, wodór)
  updateSmoke(dt) {
    for (const v of this.vents) {
      const black = v.type === 'black';
      for (const m of v.mouths) {
        m.acc += dt * (black ? (m.main ? 10 : 4) : (m.main ? 5 : 3));
        while (m.acc >= 1) {
          m.acc--;
          this.smoke.push({
            x: m.x + rand(-1, 1) * m.r * 0.4, y: m.y - 2,
            vx: rand(-6, 6), vy: black ? rand(-70, -50) : rand(-40, -25),
            r: Math.max(2, m.r * 0.8), grow: black ? rand(7, 12) : rand(5, 9),
            age: 0, life: black ? rand(4.5, 6.5) : rand(4, 6), dark: black,
          });
        }
        m.bub += dt * (black ? (m.main ? 1.5 : 0.5) : 2.5);
        while (m.bub >= 1) {
          m.bub--;
          this.bubbles.push({ x: m.x + rand(-3, 3), y: m.y, r: rand(1, 3.2), vy: rand(-60, -30), age: 0, life: rand(4, 10), ph: Math.random() * TAU });
        }
      }
    }
    for (const s of this.smoke) {
      const [fx, fy] = this.flow(s.x, s.y);
      s.vx += (fx - s.vx) * dt * 0.6;
      s.vy += (Math.min(fy, -15) - s.vy) * dt * 0.5;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.r += s.grow * dt * (1 - 0.5 * s.age / s.life);
      s.age += dt;
    }
    this.smoke = this.smoke.filter(s => s.age < s.life);
  }

  update(dt) {
    this.time += dt;

    let org = 0, lip = 0;
    for (const p of this.particles) {
      if (p.type === 'organic') org++;
      else if (p.type === 'lipid') lip++;
    }
    this.acc.org += dt * 8;
    while (this.acc.org >= 1) { this.acc.org--; if (org < 520) { this.spawnOrganic(); org++; } }
    this.acc.lip += dt * 0.6;
    while (this.acc.lip >= 1) { this.acc.lip--; if (lip < 55) { this.spawnLipid(); lip++; } }

    for (const v of this.vents) {
      v.emit = (v.emit || 0) + dt * (v.type === 'black' ? 2.4 : 2);
      while (v.emit >= 1) { v.emit--; this.spawnMineral(v); }
    }
    this.updateEnv(dt);
    this.updateSmoke(dt);
    this.sky.update(dt);

    for (const p of this.particles) {
      if (p.dead) continue;
      if (FOOD[p.type].static) continue;
      const [fx, fy] = this.flow(p.x, p.y);
      const k = Math.min(1, dt * 1.5);
      p.vx += (fx - p.vx) * k + rand(-10, 10) * dt;
      p.vy += (fy - p.vy) * k + rand(-10, 10) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.age += dt;
      if (p.x < 5) { p.x = 5; p.vx = Math.abs(p.vx); }
      if (p.x > this.waterEnd - 5) { p.x = this.waterEnd - 5; p.vx = -Math.abs(p.vx); }
      if (p.y < 4) { p.y = 4; p.vy = Math.abs(p.vy); }
      const fl = this.floorAt(p.x);
      if (p.y > fl - 3) { p.y = fl - 3; p.vy = -Math.abs(p.vy) * 0.5; }
      if (p.age > FOOD[p.type].life) p.dead = true;
    }
    this.particles = this.particles.filter(p => !p.dead);

    for (const b of this.bubbles) {
      b.age += dt;
      b.y += b.vy * dt;
      b.x += Math.sin(b.age * 3 + b.ph) * 12 * dt;
    }
    this.bubbles = this.bubbles.filter(b => b.age < b.life && b.y > 0);
  }

  updateEnv(dt) {
    const E = this.env;
    // ozon narasta z opóźnieniem względem tlenu
    E.ozone += (clamp((E.o2 - 0.25) / 0.6, 0, 1) - E.ozone) * Math.min(1, dt * 0.15);
    E.ice += clamp(E.iceTarget - E.ice, -dt * 0.05, dt * 0.05);

    // pożywienie er organizmów
    if (this.shelf) {
      let mats = 0, det = 0;
      for (const p of this.particles) { if (p.type === 'mat') mats++; else if (p.type === 'detritus') det++; }
      this.acc.mat = (this.acc.mat || 0) + dt * 3;
      while (this.acc.mat >= 1) {
        this.acc.mat--;
        if (E.mats && mats < 110) { this.spawnMat(); mats++; }
        if (E.detritus && det < 45) { this.spawnDetritus(); det++; }
      }
    }

    // nukleotydy (od Ery 2)
    if (E.era >= 2 && !this.shelf) {
      let n = 0;
      for (const p of this.particles) if (p.type === 'nucleotide') n++;
      this.acc.nuc = (this.acc.nuc || 0) + dt * 1.6;
      while (this.acc.nuc >= 1) {
        this.acc.nuc--;
        if (n < 70) { this.spawnNucleotide(this.vents[Math.random() < 0.5 ? 1 : 3]); n++; }
      }
    }

    // rdzawe płatki żelaza w trakcie utleniania oceanu
    if (E.o2 > 0.02 && E.o2 < 0.99) {
      this.acc.fe = (this.acc.fe || 0) + dt * 40;
      while (this.acc.fe >= 1) {
        this.acc.fe--;
        if (this.flakes.length < 700) this.flakes.push({ x: rand(0, this.w), y: rand(0, 700), vy: rand(6, 16), s: rand(0.8, 2), ph: Math.random() * TAU });
      }
    }
    for (const f of this.flakes) { f.y += f.vy * dt; f.x += Math.sin(this.time * 0.7 + f.ph) * 6 * dt; }
    this.flakes = this.flakes.filter(f => f.y < this.floorAt(f.x));
    const bands = Math.min(5, Math.floor(E.o2 * 5.2));
    while (E.bands < bands) this.paintIronBand(E.bands++);
  }

  // ---------- Rysowanie ----------

  drawBackground(ctx, view) {
    // Woda: jasna przy powierzchni, ciemna w głębinach
    // Ocean żelazisty (zielonkawy) z czasem staje się natleniony i błękitny
    const o = this.env.o2, ic = this.env.ice;
    const g = ctx.createLinearGradient(0, 0, 0, this.h);
    const stops = [
      [0, [58, 154, 154], [52, 138, 190]], [0.1, [29, 100, 116], [24, 92, 140]], [0.35, [16, 59, 84], [13, 52, 90]],
      [0.7, [10, 34, 54], [8, 30, 56]], [1, [5, 13, 23], [4, 11, 24]],
    ];
    for (const [t, a, b] of stops) g.addColorStop(t, rgb(mix3(mix3(a, b, o), [8, 24, 36], ic * 0.45 * (1 - t))));
    ctx.fillStyle = g;
    ctx.fillRect(0, -20, this.w, this.h + 20);
    this.sky.drawCaustics(ctx, view);

    // Promienie światła
    if (view.y0 < 1000) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const n = 16;
      for (let i = 0; i < n; i++) {
        const x = (i + 0.5) * this.w / n + Math.sin(this.time * 0.1 + i) * 80;
        if (x < view.x0 - 300 || x > view.x1 + 300) continue;
        const a = (0.035 + 0.025 * Math.sin(this.time * 0.4 + i * 1.7)) * (1 - ic * 0.85);
        const len = 950;
        const grad = ctx.createLinearGradient(0, 0, 0, len);
        grad.addColorStop(0, `rgba(190,255,235,${a})`);
        grad.addColorStop(1, 'rgba(190,255,235,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(x - 25, 0);
        ctx.lineTo(x + 35, 0);
        ctx.lineTo(x + 170, len);
        ctx.lineTo(x - 50, len);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
    if (this.cam) this.sky.drawAbove(ctx, view, this.cam);
  }

  drawSurface(ctx, view) {
    this.drawFlakes(ctx, view);
    this.sky.drawSurface(ctx, view);
  }

  // Roślinność lądowa zależna od epoki: 1 – mchy, wątrobowce, Cooksonia; 2 – paprocie, skrzypy, drzewa Archaeopteris
  drawLand(ctx, view) {
    if (!this.shelf || !this.env.flora) return;
    const t = this.time;
    for (const f of this.flora) {
      if (f.tier > this.env.flora || f.x < view.x0 - 120 || f.x > view.x1 + 120) continue;
      const y = this.floorAt(f.x) + 1, s = f.s;
      const sway = Math.sin(t * 0.8 + f.seed) * 0.05;
      ctx.lineCap = 'round';
      if (f.kind === 'moss') {
        ctx.fillStyle = 'rgba(70,110,45,0.95)';
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(f.x + (i - 1.5) * 3 * s, y - 1.5, 3 * s, 2.2 * s, 0, Math.PI, 0); ctx.fill(); }
      } else if (f.kind === 'cooksonia') {
        // rozwidlające się nagie łodyżki zakończone zarodniami
        ctx.strokeStyle = 'rgba(96,130,60,0.95)';
        ctx.lineWidth = 1.1;
        const h = 9 * s;
        ctx.beginPath(); ctx.moveTo(f.x, y); ctx.lineTo(f.x + sway * 20, y - h);
        ctx.moveTo(f.x + sway * 20, y - h); ctx.lineTo(f.x - 3 * s + sway * 30, y - h * 1.6);
        ctx.moveTo(f.x + sway * 20, y - h); ctx.lineTo(f.x + 3 * s + sway * 30, y - h * 1.6);
        ctx.stroke();
        ctx.fillStyle = 'rgba(150,120,60,1)';
        for (const d of [-3, 3]) { ctx.beginPath(); ctx.arc(f.x + d * s + sway * 30, y - h * 1.6 - 1, 1.6 * s, 0, TAU); ctx.fill(); }
      } else if (f.kind === 'fern') {
        ctx.strokeStyle = 'rgba(60,110,50,0.95)';
        ctx.lineWidth = 1.3;
        for (const dir of [-1, -0.4, 0.4, 1]) {
          const L = 22 * s;
          ctx.beginPath();
          ctx.moveTo(f.x, y);
          ctx.quadraticCurveTo(f.x + dir * L * 0.4, y - L, f.x + dir * L * 0.8 + sway * 30, y - L * 0.8);
          ctx.stroke();
        }
      } else if (f.kind === 'horsetail') {
        ctx.strokeStyle = 'rgba(90,120,60,0.95)';
        ctx.lineWidth = 2;
        const h = 34 * s;
        ctx.beginPath(); ctx.moveTo(f.x, y); ctx.lineTo(f.x + sway * 40, y - h); ctx.stroke();
        ctx.lineWidth = 0.8;
        for (let k = 1; k < 6; k++) {
          const yy = y - h * k / 6, xx = f.x + sway * 40 * k / 6;
          ctx.beginPath(); ctx.moveTo(xx - 6, yy + 3); ctx.lineTo(xx, yy); ctx.lineTo(xx + 6, yy + 3); ctx.stroke();
        }
      } else {
        // Archaeopteris – pierwsze prawdziwe drzewo (dewon)
        const h = 120 * s;
        const tg = ctx.createLinearGradient(f.x - 5, 0, f.x + 5, 0);
        tg.addColorStop(0, '#3e2f20'); tg.addColorStop(0.5, '#6a5236'); tg.addColorStop(1, '#2d2218');
        ctx.fillStyle = tg;
        ctx.beginPath(); ctx.moveTo(f.x - 6 * s, y); ctx.lineTo(f.x - 2.5 * s, y - h); ctx.lineTo(f.x + 2.5 * s, y - h); ctx.lineTo(f.x + 6 * s, y); ctx.fill();
        for (let k = 0; k < 6; k++) {
          const yy = y - h * (0.35 + k * 0.12), w = (40 - k * 5) * s;
          ctx.fillStyle = `rgba(${48 + k * 6},${92 + k * 6},${44},0.92)`;
          ctx.beginPath(); ctx.ellipse(f.x + sway * 60, yy, w, 9 * s, 0, 0, TAU); ctx.fill();
        }
      }
    }
  }

  drawFlakes(ctx, view) {
    if (!this.flakes.length) return;
    ctx.fillStyle = 'rgba(176,84,40,0.7)';
    for (const f of this.flakes) {
      if (f.x < view.x0 || f.x > view.x1 || f.y < view.y0 || f.y > view.y1) continue;
      ctx.fillRect(f.x, f.y, f.s, f.s * 0.7);
    }
  }

  // Dno i kominy – gotowy obraz z bufora, kopiowany tylko widoczny fragment
  drawFloor(ctx, view) {
    const T = this.terrain, S = T.scale;
    const x0 = Math.max(0, view.x0), x1 = Math.min(this.w, view.x1);
    const y0 = Math.max(T.top, view.y0), y1 = Math.min(this.h, view.y1);
    if (x1 <= x0 || y1 <= y0) return;
    const sx = x0 * S, sy = (y0 - T.top) * S;
    const sw = Math.min(T.canvas.width - sx, (x1 - x0) * S);
    const sh = Math.min(T.canvas.height - sy, (y1 - y0) * S);
    if (sw <= 0 || sh <= 0) return;
    ctx.drawImage(T.canvas, sx, sy, sw, sh, x0, y0, sw / S, sh / S);
  }

  drawVents(ctx, view) {
    // Ciepłe światło przy wylotach czarnych kominów
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const v of this.vents) {
      if (v.mx < view.x0 - 300 || v.mx > view.x1 + 300 || view.y1 < v.top - 300) continue;
      for (const m of v.mouths) {
        const flick = 0.8 + 0.2 * Math.sin(this.time * 9 + m.x) * Math.sin(this.time * 5.3 + m.y);
        if (v.type === 'black') {
          const R = m.main ? 110 : 55;
          const pool = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, R);
          pool.addColorStop(0, `rgba(255,120,45,${0.28 * flick})`);
          pool.addColorStop(0.35, `rgba(255,80,30,${0.08 * flick})`);
          pool.addColorStop(1, 'rgba(255,60,20,0)');
          ctx.fillStyle = pool;
          ctx.fillRect(m.x - R, m.y - R, R * 2, R * 2);
          const s = m.r * 5;
          ctx.globalAlpha = 0.8 * flick;
          ctx.drawImage(this.ember, m.x - s / 2, m.y - s / 2, s, s);
          ctx.globalAlpha = 1;
        } else {
          const R = m.main ? 90 : 45;
          const pool = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, R);
          pool.addColorStop(0, `rgba(170,255,230,${0.09 * flick})`);
          pool.addColorStop(1, 'rgba(170,255,230,0)');
          ctx.fillStyle = pool;
          ctx.fillRect(m.x - R, m.y - R, R * 2, R * 2);
        }
      }
    }
    ctx.restore();

    // Dym
    for (const s of this.smoke) {
      if (s.x + s.r < view.x0 || s.x - s.r > view.x1 || s.y + s.r < view.y0 || s.y - s.r > view.y1) continue;
      const u = s.age / s.life;
      const fadeIn = Math.min(1, s.age * 4);
      const size = s.r * 2.4;
      ctx.globalAlpha = s.dark ? 0.5 * Math.pow(1 - u, 1.2) * fadeIn : 0.2 * (1 - u) * fadeIn;
      ctx.drawImage(s.dark ? this.smokeDark : this.smokeLight, s.x - size / 2, s.y - size / 2, size, size);
    }
    // podświetlenie świeżego dymu od dołu
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const s of this.smoke) {
      if (!s.dark || s.age > 0.7) continue;
      if (s.x < view.x0 || s.x > view.x1 || s.y < view.y0 || s.y > view.y1) continue;
      const size = s.r * 2;
      ctx.globalAlpha = 0.25 * (1 - s.age / 0.7);
      ctx.drawImage(this.ember, s.x - size / 2, s.y - size / 2, size, size);
    }
    ctx.restore();
    ctx.globalAlpha = 1;

    ctx.strokeStyle = 'rgba(220,240,255,0.35)';
    ctx.lineWidth = 1;
    for (const b of this.bubbles) {
      if (b.x < view.x0 || b.x > view.x1 || b.y < view.y0 || b.y > view.y1) continue;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, TAU);
      ctx.stroke();
    }
  }

  drawParticles(ctx, view) {
    // maty (oliwkowe kępki sinic) i szczątki roślin – bez poświaty
    for (const p of this.particles) {
      const f = FOOD[p.type];
      if (!f.static || p.x < view.x0 - 20 || p.x > view.x1 + 20 || p.y < view.y0 - 20 || p.y > view.y1 + 20) continue;
      if (p.type === 'mat') {
        for (let i = 0; i < 5; i++) {
          const a = p.phase + i * 1.3;
          ctx.fillStyle = `rgba(${110 + i * 12},${140 + i * 8},${60 + i * 4},0.85)`;
          ctx.beginPath();
          ctx.ellipse(p.x + Math.cos(a) * 3, p.y - 1 - Math.abs(Math.sin(a)) * 2, 2.6, 1.6, 0, 0, TAU);
          ctx.fill();
        }
      } else {
        ctx.strokeStyle = 'rgba(120,92,52,0.95)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(p.x - 4, p.y + 1);
        ctx.lineTo(p.x + 4, p.y - 1);
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + 1 + Math.cos(p.phase) * 2, p.y - 4);
        ctx.stroke();
        ctx.fillStyle = 'rgba(90,110,50,0.8)';
        ctx.beginPath(); ctx.ellipse(p.x - 2, p.y - 1, 2, 1, p.phase, 0, TAU); ctx.fill();
      }
    }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.particles) {
      if (p.x < view.x0 - 20 || p.x > view.x1 + 20 || p.y < view.y0 - 20 || p.y > view.y1 + 20) continue;
      const f = FOOD[p.type];
      if (f.static) continue;
      const spr = this.sprites[p.type];
      let a = Math.min(1, p.age);
      if (f.life !== Infinity) a *= clamp((f.life - p.age) / 5, 0, 1);
      const sc = 0.85 + 0.15 * Math.sin(this.time * 3 + p.phase);
      const s = spr.width * sc;
      ctx.globalAlpha = a;
      ctx.drawImage(spr, p.x - s / 2, p.y - s / 2, s, s);
    }
    ctx.restore();

    // Lipidy jako małe pęcherzyki
    ctx.strokeStyle = 'rgba(255,240,200,0.7)';
    ctx.lineWidth = 1;
    for (const p of this.particles) {
      if (p.type !== 'lipid') continue;
      if (p.x < view.x0 - 20 || p.x > view.x1 + 20 || p.y < view.y0 - 20 || p.y > view.y1 + 20) continue;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, TAU);
      ctx.stroke();
    }
  }

  drawUVOverlay(ctx, view) {
    const k = 1 - 0.9 * this.env.ozone;
    if (view.y0 > UV_DEPTH || k < 0.03) return;
    const pulse = (0.16 + 0.04 * Math.sin(this.time * 2)) * k;
    const g = ctx.createLinearGradient(0, 0, 0, UV_DEPTH);
    g.addColorStop(0, `rgba(170,90,255,${pulse})`);
    g.addColorStop(1, 'rgba(170,90,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, UV_DEPTH);
  }

  // Drobiny w wodzie rysowane w przestrzeni ekranu (paralaksa daje głębię)
  drawSnow(ctx, cam, vw, vh) {
    const mod = (a, m) => ((a % m) + m) % m;
    ctx.fillStyle = '#cfe8ff';
    const surf = (0 - cam.y) * cam.zoom + vh / 2;   // linia wody na ekranie
    const shore = (this.waterEnd - cam.x) * cam.zoom + vw / 2;   // linia brzegu na ekranie
    for (const s of this.snow) {
      const x = mod(s.x * vw - cam.x * cam.zoom * s.f, vw);
      const y = mod(s.y * vh + this.time * 5 * s.s - cam.y * cam.zoom * s.f, vh);
      if (y < surf || x > shore) continue;
      ctx.globalAlpha = s.a;
      ctx.fillRect(x, y, s.s, s.s);
    }
    ctx.globalAlpha = 1;
  }

  // Statyczny obraz minimapy
  renderMinimapBase(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    const sx = w / this.w, sy = h / this.h;
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#2c7f86');
    grad.addColorStop(0.4, '#103b54');
    grad.addColorStop(1, '#050d17');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    g.fillStyle = `rgba(170,90,255,${0.35 * (1 - this.env.ozone)})`;
    g.fillRect(0, 0, w, UV_DEPTH * sy);
    const T = this.terrain;
    g.drawImage(T.canvas, 0, T.top * sy, w, (this.h - T.top) * sy);
    for (const v of this.vents) {
      const col = v.type === 'black' ? '255,150,60' : '190,255,235';
      const gl = g.createRadialGradient(v.mx * sx, v.top * sy, 0, v.mx * sx, v.top * sy, 12);
      gl.addColorStop(0, `rgba(${col},0.9)`);
      gl.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = gl;
      g.fillRect(v.mx * sx - 12, v.top * sy - 12, 24, 24);
    }
    return c;
  }
}
