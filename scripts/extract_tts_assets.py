import os
import urllib.request
from PIL import Image

output_dir = r"f:\Proyectos\CASAosServer\carcassonne-web\client\assets\tiles"
os.makedirs(output_dir, exist_ok=True)

decks = [
    {
        "name": "base_part1",
        "url": "https://i.imgur.com/WE0lBn7.jpg",
        "cols": 10,
        "rows": 6,
        "count": 60,
        "prefix": "base_21"
    },
    {
        "name": "base_part2",
        "url": "https://i.imgur.com/irOivbD.jpg",
        "cols": 10,
        "rows": 2,
        "count": 12,
        "prefix": "base_22"
    },
    {
        "name": "river",
        "url": "https://i.imgur.com/4L8kD6q.jpg",
        "cols": 6,
        "rows": 2,
        "count": 12,
        "prefix": "river_23"
    },
    {
        "name": "back",
        "url": "https://i.imgur.com/TE4keCz.jpg",
        "cols": 1,
        "rows": 1,
        "count": 1,
        "prefix": "tile_back"
    }
]

headers = {'User-Agent': 'Mozilla/5.0'}

for deck in decks:
    print(f"Downloading {deck['name']} from {deck['url']}...")
    req = urllib.request.Request(deck['url'], headers=headers)
    temp_path = os.path.join(output_dir, f"_temp_{deck['name']}.jpg")
    
    try:
        with urllib.request.urlopen(req) as resp, open(temp_path, 'wb') as out_file:
            out_file.write(resp.read())
        
        img = Image.open(temp_path)
        img_w, img_h = img.size
        tile_w = img_w / deck['cols']
        tile_h = img_h / deck['rows']
        
        idx = 0
        for r in range(deck['rows']):
            for c in range(deck['cols']):
                if idx >= deck['count']:
                    break
                left = int(c * tile_w)
                top = int(r * tile_h)
                right = int((c + 1) * tile_w)
                bottom = int((r + 1) * tile_h)
                
                cropped = img.crop((left, top, right, bottom))
                tile_filename = f"{deck['prefix']}_{idx:02d}.png" if deck['count'] > 1 else f"{deck['prefix']}.png"
                cropped.save(os.path.join(output_dir, tile_filename), "PNG")
                idx += 1
                
        print(f"  Extracted {idx} tiles for {deck['name']}.")
        if os.path.exists(temp_path):
            os.remove(temp_path)
            
    except Exception as e:
        print(f"  Error extracting {deck['name']}: {e}")

print("Asset extraction complete.")
