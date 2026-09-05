import json

with open(r'f:\Proyectos\CASAosServer\carcassonne-web\server\engine\canonical_tiles.json', encoding='utf-8') as f:
    tiles = json.load(f)

print("=== INSPECCIONANDO TODAS LAS LOSETAS DE RIO Y BASE ===")
for tid, t in tiles.items():
    if t.get('isRiver') or 'river' in tid:
        print(f"{tid}: edges={t['edges']}, name={t['name']}")
