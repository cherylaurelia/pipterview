import sand3d as s3d

# A wooden park bench: three seat slats and two back slats on dark end frames with armrests. Its seat faces -Y, which
# is the world's +Z; explore.ts seats you on it at 460 mm.


def bench(length=1300, seat_h=420, lean=-8.6):
    slats = s3d.at(seat_slat(length), on=[s3d.Frame((0, y, seat_h)) for y in (-130, 0, 130)])
    back = s3d.at(back_slat(length), on=[s3d.Frame((0, 200, z)) for z in (640, 820)], rx=90 + lean)  # on edge, leaning back
    ends = s3d.at(end_frame(seat_h, lean), on=[s3d.Frame((x, 0, 0)) for x in (-550, 550)])
    return s3d.assembly("bench", slats, back, ends)


def seat_slat(length, w=110, t=60):
    slat = s3d.extrude("slat", s3d.rect(length, w, r=8), t, both=True)
    s3d.fillet(slat, 6, edges="top")
    s3d.material(slat, "oak", color="#b07a4f")
    return slat


def back_slat(length, h=120, t=50):
    slat = s3d.extrude("slat", s3d.rect(length, h, r=10), t, both=True)
    s3d.material(slat, "oak", color="#b07a4f")
    return slat


def end_frame(seat_h, lean, w=80, depth=360):
    leg = s3d.box("leg", w, depth, seat_h)
    post = s3d.at(s3d.extrude("post", s3d.rect(70, 60), 500, both=True), y=190, z=620, rx=lean)
    arm = s3d.at(s3d.extrude("arm", s3d.rect(w, 380, r=20), 50, both=True), x=0, y=20, z=550)
    for part in (leg, post, arm):
        s3d.material(part, "walnut", color="#7a5a40")
    return s3d.group("end", leg, post, arm)
