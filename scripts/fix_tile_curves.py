import json

with open(r'f:\Proyectos\CASAosServer\carcassonne-web\server\engine\verified_tiles.json') as f:
    catalog = json.load(f)

# Tiles 33, 34, 35, 36, 37 are City curve + Road curve (Type J / Type K)
# Top-Left: City North, East: City or Road.
# Let's verify standard Carcassonne tile types:
# Type J: City North, Road East, Road South, Field West [C, R, R, F]
# Type K: City North, Field East, Road South, Road West [C, F, R, R]
# Type L: City North, Road East, Road South, Road West [C, R, R, R]
# Type O: City North, City East, Field South, Field West + Shield [C, C, F, F]
# Type P: City North, City East, Field South, Field West [C, C, F, F]

catalog['base_21_33']['edges'] = ['C', 'R', 'R', 'F'] # City North, Road East & South, Field West
catalog['base_21_34']['edges'] = ['C', 'R', 'R', 'F']
catalog['base_21_35']['edges'] = ['C', 'F', 'R', 'R']
catalog['base_21_36']['edges'] = ['C', 'F', 'R', 'R']
catalog['base_21_37']['edges'] = ['C', 'F', 'R', 'R']

with open(r'f:\Proyectos\CASAosServer\carcassonne-web\server\engine\verified_tiles.json', 'w') as f:
    json.dump(catalog, f, indent=2)

print("Updated verified_tiles.json with exact Carcassonne Type J/K edges.")
