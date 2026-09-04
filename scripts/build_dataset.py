#!/usr/bin/env python3
"""Turn the raw Shopify products.json into a clean dataset the site consumes.

Input : data/products_raw.json  (fetched from martinmartin-paris.com/products.json)
Output: site/data/products.json (normalized, lean, ready for the browser)

No paid services, no keys. Run: python3 scripts/build_dataset.py
"""
import json, re, os, html

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "products_raw.json")
OUT_DIR = os.path.join(ROOT, "site", "data")
STORE = "https://martinmartin-paris.com"

# --- vocabularies used to parse the messy title/tag data -------------------
COLORS = {
    "noir": "black", "noire": "black", "blanc": "white", "blanche": "white",
    "ivoire": "ivory", "creme": "cream", "crème": "cream", "camel": "camel",
    "marron": "brown", "beige": "beige", "ecru": "ecru", "écru": "ecru",
    "gris": "grey", "grise": "grey", "bleu": "blue", "bleue": "blue",
    "ciel": "sky blue", "marine": "navy", "vert": "green", "verte": "green",
    "kaki": "khaki", "rouge": "red", "rose": "pink", "orange": "orange",
    "jaune": "yellow", "violet": "purple", "violette": "purple",
    "glacier": "glacier", "chocolat": "chocolate", "taupe": "taupe",
    "bordeaux": "burgundy", "leopard": "leopard", "léopard": "leopard",
    "fuchsia": "pink", "corail": "orange", "lilas": "purple", "prune": "purple",
    "moutarde": "yellow", "sable": "beige", "framboise": "red", "menthe": "green",
    # note: 'doré/or/argent' deliberately excluded — false-positive from the
    # ubiquitous "bouton doré signature MM" in descriptions.
}
# words in titles that are size/shape qualifiers, not names or colors
QUALIFIERS = {"mini", "midi", "maxi", "court", "courte", "long", "longue",
              "large", "slim", "oversize", "-"}
# normalize the 20 inconsistent product_type values into clean buckets
CATEGORY_MAP = {
    "robe": "Dresses", "robes": "Dresses",
    "jupe": "Skirts", "jupes": "Skirts",
    "pantalons": "Trousers", "pantalon": "Trousers",
    "chemises": "Shirts", "chemise": "Shirts", "blouses": "Shirts", "polos": "Shirts",
    "tops": "Tops", "top": "Tops",
    "bodys": "Bodysuits", "body": "Bodysuits",
    "pulls": "Knitwear", "pull": "Knitwear",
    "vestes": "Jackets & Coats", "manteaux": "Jackets & Coats",
    "manteaux et vestes": "Jackets & Coats",
    "ensemble": "Sets", "ensembles": "Sets",
    "accessoire": "Accessories", "accessoires": "Accessories",
    "chausette": "Accessories", "chaussette": "Accessories",
}
# English (logic) -> French (display) labels
CATEGORY_FR = {
    "Dresses": "Robes", "Skirts": "Jupes", "Shirts": "Chemises",
    "Sets": "Ensembles", "Trousers": "Pantalons", "Bodysuits": "Bodys",
    "Tops": "Tops", "Jackets & Coats": "Vestes & Manteaux",
    "Accessories": "Accessoires", "Knitwear": "Mailles", "Other": "Autres",
}
COLOR_FR = {
    "black": "noir", "white": "blanc", "ivory": "ivoire", "cream": "crème",
    "camel": "camel", "brown": "marron", "beige": "beige", "ecru": "écru",
    "grey": "gris", "blue": "bleu", "sky blue": "bleu ciel", "navy": "marine",
    "green": "vert", "khaki": "kaki", "red": "rouge", "pink": "rose",
    "orange": "orange", "yellow": "jaune", "purple": "violet",
    "glacier": "glacier", "gold": "doré", "silver": "argent",
    "chocolate": "chocolat", "taupe": "taupe", "burgundy": "bordeaux",
    "leopard": "léopard",
}
CATEGORY_WORDS = {"robe", "jupe", "pantalon", "chemise", "top", "body", "pull",
                  "veste", "manteau", "ensemble", "blouse", "polo", "short",
                  "bermuda", "chausette", "chaussette", "socquette", "sweat",
                  "tailleur", "sautoir", "ceinture", "bracelet", "collier",
                  "boucles", "d'oreilles", "charm", "chaussettes", "carte",
                  "cadeau", "rayures", "pois", "carreaux"}

def strip_html(s):
    s = re.sub(r"<[^>]+>", " ", s or "")
    return re.sub(r"\s+", " ", html.unescape(s)).strip()

def normalize_category(pt, tags):
    key = (pt or "").strip().lower()
    if key in CATEGORY_MAP:
        return CATEGORY_MAP[key]
    low = [t.lower() for t in tags]
    for t in low:                       # fall back to tags when type is blank
        if t in CATEGORY_MAP:
            return CATEGORY_MAP[t]
    return "Other"

def parse_title(title):
    """Split 'Robe mini Constance noir' -> (name, colors)."""
    tokens = re.split(r"[\s]+", title.strip())
    colors, name_parts = [], []
    for tok in tokens:
        low = tok.lower().strip(",")
        if low in COLORS:
            colors.append(COLORS[low])
        elif low in CATEGORY_WORDS or low in QUALIFIERS:
            continue
        else:
            name_parts.append(tok)
    name = " ".join(name_parts).strip(" -") or title
    return name, colors

def colors_from_tags(tags):
    """Pull colour words from the curated colour tags, e.g.
    'Veste - saharienne - noire' -> ['black']. Order-preserving, deduped."""
    found = []
    for tag in tags:
        for tok in re.split(r"[^a-zà-ÿ]+", tag.lower()):
            c = COLORS.get(tok)
            if c and c not in found:
                found.append(c)
    return found

PATTERN_WORDS = ("pois", "rayure", "rayures", "carreaux", "carreau", "léopard",
                 "leopard", "fleuri", "fleurs", "imprimé", "imprime", "animal",
                 "vichy", "pied de poule", "tartan")
CASUAL_WORDS = ("chausette", "chaussette", "socquette", "sweat")

def detect_pattern(tags, title, desc):
    low = {t.lower() for t in tags}
    blob = f"{title} {desc} {' '.join(tags)}".lower()
    if "motif" in low or any(w in blob for w in PATTERN_WORDS):
        return "patterned"
    if "uni" in low:
        return "plain"
    return None

WARM_WORDS = ("sans manche", "sans manches", "manche courte", "manches courtes",
              "bretelle", "débardeur", "lin", "coton léger", "broderie anglaise",
              "dos nu", "short", "bermuda", "ajouré", "crochet", "éponge")
COLD_WORDS = ("manches longues", "manche longue", "laine", "maille", "cachemire",
              "col roulé", "velours", "matelassé", "doudoune", "polaire", "flanelle",
              "épais", "chaud", "tricot", "mohair", "alpaga", "molleton")

def climate(tags, title, desc, category, season):
    """cold · warm · all — is this piece for cold or warm weather?"""
    blob = f"{title} {desc}".lower()
    warm = cold = 0
    if season == "FW26": cold += 2
    elif season in ("SS26", "SUMMER25"): warm += 2
    warm += sum(w in blob for w in WARM_WORDS)
    cold += sum(w in blob for w in COLD_WORDS)
    if category == "Knitwear" or category == "Jackets & Coats": cold += 1
    if cold - warm >= 2: return "cold"
    if warm - cold >= 2: return "warm"
    return "all"

def formality(tags, occasions, category):
    """1=casual · 2=everyday · 3=smart · 4=formal — the taste backbone."""
    low = {t.lower() for t in tags}
    if any(w in t.lower() for t in tags for w in CASUAL_WORDS):
        return 1
    if "event" in occasions:                 # ceremonie / cocktail
        return 4
    f = 3 if category == "Dresses" else 2     # dresses read a touch dressier
    if "travelchic" in low or "travel" in occasions:
        f = min(f, 2)
    return f

def facets(tags, title="", desc="", category="Other"):
    low = {t.lower() for t in tags}
    def any_of(*xs): return any(x in low for x in xs)
    occasions = []
    if any_of("ceremonie", "cocktail dress", "cocktail"): occasions.append("event")
    if "travelchic" in low: occasions.append("travel")
    if any_of("intemporels", "essentiels"): occasions.append("everyday")
    season = "FW26" if "fw26" in low else ("SS26" if "ss26" in low else
             ("SUMMER25" if "summer25" in low else None))
    return {
        "isNew": "newin" in low,
        "onSale": "soldes" in low,
        "capuPick": "capu" in low,
        "pattern": detect_pattern(tags, title, desc),
        "season": season,
        "occasions": occasions,
        "formality": formality(tags, occasions, category),
    }

def build():
    raw = json.load(open(RAW))["products"]
    out = []
    for p in raw:
        variants = p.get("variants", [])
        if not variants:
            continue
        price = float(variants[0]["price"])
        sizes = [{"size": v.get("option1") or v["title"], "available": v["available"]}
                 for v in variants]
        name, colors = parse_title(p["title"])
        for c in colors_from_tags(p.get("tags", [])):   # enrich from colour tags
            if c not in colors:
                colors.append(c)
        imgs = [im["src"] for im in p.get("images", [])]
        cat = normalize_category(p.get("product_type"), p.get("tags", []))
        desc = strip_html(p.get("body_html"))[:400]
        fac = facets(p.get("tags", []), p["title"], desc, cat)
        out.append({
            "id": p["id"],
            "title": p["title"],
            "name": name,
            "category": cat,
            "categoryFr": CATEGORY_FR.get(cat, "Autres"),
            "price": price,
            "colors": colors,
            "colorsFr": [COLOR_FR.get(c, c) for c in colors],
            "description": desc,
            "url": f"{STORE}/products/{p['handle']}",
            "images": imgs,
            "image": imgs[0] if imgs else None,
            "sizes": sizes,
            "anyAvailable": any(s["available"] for s in sizes),
            "tags": p.get("tags", []),
            "climate": climate(p.get("tags", []), p["title"], desc, cat, fac["season"]),
            **fac,
        })
    os.makedirs(OUT_DIR, exist_ok=True)
    json.dump(out, open(os.path.join(OUT_DIR, "products.json"), "w"),
              ensure_ascii=False, indent=1)
    # tiny console report
    cats = {}
    for o in out:
        cats[o["category"]] = cats.get(o["category"], 0) + 1
    print(f"wrote {len(out)} products -> site/data/products.json")
    print("categories:", cats)
    print("named products:", sum(1 for o in out if o["name"] and o["name"][0].isupper()))

if __name__ == "__main__":
    build()
