"""Helper for authoring multi-line levels: place text pieces at exact character indexes.

The spawn marker ¤ is zero width in the game, so it doesn't count toward indexes here either.
Usage: edit LEVELS below, run `python3 scripts/place.py`, and it rewrites those levels in src/levels.ts.
"""
import re, sys

def line(*parts):
    out = ''
    for i, t in parts:
        width = len(out.replace('¤', ''))
        assert width <= i, f'piece {t!r} at {i} overlaps: {out!r}'
        out += ' ' * (i - width) + t
    return out

def ts(s):
    return "'" + s.replace('\\', '\\\\').replace("'", "\\'") + "'"

B = '\\'
LEVELS = {
    'there and back': [line((0, '¤so___`````888')), line((0, '¶ ok````````___'))],
    'downstairs': [line((0, '¤down' + B * 4)), line((0, '¶ 8`````___'))],
    'line up': [
        line((0, '¤soon___`````888___`````')),
        line((21, '___')),
        line((0, '¶888'), (4, '`' * 12), (16, '___'), (19, '`' * 5), (24, '____')),
    ],
    'walk you to school': [
        line((0, '¤so___`````666___`````' + B * 4)),
        line((23, 'H___`````888')),
        line((22, '¶go_```666``___')),
    ],
}

if __name__ == '__main__':
    path = 'src/levels.ts'
    s = open(path).read()
    for title, lines in LEVELS.items():
        print(title)
        for x in lines:
            print('   |' + x.replace('¤', '') + '|')
        m = re.search(r"(    title: '" + re.escape(title) + r"',\n(?:    split: true,\n)?    lines: \[\n)(.*?)(    \],)", s, re.S)
        if not m:
            sys.exit(f'level not found: {title}')
        s = s[: m.start(2)] + ''.join('      ' + ts(x) + ',\n' for x in lines) + s[m.end(2) :]
    open(path, 'w').write(s)
