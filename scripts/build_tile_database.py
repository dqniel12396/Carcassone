import os
import json
from PIL import Image

tiles_dir = r"f:\Proyectos\CASAosServer\carcassonne-web\client\assets\tiles"

def classify_edge(img, side):
    w, h = img.size
    # Sample point along edge
    if side == 'N':
        px, py = int(w * 0.5), int(h * 0.06)
    elif side == 'E':
        px, py = int(w * 0.94), int(h * 0.5)
    elif side == 'S':
        px, py = int(w * 0.5), int(h * 0.94)
    elif side == 'W':
        px, py = int(w * 0.06), int(h * 0.5)
    elif side == 'C':
        px, py = int(w * 0.5), int(h * 0.5)

    r_t, g_t, b_t, count = 0, 0, 0, 0
    for dx in range(-4, 5):
        for dy in range(-4, 5):
            nx, ny = px + dx, py + dy
            if 0 <= nx < w and 0 <= ny < h:
                r, g, b = img.getpixel((nx, ny))[:3]
                r_t += r; g_t += g; b_t += b; count += 1
    r, g, b = r_t // count, g_t // count, b_t // count

    # Determine type based on RGB
    # River / Water: high blue or grayish water
    # Road: very light (high R, G, B, usually greyish-white pavement or brown dirt road with gravel)
    # Field: distinct green (G > R and G > B)
    # City: brownish/brick (R > G > B, or dark stone)
    
    if g > r + 15 and g > b + 15:
        return 'F' # Field
    if r > 120 and g > 120 and b > 120 and abs(r - g) < 25 and abs(g - b) < 25:
        return 'R' # Road
    if r > g and r > b:
        return 'C' # City
    if b > r and b > g:
        return 'W' # Water/River
    return 'F'

def analyze_tile(fname):
    img = Image.open(os.path.join(tiles_dir, fname)).convert('RGB')
    n = classify_edge(img, 'N')
    e = classify_edge(img, 'E')
    s = classify_edge(img, 'S')
    w = classify_edge(img, 'W')
    c = classify_edge(img, 'C')
    
    # Monastery detection (center is red roof/church surrounded by fields)
    has_monastery = False
    if c == 'C' and (n == 'F' or n == 'R') and (s == 'F' or s == 'R') and (e == 'F' or e == 'R') and (w == 'F' or w == 'R'):
        has_monastery = True
        
    return {
        "id": os.path.splitext(fname)[0],
        "image": f"assets/tiles/{fname}",
        "edges": [n, e, s, w], # [N, E, S, W]
        "center": c,
        "monastery": has_monastery,
        "shield": False, # Will refine
        "river": fname.startswith('river')
    }

tiles = []
for f in sorted(os.listdir(tiles_dir)):
    if f.endswith('.png') and not f.startswith('tile_back'):
        tiles.append(analyze_tile(f))

# Let's save a preliminary tiles-data.json
with open(r"f:\Proyectos\CASAosServer\carcassonne-web\server\engine\tiles-data.json", "w", encoding="utf-8") as out:
    json.dump(tiles, out, indent=2)

print(f"Processed {len(tiles)} tiles saved to server/engine/tiles-data.json")
