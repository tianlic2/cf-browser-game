"""Convert locally downloaded Source ports to static browser assets.

Usage: python3 tools/import_cf_source.py /tmp/cf-source-map /tmp/cf-source-swat
Requires Pillow and numpy. Does not download or execute anything from the packs.
Format references: ValveSoftware/source-sdk-2013 src/public/{bspfile,studio,optimize}.h.
Asset provenance and redistribution restrictions: assets/classic/CREDITS.md.
"""
import io, json, math, re, struct, sys
from pathlib import Path
from collections import defaultdict
from itertools import combinations
import numpy as np
from PIL import Image

OUT = Path(__file__).resolve().parents[1] / 'assets/classic'
OUT.mkdir(parents=True, exist_ok=True)
def unpack(b, fmt, p=0): return struct.unpack_from('<'+fmt, b, p)
def string(b, p): return b[p:b.index(b'\0', p)].decode(errors='replace')
def save_json(path, data): path.write_text(json.dumps(data, separators=(',',':')), encoding='utf8')

def vtf(path):
    b = path.read_bytes()
    assert b[:4] == b'VTF\0', path
    major, minor, header, w, h = unpack(b, 'IIIHH', 4)
    fmt = unpack(b, 'I', 52)[0]; mips = b[56]
    lowfmt = unpack(b, 'I', 57)[0]; lw, lh = b[61:63]
    def size(w,h,f):
        if f in (13,20): return max(1,(w+3)//4)*max(1,(h+3)//4)*8
        if f in (14,15): return max(1,(w+3)//4)*max(1,(h+3)//4)*16
        return w*h*{0:4,1:4,2:3,3:3,4:2,5:1,6:2,7:1,8:1,9:3,11:4,12:4,16:4,24:8}.get(f,4)
    pos = header + (size(lw,lh,lowfmt) if lw and lh else 0)
    if minor >= 3:
        for i in range(unpack(b,'I',68)[0]):
            tag, off = unpack(b,'II',80+i*8)
            if tag & 0xffffff == 0x30: pos = off
    for mip in range(mips-1,0,-1): pos += size(max(1,w>>mip),max(1,h>>mip),fmt)
    data=b[pos:pos+size(w,h,fmt)]
    if fmt in (13,14,15,20): return Image.frombytes('RGBA',(w,h),data,'bcn',(1 if fmt in (13,20) else 2 if fmt==14 else 3,'RGBA'))
    modes={0:('RGBA','RGBA'),1:('RGBA','ABGR'),2:('RGB','RGB'),3:('RGB','BGR'),11:('RGBA','ARGB'),12:('RGBA','BGRA'),16:('RGB','BGRX')}
    mode,raw=modes[fmt]; return Image.frombytes(mode,(w,h),data,'raw',raw).convert('RGBA')

def materials(root, names, target):
    files={str(p.relative_to(root)).replace('\\','/').lower():p for p in root.rglob('*') if p.is_file()}
    result=[]
    for name in names:
        key='materials/'+name.lower()+'.vmt'; p=files.get(key)
        text=p.read_text(errors='replace') if p else ''
        m=re.search(r'"?\$basetexture"?\s+"?([^"\s]+)',text,re.I)
        tex=m.group(1).replace('\\','/').lower() if m else name.lower()
        t=files.get('materials/'+tex+'.vtf')
        record={'name':name}
        if t:
            dest=target/(re.sub(r'[^a-z0-9_-]','_',name.lower())+'.png')
            im=vtf(t); im.save(dest,optimize=True);record['map']=str(dest.relative_to(OUT))
        if re.search(r'\$(?:alphatest|translucent)"?\s+"?1',text,re.I): record['alphaTest']=.5
        result.append(record)
    return result

def map_convert(root):
    dst=OUT/'transport';dst.mkdir(exist_ok=True)
    b=(root/'maps/cf_transportship.bsp').read_bytes()
    assert unpack(b,'4si')==(b'VBSP',20)
    lumps=[unpack(b,'4i',8+i*16) for i in range(64)]
    def lump(i): p,n,*_=lumps[i]; return b[p:p+n]
    def rows(i,fmt): return list(struct.iter_unpack('<'+fmt,lump(i)))
    ents=[dict(re.findall(r'"([^"\n]+)"\s*"([^"\n]*)"',x)) for x in re.findall(r'\{(.*?)\}',lump(0).decode(errors='replace'),re.S)]
    planes=rows(1,'4fi'); verts=np.array(rows(3,'3f'));edges=rows(12,'2H');se=[r[0] for r in rows(13,'i')]
    ti=rows(6,'16f2i');td=rows(2,'3f5i');st=rows(44,'i');names=[string(lump(43),st[r[3]][0]).lower() for r in td]
    # Source: inches, +Z up. Deck top is z=64; preserve the source X/Y footprint.
    # The playable ship is centered between its two end walls, not the skybox.
    scale=.0254; center=[192,160,64]
    def point(v): return [(v[0]-center[0])*scale,(v[2]-center[2])*scale,(v[1]-center[1])*scale]
    # Swapping Y/Z reverses handedness; reverse polygon winding below.
    # Only worldspawn surfaces. Model 2/3 are invisible buy-zone volumes whose
    # editor material must never be drawn or treated as walls in the spawn room.
    world=rows(14,'9f3i')[0]
    faces=rows(7,'HBBihhhh4Bif4iiHHI')[world[10]:world[10]+world[11]]
    light=lump(8);atlas=Image.new('RGB',(2048,2048),(255,255,255));ax=ay=1;rowh=0
    groups=defaultdict(list); visible_faces=[]
    for f in faces:
        plane,side,_,first,n,tex,disp,*_=f
        if tex<0 or n<3:continue
        t=ti[tex]; name=names[t[17]]
        if name.startswith('tools/') or t[16]&0x6:continue # sky/nodraw compiled faces
        if 'water' in name:continue
        pts=[verts[edges[abs(se[first+j])][0 if se[first+j]>=0 else 1]] for j in range(n)]
        # Ignore the remote 3D skybox; the original six-face sky is imported separately.
        if max(abs(v[0]) for v in pts)>3000 or max(abs(v[1]) for v in pts)>4000:continue
        uv=[[(np.dot(v,t[:3])+t[3])/td[t[17]][4],1-(np.dot(v,t[4:7])+t[7])/td[t[17]][5]] for v in pts]
        ofs=f[12];lmmin=f[14:16];lw,lh=[x+1 for x in f[16:18]]
        luv=[[0,0]]*n
        if ofs>=0 and 0<lw<1024 and 0<lh<1024:
            if ax+lw+2>2048: ax=1;ay+=rowh+2;rowh=0
            assert ay+lh+2<=2048
            raw=np.frombuffer(light,dtype=np.uint8,count=lw*lh*4,offset=ofs).reshape(lh,lw,4)
            exp=raw[:,:,3].astype(np.int16);exp[exp>127]-=256
            linear=np.clip(raw[:,:,:3].astype(float)*np.exp2(exp[:,:,None])/255*2,0,1)
            srgb=np.where(linear<=.0031308,linear*12.92,1.055*linear**(1/2.4)-.055)
            image=Image.fromarray((srgb*255).astype(np.uint8));atlas.paste(image,(ax,ay))
            # Clamp gutters stop neighboring faces bleeding into seams at a distance.
            atlas.paste(image.crop((0,0,lw,1)),(ax,ay-1));atlas.paste(image.crop((0,lh-1,lw,lh)),(ax,ay+lh))
            atlas.paste(image.crop((0,0,1,lh)),(ax-1,ay));atlas.paste(image.crop((lw-1,0,lw,lh)),(ax+lw,ay))
            luv=[[(ax+.5+np.dot(v,t[8:11])+t[11]-lmmin[0])/2048,1-(ay+.5+np.dot(v,t[12:15])+t[15]-lmmin[1])/2048] for v in pts]
            ax+=lw+2;rowh=max(rowh,lh)
        for j in range(1,n-1):
            for k in (0,j+1,j):groups[name].extend(point(pts[k])+uv[k]+luv[k])
        visible_faces.append((name,[point(p) for p in pts]))
    atlas.save(dst/'lightmap.png',optimize=True)
    mats=materials(root/'pak',list(groups),dst)
    binary=bytearray();parts=[]
    for mat,values in zip(mats,groups.values()):
        parts.append({'material':mat,'offset':len(binary),'count':len(values)//7})
        binary.extend(np.array(values,dtype='<f4').tobytes())
    (dst/'map.bin').write_bytes(binary)
    # Convex brush halfspaces are also retained: runtime collision must not turn
    # diagonal stairs/walls into a larger invisible axis-aligned wall.
    bs=rows(19,'Hhhh');brushes=[]
    for first,n,contents in rows(18,'3i'):
        if not contents & (1|2|0x10000):continue
        ps=np.array([planes[bs[first+j][0]][:4] for j in range(n)])
        pts=[]
        for ids in combinations(range(n),3):
            a=ps[list(ids),:3];d=ps[list(ids),3]
            if abs(np.linalg.det(a))<1e-5:continue
            v=np.linalg.solve(a,d)
            if np.all(ps[:,:3]@v<=ps[:,3]+.02):pts.append(v)
        if not pts:continue
        world=np.array([point(v) for v in pts]);lo=world.min(0);hi=world.max(0)
        # Spawn tunnels descend below the deck to -2.4384m. Their floors and
        # stair treads must survive the same import as the visible BSP faces.
        if hi[1]<-4 or lo[1]>14 or max(abs(lo[0]),abs(hi[0]))>35 or max(abs(lo[2]),abs(hi[2]))>58:continue
        textureNames=sorted({names[ti[bs[first+j][1]][17]] for j in range(n) if bs[first+j][1]>=0})
        # The enclosed sky volume is not a gameplay barrier.
        if textureNames and all('skybox' in t or 'blackrockshooter' in t for t in textureNames):continue
        planesWorld=[[p[0],p[2],p[1],(p[3]-np.dot(p[:3],center))*scale] for p in ps]
        brushes.append({'x':float((lo[0]+hi[0])/2),'z':float((lo[2]+hi[2])/2),'hx':float((hi[0]-lo[0])/2),'hz':float((hi[2]-lo[2])/2),'h':float(hi[1]),'y0':float(lo[1]),'planes':planesWorld,'textures':textureNames})
    # Thin steel treads in each spawn stair flight. Mark whole repeated runs,
    # not other narrow ledges: runtime uses a small heel/toe contact patch here.
    flights=defaultdict(list)
    for c in brushes:
        if 0<c['h']-c['y0']<.06 and c['h']<0 and 1<c['hx']<1.5 and .2<c['hz']<.5:
            flights[round(c['x'],3)].append(c)
    for flight in flights.values():
        if len(flight)>=8:
            for c in flight:c['stair']=True
    spawns={team:[point(list(map(float,e['origin'].split()))) for e in ents if e.get('classname')==cls] for team,cls in [('player','info_player_counterterrorist'),('enemy','info_player_terrorist')]}
    for team in spawns:
        for p in spawns[team]:p[1]=0
    # Topdown comes from visible horizontal surfaces, not collision helper brushes.
    top=[]
    for name,pts in visible_faces:
        p=np.array(pts);lo=p.min(0);hi=p.max(0)
        if hi[1]-lo[1]>.015 or not .4<hi[1]<9:continue
        if hi[0]-lo[0]<.3 or hi[2]-lo[2]<.3:continue
        top.append(dict(x=float((lo[0]+hi[0])/2),z=float((lo[2]+hi[2])/2),hx=float((hi[0]-lo[0])/2),hz=float((hi[2]-lo[2])/2),kind='container',y0=float(hi[1])))
    sky={}
    files={str(p.relative_to(root/'pak')).lower():p for p in (root/'pak').rglob('*.vtf')}
    for face in ('up','dn','ft','bk','lf','rt'):
        path=dst/('sky_'+face+'.png');vtf(files['materials/skybox/cf_ship'+face+'.vtf']).save(path);sky[face]=str(path.relative_to(OUT))
    save_json(dst/'map.json',{'parts':parts,'colliders':brushes,'spawns':spawns,'topdown':top,'sky':sky,'bounds':{'hw':24,'hl':46}})
    print('Map:',len(parts),'materials',len(binary)//28//3,'triangles',len(brushes),'brushes',len(top),'top surfaces')

def soldier_convert(root):
    dst=OUT/'swat';dst.mkdir(exist_ok=True)
    base=root/'cstrike/models/player/ct_urban';mdl=base.with_suffix('.mdl').read_bytes();vvd=base.with_suffix('.vvd').read_bytes();vtx=base.with_suffix('.dx90.vtx').read_bytes()
    assert mdl[:4]==b'IDST' and unpack(mdl,'i',4)[0] in (44,48,49)
    assert unpack(mdl,'i',8)[0]==unpack(vvd,'i',8)[0]==unpack(vtx,'i',16)[0]
    nb,bi=unpack(mdl,'2i',156);bones=[]
    for i in range(nb):
        p=bi+i*216;name,par=unpack(mdl,'2i',p)
        bones.append({'name':string(mdl,p+name),'parent':par,'position':unpack(mdl,'3f',p+32),'quaternion':unpack(mdl,'4f',p+44)})
    nt,ti=unpack(mdl,'2i',204);names=[string(mdl,ti+i*64+unpack(mdl,'i',ti+i*64)[0]) for i in range(nt)]
    matnames=['models/player/cf_swat/'+n for n in names]
    mats=materials(root/'cstrike',matnames,dst)
    nv=unpack(vvd,'i',16)[0];nf,fix,vo=unpack(vvd,'3i',48)
    raw=[unpack(vvd,'3f4B8f',vo+i*48) for i in range(nv)]
    if nf:
        fixed=[]
        for i in range(nf):
            lod,start,count=unpack(vvd,'3i',fix+i*12);fixed.extend(raw[start:start+count])
        raw=fixed
    nparts,bp=unpack(mdl,'2i',232);vnpart,vbp=unpack(vtx,'2i',28)
    parts=[];binary=bytearray()
    for i in range(nparts):
        p=bp+i*16;_,nmodel,_,modeloff=unpack(mdl,'4i',p);vp=vbp+i*8;_,vmodeloff=unpack(vtx,'2i',vp)
        for j in range(nmodel):
            mp=p+modeloff+j*148;nm,mo,nv,vertbase=unpack(mdl,'4i',mp+72)
            vmp=vp+vmodeloff+j*8;_,lo=unpack(vtx,'2i',vmp);lp=vmp+lo;vn,vmoff=unpack(vtx,'2i',lp)
            assert nm==vn
            for k in range(nm):
                mesh=mp+mo+k*116;mat,_,count,offset=unpack(mdl,'4i',mesh)
                vm=lp+vmoff+k*9;ng,go=unpack(vtx,'2i',vm);indices=[]
                for g in range(ng):
                    gp=vm+go+g*25;vcount,gv,icount,gi,ns,so=unpack(vtx,'6i',gp)
                    ids=[unpack(vtx,'H',gp+gv+x*9+4)[0]+offset+vertbase//48 for x in range(vcount)]
                    ii=unpack(vtx,str(icount)+'H',gp+gi)
                    for s in range(ns):
                        sp=gp+so+s*27;sn,si=unpack(vtx,'2i',sp);flags=vtx[sp+18]
                        strip=[ids[x] for x in ii[si:si+sn]]
                        if flags&1:indices.extend(strip)
                        else:
                            for t in range(len(strip)-2):indices.extend([strip[t+(t%2)],strip[t+1-(t%2)],strip[t+2]])
                vals=[]
                # Source VTX uses clockwise front faces; Three.js uses CCW.
                indices=[indices[i+k] for i in range(0,len(indices),3) for k in (0,2,1)]
                for idx in indices:
                    r=raw[idx]; vals.extend(list(r[7:15])+list(r[3:6])+[0]+list(r[:3])+[0])
                parts.append({'material':mats[mat],'offset':len(binary),'count':len(indices)})
                binary.extend(np.array(vals,dtype='<f4').tobytes())
    (dst/'swat.bin').write_bytes(binary);save_json(dst/'swat.json',{'bones':bones,'parts':parts})
    print('SWAT:',len(bones),'bones',len(parts),'meshes',len(binary)//64//3,'triangles',names)

if __name__=='__main__':
    map_convert(Path(sys.argv[1]));soldier_convert(Path(sys.argv[2]))
