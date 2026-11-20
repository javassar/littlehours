import numpy as np
from PIL import Image

# Load the image and convert to grayscale
img = Image.open("swans_dot.png").convert("L")
gray = np.array(img, dtype=np.float32)

# Calculate alpha from darkness (white = 0 alpha, black = 255 alpha)
# Thresholding slightly removes faint JPEG compression artifacts
alpha = np.clip((240.0 - gray) / 240.0 * 255.0, 0, 255).astype(np.uint8)

# Soft pink RGB: (217, 138, 156) / #D98A9C — light, soft, and legible on cream
rgba = np.zeros((gray.shape[0], gray.shape[1], 4), dtype=np.uint8)
rgba[..., 0] = 217  # Red
rgba[..., 1] = 138  # Green
rgba[..., 2] = 156  # Blue
rgba[..., 3] = alpha

# Save as transparent PNG
Image.fromarray(rgba, "RGBA").save("swans_soft_pink.png")