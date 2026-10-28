#!/usr/bin/env python3
"""Обои, иллюстрации, награды и звуки для приложения."""
from PIL import Image, ImageDraw, ImageFilter, ImageChops
import math, random, os, subprocess

BASE=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WALL=os.path.join(BASE,"assets","wallpapers"); ART=os.path.join(BASE,"assets","art")
BADGE=os.path.join(BASE,"assets","badges"); SND=os.path.join(BASE,"assets","sounds")
for d in (WALL,ART,BADGE,SND): os.makedirs(d, exist_ok=True)
ORANGE=(254,80,0); GOLD=(255,200,87)

def grain(img, amount=7):
    n=Image.effect_noise(img.size, 22).convert("L")
    noise=Image.merge("RGB",(n,n,n)).point(lambda v: 128+(v-128)*amount/100)
    return ImageChops.overlay(img, noise)

def wallpaper(i, name, base, blobs, accent):
    W,H=2880,6400
    img=Image.new("RGB",(W,H),base); layer=Image.new("RGB",(W,H),(0,0,0))
    dl=ImageDraw.Draw(layer)
    random.seed(i*17+3)
    for (cx,cy,r,col) in blobs:
        dl.ellipse([cx-r,cy-r,cx+r,cy+r],fill=col)
    layer=layer.filter(ImageFilter.GaussianBlur(radius=W//5))
    img=Image.blend(img,layer,0.9)
    # геометрия: концентрические дуги в стиле бренда
    ov=Image.new("RGBA",(W,H),(0,0,0,0)); do=ImageDraw.Draw(ov)
    cc=random.choice([(int(W*0.2),int(H*0.22)),(int(W*0.8),int(H*0.78)),(int(W*0.85),int(H*0.18))])
    for k in range(7):
        r=260+k*150
        do.ellipse([cc[0]-r,cc[1]-r,cc[0]+r,cc[1]+r], outline=accent+(26,), width=3)
    ov=ov.filter(ImageFilter.GaussianBlur(0.6))
    img=Image.alpha_composite(img.convert("RGBA"),ov).convert("RGB")
    img=grain(img,6)
    img.save(f"{WALL}/{name}.jpg", quality=96, optimize=True, subsampling=0)

BASE_D=(16,17,21)
WALLS=[("w1",BASE_D,[(1150,520,760,(132,46,4)),(240,1500,700,(92,58,12)),(900,2700,820,(78,34,6))],ORANGE),
       ("w2",BASE_D,[(200,400,700,(120,52,10)),(1200,1200,760,(88,40,4)),(500,2800,700,(96,64,16))],GOLD),
       ("w3",(20,17,26),[(720,900,900,(104,36,10)),(160,2600,620,(70,34,14))],ORANGE),
       ("w4",(14,19,24),[(720,1400,900,(26,74,110)),(1200,400,520,(120,60,10))],(90,170,255)),
       ("w5",(22,16,14),[(900,700,820,(140,54,6)),(300,2200,740,(96,50,10)),(720,3200,500,(60,30,8))],GOLD),
       ("w6",(15,17,20),[(360,600,640,(110,44,8)),(1150,1900,780,(86,66,20)),(500,3100,560,(60,30,6))],ORANGE),
       ("w7",(18,16,24),[(720,1100,880,(90,36,16)),(220,2900,600,(40,36,90))],(170,110,255)),
       ("w8",(12,20,22),[(1150,800,760,(24,92,110)),(320,2200,700,(120,60,10))],(80,210,230)),
       ("w9",(24,18,14),[(720,900,860,(150,64,8)),(1150,2500,640,(100,40,10))],ORANGE),
       ("w10",(16,16,18),[(400,1200,800,(70,38,12)),(1100,2600,760,(110,50,6))],GOLD),
       ("w11",(17,15,21),[(760,900,880,(120,44,14)),(260,2500,640,(70,36,18)),(1150,1500,520,(90,30,10))],(180,120,255)),
       ("w12",(14,18,23),[(1150,700,780,(20,86,108)),(300,2300,720,(96,44,10))],(70,200,225)),
       ("w13",(26,17,13),[(500,700,820,(160,70,10)),(1150,2400,680,(110,46,8))],GOLD),
       ("w14",(15,17,19),[(760,1500,900,(84,46,14)),(240,600,560,(120,60,12)),(1150,2900,600,(70,36,8))],ORANGE),
       ("w15",(18,17,25),[(500,1000,820,(96,40,90)),(1150,2600,700,(60,36,100))],(170,120,255)),
       ("w16",(12,19,20),[(1150,1000,780,(26,96,104)),(300,2600,700,(110,54,8))],(90,220,235))]
for i,(n,b,bl,a) in enumerate(WALLS): wallpaper(i,n,b,bl,a)
print("обоев:", len(WALLS))

def illustration(name, kind):
    W,H=2400,1800; img=Image.new("RGBA",(W,H),(0,0,0,0)); d=ImageDraw.Draw(img); K=1.5
    if kind=="kitchen":
        d.rounded_rectangle([120,180,1680,1170],radius=48,fill=(30,32,40,255))
        d.rounded_rectangle([225,300,1575,450],radius=20,fill=(44,47,57,255))
        for x in (250,420,590,760,930):
            d.ellipse([x-34,232,x+34,300],fill=(254,80,0,255) if x in (420,760) else (70,74,86,255))
        d.rounded_rectangle([225,570,780,1050],radius=28,fill=(38,41,50,255))
        for i in range(3):
            d.ellipse([210+i*100,450,290+i*100,530],fill=(255,200,87,255))
        d.pieslice([930,600,1620,1140],0,180,fill=(254,80,0,255))
        d.ellipse([780,500,920,620],fill=(255,200,87,255))
    elif kind=="delivery":
        d.rounded_rectangle([180,360,1620,1080],radius=44,fill=(30,32,40,255))
        d.rounded_rectangle([285,480,1515,705],radius=24,fill=(254,80,0,255))
        d.ellipse([240,530,420,710],fill=(60,64,76,255)); d.ellipse([240,580,370,710],fill=(20,22,27,255))
        d.ellipse([800,530,980,710],fill=(60,64,76,255)); d.ellipse([800,580,930,710],fill=(20,22,27,255))
        d.text((120,120),"→",fill=(255,200,87,255))
    elif kind=="calendar":
        d.rounded_rectangle([180,225,1620,1185],radius=40,fill=(30,32,40,255))
        d.rounded_rectangle([180,225,1620,450],radius=40,fill=(254,80,0,255))
        d.rectangle([180,375,1620,450],fill=(254,80,0,255))
        for r in range(4):
            for c in range(7):
                x=190+c*128; y=360+r*100
                col=(255,200,87,255) if (r==1 and c in (2,3,4)) else (66,70,82,255)
                d.rounded_rectangle([x,y,x+70,y+62],radius=14,fill=col)
    elif kind=="money":
        for i in range(4):
            y=560-i*90
            d.rounded_rectangle([180-i*20,y,1020+i*20,y+150],radius=28,fill=(254,80,0,255) if i==3 else (168,54,3,255))
        d.ellipse([540,260,660,380],outline=(255,200,87,255),width=14)
    elif kind=="clock":
        d.ellipse([390,180,1410,1200],outline=(254,80,0,255),width=22)
        d.ellipse([450,240,1350,1140],outline=(255,200,87,255),width=8)
        d.line([600,440,600,260],fill=(255,255,255,255),width=18)
        d.line([600,440,760,520],fill=(255,255,255,255),width=14)
        d.ellipse([572,412,628,468],fill=(255,200,87,255))
    elif kind=="graph":
        d.rounded_rectangle([150,180,1650,1185],radius=40,fill=(30,32,40,255))
        vals=[.3,.55,.42,.78,.62,.92]
        for i,v in enumerate(vals):
            x=200+i*150; h=780*v
            d.rounded_rectangle([x,700-h,x+90,700],radius=18,fill=(254,80,0,255) if i==len(vals)-1 else (74,78,90,255))
        d.line([200,700,900,700],fill=(90,96,110,255),width=6)
    img.save(f"{ART}/{name}.png")
for n,k in [("kitchen","kitchen"),("delivery","delivery"),("calendar","calendar"),
            ("money","money"),("clock","clock"),("graph","graph")]:
    illustration(n,k)
print("иллюстраций: 6")

def badge(i,name,label,color):
    S=512; im=Image.new("RGBA",(S,S),(0,0,0,0)); d=ImageDraw.Draw(im)
    d.ellipse([20,20,S-20,S-20],fill=(34,36,44,255),outline=color+(255,),width=10)
    d.ellipse([52,52,S-52,S-52],outline=color+(90,),width=5)
    c=S/2
    if i==0:   # флейр
        d.ellipse([c-60,c-80,c+60,c+40],fill=color+(255,)); d.polygon([(c-45,c+20),(c+45,c+20),(c,c+110)],fill=color+(255,))
    elif i==1: # часы
        d.ellipse([c-70,c-70,c+70,c+70],outline=color+(255,),width=12)
        d.line([c,c-42,c,c+8],fill=color+(255,),width=10); d.line([c,c,c+38,c+24],fill=color+(255,),width=9)
    elif i==2: # купюра
        d.rounded_rectangle([c-90,c-50,c+90,c+50],radius=14,outline=color+(255,),width=10)
        d.ellipse([c-26,c-26,c+26,c+26],outline=color+(255,),width=8)
    elif i==3: # календарь
        d.rounded_rectangle([c-75,c-62,c+75,c+72],radius=14,outline=color+(255,),width=10)
        d.line([c-75,c-12,c+75,c-12],fill=color+(255,),width=9)
    elif i==4: # звезда
        pts=[]
        for k2 in range(10):
            ang=math.radians(-90+k2*36); rr2=86 if k2%2==0 else 38
            pts.append((c+math.cos(ang)*rr2, c+math.sin(ang)*rr2))
        d.polygon(pts, fill=color+(255,))
    elif i==5: # сердце
        d.ellipse([c-80,c-60,c+8,c+28],fill=color+(255,)); d.ellipse([c-8,c-60,c+80,c+28],fill=color+(255,))
        d.polygon([(c-78,c-6),(c+78,c-6),(c,c+92)],fill=color+(255,))
    else:        # кухонный колпак
        d.ellipse([c-72,c-30,c+72,c+50],fill=color+(255,))
        d.rectangle([c-30,c+46,c+30,c+86],fill=color+(255,))
        d.ellipse([c-72,c-58,c+72,c-10],fill=color+(255,))
    im.save(f"{BADGE}/{name}.png")
BADGES=[("first","Первая смена",GOLD),("ten","10 смен",ORANGE),("fifty","50 смен",GOLD),
        ("hundred","100 часов",BLUE:=(74,168,255)),("thousand","10 000 ₽",ORANGE),
        ("streak","Серия 7 дней",GOLD),("night","Ночная смена",BLUE),("bonus","С премией",ORANGE)]
for i,(n,l,c) in enumerate(BADGES): badge(i,n,l,c)
print("наград:", len(BADGES))

# ── звуки интерфейса (WAV → MP3) ──
import wave, struct, math
def tone(path, freqs, dur=0.18, vol=0.28):
    rate=44100; frames=[]
    n=int(rate*dur)
    for i in range(n):
        t=i/rate; s=0
        for k,f in enumerate(freqs):
            s+=math.sin(2*math.pi*f*t)*(1/(k+1))
        env=math.exp(-3.2*t/dur)
        frames.append(struct.pack("<h", int(max(-1,min(1,s*env*vol))*32767)))
    with wave.open(path,"w") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate); w.writeframes(b"".join(frames))
for name,freqs in [("tap",[880]),("save",[523,784,1046]),("success",[659,880,1318]),("error",[330,247])]:
    wav=f"{SND}/{name}.wav"; tone(wav,freqs)
    subprocess.run(["ffmpeg","-y","-loglevel","error","-i",wav,"-b:a","96k",f"{SND}/{name}.mp3"],check=False)
    os.remove(wav)
print("звуков: 4")
