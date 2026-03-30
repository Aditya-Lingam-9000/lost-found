#!/usr/bin/env python3
"""
INTERACTIVE TEST TOOL - Test custom matching scenarios
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from ai.text_matching import get_text_score, get_field_similarity

def print_header():
    print("\n" + "=" * 80)
    print("  INTERACTIVE MATCHING ALGORITHM TESTER")
    print("=" * 80)
    print("\nEnter two texts to compare (lost details vs found details)")
    print("Type 'exit' to quit, 'menu' to see options")
    print("=" * 80 + "\n")

def print_menu():
    print("\nOPTIONS:")
    print("  1. Test general text matching")
    print("  2. Test field-level matching (item_name, description, location)")
    print("  3. Show debug scoring breakdown")
    print("  4. Run preset test cases")
    print("  5. Exit")
    print()

def test_general():
    print("\n--- GENERAL TEXT MATCHING ---")
    text1 = input("Enter LOST item details: ").strip()
    if text1.lower() == 'exit':
        return
    
    text2 = input("Enter FOUND item details: ").strip()
    if text2.lower() == 'exit':
        return
    
    score = get_text_score(text1, text2)
    
    print(f"\nMatch Score: {score:.2f} (0.0 - 1.0)")
    print("\nInterpretation:")
    if score >= 0.70:
        print("  ✓ STRONG MATCH - Highly likely the same item")
    elif score >= 0.60:
        print("  ~ MEDIUM MATCH - Probable match, needs verification")
    elif score >= 0.50:
        print("  ⚠ WEAK MATCH - Careful, text-only match")
    else:
        print("  ✗ NO MATCH - Likely different items")

def test_field_level():
    print("\n--- FIELD-LEVEL MATCHING ---")
    field_type = input("Field type (item_name/description/location): ").strip().lower()
    
    if field_type not in ['item_name', 'description', 'location']:
        print("Invalid field type. Using 'description' as default")
        field_type = 'description'
    
    text1 = input("Enter first value: ").strip()
    if text1.lower() == 'exit':
        return
    
    text2 = input("Enter second value: ").strip()
    if text2.lower() == 'exit':
        return
    
    score = get_field_similarity(text1, text2, field_name=field_type)
    
    print(f"\n{field_type.upper()} Match Score: {score:.2f}")
    if score >= 0.75:
        print("  ✓ EXCELLENT MATCH")
    elif score >= 0.60:
        print("  ✓ GOOD MATCH")
    elif score >= 0.50:
        print("  ~ MODERATE MATCH")
    else:
        print("  ✗ NO MATCH")

def test_debug():
    print("\n--- DEBUG SCORING BREAKDOWN ---")
    text1 = input("Enter LOST item details: ").strip()
    if text1.lower() == 'exit':
        return
    
    text2 = input("Enter FOUND item details: ").strip()
    if text2.lower() == 'exit':
        return
    
    print("\n" + "-" * 80)
    score = get_text_score(text1, text2, debug=True)
    print("-" * 80)

def run_presets():
    print("\n--- PRESET TEST CASES ---")
    
    presets = [
        ("Exact Match", 
         "iPhone 15 red", 
         "iPhone 15 red"),
        
        ("Spelling Mistake",
         "Samsang Galaxy S23",
         "Samsung Galaxy S23"),
        
        ("Word Reordering",
         "lost iPhone 15 at mall",
         "mall found iPhone 15"),
        
        ("Semantic Similarity",
         "Apple smartwatch series 9",
         "Apple Watch series 9"),
        
        ("False Positive Test 1",
         "iPhone 15 red",
         "Samsung Galaxy black"),
    ]
    
    for name, text1, text2 in presets:
        score = get_text_score(text1, text2)
        print(f"\n{name}:")
        print(f"  Lost:  {text1}")
        print(f"  Found: {text2}")
        print(f"  Score: {score:.2f}", end="")
        
        if score >= 0.70:
            print(" ✓ STRONG")
        elif score >= 0.60:
            print(" ~ MEDIUM")
        elif score >= 0.50:
            print(" ⚠ WEAK")
        else:
            print(" ✗ NO MATCH")

def main():
    print_header()
    
    while True:
        print_menu()
        choice = input("Choose option (1-5): ").strip()
        
        if choice == '1':
            test_general()
        elif choice == '2':
            test_field_level()
        elif choice == '3':
            test_debug()
        elif choice == '4':
            run_presets()
        elif choice == '5' or choice.lower() == 'exit':
            print("\nGoodbye!")
            break
        else:
            print("Invalid option. Try again.")

if __name__ == '__main__':
    main()
