"""Import the supplied CF Barrett first-person SMD model, arms, clips, and foley.

Usage: python3 tools/import_cf_barrett_view.py /path/to/CF_Barrett_AllTexture
The game's damage, penetration, scope and bolt rules remain owned by main.js.
"""
import json, math, re, shutil, struct, sys
from pathlib import Path
import numpy as np

root = Path(sys.argv[1])
src = root / 'BARRETs'
sound = root / 'Barrett_M82A1/sound/weapons/awp'
repo = Path(__file__).resolve().parents[1]
out = repo / 'assets/classic/barrett'
audio = repo / 'audio/classic'
out.mkdir(parents=True, exist_ok=True)

def read_smd(path):
    lines = path.read_text(encoding='utf-8-sig').replace('\r', '').splitlines()
    def section(tag):
        start = lines.index(tag) + 1
        return lines[start:lines.index('end', start)]
    nodes = []
    for line in section('nodes'):
        m = re.fullmatch(r'\s*(\d+)\s+"(.*)"\s+(-?\d+)\s*', line)
        if m: nodes.append((int(m[1]), m[2], int(m[3])))
    frames, current = [], None
    for line in section('skeleton'):
        if line.startswith('time '):
            if current is not None: frames.append(current)
            current = {'time': int(line.split()[1]), 'bones': {}}
        elif line.strip() and current is not None:
            v = line.split(); current['bones'][int(v[0])] = list(map(float, v[1:7]))
    if current is not None: frames.append(current)
    return nodes, frames, lines

def quat(v):
    x,y,z=(a/2 for a in v); cx,sx=math.cos(x),math.sin(x); cy,sy=math.cos(y),math.sin(y); cz,sz=math.cos(z),math.sin(z)
    return [sx*cy*cz-cx*sy*sz, cx*sy*cz+sx*cy*sz,
            cx*cy*sz-sx*sy*cz, cx*cy*cz+sx*sy*sz]

def game_pose(pose):
    # GoldSrc X-right/Y-forward/Z-up becomes Three X-right/Y-up/Z-forward.
    # Swapping Y/Z reflects the basis. Quaternions are axial vectors, so their
    # vector part transforms by det(S) * S, not by the position-vector map S.
    q=quat(pose[3:6])
    return [pose[0],pose[2],pose[1],-q[0],-q[2],-q[1],q[3]]

def pose_matrix(pose):
    x,y,z=pose[:3];rx,ry,rz=pose[3:6]
    cx,sx=math.cos(rx),math.sin(rx);cy,sy=math.cos(ry),math.sin(ry);cz,sz=math.cos(rz),math.sin(rz)
    # SMD Euler XYZ, represented as Rz * Ry * Rx.
    r=np.array([[cz*cy,cz*sy*sx-sz*cx,cz*sy*cx+sz*sx],
                [sz*cy,sz*sy*sx+cz*cx,sz*sy*cx-cz*sx],
                [-sy,cy*sx,cy*cx]],dtype=float)
    m=np.eye(4);m[:3,:3]=r;m[:3,3]=(x,y,z);return m

def matrix_pose(m):
    r=m[:3,:3]; sy=-r[2,0]
    if abs(sy)<.999999:
        rx=math.atan2(r[2,1],r[2,2]);ry=math.asin(sy);rz=math.atan2(r[1,0],r[0,0])
    else:
        rx=math.atan2(-r[1,2],r[1,1]);ry=math.copysign(math.pi/2,sy);rz=0
    return [*m[:3,3],rx,ry,rz]

def hierarchy_world(nodes, pose_by_id):
    by_id={i:(name,parent) for i,name,parent in nodes};world={}
    def get(i):
        if i not in world:
            pose=pose_by_id.get(i,[0,0,0,0,0,0]);parent=by_id[i][1]
            world[i]=pose_matrix(pose) if parent<0 else get(parent)@pose_matrix(pose)
        return world[i]
    for i,_,_ in nodes:get(i)
    return world

def retarget_pose(source_nodes, source_pose, target_nodes, target_rest):
    """Evaluate source animation poses on a mesh's separate reference skeleton.

    GoldSrc sequences contain the authored absolute arm pose, while the hand
    reference SMD is a spread-arm bind mesh. Resetting each sequence's first
    frame to that bind pose leaves the hands in a T-pose. Matched bones must
    therefore use the sequence world transforms directly; unmatched helper
    bones inherit their parent's animation while preserving their bind-local
    transform.
    """
    source_world=hierarchy_world(source_nodes,source_pose)
    target_rest_world=hierarchy_world(target_nodes,target_rest)
    source_id_by_name={name:i for i,name,_ in source_nodes}
    aliases={'ct_arms':'t_arms_leet'}
    target_by_id={i:(name,parent) for i,name,parent in target_nodes};out={};target_world={}
    def retarget(i):
        if i in out:return out[i]
        name,parent=target_by_id[i];sid=source_id_by_name.get(name)
        parent_world=None if parent<0 else world_for(parent)
        if sid is None:sid=source_id_by_name.get(aliases.get(name,''))
        if sid is not None:
            world=source_world[sid]
        elif parent_world is None:
            world=target_rest_world[i]
        else:
            rest_local=np.linalg.inv(target_rest_world[parent])@target_rest_world[i]
            world=parent_world@rest_local
        local=world if parent_world is None else np.linalg.inv(parent_world)@world
        out[i]=matrix_pose(local)
        target_world[i]=world
        return out[i]
    def world_for(i):
        if i not in target_world:retarget(i)
        return target_world[i]
    for i,_,_ in target_nodes:retarget(i)
    return out

def mesh_rows(path):
    nodes, _, lines = read_smd(path)
    start = lines.index('triangles') + 1; end = lines.index('end', start)
    parts, at, by_material = [], start, {}
    while at < end:
        material = Path(lines[at].strip().strip('"')).name; at += 1
        if at + 3 > end: raise ValueError(f'incomplete triangle in {path.name}')
        tri = []
        for line in lines[at:at+3]:
            raw = list(map(float, line.split()))
            links = int(raw[9]); influences = [(int(raw[10+2*i]), raw[11+2*i]) for i in range(links)]
            tri.append({'joint': int(raw[0]), 'pos': raw[1:4], 'normal': raw[4:7], 'uv': raw[7:9], 'weights': influences})
        a,b,c=tri
        u=[b['pos'][i]-a['pos'][i] for i in range(3)]; v=[c['pos'][i]-a['pos'][i] for i in range(3)]
        cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
        if sum(cross[i]*a['normal'][i] for i in range(3)) < 0: tri[1],tri[2]=tri[2],tri[1]
        tri[1],tri[2]=tri[2],tri[1]
        by_material.setdefault(material,[]).append(tri); at += 3
    parts.extend((material,nodes,triangles) for material,triangles in by_material.items())
    return parts

def image_png(name):
    # The supplied QC references a missing v_hands.tga. The same archive does
    # include the actual arm texture used by the sequences, tm_arms_leet.tga.
    src_path = src / ('tm_arms_leet.tga' if name.lower() == 'v_hands.tga' else name)
    dest = out / (Path(name).stem + '.png')
    if not dest.exists() or dest.stat().st_mtime < src_path.stat().st_mtime:
        from PIL import Image
        Image.open(src_path).convert('RGBA').save(dest, optimize=True)
    return dest.name

idle_nodes, idle_frames, _ = read_smd(src/'idle1.smd')
hand_nodes, hand_frames, _ = read_smd(src/'hands_reference.smd')
model_nodes, model_frames, _ = read_smd(src/'barrett_reference.smd')
# Source QC permits the weapon and hands reference meshes to have different
# skeleton roots. Keep each original bind hierarchy intact; retarget every
# animation through world space instead of forcing both meshes onto idle's tree.
def unique_nodes(nodes):
    result=[]; seen_ids=set();seen_names=set()
    for i,name,parent in nodes:
        if i in seen_ids or name in seen_names:continue
        result.append((i,name,parent));seen_ids.add(i);seen_names.add(name)
    return result
weapon_nodes=unique_nodes(model_nodes); weapon_frames=model_frames
hands_nodes=unique_nodes(hand_nodes); hands_bind=hand_frames[0]['bones']
rig_specs=[('weapon',weapon_nodes,weapon_frames[0]['bones']),('hands',hands_nodes,hands_bind)]
rigs=[]
rig_bone_index=[]
for rig_name,nodes,rest in rig_specs:
    idmap={i:(name,parent) for i,name,parent in nodes}
    name_to_index={name:j for j,(_,name,_) in enumerate(nodes)}
    bones=[{'name':name,'parent':-1 if parent<0 else name_to_index[idmap[parent][0]],'pose':game_pose(rest[i])}
           for i,name,parent in nodes]
    rigs.append({'name':rig_name,'bones':bones,'clips':{}})
    rig_bone_index.append({i:name_to_index[name] for i,name,_ in nodes})

parts, blob = [], bytearray()
all_model_parts = mesh_rows(src/'barrett_reference.smd') + mesh_rows(src/'hands_reference.smd')
texture_names = set()
for material,nodes,triangles in all_model_parts:
    is_weapon='PV-BARRET' in material.upper(); rig_id=0 if is_weapon else 1
    canonical=rig_specs[rig_id][1]; bone_index=rig_bone_index[rig_id]
    map_name = image_png(material); texture_names.add(map_name)
    node_name = {i:name for i,name,_ in nodes}
    rows = [v for tri in triangles for v in tri]
    # Each material has its own mesh, preserving source UVs and the Barrett's
    # weapon/hand separation while both remain on the same original skeleton.
    part = {'map':map_name,'textureName':material,'count':0,'offset':len(blob),'rig':rig_id,
            'weapon':is_weapon,'kind':'weapon' if is_weapon else 'hands'}
    for v in rows:
        influences = [(bone_index[next(i for i,n,_ in canonical if n==node_name[j])],w)
                      for j,w in v['weights'] if w > 1e-7 and node_name[j] in bone_index]
        if not influences:
            name=node_name[v['joint']];influences=[(bone_index[next(i for i,n,_ in canonical if n==name)],1.0)]
        influences = sorted(influences,key=lambda x:-x[1])[:4]
        total=sum(w for _,w in influences) or 1
        influences=[(j,w/total) for j,w in influences]
        joints=[j for j,_ in influences]+[0]*(4-len(influences))
        weights=[w for _,w in influences]+[0.0]*(4-len(influences))
        # GoldSrc SMD camera basis: X right, -Y forward, Z up. The game view rig
        # maps source Y to camera depth and source Z to camera height.
        x,y,z=v['pos']; nx,ny,nz=v['normal']
        # SMD positions are centimeters; preserve the source unit rig until the
        # authored model is posed, then the rig transform converts cm to meters.
        data=[x,z,y,nx,nz,ny,*v['uv'],*joints,*weights]
        blob.extend(struct.pack('<16f',*data));part['count']+=1
    parts.append(part)

clip_specs = [('idle_0','idle1',60),('fire','shoot1',35),('select','draw',35),('reload','reload',30)]
qc_text=(src/'mdldecompiler.qc').read_text(encoding='utf-8-sig').replace('\r','')
def qc_events(sequence_name, fps):
    """Read animation events from the supplied QC instead of guessing timings."""
    match=re.search(rf'^\$sequence\s+{re.escape(sequence_name)}\s+"[^"]+"[^\n]*\{{(.*?)^\}}',
                    qc_text,re.MULTILINE|re.DOTALL)
    if not match:return []
    return [{'frame':int(frame),'time':round(int(frame)/fps,6),'name':name}
            for frame,name in re.findall(r'\{\s*event\s+5004\s+(\d+)\s+"([^"]+)"\s*\}',match.group(1))]
events={game_name:qc_events(file_name,fps) for game_name,file_name,fps in clip_specs}
for game_name,file_name,fps in clip_specs:
    seq_nodes,frames,_=read_smd(src/(file_name+'.smd'))
    for rig_id,(_,target_nodes,target_rest) in enumerate(rig_specs):
        clip={'times':[round(f['time']/fps,6) for f in frames], 'offset':len(blob), 'count':len(frames)}
        values=[]
        for frame in frames:
            poses=retarget_pose(seq_nodes,frame['bones'],target_nodes,target_rest)
            for i,_,_ in target_nodes:values.extend(game_pose(poses[i]))
        blob.extend(struct.pack('<'+'f'*len(values),*values))
        rigs[rig_id]['clips'][game_name]=clip

transform=[.01,0,0,0, 0,.01,0,0, 0,0,.01,0, 0,0,0,1]
(out/'view.bin').write_bytes(blob)
(out/'view.json').write_text(json.dumps({'rigs':rigs,'parts':parts,
    # Keep the source weapon/hand proportions intact. Scaling only the weapon
    # geometry around Grip breaks the authored Bolt travel and hand alignment.
    'transform':transform,'weaponScale':1.0,'weaponPivotBone':'Grip','events':events,
    'muzzleAxis':'z','muzzleSign':-1,
    'source':'User-provided CF Barrett SMD/QC; BARRETs/mdldecompiler.qc'},separators=(',',':')))

# Produce the enemy/drop model from the same Barrett geometry and texture.
def make_world_glb():
    weapon = next(item for item in all_model_parts if 'PV-BARRET' in item[0].upper())
    material,nodes,triangles=weapon
    positions=[]; normals=[]; uvs=[]
    node_name={i:name for i,name,_ in nodes}
    for tri in triangles:
        for v in tri:
            x,y,z=v['pos']; nx,ny,nz=v['normal']
            positions.extend((x, z, y)); normals.extend((nx, nz, ny)); uvs.extend(v['uv'])
    binary=bytearray(); views=[]; accessors=[]
    def add(data):
        while len(binary)%4: binary.append(0)
        offset=len(binary); binary.extend(data); views.append({'buffer':0,'byteOffset':offset,'byteLength':len(data)}); return len(views)-1
    def floats(name,values,size,typ):
        view=add(struct.pack('<'+'f'*len(values),*values))
        acc={'bufferView':view,'componentType':5126,'count':len(values)//size,'type':typ}
        if name=='POSITION':
            pts=[values[i:i+3] for i in range(0,len(values),3)]
            acc['min']=[min(p[k] for p in pts) for k in range(3)];acc['max']=[max(p[k] for p in pts) for k in range(3)]
        accessors.append(acc); return len(accessors)-1
    pos=floats('POSITION',positions,3,'VEC3');norm=floats('NORMAL',normals,3,'VEC3');uv=floats('TEXCOORD_0',uvs,2,'VEC2')
    png=(out/'PV-BARRET.png').read_bytes();image_view=add(png)
    doc={'asset':{'version':'2.0','generator':'CF Barrett SMD conversion'},'scene':0,
      'scenes':[{'nodes':[0]}],'nodes':[{'mesh':0}],'meshes':[{'primitives':[{'attributes':{'POSITION':pos,'NORMAL':norm,'TEXCOORD_0':uv},'material':0,'mode':4}]}],
      'materials':[{'name':'PV-BARRET','pbrMetallicRoughness':{'baseColorTexture':{'index':0},'metallicFactor':.28,'roughnessFactor':.48}}],
      'textures':[{'source':0,'sampler':0}],'images':[{'bufferView':image_view,'mimeType':'image/png'}],
      'samplers':[{'magFilter':9729,'minFilter':9987,'wrapS':10497,'wrapT':10497}],
      'buffers':[{'byteLength':0}],'bufferViews':views,'accessors':accessors}
    while len(binary)%4: binary.append(0)
    doc['buffers'][0]['byteLength']=len(binary)
    js=json.dumps(doc,separators=(',',':')).encode();js+=b' '*(-len(js)%4)
    target=out/'world.glb'
    target.write_bytes(struct.pack('<4sII',b'glTF',2,28+len(js)+len(binary))+
      struct.pack('<I4s',len(js),b'JSON')+js+struct.pack('<I4s',len(binary),b'BIN\0')+binary)
make_world_glb()
print(f'Imported rigs={[(r["name"],len(r["bones"])) for r in rigs]}, parts={len(parts)}, {len(blob)} bytes; clips={list(rigs[0]["clips"])} textures={sorted(texture_names)}; world=world.glb')

# Copy the additional original one-shot sounds. Existing fire/bolt WAVs are the
# exact same bytes as awp1/awp_bolt in the provided pack.
for source_name, target_name in [('awp_draw.WAV','barrett_draw.wav'),('awp_clipout.WAV','barrett_clipout.wav'),
                                 ('awp_clipin.WAV','barrett_clipin.wav')]:
    shutil.copyfile(sound/source_name, audio/target_name)
