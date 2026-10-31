"""Convert the KN-57 Source v49 pack into an isolated local preview.
The user authorized only the AK draw sound substitution. Do not publish assets.
"""
import json, math, struct, zlib, re, shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
PAK=ROOT/'assets/preview/gamebanana-weapons/sources/kn57/AK47 - BO4 KN-57'
BASE=PAK/'models/weapons/w_rif_ak47'
OUT=ROOT/'assets/preview/gamebanana-weapons/kn57-world'
OUT.mkdir(parents=True,exist_ok=True)
MDL=BASE.with_suffix('.mdl').read_bytes();VVD=BASE.with_suffix('.vvd').read_bytes();VTX=BASE.with_suffix('.dx90.vtx').read_bytes()
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
def convert_vtf(path,dest,normal=False):
    from PIL import Image, ImageOps
    blob=path.read_bytes();assert blob[:4]==b'VTF\0'
    major,minor,header,width,height=unpack(blob,'IIIHH',4);fmt=unpack(blob,'I',52)[0];mips=blob[56];lowfmt=unpack(blob,'I',57)[0];lw,lh=blob[61:63]
    def size(w,h,f):
        if f in (13,20):return max(1,(w+3)//4)*max(1,(h+3)//4)*8
        if f in (14,15):return max(1,(w+3)//4)*max(1,(h+3)//4)*16
        return w*h*{0:4,12:4}.get(f,4)
    pos=header+(size(lw,lh,lowfmt) if lw and lh else 0)
    if minor>=3:
        for i in range(unpack(blob,'I',68)[0]):
            tag,off=unpack(blob,'II',80+i*8)
            if tag&0xffffff==0x30:pos=off
    for mip in range(mips-1,0,-1):pos+=size(max(1,width>>mip),max(1,height>>mip),fmt)
    data=blob[pos:pos+size(width,height,fmt)]
    if fmt in (13,15): image=Image.frombytes('RGBA',(width,height),data,'bcn',(1 if fmt==13 else 3,'DXT1' if fmt==13 else 'DXT5'))
    elif fmt==12:image=Image.frombytes('RGBA',(width,height),data,'raw','BGRA')
    else:raise ValueError(f'unsupported VTF {fmt}: {path}')
    if normal:
        r,g,b,a=image.split();image=Image.merge('RGBA',(r,ImageOps.invert(g),b,a))
    image.save(dest)

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
materials=[]
for i,name in enumerate(texture_names):
    matches=list((PAK/'materials').rglob(name+'.vmt'));assert len(matches)==1,(name,matches)
    text=matches[0].read_text(errors='replace')
    def path(key):
        found=re.search(r'"\$'+key+r'"\s*"([^"]+)"',text,re.I)
        if not found:return None
        relative=found.group(1).replace('\\','/')
        p=PAK/'materials'/(relative+'.vtf');assert p.is_file(),(name,key,p)
        return p
    base=path('basetexture');assert base
    convert_vtf(base,OUT/f'tex{i}.png');mat={'map':f'tex{i}.png','roughness':.78,'metalness':.08}
    normal=path('bumpmap')
    if normal:
        convert_vtf(normal,OUT/f'normal{i}.png',True);mat.update(normalMap=f'normal{i}.png',normalScale=[.55,.55])
    materials.append(mat)
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
            for k in range(0,len(indices),3): indices[k+1],indices[k+2]=indices[k+2],indices[k+1]
            if not indices: continue
            packed=bytearray()
            for idx in indices:
                row=vertices[idx];weights=list(row[:3]);bone_ids=list(row[3:6]);used=row[6];pos=list(row[7:10]);normal=list(row[10:13]);uv=list(row[13:15]);uv[1]=1-uv[1];points.append(pos)
                skin_ids=[float(bone_ids[j]) if j<used else 0. for j in range(4)];skin_weights=[weights[j] if j<min(used,3) else 0. for j in range(4)]
                if used==1:skin_weights[0]=1.
                total=sum(skin_weights)
                if total<=0:skin_weights[0]=1.
                elif abs(total-1)>1e-5:skin_weights=[w/total for w in skin_weights]
                packed.extend(struct.pack('<16f',*(pos+normal+uv+skin_ids+skin_weights)))
            parts.append({**materials[material], 'textureName':texture_names[material], 'count':len(indices), 'offset':len(binary), 'weapon':True})
            binary.extend(packed)


transform=[0,-.01,0,0, 0,0,.01,0, -.01,0,0,0, 0,0,0,1]
(OUT/'view.bin').write_bytes(binary)
(OUT/'view.json').write_text(json.dumps({'bones':bones,'parts':parts,'transform':transform},separators=(',',':')))
print('KN-57 world:',len(parts),'parts',sum(p['count'] for p in parts)//3,'triangles')
