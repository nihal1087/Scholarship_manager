import csv
import random

# Configuration
TOTAL_RECORDS = 500
FILENAME = "Comprehensive_Test_Data.csv"

# Data Pools
first_names = ["Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Ayaan", "Krishna", "Ishaan", "Diya", "Saanvi", "Ananya", "Aadhya", "Pari", "Myra", "Riya", "Anvi", "Rahul", "Sneha", "Amit", "Priya"]
last_names = ["Kumar", "Singh", "Sharma", "Verma", "Gupta", "Mishra", "Yadav", "Jha", "Das", "Patel"]
districts_bihar = ["Patna", "Gaya", "Muzaffarpur", "Bhagalpur", "Darbhanga"]
other_states = ["Delhi", "UP", "Maharashtra", "West Bengal"]

def generate_base_student(id):
    """Creates a generic student structure"""
    return {
        'first_name': random.choice(first_names),
        'last_name': random.choice(last_names),
        'email': f"student{id}@scholarship.test",  # Unique email is key
        'mobile': f"9{random.randint(100000000, 999999999)}",
        'gender': random.choice(["Male", "Female"]),
        'dob': "2005-01-01",
        'father': f"Father{id}",
        # Defaults (will be overridden)
        'income': 500000, 
        'state': "Delhi",
        'district': "Other",
        'current_level': "School",
        'current_class': "NA",
        'diploma_type': "NA",
        'course_name': "NA",
        'percent_10th': 50,
        'passing_year_10th': 2020,
        'percent_12th': 0,
        'passing_year_12th': 0,
        'percent_last': 50,
        'entrance_exam': "None",
        'entrance_rank': 0
    }

students = []

for i in range(1, TOTAL_RECORDS + 1):
    s = generate_base_student(i)
    
    # We cycle through 6 scenarios to ensure a perfect mix of data
    scenario = i % 6

    # --- SCENARIO 0: IFFCO TOKIO Eligible ---
    if scenario == 0:
        s['state'] = "Bihar"
        s['income'] = random.randint(50000, 250000)
        s['current_level'] = "School"
        s['current_class'] = "Class 11"
        s['passing_year_10th'] = 2025
        s['percent_10th'] = random.randint(65, 95)
        s['percent_last'] = s['percent_10th'] # Match for logic
    
    # --- SCENARIO 1: NSF Eligible ---
    elif scenario == 1:
        s['state'] = "Bihar"
        s['income'] = random.randint(40000, 180000)
        s['current_level'] = "Diploma"
        s['diploma_type'] = "After 10th"
        s['entrance_exam'] = "DCECE"
        s['entrance_rank'] = random.randint(1, 3900) # Must be <= 4000
        s['percent_10th'] = random.randint(81, 98) # Must be >= 80
        s['passing_year_10th'] = 2025

    # --- SCENARIO 2: FFE Eligible ---
    elif scenario == 2:
        s['state'] = "Bihar"
        s['income'] = random.randint(50000, 250000)
        s['percent_10th'] = random.randint(75, 95) # >= 70
        s['passing_year_10th'] = 2023
        s['percent_12th'] = random.randint(75, 95) # >= 70
        s['passing_year_12th'] = 2025
        s['current_level'] = "Undergraduate"
        s['entrance_exam'] = "JEE Mains"
        s['entrance_rank'] = random.randint(100, 80000) # <= 90000

    # --- SCENARIO 3: PRIF Eligible ---
    elif scenario == 3:
        s['district'] = "Patna" # The only rule for PRIF in our logic
        s['state'] = "Bihar"
        s['income'] = 800000 # High income doesn't matter for PRIF logic as written

    # --- SCENARIO 4: CONFLICT (Eligible for IFFCO + PRIF + NSF) ---
    elif scenario == 4:
        s['state'] = "Bihar"
        s['district'] = "Patna" # PRIF
        s['income'] = 100000 # Low enough for all
        # Setup for NSF & IFFCO Overlap (Diploma)
        s['current_level'] = "Diploma"
        s['diploma_type'] = "After 10th"
        s['percent_10th'] = 85 # High enough for NSF
        s['percent_last'] = 85
        s['passing_year_10th'] = 2025
        s['entrance_exam'] = "DCECE"
        s['entrance_rank'] = 2000 # Good for NSF

    # --- SCENARIO 5: NOT ELIGIBLE (Noise Data) ---
    else:
        s['state'] = random.choice(other_states)
        s['income'] = random.randint(500000, 1000000) # Too high
        s['percent_10th'] = random.randint(40, 50) # Too low

    students.append(s)

# --- Write to CSV ---
headers = [
    "first_name", "last_name", "email", "mobile", "gender", "dob", "father",
    "income", "state", "district", "current_level", "current_class", 
    "diploma_type", "course_name", "percent_10th", "passing_year_10th", 
    "percent_12th", "passing_year_12th", "percent_last", 
    "entrance_exam", "entrance_rank"
]

with open(FILENAME, mode='w', newline='', encoding='utf-8') as file:
    writer = csv.DictWriter(file, fieldnames=headers)
    writer.writeheader()
    writer.writerows(students)

print(f"✅ Successfully generated '{FILENAME}' with {TOTAL_RECORDS} records.")
print("   - Includes IFFCO, NSF, FFE, PRIF, Conflicts, and Ineligible students.")