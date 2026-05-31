import { useState } from "react";
import React from "react";
import PatientChat from "./PatientChat";
import DoctorDashboard from "./DoctorDashboard";
import "./index.css";

class ErrorBoundary extends React.Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, textAlign: "center", fontFamily: "sans-serif" }}>
          <h2 style={{ color: "#333" }}>Something went wrong.</h2>
          <p style={{ color: "#888", margin: "10px 0 20px" }}>
            Please reload the page to continue.
          </p>
          <button
            onClick={() => { sessionStorage.clear(); window.location.reload(); }}
            style={{ padding: "10px 24px", background: "#1D9E75", color: "white",
              border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14 }}>
            Reload App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  // Persist view across refresh
  const [view, setView] = useState(
    () => sessionStorage.getItem("app_view") || "home"
  );
  const [patientName, setPatientName] = useState(
    () => sessionStorage.getItem("app_patient_name") || ""
  );
  const [nameInput, setNameInput] = useState("");

  function goToPatient(name) {
    sessionStorage.setItem("app_view", "patient");
    sessionStorage.setItem("app_patient_name", name);
    setPatientName(name);
    setView("patient");
  }

  function goToDoctor() {
    sessionStorage.setItem("app_view", "doctor");
    setView("doctor");
  }

  function goHome() {
    sessionStorage.setItem("app_view", "home");
    sessionStorage.removeItem("app_patient_name");
    setView("home");
  }

  if (view === "patient") {
    return (
      <ErrorBoundary>
        <PatientChat patientName={patientName} onBack={goHome} />
      </ErrorBoundary>
    );
  }
  if (view === "doctor") {
    return (
      <ErrorBoundary>
        <DoctorDashboard onBack={goHome} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="home-wrap">
        <div className="home-center">
          <div className="home-logo">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <rect width="48" height="48" rx="14" fill="#E1F5EE"/>
              <path d="M24 12v24M12 24h24" stroke="#0F6E56" strokeWidth="3.5" strokeLinecap="round"/>
            </svg>
          </div>
          <h1 className="home-title">MediTriage</h1>
          <p className="home-sub">AI-powered clinic intake & triage system</p>

          <div className="home-cards">
            <div className="role-card">
              <div className="role-icon patient-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="8" r="3.5" stroke="#0F6E56" strokeWidth="1.5"/>
                  <path d="M5 20c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke="#0F6E56" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <h2>I'm a Patient</h2>
              <p>Answer a few questions so our AI can prepare your intake report for the doctor.</p>
              <input
                className="name-input"
                placeholder="Your full name"
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && nameInput.trim() && goToPatient(nameInput.trim())}
              />
              <button
                className="role-btn patient-btn"
                disabled={!nameInput.trim()}
                onClick={() => goToPatient(nameInput.trim())}
              >
                Start intake
              </button>
            </div>

            <div className="role-card">
              <div className="role-icon doctor-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="4" width="18" height="16" rx="2" stroke="#534AB7" strokeWidth="1.5"/>
                  <path d="M8 10h8M8 14h5" stroke="#534AB7" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M8 4V2M16 4V2" stroke="#534AB7" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <h2>I'm a Doctor</h2>
              <p>View the live patient queue, triage reports, and AI-generated clinical briefs.</p>
              <button className="role-btn doctor-btn" onClick={goToDoctor}>
                Open dashboard
              </button>
            </div>
          </div>

          <p className="home-footer">
            Submission for AI Intern Case Study · Deadline June 3, 2026
          </p>
        </div>
      </div>
    </ErrorBoundary>
  );
}