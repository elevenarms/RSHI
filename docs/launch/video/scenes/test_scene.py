"""TEST scene (5 s): the team graph, one packet going round the loop, the Gatekeeper accepts.
Proves the toolchain and the look; not part of the final cut."""

from manim import *  # noqa: F401,F403
from style import *  # noqa: F401,F403


class TestTeamGraph(Scene):
    def construct(self):
        header = VGroup(
            mono("SPARKLETEAM", SIZE_SMALL, INK_3, weight="MEDIUM"),
            mono("one generation", SIZE_H2, INK, weight="BOLD"),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.1)
        header.to_corner(UL, buff=SAFE)

        g = TeamGraph(
            {
                "planner": ("Planner", "writes the plan", ROLE["planner"], (-4.4, 1.25)),
                "loader": ("Loader", "13 MCP tools", ROLE["loader"], (0, 1.25)),
                "critic": ("Critic", "post-mortem", ROLE["critic"], (4.4, 1.25)),
                "gatekeeper": ("Gatekeeper", "statistics", ROLE["gatekeeper"], (-4.4, -1.65)),
                "coach": ("Coach", "edits genome", ROLE["coach"], (0, -1.65)),
                "librarian": ("Librarian", "memory", ROLE["librarian"], (4.4, -1.65)),
            },
            [
                ("planner", "loader"),
                ("loader", "critic"),
                ("critic", "librarian"),
                ("librarian", "coach"),
                ("coach", "gatekeeper"),
                ("gatekeeper", "planner"),
            ],
        )
        g.shift(DOWN * 0.25)
        self.add(header)
        self.play(g.reveal(run_time=1.0))
        hops = [
            ("planner", "loader"),
            ("loader", "critic"),
            ("critic", "librarian"),
            ("librarian", "coach"),
            ("coach", "gatekeeper"),
        ]
        self.play(Succession(*[g.packet(a, b, run_time=0.26) for a, b in hops]))
        verdict = mono("accepted  +4.1 pts", SIZE_SMALL, CLEAN, weight="BOLD")
        verdict.next_to(g.nodes["gatekeeper"], DOWN, buff=0.22)
        self.play(
            g.nodes["gatekeeper"].box.animate.set_stroke(CLEAN, width=3),
            FadeIn(verdict, shift=UP * 0.1),
            run_time=0.4,
        )
        self.play(g.packet("gatekeeper", "planner", color=CLEAN, run_time=0.3))
        self.wait(max(5 - self.renderer.time, 1 / 60))
