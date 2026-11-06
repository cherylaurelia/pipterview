import sand3d as s3d

# The round tea table Pip and you sit at. The pale top, its darker apron, a tapered pedestal and a crossed foot.


def table(top_h=760):
    foot = crossed_foot()
    pedestal = s3d.at(pedestal_part(top_h - 70), on=foot.face("top"))
    apron = s3d.at(apron_part(), z=top_h - 70)
    top = s3d.at(tabletop(), z=top_h - 35)
    return s3d.assembly("table", foot, pedestal, apron, top)


def tabletop(d=1560, t=50, edge_r=12):
    top = s3d.cone("top", d, t, d2=d - 40)
    s3d.fillet(top, edge_r, edges="top")
    s3d.material(top, "birch", color="#e8cba4")
    return top


def apron_part(d=1440, h=40):
    apron = s3d.cylinder("apron", d, h)
    s3d.material(apron, "oak", color="#a77a4f")
    return apron


def pedestal_part(h, d=180):
    post = s3d.cone("pedestal", d, h, d2=d * 0.75)
    s3d.material(post, "oak", color="#a77a4f")
    return post


def crossed_foot(span=750, w=70, h=50):
    bar = s3d.extrude("foot", s3d.slot(span, w), h)
    other = s3d.at(s3d.copy(bar), rz=90)
    s3d.join(bar, other)
    s3d.at(bar, rz=45)
    s3d.fillet(bar, 10, edges="top")
    s3d.material(bar, "oak", color="#a77a4f")
    return bar
