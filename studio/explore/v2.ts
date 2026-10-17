/**
 * Variant 2, "Broadcast": the 3D view is the full-screen hero, like a match on TV. A scoreboard
 * bug top left, a LIVE bug top right, the team as a roster on the right, a lower third and a
 * crawl at the bottom. The director swaps full-screen "graphics" over the (blurred) hero.
 */

import { ROLE_INFO, ROLES, type World } from './mock';
import { esc, evalBars, evoChart, examBars, h, heatmap, lessonList, pct, proposalCard, Revs, sceneUrl, signed, tween } from './ui';
import type { Ctx, Spot, View } from './view';

export function broadcast(): View {
  const revs = new Revs();
  let root: HTMLElement;
  let hero: HTMLElement;
  let gfx: HTMLElement;
  let bug: HTMLElement;
  let roster: HTMLElement;
  let lower: HTMLElement;
  let crawl: HTMLElement;
  let pip: HTMLElement;
  let sceneN = -1;
  let shown: Spot | null = null;

  function mount(stage: HTMLElement): void {
    root = stage;
    hero = h('div', 'hero', '<img class="a"/><img class="b"/><div class="spray"></div><div class="vignette"></div>');
    gfx = h('div', 'gfx');
    bug = h('div', 'bug');
    bug.innerHTML = `<div class="b-logo">CREW</div><div class="b-cell"><small>GEN</small><b data-k="gen">3</b></div><div class="b-cell champ"><small>CHAMPION</small><b data-k="champ">61.8</b><i>%</i></div><div class="b-cell delta"><b data-k="delta">+13.8</b></div><div class="b-phase" data-k="phase">PRACTICE</div>`;
    const live = h('div', 'livebug', `<span class="dot"></span>LIVE<small>on Crusoe Managed Inference</small>`);
    pip = h('div', 'pip', '<img/><span>LIVE · LOADER</span>');
    roster = h('div', 'roster');
    roster.innerHTML = ROLES.map(
      (r) => `<div class="pl" data-r="${r}" style="--rc:var(--${r})"><div class="pl-num">${ROLE_INFO[r].glyph}</div><div class="pl-txt"><b>${ROLE_INFO[r].name}</b><small>${ROLE_INFO[r].job}</small></div><div class="pl-st"></div></div>`,
    ).join('');
    const epbox = h('div', 'epbox', `<div class="ep-k">NOW PLAYING</div><div class="ep-t"></div><div class="ep-s"><b data-k="pts">0</b><span>/ 64</span></div><div class="ep-items"></div>`);
    lower = h('div', 'lower');
    crawl = h('div', 'crawl', '<div class="cr-k">TEAM WIRE</div><div class="cr-win"><div class="cr-track"></div></div>');
    root.append(hero, gfx, bug, live, pip, roster, epbox, lower, crawl);
  }

  function setScene(n: number): void {
    if (n === sceneN) return;
    sceneN = n;
    const a = hero.querySelector<HTMLImageElement>('img.a')!;
    const b = hero.querySelector<HTMLImageElement>('img.b')!;
    const front = a.classList.contains('front') ? a : b;
    const back = front === a ? b : a;
    back.src = sceneUrl(n);
    back.classList.add('front');
    front.classList.remove('front');
    pip.querySelector('img')!.src = sceneUrl(n);
  }

  function update(w: World, ctx: Ctx): void {
    const spot = ctx.present ? ctx.spot : null;
    if (revs.changed(w, 'phase') || revs.changed(w, 'evo')) {
      const last = w.evo[w.evo.length - 1]!;
      tween(bug.querySelector('[data-k=champ]'), last.champion, (x) => x.toFixed(1));
      bug.querySelector('[data-k=delta]')!.textContent = `▲ ${signed(last.champion - w.evo[0]!.champion)}`;
      bug.querySelector('[data-k=gen]')!.textContent = String(w.generation);
      const ph = bug.querySelector<HTMLElement>('[data-k=phase]')!;
      ph.textContent = w.phase.toUpperCase();
      ph.classList.remove('flash');
      void ph.offsetWidth;
      ph.classList.add('flash');
    }
    if (revs.changed(w, 'episode')) {
      const e = w.episode;
      setScene(e.scene);
      const box = root.querySelector('.epbox')!;
      box.querySelector('.ep-t')!.textContent = e.task;
      tween(box.querySelector('[data-k=pts]'), e.points, (x) => String(Math.round(x)), 1400);
      box.querySelector('.ep-items')!.innerHTML = Array.from({ length: e.items }, (_, i) => `<i class="${i < e.placed ? 'on' : ''} ${e.clean !== null && i < e.clean ? 'clean' : ''} ${e.clean !== null && i >= e.clean ? 'dirty' : ''}"></i>`).join('');
      hero.classList.toggle('washing', e.wash === 'running');
    }
    if (revs.changed(w, 'agents')) {
      for (const r of ROLES) {
        const el = roster.querySelector<HTMLElement>(`.pl[data-r=${r}]`)!;
        const a = w.agents[r];
        el.className = `pl ${a.status}`;
        el.querySelector('.pl-st')!.textContent = a.status === 'idle' ? '' : a.label || a.status;
      }
    }
    if (revs.changed(w, 'caption')) {
      const c = w.caption;
      lower.innerHTML = `<div class="lt-tab" style="--rc:var(--${c.role ?? 'gatekeeper'})">${esc(c.kicker)}</div><div class="lt-bar"><div class="lt-text">${esc(c.text)}</div></div>`;
      lower.classList.remove('in');
      void lower.offsetWidth;
      lower.classList.add('in');
    }
    if (revs.changed(w, 'msgs') || revs.changed(w, 'tools')) {
      const items = [
        ...w.msgs.slice(0, 5).map((m) => `<span class="ci"><b style="color:var(--${m.from})">${ROLE_INFO[m.from].name.toUpperCase()}</b>${esc(m.title)}</span>`),
        ...w.tools.slice(0, 4).map((t) => `<span class="ci"><b>${esc(t.name)}</b>${esc(t.summary)}</span>`),
      ].join('');
      crawl.querySelector('.cr-track')!.innerHTML = `<div>${items}</div><div>${items}</div>`;
    }
    const gchanged = revs.changed(w, 'moment') || revs.changed(w, 'eval') || revs.changed(w, 'exam') || revs.changed(w, 'mem');
    if (ctx.spotChanged || gchanged) renderGfx(w, spot, ctx.spotChanged);
  }

  function renderGfx(w: World, spot: Spot | null, fresh: boolean): void {
    const m = w.moment;
    let html = '';
    if (spot === 'critic' && m.kind === 'critique') {
      html = `<div class="g g-critic"><div class="g-k" style="--rc:var(--critic)">THE CRITIC'S NOTEBOOK · drill-01 · 52/64</div><div class="g-quote">“${esc(m.lesson)}”</div><div class="g-cols"><div class="gw"><b>WORKED</b>${m.worked.map((x) => `<div>${esc(x)}</div>`).join('')}</div><div class="gf"><b>FAILED</b>${m.failed.map((x) => `<div>${esc(x)}</div>`).join('')}</div></div></div>`;
    } else if (spot === 'memory') {
      html = `<div class="g g-memory"><div class="g-k" style="--rc:var(--librarian)">THE PLAYBOOK · ${w.lessons.length} LESSONS · ${w.stats.episodes} EPISODES</div><div class="g-two"><div>${lessonList(w.lessons, 6)}</div><div><div class="g-sub">CLEAN RATE BY PLACEMENT</div>${heatmap(w.heat)}</div></div></div>`;
    } else if (spot === 'evo' && m.kind === 'proposal') {
      html = `<div class="g g-play"><div class="g-k" style="--rc:var(--coach)">THE PLAY · COACH</div>${proposalCard(m.proposal)}<div class="g-chart">${evoChart(w.evo, { w: 760, h: 400, labels: true })}</div></div>`;
    } else if (spot === 'evo' && m.kind === 'evaluate' && w.evalRun) {
      html = `<div class="g g-h2h"><div class="g-k" style="--rc:var(--gatekeeper)">HEAD TO HEAD · SAME DRILLS</div><div class="h2h-title">${esc(w.evalRun.title)}</div><div class="h2h-teams"><span class="old">CURRENT TEAM</span><span class="vs">VS</span><span class="new">WITH THE CHANGE</span></div>${evalBars(w.evalRun)}</div>`;
    } else if (spot === 'evo' && m.kind === 'verdict') {
      const v = m.verdict;
      html = `<div class="g g-final ${v.accepted ? 'kept' : 'binned'}"><div class="g-k" style="--rc:var(--gatekeeper)">FULL TIME · GATEKEEPER</div><div class="sb"><div class="sb-team"><small>CURRENT TEAM</small><b>${v.before.toFixed(1)}</b></div><div class="sb-mid">${esc(v.title)}</div><div class="sb-team new"><small>WITH THE CHANGE</small><b>${v.after.toFixed(1)}</b></div></div><div class="g-chart wide">${evoChart(w.evo, { w: 1300, h: 300, labels: true })}</div></div>`;
    } else if (spot === 'evo') {
      html = `<div class="g g-play"><div class="g-k" style="--rc:var(--gatekeeper)">SEASON SO FAR</div><div class="g-chart wide">${evoChart(w.evo, { w: 1300, h: 460, labels: true })}</div></div>`;
    } else if (spot === 'exam' && w.exam) {
      const ex = w.exam;
      const done = ex.revealed > ex.tasks.length;
      html = `<div class="g g-exam"><div class="g-k" style="--rc:var(--good)">THE FINAL · ${ex.tasks.length} LEVELS NEVER SEEN</div><div class="ex-row"><div class="ex-num ${done ? 'on' : ''}"><b>+${ex.after - ex.before}</b><small>on unseen levels</small><div class="ex-ba"><span>${pct(ex.before, 0)}</span>→<span class="a">${pct(ex.after, 0)}</span></div></div>${examBars(ex)}</div></div>`;
    }
    const on = html !== '';
    root.classList.toggle('has-gfx', on);
    if (fresh || shown !== spot || !on) {
      gfx.innerHTML = html;
      if (on) {
        gfx.firstElementChild?.classList.add('enter');
      }
    } else {
      gfx.innerHTML = html;
    }
    shown = spot;
  }

  return { id: '2', name: 'broadcast', mount, update, destroy: () => revs.reset() };
}
