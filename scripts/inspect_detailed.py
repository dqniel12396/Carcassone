import os
from PIL import Image

tiles_dir = r"f:\Proyectos\CASAosServer\carcassonne-web\client\assets\tiles"

def analyze_tile_full(fname):
    img = Image.open(os.path.join(tiles_dir, fname)).convert('RGB')
    w, h = img.size
    
    # Check 4 edges
    samples = {
        'N': (int(w * 0.5), int(h * 0.05)),
        'E': (int(w * 0.95), int(h * 0.5)),
        'S': (int(w * 0.5), int(h * 0.95)),
        'W': (int(w * 0.05), int(h * 0.5)),
        'C': (int(w * 0.5), int(h * 0.5)),
    }
    
    results = {}
    for k, (px, py) in samples.items():
        r_t, g_t, b_t, count = 0, 0, 0, 0
        for dx in range(-4, 5):
            for dy in range(-4, 5):
                nx, ny = px + dx, py + dy
                if 0 <= nx < w and 0 <= ny < h:
                    r, g, b = img.getpixel((nx, ny))[:3]
                    r_t += r; g_t += g; b_t += b; count += 1
        rgb = (r_t // count, g_t // count, b_t // count)
        
        # Classify
        r, g, b = rgb
        if b > 140 and b > r + 30:
            feat = 'W'
        elif r > 115 and g > 115 and b > 110 and abs(r - g) < 30 and abs(g - b) < 35:
            feat = 'R'
        elif r > g + 10 and r > b + 15 and r > 80:
            feat = 'C'
        elif g > r and g > b:
            feat = 'F'
        else:
            feat = 'F'
        results[k] = (feat, rgb)
    return results

print("=== ALL 12 RIVER TILES DETAILED ===")
for i in range(12):
    fn = f"river_23_{i:02d}.png"
    res = analyze_tile_full(fn)
    print(f"{fn} -> N:{res['N'][0]} E:{res['E'][0]} S:{res['S'][0]} W:{res['W'][0]} Center:{res['C'][0]}")
