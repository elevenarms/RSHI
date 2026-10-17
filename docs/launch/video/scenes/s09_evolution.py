"""S09 Evolution (≈11 s) and EvolutionPilot (≈7 s, after the UI insert): six proposals, two
accepted; every structural edit rejected for this loader, while on the Lightning pilot the
Planner was accepted."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np  # noqa: E402
from manim import *  # noqa: E402,F401,F403
from style import *  # noqa: E402,F401,F403

GX = {1: -3.9, 2: -0.9, 3: 2.1}
X_LEFT, X_RIGHT = -5.6, 3.3
SHELF = -2.75


def yv(v):
    return -1.45 + (v - 0.3) / 0.5 * 3.35


# (generation, title, candidate share, accepted, offset)
PROPOSALS = [
    (1, "Enable Planner", 0.363, False, -0.38),
    (1, "Memory brief, expanded*", 0.471, False, 0.38),
    (2, "Enable preflight", 0.334, False, -0.38),
    (2, "Avoid poor bowl placement", 0.695, True, 0.38),
    (3, "Memory brief, focused", 0.327, False, -0.38),
    (3, "Rules for glasses & cutlery", 0.775, True, 0.38),
]
INCUMBENT = {1: 0.449, 2: 0.443, 3: 0.618}
STEPS = [(1, 0.449), (2, 0.695), (3, 0.775)]


class _Chart:
    def __init__(self):
        self.axis_y = Line([X_LEFT, yv(0.3), 0], [X_LEFT, yv(0.82), 0], color=INK, stroke_width=HAIR)
        self.axis_x = Line([X_LEFT, yv(0.3), 0], [X_RIGHT, yv(0.3), 0], color=INK, stroke_width=HAIR)
        self.yt = VGroup()
        for v in (0.4, 0.6, 0.8):
            self.yt.add(Line([X_LEFT - 0.08, yv(v), 0], [X_LEFT, yv(v), 0], color=INK, stroke_width=HAIR))
            self.yt.add(mono(f".{int(v * 10)}", SIZE_CAPTION - 2, GREY).next_to([X_LEFT - 0.08, yv(v), 0], LEFT, buff=0.08))
        self.xt = VGroup(*[mono(f"G{g}", SIZE_SMALL - 2, INK, W600).move_to([x, yv(0.3) - 0.28, 0]) for g, x in GX.items()])
        self.ylab = label("validation share", SIZE_CAPTION - 3, GREY).next_to(self.axis_y, UP, buff=0.12).align_to(self.axis_y, LEFT)
        self.shelf = DashedLine([X_LEFT, SHELF, 0], [6.5, SHELF, 0], color=GREY, stroke_width=1.0, dash_length=0.06)
        self.shelf_lab = label("rejected", SIZE_CAPTION - 3, DIRTY).next_to([X_LEFT, SHELF, 0], UP, buff=0.08).align_to([X_LEFT, 0, 0], LEFT)
        self.frame = VGroup(self.axis_y, self.axis_x, self.yt, self.xt, self.ylab, self.shelf, self.shelf_lab)
        # Staircase of the incumbent.
        x0, x1 = GX[1] - 0.95, GX[3] + 0.95
        pts = [[x0, yv(0.449), 0], [GX[2], yv(0.449), 0], [GX[2], yv(0.695), 0], [GX[3], yv(0.695), 0], [GX[3], yv(0.775), 0], [x1, yv(0.775), 0]]
        self.segs = [Line(pts[i], pts[i + 1], color=INK, stroke_width=2.6) for i in range(len(pts) - 1)]
        self.step_vals = VGroup(
            mono(".449", SIZE_CAPTION - 1, INK).next_to(pts[0], UP, buff=0.08).align_to([x0, 0, 0], LEFT),
            mono(".695", SIZE_CAPTION - 1, CLEAN, W600).next_to(pts[2], LEFT, buff=0.1).shift(DOWN * 0.12),
            mono(".775", SIZE_CAPTION - 1, CLEAN, W600).next_to(pts[4], LEFT, buff=0.1).shift(DOWN * 0.12),
        )
        self.dots, self.titles, self.shelf_pos = [], [], []
        k = 0
        sx = X_LEFT + 0.25
        for g, title, v, acc, off in PROPOSALS:
            d = Dot([GX[g] + off, yv(v), 0], radius=0.085, color=INK)
            t = mono(title, SIZE_CAPTION - 2, INK)
            t.next_to(d, RIGHT if off > 0 else LEFT, buff=0.1)
            self.dots.append(d)
            self.titles.append(t)
            if not acc:
                self.shelf_pos.append(np.array([sx, SHELF - 0.3, 0]))
                sx += 0.3 + mono(title, SIZE_CAPTION - 2).width + 0.45
                k += 1
            else:
                self.shelf_pos.append(None)
        self.rules = VGroup(
            mono("glasses: mouth-down", SIZE_SMALL - 2, CLEAN, W600),
            mono("cutlery: upright", SIZE_SMALL - 2, CLEAN, W600),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.1).next_to([x1, yv(0.775), 0], RIGHT, buff=0.3).shift(DOWN * 0.15)
        self.foot = mono("validation share; fresh seeds each generation · * accepted at +0.129 under the corrected replay rule", SIZE_CAPTION - 3, GREY)
        self.foot.to_edge(DOWN, buff=0.25).align_to([X_LEFT, 0, 0], LEFT)

    def shelved(self, i):
        """Dot and struck title as they sit on the rejected shelf."""
        d = self.dots[i].copy().set_color(DIRTY).move_to(self.shelf_pos[i])
        t = mono(PROPOSALS[i][1], SIZE_CAPTION - 2, GREY).next_to(d, RIGHT, buff=0.1)
        strike = Line(t.get_left(), t.get_right(), color=DIRTY, stroke_width=1.2)
        return d, VGroup(t, strike)

    def final(self):
        g = VGroup(self.frame, *self.segs, self.step_vals, self.rules, self.foot)
        for i, p in enumerate(PROPOSALS):
            if p[3]:
                g.add(self.dots[i].copy().set_color(CLEAN))
            else:
                d, t = self.shelved(i)
                g.add(d, t)
        return g


class Evolution(Scene):
    def construct(self):
        ban = banner("EVOLUTION")
        head = heading("Six proposals. Two accepted.")
        c = _Chart()
        self.play(FadeIn(ban), FadeIn(head), run_time=0.7)
        self.play(Create(c.axis_y), Create(c.axis_x), FadeIn(c.yt), FadeIn(c.xt), FadeIn(c.ylab), Create(c.shelf), FadeIn(c.shelf_lab), FadeIn(c.foot), run_time=0.9)
        self.play(Create(c.segs[0]), FadeIn(c.step_vals[0]), run_time=0.6)
        for g in (1, 2, 3):
            idx = [i for i, p in enumerate(PROPOSALS) if p[0] == g]
            self.play(*[FadeIn(c.dots[i], scale=0.8) for i in idx], *[FadeIn(c.titles[i]) for i in idx], run_time=0.5)
            anims = []
            for i in idx:
                if PROPOSALS[i][3]:
                    anims.append(c.dots[i].animate.set_color(CLEAN))
                    anims.append(c.titles[i].animate.set_color(CLEAN))
                else:
                    anims.append(c.dots[i].animate.set_color(DIRTY))
            self.play(*anims, run_time=0.4)
            moves = []
            for i in idx:
                if not PROPOSALS[i][3]:
                    d, t = c.shelved(i)
                    moves.append(Transform(c.dots[i], d))
                    moves.append(FadeOut(c.titles[i], run_time=0.3))
                    moves.append(FadeIn(t))
            seg_anims = []
            if g == 1:
                seg_anims = [Wait(0.1)]
            elif g == 2:
                seg_anims = [Create(c.segs[1]), AnimationGroup(Create(c.segs[2]), FadeIn(c.step_vals[1]))]
            else:
                seg_anims = [Create(c.segs[3]), AnimationGroup(Create(c.segs[4]), FadeIn(c.step_vals[2]))]
            self.play(*moves, Succession(*seg_anims), run_time=0.9, rate_func=EASE)
            acc = [i for i in idx if PROPOSALS[i][3]]
            if acc:
                self.play(FadeOut(c.titles[acc[0]]), run_time=0.3)
        self.play(AddTextLetterByLetter(c.rules[0], time_per_char=0.03), run_time=0.6)
        self.play(AddTextLetterByLetter(c.rules[1], time_per_char=0.03), run_time=0.5)
        self.wait(1.0)


class EvolutionPilot(Scene):
    def construct(self):
        ban = banner("EVOLUTION")
        head = heading("Six proposals. Two accepted.")
        c = _Chart()
        main = c.final()
        self.add(ban, head, main)
        self.wait(0.3)
        # The Lightning pilot: a faint half-size ghost of G1.
        gx0, gy0 = 3.7, -0.1
        gw, gh = 2.8, 1.9
        frame = VGroup(
            Line([gx0, gy0, 0], [gx0 + gw, gy0, 0], color=GREY, stroke_width=1.0),
            Line([gx0, gy0, 0], [gx0, gy0 + gh, 0], color=GREY, stroke_width=1.0),
        )
        t = mono("Lightning pilot, G1", SIZE_CAPTION - 1, GREY, W600).next_to(frame, UP, buff=0.12).align_to(frame, LEFT)
        inc = Line([gx0 + 0.2, gy0 + 0.8, 0], [gx0 + gw - 0.2, gy0 + 0.8, 0], color=GREY, stroke_width=2)
        p_dot = Dot([gx0 + 0.9, gy0 + 0.8 + 0.135 * 4, 0], radius=0.075, color=CLEAN)
        p_lab = mono("Planner +0.135", SIZE_CAPTION - 2, CLEAN, W600).next_to(p_dot, UP, buff=0.08)
        r_dot = Dot([gx0 + 1.9, gy0 + 0.8 - 0.095 * 4, 0], radius=0.075, color=DIRTY)
        r_lab = mono("bowl rule −0.095", SIZE_CAPTION - 3, DIRTY).next_to(r_dot, DOWN, buff=0.08)
        ghost = VGroup(frame, t, inc, p_dot, p_lab, r_dot, r_lab)
        self.play(FadeOut(c.rules), run_time=0.4)
        self.play(FadeIn(ghost, shift=LEFT * 0.8), run_time=1.0, rate_func=EASE)
        # Connect the two Planner dots: rejected here, accepted on the pilot.
        planner_shelf = c.shelved(0)[0]
        link = DashedLine(planner_shelf.get_center(), p_dot.get_center(), color=GREY, stroke_width=1.2, dash_length=0.07)
        self.play(Create(link), run_time=1.0, rate_func=EASE)
        note = VGroup(mono("the right scaffold is", SIZE_SMALL - 2, INK, W600), mono("measured, not assumed", SIZE_SMALL - 2, INK, W600)).arrange(DOWN, aligned_edge=LEFT, buff=0.1).next_to(ghost, DOWN, buff=0.4).align_to(ghost, LEFT)
        self.play(FadeIn(note), run_time=0.8)
        self.wait(1.6)
