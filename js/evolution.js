// Skoki ewolucyjne: wybory dróg rozwoju na kolejnych rozdrożach oraz ich animowane podglądy.
const QUEST_DIVISIONS = 10;

// Każdy zestaw to jedno rozdroże. Opcja może dodać kilka cech naraz (traits).
const CHOICES = {
  era1: {
    kicker: 'Pierwszy skok ewolucyjny',
    title: 'Rozdroże Ewolucji',
    lead: 'Twój ród przetrwał dziesięć podziałów. W jego RNA zaszła mutacja, która może zmienić wszystko. ' +
      'Wybierz drogę – zmieni się tylko Twoja komórka, a cechę odziedziczy każdy potomek, który z niej powstanie.',
    options: {
      flagellum: {
        name: 'Wić Wędrowca', short: 'Wić',
        desc: 'Z błony wyrasta biczowata wić, którą obraca motor białkowy – jak śruba napędowa.',
        plus: ['+70% prędkości', 'Ruch zużywa mniej energii'], minus: [],
        toast: 'Wić Wędrowca! Twój ród przemierza ocean szybciej niż ktokolwiek przed nim.',
      },
      thermo: {
        name: 'Pancerz Termofila', short: 'Termofil',
        desc: 'Białka odporne na żar i usztywniona błona. Wrzątek przy kominach przestaje być barierą.',
        plus: ['Przeżywa przy czarnych kominach (do ~110°C)', 'Dwa razy mniejsze obrażenia od żaru'], minus: [],
        toast: 'Pancerz Termofila! Żar kominów i bogate w energię minerały należą teraz do Ciebie.',
      },
      phago: {
        name: 'Enzymy Drapieżcy', short: 'Drapieżca',
        desc: 'Komórka wydziela enzymy trawienne i rozpuszcza sąsiadów z zewnątrz – jak dzisiejsze bakterie Myxococcus. ' +
          'Prokarionty nie potrafią połykać całych komórek: to przyjdzie dopiero z cytoszkieletem.',
        plus: ['Rozpuszcza mniejsze obce komórki w zasięgu enzymów', 'Strawiona ofiara daje energię i biomasę'],
        minus: ['Cząsteczki dają tylko 60% pożywienia'],
        toast: 'Enzymy Drapieżcy! Zbliż się do mniejszych obcych komórek (różowych), a enzymy je rozpuszczą.',
      },
    },
  },
  domain: {
    kicker: 'Era 2 · Wielki Rozłam',
    title: 'Dwie domeny życia',
    lead: 'Potomkowie LUCA rozchodzą się na dwie linie, które różnią się budową błony i ściany komórkowej. ' +
      'Ten podział trwa do dziś – każdy prokariont jest albo bakterią, albo archeonem.',
    options: {
      bact: {
        name: 'Bakterie', short: 'Bakteria',
        desc: 'Błona z lipidów estrowych i ściana z peptydoglikanu. Kształt pałeczki, szybkie podziały, ' +
          'plazmidy do wymiany genów.',
        plus: ['Biomasa rośnie o 50% szybciej', 'Krótsza przerwa między podziałami'], minus: [],
        toast: 'Bakterie! Twój ród dzieli się szybciej niż jakakolwiek inna linia.',
      },
      arch: {
        name: 'Archeony', short: 'Archeon',
        desc: 'Błona z lipidów eterowych i białkowa S-warstwa. Oszczędny metabolizm i odporność na żar. ' +
          'To z archeonów wyłoni się kiedyś komórka złożona.',
        plus: ['Metabolizm zużywa 25% mniej energii', 'Wyższa odporność na żar i UV'], minus: [],
        toast: 'Archeony! Oszczędne i twarde – a w przyszłości gospodarze pierwszych mitochondriów.',
      },
    },
  },
  meta: {
    kicker: 'Era 3 · 3,5 mld lat temu',
    title: 'Wyścig metabolizmów',
    lead: 'Życie szuka nowych źródeł energii. Każda droga to inny łańcuch reakcji chemicznych – ' +
      'i inne miejsce w oceanie, w którym Twój ród będzie najsilniejszy.',
    options: {
      chemo: {
        name: 'Chemolitotrofia', short: 'Chemolitotrof',
        desc: 'Energia z utleniania siarkowodoru, wodoru i żelaza wypływających z kominów. W komórce gromadzą się ziarenka siarki.',
        plus: ['Minerały dają 2,2× więcej energii', 'Stały dopływ energii w ciepłej wodzie przy kominach'], minus: [],
        toast: 'Chemolitotrofia! Kominy są teraz Twoją elektrownią.',
      },
      ferment: {
        name: 'Fermentacja', short: 'Fermentator',
        desc: 'Rozkład związków organicznych bez tlenu. Mało wydajny (2 ATP z cząsteczki cukru), ale działa wszędzie.',
        plus: ['Związki organiczne i lipidy dają 60% więcej energii', 'Zapasy glikogenu'], minus: [],
        toast: 'Fermentacja! Każda drobina organiczna w oceanie to dla Ciebie paliwo.',
      },
      photo: {
        name: 'Fotosynteza beztlenowa', short: 'Fotosynteza',
        desc: 'Bakteriochlorofil w chlorosomach łapie światło. Bez tlenu – elektrony pochodzą z siarkowodoru. ' +
          'Najwięcej światła jest tuż pod strefą UV.',
        plus: ['Energia ze światła, bez jedzenia', 'W następnej erze: fotosynteza tlenowa (sinice)'],
        minus: ['W głębinach prawie nie działa'],
        toast: 'Fotosynteza! Trzymaj się jasnej wody – ale nie wpływaj w zabójcze UV.',
      },
    },
  },
  oxy: {
    kicker: 'Era 4 · 2,4 mld lat temu',
    title: 'Wielkie Utlenienie',
    lead: 'Sinice od setek milionów lat rozkładają wodę i uwalniają tlen. Teraz przestał on znikać w rdzewiejącym żelazie ' +
      'i zalewa ocean. Dla ówczesnego życia to trucizna – zaczyna się masowe wymieranie. Jak przetrwa Twój ród?',
    options: {
      deep: {
        name: 'Ucieczka w głębiny', short: 'Beztlenowiec',
        desc: 'Zostajesz beztlenowcem. Dno i okolice kominów jeszcze długo pozostaną bez tlenu – tak żyją dziś archeony metanogenne.',
        plus: ['Szybszy wzrost przy dnie', 'Minerały dają o 50% więcej energii'],
        minus: ['Natleniona woda bardzo szkodzi'],
        toast: 'Ucieczka w głębiny! Trzymaj się dna – tam tlen jeszcze nie dotarł.',
      },
      shield: {
        name: 'Tarcza antyoksydacyjna', short: 'Antyoksydanty',
        desc: 'Katalaza i dysmutaza ponadtlenkowa rozkładają reaktywne formy tlenu, zanim zniszczą białka i DNA.',
        plus: ['Tlen przestaje szkodzić', 'Swoboda w całym oceanie'], minus: [],
        toast: 'Tarcza antyoksydacyjna! Tlen nie jest już groźny.',
      },
      aerobic: {
        name: 'Oddychanie tlenowe', short: 'Tlenowiec',
        desc: 'Łańcuch oddechowy w błonie zamienia truciznę w paliwo: z jednej cząsteczki cukru ok. 30 ATP zamiast 2.',
        plus: ['Pożywienie daje do 2,4× więcej energii w natlenionej wodzie', 'Tlen przestaje szkodzić'], minus: [],
        toast: 'Oddychanie tlenowe! Im więcej tlenu, tym więcej energii.',
      },
    },
  },
  euk: {
    kicker: 'Era 5 · 1,6 mld lat temu',
    title: 'Dwie drogi eukariontów',
    lead: 'Twoja komórka ma jądro, mitochondria i cytoskelet. Teraz wybiera, czym będzie się żywić – ' +
      'a ten wybór zdecyduje, czy jej potomkowie zostaną roślinami, czy zwierzętami.',
    options: {
      alga: {
        name: 'Glon', short: 'Glon',
        desc: 'Komórka wchłania sinicę i jej nie trawi. Sinica staje się chloroplastem – tak powstały glony i rośliny. ' +
          'Dwie przednie wici, plamka oczna i miseczkowaty chloroplast jak u Chlamydomonas.',
        plus: ['Silna fotosynteza tlenowa', 'Ozon chroni już powierzchnię – jasna woda jest bezpieczna'],
        minus: ['Cząsteczki dają 30% mniej energii'],
        toast: 'Glon! Pochłonięta sinica stała się chloroplastem. Płyń ku światłu.',
      },
      predator: {
        name: 'Wiciowiec drapieżny', short: 'Łowca',
        desc: 'Cytoskelet pozwala otoczyć ofiarę błoną i połknąć ją w całości – prawdziwa fagocytoza. ' +
          'Jedna wić i kołnierzyk z mikrokosmków, jak u wiciowców kołnierzykowych – przodków zwierząt.',
        plus: ['Połyka mniejsze komórki (wszystkich innych linii)', 'Duża nagroda za każdą ofiarę'],
        minus: ['Cząsteczki dają tylko 50% pożywienia'],
        toast: 'Wiciowiec drapieżny! Poluj na mniejsze komórki – połykasz je w całości.',
      },
    },
  },  eumet: {
    kicker: 'Era 7 · Ediakar', creature: true,
    title: 'Plany budowy ciała',
    lead: 'Zwierzęta rozchodzą się na dwie drogi budowy ciała. Jedna prowadzi do meduz i koralowców, druga – do wszystkich ' +
      'pozostałych zwierząt, także tych, które kiedyś wyjdą na ląd.',
    options: {
      cnid: {
        name: 'Parzydełkowce', short: 'Parzydełkowiec', ending: 'jelly',
        desc: 'Symetria promienista, dwie warstwy komórek, sieć nerwowa bez mózgu i komórki parzydełkowe z jadem. Polip na dnie albo pływająca meduza.',
        plus: ['Paraliżujący jad', 'Przetrwały do dziś: meduzy, koralowce, ukwiały'],
        minus: ['Ślepa gałąź – parzydełkowce nigdy nie wyszły z wody (zakończenie gry)'],
        toast: 'Parzydełkowce! Twój ród zostanie w morzu na zawsze.',
      },
      bilat: {
        name: 'Zwierzęta dwubocznie symetryczne', short: 'Dwubok',
        desc: 'Przód i tył, głowa ze skupiskiem neuronów, przewód pokarmowy na przelot i trzecia warstwa komórek (mezoderma), z której powstają mięśnie.',
        plus: ['Ruch głową naprzód – szybciej i celowo', 'Droga do wszystkich zwierząt lądowych'], minus: [],
        toast: 'Dwubocznie symetryczny! Masz głowę, mięśnie i przewód pokarmowy na przelot.',
      },
    },
  },
  kambr: {
    kicker: 'Era 8 · Eksplozja kambryjska', creature: true,
    title: 'Wielkie typy zwierząt',
    lead: 'W kambrze powstają plany budowy, które przetrwały do dziś. Wybierz, kim będą potomkowie Twojego robaka.',
    options: {
      arthro: {
        name: 'Stawonogi', short: 'Stawonóg',
        desc: 'Pancerz z chityny, członowane odnóża i oczy złożone – jak trylobity i dzisiejsze owady. To one pierwsze wyjdą na ląd.',
        plus: ['Pancerz osłabia ugryzienia o 60%', 'Chodzą po dnie i po lądzie'], minus: [],
        toast: 'Stawonogi! Chitynowy pancerz i odnóża – droga na brzeg stoi otworem.',
      },
      mollusk: {
        name: 'Mięczaki', short: 'Mięczak', ending: 'mollusk',
        desc: 'Muszla z węglanu wapnia i tarka (radula). Głowonogi z prostą muszlą zostaną postrachem mórz ordowiku.',
        plus: ['Muszla i macki', 'Najwięksi drapieżnicy ordowiku'],
        minus: ['Ślepa gałąź w tej grze – ślimaki wyjdą na ląd dopiero ok. 100 mln lat później (zakończenie gry)'],
        toast: 'Mięczaki! Twój ród zdominuje morza, ale zostanie w wodzie.',
      },
      chordate: {
        name: 'Strunowce', short: 'Strunowiec',
        desc: 'Struna grzbietowa, cewka nerwowa nad nią, szczeliny skrzelowe i mięśnie w kształcie litery V – jak Pikaia. Od nich pochodzą wszystkie kręgowce.',
        plus: ['Szybkie, giętkie ciało', 'Droga do ryb i czworonogów'], minus: [],
        toast: 'Strunowce! Twoi potomkowie staną się rybami.',
      },
    },
  },
  szczeki: {
    kicker: 'Era 9 · Ordowik', creature: true,
    title: 'Szczęki',
    lead: 'Pierwsze ryby nie mają szczęk. Wśród ich potomków pojawia się wynalazek, który zmieni wszystkie kręgowce.',
    options: {
      jawless: {
        name: 'Bezżuchwowce pancerne', short: 'Bezżuchwowiec', ending: 'jawless',
        desc: 'Głowa w kostnym pancerzu, pokarm zasysany z dna. Wymarły pod koniec dewonu – przetrwały tylko minogi i śluzice.',
        plus: ['Mocny pancerz'], minus: ['Ślepa gałąź (zakończenie gry)'],
        toast: 'Bezżuchwowce! Pancerz nie wystarczy w świecie ryb ze szczękami.',
      },
      jawed: {
        name: 'Szczękowce', short: 'Szczękowiec',
        desc: 'Przedni łuk skrzelowy zmienia się w szczęki, pojawiają się płetwy parzyste. Ryba może chwytać i gryźć ofiary.',
        plus: ['Poluje na mniejsze ryby', 'Szybsze, zwrotne pływanie'], minus: ['Drobny pokarm daje mniej energii'],
        toast: 'Szczęki! Możesz polować na mniejsze ryby.',
      },
    },
  },
  pletwy: {
    kicker: 'Era 10 · Dewon', creature: true,
    title: 'Promienie czy mięśnie?',
    lead: 'Ryby szczękowe rozdzielają się na dwie linie, które różnią się budową płetw. Tylko jedna z nich wyjdzie na ląd.',
    options: {
      rayfin: {
        name: 'Promieniopłetwe', short: 'Promieniopłetwa', ending: 'rayfin',
        desc: 'Cienkie płetwy rozpięte na promieniach kostnych i pęcherz pławny. Opanują wszystkie wody świata.',
        plus: ['Ponad połowa dzisiejszych kręgowców'], minus: ['Zostają w wodzie (zakończenie gry)'],
        toast: 'Promieniopłetwe! Wody świata należą do Twojego rodu.',
      },
      lobefin: {
        name: 'Mięśniopłetwe', short: 'Mięśniopłetwa',
        desc: 'Mięsiste płetwy z kośćmi jak w kończynach (ramię, przedramię) i płuca do łykania powietrza w płytkich, dusznych wodach – jak Tiktaalik.',
        plus: ['Płuca: oddycha powietrzem', 'Płetwy podpierają ciało na dnie'], minus: [],
        toast: 'Mięśniopłetwe! Twoje płetwy mają kości ramienia i przedramienia.',
      },
    },
  },
  glony: {
    kicker: 'Era 7 · Zielenice', creature: true,
    title: 'Morze czy brzeg?',
    lead: 'Zielenice rozchodzą się na dwie linie. Jedna zostaje w oceanie, druga zasiedla płytkie, słodkie wody, które co jakiś czas wysychają.',
    options: {
      seaweed: {
        name: 'Wielkie glony morskie', short: 'Wodorost', ending: 'seaweed',
        desc: 'Plechy z czepnikiem, łodyżką i pęcherzami powietrza, rosnące w morzu jak podwodny las.',
        plus: ['Ogromne rozmiary'], minus: ['Nigdy nie opuszczą wody (zakończenie gry)'],
        toast: 'Wodorosty! Twój ród tworzy podwodne lasy.',
      },
      charo: {
        name: 'Ramienice', short: 'Ramienica',
        desc: 'Słodkowodne zielenice z okółkami gałązek – najbliżsi krewni roślin lądowych. Znoszą okresowe wysychanie.',
        plus: ['Droga na ląd'], minus: [],
        toast: 'Ramienice! Twoi potomkowie wejdą na ląd.',
      },
    },
  },
};


// Płaski słownik wszystkich opcji: klucz → opis
const OPTIONS = {};
for (const set of Object.values(CHOICES)) Object.assign(OPTIONS, set.options);

// Sztuczny, pusty świat do animowanych podglądów na kartach
const PREVIEW_WORLD = {
  w: 1e4, h: 1e4, time: 0, env: { o2: 0, ozone: 0, ice: 0 }, waterEnd: 1e5, cells: [], particles: [],
  flow: () => [0, 0], floorAt: () => 1e4, uvAt: () => 0, heatAt: () => 0, nearestVent: () => null,
  o2At: () => 0, lightAt: () => 0.5, isWater: () => true, waveY: () => -1e4,
};

const evoUI = { cards: [] };

// Buduje karty wyboru; baseTraits to cechy, które ród już ma
function buildChoiceUI(setKey, baseTraits, onPick) {
  const set = CHOICES[setKey];
  const box = document.getElementById('cards');
  box.innerHTML = '';
  evoUI.cards = [];
  for (const key of Object.keys(set.options)) {
    const e = set.options[key];
    const card = document.createElement('button');
    card.className = 'card';
    card.innerHTML =
      `<canvas width="240" height="150"></canvas>` +
      `<h3>${e.name}</h3><p>${e.desc}</p>` +
      `<ul>${e.plus.map(t => `<li class="plus">${t}</li>`).join('')}` +
      `${e.minus.map(t => `<li class="minus">${t}</li>`).join('')}</ul>`;
    card.addEventListener('click', () => onPick(key));
    box.appendChild(card);

    const traits = { ...baseTraits, [key]: true };
    if (key === 'aerobic' || key === 'shield') traits.oxygenic = false;
    if (set.creature) {
      const plan = PREVIEW_PLAN[key];
      const big = PLANS[plan].size > 18;
      const cell = new Creature(plan === 'arthropod' || plan === 'worm' ? 150 : 120, 80, { plan, traits, biomass: big ? 20 : 55, heading: 0 });
      evoUI.cards.push({ key, canvas: card.querySelector('canvas'), cell, extra: null, creature: true });
      continue;
    }
    const cell = new Cell(120, 75, { biomass: traits.euk ? 40 : 70, hue: 170, traits, heading: 0 });
    if (traits.euk) cell.endo = 0;
    const preyTrait = key === 'phago' || key === 'predator';
    const extra = preyTrait ? new Cell(190, 98, { biomass: 5, hue: 315, lineage: 'wild', traits: baseTraits.dna ? { dna: true, bact: true } : {} }) : null;
    evoUI.cards.push({ key, canvas: card.querySelector('canvas'), cell, extra });
  }
}

function drawChoicePreviews(dt) {
  PREVIEW_WORLD.time += dt;
  const t = PREVIEW_WORLD.time;
  for (const c of evoUI.cards) {
    const g = c.canvas.getContext('2d');
    const W = c.canvas.width, H = c.canvas.height;
    const k = c.key;
    const bg = g.createLinearGradient(0, 0, 0, H);
    const light = k === 'photo' || k === 'alga';
    bg.addColorStop(0, light ? '#2a7f8a' : k === 'deep' ? '#06121c' : '#0f3a52');
    bg.addColorStop(1, k === 'deep' ? '#020609' : '#071a28');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    if (k === 'thermo' || k === 'chemo') {
      const hg = g.createRadialGradient(W / 2, H + 20, 10, W / 2, H + 20, 140);
      hg.addColorStop(0, 'rgba(255,120,50,0.55)');
      hg.addColorStop(1, 'rgba(255,120,50,0)');
      g.fillStyle = hg;
      g.fillRect(0, 0, W, H);
    }
    if (light) {
      g.save();
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 4; i++) {
        const x = 30 + i * 60 + Math.sin(t * 0.5 + i) * 8;
        const lg = g.createLinearGradient(0, 0, 0, H);
        lg.addColorStop(0, 'rgba(200,255,235,0.12)');
        lg.addColorStop(1, 'rgba(200,255,235,0)');
        g.fillStyle = lg;
        g.beginPath(); g.moveTo(x - 8, 0); g.lineTo(x + 10, 0); g.lineTo(x + 40, H); g.lineTo(x - 10, H); g.fill();
      }
      g.restore();
    }
    if (k === 'shield' || k === 'aerobic') {   // pęcherzyki tlenu
      g.strokeStyle = 'rgba(200,230,255,0.4)';
      for (let i = 0; i < 12; i++) {
        const x = (i * 53) % W, y = H - ((t * 20 + i * 37) % H);
        g.beginPath(); g.arc(x, y, 1.5 + (i % 3), 0, TAU); g.stroke();
      }
    }

    const cell = c.cell;
    if (c.creature) {
      // organizm płynie w miejscu: ruch „na sucho”, pozycja głowy stała
      const hx = cell.segs.length ? 165 : 120, hy = 80;
      cell.energy = 80; cell.health = 100; cell.water = 100; cell.breath = 100;
      cell.x = hx; cell.y = hy; cell.vx = 40; cell.vy = 0;
      cell.update(dt, PREVIEW_WORLD, [1, 0]);
      cell.x = hx; cell.y = hy; cell.heading = 0;
      if (cell.segs.length) cell.segs.forEach((s, i) => { s.x = hx - i * cell.radius * cell.P.gap; s.y = hy + Math.sin(t * 3 - i * 0.6) * 3; });
      cell.draw(g, t);
      continue;
    }
    const moving = k === 'flagellum' || k === 'alga' || k === 'predator';
    const cx = moving ? 135 : 110;
    cell.energy = 80;
    cell.health = 100;
    cell.x = cx; cell.y = 75;
    cell.heading = k === 'predator' ? Math.PI : 0;
    cell.vx = k === 'flagellum' ? 55 : 0;
    cell.vy = 0;
    cell.update(dt, PREVIEW_WORLD, [0, 0]);
    cell.x = cx; cell.y = 75;
    cell.heading = k === 'predator' ? Math.PI : 0;
    if (c.extra) {
      c.extra.energy = 80;
      c.extra.update(dt, PREVIEW_WORLD, [0, 0]);
      c.extra.x = (k === 'predator' ? 40 : 182) + Math.sin(t * 1.3) * 6;
      c.extra.y = 92 + Math.cos(t * 1.1) * 5;
      c.extra.draw(g, t);
    }
    cell.draw(g, t);
  }
}
