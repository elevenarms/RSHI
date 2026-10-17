"""S11 Limits (≈13 s): the honest footnotes, set like the bottom of a paper page."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np  # noqa: E402
from manim import *  # noqa: E402,F401,F403
from style import *  # noqa: E402,F401,F403

NOTES = [
    ("1", ["n = 4 · one-sided sign test, 3 of 4: p = 5/16 ≈ 0.31"]),
    ("2", ["a demonstration, not a statistically established effect"]),
    ("3", ["Lightning endpoint throttled to ~5 calls/min → switched loader"]),
    ("4", ["replay bug: a pasta pot blocked the door; scored as invalid;", "corrected after the run; champion lineage unaffected"]),
]


def pot_and_door() -> VGroup:
    door = Rectangle(width=1.15, height=1.7, color=INK, stroke_width=1.6)
    handle = Line([-0.3, 0.62, 0], [0.3, 0.62, 0], color=INK, stroke_width=2.2)
    floor = Line([-1.1, -0.85, 0], [1.0, -0.85, 0], color=GREY, stroke_width=1.0)
    body = RoundedRectangle(corner_radius=0.06, width=0.86, height=0.56, color=INK, stroke_width=1.8, fill_color=PAPER, fill_opacity=1)
    lid = Line([-0.47, 0.34, 0], [0.47, 0.34, 0], color=INK, stroke_width=1.8)
    knob = Line([-0.08, 0.42, 0], [0.08, 0.42, 0], color=INK, stroke_width=2.6)
    h1 = Line([-0.43, 0.16, 0], [-0.58, 0.16, 0], color=INK, stroke_width=1.8)
    h2 = Line([0.43, 0.16, 0], [0.58, 0.16, 0], color=INK, stroke_width=1.8)
    pot = VGroup(body, lid, knob, h1, h2).move_to([-0.45, -0.85 + 0.3, 0])
    return VGroup(VGroup(door, floor), handle, pot)


class Limits(Scene):
    def construct(self):
        ban = banner("LIMITS")
        corner = VGroup(
            mono("46.0% → 63.7%", SIZE_SMALL, INK, W600),
            mono("+17.8 pp", SIZE_SMALL, CLEAN, W800),
        ).arrange(RIGHT, buff=0.3).to_corner(UL, buff=SAFE).shift(DOWN * 0.55)
        big = VGroup(mono("46.0% → 63.7%", SIZE_H1, INK, W600), mono("+17.8 pp", SIZE_H1, CLEAN, W800)).arrange(RIGHT, buff=0.5).move_to(UP * 0.6)
        self.add(ban)
        self.play(FadeIn(big), run_time=0.6)
        self.play(Transform(big, corner), run_time=1.0, rate_func=EASE)

        # The footnotes: a short rule, then the notes in small type.
        x0 = -6.2
        y = 0.45
        sep = Line([x0, y + 0.45, 0], [x0 + 3.0, y + 0.45, 0], color=INK, stroke_width=1.0)
        self.play(Create(sep), run_time=0.6)
        lines = []
        for n, texts in NOTES:
            num = mono(n, SIZE_CAPTION - 3, INK, W600)
            body = VGroup()
            for i, tx in enumerate(texts):
                t = line_text(tx, SIZE_SMALL - 1, INK)
                put(t, x0 + 0.3, y - i * 0.42)
                body.add(t)
            num.move_to([x0 + 0.08, body[0].strut.get_top()[1] - 0.05, 0])
            lines.append(VGroup(num, body))
            y -= 0.42 * len(texts) + 0.32
        for g in lines[:-1]:
            self.play(FadeIn(g[0]), *[type_line(t, 0.018) for t in g[1]], run_time=1.1)
            self.wait(0.35)
        art = pot_and_door().move_to([5.2, lines[-1].get_center()[1] + 0.45, 0])
        g = lines[-1]
        self.play(FadeIn(g[0]), Succession(*[type_line(t, 0.015) for t in g[1]]), FadeIn(art[0]), FadeIn(art[1]), run_time=1.6)
        self.play(FadeIn(art[2], shift=RIGHT * 0.15), run_time=0.7)
        more = mono("one machine, programme and detergent; fast tier · every throttle and bug, with its fix, is in the paper", SIZE_CAPTION - 3, GREY)
        more.to_edge(DOWN, buff=0.4).align_to([x0, 0, 0], LEFT)
        self.play(FadeIn(more), run_time=0.6)
        self.wait(1.5)
