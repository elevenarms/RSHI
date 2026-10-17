"""S10 ExamRule (≈2 s) and Exam (≈9 s): held-out levels 5–7, four drills, 46.0% → 63.7%."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np  # noqa: E402
from manim import *  # noqa: E402,F401,F403
from style import *  # noqa: E402,F401,F403

# drill, points available, G0 points, champion points, delta (pp, as reported)
DRILLS = [
    ("Family #0", 59, 48, 42, "−10.2"),
    ("Baking #1", 71, 28, 63, "+49.3"),
    ("Party #2", 77, 15, 32, "+22.1"),
    ("Family #3", 71, 31, 38, "+9.9"),
]
BASE = -1.35
H = 2.9
XS = [-5.45, -3.75, -2.05, -0.35]
BW = 0.42


class ExamRule(Scene):
    def construct(self):
        line = Line([-6.5, 0.0, 0], [6.5, 0.0, 0], color=HELD, stroke_width=3)
        t = label("held-out · levels 5–7 · never seen in training", SIZE_SMALL, HELD, W800)
        t.next_to(line, UP, buff=0.25).align_to(line, LEFT)
        self.play(Create(line), run_time=0.8, rate_func=EASE)
        self.play(FadeIn(t, shift=UP * 0.05), run_time=0.6)
        self.wait(0.8)


class Exam(Scene):
    def construct(self):
        ban = banner("THE EXAM")
        t = tag("EXAM").to_corner(UL, buff=SAFE).shift(DOWN * 0.6)
        head = mono("Four drills it had never seen", SIZE_H2, INK, W800).next_to(t, RIGHT, buff=0.3)
        amber = Line([-6.5, 2.1, 0], [6.5, 2.1, 0], color=HELD, stroke_width=2)
        self.play(FadeIn(ban), FadeIn(t), FadeIn(head), Create(amber), run_time=0.8)

        base = Line([XS[0] - 0.8, BASE, 0], [XS[-1] + 0.8, BASE, 0], color=INK, stroke_width=HAIR)
        names = VGroup(*[mono(d[0], SIZE_CAPTION - 1, INK, W600).move_to([x, BASE - 0.28, 0]) for d, x in zip(DRILLS, XS)])
        leg = VGroup(
            VGroup(Square(0.16, color=HELD, stroke_width=2, fill_opacity=0), mono("G0 baseline", SIZE_CAPTION - 2, INK)).arrange(RIGHT, buff=0.1),
            VGroup(Square(0.16, stroke_width=0, fill_color=HELD, fill_opacity=1), mono("champion G2-704108", SIZE_CAPTION - 2, INK)).arrange(RIGHT, buff=0.1),
        ).arrange(RIGHT, buff=0.4).next_to(names, DOWN, buff=0.3).align_to(base, LEFT)
        pairs, deltas = VGroup(), VGroup()
        for (name, avail, g0, ch, d), x in zip(DRILLS, XS):
            a, b = g0 / avail, ch / avail
            r1 = Rectangle(width=BW, height=a * H, color=HELD, stroke_width=2, fill_opacity=0).move_to([x - BW / 2 - 0.03, BASE + a * H / 2, 0])
            r2 = Rectangle(width=BW, height=b * H, stroke_width=0, fill_color=HELD, fill_opacity=1).move_to([x + BW / 2 + 0.03, BASE + b * H / 2, 0])
            pairs.add(VGroup(r1, r2))
            dl = mono(d, SIZE_SMALL - 1, DIRTY if d.startswith("−") else CLEAN, W800)
            dl.move_to([x, BASE + max(a, b) * H + 0.3, 0])
            deltas.add(dl)
        self.play(Create(base), FadeIn(names), FadeIn(leg), run_time=0.5)
        self.play(LaggedStart(*[AnimationGroup(GrowFromEdge(p[0], DOWN), GrowFromEdge(p[1], DOWN)) for p in pairs], lag_ratio=0.15), run_time=1.0, rate_func=EASE)
        self.play(LaggedStart(*[FadeIn(d, shift=UP * 0.06) for d in deltas], lag_ratio=0.15), run_time=0.5)

        # The first exam's mean.
        x0 = 0.95
        first = mono("first exam · 4 drills", SIZE_CAPTION - 1, HELD, W800).move_to([x0, 1.85, 0], aligned_edge=LEFT)
        m1 = mono("46.0% → 63.7%", SIZE_H2, INK, W600).move_to([x0, 1.3, 0], aligned_edge=LEFT)
        gain = mono("+17.8 pp", SIZE_HERO, CLEAN, W800).move_to([x0, 0.45, 0], aligned_edge=LEFT)
        self.play(FadeIn(first), FadeIn(m1), run_time=0.6)
        self.play(FadeIn(gain, shift=UP * 0.08), run_time=0.7)
        self.wait(0.9)

        # The replication flattens it.
        strike = Line(gain.get_left() + LEFT * 0.08, gain.get_right() + RIGHT * 0.08, color=INK, stroke_width=4)
        self.play(gain.animate.set_color(GREY).set_opacity(0.6), m1.animate.set_color(GREY), first.animate.set_opacity(0.6), Create(strike), run_time=0.8)
        rep = VGroup(mono("replication", SIZE_CAPTION - 1, HELD, W800), mono("12 held-out drills × 2 repeats · 23 pairs", SIZE_CAPTION - 1, HELD, W600)).arrange(DOWN, aligned_edge=LEFT, buff=0.06).move_to([x0, -0.55, 0], aligned_edge=LEFT)
        m2 = mono("46.0% → 45.7%", SIZE_H2, INK, W600).move_to([x0, -1.25, 0], aligned_edge=LEFT)
        d2 = mono("Δ −0.3 pp", SIZE_H1 + 10, INK, W800).move_to([x0, -2.0, 0], aligned_edge=LEFT)
        ci = mono("95% CI −13 to +12 · p = 0.66", SIZE_SMALL - 1, INK).next_to(d2, DOWN, buff=0.18).align_to(d2, LEFT)
        self.play(FadeIn(rep), FadeIn(m2), run_time=0.7)
        self.play(FadeIn(d2, shift=UP * 0.06), run_time=0.7)
        self.play(FadeIn(ci), run_time=0.5)
        self.wait(1.6)
