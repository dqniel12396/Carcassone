import os
from PIL import Image, ImageDraw

output_dir = r"f:\Proyectos\CASAosServer\carcassonne-web\client\assets\meeples"
os.makedirs(output_dir, exist_ok=True)

# Standard iconic Carcassonne Meeple SVG path
# Head, arms, legs, body
meeple_svg_template = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">
  <defs>
    <filter id="shadow_{color_name}" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="2" dy="4" stdDeviation="3" flood-color="rgba(0,0,0,0.5)"/>
    </filter>
    <linearGradient id="grad_{color_name}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="{color_light}"/>
      <stop offset="100%" stop-color="{color_dark}"/>
    </linearGradient>
  </defs>
  <path d="M 50,8 C 57,8 63,14 63,21 C 63,26 60,30 55,33 C 65,34 76,37 84,43 C 86,45 88,48 87,51 C 85,55 80,57 76,55 C 73,53 71,49 68,48 C 68,54 68,61 69,67 C 69,69 71,71 74,72 C 77,73 80,75 80,79 C 80,83 76,86 72,86 C 68,86 65,83 63,79 C 61,74 59,69 57,64 C 54,64 52,64 50,64 C 48,64 46,64 43,64 C 41,69 39,74 37,79 C 35,83 32,86 28,86 C 24,86 20,83 20,79 C 20,75 23,73 26,72 C 29,71 31,69 31,67 C 32,61 32,54 32,48 C 29,49 27,53 24,55 C 20,57 15,55 13,51 C 12,48 14,45 16,43 C 24,37 35,34 45,33 C 40,30 37,26 37,21 C 37,14 43,8 50,8 Z"
        fill="url(#grad_{color_name})" 
        stroke="{color_dark}" 
        stroke-width="2" 
        filter="url(#shadow_{color_name})"/>
</svg>"""

colors = [
    {"name": "red", "light": "#ff6b6b", "dark": "#c0392b"},
    {"name": "blue", "light": "#54a0ff", "dark": "#2980b9"},
    {"name": "green", "light": "#1dd1a1", "dark": "#10ac84"},
    {"name": "yellow", "light": "#feca57", "dark": "#d39e00"},
    {"name": "black", "light": "#576574", "dark": "#222f3e"},
    {"name": "pink", "light": "#ff9ff3", "dark": "#f368e0"},
]

for col in colors:
    svg_content = meeple_svg_template.format(
        color_name=col["name"],
        color_light=col["light"],
        color_dark=col["dark"]
    )
    svg_path = os.path.join(output_dir, f"meeple_{col['name']}.svg")
    with open(svg_path, "w", encoding="utf-8") as f:
        f.write(svg_content)
    print(f"Generated {svg_path}")

print("Meeples generation complete.")
