"""Import the original AK first-person arms, weapon and SMD animation clips.
Usage: python3 tools/import_cf_view.py /tmp/cf-source-ak
Source/credits: assets/classic/CREDITS.md (same AK archive).
"""
import json,re,sys,struct,math
from pathlib import Path
from collections import defaultdict
import numpy as np
from PIL import Image
src=Path(sys.argv[1])/'extra stuff/compile/v_'
out=Path(__file__).resolve().parents[1]/'assets/classic/ak/view';out.mkdir(parents=True,exist_ok=True)
def read(name):return (src/(name+'.smd')).read_text()
def quat(v):
 x,y,z=[a/2 for a in v];cx,sx=math.cos(x),math.sin(x);cy,sy=math.cos(y),math.sin(y);cz,sz=math.cos(z),math.sin(z)
 return [sx*cy*cz-cx*sy*sz,cx*sy*cz+sx*cy*sz,cx*cy*sz-sx*sy*cz,cx*cy*cz+sx*sy*sz]
def frames(s):
 blocks=re.split(r'time (\d+)\n',s.split('skeleton\n')[1].split('end')[0]);result=[]
 for i in range(1,len(blocks),2):
  rows=[list(map(float,l.split())) for l in blocks[i+1].splitlines() if l.strip()]
  result.append((int(blocks[i]),[r[1:4]+quat(r[4:7]) for r in rows]))
 return result
reference=read('PV-AK47');bind=frames(reference)[0][1]
nodes=[{'name':n,'parent':int(p),'pose':bind[int(i)]} for i,n,p in re.findall(r'(\d+) "([^"]+)" (-?\d+)',reference.split('skeleton')[0])]
groups=defaultdict(list)
for name in ['PV-AK47','PV-AK47_GR']:
 lines=read(name).split('triangles\n')[1].splitlines();i=0
 while i+3<len(lines):
  material=lines[i].strip();i+=1
  if material=='end':break
  tri=[]
  for l in lines[i:i+3]:
   a=l.split();joint=int(a[0]);v=list(map(float,a[1:9]));tri.append(v+[joint,0,0,0,1,0,0,0])
  i+=3;a=np.array(tri)
  if np.dot(np.cross(a[1,:3]-a[0,:3],a[2,:3]-a[0,:3]),a[0,3:6])<0:a[[1,2]]=a[[2,1]]
  groups[material].extend(a.tolist())
bin=bytearray();parts=[]
for mat,values in groups.items():
 path=Path(mat).stem+'.png';Image.open(src/mat).convert('RGB').save(out/path,optimize=True)
 a=np.asarray(values,dtype='<f4');parts.append({'map':path,'count':len(a),'offset':len(bin)});bin.extend(a.tobytes())
clips={}
for name,fps in [('idle_0',89),('reload',125),('fire',499),('select',350)]:
 f=frames(read(name));step=max(1,round(fps/60));chosen=f[::step]
 if chosen[-1]!=f[-1]:chosen.append(f[-1])
 a=np.asarray([x[1] for x in chosen],dtype='<f4');clips[name]={'times':[round(t/fps,6) for t,_ in chosen],'offset':len(bin),'count':len(chosen)};bin.extend(a.tobytes())
(out/'view.bin').write_bytes(bin);(out/'view.json').write_text(json.dumps({'bones':nodes,'parts':parts,'clips':clips},separators=(',',':')))
print(len(nodes),'bones;',len(bin),'bytes;',[(k,len(v['times'])) for k,v in clips.items()])
