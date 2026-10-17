"""S10b Finding1 (≈11 s): a cup stood mouth up keeps half its grime. Numbers from
docs/crew/insights/INSIGHTS.md (FINDING 1)."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np  # noqa: E402
from manim import *  # noqa: E402,F401,F403
from style import *  # noqa: E402,F401,F403


def cup(up: bool, color=INK) -> VGroup:
    """A small cup in section: open side up or down."""
    w, h = 0.62, 0.72
    pts = [[-w / 2, h / 2, 0], [-w / 2 + 0.06, -h / 2, 0], [w / 2 - 0.06, -h / 2, 0], [w / 2, h / 2, 0]]
    body = VMobject(stroke_color=color, stroke_width=2.2).set_points_as_corners(pts)
    g = VGroup(body)
    if up:
        water = Polygon([-w / 2 + 0.03, 0.12, 0], [-w / 2 + 0.07, -h / 2 + 0.03, 0], [w / 2 - 0.07, -h / 2 + 0.03, 0], [w / 2 - 0.03, 0.12, 0], stroke_width=0, fill_color=GREY, fill_opacity=0.35)
        g.add(water)
    else:
        g.rotate(PI)
    return g


class Finding1(Scene):
    def construct(self):
        ban = banner("FINDING 1")
        t = tag("FINDING").to_corner(UL, buff=SAFE).shift(DOWN * 0.55)
        h1 = mono("Mouth up: 0 of 11 clean.", SIZE_H1, INK, W800)
        h2 = mono("Mouth down: 26 of 26.", SIZE_H1, INK, W800)
        head = VGroup(h1, h2).arrange(DOWN, aligned_edge=LEFT, buff=0.2).next_to(t, DOWN, buff=0.35).align_to(t, LEFT)
        self.play(FadeIn(ban), FadeIn(t), run_time=0.7)
        self.play(AddTextLetterByLetter(h1, time_per_char=0.035, run_time=0.9))
        self.wait(0.5)
        self.play(AddTextLetterByLetter(h2, time_per_char=0.035, run_time=0.8))
        self.wait(0.6)

        # Two stances, two cups, the numbers beside them.
        up = cup(True).move_to([3.3, 1.55, 0])
        dn = cup(False).move_to([5.5, 1.55, 0])
        lu = label("mouth up", SIZE_CAPTION - 2, DIRTY).next_to(up, DOWN, buff=0.2)
        ld = label("mouth down", SIZE_CAPTION - 2, CLEAN).next_to(dn, DOWN, buff=0.2)
        self.play(FadeIn(up), FadeIn(dn), FadeIn(lu), FadeIn(ld), run_time=0.7)

        tbl = data_table(
            ["cups, mugs, glasses, ramekins", "mouth up", "mouth down"],
            [
                ["came out clean", "0/11", "26/26"],
                ["soil left", "49%", "0%"],
                ["water held", "224 ml", "0 ml"],
            ],
            cell_colors={(0, 1): DIRTY, (1, 1): DIRTY, (2, 1): DIRTY, (0, 2): CLEAN, (1, 2): CLEAN, (2, 2): CLEAN},
            col_align=["l", "r", "r"],
            size=SIZE_SMALL,
            col_gap=0.9,
        )
        tbl.move_to([0, -1.25, 0]).align_to(head, LEFT)
        self.play(table_in(tbl, lag=0.25))
        bowls = mono("Bowls mouth up still came out clean, but held 1.17 L of water each.", SIZE_SMALL - 2, INK)
        bowls.next_to(tbl, DOWN, buff=0.35).align_to(tbl, LEFT)
        cap = fig_caption(4, "quantified in simulation · DishwasherBench P01").next_to(bowls, DOWN, buff=0.22).align_to(bowls, LEFT)
        self.play(FadeIn(bowls), run_time=0.7)
        self.play(FadeIn(cap), run_time=0.5)
        self.wait(1.5)
