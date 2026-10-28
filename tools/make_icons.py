#!/usr/bin/env python3
"""Генерирует PNG-иконки приложения (нужен Pillow)."""
from PIL import Image, ImageDraw
import os
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
def mark(size, pad_ratio, bg=(25,26,30)):
    S=size; img=Image.new("RGBA",(S,S),(0,0,0,0)); d=ImageDraw.Draw(img)
    d.rectangle([0,0,S,S], fill=bg+(255,))
    cx,cy=S/2,S/2; R=S*pad_ratio; w=max(2,int(S*0.055))
    d.arc([cx-R,cy-R*0.86,cx+R,cy+R*0.62],180,360,fill=(254,80,0,255),width=w)
    rr=int(S*0.075); d.ellipse([cx-rr,cy-R*0.86-rr,cx+rr,cy-R*0.86+rr],fill=(255,200,87,255))
    d.ellipse([cx-R*1.28,cy-R*1.28,cx+R*1.28,cy+R*1.28],outline=(254,80,0,60),width=max(1,int(S*0.012)))
    return img
mark(512,0.30).save(f"{BASE}/assets/icon-512.png")
mark(192,0.30).save(f"{BASE}/assets/icon-192.png")
mark(512,0.22).save(f"{BASE}/assets/icon-maskable.png")
print("иконки готовы")
