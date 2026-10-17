"""S05 TeamGraph (≈18 s): around the Loader, a team of open Nemotron models on Crusoe serverless
inference, and one member that is not a model at all: the Gatekeeper."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np  # noqa: E402
from manim import *  # noqa: E402,F401,F403
from style import *  # noqa: E402,F401,F403
from s04_loader import LOADER_POS, loader_node  # noqa: E402

W = 3.5
POS = {
    "planner": (-4.55, 1.85),
    "loader": (0.0, 0.2),
    "critic": (4.55, 1.85),
    "gatekeeper": (-4.55, -1.55),
    "coach": (0.0, -2.35),
    "librarian": (4.55, -1.55),
}


def eye(color=INK) -> VGroup:
    e = Ellipse(width=0.34, height=0.18, color=color, stroke_width=1.4)
    return VGroup(e, Dot(radius=0.045, color=color))


def stack(color=INK) -> VGroup:
    return VGroup(*[RoundedRectangle(corner_radius=0.02, width=0.3, height=0.07, color=color, stroke_width=1.2).shift(UP * 0.1 * i) for i in range(3)])


class TeamGraph(Scene):
    def construct(self):
        ban = banner("THE TEAM")
        loader = loader_node()
        self.add(ban, loader)
        nodes = {
            "loader": loader,
            "planner": Node("Planner", "Nemotron-3.5-Super-VL", ROLE["planner"], width=W),
            "critic": Node("Critic", "Nano-Omni-Reasoning-30B", ROLE["critic"], width=W),
            "coach": Node("Coach", "Super-120B-A12B", ROLE["coach"], width=W),
            "librarian": Node("Librarian", "Nano-30B-A3B + code", ROLE["librarian"], width=W),
            "gatekeeper": Node("Gatekeeper", "code · statistics", INK, width=W, square=True, filled=True),
        }
        for k, n in nodes.items():
            if k != "loader":
                n.move_to([*POS[k], 0])
        g = TeamGraph_(nodes)
        crit_eye = eye().next_to(nodes["critic"].box.get_corner(UR), DL, buff=0.16)
        lib_stack = stack().next_to(nodes["librarian"].box.get_corner(UR), DL, buff=0.16)

        self.play(loader.animate(rate_func=EASE).move_to([*POS["loader"], 0]), run_time=1.0)

        def appear(key, extra=None):
            anims = [FadeIn(nodes[key], scale=0.97)]
            if extra is not None:
                anims.append(FadeIn(extra))
            return AnimationGroup(*anims, run_time=0.8)

        e_pl = g.make_edge("planner", "loader")
        e_lc = g.make_edge("loader", "critic")
        e_cl = g.make_edge("critic", "librarian")
        e_lb = g.make_edge("librarian", "coach")
        e_cg = g.make_edge("coach", "gatekeeper")
        e_gp = g.make_edge("gatekeeper", "planner")

        # A Planner.
        self.play(appear("planner"))
        self.play(Create(e_pl, run_time=0.6))
        self.play(packet_along(Line(e_pl.get_start(), e_pl.get_end()), ROLE["planner"], 0.9, "plan"))
        # A Critic that looks at the renders.
        self.play(appear("critic", crit_eye))
        self.play(Create(e_lc, run_time=0.6))
        self.play(packet_along(Line(e_lc.get_start(), e_lc.get_end()), ROLE["loader"], 0.9, "episode"))
        # A Coach.
        self.play(appear("coach"))
        # A Librarian that keeps the memory.
        self.play(appear("librarian", lib_stack))
        self.play(Create(e_cl, run_time=0.5), Create(e_lb, run_time=0.5))
        self.play(packet_along(Line(e_cl.get_start(), e_cl.get_end()), ROLE["critic"], 0.8, "lessons"))
        self.play(packet_along(Line(e_lb.get_start(), e_lb.get_end()), ROLE["librarian"], 0.8, "brief"))
        self.wait(0.6)
        # And one member that isn't a model at all: the Gatekeeper.
        gk = nodes["gatekeeper"]
        self.play(Create(gk.box.copy().set_fill(opacity=0), run_time=0.6))
        self.play(FadeIn(gk, run_time=0.6))
        self.play(Create(e_cg, run_time=0.5), Create(e_gp, run_time=0.5))

        models = VGroup(*[nodes[k] for k in ("planner", "loader", "critic", "coach", "librarian")])
        frame = DashedVMobject(
            RoundedRectangle(corner_radius=0.12, width=models.width + 0.5, height=models.height + 0.5, color=GREY, stroke_width=1.2),
            num_dashes=90,
        ).move_to(models).shift(RIGHT * 0.0)
        frame_cap = mono("Crusoe serverless inference · open NVIDIA Nemotron", SIZE_CAPTION, GREY).next_to(frame, DOWN, buff=0.18).align_to(frame, RIGHT)
        self.play(Create(frame, run_time=1.0), FadeIn(frame_cap, run_time=0.8))
        self.wait(1.5)


class TeamGraph_(VGroup):
    """Just enough of style.TeamGraph to make edges between prebuilt nodes."""

    def __init__(self, nodes):
        super().__init__()
        self.nodes = nodes

    def make_edge(self, a, b, color=GREY):
        A, B = self.nodes[a].box, self.nodes[b].box
        return Arrow(
            border_point(A, B.get_center()), border_point(B, A.get_center()), buff=0, color=color,
            stroke_width=HAIR + 0.3, tip_length=0.12, max_tip_length_to_length_ratio=0.5, max_stroke_width_to_length_ratio=100,
        )
