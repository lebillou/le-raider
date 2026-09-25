# Génère l'icône source (1024 px) : grand-livre vert réglé, « R » à l'encre, courbe de cours.
# Usage : python3 scripts/icone.py  →  assets/icone-1024.png (+ icônes web dans public/)
from PIL import Image, ImageDraw, ImageFont
N = 1024
PAPIER, REGLE, ENCRE, VERT, ROUGE = (237, 240, 229), (199, 207, 187), (24, 34, 27), (30, 106, 59), (166, 48, 29)
img = Image.new('RGBA', (N, N), (0, 0, 0, 0))
# Gabarit macOS : 824 px de contenu centré, coins arrondis à ~22 %
m, r = 100, 185
carte = Image.new('RGBA', (N, N), (0, 0, 0, 0))
d = ImageDraw.Draw(carte)
d.rounded_rectangle((m, m, N - m, N - m), r, fill=PAPIER)
for y in range(m + 70, N - m, 56):
    d.line((m + 30, y, N - m - 30, y), fill=REGLE, width=4)
d.line((m + 150, m + 20, m + 150, N - m - 20), fill=(214, 170, 160), width=5)   # marge rouge du registre
police = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf', 560)
bbox = d.textbbox((0, 0), 'R', font=police)
w, h = bbox[2] - bbox[0], bbox[3] - bbox[1]
d.text(((N - w) / 2 - bbox[0] + 30, (N - h) / 2 - bbox[1] - 40), 'R', font=police, fill=ENCRE)
pts = [(m + 60, 790), (300, 760), (400, 800), (500, 700), (600, 730), (700, 620), (800, 565), (N - m - 90, 480)]
d.line(pts, fill=VERT, width=22, joint='curve')
for x, y in pts[-1:]: d.ellipse((x - 20, y - 20, x + 20, y + 20), fill=VERT)
# Tout ce qui dépasse de la carte arrondie est découpé
masque = Image.new('L', (N, N), 0)
ImageDraw.Draw(masque).rounded_rectangle((m, m, N - m, N - m), r, fill=255)
carte.putalpha(masque)
img = Image.alpha_composite(img, carte)
img.save('assets/icone-1024.png')
# Icônes web : fond plein (pas de transparence), sans marge macOS
plein = Image.new('RGB', (N, N), PAPIER)
plein.paste(img.crop((m, m, N - m, N - m)).resize((N, N), Image.LANCZOS), (0, 0), img.crop((m, m, N - m, N - m)).resize((N, N), Image.LANCZOS))
for taille, nom in [(512, 'icone-512.png'), (192, 'icone-192.png'), (180, 'apple-touch-icon.png')]:
    plein.resize((taille, taille), Image.LANCZOS).save(f'public/{nom}')
print('icônes générées')
