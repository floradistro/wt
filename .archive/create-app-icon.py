#!/usr/bin/env python3
"""
Create app icon with black background
"""
from PIL import Image
import os

# Paths
assets_dir = os.path.dirname(os.path.abspath(__file__)) + '/assets'
logo_path = os.path.join(assets_dir, 'logo.png')
icon_path = os.path.join(assets_dir, 'icon.png')
adaptive_icon_path = os.path.join(assets_dir, 'adaptive-icon.png')

# Open the logo
logo = Image.open(logo_path)

# Create 1024x1024 black background
size = 1024
icon = Image.new('RGB', (size, size), (0, 0, 0))

# Resize logo to fit nicely (60% of icon size)
logo_size = int(size * 0.6)
logo_resized = logo.resize((logo_size, logo_size), Image.Resampling.LANCZOS)

# Calculate position to center the logo
position = ((size - logo_size) // 2, (size - logo_size) // 2)

# Paste logo onto black background
# If logo has transparency, use it as mask
if logo_resized.mode in ('RGBA', 'LA'):
    icon.paste(logo_resized, position, logo_resized)
else:
    icon.paste(logo_resized, position)

# Save as icon.png and adaptive-icon.png
icon.save(icon_path, 'PNG')
icon.save(adaptive_icon_path, 'PNG')

print(f"✅ Created app icons with black background:")
print(f"  - {icon_path}")
print(f"  - {adaptive_icon_path}")
