import { useState, useEffect } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

function getLevelStyle(level) {
  if (level === "EMERGENCY") return { bg: "#FCEBEB", color: "#A32D2D", label: "Emergency" };
  if (level === "URGENT") return { bg: "#FAEEDA", color: "#854F0B", label: "Urgent" };
  return { bg: "#EAF3DE", color: "#3B6D11", label: "Routine" };
}

function initials(name) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

const AVATAR_COLORS = [
  { bg: "#E1F5EE", color: "#0F6E56" },
  { bg: "#EEEDFE", color: "#534AB7" },
  { bg: "#FAEEDA", color: "#854F0B" },
  { bg: "#E6F1FB", color: "#185FA5" },
  { bg: "#FAECE7", color: "#993C1D" },
];

export default function DoctorDashboard({ onBack }) {
  const [patients, setPatients] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [markedSeen, setMarkedSeen] = useState(null);

  async function fetchPatients() {
    try {
      const res = await fetch(`${API}/api/patients`);
      const data = await res.json();
      setPatients(data.patients || []);
    } catch {
      // backend not running — show empty state
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchPatients();
    const interval = setInterval(fetchPatients, 10000); // poll every 10s
    return () => clearInterval(interval);
  }, []);

  async function markSeen(patientId) {
    try {
      await fetch(`${API}/api/patients/${patientId}`, { method: "DELETE" });
      setMarkedSeen(patientId);
      setSelected(null);
      setTimeout(() => { setMarkedSeen(null); fetchPatients(); }, 1200);
    } catch {}
  }

  const filtered = filter === "ALL" ? patients : patients.filter(p => p.level === filter);
  const counts = {
    total: patients.length,
    emergency: patients.filter(p => p.level === "EMERGENCY").length,
    urgent: patients.filter(p => p.level === "URGENT").length,
    routine: patients.filter(p => p.level === "ROUTINE").length,
  };

  const selectedPatient = patients.find(p => p.patient_id === selected);

  return (
    <div className="dash-page">
      {/* Topbar */}
      <div className="dash-topbar">
        <button className="back-btn" onClick={onBack}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className="chat-topbar-logo">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M12 3v18M3 12h18" stroke="#0F6E56" strokeWidth="2.5" strokeLinecap="round"/>
          </svg>
        </div>
        <div>
          <div className="chat-topbar-title">Doctor Dashboard</div>
          <div className="chat-topbar-sub">{new Date().toLocaleDateString("en-PK", { weekday: "long", month: "long", day: "numeric" })}</div>
        </div>
        <button className="refresh-btn" onClick={fetchPatients} title="Refresh">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path d="M4 4v5h5M20 20v-5h-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M20 9a8 8 0 00-14.93-2M4 15a8 8 0 0014.93 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </button>
        <div className="online-badge" style={{ marginLeft: 0 }}>
          <span className="online-dot" />Live
        </div>
      </div>

      {/* Stats */}
      <div className="stats-row">
        {[
          { label: "Total today", val: counts.total, color: "var(--color-text-primary)" },
          { label: "Emergency", val: counts.emergency, color: "#A32D2D" },
          { label: "Urgent", val: counts.urgent, color: "#854F0B" },
          { label: "Routine", val: counts.routine, color: "#3B6D11" },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-label">{s.label}</div>
            <div className="stat-val" style={{ color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Body */}
      <div className="dash-body">
        {/* Queue */}
        <div className="queue-panel">
          <div className="queue-header">
            <span>Patient queue</span>
            <div className="filter-tabs">
              {["ALL", "EMERGENCY", "URGENT", "ROUTINE"].map(f => (
                <button
                  key={f}
                  className={`ftab ${filter === f ? "active" : ""}`}
                  onClick={() => setFilter(f)}
                >
                  {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>

          {loading && <div className="empty-state">Loading patients...</div>}

          {!loading && filtered.length === 0 && (
            <div className="empty-state">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M4 20c0-4 3.582-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span>{filter === "ALL" ? "No patients in queue" : `No ${filter.toLowerCase()} cases`}</span>
            </div>
          )}

          {filtered.map((p, idx) => {
            const s = getLevelStyle(p.level);
            const av = AVATAR_COLORS[idx % AVATAR_COLORS.length];
            return (
              <div
                key={p.patient_id}
                className={`patient-row ${selected === p.patient_id ? "selected" : ""} ${markedSeen === p.patient_id ? "fading" : ""}`}
                onClick={() => setSelected(p.patient_id)}
              >
                <div className="p-avatar" style={{ background: av.bg, color: av.color }}>
                  {initials(p.patient_name)}
                </div>
                <div className="p-info">
                  <div className="p-name">{p.patient_name}</div>
                  <div className="p-complaint">{p.complaint}</div>
                </div>
                <div className="p-meta">
                  <span className="badge" style={{ background: s.bg, color: s.color }}>{s.label}</span>
                  <div className="p-time">{p.arrived_at}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Detail panel */}
        <div className="detail-panel">
          {!selectedPatient ? (
            <div className="empty-state" style={{ height: "100%" }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span>Select a patient to view their triage report</span>
            </div>
          ) : (() => {
            const p = selectedPatient;
            const s = getLevelStyle(p.level);
            const av = AVATAR_COLORS[patients.indexOf(p) % AVATAR_COLORS.length];
            return (
              <div className="detail-content">
                {p.escalate && p.level==="EMERGENCY" && (
                  <div className="escalate-banner">
                    🚨 AI flagged for immediate escalation — attending physician required now
                  </div>
                )}
                <div className="detail-header">
                  <div className="detail-header-row">
                    <div className="p-avatar lg" style={{ background: av.bg, color: av.color }}>
                      {initials(p.patient_name)}
                    </div>
                    <div>
                      <div className="detail-name">{p.patient_name}</div>
                      <div className="detail-meta">
                        Arrived {p.arrived_at} &nbsp;·&nbsp;
                        <span style={{ background: s.bg, color: s.color, padding: "1px 8px", borderRadius: 20, fontSize: 11, fontWeight: 500 }}>{s.label}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="detail-section">
                  <div className="section-title">Intake summary</div>
                  {[
                    ["Chief complaint", p.complaint],
                    ["Duration", p.duration],
                    ["Pain score", p.pain_score],
                  ].map(([k, v]) => (
                    <div key={k} className="info-row">
                      <span className="info-lbl">{k}</span>
                      <span className="info-val">{v}</span>
                    </div>
                  ))}
                </div>

                <div className="detail-section">
                  <div className="section-title">Clinical flags</div>
                  <div className="flags-wrap">
                    {p.flags.map(f => (
                      <span key={f} className="flag-chip">{f}</span>
                    ))}
                  </div>
                </div>

                <div className="detail-section">
                  <div className="section-title">AI doctor note</div>
                  <div className="doctor-note">{p.doctor_note}</div>
                </div>

                <div className="detail-actions">
                  <button className="action-btn primary" onClick={() => markSeen(p.patient_id)}>
                    ✓ Mark seen
                  </button>
                  <button
                    className="action-btn"
                    onClick={() => window.open(`mailto:?subject=SOAP Note - ${p.patient_name}&body=Complaint: ${p.complaint}%0ADuration: ${p.duration}%0APain: ${p.pain_score}%0ANote: ${p.doctor_note}`)}
                  >
                    ✉ Email note
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
