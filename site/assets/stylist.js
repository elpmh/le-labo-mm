// Le Styliste — composition de looks par le sens, 100% dans le navigateur.
// Aucune clé, aucun serveur. Modèle multilingue (FR) via transformers.js,
// avec repli par mots-clés si le modèle ne charge pas. Puis assemblage cohérent.

const $ = s => document.querySelector(s);
const statusEl = $("#status"), resultEl = $("#result");
let PRODUCTS = [], EMB = null, extractor = null;

const NEUTRALS = new Set(["black","white","ivory","cream","beige","ecru","grey",
  "navy","camel","taupe","brown","chocolate"]);
const TOP_CATS = ["Tops","Shirts","Knitwear","Bodysuits"];
const BOTTOM_CATS = ["Trousers","Skirts"];

async function loadData(){
  PRODUCTS = (await (await fetch("data/products.json")).json()).filter(p => p.image);
  PRODUCTS.forEach(p => p.doc = [
    p.name, p.categoryFr, p.description, (p.colorsFr||[]).join(" "),
    p.occasions.join(" "), p.pattern||"", p.season||""
  ].join(". ").toLowerCase());
}

// ---- couche sémantique (chargée à la demande) -----------------------------
async function ensureModel(){
  if (extractor) return extractor !== "fallback";
  try{
    statusEl.innerHTML = '<span class="spin"></span>Le styliste se prépare (une fois, ~120 Mo)…';
    const { pipeline } = await import(
      "https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2");
    extractor = await pipeline("feature-extraction",
      "Xenova/paraphrase-multilingual-MiniLM-L12-v2");
    statusEl.textContent = "Lecture du catalogue…";
    const vecs = [];
    for (const p of PRODUCTS){
      const o = await extractor(p.doc, { pooling:"mean", normalize:true });
      vecs.push(Array.from(o.data));
    }
    EMB = vecs;
    return true;
  }catch(e){
    console.warn("modèle sémantique indisponible, repli mots-clés", e);
    extractor = "fallback";
    return false;
  }
}
async function embed(text){
  const o = await extractor(text.toLowerCase(), { pooling:"mean", normalize:true });
  return Array.from(o.data);
}
const dot = (a,b) => { let s=0; for(let i=0;i<a.length;i++) s+=a[i]*b[i]; return s; };

// repli : score par recoupement de mots-clés / facettes (en français)
function keywordScores(q){
  const t = q.toLowerCase();
  const has = (...w) => w.some(x => t.includes(x));
  const want = {
    event: has("mariage","cérémonie","ceremonie","cocktail","vernissage","soirée","soiree","dîner","diner","fête","fete","gala"),
    travel: has("voyage","week-end","weekend","vacances","train","avion","confortable"),
    everyday: has("tous les jours","quotidien","travail","bureau","décontracté","decontracte","ville"),
    black: has("noir","sombre","tout en noir"),
    warm: has("automne","hiver","froid","octobre","novembre","décembre","decembre"),
  };
  return PRODUCTS.map(p => {
    let s = 0;
    if (want.event && p.occasions.includes("event")) s += 3;
    if (want.travel && p.occasions.includes("travel")) s += 3;
    if (want.everyday && p.occasions.includes("everyday")) s += 2;
    if (want.black && p.colors.includes("black")) s += 2;
    if (want.warm && ["Knitwear","Jackets & Coats"].includes(p.category)) s += 2;
    for (const w of t.split(/\W+/)) if (w.length>3 && p.doc.includes(w)) s += 0.5;
    return s;
  });
}

// ---- le goût : cohérence entre deux pièces --------------------------------
// C'est ici que le styliste "a du goût" : deux pièces ne se marient que si
// elles s'accordent en registre (formalité), en palette et en motif.
const BOLD = new Set(["red","orange","yellow","pink","purple","green","gold","leopard"]);

function harmony(a, b){
  let h = 0;
  // 1) registre — le plus déterminant. Une robe cocktail (4) ne va pas avec
  //    une veste utilitaire (2), ni avec un accessoire décontracté.
  const gap = Math.abs((a.formality||2) - (b.formality||2));
  h += gap === 0 ? 0.30 : gap === 1 ? 0.05 : gap === 2 ? -0.55 : -1.0;
  // 2) motif — un seul imprimé par tenue.
  if (a.pattern === "patterned" && b.pattern === "patterned") h -= 0.45;
  // 3) palette — quand les couleurs sont connues.
  const ac = a.colors||[], bc = b.colors||[];
  if (ac.length && bc.length){
    if (ac.some(x => bc.includes(x))) h += 0.20;                 // rappel de couleur
    else if (ac.every(x=>NEUTRALS.has(x)) && bc.every(x=>NEUTRALS.has(x))) h += 0.12;
    const boldA = ac.some(x=>BOLD.has(x)), boldB = bc.some(x=>BOLD.has(x));
    if (boldA && boldB && !ac.some(x=>bc.includes(x))) h -= 0.35; // deux couleurs vives qui se battent
  }
  return h;
}
const meanHarmony = pieces => {
  if (pieces.length < 2) return 0.15;                            // une pièce seule = toujours cohérente
  let s=0,n=0;
  for (let i=0;i<pieces.length;i++) for (let j=i+1;j<pieces.length;j++){ s+=harmony(pieces[i],pieces[j]); n++; }
  return s/n;
};
const role = (p, r) => ({ p, r });
const avail = p => p.anyAvailable;

// meilleures pièces d'une catégorie par pertinence à la requête
function topBy(sc, pred, k){
  return PRODUCTS.map((p,i)=>({p, s: sc[i]}))
    .filter(x => pred(x.p))
    .sort((a,b)=> b.s - a.s)
    .slice(0, k);
}

// ---- assemblage : on note la TENUE ENTIÈRE, pas les pièces isolées --------
function assemble(scores, q){
  // léger malus si épuisé, pour privilégier le disponible
  const sc = scores.map((s,i)=> s - (avail(PRODUCTS[i])?0:0.04));
  const cold = /automne|hiver|froid|octobre|novembre|décembre|decembre|janvier|février|fevrier/i.test(q);
  const mn = Math.min(...sc), rng = (Math.max(...sc) - mn) || 1;
  const idx = new Map(PRODUCTS.map((p,i)=>[p,i]));
  const relOf = p => (sc[idx.get(p)] - mn) / rng;                         // 0..1

  // pièces d'ancrage candidates : robes, ensembles, ou haut+bas
  const dresses = topBy(sc, p=>p.category==="Dresses", 6);
  const sets    = topBy(sc, p=>p.category==="Sets", 3);
  const tops    = topBy(sc, p=>TOP_CATS.includes(p.category), 5);
  const bottoms = topBy(sc, p=>BOTTOM_CATS.includes(p.category), 5);
  const coats   = topBy(sc, p=>p.category==="Jackets & Coats", 6);
  const accs    = topBy(sc, p=>p.category==="Accessories", 8);

  const anchors = [];                       // chaque ancre = [ {p,role}, ... ]
  dresses.forEach(d => anchors.push([role(d.p,"La robe")]));
  sets.forEach(s => anchors.push([role(s.p,"L'ensemble")]));
  tops.forEach(t => bottoms.forEach(b => {
    if (harmony(t.p, b.p) > -0.1)           // n'assemble haut+bas que s'ils s'accordent
      anchors.push([role(t.p,"En haut"), role(b.p,"En bas")]);
  }));

  // note d'une tenue = pertinence moyenne + prime de cohérence
  const REL_W = 1.0, HARM_W = 1.4;
  const scoreLook = look => {
    const pieces = look.map(x=>x.p);
    const rel = pieces.reduce((s,p)=>s+relOf(p),0) / pieces.length;
    return REL_W*rel + HARM_W*meanHarmony(pieces);
  };

  const scored = [];
  for (const base of anchors){
    const anchor = base[0].p;
    let look = base.slice();
    // superposition : seulement si elle s'accorde vraiment (registre) et
    // qu'il fait frais ou que la pièce est très pertinente.
    const coat = coats.find(c => harmony(anchor, c.p) >= 0.0 &&
      base.every(x => harmony(x.p, c.p) >= -0.1));
    if (coat && (cold || relOf(coat.p) > 0.75) && look.length < 3)
      look.push(role(coat.p,"À superposer"));
    // accessoire : uniquement s'il est dans le même registre (sinon on s'abstient)
    const acc = accs.find(a => look.every(x => harmony(x.p, a.p) >= 0.05));
    if (acc) look.push(role(acc.p,"La touche finale"));
    scored.push({ look, s: scoreLook(look) });
  }
  // classe, puis dédoublonne : on garde les meilleures tenues DISTINCTES
  // (signature = jeu de pièces d'ancrage) pour alimenter « Proposez-en un autre ».
  scored.sort((a,b)=> b.s - a.s);
  const seen = new Set(), looks = [];
  for (const { look } of scored){
    const sig = look.filter(x=>x.r!=="La touche finale").map(x=>x.p.name.toLowerCase()).sort().join("-");
    if (seen.has(sig)) continue;
    seen.add(sig); looks.push(look);
    if (looks.length >= 5) break;
  }
  return looks;
}

// ---- explication ----------------------------------------------------------
function explain(look){
  const anchor = look[0].p;
  const bits = [];
  const occ = anchor.occasions[0];
  if (occ==="event") bits.push("bâti autour d'une pièce que Martin Martin destine aux cérémonies et aux cocktails");
  else if (occ==="travel") bits.push("ancré dans la ligne Travel Chic — facile, jamais négligé");
  else bits.push("tenu dans le registre des essentiels de la maison — discret, portable");
  const cols = [...new Set(look.flatMap(x=>x.p.colorsFr||[]))];
  if (cols.length) bits.push(`réuni par une palette ${cols.slice(0,3).join(", ")}`);
  else bits.push("gardé ton sur ton, pour que les pièces ne se disputent pas");
  // registre : signale l'harmonie de formalité qui a guidé le choix
  const F = ["", "décontracté", "de jour", "soigné", "habillé"];
  const f = Math.round(look.reduce((s,x)=>s+(x.p.formality||2),0)/look.length);
  bits.push(`tenu dans un registre ${F[f]||"cohérent"}, sans fausse note`);
  const total = look.reduce((s,x)=>s+x.p.price,0);
  const names = look.map(x=>x.p.name).join(" + ");
  return `Un look ${bits.join(", ")}. ${names} — €${total.toFixed(0)} au total.`;
}

// ---- rendu ----------------------------------------------------------------
let LOOKS = [], LOOKIDX = 0;

function render(look){
  if (!look || !look.length){ resultEl.innerHTML = "<p class='lede'>Pas de correspondance nette — précisez l'occasion ou une couleur.</p>"; return; }
  const card = ({p,r}) => {
    const alt = p.images && p.images[1] ? `<span class="alt" style="background-image:url(${p.images[1]}&width=600)"></span>` : "";
    return `
    <a class="card" href="${p.url}" target="_blank" rel="noopener">
      <div class="ph" style="background-image:url(${p.image}&width=600)">
        ${alt}<span class="role">${r}</span></div>
      <div class="meta">
        <p class="nm">${p.name}</p>
        <p class="sub">${p.categoryFr}${p.anyAvailable?"":" · épuisé"}</p>
        <p class="pr">€${p.price.toFixed(0)}</p>
      </div></a>`;
  };
  const another = LOOKS.length > 1
    ? `<div style="text-align:center;margin-top:44px">
         <button class="btn ghost" id="another">Proposez-en un autre</button>
         <p class="sub" style="margin-top:14px;opacity:.6">Proposition ${LOOKIDX+1} / ${LOOKS.length}</p>
       </div>` : "";
  resultEl.innerHTML = `
    <p class="lede" style="text-align:left;max-width:none;margin:0 0 30px;font-family:var(--serif);font-size:22px;color:#3a352c">${explain(look)}</p>
    <div class="grid">${look.map(card).join("")}</div>${another}`;
  const btn = document.getElementById("another");
  if (btn) btn.addEventListener("click", () => {
    LOOKIDX = (LOOKIDX + 1) % LOOKS.length;
    render(LOOKS[LOOKIDX]);
    resultEl.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

// ---- exécution ------------------------------------------------------------
async function run(){
  const q = $("#q").value.trim() || $("#q").placeholder;   // vide → l'exemple
  $("#q").value = q;
  $("#go").disabled = true;
  const ok = await ensureModel();
  let scores;
  if (ok){
    statusEl.innerHTML = '<span class="spin"></span>Composition…';
    const qv = await embed(q);
    scores = EMB.map(v => dot(qv, v));
  }else{
    statusEl.textContent = "Composition (mode mots-clés)…";
    scores = keywordScores(q);
  }
  LOOKS = assemble(scores, q); LOOKIDX = 0;
  render(LOOKS[0]);
  statusEl.textContent = ok ? "Touchez une pièce pour l'ouvrir sur le site Martin Martin."
                            : "Modèle sémantique indisponible — correspondance par mots-clés.";
  $("#go").disabled = false;
}

$("#go").addEventListener("click", run);
$("#q").addEventListener("keydown", e => {
  if(e.key==="Enter"){ e.preventDefault(); run(); }         // Entrée = habillez-moi
});

await loadData();
statusEl.textContent = `${PRODUCTS.length} pièces chargées.`;
