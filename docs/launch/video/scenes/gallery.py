"""Helper gallery: every style.py component, for checking the look after edits. Not in the cut."""

import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from manim import *  # noqa: F401,F403
from style import *  # noqa: F401,F403


class Gallery(Scene):
    def construct(self):
        self.add(banner("METHOD"))
        t = data_table(
            ["genome", "val score", "failures", "verdict"],
            [["gen0", "61.2", "3", "incumbent"], ["gen1-a", "64.9", "2", "accepted"], ["gen1-b", "58.0", "5", "rejected"]],
            cell_colors={(1, 3): CLEAN, (2, 3): DIRTY},
        ).shift(LEFT * 3.3 + UP * 1.2)
        d = diff_block(["@@ playbook", "  bowls: lower rack, inverted", "- glasses: anywhere", "+ R2.1  Glasses and tumblers: upper_rack, mouth_down"], title="genome G2-704108").scale(0.8).shift(RIGHT * 3.2 + UP * 1.2)
        b = bar_comparison(["G0", "champion"], [46.0, 63.7], [HELD, HELD], vmax=100, unit="%", outline=True, width=4).shift(DOWN * 1.8 + LEFT * 3)
        g = TeamGraph({"a": Node("Gatekeeper", "deterministic statistics", square=True, filled=True), "b": ("Critic", "Nano-Omni-30B", ROLE["critic"], (4, -2))}, [("a", "b")])
        g.nodes["a"].move_to([0.5, -2, 0]); g.remove(*g.edges.values()); g.edges[("a","b")] = g.make_edge("a","b"); g.add(g.edges[("a","b")])
        tg = tag("FINDING").to_corner(DL, buff=0.6)
        cap = fig_caption(3, "the exam, held-out levels 5–7").next_to(tg, RIGHT, buff=0.4)
        self.add(t, d, b, g, tg, cap)
        self.wait(0.2)
