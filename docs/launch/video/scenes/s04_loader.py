"""S04 WeakLoader (≈12 s): the loader is deliberately weak. What it loads comes out clean; it
runs out of turns. 39 %."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np  # noqa: E402
from manim import *  # noqa: E402,F401,F403
from style import *  # noqa: E402,F401,F403

LOADER_POS = np.array([-3.9, 1.35, 0])


def loader_node() -> Node:
    return Node("Loader", "Nemotron-3.5-Super-VL · thinking off", ROLE["loader"], width=3.0).move_to(LOADER_POS)


def item_icon(kind: int) -> VMobject:
    if kind == 0:
        return VGroup(Circle(radius=0.22, color=INK, stroke_width=1.5), Circle(radius=0.13, color=INK, stroke_width=1.0))
    if kind == 1:
        return RoundedRectangle(corner_radius=0.05, width=0.24, height=0.42, color=INK, stroke_width=1.5)
    return VGroup(Circle(radius=0.2, color=INK, stroke_width=1.5), Dot(radius=0.04, color=INK))


class WeakLoader(Scene):
    def construct(self):
        ban = banner("THE PLAYER")
        node = loader_node()

        # Turn meter: 40 squares, two rows of 20.
        sq, gap = 0.17, 0.07
        squares = VGroup()
        for i in range(40):
            r, c = divmod(i, 20)
            s = Square(side_length=sq, color=INK, stroke_width=1.0, fill_color=INK, fill_opacity=0)
            s.move_to([0.1 + c * (sq + gap), 1.62 - r * (sq + gap), 0])
            squares.add(s)
        turns = ValueTracker(0)
        meter_lab = always_redraw(
            lambda: mono(f"turns {int(round(turns.get_value())):02d}/40", SIZE_SMALL, DIRTY if turns.get_value() >= 39.5 else INK, W600).next_to(squares, UP, buff=0.18).align_to(squares, LEFT)
        )

        def filled_squares():
            k = turns.get_value()
            col = DIRTY if k >= 39.5 else INK
            g = VGroup()
            for i in range(int(round(k))):
                s = Square(side_length=sq, stroke_width=0, fill_color=col, fill_opacity=1).move_to(squares[i])
                g.add(s)
            return g

        fills = always_redraw(filled_squares)

        # The rack (left) and the counter of waiting items (right).
        rack = Rectangle(width=4.6, height=1.5, color=INK, stroke_width=STROKE).move_to([-3.9, -1.5, 0])
        tines = VGroup(*[Line([x, -2.25, 0], [x, -1.95, 0], color=GREY, stroke_width=1.0) for x in np.linspace(-6.0, -1.8, 15)])
        rack_lab = label("rack", SIZE_CAPTION - 1, GREY).next_to(rack, DOWN, buff=0.12).align_to(rack, LEFT)
        bench = Line([0.0, -2.25, 0], [6.4, -2.25, 0], color=INK, stroke_width=HAIR)
        bench_lab = label("counter", SIZE_CAPTION - 1, GREY).next_to(bench, DOWN, buff=0.12).align_to(bench, LEFT)
        kinds = [0, 1, 2, 0, 1, 0, 2, 1, 0, 2, 1, 0]
        items = [item_icon(k) for k in kinds]
        for i, it in enumerate(items):
            it.move_to([0.35 + i * 0.52, -1.95 + (0.04 if kinds[i] != 1 else 0.06), 0])
            it.align_to([0, -2.2, 0], DOWN)
        slots = [np.array([-5.4, -1.5, 0]), np.array([-4.3, -1.5, 0]), np.array([-3.2, -1.5, 0])]

        self.play(FadeIn(ban), FadeIn(node, scale=0.97), run_time=0.9)
        self.add(meter_lab, fills)
        self.play(
            LaggedStart(*[FadeIn(s) for s in squares], lag_ratio=0.01),
            Create(rack), FadeIn(tines), FadeIn(rack_lab), Create(bench), FadeIn(bench_lab),
            LaggedStart(*[FadeIn(it) for it in items], lag_ratio=0.05),
            run_time=1.2,
        )
        moves = [(12, 3), (24, 4), (36, 9)]
        for n, (b, idx) in enumerate(moves):
            it = items[idx]
            self.play(turns.animate(rate_func=linear).set_value(b - 8), run_time=0.7)
            self.play(
                turns.animate(rate_func=linear).set_value(b),
                it.animate(rate_func=EASE).move_to(slots[n]).set_color(CLEAN),
                run_time=1.2,
            )
        self.play(turns.animate(rate_func=linear).set_value(40), run_time=0.6)
        waiting = [it for i, it in enumerate(items) if i not in (3, 4, 9)]
        self.play(*[it.animate.set_stroke(GREY, opacity=0.6) for it in waiting], run_time=0.7)

        share = ValueTracker(0)
        big = counter(share, lambda v: f"{int(round(v))}%", SIZE_HERO * 2, INK, W800, lambda m: m.move_to([0.0, 0.2, 0], aligned_edge=LEFT))
        self.add(big)
        self.play(share.animate(rate_func=EASE).set_value(39), run_time=1.4)
        sub = mono("G0 practice mean share", SIZE_SMALL, GREY).next_to(big, DOWN, buff=0.12).align_to(big, LEFT)
        detail = mono("Breakfast 56 · Tutorial 44 · Weeknight 32 · Lunch 24", SIZE_CAPTION, GREY).next_to(sub, DOWN, buff=0.1).align_to(sub, LEFT)
        self.play(FadeIn(sub, shift=UP * 0.05), run_time=0.6)
        self.play(FadeIn(detail), run_time=0.6)
        self.wait(1.4)
