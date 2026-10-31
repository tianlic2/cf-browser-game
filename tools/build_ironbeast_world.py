"""Build the locally used Iron Beast rigid world model from its approved view rig."""
from pathlib import Path
from install_admitted_gamebanana_weapons import static_world_glb

root = Path(__file__).resolve().parents[1]
asset = root / 'assets/classic/m4_ironbeast'
print(static_world_glb(asset, asset / 'world-baked.glb', 'ironbeast-idle-world', .82))
