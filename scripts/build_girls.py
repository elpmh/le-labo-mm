#!/usr/bin/env python3
"""Turn each named Martin Martin piece into a 'girl' — a little character.

Reads site/data/products.json, writes site/data/girls.json.
Personas are templated deterministically from the piece's own facets, so the
output is free to generate and identical on every run. Run after build_dataset.py.
"""
import json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IN = os.path.join(ROOT, "site", "data", "products.json")
OUT = os.path.join(ROOT, "site", "data", "girls.json")

DARK = {"black","navy","grey","brown","chocolate","burgundy","khaki","taupe"}
LIGHT = {"white","ivory","cream","beige","ecru","glacier","camel"}
BOLD_COLORS = {"red","orange","yellow","pink","purple","green","gold","leopard"}

# banques de phrases par catégorie — tirage déterministe par nom
OPENERS = {
  "Dresses": ["Elle entre dans une pièce sans hausser la voix.",
              "Elle dit oui, et improvise le reste.",
              "Elle a sa robe parfaite, et la porte partout."],
  "Shirts":  ["Elle croit qu'une belle chemise règle presque tout.",
              "Elle retrousse ses manches et fait avancer les choses.",
              "Elle rentre, à moitié, et n'y pense jamais deux fois."],
  "Trousers":["Elle marche vite et prend les escaliers.",
              "Elle préfère l'allure au confort — mais veut les deux.",
              "Elle a des opinions, et un très beau pantalon."],
  "Skirts":  ["Romantique en haut, pragmatique en bas.",
              "Elle aime le mouvement quand elle marche.",
              "Elle s'habille pour la journée qu'elle a décidé d'avoir."],
  "Knitwear":["Elle a toujours un peu froid, et s'habille en conséquence.",
              "C'est l'amie dont on veut toujours voler le pull.",
              "Elle mesure ses journées en cafés et en laine douce."],
  "Bodysuits":["Elle aime la ligne nette, sans chichi.",
               "Elle construit chaque tenue depuis la base.",
               "Minimale par choix, jamais par défaut."],
  "Tops":    ["Elle est l'ancrage discret de chaque tenue.",
              "Elle reste simple pour laisser chanter le reste.",
              "Un naturel qui, en vérité, demande du soin."],
  "Jackets & Coats":["C'est elle qui vous prête son manteau.",
                     "Elle arrive déjà habillée pour le temps et pour la pièce.",
                     "Elle laisse le vestiaire parler à sa place."],
  "Sets":    ["Aucune décision avant midi — alors elle assortit.",
              "Une humeur entière, du haut jusqu'en bas.",
              "Elle aime ce qui va déjà ensemble."],
  "Accessories":["Tout est dans le détail, chez elle.",
                 "Elle finit la phrase que les autres ont oubliée.",
                 "Elle collectionne les petits riens qui font tout."],
  "Other":   ["Difficile à ranger — et c'est très bien ainsi.",
              "Elle est l'exception à vos propres règles."],
}
PALETTE_LINE = {
  "dark":  "Sa palette tient de l'encre et de l'ombre — elle gomme la couleur.",
  "light": "Elle vit en crème et en ivoire, douce mais jamais fragile.",
  "bold":  "Elle n'a pas peur de la couleur, ni des regards.",
  "neutral":"Elle reste dans les tons et laisse la coupe s'exprimer.",
}
OCCASION_LINE = {
  "event": "On la croise à la cérémonie, au cocktail, à l'after.",
  "travel":"On l'attrape entre deux trains, agaçante de fraîcheur.",
  "everyday":"Une icône du mardi — la vraie vie, bien menée.",
}

def palette_group(colors):
  cs = set(colors)
  if cs & BOLD_COLORS: return "bold"
  if cs and cs <= DARK: return "dark"
  if cs and cs <= LIGHT: return "light"
  return "neutral"

def price_tier(p):
  return "accessible" if p<=120 else ("mid" if p<=220 else "investment")

def boldness(p, palette, pattern):
  return "bold" if (palette=="bold" or pattern=="patterned") else "quiet"

def is_person_name(name):
  # one or two capitalized words, letters only (excludes 'Carte Cadeau', jewelry)
  if not name or not name[0].isupper(): return False
  if re.search(r"[/0-9]", name): return False
  if "-" in name: return False                  # hyphenated = a set (Pam-Jo)
  words = name.split()
  if len(words) != 1: return False              # single first name only
  low = name.lower()
  if any(w in low for w in ("coquillage","shell","cadeau","charm","xl")): return False
  return bool(re.fullmatch(r"[A-Za-zÀ-ÿ']+", name))

def persona(name, cat, colors, occasions, pattern):
  h = sum(ord(c) for c in name)                 # stable per-name seed
  opener = OPENERS.get(cat, OPENERS["Other"])
  line1 = opener[h % len(opener)]
  pal = palette_group(colors)
  line2 = PALETTE_LINE[pal]
  occ = occasions[0] if occasions else "everyday"
  line3 = OCCASION_LINE.get(occ, OCCASION_LINE["everyday"])
  return f"{line1} {line2} {line3}"

def build():
  prods = json.load(open(IN))
  girls = []
  for p in prods:
    if not is_person_name(p["name"]) or not p["image"]:
      continue
    pal = palette_group(p["colors"])
    occ = p["occasions"][0] if p["occasions"] else "everyday"
    girls.append({
      "name": p["name"],
      "piece": p["title"],
      "category": p["category"],
      "categoryFr": p.get("categoryFr", p["category"]),
      "price": p["price"],
      "colors": p["colors"],
      "colorsFr": p.get("colorsFr", p["colors"]),
      "image": p["image"],
      "url": p["url"],
      "available": p["anyAvailable"],
      "persona": persona(p["name"], p["category"], p["colors"], p["occasions"], p["pattern"]),
      # quiz-scoring facets
      "occasion": occ,
      "palette": pal,
      "boldness": boldness(p, pal, p["pattern"]),
      "tier": price_tier(p["price"]),
    })
  # de-dupe repeated names (e.g. several 'Boy' shirts) keeping the available one
  seen = {}
  for g in girls:
    k = g["name"]
    if k not in seen or (g["available"] and not seen[k]["available"]):
      seen[k] = g
  girls = sorted(seen.values(), key=lambda g: g["name"])
  json.dump(girls, open(OUT,"w"), ensure_ascii=False, indent=1)
  print(f"wrote {len(girls)} girls -> site/data/girls.json")
  print("sample:", girls[0]["name"], "—", girls[0]["persona"])

if __name__ == "__main__":
  build()
