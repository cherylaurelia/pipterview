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
MODELS = ["table", "chair"]

sys.path.insert(0, str(HERE))
OUT.mkdir(parents=True, exist_ok=True)
for name in sys.argv[1:] or MODELS:
    s3d.empty_scene()
    program = importlib.import_module(name)
    path = OUT / f"{name}.glb"
    s3d.export(getattr(program, name)(), str(path))
    # quantized and meshopt-compressed (models.tsx decodes it), keeping each part's node and each colour's material
    subprocess.run(["npx", "--no-install", "gltfpack", "-i", path, "-o", path, "-cc", "-kn", "-km"], check=True, capture_output=True)
    print(f"{path.relative_to(HERE.parent)}  {path.stat().st_size / 1024:.0f} KB")
