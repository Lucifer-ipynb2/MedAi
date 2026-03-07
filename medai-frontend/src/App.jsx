import { useState, useRef, useEffect, useCallback } from "react";

const OPENROUTER_API_KEY = "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";

const MEDICAL_SYSTEM = `You are MedAI - an advanced medical AI assistant. Help users with:
- Medical information about diseases, symptoms, medications
- Symptom analysis and possible conditions  
- Drug information, interactions, dosage
- Health advice and preventive care
- First aid guidance

Rules:
- Always recommend consulting a real doctor
- Be empathetic, clear, and accurate
- For serious symptoms, urge immediate medical attention
- Use markdown formatting with emojis
- Severity: 🟢 Mild | 🟡 Moderate | 🔴 Severe | 🚨 Emergency
- Respond in the same language as user (Hindi/English both fine)`;

const SYMPTOM_SYSTEM = `You are a medical symptom analyzer AI. Analyze symptoms and provide:

## 🔍 Possible Conditions
List top 3-5 conditions with likelihood percentage

## ⚡ Severity Level
Rate: Mild / Moderate / Severe / Emergency

## ⚠️ Warning Signs to Watch
Key red flags

## 🏃 Immediate Actions
What to do right now

## 👨‍⚕️ When to See Doctor
Timeline recommendation

## ✅ Do's and ❌ Don'ts
Quick actionable advice

Always end with: "⚠️ AI Analysis Only — Please consult a qualified doctor for proper diagnosis and treatment."
Respond in user's language (Hindi/English).`;

const DRUG_SYSTEM = `You are a pharmaceutical expert. For any drug query provide:

## 💊 Drug Overview
What it is and treats

## ⚙️ How It Works
Simple mechanism

## 📏 Common Dosage
Standard doses (always say consult doctor)

## ⚠️ Side Effects
Common and serious

## 🔗 Drug Interactions
Important interactions

## 🚫 Precautions
Who should avoid

Always recommend consulting pharmacist/doctor.`;

async function callAI(messages, systemPrompt, onStream) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://medai.health",
      "X-Title": "MedAI Health Assistant",
    },
    body: JSON.stringify({
      model: "anthropic/claude-3.5-sonnet",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      max_tokens: 2000,
      temperature: 0.3,
      stream: true,
    }),
  });

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    const lines = chunk.split("\n").filter((l) => l.startsWith("data: "));
    for (const line of lines) {
      const data = line.slice(6);
      if (data === "[DONE]") continue;
      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta?.content || "";
        full += delta;
        onStream(full);
      } catch {}
    }
  }
  return full;
}

function MarkdownRenderer({ text }) {
  const renderMarkdown = (t) => {
    if (!t) return "";
    return t
      .replace(/^### (.*)/gm, '<h3 style="color:#00d4ff;font-size:1rem;font-weight:700;margin:1rem 0 0.4rem;letter-spacing:0.05em;">$1</h3>')
      .replace(/^## (.*)/gm, '<h2 style="color:#7effd4;font-size:1.1rem;font-weight:700;margin:1.2rem 0 0.5rem;border-bottom:1px solid rgba(126,255,212,0.2);padding-bottom:0.3rem;">$1</h2>')
      .replace(/^# (.*)/gm, '<h1 style="color:#fff;font-size:1.3rem;font-weight:800;margin:1rem 0 0.5rem;">$1</h1>')
      .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#ffd700;font-weight:700;">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em style="color:#b8e8ff;">$1</em>')
      .replace(/`(.*?)`/g, '<code style="background:rgba(0,212,255,0.15);color:#00d4ff;padding:0.1rem 0.4rem;border-radius:4px;font-size:0.85rem;">$1</code>')
      .replace(/^[-•] (.*)/gm, '<div style="display:flex;gap:0.5rem;margin:0.2rem 0;"><span style="color:#00d4ff;">▸</span><span>$1</span></div>')
      .replace(/\n\n/g, '<div style="height:0.7rem"></div>')
      .replace(/\n/g, "<br/>");
  };
  return <div dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }} style={{ lineHeight: 1.7, fontSize: "0.93rem" }} />;
}

const TABS = [
  { id: "chat", icon: "💬", label: "AI Doctor" },
  { id: "symptom", icon: "🔬", label: "Symptom AI" },
  { id: "drug", icon: "💊", label: "Drug Search" },
  { id: "emergency", icon: "🚨", label: "Emergency" },
];

const QUICK_SYMPTOMS = ["Headache", "Fever", "Chest Pain", "Nausea", "Fatigue", "Cough", "Joint Pain", "Rash"];

const EMERGENCY_NUMBERS = [
  { country: "🇮🇳 India", police: "100", ambulance: "108", fire: "101", women: "1091" },
  { country: "🌍 International", police: "911/999", ambulance: "112", fire: "112", women: "varies" },
];

const FIRST_AID = [
  { title: "Heart Attack", icon: "❤️", color: "#ff4757", steps: ["Call ambulance immediately (108)", "Loosen tight clothing", "Give aspirin if not allergic", "Start CPR if unconscious", "Keep calm, don't move patient"] },
  { title: "Choking", icon: "🫁", color: "#ff6b35", steps: ["Encourage coughing", "5 back blows between shoulder blades", "5 abdominal thrusts (Heimlich)", "Repeat until object dislodges", "Call 108 if unconscious"] },
  { title: "Severe Burns", icon: "🔥", color: "#ffa502", steps: ["Cool with running water 20min", "Don't use ice or butter", "Cover with clean cloth", "Don't pop blisters", "Seek immediate medical help"] },
  { title: "Stroke", icon: "🧠", color: "#5352ed", steps: ["FAST: Face drooping?", "Arm weakness?", "Speech difficulty?", "Time to call 108!", "Note exact time of symptoms"] },
];

export default function MedAI() {
  const [activeTab, setActiveTab] = useState("chat");
  const [chatMessages, setChatMessages] = useState([
    { role: "assistant", content: "🩺 **Namaste! I'm MedAI — your personal health assistant.**\n\nAap mujhse kisi bhi health topic ke baare mein puch sakte hain:\n\n▸ Symptoms aur bimariyan\n▸ Davaiyaan aur unke side effects\n▸ Health tips aur preventive care\n▸ First aid guidance\n\n**Kya jaanna chahte hain aaj?** 😊" }
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [symptoms, setSymptoms] = useState("");
  const [symptomResult, setSymptomResult] = useState("");
  const [capturedImage, setCapturedImage] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [drugQuery, setDrugQuery] = useState("");
  const [drugResult, setDrugResult] = useState("");
  const [healthTip] = useState("💡 Drink at least 8 glasses of water daily. Proper hydration improves energy, skin health, and cognitive function. Start your day with a glass of water before coffee!");
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const chatEndRef = useRef(null);
  const [particles] = useState(() => Array.from({ length: 20 }, (_, i) => ({
    id: i, x: Math.random() * 100, y: Math.random() * 100,
    size: Math.random() * 3 + 1, speed: Math.random() * 20 + 10,
    delay: Math.random() * 5
  })));

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  const sendChat = async () => {
    if (!chatInput.trim() || isLoading) return;
    const userMsg = { role: "user", content: chatInput };
    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    setChatInput("");
    setIsLoading(true);
    const aiMsg = { role: "assistant", content: "" };
    setChatMessages([...newMessages, aiMsg]);
    try {
      await callAI(
        newMessages.map((m) => ({ role: m.role, content: m.content })),
        MEDICAL_SYSTEM,
        (text) => setChatMessages([...newMessages, { role: "assistant", content: text }])
      );
    } catch (e) {
      setChatMessages([...newMessages, { role: "assistant", content: "❌ Error: " + e.message }]);
    }
    setIsLoading(false);
  };

  const analyzeSymptoms = async () => {
    if (!symptoms.trim() && !capturedImage) return;
    setIsLoading(true);
    setSymptomResult("");
    try {
      const content = capturedImage
        ? [
            { type: "image_url", image_url: { url: capturedImage } },
            { type: "text", text: `Analyze symptoms. Additional info: ${symptoms || "Please analyze the image"}` },
          ]
        : symptoms;
      await callAI(
        [{ role: "user", content }],
        SYMPTOM_SYSTEM,
        setSymptomResult
      );
    } catch (e) {
      setSymptomResult("❌ Error: " + e.message);
    }
    setIsLoading(false);
  };

  const searchDrug = async () => {
    if (!drugQuery.trim()) return;
    setIsLoading(true);
    setDrugResult("");
    try {
      await callAI([{ role: "user", content: `Tell me about: ${drugQuery}` }], DRUG_SYSTEM, setDrugResult);
    } catch (e) {
      setDrugResult("❌ Error: " + e.message);
    }
    setIsLoading(false);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setShowCamera(true);
      setTimeout(() => { if (videoRef.current) videoRef.current.srcObject = stream; }, 100);
    } catch { alert("Camera access denied"); }
  };

  const capturePhoto = () => {
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext("2d").drawImage(videoRef.current, 0, 0);
    setCapturedImage(canvas.toDataURL("image/jpeg"));
    stopCamera();
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setShowCamera(false);
  };

  const styles = {
    app: { minHeight: "100vh", background: "#020b18", color: "#e0f0ff", fontFamily: "'DM Sans', 'Segoe UI', sans-serif", position: "relative", overflow: "hidden" },
    particle: (p) => ({ position: "fixed", left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size, borderRadius: "50%", background: "rgba(0,212,255,0.3)", animation: `float ${p.speed}s ease-in-out ${p.delay}s infinite alternate`, pointerEvents: "none", zIndex: 0 }),
    grid: { position: "fixed", inset: 0, backgroundImage: "linear-gradient(rgba(0,212,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.03) 1px, transparent 1px)", backgroundSize: "60px 60px", pointerEvents: "none", zIndex: 0 },
    header: { position: "relative", zIndex: 10, padding: "1.5rem 2rem 0", textAlign: "center" },
    logo: { fontSize: "2.2rem", fontWeight: 900, background: "linear-gradient(135deg, #00d4ff, #7effd4, #00d4ff)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "-0.03em", marginBottom: "0.2rem" },
    subtitle: { color: "rgba(0,212,255,0.6)", fontSize: "0.8rem", letterSpacing: "0.2em", textTransform: "uppercase" },
    tipBar: { margin: "1rem 1.5rem 0", padding: "0.7rem 1.2rem", background: "linear-gradient(135deg, rgba(0,212,255,0.08), rgba(126,255,212,0.08))", border: "1px solid rgba(0,212,255,0.15)", borderRadius: "12px", fontSize: "0.82rem", color: "#7effd4", position: "relative", zIndex: 10 },
    tabs: { display: "flex", gap: "0.5rem", padding: "1rem 1.5rem 0", position: "relative", zIndex: 10, overflowX: "auto" },
    tab: (active) => ({ flex: 1, minWidth: 80, padding: "0.7rem 0.5rem", background: active ? "linear-gradient(135deg, rgba(0,212,255,0.2), rgba(126,255,212,0.1))" : "rgba(255,255,255,0.03)", border: active ? "1px solid rgba(0,212,255,0.5)" : "1px solid rgba(255,255,255,0.06)", borderRadius: "12px", color: active ? "#00d4ff" : "#5a7a9a", cursor: "pointer", fontSize: "0.75rem", fontWeight: active ? 700 : 400, textAlign: "center", transition: "all 0.2s", whiteSpace: "nowrap" }),
    main: { padding: "1rem 1.5rem 2rem", position: "relative", zIndex: 10, maxWidth: 900, margin: "0 auto" },
    card: { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(0,212,255,0.1)", borderRadius: "16px", padding: "1.2rem", marginBottom: "1rem", backdropFilter: "blur(10px)" },
    chatBox: { height: "55vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: "1rem", paddingRight: "0.5rem" },
    userBubble: { alignSelf: "flex-end", background: "linear-gradient(135deg, rgba(0,212,255,0.2), rgba(126,255,212,0.1))", border: "1px solid rgba(0,212,255,0.3)", borderRadius: "16px 16px 4px 16px", padding: "0.8rem 1.2rem", maxWidth: "75%", fontSize: "0.9rem" },
    aiBubble: { alignSelf: "flex-start", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "4px 16px 16px 16px", padding: "0.8rem 1.2rem", maxWidth: "85%", fontSize: "0.9rem" },
    inputRow: { display: "flex", gap: "0.7rem", marginTop: "0.8rem" },
    input: { flex: 1, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(0,212,255,0.2)", borderRadius: "12px", padding: "0.8rem 1.2rem", color: "#e0f0ff", fontSize: "0.9rem", outline: "none" },
    btn: (color = "#00d4ff", secondary = false) => ({ padding: "0.8rem 1.4rem", background: secondary ? "transparent" : `linear-gradient(135deg, ${color}, ${color}aa)`, border: `1px solid ${color}55`, borderRadius: "12px", color: secondary ? color : "#020b18", fontWeight: 700, cursor: "pointer", fontSize: "0.85rem", transition: "all 0.2s", whiteSpace: "nowrap" }),
    textarea: { width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(0,212,255,0.2)", borderRadius: "12px", padding: "1rem", color: "#e0f0ff", fontSize: "0.9rem", outline: "none", resize: "vertical", minHeight: 100, boxSizing: "border-box" },
    resultBox: { background: "rgba(0,0,0,0.3)", border: "1px solid rgba(0,212,255,0.15)", borderRadius: "12px", padding: "1.2rem", marginTop: "1rem", maxHeight: "50vh", overflowY: "auto" },
    chipRow: { display: "flex", flexWrap: "wrap", gap: "0.5rem", marginTop: "0.8rem" },
    chip: { padding: "0.4rem 0.9rem", background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.2)", borderRadius: "20px", fontSize: "0.8rem", cursor: "pointer", color: "#7effd4", transition: "all 0.2s" },
    sectionTitle: { fontSize: "1rem", fontWeight: 700, color: "#7effd4", marginBottom: "0.8rem", display: "flex", alignItems: "center", gap: "0.5rem" },
    emergGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "0.8rem" },
    firstAidCard: (color) => ({ background: `${color}15`, border: `1px solid ${color}40`, borderRadius: "14px", padding: "1rem" }),
    pulse: { display: "inline-block", width: 8, height: 8, background: "#00ff7f", borderRadius: "50%", animation: "pulse 1.5s ease-in-out infinite" },
    loading: { display: "flex", gap: 4, alignItems: "center", padding: "0.8rem 1.2rem" },
    dot: (i) => ({ width: 6, height: 6, background: "#00d4ff", borderRadius: "50%", animation: `bounce 1s ${i * 0.2}s ease-in-out infinite alternate` }),
  };

  return (
    <div style={styles.app}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;700;900&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(0,212,255,0.3); border-radius: 2px; }
        @keyframes float { 0% { transform: translateY(0) scale(1); } 100% { transform: translateY(-20px) scale(1.2); } }
        @keyframes pulse { 0%,100% { opacity:1; transform:scale(1); } 50% { opacity:0.5; transform:scale(1.5); } }
        @keyframes bounce { from { transform:translateY(0); } to { transform:translateY(-8px); } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .msg-enter { animation: fadeIn 0.3s ease; }
        input::placeholder, textarea::placeholder { color: rgba(0,212,255,0.3); }
        button:hover { transform: translateY(-1px); box-shadow: 0 4px 20px rgba(0,212,255,0.2); }
        .chip:hover { background: rgba(0,212,255,0.2) !important; transform: scale(1.05); }
      `}</style>

      {/* Background */}
      <div style={styles.grid} />
      {particles.map((p) => <div key={p.id} style={styles.particle(p)} />)}
      <div style={{ position: "fixed", top: "20%", left: "10%", width: 300, height: 300, background: "radial-gradient(circle, rgba(0,212,255,0.04) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", bottom: "20%", right: "10%", width: 400, height: 400, background: "radial-gradient(circle, rgba(126,255,212,0.03) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

      {/* Header */}
      <div style={styles.header}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.7rem" }}>
          <span style={{ fontSize: "2rem" }}>🩺</span>
          <div style={styles.logo}>MedAI</div>
          <span style={{ ...styles.pulse, marginTop: 4 }} />
        </div>
        <div style={styles.subtitle}>Intelligent Health Assistant · Powered by AI</div>
      </div>

      {/* Health Tip Bar */}
      <div style={styles.tipBar}>{healthTip}</div>

      {/* Tabs */}
      <div style={styles.tabs}>
        {TABS.map((t) => (
          <button key={t.id} style={styles.tab(activeTab === t.id)} onClick={() => setActiveTab(t.id)}>
            <div style={{ fontSize: "1.2rem" }}>{t.icon}</div>
            <div>{t.label}</div>
          </button>
        ))}
      </div>

      <div style={styles.main}>
        {/* CHAT TAB */}
        {activeTab === "chat" && (
          <div style={styles.card}>
            <div style={styles.sectionTitle}>
              <span>💬</span> Chat with AI Doctor
              <span style={{ marginLeft: "auto", fontSize: "0.75rem", color: "#5a7a9a" }}>claude-3.5-sonnet</span>
            </div>
            <div style={styles.chatBox}>
              {chatMessages.map((m, i) => (
                <div key={i} className="msg-enter" style={m.role === "user" ? styles.userBubble : styles.aiBubble}>
                  {m.role === "assistant" && m.content === "" ? (
                    <div style={styles.loading}>
                      {[0,1,2].map(j => <div key={j} style={styles.dot(j)} />)}
                    </div>
                  ) : m.role === "user" ? (
                    <span>{m.content}</span>
                  ) : (
                    <MarkdownRenderer text={m.content} />
                  )}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div style={styles.inputRow}>
              <input
                style={styles.input}
                placeholder="Koi bhi health sawaal puchiye... (Hindi/English)"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendChat()}
              />
              <button style={styles.btn()} onClick={sendChat} disabled={isLoading}>
                {isLoading ? "..." : "Send ➤"}
              </button>
            </div>
            <div style={styles.chipRow}>
              {["Fever aur headache", "Blood pressure kya hai?", "Diabetes symptoms", "Back pain relief", "Cold and cough"].map(q => (
                <span key={q} className="chip" style={styles.chip} onClick={() => { setChatInput(q); }}>
                  {q}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* SYMPTOM TAB */}
        {activeTab === "symptom" && (
          <div>
            <div style={styles.card}>
              <div style={styles.sectionTitle}><span>🔬</span> AI Symptom Analyzer</div>
              <p style={{ color: "#5a7a9a", fontSize: "0.82rem", marginBottom: "1rem" }}>
                Apne symptoms type karein ya camera se photo len — AI analyze karega
              </p>

              {/* Camera Section */}
              {showCamera ? (
                <div style={{ textAlign: "center", marginBottom: "1rem" }}>
                  <video ref={videoRef} autoPlay style={{ width: "100%", maxWidth: 400, borderRadius: 12, border: "1px solid rgba(0,212,255,0.3)" }} />
                  <div style={{ display: "flex", gap: "0.7rem", justifyContent: "center", marginTop: "0.7rem" }}>
                    <button style={styles.btn("#00ff7f")} onClick={capturePhoto}>📸 Capture</button>
                    <button style={styles.btn("#ff4757", true)} onClick={stopCamera}>✕ Cancel</button>
                  </div>
                </div>
              ) : capturedImage ? (
                <div style={{ marginBottom: "1rem", textAlign: "center" }}>
                  <img src={capturedImage} alt="captured" style={{ maxWidth: "100%", maxHeight: 200, borderRadius: 12, border: "1px solid rgba(0,212,255,0.3)" }} />
                  <div style={{ marginTop: "0.5rem" }}>
                    <button style={{ ...styles.btn("#ff4757", true), padding: "0.4rem 0.8rem", fontSize: "0.75rem" }} onClick={() => setCapturedImage(null)}>
                      🗑️ Remove Image
                    </button>
                  </div>
                </div>
              ) : (
                <button style={{ ...styles.btn("#7effd4", true), marginBottom: "1rem", width: "100%", padding: "0.7rem" }} onClick={startCamera}>
                  📷 Camera se Symptom Photo len
                </button>
              )}

              <textarea
                style={styles.textarea}
                placeholder="Symptoms describe karein... e.g. 'Kal se bukhaar hai, sar dard, aur body mein dard ho raha hai'"
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
              />
              <div style={styles.chipRow}>
                {QUICK_SYMPTOMS.map((s) => (
                  <span key={s} className="chip" style={styles.chip}
                    onClick={() => setSymptoms((prev) => prev ? `${prev}, ${s}` : s)}>
                    + {s}
                  </span>
                ))}
              </div>
              <button style={{ ...styles.btn("#7effd4"), marginTop: "1rem", width: "100%" }}
                onClick={analyzeSymptoms} disabled={isLoading}>
                {isLoading ? "🔬 Analyzing..." : "🔍 Analyze Symptoms"}
              </button>
            </div>

            {(symptomResult || isLoading) && (
              <div style={styles.card}>
                <div style={styles.sectionTitle}><span>📋</span> Analysis Result</div>
                <div style={styles.resultBox}>
                  {isLoading && !symptomResult ? (
                    <div style={styles.loading}>{[0,1,2].map(j => <div key={j} style={styles.dot(j)} />)}</div>
                  ) : (
                    <MarkdownRenderer text={symptomResult} />
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* DRUG SEARCH TAB */}
        {activeTab === "drug" && (
          <div>
            <div style={styles.card}>
              <div style={styles.sectionTitle}><span>💊</span> Drug & Medicine Database</div>
              <p style={{ color: "#5a7a9a", fontSize: "0.82rem", marginBottom: "1rem" }}>
                Kisi bhi davayi ke baare mein puri jaankari le
              </p>
              <div style={styles.inputRow}>
                <input
                  style={styles.input}
                  placeholder="Medicine name... e.g. Paracetamol, Metformin, Aspirin"
                  value={drugQuery}
                  onChange={(e) => setDrugQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchDrug()}
                />
                <button style={styles.btn("#ffd700")} onClick={searchDrug} disabled={isLoading}>
                  {isLoading ? "..." : "🔍 Search"}
                </button>
              </div>
              <div style={styles.chipRow}>
                {["Paracetamol", "Ibuprofen", "Metformin", "Aspirin", "Omeprazole", "Amoxicillin"].map(d => (
                  <span key={d} className="chip" style={styles.chip} onClick={() => { setDrugQuery(d); }}>
                    {d}
                  </span>
                ))}
              </div>
            </div>

            {(drugResult || isLoading) && (
              <div style={styles.card}>
                <div style={styles.sectionTitle}><span>💊</span> {drugQuery} — Drug Info</div>
                <div style={styles.resultBox}>
                  {isLoading && !drugResult ? (
                    <div style={styles.loading}>{[0,1,2].map(j => <div key={j} style={styles.dot(j)} />)}</div>
                  ) : (
                    <MarkdownRenderer text={drugResult} />
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* EMERGENCY TAB */}
        {activeTab === "emergency" && (
          <div>
            {/* Emergency Numbers */}
            <div style={styles.card}>
              <div style={styles.sectionTitle}><span>🚨</span> Emergency Numbers</div>
              <div style={styles.emergGrid}>
                {EMERGENCY_NUMBERS.map((e) => (
                  <div key={e.country} style={{ background: "rgba(255,71,87,0.08)", border: "1px solid rgba(255,71,87,0.25)", borderRadius: 12, padding: "1rem" }}>
                    <div style={{ fontWeight: 700, marginBottom: "0.5rem", color: "#ff4757" }}>{e.country}</div>
                    {[["🚔 Police", e.police], ["🚑 Ambulance", e.ambulance], ["🔥 Fire", e.fire], ["👩 Women Helpline", e.women]].map(([label, num]) => (
                      <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", marginBottom: "0.3rem" }}>
                        <span style={{ color: "#8a9ab0" }}>{label}</span>
                        <a href={`tel:${num.split("/")[0]}`} style={{ color: "#ffd700", fontWeight: 700, textDecoration: "none" }}>{num}</a>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* First Aid */}
            <div style={styles.card}>
              <div style={styles.sectionTitle}><span>🏥</span> First Aid Quick Guide</div>
              <div style={styles.emergGrid}>
                {FIRST_AID.map((fa) => (
                  <div key={fa.title} style={styles.firstAidCard(fa.color)}>
                    <div style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>{fa.icon}</div>
                    <div style={{ fontWeight: 700, color: fa.color, marginBottom: "0.7rem" }}>{fa.title}</div>
                    {fa.steps.map((s, i) => (
                      <div key={i} style={{ display: "flex", gap: "0.5rem", fontSize: "0.8rem", marginBottom: "0.3rem", color: "#c0d8f0" }}>
                        <span style={{ color: fa.color, fontWeight: 700, minWidth: 16 }}>{i + 1}.</span>
                        <span>{s}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Disclaimer */}
            <div style={{ ...styles.card, borderColor: "rgba(255,165,0,0.3)", background: "rgba(255,165,0,0.05)", textAlign: "center", fontSize: "0.82rem", color: "#ffaa44" }}>
              ⚠️ <strong>Disclaimer:</strong> MedAI is for informational purposes only. Always consult a qualified healthcare professional for medical advice, diagnosis, or treatment. In emergency, call 108 immediately.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}