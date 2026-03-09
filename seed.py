"""
NAYAM (नयम्) — Unified Database Seed Script

Populates the database with rich, realistic demo data in one shot:
  • Admin user (via API)
  • 60 citizens across 8 wards (via API)
  • 130+ issues with varied statuses/priorities/departments (via API)
  • 5 governance documents with full RAG indexing (via API)
  • Date distribution: spreads issue dates across past 30 days (direct DB)
  • 16 action requests for Approvals page (direct DB)
  • 22 calendar events across all types/statuses (direct DB)
  • 9 AI drafts across all document types (direct DB)

Usage:
  python seed.py          # Full seed (backend must be running on localhost:8000)
  python seed.py --reset  # Delete DB and re-seed from scratch

Requires: Backend running on http://localhost:8000
"""

import os
import sys
import uuid
import random
import shutil
import requests
from datetime import datetime, timedelta, timezone

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

# ── Configuration ────────────────────────────────────────────────────

BASE = "http://localhost:8000/api/v1"
DB_URL = "sqlite:///./nayam_dev.db"

engine = create_engine(DB_URL, connect_args={"check_same_thread": False})
Session = sessionmaker(bind=engine)

# ═══════════════════════════════════════════════════════════════════════
# DATA DEFINITIONS
# ═══════════════════════════════════════════════════════════════════════

WARDS = ["Ward-1", "Ward-2", "Ward-3", "Ward-4", "Ward-5", "Ward-6", "Ward-7", "Ward-8"]

CITIZENS = [
    # Ward-1 (8 citizens)
    {"name": "Aarav Sharma", "contact_number": "9876543210", "ward": "Ward-1"},
    {"name": "Ananya Gupta", "contact_number": "9876543215", "ward": "Ward-1"},
    {"name": "Neha Agarwal", "contact_number": "9876543225", "ward": "Ward-1"},
    {"name": "Suresh Malhotra", "contact_number": "9876543230", "ward": "Ward-1"},
    {"name": "Kiran Bala", "contact_number": "9876543231", "ward": "Ward-1"},
    {"name": "Pankaj Srivastava", "contact_number": "9876543232", "ward": "Ward-1"},
    {"name": "Rekha Jain", "contact_number": "9876543233", "ward": "Ward-1"},
    {"name": "Vivek Kohli", "contact_number": "9876543234", "ward": "Ward-1"},
    # Ward-2 (8 citizens)
    {"name": "Priya Patel", "contact_number": "9876543211", "ward": "Ward-2"},
    {"name": "Rajesh Kumar", "contact_number": "9876543216", "ward": "Ward-2"},
    {"name": "Sita Ram", "contact_number": "9876543227", "ward": "Ward-2"},
    {"name": "Harpreet Kaur", "contact_number": "9876543235", "ward": "Ward-2"},
    {"name": "Mohan Lal", "contact_number": "9876543236", "ward": "Ward-2"},
    {"name": "Anjali Saxena", "contact_number": "9876543237", "ward": "Ward-2"},
    {"name": "Dinesh Prasad", "contact_number": "9876543238", "ward": "Ward-2"},
    {"name": "Shobha Rani", "contact_number": "9876543239", "ward": "Ward-2"},
    # Ward-3 (8 citizens)
    {"name": "Rohit Verma", "contact_number": "9876543212", "ward": "Ward-3"},
    {"name": "Meena Kumari", "contact_number": "9876543217", "ward": "Ward-3"},
    {"name": "Manoj Dubey", "contact_number": "9876543228", "ward": "Ward-3"},
    {"name": "Sarita Devi", "contact_number": "9876543240", "ward": "Ward-3"},
    {"name": "Ramesh Chandra", "contact_number": "9876543241", "ward": "Ward-3"},
    {"name": "Pooja Mishra", "contact_number": "9876543242", "ward": "Ward-3"},
    {"name": "Anil Kumar Pal", "contact_number": "9876543243", "ward": "Ward-3"},
    {"name": "Usha Tiwari", "contact_number": "9876543244", "ward": "Ward-3"},
    # Ward-4 (8 citizens)
    {"name": "Sunita Devi", "contact_number": "9876543213", "ward": "Ward-4"},
    {"name": "Arjun Reddy", "contact_number": "9876543220", "ward": "Ward-4"},
    {"name": "Geeta Thakur", "contact_number": "9876543229", "ward": "Ward-4"},
    {"name": "Balram Singh", "contact_number": "9876543245", "ward": "Ward-4"},
    {"name": "Nirmala Pathak", "contact_number": "9876543246", "ward": "Ward-4"},
    {"name": "Yogesh Bhatt", "contact_number": "9876543247", "ward": "Ward-4"},
    {"name": "Kamla Devi", "contact_number": "9876543248", "ward": "Ward-4"},
    {"name": "Sunil Rawat", "contact_number": "9876543249", "ward": "Ward-4"},
    # Ward-5 (7 citizens)
    {"name": "Vikram Singh", "contact_number": "9876543214", "ward": "Ward-5"},
    {"name": "Lakshmi Nair", "contact_number": "9876543221", "ward": "Ward-5"},
    {"name": "Prakash Jha", "contact_number": "9876543250", "ward": "Ward-5"},
    {"name": "Savitri Devi", "contact_number": "9876543251", "ward": "Ward-5"},
    {"name": "Raghav Bansal", "contact_number": "9876543252", "ward": "Ward-5"},
    {"name": "Padma Iyer", "contact_number": "9876543253", "ward": "Ward-5"},
    {"name": "Arun Kapoor", "contact_number": "9876543254", "ward": "Ward-5"},
    # Ward-6 (7 citizens)
    {"name": "Deepak Yadav", "contact_number": "9876543218", "ward": "Ward-6"},
    {"name": "Pooja Chauhan", "contact_number": "9876543223", "ward": "Ward-6"},
    {"name": "Santosh Mehta", "contact_number": "9876543255", "ward": "Ward-6"},
    {"name": "Radha Krishna", "contact_number": "9876543256", "ward": "Ward-6"},
    {"name": "Vijay Pandey", "contact_number": "9876543257", "ward": "Ward-6"},
    {"name": "Lata Mangeshkar", "contact_number": "9876543258", "ward": "Ward-6"},
    {"name": "Hemant Khurana", "contact_number": "9876543259", "ward": "Ward-6"},
    # Ward-7 (7 citizens)
    {"name": "Kavita Mishra", "contact_number": "9876543219", "ward": "Ward-7"},
    {"name": "Amit Tiwari", "contact_number": "9876543224", "ward": "Ward-7"},
    {"name": "Sudha Sharma", "contact_number": "9876543260", "ward": "Ward-7"},
    {"name": "Girish Karnad", "contact_number": "9876543261", "ward": "Ward-7"},
    {"name": "Asha Bhonsle", "contact_number": "9876543262", "ward": "Ward-7"},
    {"name": "Mukesh Ambani", "contact_number": "9876543263", "ward": "Ward-7"},
    {"name": "Preeti Zinta", "contact_number": "9876543264", "ward": "Ward-7"},
    # Ward-8 (7 citizens)
    {"name": "Sanjay Joshi", "contact_number": "9876543222", "ward": "Ward-8"},
    {"name": "Ravi Pandey", "contact_number": "9876543226", "ward": "Ward-8"},
    {"name": "Nandini Verma", "contact_number": "9876543265", "ward": "Ward-8"},
    {"name": "Sudhir Choudhary", "contact_number": "9876543266", "ward": "Ward-8"},
    {"name": "Madhuri Dixit", "contact_number": "9876543267", "ward": "Ward-8"},
    {"name": "Tarun Gogoi", "contact_number": "9876543268", "ward": "Ward-8"},
    {"name": "Bhavna Solanki", "contact_number": "9876543269", "ward": "Ward-8"},
]

ISSUE_TEMPLATES = [
    # Water Supply (20)
    ("Broken water pipeline causing flooding on main road", "Water Supply", "High"),
    ("Drainage overflow during recent rainfall in colony area", "Water Supply", "High"),
    ("Water contamination reported in bore well supply", "Water Supply", "High"),
    ("Fire hydrant not functional near commercial zone", "Water Supply", "High"),
    ("Request for additional water tanker supply in summer", "Water Supply", "Low"),
    ("Low water pressure in residential apartments since 2 weeks", "Water Supply", "Medium"),
    ("Sewage mixing with drinking water in pipeline junction", "Water Supply", "High"),
    ("Water meter malfunction showing inflated readings", "Water Supply", "Medium"),
    ("Underground water tank leaking in community park", "Water Supply", "Medium"),
    ("Bore well dried up, need alternative water source", "Water Supply", "High"),
    ("Water tanker not arriving on schedule for 3 days", "Water Supply", "Medium"),
    ("Rusty water supply from old iron pipes", "Water Supply", "Medium"),
    ("Request for new water connection for newly built house", "Water Supply", "Low"),
    ("Overhead tank overflowing daily wasting water", "Water Supply", "Low"),
    ("Flooding in basement due to water main burst", "Water Supply", "High"),
    ("Water supply timing irregular, no fixed schedule", "Water Supply", "Medium"),
    ("Illegal water tapping diverting supply from main line", "Water Supply", "High"),
    ("Handpump broken in slum area, no alternative source", "Water Supply", "High"),
    ("Water purification plant not functioning properly", "Water Supply", "High"),
    ("Stagnant water collecting near water tank breeding mosquitoes", "Water Supply", "Medium"),
    # Roads & Infrastructure (20)
    ("Pothole on highway near school zone creating hazard", "Roads & Infrastructure", "High"),
    ("Road resurfacing needed after monsoon damage", "Roads & Infrastructure", "Medium"),
    ("New housing colony lacks proper road connectivity", "Roads & Infrastructure", "Medium"),
    ("Tree fell blocking road during storm", "Roads & Infrastructure", "High"),
    ("Bridge inspection needed after flood damage report", "Roads & Infrastructure", "High"),
    ("Speed breaker needed near hospital entrance", "Roads & Infrastructure", "Medium"),
    ("Road divider broken after truck accident last week", "Roads & Infrastructure", "Medium"),
    ("Footpath encroachment making pedestrians walk on road", "Roads & Infrastructure", "Medium"),
    ("Road caving in due to underground pipe leak", "Roads & Infrastructure", "High"),
    ("Missing manhole cover on main road extremely dangerous", "Roads & Infrastructure", "High"),
    ("Street name boards faded and unreadable in old town", "Roads & Infrastructure", "Low"),
    ("Railway crossing gate malfunctioning causing traffic jams", "Roads & Infrastructure", "High"),
    ("Flyover construction causing extended road closures", "Roads & Infrastructure", "Medium"),
    ("Waterlogged road after every rain for 3 months", "Roads & Infrastructure", "High"),
    ("Unpaved road in newly developed residential area", "Roads & Infrastructure", "Medium"),
    ("Road marking completely faded at busy intersection", "Roads & Infrastructure", "Medium"),
    ("Narrow bridge causing bottleneck during peak hours", "Roads & Infrastructure", "Medium"),
    ("Construction debris dumped on public road for weeks", "Roads & Infrastructure", "Medium"),
    ("Retaining wall collapse risk on hillside road", "Roads & Infrastructure", "High"),
    ("Pedestrian crossing signal not working at market area", "Roads & Infrastructure", "High"),
    # Sanitation (18)
    ("Garbage not collected for 5 days in residential area", "Sanitation", "Medium"),
    ("Public toilet facility needs urgent repair", "Sanitation", "High"),
    ("Sewage line blockage causing hygiene concerns", "Sanitation", "High"),
    ("Open drain overflowing near school compound", "Sanitation", "High"),
    ("Dumping ground overflow causing foul smell in locality", "Sanitation", "High"),
    ("No dustbins available at bus stand area", "Sanitation", "Low"),
    ("Stray dogs scattering garbage from open collection point", "Sanitation", "Medium"),
    ("Bio-medical waste found mixed in municipal garbage", "Sanitation", "High"),
    ("Community toilet block locked and unusable", "Sanitation", "Medium"),
    ("Waste segregation not being followed by garbage collectors", "Sanitation", "Medium"),
    ("Drain cleaning not done before monsoon season", "Sanitation", "High"),
    ("Plastic waste burning in open area causing pollution", "Sanitation", "Medium"),
    ("Septic tank overflowing in residential colony", "Sanitation", "High"),
    ("Night sweeping not happening in market area", "Sanitation", "Low"),
    ("Construction waste blocking drainage channel", "Sanitation", "Medium"),
    ("Dead animal carcass not removed from roadside for days", "Sanitation", "Medium"),
    ("Public urination wall needs proper signage and cleaning", "Sanitation", "Low"),
    ("Composting facility at community garden not maintained", "Sanitation", "Low"),
    # Electricity (15)
    ("Streetlights not functioning in Ward since last week", "Electricity", "Medium"),
    ("Power outages lasting 6+ hours daily in summer", "Electricity", "High"),
    ("Solar streetlight installation request for new colony", "Electricity", "Medium"),
    ("Electric pole leaning dangerously after storm", "Electricity", "High"),
    ("Transformer explosion risk due to overloading", "Electricity", "High"),
    ("Low voltage issue affecting entire residential block", "Electricity", "Medium"),
    ("Street light timer malfunction, lights on during daytime", "Electricity", "Low"),
    ("Exposed electric wires hanging low near playground", "Electricity", "High"),
    ("Power theft by illegal connections in slum area", "Electricity", "High"),
    ("UPS backup needed for community water pump", "Electricity", "Medium"),
    ("Frequent power fluctuations damaging home appliances", "Electricity", "Medium"),
    ("New electricity connection pending for 4 months", "Electricity", "Medium"),
    ("Solar panel installation on community hall not working", "Electricity", "Low"),
    ("Substation humming noise disturbing nearby residents", "Electricity", "Low"),
    ("Emergency generator at hospital not functional", "Electricity", "High"),
    # Public Health (12)
    ("Stray animal menace near marketplace area", "Public Health", "Medium"),
    ("Mosquito fogging needed to prevent dengue outbreak", "Public Health", "High"),
    ("Noise pollution from construction site at night", "Public Health", "Low"),
    ("Food safety inspection needed at street food zone", "Public Health", "Medium"),
    ("Dengue cases rising, need vector control measures", "Public Health", "High"),
    ("Air quality deteriorating due to factory emissions", "Public Health", "High"),
    ("Stagnant water breeding grounds for malaria mosquitoes", "Public Health", "High"),
    ("Community health centre understaffed for 6 months", "Public Health", "Medium"),
    ("Expired medicines found at government dispensary", "Public Health", "High"),
    ("Dog bite incidents increasing in Ward, need vaccination drive", "Public Health", "High"),
    ("Contaminated meat sold at unlicensed butcher shop", "Public Health", "High"),
    ("Lack of ambulance service in peripheral areas", "Public Health", "Medium"),
    # Education (10)
    ("School building roof leaking in monsoon season", "Education", "Medium"),
    ("Playground equipment broken and unsafe for children", "Education", "Medium"),
    ("Mid-day meal quality complaints from multiple parents", "Education", "High"),
    ("Government school toilet facilities in deplorable condition", "Education", "High"),
    ("Teacher vacancy not filled for 8 months", "Education", "Medium"),
    ("Computer lab equipment outdated and non-functional", "Education", "Medium"),
    ("School boundary wall collapsed, security concern", "Education", "High"),
    ("Drinking water facility not working in primary school", "Education", "High"),
    ("Library books not updated since 5 years", "Education", "Low"),
    ("School bus route not covering new residential area", "Education", "Medium"),
    # Housing (8)
    ("Illegal construction blocking public walkway", "Housing", "Low"),
    ("Street vendor relocation request for market area", "Housing", "Low"),
    ("Unauthorized encroachment on government land", "Housing", "Medium"),
    ("Building permission pending for 6 months", "Housing", "Medium"),
    ("Dilapidated building risk assessment needed urgently", "Housing", "High"),
    ("Affordable housing scheme applications stuck in backlog", "Housing", "Medium"),
    ("Park land being used for unauthorized parking", "Housing", "Medium"),
    ("Heritage building restoration work stalled", "Housing", "Low"),
    # Revenue (7)
    ("Property tax assessment dispute for residential plot", "Revenue", "Low"),
    ("Birth certificate issuance delayed by 3 weeks", "Revenue", "Medium"),
    ("Land records digitization error affecting property", "Revenue", "High"),
    ("Shop license renewal process taking too long", "Revenue", "Medium"),
    ("Incorrect property valuation in municipal records", "Revenue", "Medium"),
    ("Market fee collection irregular and disputed", "Revenue", "Low"),
    ("Trade license not issued despite complete documentation", "Revenue", "Medium"),
    # Social Welfare (10)
    ("Pension disbursement delayed for 3 months", "Social Welfare", "High"),
    ("Widow pension application pending for 6 months", "Social Welfare", "High"),
    ("Community hall booking system not working properly", "Social Welfare", "Low"),
    ("Disability pension not received for current quarter", "Social Welfare", "High"),
    ("Scholarship application portal down for 2 weeks", "Social Welfare", "Medium"),
    ("Old age home maintenance and hygiene complaints", "Social Welfare", "Medium"),
    ("Anganwadi centre not providing nutritional supplements", "Social Welfare", "High"),
    ("Ration card address update not processed for months", "Social Welfare", "Medium"),
    ("Self-help group loan application rejected without reason", "Social Welfare", "Medium"),
    ("Night shelter facility overcrowded, needs expansion", "Social Welfare", "Medium"),
    # Transport (10)
    ("Traffic signal malfunction at major intersection", "Transport", "High"),
    ("Bus stop shelter damaged and needs replacement", "Transport", "Low"),
    ("Auto-rickshaw overcharging complaints from commuters", "Transport", "Low"),
    ("No public transport connectivity to industrial area", "Transport", "Medium"),
    ("Parking lot at market full, vehicles parked on road", "Transport", "Medium"),
    ("City bus frequency reduced causing overcrowding", "Transport", "Medium"),
    ("School zone speed limit signs missing or damaged", "Transport", "High"),
    ("Footover bridge at railway station in poor condition", "Transport", "High"),
    ("Cycle lane encroached by vendors and parked vehicles", "Transport", "Medium"),
    ("Traffic congestion due to no left-turn signal at junction", "Transport", "Medium"),
]

# ── Sample Governance Documents (for RAG) ────────────────────────────

SAMPLE_DOCUMENTS = {
    "Municipal Water Supply Policy 2024.txt": """Municipal Water Supply Policy — 2024 Revision

Section 1: Objectives
The primary objective of this policy is to ensure 24x7 potable water supply to all residents within the municipal jurisdiction. The policy targets:
1. Universal access to clean drinking water by 2025
2. Reducing non-revenue water losses to below 15%
3. Implementing smart water metering across all wards
4. Ensuring water quality compliance with BIS 10500:2012 standards

Section 2: Supply Standards
Each household shall receive a minimum of 135 litres per capita per day (LPCD) as per CPHEEO norms.
Commercial establishments: 45 LPCD per employee.
Industrial units: As per consent-to-operate conditions from State Pollution Control Board.

Section 3: Infrastructure Investment
A total budget of Rs. 180 crores has been allocated for the FY 2024-25 under the AMRUT 2.0 scheme for:
- Replacement of aging pipeline infrastructure (Rs. 65 crores)
- New overhead tank construction in Ward-3, Ward-5, Ward-7 (Rs. 45 crores)
- Smart metering pilot in Ward-1 and Ward-2 (Rs. 30 crores)
- Water treatment plant upgradation (Rs. 40 crores)

Section 4: Emergency Response
In case of pipeline burst or water contamination:
1. The affected ward councillor must be notified within 1 hour
2. Alternative water tanker supply must be arranged within 4 hours
3. Water quality testing must be conducted within 6 hours
4. Full restoration of supply within 24 hours for minor incidents, 72 hours for major incidents

Section 5: Citizen Grievance Mechanism
All water-related complaints must be resolved within:
- Urgent (contamination/flooding): 12 hours
- High priority (no supply): 24 hours
- Medium priority (low pressure): 48 hours
- Low priority (new connection): 15 working days

Section 6: Financial Provisions
Water charges revised effective April 2024:
- Domestic: Rs. 5 per kilolitre (first 20 KL), Rs. 12 per KL (20-40 KL), Rs. 25 per KL (above 40 KL)
- Commercial: Rs. 30 per KL flat rate
- Industrial: Rs. 45 per KL flat rate
- BPL households: Free up to 20 KL per month

Approved by: Municipal Commissioner, Order No. MC/WS/2024/001
Date of Effect: 1st April 2024
""",
    "Ward Development Plan FY2024-25.txt": """Ward-wise Development Plan — Financial Year 2024-25

Executive Summary:
This document outlines the comprehensive development plan for all 8 wards under the municipal corporation jurisdiction. Total planned expenditure: Rs. 320 crores across infrastructure, public health, education, and social welfare sectors.

Ward-1 (Population: 45,000):
Priority Projects:
- Smart water metering pilot project (Rs. 15 crores) — Status: In Progress
- Road resurfacing of 12 km stretch on MG Road (Rs. 8 crores) — Status: Tendered
- New community health centre construction (Rs. 5 crores) — Status: Planning
Key Issues: Water pressure complaints (High), Pothole hazards on main road (High)
Risk Level: Medium

Ward-2 (Population: 52,000):
Priority Projects:
- Sewage treatment plant expansion (Rs. 22 crores) — Status: Under Construction
- Primary school renovation for 3 schools (Rs. 4 crores) — Status: In Progress
- LED streetlight installation on all main roads (Rs. 3 crores) — Status: Completed
Key Issues: Sewage overflow near residential areas (Critical), School building conditions (High)
Risk Level: High

Ward-3 (Population: 38,000):
Priority Projects:
- New overhead water tank (Rs. 12 crores) — Status: Approved
- Waste segregation processing unit (Rs. 7 crores) — Status: Planning
- Park and recreation area development (Rs. 3 crores) — Status: Tendered
Key Issues: Waste management concerns (Medium), Water supply intermittent (Medium)
Risk Level: Medium

Ward-4 (Population: 41,000):
Priority Projects:
- Bridge repair and strengthening (Rs. 18 crores) — Status: In Progress
- Pension disbursement digitization (Rs. 2 crores) — Status: Testing
- Market area pedestrianization (Rs. 6 crores) — Status: Public Consultation
Key Issues: Bridge structural concerns (Critical), Pension delays (High)
Risk Level: High

Ward-5 (Population: 35,000):
Priority Projects:
- New overhead water tank (Rs. 14 crores) — Status: Approved
- Traffic signal modernization (Rs. 4 crores) — Status: Procurement
- Affordable housing 200 units (Rs. 40 crores) — Status: Land Acquired
Key Issues: Water scarcity in summer (High), Traffic management (Medium)
Risk Level: Medium

Ward-6 (Population: 48,000):
Priority Projects:
- Industrial area access road (Rs. 15 crores) — Status: Under Construction
- Community toilet complex renovation (Rs. 3 crores) — Status: Completed
- Solar power installation on public buildings (Rs. 5 crores) — Status: In Progress
Key Issues: Road connectivity to industrial belt (High), Power supply issues (Medium)
Risk Level: Medium

Ward-7 (Population: 42,000):
Priority Projects:
- Dengue prevention vector control program (Rs. 2 crores) — Status: Active
- School computer lab modernization (Rs. 3 crores) — Status: Procurement
- Drainage system overhaul (Rs. 10 crores) — Status: DPR Prepared
Key Issues: Health concerns, dengue cases rising (Critical), Education infrastructure (Medium)
Risk Level: High

Ward-8 (Population: 36,000):
Priority Projects:
- Heritage building restoration (Rs. 8 crores) — Status: Planning
- Bus route extension (Rs. 5 crores) — Status: Survey Complete
- Night shelter expansion (Rs. 2 crores) — Status: Under Construction
Key Issues: Public transport gaps (Medium), Housing for vulnerable populations (Medium)
Risk Level: Low

Budget Summary:
Total Approved: Rs. 320 crores
Central Grants (AMRUT, Smart City): Rs. 180 crores | State Share: Rs. 80 crores | Municipal Revenue: Rs. 60 crores
Monitoring: Monthly progress review by Municipal Commissioner
""",
    "Citizen Grievance Redressal Guidelines.txt": """Citizen Grievance Redressal Guidelines — Municipal Corporation

Chapter 1: Introduction
These guidelines establish a standardized framework for receiving, processing, and resolving citizen grievances across all departments. Aligned with the Right to Public Services Act and CPGRAMS.

Chapter 2: Grievance Categories & Response Times
Category A — Emergency (Response: 4 hours, Resolution: 24 hours): Water contamination, gas leaks, building collapse risk, fire hazard, road cave-in, exposed electrical wires.
Category B — Urgent (Response: 12 hours, Resolution: 48 hours): Complete water supply failure, major road blockage, sewage overflow, missing manhole covers, broken traffic signals.
Category C — Priority (Response: 24 hours, Resolution: 7 days): Partial water supply issues, garbage collection failure (>3 days), streetlight outage, public toilet malfunction.
Category D — Standard (Response: 48 hours, Resolution: 15 days): New connection requests, property tax queries, license renewals, certificate issuance.
Category E — Long-term (Response: 72 hours, Resolution: 30 days): Policy suggestions, infrastructure development requests, budget allocation queries.

Chapter 3: Escalation Matrix
Level 1: Ward Officer (0-2 days) → Level 2: Zonal Officer (2-5 days) → Level 3: Department Head (5-10 days) → Level 4: Additional Commissioner (10-15 days) → Level 5: Municipal Commissioner (>15 days)

Chapter 4: Performance Metrics
1. Average Resolution Time (target: <70% of stipulated time)
2. First Contact Resolution Rate (target: >40%)
3. Citizen Satisfaction Score (target: >3.5/5.0)
4. Escalation Rate (target: <15%)
5. Reopening Rate (target: <5%)

Chapter 5: Digital Integration
All grievances must be logged in the NAYAM platform. Manual/verbal complaints digitized within 2 hours. Platform provides automatic acknowledgment SMS, real-time status tracking, automated escalation, dashboard analytics, and AI-powered predictive issue identification.

Effective Date: 1st January 2024 | Approved by: Municipal Commissioner | Order No: MC/GRG/2024/004
""",
    "Annual Budget Summary FY2024-25.txt": """Municipal Corporation Annual Budget Summary — FY 2024-25

Revenue Receipts (Total: Rs. 450 crores):
1. Tax Revenue (Rs. 220 crores): Property Tax Rs. 120 crores, Water Tax Rs. 35 crores, Advertisement Tax Rs. 15 crores, Market Fees Rs. 25 crores, Other Rs. 25 crores.
2. Non-Tax Revenue (Rs. 80 crores): User Charges Rs. 30 crores, Rental Income Rs. 20 crores, License/Permit Fees Rs. 15 crores, Other Rs. 15 crores.
3. Government Grants (Rs. 150 crores): Central Grants (AMRUT, Smart City, SBM) Rs. 90 crores, State Finance Commission Rs. 40 crores, Special Purpose Rs. 20 crores.

Expenditure Allocation (Total: Rs. 430 crores):
1. Water Supply & Sewerage: Rs. 95 crores (22%)
2. Roads & Infrastructure: Rs. 80 crores (19%)
3. Sanitation & Waste: Rs. 55 crores (13%)
4. Public Health: Rs. 40 crores (9%)
5. Education: Rs. 35 crores (8%)
6. Social Welfare: Rs. 30 crores (7%)
7. Transport: Rs. 25 crores (6%)
8. Administration & IT: Rs. 40 crores (9%) — includes NAYAM platform Rs. 10 crores
9. Revenue Department: Rs. 15 crores (3%)
10. Housing: Rs. 15 crores (3%)

Capital vs Revenue: Capital Rs. 250 crores (58%), Revenue Rs. 180 crores (42%)
Revenue surplus: Rs. 20 crores | Debt service ratio: 8% | Property tax efficiency: 78%
Approved by Municipal Council Resolution No. 2024/BUD/001
""",
    "Public Health Emergency Protocol.txt": """Public Health Emergency Response Protocol — Municipal Corporation
Document Classification: CRITICAL | Version: 3.0 (Updated January 2024)

Section 1: Scope
Covers epidemic/pandemic outbreaks, water contamination events, air quality emergencies (AQI > 400), food safety incidents, industrial chemical spills, and natural disaster health response.

Section 2: Alert Levels
GREEN (Normal): Routine surveillance, regular fogging, standard services.
YELLOW (Watch): 10% increase above seasonal baseline. Enhanced surveillance, increased fogging, public awareness.
ORANGE (Warning): 25% increase or cluster in single ward. Ward-level emergency teams, daily situation reports.
RED (Emergency): 50% increase or multi-ward outbreak. Full EOC activation, all-department coordination, state assistance.

Section 3: Dengue Protocol (Ward-7 at ORANGE)
Immediate: Door-to-door larval survey | Fogging: Daily (Red), alternate days (Orange), weekly (Yellow) | Hospital: 50 dengue-ready beds | Blood bank: 200 platelet units | Free NS1 and IgM testing.

Section 4: Water Contamination Timeline
Hour 0: Lab confirms → Alert Commissioner | Hour 1: Shut supply, notify ward | Hour 2: Deploy tanker | Hour 4: Door-to-door advisory | Hour 12: Identify source | Hour 24: Begin remediation | Hour 48: Clearance testing | Hour 72: Restore supply.

Section 5: Budget
Emergency health fund: Rs. 5 crores (revolving) | Per-event authority: Rs. 50 lakhs (Ward Officer), Rs. 2 crores (Health Officer).

Review Frequency: Monthly (normal), Weekly (elevated), Daily (emergency)
""",
}

# ── Action Request Templates ─────────────────────────────────────────

ACTION_REQUESTS = [
    # Pending (8)
    {"agent_name": "PolicyAgent", "action_type": "escalate_priority", "desc_tpl": "ISS-{iid}: Escalate priority of water contamination issue in Ward-1 to Critical — multiple citizen complaints received. {extra}", "status": "PENDING", "hours_ago": 2},
    {"agent_name": "CitizenAgent", "action_type": "assign_department", "desc_tpl": "ISS-{iid}: Reassign road pothole issue from Roads & Infrastructure to Emergency Services — structural risk detected. {extra}", "status": "PENDING", "hours_ago": 4},
    {"agent_name": "OperationsAgent", "action_type": "allocate_resources", "desc_tpl": "ISS-{iid}: Allocate 3 additional water tankers to Ward-3 — supply deficit detected by AI analysis. Estimated cost: Rs. 15,000/day.", "status": "PENDING", "hours_ago": 5},
    {"agent_name": "PolicyAgent", "action_type": "issue_advisory", "desc_tpl": "ISS-{iid}: Issue public health advisory for Ward-7 — dengue case clustering detected. Recommend fogging operation within 24 hours.", "status": "PENDING", "hours_ago": 6},
    {"agent_name": "OperationsAgent", "action_type": "schedule_maintenance", "desc_tpl": "ISS-{iid}: Schedule emergency road repair on Highway-12 near school zone — AI risk assessment: 87% accident probability if unaddressed.", "status": "PENDING", "hours_ago": 8},
    {"agent_name": "CitizenAgent", "action_type": "send_notification", "desc_tpl": "ISS-{iid}: Send SMS alert to 340 affected residents in Ward-5 about scheduled water supply interruption (maintenance). Duration: 8 hours.", "status": "PENDING", "hours_ago": 10},
    {"agent_name": "PolicyAgent", "action_type": "update_policy", "desc_tpl": "ISS-{iid}: Update sanitation collection schedule for Ward-2 — AI detected 3-day gap in waste pickup causing complaints spike.", "status": "PENDING", "hours_ago": 12},
    {"agent_name": "OperationsAgent", "action_type": "deploy_team", "desc_tpl": "ISS-{iid}: Deploy vector control team to Ward-6 — predictive model forecasts 40% increase in mosquito-borne illness within 2 weeks.", "status": "PENDING", "hours_ago": 14},
    # Approved (5)
    {"agent_name": "PolicyAgent", "action_type": "escalate_priority", "desc_tpl": "ISS-{iid}: Escalated streetlight outage in Ward-4 from Medium to High — safety concern near school. Approved by admin.", "status": "APPROVED", "hours_ago": 24},
    {"agent_name": "OperationsAgent", "action_type": "allocate_resources", "desc_tpl": "ISS-{iid}: Allocated emergency repair crew for burst water main in Ward-1. 4 workers deployed within 2 hours.", "status": "APPROVED", "hours_ago": 36},
    {"agent_name": "CitizenAgent", "action_type": "send_notification", "desc_tpl": "ISS-{iid}: Sent automated status update to 12 complainants about road repair progress in Ward-3. Estimated completion: 5 days.", "status": "APPROVED", "hours_ago": 48},
    {"agent_name": "PolicyAgent", "action_type": "close_issue", "desc_tpl": "ISS-{iid}: Auto-closed resolved garbage collection issue in Ward-8 — no complaints for 7 days. AI confidence: 94%.", "status": "APPROVED", "hours_ago": 72},
    {"agent_name": "OperationsAgent", "action_type": "schedule_maintenance", "desc_tpl": "ISS-{iid}: Scheduled transformer inspection in Ward-2 after AI detected voltage fluctuation pattern. Maintenance window: Sunday 6AM-12PM.", "status": "APPROVED", "hours_ago": 96},
    # Rejected (3)
    {"agent_name": "PolicyAgent", "action_type": "reallocate_budget", "desc_tpl": "ISS-{iid}: AI suggested reallocating Rs. 5 lakhs from Education budget to Emergency Road Repair. Rejected — education funds are ring-fenced.", "status": "REJECTED", "hours_ago": 50},
    {"agent_name": "CitizenAgent", "action_type": "auto_close_issue", "desc_tpl": "ISS-{iid}: AI suggested auto-closing pension delay complaint. Rejected — issue still active, citizen confirmed non-resolution.", "status": "REJECTED", "hours_ago": 60},
    {"agent_name": "OperationsAgent", "action_type": "reduce_frequency", "desc_tpl": "ISS-{iid}: AI suggested reducing fogging frequency in Ward-5 from daily to weekly. Rejected — dengue cases still rising.", "status": "REJECTED", "hours_ago": 80},
]


# ═══════════════════════════════════════════════════════════════════════
# DRAFT CONTENT (long strings kept at module level for readability)
# ═══════════════════════════════════════════════════════════════════════

SPEECH_CONTENT = """# Independence Day Address 2026

Respected dignitaries, fellow officers, and dear citizens of our district,

On this 80th Independence Day, as we hoist our Tricolour, I am reminded of the immense responsibility we carry -- to serve the people of this district with integrity, efficiency, and compassion.

## Our Achievements This Year

Over the past twelve months, our administration has:

1. **Resolved 847 citizen grievances** through the NAYAM governance platform -- a 40% improvement over last year.
2. **Completed 12 infrastructure projects** including the Gandhi Nagar bridge, Ward 3 drainage overhaul, and the new community health center.
3. **Digitized 95% of land records**, making them accessible to citizens online within minutes.

## Challenges Ahead

We must honestly acknowledge the work that remains. Water supply irregularities in Wards 4 and 6, the pending market construction in Ward 7, and the need for better sanitation coverage demand our urgent attention.

## Our Commitment

I pledge that this administration will:
- Launch the Ward Mission 2027 program for comprehensive development
- Implement AI-assisted decision-making through NAYAM for faster response times
- Ensure 100% grievance resolution within 30 days

Let us move forward together. Jai Hind, Jai Bharat!

Thank you."""

RESPONSE_CONTENT = """# Official Response

**Reference:** WS/2026/0342
**Date:** 28 February 2026
**Subject:** Irregular Water Supply in Sector 12, Ward 4

Dear Residents of Sector 12,

This is in response to your collective representation dated 20 February 2026 regarding irregular water supply in Sector 12, Ward 4.

The Water Supply Department has investigated the matter and identified two root causes:

1. **Pipeline deterioration** on the Sector 12 main line (installed 2008, beyond service life)
2. **Pump station capacity** insufficient for the expanded population

## Actions Being Taken

- **Immediate:** Tanker supply arranged twice daily (6 AM and 5 PM) starting 1 March 2026
- **Short-term (2 weeks):** Repair of critical pipeline sections
- **Long-term (3 months):** Replacement of entire Sector 12 main line under Ward Development Fund

The estimated cost of Rs 4.2 Lakhs has been sanctioned from the emergency maintenance budget.

We regret the inconvenience and assure you of our commitment to resolving this permanently.

Yours faithfully,
**District Administration**"""

PRESS_CONTENT = """# FOR IMMEDIATE RELEASE

**District Administration Launches AI-Powered Governance Platform "NAYAM"**

*First-of-its-kind AI Co-Pilot for public administration in the state*

The District Administration today announced the launch of NAYAM, an AI-powered governance intelligence platform that will transform how public services are delivered.

NAYAM integrates speech-to-text processing, document summarization, predictive analytics, and multi-agent AI to assist leaders and administrators in making faster, data-driven decisions.

## Key Features
- Voice-to-text issue logging in Hindi and English
- AI-generated risk assessments per ward
- Automated speech and document drafting
- Real-time dashboards with anomaly detection
- Schedule management for administrative workflows

The platform has already processed over 130 citizen issues and 60 citizen profiles during its pilot phase.

**Media Contact:** PRO, District Administration
**Email:** pro@district.gov.in"""

POLICY_CONTENT = """# Policy Brief: Ward-Level Predictive Risk Scoring

## Executive Summary
This brief proposes the adoption of AI-driven predictive risk scoring across all wards to enable proactive resource allocation and early intervention.

## Background
Traditionally, government response to civic issues has been reactive. NAYAM analytics engine can now predict which wards are likely to experience escalation based on historical patterns, seasonal factors, and real-time data feeds.

## Key Findings
- Wards with >15 open issues have a 73% probability of citizen escalation within 2 weeks
- Water and sanitation issues account for 62% of high-priority complaints
- Seasonal peaks (monsoon, summer) are predictable with 85% accuracy

## Policy Options
1. **Status Quo** -- Continue reactive approach (not recommended)
2. **Pilot Program** -- Deploy predictive scoring in 3 high-risk wards for 6 months
3. **Full Rollout** -- Implement across all wards with monthly review cycles

## Recommendation
Option 2 (Pilot Program) is recommended with Ward 3, Ward 4, and Ward 7 as pilot locations based on current risk metrics from NAYAM dashboard."""

MEETING_AGENDA_CONTENT = """# Ward Development Committee Meeting Agenda

**Date:** 5 March 2026, 10:00 AM
**Venue:** Municipal Hall, Room 201
**Chaired by:** District Magistrate

---

## 1. Call to Order & Attendance (10:00 - 10:10)
## 2. Approval of Previous Minutes (10:10 - 10:20)
## 3. Road Repair Budget Review (10:20 - 10:50)
- Current allocation: Rs 12.5 Lakhs | Expenditure: Rs 8.3 Lakhs (66.4%)
- Pending works: Ward 2 internal roads, Ward 5 NH-44 access road
- **Decision needed:** Supplementary allocation request of Rs 4 Lakhs

## 4. Drainage Status Update (10:50 - 11:20)
- Ward 3 main drain desilting: 85% complete
- Ward 4 Sector 12 waterlogging: New pipeline approved

## 5. Citizen Grievance Review (11:20 - 11:50)
- Total pending: 23 (down from 41) | High-priority: 5

## 6. New Business (11:50 - 12:00)
## 7. Adjournment

*Secretary: SDO Verma | Minutes to be circulated within 48 hours*"""

PUBLIC_NOTICE_CONTENT = """# PUBLIC NOTICE

## Regarding: Road Closure for Resurfacing Work — Main Market Road, Ward 3

**Notice No.:** PWD/2026/RC-045 | **Date:** 3 March 2026

Main Market Road in Ward 3 will remain closed for vehicular traffic from 4 March 2026 to 7 March 2026 due to road resurfacing work.

### Alternative Routes:
1. Light vehicles: Use Nehru Marg via Sector 4 crossing
2. Heavy vehicles: Divert via Ring Road (NH-44 bypass)
3. Emergency vehicles: Escort through work zone

### Timings: 7:00 AM to 6:00 PM daily | Road open for pedestrians with safety barriers

**By Order, Executive Engineer, Public Works Department**"""

FORMAL_LETTER_CONTENT = """# OFFICE OF THE DISTRICT MAGISTRATE

**Ref No.:** DM/2026/WS-087 | **Date:** 3 March 2026

To: The Chief Engineer, State Water Supply & Sewerage Board

**Subject: Urgent Request for Emergency Pipeline Replacement — Sector 12, Ward 4**

The main water supply pipeline serving Sector 12 (installed 2008) has deteriorated beyond repair. Over 3 months: 14 major leakages, supply reduced to 2 hours/day, 342 complaints, emergency tanker at Rs 15,000/day.

**Request:** Sanction emergency replacement (Rs 42 Lakhs est.), deploy technical team within 7 working days.

Yours faithfully, **District Magistrate**"""

RTI_RESPONSE_CONTENT = """# RIGHT TO INFORMATION ACT, 2005 — Response

**RTI Ref:** RTI/2026/0117 | **Application:** 15 Feb 2026 | **Response:** 3 Mar 2026

**Subject:** Road construction contracts in Ward 5

**Q1:** Total contracts awarded in Ward 5 FY 2025-26? **A1:** 7 contracts.
**Q2:** Contractors and values? **A2:** ABC Constructions Rs 8.5L, XYZ Infra Rs 12.3L, PQR Builders Rs 6.75L, LMN Associates Rs 3.2L, DEF Contractors Rs 4.5L, GHI Works Rs 9.8L, JKL Infrastructure Rs 5.6L.
**Q3:** Completion status? **A3:** 4 completed, 2 in progress, 1 not started.
**Q4:** Quality inspection reports? **A4:** Copies enclosed (47 pages).

Appeal: First Appellate Authority (Additional DM) within 30 days.

**Public Information Officer, District Administration**"""

GOVT_CIRCULAR_CONTENT = """# GOVERNMENT CIRCULAR

**Circular No.:** DM/GC/2026/012 | **Date:** 3 March 2026

**Subject: Implementation of NAYAM AI Governance Platform — Mandatory Adoption Directive**

## 1. Platform Adoption (Effective Immediately)
- 100% officer registration (Grade B+) by 15 March 2026
- Log all citizen grievances on NAYAM within 24 hours
- Upload all relevant documents to NAYAM repository

## 2. Weekly Compliance Reporting (Every Monday by 11 AM)

## 3. Training Schedule
| Batch 1 (Revenue, PWD, Water) | 8 Mar | 10 AM-1 PM | Collectorate Hall |
| Batch 2 (Education, Health, Police) | 9 Mar | 10 AM-1 PM | Collectorate Hall |
| Batch 3 (Panchayati Raj, Food, Electricity) | 10 Mar | 10 AM-1 PM | Collectorate Hall |

## 4. Each department shall designate one NAYAM Nodal Officer.

**By Order of the District Magistrate**"""


# ═══════════════════════════════════════════════════════════════════════
# SEED FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════

def step1_api_seed(base_url: str):
    """Seed citizens, issues, and documents via the REST API (requires running backend)."""
    print("[1/5] Authenticating...")
    try:
        resp = requests.post(f"{base_url}/auth/login", json={
            "email": "admin@nayam.gov.in", "password": "admin12345",
        })
        if resp.status_code != 200:
            print("  Creating admin user...")
            resp = requests.post(f"{base_url}/auth/register", json={
                "name": "Admin User",
                "email": "admin@nayam.gov.in",
                "password": "admin12345",
                "role": "Leader",
            })
            if resp.status_code not in (200, 201):
                print(f"  ✗ Registration failed: {resp.status_code} — {resp.text}")
                sys.exit(1)
        token = resp.json()["access_token"]
        print(f"  ✓ Authenticated")
    except requests.ConnectionError:
        print("  ✗ Cannot connect to backend at", base_url)
        print("    Start it first: uvicorn app.main:app --reload --port 8000")
        sys.exit(1)

    headers = {"Authorization": f"Bearer {token}"}

    # Citizens
    print(f"\n[2/5] Creating {len(CITIZENS)} citizens...")
    citizen_ids = []
    created = skipped = 0
    for c in CITIZENS:
        resp = requests.post(f"{base_url}/citizens/", json=c, headers=headers)
        if resp.status_code == 201:
            citizen_ids.append(resp.json()["id"])
            created += 1
        elif resp.status_code == 400 and "already" in resp.text.lower():
            skipped += 1
        else:
            print(f"  ✗ {c['name']} — {resp.status_code}")

    # Also fetch existing
    resp = requests.get(f"{base_url}/citizens/", params={"limit": 500}, headers=headers)
    if resp.status_code == 200:
        for c in resp.json().get("citizens", []):
            if c["id"] not in citizen_ids:
                citizen_ids.append(c["id"])
    print(f"  ✓ Created: {created}, Skipped: {skipped}, Total: {len(citizen_ids)}")

    if not citizen_ids:
        print("  ✗ No citizens available. Aborting.")
        sys.exit(1)

    # Issues
    print(f"\n[3/5] Creating {len(ISSUE_TEMPLATES)} issues...")
    issue_created = issue_failed = 0
    status_choices = ["Open", "Open", "Open", "In Progress", "In Progress", "Closed"]
    for desc, dept, priority in ISSUE_TEMPLATES:
        payload = {
            "citizen_id": random.choice(citizen_ids),
            "department": dept,
            "description": desc,
            "priority": priority,
        }
        resp = requests.post(f"{base_url}/issues/", json=payload, headers=headers)
        if resp.status_code == 201:
            issue_created += 1
            chosen = random.choice(status_choices)
            if chosen != "Open":
                requests.put(f"{base_url}/issues/{resp.json()['id']}", json={"status": chosen}, headers=headers)
        else:
            issue_failed += 1
    print(f"  ✓ Created: {issue_created}, Failed: {issue_failed}")

    # Documents
    print(f"\n[4/5] Uploading {len(SAMPLE_DOCUMENTS)} governance documents...")
    temp_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_seed_temp")
    os.makedirs(temp_dir, exist_ok=True)
    doc_created = 0
    for filename, content in SAMPLE_DOCUMENTS.items():
        temp_path = os.path.join(temp_dir, filename)
        with open(temp_path, "w", encoding="utf-8") as f:
            f.write(content)
        with open(temp_path, "rb") as f:
            resp = requests.post(
                f"{base_url}/documents/upload",
                data={"title": filename.replace(".txt", "")},
                files={"file": (filename, f, "text/plain")},
                headers=headers,
            )
            if resp.status_code == 201:
                doc_created += 1
                print(f"  ✓ {filename}")
            else:
                print(f"  ✗ {filename} — {resp.status_code}")
    shutil.rmtree(temp_dir, ignore_errors=True)

    # Summary
    resp_c = requests.get(f"{base_url}/citizens/", params={"limit": 1}, headers=headers)
    resp_i = requests.get(f"{base_url}/issues/", params={"limit": 1}, headers=headers)
    resp_d = requests.get(f"{base_url}/documents/", params={"limit": 1}, headers=headers)
    total_c = resp_c.json().get("total", "?") if resp_c.status_code == 200 else "?"
    total_i = resp_i.json().get("total", "?") if resp_i.status_code == 200 else "?"
    total_d = resp_d.json().get("total", "?") if resp_d.status_code == 200 else "?"
    print(f"\n  ✓ API seed complete: {total_c} citizens, {total_i} issues, {total_d} documents")


def step2_spread_dates():
    """Spread issue created_at dates across the past 30 days for realistic charts."""
    print("\n[5/5] Post-processing...")
    print("  Spreading issue dates across past 30 days...")
    db = Session()
    try:
        rows = db.execute(text("SELECT id FROM issues")).fetchall()
        if not rows:
            print("  ⚠ No issues found.")
            return
        now = datetime.now(timezone.utc)
        total = len(rows)
        for idx, (issue_id,) in enumerate(rows):
            days_ago = int((1 - idx / total) * 30)
            new_date = now - timedelta(days=days_ago, hours=random.randint(0, 23), minutes=random.randint(0, 59))
            db.execute(text("UPDATE issues SET created_at = :dt WHERE id = :id"), {"dt": new_date.isoformat(), "id": str(issue_id)})
        db.commit()
        print(f"  ✓ Spread {total} issues across 30 days")
    finally:
        db.close()


def step3_action_requests():
    """Insert action requests for the Approvals page."""
    print("  Seeding action requests...")
    db = Session()
    try:
        user_row = db.execute(text("SELECT id FROM users LIMIT 1")).fetchone()
        if not user_row:
            print("  ⚠ No users found.")
            return
        user_id = str(user_row[0])

        issue_rows = db.execute(text("SELECT id, description FROM issues LIMIT 20")).fetchall()
        issue_ids = [(str(r[0]), r[1] or "") for r in issue_rows]

        try:
            db.execute(text("SELECT COUNT(*) FROM action_requests")).fetchone()
        except Exception:
            print("  ⚠ action_requests table missing. Restart backend first.")
            return

        db.execute(text("DELETE FROM action_requests"))
        now = datetime.now(timezone.utc)
        created = 0

        for i, req in enumerate(ACTION_REQUESTS):
            iid = issue_ids[i % len(issue_ids)][0][:8]
            extra = issue_ids[i % len(issue_ids)][1][:60]
            desc = req["desc_tpl"].format(iid=iid, extra=extra)
            created_at = now - timedelta(hours=req["hours_ago"])
            reviewed_at = reviewed_by = review_note = None

            if req["status"] == "APPROVED":
                reviewed_at = (created_at + timedelta(hours=random.randint(1, 4))).isoformat()
                reviewed_by = user_id
                review_note = "Approved via dashboard review"
            elif req["status"] == "REJECTED":
                reviewed_at = (created_at + timedelta(hours=random.randint(1, 6))).isoformat()
                reviewed_by = user_id
                review_note = "Rejected — requires further review"

            db.execute(text("""
                INSERT INTO action_requests (id, session_id, agent_name, action_type, description, payload, status, requested_by, reviewed_by, review_note, created_at, reviewed_at)
                VALUES (:id, :session_id, :agent_name, :action_type, :description, :payload, :status, :requested_by, :reviewed_by, :review_note, :created_at, :reviewed_at)
            """), {
                "id": uuid.uuid4().hex, "session_id": uuid.uuid4().hex,
                "agent_name": req["agent_name"], "action_type": req["action_type"],
                "description": desc, "payload": "{}",
                "status": req["status"], "requested_by": user_id,
                "reviewed_by": reviewed_by, "review_note": review_note,
                "created_at": created_at.isoformat(), "reviewed_at": reviewed_at,
            })
            created += 1

        db.commit()
        pending = sum(1 for r in ACTION_REQUESTS if r["status"] == "PENDING")
        approved = sum(1 for r in ACTION_REQUESTS if r["status"] == "APPROVED")
        rejected = sum(1 for r in ACTION_REQUESTS if r["status"] == "REJECTED")
        print(f"  ✓ {created} action requests (Pending: {pending}, Approved: {approved}, Rejected: {rejected})")
    finally:
        db.close()


def step4_events_and_drafts():
    """Seed events and drafts via ORM (requires app models)."""
    print("  Seeding events and drafts...")
    from app.core.database import SessionLocal
    from app.models.event import Event, EventType, EventStatus, EventPriority
    from app.models.draft import Draft, DraftType, DraftStatus
    from app.models.user import User

    db = SessionLocal()
    admin = db.query(User).first()
    uid = admin.id if admin else None
    now = datetime.now(timezone.utc)

    # ── Events (22 total) ────────────────────────────────────────
    events_data = [
        # From seed_schedule_drafts.py (10)
        dict(title="Ward Development Committee Meeting", description="Monthly review of ongoing projects in Wards 1-5. Road repair budget, drainage status, citizen grievances.", event_type=EventType.MEETING, status=EventStatus.SCHEDULED, priority=EventPriority.HIGH, start_time=now+timedelta(days=1,hours=2), end_time=now+timedelta(days=1,hours=4), location="Municipal Hall, Room 201", attendees="DM Singh, SDO Verma, Ward Members 1-5", department="Public Works", ward="Ward 3", created_by=uid),
        dict(title="Water Supply Review", description="Review water distribution schedule and address citizen complaints.", event_type=EventType.REVIEW, status=EventStatus.SCHEDULED, priority=EventPriority.HIGH, start_time=now+timedelta(days=2,hours=3), end_time=now+timedelta(days=2,hours=5), location="Water Department Office", attendees="JE Water Supply, Ward Engineers", department="Water Supply Department", ward="Ward 4", created_by=uid),
        dict(title="Public Hearing - New Market Construction", description="Public hearing for proposed commercial market in Ward 7.", event_type=EventType.HEARING, status=EventStatus.SCHEDULED, priority=EventPriority.MEDIUM, start_time=now+timedelta(days=3,hours=1), end_time=now+timedelta(days=3,hours=3), location="Community Center, Ward 7", attendees="Public, Ward Councillor, Revenue Officer", department="Revenue Department", ward="Ward 7", created_by=uid),
        dict(title="Bridge Construction Site Visit", description="Inspection of under-construction bridge near Gandhi Nagar.", event_type=EventType.SITE_VISIT, status=EventStatus.SCHEDULED, priority=EventPriority.MEDIUM, start_time=now+timedelta(days=4), end_time=now+timedelta(days=4,hours=2), location="Gandhi Nagar Bridge Site", attendees="Executive Engineer, Contractor Rep", department="Public Works", ward="Ward 2", created_by=uid),
        dict(title="Budget Submission Deadline", description="Final date for departmental budget proposals FY 2026-27.", event_type=EventType.DEADLINE, status=EventStatus.SCHEDULED, priority=EventPriority.HIGH, start_time=now+timedelta(days=5), end_time=now+timedelta(days=5,hours=1), location="Online Portal", attendees="All Department Heads", department="Finance Department", is_all_day=True, created_by=uid),
        dict(title="Independence Day Celebration Planning", description="Plan cultural programs, security, VIP seating for 15 August.", event_type=EventType.PUBLIC_EVENT, status=EventStatus.SCHEDULED, priority=EventPriority.MEDIUM, start_time=now+timedelta(days=7,hours=2), end_time=now+timedelta(days=7,hours=4), location="District Stadium", attendees="Cultural Officer, Police SP, Protocol Officer", department="General Administration", created_by=uid),
        dict(title="Sanitation Drive - Ward 1", description="Mega cleanliness campaign. Deploy 3 teams.", event_type=EventType.PUBLIC_EVENT, status=EventStatus.SCHEDULED, priority=EventPriority.LOW, start_time=now+timedelta(days=6,hours=1), end_time=now+timedelta(days=6,hours=6), location="Ward 1 - All sectors", attendees="Sanitation Inspector, 30 field workers", department="Sanitation Department", ward="Ward 1", created_by=uid),
        dict(title="Staff Performance Review", description="Quarterly KPI review for administrative staff.", event_type=EventType.REVIEW, status=EventStatus.SCHEDULED, priority=EventPriority.LOW, start_time=now+timedelta(days=8,hours=3), end_time=now+timedelta(days=8,hours=5), location="Conference Room B", attendees="HR Head, Section Officers", department="General Administration", created_by=uid),
        dict(title="Road Repair Inspection (completed)", description="Final inspection of NH-44 pothole repair completed.", event_type=EventType.SITE_VISIT, status=EventStatus.COMPLETED, priority=EventPriority.HIGH, start_time=now-timedelta(days=2,hours=3), end_time=now-timedelta(days=2,hours=1), location="NH-44 Km 23-25", attendees="PWD Engineer, Contractor", department="Public Works", ward="Ward 5", created_by=uid),
        dict(title="Monsoon Preparedness Meeting (completed)", description="Pre-monsoon planning. All departments briefed.", event_type=EventType.MEETING, status=EventStatus.COMPLETED, priority=EventPriority.HIGH, start_time=now-timedelta(days=5,hours=4), end_time=now-timedelta(days=5,hours=2), location="Collectorate Conference Hall", attendees="All Department Heads", department="Disaster Management", created_by=uid),
        # From seed_more_data.py (12)
        dict(title="RTI Response Deadline - Case 2026/117", description="Final date to respond to RTI on road construction contracts in Ward 5.", event_type=EventType.DEADLINE, status=EventStatus.SCHEDULED, priority=EventPriority.HIGH, start_time=now+timedelta(days=2,hours=5), end_time=now+timedelta(days=2,hours=6), location="RTI Cell, Collectorate", attendees="PIO, APIO, Legal Advisor", department="General Administration", ward="Ward 5", created_by=uid),
        dict(title="Gram Sabha - Ward 6", description="Quarterly Gram Sabha: MGNREGA review, BPL list, road repair priorities.", event_type=EventType.MEETING, status=EventStatus.SCHEDULED, priority=EventPriority.MEDIUM, start_time=now+timedelta(days=3,hours=2), end_time=now+timedelta(days=3,hours=5), location="Panchayat Bhawan, Ward 6", attendees="Sarpanch, Gram Sachiv, Ward Members, Citizens", department="Panchayati Raj", ward="Ward 6", created_by=uid),
        dict(title="Electricity Department Coordination", description="Coordinate transformer replacement for Wards 2 and 3.", event_type=EventType.MEETING, status=EventStatus.SCHEDULED, priority=EventPriority.HIGH, start_time=now+timedelta(days=1,hours=5), end_time=now+timedelta(days=1,hours=7), location="SDM Office", attendees="SDM, XEN Electricity, JE Ward 2, JE Ward 3", department="Electricity Department", ward="Ward 2", created_by=uid),
        dict(title="School Building Safety Inspection", description="Annual structural safety audit of government schools in Wards 1-3.", event_type=EventType.SITE_VISIT, status=EventStatus.SCHEDULED, priority=EventPriority.HIGH, start_time=now+timedelta(days=5,hours=1), end_time=now+timedelta(days=5,hours=6), location="Govt. Primary School, Ward 1", attendees="BEO, PWD Engineer, School Principals", department="Education Department", ward="Ward 1", created_by=uid),
        dict(title="Weekly Law & Order Review", description="Weekly review with police on law and order, pending cases, festival security.", event_type=EventType.REVIEW, status=EventStatus.SCHEDULED, priority=EventPriority.MEDIUM, start_time=now+timedelta(days=1), end_time=now+timedelta(days=1,hours=1), location="SP Office", attendees="DM, SP, DSP, SHOs", department="Police", created_by=uid),
        dict(title="Ration Distribution Drive - Ward 4", description="Special ration for 200 flood-affected families in Sector 8.", event_type=EventType.PUBLIC_EVENT, status=EventStatus.SCHEDULED, priority=EventPriority.HIGH, start_time=now+timedelta(days=2,hours=1), end_time=now+timedelta(days=2,hours=8), location="Community Hall, Sector 8, Ward 4", attendees="Supply Inspector, 10 Volunteers, Ward Councillor", department="Food & Civil Supplies", ward="Ward 4", created_by=uid),
        dict(title="Vaccination Camp Planning", description="Plan pulse polio and routine immunization camp across all wards.", event_type=EventType.MEETING, status=EventStatus.SCHEDULED, priority=EventPriority.MEDIUM, start_time=now+timedelta(days=9,hours=3), end_time=now+timedelta(days=9,hours=5), location="CMO Office", attendees="CMO, PHC Doctors, ASHA Workers Coordinator", department="Health Department", created_by=uid),
        dict(title="Revenue Court Hearing - Land Dispute", description="Hearing for land dispute case No. 45/2025 in Ward 7.", event_type=EventType.HEARING, status=EventStatus.SCHEDULED, priority=EventPriority.MEDIUM, start_time=now+timedelta(days=4,hours=3), end_time=now+timedelta(days=4,hours=5), location="Revenue Court, Tehsil Office", attendees="SDM (Presiding), Patwari, Both Parties", department="Revenue Department", ward="Ward 7", created_by=uid),
        dict(title="CANCELLED: Contractor Meeting (postponed)", description="Road contractors for NH-44 widening postponed due to state review.", event_type=EventType.MEETING, status=EventStatus.CANCELLED, priority=EventPriority.MEDIUM, start_time=now-timedelta(days=1,hours=2), end_time=now-timedelta(days=1), location="PWD Office", attendees="EE PWD, Contractors", department="Public Works", created_by=uid),
        dict(title="Completed: Flood Damage Assessment - Ward 4", description="47 houses partially damaged, 8 fully damaged. Report submitted.", event_type=EventType.SITE_VISIT, status=EventStatus.COMPLETED, priority=EventPriority.HIGH, start_time=now-timedelta(days=3,hours=5), end_time=now-timedelta(days=3,hours=1), location="Ward 4, Sectors 6-9", attendees="Tehsildar, Patwari, Revenue Inspector", department="Revenue Department", ward="Ward 4", created_by=uid),
        dict(title="Completed: District Development Committee", description="Quarterly DDC: approved 5 new projects, reviewed 12 schemes.", event_type=EventType.MEETING, status=EventStatus.COMPLETED, priority=EventPriority.HIGH, start_time=now-timedelta(days=7,hours=4), end_time=now-timedelta(days=7,hours=1), location="Collectorate Conference Hall", attendees="DM, CDO, All BDOs, MPs/MLAs Representatives", department="Planning Department", created_by=uid),
        dict(title="IN PROGRESS: Road Resurfacing - Ward 3", description="Road resurfacing on Main Market Road, Ward 3. Completion: 3 days.", event_type=EventType.SITE_VISIT, status=EventStatus.IN_PROGRESS, priority=EventPriority.MEDIUM, start_time=now-timedelta(hours=6), end_time=now+timedelta(days=3), location="Main Market Road, Ward 3", attendees="JE PWD, Contractor Foreman", department="Public Works", ward="Ward 3", created_by=uid),
    ]

    for ed in events_data:
        db.add(Event(**ed))
    db.commit()
    print(f"  ✓ {len(events_data)} events")

    # ── Drafts (9 total) ─────────────────────────────────────────
    drafts_data = [
        dict(title="Speech: Independence Day Address 2026", draft_type=DraftType.SPEECH, status=DraftStatus.DRAFT, content=SPEECH_CONTENT, prompt_context="Independence Day speech highlighting district achievements", tone="Formal", audience="Citizens, Officials, Media", department="General Administration", version=1, extra_metadata={"word_count": 210, "ai_generated": False}, created_by=uid),
        dict(title="Official Response: Water Supply Complaint - Ward 4", draft_type=DraftType.OFFICIAL_RESPONSE, status=DraftStatus.APPROVED, content=RESPONSE_CONTENT, prompt_context="Response to water supply complaints from Ward 4 residents", tone="Empathetic", audience="Ward 4 Residents", department="Water Supply Department", version=2, extra_metadata={"word_count": 185, "ai_generated": True}, created_by=uid),
        dict(title="Press Release: NAYAM AI Governance Platform Launch", draft_type=DraftType.PRESS_RELEASE, status=DraftStatus.PUBLISHED, content=PRESS_CONTENT, prompt_context="Press release for NAYAM platform launch", tone="Professional", audience="Media, General Public", department="General Administration", version=1, extra_metadata={"word_count": 195, "ai_generated": True}, created_by=uid),
        dict(title="Policy Brief: Ward-Level Predictive Risk Scoring", draft_type=DraftType.POLICY_BRIEF, status=DraftStatus.UNDER_REVIEW, content=POLICY_CONTENT, prompt_context="Policy brief on AI predictive analytics for ward risk management", tone="Analytical", audience="Senior Administration, Policy Committee", department="Planning Department", version=1, extra_metadata={"word_count": 190, "ai_generated": True}, created_by=uid),
        dict(title="Meeting Agenda: Ward Development Committee - 5 March", draft_type=DraftType.MEETING_AGENDA, status=DraftStatus.APPROVED, content=MEETING_AGENDA_CONTENT, prompt_context="Monthly ward development committee meeting agenda", tone="Professional", audience="Ward Committee Members, Department Officers", department="General Administration", version=1, extra_metadata={"word_count": 280, "ai_generated": True}, created_by=uid),
        dict(title="Public Notice: Road Closure - Ward 3 Main Market Road", draft_type=DraftType.PUBLIC_NOTICE, status=DraftStatus.PUBLISHED, content=PUBLIC_NOTICE_CONTENT, prompt_context="Road closure notice for resurfacing work", tone="Informative", audience="General Public, Commuters", department="Public Works", version=1, extra_metadata={"word_count": 220, "ai_generated": True}, created_by=uid),
        dict(title="Formal Letter: Emergency Pipeline Replacement Request", draft_type=DraftType.LETTER, status=DraftStatus.UNDER_REVIEW, content=FORMAL_LETTER_CONTENT, prompt_context="Letter to State Water Board for emergency pipeline replacement", tone="Formal", audience="State Government Officials", department="Water Supply Department", version=2, extra_metadata={"word_count": 260, "ai_generated": True}, created_by=uid),
        dict(title="RTI Response: Road Construction Contracts - Ward 5", draft_type=DraftType.RTI_RESPONSE, status=DraftStatus.APPROVED, content=RTI_RESPONSE_CONTENT, prompt_context="RTI response about road contracts in Ward 5", tone="Formal", audience="RTI Applicant", department="General Administration", version=1, extra_metadata={"word_count": 320, "ai_generated": False}, created_by=uid),
        dict(title="Government Circular: NAYAM Platform Mandatory Adoption", draft_type=DraftType.CIRCULAR, status=DraftStatus.PUBLISHED, content=GOVT_CIRCULAR_CONTENT, prompt_context="Circular for mandatory NAYAM platform adoption", tone="Authoritative", audience="Department Heads, All Officers", department="General Administration", version=1, extra_metadata={"word_count": 350, "ai_generated": True}, created_by=uid),
    ]

    for dd in drafts_data:
        db.add(Draft(**dd))
    db.commit()
    print(f"  ✓ {len(drafts_data)} drafts")
    db.close()


# ═══════════════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════════════

def main():
    print("=" * 60)
    print("  NAYAM — Unified Database Seed")
    print("=" * 60)

    if "--reset" in sys.argv:
        db_path = "nayam_dev.db"
        if os.path.exists(db_path):
            os.remove(db_path)
            print(f"\n  ✗ Deleted {db_path}. Restart the backend to recreate tables, then run seed.py again.")
            sys.exit(0)
        else:
            print(f"\n  ⚠ {db_path} not found.")
            sys.exit(0)

    print()
    step1_api_seed(BASE)
    step2_spread_dates()
    step3_action_requests()
    step4_events_and_drafts()

    print()
    print("=" * 60)
    print("  ✓ Seed complete!")
    print()
    print("    Login:    admin@nayam.gov.in / admin12345")
    print("    Backend:  http://localhost:8000/docs")
    print("    Frontend: http://localhost:3000")
    print("=" * 60)


if __name__ == "__main__":
    main()
