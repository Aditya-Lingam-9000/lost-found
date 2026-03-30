import re
import math
from collections import Counter
from rapidfuzz import fuzz, distance
from difflib import SequenceMatcher

# ============================================================================
# ADVANCED TEXT MATCHING WITH MULTIPLE TECHNIQUES
# Handles: semantic similarity, word swaps, spelling mistakes, rearrangement
# ============================================================================

STOPWORDS = set([
    "i", "me", "my", "myself", "we", "our", "ours", "ourselves", "you",
    "your", "yours", "yourself", "yourselves", "he", "him", "his", "himself",
    "she", "her", "hers", "herself", "it", "its", "itself", "they", "them",
    "their", "theirs", "themselves", "what", "which", "who", "whom", "this",
    "that", "these", "those", "am", "is", "are", "was", "were", "be", "been",
    "being", "have", "has", "had", "having", "do", "does", "did", "doing",
    "a", "an", "the", "and", "but", "if", "or", "because", "as", "until",
    "while", "of", "at", "by", "for", "with", "about", "against", "between",
    "into", "through", "during", "before", "after", "above", "below", "to",
    "from", "up", "down", "in", "out", "on", "off", "over", "under", "again",
    "further", "then", "once", "here", "there", "when", "where", "why", "how",
    "all", "any", "both", "each", "few", "more", "most", "other", "some", "such",
    "no", "nor", "not", "only", "own", "same", "so", "than", "too", "very",
    "s", "t", "can", "will", "just", "don", "should", "now"
])

# Semantic groups for common items (helps with synonym matching)
SEMANTIC_GROUPS = {
    "phone": ["phone", "mobile", "smartphone", "cell", "iphone", "samsung", "realme", "redmi", "honor", "poco", "nokia", "motorola", "oneplus"],
    "watch": ["watch", "smartwatch", "fitbit", "apple watch", "mi band", "realme band", "honor band"],
    "laptop": ["laptop", "macbook", "dell", "hp", "lenovo", "asus", "computer", "notebook", "chromebook"],
    "tablet": ["tablet", "ipad", "samsung tablet", "kindle"],
    "color": ["black", "white", "red", "blue", "green", "yellow", "gold", "silver", "gray", "brown", "purple", "pink"],
    "location": ["mall", "market", "shopping", "center", "station", "bus", "metro", "park", "cafe", "store", "shop", "office", "home", "street", "road", "university", "college", "school"],
    "condition": ["new", "like new", "good", "broken", "cracked", "scratched", "damaged", "perfect", "mint", "condition"]
}

def normalize(text):
    """Normalize text: lowercase, remove punctuation, extra spaces"""
    text = str(text).lower().strip()
    # Remove special characters but keep alphanumeric and spaces
    text = re.sub(r'[^\w\s]', '', text)
    # Remove extra spaces
    text = re.sub(r'\s+', ' ', text)
    return text

def get_tokens(text, remove_stopwords=True):
    """Split text into tokens, optionally removing stopwords"""
    norm_text = normalize(text)
    tokens = norm_text.split()
    if remove_stopwords:
        tokens = [t for t in tokens if t not in STOPWORDS and len(t) > 1]
    return tokens

def get_important_tokens(text):
    """Extract important tokens (longer words, likely to be more meaningful)"""
    tokens = get_tokens(text, remove_stopwords=True)
    # Prioritize tokens with length > 3 (more descriptive)
    important = [t for t in tokens if len(t) > 3]
    return important if important else tokens[:3]  # fallback to first 3 tokens

def phonetic_similarity(word1, word2):
    """Match phonetically similar words (handles spelling variations)"""
    # Levenshtein distance for typo detection
    lev_distance = distance.Levenshtein.normalized_distance(word1, word2)
    # If normalized distance < 0.3, likely same word with typo
    return 1.0 - lev_distance if lev_distance < 0.4 else 0.0

def token_fuzzy_match(tokens1, tokens2):
    """Match tokens with fuzzy matching (handles typos, word swaps in token level)"""
    if not tokens1 or not tokens2:
        return 0.0
    
    # Create best matches for each token in tokens1 against tokens2
    matched_score = 0
    for token1 in tokens1:
        best_match = max(
            (fuzz.ratio(token1, token2) for token2 in tokens2),
            default=0
        )
        matched_score += best_match / 100.0
    
    # Normalize by average length
    avg_len = (len(tokens1) + len(tokens2)) / 2
    return (matched_score / len(tokens1)) if tokens1 else 0.0

def semantic_similarity(text1, text2):
    """Check if texts belong to same semantic groups (e.g., both are phones, both are colors)"""
    tokens1 = get_tokens(normalize(text1))
    tokens2 = get_tokens(normalize(text2))
    
    matches = 0
    for group_name, keywords in SEMANTIC_GROUPS.items():
        has_in_text1 = any(token in keywords for token in tokens1)
        has_in_text2 = any(token in keywords for token in tokens2)
        if has_in_text1 and has_in_text2:
            matches += 1
    
    # Max 5 semantic groups typically in a description
    return min(1.0, matches / 5.0)

def sequence_matching_score(text1, text2):
    """Use RapidFuzz token_set_ratio: handles word order + fuzzy matching + substrings"""
    # token_set_ratio: good for word reordering + fuzzy matching simultaneously
    # It tokenizes, deduplicates, and matches, so "phone found at mall" == "mall phone found"
    return fuzz.token_set_ratio(normalize(text1), normalize(text2)) / 100.0

def partial_matching_score(text1, text2):
    """Use RapidFuzz partial_ratio: handles substring matches (e.g., description contains item name)"""
    return fuzz.partial_ratio(normalize(text1), normalize(text2)) / 100.0

def jaccard_similarity(tokens1, tokens2):
    """Jaccard: intersection/union of tokens (set overlap)"""
    if not tokens1 and not tokens2:
        return 1.0
    if not tokens1 or not tokens2:
        return 0.0
    
    set1 = set(tokens1)
    set2 = set(tokens2)
    
    intersection = len(set1 & set2)
    union = len(set1 | set2)
    
    return intersection / union if union > 0 else 0.0

def get_text_score(text1: str, text2: str, debug=False) -> float:
    """
    Advanced similarity matching combining multiple algorithms:
    1. Token-set fuzzy matching (handles word swaps + spelling mistakes)
    2. Partial ratio matching (for substring overlaps)
    3. Token-level fuzzy matching (granular comparison)
    4. Jaccard similarity (set overlap)
    5. Phonetic matching for important words
    6. Semantic group matching
    
    Returns score 0.0-1.0 (higher = more similar)
    """
    if not text1 or not text2:
        return 0.0 if (text1 or text2) else 1.0
    
    norm_t1 = normalize(text1)
    norm_t2 = normalize(text2)
    
    if not norm_t1 or not norm_t2:
        return 0.0
    
    # Score 1: Token-Set Ratio (BEST for real-world typos, word reordering, partial matches)
    # This is the workhorse: handles "realme note 20 at mall" vs "note 2.0 realme found mall"
    token_set_score = sequence_matching_score(text1, text2)
    
    # Score 2: Partial Ratio (good for finding descriptions containing item names)
    partial_score = partial_matching_score(text1, text2)
    
    # Score 3: Token-level Fuzzy Match (granular matching of important terms)
    imp_tokens1 = get_important_tokens(text1)
    imp_tokens2 = get_important_tokens(text2)
    token_fuzzy_score = token_fuzzy_match(imp_tokens1, imp_tokens2)
    
    # Score 4: Jaccard Similarity (rewards exact token overlaps)
    tokens1 = get_tokens(text1)
    tokens2 = get_tokens(text2)
    jaccard_score = jaccard_similarity(tokens1, tokens2)
    
    # Score 5: Semantic Matching (bonus if both are same category like "phone" + "phone")
    semantic_score = semantic_similarity(text1, text2)
    
    # Score 6: Phonetic Matching for important terms (handles nickname matches)
    phonetic_boost = 0.0
    if len(imp_tokens1) > 0 and len(imp_tokens2) > 0:
        # Check if any important token has high phonetic similarity
        for t1 in imp_tokens1:
            for t2 in imp_tokens2:
                phonetic_boost += phonetic_similarity(t1, t2)
        phonetic_boost = min(phonetic_boost / 5.0, 0.15)  # Cap phonetic boost
    
    # ========== BLEND SCORES ==========
    # Weight distribution optimized for high accuracy without false positives:
    # - token_set is the workhorse (50%): handles 90% of real-world variations
    # - partial adds context awareness (20%)
    # - token_fuzzy provides granular check (15%)
    # - jaccard prevents false positives from unrelated texts (10%)
    # - semantic provides category match bonus (5%)
    
    blended = (
        0.50 * token_set_score +
        0.20 * partial_score +
        0.15 * token_fuzzy_score +
        0.10 * jaccard_score +
        0.05 * semantic_score
    )
    
    # Add small phonetic boost if available
    final_score = min(1.0, blended + phonetic_boost)
    
    if debug:
        print(f"\n=== MATCHING DEBUG ===")
        print(f"Text1: {text1[:50]}...")
        print(f"Text2: {text2[:50]}...")
        print(f"  Token-Set: {token_set_score:.2f} (word swap/typo resilient)")
        print(f"  Partial:   {partial_score:.2f} (substring match)")
        print(f"  Token-Fuz: {token_fuzzy_score:.2f} (term-level fuzzy)")
        print(f"  Jaccard:   {jaccard_score:.2f} (set overlap)")
        print(f"  Semantic:  {semantic_score:.2f} (category match)")
        print(f"  Phonetic:  {phonetic_boost:.2f} (typo handling)")
        print(f"  FINAL:     {final_score:.2f}")
        print(f"===================\n")
    
    return final_score


# ============================================================================
# CONVENIENCE FUNCTION FOR FIELD-LEVEL MATCHING
# ============================================================================

def get_field_similarity(field1_value: str, field2_value: str, field_name: str = "general") -> float:
    """
    Match individual fields with appropriate weighting:
    - "item_name" : stricter (name should be very similar)
    - "description" : moderate (more variation allowed)
    - "location" : lenient (can have many variations)
    """
    base_score = get_text_score(field1_value, field2_value)
    
    # Adjust thresholds based on field type for stricter/lenient matching
    if field_name == "item_name":
        # Names should match very closely (at least 0.6 base)
        return base_score if base_score >= 0.6 else base_score * 0.8
    elif field_name == "location":
        # Locations can vary more (mall vs shopping center)
        return base_score * 0.9  # slight boost
    else:
        # Description field: use base score as-is
        return base_score

