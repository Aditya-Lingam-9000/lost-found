import os
try:
    import imagehash
    from PIL import Image
    HAS_IMAGE_TOOLS = True
except ImportError:
    HAS_IMAGE_TOOLS = False

def get_image_score(image_path1: str, image_path2: str) -> float:
    """Returns a similarity score between 0.0 and 1.0 using Perceptual Hashing"""
    if not HAS_IMAGE_TOOLS:
        print("Warning: Pillow or imagehash not installed. Skipping image matching.")
        return 0.0
        
    if not image_path1 or not image_path2:
        return 0.0
        
    try:
        # Base path of the backend directory
        base_path = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        
        full_path1 = os.path.join(base_path, image_path1)
        full_path2 = os.path.join(base_path, image_path2)
        
        if not os.path.exists(full_path1) or not os.path.exists(full_path2):
            return 0.0
            
        img1 = Image.open(full_path1)
        img2 = Image.open(full_path2)
        
        # dhash is often better at handling slight modifications like cropping/aspect ratio
        hash1 = imagehash.dhash(img1)
        hash2 = imagehash.dhash(img2)
        
        # The difference between hashes is the Hamming distance
        diff = hash1 - hash2
        
        # Max difference for a 64-bit hash is 64. 
        # Typically, a difference of < 10 indicates the images are identical/very close.
        # Let's use a scale where a distance of 0 -> 1.0, and >= 25 -> 0.0
        max_diff = 25.0
        similarity = max(0.0, (max_diff - diff) / max_diff)
        
        return float(similarity)
        
    except Exception as e:
        print(f"Error computing image similarity: {e}")
        return 0.0
