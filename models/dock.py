import sand3d as s3d

# The wooden dock, from the shore out over the pond: planks in three shades on two stringers, on posts, with a tin
# bucket and a post for the lantern at the far end. It runs from y = 400 out to y = -length, which is the world's +Z
# (towards the pond's middle); z = 0 is the water line, and the deck's top is 95 mm above it. The far pair of posts stand
# proud of the deck as bollards. The world hangs the lantern on the post, and `length` must match DOCK.length in
# island.tsx (models.test.ts checks).


def dock(length=1900, start=-400, planks=12, top=70):
    step = (length - start) / planks
    deck = [s3d.at(plank(step * 0.84, k), y=-(start + step * (k + 0.5)), z=top - 25, rz=((k * 7) % 5 - 2) * 0.7) for k in range(planks)]
    stringers = s3d.at(s3d.box("stringer", 70, length - start, 70), on=[s3d.Frame((x, -(start + length) / 2, top - 95)) for x in (-300, 300)])
    # posts under the deck, down into the pond bed; the far pair taller, to hold the end up out of the water
    piles = [s3d.at(pile(h), x=x, y=-y, z=-395) for y, h in ((550, 450), (1250, 450), (length - 60, 550)) for x in (-380, 380)]
    post = s3d.at(lantern_post(), x=-360, y=-(length - 60), z=top)
    pail = s3d.at(bucket(), x=220, y=-(length - 450), z=top + 25)
    for p in stringers:
        s3d.material(p, "walnut", color="#8a5d3b")
    return s3d.assembly("dock", deck, stringers, piles, post, pail)


def plank(w, k, length=820, t=50, shades=("#b47d50", "#a56f45", "#bd895b")):
    board = s3d.box("plank", length, w, t)
    s3d.material(board, "oak", color=shades[k % 3])
    return board


def pile(h, d=100):
    p = s3d.cone("pile", d, h, d2=d * 0.9)
    s3d.material(p, "walnut", color="#7d5638")
    return p


def lantern_post(h=500, d=70):
    p = s3d.cone("lantern_post", d, h, d2=d * 0.86)
    s3d.material(p, "walnut", color="#7d5638")
    return p


def bucket(d=170, h=140, t=6):
    pail = s3d.shell(s3d.cone("bucket", d * 0.76, h, d2=d), t, open="top")
    s3d.material(pail, "aluminium", color="#9fb4c4")
    handle = s3d.wire("handle", s3d.arc((0, 0), d / 2, 0, 180), 12)
    s3d.at(handle, rx=90, z=h - 20)
    s3d.material(handle, "steel", color="#6f8090")
    return s3d.group("bucket", pail, handle)
