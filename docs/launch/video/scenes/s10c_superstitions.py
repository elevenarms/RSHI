"""S10c Superstitions (≈20 s): one rule was a superstition, one was physics; the Gatekeeper
accepted both."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np  # noqa: E402
from manim import *  # noqa: E402,F401,F403
from style import *  # noqa: E402,F401,F403

CW, CH = 6.0, 5.0
CY = -0.3


def bowl_down() -> VGroup:
    arc = Arc(radius=0.2, start_angle=0, angle=PI, color=INK, stroke_width=1.6)
    rim = Line([-0.24, 0, 0], [0.24, 0, 0], color=INK, stroke_width=1.6)
    return VGroup(arc, rim)


def stamp(text: str, color: str) -> VGroup:
    t = label(text, SIZE_BODY - 2, color, W800, tracking=0.06)
    inner = Rectangle(width=t.width + 0.5, height=t.height + 0.32, color=color, stroke_width=3)
    outer = Rectangle(width=t.width + 0.66, height=t.height + 0.48, color=INK, stroke_width=1.5)
    g = VGroup(outer, inner, t)
    g.set_z_index(5)
    bg = Rectangle(width=outer.width, height=outer.height, stroke_width=0, fill_color=PAPER, fill_opacity=0.92).set_z_index(4)
    return VGroup(bg, g).rotate(-6 * DEGREES)


def card(x, tagline, rule_lines, accepted):
    box = Rectangle(width=CW, height=CH, color=INK, stroke_width=HAIR).move_to([x, CY, 0])
    left = box.get_left()[0] + 0.3
    top = box.get_top()[1] - 0.4
    tg = label(tagline, SIZE_CAPTION - 2, GREY, W800)
    tg.move_to([left + tg.width / 2, top, 0])
    rl = VGroup(*[mono(l, SIZE_SMALL - 1, INK, W600) for l in rule_lines]).arrange(DOWN, aligned_edge=LEFT, buff=0.1)
    rl.next_to(tg, DOWN, buff=0.25).align_to(tg, LEFT)
    acc = mono(accepted, SIZE_SMALL - 2, CLEAN, W600).next_to(rl, DOWN, buff=0.3).align_to(tg, LEFT)
    return box, tg, rl, acc


class Superstitions(Scene):
    def construct(self):
        ban = banner("WHAT IT LEARNED")
        head = heading("Learned superstitions")
        self.play(FadeIn(ban), FadeIn(head), run_time=0.7)

        # Left: R1.1.
        lx = -3.35
        box1, tg1, rl1, acc1 = card(lx, "rule R1.1", ["do not place cereal_bowl", "upper_rack mouth_down_tilted_45"], "accepted +25.1 pp (3 paired drills)")
        ev = mono("evidence: 1 failure in 2 loads", SIZE_SMALL - 2, INK).next_to(rl1, DOWN, buff=0.18).align_to(rl1, LEFT)
        acc1.next_to(ev, DOWN, buff=0.18).align_to(rl1, LEFT)
        self.play(Create(box1), FadeIn(tg1), run_time=0.6)
        self.play(FadeIn(rl1), run_time=0.6)
        self.play(FadeIn(ev), run_time=0.5)
        self.play(FadeIn(acc1), run_time=0.5)
        self.wait(1.4)
        sweep = VGroup(mono("controlled sweep: every mouth-down", SIZE_SMALL - 2, INK), mono("bowl clean, 45° included", SIZE_SMALL - 2, INK)).arrange(DOWN, aligned_edge=LEFT, buff=0.08)
        sweep.next_to(acc1, DOWN, buff=0.35).align_to(rl1, LEFT)
        bowls = VGroup()
        for i, ang in enumerate([0, 15, 30, 45, 0, 15, 30, 45]):
            b = bowl_down().rotate(-ang * DEGREES)
            tk = check_mark(CLEAN, 0.09).next_to(b, DOWN, buff=0.06)
            bowls.add(VGroup(b, tk))
        bowls.arrange(RIGHT, buff=0.22).next_to(sweep, DOWN, buff=0.25).align_to(rl1, LEFT)
        self.play(FadeIn(sweep), run_time=0.6)
        self.play(LaggedStart(*[FadeIn(b[0]) for b in bowls], lag_ratio=0.08), run_time=0.7)
        self.play(LaggedStart(*[Create(b[1]) for b in bowls], lag_ratio=0.08), run_time=0.7)
        s1 = stamp("SUPERSTITION", DIRTY)
        s1.move_to([box1.get_right()[0] - s1.width / 2 - 0.25, box1.get_bottom()[1] + 0.55, 0])
        self.play(FadeIn(s1, scale=1.06), run_time=0.5)
        self.wait(1.6)

        # Right: R2.1.
        rx = 3.35
        box2, tg2, rl2, acc2 = card(rx, "rule R2.1", ["glasses and tumblers:", "upper_rack, mouth_down"], "accepted +15.7 pp")
        self.play(Create(box2), FadeIn(tg2), FadeIn(rl2), run_time=0.8)
        self.play(FadeIn(acc2), run_time=0.5)
        f1 = VGroup(
            mono("Finding 1:", SIZE_SMALL - 2, INK, W600),
            mono("mouth up    0/11 clean", SIZE_SMALL - 2, DIRTY),
            mono("mouth down  26/26 clean", SIZE_SMALL - 2, CLEAN),
        ).arrange(DOWN, aligned_edge=LEFT, buff=0.08).next_to(acc2, DOWN, buff=0.4).align_to(rl2, LEFT)
        self.play(FadeIn(f1), run_time=0.8)
        s2 = stamp("PHYSICS", CLEAN)
        s2.move_to([box2.get_right()[0] - s2.width / 2 - 0.25, box2.get_bottom()[1] + 0.55, 0])
        self.play(FadeIn(s2, scale=1.06), run_time=0.5)
        self.wait(1.4)

        bottom = mono("The Gatekeeper accepted both. It could not tell them apart.", SIZE_BODY - 2, INK, W800)
        bottom.to_edge(DOWN, buff=0.35)
        self.play(AddTextLetterByLetter(bottom, time_per_char=0.03, run_time=1.6))
        self.wait(2.8)
