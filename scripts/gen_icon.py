"""
Generates the placeholder app icon: a minimalist greyscale donut/pie mark
on a soft off-white rounded-square card, matching the dashboard's
neumorphic aesthetic. Produces assets/icon.svg and assets/icon.png (1024x1024).

This is a placeholder until the user's real icon is available — see README.
"""
import math
import cairosvg

SIZE = 1024
CX = CY = SIZE / 2
R = 300
STROKE = 160
CIRC = 2 * math.pi * R

segments = [
    ("#2B2B2B", 0.45),  # charcoal
    ("#8F8F8F", 0.30),  # mid grey
    ("#D6D6D2", 0.25),  # light grey
]

corner = 230  # squircle-ish corner radius for the 1024 canvas

circles = []
offset = 0.0
for color, frac in segments:
    length = CIRC * frac
    dasharray = f"{length:.3f} {CIRC - length:.3f}"
    dashoffset = -offset
    circles.append(
        f'<circle cx="{CX}" cy="{CY}" r="{R}" fill="none" stroke="{color}" '
        f'stroke-width="{STROKE}" stroke-dasharray="{dasharray}" '
        f'stroke-dashoffset="{dashoffset:.3f}" transform="rotate(-90 {CX} {CY})" />'
    )
    offset += length

svg = f'''<svg width="{SIZE}" height="{SIZE}" viewBox="0 0 {SIZE} {SIZE}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#FBFBFA"/>
      <stop offset="100%" stop-color="#EDEDEA"/>
    </linearGradient>
    <filter id="soft" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#000000" flood-opacity="0.16"/>
    </filter>
  </defs>
  <rect x="0" y="0" width="{SIZE}" height="{SIZE}" rx="{corner}" ry="{corner}" fill="url(#bg)"/>
  <rect x="20" y="20" width="{SIZE-40}" height="{SIZE-40}" rx="{corner-16}" ry="{corner-16}"
        fill="none" stroke="#FFFFFF" stroke-width="2" opacity="0.6"/>
  <g filter="url(#soft)">
    {''.join(circles)}
  </g>
  <circle cx="{CX}" cy="{CY}" r="{R-STROKE/2-30}" fill="#FBFBFA"/>
</svg>'''

with open("assets/icon.svg", "w") as f:
    f.write(svg)

cairosvg.svg2png(bytestring=svg.encode(), write_to="assets/icon.png",
                  output_width=SIZE, output_height=SIZE)

print("Wrote assets/icon.svg and assets/icon.png")
