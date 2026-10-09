"""Build original compact HUD numerals; no game/client font is redistributed."""
from pathlib import Path
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
# Square, clipped-corner numerals with broad proportions, like the reference HUD.
segments = {
 'a':[(100,710),(580,710),(620,670),(566,625),(115,625),(65,670)],
 'g':[(110,405),(566,405),(610,365),(566,325),(110,325),(65,365)],
 'd':[(115,105),(566,105),(620,60),(580,20),(100,20),(65,60)],
 'f':[(55,650),(140,605),(140,425),(55,380),(35,405),(35,625)],
 'b':[(630,650),(650,625),(650,405),(630,380),(545,425),(545,605)],
 'e':[(55,350),(140,305),(140,125),(55,80),(35,105),(35,325)],
 'c':[(630,350),(650,325),(650,105),(630,80),(545,125),(545,305)],
}
forms={'0':'abcedf','1':'bc','2':'abged','3':'abgcd','4':'fgbc','5':'afgcd','6':'afgecd','7':'abc','8':'abcdefg','9':'abfgcd','-':'g'}
glyphs={};metrics={};cmap={}
def glyph(name,polys,width=710):
 p=TTGlyphPen(None)
 for poly in polys:
  p.moveTo(poly[0])
  for point in poly[1:]:p.lineTo(point)
  p.closePath()
 glyphs[name]=p.glyph();metrics[name]=(width,0)
glyph('.notdef',[]);glyph('space',[],280);cmap[32]='space'
for char,segs in forms.items():
 name='n'+str(ord(char));glyph(name,[segments[s] for s in segs]);cmap[ord(char)]=name
glyph('colon',[[(95,y),(185,y),(185,y+90),(95,y+90)] for y in (165,485)],280);cmap[58]='colon'
glyph('slash',[[(35,20),(130,20),(350,710),(255,710)]],385);cmap[47]='slash'
f=FontBuilder(1000,isTTF=True);f.setupGlyphOrder(list(glyphs));f.setupCharacterMap(cmap);f.setupGlyf(glyphs);f.setupHorizontalMetrics(metrics);f.setupHorizontalHeader(ascent=820,descent=-180)
f.setupNameTable({'familyName':'Tactical HUD','styleName':'Regular','uniqueFontIdentifier':'TacticalHUD-1','fullName':'Tactical HUD Numerals','psName':'TacticalHUD-Numerals'});f.setupOS2(sTypoAscender=820,sTypoDescender=-180,usWinAscent=820,usWinDescent=180);f.setupPost();f.setupMaxp();f.font.flavor='woff'
f.save(Path(__file__).resolve().parents[1]/'assets/hud/numerals.woff')
