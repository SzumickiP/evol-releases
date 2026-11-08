// Profile graczy (logowanie lokalne) i osiągnięcia zapisywane w localStorage.
// Gracz to po prostu nazwa; dane zostają w tej przeglądarce.
const STORE_KEY = 'evol.profiles.v1';
const CURRENT_KEY = 'evol.current.v1';

const ACHIEVEMENTS = [
  { id: 'firstDivide', icon: '◐', name: 'Pierwsze pęknięcie', desc: 'Podziel się po raz pierwszy.' },
  { id: 'quest1', icon: '✦', name: 'Narodziny Rodu', desc: 'Wykonaj 10 podziałów w jednej grze.' },
  { id: 'evo_flagellum', icon: '〰', name: 'Wędrowiec', desc: 'Wybierz Wić Wędrowca.' },
  { id: 'evo_thermo', icon: '♨︎', name: 'Dziecię Ognia', desc: 'Wybierz Pancerz Termofila.' },
  { id: 'evo_phago', icon: '◉', name: 'Pierwszy Drapieżnik', desc: 'Wybierz Enzymy Drapieżcy.' },
  { id: 'allPaths', icon: '☯', name: 'Wszystkie drogi', desc: 'Wypróbuj każdą z trzech dróg ewolucji.' },
  { id: 'firstKill', icon: '⊘', name: 'Pierwsza ofiara', desc: 'Pochłoń obcą komórkę.' },
  { id: 'kills10', icon: '☠', name: 'Postrach toni', desc: 'Pochłoń 10 obcych komórek w jednej grze.' },
  { id: 'gen10', icon: '⧖', name: 'Dziesiąte pokolenie', desc: 'Doprowadź ród do 10. pokolenia.' },
  { id: 'colony20', icon: '❂', name: 'Kolonia', desc: 'Miej jednocześnie 20 żywych komórek rodu.' },
  { id: 'feast', icon: '❖', name: 'Pierwotny bulion', desc: 'Pochłoń 300 cząsteczek w jednej grze.' },
  { id: 'surface', icon: '☀', name: 'Ku światłu', desc: 'Dotrzyj tuż pod powierzchnię oceanu.' },
  { id: 'inferno', icon: '♆', name: 'W paszczy komina', desc: 'Przetrwaj 5 s w wodzie gorętszej niż 100°C.' },
  { id: 'lightning', icon: '⚡︎', name: 'Iskra życia', desc: 'Bądź w pobliżu uderzenia pioruna.' },
  { id: 'survive5', icon: '⌛︎', name: 'Długowieczny ród', desc: 'Utrzymaj ród przy życiu przez 5 minut.' },
  { id: 'survive15', icon: '∞', name: 'Nieśmiertelna linia', desc: 'Utrzymaj ród przy życiu przez 15 minut.' },
  { id: 'dna', icon: '⧓', name: 'Kod DNA', desc: 'Zastąp kruche RNA podwójną nicią DNA.' },
  { id: 'luca', icon: '⚘', name: 'Wspólny przodek', desc: 'Ukończ Erę 2 jako LUCA.' },
  { id: 'evo_bact', icon: '⬭', name: 'Bakteria', desc: 'Wybierz drogę bakterii.' },
  { id: 'evo_arch', icon: '✺', name: 'Archeon', desc: 'Wybierz drogę archeonów.' },
  { id: 'mat', icon: '≋', name: 'Mata mikrobiologiczna', desc: 'Ukończ Erę 3 – wyścig metabolizmów.' },
  { id: 'oxygen', icon: 'O₂', name: 'Wielkie Utlenienie', desc: 'Przetrwaj Erę 4, gdy tlen zalał ocean.' },
  { id: 'euk', icon: '⊛', name: 'Komórka złożona', desc: 'Przyjmij endosymbionty, które staną się mitochondriami.' },
  { id: 'sex', icon: '⚭', name: 'Mejoza', desc: 'Połącz geny dwóch komórek rodu.' },
  { id: 'evo_alga', icon: '❦', name: 'Pierwszy glon', desc: 'Zostań glonem z chloroplastem.' },
  { id: 'evo_predator', icon: '◍', name: 'Pierwszy łowca', desc: 'Zostań wiciowcem drapieżnym.' },
  { id: 'guardian', icon: '⛨', name: 'Strażnik organizmu', desc: 'Usuń 3 komórki-oszustki przez apoptozę.' },
  { id: 'multi', icon: '❁', name: 'Pierwszy organizm', desc: 'Doprowadź ród do organizmu wielokomórkowego.' },
  { id: 'ediacara', icon: '❋', name: 'Ogród Ediakaru', desc: 'Ukończ Erę 7 – Ediakar.' },
  { id: 'cambrian', icon: '✷', name: 'Eksplozja kambryjska', desc: 'Przetrwaj wyścig zbrojeń z anomalokarysami.' },
  { id: 'evo_jawed', icon: '⋎', name: 'Szczęki', desc: 'Zostań rybą szczękową.' },
  { id: 'evo_lobefin', icon: '✋', name: 'Ręka z płetwy', desc: 'Wybierz ryby mięśniopłetwe.' },
  { id: 'deadEnd', icon: '⚓', name: 'Ślepa gałąź', desc: 'Zakończ grę na gałęzi, która została w wodzie.' },
  { id: 'landArthro', icon: '⋔', name: 'Pierwsze kroki na lądzie', desc: 'Wyjdź z wody jako stawonóg.' },
  { id: 'tetrapod', icon: '⚘', name: 'Pierwszy czworonóg', desc: 'Wyjdź z wody jako ryba z kończynami.' },
  { id: 'landPlant', icon: '☘', name: 'Zielony ląd', desc: 'Wprowadź rośliny na ląd.' },
];
const ACH_BY_ID = Object.fromEntries(ACHIEVEMENTS.map(a => [a.id, a]));

const Profiles = {
  data: {},
  current: null,   // klucz wybranego gracza (nazwa małymi literami)

  load() {
    try { this.data = JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { this.data = {}; }
    try {
      const cur = localStorage.getItem(CURRENT_KEY);
      this.current = cur && this.data[cur.toLowerCase()] ? cur.toLowerCase() : null;
    } catch { this.current = null; }
  },
  save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(this.data));
      if (this.current) localStorage.setItem(CURRENT_KEY, this.current);
      else localStorage.removeItem(CURRENT_KEY);
    } catch { /* tryb prywatny / zablokowany zapis – gra działa dalej bez zapisu */ }
  },
  get profile() { return this.current ? this.data[this.current] : null; },
  list() { return Object.values(this.data).sort((a, b) => (b.lastLogin || 0) - (a.lastLogin || 0)); },

  // Zwraca komunikat błędu albo null przy sukcesie
  login(rawName) {
    const name = rawName.trim().replace(/\s+/g, ' ');
    if (name.length < 2 || name.length > 20) return 'Nazwa musi mieć od 2 do 20 znaków.';
    const key = name.toLowerCase();
    let p = this.data[key];
    if (!p) {
      p = this.data[key] = {
        name, created: Date.now(),
        achievements: {}, paths: {}, games: 0, tree: {},
        best: { time: 0, maxGen: 0, divisions: 0, kills: 0, era: 1 },
      };
    }
    p.lastLogin = Date.now();
    this.current = key;
    this.save();
    return null;
  },
  logout() { this.current = null; this.save(); },
  remove(key) { delete this.data[key]; if (this.current === key) this.current = null; this.save(); },

  has(id) { const p = this.profile; return !!(p && p.achievements[id]); },
  unlock(id) {
    const p = this.profile;
    if (!p || p.achievements[id] || !ACH_BY_ID[id]) return false;
    p.achievements[id] = Date.now();
    this.save();
    return true;
  },
  count() { const p = this.profile; return p ? Object.keys(p.achievements).length : 0; },

  // Zaliczony etap: początek ery `era` osiągnięty gałęzią wyborów `picks` (era 7 = ukończona gra)
  saveCheckpoint(era, picks, ending) {
    const p = this.profile;
    if (!p) return;
    p.tree = p.tree || {};
    const key = era + ':' + picks.join(',');
    const cp = p.tree[key] || (p.tree[key] = { era, picks: [...picks], at: Date.now(), plays: 0 });
    cp.plays++;
    if (ending) cp.ending = ending;
    if (ERAS[era]) p.best.era = Math.max(p.best.era || 1, ERAS[era].col);
    this.save();
  },

  recordPath(key) {
    const p = this.profile;
    if (!p) return;
    p.paths[key] = (p.paths[key] || 0) + 1;
    this.save();
  },
  recordGame(stats) {
    const p = this.profile;
    if (!p) return;
    p.games++;
    p.best.time = Math.max(p.best.time, stats.time);
    p.best.maxGen = Math.max(p.best.maxGen, stats.maxGen);
    p.best.divisions = Math.max(p.best.divisions, stats.divisions);
    p.best.kills = Math.max(p.best.kills, stats.kills);
    p.best.era = Math.max(p.best.era || 1, stats.era || 1);
    this.save();
  },
};
Profiles.load();

// ---------- Interfejs ----------
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtTime = t => `${Math.floor(t / 60)} min ${Math.floor(t % 60)} s`;
const OVERLAYS = ['title', 'intro', 'achievements'];
function showOnly(id) {
  OVERLAYS.forEach(o => document.getElementById(o).classList.toggle('hidden', o !== id));
  document.body.classList.toggle('in-menu', !!id);   // w menu chowamy HUD gry
}

function renderAchievementGrid(el) {
  const p = Profiles.profile;
  el.innerHTML = ACHIEVEMENTS.map(a => {
    const at = p && p.achievements[a.id];
    const when = at ? new Date(at).toLocaleDateString('pl-PL') : '';
    return `<div class="ach ${at ? 'got' : ''}" title="${esc(a.desc)}${when ? ' · zdobyte ' + when : ''}">` +
      `<span class="ach-icon">${a.icon}</span><span class="ach-name">${esc(a.name)}</span>` +
      `<span class="ach-desc">${esc(a.desc)}</span></div>`;
  }).join('');
}

function renderProfileUI() {
  const p = Profiles.profile;
  document.getElementById('hud-profile').textContent = p ? `${p.name} · ★ ${Profiles.count()}/${ACHIEVEMENTS.length}` : '';
}

// ---------- Drzewo ewolucji ----------
// Węzeł = zaliczony etap (początek ery) + gałąź wyborów, która do niego prowadzi.
// Rodzicem węzła jest najpóźniejszy etap, którego gałąź jest początkiem gałęzi węzła.
function buildTree(p) {
  const nodes = [{ era: 1, col: 1, picks: [], root: true }];
  for (const cp of Object.values(p ? p.tree || {} : {})) {
    if (cp.era !== 99 && !ERAS[cp.era]) continue;
    if (cp.era === 7 && cp.ending) continue;   // zakończenia ze starszej wersji gry (Era 6 była ostatnia)
    nodes.push({ ...cp, col: cp.era === 99 ? 99 : ERAS[cp.era].col });
  }
  nodes.sort((a, b) => a.col - b.col || a.picks.length - b.picks.length);
  const isPrefix = (a, b) => a.length <= b.length && a.every((k, i) => b[i] === k);
  for (const n of nodes) {
    n.kids = [];
    if (n.root) continue;
    let par = nodes[0];
    for (const m of nodes) {
      if (m === n || m.col >= n.col || !isPrefix(m.picks, n.picks)) continue;
      if (m.col > par.col || (m.col === par.col && m.picks.length > par.picks.length)) par = m;
    }
    n.parent = par;
    n.added = n.picks.slice(par.picks.length);
    if (n.era === 99) n.col = par.col + 1;   // zakończenie tuż za etapem, z którego wynika
    par.kids.push(n);
  }
  // układ: kolumna = era, wiersze według kolejności liści
  let row = 0;
  const place = n => {
    if (!n.kids.length) { n.row = row++; return; }
    n.kids.forEach(place);
    n.row = (n.kids[0].row + n.kids[n.kids.length - 1].row) / 2;
  };
  place(nodes[0]);
  return { nodes, rows: row };
}

function renderTree(el, onStart) {
  const p = Profiles.profile;
  const { nodes, rows } = buildTree(p);
  const W = 136, H = 92, CX = 156, CY = 104, PAD = 8;
  const maxCol = Math.max(6, ...nodes.map(n => n.col));
  const width = PAD * 2 + (maxCol - 1) * CX + W, height = PAD * 2 + Math.max(1, rows) * CY - (CY - H);
  const pos = n => ({ x: PAD + (n.col - 1) * CX, y: PAD + n.row * CY });
  let svg = '';
  for (const n of nodes) {
    if (!n.parent) continue;
    const a = pos(n.parent), b = pos(n);
    const x1 = a.x + W, y1 = a.y + H / 2, x2 = b.x, y2 = b.y + H / 2, mx = (x1 + x2) / 2;
    svg += `<path d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}"/>`;
  }
  let html = `<svg class="tree-edges" width="${width}" height="${height}">${svg}</svg>`;
  for (const n of nodes) {
    const { x, y } = pos(n);
    const chips = (n.added || []).map(k => OPTIONS[k] ? `<span class="chip">${esc(OPTIONS[k].short)}</span>` : '').join('');
    if (n.era === 99) {
      const end = ENDINGS[n.ending];
      if (!end) continue;
      html += `<div class="tnode won${end.land ? ' land' : ''}" style="left:${x}px;top:${y}px" title="${esc(end.when)}">` +
        `<small>${end.land ? 'Wyjście z wody' : 'Ślepa gałąź'}</small><b>${esc(end.title)}</b><div class="tchips">${chips}</div></div>`;
      continue;
    }
    const when = n.at ? ` · ${new Date(n.at).toLocaleDateString('pl-PL')}` : '';
    const tip = n.root ? 'Nowa gra od pierwszej komórki' : `Zacznij od Ery ${n.era} z tą gałęzią ewolucji${when}`;
    html += `<button class="tnode${n.root ? ' root' : ''}" style="left:${x}px;top:${y}px" data-era="${n.era}" ` +
      `data-picks="${esc(n.picks.join(','))}" title="${esc(tip)}">` +
      `<small>Era ${n.col}</small><b>${esc(ERAS[n.era].name)}</b><div class="tchips">${chips || (n.root ? '<span class="chip dim">start</span>' : '')}</div></button>`;
  }
  el.innerHTML = `<div class="tree-inner" style="width:${width}px;height:${height}px">${html}</div>`;
  el.scrollLeft = el.scrollWidth;   // pokaż najdalszy etap
  el.querySelectorAll('.tnode[data-era]').forEach(b => b.onclick = () =>
    onStart(+b.dataset.era, b.dataset.picks ? b.dataset.picks.split(',') : []));
  if (!p) el.insertAdjacentHTML('beforeend', '<p class="note">Wybierz albo dodaj gracza – wtedy każdy zaliczony etap zapisze się na drzewie.</p>');
  else if (nodes.length === 1) el.insertAdjacentHTML('beforeend', '<p class="note">Drzewo jest jeszcze puste. Każda nowa era, do której dotrzesz, pojawi się tu jako etap do wyboru.</p>');
}

// ---------- Strona tytułowa ----------
let menuHandlers = { onNew: () => {}, onCheckpoint: () => {} };

function showTitle() {
  const list = document.getElementById('t-players');
  const profs = Profiles.list();
  list.innerHTML = profs.map(p => {
    const key = p.name.toLowerCase();
    return `<span class="prof-wrap"><button class="prof${key === Profiles.current ? ' cur' : ''}" data-key="${esc(key)}">${esc(p.name)}` +
      `<small>★ ${Object.keys(p.achievements).length}/${ACHIEVEMENTS.length}</small></button>` +
      `<button class="prof-del" data-key="${esc(key)}" title="Usuń gracza">×</button></span>`;
  }).join('') || '<span class="note">Brak zapisanych graczy.</span>';
  list.querySelectorAll('.prof').forEach(b => b.onclick = () => { Profiles.login(Profiles.data[b.dataset.key].name); showTitle(); });
  list.querySelectorAll('.prof-del').forEach(b => b.onclick = () => {
    const p = Profiles.data[b.dataset.key];
    if (confirm(`Usunąć gracza „${p.name}” razem z drzewem ewolucji i osiągnięciami?`)) { Profiles.remove(b.dataset.key); showTitle(); }
  });
  const p = Profiles.profile;
  document.getElementById('t-who').innerHTML = p
    ? `Gracz <b>${esc(p.name)}</b> · osiągnięcia ${Profiles.count()}/${ACHIEVEMENTS.length} · najdalej: era ${p.best.era || 1}`
    : 'Grasz bez zapisu postępów';
  document.getElementById('login-err').textContent = '';
  showOnly('title');
  renderTree(document.getElementById('t-tree'), (era, picks) => menuHandlers.onCheckpoint(era, picks));
  renderProfileUI();
}

function showIntro() { showOnly('intro'); }

function showAchievements() {
  const p = Profiles.profile;
  renderAchievementGrid(document.getElementById('ach-grid'));
  document.getElementById('ach-summary').innerHTML = p
    ? `<b>${esc(p.name)}</b> · zdobyte ${Profiles.count()} z ${ACHIEVEMENTS.length} · rozegrane gry: ${p.games}<br>` +
      `Rekordy: przetrwanie <b>${fmtTime(p.best.time)}</b> · pokolenie <b>${p.best.maxGen}</b> · ` +
      `podziały <b>${p.best.divisions}</b> · ofiary <b>${p.best.kills}</b> · era <b>${p.best.era || 1}</b>`
    : 'Wybierz gracza, aby zapisywać osiągnięcia.';
  showOnly('achievements');
}

function initProfileUI(handlers) {
  menuHandlers = handlers;
  const input = document.getElementById('login-name');
  const submit = () => {
    const err = Profiles.login(input.value);
    if (err) { document.getElementById('login-err').textContent = err; return; }
    input.value = '';
    showTitle();
  };
  document.getElementById('login-go').onclick = submit;
  input.addEventListener('keydown', e => {
    e.stopPropagation();   // nie przekazuj klawiszy do sterowania grą
    if (e.key === 'Enter') submit();
  });
  document.getElementById('t-new').onclick = () => menuHandlers.onNew();
  document.getElementById('t-how').onclick = showIntro;
  document.getElementById('t-ach').onclick = showAchievements;
  document.getElementById('intro-back').onclick = showTitle;
  document.getElementById('ach-back').onclick = showTitle;
  renderProfileUI();
}
