import urllib.request
import json

def check(url):
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = resp.read()
            print(f'GET {url} -> Status {resp.status} ({len(data)} bytes)')
    except Exception as e:
        print(f'GET {url} -> ERROR: {e}')

check('http://127.0.0.1:3080/')
check('http://127.0.0.1:3080/api/rooms')
check('http://127.0.0.1:3080/api/saves')
check('http://127.0.0.1:3080/assets/tiles/base_21_00.png')
check('http://127.0.0.1:3080/assets/meeples/meeple_red.svg')
check('http://127.0.0.1:3080/css/style.css')
check('http://127.0.0.1:3080/js/game.js')
