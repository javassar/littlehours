import numpy as np
from PIL import Image

# Load the image and convert to grayscale
img = Image.open("swans_dot.png").convert("L")
gray = np.array(img, dtype=np.float32)

# Calculate alpha from darkness (white = 0 alpha, black = 255 alpha)
# Thresholding slightly removes faint JPEG compression artifacts
alpha = np.clip((240.0 - gray) / 240.0 * 255.0, 0, 255).astype(np.uint8)

rgba = np.zeros((gray.shape[0], gray.shape[1], 4), dtype=np.uint8)
rgba[..., 0] = 75   # 4B
rgba[..., 1] = 51   # 33
rgba[..., 2] = 64   # 40
rgba[..., 3] = alpha

# Save as transparent PNG
Image.fromarray(rgba, "RGBA").save("swans_purple.png")