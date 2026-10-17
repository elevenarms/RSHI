"""S11a Lesson (≈6 s): the fix, three numbered lines."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from manim import *  # noqa: E402,F401,F403
from style import *  # noqa: E402,F401,F403


class Lesson(Scene):
    def construct(self):
        ban = banner("THE FIX")
        head = heading("The fix")
        self.play(FadeIn(ban), FadeIn(head), run_time=0.6)
        items = ["more trials", "a statistical test", "check every rule against physics"]
        rows = []
        for i, txt in enumerate(items):
            n = line_text(f"{i + 1}", SIZE_H2, GREY, W800)
            t = line_text(txt, SIZE_H2, INK, W800)
            y = 0.9 - i * 1.05
            put(n, -4.6, y)
            put(t, -3.8, y)
            rows.append((n, t))
        top = Line([-4.8, 1.55, 0], [4.8, 1.55, 0], color=INK, stroke_width=HAIR)
        self.play(Create(top), run_time=0.5)
        for n, t in rows:
            self.play(FadeIn(n.ink), type_line(t, 0.04), run_time=0.9)
            self.wait(0.25)
        bot = Line([-4.8, 0.9 - 2 * 1.05 - 0.65, 0], [4.8, 0.9 - 2 * 1.05 - 0.65, 0], color=INK, stroke_width=HAIR)
        self.play(Create(bot), run_time=0.5)
        self.wait(1.3)
