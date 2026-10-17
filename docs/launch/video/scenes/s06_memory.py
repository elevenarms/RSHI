"""S06 MemoryLayers (≈13 s): episodic, semantic (Bayesian confidence), procedural."""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np  # noqa: E402
from manim import *  # noqa: E402,F401,F403
from style import *  # noqa: E402,F401,F403

X0, X1 = -6.5, 6.5
LAB_W = 2.9  # left label column
ROWS = [(1.4, 1.45), (-0.45, 1.95), (-2.35, 1.45)]  # (centre y, height) of the three slabs
TEAL = ROLE["librarian"]


def slab(y, h, name, sub):
    box = Rectangle(width=X1 - X0, height=h, color=INK, stroke_width=HAIR).move_to([(X0 + X1) / 2, y, 0])
    mark = Rectangle(width=0.08, height=h - 0.3, fill_color=TEAL, fill_opacity=1, stroke_width=0).move_to([X0 + 0.22, y, 0])
    n = label(name, SIZE_CAPTION, INK, W800)
    s = mono(sub, SIZE_CAPTION - 1, GREY)
    t = VGroup(n, s).arrange(DOWN, aligned_edge=LEFT, buff=0.1).move_to([0, y, 0]).align_to([X0 + 0.45, 0, 0], LEFT)
    div = Line([X0 + LAB_W, y - h / 2, 0], [X0 + LAB_W, y + h / 2, 0], color=INK, stroke_width=0.8)
    return VGroup(box, mark, t, div)


class MemoryLayers(Scene):
    def construct(self):
        ban = banner("MEMORY")
        head = heading("Memory has three layers")
        own = mono("kept by the Librarian (Nano-30B-A3B + code)", SIZE_CAPTION, GREY).next_to(head, RIGHT, buff=0.4).align_to(head, DOWN)
        self.play(FadeIn(ban), FadeIn(head), FadeIn(own), run_time=0.9)

        slabs = [slab(y, h, n, s) for (y, h), (n, s) in zip(ROWS, [("episodic", "item by item"), ("semantic", "lessons, confidence"), ("procedural", "every genome")])]
        self.play(LaggedStart(*[AnimationGroup(Create(sl[0]), FadeIn(sl[1]), FadeIn(sl[2]), Create(sl[3])) for sl in slabs], lag_ratio=0.25), run_time=1.6)

        # 1. Episodic: item rows.
        cx = X0 + LAB_W + 0.4
        y0 = ROWS[0][0] + 0.42
        rows = [
            ("juice_glass_01", "upper", "mouth_down", "clean", CLEAN),
            ("fork_01", "basket", "upright", "clean", CLEAN),
            ("porridge_bowl_04", "upper", "mouth_down_tilted_45", "residue", DIRTY),
        ]
        ep = VGroup()
        for i, (a, b, c, d, col) in enumerate(rows):
            y = y0 - i * 0.4
            cells = [line_text(a, SIZE_SMALL - 2, INK), line_text(b, SIZE_SMALL - 2, GREY), line_text(c, SIZE_SMALL - 2, GREY), line_text(d, SIZE_SMALL - 2, col, W600)]
            for x, cell in zip([cx, cx + 2.75, cx + 4.15, cx + 7.4], cells):
                put(cell, x, y)
            ep.add(VGroup(*cells))
        self.play(LaggedStart(*[FadeIn(r, shift=RIGHT * 0.1) for r in ep], lag_ratio=0.3), run_time=1.4)

        # 2. Semantic: a lesson card with confidence, the confidence bar growing with support.
        ys = ROWS[1][0]
        card_t = line_text("Tilt glasses mouth-down in the upper rack", SIZE_SMALL - 1, INK, W600)
        put(card_t, cx, ys + 0.6)
        kappa_card = line_text("κ 0.69", SIZE_SMALL - 1, TEAL, W800)
        put(kappa_card, cx + 8.6, ys + 0.6, "r")
        track = Line([cx, ys + 0.02, 0], [cx + 4.0, ys + 0.02, 0], color=FAINT, stroke_width=8)
        half = Line([cx + 2.0, ys - 0.14, 0], [cx + 2.0, ys + 0.18, 0], color=GREY, stroke_width=1)
        kt = ValueTracker(0.54)
        st = ValueTracker(1)
        bar = always_redraw(lambda: Line([cx, ys + 0.02, 0], [cx + 4.0 * kt.get_value() + 1e-3, ys + 0.02, 0], color=INK, stroke_width=8))
        read = always_redraw(lambda: put(line_text(f"s = {int(round(st.get_value())):>2d}   κ = {kt.get_value():.2f}", SIZE_SMALL - 2, INK), cx + 4.3, ys + 0.02))
        eq1 = line_text("p = (s+1)/(n+2)", SIZE_SMALL - 2, GREY)
        eq2 = line_text("κ = ½ + (p − ½)·n/(n+K)", SIZE_SMALL - 2, GREY)
        eq3 = line_text("n = s + c,  K = 3", SIZE_SMALL - 2, GREY)
        put(eq1, cx, ys - 0.62)
        put(eq2, eq1.ink.get_right()[0] + 0.6, ys - 0.62)
        put(eq3, eq2.ink.get_right()[0] + 0.6, ys - 0.62)
        self.play(FadeIn(card_t, shift=RIGHT * 0.1), FadeIn(kappa_card), run_time=0.7)
        self.play(Create(track), FadeIn(half), FadeIn(bar), FadeIn(read), run_time=0.5)
        self.play(kt.animate.set_value(0.72), st.animate.set_value(5), run_time=0.9, rate_func=EASE)
        self.play(kt.animate.set_value(0.90), st.animate.set_value(20), run_time=0.9, rate_func=EASE)
        self.play(LaggedStart(*[FadeIn(e) for e in (eq1, eq2, eq3)], lag_ratio=0.3), run_time=0.9)

        # 3. Procedural: the lineage.
        yp = ROWS[2][0]
        ids = ["G0-fc671e", "G1-321329", "G2-704108"]
        gx = [cx + 0.0, cx + 3.65, cx + 7.3]
        gnodes = []
        for x, gid in zip(gx, ids):
            t = line_text(gid, SIZE_SMALL - 1, INK, W600)
            put(t, x + 0.15, yp + 0.15)
            box = SurroundingRectangle(t.ink, buff=0.12, color=INK, stroke_width=1.2)
            gnodes.append(VGroup(box, t))
        links = VGroup(*[Arrow(gnodes[i][0].get_right(), gnodes[i + 1][0].get_left(), buff=0.08, color=INK, stroke_width=1.4, tip_length=0.12, max_stroke_width_to_length_ratio=100) for i in range(2)])
        leaves = VGroup()
        # Rejected children hang below each incumbent: G0 had 3 (Planner, brief, preflight), G1 one (focused brief).
        rej = {0: 3, 1: 1}
        for gi, n in rej.items():
            base = gnodes[gi][0].get_bottom()
            for k in range(n):
                p = base + np.array([0.35 * (k - (n - 1) / 2), -0.42, 0])
                leaves.add(Line(base, p + UP * 0.07, color=GREY, stroke_width=1.0), Dot(p, radius=0.06, color=DIRTY))
        acc = VGroup(*[mono("+ bowl rule", SIZE_CAPTION - 2, CLEAN).next_to(links[0], UP, buff=0.06), mono("+ glasses/cutlery", SIZE_CAPTION - 2, CLEAN).next_to(links[1], UP, buff=0.06)])
        self.play(FadeIn(gnodes[0]), run_time=0.4)
        self.play(GrowArrow(links[0]), FadeIn(gnodes[1]), FadeIn(acc[0]), run_time=0.7)
        self.play(GrowArrow(links[1]), FadeIn(gnodes[2]), FadeIn(acc[1]), run_time=0.7)
        rej_lab = mono("rejected", SIZE_CAPTION - 2, DIRTY).next_to(leaves[5], RIGHT, buff=0.15)
        self.play(LaggedStart(*[FadeIn(l) for l in leaves], lag_ratio=0.1), FadeIn(rej_lab), run_time=0.6)
        foot = mono("end of run: 36 lessons from 39 episodes · exam episodes stored apart, never read back", SIZE_CAPTION - 1, GREY)
        foot.next_to(slabs[2][0], DOWN, buff=0.16).align_to(slabs[2][0], LEFT)
        self.play(FadeIn(foot), run_time=0.6)
        self.wait(1.2)
