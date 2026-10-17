"""S12 Outro (≈6 s): title, authors, event, repository, thanks."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from manim import *  # noqa: E402,F401,F403
from style import *  # noqa: E402,F401,F403


class Outro(Scene):
    def construct(self):
        head = mono("SPARKLETEAM", SIZE_HERO + 8, INK, W800)
        sub = mono("Towards Recursive Self Home Improvement", SIZE_BODY + 2, INK)
        line = rule(max(head.width, sub.width), INK, HAIR)
        tagline = mono("Self-improvement that knows when it's fooling itself.", SIZE_BODY - 2, INK, W600)
        block = VGroup(head, line, sub).arrange(DOWN, buff=0.32).move_to(UP * 1.35)
        tagline.next_to(block, DOWN, buff=0.4)
        info = VGroup(
            mono("Dave Rauchwerk (@_elevenarms) · Claude (Anthropic)", SIZE_SMALL, GREY),
            mono("Crusoe × Cerebral Valley Recursive Agents Hackathon · 17 Oct 2026", SIZE_SMALL, GREY),
            mono("github.com/elevenarms/RSHI", SIZE_SMALL + 1, INK, W600),
        ).arrange(DOWN, buff=0.16).next_to(tagline, DOWN, buff=0.5)
        thanks = mono("Thanks: Composo (DishwasherBench), Crusoe, NVIDIA Nemotron", SIZE_CAPTION - 1, GREY).to_edge(DOWN, buff=0.55)
        self.play(AddTextLetterByLetter(head, time_per_char=0.07, run_time=0.9))
        self.play(Create(line, run_time=0.6), FadeIn(sub, shift=UP * 0.06, run_time=0.8))
        self.play(FadeIn(tagline, shift=UP * 0.05), run_time=0.7)
        self.play(LaggedStart(*[FadeIn(i) for i in info], lag_ratio=0.3), run_time=1.0)
        self.play(FadeIn(thanks), run_time=0.6)
        self.wait(1.8)
