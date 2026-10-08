"""
win_logit.py · v0.1 · 2026-10-07

Did the replays' win probabilities predict who won? One point per finished division series game: x the share of
its 1,000 replays (regular-season pitching, diag_out/replays/<pk>.jsonl) the home team won, y whether the home team
won the real game. One team per game, because the visitor's point is the mirror image of the home team's and would
double the data without adding any. A logistic regression y ~ a + b x by Newton's method: the slope's Wald test,
the likelihood-ratio test against the intercept alone, McFadden's and Tjur's R-squared; and the figure.

  python3 review/win_logit.py OUT.png

CHANGED
  v0.1  first build (Joe, 2026-10-07)
"""
import json, sys, os, math
import numpy as np
from scipy import stats
sys.path.insert(0, 'review')
from replay_grids import GAMES, NICK


def rows():
    out = []
    for pk, ser, num, date in GAMES:
        f = 'diag_out/replays/%d.jsonl' % pk
        if not os.path.exists(f): continue
        G = json.load(open('review/games/%d.json' % pk))
        R = [json.loads(l) for l in open(f) if l.startswith('{')]
        p = sum(1 for r in R if r['score'][1] > r['score'][0]) / len(R)
        h, a = G['teams']['home']['abbrev'], G['teams']['away']['abbrev']
        out.append({'pk': pk, 'label': '%s G%d %s' % (ser, num, NICK[h]), 'home': h, 'away': a, 'p': p, 'y': int(G['final']['home'] > G['final']['away'])})
    return out


def fit(x, y):
    X = np.column_stack([np.ones_like(x), x]); b = np.zeros(2)
    for _ in range(50):
        mu = 1 / (1 + np.exp(-X @ b)); W = mu * (1 - mu)
        H = (X * W[:, None]).T @ X; g = X.T @ (y - mu)
        step = np.linalg.solve(H, g); b = b + step
        if np.max(np.abs(step)) < 1e-10: break
    mu = 1 / (1 + np.exp(-X @ b)); H = (X * (mu * (1 - mu))[:, None]).T @ X
    cov = np.linalg.inv(H)
    ll1 = float(np.sum(y * np.log(mu) + (1 - y) * np.log(1 - mu)))
    ybar = y.mean(); ll0 = float(len(y) * (ybar * math.log(ybar) + (1 - ybar) * math.log(1 - ybar)))
    return b, cov, mu, ll1, ll0


def main(out):
    D = rows(); x = np.array([d['p'] for d in D]); y = np.array([d['y'] for d in D], float)
    b, cov, mu, ll1, ll0 = fit(x, y)
    se = np.sqrt(np.diag(cov)); z = b[1] / se[1]; p_wald = 2 * stats.norm.sf(abs(z))
    lr = 2 * (ll1 - ll0); p_lr = stats.chi2.sf(lr, 1)
    r2_mcf = 1 - ll1 / ll0; r2_tjur = mu[y == 1].mean() - mu[y == 0].mean()
    brier = float(np.mean((x - y) ** 2)); brier0 = float(np.mean((0.5 - y) ** 2))
    S = {'n': len(D), 'a': b[0], 'b': b[1], 'se_a': se[0], 'se_b': se[1], 'z': z, 'p_wald': p_wald, 'lr': lr, 'p_lr': p_lr,
         'r2_mcfadden': r2_mcf, 'r2_tjur': r2_tjur, 'brier': brier, 'brier_coin': brier0, 'rows': D}
    json.dump(S, open('review/win_logit.json', 'w'), indent=1, default=float)
    for d in D: print('  %-18s home %-3s p %.3f  won %d' % (d['label'], d['home'], d['p'], d['y']))
    print('n %d | intercept %.2f (se %.2f) | slope %.2f (se %.2f), Wald z %.2f, p %.3f | LR chi2 %.2f, p %.3f | McFadden R2 %.3f, Tjur R2 %.3f | Brier %.3f (coin flip %.3f)' % (
        len(D), b[0], se[0], b[1], se[1], z, p_wald, lr, p_lr, r2_mcf, r2_tjur, brier, brier0))

    import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
    INK, MUTED, LINE, BLUE = '#121a26', '#5b6676', '#d6dce4', '#2a78d6'
    plt.rcParams.update({'font.family': ['Helvetica Neue', 'Arial', 'DejaVu Sans'], 'font.size': 10, 'axes.edgecolor': LINE, 'axes.labelcolor': INK, 'xtick.color': MUTED, 'ytick.color': MUTED})
    fig, ax = plt.subplots(figsize=(8.2, 5.4), dpi=200)
    xs = np.linspace(0, 1, 201); Xs = np.column_stack([np.ones_like(xs), xs]); eta = Xs @ b
    se_eta = np.sqrt(np.einsum('ij,jk,ik->i', Xs, cov, Xs))
    lo, hi = 1 / (1 + np.exp(-(eta - 1.96 * se_eta))), 1 / (1 + np.exp(-(eta + 1.96 * se_eta)))
    ax.fill_between(xs, lo, hi, color=BLUE, alpha=0.12, linewidth=0, label='95% band of the fit')
    ax.plot([0, 1], [0, 1], color=MUTED, lw=1, ls=(0, (4, 3)), label='a perfect forecast (win share = chance)')
    ax.plot(xs, 1 / (1 + np.exp(-eta)), color=BLUE, lw=2, label='logistic fit')
    # the games: each at its replay win share, at 1 (home team won) or 0 (lost), labelled
    for d in D:   # labels stand vertically off each point: up from a loss, down from a win, so neighbours never overlap
        yy = d['y']
        ax.scatter([d['p']], [yy], s=46, color=INK, edgecolor='white', linewidth=1.5, zorder=5)
        ax.annotate(d['label'], (d['p'], yy), xytext=(0, 8 if yy == 0 else -8), textcoords='offset points', fontsize=7.2, color=MUTED,
                    rotation=90, ha='center', va='bottom' if yy == 0 else 'top')
    ax.set_xlim(-0.02, 1.02); ax.set_ylim(-0.12, 1.12)
    ax.set_xticks(np.linspace(0, 1, 11)); ax.set_xticklabels(['%d%%' % (100 * t) for t in np.linspace(0, 1, 11)])
    ax.set_yticks([0, 0.25, 0.5, 0.75, 1]); ax.set_yticklabels(['lost', '25%', '50%', '75%', 'won'])
    ax.grid(True, color=LINE, lw=0.6, alpha=0.7); ax.set_axisbelow(True)
    for s in ('top', 'right'): ax.spines[s].set_visible(False)
    ax.set_xlabel("Home team's share of 1,000 replays won (regular-season pitching)")
    ax.set_ylabel('Real game: home team won or lost; fitted chance of winning')
    ax.set_title('Did the replays pick the winners? Division series, %d games' % len(D), loc='left', fontsize=12, color=INK, pad=12)
    txt = ('slope %.2f (se %.2f), Wald p = %.2f\nlikelihood ratio p = %.2f\nMcFadden R² = %.2f   Tjur R² = %.2f' % (b[1], se[1], p_wald, p_lr, r2_mcf, r2_tjur))
    ax.text(0.015, 0.62, txt, transform=ax.transAxes, fontsize=8.6, color=INK, va='top', bbox=dict(boxstyle='round,pad=0.5', fc='white', ec=LINE, lw=0.8))
    ax.legend(loc='lower right', fontsize=8, frameon=True, edgecolor=LINE)
    fig.tight_layout(); fig.savefig(out, facecolor='white'); print('wrote', out)


if __name__ == '__main__':
    main(sys.argv[1])
