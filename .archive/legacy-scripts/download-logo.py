#!/usr/bin/env python3
"""
Save the whale logo from the conversation
"""
from PIL import Image, ImageDraw
import os

# Create the whale logo with red eye on black background
size = 1024
img = Image.new('RGBA', (size, size), (0, 0, 0, 255))
draw = ImageDraw.Draw(img)

# This is a simplified version - we'll replace with the actual image
# For now, let's create a placeholder that matches the description
# The actual logo will be provided by the user

# Create a white whale shape (simplified)
whale_color = (255, 255, 255, 255)
eye_color = (255, 0, 0, 255)  # Red eye

# Draw a simple whale body (ellipse)
whale_x = size * 0.3
whale_y = size * 0.35
whale_width = size * 0.5
whale_height = size * 0.35
draw.ellipse([whale_x, whale_y, whale_x + whale_width, whale_y + whale_height], fill=whale_color)

# Draw tail
tail_points = [
    (whale_x - size * 0.05, whale_y + whale_height * 0.4),
    (whale_x - size * 0.15, whale_y + whale_height * 0.2),
    (whale_x - size * 0.1, whale_y + whale_height * 0.6),
]
draw.polygon(tail_points, fill=whale_color)

# Draw water spout
spout_x = whale_x + whale_width * 0.6
spout_y = whale_y - size * 0.05
draw.ellipse([spout_x - 20, spout_y - 40, spout_x + 20, spout_y], fill=whale_color)
draw.ellipse([spout_x + 30, spout_y - 40, spout_x + 70, spout_y], fill=whale_color)

# Draw red eye
eye_x = whale_x + whale_width * 0.65
eye_y = whale_y + whale_height * 0.4
eye_radius = 15
draw.ellipse([eye_x - eye_radius, eye_y - eye_radius, eye_x + eye_radius, eye_y + eye_radius], fill=eye_color)

# Save
assets_dir = os.path.dirname(os.path.abspath(__file__)) + '/assets'
logo_path = os.path.join(assets_dir, 'logo.png')
img.save(logo_path, 'PNG')

print(f"✅ Created whale logo at {logo_path}")
print("Note: This is a simplified version. Please replace with the actual whale logo if available.")
