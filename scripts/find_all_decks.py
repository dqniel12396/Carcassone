import json
import urllib.request
import os

path = r'C:\Users\danie\Documents\My Games\Tabletop Simulator\Mods\Workshop\3269513051.json'
with open(path, 'r', encoding='utf-8', errors='ignore') as f:
    data = json.load(f)

decks = {}
def collect_decks(obj):
    if 'CustomDeck' in obj and obj['CustomDeck']:
        for k, v in obj['CustomDeck'].items():
            decks[k] = v
    for c in obj.get('ContainedObjects', []):
        collect_decks(c)

for o in data.get('ObjectStates', []):
    collect_decks(o)

print(f"Total Custom Decks found: {len(decks)}")
for k, v in decks.items():
    print(f"Deck ID {k}: Face={v.get('FaceURL')} (W:{v.get('NumWidth')}, H:{v.get('NumHeight')})")
