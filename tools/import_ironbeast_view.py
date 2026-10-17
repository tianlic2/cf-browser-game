"""Extract the complete GoldSrc M4A1-S first-person rig and animation tracks.

Usage: python3 tools/import_ironbeast_view.py /path/to/models/v_ak47.mdl [/path/to/compile/v_] [asset-name] [weapon-length] [forward-axis]
The source file also contains the weapon's indexed texture palette.
"""
import json, math, struct, sys, zlib
from pathlib import Path

src = Path(sys.argv[1]); data = src.read_bytes()
assert data[:4] == b"IDST" and struct.unpack_from("<i", data, 4)[0] == 10
asset_name = sys.argv[3] if len(sys.argv)>3 else "m4_ironbeast"
weapon_length = float(sys.argv[4]) if len(sys.argv)>4 else .82
forward_axis = sys.argv[5].lower() if len(sys.argv)>5 else "y"
assert forward_axis in ("x", "y"), "forward-axis must be x or y"
out = Path(__file__).resolve().parents[1] / "assets/classic" / asset_name
out.mkdir(parents=True, exist_ok=True)
texture_dir = Path(sys.argv[2]) if len(sys.argv)>2 else src.parent.parent / "compile/v_"
I = lambda p: struct.unpack_from("<i", data, p)[0]
S = lambda p: data[p:].split(b"\0", 1)[0].decode("utf-8", "replace")

def png_chunk(tag,payload):
    return struct.pack(">I",len(payload))+tag+payload+struct.pack(">I",zlib.crc32(tag+payload)&0xffffffff)

def rgba_png(w,h,rgba):
    raw=b"".join(b"\0"+rgba[y*w*4:(y+1)*w*4] for y in range(h))
    return (b"\x89PNG\r\n\x1a\n"+png_chunk(b"IHDR",struct.pack(">2I5B",w,h,8,6,0,0,0))+
            png_chunk(b"IDAT",zlib.compress(raw,9))+png_chunk(b"IEND",b""))

def read_indexed_bmp(path,transparent_zero=False):
    bmp=path.read_bytes(); assert bmp[:2]==b"BM"
    offset=struct.unpack_from("<I",bmp,10)[0]; dib=struct.unpack_from("<I",bmp,14)[0]
    w,h=struct.unpack_from("<ii",bmp,18); planes,bpp=struct.unpack_from("<HH",bmp,26)
    compression=struct.unpack_from("<I",bmp,30)[0]
    assert planes==1 and bpp==8 and compression==0, f"unsupported texture: {path}"
    colors=struct.unpack_from("<I",bmp,46)[0] or 256; paloff=14+dib
    palette=[bmp[paloff+i*4:paloff+i*4+4] for i in range(colors)]
    stride=((w+3)//4)*4; rgba=bytearray(w*h*4)
    for y in range(h):
        source_y=h-1-y if h>0 else y; row=offset+source_y*stride
        for x in range(w):
            idx=bmp[row+x]; b,g,r,_=palette[idx]; at=(y*w+x)*4
            rgba[at:at+4]=bytes((r,g,b,0 if transparent_zero and idx==0 else 255))
    return w,h,rgba

def quat(angles):
    # Studio bones store the same XYZ Euler convention used by decompiled SMD
    # skeletons.  Compose Rz * Ry * Rx; in particular (-pi, 0, pi) is a 180°
    # Y rotation, not a 180° Z rotation.  GoldSrc's unrelated entity
    # AngleMatrix convention swaps those axes and tears the hands off the held
    # weapon when it is used for studio animation data.
    x,y,z=(a*.5 for a in angles)
    cx,sx=math.cos(x),math.sin(x); cy,sy=math.cos(y),math.sin(y); cz,sz=math.cos(z),math.sin(z)
    return [sx*cy*cz-cx*sy*sz, cx*sy*cz+sx*cy*sz,
            cx*cy*sz-sx*sy*cz, cx*cy*cz+sx*sy*sz]

# Bones retain the authored local-space hierarchy; MDL vertex positions are
# already model-space bind-pose coordinates and must not be transformed by the
# owning bone a second time. The renderer applies one calibrated root transform.
nb, bo=I(140),I(144); bones=[]
for n in range(nb):
    p=bo+n*112; name=S(p); parent=struct.unpack_from("<i",data,p+32)[0]
    vals=struct.unpack_from("<6f",data,p+64)
    bones.append({"name":name,"parent":parent,"pose":list(vals[:3])+quat(vals[3:]),"angles":list(vals[3:])})

nt,to,td=I(180),I(184),I(188); textures=[]
for n in range(nt):
    p=to+n*80; name,flags,w,h,pixels=struct.unpack_from("<64s4i",data,p)
    filename=name.decode("utf-8","replace").split("\0")[0]
    # This pack's QC compiles the SWAT/blue first-person body with these
    # authored diffuse maps. Some redistributed MDLs carry generic embedded
    # fallback palettes under view_glove/finger/skin instead; prefer the
    # matching source materials when the companion BMPs are available.
    diffuse_override={
        "view_glove.bmp":"FVIEW_HAND_BL.bmp",
        "view_finger.bmp":"FVIEW_HAND_BL.bmp",
        "view_skin.bmp":"FVIEW_ARM_BL.bmp",
    }.get(filename.lower())
    external=texture_dir/(diffuse_override or filename)
    if external.is_file():
        tw,th,rgba=read_indexed_bmp(external,transparent_zero=bool(flags&32))
        textures.append((filename,tw,th,rgba_png(tw,th,rgba)))
        continue
    # GoldSrc studio MDL stores the fixed 256-colour RGB palette immediately
    # after the indexed pixels (unlike an 8-bit BMP, there is no colour-count
    # prefix). Treating the first two palette bytes as a count happens to look
    # plausible for some hand maps but turns palettes beginning with black into
    # empty data, producing a one-byte-per-pixel broken PNG.
    pal=data[pixels+w*h:pixels+w*h+256*3]
    assert len(pal)==256*3, f"truncated embedded palette: {filename}"
    rgba=bytearray()
    for idx in data[pixels:pixels+w*h]: rgba.extend(pal[idx*3:idx*3+3]); rgba.append(255)
    textures.append((filename,w,h,rgba_png(w,h,rgba)))
skin_n,skin_f,skin_o=I(192),I(196),I(200)
skinmap=struct.unpack_from("<"+"H"*(skin_n*skin_f),data,skin_o)
# Resolve the bind hierarchy with the studio/SMD XYZ convention.
def angle_matrix(angles,pos):
    x,y,z=angles; sx,cx=math.sin(x),math.cos(x); sy,cy=math.sin(y),math.cos(y); sz,cz=math.sin(z),math.cos(z)
    return [[cz*cy,cz*sy*sx-sz*cx,cz*sy*cx+sz*sx,pos[0]],
            [sz*cy,sz*sy*sx+cz*cx,sz*sy*cx-cz*sx,pos[1]],
            [-sy,cy*sx,cy*cx,pos[2]]]
def mul(a,c):
    return [[sum(a[r][k]*c[k][j] for k in range(3)) for j in range(3)]+[sum(a[r][k]*c[k][3] for k in range(3))+a[r][3]] for r in range(3)]
def point(m,p): return tuple(sum(m[r][k]*p[k] for k in range(3))+m[r][3] for r in range(3))
world=[]
for b in bones:
    q=b["pose"]; R=angle_matrix(b["angles"],q[:3]); parent=b["parent"]
    world.append(mul(world[parent],R) if parent>=0 else R)

# GoldSrc mstudioanimvalue_t RLE sample decoder.
def channel(base,off,frame,default,step):
    if not off:return default
    p=base+off; cursor=0
    while True:
        valid,total=struct.unpack_from("<2B",data,p);p+=2
        vals=list(struct.unpack_from("<"+"h"*valid,data,p));p+=valid*2
        if not vals:return default
        if frame < cursor+total:
            return default+vals[min(frame-cursor,valid-1)]*step
        cursor+=total

body_n,body_o=I(204),I(208)
parts=[]; blob=bytearray(); bounds=[]; calibration=[]
for bi in range(body_n):
    # QC's two $body "Weapon" entries are independent bodyparts, not choices:
    # bodyparts 1 and 2 are complementary authored rifle meshes. Keep both.
    # Bodyparts 3/4 are diffuse-matched specular companions (Three shades the
    # diffuse model), while 5 is the billboard VFX set, which does not survive
    # GoldSrc's effect/material pipeline in Three.js.
    if bi in (3, 4, 5):
        continue
    bp=body_o+bi*76; models,base,mo=struct.unpack_from("<3i",data,bp+64)
    # GoldSrc bodyparts are alternatives, not layers. The first model is the
    # compiled default selected by the weapon QC/bodygroup. Rendering every
    # alternative stacked together duplicates geometry (and makes the
    # specular-only bodypart look like a second, displaced rifle).
    for model_i in range(min(models,1)):
        mp=mo+model_i*112; nv=struct.unpack_from("<i",data,mp+80)[0]
        meshes,mesh_o=struct.unpack_from("<2i",data,mp+72)
        bone_i,vert_o=struct.unpack_from("<2i",data,mp+84)
        normal_n=struct.unpack_from("<i",data,mp+92)[0]; normal_b,normal_o=struct.unpack_from("<2i",data,mp+96)
        rawv=[struct.unpack_from("<3f",data,vert_o+12*j) for j in range(nv)]
        rawn=[struct.unpack_from("<3f",data,normal_o+12*j) for j in range(normal_n)]
        vbone=data[bone_i:bone_i+nv]
        for mi in range(meshes):
            m=mesh_o+mi*20; _,tri_o,skinref,_,_=struct.unpack_from("<5i",data,m); ti=skinmap[skinref] if skinref<skin_n else 0
            at=tri_o; verts=[]
            while True:
                count=struct.unpack_from("<h",data,at)[0];at+=2
                if count==0:break
                rec=[struct.unpack_from("<4h",data,at+j*8) for j in range(abs(count))];at+=abs(count)*8
                for j in range(2,len(rec)):
                    tri=([rec[j-2],rec[j-1],rec[j]] if j%2==0 else [rec[j-1],rec[j-2],rec[j]]) if count>0 else [rec[0],rec[j-1],rec[j]]
                    face=[]
                    for vi,ni,u,v in tri:
                        bone=vbone[vi]; x,y,z=point(world[bone],rawv[vi])
                        N=world[bone]; ax,ay,az=rawn[ni]
                        nx,ny,nz=(N[0][0]*ax+N[0][1]*ay+N[0][2]*az,
                                  N[1][0]*ax+N[1][1]*ay+N[1][2]*az,
                                  N[2][0]*ax+N[2][1]*ay+N[2][2]*az)
                        length=math.sqrt(nx*nx+ny*ny+nz*nz) or 1.
                        nx,ny,nz=nx/length,ny/length,nz/length
                        bounds.append((bi,bone,(x,y,z)))
                        calibration.append((bi,bone,rawv[vi]))
                        face.append([x,y,z,nx,ny,nz,u/textures[ti][1],1-v/textures[ti][2],vbone[vi]])
                    a,c,d=face
                    ux,uy,uz=(c[k]-a[k] for k in range(3)); vx,vy,vz=(d[k]-a[k] for k in range(3))
                    cross=(uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx)
                    if sum(cross[k]*(a[3+k]+c[3+k]+d[3+k]) for k in range(3))<0: face[1],face[2]=face[2],face[1]
                    for vtx in face: verts.extend(vtx)
            # The shared ClassicView binary ABI stores all 16 lanes as float32;
            # its constructor converts lanes 8..11 into Uint16 skin indices.
            packed=bytearray()
            for j in range(0,len(verts),9): packed.extend(struct.pack("<16f",*verts[j:j+8],float(verts[j+8]),0.,0.,0.,1.,0.,0.,0.))
            # Weapon bodyparts 1 and 2 form the complete authored rifle.
            parts.append({"map":f"tex{ti}.png","textureName":textures[ti][0],"count":len(verts)//9,"offset":len(blob),"weapon":bi in (1,2)})
            blob.extend(packed)

# Calibrate against the authored first idle frame rather than the MDL reference
# pose. Some CF melee models store a spread/reference bind while idle_0 moves
# the weapon and both hands to their real first-person pose; centering the bind
# would put the live weapon behind the camera as soon as animation starts.
seqn,seqo=I(164),I(168)
idle_index=next((si for si in range(seqn) if S(seqo+si*176)=="idle_0"),0)
idle_desc=seqo+idle_index*176; idle_anim=I(idle_desc+124); idle_world=[]
for bn,bone in enumerate(bones):
    rec=idle_anim+bn*12; offsets=struct.unpack_from("<6H",data,rec)
    base=struct.unpack_from("<6f",data,bo+bn*112+64); steps=struct.unpack_from("<6f",data,bo+bn*112+88)
    pose=[channel(rec,offsets[k],0,base[k],steps[k]) for k in range(6)]
    local=angle_matrix(pose[3:],pose[:3]); parent=bone["parent"]
    idle_world.append(mul(idle_world[parent],local) if parent>=0 else local)
gun=[point(idle_world[bn],p) for bi,bn,p in calibration if bi in (1,2)]
mins=[min(p[k] for p in gun) for k in range(3)]; maxs=[max(p[k] for p in gun) for k in range(3)]
scale=weapon_length/max(maxs[k]-mins[k] for k in range(3)); center=[(mins[k]+maxs[k])*.5 for k in range(3)]

clips={}; events={}
for si in range(seqn):
    p=seqo+si*176; name=S(p); fps=struct.unpack_from("<f",data,p+32)[0]; frames=struct.unpack_from("<i",data,p+56)[0]
    blends=struct.unpack_from("<i",data,p+120)[0]
    # mstudioseqdesc_t.animindex is an absolute byte offset from the start of
    # the MDL header. Adding the sequence descriptor address reads mesh bytes
    # as animation tracks; compare against the packaged SMD sequence skeleton.
    anim=struct.unpack_from("<i",data,p+124)[0]
    values=[]
    for frame in range(frames):
        for bn,b in enumerate(bones):
            rec=anim+bn*12; offsets=struct.unpack_from("<6H",data,rec)
            base=struct.unpack_from("<6f",data,bo+bn*112+64); steps=struct.unpack_from("<6f",data,bo+bn*112+88)
            pose=[channel(rec,offsets[k],frame,base[k],steps[k]) for k in range(6)]
            values.extend(pose[:3]); values.extend(quat(pose[3:]))
    clips[name]={"times":[round(f/fps,6) for f in range(frames)],"offset":len(blob),"count":frames}
    blob.extend(struct.pack("<"+"f"*len(values),*values))
    event_count,event_offset=struct.unpack_from("<2i",data,p+48)
    if event_count:
        events[name]=[]
        for ei in range(event_count):
            ep=event_offset+ei*76
            frame,event_code,event_type=struct.unpack_from("<3i",data,ep)
            option=S(ep+12)
            events[name].append({"name":option,"code":event_code,"type":event_type,
                                 "frame":frame,"time":round(frame/fps,6)})

# Store textures separately; classic_view loader consumes one map per part.
for i,(name,w,h,png) in enumerate(textures): (out/f"tex{i}.png").write_bytes(png)
(out/"view.bin").write_bytes(blob)
# GoldSrc packages do not all use the same authored forward axis. Most rifles
# in this project point along +Y; the Festa CFS 2019 Desert Eagle points along
# +X in its animated idle pose. Map the selected forward axis to game -Z while
# keeping source +Z upright. The remaining horizontal axis becomes game +X.
if forward_axis == "x":
    transform=[0,scale,0,-center[1]*scale,
               0,0,scale,-center[2]*scale,
               -scale,0,0,center[0]*scale,
               0,0,0,1]
else:
    transform=[scale,0,0,-center[0]*scale,
               0,0,scale,-center[2]*scale,
               0,-scale,0,center[1]*scale,
               0,0,0,1]
(out/"view.json").write_text(json.dumps({"bones":bones,"parts":parts,"clips":clips,"events":events,
    "source":"GoldSrc v10 full first-person rig","weaponLength":weapon_length,
    "muzzleAxis":forward_axis,"muzzleSign":1,"transform":transform},separators=(",",":")))
print(f"Extracted {nb} bones, {len(parts)} meshes and {len(clips)} complete animation clips to {out}; weapon calibrated to {weapon_length}m (source bounds {mins}..{maxs}, center {center})")
