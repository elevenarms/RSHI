"""S08 Gatekeeper (≈15 s): paired comparison on the same fresh drills, same seeds; accept only if
the mean paired difference clears δ = 0.03. Real decisions of the run (generation 2)."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np  # noqa: E402
from manim import *  # noqa: E402,F401,F403
from style import *  # noqa: E402,F401,F403

DRILLS = ["Tutorial", "Lunch", "Weeknight"]
BOWL = ([0.53125, 0.432432, 0.364865], [0.81251, 0.675676, 0.594595], "+0.251", 0.251, "Avoid poor bowl placement")
PREFLIGHT = ([0.53125, 0.432432, 0.364865], [0.71875, 0.0, 0.283784], "−0.109", -0.109, "Enable preflight check")
BASE = -1.75
HMAX = 3.1
XS = [-5.3, -3.25, -1.2]
BW = 0.5
AX0, AX1 = 1.6, 6.4  # Δ axis, x range
DMIN, DMAX = -0.45, 0.45


def ax(v):
    return AX0 + (v - DMIN) / (DMAX - DMIN) * (AX1 - AX0)


def bars(inc, cand):
    g = VGroup()
    for x, a, b in zip(XS, inc, cand):
        r1 = Rectangle(width=BW, height=max(a * HMAX, 0.005), stroke_width=0, fill_color=GREY, fill_opacity=1).move_to([x - BW / 2 - 0.04, BASE + a * HMAX / 2, 0])
        r2 = Rectangle(width=BW, height=max(b * HMAX, 0.005), stroke_width=0, fill_color=INK, fill_opacity=1).move_to([x + BW / 2 + 0.04, BASE + b * HMAX / 2, 0])
        v1 = mono(f"{a:.3f}".lstrip("0") if a > 0 else "0", SIZE_CAPTION - 2, GREY).next_to(r1, UP, buff=0.07)
        v2 = mono(f"{b:.3f}".lstrip("0") if b > 0 else "0", SIZE_CAPTION - 2, INK).next_to(r2, UP, buff=0.07)
        g.add(VGroup(r1, r2, v1, v2))
    return g


def deltas(inc, cand):
    g = VGroup()
    for x, a, b in zip(XS, inc, cand):
        d = b - a
        t = mono(("+" if d >= 0 else "−") + f"{abs(d):.3f}".lstrip("0"), SIZE_SMALL - 2, CLEAN if d > 0 else DIRTY, W600)
        t.move_to([x, BASE - 1.05, 0])
        g.add(t)
    return g


class Gatekeeper(Scene):
    def construct(self):
        ban = banner("THE GATEKEEPER")
        head = heading("Same drills, same seeds")
        rule_t = mono("accept ⇔ Δ̄ ≥ δ = 0.03", SIZE_BODY - 2, INK, W600).move_to([4.0, 2.05, 0])
        self.play(FadeIn(ban), FadeIn(head), run_time=0.8)

        base = Line([XS[0] - 1.0, BASE, 0], [XS[-1] + 1.0, BASE, 0], color=INK, stroke_width=HAIR)
        names = VGroup()
        for x, n in zip(XS, DRILLS):
            t = mono(n, SIZE_SMALL - 1, INK, W600).move_to([x, BASE - 0.3, 0])
            s = label("same seed", SIZE_CAPTION - 4, GREY).next_to(t, DOWN, buff=0.08)
            names.add(VGroup(t, s))
        leg_i = VGroup(Square(0.16, stroke_width=0, fill_color=GREY, fill_opacity=1), mono("incumbent G0-fc671e", SIZE_CAPTION - 1, GREY)).arrange(RIGHT, buff=0.12)
        cand_name = mono("candidate: " + BOWL[4], SIZE_CAPTION - 1, INK)
        leg_c = VGroup(Square(0.16, stroke_width=0, fill_color=INK, fill_opacity=1), cand_name).arrange(RIGHT, buff=0.12)
        legend = VGroup(leg_i, leg_c).arrange(DOWN, aligned_edge=LEFT, buff=0.1).move_to([-3.25, 2.0, 0]).align_to([XS[0] - 1.0, 0, 0], LEFT)
        self.play(Create(base), LaggedStart(*[FadeIn(n) for n in names], lag_ratio=0.2), FadeIn(legend), run_time=1.0)

        b = bars(BOWL[0], BOWL[1])
        self.play(LaggedStart(*[AnimationGroup(GrowFromEdge(p[0], DOWN), GrowFromEdge(p[1], DOWN)) for p in b], lag_ratio=0.2), run_time=1.3, rate_func=EASE)
        self.play(FadeIn(VGroup(*[VGroup(p[2], p[3]) for p in b])), run_time=0.4)

        # Paired differences drop below.
        d = deltas(BOWL[0], BOWL[1])
        self.play(LaggedStart(*[FadeIn(t, shift=DOWN * 0.2) for t in d], lag_ratio=0.15), run_time=0.8)

        # The Δ axis and the threshold.
        ay = -0.2
        axis = Line([AX0, ay, 0], [AX1, ay, 0], color=INK, stroke_width=HAIR)
        zero = Line([ax(0), ay - 0.08, 0], [ax(0), ay + 0.08, 0], color=INK, stroke_width=HAIR)
        z_lab = mono("0", SIZE_CAPTION - 2, GREY).next_to(zero, DOWN, buff=0.08)
        thr = DashedLine([ax(0.03), ay - 0.25, 0], [ax(0.03), ay + 0.85, 0], color=INK, stroke_width=1.2, dash_length=0.06)
        thr_lab = mono("δ = 0.03", SIZE_CAPTION - 1, INK).next_to(thr, UP, buff=0.08)
        ax_lab = mono("mean paired difference Δ̄", SIZE_CAPTION - 1, GREY).next_to(axis, DOWN, buff=0.45)
        self.play(FadeIn(rule_t), Create(axis), FadeIn(zero), FadeIn(z_lab), Create(thr), FadeIn(thr_lab), FadeIn(ax_lab), run_time=0.9)

        def verdict(spec, accept):
            col = CLEAN if accept else DIRTY
            dot = Dot([ax(0), ay, 0], radius=0.1, color=INK)
            mean = mono("Δ̄ = " + spec[2], SIZE_BODY, col, W800)
            self.play(FadeIn(dot), *[t.animate.move_to([ax(0), ay + 0.55, 0]).set_opacity(0) for t in d.copy()], run_time=0.6)
            self.play(dot.animate(rate_func=EASE).move_to([ax(spec[3]), ay, 0]).set_color(col), run_time=0.9)
            mean.move_to([4.0, 1.25, 0])
            stamp = tag("ACCEPT" if accept else "REJECT", SIZE_SMALL, fill=col)
            stamp.next_to(dot, DOWN, buff=0.75)
            self.play(FadeIn(mean, shift=UP * 0.05), thr.animate.set_color(col), run_time=0.5)
            self.play(FadeIn(stamp, scale=1.0), run_time=0.4)
            return VGroup(dot, mean, stamp)

        v1 = verdict(BOWL, True)
        self.wait(1.2)

        # Quick replay: the preflight edit.
        b2 = bars(PREFLIGHT[0], PREFLIGHT[1])
        d2 = deltas(PREFLIGHT[0], PREFLIGHT[1])
        new_name = mono("candidate: " + PREFLIGHT[4], SIZE_CAPTION - 1, INK).move_to(cand_name, aligned_edge=LEFT)
        self.play(FadeOut(v1), thr.animate.set_color(INK), Transform(b, b2), Transform(d, d2), Transform(cand_name, new_name), run_time=0.9)
        self.wait(0.2)
        v2 = verdict(PREFLIGHT, False)
        foot = mono("void if fewer than 3 paired drills · generation 2 of the run", SIZE_CAPTION - 1, GREY).to_edge(DOWN, buff=0.35).align_to([XS[0] - 1.0, 0, 0], LEFT)
        self.play(FadeIn(foot), run_time=0.6)
        self.wait(1.2)
