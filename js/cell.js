// Stopień rozwoju: liczba cech ewolucyjnych (słabiej rozwinięty krewny ma ich mniej)
const evoLevel = c => Object.values(c.traits).filter(Boolean).length;

// Gracz może zjeść krewnego z własnego rodu, jeśli ten jest słabiej rozwinięty (np. starszy potomek sprzed ewolucji).
// Potomkowie sterowani przez grę nie zjadają się nawzajem.
function edibleRelative(hunter, o) {
  return hunter.isPlayer && o.lineage === hunter.lineage && !o.isPlayer && !(o.colony && hunter.colony) &&
    evoLevel(o) < evoLevel(hunter);
}

// Komórka: od protokomórki z RNA, przez prokarionta z DNA, po eukarionta z jądrem i mitochondriami.
// Cechy (traits) dziedziczy potomek przy podziale (kopia). Nowa cecha pojawia się tylko w komórce,
// która ewoluowała – starsi potomkowie jej nie dostają.
//   Era 1: flagellum (wić), thermo (termofil), phago (enzymy drapieżcy – trawienie zewnętrzne)
//   Era 2: dna, pumps (chemiosmoza), bact / arch (domena)
//   Era 3: biofilm, chemo / ferment / photo, oxygenic (sinice)
//   Era 4: deep / shield / aerobic
//   Era 5: euk (mitochondria, jądro), sex (mejoza), alga / predator
//   Era 6: adhesion, special (specjalizacja komórek kolonii)
class Cell {
  constructor(x, y, o = {}) {
    this.x = x;
    this.y = y;
    this.vx = o.vx ?? 0;
    this.vy = o.vy ?? 0;
    this.biomass = o.biomass ?? 25;   // 100 = gotowa do podziału
    this.energy = o.energy ?? 70;
    this.health = 100;
    this.hue = o.hue ?? 170;
    this.isPlayer = !!o.isPlayer;
    this.lineage = o.lineage ?? 'player';   // 'player' = Twój ród; 'wild', 'cyano', 'alpha' = inne linie
    this.traits = o.traits ?? {};
    this.generation = o.generation ?? 1;
    this.alive = true;
    this.eaten = false;
    this.age = 0;
    this.n = 32;
    this.pts = [];
    this.seed = Math.random() * 100;
    this.heading = o.heading ?? Math.random() * TAU;
    const R = this.radius;
    for (let i = 0; i < this.n; i++) this.pts.push({ r: R, v: 0 });
    this.digest = [];
    this.ribos = Array.from({ length: 9 }, () => ({
      a: Math.random() * TAU, d: rand(0.25, 0.8), s: rand(-0.8, 0.8), z: rand(0.8, 1.6),
    }));
    this.granules = Array.from({ length: 12 }, (_, i) => ({ a: i / 12 * TAU + rand(-0.2, 0.2), d: rand(0.78, 0.88), z: rand(0.8, 1.3) }));
    this.mitos = Array.from({ length: 5 }, () => ({ a: Math.random() * TAU, d: rand(0.45, 0.72), s: rand(-0.25, 0.25), rot: rand(0, TAU) }));
    this.flash = 0;
    this.hurt = 0;
    this.dmgRate = 0;
    this.moving = false;
    this.tailPhase = Math.random() * TAU;
    this.ai = { tx: x, ty: y, timer: 0, prey: null };
    this.divideCooldown = 0;
    this.metaGain = 0;    // energia z nowego metabolizmu (zadanie Ery 3)
    this.endo = 0;        // wchłonięte alfaproteobakterie (Era 5, zanim staną się mitochondriami)
    this.cheater = !!o.cheater;
    this.apop = 0;        // apoptoza – zaprogramowana śmierć komórki
    this.colony = false;
    this.slot = -1;
    this.role = '';       // w kolonii: 'soma' (komórka ciała) albo 'germ' (rozrodcza)
    this.powerMul = 1;
    this.lysing = 0;
    this.bond = 0;        // postęp symbiozy (komórki 'alpha')
    this.inMat = false;   // w macie mikrobiologicznej
  }

  get radius() { return (12 + this.biomass * 0.18) * (this.traits.euk ? 1.7 : 1); }
  get canDivide() { return this.biomass >= 100 && this.divideCooldown <= 0 && this.apop === 0; }
  get heatLimit() {
    const t = this.traits;
    let l = t.thermo ? 0.86 : 0.62;
    if (t.arch) l += 0.08;
    if (t.euk) l = Math.min(l, 0.45);   // eukarionty nie znoszą wody gorętszej niż ~65°C
    return l;
  }
  // 1 = pełna ochrona przed tlenem (enzymy antyoksydacyjne), 0 = beztlenowiec
  get o2Resist() {
    const t = this.traits;
    return t.euk || t.oxygenic || t.shield || t.aerobic ? 1 : 0;
  }
  get canHunt() { return !!(this.traits.predator || (this.traits.phago && !this.traits.euk)); }

  // Mnożnik energii z pożywienia – zależy od metabolizmu
  foodMul(type, world) {
    const t = this.traits;
    let m = 1;
    if (t.phago && !t.euk) m *= 0.6;
    if (t.predator) m *= 0.5;
    if (t.chemo && type === 'mineral') m *= 2.2;
    if (t.ferment && (type === 'organic' || type === 'lipid')) m *= 1.6;
    if (t.deep && type === 'mineral') m *= 1.5;
    if (t.alga && type !== 'lipid') m *= 0.7;
    const o2 = world.o2At(this.x, this.y);
    if (t.euk) m *= 1.3 + 0.5 * o2;          // mitochondria – oddychanie tlenowe
    else if (t.aerobic) m *= 1 + 1.4 * o2;   // ok. 15× więcej ATP niż fermentacja, gdy jest tlen
    return m;
  }

  update(dt, world, dir) {
    this.age += dt;
    this.divideCooldown -= dt;
    const tr = this.traits;
    if (this.apop > 0) {
      this.apop += dt;
      dir = [0, 0];
      if (this.apop > 1.6) this.alive = false;
    }
    const R = this.radius;

    // Ruch: napęd błony (lub wici) + unoszenie przez prądy + ruchy Browna
    const len = Math.hypot(dir[0], dir[1]);
    this.moving = len > 0.01;
    let power = 140 * Math.sqrt(17 / R) * (tr.flagellum ? 1.7 : 1) * this.powerMul;
    if (tr.euk) power *= (tr.alga || tr.predator) ? 1.9 : 1.5;   // cytoszkielet i wici eukariotyczne
    let ax = 0, ay = 0;
    if (this.moving) {
      const m = Math.max(1, len);
      ax = dir[0] / m * power;
      ay = dir[1] / m * power;
    }
    const [fx, fy] = world.flow(this.x, this.y);
    const drag = 1.6;
    const brown = tr.euk ? 10 : 25;
    this.vx += (ax + drag * (fx * 0.7 - this.vx) + rand(-brown, brown)) * dt;
    this.vy += (ay + drag * (fy * 0.7 - this.vy) + rand(-brown, brown)) * dt;
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    const top = world.env.ice > 0.5 ? 50 * world.env.ice : 0;   // pod lodem nie da się wypłynąć
    if (this.x < R) { this.x = R; this.vx = Math.abs(this.vx) * 0.3; }
    if (this.x > world.w - R) { this.x = world.w - R; this.vx = -Math.abs(this.vx) * 0.3; }
    if (this.y < R + top) { this.y = R + top; this.vy = Math.abs(this.vy) * 0.3; }
    const fl = world.floorAt(this.x);
    if (this.y > fl - R) { this.y = fl - R; this.vy = -Math.abs(this.vy) * 0.3; }

    // Kierunek "przodu" komórki (wić ciągnie się z tyłu)
    const sp = Math.hypot(this.vx, this.vy);
    if (sp > 8 && !this.colony) {
      const target = Math.atan2(this.vy, this.vx);
      let d = target - this.heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.heading += d * Math.min(1, dt * 5);
    }
    this.tailPhase += dt * (this.moving || this.colony ? 20 : 7);

    // Metabolizm
    let meta = 0.55 * (R / 17);
    if (tr.euk) meta *= 0.55;
    if (tr.arch) meta *= 0.75;     // archeony żyją oszczędnie (stres energetyczny)
    if (tr.pumps) meta *= 0.85;
    if (this.colony) meta *= 0.6;   // komórki kolonii dzielą się zasobami
    this.energy -= dt * (meta + (this.moving ? 0.9 * (tr.flagellum ? 0.75 : 1) : 0));

    // Fotosynteza i chemosynteza – energia bez jedzenia
    if (tr.photo || tr.alga) {
      const k = tr.alga ? 6 : tr.oxygenic ? 4.5 : 4;
      const gain = world.lightAt(this.y) * k * dt;
      this.energy += gain;
      this.metaGain += gain;
    }
    if (tr.chemo) {
      const h = world.heatAt(this.x, this.y);
      if (h > 0.12 && h < 0.8) { this.energy += 1.6 * dt; this.metaGain += 1.6 * dt; }
    }

    // Zagrożenia środowiska
    const uv = world.uvAt(this.y);
    const heat = world.heatAt(this.x, this.y);
    const lim = this.heatLimit;
    let dmg = 0;
    if (uv > 0) dmg += uv * uv * 14 * (tr.arch ? 0.8 : 1) * (this.inMat ? 0.5 : 1) * (tr.oxygenic ? 0.7 : 1);
    if (heat > lim) dmg += (heat - lim) / (1 - lim) * (tr.thermo ? 15 : 30);
    const o2 = world.o2At(this.x, this.y);
    if (o2 > 0.02) dmg += o2 * 9 * (1 - this.o2Resist);   // reaktywne formy tlenu niszczą białka i DNA
    if (this.energy <= 0) { this.energy = 0; dmg += 6; }
    this.dmgRate = dmg;
    if (dmg > 0) {
      this.health -= dmg * dt;
      this.hurt = Math.min(1, this.hurt + dmg * dt * 0.25);
    } else if (this.energy > 30 && this.health < 100) {
      // naprawa kosztuje energię
      this.health = Math.min(100, this.health + 3 * dt);
      this.energy -= 0.3 * dt;
    }
    // nadwyżka energii idzie na budowę biomasy (wzrost)
    if (this.cheater) {
      this.biomass = Math.min(100, this.biomass + 1.6 * dt);   // oszustka rośnie bez kontroli
    } else if (this.energy > (this.colony ? 50 : 75) && this.biomass < 100) {
      let g = 0.8 * (tr.bact ? 1.5 : 1);
      if (tr.deep && this.y > fl - 450) g *= 1.5;
      this.energy -= 2 * dt;
      this.biomass = Math.min(100, this.biomass + g * dt);
    }
    this.hurt = Math.max(0, this.hurt - dt * 1.2);
    this.energy = clamp(this.energy, 0, 100);
    if (this.health <= 0) this.alive = false;

    // Błona – sprężyste punkty, odkształcanie w ruchu, kształt zależny od budowy
    const n = this.n;
    const k = this.colony ? 0 : Math.min(1, sp / 90);
    const va = Math.atan2(this.vy, this.vx);
    const t = world.time;
    const amoeboid = tr.predator && this.role !== 'soma';
    const wobAmp = this.cheater ? 0.22 : amoeboid ? 0.15 : tr.euk ? 0.06 : 0.1;
    const shrink = this.apop > 0 ? 1 - 0.4 * Math.min(1, this.apop / 1.4) : 1;
    const h = this.heading;
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU;
      const p = this.pts[i];
      const wob = Noise.perlin(Math.cos(a) * 1.3 + this.seed, Math.sin(a) * 1.3 + t * (amoeboid || this.cheater ? 0.9 : 0.6)) * wobAmp;
      let shape = 1;
      const c = Math.cos(a - h);
      if (tr.euk) shape = tr.alga ? 0.93 + 0.14 * c * c : tr.predator ? 0.92 + 0.1 * c * c + 0.05 * c : 1;
      else if (tr.bact) shape = 0.8 + 0.44 * c * c;                         // pałeczka
      else if (tr.arch) shape = 1 + 0.07 * Math.sin(a * 5 + this.seed);    // płatowaty ziarniak
      const d = Math.cos(a - va);
      const target = R * shrink * (shape + wob + k * (0.16 * d * d - 0.07) - k * 0.06 * d);
      p.v += (target - p.r) * 55 * dt;
      p.v *= Math.exp(-7 * dt);
    }
    for (const p of this.pts) p.r += p.v * dt;
    const smooth = this.pts.map((p, i) => (this.pts[(i - 1 + n) % n].r + p.r * 2 + this.pts[(i + 1) % n].r) / 4);
    for (let i = 0; i < n; i++) this.pts[i].r += (smooth[i] - this.pts[i].r) * 0.5;

    for (const r of this.ribos) r.a += r.s * dt;
    for (const m of this.mitos) { m.a += m.s * dt * 0.4; m.rot += m.s * dt; }
    for (const d of this.digest) {
      d.t += dt;
      const f = Math.min(1, dt * 4);
      d.x += (d.tx - d.x) * f;
      d.y += (d.ty - d.y) * f;
    }
    this.digest = this.digest.filter(d => d.t < d.dur);
    this.flash = Math.max(0, this.flash - dt * 2);
    this.lysing = Math.max(0, this.lysing - dt * 2);
  }

  gulp(dx, dy, rgbCol, size, strength = 30, dur = 1.6) {
    const ang = Math.atan2(dy, dx);
    const idx = Math.round(((ang + TAU) % TAU) / TAU * this.n) % this.n;
    for (let j = -2; j <= 2; j++) {
      this.pts[(idx + j + this.n) % this.n].v -= strength - Math.abs(j) * strength / 3;   // "wgłębienie" błony
    }
    const R = this.radius;
    const rr = Math.random() * R * 0.55, ra = Math.random() * TAU;
    this.digest.push({ x: dx, y: dy, tx: Math.cos(ra) * rr, ty: Math.sin(ra) * rr, t: 0, dur, rgb: rgbCol, size });
    this.flash = Math.min(1, this.flash + 0.4);
  }

  eat(p, world) {
    const f = FOOD[p.type];
    const m = this.foodMul(p.type, world);
    const gain = f.energy * m;
    // energia z jedzenia przerobionego nowym metabolizmem (cel Ery 3)
    const t = this.traits;
    if ((t.chemo && p.type === 'mineral') || (t.ferment && (p.type === 'organic' || p.type === 'lipid'))) this.metaGain += gain;
    this.energy = Math.min(100, this.energy + gain);
    this.biomass = Math.min(100, this.biomass + f.biomass * Math.min(1, m));
    this.health = Math.min(100, this.health + f.health);
    this.gulp(p.x - this.x, p.y - this.y, f.color, f.size);
  }

  // Pochłonięcie (fagocytoza) albo strawienie z zewnątrz (enzymy) całej komórki
  eatCell(o, external = false) {
    this.energy = Math.min(100, this.energy + 25 + o.biomass * 0.3);
    this.biomass = Math.min(100, this.biomass + o.biomass * (external ? 0.4 : 0.6));
    this.health = Math.min(100, this.health + 10);
    if (external) this.gulp(o.x - this.x, o.y - this.y, [255, 150, 170], 3, 12, 1);
    else this.gulp(o.x - this.x, o.y - this.y, [255, 130, 170], o.radius * 0.45, 60, 3.5);   // wodniczka pokarmowa
    this.flash = 1;
  }

  canEat(o) {
    if (!o.alive || o === this || o.apop > 0) return false;
    if (o.lineage === this.lineage && !edibleRelative(this, o)) return false;
    if (this.traits.predator) return o.radius < this.radius * 0.7;
    if (this.traits.phago && !this.traits.euk) return o.radius < this.radius * 0.85;
    return false;
  }

  divide() {
    const ang = Math.random() * TAU;
    const R = this.radius;
    const c = Math.cos(ang), s = Math.sin(ang);
    const e = Math.max(25, this.energy * 0.5);
    this.biomass = 50;
    this.energy = e;
    this.generation += 1;
    const d = new Cell(this.x + c * R * 0.5, this.y + s * R * 0.5, {
      biomass: 50, energy: e,
      hue: this.cheater ? this.hue : (this.hue + rand(-15, 15) + 360) % 360,   // drobna mutacja
      generation: this.generation,
      lineage: this.lineage,
      traits: { ...this.traits },
      cheater: this.cheater,
      heading: this.heading,
      vx: this.vx + c * 60, vy: this.vy + s * 60,
    });
    this.x -= c * R * 0.5;
    this.y -= s * R * 0.5;
    this.vx -= c * 60;
    this.vy -= s * 60;
    this.divideCooldown = d.divideCooldown = this.traits.bact ? 2 : 3;
    for (const p of this.pts) p.r *= 0.7;
    for (const p of d.pts) p.r *= 0.7;
    return d;
  }

  // Prosta "inteligencja" komórek bez gracza: poluj / szukaj jedzenia i światła,
  // unikaj UV, wrzątku i (dla beztlenowców) natlenionej wody
  aiDir(dt, world) {
    const ai = this.ai;
    const tr = this.traits;
    const E = world.env;
    if (this.bond > 0) return [0, 0];   // trwa symbioza z graczem
    ai.timer -= dt;
    if (ai.prey && !ai.prey.alive) ai.prey = null;
    if (ai.timer <= 0) {
      ai.timer = rand(0.6, 1.4);
      ai.prey = null;
      if (this.canHunt && world.cells) {
        let bd = 320 * 320;
        for (const o of world.cells) {
          if (!this.canEat(o)) continue;
          const d = (o.x - this.x) ** 2 + (o.y - this.y) ** 2;
          if (d < bd) { bd = d; ai.prey = o; }
        }
      }
      if (!ai.prey) {
        let best = null, bd = 260 * 260;
        for (const p of world.particles) {
          const dx = p.x - this.x, dy = p.y - this.y;
          const d = dx * dx + dy * dy;
          if (d < bd) { bd = d; best = p; }
        }
        if ((tr.photo || tr.alga) && Math.random() < 0.6) best = null;   // fotosyntetyki trzymają się światła
        // Era 3: quorum sensing – komórki rodu skupiają się w matę wokół gracza
        const an = world.anchor;
        const gather = tr.biofilm && E.era === 3 && this.lineage === 'player' && an && an !== this &&
          Math.hypot(an.x - this.x, an.y - this.y) < 1100 && Math.random() < 0.6;
        if (gather) { ai.tx = an.x + rand(-110, 110); ai.ty = an.y + rand(-110, 110); }
        else if (best) { ai.tx = best.x; ai.ty = best.y; }
        else {
          ai.tx = this.x + rand(-200, 200);
          ai.ty = (tr.photo || tr.alga) ? rand(UV_DEPTH * (1 - E.ozone) + 60, 750) : this.y + rand(-150, 150);
        }
      }
      const uvTop = UV_DEPTH * (1 - E.ozone);
      if (ai.ty < uvTop + 100) ai.ty = uvTop + 150;
      if (E.ice > 0.5 && ai.ty < 120) ai.ty = 140;
      // beztlenowce uciekają w głębiny
      if (E.o2 > 0.08 && this.o2Resist < 0.5) {
        const anoxic = 1900 * (1.15 - 0.12 / E.o2);
        if (ai.ty < anoxic) { ai.ty = Math.min(anoxic + rand(50, 250), world.floorAt(ai.tx) - 60); ai.prey = null; }
      }
      if (world.heatAt(this.x, this.y) > this.heatLimit - 0.17) {
        const v = world.nearestVent(this.x);
        ai.tx = this.x + Math.sign(this.x - v.x || 1) * 300;
        ai.ty = this.y - 120;
        ai.prey = null;
      }
    }
    if (ai.prey) { ai.tx = ai.prey.x; ai.ty = ai.prey.y; }
    const dx = ai.tx - this.x, dy = ai.ty - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 10) return [0, 0];
    const speed = ai.prey ? 1 : 0.75;
    return [dx / d * speed, dy / d * speed];
  }

  // ---------- Rysowanie ----------

  // Wić: falująca nić ciągnięta za komórką (bakteryjna – cienka; eukariotyczna – grubsza i dłuższa)
  drawFlagellum(ctx, memHue, ang, len, width, alpha = 1) {
    const R = this.radius;
    const bx = Math.cos(ang), by = Math.sin(ang);
    const px = -by, py = bx;
    const steps = 22;
    let prev = null;
    ctx.lineCap = 'round';
    for (let s = 0; s <= steps; s++) {
      const u = s / steps;
      const along = R * 0.85 + u * len;
      const side = Math.sin(u * 9 - this.tailPhase) * R * 0.22 * Math.min(1, u * 2.5);
      const p = [this.x + bx * along + px * side, this.y + by * along + py * side];
      if (prev) {
        ctx.strokeStyle = `hsla(${memHue},60%,84%,${(0.9 - u * 0.5) * alpha})`;
        ctx.lineWidth = width * (1 - u * 0.75);
        ctx.beginPath();
        ctx.moveTo(prev[0], prev[1]);
        ctx.lineTo(p[0], p[1]);
        ctx.stroke();
      }
      prev = p;
    }
    // podstawa wici (motor bakteryjny / ciałko podstawowe)
    ctx.fillStyle = `hsla(${memHue},70%,85%,${0.9 * alpha})`;
    ctx.beginPath();
    ctx.arc(this.x + bx * R * 0.85, this.y + by * R * 0.85, width * 0.85, 0, TAU);
    ctx.fill();
  }

  // Dwie przednie wici glonu – ruch „żabką” jak u Chlamydomonas
  drawTwinFlagella(ctx) {
    const R = this.radius, h = this.heading;
    const fx = this.x + Math.cos(h) * R * 0.92, fy = this.y + Math.sin(h) * R * 0.92;
    const sw = 0.5 + 0.5 * Math.sin(this.tailPhase * 0.45);
    ctx.lineCap = 'round';
    for (const side of [-1, 1]) {
      let x = fx, y = fy;
      for (let s = 1; s <= 16; s++) {
        const u = s / 16;
        const a = h + side * (0.25 + (0.4 + 1.5 * sw) * u);
        const nx = x + Math.cos(a) * R * 0.1, ny = y + Math.sin(a) * R * 0.1;
        ctx.strokeStyle = `rgba(215,240,205,${0.85 - u * 0.5})`;
        ctx.lineWidth = 2.2 * (1 - u * 0.6);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(nx, ny); ctx.stroke();
        x = nx; y = ny;
      }
    }
  }

  // Kołnierzyk z mikrokosmków wokół wici – jak u wiciowców kołnierzykowych, przodków zwierząt
  drawCollar(ctx, ang) {
    const R = this.radius;
    ctx.strokeStyle = 'rgba(225,235,240,0.45)';
    ctx.lineWidth = 0.9;
    for (let i = -5; i <= 5; i++) {
      const a0 = ang + i * 0.085;
      const x0 = this.x + Math.cos(a0) * R * 0.9, y0 = this.y + Math.sin(a0) * R * 0.9;
      const a1 = ang + i * 0.06;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + Math.cos(a1) * R * 0.85, y0 + Math.sin(a1) * R * 0.85);
      ctx.stroke();
    }
  }

  // Obrys błony przeskalowany względem środka (ściana komórkowa, S-warstwa, tylakoidy)
  strokeScaled(ctx, path, s, width, style, dash) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(s, s);
    ctx.translate(-this.x, -this.y);
    ctx.strokeStyle = style;
    ctx.lineWidth = width / s;
    if (dash) ctx.setLineDash(dash.map(d => d / s));
    ctx.stroke(path);
    ctx.restore();
  }

  drawProkaryoteInside(ctx, t, hue) {
    const R = this.radius, tr = this.traits, x = this.x, y = this.y;
    if (!tr.dna) {
      // Nić RNA – materiał genetyczny protokomórki
      ctx.strokeStyle = `hsla(${(hue + 160) % 360},85%,78%,0.85)`;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let s = 0; s <= 48; s++) {
        const u = s / 48;
        const ang = u * TAU * 1.6 + t * 0.3 + this.seed;
        const rad = R * (0.12 + 0.36 * Math.sin(u * Math.PI));
        const wig = Math.sin(u * 30 + t * 3) * R * 0.05;
        const px = x + Math.cos(ang) * (rad + wig), py = y + Math.sin(ang) * (rad + wig);
        if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    } else {
      // Kolisty chromosom (nukleoid) – podwójna, skręcona nić DNA
      for (const [ph, col] of [[0, `hsla(${(hue + 160) % 360},80%,80%,0.8)`], [Math.PI, `hsla(${(hue + 190) % 360},70%,70%,0.6)`]]) {
        ctx.strokeStyle = col;
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        for (let s = 0; s <= 64; s++) {
          const u = s / 64 * TAU;
          const rad = R * (0.3 + 0.07 * Math.sin(u * 3 + this.seed + t * 0.2)) + Math.sin(u * 14 + ph + t * 0.5) * R * 0.04;
          const px = x + Math.cos(u + this.heading) * rad * (tr.bact ? 1.25 : 1);
          const py = y + Math.sin(u + this.heading) * rad * (tr.bact ? 0.8 : 1);
          if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      if (tr.bact) {   // plazmid – mały pierścień DNA, którym bakterie wymieniają geny
        const pa = this.seed + t * 0.1;
        ctx.strokeStyle = `hsla(${(hue + 160) % 360},80%,80%,0.7)`;
        ctx.beginPath();
        ctx.arc(x + Math.cos(pa) * R * 0.55, y + Math.sin(pa) * R * 0.45, R * 0.08, 0, TAU);
        ctx.stroke();
      }
    }
    // Chlorosomy – barwniki fotosyntezy beztlenowej przy błonie
    if (tr.photo && !tr.oxygenic) {
      ctx.fillStyle = 'hsla(78,55%,52%,0.6)';
      for (const g of this.granules) {
        ctx.beginPath();
        ctx.ellipse(x + Math.cos(g.a) * R * g.d, y + Math.sin(g.a) * R * g.d, R * 0.09 * g.z, R * 0.045 * g.z, g.a + Math.PI / 2, 0, TAU);
        ctx.fill();
      }
    }
    // Ziarenka siarki (chemolitotrofy utleniające siarkowodór)
    if (tr.chemo) {
      for (let i = 0; i < 4; i++) {
        const g = this.granules[i * 3];
        const gx = x + Math.cos(g.a) * R * 0.5, gy = y + Math.sin(g.a) * R * 0.5;
        ctx.fillStyle = 'hsla(52,90%,62%,0.8)';
        ctx.beginPath(); ctx.arc(gx, gy, R * 0.085, 0, TAU); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,220,0.7)';
        ctx.beginPath(); ctx.arc(gx - R * 0.025, gy - R * 0.025, R * 0.03, 0, TAU); ctx.fill();
      }
    }
    // Ziarna glikogenu – zapasy fermentatora
    if (tr.ferment) {
      ctx.fillStyle = 'hsla(40,25%,82%,0.5)';
      for (let i = 0; i < 6; i++) {
        const g = this.granules[i * 2 + 1];
        ctx.beginPath(); ctx.arc(x + Math.cos(g.a + 1) * R * 0.45, y + Math.sin(g.a + 1) * R * 0.45, R * 0.05, 0, TAU); ctx.fill();
      }
    }
    // Łańcuch oddechowy w błonie (oddychanie tlenowe)
    if (tr.aerobic) {
      ctx.fillStyle = 'hsla(8,80%,62%,0.65)';
      for (let i = 0; i < 18; i++) {
        const a = i / 18 * TAU + this.seed;
        ctx.beginPath(); ctx.arc(x + Math.cos(a) * R * 0.86, y + Math.sin(a) * R * 0.86, 1.1, 0, TAU); ctx.fill();
      }
    }
    // Wchłonięte alfaproteobakterie (przyszłe mitochondria)
    for (let i = 0; i < this.endo; i++) {
      const m = this.mitos[i];
      this.drawRod(ctx, x + Math.cos(m.a) * R * 0.5, y + Math.sin(m.a) * R * 0.5, m.rot, R * 0.2, R * 0.09, 'hsla(350,55%,55%,0.75)');
    }
  }

  drawRod(ctx, x, y, rot, rx, ry, fill) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,220,210,0.5)';
    ctx.lineWidth = 0.7;
    ctx.stroke();
    ctx.restore();
  }

  drawEukaryoteInside(ctx, t, hue) {
    const R = this.radius, tr = this.traits, h = this.heading;
    const cx = this.x - Math.cos(h) * R * 0.08, cy = this.y - Math.sin(h) * R * 0.08;
    const nR = R * (this.role === 'germ' ? 0.36 : 0.3);

    // Chloroplast w kształcie miseczki z pirenoidem (glon)
    if (tr.alga) {
      const back = h + Math.PI;
      ctx.strokeStyle = 'hsla(108,62%,36%,0.8)';
      ctx.lineWidth = R * 0.3;
      ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(this.x, this.y, R * 0.66, back - 1.45, back + 1.45); ctx.stroke();
      ctx.strokeStyle = 'hsla(100,70%,55%,0.4)';   // grana / tylakoidy
      ctx.lineWidth = 0.8;
      for (const f of [0.56, 0.66, 0.76]) {
        ctx.beginPath(); ctx.arc(this.x, this.y, R * f, back - 1.35, back + 1.35); ctx.stroke();
      }
      const px = this.x + Math.cos(back) * R * 0.62, py = this.y + Math.sin(back) * R * 0.62;
      ctx.fillStyle = 'rgba(200,225,170,0.7)';
      ctx.beginPath(); ctx.arc(px, py, R * 0.11, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(245,245,225,0.7)';   // osłonka skrobiowa
      ctx.lineWidth = 1.3;
      ctx.stroke();
      // plamka oczna (stigma) – czerwone karotenoidy, wyczuwa kierunek światła
      const ea = h + 0.7;
      ctx.fillStyle = 'rgba(255,80,40,0.9)';
      ctx.beginPath(); ctx.ellipse(this.x + Math.cos(ea) * R * 0.72, this.y + Math.sin(ea) * R * 0.72, R * 0.08, R * 0.045, ea, 0, TAU); ctx.fill();
    }

    // Siateczka śródplazmatyczna wokół jądra, obsadzona rybosomami
    ctx.strokeStyle = `hsla(${(hue + 30) % 360},45%,78%,0.32)`;
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const r = nR * (1.3 + i * 0.22);
      ctx.beginPath();
      for (let s = 0; s <= 30; s++) {
        const a = h + 0.9 + s / 30 * 3.6;
        const rr = r + Math.sin(s * 1.7 + t + i) * R * 0.025;
        const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
        if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    // Aparat Golgiego – stos spłaszczonych cystern
    const ga = h - 1.2;
    ctx.strokeStyle = `hsla(${(hue + 50) % 360},55%,75%,0.45)`;
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 4; i++) {
      const r = nR * 1.5 + i * R * 0.045;
      ctx.beginPath(); ctx.arc(cx, cy, r, ga - 0.35 + i * 0.03, ga + 0.35 - i * 0.03); ctx.stroke();
    }

    // Mitochondria – owalne, z grzebieniami (cristae)
    for (const m of this.mitos) {
      const mx = this.x + Math.cos(m.a) * R * m.d, my = this.y + Math.sin(m.a) * R * m.d;
      ctx.save();
      ctx.translate(mx, my);
      ctx.rotate(m.rot);
      const rx = R * 0.15, ry = R * 0.075;
      ctx.fillStyle = 'hsla(14,65%,52%,0.8)';
      ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,215,190,0.65)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
      ctx.beginPath();
      for (let i = -2; i <= 2; i++) {
        const xx = i * rx * 0.33;
        ctx.moveTo(xx, (i % 2 ? -1 : 1) * ry * 0.85);
        ctx.lineTo(xx, (i % 2 ? 1 : -1) * ry * 0.15);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Wodniczki pokarmowe drapieżnika
    if (tr.predator) {
      for (let i = 0; i < 2; i++) {
        const m = this.mitos[i + 2];
        const vx = this.x + Math.cos(m.a + 2) * R * 0.45, vy = this.y + Math.sin(m.a + 2) * R * 0.45;
        ctx.fillStyle = 'rgba(120,70,60,0.35)';
        ctx.beginPath(); ctx.arc(vx, vy, R * 0.12, 0, TAU); ctx.fill();
        ctx.strokeStyle = 'rgba(240,210,200,0.5)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }
    }
    // Wodniczka tętniąca – wypompowuje nadmiar wody
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.2 + this.seed);
    const va = h + 2.3;
    ctx.strokeStyle = `rgba(220,245,255,${0.25 + pulse * 0.3})`;
    ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.arc(this.x + Math.cos(va) * R * 0.62, this.y + Math.sin(va) * R * 0.62, R * (0.05 + pulse * 0.06), 0, TAU); ctx.stroke();

    // Jądro: podwójna otoczka z porami, chromatyna i jąderko
    const ng = ctx.createRadialGradient(cx - nR * 0.3, cy - nR * 0.3, nR * 0.1, cx, cy, nR);
    ng.addColorStop(0, this.cheater ? 'rgba(200,90,110,0.65)' : `hsla(${(hue + 200) % 360},35%,62%,0.6)`);
    ng.addColorStop(1, this.cheater ? 'rgba(120,40,60,0.7)' : `hsla(${(hue + 210) % 360},40%,40%,0.6)`);
    ctx.fillStyle = ng;
    ctx.beginPath(); ctx.arc(cx, cy, nR, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(230,240,255,0.55)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.setLineDash([2, 3]);
    ctx.strokeStyle = 'rgba(230,240,255,0.35)';
    ctx.beginPath(); ctx.arc(cx, cy, nR * 1.08, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(210,190,255,0.35)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let s = 0; s <= 40; s++) {
      const u = s / 40 * TAU * 2;
      const rr = nR * (0.3 + 0.45 * Math.abs(Math.sin(u * 1.3 + this.seed)));
      const px = cx + Math.cos(u * 1.7) * rr, py = cy + Math.sin(u * 2.1) * rr;
      if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.fillStyle = 'rgba(70,40,90,0.7)';
    ctx.beginPath(); ctx.arc(cx + nR * 0.25, cy - nR * 0.15, nR * 0.28, 0, TAU); ctx.fill();
  }

  draw(ctx, t) {
    const n = this.n, R = this.radius, tr = this.traits;
    const P = [];
    for (let i = 0; i < n; i++) {
      const a = i / n * TAU;
      P.push([this.x + Math.cos(a) * this.pts[i].r, this.y + Math.sin(a) * this.pts[i].r]);
    }
    const path = new Path2D();
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    const m0 = mid(P[n - 1], P[0]);
    path.moveTo(m0[0], m0[1]);
    for (let i = 0; i < n; i++) {
      const m = mid(P[i], P[(i + 1) % n]);
      path.quadraticCurveTo(P[i][0], P[i][1], m[0], m[1]);
    }
    path.closePath();

    const hue = this.cheater ? 352 : tr.alga ? 105 : this.hue;
    // przy obrażeniach błona czerwienieje
    const memHue = hue + ((hue < 180 ? 0 : 360) - hue) * Math.max(this.hurt, this.lysing);

    // Poświata
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const gl = ctx.createRadialGradient(this.x, this.y, R * 0.5, this.x, this.y, R * 2.2);
    gl.addColorStop(0, `hsla(${memHue},90%,60%,${(tr.euk ? 0.06 : 0.12) + this.flash * 0.25})`);
    gl.addColorStop(1, `hsla(${memHue},90%,60%,0)`);
    ctx.fillStyle = gl;
    ctx.fillRect(this.x - R * 2.2, this.y - R * 2.2, R * 4.4, R * 4.4);
    // Enzymy trawienne wydzielane na zewnątrz (drapieżny prokariont)
    if (tr.phago && !tr.euk) {
      const eg = ctx.createRadialGradient(this.x, this.y, R, this.x, this.y, R * 1.7);
      eg.addColorStop(0, `rgba(255,90,110,${0.1 + 0.04 * Math.sin(t * 3 + this.seed)})`);
      eg.addColorStop(1, 'rgba(255,90,110,0)');
      ctx.fillStyle = eg;
      ctx.fillRect(this.x - R * 1.7, this.y - R * 1.7, R * 3.4, R * 3.4);
    }
    ctx.restore();

    // Wici
    const showFlag = !this.colony || this.role !== 'germ';
    if (tr.euk && tr.alga) { if (showFlag) this.drawTwinFlagella(ctx); }
    else if (tr.euk && tr.predator) { if (showFlag) this.drawFlagellum(ctx, memHue, this.heading + Math.PI, R * 2.4, 3); }
    else if (tr.flagellum && showFlag) this.drawFlagellum(ctx, memHue, this.heading + Math.PI, R * 2, 2.6);

    // Cytoplazma
    const g = ctx.createRadialGradient(this.x - R * 0.3, this.y - R * 0.3, R * 0.1, this.x, this.y, R * 1.1);
    const sat = tr.euk ? 35 : 70;
    g.addColorStop(0, `hsla(${hue},${sat}%,72%,${tr.euk ? 0.4 : 0.55})`);
    g.addColorStop(0.7, `hsla(${hue},${sat - 10}%,45%,${tr.euk ? 0.3 : 0.4})`);
    g.addColorStop(1, `hsla(${hue},${sat - 10}%,35%,0.6)`);
    ctx.fillStyle = g;
    ctx.fill(path);

    ctx.save();
    ctx.clip(path);

    // Tylakoidy sinic – koncentryczne błony fotosyntetyczne
    if (tr.oxygenic && !tr.euk) {
      for (const s of [0.8, 0.7, 0.6]) this.strokeScaled(ctx, path, s, 1, 'hsla(168,60%,58%,0.45)');
    }
    if (tr.euk) this.drawEukaryoteInside(ctx, t, hue);
    else this.drawProkaryoteInside(ctx, t, hue);

    // Rybosomy
    ctx.fillStyle = 'hsla(50,90%,78%,0.85)';
    for (const r of this.ribos) {
      ctx.beginPath();
      ctx.arc(this.x + Math.cos(r.a) * R * r.d, this.y + Math.sin(r.a) * R * r.d, (tr.euk ? 0.9 : 1.2) * r.z, 0, TAU);
      ctx.fill();
    }

    // Trawione cząsteczki
    for (const d of this.digest) {
      const u = d.t / d.dur;
      const [cr, cg, cb] = d.rgb;
      ctx.fillStyle = `rgba(${cr},${cg},${cb},${1 - u})`;
      ctx.beginPath();
      ctx.arc(this.x + d.x, this.y + d.y, d.size * (1 - u * 0.7), 0, TAU);
      ctx.fill();
    }
    ctx.restore();

    // Zewnętrzne osłony
    if (tr.thermo && !tr.euk) {
      ctx.strokeStyle = `rgba(255,130,60,${0.35 + 0.1 * Math.sin(t * 3 + this.seed)})`;
      ctx.lineWidth = 7;
      ctx.stroke(path);
    }
    if (tr.alga) this.strokeScaled(ctx, path, 1.07, 3, 'hsla(95,35%,75%,0.35)');                 // ściana komórkowa glonu
    else if (tr.arch && !tr.euk) this.strokeScaled(ctx, path, 1.08, 1.8, `hsla(${(hue + 30) % 360},40%,82%,0.6)`, [1.5, 2.5]);   // S-warstwa białkowa
    else if (tr.bact && !tr.euk) this.strokeScaled(ctx, path, 1.05, 1, `hsla(${hue},40%,78%,0.4)`);   // ściana z peptydoglikanu

    // Błona – podwójna warstwa lipidowa
    const flick = this.dmgRate > 0 || this.lysing > 0 ? 0.6 + 0.4 * Math.sin(t * 25) : 1;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = tr.thermo && !tr.euk ? `hsla(25,90%,75%,${0.95 * flick})` : `hsla(${memHue},70%,82%,${0.95 * flick})`;
    ctx.lineWidth = tr.thermo && !tr.euk ? 4.2 : tr.euk ? 2.4 : 3.4;
    ctx.stroke(path);
    ctx.strokeStyle = `hsla(${memHue},60%,28%,0.9)`;
    ctx.lineWidth = 1.1;
    ctx.stroke(path);

    if (tr.euk && tr.predator && showFlag) this.drawCollar(ctx, this.heading + Math.PI);

    // Apoptoza: komórka obkurcza się i rozpada na pęcherzyki
    if (this.apop > 0) {
      const u = Math.min(1, this.apop / 1.4);
      ctx.fillStyle = `rgba(255,200,210,${0.6 * u})`;
      for (let i = 0; i < 7; i++) {
        const a = i / 7 * TAU + this.seed;
        ctx.beginPath();
        ctx.arc(this.x + Math.cos(a) * R * (0.7 + u * 0.5), this.y + Math.sin(a) * R * (0.7 + u * 0.5), R * 0.16 * u, 0, TAU);
        ctx.fill();
      }
    }

    if (this.isPlayer) {
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.arc(this.x, this.y, R * 1.15 + 9, t * 0.5, t * 0.5 + TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}
