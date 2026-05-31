import { useState, useRef, useEffect } from "react";

const API = "https://sameerkhan12-meditriage-api.hf.space";

const QUICK_REPLIES = [
  "I have a fever and sore throat",
  "Chest pain",
  "I hurt my leg",
  "Prescription refill",
];

export default function PatientChat({ patientName, onBack }) {
  const [messages, setMessages] = useState([
    {
      role: "bot",
      text: `Hello ${patientName}! I'm your clinic intake assistant. I'll ask you a few quick questions so the doctor can prepare for your visit.\n\nWhat is your main reason for visiting today?`,
      showQuick: true,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
 const [sessionId, setSessionId] = useState(
  () => sessionStorage.getItem("triage_session_id") || null
);
const [msgCount, setMsgCount] = useState(0);
  const [triageDone, setTriageDone] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function send(text) {
    if (!text.trim() || loading || triageDone) return;
    setInput("");
    setMessages(prev => [...prev, { role: "user", text }]);
    setLoading(true);

    try {
      const newCount = msgCount + 1;
    setMsgCount(newCount);

    const res = await fetch(`${API}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: sessionId,
        message: text,
        patient_name: patientName,
        message_count: newCount,
      }),
    });
    const data = await res.json();
    setSessionId(data.session_id);
    sessionStorage.setItem("triage_session_id", data.session_id);
      setMessages(prev => [
        ...prev,
        { role: "bot", text: data.reply, triage: data.triage_result },
      ]);
    if (data.triage_result) {
        setTriageDone(true);
        sessionStorage.removeItem("triage_session_id");
      }
    } catch {
      setMessages(prev => [
        ...prev,
        { role: "bot", text: "Sorry, there was a connection error. Please try again." },
      ]);
    }
    setLoading(false);
  }

  function getLevelStyle(level) {
    if (level === "EMERGENCY") return { bg: "#FCEBEB", color: "#A32D2D", label: "🚨 Emergency" };
    if (level === "URGENT") return { bg: "#FAEEDA", color: "#854F0B", label: "⚠️ Urgent" };
    return { bg: "#EAF3DE", color: "#3B6D11", label: "✓ Routine" };
  }

  return (
    <div className="chat-page">
      <div className="chat-topbar">
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
          <div className="chat-topbar-title">MediTriage</div>
          <div className="chat-topbar-sub">Intake assistant</div>
        </div>
        <div className="online-badge">
          <span className="online-dot" />
          Online
        </div>
      </div>

      <div className="chat-messages">
        {messages.map((m, i) => (
          <div key={i} className={`msg-wrap ${m.role}`}>
            <div className={`bubble ${m.role}`}>
              {m.text.split("\n").map((line, j) => (
                <span key={j}>{line}{j < m.text.split("\n").length - 1 && <br />}</span>
              ))}

              {m.showQuick && (
                <div className="quick-btns">
                  {QUICK_REPLIES.map(q => (
                    <button key={q} className="qr-btn" onClick={() => send(q)}>{q}</button>
                  ))}
                </div>
              )}

              {m.triage && (() => {
                const s = getLevelStyle(m.triage.level);
                return (
                  <div className="triage-result" style={{ borderColor: s.color + "40" }}>
                    <div className="triage-badge" style={{ background: s.bg, color: s.color }}>
                      {s.label}
                    </div>
                    <div className="triage-rows">
                      <div className="triage-row"><span>Complaint</span><span>{m.triage.complaint}</span></div>
                      <div className="triage-row"><span>Duration</span><span>{m.triage.duration}</span></div>
                      <div className="triage-row"><span>Pain score</span><span>{m.triage.pain_score}</span></div>
                    </div>
                    <div className="triage-flags">
                      {m.triage.flags.map(f => <span key={f} className="flag">{f}</span>)}
                    </div>
                    <div className="triage-note">{m.triage.doctor_note}</div>
                    {m.triage.escalate && (
                      <div className="escalate-alert">
                        🚨 Please call <strong>1122</strong> or go to the nearest emergency room immediately.
                      </div>
                    )}
                    <div className="triage-done-msg">
                      Your intake is complete. Please proceed to the front desk — your report has been sent to the doctor.
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        ))}

        {loading && (
          <div className="msg-wrap bot">
            <div className="bubble bot">
              <div className="typing">
                <span /><span /><span />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-area">
        <textarea
          className="chat-input"
          placeholder={triageDone ? "Intake complete" : "Describe your symptoms..."}
          value={input}
          disabled={triageDone}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
          rows={1}
        />
        <button className="send-btn" onClick={() => send(input)} disabled={!input.trim() || loading || triageDone}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}
