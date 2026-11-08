// Ery organizmów wielokomórkowych: przygotowanie świata, mieszkańcy, polowania i liczniki celów.
// Mapa „szelf” (World({shelf:true})): głęboki stok po lewej, płytkie morze, plaża i ląd po prawej.

// Gdzie pojawiają się organizmy
function lifeSpot(where) {
  const W = world.waterEnd;
  for (let i = 0; i < 40; i++) {
    let x, y;
    if (where === 'land') { x = rand(W + 60, world.w - 40); y = world.floorAt(x) - 6; return [x, y]; }
    if (where === 'floor') { x = rand(Math.max(250, W - 2300), W - 120); y = world.floorAt(x) - 8; }
    else if (where === 'shallow') { x = rand(W - 900, W - 150); y = rand(40, world.floorAt(x) - 30); }
    else if (where === 'deep') { x = rand(300, W - 1300); y = rand(300, world.floorAt(x) - 80); }
    else { x = rand(300, W - 300); y = rand(120, world.floorAt(x) - 60); }
    if (y > 20 && (!player || Math.hypot(x - player.x, y - player.y) > 450)) return [x, y];
  }
  return [W - 600, 200];
}

// Ustawienia er: roślinność na lądzie, pożywienie, start gracza i mieszkańcy
const LIFE = {
  7:  { flora: 0, mats: true, start: 'floorMid',
        npc: [{ plan: 'charnia', lineage: 'decor', n: 12, where: 'floor' }, { plan: 'disc', lineage: 'grazer', n: 6, where: 'floor' }] },
  8:  { flora: 0, mats: true, start: 'floorMid',
        npc: [{ plan: 'trilobite', lineage: 'grazer', n: 9, where: 'floor' }, { plan: 'anomalocaris', lineage: 'pred', n: 2, where: 'mid' }] },
  9:  { flora: 1, mats: true, detritus: true, start: 'shoreFloor',
        npc: [{ plan: 'trilobite', lineage: 'grazer', n: 6, where: 'floor' }, { plan: 'eurypterid', lineage: 'pred', n: 2, where: 'deep' }] },
  10: { flora: 1, start: 'mid',
        npc: [{ plan: 'trilobite', lineage: 'grazer', n: 6, where: 'floor' }, { plan: 'orthocone', lineage: 'pred', n: 2, where: 'mid' },
              { plan: 'eurypterid', lineage: 'pred', n: 1, where: 'deep' }] },
  11: { flora: 1, start: 'mid',
        npc: [{ plan: 'smallfish', lineage: 'prey', n: 14, where: 'mid' }, { plan: 'dunkleosteus', lineage: 'pred', n: 1, where: 'deep' }] },
  12: { flora: 2, detritus: true, start: 'shallow',
        npc: [{ plan: 'smallfish', lineage: 'prey', n: 10, where: 'shallow' }, { plan: 'millipede', lineage: 'landprey', n: 9, where: 'land' },
              { plan: 'hyneria', lineage: 'pred', n: 1, where: 'deep' }] },
  13: { flora: 0, start: 'mid', npc: [{ plan: 'jelly', lineage: 'decor', n: 5, where: 'mid' }] },
  14: { flora: 0, start: 'shallow', npc: [{ plan: 'fungus', lineage: 'fungus', n: 9, where: 'land' }] },
};

const LifeEras = {
  // Nowy świat z wybrzeżem i ród gracza jako organizm wielokomórkowy
  setup(n) {
    const L = LIFE[n];
    if (!world.shelf) {
      const nw = new World({ shelf: true });
      nw.cam = cam; nw.onLightning = world.onLightning; nw.focusX = world.focusX;
      world = nw;
    }
    Object.assign(world.env, { era: n, o2: 1, ozone: 1, ice: 0, iceTarget: 0, flora: L.flora, mats: !!L.mats, detritus: !!L.detritus });
    for (let i = 0; i < 40 && L.mats; i++) world.spawnMat();
    for (let i = 0; i < 20 && L.detritus; i++) world.spawnDetritus();
    const W = world.waterEnd;
    let sx, sy;
    if (L.start === 'floorMid') { sx = W - 1500; sy = world.floorAt(sx) - 20; }
    else if (L.start === 'shoreFloor') { sx = W - 700; sy = world.floorAt(sx) - 20; }
    else if (L.start === 'shallow') { sx = W - 420; sy = Math.min(120, world.floorAt(sx) - 30); }
    else { sx = W - 1300; sy = 380; }
    const traits = { ...player.traits };
    const plan = planFor(traits);
    const me = new Creature(sx, sy, { plan, traits, isPlayer: true, biomass: 60, generation: player.generation, heading: 0 });
    cells = [me];
    player = me;
    for (let i = 0; i < 2; i++) cells.push(new Creature(sx - 60 - i * 40, sy + rand(-20, 10), { plan, traits: { ...traits }, biomass: 45, generation: me.generation, heading: 0 }));
    for (const s of L.npc) for (let i = 0; i < s.n; i++) this.spawn(s);
    world.cells = cells;
    cam.x = sx; cam.y = sy;
    cam.zoom = clamp(cam.zoom, 0.55, 1.2);
    this.spawnT = 0;
  },

  spawn(s) {
    const [x, y] = lifeSpot(s.where);
    const big = PREDATOR_PLANS.has(s.plan);
    const c = new Creature(x, y, { plan: s.plan, lineage: s.lineage, biomass: big ? rand(70, 100) : rand(30, 80), traits: {} });
    cells.push(c);
    return c;
  },

  onEat(c, p) {
    if (c !== player) return;
    progress('eat:any');
    if (p.type === 'mat') progress('eat:mat');
    if (p.type === 'detritus' && !c.inWater) progress('eat:detritus');
  },

  onReproduce(d) {
    progress('brood');
    if (!player.inWater) { progress('brood:land'); progress('spores:land'); }
    if (player.P.plant) hintOnce('spores', 'Zarodniki w twardej osłonce (sporopolenina) nie wysychają – wiatr niesie je na ląd.', 'good');
  },

  update(dt) {
    const n = stats.era, L = LIFE[n], p = player;
    if (!L) return;
    const fl = world.floorAt(p.x);

    // liczniki czasu w strefach
    if (p.inWater && world.lightAt(p.y) > 0.3) progress('time:light', dt);
    if (p.inWater && fl < 260) progress('time:tidal', dt);
    if (p.inWater && fl < 520) progress('time:shallow', dt);
    if (p.inWater && fl < 200) progress('time:lagoon', dt);
    if (p.inWater && p.onGround && fl < 600) progress('time:crawl', dt);
    if (p.surfaced) { progress('breath'); hintOnce('gulp', 'Haust powietrza! W dusznych, płytkich wodach płuca dają przewagę.', 'good'); }
    if (p.metaGain > 0) { progress('energy:light', p.metaGain); p.metaGain = 0; }
    if (cells.some(c => c.alive && c.lineage === 'pred')) progress('survive', dt);

    // ugryzienia drapieżników
    for (const pr of cells) {
      if (!pr.alive || pr.lineage !== 'pred') continue;
      for (const v of cells) {
        if (!v.alive || v.lineage !== 'player' || !v.inWater || pr.biteCd > 0) continue;
        if (Math.hypot(v.x - pr.x, v.y - pr.y) > pr.radius * 1.3 + v.radius * 0.6) continue;
        const armor = v.P.armor || (v.plan === 'fish' ? 0.35 : 0);
        v.health -= 24 * (1 - armor);
        v.hurt = 1;
        pr.bite = 1;
        pr.biteCd = 1.6;
        if (v === player) hintOnce('bitten', `Atak drapieżnika! ${v.traits.eyes ? 'Oczy pokazują zagrożenie na krawędzi ekranu.' : 'Uciekaj na płyciznę albo w stronę dna.'}`, 'bad');
      }
    }

    // polowanie ryb szczękowych i mięśniopłetwych
    for (const h of cells) {
      if (!h.alive || h.lineage !== 'player' || !(h.P.hunter || h.plan === 'arthropod')) continue;
      for (const v of cells) {
        if (!v.alive || v === h || v.radius > h.radius * 0.85) continue;
        const relative = edibleRelative(h, v);   // słabiej rozwinięty krewny z własnego rodu
        if (!relative && v.lineage !== 'prey' && v.lineage !== 'landprey') continue;
        if (!relative && !h.P.hunter) continue;   // stawonóg zjada tylko słabszych krewnych
        if (Math.hypot(v.x - h.x, v.y - h.y) > h.radius * 1.2 + v.radius * 0.6) continue;
        v.alive = false; v.eaten = true;
        h.energy = Math.min(100, h.energy + 28);
        h.biomass = Math.min(100, h.biomass + 14);
        h.bite = 1;
        if (relative) {
          hintOnce('cannibal', 'Zjadłeś słabiej rozwiniętego krewnego. Dobór naturalny działa też wewnątrz rodu.', 'good');
          continue;
        }
        if (h === player) {
          stats.kills++;
          progress(h.inWater ? 'kill' : 'kill:land');
          hintOnce('prey', h.inWater ? 'Szczęki! Złapana ryba to dużo energii i biomasy.' : 'Pierwsza zdobycz na lądzie – tu nikt jeszcze nie konkuruje o pokarm.', 'good');
        }
      }
    }

    // mikoryza: roślina łączy się z grzybem na lądzie
    for (const f of cells) {
      if (f.lineage !== 'fungus' || !f.alive || f.bonded) continue;
      if (!p.inWater && p.P.plant && Math.hypot(f.x - p.x, f.y - p.y) < p.radius + f.radius + 30) {
        f.bond += dt;
        hintOnce('myco', 'Strzępki grzyba oplatają korzenie – grzyb da wodę i fosfor, roślina odda cukry.', 'good');
        if (f.bond >= 4) { f.bonded = true; progress('bond:fungus'); toast('Mikoryza! Kolejny grzyb połączony z rośliną.', 'good'); }
      }
    }

    // uzupełnianie populacji
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 3;
      for (const s of L.npc) {
        if (s.lineage === 'decor' || s.lineage === 'fungus') continue;
        const have = cells.filter(c => c.alive && c.plan === s.plan).length;
        if (have < s.n) this.spawn(s);
      }
    }
  },

  // Oczy: strzałki na krawędzi ekranu pokazujące drapieżniki poza widokiem
  drawIndicators(ctx) {
    if (!player || !player.creature || !player.traits.eyes) return;
    for (const c of cells) {
      if (!c.alive || c.lineage !== 'pred') continue;
      const sx = (c.x - cam.x) * cam.zoom + vw / 2, sy = (c.y - cam.y) * cam.zoom + vh / 2;
      if (sx > 0 && sx < vw && sy > 0 && sy < vh) continue;
      const d = Math.hypot(c.x - player.x, c.y - player.y);
      if (d > 1600) continue;
      const a = Math.atan2(sy - vh / 2, sx - vw / 2);
      const ex = vw / 2 + Math.cos(a) * (vw / 2 - 40), ey = vh / 2 + Math.sin(a) * (vh / 2 - 40);
      ctx.save();
      ctx.translate(clamp(ex, 30, vw - 30), clamp(ey, 30, vh - 30));
      ctx.rotate(a);
      ctx.fillStyle = `rgba(255,90,80,${clamp(1.2 - d / 1600, 0.3, 0.95)})`;
      ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -9); ctx.lineTo(-4, 0); ctx.lineTo(-8, 9); ctx.fill();
      ctx.restore();
    }
  },
};
