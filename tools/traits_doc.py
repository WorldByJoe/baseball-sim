#!/usr/bin/env python3
"""
traits_doc.py · v0.6 · 2026-10-03

Writes TRAITS.md, the list of every player trait and how the population of
players is drawn, straight from bb_engine.js: the TRAITS table (mean, spread,
range and the comment beside each entry), the position offsets (FIELD_MEANS),
the pitch types (PITCH_TYPES) and the repertoire library (REPERTOIRES). Run it after any
change to those tables, so the list never drifts from the engine:

  python3 tools/traits_doc.py

It stops with an error if the engine's tables change shape in a way it does
not understand, rather than writing a wrong list. How each trait is drawn
beyond "normal, clipped to its range" is written in DRAWN below; when the
engine draws a trait differently, change it here too.

CHANGED
  v0.6  the pro pool: best of six, the levels, the open question re-answered (engine v2.0)
  v0.5  the farm: the tables are the population; spin talent; a first answer to the open question (engine v1.8)
  v0.4  the pitcher's body and delivery traits; the repertoire library replaces the archetypes (engine v1.6)
  v0.3  two-axis command; each type's command factor and plate scatter; pitchers' aiming habits (engine v1.4)
  v0.1  first build
"""
import os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENGINE = os.path.join(ROOT, 'bb_engine.js')
OUT = os.path.join(ROOT, 'TRAITS.md')

# How a trait is drawn when it is not simply normal(mean, sd) clipped to [lo, hi].
DRAWN = {
    'heightIn': 'normal, clipped; the root of the body chain',
    'weightLb': '206 + 5.25 per inch of height over 72, plus normal(0, sd)',
    'swingLenFt': '7.32 + 0.047 per inch of height over 72, plus normal(0, sd)',
    'batOz': '31.8 + 0.012 per lb of weight over 206, plus normal(0, sd)',
    'swingPower': 'lognormal: median x (weight / 206)^-0.45, log-sd as the spread',
    'batSpeed': 'NOT drawn: built from the chain, v^3 = 4 x power x weight x swing length / bat effective mass; this entry only scales the display bars',
    'barrelSD': 'NOT drawn: motorIn x (bat speed / 72)^2; display scale only',
    'coverage': 'normal, clipped, then x armIdx',
    'attack': 'normal, clipped; shares the swing style (STYLE loading 0.80)', 'pullBias': 'normal, clipped; shares the swing style (STYLE loading 0.82)',
    'pBatSpeed': 'normal, clipped; replaces the chain for a pitcher batting',
    'pTimingSD': 'replaces timingSD for a pitcher batting', 'pBarrelSD': 'replaces motorIn for a pitcher batting',
    'pSpotIn': 'replaces spotIn for a pitcher batting', 'pEyeSD': 'replaces eyeSD for a pitcher batting', 'pAttack': 'replaces attack for a pitcher batting',
    'fbVeloSP': 'normal, clipped; starters', 'fbVeloRP': 'normal, clipped; relievers',
    'pHeightIn': 'normal, clipped; the root of the pitcher\'s chain', 'pWeightLb': 'normal about the height line, clipped',
    'armAngle': 'normal, clipped; sets his release point, turns his pitches\' movement, picks his repertoire',
    'spinTalent': 'normal, clipped; shared across his pitches (PITCH_TYPES spinRho)',
    'cmdXSP': 'normal, clipped; starters', 'cmdZSP': 'normal, clipped; starters', 'cmdXRP': 'normal, clipped; relievers', 'cmdZRP': 'normal, clipped; relievers',
    'staminaSP': 'normal, clipped; starters', 'staminaRP': 'normal, clipped; relievers',
    'umpEdge': 'drawn separately for each of the four edges',
    'umpQuirk': 'one umpire in three: added to (or taken from) one edge picked at random',
    'framing': 'catchers only',
    'speed': 'normal around the mean plus the position offset, clipped', 'react': 'normal around the mean plus the position offset, clipped',
    'route': 'normal around the mean plus the position offset, clipped', 'glove': 'normal around the mean plus the position offset, clipped',
    'armMph': 'normal around the mean plus the position offset, clipped', 'armAcc': 'normal around the mean plus the position offset, clipped',
    'transfer': 'normal around the mean plus the position offset, clipped', 'runAggr': 'normal, clipped', 'jump': 'normal, clipped; every player',
    'holdTime': 'pitchers only', 'popTime': 'catchers only, plus the position offset', 'block': 'catchers only',
}
# Units for traits whose comment in the engine does not start with one.
UNITS = {'pBatSpeed': 'mph', 'pTimingSD': 'ms', 'pBarrelSD': 'in', 'pSpotIn': 'in', 'pEyeSD': 'in', 'pAttack': 'deg',
         'fbVeloSP': 'mph', 'fbVeloRP': 'mph', 'cmdXSP': 'in', 'cmdZSP': 'in', 'cmdXRP': 'in', 'cmdZRP': 'in', 'staminaSP': 'pitches', 'staminaRP': 'pitches',
         'pHeightIn': 'in', 'pWeightLb': 'lb', 'armAngle': 'deg', 'spinTalent': 'sd', 'speed': 'ft/s', 'armMph': 'mph', 'armIdx': 'ratio', 'aggr': 'share', 'commit': 'share',
         'fbLean': 'factor', 'learn': 'share', 'route': 'share', 'glove': 'share', 'block': 'share'}
GROUPS = [('hitters', 'Hitters'), ('pitchers when they bat', 'Pitchers when they bat (NL rules)'), ('pitchers', 'Pitchers'), ('umpires', 'Umpires'),
          ('catchers', 'Catchers'), ('fielding and running', 'Fielding and running (every player)'), ('the running game', 'The running game')]


def block(src, start, end_pat):
    i = src.index(start)
    j = src.index(end_pat, i)
    return src[i:j]


def parse_traits(src):
    b = block(src, '  var TRAITS = {', '\n  };')
    group, rows = None, []
    for line in b.split('\n')[1:]:
        s = line.strip()
        if s.startswith('//'):
            g = s[2:].strip().split(' (')[0].split(' -')[0].lower()
            for key, _ in GROUPS:                    # the first, most specific match wins
                if g == key or g.startswith(key + ' '):
                    group = key
                    break
            continue
        entries = re.findall(r'(\w+):\s*\[([^\]]*)\]', s)
        if not entries:
            continue
        comment = s.split('//', 1)[1].strip() if '//' in s else ''
        for name, vals in entries:
            v = [float(x) for x in vals.split(',')]
            if len(v) != 4:
                sys.exit('TRAITS.%s does not have four numbers [mean, sd, lo, hi]' % name)
            if group is None:
                sys.exit('TRAITS.%s comes before any group comment' % name)
            rows.append(dict(group=group, name=name, mean=v[0], sd=v[1], lo=v[2], hi=v[3], comment=comment))
    if len(rows) < 40:
        sys.exit('only %d traits parsed: has the TRAITS table changed shape?' % len(rows))
    return rows


def parse_field_means(src):
    b = block(src, '  var FIELD_MEANS = {', '\n  };')
    out = {}
    for pos, body in re.findall(r"'?(\w+)'?:\s*\{([^}]*)\}", b):
        out[pos] = {k: float(v) for k, v in re.findall(r'(\w+):\s*(-?[0-9.]+)', body)}
    return out


def parse_pitch_types(src):
    b = block(src, '  var PITCH_TYPES = {', '\n  };')
    out = []
    for code, body in re.findall(r'(\w\w):\s*\{([^}]*)\}', b):
        d = dict(re.findall(r"(\w+):\s*(\[[^\]]*\]|'[^']*'|-?[0-9.]+)", body))
        out.append((code, {k: v.strip("'") for k, v in d.items()}))   # arrays stay as their source text, e.g. '[2.6, 2.0]'
    if len(out) < 6:
        sys.exit('PITCH_TYPES did not parse')
    return out


def parse_reps(src):
    b = block(src, '  var REPERTOIRES = [', '\n  ];')
    out = [[float(x) for x in m.split(',')] for m in re.findall(r'\[([-0-9.,]+)\]', b)]
    if len(out) < 50:
        sys.exit('REPERTOIRES did not parse')
    return out


def unit_of(comment):
    m = re.match(r'^(lb|in|ft|ft/s|deg|ms|s|mph|oz|W/kg|m|pitches)\b', comment)
    return m.group(1) if m else ''


def num(x):
    return ('%g' % x)


def main():
    src = open(ENGINE).read()
    ver = re.search(r'bb_engine\.js · (v[0-9.]+) · ([0-9-]+)', src)
    rows = parse_traits(src)
    fm = parse_field_means(src)
    pt = parse_pitch_types(src)
    reps = parse_reps(src)
    bats = re.search(r"pb \? \(r < ([0-9.]+) \? 'R' : r < ([0-9.]+) \? 'L' : 'S'\) : \(r < ([0-9.]+) \? 'R' : r < ([0-9.]+) \? 'L' : 'S'\)", src)
    throws = re.search(r"rng\.u\(\) < ([0-9.]+) \? 'L' : 'R'", src)
    quirk = re.search(r'if \(rng\.u\(\) < ([0-9.]+)\) \{\s*var names = \[', src)
    if not (ver and bats and throws and quirk):
        sys.exit('could not find the engine version or the handedness / quirk draws')
    L = []
    w = L.append
    w('# Player traits\n')
    w('`TRAITS.md · generated from bb_engine.js %s (%s) by tools/traits_doc.py`\n' % (ver.group(1), ver.group(2)))
    w('Every trait a player, umpire or pitch type is drawn with, and the population it is drawn from. **Do not edit this file by hand**: change the TRAITS table in `bb_engine.js` (and the comment beside the entry, which is copied here as its description), then run `python3 tools/traits_doc.py`.\n')
    w('**How a population is drawn.** Each player is drawn trait by trait. Unless the "how drawn" column says otherwise, a trait is normal with the mean and spread shown, clipped to the range. Traits are independent of each other except where a draw names another trait: the body chain (height, then weight, swing length, bat, swing power, then the bat speed built from them), coverage scaled by arm length, and the position offsets below. Nothing correlates a hitter\'s eye with his bat speed, say, unless a mechanism does; that is deliberate (the correlations are tests, see STATCAST_TARGETS_2025.md).\n')
    for key, title in GROUPS:
        g = [r for r in rows if r['group'] == key]
        if not g:
            continue
        w('\n## %s\n' % title)
        w('| trait | unit | mean | spread | range | how drawn | what it is (and where the numbers came from) |')
        w('|---|---|---|---|---|---|---|')
        for r in g:
            desc = r['comment']
            u = unit_of(desc) or UNITS.get(r['name'], '')
            if u and desc.startswith(u):
                desc = desc[len(u):].lstrip(' :-')
            w('| `%s` | %s | %s | %s | %s to %s | %s | %s |' % (r['name'], u, num(r['mean']), num(r['sd']), num(r['lo']), num(r['hi']), DRAWN.get(r['name'], 'normal, clipped'), desc.replace('|', '/')))
    w('\n## Position offsets\n')
    w('Added to the league mean of each fielding trait for a player at that position (`FIELD_MEANS`).\n')
    keys = sorted({k for d in fm.values() for k in d})
    w('| position | ' + ' | '.join(keys) + ' |')
    w('|---|' + '---|' * len(keys))
    for pos, d in fm.items():
        w('| %s | %s |' % (pos, ' | '.join(('%+g' % d[k]) if k in d else '' for k in keys)))
    w('\n## Pitch types\n')
    w('Each pitcher\'s version of a pitch is drawn from these league figures (`PITCH_TYPES`): speed is his fastball speed plus the offset (and, for every pitch but the fastballs, a further normal(0, 1.0 mph) of his own); spin rate and spin efficiency are normal with the spread shown (spin rate clipped to 3 spreads, efficiency to 0.03-0.99); tilt is normal; his seam break (extra movement the spin does not explain, toward his arm side and up, in inches) is normal around 0 with the spread shown.\n')
    w('| type | name | kind | speed offset (mph) | spin (rpm) | spin efficiency | tilt (deg) | seam break sd, arm side / up (in) | command factor, across / up (vs four-seam) | plate scatter of its own, across / up (in) |')
    w('|---|---|---|---|---|---|---|---|---|---|')
    pair = lambda v: ' / '.join(x.strip() for x in v.strip('[]').split(',')) if v else ''
    for code, d in pt:
        w('| %s | %s | %s | %s | %s ± %s | %s ± %s | %s ± %s | %s | %s | %s |' % (code, d.get('name', ''), d.get('kind', ''), d.get('dv', ''), d.get('rpm', ''), d.get('rpmSD', ''), d.get('eff', ''), d.get('effSD', ''), d.get('tilt', ''), d.get('tiltSD', ''), pair(d.get('seamSD')), pair(d.get('cmd')), pair(d.get('plateW'))))
    w('\nA pitch thrown varies again around his version, by these spreads within a game, plus tilt 5 deg and efficiency 0.03 for every type. His command (two traits, across and up and down, times the type\'s factor) is his whole scatter at the plate about the target: the scatter these pitch-to-pitch spreads make on their own (the last column, tools/plate_scatter.js) is part of it, not added to it.\n')
    w('| type | speed (mph) | spin (share of his rpm) | seam break, arm side / up (in) |')
    w('|---|---|---|---|')
    for code, d in pt:
        w('| %s | %s | %s | %s |' % (code, d.get('veloW', ''), d.get('rpmW', ''), pair(d.get('seamW'))))
    m = re.search(r"habit:\s*(\{[^\n]*\})", src)
    if not m:
        sys.exit('traits_doc: PLAN_LOC.habit not found in bb_engine.js')
    hab = re.findall(r"'(\w+)':\[([-0-9.]+),([-0-9.]+)\]", m.group(1))
    w('Each pitcher also has his own aim for each of his pitches, normal around the league\'s aim point (`PLAN_LOC.habit`, statcast/locations.py): the spread between pitchers, across (in toward his arm side) and in height (share of the batter\'s zone).\n')
    w('| type | ' + ' | '.join(t for t, _, _ in hab) + ' |')
    w('|---|' + '---|' * len(hab))
    w('| across (in) | ' + ' | '.join(a for _, a, _ in hab) + ' |')
    w('| height (zone share) | ' + ' | '.join(b for _, _, b in hab) + ' |')
    w('\n## Repertoires\n')
    w('A pitcher\'s repertoire is a league pitcher\'s (`REPERTOIRES`, statcast/pitcher_chain.py): drawn from the %d pitchers of 2025 (150+ pitches) in his role, weighted by how near their arm slot is to his (Gaussian, 5 deg wide); his usage of each pitch is that mix times a lognormal factor (log-sd 0.15), renormalized. Summary of the library, by role and slot (share of pitchers carrying each type, and the average number of types):\n' % len(reps))
    TY = ['FF', 'SI', 'FC', 'SL', 'ST', 'CU', 'CH', 'FS']
    w('| role | arm slot | pitchers | types | ' + ' | '.join(TY) + ' |')
    w('|---|---|---|---|' + '---|' * len(TY))
    for rl, rn in ((0, 'starters'), (1, 'relievers')):
        for lo, hi, sn in ((-99, 33, 'under 33 deg'), (33, 43, '33-43 deg'), (43, 99, 'over 43 deg')):
            q = [r for r in reps if r[1] == rl and lo <= r[0] < hi]
            if not q:
                continue
            w('| %s | %s | %d | %.1f | %s |' % (rn, sn, len(q), sum(sum(1 for v in r[2:] if v > 0) for r in q) / len(q), ' | '.join('%.2f' % (sum(1 for r in q if r[2 + i] > 0) / len(q)) for i in range(len(TY)))))
    r1, r2, r3, r4 = (float(bats.group(i)) for i in range(1, 5))
    w('\n## Other draws\n')
    w('- **Batting hand, position players:** right %.0f%%, left %.0f%%, switch %.0f%%. **Pitchers batting:** right %.0f%%, left %.0f%%, switch %.0f%%.' % (100 * r3, 100 * (r4 - r3), 100 * (1 - r4), 100 * r1, 100 * (r2 - r1), 100 * (1 - r2)))
    w('- **Throwing hand, pitchers:** left %.0f%%.' % (100 * float(throws.group(1))))
    w('- **Umpires with one strong habit:** %.0f%% (see `umpQuirk`).' % (100 * float(quirk.group(1))))
    w('- **Strike zone:** not drawn; from height, bottom 0.263 x height, top 0.559 x height.')
    w('\n## The farm\n')
    w('The tables above are the POOL: the frequency distribution of the traits among all professional players, majors and minors (the project\'s goal since 2026-10-03 is that distribution and how it meets the physics to give the statistics we measure). Each roster spot goes to the best of `FARM_N` = 6 candidates drawn from it (since engine v2.0; 4 in v1.8-v1.9), as the scouts judge them: `HITTER_VALUE` and `PITCHER_VALUE`, the expected wOBA the engine itself gives each trait (tools/hitter_value.js, tools/pitcher_value.js), with `SCOUT_SD` of judgement error. The majors are therefore an extreme-value sample of the pool. Where a trait is measured, its pool was fitted (tools/fit_population.js) so that the majors have the league\'s value; the hand-set skills keep their pool spread, and the farm narrows it.\n')
    w('**Levels** (engine v2.0): the candidate the scouts rank k-th of six plays at level k - 1 the majors, 2 Triple-A, down to 6 rookie ball (`makeBatter(rng, {level: k})`). The levels below the majors are predictions; Triple-A is measured (statcast/levels.py) and compared in headless/level_check.js.\n')
    w('\n## Open questions\n')
    w('- **A player below average in every category** (Joe, 2026-10-02, for later): how should the game handle a player on a team who is below average in every trait? With traits drawn independently, such players occur by chance (for k independent traits, about 1 in 2^k players is below the mean in all of them), and real rosters are the selected top of a much larger population, so they would be rare there. Not yet decided. Answer from the farm (engine v2.0, best of six): below the pool average in all seven of bat speed, eye, timing, pitch spotting, barrel control, along-barrel control and patience, 0.78% of the pool but 0.01% of the major leaguers (five categories: 3.1% against 0.18%). Such a player can still reach the majors on the scouts\' error, about 1 in 10,000 (1 in 3,000 at best of four, v1.8).')
    open(OUT, 'w').write('\n'.join(L) + '\n')
    print('wrote %s: %d traits, %d positions, %d pitch types, %d repertoires' % (OUT, len(rows), len(fm), len(pt), len(reps)))


if __name__ == '__main__':
    main()
