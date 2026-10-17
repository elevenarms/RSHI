"""SparkleTeam launch video: the visual system shared by every Manim scene.

Follows docs/crew/launch/STYLE.md: white paper, black ink, one monospace face (JetBrains Mono,
weights 400 / 600 / 800, no LaTeX anywhere), colour for meaning only (green = clean / accepted /
gain, red = dirty / rejected / loss, amber = held-out exam / caution, grey = secondary) and one
accent per team role, used only on that role's marker. Motion is slow and eased; nothing bounces.

Helpers: house banner, black section tag, tracked small-caps label, journal figure caption,
count-up number, title card, lower third, data table, bar comparison, team node graph with
travelling packets, typed diff block.

Import with `from style import *` from a scene in this folder (manim runs from the video folder
with scenes/ on the path; each scene file adds its own folder to sys.path).
"""

from __future__ import annotations

from typing import Callable, Iterable, Sequence

import numpy as np
from manim import (
    DOWN,
    LEFT,
    ORIGIN,
    RIGHT,
    UP,
    UL,
    UR,
    AddTextLetterByLetter,
    AnimationGroup,
    Arrow,
    Create,
    Dot,
    FadeIn,
    FadeOut,
    GrowFromEdge,
    LaggedStart,
    Line,
    MoveAlongPath,
    Rectangle,
    RoundedRectangle,
    Succession,
    Text,
    ValueTracker,
    VGroup,
    VMobject,
    always_redraw,
    config,
    linear,
    rate_functions,
)

# ---------------------------------------------------------------------------------------------
# Frame (size and rate come from the command line: -qh --fps 30)
# ---------------------------------------------------------------------------------------------

config.background_color = "#FFFFFF"

FW = 14.222  # frame width, units (16:9, 8 units tall)
FH = 8.0

# ---------------------------------------------------------------------------------------------
# Palette (STYLE.md: colour means something or it is black)
# ---------------------------------------------------------------------------------------------

PAPER = "#FFFFFF"
PLATE = "#F6F6F4"  # off-white plate (3D backgrounds, quiet panels)
INK = "#000000"
GREY = "#8A8A8A"  # reasoning, secondary
INK_2 = GREY  # secondary text
INK_3 = GREY  # captions, axes
RULE = "#000000"  # hairline rules are black
FAINT = "#E4E4E2"  # the faintest structure (grid ticks, ghost bars), never text
WASH = PLATE

CLEAN = "#0A9D58"  # clean / accepted / gain
DIRTY = "#D64545"  # dirty / rejected / loss
HELD = "#E6A100"  # held-out exam / caution

ROLE = {
    "planner": "#1F6FEB",  # blue
    "loader": "#00A0C6",  # cyan
    "critic": "#E0559A",  # pink
    "coach": "#7B4FD6",  # violet
    "librarian": "#13998A",  # green-teal
    "gatekeeper": INK,  # deterministic code: black
}

FONT = "JetBrains Mono NL"  # the no-ligature cut: one glyph per character (//, ->, <= stay literal)
W400, W600, W800 = "NORMAL", "SEMIBOLD", "ULTRABOLD"

# Type scale (Manim font_size units).
SIZE_HERO = 64
SIZE_H1 = 44
SIZE_H2 = 32
SIZE_BODY = 24
SIZE_SMALL = 19
SIZE_CAPTION = 15

HAIR = 1.2  # hairline stroke
STROKE = 1.8  # box outlines
SAFE = 0.6  # margin from the frame edge, units

EASE = rate_functions.ease_in_out_sine
T_IN = 0.8  # standard reveal time


# ---------------------------------------------------------------------------------------------
# Text
# ---------------------------------------------------------------------------------------------


def mono(text: str, size: float = SIZE_BODY, color: str = INK, weight: str = W400, **kwargs) -> Text:
    """Monospace text in the house face. `weight`: W400, W600 or W800."""
    weight = {"BOLD": W800, "MEDIUM": W600}.get(weight, weight)
    return Text(text, font=FONT, font_size=size, color=color, weight=weight, disable_ligatures=True, **kwargs)


def line_text(text: str, size: float = SIZE_BODY, color: str = INK, weight: str = W400) -> Text:
    """Monospace text with an invisible strut glyph '|' in front: every such line has the same
    vertical box (no jitter from descenders) and leading spaces are kept. `.ink` is the visible
    glyph group; use `put(t, x, y)` to place it by its strut."""
    t = mono("|" + text, size, color, weight)
    t[0].set_opacity(0)
    t.strut = t[0]  # type: ignore[attr-defined]
    t.ink = VGroup(*t[1:]) if len(t) > 1 else VGroup()  # type: ignore[attr-defined]
    t.plain = text  # type: ignore[attr-defined]
    return t


def char_width(size: float) -> float:
    a = mono("|" * 2, size)
    b = mono("|" * 12, size)
    return (b.width - a.width) / 10


def put(t: Text, x: float, y: float, align: str = "l") -> Text:
    """Places a line_text so that its strut sits on row y; x is the left edge of the visible
    ink ('l'), its right edge ('r'), or the left of the strut ('s': keeps indentation)."""
    sy = t.strut.get_center()[1]
    if align == "s":
        t.shift([x - t.strut.get_left()[0], y - sy, 0])
    elif align == "l":
        left = t.ink.get_left()[0] if len(t.ink) else t.strut.get_right()[0]
        t.shift([x - left, y - sy, 0])
    else:
        right = t.ink.get_right()[0] if len(t.ink) else t.strut.get_right()[0]
        t.shift([x - right, y - sy, 0])
    return t


def label(text: str, size: float = SIZE_CAPTION, color: str = INK, weight: str = W600, tracking: float = 0.08) -> VGroup:
    """Small uppercase label with letter-spacing (`tracking` in em)."""
    text = text.upper()
    t = mono(text, size, color, weight)
    adv = char_width(size)
    extra = tracking * adv / 0.6
    x0 = t.get_left()[0]
    for g in t:
        col = round((g.get_center()[0] - x0) / adv - 0.5)
        g.shift(RIGHT * extra * col)
    return t


def rule(width: float, color: str = RULE, stroke: float = HAIR) -> Line:
    return Line(LEFT * width / 2, RIGHT * width / 2, color=color, stroke_width=stroke)


def banner(section: str | None = None) -> VGroup:
    """The house banner across the top: `SPARKLETEAM // DISHWASHING SCIENCE DIVISION`, an
    optional section name at the right, a black hairline under both."""
    left = label("SPARKLETEAM // DISHWASHING SCIENCE DIVISION", SIZE_CAPTION - 2, INK, W600)
    left.to_corner(UL, buff=SAFE).shift(UP * 0.18)
    parts: list[VMobject] = [left]
    if section:
        right = label(section, SIZE_CAPTION - 2, GREY, W600)
        right.to_corner(UR, buff=SAFE).shift(UP * 0.18)
        right.align_to(left, UP)
        parts.append(right)
    line = Line([-FW / 2 + SAFE, 0, 0], [FW / 2 - SAFE, 0, 0], color=INK, stroke_width=1.0)
    line.next_to(left, DOWN, buff=0.12)
    line.set_x(0)
    parts.append(line)
    return VGroup(*parts)


def tag(text: str, size: float = SIZE_CAPTION, fill: str = INK, color: str = PAPER) -> VGroup:
    """Black-filled section tag with white tracked uppercase text (FINDING, METHOD, EXAM)."""
    t = label(text, size, color, W800, tracking=0.1)
    box = Rectangle(width=t.width + 0.32, height=t.height + 0.2, fill_color=fill, fill_opacity=1, stroke_width=0)
    t.move_to(box)
    return VGroup(box, t)


def fig_caption(n: int | str, text: str, width: float | None = None) -> Text:
    """Journal caption: `Fig. N · text`, small grey monospace."""
    return mono(f"Fig. {n} · {text}", SIZE_CAPTION, GREY)


def heading(text: str, size: float = SIZE_H2, color: str = INK) -> Text:
    """Content-scene headline under the banner, top-left."""
    h = mono(text, size, color, W800)
    h.to_corner(UL, buff=SAFE).shift(DOWN * 0.55)
    return h


def counter(
    tracker: ValueTracker,
    fmt: Callable[[float], str] | str = "{:.1f}",
    size: float = SIZE_HERO,
    color: str = INK,
    weight: str = W800,
    place: Callable[[VMobject], None] | None = None,
) -> VMobject:
    """A number that counts with `tracker` (monospace, redrawn each frame; no LaTeX).
    `place(m)` positions each redraw."""
    f = fmt.format if isinstance(fmt, str) else fmt

    def make() -> VMobject:
        m = mono(f(tracker.get_value()), size, color, weight)
        if place is not None:
            place(m)
        return m

    return always_redraw(make)


# ---------------------------------------------------------------------------------------------
# Title card and lower third
# ---------------------------------------------------------------------------------------------


def title_card(title: str, subtitle: str | None = None, kicker: str | None = None) -> VGroup:
    """Centered title, optional tracked kicker above and subtitle below, a hairline between."""
    parts: list[VMobject] = []
    if kicker:
        parts.append(label(kicker, SIZE_SMALL - 2, GREY, W600))
    head = mono(title, SIZE_HERO, INK, W800)
    parts.append(head)
    if subtitle:
        sub = mono(subtitle, SIZE_BODY, INK, W400)
        parts.append(rule(max(head.width, sub.width), INK, HAIR))
        parts.append(sub)
    return VGroup(*parts).arrange(DOWN, buff=0.32)


def lower_third(name: str, detail: str | None = None, accent: str = INK) -> VGroup:
    """Bottom-left caption: an accent tick, a name, an optional grey detail line."""
    lines = [mono(name, SIZE_H2, INK, W800)]
    if detail:
        lines.append(mono(detail, SIZE_SMALL, GREY))
    text = VGroup(*lines).arrange(DOWN, aligned_edge=LEFT, buff=0.12)
    tick = Line(UP * text.height / 2, DOWN * text.height / 2, color=accent, stroke_width=6)
    tick.next_to(text, LEFT, buff=0.22)
    group = VGroup(tick, text)
    group.to_corner(LEFT + DOWN, buff=SAFE + 0.2)
    return group


def lower_third_in(group: VGroup):
    tick, text = group
    return Succession(Create(tick, run_time=0.4), FadeIn(text, shift=RIGHT * 0.12, run_time=0.7))


# ---------------------------------------------------------------------------------------------
# Data table
# ---------------------------------------------------------------------------------------------


def data_table(
    headers: Sequence[str],
    rows: Sequence[Sequence[str]],
    cell_colors: dict[tuple[int, int], str] | None = None,
    col_align: Sequence[str] | None = None,
    size: float = SIZE_SMALL + 1,
    col_gap: float = 0.6,
    row_h: float | None = None,
    header_color: str = GREY,
) -> VGroup:
    """Booktabs-style table: black rules top and bottom, a hairline under the header, no
    vertical lines, every cell on a common baseline. `cell_colors[(r, c)]` colours one body cell
    (0-based); `col_align` 'l' / 'r' per column (numeric columns right-aligned by default).
    `.rows` holds the body row groups and `.header` the header row, for staggered reveals."""
    cell_colors = cell_colors or {}
    n = len(headers)
    head = [line_text(h, size, header_color, W600) for h in headers]
    body = [[line_text(str(v), size, cell_colors.get((r, c), INK)) for c, v in enumerate(row)] for r, row in enumerate(rows)]

    def is_num(s: str) -> bool:
        try:
            float(s.replace("%", "").replace("+", "").replace("−", "-").replace(",", "").replace("pp", "").strip())
            return True
        except ValueError:
            return False

    if col_align is None:
        col_align = ["r" if rows and all(is_num(str(r[c])) for r in rows) else "l" for c in range(n)]
    widths = [max([head[c].ink.width] + [row[c].ink.width for row in body]) for c in range(n)]
    xs, x = [], 0.0
    for w in widths:
        xs.append(x)
        x += w + col_gap
    total = x - col_gap
    lh = head[0].strut.height
    row_h = row_h or lh * 1.75

    def place(cells: list[Text], y: float) -> VGroup:
        for c, cell in enumerate(cells):
            if col_align[c] == "r":
                put(cell, xs[c] + widths[c], y, "r")
            else:
                put(cell, xs[c], y, "l")
        return VGroup(*cells)

    y = 0.0
    header = place(head, y)
    y -= row_h * 1.15
    body_rows = []
    for row in body:
        body_rows.append(place(row, y))
        y -= row_h
    pad = 0.2
    top_y = row_h * 0.62
    mid_y = -row_h * 0.55
    bot_y = y + row_h * 0.45
    top = Line([-pad, top_y, 0], [total + pad, top_y, 0], color=INK, stroke_width=2)
    mid = Line([-pad, mid_y, 0], [total + pad, mid_y, 0], color=INK, stroke_width=0.8)
    bot = Line([-pad, bot_y, 0], [total + pad, bot_y, 0], color=INK, stroke_width=2)
    table = VGroup(top, header, mid, *body_rows, bot)
    table.rows = body_rows  # type: ignore[attr-defined]
    table.header = header  # type: ignore[attr-defined]
    table.rules = VGroup(top, mid, bot)  # type: ignore[attr-defined]
    table.move_to(ORIGIN)
    return table


def table_in(table: VGroup, lag: float = 0.12):
    return Succession(
        AnimationGroup(Create(table.rules[0], run_time=0.6), FadeIn(table.header, run_time=0.6)),
        Create(table.rules[1], run_time=0.4),
        LaggedStart(*[FadeIn(r, shift=DOWN * 0.05) for r in table.rows], lag_ratio=lag, run_time=0.6 + lag * len(table.rows)),
        Create(table.rules[2], run_time=0.4),
    )


# ---------------------------------------------------------------------------------------------
# Bar comparison
# ---------------------------------------------------------------------------------------------


def bar_comparison(
    labels: Sequence[str],
    values: Sequence[float],
    colors: Sequence[str] | None = None,
    vmax: float | None = None,
    fmt: str = "{:.1f}",
    unit: str = "",
    width: float = 7.0,
    bar_h: float = 0.42,
    gap: float = 0.34,
    outline: bool = False,
) -> VGroup:
    """Horizontal bars, labels on the left, values at the bar ends, a hairline baseline.
    `outline=True` draws bars as outlines (held-out exam style). `.grow()` reveals it."""
    colors = list(colors or [INK] * len(values))
    vmax = vmax or max(values) or 1.0
    lab = [line_text(l, SIZE_SMALL + 1, INK) for l in labels]
    bars, vals = [], []
    for i, (v, col) in enumerate(zip(values, colors)):
        y = -i * (bar_h + gap)
        put(lab[i], -0.25, y, "r")
        w = max(width * v / vmax, 0.01)
        bar = Rectangle(
            width=w, height=bar_h, fill_color=col, fill_opacity=0 if outline else 1,
            stroke_color=col, stroke_width=2 if outline else 0,
        )
        bar.move_to([w / 2, y, 0])
        val = line_text(fmt.format(v) + unit, SIZE_SMALL + 1, col if col != GREY else GREY, W600)
        put(val, bar.get_right()[0] + 0.15, y)
        bars.append(bar)
        vals.append(val)
    top = bar_h / 2 + 0.12
    bottom = -(len(values) - 1) * (bar_h + gap) - bar_h / 2 - 0.12
    axis = Line([0, top, 0], [0, bottom, 0], color=INK, stroke_width=HAIR)
    group = VGroup(VGroup(*lab), VGroup(*bars), VGroup(*vals), axis)
    group.move_to(ORIGIN)

    def grow(run_time: float = 1.2, lag: float = 0.15):
        return AnimationGroup(
            FadeIn(group[0], run_time=0.6),
            Create(group[3], run_time=0.6),
            LaggedStart(*[GrowFromEdge(b, LEFT, rate_func=EASE) for b in group[1]], lag_ratio=lag, run_time=run_time),
            LaggedStart(*[FadeIn(v, shift=RIGHT * 0.08) for v in group[2]], lag_ratio=lag, run_time=run_time + 0.3),
        )

    group.grow = grow  # type: ignore[attr-defined]
    return group


# ---------------------------------------------------------------------------------------------
# Team node graph with travelling packets
# ---------------------------------------------------------------------------------------------


class Node(VGroup):
    """A role box: black hairline rounded rectangle, the role's accent marker on the left, name
    (600) and caption (grey). `square=True` + `filled=True` draws the Gatekeeper style: a square
    corner box, solid black, white text."""

    def __init__(
        self,
        name: str,
        caption: str | None = None,
        accent: str = INK,
        width: float = 2.6,
        square: bool = False,
        filled: bool = False,
        size: float = SIZE_BODY,
    ):
        fg = PAPER if filled else INK
        title = line_text(name, size, fg, W800)
        lines = [title]
        if caption:
            lines.append(line_text(caption, SIZE_CAPTION, "#BDBDBD" if filled else GREY))
        text = VGroup(*lines).arrange(DOWN, aligned_edge=LEFT, buff=0.04)
        h = max(text.height + 0.34, 0.78)
        width = max(width, text.width + 0.8)
        box = (Rectangle if square else RoundedRectangle)(
            **({} if square else {"corner_radius": 0.08}),
            width=width, height=h, stroke_color=INK, stroke_width=STROKE,
            fill_color=INK if filled else PAPER, fill_opacity=1,
        )
        parts: list[VMobject] = [box]
        if not filled:
            bar = Rectangle(width=0.09, height=h - 0.18, fill_color=accent, fill_opacity=1, stroke_width=0)
            bar.move_to(box.get_left() + RIGHT * 0.16)
            parts.append(bar)
            text.move_to(box.get_center())
            text.shift(RIGHT * (bar.get_right()[0] + 0.2 - text.get_left()[0]))
        else:
            bar = VMobject()
            text.move_to(box.get_center())
            text.shift(RIGHT * (box.get_left()[0] + 0.3 - text.get_left()[0]))
        super().__init__(*parts, text)
        self.box, self.accent_bar, self.label = box, bar, text
        self.accent = accent


class TeamGraph(VGroup):
    """Nodes at given positions and straight hairline arrows between their box borders.

    nodes: {key: (name, caption, accent, (x, y))} or {key: Node}; edges: [(a, b)].
    `packet(a, b)` animates a dot travelling a→b along the edge; `pulse(key)` flashes a
    node's marker."""

    def __init__(self, nodes: dict, edges: Iterable[tuple[str, str]] = (), node_width: float = 2.6):
        super().__init__()
        self.nodes: dict[str, Node] = {}
        for key, spec in nodes.items():
            if isinstance(spec, Node):
                n = spec
            else:
                name, caption, accent, pos = spec
                n = Node(name, caption, accent, width=node_width)
                n.move_to([pos[0], pos[1], 0])
            self.nodes[key] = n
        self.edges: dict[tuple[str, str], Arrow] = {}
        for a, b in edges:
            self.edges[(a, b)] = self.make_edge(a, b)
        self.add(*self.edges.values(), *self.nodes.values())

    def make_edge(self, a: str, b: str, color: str = GREY) -> Arrow:
        A, B = self.nodes[a].box, self.nodes[b].box
        start, end = border_point(A, B.get_center()), border_point(B, A.get_center())
        return Arrow(
            start, end, buff=0, color=color, stroke_width=HAIR + 0.3, tip_length=0.12,
            max_tip_length_to_length_ratio=0.5, max_stroke_width_to_length_ratio=100,
        )

    def reveal(self, run_time: float = 1.6):
        return Succession(
            LaggedStart(*[FadeIn(n, scale=0.97) for n in self.nodes.values()], lag_ratio=0.12, run_time=run_time * 0.6),
            LaggedStart(*[Create(e) for e in self.edges.values()], lag_ratio=0.08, run_time=run_time * 0.4),
        )

    def path(self, a: str, b: str) -> Line:
        if (a, b) in self.edges:
            e = self.edges[(a, b)]
            return Line(e.get_start(), e.get_end())
        e = self.edges[(b, a)]
        return Line(e.get_end(), e.get_start())

    def packet(self, a: str, b: str, color: str | None = None, run_time: float = 0.9, label: str | None = None):
        """A small filled dot (optionally carrying a caption) travels a→b, then fades."""
        color = color or self.nodes[a].accent
        return packet_along(self.path(a, b), color, run_time, label)

    def pulse(self, key: str, color: str | None = None, run_time: float = 0.6):
        from manim import Indicate

        n = self.nodes[key]
        return Indicate(n.accent_bar, color=color or n.accent, scale_factor=1.0, run_time=run_time)


def packet_along(path: VMobject, color: str = INK, run_time: float = 0.9, label: str | None = None):
    """A dot (optionally with a grey caption riding above it) travels along `path`, then fades."""
    from manim import UpdateFromAlphaFunc

    dot = Dot(path.get_start(), radius=0.07, color=color)
    parts: list[VMobject] = [dot]
    t = None
    if label:
        t = mono(label, SIZE_CAPTION, GREY).next_to(dot, UP, buff=0.08)
        parts.append(t)
    moving = VGroup(*parts)

    def step(_m, a):
        dot.move_to(path.point_from_proportion(EASE(a)))
        if t is not None:
            t.next_to(dot, UP, buff=0.08)

    return Succession(
        FadeIn(moving, run_time=0.15),
        UpdateFromAlphaFunc(moving, step, run_time=run_time),
        FadeOut(moving, run_time=0.2),
    )


def border_point(box: VMobject, toward) -> np.ndarray:
    """Where the ray from the box centre toward `toward` leaves the box (axis-aligned)."""
    c = box.get_center()
    d = np.array(toward) - c
    hw, hh = box.width / 2 + 0.06, box.height / 2 + 0.06
    sx = hw / abs(d[0]) if abs(d[0]) > 1e-9 else np.inf
    sy = hh / abs(d[1]) if abs(d[1]) > 1e-9 else np.inf
    return c + d * min(sx, sy)


# ---------------------------------------------------------------------------------------------
# Typed diff block
# ---------------------------------------------------------------------------------------------


def diff_block(lines: Sequence[str], title: str | None = None, size: float = SIZE_SMALL, width: float | None = None, line_h: float | None = None) -> VGroup:
    """A code panel: lines starting with '+' are green, '-' red, '@' grey, others ink;
    indentation is kept. Returns VGroup(panel, bands, [title], body); `type_diff()` types it."""
    colour = {"+": CLEAN, "-": DIRTY, "@": GREY}
    mobs = [line_text(l, size, colour.get(l[:1], INK) if l else INK, W600 if l[:1] == "+" else W400) for l in lines]
    lh = line_h or mobs[0].strut.height * 1.55
    for i, m in enumerate(mobs):
        put(m, 0, -i * lh, "s")
    body = VGroup(*mobs)
    ink_w = max((m.ink.get_right()[0] if len(m.ink) else 0) for m in mobs) - mobs[0].strut.get_right()[0]
    x_left = mobs[0].strut.get_right()[0]
    w = (width or ink_w) + 0.7
    h = len(lines) * lh + 0.3
    panel = RoundedRectangle(corner_radius=0.05, width=w, height=h, stroke_color=INK, stroke_width=HAIR, fill_color=PLATE, fill_opacity=1)
    panel.move_to([x_left + ink_w / 2, -(len(lines) - 1) * lh / 2, 0])
    bands = VGroup()
    for line, m in zip(lines, mobs):
        if line[:1] in ("+", "-"):
            band = Rectangle(width=w - 0.03, height=lh * 0.92, stroke_width=0, fill_color=colour[line[:1]], fill_opacity=0.09)
            band.move_to([panel.get_center()[0], m.strut.get_center()[1], 0])
            bands.add(band)
    parts: list[VMobject] = [panel, bands]
    if title:
        t = label(title, SIZE_CAPTION - 1, GREY, W600)
        t.next_to(panel, UP, buff=0.14).align_to(panel, LEFT)
        parts.append(t)
    group = VGroup(*parts, body)
    group.body = body  # type: ignore[attr-defined]
    group.bands = bands  # type: ignore[attr-defined]
    group.panel = panel  # type: ignore[attr-defined]
    group.title = parts[2] if title else None  # type: ignore[attr-defined]
    group.move_to(ORIGIN)
    return group


def type_line(m: Text, seconds_per_char: float = 0.03):
    """Types a line_text glyph by glyph (the strut stays hidden)."""
    from manim import ShowIncreasingSubsets

    n = max(len(m.ink), 1)
    return ShowIncreasingSubsets(m.ink, run_time=max(n * seconds_per_char, 0.15), rate_func=linear)


def type_diff(block: VGroup, seconds_per_char: float = 0.03, only: Sequence[int] | None = None):
    """Shows the panel, then types the lines (all, or the indices in `only`) letter by letter."""
    anims = [FadeIn(block.panel, run_time=0.5)]
    if block.title is not None:
        anims.append(FadeIn(block.title, run_time=0.3))
    seq = []
    bands = list(block.bands)
    bi = 0
    for i, m in enumerate(block.body):
        is_band = m.plain[:1] in ("+", "-")
        if only is not None and i not in only:
            if is_band:
                bi += 1
            continue
        if is_band:
            seq.append(FadeIn(bands[bi], run_time=0.15))
            bi += 1
        seq.append(type_line(m, seconds_per_char))
    return Succession(*anims, *seq)


# ---------------------------------------------------------------------------------------------
# Small glyphs
# ---------------------------------------------------------------------------------------------


def check_mark(color: str = CLEAN, s: float = 0.16) -> VMobject:
    m = VMobject(stroke_color=color, stroke_width=3)
    m.set_points_as_corners([[-s, 0, 0], [-s * 0.3, -s * 0.7, 0], [s, s * 0.8, 0]])
    return m


def cross_mark(color: str = DIRTY, s: float = 0.13) -> VGroup:
    return VGroup(
        Line([-s, -s, 0], [s, s, 0], color=color, stroke_width=3),
        Line([-s, s, 0], [s, -s, 0], color=color, stroke_width=3),
    )


def hatch(width: float, height: float, color: str = GREY, step: float = 0.14, stroke: float = 1.0) -> VGroup:
    """Diagonal hatching clipped to a width × height box centred at the origin."""
    lines = VGroup()
    x0, x1, y0, y1 = -width / 2, width / 2, -height / 2, height / 2
    k = -height
    while k < width:
        a = np.array([x0 + k, y0, 0.0])
        b = np.array([x0 + k + height, y1, 0.0])
        # clip to box
        if a[0] < x0:
            a = np.array([x0, y0 + (x0 - a[0]), 0.0])
        if b[0] > x1:
            b = np.array([x1, y1 - (b[0] - x1), 0.0])
        if b[0] > a[0]:
            lines.add(Line(a, b, color=color, stroke_width=stroke))
        k += step
    return lines
