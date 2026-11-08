// Ery: od protokomórki (4 mld lat temu) do pierwszego organizmu wielokomórkowego (ok. 600 mln lat temu).
// Każda era ma listę celów wykonywanych po kolei. Cel z polem `live` czyta wartość wprost ze świata,
// pozostałe liczą postęp przez progress(key, ile). `done` to cecha, którą ród zyskuje po wykonaniu celu.
// startChoice – rozdroże na początku ery, endChoice – rozdroże po wykonaniu wszystkich celów.
const ERAS = {
  1: {
    name: 'Pierwotny ocean', when: 'ok. 4 mld lat temu',
    objectives: [
      { key: 'div', title: 'Narodziny Rodu', goal: 10,
        desc: 'Podziel się 10 razy, aby dotrzeć do Rozdroża Ewolucji.' },
    ],
    endChoice: 'era1',
  },
  2: {
    name: 'Wspólny przodek', when: 'ok. 3,8 mld lat temu',
    intro: 'Świat RNA odchodzi. RNA jest kruche i łatwo się psuje – trwalsze DNA przejmie przechowywanie genów, ' +
      'a białka staną się sprawniejszymi enzymami. W porach kominów alkalicznych ciepła, zasadowa woda styka się ' +
      'z kwaśnym oceanem. Ta naturalna różnica pH napędza pierwsze pompy jonowe i syntezę ATP. ' +
      'Tak najpewniej żył LUCA – ostatni wspólny przodek wszystkich organizmów na Ziemi.',
    objectives: [
      { key: 'nuc', title: 'Kod DNA', goal: 20, done: 'dna',
        desc: 'Zbierz 20 nukleotydów (niebieskie drobiny) wypływających z porów kominów alkalicznych.' },
      { key: 'chemi', title: 'Chemiosmoza', goal: 30, done: 'pumps',
        desc: 'Przebywaj łącznie 30 s w ciepłej wodzie przy kominie alkalicznym. Gradient pH buduje pompy jonowe.' },
    ],
    endChoice: 'domain',
  },
  3: {
    name: 'Wyścig metabolizmów', when: 'ok. 3,5 mld lat temu',
    startChoice: 'meta',
    objectives: [
      { key: 'meta', title: 'Nowe źródło energii', goal: 100,
        desc: 'Zdobądź 100 energii dzięki nowemu metabolizmowi.' },
      { key: 'mat', title: 'Mata mikrobiologiczna', goal: 20,
        desc: 'Utrzymaj blisko siebie przez 20 s co najmniej 6 komórek rodu urodzonych w tej erze (wytwarzają śluz). Śluz łączy je w matę, ' +
          'która osłania przed UV i rozprowadza energię.' },
    ],
  },
  4: {
    name: 'Wielkie Utlenienie', when: 'ok. 2,4 mld lat temu',
    startChoice: 'oxy',
    objectives: [
      { key: 'o2', title: 'Przetrwaj Wielkie Utlenienie', goal: 100, live: () => world.env.o2 * 100, unit: '% tlenu',
        desc: 'Tlen wypełnia ocean, a żelazo wytrąca się w rdzawych płatkach. Utrzymaj ród przy życiu. ' +
          'Po drodze przyjdzie zlodowacenie – metan, który ogrzewał planetę, znika.' },
      { key: 'div', title: 'Nowy świat', goal: 5,
        desc: 'Podziel się 5 razy w natlenionym oceanie. Warstwa ozonu osłabiła UV – przy powierzchni jest bezpieczniej.' },
    ],
  },
  5: {
    name: 'Komórka złożona', when: 'ok. 2 mld lat temu',
    intro: 'W oceanie żyją alfaproteobakterie, które oddychają tlenem. Archeon z grupy Asgard wysuwa ku nim długie ' +
      'wypustki błony, wymienia z nimi substancje, aż w końcu je otacza. Bakteria nie zostaje strawiona – staje się ' +
      'mitochondrium, elektrownią komórki. Dopiero z nią komórka mogła urosnąć tysiące razy, wytworzyć jądro i cytoszkielet. ' +
      'To najważniejsze zdarzenie na drodze do organizmów złożonych.',
    objectives: [
      { key: 'sym', title: 'Endosymbioza', goal: 3, done: 'euk',
        desc: 'Zbliż się do alfaproteobakterii (małe czerwone pałeczki) i trzymaj się przy niej, aż ją otoczysz. Potrzebne 3.' },
      { key: 'meio', title: 'Mejoza', goal: 3, done: 'sex',
        desc: 'Podziel się 3 razy tuż obok innej eukariotycznej komórki rodu (np. własnego potomka) – geny obu komórek wymieszają się.' },
    ],
    endChoice: 'euk',
  },
  6: {
    name: 'Organizm wielokomórkowy', when: 'ok. 720–600 mln lat temu',
    intro: 'Ziemia-śnieżka: lód skuwa oceany aż po równik, a życie przetrwa w ciepłej wodzie przy kominach i w szczelinach lodu. ' +
      'Kiedy lód stopnieje, tlenu będzie więcej niż kiedykolwiek. Twój ród jest gotowy na kolejny krok: komórki po podziale ' +
      'przestają się rozchodzić. Sklejają je białka adhezyjne, porozumiewają się sygnałami chemicznymi i dzielą się pracą. ' +
      'Organizm musi jednak pilnować komórek, które dzielą się tylko dla siebie – to biologiczny odpowiednik nowotworu.',
    objectives: [
      { key: 'col5', title: 'Adhezja', goal: 5, live: () => Colony.size(),
        desc: 'Dziel się – potomkowie zostają przyklejeni do Ciebie. Zbuduj kolonię z 5 komórek.' },
      { key: 'sig', title: 'Sygnały i specjalizacja', goal: 20, done: 'special',
        desc: 'Utrzymaj kolonię z co najmniej 5 komórek przez 20 s (postęp nie przepada, gdy kolonia na chwilę się zmniejszy). ' +
          'Komórki zaczną dzielić się pracą: zewnętrzne poruszają organizm, wewnętrzne zostają komórkami rozrodczymi.' },
      { key: 'cheat', title: 'Strażnik organizmu', goal: 3,
        desc: 'Komórki-oszustki (czerwone) dzielą się bez kontroli i kradną energię. Naciśnij E, by wywołać ich apoptozę. Usuń 3 – ' +
          'potem organizm wykształci geny strażnicze i sam będzie się ich pozbywał.' },
      { key: 'col12', title: 'Pierwszy organizm', goal: 12, live: () => Colony.healthy(),
        desc: 'Rozwiń organizm do 12 zdrowych komórek.' },
    ],
  },
};


// Zakończenia gry – zależą od drogi wybranej w Erze 5
const ENDINGS = {
  alga: {
    title: 'Pierwsza roślina wodna',
    text: 'Twój ród stał się wielokomórkowym glonem: kulą komórek w galaretowatej osłonce, z wiciowymi komórkami ciała ' +
      'i wyspecjalizowanymi komórkami rozrodczymi – jak dzisiejszy Volvox. Pierwszym znanym organizmem tego typu jest krasnorost ' +
      'Bangiomorpha sprzed ok. 1 mld lat. Od takich glonów wywodzą się wszystkie rośliny lądowe.',
  },
  predator: {
    title: 'Pierwsze zwierzę',
    text: 'Twój ród stał się prostym zwierzęciem: komórki kołnierzykowe z wiciami pędzą wodę i łapią pokarm, ' +
      'a we wnętrzu żyją komórki rozrodcze otoczone macierzą białkową – jak u dzisiejszych gąbek. ' +
      'Wkrótce w ediakarze (ok. 575 mln lat temu) oceany zapełnią się pierwszymi dużymi zwierzętami.',
  },
};

// ---------- Ery organizmów wielokomórkowych (wyjście z wody) ----------
// col – kolumna na drzewie ewolucji; next – następna era (liczba albo funkcja cech gracza)
Object.assign(ERAS, {
  7: {
    name: 'Ediakar', when: 'ok. 575 mln lat temu', col: 7, creature: true, next: 8,
    intro: 'Lody stopniały, tlenu jest więcej niż kiedykolwiek. Dno płytkich mórz pokrywają maty mikrobiologiczne, ' +
      'a wśród nich żyją pierwsze duże organizmy: liściowate Charnie przyczepione do dna i płaskie, pikowane Dickinsonie, ' +
      'które pełzają po macie i trawią ją całą powierzchnią ciała. Twój ród jest jednym z nich.',
    objectives: [
      { key: 'eat:mat', title: 'Wypas na matach', goal: 25,
        desc: 'Pełznij po dnie i zjadaj maty mikrobiologiczne (oliwkowe kępki).' },
      { key: 'brood', title: 'Potomstwo', goal: 3,
        desc: 'Gdy biomasa się zapełni, naciśnij SPACJĘ – wydaj na świat potomka. Potrzeba 3.' },
    ],
    endChoice: 'eumet',
  },
  8: {
    name: 'Eksplozja kambryjska', when: 'ok. 539 mln lat temu', col: 8, creature: true, next: t => (t.arthro ? 9 : 10),
    intro: 'W ciągu kilkudziesięciu milionów lat pojawiają się prawie wszystkie dzisiejsze typy zwierząt. Zaczyna się wyścig zbrojeń: ' +
      'drapieżniki takie jak metrowy anomalokarys polują z pomocą oczu i chwytnych odnóży, a ofiary odpowiadają pancerzami, ' +
      'muszlami i zagrzebywaniem się w dnie. Twój ród to robak o dwubocznej budowie: ma głowę, mięśnie i przewód pokarmowy na przelot.',
    objectives: [
      { key: 'eat:any', title: 'Nowe pokarmy', goal: 25, desc: 'Zjedz 25 porcji pokarmu – drobin w wodzie albo mat na dnie.' },
      { key: 'time:light', title: 'Pierwsze oczy', goal: 20, done: 'eyes',
        desc: 'Przebywaj 20 s w jasnej wodzie (płycej niż ok. 60 m). Plamki światłoczułe zmienią się w oczy.' },
      { key: 'survive', title: 'Wyścig zbrojeń', goal: 60,
        desc: 'Przetrwaj 60 s wśród polujących anomalokarysów. Oczy pokazują je strzałkami na krawędzi ekranu.' },
    ],
    endChoice: 'kambr',
  },
  9: {
    name: 'Stawonogi na brzegu', when: 'ok. 425 mln lat temu (sylur)', col: 9, creature: true,
    intro: 'Przy brzegu rosną pierwsze niskie rośliny lądowe, a ich szczątki gniją na wilgotnej ziemi. Na lądzie nie ma jeszcze żadnych ' +
      'zwierząt – czeka tam pokarm bez konkurencji. Twój ród to stawonóg: chitynowy pancerz i członowane odnóża już pozwalają mu chodzić. ' +
      'Brakuje dwóch rzeczy: ochrony przed wysychaniem i oddychania powietrzem.',
    objectives: [
      { key: 'time:tidal', title: 'Strefa pływów', goal: 20, done: 'wax',
        desc: 'Przebywaj 20 s w strefie pływów przy samym brzegu. Pancerz pokryje się woskiem, który chroni przed wysychaniem.' },
      { key: 'eat:detritus', title: 'Pokarm na lądzie', goal: 8, done: 'tracheae',
        desc: 'Wyjdź na ląd (płyń w prawo przy dnie) i zjedz 8 szczątków roślin. Wewnątrz ciała rozwiną się tchawki do oddychania powietrzem.' },
      { key: 'brood:land', title: 'Życie na lądzie', goal: 3,
        desc: 'Wydaj potomstwo 3 razy na lądzie (SPACJA, gdy biomasa jest pełna).' },
    ],
    ending: 'arthroLand',
  },
  10: {
    name: 'Pierwsze ryby', when: 'ok. 470 mln lat temu (ordowik)', col: 9, creature: true, next: 11,
    intro: 'Potomkowie strunowców mają już czaszkę, kręgi i skrzela. Pierwsze ryby nie mają szczęk ani płetw parzystych – ' +
      'ich głowę osłaniają kostne płyty, a pokarm zasysają z wody i dna. Mórz pilnują drapieżniki: kilkumetrowe głowonogi ' +
      'z prostymi muszlami i wielkoraki.',
    objectives: [
      { key: 'eat:any', title: 'Filtrowanie', goal: 30, desc: 'Zjedz 30 porcji pokarmu z wody.' },
      { key: 'survive', title: 'Przetrwanie', goal: 60, desc: 'Przetrwaj 60 s wśród drapieżników. Pancerz głowy osłabia ich ugryzienia.' },
    ],
    endChoice: 'szczeki',
  },
  11: {
    name: 'Ryby szczękowe', when: 'ok. 420 mln lat temu (sylur–dewon)', col: 10, creature: true, next: 12,
    intro: 'Przedni łuk skrzelowy zmienił się w szczęki. Ryba może teraz chwytać ofiary, a parzyste płetwy dają jej sterowność. ' +
      'Najgroźniejsze są pancerne płytoskóre – jak dunkleosteus z ostrymi płytami zamiast zębów.',
    objectives: [
      { key: 'kill', title: 'Polowanie', goal: 6, desc: 'Złap 6 mniejszych ryb (dopłyń do nich – ofiara musi być mniejsza od Ciebie).' },
      { key: 'time:shallow', title: 'Płytkie wody', goal: 30, done: 'lungs',
        desc: 'Przebywaj 30 s w płytkiej, ciepłej wodzie przy brzegu. Jest w niej mało tlenu – rozwiną się płuca do łykania powietrza.' },
    ],
    endChoice: 'pletwy',
  },
  12: {
    name: 'Wyjście z wody', when: 'ok. 375 mln lat temu (dewon)', col: 11, creature: true,
    intro: 'Przy brzegu rosną pierwsze lasy, a w płytkich, dusznych rozlewiskach żyją ryby mięśniopłetwe takie jak Tiktaalik: ' +
      'płaska głowa z oczami na wierzchu, płuca i płetwy z kośćmi ramienia i przedramienia. Na lądzie biegają już wije i pajęczaki – ' +
      'pokarm, po który nikt inny nie sięga.',
    objectives: [
      { key: 'breath', title: 'Haust powietrza', goal: 5, desc: 'Wynurz głowę nad wodę 5 razy, by zaczerpnąć powietrza.' },
      { key: 'time:crawl', title: 'Płetwy w kończyny', goal: 30, done: 'limbs',
        desc: 'Pełzaj 30 s po dnie płycizny, podpierając się płetwami. Wyrosną z nich kończyny z palcami.' },
      { key: 'kill:land', title: 'Na lądzie', goal: 4, desc: 'Wyjdź na ląd i złap 4 wije.' },
    ],
    ending: 'tetrapod',
  },
  13: {
    name: 'Zielenice', when: 'ok. 700–500 mln lat temu', col: 7, creature: true,
    intro: 'Twój ród to wielokomórkowa zielenica. W morzach i jeziorach glony tworzą coraz bardziej złożone plechy: ' +
      'jedne zostaną w oceanie jako wielkie wodorosty, inne zasiedlą płytkie, słodkie wody przy brzegu, które co jakiś czas wysychają. ' +
      'To z nich wyrosną rośliny lądowe.',
    objectives: [
      { key: 'energy:light', title: 'Fotosynteza', goal: 100, desc: 'Zgromadź 100 energii ze światła. Najjaśniej jest tuż pod powierzchnią.' },
      { key: 'time:lagoon', title: 'Płycizna przy brzegu', goal: 20, desc: 'Przebywaj 20 s w bardzo płytkiej wodzie przy samym brzegu.' },
    ],
    endChoice: 'glony',
  },
  14: {
    name: 'Pierwsze rośliny lądowe', when: 'ok. 470 mln lat temu (ordowik)', col: 8, creature: true,
    intro: 'Ląd jest nagi – tylko skały, piasek i cienkie skorupki sinic. Roślina, która tu wejdzie, musi nie wyschnąć, ' +
      'zdobyć wodę i minerały bez korzeni i rozsiać się w suchym powietrzu. Pomogą jej grzyby: skamieniałości pokazują, ' +
      'że pierwsze rośliny lądowe żyły z nimi w symbiozie (mikoryza).',
    objectives: [
      { key: 'time:tidal', title: 'Kutykula', goal: 20, done: 'cuticle',
        desc: 'Przebywaj 20 s w strefie pływów. Powierzchnię plechy pokryje woskowa kutykula, która nie przepuszcza wody.' },
      { key: 'bond:fungus', title: 'Mikoryza', goal: 3, done: 'myco',
        desc: 'Wyjdź na ląd i zatrzymaj się przy 3 grzybach (białe strzępki), aż połączą się z Tobą.' },
      { key: 'spores:land', title: 'Zarodniki', goal: 5, desc: 'Rozsiej zarodniki 5 razy na lądzie (SPACJA, gdy biomasa jest pełna).' },
    ],
    ending: 'landPlant',
  },
});
for (let n = 1; n <= 5; n++) { ERAS[n].col = n; ERAS[n].next = n + 1; }
ERAS[6].col = 6;
ERAS[6].next = t => (t.alga ? 13 : 7);

Object.assign(ENDINGS, {
  jelly: { title: 'Parzydełkowce', when: 'od ok. 560 mln lat do dziś', land: false,
    text: 'Twój ród wybrał symetrię promienistą: polipy przyczepione do dna i pływające meduzy z jadowitymi parzydełkami. ' +
      'Przetrwały wszystkie wielkie wymierania – dzisiejsze koralowce budują rafy widoczne z kosmosu. Na ląd jednak nigdy nie wyszły: ' +
      'galaretowate ciało bez szkieletu i skóry chroniącej przed wysychaniem nie ma tam szans.' },
  mollusk: { title: 'Głowonogi – władcy mórz', when: 'ok. 470 mln lat temu', land: false,
    text: 'Twój ród to mięczaki. Głowonogi z prostymi, kilkumetrowymi muszlami były największymi drapieżnikami ordowiku, ' +
      'a ich potomkami są dzisiejsze łodziki, mątwy i ośmiornice. Z mięczaków na ląd wyszły tylko ślimaki – i to dopiero ' +
      'ok. 100 mln lat później, gdy lądy pokryły już lasy.' },
  jawless: { title: 'Pancerne bezżuchwowce', when: 'ok. 470–360 mln lat temu', land: false,
    text: 'Twój ród pozostał rybą bez szczęk, chronioną kostnym pancerzem. Przez 100 mln lat bezżuchwowce były bardzo liczne, ' +
      'ale nie wytrzymały konkurencji z rybami szczękowymi i wymarły pod koniec dewonu. Do dziś przetrwały tylko minogi i śluzice.' },
  rayfin: { title: 'Władcy wód – ryby promieniopłetwe', when: 'od ok. 420 mln lat do dziś', land: false,
    text: 'Twój ród wybrał cienkie płetwy rozpięte na promieniach i pęcherz pławny. To najbardziej udana grupa kręgowców: ' +
      'ponad 30 tysięcy gatunków, od koników morskich po tuńczyki. Ląd zostawiły jednak kuzynom z mięsistymi płetwami.' },
  seaweed: { title: 'Las wodorostów', when: 'od ok. 500 mln lat do dziś', land: false,
    text: 'Twój ród został w morzu jako wielki glon z czepnikiem, łodyżką i liściastymi plechami z pęcherzami powietrza. ' +
      'Takie podwodne lasy są dziś domem tysięcy gatunków, ale nigdy nie opuściły wody.' },
  arthroLand: { title: 'Pierwszy lądowy stawonóg', when: 'ok. 425 mln lat temu', land: true,
    text: 'Twój ród wyszedł z wody jako jedno z pierwszych zwierząt lądowych – podobne do wija Pneumodesmus, ' +
      'najstarszego znanego zwierzęcia oddychającego powietrzem. Woskowy pancerz chroni przed wysychaniem, a tchawki doprowadzają ' +
      'powietrze do tkanek. Potomkowie tej drogi to owady, pająki i skorupiaki lądowe – dziś najliczniejsze zwierzęta na Ziemi.' },
  tetrapod: { title: 'Pierwszy czworonóg', when: 'ok. 375–365 mln lat temu', land: true,
    text: 'Twój ród wyszedł z wody jak Tiktaalik, a jego potomkowie – jak Acanthostega i Ichthyostega – mieli już cztery kończyny z palcami. ' +
      'Od nich pochodzą wszystkie płazy, gady, ptaki i ssaki, w tym człowiek. Nasze ręce to przebudowane płetwy dewońskiej ryby.' },
  landPlant: { title: 'Pierwsza roślina lądowa', when: 'ok. 470–430 mln lat temu', land: true,
    text: 'Twój ród zasiedlił ląd jak pierwsze rośliny zarodnikowe – wątrobowce i Cooksonia. Kutykula chroni przed wysychaniem, ' +
      'grzyby dostarczają wody i fosforu, a zarodniki w twardej osłonce niesie wiatr. Rośliny przygotowały ląd dla zwierząt: ' +
      'dały im pokarm, cień, wilgoć i glebę.' },
});
