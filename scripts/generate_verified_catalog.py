import json
import os
from PIL import Image

tiles_dir = r"f:\Proyectos\CASAosServer\carcassonne-web\client\assets\tiles"

def sample_point(img, x_pct, y_pct):
    w, h = img.size
    px, py = int(x_pct * w), int(y_pct * h)
    r_t, g_t, b_t, count = 0, 0, 0, 0
    for dx in range(-4, 5):
        for dy in range(-4, 5):
            nx, ny = px + dx, py + dy
            if 0 <= nx < w and 0 <= ny < h:
                r, g, b = img.getpixel((nx, ny))[:3]
                r_t += r; g_t += g; b_t += b; count += 1
    return (r_t // count, g_t // count, b_t // count)

def classify_edge(rgb, is_river_set):
    r, g, b = rgb
    
    # In river set, distinctive water blue
    if is_river_set and b > 140 and b > r + 30:
        return 'W'
    
    # Road (greyish/white gravel stripe)
    if (r > 105 and g > 105 and b > 100 and abs(r - g) < 35 and abs(g - b) < 35) or (b > 140 and not is_river_set):
        return 'R'
        
    # City (brownish roof/bricks or stone wall)
    if r > g + 10 and r > b + 15 and r > 75:
        return 'C'
        
    # Field (lush green)
    if g > r and g > b:
        return 'F'
        
    return 'F'

verified_catalog = {}

for fname in sorted(os.listdir(tiles_dir)):
    if not fname.endswith('.png') or fname.startswith('tile_back'):
        continue
    img = Image.open(os.path.join(tiles_dir, fname)).convert('RGB')
    is_river = fname.startswith('river')
    
    # [N, E, S, W]
    n = classify_edge(sample_point(img, 0.5, 0.05), is_river)
    e = classify_edge(sample_point(img, 0.95, 0.5), is_river)
    s = classify_edge(sample_point(img, 0.5, 0.95), is_river)
    w = classify_edge(sample_point(img, 0.05, 0.5), is_river)
    c = classify_edge(sample_point(img, 0.5, 0.5), is_river)

    tile_id = os.path.splitext(fname)[0]
    verified_catalog[tile_id] = {
        "id": tile_id,
        "edges": [n, e, s, w], # [0=N, 1=E, 2=S, 3=W]
        "center": c,
        "isRiver": is_river
    }

with open(r"f:\Proyectos\CASAosServer\carcassonne-web\server\engine\verified_tiles.json", "w") as fp:
    json.dump(verified_catalog, fp, indent=2)

print(f"Generated verified catalog with {len(verified_catalog)} tiles.")
