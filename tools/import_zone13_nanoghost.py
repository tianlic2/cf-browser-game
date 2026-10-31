"""Convert the locally downloaded Zone13 Nano Ghost Source model for the isolated preview.

The output stays below assets/local/cf_bio_candidates and is never a publishable asset.
It preserves the three clips actually embedded in nanoghost.mdl: idle, walk and ragdoll.
"""
import json, math, struct, sys, zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAK = ROOT / 'assets/local/cf_bio_candidates/zone13/pak'
VIEWMODEL = '--viewmodel' in sys.argv
BASE = PAK / ('models/weapons/v_knife_cfghost' if VIEWMODEL else 'models/player/nanoghost/nanoghost')
OUT = ROOT / 'assets/local/cf_bio_candidates/zone13/runtime-character' / ('ghost-view' if VIEWMODEL else 'nanoghost')
OUT.mkdir(parents=True, exist_ok=True)
MDL = BASE.with_suffix('.mdl').read_bytes()
VVD = BASE.with_suffix('.vvd').read_bytes()
VTX = BASE.with_suffix('.dx90.vtx').read_bytes()

def unpack(blob, fmt, at=0): return struct.unpack_from('<' + fmt, blob, at)
def cstring(blob, at): return blob[at:blob.index(b'\0', at)].decode('utf-8', 'replace')
def quat_xyz(angles):
    x,y,z=(a*.5 for a in angles);cx,sx=math.cos(x),math.sin(x);cy,sy=math.cos(y),math.sin(y);cz,sz=math.cos(z),math.sin(z)
    return [sx*cy*cz-cx*sy*sz,cx*sy*cz+sx*cy*sz,cx*cy*sz-sx*sy*cz,cx*cy*cz+sx*sy*sz]
def png_chunk(kind,payload): return struct.pack('>I',len(payload))+kind+payload+struct.pack('>I',zlib.crc32(kind+payload)&0xffffffff)
def rgba_png(width,height,rgba):
    rows=b''.join(b'\0'+rgba[y*width*4:(y+1)*width*4] for y in range(height))
    return b'\x89PNG\r\n\x1a\n'+png_chunk(b'IHDR',struct.pack('>2I5B',width,height,8,6,0,0,0))+png_chunk(b'IDAT',zlib.compress(rows,9))+png_chunk(b'IEND',b'')
def rgb565(value): return (((value>>11)&31)*255//31,((value>>5)&63)*255//63,(value&31)*255//31,255)
def decode_bc3(width,height,data):
    out=bytearray(width*height*4);at=0
    for by in range((height+3)//4):
        for bx in range((width+3)//4):
            a0,a1=data[at],data[at+1];abits=int.from_bytes(data[at+2:at+8],'little');c0,c1,cbits=struct.unpack_from('<HHI',data,at+8);at+=16
            alphas=[a0,a1]
            if a0>a1:alphas += [( (7-i)*a0+(i-1)*a1)//7 for i in range(2,8)]
            else:alphas += [( (5-i)*a0+(i-1)*a1)//5 for i in range(2,6)]+[0,255]
            ca,cb=rgb565(c0),rgb565(c1);colors=[ca,cb,tuple((2*ca[k]+cb[k])//3 for k in range(4)),tuple((ca[k]+2*cb[k])//3 for k in range(4))]
            for py in range(4):
                for px in range(4):
                    x,y=bx*4+px,by*4+py
                    if x>=width or y>=height:continue
                    n=py*4+px;color=colors[(cbits>>(2*n))&3];alpha=alphas[(abits>>(3*n))&7];off=(y*width+x)*4;out[off:off+4]=bytes((*color[:3],alpha))
    return out
def convert_vtf(path,dest):
    blob=path.read_bytes();assert blob[:4]==b'VTF\0';major,minor,header,width,height=unpack(blob,'IIIHH',4);fmt=unpack(blob,'I',52)[0];mips=blob[56];lowfmt=unpack(blob,'I',57)[0];lw,lh=blob[61:63]
    def size(w,h,f):
        if f in (13,20):return max(1,(w+3)//4)*max(1,(h+3)//4)*8
        if f in (14,15):return max(1,(w+3)//4)*max(1,(h+3)//4)*16
        return w*h*{0:4,1:4,2:3,3:3,11:4,12:4,16:4}.get(f,4)
    pos=header+(size(lw,lh,lowfmt) if lw and lh else 0)
    if minor>=3:
        for i in range(unpack(blob,'I',68)[0]):
            tag,offset=unpack(blob,'II',80+i*8)
            if tag&0xffffff==0x30:pos=offset
    for mip in range(mips-1,0,-1):pos+=size(max(1,width>>mip),max(1,height>>mip),fmt)
    data=blob[pos:pos+size(width,height,fmt)]
    if fmt==15:rgba=decode_bc3(width,height,data)
    elif fmt==12:
        rgba=bytearray(len(data))
        for i in range(0,len(data),4):rgba[i:i+4]=bytes((data[i+2],data[i+1],data[i],data[i+3]))
    else:raise ValueError(f'unsupported Nano Ghost VTF format {fmt}')
    dest.write_bytes(rgba_png(width,height,rgba))

assert MDL[:4] == b'IDST' and unpack(MDL,'i',4)[0] == 49
assert unpack(MDL,'i',8)[0] == unpack(VVD,'i',8)[0] == unpack(VTX,'i',16)[0]

bone_count,bone_offset=unpack(MDL,'2i',156);bones=[];bone_anim=[]
for i in range(bone_count):
    at=bone_offset+i*216; name=cstring(MDL,at+unpack(MDL,'i',at)[0]); parent=unpack(MDL,'i',at+4)[0]
    pos=list(unpack(MDL,'3f',at+32)); quat=list(unpack(MDL,'4f',at+44)); rot=list(unpack(MDL,'3f',at+60))
    pscale=list(unpack(MDL,'3f',at+72)); rscale=list(unpack(MDL,'3f',at+84))
    bones.append({'name':name,'parent':parent,'pose':pos+quat});bone_anim.append((pos,rot,pscale,rscale))

texture_count,texture_offset=unpack(MDL,'2i',204)
texture_names=[cstring(MDL,texture_offset+i*64+unpack(MDL,'i',texture_offset+i*64)[0]) for i in range(texture_count)]
for i,name in enumerate(texture_names):
    source=PAK/('materials/models/weapons/ghost' if VIEWMODEL else 'materials/models/player/nanoghost')/f'{name.lower()}.vtf'
    assert source.is_file(), source
    convert_vtf(source,OUT/f'tex{i}.png')

vertex_count=unpack(VVD,'i',16)[0]; fix_count,fix_offset,vertex_offset=unpack(VVD,'3i',48)
vertices=[unpack(VVD,'3f4B8f',vertex_offset+i*48) for i in range(vertex_count)]
if fix_count:
    fixed=[]
    for i in range(fix_count):
        _,start,count=unpack(VVD,'3i',fix_offset+i*12);fixed.extend(vertices[start:start+count])
    vertices=fixed

body_count,body_offset=unpack(MDL,'2i',232);vbody_count,vbody_offset=unpack(VTX,'2i',28)
assert body_count == vbody_count
binary=bytearray();parts=[];points=[]
for bi in range(body_count):
    body=body_offset+bi*16; model_count,_,model_offset=unpack(MDL,'3i',body+4)
    vbody=vbody_offset+bi*8; vmcount,vmodel_offset=unpack(VTX,'2i',vbody); assert model_count == vmcount
    for mi in range(model_count):
        model=body+model_offset+mi*148; vmodel=vbody+vmodel_offset+mi*8
        mesh_count,mesh_offset,_,model_vertex_offset=unpack(MDL,'4i',model+72)
        _,lod_offset=unpack(VTX,'2i',vmodel);lod=vmodel+lod_offset;lod_mesh_count,vmesh_offset=unpack(VTX,'2i',lod);assert mesh_count==lod_mesh_count
        for xi in range(mesh_count):
            mesh=model+mesh_offset+xi*116;material,_,_,mesh_vertex_offset=unpack(MDL,'4i',mesh)
            vmesh=lod+vmesh_offset+xi*9;group_count,group_offset=unpack(VTX,'2i',vmesh);indices=[]
            for gi in range(group_count):
                group=vmesh+group_offset+gi*25;vc,vo,ic,io,sc,so=unpack(VTX,'6i',group)
                refs=[unpack(VTX,'H',group+vo+j*9+4)[0]+mesh_vertex_offset+model_vertex_offset//48 for j in range(vc)]
                raw=unpack(VTX,str(ic)+'H',group+io)
                for si in range(sc):
                    strip=group+so+si*27;count,start=unpack(VTX,'2i',strip);flags=VTX[strip+18];ids=[refs[j] for j in raw[start:start+count]]
                    if flags&1: indices.extend(ids)
                    else:
                        for j in range(len(ids)-2): indices.extend((ids[j+j%2],ids[j+1-j%2],ids[j+2]))
            packed=bytearray()
            for idx in indices:
                row=vertices[idx];weights=list(row[:3]);bone_ids=list(row[3:6]);used=row[6];pos=list(row[7:10]);normal=list(row[10:13]);uv=list(row[13:15]);points.append(pos)
                skin_ids=[float(bone_ids[j]) if j<used else 0. for j in range(4)];skin_weights=[weights[j] if j<min(used,3) else 0. for j in range(4)]
                if used==1:skin_weights[0]=1.
                total=sum(skin_weights)
                if total<=0:skin_weights[0]=1.
                elif abs(total-1)>1e-5:skin_weights=[w/total for w in skin_weights]
                packed.extend(struct.pack('<16f',*(pos+normal+uv+skin_ids+skin_weights)))
            parts.append({'map':f'tex{material}.png','textureName':texture_names[material],'count':len(indices),'offset':len(binary)})
            binary.extend(packed)

def anim_value(pointer,frame):
    remaining=frame;at=pointer;last=0
    while True:
        valid,total=unpack(MDL,'2B',at)
        # Some bundled v49 viewmodel streams stop after their last authored
        # change instead of padding the run to numframes. Source holds that
        # final sample for the remaining frames.
        if total<=0 or valid>total:return last
        if remaining<total:
            sample=min(remaining,valid-1);return unpack(MDL,'h',at+2+sample*2)[0] if valid else last
        if valid:last=unpack(MDL,'h',at+2+(valid-1)*2)[0]
        remaining-=total;at+=2+valid*2

def animation_records(start):
    records={};at=start
    while True:
        bone,flags,next_offset=unpack(MDL,'BBH',at);payload=at+4;base=payload;pos_ptr=rot_ptr=raw_pos=raw_quat=None
        # Source SDK mstudioanim_t stores invariant rotation first, followed by
        # invariant position.  The Nano Ghost root uses RAWROT2 | RAWPOS; reading
        # the Vector48 first corrupts both fields and scatters the two arms even
        # though the original viewmodel is correctly authored.
        if flags&0x20:
            packed=int.from_bytes(MDL[payload:payload+8],'little');payload+=8
            values=[((packed>>shift)&0x1fffff)-0x100000 for shift in (0,21,42)]
            xyz=[value/1048576 for value in values];w=math.sqrt(max(0,1-sum(value*value for value in xyz)))
            raw_quat=xyz+[-w if packed>>63 else w]
        elif flags&0x02:
            x,y,z=unpack(MDL,'3H',payload);payload+=6;wneg=bool(z&0x8000);z&=0x7fff
            xyz=[x/32768-1,y/32768-1,z/16384-1];w=math.sqrt(max(0,1-sum(value*value for value in xyz)))
            raw_quat=xyz+[-w if wneg else w]
        if flags&0x01:raw_pos=list(unpack(MDL,'3e',payload));payload+=6
        if flags&0x08:rot_ptr=payload;payload+=6
        if flags&0x04:pos_ptr=payload
        records[bone]=(pos_ptr,rot_ptr,raw_pos,raw_quat)
        if not next_offset:break
        at+=next_offset
    return records

anim_count,anim_offset=unpack(MDL,'2i',180);source_anims={}
for ai in range(anim_count):
    desc=anim_offset+ai*100;name=cstring(MDL,desc+unpack(MDL,'i',desc+4)[0]);fps=unpack(MDL,'f',desc+8)[0];frames=unpack(MDL,'i',desc+16)[0]
    block,index=unpack(MDL,'2i',desc+52);section_index,section_frames=unpack(MDL,'2i',desc+80);assert block==0 and index>0
    record_cache={};values=[];decoded_frames=1 if name == '@testIdle' else frames
    for frame in range(decoded_frames):
        local_frame=frame
        if section_frames:
            # Source keeps the final frame in a dedicated terminal section so
            # looping clips can preserve their exact seam pose.
            if frame == frames-1:section=frames//section_frames+1;local_frame=0
            else:section=frame//section_frames;local_frame=frame%section_frames
            section_block,section_anim=unpack(MDL,'2i',desc+section_index+section*8)
            assert section_block==0 and section_anim>0
        else:section_anim=index
        records=record_cache.setdefault(section_anim,animation_records(desc+section_anim))
        for bone_index in range(bone_count):
            base_pos,base_rot,pos_scale,rot_scale=bone_anim[bone_index];position=list(base_pos);rotation=list(base_rot);record=records.get(bone_index)
            if record:
                pos_ptr,rot_ptr,raw_pos,raw_quat=record
                if raw_pos is not None:position=raw_pos
                if pos_ptr:
                    offsets=unpack(MDL,'3H',pos_ptr)
                    for axis in range(3):
                        if offsets[axis]:position[axis]+=anim_value(pos_ptr+offsets[axis],local_frame)*pos_scale[axis]
                if rot_ptr:
                    offsets=unpack(MDL,'3H',rot_ptr)
                    for axis in range(3):
                        if offsets[axis]:rotation[axis]+=anim_value(rot_ptr+offsets[axis],local_frame)*rot_scale[axis]
            values.extend(position);values.extend(raw_quat if record and raw_quat is not None else quat_xyz(rotation))
    source_anims[name]={'fps':fps,'frames':decoded_frames,'values':values}

clips={}
clip_map = ({
    '@draw':'select', '@idle1':'idle_0', '@idle2':'idle_1',
    '@light_miss1':'light_miss1', '@light_miss2':'light_miss2',
    '@light_hit1':'light_hit1', '@light_hit2':'light_hit2',
    '@light_backstab':'light_backstab', '@light_backstab2':'light_backstab2',
    '@heavy_miss1':'heavy_miss1', '@heavy_hit1':'heavy_hit1',
    '@heavy_backstab':'heavy_backstab',
} if VIEWMODEL else {'@testIdle':'idle','@testWalkN':'walk','@ragdoll':'death'})
for source_name,clip_name in clip_map.items():
    source=source_anims[source_name];values=source['values'];clips[clip_name]={'times':[round(f/source['fps'],6) for f in range(source['frames'])],'offset':len(binary),'count':source['frames']}
    binary.extend(struct.pack('<'+'f'*len(values),*values))

mins=[min(p[a] for p in points) for a in range(3)];maxs=[max(p[a] for p in points) for a in range(3)]
if VIEWMODEL:
    scale=.01
    transform=[0,-scale,0,0, 0,0,scale,0, -scale,0,0,0, 0,0,0,1]
else:
    scale=1.84/(maxs[2]-mins[2]);cx=(mins[0]+maxs[0])*.5;cy=(mins[1]+maxs[1])*.5
    transform=[scale,0,0,-cx*scale, 0,0,scale,-mins[2]*scale, 0,-scale,0,cy*scale, 0,0,0,1]
(OUT/'view.bin').write_bytes(binary)
source_label = 'Zone13 downloaded v_knife_cfghost MDL v49' if VIEWMODEL else 'Zone13 downloaded Nano Ghost MDL v49'
(OUT/'view.json').write_text(json.dumps({'bones':bones,'parts':parts,'clips':clips,'events':{},'transform':transform,'source':source_label},separators=(',',':')),encoding='utf8')
print(source_label+':',bone_count,'bones',len(parts),'parts',[(k,v['count']) for k,v in clips.items()])
