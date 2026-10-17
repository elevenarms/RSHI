"""S03 BenchmarkPhysics (≈8.5 s): you can't sweet-talk physics. A schematic of the lower spray
arm from above: jets fan out, one corner is a dead spot; the bowl there stays dirty however
eloquently it is described."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np  # noqa: E402
from manim import *  # noqa: E402,F401,F403
from style import *  # noqa: E402,F401,F403

C = np.array([-3.2, -0.65, 0.0])  # tub centre
S = 4.4  # tub side


def plate(r=0.32):
    return VGroup(Circle(radius=r, color=INK, stroke_width=1.6), Circle(radius=r * 0.62, color=INK, stroke_width=1.0))


def bowl(r=0.3):
    return VGroup(Circle(radius=r, color=INK, stroke_width=1.6), Circle(radius=r * 0.45, color=INK, stroke_width=1.0), Dot(radius=0.035, color=INK))


class BenchmarkPhysics(Scene):
    def construct(self):
        ban = banner("BENCHMARK")
        head = heading("You can't sweet-talk physics")
        tub = Square(side_length=S, color=INK, stroke_width=STROKE).move_to(C)
        cap = fig_caption(1, "lower spray arm from above (schematic); hatched: a dead spot").next_to(tub, DOWN, buff=0.22).align_to(tub, LEFT)

        # Dead spot: top-left corner of the tub.
        ds_w, ds_h = 1.3, 1.3
        dead_box = Square(side_length=ds_w, color=GREY, stroke_width=1.0).move_to(C + np.array([-S / 2 + ds_w / 2, S / 2 - ds_h / 2, 0]))
        dead_hatch = hatch(ds_w, ds_h, GREY, 0.13, 0.9).move_to(dead_box)
        dead_lab = label("dead spot", SIZE_CAPTION - 3, GREY).next_to(dead_box, DOWN, buff=0.08).align_to(dead_box, LEFT).shift(RIGHT * 0.06)

        # The arm and its jets (jets avoid the dead-spot direction).
        arm = VGroup(
            RoundedRectangle(corner_radius=0.08, width=2.8, height=0.18, color=INK, stroke_width=1.6, fill_color=PAPER, fill_opacity=1),
            Circle(radius=0.16, color=INK, stroke_width=1.6, fill_color=PAPER, fill_opacity=1),
        ).move_to(C)
        jets = VGroup()
        for ang in np.linspace(-150, 150, 17):
            a = np.deg2rad(ang - 45)  # skip the 135° (top-left) direction
            d = np.array([np.cos(a), np.sin(a), 0])
            if np.dot(d, np.array([-1, 1, 0]) / np.sqrt(2)) > 0.86:
                continue
            jets.add(Line(C + d * 0.3, C + d * 1.8, color=GREY, stroke_width=1.0))

        # Items: plates and a bowl in the dead spot.
        others = [plate().move_to(C + np.array(p)) for p in [(1.3, 1.25, 0), (1.3, -1.3, 0), (-1.3, -1.3, 0), (0.0, -1.6, 0), (1.6, 0.0, 0)]]
        target = bowl().move_to(dead_box)

        # The speech bubble.
        words = VGroup(
            mono("This bowl has been placed", SIZE_SMALL - 1, GREY),
            mono("with exceptional care. Its", SIZE_SMALL - 1, GREY),
            mono("orientation reflects a deep", SIZE_SMALL - 1, GREY),
            mono("understanding of fluid flow,", SIZE_SMALL - 1, GREY),
            mono("and it will certainly be…", SIZE_SMALL - 1, GREY),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.1)
        bub = RoundedRectangle(corner_radius=0.14, width=words.width + 0.5, height=words.height + 0.42, color=GREY, stroke_width=1.2)
        bubble = VGroup(bub, words)
        bubble.move_to([0, target.get_center()[1], 0]).align_to([0.3, 0, 0], LEFT)
        words.move_to(bub)
        tail = Line(target.get_right() + RIGHT * 0.08, bub.get_left(), color=GREY, stroke_width=1.0)
        bubble_all = VGroup(tail, bub, words)

        num = mono("points(clean items)", SIZE_SMALL + 1, INK, W600)
        den = mono("points available", SIZE_SMALL + 1, INK, W600)
        bar = Line(LEFT, RIGHT, color=INK, stroke_width=1.6).set_width(num.width + 0.2)
        frac = VGroup(num, bar, den).arrange(DOWN, buff=0.16)
        lhs = mono("score =", SIZE_SMALL + 1, INK, W600).next_to(bar, LEFT, buff=0.25)
        formula = VGroup(lhs, frac).move_to([3.4, -1.25, 0])
        fl = bar
        foot = label("objective · deterministic · unfakeable", SIZE_CAPTION - 1, GREY).next_to(formula, DOWN, buff=0.5).set_x(formula.get_x())

        self.play(FadeIn(ban), FadeIn(head), Create(tub, rate_func=EASE), run_time=0.9)
        self.play(FadeIn(arm), LaggedStart(*[Create(j) for j in jets], lag_ratio=0.05), FadeIn(dead_hatch), Create(dead_box), FadeIn(dead_lab), FadeIn(cap), run_time=1.0)
        self.play(LaggedStart(*[FadeIn(o) for o in others + [target]], lag_ratio=0.1), run_time=0.7)
        self.play(Create(tail), FadeIn(bub), AddTextLetterByLetter(words, time_per_char=0.012, run_time=1.2))
        sweep = arm
        self.play(Rotate(sweep, angle=2 * PI, about_point=C, rate_func=EASE), run_time=1.6)
        ticks = [check_mark().scale(0.9).move_to(o) for o in others]
        self.play(
            *[o.animate.set_stroke(CLEAN) for o in others],
            *[FadeIn(t) for t in ticks],
            target.animate.set_stroke(DIRTY).set_fill(DIRTY, opacity=0),
            run_time=0.6,
        )
        self.play(target[2].animate.set_color(DIRTY), bubble_all.animate.scale(0.01, about_point=tail.get_start()), run_time=0.7, rate_func=EASE)
        self.remove(bubble_all)
        self.play(FadeIn(lhs, run_time=0.5), AddTextLetterByLetter(num, time_per_char=0.03, run_time=0.7))
        self.play(Create(bar, run_time=0.4), AddTextLetterByLetter(den, time_per_char=0.03, run_time=0.6))
        self.play(FadeIn(foot), run_time=0.6)
        self.wait(1.0)
