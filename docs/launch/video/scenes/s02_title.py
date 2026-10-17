"""S02 title card (≈4 s): SPARKLETEAM / Towards Recursive Self Home Improvement."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from manim import *  # noqa: E402,F401,F403
from style import *  # noqa: E402,F401,F403


class Title(Scene):
    def construct(self):
        head = mono("SPARKLETEAM", SIZE_HERO + 8, INK, W800)
        sub = mono("Towards Recursive Self Home Improvement", SIZE_BODY + 2, INK, W400)
        line = rule(max(head.width, sub.width), INK, HAIR)
        kicker = label("DishwasherBench · NVIDIA Nemotron · Crusoe", SIZE_CAPTION, GREY, W600)
        group = VGroup(head, line, sub).arrange(DOWN, buff=0.34).move_to(UP * 0.15)
        kicker.next_to(group, DOWN, buff=0.75)
        self.play(AddTextLetterByLetter(head, time_per_char=0.07, run_time=0.9))
        self.play(Create(line, run_time=0.7, rate_func=EASE))
        self.play(FadeIn(sub, shift=UP * 0.08, run_time=0.8))
        self.play(FadeIn(kicker, run_time=0.6))
        self.wait(1.2)
