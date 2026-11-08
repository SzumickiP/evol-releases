// Pętla gry, sterowanie, kamera, HUD, ery i ich cele.
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const mini = document.getElementById('minimap');
const mctx = mini.getContext('2d');
const $ = id => document.getElementById(id);

let vw = 0, vh = 0, dpr = 1;
function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  vw = innerWidth;
  vh = innerHeight;
  canvas.width = vw * dpr;
  canvas.height = vh * dpr;
  canvas.style.width = vw + 'px';
  canvas.style.height = vh + 'px';
}
addEventListener('resize', resize);
resize();

// ---------- Sterowanie ----------
const keys = new Set();
const mouse = { x: 0, y: 0, down: false };
addEventListener('keydown', e => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  keys.add(e.code);
  if (e.code === 'Space' && state === 'play') tryDivide();
  if (e.code === 'KeyE' && state === 'play') tryApoptosis();
});
addEventListener('keyup', e => keys.delete(e.code));
canvas.addEventListener('mousedown', e => { mouse.down = true; mouse.x = e.clientX; mouse.y = e.clientY; });
addEventListener('mouseup', () => { mouse.down = false; });
addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  cam.zoom = clamp(cam.zoom * Math.exp(-e.deltaY * 0.001), 0.35, 2.8);
}, { passive: false });

function playerDir() {
  let x = 0, y = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
  if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
  if (mouse.down) {
    const wx = cam.x + (mouse.x - vw / 2) / cam.zoom;
    const wy = cam.y + (mouse.y - vh / 2) / cam.zoom;
    const dx = wx - player.x, dy = wy - player.y;
    const d = Math.hypot(dx, dy);
    if (d > 4) { x = dx / d; y = dy / d; }
  }
  return [x, y];
}

// ---------- Stan gry ----------
let world, cells, player, cam, state = 'intro', stats, hints, minimapBase, spawnTimer = 0;
let matPairs = [], matTimer = 0;

const isMine = c => c.lineage === 'player';

// Ewoluuje tylko komórka gracza. Dostaje nowy obiekt cech, więc wcześniejsi potomkowie
// zostają bez zmian, a cechę odziedziczą dopiero ci, którzy powstaną z niej po tej chwili.
function addTrait(...keys) {
  player.traits = { ...player.traits };
  for (const k of keys) player.traits[k] = true;
}

// Cechy innych linii życia (wspólne obiekty – potomkowie je dziedziczą)
let wildA = {}, wildB = {};   // cechy NOWO przybywających obcych komórek (istniejące się nie zmieniają)
const CYANO_T = { dna: true, bact: true, photo: true, oxygenic: true };
const ALPHA_T = { dna: true, bact: true, aerobic: true, flagellum: true };
const LINEAGE_CAP = { wild: 30, cyano: 20, alpha: 16 };

function newGame(ventIndex = 1) {
  world = new World();
  const v = world.vents[ventIndex] || world.vents[1];
  const low = location.hash.includes('low');   // test: start tuż nad dnem
  const high = location.hash.includes('high'); // test: start pod powierzchnią
  wildA = {};
  wildB = {};
  player = new Cell(v.x + (low ? 160 : 280), low ? v.y - 90 : high ? 60 : v.top - 220, { isPlayer: true, traits: {} });
  cells = [player];
  for (let i = 0; i < 14; i++) spawnLineage('wild', player);
  cam = { x: player.x, y: player.y, zoom: location.hash.includes('far') ? 0.8 : 1.6 };
  world.cam = cam;
  world.cells = cells;
  world.onLightning = x => {
    if (Math.abs(x - player.x) < 1000) {
      hintOnce('lightning', 'Błyskawica! Wyładowania tworzą w wodzie nowe związki organiczne – jak w doświadczeniu Millera–Ureya.', 'good');
      achieve('lightning');
    }
  };
  stats = {
    time: 0, divisions: 0, maxGen: 1, deaths: 0, kills: 0, evolution: null, eaten: 0, hotTime: 0, newAch: [], recorded: false,
    era: 1, obj: 0, c: {}, path: [], eraTime: 0, cheatTimer: 4, won: false,
  };
  achTimer = 0;
  hints = {};
  minimapBase = world.renderMinimapBase(mini.width, mini.height);
  $('toasts').innerHTML = '';
  $('evolve').classList.add('hidden');
  $('victory').classList.add('hidden');
  updateEraTitle();
  updateQuest();
}

// Inne linie życia: obce prokarionty (rywale i ofiary), sinice (era 3+), alfaproteobakterie (era 5+)
function spawnLineage(type, farFrom) {
  const E = world.env;
  const uvTop = UV_DEPTH * (1 - E.ozone);
  for (let tries = 0; tries < 30; tries++) {
    const x = rand(100, world.w - 100);
    const fl = world.floorAt(x);
    let y, o;
    if (type === 'wild') {
      y = E.o2 > 0.1 ? rand(1950, fl - 120) : rand(UV_DEPTH + 120, fl - 150);   // po utlenieniu – tylko w głębinach
      const tr = { ...(E.era >= 2 && Math.random() < 0.5 ? wildB : wildA) };
      o = { lineage: 'wild', hue: rand(290, 335), biomass: rand(10, 40), energy: 60, traits: tr };
    } else if (type === 'cyano') {
      y = rand(uvTop + 90, 950);
      o = { lineage: 'cyano', hue: rand(95, 125), biomass: rand(15, 45), energy: 70, traits: { ...CYANO_T } };
    } else {
      y = rand(700, 2100);
      o = { lineage: 'alpha', hue: rand(345, 360) % 360, biomass: rand(2, 15), energy: 70, traits: { ...ALPHA_T } };
    }
    if (y > fl - 60) continue;
    if (farFrom && Math.hypot(x - farFrom.x, y - farFrom.y) < 650) continue;
    if (world.heatAt(x, y) > 0.4) continue;
    cells.push(new Cell(x, y, o));
    return;
  }
}

// najwyżej 4 komunikaty naraz – najstarsze znikają
function trimToasts() {
  const box = $('toasts');
  while (box.children.length >= 4) box.firstElementChild.remove();
}

function toast(text, kind = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = text;
  trimToasts();
  $('toasts').appendChild(el);
  setTimeout(() => el.classList.add('out'), 5500);
  setTimeout(() => el.remove(), 6200);
}
// Osiągnięcie: zapis w profilu + wyróżniony komunikat (tylko dla zalogowanych)
function achieve(id) {
  if (!Profiles.unlock(id)) return;
  const a = ACH_BY_ID[id];
  stats.newAch.push(id);
  const el = document.createElement('div');
  el.className = 'toast ach-toast';
  el.innerHTML = `${a.icon} Osiągnięcie: <b>${esc(a.name)}</b> – ${esc(a.desc)}`;
  trimToasts();
  $('toasts').appendChild(el);
  setTimeout(() => el.classList.add('out'), 5000);
  setTimeout(() => el.remove(), 5700);
  renderProfileUI();
}

let achTimer = 0;
function checkAchievements(dt, mine) {
  const t = world.temperatureAt(player.x, player.y);
  stats.hotTime = t > 100 ? stats.hotTime + dt : 0;
  if (stats.hotTime >= 5) achieve('inferno');
  achTimer -= dt;
  if (achTimer > 0) return;
  achTimer = 0.5;
  if (stats.maxGen >= 10) achieve('gen10');
  if (mine >= 20) achieve('colony20');
  if (stats.eaten >= 300) achieve('feast');
  if (player.y < 60) achieve('surface');
  if (stats.time >= 300) achieve('survive5');
  if (stats.time >= 900) achieve('survive15');
}

function recordGame() {
  if (stats.recorded) return;
  stats.recorded = true;
  Profiles.recordGame(stats);
}
addEventListener('beforeunload', () => { if (stats && state !== 'intro') recordGame(); });

function hintOnce(key, text, kind) {
  if (hints[key]) return;
  hints[key] = true;
  toast(text, kind);
}

// ---------- Cele er ----------
const curObjective = () => ERAS[stats.era].objectives[stats.obj];
function objValue(o) { return o.live ? o.live() : (stats.c[o.key] || 0); }
function progress(key, amt = 1) {
  const o = curObjective();
  if (!o || o.live || o.key !== key) return;
  stats.c[key] = (stats.c[key] || 0) + amt;
}

function checkObjective() {
  const o = curObjective();
  if (!o || state !== 'play') return;
  if (objValue(o) >= o.goal) completeObjective();
}

function completeObjective() {
  const o = curObjective();
  if (o.done) { addTrait(o.done); onTraitGained(o.done); }
  if (o.key === 'cheat') {
    for (const c of cells) if (c.cheater && c.apop === 0 && isMine(c)) c.apop = 0.001;
    toast('Geny strażnicze! Organizm sam wykrywa zmutowane komórki i uruchamia w nich apoptozę – jak białko p53.', 'good');
  }
  stats.obj++;
  const era = ERAS[stats.era];
  if (stats.obj >= era.objectives.length) { updateQuest(); endEra(); return; }
  toast(`Cel osiągnięty: ${o.title}. Następny: ${curObjective().title}.`, 'good');
  updateQuest();
}

// Skutki nowych cech zdobytych przez wykonanie celu
function onTraitGained(t) {
  if (t === 'dna') {
    toast('Kod DNA! Podwójna nić jest trwalsza niż RNA – geny kopiują się z mniejszą liczbą błędów. Chromosom ma postać pierścienia.', 'good');
    achieve('dna');
  } else if (t === 'pumps') {
    toast('Chemiosmoza! Pompy jonowe i syntaza ATP – komórka zużywa mniej energii i może odpłynąć od kominów.', 'good');
  } else if (t === 'euk') {
    player.endo = 0;
    toast('Endosymbioza! Bakterie stały się mitochondriami. Komórka urosła, wytworzyła jądro i cytoszkielet – jest eukariontem.', 'good');
    if (player.traits.thermo || player.traits.arch) hintOnce('eukHeat', 'Uwaga: eukarionty nie znoszą wody gorętszej niż ok. 65°C – omijaj wyloty kominów.', 'bad');
    cam.zoom = Math.min(cam.zoom, 1.1);
    achieve('euk');
  } else if (t === 'sex') {
    toast('Mejoza! Rozmnażanie płciowe miesza geny – potomkowie różnią się od siebie, a ród szybciej się przystosowuje.', 'good');
    achieve('sex');
  } else if (t === 'special') {
    toast('Specjalizacja! Komórki na obrzeżu napędzają organizm wiciami, wewnętrzne stały się komórkami rozrodczymi.', 'good');
  }
}

function endEra() {
  const n = stats.era;
  const ach = { 1: 'quest1', 2: 'luca', 3: 'mat', 4: 'oxygen', 6: 'multi', 7: 'ediacara', 8: 'cambrian' }[n];
  if (ach) achieve(ach);
  const era = ERAS[n];
  if (era.ending) { victory(era.ending); return; }
  // wybór może prowadzić do kolejnej ery albo do zakończenia (ślepa gałąź)
  if (era.endChoice) openChoice(era.endChoice, key => (OPTIONS[key].ending ? victory(OPTIONS[key].ending) : afterEra()));
  else afterEra();
}

function afterEra() {
  const era = ERAS[stats.era];
  const next = typeof era.next === 'function' ? era.next(player.traits) : era.next;
  openEraIntro(next);
}

// Ery na drodze rozwoju bieżącego rodu (do osi czasu)
function lineageEras(n) {
  const t = player ? player.traits : {};
  const list = [1, 2, 3, 4, 5, 6];
  if (n >= 13 || t.alga) list.push(13, 14);
  else if (n >= 7 || t.predator) {
    list.push(7, 8);
    if (n === 9 || t.arthro) list.push(9); else list.push(10, 11, 12);
  }
  return list;
}

function pauseForOverlay() {
  state = 'evolve';
  keys.clear();
  mouse.down = false;
}

function renderTimeline(n) {
  const list = lineageEras(n), at = list.indexOf(n);
  $('timeline').style.gridTemplateColumns = `repeat(${list.length}, 1fr)`;
  $('timeline').innerHTML = list.map((k, i) =>
    `<div class="tl ${i < at ? 'past' : i === at ? 'now' : ''}"><b>${ERAS[k].col}</b><span>${ERAS[k].name}</span></div>`).join('');
}

// Rozdroże: karty wyboru drogi
function openChoice(setKey, then) {
  pauseForOverlay();
  const set = CHOICES[setKey];
  $('evo-kicker').textContent = set.kicker;
  $('evo-title').textContent = set.title;
  $('evo-lead').textContent = set.lead;
  renderTimeline(stats.era);
  $('evo-go').classList.add('hidden');
  $('cards').classList.remove('hidden');
  buildChoiceUI(setKey, player.traits, key => {
    if (state !== 'evolve') return;
    applyChoice(key);
    then(key);
  });
  $('evolve').classList.remove('hidden');
}

function applyChoice(key) {
  addTrait(key);   // tylko Twoja komórka – potomkowie dostaną cechę przy kolejnych podziałach
  stats.path.push(key);
  if (!stats.evolution) stats.evolution = key;
  toast(OPTIONS[key].toast, 'good');
  Profiles.recordPath(key);
  achieve('evo_' + key);
  if (Object.keys(CHOICES.era1.options).every(k => Profiles.has('evo_' + k))) achieve('allPaths');
}

// Ekran nowej ery: opis i (opcjonalnie) wybór drogi na start
function openEraIntro(n) {
  pauseForOverlay();
  const era = ERAS[n];
  renderTimeline(n);
  if (era.startChoice) {
    openChoice(era.startChoice, () => startEra(n));
    renderTimeline(n);
    return;
  }
  $('evo-kicker').textContent = `Era ${era.col} · ${era.when}`;
  $('evo-title').textContent = era.name;
  $('evo-lead').textContent = era.intro || '';
  $('cards').classList.add('hidden');
  $('cards').innerHTML = '';
  evoUI.cards = [];
  $('evo-go').classList.remove('hidden');
  $('evo-go').onclick = () => startEra(n);
  $('evolve').classList.remove('hidden');
}

function startEra(n) {
  if (ERAS[n].creature) LifeEras.setup(n);   // nowa mapa z wybrzeżem i ród jako organizm wielokomórkowy
  stats.era = n;
  stats.obj = 0;
  stats.c = {};
  stats.eraTime = 0;
  world.env.era = n;
  if (!stats.test) Profiles.saveCheckpoint(n, stats.path);
  if (n === 2) {
    wildA = { dna: true, arch: true };
    wildB = { dna: true, bact: true };
    hintOnce('era2', 'Nukleotydy (niebieskie) wypływają z kominów alkalicznych – jasnych wież węglanowych.');
  }
  if (n === 3) {
    addTrait('biofilm');
    for (let i = 0; i < 6; i++) spawnLineage('cyano');
    hintOnce('era3', 'Pojawiły się sinice (zielone pałeczki pod strefą UV) – pierwsze organizmy, które rozkładają wodę i uwalniają tlen.');
  }
  if (n === 4 && player.traits.photo) {
    addTrait('oxygenic');
    toast('Twój ród to teraz sinice: fotosynteza tlenowa rozkłada wodę – to Ty wytwarzasz tlen!', 'good');
  }
  if (n === 5) {
    world.env.o2 = 1;
    for (let i = 0; i < 8; i++) spawnLineage('alpha', player);
  }
  if (n === 6) {
    addTrait('adhesion');
    world.env.ice = Math.max(world.env.ice, 0.3);
    for (const c of cells) if (c.colony) { c.colony = false; c.slot = -1; }
    player.colony = true;
    player.slot = 0;
    cam.zoom = Math.min(cam.zoom, 0.9);
    hintOnce('snowball', 'Ziemia-śnieżka! Lód zasłania światło. Ciepło i pożywienie znajdziesz przy kominach.', 'bad');
  }
  $('evolve').classList.add('hidden');
  state = 'play';
  last = performance.now();
  minimapBase = world.renderMinimapBase(mini.width, mini.height);
  updateEraTitle();
  updateQuest();
  toast(`Era ${ERAS[n].col}: ${ERAS[n].name}. Cel: ${curObjective().title}.`, 'good');
  if (ERAS[n].creature) hintOnce('creature', 'Jesteś organizmem wielokomórkowym. Jedz, rośnij i wydawaj potomstwo (SPACJA). Gdy zginiesz, przejmiesz potomka.');
}

// Harmonogram zmian planety w danej erze
function updateEnvSchedule(dt) {
  const E = world.env;
  if (stats.era === 4) {
    E.o2 = Math.min(1, E.o2 + dt / 150);
    E.iceTarget = E.o2 > 0.35 && E.o2 < 0.7 ? 1 : 0;   // zlodowacenie hurońskie
    if (E.o2 > 0.05) hintOnce('o2', 'Tlen! Dla beztlenowców to trucizna. Obce komórki giną albo uciekają na dno.', 'bad');
    if (E.ice > 0.4) hintOnce('huron', 'Zlodowacenie hurońskie: tlen zniszczył metan, który ogrzewał planetę. Ocean zamarza od góry.', 'bad');
    if (E.ozone > 0.5 && !hints.ozone) {
      hintOnce('ozone', 'Powstała warstwa ozonowa – promieniowanie UV słabnie, niebo staje się błękitne.', 'good');
      minimapBase = world.renderMinimapBase(mini.width, mini.height);
    }
  } else if (stats.era >= 5) {
    E.o2 = 1;
    E.iceTarget = stats.era === 6 && stats.eraTime < 60 ? 1 : 0;   // Ziemia-śnieżka na początku Ery 6
  } else {
    E.iceTarget = 0;
  }
}

function tryDivide() {
  if (!player.canDivide) return;
  if (cells.filter(isMine).length >= 60) { toast('Ocean jest przepełniony – za mało miejsca na podział.'); return; }
  const partner = player.traits.euk && stats.era === 5 && curObjective()?.key === 'meio'
    ? cells.find(c => c !== player && c.alive && isMine(c) && c.traits.euk && Math.hypot(c.x - player.x, c.y - player.y) < player.radius * 5)
    : null;
  const d = player.divide();
  cells.push(d);
  if (player.creature) LifeEras.onReproduce(d);
  if (player.colony && player.traits.adhesion && !d.cheater) Colony.join(d);
  if (partner) {
    d.hue = (player.hue + partner.hue) / 2 + rand(-6, 6);   // rekombinacja – cechy obu rodziców
    progress('meio');
    hintOnce('meio', 'Rekombinacja! Potomek łączy geny dwóch komórek rodu.', 'good');
  }
  stats.divisions++;
  progress('div');
  stats.maxGen = Math.max(stats.maxGen, player.generation);
  achieve('firstDivide');
  hintOnce('firstDivide', 'Pierwszy podział! Potomek żyje samodzielnie. Jeśli zginiesz, przejmiesz kontrolę nad najbliższym potomkiem.', 'good');
  if (stats.era === 6) hintOnce('adhesion', 'Adhezja: potomek został przyklejony do Ciebie. Kolonia porusza się razem.', 'good');
  updateQuest();
}

// Apoptoza najbliższej komórki-oszustki
function tryApoptosis() {
  let best = null, bd = Infinity;
  for (const c of cells) {
    if (!c.alive || !c.cheater || c.apop > 0 || !isMine(c)) continue;
    const d = Math.hypot(c.x - player.x, c.y - player.y);
    if (d < bd) { bd = d; best = c; }
  }
  if (!best) return;
  best.apop = 0.001;
  hintOnce('apop', 'Apoptoza: komórka sama się rozkłada na pęcherzyki, które zjedzą sąsiedzi. Organizm jest ważniejszy niż jedna komórka.', 'good');
}

// ---------- Interakcje specjalne ----------

// Era 3: komórki rodu blisko siebie tworzą matę połączoną śluzem
function updateMats(dt) {
  matTimer -= dt;
  if (matTimer <= 0) {
    matTimer = 0.25;
    matPairs = [];
    const mine = cells.filter(c => c.alive && isMine(c) && !c.colony && !c.creature && c.traits.biofilm);
    for (const c of mine) c.inMat = false;
    for (let i = 0; i < mine.length; i++) {
      for (let j = i + 1; j < mine.length; j++) {
        const a = mine[i], b = mine[j];
        const lim = (a.radius + b.radius) * 2.4;
        if ((a.x - b.x) ** 2 + (a.y - b.y) ** 2 < lim * lim) matPairs.push([a, b]);
      }
    }
    const deg = new Map();
    for (const [a, b] of matPairs) { deg.set(a, (deg.get(a) || 0) + 1); deg.set(b, (deg.get(b) || 0) + 1); }
    for (const [c, n] of deg) if (n >= 2) c.inMat = true;
  }
  for (const [a, b] of matPairs) {
    if (!a.alive || !b.alive) continue;
    const f = (a.energy - b.energy) * Math.min(1, dt * 0.6);
    a.energy -= f; b.energy += f;
  }
  if (stats.era === 3) {
    let near = 0;
    for (const c of cells) if (c.alive && isMine(c) && c.traits.biofilm && Math.hypot(c.x - player.x, c.y - player.y) < 230) near++;
    if (near >= 6) { progress('mat', dt); hintOnce('mat', 'Mata mikrobiologiczna! Wspólny śluz osłania przed UV i rozprowadza energię.', 'good'); }
    else hintOnce('quorum', 'Komórki rodu wyczuwają się nawzajem (quorum sensing) i zbierają wokół Ciebie. Poczekaj na nie albo podziel się.');
  }
}

// Era 5: symbioza z alfaproteobakterią – wypustki błony archeona otaczają bakterię
function updateSymbiosis(dt) {
  const active = stats.era === 5 && curObjective()?.key === 'sym';
  for (const c of cells) {
    if (c.lineage !== 'alpha' || !c.alive) continue;
    const d = Math.hypot(c.x - player.x, c.y - player.y);
    if (active && d < player.radius + c.radius + 55) {
      c.bond += dt;
      hintOnce('bond', 'Symbioza: wypustki Twojej błony oplatają bakterię. Zostań przy niej.', 'good');
      if (c.bond >= 5) {
        c.alive = false;
        c.eaten = true;
        player.endo = Math.min(5, player.endo + 1);
        player.gulp(c.x - player.x, c.y - player.y, [230, 120, 130], 4, 40);
        progress('sym');
        toast(`Endosymbiont ${stats.c.sym || 0}/3: bakteria żyje w Twoim wnętrzu i dzieli się energią z oddychania tlenowego.`, 'good');
      }
    } else c.bond = Math.max(0, c.bond - dt * 0.5);
  }
}

// Era 6: oszustki pojawiają się w wyspecjalizowanym organizmie
function updateCheaters(dt) {
  if (!player.traits.special || stats.era !== 6) return;
  if (curObjective()?.key !== 'cheat') return;   // po tym celu organizm sam pilnuje swoich komórek
  if (cells.some(c => c.alive && c.cheater && c.apop === 0 && c.colony)) return;   // najwyżej jedna naraz
  stats.cheatTimer -= dt;
  if (stats.cheatTimer > 0) return;
  stats.cheatTimer = rand(6, 10);
  const cand = Colony.members().filter(c => c !== player && !c.cheater && c.apop === 0);
  if (!cand.length) return;
  const c = cand[Math.floor(Math.random() * cand.length)];
  c.cheater = true;
  hintOnce('cheater', 'Komórka-oszustka! Mutacja sprawiła, że dzieli się bez kontroli i podkrada energię – jak nowotwór. Naciśnij E.', 'bad');
}

// ---------- Aktualizacja ----------
function update(dt) {
  stats.time += dt;
  stats.eraTime += dt;
  updateEnvSchedule(dt);
  world.focusX = player.x;
  world.cells = cells;
  world.anchor = player;
  world.update(dt);

  for (const c of cells) {
    const dir = c === player ? playerDir() : c.colony ? [0, 0] : c.aiDir(dt, world);
    c.update(dt, world, dir);
  }
  Colony.update(dt);

  // Pochłanianie cząsteczek
  for (const p of world.particles) {
    const fs = FOOD[p.type].size;
    for (const c of cells) {
      if (c.apop > 0 || c.noEat) continue;
      const dx = p.x - c.x, dy = p.y - c.y;
      const r = c.radius + fs;
      if (dx * dx + dy * dy < r * r) {
        c.eat(p, world);
        p.dead = true;
        if (c === player) stats.eaten++;
        if (p.type === 'nucleotide' && isMine(c)) progress('nuc');
        if (c.creature) LifeEras.onEat(c, p);
        break;
      }
    }
  }
  if (!player.creature && player.metaGain > 0) { progress('meta', player.metaGain); player.metaGain = 0; }
  for (const c of cells) if (c !== player) c.metaGain = 0;

  // Chemiosmoza: ciepła woda przy kominie alkalicznym
  if (stats.era === 2) {
    const v = world.nearestVent(player.x);
    const h = world.ventHeat(v, player.x, player.y);
    if (v.type === 'alkaline' && h > 0.12) { progress('chemi', dt); hintOnce('chemi', 'Gradient pH! Różnica między zasadową wodą komina a kwaśnym oceanem ładuje Twoją błonę.', 'good'); }
  }

  const onKill = (c, o) => {
    if (c !== player) return;
    if (o && o.lineage === c.lineage) {
      hintOnce('cannibal', 'Pochłonąłeś słabiej rozwiniętego krewnego. Dobór naturalny działa też wewnątrz rodu.', 'good');
      return;
    }
    stats.kills++;
    hintOnce('firstKill', 'Pierwsza ofiara! Strawiona komórka to porcja energii i biomasy.', 'good');
    achieve('firstKill');
    if (stats.kills >= 10) achieve('kills10');
  };
  // Drapieżnictwo
  for (const c of cells) {
    if (!c.canHunt || !c.alive || c.apop > 0) continue;
    const external = !c.traits.euk;   // prokarionty trawią enzymami z zewnątrz, eukarionty połykają
    for (const o of cells) {
      if (!c.canEat(o) || (o.lineage === 'alpha' && stats.era === 5 && !c.traits.euk)) continue;
      const d = Math.hypot(o.x - c.x, o.y - c.y);
      if (external) {
        if (d > c.radius * 1.7 + o.radius * 0.5) continue;
        o.health -= 28 * dt;
        o.lysing = 1;
        c.energy = Math.min(100, c.energy + 2 * dt);
        if (o.health <= 0) { o.alive = false; o.eaten = true; c.eatCell(o, true); onKill(c, o); }
      } else if (d < c.radius + o.radius * 0.9) {
        c.eatCell(o);
        o.alive = false;
        o.eaten = true;
        onKill(c, o);
      }
    }
  }

  if (ERAS[stats.era].creature) LifeEras.update(dt);
  updateSymbiosis(dt);
  updateMats(dt);
  updateCheaters(dt);
  if (stats.era === 6 && Colony.size() >= 5) {
    progress('sig', dt);
    if (curObjective()?.key === 'sig') hintOnce('sig', 'Komórki kolonii wymieniają sygnały chemiczne – zaczyna się podział pracy.', 'good');
  }

  // Zderzenia komórek
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      const a = cells[i], b = cells[j];
      if (!a.alive || !b.alive || (a.colony && b.colony) || a.ghost || b.ghost || a.creature || b.creature) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const min = (a.radius + b.radius) * 0.92;
      const d2 = dx * dx + dy * dy;
      if (d2 < min * min && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        const push = (min - d) / 2;
        const nx = dx / d, ny = dy / d;
        const wa = a.colony ? 0.2 : 1, wb = b.colony ? 0.2 : 1;
        a.x -= nx * push * wa; a.y -= ny * push * wa;
        b.x += nx * push * wb; b.y += ny * push * wb;
      }
    }
  }

  // Samodzielne podziały
  const count = { player: 0, wild: 0, cyano: 0, alpha: 0 };
  for (const c of cells) if (c.alive) count[c.lineage] = (count[c.lineage] || 0) + 1;
  const born = [];
  for (const c of cells) {
    if (c === player || !c.alive || !c.canDivide) continue;
    if (isMine(c)) {
      if (count.player >= (ERAS[stats.era].creature ? 10 : 45)) continue;
      const d = c.divide();
      born.push(d);
      if (c.colony && c.traits.adhesion && !d.cheater) Colony.join(d);   // potomek oszustki odpływa (traci adhezję)
      count.player++;
      stats.maxGen = Math.max(stats.maxGen, c.generation);
    } else if (count[c.lineage] < LINEAGE_CAP[c.lineage]) {
      born.push(c.divide());
      count[c.lineage]++;
    }
  }
  cells.push(...born);

  // Napływ innych linii, gdy jest ich mało
  spawnTimer -= dt;
  if (spawnTimer <= 0 && !ERAS[stats.era].creature) {
    spawnTimer = 3;
    const era = stats.era;
    if (count.wild < (era >= 4 ? 5 : 10)) spawnLineage('wild', player);
    if (era >= 3 && count.cyano < 8) spawnLineage('cyano', player);
    if (era >= 5 && count.alpha < 8) spawnLineage('alpha', player);
  }

  // Śmierć
  for (const c of cells) {
    if (c.alive) continue;
    if (!c.eaten) world.spawnRemains(c.x, c.y);
    if (c.cheater && c.apop > 0) {
      progress('cheat');
      if ((stats.c.cheat || 0) >= 3) achieve('guardian');
    }
    stats.deaths++;
  }
  if (!player.alive) {
    const alive = cells.filter(c => c.alive && isMine(c) && !c.cheater);
    if (alive.length) {
      const wasColony = player.colony;
      // pierwszeństwo: komórka kolonii, potem najbardziej rozwinięta (najwięcej cech), potem najbliższa
      const nTr = c => Object.keys(c.traits).length;
      const lost = Object.keys(player.traits);
      alive.sort((a, b) => (b.colony - a.colony) || (nTr(b) - nTr(a)) ||
        Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y));
      player.isPlayer = false;
      player = alive[0];
      player.isPlayer = true;
      const missing = lost.filter(k => !player.traits[k] && OPTIONS[k]).map(k => OPTIONS[k].name);
      if (missing.length) toast(`Ten potomek urodził się przed ewolucją – nie ma cech: ${missing.join(', ')}.`, 'bad');
      if (wasColony) {
        if (!player.colony) { player.colony = true; player.slot = 0; }
        else Colony.recenter(player);
      }
      toast(`Twoja komórka zginęła. Ród trwa – sterujesz potomkiem (pokolenie ${player.generation}).`, 'bad');
    } else {
      cells = [];
      gameOver();
      return;
    }
  }
  cells = cells.filter(c => c.alive);
  world.particles = world.particles.filter(p => !p.dead);

  checkAchievements(dt, count.player);
  checkObjective();
  updateHints();

  // Kamera
  const k = Math.min(1, dt * 4);
  cam.x += (player.x - cam.x) * k;
  cam.y += (player.y - cam.y) * k;
  const hw = vw / 2 / cam.zoom, hh = vh / 2 / cam.zoom;
  cam.x = world.w > hw * 2 ? clamp(cam.x, hw, world.w - hw) : world.w / 2;
  cam.y = clamp(cam.y, -520 + hh, world.h - hh);
}

function updateHints() {
  const heat = world.heatAt(player.x, player.y);
  const tr = player.traits;
  if (!player.creature && world.uvAt(player.y) > 0.1) hintOnce('uv', 'Promieniowanie UV niszczy RNA! Brak warstwy ozonowej – uciekaj w głąb.', 'bad');
  if (heat > player.heatLimit) hintOnce('heat', 'Za gorąco! Przy kominie białka i kwasy nukleinowe ulegają rozpadowi.', 'bad');
  if (heat > 0.25 && heat < 0.6) hintOnce('warm', 'Ciepłe źródła: tu komin wyrzuca bogate w energię minerały (pomarańczowe).');
  if (player.energy < 20) hintOnce('hunger', 'Mało energii – pochłaniaj świecące cząsteczki.', 'bad');
  if (player.canDivide) {
    if (player.creature) hintOnce('canBrood', player.P.plant ? 'Biomasa pełna – naciśnij SPACJĘ, aby rozsiać zarodniki!' : 'Biomasa pełna – naciśnij SPACJĘ, aby wydać potomstwo!', 'good');
    else hintOnce('canDivide', 'Biomasa pełna – naciśnij SPACJĘ, aby się podzielić!', 'good');
  }
  if (world.o2At(player.x, player.y) > 0.1 && player.o2Resist < 0.5) hintOnce('o2deep', 'Tlen Cię niszczy! Zejdź głębiej – przy dnie woda jest jeszcze beztlenowa.', 'bad');
  if ((tr.photo || tr.alga) && stats.era >= 3 && (!player.creature || player.P.plant)) hintOnce('light', 'Fotosynteza działa najlepiej w jasnej wodzie. Im głębiej, tym mniej światła.');
  if (!hints.wild && cells.some(c => c.lineage === 'wild' && Math.hypot(c.x - player.x, c.y - player.y) < 350)) {
    hintOnce('wild', 'Obce prokarionty (różowe) – inna linia życia. Rywalizują z Tobą o pożywienie.');
  }
}

function gameOver() {
  state = 'dead';
  const m = Math.floor(stats.time / 60), s = Math.floor(stats.time % 60);
  $('go-stats').innerHTML =
    `Czas przetrwania rodu: <b>${m} min ${s} s</b><br>` +
    `Osiągnięta era: <b>${ERAS[stats.era].col} · ${ERAS[stats.era].name}</b><br>` +
    `Najwyższe pokolenie: <b>${stats.maxGen}</b><br>` +
    `Twoje podziały: <b>${stats.divisions}</b><br>` +
    `Drogi ewolucji: <b>${stats.path.length ? stats.path.map(k => OPTIONS[k].name).join(' → ') : 'brak'}</b>`;
  recordGame();
  renderNewAch($('go-ach'));
  $('gameover').classList.remove('hidden');
}

function renderNewAch(el) {
  const p = Profiles.profile;
  if (!p) {
    el.innerHTML = '<p class="note">Wybierz gracza w menu, aby zapisywać osiągnięcia.</p>';
  } else if (stats.newAch.length) {
    el.innerHTML = '<div class="kicker">Nowe osiągnięcia</div><div class="ach-grid">' +
      stats.newAch.map(id => { const a = ACH_BY_ID[id];
        return `<div class="ach got"><span class="ach-icon">${a.icon}</span><span class="ach-name">${esc(a.name)}</span><span class="ach-desc">${esc(a.desc)}</span></div>`;
      }).join('') + '</div>';
  } else {
    el.innerHTML = `<p class="note">Osiągnięcia: ${Profiles.count()} / ${ACHIEVEMENTS.length}</p>`;
  }
}

function victory(key) {
  pauseForOverlay();
  stats.won = true;
  const end = ENDINGS[key];
  achieve(end.land ? { arthroLand: 'landArthro', tetrapod: 'tetrapod', landPlant: 'landPlant' }[key] : 'deadEnd');
  if (!stats.test) Profiles.saveCheckpoint(99, stats.path, key);
  $('vic-kicker').textContent = `${end.when} · ${end.land ? 'wyjście z wody' : 'ślepa gałąź – ten ród zostaje w wodzie'}`;
  $('vic-title').textContent = end.title;
  $('vic-text').textContent = end.text;
  const m = Math.floor(stats.time / 60), s = Math.floor(stats.time % 60);
  $('vic-stats').innerHTML =
    `Miliardy lat ewolucji w <b>${m} min ${s} s</b> · pokolenie <b>${stats.maxGen}</b><br>` +
    `Twoja droga: <b>${stats.path.map(k => OPTIONS[k].name).join(' → ')}</b>`;
  recordGame();
  renderNewAch($('vic-ach'));
  $('victory').classList.remove('hidden');
}

// ---------- Rysowanie ----------
function drawMat(ctx) {
  if (!matPairs.length) return;
  ctx.strokeStyle = 'rgba(205,215,170,0.16)';
  ctx.lineCap = 'round';
  for (const [a, b] of matPairs) {
    if (!a.alive || !b.alive) continue;
    ctx.lineWidth = Math.min(a.radius, b.radius) * 1.1;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  for (const c of cells) {
    if (!c.inMat) continue;
    const R = c.radius * 2.1;
    const g = ctx.createRadialGradient(c.x, c.y, c.radius * 0.8, c.x, c.y, R);
    g.addColorStop(0, 'rgba(205,215,170,0.13)');
    g.addColorStop(1, 'rgba(205,215,170,0)');
    ctx.fillStyle = g;
    ctx.fillRect(c.x - R, c.y - R, R * 2, R * 2);
  }
}

// Wypustki błony oplatające alfaproteobakterię + pierścień postępu symbiozy
function drawBonds(ctx, t) {
  for (const c of cells) {
    if (c.lineage !== 'alpha' || c.bond <= 0) continue;
    const u = Math.min(1, c.bond / 5);
    const dx = c.x - player.x, dy = c.y - player.y;
    const d = Math.hypot(dx, dy) || 1;
    const nx = -dy / d, ny = dx / d;
    ctx.strokeStyle = `hsla(${player.hue},60%,80%,${0.35 + u * 0.4})`;
    ctx.lineWidth = 1.2;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      for (let s = 0; s <= 12; s++) {
        const v = s / 12;
        const reach = Math.min(1, u * 1.6 + 0.2);
        if (v > reach) break;
        const w = Math.sin(v * 9 + t * 4 + i) * 4 + i * c.radius * 0.8 * v;
        const px = player.x + dx * (0.85 * player.radius / d + v * (1 - player.radius / d)) + nx * w;
        const py = player.y + dy * (0.85 * player.radius / d + v * (1 - player.radius / d)) + ny * w;
        if (s === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,220,140,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.radius * 1.3 + 6, -Math.PI / 2, -Math.PI / 2 + u * TAU);
    ctx.stroke();
  }
}

function render() {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#03070c';
  ctx.fillRect(0, 0, vw, vh);
  if (!world) return;

  const z = cam.zoom;
  const view = {
    x0: cam.x - vw / 2 / z, x1: cam.x + vw / 2 / z,
    y0: cam.y - vh / 2 / z, y1: cam.y + vh / 2 / z,
  };

  ctx.save();
  ctx.translate(vw / 2, vh / 2);
  ctx.scale(z, z);
  ctx.translate(-cam.x, -cam.y);
  world.drawBackground(ctx, view);
  world.drawFloor(ctx, view);
  world.drawLand(ctx, view);
  world.drawVents(ctx, view);
  world.drawParticles(ctx, view);
  if (state !== 'intro') {
    drawMat(ctx);
    Colony.drawMatrix(ctx);
  }
  for (const c of cells) {
    const R = c.radius * 3;
    if (c.x + R < view.x0 || c.x - R > view.x1 || c.y + R < view.y0 || c.y - R > view.y1) continue;
    c.draw(ctx, world.time);
  }
  if (player) drawBonds(ctx, world.time);
  world.drawSurface(ctx, view);
  world.drawUVOverlay(ctx, view);
  ctx.restore();

  world.drawSnow(ctx, cam, vw, vh);
  LifeEras.drawIndicators(ctx);

  // Winieta
  const vg = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.35, vw / 2, vh / 2, Math.max(vw, vh) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, vw, vh);

  drawMinimap(view);
}

const MINI_COL = { wild: '#e070d0', cyano: '#9be05a', alpha: '#ff6060', pred: '#ff4040', prey: '#c8d8e8', grazer: '#c8a070', landprey: '#b08060' };
function drawMinimap(view) {
  const w = mini.width, h = mini.height;
  const sx = w / world.w, sy = h / world.h;
  mctx.drawImage(minimapBase, 0, 0);
  if (world.env.ice > 0.05) {
    mctx.fillStyle = `rgba(230,240,250,${world.env.ice * 0.8})`;
    mctx.fillRect(0, 0, w, 3);
  }
  for (const c of cells) {
    if (c.ghost || c.lineage === 'decor') continue;
    mctx.fillStyle = c === player ? '#ffffff' : isMine(c) ? (c.creature ? '#9ff5e0' : `hsl(${c.hue},80%,65%)`) : MINI_COL[c.lineage] || '#888';
    const r = c === player ? 3 : 1.6;
    mctx.fillRect(c.x * sx - r, c.y * sy - r, r * 2, r * 2);
  }
  mctx.strokeStyle = 'rgba(255,255,255,0.6)';
  mctx.lineWidth = 1;
  mctx.strokeRect(view.x0 * sx, view.y0 * sy, (view.x1 - view.x0) * sx, (view.y1 - view.y0) * sy);
}

// ---------- HUD ----------
function updateEraTitle() {
  const n = stats ? stats.era : 1;
  $('hud-era').textContent = `Era ${ERAS[n].col} · ${ERAS[n].name}`;
  document.title = `EVOL – ${ERAS[n].name}`;
}

function updateQuest() {
  const era = ERAS[stats.era];
  const o = curObjective();
  $('q-kicker').textContent = `Era ${ERAS[stats.era].col} · cel ${Math.min(stats.obj + 1, era.objectives.length)} z ${era.objectives.length}`;
  $('q-list').innerHTML = era.objectives.map((x, i) =>
    `<li class="${i < stats.obj ? 'done' : i === stats.obj ? 'now' : ''}">${x.title}</li>`).join('');
  if (!o) {
    $('q-title').textContent = 'Era ukończona';
    $('q-desc').textContent = '';
    $('q-progress').style.display = 'none';
    $('quest').classList.add('done');
    return;
  }
  $('q-title').textContent = o.title;
  $('q-desc').textContent = o.desc;
  $('q-progress').style.display = '';
  $('quest').classList.remove('done');
  updateQuestProgress();
}

function updateQuestProgress() {
  const o = curObjective();
  if (!o) return;
  const v = Math.min(o.goal, objValue(o));
  $('q-fill').style.width = (v / o.goal * 100) + '%';
  $('q-count').textContent = o.unit ? `${Math.floor(v)}${o.unit}` : `${Math.floor(v)} / ${o.goal}`;
}

let hudTimer = 0;
function updateHUD(dt) {
  hudTimer -= dt;
  if (hudTimer > 0 || !player) return;
  hudTimer = 0.1;
  const setBar = (id, v) => {
    $('b-' + id).style.width = v + '%';
    $('v-' + id).textContent = Math.round(v);
  };
  setBar('energy', player.energy);
  setBar('health', Math.max(0, player.health));
  setBar('biomass', player.biomass);
  let mine = 0;
  for (const c of cells) if (isMine(c)) mine++;
  $('s-gen').textContent = player.generation;
  $('s-pop').textContent = player.colony ? `${mine} (kolonia ${Colony.size()})` : mine;
  $('s-wild').textContent = cells.filter(c => !c.ghost && c.lineage !== 'decor').length - mine;
  $('l-wild').textContent = player.creature ? 'Inne organizmy' : 'Inne komórki';
  $('hud').classList.toggle('cr-mode', !!player.creature);
  if (player.creature) {
    $('s-water').textContent = Math.round(player.water) + '%';
    $('s-water').className = player.water < 40 ? 'warn' : '';
    $('s-breath').textContent = Math.round(player.breath) + '%';
    $('s-breath').className = player.breath < 40 ? 'warn' : '';
  }
  $('s-zone').textContent = world.zoneAt(player.x, player.y);
  const temp = world.temperatureAt(player.x, player.y);
  $('s-temp').textContent = Math.round(temp) + '°C';
  $('s-temp').className = world.heatAt(player.x, player.y) > player.heatLimit ? 'warn' : '';
  const uv = world.uvAt(player.y);
  $('s-uv').textContent = uv > 0.005 ? Math.round(uv * 100) + '%' : 'brak';
  $('s-uv').className = uv > 0.05 && !player.creature ? 'warn' : '';
  const o2 = world.o2At(player.x, player.y);
  $('s-o2').textContent = world.env.o2 > 0.005 ? Math.round(o2 * 100) + '%' : 'brak';
  $('s-o2').className = o2 > 0.1 && player.o2Resist < 0.5 ? 'warn' : '';
  $('s-light').textContent = Math.round(world.lightAt(player.y) * 100) + '%';
  $('s-depth').textContent = Math.max(0, Math.round(player.y / 10)) + ' m';
  const pt = player.traits;   // cechy komórki, którą akurat sterujesz
  $('s-traits').innerHTML = stats.path.filter(k => pt[k]).map(k => `<span class="chip">${OPTIONS[k].short}</span>`).join('') +
    (pt.dna ? '<span class="chip dim">DNA</span>' : '<span class="chip dim">RNA</span>') +
    (pt.euk ? '<span class="chip dim">Eukariont</span>' : '');
  $('divide-hint').textContent = player.creature ? (player.P.plant ? 'SPACJA – rozsiej zarodniki' : 'SPACJA – wydaj potomstwo')
    : player.colony ? 'SPACJA – podział (potomek dołącza do kolonii)' : 'SPACJA – podział komórki';
  $('divide-hint').classList.toggle('show', player.canDivide);
  $('apop-hint').classList.toggle('show', cells.some(c => c.cheater && c.apop === 0 && isMine(c)));
  $('hud').classList.toggle('danger', player.dmgRate > 1);
  updateQuestProgress();
}

// ---------- Pętla ----------
let last = performance.now();
function frame(now) {
  const dt = clamp((now - last) / 1000, 0, 0.05);   // nigdy ujemny (np. po wznowieniu z menu)
  last = now;
  requestAnimationFrame(frame);   // najpierw – pojedynczy błąd nie zatrzyma gry
  try {
    if (state === 'play') update(dt);
    else if (world) world.update(dt * 0.5);   // tło żyje także za ekranami menu
    render();
    if (state === 'play') updateHUD(dt);
    if (state === 'evolve') drawChoicePreviews(dt);
  } catch (err) {
    console.error(err);
  }
}

function startGame(ventIndex) {
  showOnly(null);
  $('gameover').classList.add('hidden');
  newGame(ventIndex);
  state = 'play';
  $('quest').classList.remove('hidden');
}

function toMenu() {
  $('gameover').classList.add('hidden');
  $('victory').classList.add('hidden');
  $('quest').classList.add('hidden');
  state = 'intro';
  showTitle();
}

$('start').addEventListener('click', () => menuHandlers.onNew());
$('restart').addEventListener('click', () => startGame());
$('go-menu').addEventListener('click', toMenu);
$('vic-menu').addEventListener('click', toMenu);
$('vic-continue').addEventListener('click', () => {
  $('victory').classList.add('hidden');
  state = 'play';
  last = performance.now();
});

// Ekran logowania albo od razu menu, jeśli ktoś jest już zalogowany
initProfileUI({
  onNew: () => {
    startGame();
    setTimeout(() => toast('Jesteś pierwszą komórką. Pochłaniaj cząsteczki, rośnij i podziel się.', 'good'), 600);
  },
  onCheckpoint: (era, picks) => {
    if (era <= 1) { menuHandlers.onNew(); return; }
    startFromCheckpoint(era, picks);
  },
});
showTitle();

// Tło za ekranem startowym
world = new World();
cells = [];
cam = { x: world.vents[1].x + 200, y: world.vents[1].top - 300, zoom: 0.9 };
world.cam = cam;
player = null;
minimapBase = world.renderMinimapBase(mini.width, mini.height);
requestAnimationFrame(frame);

// ---------- Start z zapisanego etapu ----------
// Odtwarza cechy z gałęzi `picks` i zaczyna erę `n` od początku (z jedną komórką).
function applyHistory(n, picks) {
  for (const k of picks) if (OPTIONS[k]) addTrait(k);
  stats.path = [...picks];
  if (n > 2) { addTrait('dna', 'pumps'); wildA = { dna: true, arch: true }; wildB = { dna: true, bact: true }; }
  if (n > 3) addTrait('biofilm');
  if (n > 4) { if (player.traits.photo) addTrait('oxygenic'); world.env.o2 = 1; world.env.ozone = 1; }
  if (n > 5) addTrait('euk', 'sex');
  if (n > 6) addTrait('adhesion', 'special');
  const animal = picks.includes('predator');
  if (animal && n > 8) addTrait('eyes');
  if (animal && n > 11) addTrait('lungs');
  stats.evolution = picks[0] || null;
  stats.era = n - 1;
}

function startFromCheckpoint(n, picks) {
  startGame();
  applyHistory(n, picks);
  player.biomass = 60;
  startEra(n);
}

// ---------- Skróty do testów ----------
// index.html#play=0 (start przy kominie 0), dodatki: -low, -high, -far, -evo
// #play-era=4 – skok do ery 4 z domyślnymi wyborami; -t=bact,chemo – własne wybory
// Gałąź wyborów prowadząca do ery n (domyślne wybory, nadpisywane przez `over`)
function picksFor(n, over) {
  const def = { era1: 'flagellum', domain: 'arch', meta: 'photo', oxy: 'aerobic', euk: 'alga' };
  for (const k of over) for (const s in def) if (CHOICES[s].options[k]) def[s] = k;
  if (n >= 13) def.euk = 'alga'; else if (n >= 7) def.euk = 'predator';
  const p = [];
  if (n > 1) p.push(def.era1);
  if (n > 2) p.push(def.domain);
  if (n > 3) p.push(def.meta);
  if (n > 4) p.push(def.oxy);
  if (n > 5) p.push(def.euk);
  if (n >= 8 && n <= 12) p.push('bilat');
  if (n === 9) p.push('arthro');
  if (n >= 10 && n <= 12) p.push('chordate');
  if (n >= 11 && n <= 12) p.push('jawed');
  if (n === 12) p.push('lobefin');
  if (n === 14) p.push('charo');
  return p;
}

function jumpToEra(n, over) {
  stats.test = true;   // skoki testowe nie zapisują etapów na drzewie
  if (n === 1) return;
  applyHistory(n, picksFor(n, over));
  player.biomass = 90;
  if (ERAS[n].startChoice) openEraIntro(n); else startEra(n);
}

const auto = location.hash.match(/play=?(\d)?/);
if (auto) {
  startGame(auto[1] ? +auto[1] : 1);
  const pk = location.hash.match(/t=([\w,]+)/);
  const picks = pk ? pk[1].split(',') : [];
  const je = location.hash.match(/era=(\d+)/);
  if (je) jumpToEra(+je[1], picks);
  else if (location.hash.includes('evo')) {
    stats.c.div = QUEST_DIVISIONS;
    checkObjective();
    if (picks[0] && OPTIONS[picks[0]]) { applyChoice(picks[0]); afterEra(); }
  }
}
