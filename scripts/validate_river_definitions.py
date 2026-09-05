import os
import json

# Let's define the exact, precise topology and meeple segments for all 12 river tiles
river_definitions = {
    "river_23_00": {
        "edges": ["C", "W", "F", "W"],
        "center": "river",
        "segments": [
            { "id": "city_N", "type": "city", "name": "Ciudad Norte (Caballero)", "pos": { "x": 0.5, "y": 0.18 }, "color": "#3498db" },
            { "id": "field_N", "type": "field", "name": "Campo Norte (Granjero)", "pos": { "x": 0.2, "y": 0.35 }, "color": "#27ae60" },
            { "id": "field_S", "type": "field", "name": "Campo Sur (Granjero)", "pos": { "x": 0.5, "y": 0.8 }, "color": "#27ae60" }
        ]
    },
    "river_23_01": {
        "edges": ["W", "F", "F", "W"],
        "center": "river_turn",
        "segments": [
            { "id": "field_inner", "type": "field", "name": "Campo Interior (Granjero)", "pos": { "x": 0.2, "y": 0.2 }, "color": "#27ae60" },
            { "id": "field_outer", "type": "field", "name": "Campo Exterior (Granjero)", "pos": { "x": 0.75, "y": 0.75 }, "color": "#27ae60" }
        ]
    },
    "river_23_02": {
        "edges": ["C", "C", "W", "W"],
        "center": "river_turn",
        "segments": [
            { "id": "city_NE", "type": "city", "name": "Ciudad NE (Caballero)", "pos": { "x": 0.7, "y": 0.3 }, "color": "#3498db" },
            { "id": "field_inner", "type": "field", "name": "Campo Interior (Granjero)", "pos": { "x": 0.15, "y": 0.85 }, "color": "#27ae60" },
            { "id": "field_outer", "type": "field", "name": "Campo Exterior (Granjero)", "pos": { "x": 0.45, "y": 0.45 }, "color": "#27ae60" }
        ]
    },
    "river_23_03": {
        "edges": ["F", "W", "F", "F"],
        "center": "spring",
        "isSpring": True,
        "segments": [
            { "id": "field_all", "type": "field", "name": "Campo (Granjero)", "pos": { "x": 0.3, "y": 0.5 }, "color": "#27ae60" }
        ]
    },
    "river_23_04": {
        "edges": ["W", "F", "W", "F"],
        "center": "river",
        "segments": [
            { "id": "field_W", "type": "field", "name": "Campo Oeste (Granjero)", "pos": { "x": 0.2, "y": 0.5 }, "color": "#27ae60" },
            { "id": "field_E", "type": "field", "name": "Campo Este (Granjero)", "pos": { "x": 0.8, "y": 0.5 }, "color": "#27ae60" }
        ]
    },
    "river_23_05": {
        "edges": ["F", "W", "W", "F"],
        "center": "river_turn",
        "segments": [
            { "id": "field_inner", "type": "field", "name": "Campo Interior (Granjero)", "pos": { "x": 0.8, "y": 0.8 }, "color": "#27ae60" },
            { "id": "field_outer", "type": "field", "name": "Campo Exterior (Granjero)", "pos": { "x": 0.25, "y": 0.25 }, "color": "#27ae60" }
        ]
    },
    "river_23_06": {
        "edges": ["C", "W", "C", "W"],
        "center": "river",
        "segments": [
            { "id": "city_N", "type": "city", "name": "Ciudad Norte (Caballero)", "pos": { "x": 0.5, "y": 0.18 }, "color": "#3498db" },
            { "id": "city_S", "type": "city", "name": "Ciudad Sur (Caballero)", "pos": { "x": 0.5, "y": 0.82 }, "color": "#3498db" },
            { "id": "field_N", "type": "field", "name": "Campo Norte (Granjero)", "pos": { "x": 0.2, "y": 0.35 }, "color": "#27ae60" },
            { "id": "field_S", "type": "field", "name": "Campo Sur (Granjero)", "pos": { "x": 0.2, "y": 0.65 }, "color": "#27ae60" }
        ]
    },
    "river_23_07": {
        "edges": ["C", "W", "R", "W"],
        "center": "river_bridge",
        "segments": [
            { "id": "city_N", "type": "city", "name": "Ciudad Norte (Caballero)", "pos": { "x": 0.5, "y": 0.18 }, "color": "#3498db" },
            { "id": "road_S", "type": "road", "name": "Camino/Puente Sur (Bandido)", "pos": { "x": 0.5, "y": 0.75 }, "color": "#f39c12" },
            { "id": "field_NW", "type": "field", "name": "Campo NO (Granjero)", "pos": { "x": 0.2, "y": 0.35 }, "color": "#27ae60" },
            { "id": "field_SW", "type": "field", "name": "Campo SO (Granjero)", "pos": { "x": 0.25, "y": 0.8 }, "color": "#27ae60" },
            { "id": "field_SE", "type": "field", "name": "Campo SE (Granjero)", "pos": { "x": 0.75, "y": 0.8 }, "color": "#27ae60" }
        ]
    },
    "river_23_08": {
        "edges": ["F", "F", "F", "W"],
        "center": "lake",
        "isLake": True,
        "segments": [
            { "id": "field_all", "type": "field", "name": "Campo (Granjero)", "pos": { "x": 0.7, "y": 0.5 }, "color": "#27ae60" }
        ]
    },
    "river_23_09": {
        "edges": ["F", "W", "R", "W"],
        "center": "monastery",
        "monastery": True,
        "segments": [
            { "id": "monastery", "type": "monastery", "name": "Monasterio (Monje)", "pos": { "x": 0.5, "y": 0.42 }, "color": "#e67e22" },
            { "id": "road_S", "type": "road", "name": "Camino/Puente Sur (Bandido)", "pos": { "x": 0.5, "y": 0.8 }, "color": "#f39c12" },
            { "id": "field_N", "type": "field", "name": "Campo Norte (Granjero)", "pos": { "x": 0.25, "y": 0.2 }, "color": "#27ae60" },
            { "id": "field_SW", "type": "field", "name": "Campo SO (Granjero)", "pos": { "x": 0.2, "y": 0.85 }, "color": "#27ae60" },
            { "id": "field_SE", "type": "field", "name": "Campo SE (Granjero)", "pos": { "x": 0.8, "y": 0.85 }, "color": "#27ae60" }
        ]
    },
    "river_23_10": {
        "edges": ["W", "R", "W", "R"],
        "center": "river_bridge",
        "segments": [
            { "id": "road", "type": "road", "name": "Camino/Puente (Bandido)", "pos": { "x": 0.5, "y": 0.5 }, "color": "#f39c12" },
            { "id": "field_NW", "type": "field", "name": "Campo NO (Granjero)", "pos": { "x": 0.25, "y": 0.25 }, "color": "#27ae60" },
            { "id": "field_NE", "type": "field", "name": "Campo NE (Granjero)", "pos": { "x": 0.75, "y": 0.25 }, "color": "#27ae60" },
            { "id": "field_SW", "type": "field", "name": "Campo SO (Granjero)", "pos": { "x": 0.25, "y": 0.75 }, "color": "#27ae60" },
            { "id": "field_SE", "type": "field", "name": "Campo SE (Granjero)", "pos": { "x": 0.75, "y": 0.75 }, "color": "#27ae60" }
        ]
    },
    "river_23_11": {
        "edges": ["W", "F", "W", "F"],
        "center": "river",
        "segments": [
            { "id": "field_W", "type": "field", "name": "Campo Oeste (Granjero)", "pos": { "x": 0.2, "y": 0.5 }, "color": "#27ae60" },
            { "id": "field_E", "type": "field", "name": "Campo Este (Granjero)", "pos": { "x": 0.8, "y": 0.5 }, "color": "#27ae60" }
        ]
    }
}

print(f"Validated {len(river_definitions)} river tile definitions.")
