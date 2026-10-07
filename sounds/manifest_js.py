#!/usr/bin/env python3
# manifest_js.py · v0.1 · 2026-10-02
# Writes sounds/manifest.js from sounds/manifest.json. The page cannot fetch a
# JSON file from file:// on the wall, but it can load a script: manifest.js sets
# window.BB_SOUNDS for bb_sound.js. Run it after any change to manifest.json.
# CHANGED
#   v0.1  first version
import json, os
here = os.path.dirname(os.path.abspath(__file__))
m = json.load(open(os.path.join(here, 'manifest.json')))
# the page needs only each sound's group, whether it loops, and its files
slim = {'version': m.get('version'), 'sounds': {k: {'group': v.get('group'), 'loop': bool(v.get('loop')), 'files': [{'file': f['file'], 'dur': f.get('dur')} for f in v.get('files', [])]}
                                               for k, v in m['sounds'].items()}}
with open(os.path.join(here, 'manifest.js'), 'w') as f:
    f.write('// manifest.js - written by manifest_js.py from manifest.json; do not edit by hand\n')
    f.write('window.BB_SOUNDS = ' + json.dumps(slim, separators=(',', ':')) + ';\n')
print('manifest.js:', sum(len(v['files']) for v in slim['sounds'].values()), 'files in', len(slim['sounds']), 'sounds')
