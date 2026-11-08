// Era 6: kolonia komórek połączonych białkami adhezyjnymi – zalążek organizmu wielokomórkowego.
// Potomkowie po podziale nie odpływają, tylko zajmują kolejne miejsca w heksagonalnym układzie wokół gracza.
// Kolonia jest klonalna (wszystkie komórki pochodzą od jednej) – tak powstały glony wielokomórkowe i zwierzęta.
const COLONY_MAX = 24;

const Colony = {
  slots: (() => {
    const out = [{ x: 0, y: 0, ring: 0 }];
    const dirs = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
    for (let k = 1; k <= 3; k++) {
      let q = -k, r = k;
      for (let i = 0; i < 6; i++) {
        for (let j = 0; j < k; j++) {
          out.push({ x: q + r / 2, y: r * Math.sqrt(3) / 2, ring: k });
          q += dirs[i][0];
          r += dirs[i][1];
        }
      }
    }
    return out;
  })(),

  members() { return cells.filter(c => c.alive && c.colony); },
  size() { return cells ? cells.reduce((n, c) => n + (c.alive && c.colony ? 1 : 0), 0) : 0; },
  // zdrowe komórki (bez oszustek i komórek w apoptozie)
  healthy() { return cells ? cells.reduce((n, c) => n + (c.alive && c.colony && !c.cheater && c.apop === 0 ? 1 : 0), 0) : 0; },

  join(c) {
    if (this.size() >= COLONY_MAX) return false;
    const used = new Set(this.members().map(m => m.slot));
    for (let i = 1; i < this.slots.length; i++) {
      if (!used.has(i)) { c.colony = true; c.slot = i; return true; }
    }
    return false;
  },

  // Nowy środek kolonii po śmierci komórki gracza
  recenter(newCenter) {
    const old = this.slots[newCenter.slot] || this.slots[0];
    newCenter.slot = 0;
    for (const m of this.members()) {
      if (m === newCenter) continue;
      // przesunięcie wszystkich miejsc tak, by nowy środek był w (0,0)
      const s = this.slots[m.slot];
      const tx = s.x - old.x, ty = s.y - old.y;
      let best = -1, bd = Infinity;
      for (let i = 1; i < this.slots.length; i++) {
        const d = (this.slots[i].x - tx) ** 2 + (this.slots[i].y - ty) ** 2;
        if (d < bd && !this.members().some(o => o !== m && o.slot === i)) { bd = d; best = i; }
      }
      m.slot = best;
    }
  },

  update(dt) {
    if (!player.colony) return;
    const mem = this.members();
    const tr = player.traits;
    const sp = player.radius * 1.85;
    let maxRing = 0;
    for (const m of mem) maxRing = Math.max(maxRing, this.slots[m.slot].ring);
    // większa kolonia jest wolniejsza, chyba że komórki ciała wiosłują wspólnie (specjalizacja)
    player.powerMul = tr.special ? 1.1 + mem.length * 0.01 : clamp(1 / (1 + (mem.length - 1) * 0.07), 0.4, 1);
    player.role = tr.special && mem.length > 1 ? 'germ' : '';
    const k = Math.min(1, dt * 6);
    for (const m of mem) {
      if (m === player) continue;
      const s = this.slots[m.slot];
      const tx = player.x + s.x * sp, ty = player.y + s.y * sp;
      m.x += (tx - m.x) * k;
      m.y += (ty - m.y) * k;
      m.vx = player.vx;
      m.vy = player.vy;
      m.role = tr.special ? (s.ring === maxRing ? 'soma' : 'germ') : '';
      const out = Math.atan2(s.y, s.x);
      m.heading = tr.alga ? out : out + Math.PI;   // wici zwrócone na zewnątrz kolonii
    }

    // wici kolonii pędzą wodę – prąd przyciąga drobiny pokarmu (jak u gąbek i Volvox)
    let cx = 0, cy = 0;
    for (const m of mem) { cx += m.x; cy += m.y; }
    cx /= mem.length; cy /= mem.length;
    const reach = sp * (maxRing + 1) + 160;
    for (const p of world.particles) {
      const dx = cx - p.x, dy = cy - p.y;
      const d = Math.hypot(dx, dy);
      if (d > reach || d < 1) continue;
      const pull = (tr.special ? 70 : 40) * (1 - d / reach) * dt;
      p.x += dx / d * pull;
      p.y += dy / d * pull;
    }

    // wymiana substancji między komórkami – energia wyrównuje się w całej kolonii
    const honest = mem.filter(m => !m.cheater && m.apop === 0);
    if (honest.length > 1) {
      let avg = 0;
      for (const m of honest) avg += m.energy;
      avg /= honest.length;
      for (const m of honest) m.energy += (avg - m.energy) * Math.min(1, dt * 1.5);
    }
    // oszustki podkradają energię reszcie organizmu
    for (const c of mem) {
      if (!c.cheater || c.apop > 0) continue;
      const steal = 3 * dt;
      c.energy = Math.min(100, c.energy + steal);
      for (const m of honest) m.energy = Math.max(0, m.energy - steal * 1.5 / honest.length);
    }
  },

  drawMatrix(ctx) {
    if (!player || !player.colony) return;
    const mem = this.members();
    if (mem.length < 2) return;
    const R = player.radius;
    if (player.traits.alga) {
      // galaretowata kula jak u Volvox
      let cx = 0, cy = 0;
      for (const m of mem) { cx += m.x; cy += m.y; }
      cx /= mem.length; cy /= mem.length;
      let rad = 0;
      for (const m of mem) rad = Math.max(rad, Math.hypot(m.x - cx, m.y - cy));
      rad += R * 1.6;
      const g = ctx.createRadialGradient(cx, cy, rad * 0.3, cx, cy, rad);
      g.addColorStop(0, 'rgba(170,215,150,0.05)');
      g.addColorStop(0.85, 'rgba(170,215,150,0.1)');
      g.addColorStop(1, 'rgba(190,235,170,0.16)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, rad, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(200,240,180,0.3)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      // macierz zewnątrzkomórkowa (mezohyl) z włóknami białkowymi – jak u gąbek
      for (const m of mem) {
        const g = ctx.createRadialGradient(m.x, m.y, R * 0.6, m.x, m.y, R * 1.6);
        g.addColorStop(0, 'rgba(225,195,150,0.12)');
        g.addColorStop(1, 'rgba(225,195,150,0)');
        ctx.fillStyle = g;
        ctx.fillRect(m.x - R * 1.6, m.y - R * 1.6, R * 3.2, R * 3.2);
      }
    }
    // połączenia adhezyjne między sąsiadami
    ctx.strokeStyle = player.traits.alga ? 'rgba(200,240,180,0.22)' : 'rgba(235,210,175,0.3)';
    ctx.lineWidth = 1.2;
    const lim = (R * 2.3) ** 2;
    ctx.beginPath();
    for (let i = 0; i < mem.length; i++) {
      for (let j = i + 1; j < mem.length; j++) {
        const a = mem[i], b = mem[j];
        if ((a.x - b.x) ** 2 + (a.y - b.y) ** 2 > lim) continue;
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
    }
    ctx.stroke();
  },
};
