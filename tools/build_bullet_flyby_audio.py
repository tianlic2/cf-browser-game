"""Make short, pitch-preserving game cues from CC0 flyby sound effects."""
from pathlib import Path
import argparse,subprocess,hashlib,json,wave
import numpy as np
from scipy.signal import butter,sosfilt
ROOT=Path(__file__).resolve().parents[1];RATE=48000
SOURCES={
 'pass':{'page':'https://freesound.org/people/GO_s0unds123/sounds/730351/','author':'GO_s0unds123','license':'CC0-1.0','title':'Bullet Fly By','url':'https://cdn.freesound.org/previews/730/730351_15855556-hq.mp3'},
 'crack':{'page':'https://freesound.org/people/craigsmith/sounds/675948/','author':'craigsmith','license':'CC0-1.0','title':'S20-43 Heavy ammunition bullets flying overhead & hitting things','url':'https://cdn.freesound.org/previews/675/675948_2524442-hq.mp3'},
}
CUTS={'pass_1':('pass',5.13,5.39),'pass_2':('pass',6.70,6.96),'pass_3':('pass',9.42,9.68),
      'crack_1':('crack',.071,.191),'crack_2':('crack',1.054,1.174),'crack_3':('crack',2.074,2.194)}
def main():
 p=argparse.ArgumentParser();p.add_argument('--ffmpeg',required=True);p.add_argument('--source',default='/private/tmp/cf-flyby-sources');a=p.parse_args()
 out=ROOT/'audio/impacts/flyby';out.mkdir(parents=True,exist_ok=True);decoded={};manifest={'sources':{},'cues':{},'processing':'Mono 48 kHz, high-pass rumble removal, short equal-power fades, level normalization; no pitch/time change. Designed effects, not verified live-fire field recordings.'}
 for name,s in SOURCES.items():
  path=Path(a.source)/(name+'.mp3');b=subprocess.check_output([a.ffmpeg,'-v','error','-i',str(path),'-ac','1','-ar',str(RATE),'-f','f32le','pipe:1'])
  decoded[name]=sosfilt(butter(2,200 if name=='pass' else 850,btype='highpass',fs=RATE,output='sos'),np.frombuffer(b,np.float32))
  manifest['sources'][name]={**s,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
 for name,(src,start,end) in CUTS.items():
  x=decoded[src][round(start*RATE):round(end*RATE)].copy();x-=np.mean(x)
  trim=max(0,int(np.flatnonzero(np.abs(x)>np.max(np.abs(x))*.15)[0])-round(.004*RATE));x=x[trim:];start+=trim/RATE
  fade=round(.001*RATE);tail=round(.018*RATE);x[:fade]*=np.sin(np.linspace(0,np.pi/2,fade))**2;x[-tail:]*=np.cos(np.linspace(0,np.pi/2,tail))**2
  x*=.74/max(np.max(np.abs(x)),1e-9);path=out/(name+'.wav')
  with wave.open(str(path),'wb') as w:w.setparams((1,2,RATE,0,'NONE','not compressed'));w.writeframes(np.rint(x*32767).astype('<i2').tobytes())
  attack=np.flatnonzero(np.abs(x)>max(abs(x))*.15)[0]/RATE
  manifest['cues'][name]={'source':src,'start':start,'end':end,'attack':round(attack,5),'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
 (out/'provenance.json').write_text(json.dumps(manifest,indent=2)+'\n')
 print(json.dumps({k:v['attack'] for k,v in manifest['cues'].items()}))
if __name__=='__main__':main()
