"""S11b Next (≈8 s): discover → verify → consolidate, with LoRA SFT on Crusoe."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np  # noqa: E402
from manim import *  # noqa: E402,F401,F403
from style import *  # noqa: E402,F401,F403


class Next(Scene):
    def construct(self):
        ban = banner("NEXT")
        t = tag("NEXT").to_corner(UL, buff=SAFE).shift(DOWN * 0.6)
        head = mono("Close the loop", SIZE_H2, INK, W800).next_to(t, RIGHT, buff=0.3)
        self.play(FadeIn(ban), FadeIn(t), FadeIn(head), run_time=0.7)
        C = np.array([0, -0.35, 0])
        R = 2.1
        angs = {"discover": 90, "verify": -30, "consolidate": 210}
        nodes = {}
        for k, a in angs.items():
            n = Node(k, None, INK, width=2.7)
            n.move_to({"discover": [0, 1.25, 0], "verify": [3.3, -1.55, 0], "consolidate": [-3.3, -1.55, 0]}[k])
            nodes[k] = n
        g = TeamGraph(nodes, [("discover", "verify"), ("verify", "consolidate"), ("consolidate", "discover")])
        self.play(LaggedStart(*[FadeIn(n, scale=0.97) for n in nodes.values()], lag_ratio=0.25), run_time=1.2)
        self.play(LaggedStart(*[Create(e) for e in g.edges.values()], lag_ratio=0.2), run_time=1.0)
        e = g.edges[("consolidate", "discover")]
        lora = mono("LoRA SFT on Crusoe", SIZE_SMALL - 1, ROLE["coach"], W600)
        lora.next_to(e.get_center(), LEFT, buff=0.35)
        self.play(FadeIn(lora), run_time=0.6)
        self.play(g.packet("discover", "verify", INK, 0.8))
        self.play(g.packet("verify", "consolidate", INK, 0.8))
        self.play(g.packet("consolidate", "discover", ROLE["coach"], 0.8))
        cap = mono("fine-tune the noisy loader on the team's best runs", SIZE_SMALL - 1, GREY).to_edge(DOWN, buff=0.55)
        self.play(FadeIn(cap), run_time=0.6)
        self.wait(1.4)
