import os
from PIL import Image

tiles_dir = r"f:\Proyectos\CASAosServer\carcassonne-web\client\assets\tiles"

# Check all tiles to find the exact tile in Image 4
for fn in sorted(os.listdir(tiles_dir)):
    if fn.endswith('.png'):
        img = Image.open(os.path.join(tiles_dir, fn))
        # Let's inspect river tiles and crossroads
        if 'river' in fn or 'base_21_07' in fn or 'base_21_30' in fn or 'base_21_62' in fn:
            print(f"{fn} size: {img.size}")
