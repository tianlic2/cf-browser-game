"""Extract the default smoke texture and original sounds from the classic pack.
Usage: python3 tools/import_cf_grenade_pack.py /tmp/cf-grenade-pack
Run import_cf_grenades.py for frag/flash first. See assets/classic/CREDITS.md.
"""
from pathlib import Path
import struct,sys,shutil,json
from PIL import Image
root=Path(sys.argv[1]);repo=Path(__file__).resolve().parents[1]
base=repo/'assets/classic/grenades';dest=base/'smoke';dest.mkdir(exist_ok=True)
for p in (base/'flash').iterdir():shutil.copyfile(p,dest/p.name)
b=(root/'Smokegrenade/Variants/Smokegrenade/models/v_smokegrenade.mdl').read_bytes()
assert b[:4]==b'IDST' and struct.unpack_from('<i',b,4)[0]==10
count,offset=struct.unpack_from('<ii',b,180)
for i in range(count):
 n,flags,w,h,at=struct.unpack_from('<64s4i',b,offset+80*i);name=n.split(b'\0')[0].decode()
 print(name,w,h)
 if name.startswith('PV-'):
  im=Image.frombytes('P',(w,h),b[at:at+w*h]);im.putpalette(b[at+w*h:at+w*h+768]);im.convert('RGB').save(dest/'PV-FLASHBANG.png',optimize=True)
sounds=repo/'audio/classic'
for source,name in [('Grenades/sound/weapons/T_HEGRENADE_PIN.WAV','grenade_pin.wav'),('Grenades/sound/weapons/explode3.WAV','grenade_explode.wav'),('Flashbang/sound/weapons/flashbang-1.WAV','grenade_flash.wav'),('Smokegrenade/sound/weapons/sg_explode.WAV','grenade_smoke.wav')]:
 shutil.copyfile(root/source,sounds/name)
