"""S07 GenomeEdits (≈13 s): the Coach rewrites the genome through six typed edits; three green
playbook lines are the champion's diff. The team can change how it plays, never how it's graded."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np  # noqa: E402
from manim import *  # noqa: E402,F401,F403
from style import *  # noqa: E402,F401,F403

SZ = SIZE_SMALL - 4
LINES = [
    "prompts   loader · planner · critic",
    "playbook  (0 rules)",
    "team      { usePlanner: false,",
    "            useMemoryBrief: false,",
    "            preflightCheck: false }",
    "loader    { … }",
]
DIFF = [
    "+ R1.1  Do not place cereal_bowl_vitrelle_159 on upper_rack/",
    "+       mouth_down_tilted_45; lower_rack on_edge, or leave it out",
    "+ R2.1  Glasses and tumblers: upper_rack, mouth_down",
    "+ R2.2  Cutlery: cutlery_basket, upright",
]
OPS = ["add_rule", "edit_rule", "remove_rule", "set_prompt", "set_team", "set_loader"]


def padlock(color=INK) -> VGroup:
    body = RoundedRectangle(corner_radius=0.04, width=0.34, height=0.26, color=color, stroke_width=1.6, fill_color=color, fill_opacity=1)
    shackle = Arc(radius=0.12, start_angle=0, angle=PI, color=color, stroke_width=2.2).next_to(body, UP, buff=-0.01)
    return VGroup(shackle, body)


class GenomeEdits(Scene):
    def construct(self):
        ban = banner("THE GENOME")
        head = heading("Six typed edits")
        self.play(FadeIn(ban), FadeIn(head), run_time=0.8)

        # The genome card.
        X, Y = -6.3, 1.78
        lh = 0.36
        title = line_text("genome G0-fc671e", SZ + 1, INK, W800)
        put(title, X + 0.3, Y)
        body = [line_text(l, SZ, INK if i in (0, 1) or True else GREY) for i, l in enumerate(LINES)]
        for i, b in enumerate(body):
            put(b, X + 0.3, Y - 0.55 - i * lh, "s")
        diff = [line_text(l, SZ, CLEAN, W600) for l in DIFF]
        for i, d in enumerate(diff):
            put(d, X + 0.3, Y - 0.55 - (len(LINES) + i) * lh, "s")
        w = 8.65
        top = Y + 0.32
        bottom = Y - 0.55 - (len(LINES) + len(DIFF) - 1) * lh - 0.3
        panel = RoundedRectangle(corner_radius=0.05, width=w, height=top - bottom, color=INK, stroke_width=HAIR, fill_color=PLATE, fill_opacity=1)
        panel.move_to([X + w / 2, (top + bottom) / 2, 0])
        sep = Line([X, Y - 0.27, 0], [X + w, Y - 0.27, 0], color=INK, stroke_width=0.8)
        bands = VGroup(*[Rectangle(width=w - 0.03, height=lh * 0.95, stroke_width=0, fill_color=CLEAN, fill_opacity=0.09).move_to([X + w / 2, d.strut.get_center()[1], 0]) for d in diff])
        self.play(FadeIn(panel), Create(sep), FadeIn(title), run_time=0.6)
        self.play(LaggedStart(*[FadeIn(b) for b in body], lag_ratio=0.12), run_time=1.0)

        # The six operations.
        chips = VGroup()
        for op in OPS:
            t = mono(op, SZ, INK)
            box = RoundedRectangle(corner_radius=0.06, width=t.width + 0.3, height=t.height + 0.24, color=INK, stroke_width=1.2, fill_color=PAPER, fill_opacity=1)
            chips.add(VGroup(box, t.move_to(box)))
        chips.arrange(RIGHT, buff=0.16).next_to(panel, DOWN, buff=0.35).align_to(panel, LEFT)
        coach_mark = Rectangle(width=0.07, height=chips.height, fill_color=ROLE["coach"], fill_opacity=1, stroke_width=0).next_to(chips, LEFT, buff=0.12)
        coach_lab = label("coach edits", SIZE_CAPTION - 3, GREY).next_to(chips, DOWN, buff=0.12).align_to(chips, LEFT)
        self.play(LaggedStart(*[FadeIn(c, shift=UP * 0.06) for c in chips], lag_ratio=0.1), FadeIn(coach_mark), FadeIn(coach_lab), run_time=1.0)

        # add_rule lifts and lands in the playbook; three rules type in.
        chip = chips[0]
        ghost = chip.copy()
        self.play(chip.animate(rate_func=EASE).set_stroke(ROLE["coach"], width=2).shift(UP * 0.12), run_time=0.4)
        self.play(ghost.animate(rate_func=EASE).move_to(diff[0].ink.get_left() + RIGHT * 0.6).set_opacity(0), run_time=0.8)
        self.remove(ghost)
        new_play = line_text("playbook  (3 rules)", SZ, INK)
        put(new_play, X + 0.3, body[1].strut.get_center()[1], "s")
        new_play.align_to(body[1], LEFT)
        for i, d in enumerate(diff):
            anims = [FadeIn(bands[i], run_time=0.15), type_line(d, 0.022)]
            self.play(Succession(*anims))
        self.play(Transform(body[1], new_play), run_time=0.5)
        new_title = line_text("genome G2-704108   parent G1-321329 ← G0-fc671e", SZ + 1, INK, W800)
        put(new_title, X + 0.3, Y)
        self.play(chip.animate.set_stroke(INK, width=1.2).shift(DOWN * 0.12), Transform(title, new_title), run_time=0.7)

        # Scoring is out of reach.
        lock_box = Rectangle(width=3.5, height=1.5, color=INK, stroke_width=STROKE).move_to([4.75, -0.9, 0])
        l1 = label("scoring", SIZE_CAPTION, INK, W800)
        l1.move_to(lock_box.get_left() + RIGHT * (0.35 + l1.width / 2) + UP * 0.22)
        l2 = line_text("physics + Gatekeeper", SIZE_SMALL - 3, INK)
        put(l2, lock_box.get_left()[0] + 0.35, lock_box.get_center()[1] - 0.22)
        lt = VGroup(l1, l2)
        lock = padlock().move_to(lock_box.get_corner(UR) + np.array([-0.4, -0.4, 0]))
        coach = Node("Coach", "Super-120B-A12B", ROLE["coach"], width=3.0).scale(0.85).move_to([4.75, 1.55, 0])
        self.play(FadeIn(coach, scale=0.97), Create(lock_box), FadeIn(lt), run_time=0.8)
        self.play(FadeIn(lock, shift=DOWN * 0.08), run_time=0.5)
        reach = Arrow(coach.get_bottom() + DOWN * 0.05, lock_box.get_top() + UP * 0.35, buff=0, color=ROLE["coach"], stroke_width=2, tip_length=0.14, max_stroke_width_to_length_ratio=100)
        self.play(GrowArrow(reach), run_time=0.8, rate_func=EASE)
        self.play(FadeOut(reach), run_time=0.6)
        never = mono("out of the team's reach", SIZE_CAPTION, GREY).next_to(lock_box, DOWN, buff=0.2).align_to(lock_box, LEFT)
        foot = mono("ids hash content + parent: lineage is diffable", SIZE_CAPTION - 1, GREY).to_edge(DOWN, buff=0.35).align_to(panel, LEFT)
        self.play(FadeIn(never), FadeIn(foot), run_time=0.7)
        self.wait(1.2)
