import sand3d as s3d

# The windmill: a tapering white tower on a stone base, a wooden balcony round its middle, a red cap with a finial, a
# door and a little window, the shaft the sails turn on, and flour sacks and a barrel by the door. Its front is on -Y,
# which is the world's +Z. The sails are their own model (sails.py), turned by the world at the end of the shaft; the
# world also gives the tower its painted look.


def windmill(base_h=340, tower_h=2400, deck_z=1700):
    base = s3d.cone("base", 1680, base_h, d2=1560)
    s3d.material(base, "concrete", color="#c9c0b2")
    tower = s3d.at(s3d.cone("tower", 1360, tower_h, d2=900), z=150, rx=0.7, ry=0.6)
    s3d.material(tower, "plastic", color="#efe6d6")
    cap = s3d.at(cap_part(), z=150 + tower_h - 50)
    deck = s3d.at(balcony(), z=deck_z - 30)
    door = s3d.at(door_part(), y=-630, z=650, rx=90 - 5.2)  # upright, leaning with the tower
    window = s3d.at(window_part(), y=-600, z=1250, rx=-5.2)
    shaft = s3d.at(s3d.cylinder("shaft", 100, 600), rx=90, y=-400, z=2720)
    s3d.material(shaft, "walnut", color="#7a5a40")
    sacks = [s3d.at(flour_sack(), x=x, y=y, rz=r) for x, y, r in ((500, -750, 11), (720, -620, -23))]
    barrel = s3d.at(barrel_part(), x=-600, y=-700)
    return s3d.assembly("windmill", base, tower, cap, deck, door, window, shaft, sacks, barrel)


def cap_part(d=1240, h=800, finial=140):
    roof = s3d.cone("cap", d, h)
    s3d.material(roof, "painted_metal", color="#c8644c")
    top = s3d.at(s3d.sphere("finial", finial), z=h - 10)
    s3d.material(top, "brass", color="#e8c45a")
    return s3d.group("cap", roof, top)


def balcony(d=1640, posts=14, rail_h=300):
    deck = s3d.cylinder("deck", d, 60)
    uprights = s3d.at(s3d.cylinder("railing_post", 36, rail_h), on=s3d.ring(posts, 780), z=40)
    rail = s3d.at(s3d.torus("rail", 1560, 44), z=rail_h)
    parts = [deck, *uprights, rail]
    for p in parts:
        s3d.material(p, "walnut", color="#7a5a40")
    return s3d.group("balcony", parts)


def door_part(w=340, h=620):
    door = s3d.extrude("door", s3d.rect(w, h, r=40), 60, both=True)
    s3d.material(door, "oak", color="#8a5a3c")
    return door


def window_part(w=240, h=260):
    frame = s3d.at(s3d.extrude("window_frame", s3d.rect(w, h), 50, both=True), rx=90)
    s3d.material(frame, "plastic", color="#fff6e6")
    pane = s3d.at(s3d.extrude("pane", s3d.rect(w - 70, h - 70), 30, both=True), rx=90, y=-20)
    s3d.material(pane, "glass", color="#5e7f96")
    return s3d.group("window", frame, pane)


def flour_sack(w=340, d=260, h=300):
    sack = s3d.loft(
        "sack",
        s3d.station(0, w * 0.8, d * 0.8, n=3),
        s3d.station(h * 0.45, w, d, n=3),
        s3d.station(h * 0.85, w * 0.55, d * 0.5),
        s3d.station(h, w * 0.2, d * 0.2),
    )
    s3d.material(sack, "fabric", color="#e8dcc2")
    return sack


def barrel_part(d=320, h=440):
    staves = s3d.loft("barrel", s3d.station(0, d * 0.88, d * 0.88), s3d.station(h / 2, d, d), s3d.station(h, d * 0.88, d * 0.88))
    s3d.material(staves, "oak", color="#a26e45")
    hoops = s3d.at(s3d.torus("hoop", d * 0.96, 24), on=[s3d.Frame((0, 0, z)) for z in (80, h - 80)])
    for p in hoops:
        s3d.material(p, "steel", color="#5e5650")
    return s3d.group("barrel", staves, hoops)
