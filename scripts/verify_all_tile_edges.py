import json
import os

with open(r'f:\Proyectos\CASAosServer\carcassonne-web\server\engine\canonical_tiles.json', encoding='utf-8') as f:
    tiles = json.load(f)

# Let's inspect river_23_00 and other river tiles specifically
# Look at river_23_00 image
print("river_23_00 edges:", tiles['river_23_00']['edges'])
print("river_23_01 edges:", tiles['river_23_01']['edges'])
print("river_23_02 edges:", tiles['river_23_02']['edges'])
print("river_23_03 edges:", tiles['river_23_03']['edges'])
print("river_23_04 edges:", tiles['river_23_04']['edges'])
print("river_23_05 edges:", tiles['river_23_05']['edges'])
print("river_23_06 edges:", tiles['river_23_06']['edges'])
print("river_23_07 edges:", tiles['river_23_07']['edges'])
print("river_23_08 edges:", tiles['river_23_08']['edges'])
print("river_23_09 edges:", tiles['river_23_09']['edges'])
print("river_23_10 edges:", tiles['river_23_10']['edges'])
print("river_23_11 edges:", tiles['river_23_11']['edges'])
