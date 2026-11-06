import math

import sand3d as s3d

# The cottage: cream walls with dark timber framing on a stone footing, a deep red roof with rows of shingles that
# overhangs, a chimney, a front door with a step and a knob, four shuttered windows with flower boxes, and firewood
# stacked round the side. Its front is on -Y, which is the world's +Z. The world gives the walls their painted look
# and the glass its glow at dusk, and adds the door lantern and the chimney smoke.

ROOF_W, ROOF_H, ROOF_D = 2760, 1150, 2500


def cottage(w=2100, d=2000, wall_h=1300, eaves=1380):
    footing = s3d.box("footing", w + 120, d + 120, 160)
    s3d.material(footing, "concrete", color="#c9c0b2")
    walls = s3d.at(s3d.box("walls", w, d, wall_h), z=80, ry=-0.7)  # leaning a touch, like a real old cottage
    s3d.material(walls, "plastic", color="#f6ecdc")
    frame = timber_frame(w, d, wall_h)
    roof = s3d.at(roof_part(), z=eaves, ry=1.0)
    chimney = s3d.at(chimney_part(), x=600, y=350, z=1725)
    door = s3d.at(front_door(), y=-d / 2)
    windows = [
        s3d.at(window(), x=-650, y=-d / 2 - 20, z=820),
        s3d.at(window(), x=680, y=-d / 2 - 20, z=820),
        s3d.at(window(), x=w / 2 + 10, z=820, rz=90),
        s3d.at(window(), x=-w / 2 - 10, z=820, rz=-90),
    ]
    wood = s3d.at(firewood(), x=-1300, y=550)
    return s3d.assembly("cottage", footing, walls, frame, roof, chimney, door, windows, wood)


def timber_frame(w, d, h, t=100):
    posts = s3d.at(s3d.box("beam", t, t, h + 20), on=s3d.grid(2, 2, w, d), z=70)
    bands = s3d.at(s3d.box("beam", w + 40, 60, 90), on=[s3d.Frame((0, y, h - 15)) for y in (-d / 2 - 10, d / 2 + 10)])
    parts = [*posts, *bands]
    for p in parts:
        s3d.material(p, "walnut", color="#7d5236")
    return s3d.group("frame", parts)


def roof_part(rows=7):
    gable = s3d.at(s3d.extrude("roof", s3d.poly([(-ROOF_W / 2, 0), (ROOF_W / 2, 0), (0, ROOF_H)]), ROOF_D, both=True), rx=90)
    s3d.material(gable, "painted_metal", color="#b9573f")
    ridge = s3d.at(s3d.cylinder("ridge", 140, ROOF_D + 60), rx=90, y=(ROOF_D + 60) / 2, z=ROOF_H + 10)
    s3d.material(ridge, "painted_metal", color="#9e4a38")
    return s3d.group("roof", gable, ridge, shingles(rows))


def shingles(rows):
    # down each slope from the ridge, overlapping, a little uneven, in two shades of red
    slope, run = math.atan2(ROOF_H, ROOF_W / 2), math.hypot(ROOF_W / 2, ROOF_H)
    out = []
    for side in (-1, 1):
        for k in range(rows):
            along = 120 + k / rows * (run - 200)
            x = side * (ROOF_W / 2 - along * math.cos(slope) + 35 * math.sin(slope))
            z = along * math.sin(slope) + 35 * math.cos(slope)
            tile = s3d.extrude("shingle", s3d.rect(300, 2560), 50, both=True)
            s3d.at(tile, x=x, y=(k * 37) % 5 * 4 - 8, z=z, ry=side * math.degrees(slope) + ((k * 13) % 3 - 1) * 0.6)
            s3d.material(tile, "painted_metal", color="#c8644c" if k % 2 else "#d2704f")
            out.append(tile)
    return out


def chimney_part(w=300, h=750):
    stack = s3d.box("chimney", w, w, h)
    s3d.material(stack, "concrete", color="#b6a898")
    cap = s3d.at(s3d.box("chimney_cap", w + 60, w + 60, 70), z=h - 10)
    s3d.material(cap, "concrete", color="#8f8378")
    return s3d.group("chimney", stack, cap)


def front_door(w=440, h=880):
    frame = s3d.at(s3d.box("door_frame", w + 120, 40, h + 100), y=-10, z=90)
    s3d.material(frame, "walnut", color="#7d5236")
    leaf = s3d.at(s3d.box("door", w, 40, h), y=-30, z=120)
    s3d.material(leaf, "oak", color="#8a5a3c")
    knob = s3d.at(s3d.sphere("knob", 60), x=140, y=-70, z=520)
    s3d.material(knob, "brass", color="#e8c45a")
    step = s3d.at(s3d.extrude("step", s3d.rect(700, 350, r=40), 100), y=-220)
    s3d.material(step, "concrete", color="#d8d0c4")
    return s3d.group("front_door", frame, leaf, knob, step)


def window(w=440, h=420, blooms=("#ff9fb8", "#ffd84a", "#ffffff", "#ff9fb8", "#c9a8f0")):
    frame = s3d.extrude("window_frame", s3d.rect(w, h), 50, both=True)
    s3d.at(frame, rx=90)
    glass = s3d.at(s3d.extrude("glass", s3d.rect(w - 80, h - 80), 40, both=True), rx=90, y=-12)
    bars = [s3d.at(s3d.extrude("glazing_bar", s3d.rect(*size), 20, both=True), rx=90, y=-35) for size in ((30, h - 80), (w - 80, 30))]
    shutters = [s3d.at(s3d.extrude("shutter", s3d.rect(200, h + 20), 30, both=True), rx=90, x=side * 320, y=-10, rz=side * -14.3) for side in (-1, 1)]
    box = s3d.at(s3d.box("flower_box", w + 40, 140, 100), y=-80, z=-320)
    flowers = [s3d.at(s3d.sphere("bloom", 90), x=x, y=-80 - (i % 2) * 30, z=-225) for i, x in enumerate((-180, -90, 0, 90, 180))]
    leaves = [s3d.at(s3d.sphere("leaves", 80), x=x, y=-90, z=-240) for x in (-200, 200)]
    s3d.material(frame, "plastic", color="#fff6e6")
    s3d.material(glass, "glass", color="#ffe7b0")
    for p in bars:
        s3d.material(p, "plastic", color="#fff6e6")
    for p in shutters:
        s3d.material(p, "painted_metal", color="#6f9fb0")
    s3d.material(box, "oak", color="#8a5a3c")
    for p, c in zip(flowers, blooms):
        s3d.material(p, "plastic", color=c)
    for p in leaves:
        s3d.material(p, "plastic", color="#6fb84a")
    return s3d.group("window", frame, glass, bars, shutters, box, flowers, leaves)


def firewood(d=150, length=500):
    logs = []
    for row in range(3):
        for i in range(4 - row):
            log = s3d.at(s3d.cylinder("log", d, length), ry=90, x=-length / 2, y=-(i * 160 + row * 80), z=100 + row * 150)
            s3d.material(log, "oak", color="#a77a4f" if i % 2 else "#b88a5a")
            logs.append(log)
    return s3d.group("firewood", logs)
