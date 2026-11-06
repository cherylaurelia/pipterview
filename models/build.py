# /// script
# requires-python = ">=3.13,<3.14"
# dependencies = ["sand3d==1.6.2"]
# ///
"""Builds the island's sand3d models into public/models/ as GLB, compressed with meshoptimizer's gltfpack: `npm run models`
(needs uv, and `npm install` for gltfpack)."""

import importlib
import subprocess
import sys
from pathlib import Path

import sand3d as s3d

HERE = Path(__file__).parent
OUT = HERE.parent / "public" / "models"
MODELS = ["table", "chair", "bench", "cottage", "windmill", "sails", "dock"]

sys.path.insert(0, str(HERE))
OUT.mkdir(parents=True, exist_ok=True)
for name in sys.argv[1:] or MODELS:
    s3d.empty_scene()
    program = importlib.import_module(name)
    path, raw = OUT / f"{name}.glb", OUT / f"{name}.raw.glb"
    s3d.export(getattr(program, name)(), str(raw))
    # simplified (within gltfpack's default 1% error), quantized and meshopt-compressed (models.tsx decodes it), keeping
    # each part's node and each colour's material; the file only takes the model's name once that worked
    subprocess.run(["npx", "--no-install", "gltfpack", "-i", raw, "-o", path, "-cc", "-kn", "-km", "-si", "0.2"], check=True, stdout=subprocess.DEVNULL)
    raw.unlink()
    print(f"{path.relative_to(HERE.parent)}  {path.stat().st_size / 1024:.0f} KB")
