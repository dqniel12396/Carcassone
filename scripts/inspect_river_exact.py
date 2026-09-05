import os
from PIL import Image

tiles_dir = r"f:\Proyectos\CASAosServer\carcassonne-web\client\assets\tiles"

# Sample 4 edges (N, E, S, W) and center (C)
def get_sample_rgb(img, x_f, y_f):
    w, h = img.size
    px, py = int(x_f * w), int(y_f * h)
    r_t, g_t, b_t, count = 0, 0, 0, 0
    for dx in range(-3, 4):
        for dy in range(-3, 4):
            nx, ny = px + dx, py + dy
            if 0 <= nx < w and 0 <= ny < h:
                r, g, b = img.getpixel((nx, ny))[:3]
                r_t += r; g_t += g; b_t += b; count += 1
    return (r_t // count, g_t // count, b_t // count)

def detect_feature(rgb):
    r, g, b = rgb
    # Water / River: High blue or bluish grey
    if b > r and b > g - 10 and (b > 110 or (r < 100 and g < 130 and b > 80)):
        return 'W'
    # City: Brownish / Orange / Roof tiles (R highest)
    if r > g + 10 and r > b + 15 and r > 90:
        return 'C'
    # Road: Light greyish sand / pavement (r, g, b close to each other, > 110)
    if r > 110 and g > 110 and b > 100 and abs(r - g) < 25 and abs(r - b) < 35:
        return 'R'
    # Field: Lush green (G highest)
    if g > r and g > b:
        return 'F'
    return 'F'

print("=== RIVER TILES ===")
for i in range(12):
    fname = f"river_23_{i:02d}.png"
    img = Image.open(os.path.join(tiles_dir, fname)).convert('RGB')
    n = detect_feature(get_sample_rgb(img, 0.5, 0.05))
    e = detect_feature(get_sample_rgb(img, 0.95, 0.5))
    s = detect_feature(get_sample_rgb(img, 0.5, 0.95))
    w = detect_feature(get_sample_rgb(img, 0.05, 0.5))
    c = detect_feature(get_sample_rgb(img, 0.5, 0.5))
    print(f"{fname} -> N:{n}, E:{e}, S:{s}, W:{w}, C:{c} | Raw N:{get_sample_rgb(img, 0.5, 0.05)} E:{get_sample_rgb(img, 0.95, 0.5)} S:{get_sample_rgb(img, 0.5, 0.95)} W:{get_sample_rgb(img, 0.05, 0.5)} C:{get_sample_rgb(img, 0.5, 0.5)}")
