#!/usr/bin/env python3
"""
ADVANCED MATCHING ALGORITHM - MANUAL TEST SUITE
Tests all scenarios: semantic meaning, word swaps, spelling mistakes, etc.
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from ai.text_matching import (
    get_text_score, 
    get_field_similarity,
    normalize,
    get_tokens,
    get_important_tokens
)

def print_section(title):
    """Print a formatted section header"""
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80)

def test_scenario(name, lost_text, found_text, expected_min=0.0):
    """Test a matching scenario and display results"""
    score = get_text_score(lost_text, found_text, debug=True)
    
    status = "✓ PASS" if score >= expected_min else "✗ FAIL"
    print(f"{status}: {name}")
    print(f"Expected: >= {expected_min:.2f}, Got: {score:.2f}")
    print("-" * 80)
    return score

def test_field_matching():
    """Test field-level matching with different field types"""
    print_section("FIELD-LEVEL MATCHING TESTS")
    
    test_cases = [
        ("Item Name (exact)", "iPhone 15", "iPhone 15", "item_name", 0.95),
        ("Item Name (typo)", "iPhone 15", "Iphone 15", "item_name", 0.90),
        ("Item Name (partial)", "Samsung Phone", "Samsung", "item_name", 0.70),
        ("Description (semantic)", "black phone with crack", "phone damaged with black screen", "description", 0.60),
        ("Location (synonym)", "shopping mall", "shopping center", "location", 0.70),
        ("Location (abbr)", "university", "uni", "location", 0.50),
    ]
    
    for name, text1, text2, field, expected in test_cases:
        score = get_field_similarity(text1, text2, field_name=field)
        status = "✓" if score >= expected else "✗"
        print(f"{status} {name:40} | Exp: {expected:.2f}, Got: {score:.2f}")

def test_semantic_similarity():
    """Test semantic similarity with different vocabulary"""
    print_section("SEMANTIC SIMILARITY TESTS (Different vocabulary, same meaning)")
    
    scenarios = [
        ("Both iPhones", "lost iPhone 15 red", "found apple phone red", 0.65),
        ("Both watches", "lost apple watch series 8", "found smartwatch wearable", 0.60),
        ("Both at malls", "lost at shopping center", "found at mall", 0.70),
        ("Similar colors", "black device", "charcoal phone", 0.50),
    ]
    
    for name, lost, found, expected in scenarios:
        test_scenario(name, lost, found, expected)

def test_word_swaps():
    """Test word reordering and swaps"""
    print_section("WORD SWAP & REORDERING TESTS")
    
    scenarios = [
        ("Word reorder 1", "iPhone 15 red found at mall", "found red iPhone 15 at mall", 0.75),
        ("Word reorder 2", "Samsung phone black lost location college", "college location lost black phone Samsung", 0.70),
        ("Word reorder 3", "blue watch smartwatch apple", "apple smartwatch blue watch", 0.70),
        ("Partial shuffle", "iPhone damaged screen", "screen damaged iPhone", 0.75),
    ]
    
    for name, lost, found, expected in scenarios:
        test_scenario(name, lost, found, expected)

def test_spelling_mistakes():
    """Test tolerance for spelling mistakes and typos"""
    print_section("SPELLING MISTAKES & TYPOS TESTS")
    
    scenarios = [
        ("Single char typo", "Samsung phone", "Samsang phone", 0.75),
        ("Device name typo", "iPhone 15", "iphone 15", 0.85),
        ("Double typo", "realme note 20", "realme note 2.0", 0.75),
        ("Brand typo", "Samsong Galaxy", "Samsung Mobile", 0.70),
        ("Complex typo", "Raelme Note 20 Pro Max", "Realme Note 2.0 Pro Max", 0.70),
        ("Missing vowels", "phn", "phone", 0.50),  # Too different
    ]
    
    for name, lost, found, expected in scenarios:
        test_scenario(name, lost, found, expected)

def test_real_world_scenarios():
    """Test realistic lost and found scenarios"""
    print_section("REAL-WORLD SCENARIOS")
    
    scenarios = [
        ("Phone - exact",
         "Lost: Apple iPhone 15 Pro Max silver color",
         "Found: iPhone 15 Pro Max in silver", 0.80),
        
        ("Phone - typo & reorder",
         "Lost: Samsung Galaxy S23 ultra black at mall",
         "Found: Black Ultra Galaxy S23 Samsung mall", 0.75),
        
        ("Phone - description variation",
         "Lost: Realme Note 20 Pro with blue case",
         "Found: realme note 2.0 blue case", 0.70),
        
        ("Watch - semantic",
         "Lost: Apple smartwatch series 9",
         "Found: Apple Watch band series 9", 0.70),
        
        ("Laptop - partial",
         "Lost: Dell XPS 13 at university",
         "Found: XPS laptop Dell", 0.65),
        
        ("False Positive Blocking 1",
         "Lost: iPhone 15 red",
         "Found: Samsung Galaxy phone black", 0.25),  # Should NOT match
        
        ("False Positive Blocking 2",
         "Lost: Apple Watch at park",
         "Found: Casio Watch black at beach", 0.30),  # Should NOT match
    ]
    
    for name, lost, found, expected in scenarios:
        test_scenario(name, lost, found, expected)

def test_edge_cases():
    """Test edge cases and boundary conditions"""
    print_section("EDGE CASES")
    
    scenarios = [
        ("Empty strings", "", "", 1.0),
        ("One empty", "iPhone", "", 0.0),
        ("Very short", "phone", "phone", 0.95),
        ("Very long descriptions",
         "lost a beautiful apple iphone 15 pro max in silver color with a slight scratch on back" +
         "bought last month at apple store premium storage 256gb",
         "found apple iphone 15 pro max silver color with scratch mark storage 256", 0.70),
        ("Numbers only", "15 256 512", "256 512 15", 0.90),
        ("Special chars", "iPhone 15 & iPad", "iPhone 15 iPad", 0.85),
    ]
    
    for name, lost, found, expected in scenarios:
        test_scenario(name, lost, found, expected)

def run_comprehensive_test():
    """Run all test suites"""
    print("\n")
    print("█" * 80)
    print("█  ADVANCED MATCHING ALGORITHM - COMPREHENSIVE TEST SUITE")
    print("█" * 80)
    
    test_field_matching()
    test_semantic_similarity()
    test_word_swaps()
    test_spelling_mistakes()
    test_real_world_scenarios()
    test_edge_cases()
    
    print_section("TEST SUITE COMPLETE")
    print("\nAll tests completed! Review results above for any failures (✗ marks).")
    print("\nIMPORTANT THRESHOLDS:")
    print("  • Strong Match (≥ 0.70): Highly likely the same item")
    print("  • Medium Match (0.60 - 0.69): Probable match, may need verification")
    print("  • Weak Match (0.50 - 0.59): Text-only matches, requires care")
    print("  • No Match (< 0.50): Likely different items")

if __name__ == '__main__':
    run_comprehensive_test()
