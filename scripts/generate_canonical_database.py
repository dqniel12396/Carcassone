import json
import os

# Definition of the 24 classic Carcassonne base game tile types (A through X)
# and exact mappings to the 72 base tiles + 12 river tiles

canonical_database = {}

def add_base_tile(tile_id, tile_type, edges, segments, shield=False, monastery=False, is_start=False):
    canonical_database[tile_id] = {
        "id": tile_id,
        "name": f"Loseta Base {tile_id} (Tipo {tile_type})",
        "set": "base",
        "type": tile_type,
        "edges": edges, # [N, E, S, W]
        "shield": shield,
        "monastery": monastery,
        "isStartTile": is_start,
        "isRiver": False,
        "image": f"assets/tiles/{tile_id}.png",
        "segments": segments
    }

# Build Type A (2x)
for tid in ["base_21_00", "base_21_01"]:
    add_base_tile(tid, "A", ["F", "F", "R", "F"], [
        { "id": "monastery", "type": "monastery", "name": "Monasterio (Monje)", "edges": [], "pos": { "x": 0.5, "y": 0.45 }, "color": "#e67e22" },
        { "id": "road_S", "type": "road", "name": "Camino Sur (Bandido)", "edges": ["S"], "pos": { "x": 0.5, "y": 0.8 }, "color": "#f39c12", "isTerminus": True },
        { "id": "field", "type": "field", "name": "Campo (Granjero)", "edges": ["N", "E", "W", "S_W", "S_E"], "pos": { "x": 0.2, "y": 0.2 }, "color": "#27ae60", "touchesCities": [] }
    ], monastery=True)

# Build Type B (4x)
for tid in ["base_21_02", "base_21_03", "base_21_04", "base_21_05"]:
    add_base_tile(tid, "B", ["F", "F", "F", "F"], [
        { "id": "monastery", "type": "monastery", "name": "Monasterio (Monje)", "edges": [], "pos": { "x": 0.5, "y": 0.5 }, "color": "#e67e22" },
        { "id": "field", "type": "field", "name": "Campo (Granjero)", "edges": ["N", "E", "S", "W"], "pos": { "x": 0.2, "y": 0.2 }, "color": "#27ae60", "touchesCities": [] }
    ], monastery=True)

# Build Type C (1x)
add_base_tile("base_21_06", "C", ["C", "C", "C", "C"], [
    { "id": "city", "type": "city", "name": "Gran Ciudad (Caballero)", "edges": ["N", "E", "S", "W"], "pos": { "x": 0.5, "y": 0.5 }, "color": "#3498db" }
], shield=True)

# Build Type D (4x) - Tile 07 is official start tile
for idx, tid in enumerate(["base_21_07", "base_21_08", "base_21_09", "base_21_10"]):
    add_base_tile(tid, "D", ["C", "R", "F", "R"], [
        { "id": "city_N", "type": "city", "name": "Ciudad Norte (Caballero)", "edges": ["N"], "pos": { "x": 0.5, "y": 0.2 }, "color": "#3498db" },
        { "id": "road_EW", "type": "road", "name": "Camino Este-Oeste (Bandido)", "edges": ["E", "W"], "pos": { "x": 0.5, "y": 0.52 }, "color": "#f39c12" },
        { "id": "field_N", "type": "field", "name": "Campo Norte (Granjero)", "edges": ["E_N", "W_N"], "pos": { "x": 0.2, "y": 0.38 }, "color": "#27ae60", "touchesCities": ["city_N"] },
        { "id": "field_S", "type": "field", "name": "Campo Sur (Granjero)", "edges": ["S", "E_S", "W_S"], "pos": { "x": 0.5, "y": 0.8 }, "color": "#27ae60", "touchesCities": [] }
    ], is_start=(idx == 0))

# Build Type E (5x)
for tid in ["base_21_11", "base_21_12", "base_21_13", "base_21_14", "base_21_15"]:
    add_base_tile(tid, "E", ["C", "F", "F", "F"], [
        { "id": "city_N", "type": "city", "name": "Ciudad Norte (Caballero)", "edges": ["N"], "pos": { "x": 0.5, "y": 0.2 }, "color": "#3498db" },
        { "id": "field", "type": "field", "name": "Campo (Granjero)", "edges": ["E", "S", "W", "N_E", "N_W"], "pos": { "x": 0.5, "y": 0.65 }, "color": "#27ae60", "touchesCities": ["city_N"] }
    ])

# Build Type F (2x) with shield
for tid in ["base_21_16", "base_21_17"]:
    add_base_tile(tid, "F", ["C", "F", "C", "F"], [
        { "id": "city_bridge", "type": "city", "name": "Ciudad Central (Caballero)", "edges": ["N", "S"], "pos": { "x": 0.5, "y": 0.5 }, "color": "#3498db" },
        { "id": "field_W", "type": "field", "name": "Campo Oeste (Granjero)", "edges": ["W"], "pos": { "x": 0.18, "y": 0.5 }, "color": "#27ae60", "touchesCities": ["city_bridge"] },
        { "id": "field_E", "type": "field", "name": "Campo Este (Granjero)", "edges": ["E"], "pos": { "x": 0.82, "y": 0.5 }, "color": "#27ae60", "touchesCities": ["city_bridge"] }
    ], shield=True)

# Build Type G (1x)
add_base_tile("base_21_18", "G", ["C", "F", "C", "F"], [
    { "id": "city_bridge", "type": "city", "name": "Ciudad Central (Caballero)", "edges": ["N", "S"], "pos": { "x": 0.5, "y": 0.5 }, "color": "#3498db" },
    { "id": "field_W", "type": "field", "name": "Campo Oeste (Granjero)", "edges": ["W"], "pos": { "x": 0.18, "y": 0.5 }, "color": "#27ae60", "touchesCities": ["city_bridge"] },
    { "id": "field_E", "type": "field", "name": "Campo Este (Granjero)", "edges": ["E"], "pos": { "x": 0.82, "y": 0.5 }, "color": "#27ae60", "touchesCities": ["city_bridge"] }
], shield=False)

# Build Type H (3x) - 2 separate cities
for tid in ["base_21_19", "base_21_20", "base_21_21"]:
    add_base_tile(tid, "H", ["C", "C", "F", "F"], [
        { "id": "city_N", "type": "city", "name": "Ciudad Norte (Caballero)", "edges": ["N"], "pos": { "x": 0.5, "y": 0.18 }, "color": "#3498db" },
        { "id": "city_E", "type": "city", "name": "Ciudad Este (Caballero)", "edges": ["E"], "pos": { "x": 0.82, "y": 0.5 }, "color": "#3498db" },
        { "id": "field", "type": "field", "name": "Campo (Granjero)", "edges": ["S", "W"], "pos": { "x": 0.35, "y": 0.65 }, "color": "#27ae60", "touchesCities": ["city_N", "city_E"] }
    ])

# Build Type I (2x) - Connected corner city
for tid in ["base_21_22", "base_21_23"]:
    add_base_tile(tid, "I", ["C", "F", "F", "C"], [
        { "id": "city_NW", "type": "city", "name": "Ciudad Curva NO (Caballero)", "edges": ["N", "W"], "pos": { "x": 0.35, "y": 0.35 }, "color": "#3498db" },
        { "id": "field_SE", "type": "field", "name": "Campo SE (Granjero)", "edges": ["E", "S"], "pos": { "x": 0.65, "y": 0.65 }, "color": "#27ae60", "touchesCities": ["city_NW"] }
    ])

# Build Type J (3x) - City North, Road East & South
for tid in ["base_21_24", "base_21_25", "base_21_26"]:
    add_base_tile(tid, "J", ["C", "R", "R", "F"], [
        { "id": "city_N", "type": "city", "name": "Ciudad Norte (Caballero)", "edges": ["N"], "pos": { "x": 0.5, "y": 0.18 }, "color": "#3498db" },
        { "id": "road_SE", "type": "road", "name": "Camino Curva (Bandido)", "edges": ["E", "S"], "pos": { "x": 0.65, "y": 0.65 }, "color": "#f39c12" },
        { "id": "field_inner", "type": "field", "name": "Campo Interior (Granjero)", "edges": ["E_S", "S_E"], "pos": { "x": 0.85, "y": 0.85 }, "color": "#27ae60", "touchesCities": [] },
        { "id": "field_outer", "type": "field", "name": "Campo Exterior (Granjero)", "edges": ["W", "E_N", "S_W"], "pos": { "x": 0.3, "y": 0.55 }, "color": "#27ae60", "touchesCities": ["city_N"] }
    ])

# Build Type K (3x) - City North, Road South & West
for tid in ["base_21_27", "base_21_28", "base_21_29"]:
    add_base_tile(tid, "K", ["C", "F", "R", "R"], [
        { "id": "city_N", "type": "city", "name": "Ciudad Norte (Caballero)", "edges": ["N"], "pos": { "x": 0.5, "y": 0.18 }, "color": "#3498db" },
        { "id": "road_SW", "type": "road", "name": "Camino Curva (Bandido)", "edges": ["S", "W"], "pos": { "x": 0.35, "y": 0.65 }, "color": "#f39c12" },
        { "id": "field_inner", "type": "field", "name": "Campo Interior (Granjero)", "edges": ["S_W", "W_S"], "pos": { "x": 0.15, "y": 0.85 }, "color": "#27ae60", "touchesCities": [] },
        { "id": "field_outer", "type": "field", "name": "Campo Exterior (Granjero)", "edges": ["E", "S_E", "W_N"], "pos": { "x": 0.7, "y": 0.55 }, "color": "#27ae60", "touchesCities": ["city_N"] }
    ])

# Build Type L (3x) - City North, 3-way Road (3 separate branch roads ending in village)
for tid in ["base_21_30", "base_21_31", "base_21_32"]:
    add_base_tile(tid, "L", ["C", "R", "R", "R"], [
        { "id": "city_N", "type": "city", "name": "Ciudad Norte (Caballero)", "edges": ["N"], "pos": { "x": 0.5, "y": 0.18 }, "color": "#3498db" },
        { "id": "road_E", "type": "road", "name": "Camino Este (Bandido)", "edges": ["E"], "pos": { "x": 0.75, "y": 0.55 }, "color": "#f39c12", "isTerminus": True },
        { "id": "road_S", "type": "road", "name": "Camino Sur (Bandido)", "edges": ["S"], "pos": { "x": 0.5, "y": 0.8 }, "color": "#f39c12", "isTerminus": True },
        { "id": "road_W", "type": "road", "name": "Camino Oeste (Bandido)", "edges": ["W"], "pos": { "x": 0.25, "y": 0.55 }, "color": "#f39c12", "isTerminus": True },
        { "id": "field_SW", "type": "field", "name": "Campo SO (Granjero)", "edges": ["S_W", "W_S"], "pos": { "x": 0.2, "y": 0.8 }, "color": "#27ae60", "touchesCities": [] },
        { "id": "field_SE", "type": "field", "name": "Campo SE (Granjero)", "edges": ["S_E", "E_S"], "pos": { "x": 0.8, "y": 0.8 }, "color": "#27ae60", "touchesCities": [] },
        { "id": "field_N", "type": "field", "name": "Campo Norte (Granjero)", "edges": ["W_N", "E_N"], "pos": { "x": 0.5, "y": 0.4 }, "color": "#27ae60", "touchesCities": ["city_N"] }
    ])

# Build Type M (2x) - City Corner with Shield
for tid in ["base_21_33", "base_21_34"]:
    add_base_tile(tid, "M", ["C", "C", "F", "F"], [
        { "id": "city_NE", "type": "city", "name": "Ciudad Curva con Escudo (Caballero)", "edges": ["N", "E"], "pos": { "x": 0.65, "y": 0.35 }, "color": "#3498db" },
        { "id": "field_SW", "type": "field", "name": "Campo SO (Granjero)", "edges": ["S", "W"], "pos": { "x": 0.3, "y": 0.7 }, "color": "#27ae60", "touchesCities": ["city_NE"] }
    ], shield=True)

# Build Type N (3x) - City Corner without Shield
for tid in ["base_21_35", "base_21_36", "base_21_37"]:
    add_base_tile(tid, "N", ["C", "C", "F", "F"], [
        { "id": "city_NE", "type": "city", "name": "Ciudad Curva (Caballero)", "edges": ["N", "E"], "pos": { "x": 0.65, "y": 0.35 }, "color": "#3498db" },
        { "id": "field_SW", "type": "field", "name": "Campo SO (Granjero)", "edges": ["S", "W"], "pos": { "x": 0.3, "y": 0.7 }, "color": "#27ae60", "touchesCities": ["city_NE"] }
    ], shield=False)

# Build Type O (2x) - City 3 sides, Road South with Shield
for tid in ["base_21_38", "base_21_39"]:
    add_base_tile(tid, "O", ["C", "C", "R", "C"], [
        { "id": "city_main", "type": "city", "name": "Gran Ciudad con Escudo (Caballero)", "edges": ["N", "E", "W"], "pos": { "x": 0.5, "y": 0.35 }, "color": "#3498db" },
        { "id": "road_S", "type": "road", "name": "Camino Sur (Bandido)", "edges": ["S"], "pos": { "x": 0.5, "y": 0.85 }, "color": "#f39c12", "isTerminus": True },
        { "id": "field_SW", "type": "field", "name": "Campo SO (Granjero)", "edges": ["S_W"], "pos": { "x": 0.2, "y": 0.85 }, "color": "#27ae60", "touchesCities": ["city_main"] },
        { "id": "field_SE", "type": "field", "name": "Campo SE (Granjero)", "edges": ["S_E"], "pos": { "x": 0.8, "y": 0.85 }, "color": "#27ae60", "touchesCities": ["city_main"] }
    ], shield=True)

# Build Type P (3x) - City 3 sides, Road South without Shield
for tid in ["base_21_40", "base_21_41", "base_21_42"]:
    add_base_tile(tid, "P", ["C", "C", "R", "C"], [
        { "id": "city_main", "type": "city", "name": "Gran Ciudad (Caballero)", "edges": ["N", "E", "W"], "pos": { "x": 0.5, "y": 0.35 }, "color": "#3498db" },
        { "id": "road_S", "type": "road", "name": "Camino Sur (Bandido)", "edges": ["S"], "pos": { "x": 0.5, "y": 0.85 }, "color": "#f39c12", "isTerminus": True },
        { "id": "field_SW", "type": "field", "name": "Campo SO (Granjero)", "edges": ["S_W"], "pos": { "x": 0.2, "y": 0.85 }, "color": "#27ae60", "touchesCities": ["city_main"] },
        { "id": "field_SE", "type": "field", "name": "Campo SE (Granjero)", "edges": ["S_E"], "pos": { "x": 0.8, "y": 0.85 }, "color": "#27ae60", "touchesCities": ["city_main"] }
    ], shield=False)

# Build Type Q (1x) - City 3 sides with Shield
add_base_tile("base_21_43", "Q", ["C", "C", "F", "C"], [
    { "id": "city_main", "type": "city", "name": "Gran Ciudad con Escudo (Caballero)", "edges": ["N", "E", "W"], "pos": { "x": 0.5, "y": 0.35 }, "color": "#3498db" },
    { "id": "field_S", "type": "field", "name": "Campo Sur (Granjero)", "edges": ["S"], "pos": { "x": 0.5, "y": 0.85 }, "color": "#27ae60", "touchesCities": ["city_main"] }
], shield=True)

# Build Type R (3x) - City 3 sides without Shield
for tid in ["base_21_44", "base_21_45", "base_21_46"]:
    add_base_tile(tid, "R", ["C", "C", "F", "C"], [
        { "id": "city_main", "type": "city", "name": "Gran Ciudad (Caballero)", "edges": ["N", "E", "W"], "pos": { "x": 0.5, "y": 0.35 }, "color": "#3498db" },
        { "id": "field_S", "type": "field", "name": "Campo Sur (Granjero)", "edges": ["S"], "pos": { "x": 0.5, "y": 0.85 }, "color": "#27ae60", "touchesCities": ["city_main"] }
    ], shield=False)

# Build Type S (2x) - City NE with Road SW with Shield
for tid in ["base_21_47", "base_21_48"]:
    add_base_tile(tid, "S", ["C", "C", "R", "R"], [
        { "id": "city_NE", "type": "city", "name": "Ciudad Curva con Escudo (Caballero)", "edges": ["N", "E"], "pos": { "x": 0.65, "y": 0.35 }, "color": "#3498db" },
        { "id": "road_SW", "type": "road", "name": "Camino Curvo (Bandido)", "edges": ["S", "W"], "pos": { "x": 0.35, "y": 0.65 }, "color": "#f39c12" },
        { "id": "field_inner", "type": "field", "name": "Campo Interior (Granjero)", "edges": ["S_W", "W_S"], "pos": { "x": 0.15, "y": 0.85 }, "color": "#27ae60", "touchesCities": [] },
        { "id": "field_outer", "type": "field", "name": "Campo Exterior (Granjero)", "edges": ["S_E", "W_N"], "pos": { "x": 0.5, "y": 0.5 }, "color": "#27ae60", "touchesCities": ["city_NE"] }
    ], shield=True)

# Build Type T (1x) - City NE with Road SW without Shield
add_base_tile("base_21_49", "T", ["C", "C", "R", "R"], [
    { "id": "city_NE", "type": "city", "name": "Ciudad Curva (Caballero)", "edges": ["N", "E"], "pos": { "x": 0.65, "y": 0.35 }, "color": "#3498db" },
    { "id": "road_SW", "type": "road", "name": "Camino Curvo (Bandido)", "edges": ["S", "W"], "pos": { "x": 0.35, "y": 0.65 }, "color": "#f39c12" },
    { "id": "field_inner", "type": "field", "name": "Campo Interior (Granjero)", "edges": ["S_W", "W_S"], "pos": { "x": 0.15, "y": 0.85 }, "color": "#27ae60", "touchesCities": [] },
    { "id": "field_outer", "type": "field", "name": "Campo Exterior (Granjero)", "edges": ["S_E", "W_N"], "pos": { "x": 0.5, "y": 0.5 }, "color": "#27ae60", "touchesCities": ["city_NE"] }
], shield=False)

# Build Type U (8x) - Straight Road North-South
for tid in [f"base_21_{i:02d}" for i in range(50, 58)]:
    add_base_tile(tid, "U", ["R", "F", "R", "F"], [
        { "id": "road_NS", "type": "road", "name": "Camino Recto (Bandido)", "edges": ["N", "S"], "pos": { "x": 0.5, "y": 0.5 }, "color": "#f39c12" },
        { "id": "field_W", "type": "field", "name": "Campo Oeste (Granjero)", "edges": ["W", "N_W", "S_W"], "pos": { "x": 0.2, "y": 0.5 }, "color": "#27ae60", "touchesCities": [] },
        { "id": "field_E", "type": "field", "name": "Campo Este (Granjero)", "edges": ["E", "N_E", "S_E"], "pos": { "x": 0.8, "y": 0.5 }, "color": "#27ae60", "touchesCities": [] }
    ])

# Build Type V (9x) - Curved Road South-West
for tid in ["base_21_58", "base_21_59"] + [f"base_22_{i:02d}" for i in range(7)]:
    add_base_tile(tid, "V", ["F", "F", "R", "R"], [
        { "id": "road_SW", "type": "road", "name": "Camino Curvo (Bandido)", "edges": ["S", "W"], "pos": { "x": 0.35, "y": 0.65 }, "color": "#f39c12" },
        { "id": "field_inner", "type": "field", "name": "Campo Interior (Granjero)", "edges": ["S_W", "W_S"], "pos": { "x": 0.15, "y": 0.85 }, "color": "#27ae60", "touchesCities": [] },
        { "id": "field_outer", "type": "field", "name": "Campo Exterior (Granjero)", "edges": ["N", "E", "S_E", "W_N"], "pos": { "x": 0.65, "y": 0.35 }, "color": "#27ae60", "touchesCities": [] }
    ])

# Build Type W (4x) - 3-Way Crossroads (3 separate branching roads ending at village)
for tid in [f"base_22_{i:02d}" for i in range(7, 11)]:
    add_base_tile(tid, "W", ["F", "R", "R", "R"], [
        { "id": "road_E", "type": "road", "name": "Camino Este (Bandido)", "edges": ["E"], "pos": { "x": 0.75, "y": 0.55 }, "color": "#f39c12", "isTerminus": True },
        { "id": "road_S", "type": "road", "name": "Camino Sur (Bandido)", "edges": ["S"], "pos": { "x": 0.5, "y": 0.8 }, "color": "#f39c12", "isTerminus": True },
        { "id": "road_W", "type": "road", "name": "Camino Oeste (Bandido)", "edges": ["W"], "pos": { "x": 0.25, "y": 0.55 }, "color": "#f39c12", "isTerminus": True },
        { "id": "field_N", "type": "field", "name": "Campo Norte (Granjero)", "edges": ["N", "E_N", "W_N"], "pos": { "x": 0.5, "y": 0.2 }, "color": "#27ae60", "touchesCities": [] },
        { "id": "field_SW", "type": "field", "name": "Campo SO (Granjero)", "edges": ["S_W", "W_S"], "pos": { "x": 0.2, "y": 0.8 }, "color": "#27ae60", "touchesCities": [] },
        { "id": "field_SE", "type": "field", "name": "Campo SE (Granjero)", "edges": ["S_E", "E_S"], "pos": { "x": 0.8, "y": 0.8 }, "color": "#27ae60", "touchesCities": [] }
    ])

# Build Type X (1x) - 4-Way Crossroads (4 separate branching roads ending at village)
add_base_tile("base_22_11", "X", ["R", "R", "R", "R"], [
    { "id": "road_N", "type": "road", "name": "Camino Norte (Bandido)", "edges": ["N"], "pos": { "x": 0.5, "y": 0.25 }, "color": "#f39c12", "isTerminus": True },
    { "id": "road_E", "type": "road", "name": "Camino Este (Bandido)", "edges": ["E"], "pos": { "x": 0.75, "y": 0.5 }, "color": "#f39c12", "isTerminus": True },
    { "id": "road_S", "type": "road", "name": "Camino Sur (Bandido)", "edges": ["S"], "pos": { "x": 0.5, "y": 0.75 }, "color": "#f39c12", "isTerminus": True },
    { "id": "road_W", "type": "road", "name": "Camino Oeste (Bandido)", "edges": ["W"], "pos": { "x": 0.25, "y": 0.5 }, "color": "#f39c12", "isTerminus": True },
    { "id": "field_NW", "type": "field", "name": "Campo NO (Granjero)", "edges": ["N_W", "W_N"], "pos": { "x": 0.2, "y": 0.2 }, "color": "#27ae60", "touchesCities": [] },
    { "id": "field_NE", "type": "field", "name": "Campo NE (Granjero)", "edges": ["N_E", "E_N"], "pos": { "x": 0.8, "y": 0.2 }, "color": "#27ae60", "touchesCities": [] },
    { "id": "field_SW", "type": "field", "name": "Campo SO (Granjero)", "edges": ["S_W", "W_S"], "pos": { "x": 0.2, "y": 0.8 }, "color": "#27ae60", "touchesCities": [] },
    { "id": "field_SE", "type": "field", "name": "Campo SE (Granjero)", "edges": ["S_E", "E_S"], "pos": { "x": 0.8, "y": 0.8 }, "color": "#27ae60", "touchesCities": [] }
])

# Build 12 River Tiles
river_definitions = {
    "river_23_00": {
        "name": "Río con Ciudad Norte",
        "edges": ["C", "W", "F", "W"],
        "segments": [
            { "id": "city_N", "type": "city", "name": "Ciudad Norte (Caballero)", "edges": ["N"], "pos": { "x": 0.5, "y": 0.18 }, "color": "#3498db" },
            { "id": "river", "type": "river", "name": "Río", "edges": ["E", "W"], "pos": { "x": 0.5, "y": 0.5 }, "color": "#2980b9", "noMeeple": True },
            { "id": "field_NW", "type": "field", "name": "Campo NO (Granjero)", "edges": ["W_N", "E_N"], "pos": { "x": 0.2, "y": 0.35 }, "color": "#27ae60", "touchesCities": ["city_N"] },
            { "id": "field_S", "type": "field", "name": "Campo Sur (Granjero)", "edges": ["S", "W_S", "E_S"], "pos": { "x": 0.5, "y": 0.8 }, "color": "#27ae60", "touchesCities": [] }
        ]
    },
    "river_23_01": {
        "name": "Río Curva NO",
        "edges": ["W", "F", "F", "W"],
        "segments": [
            { "id": "river", "type": "river", "name": "Río", "edges": ["N", "W"], "pos": { "x": 0.35, "y": 0.35 }, "color": "#2980b9", "noMeeple": True },
            { "id": "field_inner", "type": "field", "name": "Campo Interior (Granjero)", "edges": ["N_W", "W_N"], "pos": { "x": 0.15, "y": 0.15 }, "color": "#27ae60", "touchesCities": [] },
            { "id": "field_outer", "type": "field", "name": "Campo Exterior (Granjero)", "edges": ["E", "S", "N_E", "W_S"], "pos": { "x": 0.7, "y": 0.7 }, "color": "#27ae60", "touchesCities": [] }
        ]
    },
    "river_23_02": {
        "name": "Río Curva con Ciudad NE",
        "edges": ["C", "C", "W", "W"],
        "segments": [
            { "id": "city_NE", "type": "city", "name": "Ciudad NE (Caballero)", "edges": ["N", "E"], "pos": { "x": 0.7, "y": 0.3 }, "color": "#3498db" },
            { "id": "river", "type": "river", "name": "Río", "edges": ["S", "W"], "pos": { "x": 0.35, "y": 0.65 }, "color": "#2980b9", "noMeeple": True },
            { "id": "field_inner", "type": "field", "name": "Campo Interior (Granjero)", "edges": ["S_W", "W_S"], "pos": { "x": 0.15, "y": 0.85 }, "color": "#27ae60", "touchesCities": [] },
            { "id": "field_outer", "type": "field", "name": "Campo Central (Granjero)", "edges": ["S_E", "W_N"], "pos": { "x": 0.45, "y": 0.45 }, "color": "#27ae60", "touchesCities": ["city_NE"] }
        ]
    },
    "river_23_03": {
        "name": "Nacimiento del Río (Manantial)",
        "edges": ["F", "W", "F", "F"],
        "isSpring": True,
        "segments": [
            { "id": "river", "type": "river", "name": "Nacimiento Río", "edges": ["E"], "pos": { "x": 0.7, "y": 0.5 }, "color": "#2980b9", "noMeeple": True },
            { "id": "field", "type": "field", "name": "Campo (Granjero)", "edges": ["N", "S", "W", "E_N", "E_S"], "pos": { "x": 0.3, "y": 0.5 }, "color": "#27ae60", "touchesCities": [] }
        ]
    },
    "river_23_04": {
        "name": "Río Recto Norte-Sur",
        "edges": ["W", "F", "W", "F"],
        "segments": [
            { "id": "river", "type": "river", "name": "Río", "edges": ["N", "S"], "pos": { "x": 0.5, "y": 0.5 }, "color": "#2980b9", "noMeeple": True },
            { "id": "field_W", "type": "field", "name": "Campo Oeste (Granjero)", "edges": ["W", "N_W", "S_W"], "pos": { "x": 0.2, "y": 0.5 }, "color": "#27ae60", "touchesCities": [] },
            { "id": "field_E", "type": "field", "name": "Campo Este (Granjero)", "edges": ["E", "N_E", "S_E"], "pos": { "x": 0.8, "y": 0.5 }, "color": "#27ae60", "touchesCities": [] }
        ]
    },
    "river_23_05": {
        "name": "Río Curva SE",
        "edges": ["F", "W", "W", "F"],
        "segments": [
            { "id": "river", "type": "river", "name": "Río", "edges": ["E", "S"], "pos": { "x": 0.65, "y": 0.65 }, "color": "#2980b9", "noMeeple": True },
            { "id": "field_inner", "type": "field", "name": "Campo Interior (Granjero)", "edges": ["E_S", "S_E"], "pos": { "x": 0.85, "y": 0.85 }, "color": "#27ae60", "touchesCities": [] },
            { "id": "field_outer", "type": "field", "name": "Campo Exterior (Granjero)", "edges": ["N", "W", "E_N", "S_W"], "pos": { "x": 0.3, "y": 0.3 }, "color": "#27ae60", "touchesCities": [] }
        ]
    },
    "river_23_06": {
        "name": "Río con Dos Ciudades",
        "edges": ["C", "W", "C", "W"],
        "segments": [
            { "id": "city_N", "type": "city", "name": "Ciudad Norte (Caballero)", "edges": ["N"], "pos": { "x": 0.5, "y": 0.18 }, "color": "#3498db" },
            { "id": "city_S", "type": "city", "name": "Ciudad Sur (Caballero)", "edges": ["S"], "pos": { "x": 0.5, "y": 0.82 }, "color": "#3498db" },
            { "id": "river", "type": "river", "name": "Río", "edges": ["E", "W"], "pos": { "x": 0.5, "y": 0.5 }, "color": "#2980b9", "noMeeple": True },
            { "id": "field_N", "type": "field", "name": "Campo Norte (Granjero)", "edges": ["E_N", "W_N"], "pos": { "x": 0.2, "y": 0.35 }, "color": "#27ae60", "touchesCities": ["city_N"] },
            { "id": "field_S", "type": "field", "name": "Campo Sur (Granjero)", "edges": ["E_S", "W_S"], "pos": { "x": 0.2, "y": 0.65 }, "color": "#27ae60", "touchesCities": ["city_S"] }
        ]
    },
    "river_23_07": {
        "name": "Río con Ciudad Norte y Camino Sur",
        "edges": ["C", "W", "R", "W"],
        "segments": [
            { "id": "city_N", "type": "city", "name": "Ciudad Norte (Caballero)", "edges": ["N"], "pos": { "x": 0.5, "y": 0.18 }, "color": "#3498db" },
            { "id": "road_S", "type": "road", "name": "Camino Sur (Bandido)", "edges": ["S"], "pos": { "x": 0.5, "y": 0.75 }, "color": "#f39c12", "isTerminus": True },
            { "id": "river", "type": "river", "name": "Río", "edges": ["E", "W"], "pos": { "x": 0.5, "y": 0.5 }, "color": "#2980b9", "noMeeple": True },
            { "id": "field_NW", "type": "field", "name": "Campo NO (Granjero)", "edges": ["W_N", "E_N"], "pos": { "x": 0.2, "y": 0.35 }, "color": "#27ae60", "touchesCities": ["city_N"] },
            { "id": "field_SW", "type": "field", "name": "Campo SO (Granjero)", "edges": ["S_W", "W_S"], "pos": { "x": 0.2, "y": 0.8 }, "color": "#27ae60", "touchesCities": [] },
            { "id": "field_SE", "type": "field", "name": "Campo SE (Granjero)", "edges": ["S_E", "E_S"], "pos": { "x": 0.8, "y": 0.8 }, "color": "#27ae60", "touchesCities": [] }
        ]
    },
    "river_23_08": {
        "name": "Desembocadura del Río (Lago)",
        "edges": ["F", "F", "F", "W"],
        "isLake": True,
        "segments": [
            { "id": "river", "type": "river", "name": "Lago", "edges": ["W"], "pos": { "x": 0.3, "y": 0.5 }, "color": "#2980b9", "noMeeple": True },
            { "id": "field", "type": "field", "name": "Campo (Granjero)", "edges": ["N", "E", "S", "W_N", "W_S"], "pos": { "x": 0.65, "y": 0.5 }, "color": "#27ae60", "touchesCities": [] }
        ]
    },
    "river_23_09": {
        "name": "Río con Monasterio y Camino",
        "edges": ["F", "W", "R", "W"],
        "monastery": True,
        "segments": [
            { "id": "monastery", "type": "monastery", "name": "Monasterio (Monje)", "edges": [], "pos": { "x": 0.5, "y": 0.35 }, "color": "#e67e22" },
            { "id": "road_S", "type": "road", "name": "Camino Sur (Bandido)", "edges": ["S"], "pos": { "x": 0.5, "y": 0.8 }, "color": "#f39c12", "isTerminus": True },
            { "id": "river", "type": "river", "name": "Río", "edges": ["E", "W"], "pos": { "x": 0.5, "y": 0.55 }, "color": "#2980b9", "noMeeple": True },
            { "id": "field_N", "type": "field", "name": "Campo Norte (Granjero)", "edges": ["N", "E_N", "W_N"], "pos": { "x": 0.25, "y": 0.2 }, "color": "#27ae60", "touchesCities": [] },
            { "id": "field_SW", "type": "field", "name": "Campo SO (Granjero)", "edges": ["S_W", "W_S"], "pos": { "x": 0.2, "y": 0.85 }, "color": "#27ae60", "touchesCities": [] },
            { "id": "field_SE", "type": "field", "name": "Campo SE (Granjero)", "edges": ["S_E", "E_S"], "pos": { "x": 0.8, "y": 0.85 }, "color": "#27ae60", "touchesCities": [] }
        ]
    },
    "river_23_10": {
        "name": "Río con Puente de Camino",
        "edges": ["W", "R", "W", "R"],
        "segments": [
            { "id": "road_EW", "type": "road", "name": "Camino Puente (Bandido)", "edges": ["E", "W"], "pos": { "x": 0.5, "y": 0.5 }, "color": "#f39c12" },
            { "id": "river_NS", "type": "river", "name": "Río", "edges": ["N", "S"], "pos": { "x": 0.5, "y": 0.5 }, "color": "#2980b9", "noMeeple": True },
            { "id": "field_NW", "type": "field", "name": "Campo NO (Granjero)", "edges": ["N_W", "W_N"], "pos": { "x": 0.25, "y": 0.25 }, "color": "#27ae60", "touchesCities": [] },
            { "id": "field_NE", "type": "field", "name": "Campo NE (Granjero)", "edges": ["N_E", "E_N"], "pos": { "x": 0.75, "y": 0.25 }, "color": "#27ae60", "touchesCities": [] },
            { "id": "field_SW", "type": "field", "name": "Campo SO (Granjero)", "edges": ["S_W", "W_S"], "pos": { "x": 0.25, "y": 0.75 }, "color": "#27ae60", "touchesCities": [] },
            { "id": "field_SE", "type": "field", "name": "Campo SE (Granjero)", "edges": ["S_E", "E_S"], "pos": { "x": 0.75, "y": 0.75 }, "color": "#27ae60", "touchesCities": [] }
        ]
    },
    "river_23_11": {
        "name": "Río Recto Norte-Sur",
        "edges": ["W", "F", "W", "F"],
        "segments": [
            { "id": "river", "type": "river", "name": "Río", "edges": ["N", "S"], "pos": { "x": 0.5, "y": 0.5 }, "color": "#2980b9", "noMeeple": True },
            { "id": "field_W", "type": "field", "name": "Campo Oeste (Granjero)", "edges": ["W", "N_W", "S_W"], "pos": { "x": 0.2, "y": 0.5 }, "color": "#27ae60", "touchesCities": [] },
            { "id": "field_E", "type": "field", "name": "Campo Este (Granjero)", "edges": ["E", "N_E", "S_E"], "pos": { "x": 0.8, "y": 0.5 }, "color": "#27ae60", "touchesCities": [] }
        ]
    }
}

for rid, rdata in river_definitions.items():
    canonical_database[rid] = {
        "id": rid,
        "name": rdata["name"],
        "set": "river",
        "type": "River",
        "edges": rdata["edges"],
        "shield": False,
        "monastery": bool(rdata.get("monastery", False)),
        "isStartTile": False,
        "isRiver": True,
        "isSpring": bool(rdata.get("isSpring", False)),
        "isLake": bool(rdata.get("isLake", False)),
        "image": f"assets/tiles/{rid}.png",
        "segments": rdata["segments"]
    }

output_path = r"f:\Proyectos\CASAosServer\carcassonne-web\server\engine\canonical_tiles.json"
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(canonical_database, f, indent=2, ensure_ascii=False)

print(f"Generada base de datos canonica con {len(canonical_database)} losetas.")
