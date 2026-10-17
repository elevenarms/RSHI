"""S10a Noise (≈8 s): same drill, same genome, two repeats: 0.000 and 0.803."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from manim import *  # noqa: E402,F401,F403
from style import *  # noqa: E402,F401,F403


class Noise(Scene):
    def construct(self):
        ban = banner("NOISE")
        head = heading("Same drill. Same genome. Two repeats.")
        self.play(FadeIn(ban), FadeIn(head), run_time=0.7)
        base_y, H, bw = -1.9, 3.6, 1.1
        base = Line([-6.0, base_y, 0], [-1.6, base_y, 0], color=INK, stroke_width=HAIR)
        b1 = Rectangle(width=bw, height=0.012, stroke_width=0, fill_color=HELD, fill_opacity=1).move_to([-4.7, base_y + 0.006, 0])
        b2 = Rectangle(width=bw, height=0.803 * H, stroke_width=0, fill_color=HELD, fill_opacity=1).move_to([-2.9, base_y + 0.803 * H / 2, 0])
        v1 = mono("0.000", SIZE_BODY, INK, W800).next_to(b1, UP, buff=0.15)
        v2 = mono("0.803", SIZE_BODY, INK, W800).next_to(b2, UP, buff=0.15)
        l1 = mono("repeat 1", SIZE_SMALL - 1, GREY).next_to([-4.7, base_y, 0], DOWN, buff=0.2)
        l2 = mono("repeat 2", SIZE_SMALL - 1, GREY).next_to([-2.9, base_y, 0], DOWN, buff=0.2)
        self.play(Create(base), FadeIn(l1), FadeIn(l2), run_time=0.6)
        self.play(FadeIn(b1), FadeIn(v1), run_time=0.6)
        self.play(GrowFromEdge(b2, DOWN), run_time=1.0, rate_func=EASE)
        self.play(FadeIn(v2), run_time=0.4)
        line = VGroup(mono("A weak model is", SIZE_H1, INK, W800), mono("a noisy witness.", SIZE_H1, INK, W800)).arrange(DOWN, aligned_edge=LEFT, buff=0.15).move_to([-0.6, 0.7, 0], aligned_edge=LEFT)
        foot = VGroup(
            mono("mean repeat-to-repeat difference 0.20 share", SIZE_SMALL - 2, GREY),
            mono("per-drill SD ≈ 0.3", SIZE_SMALL - 2, GREY),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.1).next_to(line, DOWN, buff=0.4).align_to(line, LEFT)
        self.wait(0.4)
        self.play(FadeIn(foot), run_time=0.7)
        self.play(AddTextLetterByLetter(line[0], time_per_char=0.035, run_time=0.6))
        self.play(AddTextLetterByLetter(line[1], time_per_char=0.035, run_time=0.6))
        self.wait(1.8)
