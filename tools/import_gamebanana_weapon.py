"""Convert a local GoldSrc view to ClassicView without replacing its rig.

Reference format: ValveSoftware/halflife engine/studio.h and StudioModelRenderer.
No downloaded scripts are executed. All authored frames and sound-event frames
are retained; missing dependencies remain explicit admission failures.
"""
import argparse
from array import array
from collections import defaultdict
import hashlib
import json
import math
from pathlib import Path
import shutil
import struct
import sys
import zlib

from inspect_goldsrc_weapons import inspect


def quaternion(a):
    x, y, z = (v / 2 for v in a)
    sx, cx, sy, cy, sz, cz = math.sin(x), math.cos(x), math.sin(y), math.cos(y), math.sin(z), math.cos(z)
    return [sx*cy*cz-cx*sy*sz, cx*sy*cz+sx*cy*sz, cx*cy*sz-sx*sy*cz, cx*cy*cz+sx*sy*sz]


def matrix(v):
    x, y, z = v[3:]
    sx, cx, sy, cy, sz, cz = math.sin(x), math.cos(x), math.sin(y), math.cos(y), math.sin(z), math.cos(z)
    return [[cz*cy, cz*sy*sx-sz*cx, cz*sy*cx+sz*sx, v[0]],
            [sz*cy, sz*sy*sx+cz*cx, sz*sy*cx-cz*sx, v[1]],
            [-sy, cy*sx, cy*cx, v[2]]]


def multiply(a, b):
    return [[sum(a[r][k]*b[k][c] for k in range(3)) if c < 3 else
             sum(a[r][k]*b[k][3] for k in range(3))+a[r][3] for c in range(4)] for r in range(3)]


def transform(m, v, normal=False):
    return [sum(m[r][k]*v[k] for k in range(3))+(0 if normal else m[r][3]) for r in range(3)]


def png(w, h, indices, palette, masked):
    def chunk(tag, payload):
        return struct.pack('>I', len(payload))+tag+payload+struct.pack('>I', zlib.crc32(tag+payload)&0xffffffff)
    rgba = bytearray()
    for y in range(h):
        rgba.append(0)
        for i in indices[y*w:(y+1)*w]:
            rgba.extend(palette[i*3:i*3+3]); rgba.append(0 if masked and i == 255 else 255)
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR', struct.pack('>2I5B', w,h,8,6,0,0,0))+chunk(b'IDAT', zlib.compress(rgba,9))+chunk(b'IEND', b'')


def convert(src, output, sound_root, aliases, fire, reload_segments=None):
    data = src.read_bytes()
    report = inspect(src)
    assert report['controllers'] == 0, 'Bone controller rigs require explicit support, not silent approximations'
    assert all(c['group'] == 0 for c in report['clips']), 'External animation groups must be supplied first'
    output.mkdir(parents=True, exist_ok=True)
    def get(fmt, at): return struct.unpack_from('<'+fmt, data, at)
    def string(raw): return raw.split(b'\0',1)[0].decode('utf-8','replace')
    nb, bo = get('2i',140)
    bones, worlds, raw_bones = [], [], []
    for i in range(nb):
        r = get('32sii6i12f', bo+i*112)
        name, parent, base, scales = string(r[0]), r[1], r[9:15], r[15:21]
        assert parent < i
        raw_bones.append((base,scales))
        local = matrix(base)
        worlds.append(multiply(worlds[parent],local) if parent>=0 else local)
        bones.append({'name':name,'parent':parent,'pose':list(base[:3])+quaternion(base[3:])})
    nt,to = get('2i',180)
    textures = []
    for i in range(nt):
        name,flags,w,h,pixels = get('64s4i',to+i*80)
        name=string(name); length=w*h
        palette=data[pixels+length:pixels+length+768]
        assert len(palette)==768 and w>0 and h>0
        image_name=f'tex{i}.png'
        (output/image_name).write_bytes(png(w,h,data[pixels:pixels+length],palette,flags&64))
        textures.append({'name':name,'map':image_name,'w':w,'h':h,'flags':flags})
    assert nt, 'Missing embedded textures; supply the matching T.mdl before conversion'
    skin_count, skin_families, skin_at=get('3i',192)
    skins=get(str(skin_count)+'H',skin_at)
    np,po=get('2i',204)
    groups=defaultdict(list)
    for i in range(np):
        name,count,base,models=get('64s3i',po+i*76)
        name=string(name)
        assert count>=1
        # GoldSrc body value 0 chooses the first authored model in each part.
        r=get('64sif10i',models)
        meshes,mesh_at,nv,vi,vertices,nn,ni,normals=r[3:11]
        vb=data[vi:vi+nv]; nbo=data[ni:ni+nn]
        positions=[transform(worlds[vb[j]],get('3f',vertices+j*12)) for j in range(nv)]
        norms=[transform(worlds[nbo[j]],get('3f',normals+j*12),True) for j in range(nn)]
        for mi in range(meshes):
            _,at,skinref,_,_=get('5i',mesh_at+mi*20)
            tex_id=skins[skinref];tex=textures[tex_id]
            target=groups[(tex_id,name)]
            while True:
                count=get('h',at)[0];at+=2
                if not count: break
                records=[get('4h',at+j*8) for j in range(abs(count))];at+=abs(count)*8
                for j in range(2,len(records)):
                    tri=([records[j-2],records[j-1],records[j]] if j%2==0 else
                         [records[j-1],records[j-2],records[j]]) if count>0 else [records[0],records[j-1],records[j]]
                    # Determine winding from authored normals, in native coordinates.
                    p=[positions[v[0]] for v in tri];a=[p[1][k]-p[0][k] for k in range(3)];b=[p[2][k]-p[0][k] for k in range(3)]
                    cross=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
                    if sum(cross[k]*norms[tri[0][1]][k] for k in range(3))<0:tri[1],tri[2]=tri[2],tri[1]
                    for v,n,s,t in tri:
                        # GoldSrc stores top-origin texel t. ClassicView consumes
                        # the existing SMD-style V convention and flips V once;
                        # serialize its complement so the final GPU UV is t/h.
                        # Do not change ClassicView: existing approved rigs rely
                        # on that shared flip and must remain visually unchanged.
                        target.append(positions[v]+norms[n]+[s/tex['w'],1-t/tex['h']]+[vb[v],0,0,0,1,0,0,0])
    binary=bytearray()
    def append(values):
        offset=len(binary);a=array('f',values)
        if sys.byteorder!='little':a.byteswap()
        binary.extend(a.tobytes());return offset
    parts=[]
    for (tex_id,part),vertices in groups.items():
        tex=textures[tex_id]
        parts.append({'map':tex['map'],'textureName':tex['name'],'bodypart':part,'count':len(vertices),
                      'offset':append(v for row in vertices for v in row),'weapon':'hand' not in part.lower() and part.lower()!='effect',
                      'additive':bool(tex['flags']&32) or part.lower()=='effect','effect':part.lower()=='effect'})
    ns,so=get('2i',164)
    clips={};all_events={};raw_clips=[]
    # Independent stream decoder: signed 16-bit values, repeated-tail runs.
    def channel(at, offset, frame):
        if not offset:return 0
        p=at+offset;k=frame
        for _ in range(100000):
            valid,total=get('2B',p)
            assert 0<valid<=total, f'Invalid animation run at {p}'
            if k<total:return get('h',p+2*(min(k,valid-1)+1))[0]
            k-=total;p+=2*(valid+1)
        raise ValueError('Unbounded animation stream')
    for i in range(ns):
        at=so+i*176;meta=report['clips'][i];name=meta['name']
        if not name.strip() or name in clips:name=f'sequence_{i}'
        nf=meta['frames'];fps=get('f',at+32)[0];anim=get('i',at+124)[0]
        values=[]
        for f in range(nf):
            for j,(base,scales) in enumerate(raw_bones):
                bone_at=anim+j*12; offsets=get('6H',bone_at)
                v=[base[k]+channel(bone_at,offsets[k],f)*scales[k] for k in range(6)]
                values.extend(v[:3]+quaternion(v[3:]))
        clips[name]={'times':[round(f/fps,8) for f in range(nf)],'offset':append(values),'count':nf}
        all_events[name]=[dict(e,time=e['frame']/fps) for e in meta['events']]
        raw_clips.append(dict(meta,key=name))
    aliases=aliases or {}
    for alias,original in aliases.items():
        assert original in clips, f'Clip {original} missing'
        clips[alias]=clips[original];all_events[alias]=all_events[original]
    if reload_segments:
        times=[];values=[];merged_events=[];start=0
        for name in reload_segments:
            c=clips[name];n=c['count']*nb*7*4
            values.extend(struct.unpack('<'+str(n//4)+'f',binary[c['offset']:c['offset']+n]))
            times.extend(start+t for t in c['times'])
            merged_events.extend(dict(e,time=start+e['time']) for e in all_events[name])
            step=c['times'][-1]-c['times'][-2] if c['count']>1 else 1/30
            start=times[-1]+step
        clips['reload']={'times':times,'offset':append(values),'count':len(times)}
        all_events['reload']=merged_events
    sound_files={}
    for p in sound_root.rglob('*'):
        if p.is_file() and p.suffix.lower() in ('.wav','.mp3','.ogg'):
            key=p.name.casefold()
            if key in sound_files and sound_files[key].read_bytes()!=p.read_bytes():
                raise ValueError(f'Ambiguous audio dependency: {key}; narrow --sounds')
            sound_files[key]=p
    missing=[];events={};copied={}
    def sound(option):
        key=option.replace('\\','/').split('/')[-1].casefold()
        p=sound_files.get(key)
        if not p:
            missing.append(option);return None
        if key not in copied:
            dest='audio/'+key
            (output/'audio').mkdir(exist_ok=True);shutil.copyfile(p,output/dest);copied[key]=dest
        return copied[key]
    for name,items in all_events.items():
        events[name]=[]
        for e in items:
            if e['id']!=5004:continue
            audio=sound(e['option'])
            events[name].append(dict(e,name=e['option'],audio=audio))
    firing=[sound(s) for s in fire]
    required=['idle_0','select','fire','reload']
    missing_clips=[c for c in required if c not in clips]
    checks={'requiredClips':not missing_clips,'fingerRig':report['fingerBones']>=10,
            'sourceSoundDependencies':not missing,'fireSounds':bool(firing) and all(firing),
            'reloadFoley':bool(events.get('reload')),'drawFoley':bool(events.get('select'))}
    result={'bones':bones,'parts':parts,'clips':clips,'events':events,'uvConvention':'classic-smd-v',
            # GoldSrc's right-handed view presentation: source X forward,
            # Y screen-right, Z up. Retain the source's handedness conversion
            # on the whole rig, never by changing individual bones.
            'transform':[0,.0254,0,0, 0,0,.0254,0, -.0254,0,0,0, 0,0,0,1],
            'muzzleAxis':'x','muzzleSign':1,'fireSounds':firing,
            'candidate':{'sourceFile':str(src),'sha256':hashlib.sha256(data).hexdigest(),
                         'nativeClips':raw_clips,'reloadSegments':reload_segments,'missingSounds':sorted(set(missing)),
                         'missingClips':missing_clips,'checks':checks,
                         'status':'awaiting-visual-audio-review' if all(checks.values()) else 'incomplete',
                         'license':'Restricted mod port; local preview only; no public redistribution approval'}}
    (output/'view.bin').write_bytes(binary)
    (output/'view.json').write_text(json.dumps(result,separators=(',',':')))
    print(json.dumps({'output':str(output),'bones':nb,'triangles':sum(p['count']//3 for p in parts),
                      'bytes':len(binary),'checks':checks,'missingSounds':sorted(set(missing)),
                      'clips':{k:round(c['times'][-1],3) for k,c in clips.items()}},ensure_ascii=False))


if __name__=='__main__':
    p=argparse.ArgumentParser()
    p.add_argument('source',type=Path);p.add_argument('output',type=Path)
    p.add_argument('--sounds',type=Path,required=True);p.add_argument('--clips',type=json.loads,default={})
    p.add_argument('--fire',nargs='+',default=[])
    p.add_argument('--reload-segments',nargs='+')
    a=p.parse_args();convert(a.source,a.output,a.sounds,a.clips,a.fire,a.reload_segments)
