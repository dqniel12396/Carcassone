import json

path = r'C:\Users\danie\Documents\My Games\Tabletop Simulator\Mods\Workshop\3269513051.json'
with open(path, 'r', encoding='utf-8', errors='ignore') as f:
    data = json.load(f)

all_cards = []
def scan(obj):
    cid = obj.get('CardID')
    if cid:
        all_cards.append((cid, obj.get('Nickname'), obj.get('Transform', {}).get('posX')))
    for c in obj.get('ContainedObjects', []):
        scan(c)

for o in data.get('ObjectStates', []):
    scan(o)

base_cards = [c for c in all_cards if str(c[0]).startswith('21') or str(c[0]).startswith('22')]
river_cards = [c for c in all_cards if str(c[0]).startswith('23')]

print(f"Total Base Cards found: {len(base_cards)} (unique: {len(set(c[0] for c in base_cards))})")
print(f"Total River Cards found: {len(river_cards)} (unique: {len(set(c[0] for c in river_cards))})")
