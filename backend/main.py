from fastapi import FastAPI, HTTPException
from sqlalchemy import create_engine, Column, String, Integer, Boolean, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, Depends
from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional
from groq import Groq
import uuid
import os
import re
from datetime import datetime
from dotenv import load_dotenv
import traceback

load_dotenv()

# Database Setup with SQLAlchemy
DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# Define the Patient table
class PatientDB(Base):
    __tablename__ = "patients"
    id = Column(String, primary_key=True, index=True)
    patient_name = Column(String)
    level = Column(String)
    complaint = Column(String)
    duration = Column(String)
    pain_score = Column(String)
    flags = Column(String)  # Store as a comma-separated string
    doctor_note = Column(String)
    escalate = Column(Boolean)
    arrived_at = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

# Create tables
Base.metadata.create_all(bind=engine)

# Dependency to get DB session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

app = FastAPI(title="MediTriage API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Groq client
api_key = os.getenv("GROQ_API_KEY")
client = Groq(api_key=api_key) if api_key else None

# In-memory store for chat sessions
sessions: dict = {}

# Pydantic models
class ChatRequest(BaseModel):
    session_id: Optional[str] = None
    message: str
    patient_name: Optional[str] = "Patient"

class ChatResponse(BaseModel):
    session_id: str
    reply: str
    triage_result: Optional[dict] = None

class TriageResult(BaseModel):
    patient_id: str
    patient_name: str
    level: str
    complaint: str
    duration: str
    pain_score: str
    flags: List[str]
    doctor_note: str
    escalate: bool
    arrived_at: str

SYSTEM_PROMPT = """You are MediTriage, an AI intake assistant for a medical clinic. 
Conduct a structured patient intake interview and triage the patient's condition.

INTAKE FLOW:
1. Get the chief complaint (main symptom)
2. Ask about duration ("How long have you had this?")
3. Ask about severity on scale 1-10
4. Ask about accompanying symptoms
5. Ask about relevant medical history if needed
6. After 4-5 exchanges, produce a triage summary

TRIAGE LEVELS:
- EMERGENCY: Life-threatening (chest pain + sweating, severe breathing difficulty, stroke symptoms, major bleeding)
- URGENT: Needs same-day attention (fever >39°C, pain 7+, suspected infection)
- ROUTINE: Standard appointment (mild symptoms, refills, checkups)

When you have enough information, respond with your conversational message AND this exact block:

TRIAGE_RESULT:
Level: [EMERGENCY|URGENT|ROUTINE]
Chief complaint: [brief phrase]
Duration: [X hours/days]
Pain score: [X/10]
Key flags: [flag1, flag2, flag3]
Doctor note: [1-2 sentence clinical summary for physician]
Escalate: [YES|NO]

Rules:
- One question at a time, warm and professional tone
- Never diagnose — only triage
- Keep responses under 80 words unless giving the final summary
- For EMERGENCY: add "Please call 1122 or go to the nearest emergency room immediately."
"""

def parse_triage(text: str) -> Optional[dict]:
    try:
        if "TRIAGE_RESULT:" not in text:
            return None
        section = text.split("TRIAGE_RESULT:")[1]
        
        def get(key):
            m = re.search(rf"{key}:\s*(.+)", section, re.MULTILINE)
            return m.group(1).strip() if m else ""
        
        flags_raw = get("Key flags")
        flags = [f.strip() for f in flags_raw.split(",") if f.strip()] if flags_raw else []
        
        return {
            "level": get("Level"),
            "complaint": get("Chief complaint"),
            "duration": get("Duration"),
            "pain_score": get("Pain score"),
            "flags": flags,
            "doctor_note": get("Doctor note"),
            "escalate": get("Escalate").upper() == "YES",
        }
    except Exception as e:
        return None

@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest, db: Session = Depends(get_db)):
    try:
        if not client:
            raise HTTPException(status_code=500, detail="Groq client not initialized. Check API key.")
        
        session_id = req.session_id or str(uuid.uuid4())
        if session_id not in sessions:
            sessions[session_id] = []

        history = sessions[session_id]
        history.append({"role": "user", "content": req.message})

        messages = [{"role": "system", "content": SYSTEM_PROMPT}] + history

        response = client.chat.completions.create(
            model="llama-3.1-8b-instant",
            messages=messages,
            max_tokens=1000,
            temperature=0.7,
        )
        
        reply = response.choices[0].message.content
        
        history.append({"role": "assistant", "content": reply})
        sessions[session_id] = history

        triage = parse_triage(reply)
        clean_reply = reply.split("TRIAGE_RESULT:")[0].strip() if triage else reply

       
        # Save to DATABASE
        if triage:
            patient_id = str(uuid.uuid4())
            db_patient = PatientDB(
                id=patient_id,
                patient_name=req.patient_name,
                level=triage["level"],
                complaint=triage["complaint"],
                duration=triage["duration"],
                pain_score=triage["pain_score"],
                flags=",".join(triage["flags"]),  # Convert list to comma-separated string
                doctor_note=triage["doctor_note"],
                escalate=triage["escalate"],
                arrived_at=datetime.now().strftime("%I:%M %p"),
            )
            db.add(db_patient)
            db.commit()

        return ChatResponse(
            session_id=session_id,
            reply=clean_reply,
            triage_result=triage,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/patients")
async def get_patients(db: Session = Depends(get_db)):
    # Get all patients from database
    db_patients = db.query(PatientDB).order_by(PatientDB.created_at.desc()).all()
    
    # Convert to dict format expected by frontend
    patient_list = []
    for p in db_patients:
        patient_list.append({
            "patient_id": p.id,
            "patient_name": p.patient_name,
            "level": p.level,
            "complaint": p.complaint,
            "duration": p.duration,
            "pain_score": p.pain_score,
            "flags": p.flags.split(",") if p.flags else [],  # Convert string back to list
            "doctor_note": p.doctor_note,
            "escalate": p.escalate,
            "arrived_at": p.arrived_at,
        })
    
    # Sort by urgency level (EMERGENCY first, then URGENT, then ROUTINE)
    order = {"EMERGENCY": 0, "URGENT": 1, "ROUTINE": 2}
    sorted_patients = sorted(
        patient_list,
        key=lambda p: order.get(p["level"], 3)
    )
    
    return {"patients": sorted_patients, "total": len(sorted_patients)}

@app.delete("/patients/{patient_id}")
async def mark_seen(patient_id: str, db: Session = Depends(get_db)):
    # Find patient in database
    patient = db.query(PatientDB).filter(PatientDB.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    
    # Delete from database
    db.delete(patient)
    db.commit()
    return {"status": "removed"}

@app.get("/health")
async def health(db: Session = Depends(get_db)):
    # Check database connection
    try:
        db.execute("SELECT 1")
        db_status = "ok"
    except:
        db_status = "error"
    
    return {
        "status": "ok", 
        "active_sessions": len(sessions), 
        "queue_length": db.query(PatientDB).count(),
        "database": db_status
    }