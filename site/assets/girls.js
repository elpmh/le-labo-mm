// Le Quiz MM — cinq questions sur ta personnalité et tes habitudes, puis on
// t'associe à une pièce prénommée. Chaque réponse pèse sur des dimensions
// (occasion · palette · registre · budget) que porte chaque personnage.

const $ = s => document.querySelector(s);
let GIRLS = [];

// chaque réponse ajoute des points aux valeurs des facettes des personnages
const QUESTIONS = [
  { q: "Tu organises ton vendredi soir. Tu es plutôt…", opts: [
      ["Un dîner qui finit tard, là où l'on se fait belle", {occasion:{event:2}, tier:{investment:1}, boldness:{bold:1}}],
      ["Un vernissage, puis un dernier verre en petit comité", {occasion:{event:1}, palette:{dark:1}, boldness:{quiet:1}}],
      ["Canapé, série, personne à impressionner", {occasion:{everyday:2}, boldness:{quiet:1}, palette:{light:1}}],
      ["Le sac est bouclé, tu files pour le week-end", {occasion:{travel:2}}] ] },

  { q: "Le matin, devant l'armoire, tu attrapes…", opts: [
      ["Trois pièces neutres qui vont avec tout", {palette:{neutral:2}, boldness:{quiet:1}, occasion:{travel:1}}],
      ["Une couleur, un imprimé — quelque chose qui se remarque", {palette:{bold:2}, boldness:{bold:2}}],
      ["Du noir, toujours : plus simple, plus net", {palette:{dark:2}, boldness:{quiet:1}}],
      ["Du doux et du lumineux — crème, ivoire, beige", {palette:{light:2}}] ] },

  { q: "Ton dimanche idéal, c'est…", opts: [
      ["Marché, café en terrasse, flâner Rive Gauche", {occasion:{everyday:2}, palette:{neutral:1}}],
      ["Une expo, un musée, un long café à lire", {occasion:{everyday:1}, palette:{dark:1}, boldness:{quiet:1}}],
      ["Un brunch entre amies qui s'éternise", {occasion:{everyday:1}, palette:{light:1}}],
      ["Un train, une ville nouvelle à explorer", {occasion:{travel:2}}] ] },

  { q: "Une amie te décrit en un mot…", opts: [
      ["Audacieuse", {boldness:{bold:2}, palette:{bold:1}}],
      ["Discrète", {boldness:{quiet:2}, palette:{neutral:1}}],
      ["Élégante", {boldness:{quiet:1}, tier:{investment:1}, occasion:{event:1}}],
      ["Solaire", {palette:{light:2}, boldness:{bold:1}}] ] },

  { q: "Devant une belle pièce, tu…", opts: [
      ["Craques — c'est un coup de cœur", {tier:{accessible:1, mid:1}, boldness:{bold:1}}],
      ["Investis : tu la garderas dix ans", {tier:{investment:2}, boldness:{quiet:1}}],
      ["Regardes la coupe d'abord, le prix ensuite", {tier:{investment:1, mid:1}, palette:{neutral:1}}],
      ["Attends les soldes, l'œil malin", {tier:{accessible:2}}] ] },
];

const DIM_W = { occasion: 1.3, palette: 1.0, boldness: 1.0, tier: 0.7 };
const profile = { occasion:{}, palette:{}, boldness:{}, tier:{} };
let step = 0;

function apply(weights){
  for (const dim in weights)
    for (const val in weights[dim])
      profile[dim][val] = (profile[dim][val] || 0) + weights[dim][val];
}

function renderQuestion(){
  const { q, opts } = QUESTIONS[step];
  $("#quiz").innerHTML = `
    <div class="qcard">
      <div class="bar"><i style="width:${(step/QUESTIONS.length)*100}%"></i></div>
      <p class="qnum">${step+1} / ${QUESTIONS.length}</p>
      <p class="qtext">${q}</p>
      <div class="opts">
        ${opts.map((_,i)=>`<button class="opt" data-i="${i}">${opts[i][0]}</button>`).join("")}
      </div>
    </div>`;
  document.querySelectorAll(".opt").forEach(b => b.addEventListener("click", () => {
    apply(QUESTIONS[step].opts[+b.dataset.i][1]);
    step++;
    if (step < QUESTIONS.length) renderQuestion(); else reveal();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }));
}

function scoreGirl(g){
  let s = 0;
  s += (profile.occasion[g.occasion] || 0) * DIM_W.occasion;
  s += (profile.palette[g.palette]   || 0) * DIM_W.palette;
  s += (profile.boldness[g.boldness] || 0) * DIM_W.boldness;
  s += (profile.tier[g.tier]         || 0) * DIM_W.tier;
  return s;
}

function reveal(){
  $("#quiz").innerHTML = "";
  const ranked = GIRLS.map(g => ({ g, s: scoreGirl(g) }))
    .sort((a,b) => b.s - a.s || a.g.name.localeCompare(b.g.name));
  const top = ranked[0].g;
  const alsos = ranked.slice(1, 4).map(x => x.g);
  $("#reveal").innerHTML = `
    <p class="kicker" style="text-align:center">Tu es…</p>
    <div class="reveal">
      <div class="ph" style="background-image:url(${top.image}&width=800)"></div>
      <div class="txt">
        <h2>${top.name}</h2>
        <p class="sub" style="margin:8px 0 0">${top.piece} · ${top.categoryFr}</p>
        <p class="persona">${top.persona}</p>
        <p style="margin:0 0 24px">
          ${(top.colorsFr||[]).map(c=>`<span class="tag">${c}</span>`).join("")}
          <span class="tag">€${top.price.toFixed(0)}</span>
          ${top.available?"":'<span class="tag">épuisé</span>'}</p>
        <div style="display:flex;gap:12px;flex-wrap:wrap">
          <a class="btn" href="${top.url}" target="_blank" rel="noopener">Voir ${top.name}</a>
          <button class="btn ghost" id="again">Recommencer</button>
        </div>
      </div>
    </div>
    <p class="kicker" style="text-align:center;margin:34px 0 14px">Tu t'entendrais aussi avec…</p>
    <div class="grid" style="max-width:800px;margin:0 auto">${alsos.map(card).join("")}</div>`;
  $("#again").addEventListener("click", () => {
    for (const d in profile) profile[d] = {};
    step = 0; $("#reveal").innerHTML = ""; renderQuestion();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  $("#reveal").scrollIntoView({ behavior: "smooth" });
}

const card = g => `
  <a class="card" href="${g.url}" target="_blank" rel="noopener">
    <div class="ph" style="background-image:url(${g.image}&width=500)"></div>
    <div class="meta">
      <p class="nm">${g.name}</p>
      <p class="sub">${g.categoryFr}${g.available?"":" · épuisé"}</p>
      <p style="font-family:var(--serif);font-size:15px;color:#6b6255;line-height:1.4;margin:6px 0 0">${g.persona.split(". ")[0]}.</p>
    </div></a>`;

async function init(){
  GIRLS = await (await fetch("data/girls.json")).json();
  $("#count").textContent = GIRLS.length;
  $("#gallery").innerHTML = GIRLS.map(card).join("");
  renderQuestion();
}
init();
