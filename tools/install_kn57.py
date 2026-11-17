"""Install locally only; original KN-57 plus user-approved AK draw sound."""
from pathlib import Path
import json,hashlib,shutil,sys
ROOT=Path(__file__).resolve().parents[1];src=ROOT/'assets/preview/gamebanana-weapons/kn57';world=ROOT/'assets/preview/gamebanana-weapons/kn57-world';dst=ROOT/'assets/local/kn57';dst.mkdir(parents=True,exist_ok=True)
sys.path.insert(0,str(ROOT/'tools'))
from install_admitted_gamebanana_weapons import static_world_glb
v=json.loads((src/'view.json').read_text());files={'view.json','view.bin',*(p['map'] for p in v['parts']),*(p['normalMap'] for p in v['parts'] if p.get('normalMap')),*(p['emissiveMap'] for p in v['parts'] if p.get('emissiveMap')),*(p['roughnessMap'] for p in v['parts'] if p.get('roughnessMap')),*(p['specularIntensityMap'] for p in v['parts'] if p.get('specularIntensityMap')),*(p['phongMap'] for p in v['parts'] if p.get('phongMap')),*v['fireSounds'],*(e['audio'] for seq in v['events'].values() for e in seq)}
for name in files:shutil.copyfile(src/name,dst/name)
w=static_world_glb(world,dst/'world.glb','kn57-source-world',.82)
# The supplied third-person file is an AK-style world mesh and is intentionally
# retained for existing drops/NPC compatibility.  Backpack and HUD artwork must
# instead show the admitted KN-57 itself, so bake the weapon-only pieces from
# the 94-bone first-person source (the hand part is marked weapon=false).
ui=static_world_glb(src,dst/'ui.glb','kn57-ui-original',.82)
manifest={'source':'https://gamebanana.com/mods/646748','file':1604344,'sourceMD5':'580d51798314f17811edb5efc1c873c8','license':'CC BY-NC-ND 4.0; Activision original assets; local only','publicRedistributionApproved':False,'audioException':'ak47_bolt.wav from backpack 1, user approved','world':w,'ui':ui,'uiSha256':hashlib.sha256((dst/'ui.glb').read_bytes()).hexdigest(),'files':{n:hashlib.sha256((dst/n).read_bytes()).hexdigest() for n in sorted(files)}}
(dst/'provenance.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2));print('KN57 local install',len(files),w)
