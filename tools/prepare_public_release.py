#!/usr/bin/env python3
"""Stage the public game without changing or deleting local-only assets."""
from pathlib import Path
import json, shutil, subprocess
ROOT=Path(__file__).resolve().parents[1]
OMIT=('audio/classic/m4c_', 'assets/classic/m4c/', 'assets/classic/m4c_view/', 'assets/classic/deagle/', 'assets/classic/deagle_festa/', 'audio/classic/deagle_festa/', 'assets/local/', 'assets/preview/', 'assets/classic/m4_ironbeast/',
      'assets/classic/kukri_dragon/', 'models/skins/', 'assets/classic/motions/', 'audio/classic/ironbeast/',
      'audio/classic/kukri_dragon/', 'audio/weapons/hbr7/', 'scripts/harbor_', 'scripts/pyramid_map.js')
# Fox is the already admitted shared character, not a local-only weapon.
def publish(path):
    if path.startswith('assets/local/fox_npc/'):
        return path.rsplit('/',1)[-1] in ('fox.fbx','body.png','face.png','ddfcd20.png','visit-surface.png','CREDITS.md','provenance.json')
    return not path.startswith(OMIT)
def files():
    tracked=subprocess.check_output(['git','ls-files','-z'],cwd=ROOT).decode().split('\0')
    result={p for p in tracked if p and publish(p) and (ROOT/p).is_file()}
    for folder,glob in [('scripts','*.js'),('styles','*.css'),('lingyin-map/src','**/*'),
        ('assets/classic/m4a1_conv','**/*'),('assets/classic/deagle_conv','**/*'),('assets/transport-materials','**/*'),('assets/lingyin','**/*'),
        ('assets/hud','**/*'),('assets/ui','**/*'),('audio/footsteps/transport','**/*'),
        ('audio/weather','**/*'),('audio/impacts/flyby','**/*')]:
        for p in (ROOT/folder).glob(glob):
            if p.is_file() and publish(p.relative_to(ROOT).as_posix()):result.add(p.relative_to(ROOT).as_posix())
    for p in ['PUBLIC_RELEASE.md','assets/local/fox_npc/visit-surface.png','assets/map-posters/blacktown.png','.gitattributes','tools/prepare_public_release.py','tools/test_public_release_browser.mjs','tools/test_public_ordinary_browser.mjs','tools/test_player_flight_browser.mjs','tools/test_player_skills.mjs','tools/test_enemy_ballistics.mjs','tools/test_enemy_flyby_browser.mjs','tools/build_bullet_flyby_audio.py']:
        if (ROOT/p).is_file():result.add(p)
    return sorted(result)
if __name__=='__main__':
    import argparse
    parser=argparse.ArgumentParser();parser.add_argument('destination',type=Path);args=parser.parse_args()
    args.destination.mkdir(parents=True,exist_ok=True)
    paths=files()
    existing=[p for p in args.destination.rglob('*') if p.is_file()]
    if existing and not (args.destination/'public-release.json').is_file():
        raise SystemExit('Destination must be empty or an existing generated public release')
    for p in existing:
        if p.relative_to(args.destination).as_posix() not in paths and p.name!='public-release.json':p.unlink()
    for rel in paths:
        dst=args.destination/rel;dst.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(ROOT/rel,dst)
    sizes=[((ROOT/p).stat().st_size,p) for p in paths]
    summary={'files':len(paths),'bytes':sum(n for n,_ in sizes),'largest':sorted(sizes,reverse=True)[:12],
        'omittedTracked':[p for p in subprocess.check_output(['git','ls-files','-z'],cwd=ROOT).decode().split('\0') if p and not publish(p)]}
    (args.destination/'public-release.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:v for k,v in summary.items() if k!='omittedTracked'},ensure_ascii=False))
