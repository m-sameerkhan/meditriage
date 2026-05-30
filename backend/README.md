---
title: "MediTriage API"
emoji: 🏥
colorFrom: green
colorTo: teal
sdk: docker
app_port: 7860
---

# MediTriage AI Medical Intake System

Backend API for AI-powered patient triage.

- FastAPI backend with Groq AI integration
- PostgreSQL database for patient data persistence
- Triage system (Emergency/Urgent/Routine)

## API Endpoints

- `POST /chat` - Patient intake conversation
- `GET /patients` - Doctor queue
- `DELETE /patients/{id}` - Mark patient seen
- `GET /health` - Health check