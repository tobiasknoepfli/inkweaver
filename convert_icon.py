from PIL import Image
import os

img_path = r'C:\Users\tobik\.gemini\antigravity\scratch\inkweaver\wwwroot\logo.png'
ico_path = r'C:\Users\tobik\.gemini\antigravity\scratch\inkweaver\InkweaverShell\logo.ico'

img = Image.open(img_path)
# Ensure it's square for best results
icon_sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
img.save(ico_path, sizes=icon_sizes)
print(f"Icon saved to {ico_path}")
