/**
 * Variant 1, "Mission control": a dense dark HUD on a grid. Six panels; the director promotes
 * one into the big slot (FLIP-animated) and dims the rest. Caption bar and ticker at the bottom.
 */

import { ROLE_INFO, ROLES, PHASES, type Role, type World } from './mock';
import { esc, evalBars, evoChart, examBars, flip, h, heatmap, kfmt, lessonList, msgRow, pct, proposalCard, Revs, roleTag, sceneUrl, signed, toolRow, tween, verdictBlock } from './ui';
import type { Ctx, Spot, View } from './view';

type PanelId = 'live' | 'team' | 'chatter' | 'evo' | 'memory' | 'stream';
const ORDER: PanelId[] = ['live', 'evo', 'team', 'chatter', 'memory', 'stream'];
const SPOT_PANEL: Record<Spot, PanelId> = { live: 'live', critic: 'chatter', memory: 'memory', evo: 'evo', exam: 'evo', team: 'team' };
const TITLES: Record<PanelId, [string, string]> = {
  live: ['Live', '3D episode'],
  team: ['Team', 'constellation'],
  chatter: ['Team chatter', 'messages'],
  evo: ['Evolution', 'same validation drills'],
  memory: ['Memory', 'librarian'],
  stream: ['Thought stream', 'loader'],
};

// Positions of the roles in the constellation (viewBox 600×360).
const POS: Record<Role, [number, number]> = {
  planner: [110, 90],
  loader: [300, 60],
  critic: [490, 90],
  coach: [490, 270],
  gatekeeper: [300, 300],
  librarian: [110, 270],
};

export function mission(): View {
  const revs = new Revs();
  let root: HTMLElement;
  const panels = {} as Record<PanelId, { el: HTMLElement; body: HTMLElement; note: HTMLElement }>;
  let big: PanelId = 'live';
  let header: HTMLElement;
  let capEl: HTMLElement;
  let ticker: HTMLElement;
  let sceneN = -1;

  function panel(id: PanelId): void {
    const el = h('section', `panel p-${id}`);
    const [t, em] = TITLES[id];
    const head = h('h2', '', `<span class="pt">${t}</span> <em>${em}</em>`);
    const note = h('span', 'pnote');
    head.append(note);
    const body = h('div', 'pbody');
    el.append(head, body);
    el.addEventListener('click', () => setBig(id));
    panels[id] = { el, body, note };
  }

  function setBig(id: PanelId): void {
    if (id === big) return;
    const els = ORDER.map((p) => panels[p].el);
    flip(els, () => {
      big = id;
      let i = 1;
      for (const p of ORDER) {
        panels[p].el.style.gridArea = p === big ? 'B' : `s${i++}`;
        panels[p].el.classList.toggle('big', p === big);
      }
    });
  }

  function mount(stage: HTMLElement): void {
    root = stage;
    header = h('header', 'hud-top');
    header.innerHTML = `
      <div class="brand"><div class="logo"><i></i><i></i><i></i></div><div><div class="title">CREW</div><div class="sub">self-improving agent team · Crusoe Managed Inference</div></div></div>
      <div class="phases">${PHASES.map((p) => `<div class="ph" data-p="${p}">${p}</div>`).join('')}</div>
      <div class="counters">
        <div class="ctr"><small>generation</small><b data-k="gen">3</b></div>
        <div class="ctr big"><small>champion</small><b data-k="champ">61.8%</b></div>
        <div class="ctr"><small>episodes</small><b data-k="eps">41</b></div>
        <div class="ctr"><small>tokens</small><b data-k="tok">3.4M</b></div>
        <div class="ctr live"><small>status</small><b><i class="rec"></i>LIVE</b></div>
      </div>`;
    const grid = h('main', 'grid');
    for (const id of ORDER) {
      panel(id);
      grid.append(panels[id].el);
    }
    capEl = h('div', 'caption');
    ticker = h('div', 'ticker', '<div class="track"></div>');
    const scan = h('div', 'scan');
    root.append(header, grid, capEl, ticker, scan);

    // Static parts of panels.
    panels.live.body.innerHTML = `<div class="scene"><img class="a"/><img class="b"/><div class="water"></div><div class="reticle"></div></div>
      <div class="ep-hud"><div class="ep-task"></div><div class="ep-score"><b data-k="pts">0</b><small>/ 64 pts</small></div><div class="ep-bar"><i></i></div><div class="ep-wash"></div></div>`;
    panels.team.body.innerHTML = teamSvg();
    let i = 1;
    for (const p of ORDER) {
      panels[p].el.style.gridArea = p === big ? 'B' : `s${i++}`;
      panels[p].el.classList.toggle('big', p === big);
    }
  }

  function teamSvg(): string {
    const links: string[] = [];
    for (let a = 0; a < ROLES.length; a++)
      for (let b = a + 1; b < ROLES.length; b++) {
        const [x1, y1] = POS[ROLES[a]!];
        const [x2, y2] = POS[ROLES[b]!];
        links.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`);
      }
    const nodes = ROLES.map((r) => {
      const [x, y] = POS[r];
      return `<g class="node" data-r="${r}" style="--rc:var(--${r})" transform="translate(${x},${y})"><circle class="halo" r="46"/><circle class="core" r="34"/><text class="glyph" y="10">${ROLE_INFO[r].glyph}</text><text class="nm" y="64">${ROLE_INFO[r].name}</text><text class="lbl" y="86"></text></g>`;
    }).join('');
    return `<svg class="team" viewBox="0 0 600 380"><g class="links">${links.join('')}</g><g class="flights"></g>${nodes}</svg>`;
  }

  function fly(from: Role, to: Role | 'all'): void {
    const g = panels.team.body.querySelector('.flights');
    if (!g) return;
    const targets = to === 'all' ? ROLES.filter((r) => r !== from) : [to];
    const [x1, y1] = POS[from];
    for (const t of targets) {
      const [x2, y2] = POS[t];
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      c.setAttribute('r', '9');
      c.setAttribute('class', 'flight');
      c.style.setProperty('--rc', `var(--${from})`);
      g.append(c);
      c.animate([{ transform: `translate(${x1}px,${y1}px)` }, { transform: `translate(${x2}px,${y2}px)` }], { duration: 1100, easing: 'cubic-bezier(.5,0,.3,1)' }).onfinish = () => c.remove();
    }
  }

  function update(w: World, ctx: Ctx): void {
    root.classList.toggle('present', ctx.present);
    if (ctx.spotChanged) setBig(ctx.spot ? SPOT_PANEL[ctx.spot] : 'live');
    for (const p of ORDER) panels[p].el.classList.toggle('dim', ctx.present && p !== big);

    if (revs.changed(w, 'phase') || revs.changed(w, 'evo')) {
      header.querySelectorAll<HTMLElement>('.ph').forEach((e) => {
        const idx = PHASES.indexOf(e.dataset['p'] as never);
        const cur = PHASES.indexOf(w.phase);
        e.className = `ph ${idx === cur ? 'on' : idx < cur ? 'past' : ''}`;
      });
      tween(header.querySelector('[data-k=champ]'), w.evo[w.evo.length - 1]!.champion, (x) => pct(x));
      header.querySelector('[data-k=gen]')!.textContent = String(w.generation);
      renderEvo(w);
    }
    if (revs.changed(w, 'tools')) {
      tween(header.querySelector('[data-k=tok]'), w.stats.tokensIn + w.stats.tokensOut, kfmt, 600);
      const s = panels.stream.body;
      s.innerHTML = w.tools
        .slice(0, 14)
        .map((t) => (t.thought ? `<div class="thought">${roleTag('loader')}<span>${esc(t.thought)}</span></div>` : '') + toolRow(t))
        .join('');
      s.firstElementChild?.classList.add('new');
      panels.stream.note.textContent = `${w.tools.length} calls`;
      renderTicker(w);
    }
    if (revs.changed(w, 'episode')) {
      const e = w.episode;
      tween(header.querySelector('[data-k=eps]'), w.stats.episodes, (x) => String(Math.round(x)));
      const live = panels.live.body;
      if (e.scene !== sceneN) {
        sceneN = e.scene;
        const [a, b] = [live.querySelector<HTMLImageElement>('img.a')!, live.querySelector<HTMLImageElement>('img.b')!];
        const front = a.classList.contains('front') ? a : b;
        const back = front === a ? b : a;
        back.src = sceneUrl(e.scene);
        back.classList.add('front');
        front.classList.remove('front');
      }
      live.querySelector('.ep-task')!.innerHTML = `<small>generation ${e.gen} · practice</small>${esc(e.task)}`;
      tween(live.querySelector('[data-k=pts]'), e.points, (x) => String(Math.round(x)), 1400);
      (live.querySelector('.ep-bar i') as HTMLElement).style.width = `${e.progress * 100}%`;
      live.querySelector('.ep-wash')!.innerHTML =
        e.wash === 'running' ? '<span class="pill run">WASHING · ECO 50</span>' : e.wash === 'done' ? `<span class="pill done">${e.clean}/${e.items} CLEAN</span>` : `<span class="pill">${e.placed} PLACED</span>`;
      live.classList.toggle('washing', e.wash === 'running');
      panels.live.note.textContent = e.taskId;
    }
    if (revs.changed(w, 'agents')) {
      for (const r of ROLES) {
        const n = panels.team.body.querySelector(`.node[data-r=${r}]`);
        if (!n) continue;
        n.setAttribute('class', `node ${w.agents[r].status}`);
        n.querySelector('.lbl')!.textContent = w.agents[r].label;
      }
    }
    if (revs.changed(w, 'msgs')) {
      if (w.lastMsg) fly(w.lastMsg.from, w.lastMsg.to);
      renderChatter(w);
      renderTicker(w);
    }
    if (revs.changed(w, 'moment')) {
      renderChatter(w);
      renderEvo(w);
    }
    if (revs.changed(w, 'eval') || revs.changed(w, 'exam')) renderEvo(w);
    if (revs.changed(w, 'mem')) {
      panels.memory.body.innerHTML = `<div class="memstats"><div><b>${w.stats.episodes}</b><small>episodes</small></div><div><b>${w.lessons.length}</b><small>lessons</small></div><div><b>${w.stats.genomes}</b><small>genomes</small></div></div>
        <div class="memcols"><div class="memlessons">${lessonList(w.lessons, 7)}</div><div class="memheat"><div class="sub">clean rate by placement</div>${heatmap(w.heat)}</div></div>`;
    }
    if (revs.changed(w, 'caption')) {
      const c = w.caption;
      capEl.innerHTML = `<div class="cap-role" style="--rc:var(--${c.role ?? 'loader'})">${c.role ? ROLE_INFO[c.role].glyph : '◆'}</div><div class="cap-txt"><div class="cap-k">${esc(c.kicker)}</div><div class="cap-t">${esc(c.text)}</div></div>`;
      capEl.classList.remove('in');
      void capEl.offsetWidth;
      capEl.classList.add('in');
    }
  }

  function renderChatter(w: World): void {
    const m = w.moment;
    const card =
      m.kind === 'critique'
        ? `<div class="critic-card"><div class="cc-k">${roleTag('critic')} post-mortem · drill-01 · 52/64</div><div class="cc-lesson">“${esc(m.lesson)}”</div><div class="cc-cols"><div><b class="ok">worked</b>${m.worked.map((x) => `<div>+ ${esc(x)}</div>`).join('')}</div><div><b class="no">failed</b>${m.failed.map((x) => `<div>− ${esc(x)}</div>`).join('')}</div></div></div>`
        : '';
    panels.chatter.body.innerHTML = card + `<div class="feed">${w.msgs.slice(0, 8).map(msgRow).join('')}</div>`;
    panels.chatter.el.classList.toggle('has-card', !!card);
  }

  function renderEvo(w: World): void {
    const m = w.moment;
    const body = panels.evo.body;
    const last = w.evo[w.evo.length - 1]!;
    panels.evo.note.textContent = `${w.evo.length - 1} decisions`;
    const chart = evoChart(w.evo, { w: 900, h: 420, labels: true });
    let side = '';
    if (m.kind === 'exam' && w.exam) {
      const ex = w.exam;
      const done = ex.revealed > ex.tasks.length;
      body.innerHTML = `<div class="exam-mode"><div class="ex-head"><small>final exam · ${ex.tasks.length} levels never seen</small><div class="ex-big ${done ? 'on' : ''}">+${ex.after - ex.before}<small> on unseen levels</small></div></div>${examBars(ex)}<div class="ex-legend"><span class="b">day-one team</span><span class="a">today's team</span></div></div>`;
      return;
    }
    if (m.kind === 'proposal') side = proposalCard(m.proposal);
    else if (m.kind === 'evaluate' && w.evalRun) side = `<div class="eval"><div class="p-kicker">Gatekeeper · paired evaluation</div><div class="p-title">${esc(w.evalRun.title)}</div>${evalBars(w.evalRun)}<div class="ex-legend"><span class="b">current team</span><span class="a">with the change</span></div></div>`;
    else if (m.kind === 'verdict') side = verdictBlock(m.verdict);
    body.innerHTML = `<div class="evo-wrap ${side ? 'with-side' : ''}"><div class="evo-chart"><div class="evo-now"><b>${pct(last.champion)}</b><small>champion · ${signed(last.champion - w.evo[0]!.champion)} since baseline</small></div>${chart}</div>${side ? `<div class="evo-side">${side}</div>` : ''}</div>`;
  }

  function renderTicker(w: World): void {
    const items = [
      ...w.msgs.slice(0, 4).map((m) => `<span class="ti" style="--rc:var(--${m.from})"><b>${ROLE_INFO[m.from].name.toUpperCase()}</b> ${esc(m.title)}</span>`),
      ...w.tools.slice(0, 6).map((t) => `<span class="ti tool ${t.ok ? '' : 'bad'}"><b>${esc(t.name)}</b> ${esc(t.summary)}</span>`),
    ].join('<span class="sep">◆</span>');
    const track = ticker.querySelector('.track')!;
    track.innerHTML = `<div>${items}<span class="sep">◆</span></div><div>${items}<span class="sep">◆</span></div>`;
  }

  return {
    id: '1',
    name: 'mission control',
    mount,
    update,
    destroy: () => revs.reset(),
  };
}
