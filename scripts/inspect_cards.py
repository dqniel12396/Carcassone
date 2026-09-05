import json

path = r'C:\Users\danie\Documents\My Games\Tabletop Simulator\Mods\Workshop\3269513051.json'
with open(path, 'r', encoding='utf-8', errors='ignore') as f:
    data = json.load(f)

for o in data.get('ObjectStates', []):
    nick = o.get('Nickname') or o.get('Name') or ''
    cd = o.get('CustomDeck', {})
    if '21' in cd or '22' in cd or '23' in cd or 'Juego Base' in nick or 'Río' in nick or 'Rio' in nick:
        print(f"Name: {nick} | CardID: {o.get('CardID')} | DeckIDs: {list(cd.keys())}")
        contained = o.get('ContainedObjects', [])
        if contained:
            print(f"  Contained count: {len(contained)}")
            for i, c in enumerate(contained[:5]):
                print(f"    [{i}] Nick: {c.get('Nickname')} CardID: {c.get('CardID')} Memo: {c.get('Memo')} Description: {c.get('Description')}")
