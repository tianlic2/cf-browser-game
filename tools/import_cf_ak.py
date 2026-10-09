"""Convert the AK-47 SMD supplied in the public CF port to an embedded GLB.
Usage: python3 tools/import_cf_ak.py /tmp/cf-source-ak
The source model/texture and sounds remain Smilegate assets; see CREDITS.md.
"""
import io,json,struct,sys,shutil
from pathlib import Path
import numpy as np
from PIL import Image

root=Path(sys.argv[1]);out=Path(__file__).resolve().parents[1]/'assets/classic/ak'
out.mkdir(parents=True,exist_ok=True)
src=root/'extra stuff/compile/w_'
lines=(src/'AK47.smd').read_text().split('triangles\n')[1].splitlines()
a=np.array([[float(x) for x in l.split()[1:9]] for l in lines if l.strip() and l.strip()[0].isdigit()],dtype='<f4')
# The world reference is lying on its side: +X muzzle, -Y top, Z thickness.
a[:,:3]=a[:,:3][:,[2,1,0]]*[-1,-1,-1]
a[:,3:6]=a[:,3:6][:,[2,1,0]]*[-1,-1,-1]
a[:,:3]-=(a[:,:3].min(0)+a[:,:3].max(0))*.5
a[:,:3]*=.82/np.ptp(a[:,:3],axis=0).max()
# Choose winding against authored normals (GoldSrc SMDs differ by exporter).
for tri in a.reshape(-1,3,8):
    if np.dot(np.cross(tri[1,:3]-tri[0,:3],tri[2,:3]-tri[0,:3]),tri[0,3:6])<0:tri[[1,2]]=tri[[2,1]]
doc={'asset':{'version':'2.0','generator':'CF SMD conversion; see assets/classic/CREDITS.md'},'scene':0,'scenes':[{'nodes':[0]}],
     'nodes':[{'mesh':0}],'meshes':[{'primitives':[]}],'buffers':[],'bufferViews':[],'accessors':[],
     'materials':[{'name':'CF_AK47','pbrMetallicRoughness':{'baseColorTexture':{'index':0},'metallicFactor':.08,'roughnessFactor':.8}}],
     'textures':[{'source':0,'sampler':0}],'samplers':[{'magFilter':9729,'minFilter':9987,'wrapS':10497,'wrapT':10497}],'images':[]}
binary=bytearray()
def view(data):
    while len(binary)%4:binary.append(0)
    i=len(doc['bufferViews']);doc['bufferViews'].append({'buffer':0,'byteOffset':len(binary),'byteLength':len(data)});binary.extend(data);return i
attrs={}
for name,arr,typ in [('POSITION',a[:,:3],'VEC3'),('NORMAL',a[:,3:6],'VEC3'),('TEXCOORD_0',a[:,6:8]*[1,-1]+[0,1],'VEC2')]:
    acc={'bufferView':view(np.asarray(arr,dtype='<f4').tobytes()),'componentType':5126,'count':len(a),'type':typ}
    if name=='POSITION':acc.update(min=arr.min(0).tolist(),max=arr.max(0).tolist())
    attrs[name]=len(doc['accessors']);doc['accessors'].append(acc)
doc['meshes'][0]['primitives'].append({'attributes':attrs,'material':0})
png=io.BytesIO();Image.open(src/'AK47.bmp').convert('RGB').save(png,format='PNG')
doc['images'].append({'bufferView':view(png.getvalue()),'mimeType':'image/png'})
while len(binary)%4:binary.append(0)
doc['buffers'].append({'byteLength':len(binary)})
j=json.dumps(doc,separators=(',',':')).encode();j+=b' '*((-len(j))%4)
(out/'ak47.glb').write_bytes(struct.pack('<4sII',b'glTF',2,28+len(j)+len(binary))+struct.pack('<I4s',len(j),b'JSON')+j+struct.pack('<I4s',len(binary),b'BIN\0')+binary)
sounds=out.parents[2]/'audio/classic';sounds.mkdir(exist_ok=True)
for source,dest in [('ak47-1.wav','ak47_fire.wav'),('G_MZC_AK47_CLIPOUT.WAV','ak47_out.wav'),('G_MZC_AK47_CLIPIN.WAV','ak47_in.wav'),('G_RELOAD_AK47.WAV','ak47_bolt.wav')]:
    shutil.copyfile(root/'cstrike/sound/weapons'/source,sounds/dest)
print('AK-47:',len(a)//3,'triangles; 4 original sounds')
