import os
import json
from PIL import Image

tiles_dir = r"f:\Proyectos\CASAosServer\carcassonne-web\client\assets\tiles"

def analyze_all():
    catalog = {}
    for prefix in ['base_21', 'base_22', 'river_23']:
        files = [f for f in sorted(os.listdir(tiles_dir)) if f.startswith(prefix) and f.endswith('.png')]
        for fname in files:
            img = Image.open(os.path.join(tiles_dir, fname)).convert('RGB')
            w, h = img.size
            samples = {
                'N': (int(w * 0.5), int(h * 0.05)),
                'E': (int(w * 0.95), int(h * 0.5)),
                'S': (int(w * 0.5), int(h * 0.95)),
                'W': (int(w * 0.05), int(h * 0.5)),
                'C': (int(w * 0.5), int(h * 0.5)),
            }
            
            res_edges = {}
            for k, (px, py) in samples.items():
                r_t, g_t, b_t, count = 0, 0, 0, 0
                for dx in range(-4, 5):
                    for dy in range(-4, 5):
                        nx, ny = px + dx, py + dy
                        if 0 <= nx < w and 0 <= ny < h:
                            r, g, b = img.getpixel((nx, ny))[:3]
                            r_t += r; g_t += g; b_t += b; count += 1
                rgb = (r_t // count, g_t // count, b_t // count)
                r, g, b = rgb
                if b > 140 and b > r + 30:
                    feat = 'W'
                elif r > 115 and g > 115 and b > 100 and abs(r - g) < 30 and abs(g - b) < 35:
                    feat = 'R'
                elif r > g + 10 and r > b + 15 and r > 80:
                    feat = 'C'
                elif g > r and g > b:
                    feat = 'F'
                else:
                    feat = 'F'
                res_edges[k] = feat

            tile_id = os.path.splitext(fname)[0]
            catalog[tile_id] = {
                'id': tile_id,
                'edges': [res_edges['N'], res_edges['E'], res_edges['S'], res_edges['W']],
                'center': res_edges['C'],
                'image': f"assets/tiles/{fname}"
            }
    return catalog

catalog = analyze_all()
with open(r"f:\Proyectos\CASAosServer\carcassonne-web\server\engine\exact_tiles.json", "w", encoding="utf-8") as fp:
    json.dump(catalog, fp, indent=2)

print(f"Catalog saved with {len(catalog)} tiles.")
