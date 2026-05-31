# 🏥 MediTriage — AI Clinic Intake & Triage System

An AI-powered patient intake and triage bot that handles 80% of clinic intake autonomously.

![Status](https://img.shields.io/badge/Status-Live-brightgreen) ![License](https://img.shields.io/badge/License-MIT-blue) ![AI](https://img.shields.io/badge/AI-Groq%20LLaMA3-orange)

---

## 🌐 Live Demo

| | URL |
|---|---|
| **Frontend** | https://meditriage-chi.vercel.app |
| **Backend API** | https://sameerkhan12-meditriage-api.hf.space |

---

## 🎯 Problem Statement

Clinic front-desk staff manually ask every patient the same intake questions, hand-write notes, then verbally brief the doctor — wasting 10–15 minutes per patient. This repetitive, data-heavy workflow is a perfect candidate for AI automation.

---

## 💡 Solution

MediTriage is an AI agent that:
- Conducts structured patient intake via conversational chat
- Triages patients into **EMERGENCY / URGENT / ROUTINE** in max 4 questions
- Generates an AI doctor brief automatically
- Displays all triaged patients on a live doctor dashboard
- Escalates life-threatening cases immediately

---

## 👥 Users

| User | How they use it |
|---|---|
| **Patient** | Opens app on phone/tablet in waiting room, chats with AI |
| **Doctor** | Opens dashboard, sees pre-triaged queue with clinical notes |

---

## 🏗️ Architecture

```
Patient (Browser)
      │
      ▼
Vercel (React Frontend)
      │  HTTPS
      ▼
Hugging Face Spaces (FastAPI Backend)
      │
      ├── Groq API (LLaMA 3 — AI triage agent)
      │
      └── Neon PostgreSQL (patient data persistence)
```

### Agent Decision Flow
```
Patient message
      │
      ▼
Is this message 1-3?  ──YES──► Ask next intake question
      │
      NO
      ▼
Force TRIAGE_RESULT output
      │
      ▼
Parse: EMERGENCY / URGENT / ROUTINE
      │
      ├── EMERGENCY ──► Escalate flag + call 1122
      ├── URGENT    ──► Same-day attention required
      └── ROUTINE   ──► Standard appointment
```

---

## 🤖 What the Agent Does Autonomously

- Asks structured intake questions (max 4)
- Combines related questions to save time
- Classifies urgency level based on symptoms
- Generates clinical doctor note
- Saves patient to Neon database
- Flags emergencies for immediate escalation

## 🧑‍⚕️ What Gets Escalated to Humans

- EMERGENCY cases → immediate physician alert
- Cases with ambiguous or conflicting symptoms
- All final clinical decisions (AI only triages, never diagnoses)

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18 + Vite |
| **Backend** | FastAPI (Python) |
| **AI Model** | Groq — LLaMA 3.1 8B Instant |
| **Database** | Neon PostgreSQL (via SQLAlchemy) |
| **Frontend Deploy** | Vercel (free, no card) |
| **Backend Deploy** | Hugging Face Spaces (free, no card) |

---

## 📁 Project Structure

```
meditriage/
├── src/
│   ├── App.jsx              ← Home screen (Patient / Doctor selector)
│   ├── PatientChat.jsx      ← Conversational intake chat UI
│   ├── DoctorDashboard.jsx  ← Live patient queue + triage details
│   └── index.css            ← All styles
├── backend/
│   ├── main.py              ← FastAPI server (local dev)
│   └── requirements.txt
├── index.html
├── package.json
└── vite.config.js
```

---

## 🚀 Run Locally

### Backend

```bash
cd backend
pip install -r requirements.txt

# Create .env file
echo GROQAPIKEY=your_key_here > .env
echo DATABASE_URL=your_neon_url_here >> .env

uvicorn main:app --reload --port 8000
```

### Frontend

```bash
npm install
npm run dev
```

Open `http://localhost:5173`

---

## 🔑 Environment Variables

### Backend (Hugging Face Secrets)
| Key | Value |
|---|---|
| `GROQAPIKEY` | From console.groq.com |
| `DATABASE_URL` | From neon.tech (with ?sslmode=require) |

### Frontend (Vercel)
| Key | Value |
|---|---|
| `VITE_API_URL` | https://sameerkhan12-meditriage-api.hf.space |

---

## 📡 API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/chat` | Patient sends message, get AI reply + triage |
| `GET` | `/api/patients` | Get all triaged patients sorted by urgency |
| `DELETE` | `/api/patients/{id}` | Mark patient as seen |
| `GET` | `/api/health` | Health check + DB status |

---

## 🧪 Test the API

### Option 1 — Live App
👉 https://meditriage-chi.vercel.app

### Option 2 — Interactive Docs (No setup needed)
👉 https://sameerkhan12-meditriage-api.hf.space/docs

### Option 3 — Postman
- Download [Postman](https://postman.com)
- POST to `https://sameerkhan12-meditriage-api.hf.space/api/chat`
- Body (JSON):

```json
{
  "message": "I have chest pain",
  "patient_name": "Test Patient"
}
```

### Option 4 — Terminal (curl)

```bash
curl -X POST https://sameerkhan12-meditriage-api.hf.space/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "I have chest pain", "patient_name": "Test Patient"}'
```

---

## 📊 Triage Logic

| Level | Criteria | Action |
|---|---|---|
| 🚨 **EMERGENCY** | Chest pain + sweating, stroke, severe bleeding, breathing failure | Escalate immediately + call 1122 |
| ⚠️ **URGENT** | Pain 7+, fever >39°C, fracture, infection, limited mobility | Same-day doctor visit |
| ✅ **ROUTINE** | Mild symptoms, refills, checkups, pain under 6 | Standard appointment |

---

## 🛡️ Failure Handling

| Scenario | How agent handles it |
|---|---|
| Vague input | Asks targeted follow-up question |
| Missing info after 4 questions | Forces triage with available data |
| Connection error | Shows retry message to patient |
| Database down | Returns error with status code |
| Blank screen crash | Error boundary shows reload button |
| Page refresh | Session persists via sessionStorage |

---

## 👨‍💻 Built By

**Muhammad Sameer Khan**
BS Intelligent Systems & Robotics — Islamia University of Bahawalpur
GitHub: [@m-sameerkhan](https://github.com/m-sameerkhan)

---

## 📄 License

MIT License — feel free to use and modify.