import sand3d as s3d

# A small wooden chair: a seat on four tapered legs, two back posts and two rounded rails. The cushion is drawn in the
# world, in the sitter's colour. Its back is on +Y, which is the world's -Z (behind the chick).


def chair(seat_h=440, back=360):
    seat = s3d.at(seat_part(), y=60, z=seat_h - 25)
    legs = s3d.at(leg(seat_h - 25), on=s3d.grid(2, 2, 440, 420).move(y=60))
    posts = s3d.at(back_post(), on=s3d.grid(2, 1, 440).move(y=back), z=seat_h + 10)
    rails = s3d.at(rail(), on=[s3d.Frame((0, back, z)) for z in (660, 920)])
    return s3d.assembly("chair", seat, legs, posts, rails)


def seat_part(w=520, t=50):
    seat = s3d.extrude("seat", s3d.rect(w, w, r=30), t)
    s3d.fillet(seat, 8, edges="top")
    s3d.material(seat, "pine", color="#c99a6a")
    return seat


def leg(h, d=60):
    leg = s3d.cone("leg", d, h, d2=d * 0.87)
    s3d.material(leg, "oak", color="#a77a4f")
    return leg


def back_post(h=600, d=52):
    post = s3d.cylinder("post", d, h)
    s3d.material(post, "oak", color="#a77a4f")
    return post


def rail(length=490, d=70):
    r, h = d / 2, length / 2 - d / 2
    rail = s3d.revolve("rail", s3d.poly([(0, -h - r), s3d.arc((0, -h), r, -90, 0), s3d.arc((0, h), r, 0, 90)]))
    s3d.at(rail, ry=90)  # a capsule lying along X
    s3d.material(rail, "pine", color="#c99a6a")
    return rail
