"""S01 Hook (≈13 s): a flat performance line across 100 runs; a green line starts to climb."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from manim import *  # noqa: E402,F401,F403
from style import *  # noqa: E402,F401,F403

X0, X1 = -5.4, 5.4
Y0, Y1 = -2.0, 2.0


def ylevel(v: float) -> float:
    return Y0 + v * (Y1 - Y0)


class Hook(Scene):
    def construct(self):
        self.wait(1.0)
        ban = banner()
        x_axis = Line([X0, Y0, 0], [X1, Y0, 0], color=INK, stroke_width=HAIR)
        y_axis = Line([X0, Y0, 0], [X0, Y1, 0], color=INK, stroke_width=HAIR)
        ticks = VGroup(
            Line([X0, Y0, 0], [X0, Y0 - 0.1, 0], color=INK, stroke_width=HAIR),
            Line([X1, Y0, 0], [X1, Y0 - 0.1, 0], color=INK, stroke_width=HAIR),
        )
        t1 = mono("1", SIZE_SMALL, INK).next_to([X0, Y0 - 0.1, 0], DOWN, buff=0.12)
        t100 = mono("100", SIZE_SMALL, INK).next_to([X1, Y0 - 0.1, 0], DOWN, buff=0.12)
        xlab = label("run", SIZE_CAPTION, GREY).next_to(Line([X0, Y0, 0], [X1, Y0, 0]), DOWN, buff=0.3)
        ylab = label("performance", SIZE_CAPTION, GREY).next_to([X0, Y1, 0], UP, buff=0.18).align_to([X0, 0, 0], LEFT)
        self.play(
            FadeIn(ban, run_time=0.8),
            Create(x_axis, run_time=1.0, rate_func=EASE),
            Create(y_axis, run_time=1.0, rate_func=EASE),
            FadeIn(VGroup(ticks, t1, t100, xlab, ylab), run_time=1.0),
        )

        lvl = ylevel(0.40)
        flat = Line([X0, lvl, 0], [X1, lvl, 0], color=INK, stroke_width=2.4)
        run = ValueTracker(1)
        box_anchor = [X1, Y1 + 0.35, 0]

        def place_counter(m):
            m.move_to(box_anchor, aligned_edge=RIGHT)

        cnt = counter(run, lambda v: f"run {int(round(v)):03d}", SIZE_BODY, INK, W600, place_counter)
        self.add(cnt)
        self.play(Create(flat, rate_func=linear), run.animate(rate_func=linear).set_value(100), run_time=4.0)
        self.wait(0.8)

        # A team that improves: a green staircase from the same level, frozen mid-step.
        steps = [(-5.4, 0.40), (-3.6, 0.40), (-3.6, 0.47), (-1.8, 0.47), (-1.8, 0.56), (0.0, 0.56), (0.0, 0.66), (1.4, 0.66), (1.4, 0.71)]
        pts = [[x, ylevel(v), 0] for x, v in steps]
        stair = VMobject(stroke_color=CLEAN, stroke_width=3.2)
        stair.set_points_as_corners(pts)
        tip = Dot(pts[-1], radius=0.06, color=CLEAN)
        self.play(Create(stair, rate_func=linear), run_time=3.2)
        self.add(tip)
        self.play(
            FadeOut(VGroup(x_axis, y_axis, ticks, t1, t100, xlab, ylab, flat, cnt), run_time=1.0),
            VGroup(stair, tip).animate(run_time=1.2, rate_func=EASE).move_to(DOWN * 0.2).scale(1.15),
        )
        self.wait(1.5)
