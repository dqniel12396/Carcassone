import os
import json
from PIL import Image

tiles_dir = r"f:\Proyectos\CASAosServer\carcassonne-web\client\assets\tiles"

def sample_color(img, x_pct, y_pct):
    w, h = img.size
    px = int(x_pct * w)
    py = int(y_pct * h)
    # Average 5x5 block
    r_t, g_t, b_t, count = 0, 0, 0, 0
    for dx in range(-2, 3):
        for dy in range(-2, 3):
            nx, ny = px + dx, py + dy
            if 0 <= nx < w and 0 <= ny < h:
                r, g, b = img.getpixel((nx, ny))[:3]
                r_t += r
                g_t += g
                b_t += b
                count += 1
    return (r_t // count, g_t // count, b_t // count)

results = []
for fname in sorted(os.listdir(tiles_dir)):
    if not fname.endswith('.png') or fname.startswith('tile_back'):
        continue
    img_path = os.path.join(tiles_dir, fname)
    img = Image.open(img_path).convert('RGB')
    
    n_col = sample_color(img, 0.5, 0.05)
    e_col = sample_color(img, 0.95, 0.5)
    s_col = sample_color(img, 0.5, 0.95)
    w_col = sample_color(img, 0.05, 0.5)
    c_col = sample_color(img, 0.5, 0.5)
    
    results.append({
        "file": fname,
        "N": n_col, "E": e_col, "S": s_col, "W": w_col, "Center": c_col
    })

print(f"Sampled {len(results)} tiles.")
for r in results[:10]:
    print(r['file'], "N:", r['N'], "E:", r['E'], "S:", r['S'], "W:", r['W'], "C:", r['Center'])
