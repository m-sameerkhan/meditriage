from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, String, Boolean, DateTime, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from pydantic import BaseModel
from typing import List, Optional
from groq import Groq
from datetime import datetime
from dotenv import load_dotenv
import uuid, os, re, traceback

load_dotenv()

# Database
DATABASE_URL = os.getenv("DATABASE_URL")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class PatientDB(Base):
    __tablename__ = "patients"
    id           = Column(String, primary_key=True, index=True)
    patient_name = Column(String)
    level        = Column(String)
    complaint    = Column(String)
    duration     = Column(String)
    pain_score   = Column(String)
    flags        = Column(String)
    doctor_note  = Column(String)
    escalate     = Column(Boolean)
    arrived_at   = Column(String)
    created_at   = Column(DateTime, default=datetime.utcnow)

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# App
app = FastAPI(title="MediTriage API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Groq 
api_key = os.getenv("GROQAPIKEY")
client = Groq(api_key=api_key) if api_key else None

sessions: dict = {}

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
# Schemas 
class ChatRequest(BaseModel):
    session_id:    Optional[str] = None
    message:       str
    patient_name:  Optional[str] = "Patient"
    message_count: Optional[int] = 0

class ChatResponse(BaseModel):
    session_id:    str
    reply:         str
    triage_result: Optional[dict] = None

# Helpers 
def parse_triage(text: str) -> Optional[dict]:
    if "TRIAGE_RESULT:" not in text:
        return None
    section = text.split("TRIAGE_RESULT:")[1]
    def get(key):
        m = re.search(rf"{key}:\s*(.+)", section, re.MULTILINE)
        return m.group(1).strip() if m else ""
    flags = [f.strip() for f in get("Key flags").split(",") if f.strip()]
    return {
        "level":       get("Level"),
        "complaint":   get("Chief complaint"),
        "duration":    get("Duration"),
        "pain_score":  get("Pain score"),
        "flags":       flags,
        "doctor_note": get("Doctor note"),
        "escalate":    get("Escalate").upper() == "YES",
    }

# Routes 
@app.post("/api/chat", response_model=ChatResponse)
async def chat(req: ChatRequest, db: Session = Depends(get_db)):
    if not client:
        raise HTTPException(status_code=500, detail="Groq API key missing")

    session_id = req.session_id or str(uuid.uuid4())
    if session_id not in sessions:
        sessions[session_id] = {"messages": [], "count": 0}

    sessions[session_id]["count"] += 1
    msg_count = sessions[session_id]["count"]

    sessions[session_id]["messages"].append({
        "role": "user", "content": req.message
    })

    messages = sessions[session_id]["messages"].copy()
    if msg_count >= 4:
        messages[-1]["content"] += "\n\n[SYSTEM: Output TRIAGE_RESULT immediately. Do not ask anything more.]"

    response = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[{"role": "system", "content": SYSTEM_PROMPT}, *messages],
        max_tokens=500,
        temperature=0.3,
    )
    reply = response.choices[0].message.content

    sessions[session_id]["messages"].append({
        "role": "assistant", "content": reply
    })

    triage = parse_triage(reply)
    # Only EMERGENCY cases escalate
    if triage and triage["level"] != "EMERGENCY":
        triage["escalate"] = False

    clean_reply = reply.split("TRIAGE_RESULT:")[0].strip() if triage else reply

    # Save to Neon database
    if triage:
        patient_id = str(uuid.uuid4())
        db_patient = PatientDB(
            id=patient_id,
            patient_name=req.patient_name,
            level=triage["level"],
            complaint=triage["complaint"],
            duration=triage["duration"],
            pain_score=triage["pain_score"],
            flags=",".join(triage["flags"]),
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


@app.get("/api/patients")
async def get_patients(db: Session = Depends(get_db)):
    db_patients = db.query(PatientDB).order_by(PatientDB.created_at.desc()).all()
    order = {"EMERGENCY": 0, "URGENT": 1, "ROUTINE": 2}
    patient_list = [{
        "patient_id":   p.id,
        "patient_name": p.patient_name,
        "level":        p.level,
        "complaint":    p.complaint,
        "duration":     p.duration,
        "pain_score":   p.pain_score,
        "flags":        p.flags.split(",") if p.flags else [],
        "doctor_note":  p.doctor_note,
        "escalate":     p.escalate,
        "arrived_at":   p.arrived_at,
    } for p in db_patients]
    return {
        "patients": sorted(patient_list, key=lambda p: order.get(p["level"], 3)),
        "total": len(patient_list)
    }


@app.delete("/api/patients/{patient_id}")
async def mark_seen(patient_id: str, db: Session = Depends(get_db)):
    patient = db.query(PatientDB).filter(PatientDB.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    db.delete(patient)
    db.commit()
    return {"status": "removed"}


@app.get("/api/health")
async def health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        db_status = "ok"
    except:
        db_status = "error"
    return {
        "status": "ok",
        "active_sessions": len(sessions),
        "queue_length": db.query(PatientDB).count(),
        "database": db_status
    }