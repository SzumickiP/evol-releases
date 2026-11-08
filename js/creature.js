// Organizmy wielokomórkowe (ery 7+): zwierzęta i rośliny jako jedno ciało.
// Klasa Creature ma ten sam interfejs co Cell, więc działa w tej samej pętli gry.
// Plan budowy (plan) decyduje o wyglądzie, ruchu i sposobie życia.

const PLANS = {
  // linia gracza
  disc:       { size: 20, speed: 70,  bottom: true },                       // Ediakar – jak Dickinsonia
  worm:       { size: 8,  speed: 115, bottom: true, segs: 13, gap: 0.85 },  // pierwszy dwubok
  arthropod:  { size: 10, speed: 120, bottom: true, segs: 9, gap: 1.05, walker: true, armor: 0.6 },
  fish:       { size: 15, speed: 175 },                                     // bezżuchwowiec pancerny
  jawfish:    { size: 17, speed: 215, hunter: true },                       // szczękowiec
  lobefish:   { size: 20, speed: 170, hunter: true },                       // mięśniopłetwy (Tiktaalik)
  chara:      { size: 18, speed: 50, plant: true },                         // ramienica
  landplant:  { size: 15, speed: 34, plant: true, walker: true },           // pierwsza roślina lądowa
  // podglądy wyborów
  pikaia:     { size: 12, speed: 140 },
  rayfish:    { size: 17, speed: 220 },
  jelly:      { size: 16, speed: 28 },
  orthocone:  { size: 26, speed: 120 },
  kelp:       { size: 22, speed: 0, plant: true },
  // inne organizmy
  charnia:    { size: 28, static: true },
  fungus:     { size: 13, static: true },
  trilobite:  { size: 9,  speed: 45, bottom: true },
  anomalocaris: { size: 30, speed: 150 },
  eurypterid: { size: 17, speed: 140, segs: 8, gap: 1.0 },
  smallfish:  { size: 8,  speed: 150 },
  dunkleosteus: { size: 40, speed: 160 },
  hyneria:    { size: 34, speed: 160 },
  millipede:  { size: 6,  speed: 60, bottom: true, segs: 11, gap: 1.0, walker: true },
};
const PREDATOR_PLANS = new Set(['anomalocaris', 'orthocone', 'eurypterid', 'dunkleosteus', 'hyneria']);

// Plan budowy rodu gracza na podstawie jego cech
function planFor(t) {
  if (t.charo) return 'landplant';
  if (t.alga) return 'chara';
  if (t.lobefin) return 'lobefish';
  if (t.jawed) return 'jawfish';
  if (t.chordate) return 'fish';
  if (t.arthro) return 'arthropod';
  if (t.bilat) return 'worm';
  return 'disc';
}

class Creature {
  constructor(x, y, o = {}) {
    this.creature = true;
    this.plan = o.plan || 'disc';
    this.P = PLANS[this.plan];
    this.x = x; this.y = y;
    this.vx = o.vx ?? 0; this.vy = o.vy ?? 0;
    this.biomass = o.biomass ?? 50;
    this.energy = o.energy ?? 80;
    this.health = 100;
    this.water = 100;     // wilgotność ciała (wysychanie na lądzie)
    this.breath = 100;    // zapas tlenu (skrzela nie działają w powietrzu)
    this.hue = o.hue ?? 0;
    this.isPlayer = !!o.isPlayer;
    this.lineage = o.lineage ?? 'player';
    this.traits = o.traits ?? {};
    this.generation = o.generation ?? 1;
    this.alive = true; this.eaten = false; this.age = 0;
    this.digest = []; this.flash = 0; this.hurt = 0; this.dmgRate = 0; this.moving = false;
    this.heading = o.heading ?? (Math.random() < 0.5 ? 0 : Math.PI);
    this.divideCooldown = 2; this.metaGain = 0; this.endo = 0;
    this.cheater = false; this.apop = 0; this.colony = false; this.slot = -1; this.role = '';
    this.powerMul = 1; this.lysing = 0; this.bond = 0; this.inMat = false;
    this.phase = Math.random() * TAU; this.seed = Math.random() * 100;
    this.ai = { tx: x, ty: y, timer: 0, prey: null };
    this.biteCd = 0; this.bite = 0;
    this.inWater = true; this.onGround = false;
    this.ghost = !!this.P.static;   // nie przepycha się z innymi
    this.noEat = this.P.plant || this.P.static || PREDATOR_PLANS.has(this.plan) || this.plan === 'jelly';
    this.segs = [];
    if (this.P.segs) {
      const R = this.radius;
      for (let i = 0; i < this.P.segs; i++) this.segs.push({ x: x - Math.cos(this.heading) * i * R * this.P.gap, y: y - Math.sin(this.heading) * i * R * this.P.gap });
    }
  }

  get radius() { return this.P.size * (0.75 + this.biomass / 100 * 0.5); }
  get canDivide() { return this.lineage === 'player' && this.biomass >= 100 && this.divideCooldown <= 0; }
  get heatLimit() { return 0.45; }
  get o2Resist() { return 1; }
  get canHunt() { return false; }
  foodMul() { return 1; }
  canEat() { return false; }
  eatCell() {}
  gulp() { this.flash = Math.min(1, this.flash + 0.4); }

  eat(p) {
    const f = FOOD[p.type];
    const m = this.P.hunter ? 0.6 : 1;   // drapieżne ryby – drobny pokarm to tylko dodatek
    this.energy = Math.min(100, this.energy + f.energy * m * 1.2);
    this.biomass = Math.min(100, this.biomass + f.biomass * m * 0.7);
    this.health = Math.min(100, this.health + f.health);
    this.flash = Math.min(1, this.flash + 0.3);
  }

  groundOff() {
    const R = this.radius;
    if (this.P.plant) return R * 0.15;
    if (this.plan === 'disc' || this.plan === 'trilobite') return R * 0.35;
    if (this.P.segs) return R * 0.55;
    return R * 0.5;
  }

  divide() {
    const d = new Creature(this.x - Math.cos(this.heading) * this.radius, this.y - 4, {
      plan: this.plan, biomass: 30, energy: 60, lineage: this.lineage, traits: { ...this.traits },
      generation: this.generation + 1, heading: this.heading, hue: this.hue,
    });
    if (this.P.plant) {   // zarodnik wyrasta kawałek dalej
      d.x = clamp(this.x + rand(-160, 160), 20, (typeof world !== 'undefined' ? world.w : 4000) - 20);
      d.y = this.y - 40;
    }
    this.biomass = 55;
    this.energy = Math.max(30, this.energy * 0.7);
    this.generation += 1;
    this.divideCooldown = d.divideCooldown = 4;
    return d;
  }

  update(dt, world, dir) {
    const P = this.P, tr = this.traits;
    this.age += dt; this.divideCooldown -= dt; this.biteCd -= dt;
    this.bite = Math.max(0, this.bite - dt * 3);
    this.flash = Math.max(0, this.flash - dt * 2);
    this.hurt = Math.max(0, this.hurt - dt * 1.2);
    this.phase += dt * (this.moving ? 8 : 3);
    if (P.static) { this.health = Math.min(100, this.health + dt * 5); return; }
    const R = this.radius;
    const wasWater = this.inWater;
    this.inWater = world.isWater ? world.isWater(this.x, this.y) : true;
    this.surfaced = wasWater && !this.inWater;

    const len = Math.hypot(dir[0], dir[1]);
    this.moving = len > 0.01;
    const m = Math.max(1, len);
    const dx = this.moving ? dir[0] / m : 0, dy = this.moving ? dir[1] / m : 0;
    const fl = world.floorAt(this.x);
    const off = this.groundOff();
    this.onGround = this.y >= fl - off - 2;

    if (this.inWater) {
      const sp = P.speed * this.powerMul;
      const [fx, fy] = world.flow(this.x, this.y);
      this.vx += (dx * sp * 2.2 + 2.2 * (fx * 0.3 - this.vx)) * dt;
      this.vy += (dy * sp * 2.2 + 2.2 * (fy * 0.3 - this.vy)) * dt;
      if (P.bottom && !this.moving) this.vy += 30 * dt;   // zwierzęta denne opadają na dno
    } else {
      this.vy += 650 * dt;   // grawitacja w powietrzu
      if (this.onGround) {
        const lobe = this.plan === 'lobefish';
        const walk = lobe ? (tr.limbs ? 95 : 32) : P.walker ? (P.plant ? 30 : 85) : 14;
        this.vx += (dx * walk - this.vx) * Math.min(1, dt * 6);
        // ryba bez kończyn na lądzie tylko podskakuje i trzepocze
        if (!P.walker && !lobe && this.moving && Math.random() < dt * 1.5) this.vy = -130;
      } else this.vx *= 1 - dt * 0.4;
    }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.x < R) { this.x = R; this.vx = Math.abs(this.vx) * 0.3; }
    if (this.x > world.w - R) { this.x = world.w - R; this.vx = -Math.abs(this.vx) * 0.3; }
    if (this.y < -470) { this.y = -470; this.vy = 0; }
    const fl2 = world.floorAt(this.x);
    if (this.y > fl2 - off) { this.y = fl2 - off; if (this.vy > 0) this.vy = 0; }

    // kierunek ciała: w wodzie wzdłuż ruchu, na ziemi – po pochyłości gruntu
    const spd = Math.hypot(this.vx, this.vy);
    if (!this.inWater && this.onGround) {
      const slope = Math.atan2(world.floorAt(this.x + 6) - world.floorAt(this.x - 6), 12);
      if (Math.abs(this.vx) > 3) this.heading = this.vx > 0 ? slope : Math.PI + slope;
    } else if (spd > 10) {
      let target = Math.atan2(this.vy, this.vx);
      if (P.bottom || this.plan === 'disc') target = Math.atan2(this.vy * 0.4, this.vx);   // denne trzymają się poziomo
      let d = target - this.heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.heading += d * Math.min(1, dt * 5);
    }

    // ciało z segmentów podąża za głową
    if (this.segs.length) {
      const gap = R * P.gap;
      this.segs[0].x = this.x; this.segs[0].y = this.y;
      for (let i = 1; i < this.segs.length; i++) {
        const a = this.segs[i - 1], b = this.segs[i];
        const ddx = b.x - a.x, ddy = b.y - a.y, d = Math.hypot(ddx, ddy) || 1;
        b.x = a.x + ddx / d * gap;
        b.y = a.y + ddy / d * gap;
        const f = world.floorAt(b.x) - off * 0.8;
        if (b.y > f) b.y = f;
      }
    }

    // metabolizm
    let meta = 0.3 + R * 0.012 + (this.moving ? 0.3 : 0);
    if (P.plant) {
      meta = 0.35;
      const light = this.inWater ? world.lightAt(this.y) : 1;
      let gain = light * (this.plan === 'landplant' ? 3.2 : 3.6);
      if (!this.inWater && tr.myco) gain += 1.2;   // grzyb dostarcza wodę i fosfor
      this.energy += gain * dt;
      this.metaGain += gain * dt;
    }
    this.energy -= meta * dt;

    // tlen i woda
    let dmg = 0;
    if (this.inWater) {
      this.water = Math.min(100, this.water + 30 * dt);
      this.breath = Math.min(100, this.breath + 40 * dt);
    } else {
      let dry = 10;
      if (P.plant) dry = tr.cuticle ? 0.8 : 7;
      else if (this.plan === 'arthropod' || this.plan === 'millipede') dry = tr.wax || this.lineage !== 'player' ? 0.8 : 6;
      else if (this.plan === 'lobefish') dry = tr.limbs ? 1.5 : 3.5;
      this.water = Math.max(0, this.water - dry * dt);
      const airBreath = P.plant || tr.tracheae || tr.lungs || this.lineage !== 'player';
      this.breath = Math.max(0, this.breath - (airBreath ? 0 : 13) * dt);
    }
    if (this.water <= 0) dmg += 8;
    if (this.breath <= 0) dmg += 10;
    const heat = world.heatAt(this.x, this.y);
    if (heat > 0.45) dmg += (heat - 0.45) / 0.55 * 25;
    if (this.energy <= 0) { this.energy = 0; dmg += 5; }
    this.dmgRate = dmg;
    if (dmg > 0) { this.health -= dmg * dt; this.hurt = Math.min(1, this.hurt + dmg * dt * 0.2); }
    else if (this.energy > 25 && this.health < 100) { this.health = Math.min(100, this.health + 4 * dt); this.energy -= 0.3 * dt; }
    if (this.energy > 60 && this.biomass < 100) { this.energy -= 1.6 * dt; this.biomass = Math.min(100, this.biomass + 1.1 * dt); }
    this.energy = clamp(this.energy, 0, 100);
    if (this.health <= 0) this.alive = false;
  }

  // ---------- Zachowanie organizmów bez gracza ----------
  aiDir(dt, world) {
    const ai = this.ai, P = this.P;
    if (P.static || this.plan === 'kelp') return [0, 0];
    ai.timer -= dt;
    const W = world.waterEnd;
    const go = (tx, ty, s = 0.8) => {
      const dx = tx - this.x, dy = ty - this.y, d = Math.hypot(dx, dy);
      return d < 8 ? [0, 0] : [dx / d * s, dy / d * s];
    };
    if (ai.prey && !ai.prey.alive) ai.prey = null;

    if (PREDATOR_PLANS.has(this.plan)) {
      if (ai.timer <= 0) {
        ai.timer = rand(0.5, 1.2);
        ai.prey = null;
        let bd = 520 * 520;
        for (const o of world.cells) {
          if (!o.alive || o.lineage !== 'player' || !o.inWater || !o.creature) continue;
          const d = (o.x - this.x) ** 2 + (o.y - this.y) ** 2;
          if (d < bd) { bd = d; ai.prey = o; }
        }
        if (!ai.prey) { ai.tx = clamp(this.x + rand(-500, 500), 100, W - 300); ai.ty = clamp(this.y + rand(-200, 200), 120, world.floorAt(ai.tx) - 60); }
      }
      if (ai.prey) return go(ai.prey.x, ai.prey.y, 1);
      return go(ai.tx, ai.ty, 0.55);
    }
    if (this.lineage === 'prey') {
      const pl = world.cells.find(c => c.isPlayer);
      if (pl && pl.inWater && Math.hypot(pl.x - this.x, pl.y - this.y) < 170) {
        const dx = this.x - pl.x, dy = this.y - pl.y, d = Math.hypot(dx, dy) || 1;
        return [dx / d, dy / d];   // ucieczka przed drapieżnikiem
      }
    }
    if (this.lineage === 'landprey') {
      if (ai.timer <= 0) { ai.timer = rand(1, 3); ai.tx = rand(W + 40, world.w - 40); ai.ty = world.floorAt(ai.tx) - 5; }
      return go(ai.tx, ai.ty, 0.6);
    }
    if (ai.timer <= 0) {
      ai.timer = rand(0.8, 1.8);
      let best = null, bd = 280 * 280;
      if (!this.noEat) {
        for (const p of world.particles) {
          if (P.bottom && p.type !== 'mat' && p.type !== 'detritus' && Math.random() < 0.5) continue;
          const d = (p.x - this.x) ** 2 + (p.y - this.y) ** 2;
          if (d < bd) { bd = d; best = p; }
        }
      }
      if (best) { ai.tx = best.x; ai.ty = best.y; }
      else if (P.plant && this.plan === 'landplant' && !this.inWater) { ai.tx = this.x; ai.ty = this.y; }
      else {
        ai.tx = clamp(this.x + rand(-300, 300), 60, W - 40);
        const fl = world.floorAt(ai.tx);
        ai.ty = P.bottom ? fl - 10 : P.plant ? rand(60, Math.min(500, fl - 40)) : clamp(this.y + rand(-200, 200), 60, fl - 40);
      }
    }
    return go(ai.tx, ai.ty, P.plant ? 0.5 : 0.75);
  }

  // ---------- Rysowanie ----------
  draw(ctx, t) {
    const fn = DRAW[this.plan];
    if (!fn) return;
    ctx.save();
    fn(ctx, this, t);
    ctx.restore();
    if (this.isPlayer) {
      const R = this.radius * (this.P.segs ? 1.6 : 1.9);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.arc(this.x, this.y, R + 6, t * 0.5, t * 0.5 + TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

// ---------- Pomocnicze ----------
const C3 = (c, k = 1, a = 1) => `rgba(${c[0] * k | 0},${c[1] * k | 0},${c[2] * k | 0},${a})`;

// Obrót do lokalnego układu: przód = +x, grzbiet = −y (lustrzane odbicie, gdy zwierzę płynie w lewo)
function toLocal(ctx, c) {
  ctx.translate(c.x, c.y);
  ctx.rotate(c.heading);
  if (Math.cos(c.heading) < 0) ctx.scale(1, -1);
}
function hurtTint(c, col) { return c.hurt > 0 ? mix3(col, [220, 60, 50], c.hurt * 0.6) : col; }

// Ryba w widoku z boku. o: kolory i cechy budowy
function drawFish(ctx, c, t, o) {
  toLocal(ctx, c);
  const R = c.radius, L = R * (o.len || 2.6), H = R * (o.h || 0.55);
  const N = 18, top = [], bot = [];
  const swim = c.moving ? 1 : 0.4;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const x = (u - 0.5) * L;
    const yw = Math.sin(c.phase - u * 5) * L * 0.05 * Math.pow(1 - u, 1.6) * swim;
    let hh = H * Math.pow(Math.sin(Math.PI * clamp(u * 0.9 + 0.06, 0, 1)), 0.7) * (0.4 + 0.6 * Math.min(1, u * 1.4));
    if (o.flatHead && u > 0.75) hh *= 0.82;
    top.push([x, yw - hh]);
    bot.push([x, yw + hh * (o.belly || 0.9)]);
  }
  const tail = [(-0.5) * L, Math.sin(c.phase) * L * 0.05 * swim];
  const col1 = hurtTint(c, o.dorsal), col2 = o.ventral;

  // płetwa ogonowa (heterocerkiczna – górny płat dłuższy, jak u ryb paleozoicznych)
  ctx.fillStyle = C3(col1, 0.85, 0.9);
  ctx.beginPath();
  ctx.moveTo(tail[0] + L * 0.04, tail[1]);
  ctx.lineTo(tail[0] - L * (o.tailLen || 0.26), tail[1] - H * 1.25 + Math.sin(c.phase) * H * 0.3);
  ctx.quadraticCurveTo(tail[0] - L * 0.1, tail[1], tail[0] - L * 0.18, tail[1] + H * 0.85 + Math.sin(c.phase) * H * 0.3);
  ctx.closePath();
  ctx.fill();
  if (o.rays) {
    ctx.strokeStyle = C3(col1, 0.6, 0.5); ctx.lineWidth = 0.6;
    for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(tail[0], tail[1]); ctx.lineTo(tail[0] - L * 0.2, tail[1] - H * 1.1 + k * H * 0.38); ctx.stroke(); }
  }

  // płetwy grzbietowe i odbytowa
  if (o.dorsalFin) {
    ctx.fillStyle = C3(col1, 0.8, 0.85);
    for (const [u0, s] of o.dorsalFin) {
      const i = Math.round(u0 * N), p = top[i];
      ctx.beginPath();
      ctx.moveTo(p[0] + L * 0.06, p[1] + 1);
      ctx.lineTo(p[0] - L * 0.02, p[1] - H * s);
      ctx.lineTo(p[0] - L * 0.08, p[1] + 1);
      ctx.fill();
      if (o.spines) { ctx.strokeStyle = 'rgba(230,220,200,0.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p[0] + L * 0.05, p[1]); ctx.lineTo(p[0] - L * 0.02, p[1] - H * s * 1.05); ctx.stroke(); }
    }
  }
  // kończyny / płetwy parzyste po dalszej stronie ciała
  const limb = (u, front, far) => {
    const i = Math.round(u * N), p = bot[i];
    const a = c.onGround && !c.inWater ? Math.sin(c.phase * 1.2 + (front ? 0 : Math.PI) + (far ? Math.PI : 0)) * 0.6 : Math.sin(c.phase * 0.8 + (far ? 1 : 0)) * 0.25;
    ctx.save();
    ctx.translate(p[0], p[1] - H * 0.15);
    ctx.globalAlpha = far ? 0.6 : 1;
    if (o.limbs) {
      // kończyna z łokciem i palcami (jak u Acanthostega)
      const l1 = R * 0.55, l2 = R * 0.5;
      const k1 = [Math.sin(a) * l1, Math.cos(a) * l1 * 0.9];
      const k2 = [k1[0] + Math.sin(a * 0.5 + 0.4) * l2, k1[1] + Math.cos(a * 0.5) * l2 * 0.8];
      ctx.strokeStyle = C3(col1, 0.85); ctx.lineCap = 'round';
      ctx.lineWidth = R * 0.22; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(k1[0], k1[1]); ctx.lineTo(k2[0], k2[1]); ctx.stroke();
      ctx.lineWidth = R * 0.06;
      for (let d = -2; d <= 2; d++) { ctx.beginPath(); ctx.moveTo(k2[0], k2[1]); ctx.lineTo(k2[0] + R * 0.18 + d * R * 0.02, k2[1] + d * R * 0.05); ctx.stroke(); }
    } else if (o.lobes) {
      // mięsista płetwa z kośćmi i obrzeżem z promieni
      ctx.rotate(0.6 + a);
      ctx.fillStyle = C3(col1, 0.9);
      ctx.beginPath(); ctx.ellipse(R * 0.32, 0, R * 0.38, R * 0.13, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = C3(col2, 0.9, 0.7);
      ctx.beginPath(); ctx.moveTo(R * 0.55, -R * 0.12); ctx.lineTo(R * 0.95, 0); ctx.lineTo(R * 0.55, R * 0.12); ctx.fill();
    } else {
      ctx.rotate(0.9 + a);
      ctx.fillStyle = C3(col1, 0.8, 0.8);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(R * 0.6, -R * 0.08); ctx.lineTo(R * 0.45, R * 0.18); ctx.fill();
      if (o.spines) { ctx.strokeStyle = 'rgba(230,220,200,0.8)'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(R * 0.62, -R * 0.1); ctx.stroke(); }
    }
    ctx.restore();
  };
  if (o.paired) { limb(0.78, true, true); limb(0.38, false, true); }

  // ciało
  const body = new Path2D();
  body.moveTo(top[0][0], top[0][1]);
  for (const p of top) body.lineTo(p[0], p[1]);
  const nose = top[N];
  body.quadraticCurveTo(nose[0] + L * 0.07, (nose[1] + bot[N][1]) / 2, bot[N][0], bot[N][1]);
  for (let i = N; i >= 0; i--) body.lineTo(bot[i][0], bot[i][1]);
  body.closePath();
  const g = ctx.createLinearGradient(0, -H, 0, H);
  g.addColorStop(0, C3(col1, 0.8));
  g.addColorStop(0.45, C3(col1));
  g.addColorStop(1, C3(col2));
  ctx.fillStyle = g;
  ctx.fill(body);
  ctx.save();
  ctx.clip(body);
  // łuski / miomery
  ctx.strokeStyle = o.myomeres ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.13)';
  ctx.lineWidth = 0.7;
  for (let x = -L * 0.5; x < L * 0.5; x += R * (o.myomeres ? 0.22 : 0.18)) {
    ctx.beginPath();
    if (o.myomeres) { ctx.moveTo(x, -H); ctx.lineTo(x + R * 0.12, 0); ctx.lineTo(x, H); }
    else { ctx.moveTo(x, -H); ctx.lineTo(x + H, H); ctx.moveTo(x + H, -H); ctx.lineTo(x, H); }
    ctx.stroke();
  }
  // pancerz głowy z guzkami
  if (o.armor) {
    const a0 = (o.armor - 0.5) * L;
    ctx.fillStyle = C3(o.armorCol || [150, 140, 120], 1, 0.9);
    ctx.beginPath(); ctx.rect(a0, -H * 1.2, L, H * 2.4); ctx.fill();
    ctx.fillStyle = 'rgba(255,245,220,0.25)';
    for (let k = 0; k < 30; k++) { const xx = a0 + (k * 37 % 100) / 100 * (L * 0.5 - a0) , yy = ((k * 53) % 100 / 100 - 0.5) * H * 1.6; ctx.beginPath(); ctx.arc(xx, yy, R * 0.035, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = 'rgba(40,30,20,0.5)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(a0, -H * 1.2); ctx.lineTo(a0, H * 1.2); ctx.moveTo(a0 + (L * 0.5 - a0) * 0.5, -H); ctx.lineTo(a0 + (L * 0.5 - a0) * 0.45, H); ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = C3(col1, 0.5, 0.8);
  ctx.lineWidth = 1;
  ctx.stroke(body);

  // skrzela
  const hx = L * 0.5;
  if (o.gillRow) {
    ctx.fillStyle = 'rgba(30,20,20,0.7)';
    for (let k = 0; k < 7; k++) { ctx.beginPath(); ctx.arc(hx - L * (0.17 + k * 0.03), H * 0.15, R * 0.035, 0, TAU); ctx.fill(); }
  } else if (o.jaws) {
    ctx.strokeStyle = 'rgba(30,25,20,0.55)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(hx - L * 0.2, 0, H * 0.7, -1.1, 1.1); ctx.stroke();
  }
  // pysk i szczęki
  const mo = c.bite * 0.5;
  if (o.jaws) {
    ctx.fillStyle = 'rgba(40,10,10,0.85)';
    ctx.beginPath(); ctx.moveTo(hx + L * 0.05, H * 0.1); ctx.lineTo(hx - L * 0.1, H * 0.2); ctx.lineTo(hx + L * 0.05, H * (0.1 + mo)); ctx.fill();
    ctx.strokeStyle = 'rgba(30,20,15,0.8)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(hx + L * 0.06, H * 0.1); ctx.lineTo(hx - L * 0.11, H * 0.22); ctx.stroke();
    if (o.blades) { ctx.fillStyle = '#e8e2d0'; ctx.beginPath(); ctx.moveTo(hx + L * 0.06, H * 0.05); ctx.lineTo(hx + L * 0.01, H * 0.32); ctx.lineTo(hx - L * 0.02, H * 0.08); ctx.fill(); }
  } else {
    ctx.fillStyle = 'rgba(40,20,20,0.8)';
    ctx.beginPath(); ctx.arc(hx + L * 0.03, H * 0.25, R * 0.05, 0, TAU); ctx.fill();
  }
  // oko (u ryb mięśniopłetwych wysoko na płaskiej głowie)
  const ey = o.flatHead ? -H * 0.55 : -H * 0.25;
  ctx.fillStyle = '#f2ead0';
  ctx.beginPath(); ctx.arc(hx - L * 0.07, ey, R * (o.eye || 0.11), 0, TAU); ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(hx - L * 0.06, ey, R * (o.eye || 0.11) * 0.6, 0, TAU); ctx.fill();

  if (o.paired) { limb(0.78, true, false); limb(0.38, false, false); }
}

// Ciało z segmentów (robak, stawonóg, wije) – rysowane w układzie świata
function segNormal(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y, d = Math.hypot(dx, dy) || 1;
  let nx = -dy / d, ny = dx / d;
  if (ny < 0) { nx = -nx; ny = -ny; }   // „dół” ciała zawsze w stronę gruntu
  return [nx, ny, dx / d, dy / d];
}

const DRAW = {
  // Dickinsonia – owalne ciało z pikowanymi segmentami, widziane lekko z góry
  disc(ctx, c, t) {
    const R = c.radius, col = hurtTint(c, c.lineage === 'player' ? [196, 160, 110] : [176, 150, 120]);
    ctx.translate(c.x, c.y);
    ctx.rotate(Math.cos(c.heading) < 0 ? 0 : 0);
    const rx = R * 1.35, ry = R * 0.55;
    const g = ctx.createRadialGradient(-rx * 0.2, -ry * 0.3, 1, 0, 0, rx);
    g.addColorStop(0, C3(col, 1.15, 0.95)); g.addColorStop(1, C3(col, 0.75, 0.9));
    ctx.fillStyle = g;
    ctx.beginPath();
    for (let i = 0; i <= 40; i++) {
      const a = i / 40 * TAU, w = 1 + 0.04 * Math.sin(a * 8 + c.phase);
      const px = Math.cos(a) * rx * w, py = Math.sin(a) * ry * w;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.fill();
    ctx.strokeStyle = C3(col, 0.55, 0.8); ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(-rx * 0.95, 0); ctx.lineTo(rx * 0.95, 0); ctx.stroke();
    for (let k = -9; k <= 9; k++) {
      const x = k / 10 * rx, h = ry * Math.sqrt(Math.max(0, 1 - (x / rx) ** 2));
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.quadraticCurveTo(x + R * 0.08, -h * 0.5, x + R * 0.04, -h * 0.98);
      ctx.moveTo(x, 0); ctx.quadraticCurveTo(x - R * 0.08, h * 0.5, x - R * 0.04, h * 0.98); ctx.stroke();
    }
    ctx.strokeStyle = C3(col, 0.5, 0.9); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.stroke();
  },

  // Robak dwubocznie symetryczny: głowa, pierścienie, przewód pokarmowy, oczy (po Erze 8)
  worm(ctx, c, t) {
    const R = c.radius, s = c.segs, col = hurtTint(c, [214, 140, 130]);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let pass = 0; pass < 2; pass++) {
      ctx.strokeStyle = pass ? C3(col, 1.05) : C3(col, 0.6);
      for (let i = s.length - 1; i > 0; i--) {
        const w = R * (pass ? 1.5 : 1.75) * (1 - i / s.length * 0.55);
        ctx.lineWidth = w;
        ctx.beginPath(); ctx.moveTo(s[i].x, s[i].y); ctx.lineTo(s[i - 1].x, s[i - 1].y); ctx.stroke();
      }
    }
    // przewód pokarmowy przez całe ciało
    ctx.strokeStyle = 'rgba(120,70,50,0.5)'; ctx.lineWidth = R * 0.3;
    ctx.beginPath(); s.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
    ctx.strokeStyle = C3(col, 0.7, 0.7); ctx.lineWidth = 0.8;
    for (let i = 1; i < s.length; i++) {
      const [nx, ny] = segNormal(s[i - 1], s[i]), w = R * 0.8 * (1 - i / s.length * 0.55);
      ctx.beginPath(); ctx.moveTo(s[i].x - nx * w, s[i].y - ny * w); ctx.lineTo(s[i].x + nx * w, s[i].y + ny * w); ctx.stroke();
    }
    const [nx, ny, fx, fy] = segNormal(s[0], s[1]);
    ctx.fillStyle = C3(col, 1.1);
    ctx.beginPath(); ctx.arc(s[0].x + fx * R * 0.3, s[0].y + fy * R * 0.3, R * 0.85, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(70,20,20,0.8)';
    ctx.beginPath(); ctx.arc(s[0].x + fx * R * 0.95, s[0].y + fy * R * 0.95 + ny * R * 0.2, R * 0.22, 0, TAU); ctx.fill();
    if (c.traits.eyes) {
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.arc(s[0].x + fx * R * 0.5 - nx * R * 0.45, s[0].y + fy * R * 0.5 - ny * R * 0.45, R * 0.2, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath(); ctx.arc(s[0].x + fx * R * 0.55 - nx * R * 0.5, s[0].y + fy * R * 0.55 - ny * R * 0.5, R * 0.07, 0, TAU); ctx.fill();
    }
  },

  // Stawonóg: chitynowe tergity, członowane odnóża, czułki, oko złożone
  arthropod(ctx, c, t, o = {}) {
    const R = c.radius, s = c.segs;
    const col = hurtTint(c, o.col || [138, 92, 54]);
    const legs = (far) => {
      ctx.strokeStyle = C3(col, far ? 0.5 : 0.75); ctx.lineWidth = Math.max(1, R * 0.13); ctx.lineCap = 'round';
      for (let i = 1; i < s.length - 1; i++) {
        const [nx, ny, fx, fy] = segNormal(s[i - 1], s[i]);
        const ph = c.phase * 1.6 + i * 0.9 + (far ? Math.PI : 0);
        const sw = (c.moving ? Math.sin(ph) : 0) * R * 0.35;
        const bx = s[i].x + nx * R * 0.3, by = s[i].y + ny * R * 0.3;
        const kx = bx + nx * R * 0.55 + fx * (sw + R * 0.15), ky = by + ny * R * 0.55 + fy * (sw + R * 0.15);
        const ex = kx + nx * R * 0.55 + fx * sw * 0.5, ey = ky + ny * R * 0.55 + fy * sw * 0.5;
        if (o.paddle && i === 3) {
          ctx.fillStyle = C3(col, 0.8, 0.9);
          ctx.beginPath(); ctx.ellipse(ex, ey, R * 0.6, R * 0.25, Math.atan2(fy, fx), 0, TAU); ctx.fill();
          continue;
        }
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(kx, ky); ctx.lineTo(ex, ey); ctx.stroke();
      }
    };
    legs(true);
    for (let i = s.length - 1; i >= 0; i--) {
      const a = s[i], b = s[Math.min(s.length - 1, i + 1)], p = s[Math.max(0, i - 1)];
      const ang = Math.atan2(p.y - b.y, p.x - b.x);
      const sc = (i === 0 ? 1.15 : 1) * (1 - i / s.length * (o.taper ?? 0.35));
      ctx.save();
      ctx.translate(a.x, a.y); ctx.rotate(ang);
      if (Math.cos(ang) < 0) ctx.scale(1, -1);
      const g = ctx.createLinearGradient(0, -R * 0.7 * sc, 0, R * 0.5 * sc);
      g.addColorStop(0, C3(col, 1.25)); g.addColorStop(0.5, C3(col)); g.addColorStop(1, C3(col, 0.55));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(0, -R * 0.08, R * 0.62 * sc * (o.wide || 1), R * 0.55 * sc, 0, Math.PI * 0.98, Math.PI * 2.02); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = C3(col, 0.45); ctx.lineWidth = 0.9; ctx.stroke();
      ctx.restore();
    }
    legs(false);
    const [nx, ny, fx, fy] = segNormal(s[0], s[1]);
    const hx = s[0].x + fx * R * 0.5, hy = s[0].y + fy * R * 0.5;
    // czułki
    ctx.strokeStyle = C3(col, 0.8); ctx.lineWidth = 0.9;
    for (const k of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(hx, hy - ny * R * 0.2);
      ctx.quadraticCurveTo(hx + fx * R * 1.2 - nx * R * (0.6 + k * 0.2), hy + fy * R * 1.2 - ny * R * (0.6 + k * 0.2),
        hx + fx * R * (1.8 + Math.sin(c.phase + k) * 0.2) - nx * R * (0.2 + k * 0.4), hy + fy * R * 1.8 - ny * R * (0.2 + k * 0.4));
      ctx.stroke();
    }
    if (o.telson) {
      const e = s[s.length - 1], [, , bfx, bfy] = segNormal(s[s.length - 2], e);
      ctx.strokeStyle = C3(col, 0.7); ctx.lineWidth = R * 0.2;
      ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x - bfx * R * 1.4, e.y - bfy * R * 1.4); ctx.stroke();
    }
    // oko złożone
    ctx.fillStyle = '#1a1410';
    ctx.beginPath(); ctx.arc(hx - nx * R * 0.25, hy - ny * R * 0.25, R * 0.17, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.arc(hx - nx * R * 0.3 + fx, hy - ny * R * 0.3, R * 0.05, 0, TAU); ctx.fill();
  },
  millipede(ctx, c, t) { DRAW.arthropod(ctx, c, t, { col: [80, 52, 40], taper: 0.1 }); },
  eurypterid(ctx, c, t) { DRAW.arthropod(ctx, c, t, { col: [92, 84, 58], paddle: true, telson: true, wide: 1.2, taper: 0.55 }); },

  // Trylobit – kopułka z trzema płatami, kolce policzkowe, odnóża pod spodem
  trilobite(ctx, c, t) {
    toLocal(ctx, c);
    const R = c.radius, col = hurtTint(c, [120, 104, 88]);
    ctx.strokeStyle = C3(col, 0.6); ctx.lineWidth = 0.8;
    for (let k = -3; k <= 3; k++) { const sw = Math.sin(c.phase * 2 + k) * R * 0.15; ctx.beginPath(); ctx.moveTo(k * R * 0.25, 0); ctx.lineTo(k * R * 0.25 + sw, R * 0.45); ctx.stroke(); }
    const g = ctx.createLinearGradient(0, -R * 0.6, 0, R * 0.2);
    g.addColorStop(0, C3(col, 1.3)); g.addColorStop(1, C3(col, 0.7));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(0, 0, R * 1.1, R * 0.6, 0, Math.PI, TAU); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = C3(col, 0.5);
    for (let k = -4; k <= 3; k++) { ctx.beginPath(); ctx.moveTo(k * R * 0.22, 0); ctx.lineTo(k * R * 0.22, -R * 0.55 * Math.sqrt(Math.max(0, 1 - (k * 0.22 / 1.1) ** 2))); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(R * 0.8, -R * 0.1); ctx.lineTo(R * 0.4, R * 0.25); ctx.stroke();   // kolec policzkowy
    ctx.fillStyle = '#1a1410'; ctx.beginPath(); ctx.arc(R * 0.72, -R * 0.32, R * 0.12, 0, TAU); ctx.fill();
  },

  fish(ctx, c, t) {
    drawFish(ctx, c, t, { dorsal: [120, 112, 96], ventral: [200, 190, 160], armor: 0.68, armorCol: [140, 128, 104], gillRow: true, eye: 0.1 });
  },
  pikaia(ctx, c, t) {
    drawFish(ctx, c, t, { dorsal: [200, 160, 140], ventral: [230, 200, 180], len: 3.3, h: 0.32, myomeres: true, tailLen: 0.12, eye: 0.05 });
  },
  smallfish(ctx, c, t) {
    drawFish(ctx, c, t, { dorsal: [96, 112, 120], ventral: [200, 210, 210], armor: 0.7, armorCol: [110, 120, 124], gillRow: true });
  },
  jawfish(ctx, c, t) {
    drawFish(ctx, c, t, { dorsal: [70, 104, 96], ventral: [200, 214, 196], jaws: true, paired: true, spines: true, dorsalFin: [[0.6, 0.9], [0.32, 0.7]] });
  },
  rayfish(ctx, c, t) {
    drawFish(ctx, c, t, { dorsal: [64, 96, 130], ventral: [220, 228, 232], jaws: true, paired: true, rays: true, dorsalFin: [[0.5, 1.1]] });
  },
  lobefish(ctx, c, t) {
    const limbs = !!c.traits.limbs;
    drawFish(ctx, c, t, { dorsal: [98, 104, 64], ventral: [196, 188, 140], jaws: true, paired: true, lobes: !limbs, limbs, flatHead: true,
      h: 0.48, len: 2.8, dorsalFin: [[0.3, 0.6]], eye: 0.1 });
  },
  dunkleosteus(ctx, c, t) {
    drawFish(ctx, c, t, { dorsal: [60, 62, 66], ventral: [150, 150, 140], jaws: true, blades: true, armor: 0.7, armorCol: [88, 84, 78], paired: true, h: 0.6 });
  },
  hyneria(ctx, c, t) {
    drawFish(ctx, c, t, { dorsal: [64, 74, 50], ventral: [150, 150, 110], jaws: true, paired: true, lobes: true, flatHead: true, dorsalFin: [[0.3, 0.6]] });
  },

  // Anomalokarys – szczypce z kolcami, oczy na słupkach, płaty pływne wzdłuż boków
  anomalocaris(ctx, c, t) {
    toLocal(ctx, c);
    const R = c.radius, col = hurtTint(c, [170, 92, 70]);
    const L = R * 2.4;
    ctx.fillStyle = C3(col, 0.8, 0.85);
    for (let k = 0; k < 11; k++) {
      const x = L * 0.4 - k * L * 0.075, w = Math.sin(c.phase * 1.5 - k * 0.7) * R * 0.18;
      ctx.beginPath(); ctx.ellipse(x, R * 0.28 + w, R * 0.24, R * 0.12, 0.3, 0, TAU); ctx.fill();
    }
    const g = ctx.createLinearGradient(0, -R * 0.4, 0, R * 0.3);
    g.addColorStop(0, C3(col, 1.15)); g.addColorStop(1, C3(col, 0.65));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(0, 0, L * 0.5, R * 0.33, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = C3(col, 0.5); ctx.lineWidth = 0.8;
    for (let k = 1; k < 10; k++) { const x = L * 0.45 - k * L * 0.09; ctx.beginPath(); ctx.moveTo(x, -R * 0.3); ctx.lineTo(x, R * 0.3); ctx.stroke(); }
    // ogon w kształcie wachlarza
    ctx.fillStyle = C3(col, 0.8, 0.8);
    for (const a of [-0.5, 0, 0.5]) { ctx.save(); ctx.translate(-L * 0.5, 0); ctx.rotate(Math.PI + a); ctx.beginPath(); ctx.ellipse(R * 0.35, 0, R * 0.4, R * 0.1, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    // przednie odnóża chwytne
    const grab = 0.4 + Math.sin(c.phase * 0.7) * 0.25 + c.bite;
    ctx.strokeStyle = C3(col, 0.9); ctx.lineWidth = R * 0.12; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(L * 0.48, R * 0.1);
    let px = L * 0.48, py = R * 0.1;
    for (let k = 1; k <= 8; k++) {
      const a = -0.2 + k * grab * 0.32;
      px += Math.cos(a) * R * 0.17; py += Math.sin(a) * R * 0.17;
      ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.fillStyle = '#1a1010';
    for (const dy of [-1, 1]) {
      ctx.strokeStyle = C3(col, 0.7); ctx.lineWidth = R * 0.06;
      ctx.beginPath(); ctx.moveTo(L * 0.4, -R * 0.25); ctx.lineTo(L * 0.42 + dy * R * 0.05, -R * 0.55); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(L * 0.42 + dy * R * 0.05, -R * 0.6, R * 0.12, R * 0.08, 0, 0, TAU); ctx.fill();
    }
  },

  // Głowonóg z prostą stożkową muszlą (ortoceras / Cameroceras)
  orthocone(ctx, c, t) {
    toLocal(ctx, c);
    const R = c.radius, L = R * 3.4, col = hurtTint(c, [210, 190, 160]);
    ctx.strokeStyle = 'rgba(200,150,130,0.85)'; ctx.lineWidth = R * 0.07; ctx.lineCap = 'round';
    for (let k = 0; k < 8; k++) {
      const ang = -0.5 + k * 0.14, w = Math.sin(c.phase + k) * 0.2;
      ctx.beginPath(); ctx.moveTo(L * 0.42, 0);
      ctx.quadraticCurveTo(L * 0.55, Math.sin(ang) * R * 0.6, L * 0.6 + Math.cos(ang + w) * R * 0.8, Math.sin(ang + w) * R * 0.9);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(200,150,130,0.95)';
    ctx.beginPath(); ctx.ellipse(L * 0.42, 0, R * 0.35, R * 0.38, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(L * 0.45, -R * 0.12, R * 0.09, 0, TAU); ctx.fill();
    const shell = new Path2D();
    shell.moveTo(L * 0.38, -R * 0.42); shell.lineTo(-L * 0.6, -R * 0.06); shell.lineTo(-L * 0.6, R * 0.06); shell.lineTo(L * 0.38, R * 0.42); shell.closePath();
    const g = ctx.createLinearGradient(0, -R * 0.4, 0, R * 0.4);
    g.addColorStop(0, C3(col, 1.1)); g.addColorStop(1, C3(col, 0.7));
    ctx.fillStyle = g; ctx.fill(shell);
    ctx.save(); ctx.clip(shell);
    ctx.fillStyle = 'rgba(120,60,40,0.45)';
    for (let x = -L * 0.6; x < L * 0.4; x += R * 0.45) ctx.fillRect(x, -R, R * 0.18, R * 2);
    ctx.strokeStyle = 'rgba(80,60,40,0.35)'; ctx.lineWidth = 0.7;
    for (let x = -L * 0.6; x < L * 0.38; x += R * 0.22) { ctx.beginPath(); ctx.moveTo(x, -R); ctx.quadraticCurveTo(x + R * 0.08, 0, x, R); ctx.stroke(); }
    ctx.restore();
  },

  // Meduza – pulsujący dzwon i parzydełkowe czułki
  jelly(ctx, c, t) {
    ctx.translate(c.x, c.y);
    const R = c.radius, p = 1 + Math.sin(c.phase * 0.8) * 0.12;
    ctx.strokeStyle = 'rgba(220,200,255,0.45)'; ctx.lineWidth = 0.8;
    for (let k = -4; k <= 4; k++) {
      ctx.beginPath(); ctx.moveTo(k * R * 0.2 * p, 0);
      for (let s = 1; s <= 8; s++) ctx.lineTo(k * R * 0.2 * p + Math.sin(c.phase + s * 0.6 + k) * R * 0.12, s * R * 0.32);
      ctx.stroke();
    }
    const g = ctx.createRadialGradient(0, -R * 0.4, 1, 0, -R * 0.2, R * 1.2);
    g.addColorStop(0, 'rgba(240,220,255,0.6)'); g.addColorStop(1, 'rgba(180,150,240,0.25)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(0, 0, R * p, R * 0.8 / p, 0, Math.PI, TAU); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,230,255,0.6)'; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,180,220,0.5)';
    for (const k of [-0.4, 0, 0.4]) { ctx.beginPath(); ctx.ellipse(k * R, -R * 0.3, R * 0.15, R * 0.1, 0, 0, TAU); ctx.stroke(); }
  },

  // Charnia – liść na trzonku z tarczą czepną (fauna ediakarańska)
  charnia(ctx, c, t) {
    const R = c.radius, sway = Math.sin(t * 0.6 + c.seed) * 0.08;
    ctx.translate(c.x, c.y + R * 0.15);
    ctx.fillStyle = 'rgba(150,120,90,0.9)';
    ctx.beginPath(); ctx.ellipse(0, 0, R * 0.35, R * 0.12, 0, 0, TAU); ctx.fill();
    ctx.rotate(sway);
    const H = R * 3;
    ctx.strokeStyle = 'rgba(160,130,95,0.95)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -H); ctx.stroke();
    ctx.lineWidth = 1;
    for (let k = 2; k < 22; k++) {
      const y = -H * k / 22, w = R * 0.55 * Math.sin(Math.PI * k / 22);
      ctx.strokeStyle = `rgba(${170 + k * 2},${140 + k},${100},0.9)`;
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0, y); ctx.quadraticCurveTo(s * w * 0.6, y - R * 0.05, s * w, y - R * 0.22); ctx.stroke(); }
    }
  },

  // Grzyb na lądzie – sieć strzępek z zarodnikami
  fungus(ctx, c, t) {
    const R = c.radius;
    ctx.translate(c.x, c.y + R * 0.1);
    ctx.strokeStyle = c.bonded ? 'rgba(255,240,170,0.8)' : 'rgba(235,230,215,0.65)'; ctx.lineWidth = 0.7;
    for (let k = 0; k < 9; k++) {
      const a = Math.PI + k / 8 * Math.PI;
      ctx.beginPath(); ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(Math.cos(a) * R * 0.6, Math.sin(a) * R * 0.3 + 2, Math.cos(a) * R * 1.4, Math.sin(a) * R * 0.25 + 3);
      ctx.stroke();
    }
    ctx.fillStyle = c.bonded ? '#f2e2a0' : '#e8e0cc';
    for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.arc(Math.cos(k * 1.7) * R * 0.6, -Math.abs(Math.sin(k * 1.3)) * R * 0.25, R * 0.12, 0, TAU); ctx.fill(); }
  },

  // Ramienica – oś z okółkami gałązek (najbliższy krewny roślin lądowych)
  chara(ctx, c, t) { drawWhorled(ctx, c, t, [70, 150, 70], false); },
  kelp(ctx, c, t) { drawWhorled(ctx, c, t, [120, 100, 40], true); },

  // Pierwsza roślina lądowa: płaska plecha przy ziemi + łodyżki z zarodniami (jak Cooksonia)
  landplant(ctx, c, t) {
    const R = c.radius, col = hurtTint(c, [80, 140, 60]);
    ctx.translate(c.x, c.y + R * 0.1);
    ctx.fillStyle = C3(col, 0.9);
    for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.ellipse(k * R * 0.35, 0, R * 0.45, R * 0.14, k * 0.15, Math.PI, TAU); ctx.fill(); }
    if (c.traits.cuticle) { ctx.strokeStyle = 'rgba(220,240,180,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(0, 0, R * 1.1, R * 0.2, 0, Math.PI, TAU); ctx.stroke(); }
    ctx.strokeStyle = C3(col, 0.8); ctx.lineWidth = 1.4;
    const n = 2 + Math.floor(c.biomass / 35);
    for (let k = 0; k < n; k++) {
      const x0 = (k - (n - 1) / 2) * R * 0.4, h = R * (1.4 + (k % 2) * 0.4), sw = Math.sin(t + c.seed + k) * R * 0.08;
      ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0 + sw, -h);
      ctx.moveTo(x0 + sw, -h); ctx.lineTo(x0 + sw - R * 0.25, -h - R * 0.45);
      ctx.moveTo(x0 + sw, -h); ctx.lineTo(x0 + sw + R * 0.25, -h - R * 0.45);
      ctx.stroke();
      ctx.fillStyle = '#b08840';
      for (const d of [-0.25, 0.25]) { ctx.beginPath(); ctx.ellipse(x0 + sw + d * R, -h - R * 0.5, R * 0.1, R * 0.14, 0, 0, TAU); ctx.fill(); }
    }
    if (c.traits.myco) {   // strzępki grzyba w ziemi wokół korzeni
      ctx.strokeStyle = 'rgba(240,230,190,0.5)'; ctx.lineWidth = 0.6;
      for (let k = 0; k < 6; k++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(k) * R * 1.2, R * 0.3 + Math.sin(k * 2) * R * 0.2); ctx.stroke(); }
    }
  },
};

function drawWhorled(ctx, c, t, colBase, kelp) {
  const R = c.radius, col = hurtTint(c, colBase);
  ctx.translate(c.x, c.y);
  const H = R * 3.2, nodes = kelp ? 6 : 5;
  const sway = Math.sin(t * 0.9 + c.seed) * 0.12;
  ctx.strokeStyle = C3(col, 0.8); ctx.lineWidth = kelp ? 3 : 2; ctx.lineCap = 'round';
  const pt = u => [Math.sin(u * 2 + t * 0.8 + c.seed) * R * 0.2 + sway * u * H, R * 1.2 - u * H];
  ctx.beginPath();
  for (let i = 0; i <= 20; i++) { const [x, y] = pt(i / 20); if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
  ctx.stroke();
  for (let k = 1; k <= nodes; k++) {
    const [x, y] = pt(k / (nodes + 0.5));
    if (kelp) {
      ctx.fillStyle = C3(col, 1.1, 0.85);
      ctx.beginPath(); ctx.ellipse(x + R * 0.5, y, R * 0.6, R * 0.16, 0.4 + sway, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(200,180,90,0.9)'; ctx.beginPath(); ctx.arc(x + R * 0.08, y, R * 0.11, 0, TAU); ctx.fill();   // pęcherz powietrzny
      continue;
    }
    ctx.strokeStyle = C3(col, 1.05); ctx.lineWidth = 1.2;
    for (let j = 0; j < 7; j++) {
      const a = j / 7 * Math.PI - Math.PI / 2 + Math.sin(t + j) * 0.05, l = R * (0.75 - k * 0.06);
      const ex = x + Math.cos(a) * l * (j % 2 ? 1 : -1), ey = y + Math.sin(a) * l * 0.4 - l * 0.25;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo((x + ex) / 2, ey - l * 0.15, ex, ey); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(220,120,60,0.8)';   // organy rozrodcze ramienicy
    ctx.beginPath(); ctx.arc(x + R * 0.12, y - R * 0.05, R * 0.07, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = C3(col, 0.6);
  ctx.beginPath(); ctx.ellipse(0, R * 1.25, R * 0.4, R * 0.1, 0, 0, TAU); ctx.fill();
}

// Podgląd w kartach wyboru: która opcja jakim planem budowy jest pokazana
const PREVIEW_PLAN = {
  cnid: 'jelly', bilat: 'worm', arthro: 'arthropod', mollusk: 'orthocone', chordate: 'pikaia',
  jawless: 'fish', jawed: 'jawfish', rayfin: 'rayfish', lobefin: 'lobefish', seaweed: 'kelp', charo: 'landplant',
};
