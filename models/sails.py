import sand3d as s3d

# The windmill's four sails round their hub, built about the hub so the world can turn them: each a stock with a lattice
# of bars and cloth over most of it. They turn in the XZ plane (the world's XY), facing -Y (the world's +Z).


def sails(n=4):
    hub = s3d.at(s3d.extrude("hub", s3d.circle(200), 160, both=True), rx=90)
    s3d.material(hub, "walnut", color="#7a5a40")
    blades = [s3d.at(sail(), ry=-k * 360 / n) for k in range(n)]
    return s3d.assembly("sails", hub, blades)


def sail(length=1600, bars=(350, 600, 850, 1100, 1350)):
    stock = s3d.box("stock", 50, 40, length)
    lattice = [s3d.at(s3d.box("bar", 260, 25, 25), x=130, y=-10, z=z - 12) for z in bars]
    rail = s3d.at(s3d.box("bar", 25, 25, 1100), x=250, y=-10, z=300)
    cloth = s3d.at(s3d.box("cloth", 220, 10, 900), x=130, y=-20, z=500)
    for p in (stock, *lattice, rail):
        s3d.material(p, "walnut", color="#7a5a40")
    s3d.material(cloth, "fabric", color="#f3ede2")
    return s3d.group("sail", stock, lattice, rail, cloth)
