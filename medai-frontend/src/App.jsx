import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
const MODEL = "stepfun/step-3.5-flash";

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
      "X-OpenRouter-Title": "MedAI Health Assistant",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      max_tokens: 1000,
      temperature: 0.3,
      stream: true,
    }),
  });
  if (!res.ok) { const err = await res.text(); throw new Error(err); }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "", full = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (data === "[DONE]") return full;
      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) { full += delta; onStream(full); }
      } catch (err) { console.error("Parse error:", err); }
    }
  }
  return full;
}

const TABS = [
  { id: "chat", icon: "💬", label: "AI Doctor" },
  { id: "symptom", icon: "🔬", label: "Symptom AI" },
  { id: "drug", icon: "💊", label: "Drug Search" },
  { id: "doctors", icon: "🏥", label: "Find Doctors" },
  { id: "emergency", icon: "🚨", label: "Emergency" },
];
const DOCTOR_TABS = [
  { id: "profiles", icon: "👥", label: "All Profiles" },
  { id: "profile", icon: "👨‍⚕️", label: "My Profile" },
  { id: "credentials", icon: "🎓", label: "Credentials" },
  { id: "schedule", icon: "📅", label: "Schedule" },
  { id: "patients", icon: "🩺", label: "Patients" },
];
const QUICK_SYMPTOMS = ["Headache","Fever","Chest Pain","Nausea","Fatigue","Cough","Joint Pain","Rash"];
const EMERGENCY_NUMBERS = [
  { country:"🇮🇳 India", police:"100", ambulance:"108", fire:"101", women:"1091" },
  { country:"🌍 International", police:"911/999", ambulance:"112", fire:"112", women:"varies" },
];
const FIRST_AID = [
  { title:"Heart Attack", icon:"❤️", color:"#ff4757", steps:["Call ambulance immediately (108)","Loosen tight clothing","Give aspirin if not allergic","Start CPR if unconscious","Keep calm, don't move patient"] },
  { title:"Choking", icon:"🫁", color:"#ff6b35", steps:["Encourage coughing","5 back blows between shoulder blades","5 abdominal thrusts (Heimlich)","Repeat until object dislodges","Call 108 if unconscious"] },
  { title:"Severe Burns", icon:"🔥", color:"#ffa502", steps:["Cool with running water 20min","Don't use ice or butter","Cover with clean cloth","Don't pop blisters","Seek immediate medical help"] },
  { title:"Stroke", icon:"🧠", color:"#5352ed", steps:["FAST: Face drooping?","Arm weakness?","Speech difficulty?","Time to call 108!","Note exact time of symptoms"] },
];
const SPECIALIZATIONS = ["General Physician","Cardiologist","Neurologist","Dermatologist","Orthopedist","Gynecologist","Pediatrician","Psychiatrist","Oncologist","Endocrinologist","Gastroenterologist","Pulmonologist","Nephrologist","Ophthalmologist","ENT Specialist","Urologist"];
const DEGREES = ["MBBS","MD","MS","DNB","DM","MCh","BDS","MDS","BHMS","BAMS","PhD (Medicine)","FRCS","MRCP","FACC"];

const BLANK_DOCTOR_PROFILE = () => ({
  fullName:"",phone:"",email:"",city:"",hospital:"",specialization:"",degree:"",university:"",
  passingYear:"",gpa:"",regNumber:"",experience:"",consultFee:"",bio:"",
  availability:{mon:false,tue:false,wed:false,thu:false,fri:false,sat:false,sun:false},
  timeSlots:"9:00 AM - 1:00 PM",
  _id: Date.now().toString(),
});

const SAMPLE_PATIENTS = [
  { id:1,name:"Ramesh Kumar",age:45,issue:"Hypertension follow-up",date:"Today, 10:00 AM",status:"upcoming" },
  { id:2,name:"Priya Sharma",age:32,issue:"Diabetes management",date:"Today, 11:30 AM",status:"upcoming" },
  { id:3,name:"Anjali Singh",age:28,issue:"Thyroid checkup",date:"Yesterday",status:"completed" },
  { id:4,name:"Mohan Patel",age:60,issue:"Chest pain evaluation",date:"Yesterday",status:"completed" },
];

// ── localStorage helpers ──────────────────────────────────────────────────────
function lsGet(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function lsSet(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
function lsDel(key) {
  try { localStorage.removeItem(key); } catch {}
}

// ── Doctor Registry helpers ───────────────────────────────────────────────────
function getDoctorsRegistry() {
  return lsGet("medai_doctors_registry") || [];
}
function saveDoctorToRegistry(profile) {
  if (!profile || !profile.fullName) return;
  const registry = getDoctorsRegistry();
  const key = profile._id || profile.email || profile.fullName;
  const idx = registry.findIndex(d => (d._id || d.email || d.fullName) === key);
  const entry = { ...profile, _savedAt: new Date().toISOString() };
  if (idx >= 0) registry[idx] = entry;
  else registry.push(entry);
  lsSet("medai_doctors_registry", registry);
}
function deleteDoctorFromRegistry(profileId) {
  const registry = getDoctorsRegistry();
  const updated = registry.filter(d => d._id !== profileId);
  lsSet("medai_doctors_registry", updated);
}

// ── Get all doctor profiles saved by current user ────────────────────────────
function getUserDoctorProfiles() {
  return lsGet("medai_my_doctor_profiles") || [];
}
function saveUserDoctorProfiles(profiles) {
  lsSet("medai_my_doctor_profiles", profiles);
}

// ── Animated Live ECG Canvas ──────────────────────────────────────────────────
function ECGLine() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width = canvas.offsetWidth * window.devicePixelRatio;
    const H = canvas.height = 60 * window.devicePixelRatio;
    canvas.style.width = "100%"; canvas.style.height = "60px";
    const ecg = [];
    for (let i = 0; i < W * 2; i++) {
      const p = i % 140;
      let y = 0;
      if (p < 8) y = Math.sin(p/8*Math.PI)*2;
      else if (p===22) y = -20;
      else if (p===24) y = 34;
      else if (p===26) y = -12;
      else if (p>=32&&p<44) y = Math.sin((p-32)/12*Math.PI)*6;
      ecg.push(y);
    }
    let offset = 0;
    const animate = () => {
      ctx.clearRect(0,0,W,H);
      const grad = ctx.createLinearGradient(0,0,W,0);
      grad.addColorStop(0,"rgba(0,212,255,0)");
      grad.addColorStop(0.2,"rgba(0,212,255,0.5)");
      grad.addColorStop(0.6,"rgba(126,255,212,0.7)");
      grad.addColorStop(0.88,"rgba(0,212,255,0.6)");
      grad.addColorStop(1,"rgba(0,212,255,0)");
      ctx.beginPath();
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2.5 * window.devicePixelRatio;
      ctx.shadowColor = "#00d4ff";
      ctx.shadowBlur = 10;
      for (let i=0;i<W;i++) {
        const y = H/2 - ecg[(i+offset)%ecg.length] * window.devicePixelRatio;
        i===0 ? ctx.moveTo(i,y) : ctx.lineTo(i,y);
      }
      ctx.stroke();
      const hy = H/2 - ecg[(W-1+offset)%ecg.length]*window.devicePixelRatio;
      ctx.beginPath();
      ctx.arc(W-1, hy, 5*window.devicePixelRatio, 0, Math.PI*2);
      ctx.fillStyle = "#00ff7f";
      ctx.shadowColor = "#00ff7f";
      ctx.shadowBlur = 20;
      ctx.fill();
      offset=(offset+1.5|0);
      requestAnimationFrame(animate);
    };
    animate();
  }, []);
  return <canvas ref={canvasRef} />;
}

// ── DNA Helix ─────────────────────────────────────────────────────────────────
function DNAHelix() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const resize = () => { canvas.width=window.innerWidth; canvas.height=window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);
    let t = 0;
    const draw = () => {
      ctx.clearRect(0,0,canvas.width,canvas.height);
      const cx = canvas.width*0.88, pairs=20, spacing=30, amp=45;
      for (let i=0;i<pairs;i++) {
        const y = canvas.height*0.2 + i*spacing;
        const ph = t + i*0.36;
        const x1 = cx+Math.sin(ph)*amp, x2 = cx-Math.sin(ph)*amp;
        const a = 0.04+Math.abs(Math.sin(ph))*0.05;
        ctx.beginPath(); ctx.arc(x1,y,3.5,0,Math.PI*2);
        ctx.fillStyle=`rgba(0,212,255,${a})`; ctx.fill();
        ctx.beginPath(); ctx.arc(x2,y,3.5,0,Math.PI*2);
        ctx.fillStyle=`rgba(126,255,212,${a})`; ctx.fill();
        if(i%3===0){
          ctx.beginPath(); ctx.moveTo(x1,y); ctx.lineTo(x2,y);
          ctx.strokeStyle=`rgba(0,212,255,${a*0.6})`; ctx.lineWidth=1; ctx.stroke();
        }
      }
      t+=0.016; requestAnimationFrame(draw);
    };
    draw();
    return () => window.removeEventListener("resize", resize);
  }, []);
  return <canvas ref={canvasRef} style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,opacity:.8}} />;
}

// ── Neural Net ────────────────────────────────────────────────────────────────
function NeuralNet() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const resize=()=>{canvas.width=window.innerWidth;canvas.height=window.innerHeight;};
    resize(); window.addEventListener("resize",resize);
    const nodes = Array.from({length:32},()=>({
      x:Math.random()*window.innerWidth*0.65,
      y:Math.random()*window.innerHeight,
      vx:(Math.random()-.5)*0.28, vy:(Math.random()-.5)*0.28,
      r:Math.random()*1.8+0.8,
    }));
    const draw=()=>{
      ctx.clearRect(0,0,canvas.width,canvas.height);
      nodes.forEach(n=>{
        n.x+=n.vx; n.y+=n.vy;
        if(n.x<0||n.x>canvas.width*0.68)n.vx*=-1;
        if(n.y<0||n.y>canvas.height)n.vy*=-1;
      });
      for(let i=0;i<nodes.length;i++){
        for(let j=i+1;j<nodes.length;j++){
          const dx=nodes[i].x-nodes[j].x,dy=nodes[i].y-nodes[j].y;
          const d=Math.sqrt(dx*dx+dy*dy);
          if(d<150){
            ctx.beginPath();ctx.moveTo(nodes[i].x,nodes[i].y);ctx.lineTo(nodes[j].x,nodes[j].y);
            ctx.strokeStyle=`rgba(0,212,255,${(1-d/150)*0.055})`;ctx.lineWidth=1;ctx.stroke();
          }
        }
      }
      nodes.forEach(n=>{
        ctx.beginPath();ctx.arc(n.x,n.y,n.r,0,Math.PI*2);
        ctx.fillStyle="rgba(0,212,255,0.14)";
        ctx.shadowColor="#00d4ff";ctx.shadowBlur=5;ctx.fill();
      });
      requestAnimationFrame(draw);
    };
    draw();
    return()=>window.removeEventListener("resize",resize);
  },[]);
  return <canvas ref={canvasRef} style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0}} />;
}

// ── Ripple Button ─────────────────────────────────────────────────────────────
function RippleBtn({style,onClick,children,disabled,...props}) {
  const [ripples,setRipples]=useState([]);
  const handleClick=useCallback((e)=>{
    if(disabled)return;
    const rect=e.currentTarget.getBoundingClientRect();
    const id=Date.now();
    setRipples(r=>[...r,{id,x:e.clientX-rect.left,y:e.clientY-rect.top}]);
    setTimeout(()=>setRipples(r=>r.filter(rr=>rr.id!==id)),700);
    onClick?.(e);
  },[onClick,disabled]);
  return (
    <button {...props} disabled={disabled} style={{...style,position:"relative",overflow:"hidden",opacity:disabled?0.6:1}}
      onClick={handleClick}>
      {ripples.map(r=>(
        <span key={r.id} style={{position:"absolute",left:r.x-15,top:r.y-15,width:30,height:30,
          borderRadius:"50%",background:"rgba(255,255,255,0.28)",
          animation:"rippleOut 0.7s ease-out forwards",pointerEvents:"none"}} />
      ))}
      {children}
    </button>
  );
}

// ── Glitch Logo ───────────────────────────────────────────────────────────────
function GlitchLogo() {
  return (
    <div style={{position:"relative",display:"inline-block"}}>
      <span style={{fontSize:"2.5rem",fontWeight:900,
        background:"linear-gradient(135deg,#00d4ff 0%,#7effd4 50%,#00d4ff 100%)",
        backgroundSize:"200% auto",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",
        letterSpacing:"-0.04em",animation:"shimmer 3s linear infinite"}} className="glitch-base">
        MedAI
      </span>
      <span aria-hidden style={{position:"absolute",top:0,left:"-2px",fontSize:"2.5rem",fontWeight:900,
        color:"#00fff7",letterSpacing:"-0.04em",opacity:0,
        animation:"glitch1 6s infinite steps(1)",clipPath:"inset(0 0 100% 0)",WebkitTextFillColor:"#00fff7"}}>
        MedAI
      </span>
      <span aria-hidden style={{position:"absolute",top:0,left:"2px",fontSize:"2.5rem",fontWeight:900,
        color:"#ff0070",letterSpacing:"-0.04em",opacity:0,
        animation:"glitch2 6s infinite steps(1) 0.5s",clipPath:"inset(0 0 100% 0)",WebkitTextFillColor:"#ff0070"}}>
        MedAI
      </span>
    </div>
  );
}

// ── Typewriter ────────────────────────────────────────────────────────────────
function Typewriter({text,speed=40}) {
  const [d,setD]=useState("");
  useEffect(()=>{
    setD(""); let i=0;
    const t=setInterval(()=>{setD(text.slice(0,++i));if(i>=text.length)clearInterval(t);},speed);
    return()=>clearInterval(t);
  },[text]);
  return <span>{d}<span className="cursor-blink">▮</span></span>;
}

// ── HoloCard ──────────────────────────────────────────────────────────────────
function HoloCard({children,style,docMode=false}) {
  const [tilt,setTilt]=useState({x:0,y:0});
  const [hov,setHov]=useState(false);
  return (
    <div
      onMouseMove={e=>{
        const r=e.currentTarget.getBoundingClientRect();
        setTilt({x:((e.clientX-r.left-r.width/2)/r.width)*7,y:((e.clientY-r.top-r.height/2)/r.height)*-7});
      }}
      onMouseEnter={()=>setHov(true)}
      onMouseLeave={()=>{setTilt({x:0,y:0});setHov(false);}}
      style={{
        ...style,
        background:docMode?"rgba(126,255,212,0.03)":"rgba(255,255,255,0.03)",
        border:docMode?`1px solid rgba(126,255,212,${hov?.28:.11})`:`1px solid rgba(0,212,255,${hov?.28:.11})`,
        borderRadius:18,padding:"1.2rem",marginBottom:"1rem",backdropFilter:"blur(16px)",
        transform:`perspective(900px) rotateX(${tilt.y}deg) rotateY(${tilt.x}deg) ${hov?"scale(1.008)":"scale(1)"}`,
        transition:hov?"transform 0.1s":"transform 0.45s cubic-bezier(0.16,1,0.3,1)",
        boxShadow:hov?(docMode?"0 12px 50px rgba(126,255,212,0.08),inset 0 1px 0 rgba(126,255,212,0.12)":"0 12px 50px rgba(0,212,255,0.08),inset 0 1px 0 rgba(0,212,255,0.12)"):"0 4px 24px rgba(0,0,0,0.35)",
        position:"relative",overflow:"hidden",
      }}
    >
      {hov&&<div style={{position:"absolute",inset:0,
        background:`radial-gradient(circle at ${50+tilt.x*4}% ${50-tilt.y*4}%, ${docMode?"rgba(126,255,212,0.055)":"rgba(0,212,255,0.055)"} 0%, transparent 55%)`,
        pointerEvents:"none",zIndex:0,transition:"all 0.1s"}} />}
      <div style={{position:"relative",zIndex:1}}>{children}</div>
    </div>
  );
}

// ── Animated Stat Counter ─────────────────────────────────────────────────────
function AnimCounter({value}) {
  const [d,setD]=useState(0);
  useEffect(()=>{
    const n=parseFloat(value)||0; let cur=0; const step=n/40;
    const t=setInterval(()=>{cur+=step;if(cur>=n){setD(n);clearInterval(t);}else setD(Math.round(cur*10)/10);},18);
    return()=>clearInterval(t);
  },[value]);
  return <span>{d}</span>;
}

// ── Scan Line ─────────────────────────────────────────────────────────────────
function ScanLine() {
  return <div style={{position:"fixed",top:0,left:0,right:0,height:2,
    background:"linear-gradient(90deg,transparent,rgba(0,212,255,0.55),rgba(126,255,212,0.4),transparent)",
    animation:"scanDown 5s linear infinite",zIndex:2,pointerEvents:"none"}} />;
}

// ── Floating Particles for Auth Pages ────────────────────────────────────────
function AuthParticles() {
  const canvasRef = useRef(null);
  useEffect(()=>{
    const canvas = canvasRef.current;
    if(!canvas) return;
    const ctx = canvas.getContext("2d");
    const resize=()=>{ canvas.width=window.innerWidth; canvas.height=window.innerHeight; };
    resize();
    window.addEventListener("resize",resize);
    const pts = Array.from({length:50},()=>({
      x:Math.random()*window.innerWidth,
      y:Math.random()*window.innerHeight,
      vx:(Math.random()-.5)*0.4, vy:(Math.random()-.5)*0.4,
      size:Math.random()*2+0.5,
      hue: Math.random()>0.5?185:165,
    }));
    const draw=()=>{
      ctx.clearRect(0,0,canvas.width,canvas.height);
      pts.forEach(p=>{
        p.x+=p.vx; p.y+=p.vy;
        if(p.x<0||p.x>canvas.width) p.vx*=-1;
        if(p.y<0||p.y>canvas.height) p.vy*=-1;
        ctx.beginPath();
        ctx.arc(p.x,p.y,p.size,0,Math.PI*2);
        ctx.fillStyle=`hsla(${p.hue},100%,65%,0.18)`;
        ctx.shadowColor=`hsl(${p.hue},100%,65%)`;
        ctx.shadowBlur=8;
        ctx.fill();
      });
      for(let i=0;i<pts.length;i++){
        for(let j=i+1;j<pts.length;j++){
          const dx=pts[i].x-pts[j].x, dy=pts[i].y-pts[j].y;
          const d=Math.sqrt(dx*dx+dy*dy);
          if(d<100){
            ctx.beginPath(); ctx.moveTo(pts[i].x,pts[i].y); ctx.lineTo(pts[j].x,pts[j].y);
            ctx.strokeStyle=`rgba(0,212,255,${(1-d/100)*0.06})`;
            ctx.lineWidth=1; ctx.stroke();
          }
        }
      }
      requestAnimationFrame(draw);
    };
    draw();
    return()=>window.removeEventListener("resize",resize);
  },[]);
  return <canvas ref={canvasRef} style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0}} />;
}

// ── Doctor Profile Card (User Mode) ──────────────────────────────────────────
function DoctorCard({ doctor, index }) {
  const [expanded, setExpanded] = useState(false);
  const availDays = doctor.availability
    ? Object.entries(doctor.availability).filter(([,v])=>v).map(([d])=>d.charAt(0).toUpperCase()+d.slice(1))
    : [];

  const specColors = {
    "Cardiologist":"#ff4757","Neurologist":"#5352ed","Dermatologist":"#ff6b81",
    "Orthopedist":"#ffa502","General Physician":"#00d4ff","Pediatrician":"#2ed573",
    "Psychiatrist":"#a29bfe","Gynecologist":"#fd79a8","Oncologist":"#e17055",
  };
  const accentColor = specColors[doctor.specialization] || "#00d4ff";

  return (
    <div style={{
      background:"rgba(255,255,255,0.025)",
      border:`1px solid ${accentColor}28`,
      borderRadius:18,padding:"1.2rem",marginBottom:"1rem",backdropFilter:"blur(16px)",
      transition:"all .3s cubic-bezier(.16,1,.3,1)",
      boxShadow:`0 4px 28px rgba(0,0,0,0.35)`,
      animation:`fadeUp .4s ease ${index*0.07}s both`,
      position:"relative",overflow:"hidden",
    }}
    onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-3px)";e.currentTarget.style.boxShadow=`0 12px 42px ${accentColor}18`;e.currentTarget.style.borderColor=`${accentColor}55`;}}
    onMouseLeave={e=>{e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow="0 4px 28px rgba(0,0,0,0.35)";e.currentTarget.style.borderColor=`${accentColor}28`;}}>

      <div style={{position:"absolute",top:0,left:0,width:80,height:80,
        background:`radial-gradient(circle,${accentColor}18 0%,transparent 70%)`,pointerEvents:"none"}} />

      <div style={{display:"flex",gap:"1rem",alignItems:"flex-start",position:"relative",zIndex:1}}>
        <div style={{
          width:54,height:54,borderRadius:"50%",flexShrink:0,
          background:`linear-gradient(135deg,${accentColor}28,${accentColor}10)`,
          border:`2px solid ${accentColor}40`,
          display:"flex",alignItems:"center",justifyContent:"center",
          fontSize:"1.4rem",boxShadow:`0 0 18px ${accentColor}22`
        }}>
          {doctor.fullName ? doctor.fullName.charAt(0).toUpperCase() : "👨‍⚕️"}
        </div>

        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:".5rem",flexWrap:"wrap"}}>
            <div style={{fontWeight:800,fontSize:"1rem",color:"#ddeeff"}}>
              Dr. {doctor.fullName}
            </div>
            {doctor.degree && (
              <span style={{fontSize:".7rem",padding:".18rem .55rem",background:`${accentColor}14`,border:`1px solid ${accentColor}35`,borderRadius:20,color:accentColor,fontWeight:700}}>
                {doctor.degree}
              </span>
            )}
            {doctor.regNumber && (
              <span style={{fontSize:".68rem",padding:".15rem .5rem",background:"rgba(0,255,127,.08)",border:"1px solid rgba(0,255,127,.22)",borderRadius:20,color:"#00ff7f",fontWeight:700}}>
                ✓ Verified
              </span>
            )}
          </div>

          <div style={{color:accentColor,fontWeight:700,fontSize:".84rem",marginTop:".12rem"}}>
            {doctor.specialization || "General Physician"}
          </div>

          <div style={{display:"flex",gap:".85rem",marginTop:".35rem",flexWrap:"wrap"}}>
            {doctor.hospital && (
              <span style={{color:"#2a4a62",fontSize:".78rem"}}>🏥 {doctor.hospital}</span>
            )}
            {doctor.city && (
              <span style={{color:"#2a4a62",fontSize:".78rem"}}>📍 {doctor.city}</span>
            )}
            {doctor.experience && (
              <span style={{color:"#2a4a62",fontSize:".78rem"}}>⏱ {doctor.experience} yrs exp</span>
            )}
          </div>
        </div>

        <div style={{textAlign:"right",flexShrink:0}}>
          {doctor.consultFee && (
            <div style={{fontWeight:900,fontSize:"1.1rem",color:"#ffd700",letterSpacing:"-.02em"}}>
              ₹{doctor.consultFee}
            </div>
          )}
          {doctor.consultFee && (
            <div style={{fontSize:".65rem",color:"#2a4a62"}}>per consult</div>
          )}
          <RippleBtn
            style={{marginTop:".5rem",padding:".32rem .75rem",background:"transparent",
              border:`1px solid ${accentColor}38`,borderRadius:10,color:accentColor,
              cursor:"pointer",fontWeight:700,fontSize:".72rem",fontFamily:"'DM Sans',sans-serif"}}
            onClick={()=>setExpanded(e=>!e)}>
            {expanded ? "▲ Less" : "▼ More"}
          </RippleBtn>
        </div>
      </div>

      <div style={{display:"flex",gap:".6rem",marginTop:".9rem",flexWrap:"wrap",position:"relative",zIndex:1}}>
        {[
          availDays.length > 0 && {label:"Available",value:availDays.slice(0,3).join(", ")+(availDays.length>3?" +more":""),color:"#00ff7f"},
          doctor.timeSlots && {label:"Hours",value:doctor.timeSlots,color:"#00d4ff"},
          doctor.gpa && {label:"Academic Score",value:doctor.gpa,color:"#ffd700"},
        ].filter(Boolean).map((stat,i)=>(
          <div key={i} style={{
            padding:".38rem .8rem",background:`${stat.color}08`,
            border:`1px solid ${stat.color}22`,borderRadius:10,
            fontSize:".74rem",
          }}>
            <span style={{color:"#2a4a62"}}>{stat.label}: </span>
            <span style={{color:stat.color,fontWeight:700}}>{stat.value}</span>
          </div>
        ))}
      </div>

      {expanded && (
        <div style={{marginTop:"1rem",paddingTop:"1rem",borderTop:`1px solid ${accentColor}18`,position:"relative",zIndex:1,animation:"fadeUp .25s ease"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:".7rem",marginBottom:".8rem"}}>
            {[
              doctor.university && ["🏛️ University", doctor.university],
              doctor.passingYear && ["📅 Passed", doctor.passingYear],
              doctor.regNumber && ["📋 Reg. No.", doctor.regNumber],
              doctor.email && ["📧 Email", doctor.email],
              doctor.phone && ["📞 Phone", doctor.phone],
            ].filter(Boolean).map(([label,value],i)=>(
              <div key={i} style={{padding:".6rem .9rem",background:"rgba(0,0,0,.25)",border:"1px solid rgba(255,255,255,.06)",borderRadius:10}}>
                <div style={{fontSize:".68rem",color:"#2a4a62",marginBottom:".2rem"}}>{label}</div>
                <div style={{fontSize:".82rem",color:"#ddeeff",fontWeight:600,wordBreak:"break-all"}}>{value}</div>
              </div>
            ))}
          </div>

          {doctor.bio && (
            <div style={{padding:".8rem 1rem",background:`${accentColor}06`,border:`1px solid ${accentColor}18`,borderRadius:12}}>
              <div style={{fontSize:".68rem",color:"#2a4a62",marginBottom:".3rem",textTransform:"uppercase",letterSpacing:".07em"}}>About</div>
              <div style={{fontSize:".83rem",color:"rgba(221,238,255,.72)",lineHeight:1.6}}>{doctor.bio}</div>
            </div>
          )}

          {availDays.length > 0 && (
            <div style={{marginTop:".8rem"}}>
              <div style={{fontSize:".68rem",color:"#2a4a62",marginBottom:".38rem",textTransform:"uppercase",letterSpacing:".07em"}}>Full Availability</div>
              <div style={{display:"flex",gap:".38rem",flexWrap:"wrap"}}>
                {Object.entries(doctor.availability||{}).map(([day,active])=>(
                  <span key={day} style={{
                    padding:".28rem .65rem",borderRadius:8,fontSize:".74rem",fontWeight:active?700:400,
                    background:active?`${accentColor}15`:"rgba(255,255,255,.03)",
                    border:active?`1px solid ${accentColor}38`:"1px solid rgba(255,255,255,.06)",
                    color:active?accentColor:"#2a4a62",
                  }}>{day.charAt(0).toUpperCase()+day.slice(1)}</span>
                ))}
              </div>
            </div>
          )}

          <div style={{marginTop:"1rem",display:"flex",gap:".7rem"}}>
            {doctor.phone && (
              <a href={`tel:${doctor.phone}`} style={{flex:1,padding:".65rem",background:`${accentColor}12`,border:`1px solid ${accentColor}32`,borderRadius:12,color:accentColor,fontWeight:700,fontSize:".8rem",textDecoration:"none",textAlign:"center",display:"block",transition:"all .2s"}}
              onMouseEnter={e=>{e.target.style.background=`${accentColor}22`;}}
              onMouseLeave={e=>{e.target.style.background=`${accentColor}12`;}}>
                📞 Call Now
              </a>
            )}
            {doctor.email && (
              <a href={`mailto:${doctor.email}`} style={{flex:1,padding:".65rem",background:"rgba(0,212,255,.08)",border:"1px solid rgba(0,212,255,.25)",borderRadius:12,color:"#00d4ff",fontWeight:700,fontSize:".8rem",textDecoration:"none",textAlign:"center",display:"block",transition:"all .2s"}}
              onMouseEnter={e=>{e.target.style.background="rgba(0,212,255,.16)";}}
              onMouseLeave={e=>{e.target.style.background="rgba(0,212,255,.08)";}}>
                ✉️ Email
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Find Doctors Panel ────────────────────────────────────────────────────────
function FindDoctorsPanel() {
  const [doctors, setDoctors] = useState([]);
  const [search, setSearch] = useState("");
  const [filterSpec, setFilterSpec] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setDoctors(getDoctorsRegistry());
  }, [refreshKey]);

  const filtered = doctors.filter(d => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      (d.fullName||"").toLowerCase().includes(q) ||
      (d.specialization||"").toLowerCase().includes(q) ||
      (d.hospital||"").toLowerCase().includes(q) ||
      (d.city||"").toLowerCase().includes(q);
    const matchSpec = !filterSpec || d.specialization === filterSpec;
    return matchSearch && matchSpec;
  });

  const specsInRegistry = [...new Set(doctors.map(d=>d.specialization).filter(Boolean))];

  return (
    <div>
      <HoloCard>
        <div style={{display:"flex",alignItems:"center",gap:".6rem",marginBottom:".85rem"}}>
          <span style={{fontSize:"1.2rem"}}>🏥</span>
          <div style={{fontWeight:800,fontSize:"1rem",color:"#7effd4"}}>Find Doctors</div>
          <span style={{marginLeft:"auto",padding:".2rem .65rem",background:"rgba(0,212,255,.1)",border:"1px solid rgba(0,212,255,.25)",borderRadius:20,fontSize:".72rem",color:"#00d4ff",fontWeight:700}}>
            {doctors.length} registered
          </span>
          <RippleBtn style={{padding:".28rem .65rem",background:"transparent",border:"1px solid rgba(0,212,255,.22)",borderRadius:8,color:"rgba(0,212,255,.6)",cursor:"pointer",fontSize:".72rem",fontWeight:700,fontFamily:"'DM Sans',sans-serif"}}
            onClick={()=>setRefreshKey(k=>k+1)}>↻ Refresh</RippleBtn>
        </div>

        <div style={{display:"flex",gap:".7rem",flexWrap:"wrap"}}>
          <input
            style={{flex:1,minWidth:160,background:"rgba(0,0,0,.32)",border:"1px solid rgba(0,212,255,.18)",borderRadius:12,padding:".72rem 1rem",color:"#ddeeff",fontSize:".88rem",outline:"none",backdropFilter:"blur(10px)",transition:"border-color .2s,box-shadow .2s",fontFamily:"'DM Sans','Segoe UI',sans-serif"}}
            placeholder="Search by name, hospital, city..."
            value={search} onChange={e=>setSearch(e.target.value)}
          />
          <select
            style={{background:"rgba(0,0,0,.3)",border:"1px solid rgba(0,212,255,.18)",borderRadius:12,padding:".72rem 1rem",color:filterSpec?"#ddeeff":"rgba(0,212,255,.35)",fontSize:".85rem",outline:"none",cursor:"pointer",fontFamily:"'DM Sans','Segoe UI',sans-serif",minWidth:160}}
            value={filterSpec} onChange={e=>setFilterSpec(e.target.value)}>
            <option value="">All Specializations</option>
            {specsInRegistry.map(s=><option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {(search||filterSpec) && (
          <div style={{marginTop:".6rem",display:"flex",gap:".5rem",alignItems:"center"}}>
            <span style={{fontSize:".78rem",color:"#2a4a62"}}>
              {filtered.length} result{filtered.length!==1?"s":""} found
            </span>
            <span style={{fontSize:".75rem",color:"rgba(0,212,255,.5)",cursor:"pointer"}} onClick={()=>{setSearch("");setFilterSpec("");}}>
              ✕ Clear filters
            </span>
          </div>
        )}
      </HoloCard>

      {doctors.length === 0 ? (
        <div style={{textAlign:"center",padding:"3rem 2rem",background:"rgba(255,255,255,.02)",border:"1px solid rgba(0,212,255,.1)",borderRadius:18,backdropFilter:"blur(12px)"}}>
          <div style={{fontSize:"3rem",marginBottom:"1rem",opacity:.5}}>🏥</div>
          <div style={{fontWeight:700,fontSize:".95rem",color:"rgba(221,238,255,.5)",marginBottom:".4rem"}}>No Doctors Registered Yet</div>
          <div style={{fontSize:".8rem",color:"rgba(0,212,255,.3)",lineHeight:1.6}}>
            Doctors need to register and save their profile in Doctor Mode.<br/>
            Once saved, their profiles will appear here for patients.
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{textAlign:"center",padding:"2.5rem",background:"rgba(255,255,255,.02)",border:"1px solid rgba(0,212,255,.1)",borderRadius:18,backdropFilter:"blur(12px)"}}>
          <div style={{fontSize:"2rem",marginBottom:".6rem",opacity:.5}}>🔍</div>
          <div style={{fontWeight:700,fontSize:".9rem",color:"rgba(221,238,255,.5)"}}>No doctors match your search</div>
          <div style={{fontSize:".78rem",color:"rgba(0,212,255,.3)",marginTop:".3rem"}}>Try different keywords or clear filters</div>
        </div>
      ) : (
        <div>
          {specsInRegistry.length > 1 && (
            <div style={{display:"flex",flexWrap:"wrap",gap:".45rem",marginBottom:"1rem"}}>
              {specsInRegistry.map(s=>(
                <span key={s} className="chip"
                  style={{padding:".32rem .78rem",background:filterSpec===s?"rgba(0,212,255,.18)":"rgba(0,212,255,.055)",border:filterSpec===s?"1px solid rgba(0,212,255,.5)":"1px solid rgba(0,212,255,.16)",borderRadius:20,fontSize:".75rem",cursor:"pointer",color:filterSpec===s?"#00d4ff":"#7effd4",transition:"all .2s",fontWeight:filterSpec===s?700:400}}
                  onClick={()=>setFilterSpec(filterSpec===s?"":s)}>{s}</span>
              ))}
            </div>
          )}
          {filtered.map((doc, i) => (
            <DoctorCard key={doc._id||doc.email||doc.fullName||i} doctor={doc} index={i} />
          ))}
        </div>
      )}

      <div style={{background:"rgba(255,165,0,.03)",border:"1px solid rgba(255,165,0,.15)",borderRadius:14,padding:".85rem 1rem",textAlign:"center",fontSize:".78rem",color:"rgba(255,170,68,.75)",backdropFilter:"blur(10px)",marginTop:".5rem"}}>
        ℹ️ Doctor profiles are self-registered. Always verify credentials independently before booking appointments.
      </div>
    </div>
  );
}

// ═══════════════════════ LOGIN PAGE ═══════════════════════════════════════════
function LoginPage({ onLogin, onGoSignup }) {
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");
  const [role,setRole]=useState("user");
  const [showPass,setShowPass]=useState(false);
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");
  const [mounted,setMounted]=useState(false);

  useEffect(()=>{ setTimeout(()=>setMounted(true),80); },[]);

  const handleLogin=(e)=>{
    e.preventDefault();
    setErr("");
    if(!email.trim()||!password.trim()){ setErr("Please fill in all fields."); return; }
    if(!/\S+@\S+\.\S+/.test(email)){ setErr("Enter a valid email address."); return; }
    if(password.length<6){ setErr("Password must be at least 6 characters."); return; }
    setLoading(true);
    setTimeout(()=>{ setLoading(false); onLogin(role); },1200);
  };

  const inputStyle={
    width:"100%",background:"rgba(0,0,0,.35)",border:"1px solid rgba(0,212,255,.18)",
    borderRadius:12,padding:".82rem 1.15rem",color:"#ddeeff",fontSize:".9rem",outline:"none",
    boxSizing:"border-box",backdropFilter:"blur(10px)",transition:"border-color .2s,box-shadow .2s",
    fontFamily:"'DM Sans','Segoe UI',sans-serif"
  };

  return (
    <div style={{minHeight:"100vh",background:"#010c17",display:"flex",alignItems:"center",justifyContent:"center",position:"relative",overflow:"hidden",fontFamily:"'DM Sans','Segoe UI',sans-serif"}}>
      <ScanLine/>
      <AuthParticles/>
      <div style={{position:"fixed",inset:0,backgroundImage:"linear-gradient(rgba(0,212,255,.022) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,.022) 1px,transparent 1px)",backgroundSize:"48px 48px",pointerEvents:"none",zIndex:0}} />
      <div style={{position:"fixed",top:"10%",left:"5%",width:500,height:500,background:"radial-gradient(circle,rgba(0,212,255,.04) 0%,transparent 65%)",pointerEvents:"none",zIndex:0,animation:"orbPulse 5s ease-in-out infinite"}} />
      <div style={{position:"fixed",bottom:"10%",right:"5%",width:400,height:400,background:"radial-gradient(circle,rgba(126,255,212,.03) 0%,transparent 65%)",pointerEvents:"none",zIndex:0,animation:"orbPulse 7s ease-in-out infinite 2s"}} />

      <div style={{
        position:"relative",zIndex:10,width:"100%",maxWidth:440,margin:"0 1.5rem",
        opacity:mounted?1:0, transform:mounted?"translateY(0) scale(1)":"translateY(28px) scale(0.97)",
        transition:"all .75s cubic-bezier(.16,1,.3,1)"
      }}>
        <div style={{textAlign:"center",marginBottom:"2rem"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:".65rem",marginBottom:".4rem"}}>
            <span style={{fontSize:"2rem",animation:"floatLogo 3.5s ease-in-out infinite"}}>🩺</span>
            <GlitchLogo/>
            <span style={{width:8,height:8,background:"#00ff7f",borderRadius:"50%",display:"inline-block",animation:"pulseRing 1.6s ease-in-out infinite"}}/>
          </div>
          <div style={{color:"rgba(0,212,255,.5)",fontSize:".7rem",letterSpacing:".28em",textTransform:"uppercase"}}>Intelligent Health Assistant</div>
        </div>

        <div style={{background:"rgba(255,255,255,.025)",border:"1px solid rgba(0,212,255,.14)",borderRadius:24,padding:"2rem",backdropFilter:"blur(24px)",boxShadow:"0 24px 80px rgba(0,0,0,.5),inset 0 1px 0 rgba(0,212,255,.08)"}}>
          <h2 style={{margin:"0 0 .3rem",fontSize:"1.5rem",fontWeight:800,color:"#ddeeff",letterSpacing:"-.03em"}}>Welcome back</h2>
          <p style={{margin:"0 0 1.6rem",color:"rgba(0,212,255,.4)",fontSize:".83rem"}}>Sign in to your MedAI account</p>

          <div style={{display:"flex",background:"rgba(0,0,0,.3)",border:"1px solid rgba(0,212,255,.12)",borderRadius:50,padding:3,marginBottom:"1.4rem"}}>
            {[["user","👤 User"],["doctor","👨‍⚕️ Doctor"]].map(([r,label])=>(
              <button key={r} onClick={()=>setRole(r)} style={{flex:1,padding:".52rem",borderRadius:50,border:"none",cursor:"pointer",fontWeight:700,fontSize:".8rem",fontFamily:"'DM Sans','Segoe UI',sans-serif",background:role===r?"linear-gradient(135deg,rgba(0,212,255,.22),rgba(126,255,212,.12))":"transparent",color:role===r?"#00d4ff":"rgba(180,210,240,.38)",border:role===r?"1px solid rgba(0,212,255,.32)":"1px solid transparent",transition:"all .25s cubic-bezier(.16,1,.3,1)"}}>{label}</button>
            ))}
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:".9rem"}}>
            <div>
              <div style={{fontSize:".7rem",color:"rgba(0,212,255,.55)",marginBottom:".3rem",letterSpacing:".08em",textTransform:"uppercase",fontWeight:600}}>Email Address</div>
              <input style={inputStyle} type="email" placeholder="your@email.com" value={email} onChange={e=>{setEmail(e.target.value);setErr("");}} />
            </div>
            <div>
              <div style={{fontSize:".7rem",color:"rgba(0,212,255,.55)",marginBottom:".3rem",letterSpacing:".08em",textTransform:"uppercase",fontWeight:600}}>Password</div>
              <div style={{position:"relative"}}>
                <input style={{...inputStyle,paddingRight:"3rem"}} type={showPass?"text":"password"} placeholder="••••••••" value={password} onChange={e=>{setPassword(e.target.value);setErr("");}} onKeyDown={e=>e.key==="Enter"&&handleLogin(e)} />
                <button onClick={()=>setShowPass(s=>!s)} style={{position:"absolute",right:"1rem",top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"rgba(0,212,255,.5)",fontSize:"1rem",padding:0}}>
                  {showPass?"🙈":"👁"}
                </button>
              </div>
            </div>
          </div>

          {err&&<div style={{marginTop:".8rem",padding:".62rem 1rem",background:"rgba(255,71,87,.08)",border:"1px solid rgba(255,71,87,.25)",borderRadius:10,color:"#ff6b7a",fontSize:".8rem"}}>{err}</div>}

          <div style={{textAlign:"right",marginTop:".6rem"}}>
            <span style={{fontSize:".78rem",color:"rgba(0,212,255,.45)",cursor:"pointer",transition:"color .2s"}}
              onMouseEnter={e=>e.target.style.color="rgba(0,212,255,.85)"}
              onMouseLeave={e=>e.target.style.color="rgba(0,212,255,.45)"}>Forgot password?</span>
          </div>

          <RippleBtn
            style={{marginTop:"1.2rem",width:"100%",padding:".92rem",background:loading?"rgba(0,212,255,.1)":"linear-gradient(135deg,#00d4ff,#00b8e0)",border:"1px solid rgba(0,212,255,.35)",borderRadius:14,color:"#010c17",fontWeight:800,cursor:"pointer",fontSize:".9rem",boxShadow:"0 4px 28px rgba(0,212,255,.3)",transition:"all .3s",letterSpacing:"-.01em"}}
            onClick={handleLogin} disabled={loading}>
            {loading?(
              <span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:".5rem"}}>
                <span style={{display:"flex",gap:4}}>{[0,1,2].map(j=><span key={j} style={{width:6,height:6,background:"rgba(0,212,255,.6)",borderRadius:"50%",display:"inline-block",animation:`bounceDot 1s ${j*.15}s ease-in-out infinite alternate`}}/>)}</span>
                Signing in...
              </span>
            ):"Sign In →"}
          </RippleBtn>

          <div style={{marginTop:"1.4rem",textAlign:"center",fontSize:".83rem",color:"rgba(180,210,240,.38)"}}>
            Don't have an account?{" "}
            <span onClick={onGoSignup} style={{color:"#7effd4",fontWeight:700,cursor:"pointer",transition:"opacity .2s"}}
              onMouseEnter={e=>e.target.style.opacity=".7"}
              onMouseLeave={e=>e.target.style.opacity="1"}>
              Create account
            </span>
          </div>
        </div>

        <div style={{textAlign:"center",marginTop:"1.2rem",fontSize:".73rem",color:"rgba(0,212,255,.22)",letterSpacing:".05em"}}>
          🔒 Secured with end-to-end encryption
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════ SIGNUP PAGE ══════════════════════════════════════════
function SignupPage({ onSignup, onGoLogin }) {
  const [form,setForm]=useState({name:"",email:"",password:"",confirm:"",role:"user"});
  const [showPass,setShowPass]=useState(false);
  const [loading,setLoading]=useState(false);
  const [err,setErr]=useState("");
  const [step,setStep]=useState(1);
  const [mounted,setMounted]=useState(false);

  useEffect(()=>{ setTimeout(()=>setMounted(true),80); },[]);

  const set=(f,v)=>{ setForm(p=>({...p,[f]:v})); setErr(""); };

  const handleNext=()=>{
    if(!form.name.trim()){ setErr("Please enter your full name."); return; }
    if(!form.email.trim()||!/\S+@\S+\.\S+/.test(form.email)){ setErr("Enter a valid email."); return; }
    setErr(""); setStep(2);
  };

  const handleSignup=(e)=>{
    e.preventDefault(); setErr("");
    if(!form.password||form.password.length<6){ setErr("Password must be at least 6 characters."); return; }
    if(form.password!==form.confirm){ setErr("Passwords do not match."); return; }
    setLoading(true);
    setTimeout(()=>{ setLoading(false); onSignup(form.role); },1400);
  };

  const inputStyle={
    width:"100%",background:"rgba(0,0,0,.35)",border:"1px solid rgba(0,212,255,.18)",
    borderRadius:12,padding:".82rem 1.15rem",color:"#ddeeff",fontSize:".9rem",outline:"none",
    boxSizing:"border-box",backdropFilter:"blur(10px)",transition:"border-color .2s,box-shadow .2s",
    fontFamily:"'DM Sans','Segoe UI',sans-serif"
  };

  return (
    <div style={{minHeight:"100vh",background:"#010c17",display:"flex",alignItems:"center",justifyContent:"center",position:"relative",overflow:"hidden",fontFamily:"'DM Sans','Segoe UI',sans-serif"}}>
      <ScanLine/>
      <AuthParticles/>
      <div style={{position:"fixed",inset:0,backgroundImage:"linear-gradient(rgba(0,212,255,.022) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,.022) 1px,transparent 1px)",backgroundSize:"48px 48px",pointerEvents:"none",zIndex:0}} />
      <div style={{position:"fixed",top:"15%",right:"8%",width:450,height:450,background:"radial-gradient(circle,rgba(126,255,212,.04) 0%,transparent 65%)",pointerEvents:"none",zIndex:0,animation:"orbPulse 6s ease-in-out infinite"}} />
      <div style={{position:"fixed",bottom:"15%",left:"5%",width:350,height:350,background:"radial-gradient(circle,rgba(0,212,255,.03) 0%,transparent 65%)",pointerEvents:"none",zIndex:0,animation:"orbPulse 8s ease-in-out infinite 3s"}} />

      <div style={{
        position:"relative",zIndex:10,width:"100%",maxWidth:460,margin:"0 1.5rem",
        opacity:mounted?1:0,transform:mounted?"translateY(0) scale(1)":"translateY(28px) scale(0.97)",
        transition:"all .75s cubic-bezier(.16,1,.3,1)"
      }}>
        <div style={{textAlign:"center",marginBottom:"1.8rem"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:".65rem",marginBottom:".4rem"}}>
            <span style={{fontSize:"2rem",animation:"floatLogo 3.5s ease-in-out infinite"}}>🩺</span>
            <GlitchLogo/>
            <span style={{width:8,height:8,background:"#00ff7f",borderRadius:"50%",display:"inline-block",animation:"pulseRing 1.6s ease-in-out infinite"}}/>
          </div>
          <div style={{color:"rgba(0,212,255,.5)",fontSize:".7rem",letterSpacing:".28em",textTransform:"uppercase"}}>Join MedAI Today</div>
        </div>

        <div style={{background:"rgba(255,255,255,.025)",border:"1px solid rgba(0,212,255,.14)",borderRadius:24,padding:"2rem",backdropFilter:"blur(24px)",boxShadow:"0 24px 80px rgba(0,0,0,.5),inset 0 1px 0 rgba(0,212,255,.08)"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"1.6rem"}}>
            <div>
              <h2 style={{margin:"0 0 .2rem",fontSize:"1.4rem",fontWeight:800,color:"#ddeeff",letterSpacing:"-.03em"}}>Create Account</h2>
              <p style={{margin:0,color:"rgba(0,212,255,.4)",fontSize:".8rem"}}>Step {step} of 2 — {step===1?"Your details":"Set password"}</p>
            </div>
            <div style={{display:"flex",gap:6,alignItems:"center"}}>
              {[1,2].map(s=>(
                <div key={s} style={{width:s===step?28:8,height:8,borderRadius:4,background:s<=step?"linear-gradient(90deg,#00d4ff,#7effd4)":"rgba(0,212,255,.15)",transition:"all .35s cubic-bezier(.16,1,.3,1)",boxShadow:s===step?"0 0 12px rgba(0,212,255,.5)":"none"}}/>
              ))}
            </div>
          </div>

          {step===1?(
            <div style={{animation:"fadeUp .3s ease"}}>
              <div style={{marginBottom:"1.2rem"}}>
                <div style={{fontSize:".7rem",color:"rgba(0,212,255,.55)",marginBottom:".4rem",letterSpacing:".08em",textTransform:"uppercase",fontWeight:600}}>I am a</div>
                <div style={{display:"flex",background:"rgba(0,0,0,.3)",border:"1px solid rgba(0,212,255,.12)",borderRadius:50,padding:3}}>
                  {[["user","👤 Patient / User"],["doctor","👨‍⚕️ Healthcare Professional"]].map(([r,label])=>(
                    <button key={r} onClick={()=>set("role",r)} style={{flex:1,padding:".52rem .4rem",borderRadius:50,border:"none",cursor:"pointer",fontWeight:700,fontSize:".76rem",fontFamily:"'DM Sans','Segoe UI',sans-serif",background:form.role===r?"linear-gradient(135deg,rgba(0,212,255,.22),rgba(126,255,212,.12))":"transparent",color:form.role===r?"#00d4ff":"rgba(180,210,240,.38)",border:form.role===r?"1px solid rgba(0,212,255,.32)":"1px solid transparent",transition:"all .25s cubic-bezier(.16,1,.3,1)"}}>{label}</button>
                  ))}
                </div>
              </div>

              <div style={{display:"flex",flexDirection:"column",gap:".9rem"}}>
                <div>
                  <div style={{fontSize:".7rem",color:"rgba(0,212,255,.55)",marginBottom:".3rem",letterSpacing:".08em",textTransform:"uppercase",fontWeight:600}}>Full Name</div>
                  <input style={inputStyle} type="text" placeholder={form.role==="doctor"?"Dr. Full Name":"Your Full Name"} value={form.name} onChange={e=>set("name",e.target.value)} />
                </div>
                <div>
                  <div style={{fontSize:".7rem",color:"rgba(0,212,255,.55)",marginBottom:".3rem",letterSpacing:".08em",textTransform:"uppercase",fontWeight:600}}>Email Address</div>
                  <input style={inputStyle} type="email" placeholder="your@email.com" value={form.email} onChange={e=>set("email",e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleNext()} />
                </div>
              </div>

              {err&&<div style={{marginTop:".8rem",padding:".62rem 1rem",background:"rgba(255,71,87,.08)",border:"1px solid rgba(255,71,87,.25)",borderRadius:10,color:"#ff6b7a",fontSize:".8rem"}}>{err}</div>}

              <RippleBtn style={{marginTop:"1.2rem",width:"100%",padding:".92rem",background:"linear-gradient(135deg,#00d4ff,#00b8e0)",border:"1px solid rgba(0,212,255,.35)",borderRadius:14,color:"#010c17",fontWeight:800,cursor:"pointer",fontSize:".9rem",boxShadow:"0 4px 28px rgba(0,212,255,.3)",letterSpacing:"-.01em"}} onClick={handleNext}>
                Continue →
              </RippleBtn>
            </div>
          ):(
            <div style={{animation:"fadeUp .3s ease"}}>
              <div style={{padding:".75rem 1rem",background:"rgba(0,212,255,.06)",border:"1px solid rgba(0,212,255,.12)",borderRadius:12,marginBottom:"1.2rem",display:"flex",gap:".7rem",alignItems:"center"}}>
                <div style={{width:38,height:38,borderRadius:"50%",background:"rgba(0,212,255,.12)",border:"1px solid rgba(0,212,255,.2)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1rem",flexShrink:0}}>
                  {form.role==="doctor"?"👨‍⚕️":"👤"}
                </div>
                <div>
                  <div style={{fontWeight:700,fontSize:".88rem",color:"#ddeeff"}}>{form.name||"—"}</div>
                  <div style={{fontSize:".75rem",color:"rgba(0,212,255,.5)"}}>{form.email} · {form.role==="doctor"?"Doctor":"User"}</div>
                </div>
                <button onClick={()=>{setStep(1);setErr("");}} style={{marginLeft:"auto",background:"none",border:"none",cursor:"pointer",color:"rgba(0,212,255,.45)",fontSize:".75rem",fontWeight:700,fontFamily:"'DM Sans',sans-serif"}}>Edit</button>
              </div>

              <div style={{display:"flex",flexDirection:"column",gap:".9rem"}}>
                <div>
                  <div style={{fontSize:".7rem",color:"rgba(0,212,255,.55)",marginBottom:".3rem",letterSpacing:".08em",textTransform:"uppercase",fontWeight:600}}>Password</div>
                  <div style={{position:"relative"}}>
                    <input style={{...inputStyle,paddingRight:"3rem"}} type={showPass?"text":"password"} placeholder="Min. 6 characters" value={form.password} onChange={e=>set("password",e.target.value)} />
                    <button onClick={()=>setShowPass(s=>!s)} style={{position:"absolute",right:"1rem",top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"rgba(0,212,255,.5)",fontSize:"1rem",padding:0}}>
                      {showPass?"🙈":"👁"}
                    </button>
                  </div>
                  {form.password&&(
                    <div style={{marginTop:".4rem",display:"flex",gap:3}}>
                      {[1,2,3,4].map(i=>(
                        <div key={i} style={{flex:1,height:3,borderRadius:2,transition:"background .3s",background:form.password.length>=(i*3)?(i<=1?"#ff4757":i<=2?"#ffa502":i<=3?"#00d4ff":"#00ff7f"):"rgba(255,255,255,.08)"}} />
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <div style={{fontSize:".7rem",color:"rgba(0,212,255,.55)",marginBottom:".3rem",letterSpacing:".08em",textTransform:"uppercase",fontWeight:600}}>Confirm Password</div>
                  <input style={{...inputStyle,borderColor:form.confirm&&form.confirm!==form.password?"rgba(255,71,87,.4)":undefined}} type={showPass?"text":"password"} placeholder="Re-enter password" value={form.confirm} onChange={e=>set("confirm",e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleSignup(e)} />
                </div>
              </div>

              {err&&<div style={{marginTop:".8rem",padding:".62rem 1rem",background:"rgba(255,71,87,.08)",border:"1px solid rgba(255,71,87,.25)",borderRadius:10,color:"#ff6b7a",fontSize:".8rem"}}>{err}</div>}

              <div style={{marginTop:".9rem",fontSize:".75rem",color:"rgba(180,210,240,.3)",lineHeight:1.5}}>
                By creating an account, you agree to our{" "}
                <span style={{color:"rgba(0,212,255,.6)",cursor:"pointer"}}>Terms of Service</span>
                {" "}and{" "}
                <span style={{color:"rgba(0,212,255,.6)",cursor:"pointer"}}>Privacy Policy</span>.
              </div>

              <RippleBtn
                style={{marginTop:"1.1rem",width:"100%",padding:".92rem",background:loading?"rgba(126,255,212,.1)":"linear-gradient(135deg,#7effd4,#5ce8b5)",border:"1px solid rgba(126,255,212,.35)",borderRadius:14,color:"#010c17",fontWeight:800,cursor:"pointer",fontSize:".9rem",boxShadow:"0 4px 28px rgba(126,255,212,.25)",letterSpacing:"-.01em"}}
                onClick={handleSignup} disabled={loading}>
                {loading?(
                  <span style={{display:"flex",alignItems:"center",justifyContent:"center",gap:".5rem"}}>
                    <span style={{display:"flex",gap:4}}>{[0,1,2].map(j=><span key={j} style={{width:6,height:6,background:"rgba(0,0,0,.4)",borderRadius:"50%",display:"inline-block",animation:`bounceDot 1s ${j*.15}s ease-in-out infinite alternate`}}/>)}</span>
                    Creating account...
                  </span>
                ):"Create Account ✓"}
              </RippleBtn>
            </div>
          )}

          <div style={{marginTop:"1.4rem",textAlign:"center",fontSize:".83rem",color:"rgba(180,210,240,.38)"}}>
            Already have an account?{" "}
            <span onClick={onGoLogin} style={{color:"#00d4ff",fontWeight:700,cursor:"pointer",transition:"opacity .2s"}}
              onMouseEnter={e=>e.target.style.opacity=".7"}
              onMouseLeave={e=>e.target.style.opacity="1"}>
              Sign in
            </span>
          </div>
        </div>

        <div style={{textAlign:"center",marginTop:"1.2rem",fontSize:".73rem",color:"rgba(0,212,255,.22)",letterSpacing:".05em"}}>
          🔒 Your data is private and encrypted
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════ MAIN APP ═════════════════════════════════════════════
export default function MedAI() {
  const savedUser = lsGet("medai_user");
  const [authPage,setAuthPage]=useState(savedUser ? null : "login");
  const [currentUser,setCurrentUser]=useState(savedUser || null);

  const handleLogin=(role)=>{
    const u={role};
    lsSet("medai_user", u);
    setCurrentUser(u);
    setAuthPage(null);
  };
  const handleSignup=(role)=>{
    const u={role};
    lsSet("medai_user", u);
    setCurrentUser(u);
    setAuthPage(null);
  };
  const handleLogout=()=>{
    lsDel("medai_user");
    setCurrentUser(null);
    setAuthPage("login");
  };

  if(authPage==="login") return <LoginPage onLogin={handleLogin} onGoSignup={()=>setAuthPage("signup")}/>;
  if(authPage==="signup") return <SignupPage onSignup={handleSignup} onGoLogin={()=>setAuthPage("login")}/>;

  return <AppMain currentUser={currentUser} onLogout={handleLogout}/>;
}

// ═══════════════════════ APP MAIN (after login) ═══════════════════════════════
function AppMain({ currentUser, onLogout }) {
  const [appMode,setAppMode]=useState(currentUser?.role==="doctor"?"doctor":"user");
  const [activeTab,setActiveTab]=useState("chat");
  const [activeDoctorTab,setActiveDoctorTab]=useState("profiles");
  const [mounted,setMounted]=useState(false);
  const [transitioning,setTransitioning]=useState(false);

  // ── Chat state ──
  const [chatMessages,setChatMessages]=useState([
    {role:"assistant",content:"🩺 **Namaste! I'm MedAI — your personal health assistant.**\n\nAap mujhse kisi bhi health topic ke baare mein puch sakte hain:\n\n▸ Symptoms aur bimariyan\n▸ Davaiyaan aur unke side effects\n▸ Health tips aur preventive care\n▸ First aid guidance\n\n**Kya jaanna chahte hain aaj?** 😊"},
  ]);
  const [chatInput,setChatInput]=useState("");
  const [isLoading,setIsLoading]=useState(false);

  // ── Symptom state (camera removed) ──
  const [symptoms,setSymptoms]=useState("");
  const [symptomResult,setSymptomResult]=useState("");
  const [symptomLoading,setSymptomLoading]=useState(false);

  // ── Drug state ──
  const [drugQuery,setDrugQuery]=useState("");
  const [drugResult,setDrugResult]=useState("");
  const [drugLoading,setDrugLoading]=useState(false);

  const [healthTip]=useState("💡 Drink at least 8 glasses of water daily. Proper hydration improves energy, skin health, and cognitive function.");

  // ── Multi-profile doctor state ──
  const [myProfiles, setMyProfiles] = useState(() => {
    const saved = getUserDoctorProfiles();
    return saved.length > 0 ? saved : [];
  });
  const [activeProfileIdx, setActiveProfileIdx] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [saveMsg,setSaveMsg]=useState("");

  // Current profile being edited
  const currentProfile = myProfiles[activeProfileIdx] || null;

  const chatEndRef=useRef(null);

  useEffect(()=>{setTimeout(()=>setMounted(true),80);},[]);
  useEffect(()=>{chatEndRef.current?.scrollIntoView({behavior:"smooth"});},[chatMessages]);

  const switchMode=m=>{
    setTransitioning(true);
    setTimeout(()=>{
      setAppMode(m);
      m==="user"?setActiveTab("chat"):setActiveDoctorTab("profiles");
      setTransitioning(false);
    },280);
  };

  // ── Doctor profile actions ──
  const addNewProfile = () => {
    const newP = BLANK_DOCTOR_PROFILE();
    const updated = [...myProfiles, newP];
    setMyProfiles(updated);
    saveUserDoctorProfiles(updated);
    setActiveProfileIdx(updated.length - 1);
    setEditMode(true);
    setActiveDoctorTab("profile");
  };

  const deleteProfile = (idx) => {
    const prof = myProfiles[idx];
    if (prof?._id) deleteDoctorFromRegistry(prof._id);
    const updated = myProfiles.filter((_,i)=>i!==idx);
    setMyProfiles(updated);
    saveUserDoctorProfiles(updated);
    setActiveProfileIdx(Math.max(0, idx-1));
    if(updated.length === 0) setActiveDoctorTab("profiles");
  };

  const handleProfileChange=(field,value)=>{
    const updated = myProfiles.map((p,i)=>i===activeProfileIdx?{...p,[field]:value}:p);
    setMyProfiles(updated);
  };

  const handleAvail=(day)=>{
    const updated = myProfiles.map((p,i)=>i===activeProfileIdx?{...p,availability:{...p.availability,[day]:!p.availability[day]}}:p);
    setMyProfiles(updated);
  };

  const saveCurrentProfile=()=>{
    const prof = myProfiles[activeProfileIdx];
    if(!prof) return;
    saveUserDoctorProfiles(myProfiles);
    saveDoctorToRegistry(prof);
    setEditMode(false);
    setSaveMsg("✅ Profile saved & published to Find Doctors!");
    setTimeout(()=>setSaveMsg(""),3500);
  };

  const saveCredentials=()=>{
    const prof = myProfiles[activeProfileIdx];
    if(!prof) return;
    saveUserDoctorProfiles(myProfiles);
    saveDoctorToRegistry(prof);
    setSaveMsg("✅ Credentials verified & saved!");
    setTimeout(()=>setSaveMsg(""),3000);
  };

  const saveSchedule=()=>{
    const prof = myProfiles[activeProfileIdx];
    if(!prof) return;
    saveUserDoctorProfiles(myProfiles);
    saveDoctorToRegistry(prof);
    setSaveMsg("✅ Schedule saved & synced to Find Doctors!");
    setTimeout(()=>setSaveMsg(""),3000);
  };

  // ── Chat ──
  const sendChat=async()=>{
    if(!chatInput.trim()||isLoading)return;
    const userMsg={role:"user",content:chatInput};
    const msgs=[...chatMessages,userMsg];
    setChatMessages(msgs);setChatInput("");setIsLoading(true);
    setChatMessages([...msgs,{role:"assistant",content:""}]);
    try{
      await callAI(
        msgs.map(m=>({role:m.role,content:m.content})),
        MEDICAL_SYSTEM,
        t=>setChatMessages(prev=>[...prev.slice(0,-1),{role:"assistant",content:t}])
      );
    }catch(e){
      setChatMessages(prev=>[...prev.slice(0,-1),{role:"assistant",content:"❌ Error: "+e.message}]);
    }
    setIsLoading(false);
  };

  const analyzeSymptoms=async()=>{
    const trimmed=symptoms.trim();
    if(!trimmed)return;
    setSymptomLoading(true);
    setSymptomResult("");
    try{
      await callAI(
        [{role:"user",content:`Please analyze the following symptoms and provide a detailed medical assessment:\n\nSymptoms: ${trimmed}`}],
        SYMPTOM_SYSTEM,
        t=>setSymptomResult(t)
      );
    }catch(e){
      setSymptomResult("❌ Error: "+e.message+"\n\nPlease check your API key or try again.");
    }
    setSymptomLoading(false);
  };

  const searchDrug=async()=>{
    if(!drugQuery.trim())return;
    setDrugLoading(true);setDrugResult("");
    try{
      await callAI([{role:"user",content:`Tell me about: ${drugQuery}`}],DRUG_SYSTEM,t=>setDrugResult(t));
    }catch(e){setDrugResult("❌ Error: "+e.message);}
    setDrugLoading(false);
  };

  const badge=c=>({display:"inline-block",padding:"0.22rem 0.65rem",background:`${c}18`,border:`1px solid ${c}45`,borderRadius:20,fontSize:"0.73rem",color:c,fontWeight:700});
  const panelAnim={opacity:transitioning?0:1,transform:transitioning?"translateY(14px) scale(0.985)":"translateY(0) scale(1)",transition:"opacity 0.28s ease,transform 0.28s ease"};

  const docInputStyle={background:"rgba(0,0,0,.25)",border:"1px solid rgba(126,255,212,.16)",borderRadius:12,padding:".78rem 1.1rem",color:"#ddeeff",fontSize:".88rem",outline:"none",width:"100%",boxSizing:"border-box",transition:"border-color .2s,box-shadow .2s",fontFamily:"'DM Sans','Segoe UI',sans-serif"};

  return (
    <div style={{minHeight:"100vh",background:"#010c17",color:"#ddeeff",fontFamily:"'DM Sans','Segoe UI',sans-serif",position:"relative",overflow:"hidden"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;700;900&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px;}
        ::-webkit-scrollbar-thumb{background:rgba(0,212,255,0.22);border-radius:2px;}
        ::-webkit-scrollbar-thumb:hover{background:rgba(0,212,255,0.45);}
        @keyframes shimmer{0%{background-position:0% 50%}100%{background-position:200% 50%}}
        @keyframes scanDown{0%{top:-2px;opacity:0}5%{opacity:1}95%{opacity:1}100%{top:100vh;opacity:0}}
        @keyframes rippleOut{from{transform:scale(1);opacity:.5}to{transform:scale(7);opacity:0}}
        @keyframes bubbleIn{from{opacity:0;transform:scale(.82) translateY(12px)}to{opacity:1;transform:scale(1) translateY(0)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
        @keyframes bounceDot{from{transform:translateY(0) scale(1)}to{transform:translateY(-11px) scale(.78)}}
        @keyframes pulseRing{0%,100%{box-shadow:0 0 0 0 rgba(0,255,127,.5);transform:scale(1)}50%{box-shadow:0 0 0 10px rgba(0,255,127,0);transform:scale(1.4)}}
        @keyframes floatLogo{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
        @keyframes progressBar{from{width:0}to{width:100%}}
        @keyframes toastSlide{from{opacity:0;transform:translateX(-50%) translateY(22px) scale(.92)}to{opacity:1;transform:translateX(-50%) translateY(0) scale(1)}}
        @keyframes orbPulse{0%,100%{opacity:.35}50%{opacity:.75}}
        @keyframes glitch1{0%,89%,100%{opacity:0;clip-path:inset(0 0 100% 0)}90%{opacity:.7;clip-path:inset(12% 0 65% 0)}93%{clip-path:inset(55% 0 22% 0)}96%{clip-path:inset(75% 0 5% 0)}99%{opacity:0;clip-path:inset(0 0 100% 0)}}
        @keyframes glitch2{0%,79%,100%{opacity:0;clip-path:inset(0 0 100% 0)}80%{opacity:.6;clip-path:inset(45% 0 30% 0)}84%{clip-path:inset(18% 0 60% 0)}88%{clip-path:inset(70% 0 8% 0)}92%{opacity:0}}
        @keyframes cursor-flash{0%,100%{opacity:1}50%{opacity:0}}
        .cursor-blink{animation:cursor-flash 1s steps(1) infinite;color:rgba(0,212,255,.6);font-size:.85em;}
        input::placeholder,textarea::placeholder{color:rgba(0,212,255,.2);}
        select option{background:#030f1e;color:#ddeeff;}
        .ripple-btn{cursor:pointer;}
        .ripple-btn:hover{transform:translateY(-2px) scale(1.02);filter:brightness(1.12);}
        .ripple-btn:active{transform:translateY(0) scale(.97);}
        .tab-btn:hover{background:rgba(0,212,255,.07)!important;color:#00d4ff!important;transform:translateY(-2px)!important;}
        .doc-tab-btn:hover{background:rgba(126,255,212,.07)!important;color:#7effd4!important;transform:translateY(-2px)!important;}
        .chip:hover{background:rgba(0,212,255,.15)!important;border-color:rgba(0,212,255,.4)!important;transform:translateY(-2px) scale(1.06)!important;box-shadow:0 4px 14px rgba(0,212,255,.14)!important;}
        .patient-row:hover{transform:translateX(5px);border-color:rgba(0,212,255,.28)!important;}
        .fa-card:hover{transform:translateY(-4px);box-shadow:0 10px 35px rgba(0,0,0,.35)!important;}
        .stat-box:hover{transform:scale(1.05);}
        .day-btn:hover{transform:scale(1.07);}
        input:focus,textarea:focus,select:focus{border-color:rgba(0,212,255,.48)!important;box-shadow:0 0 0 3px rgba(0,212,255,.07),0 0 22px rgba(0,212,255,.1)!important;}
        .doc-input:focus{border-color:rgba(126,255,212,.42)!important;box-shadow:0 0 0 3px rgba(126,255,212,.06)!important;}
        .panel{animation:fadeUp .42s cubic-bezier(.16,1,.3,1);}
        .msg-anim{animation:bubbleIn .32s cubic-bezier(.16,1,.3,1);}
        .prose-md h2{color:#7effd4;margin:1rem 0 .4rem;font-size:.95rem;}
        .prose-md h3{color:#00d4ff;margin:.8rem 0 .3rem;font-size:.88rem;}
        .prose-md ul{padding-left:1.2rem;margin:.3rem 0;}
        .prose-md li{margin:.22rem 0;line-height:1.5;}
        .prose-md p{margin:.35rem 0;line-height:1.6;}
        .prose-md strong{color:#ddeeff;}
        .profile-pill{cursor:pointer;transition:all .2s;}
        .profile-pill:hover{background:rgba(126,255,212,.1)!important;border-color:rgba(126,255,212,.4)!important;}
      `}</style>

      <div style={{position:"fixed",inset:0,backgroundImage:"linear-gradient(rgba(0,212,255,.022) 1px,transparent 1px),linear-gradient(90deg,rgba(0,212,255,.022) 1px,transparent 1px)",backgroundSize:"48px 48px",pointerEvents:"none",zIndex:0}} />
      <NeuralNet/>
      <DNAHelix/>
      <ScanLine/>

      {[["15%","4%",500,"rgba(0,212,255,.032)","orbPulse 5s ease-in-out infinite"],
        ["8%","55%",400,"rgba(0,212,255,.02)","orbPulse 7s ease-in-out infinite 2s"],
        ["10%","85%",350,"rgba(126,255,212,.02)","orbPulse 6s ease-in-out infinite 1s"]].map(([t,l,s,c,a],i)=>(
        <div key={i} style={{position:"fixed",top:t,left:l,width:s,height:s,background:`radial-gradient(circle,${c} 0%,transparent 65%)`,pointerEvents:"none",zIndex:0,animation:a}} />
      ))}

      {/* ── HEADER ── */}
      <div style={{position:"relative",zIndex:10,padding:"1.8rem 2rem 0",textAlign:"center",opacity:mounted?1:0,transform:mounted?"translateY(0)":"translateY(-28px)",transition:"all .75s cubic-bezier(.16,1,.3,1)"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:".75rem"}}>
          <span style={{fontSize:"2rem",animation:"floatLogo 3.5s ease-in-out infinite"}}>🩺</span>
          <GlitchLogo/>
          <span style={{display:"inline-block",width:8,height:8,background:"#00ff7f",borderRadius:"50%",animation:"pulseRing 1.6s ease-in-out infinite",marginTop:2}} />
          <button onClick={onLogout} style={{position:"absolute",right:"1.5rem",top:0,background:"rgba(255,71,87,.06)",border:"1px solid rgba(255,71,87,.2)",borderRadius:10,padding:".38rem .85rem",color:"rgba(255,71,87,.7)",fontSize:".75rem",fontWeight:700,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",transition:"all .2s"}}
          onMouseEnter={e=>{e.target.style.background="rgba(255,71,87,.12)";e.target.style.color="#ff4757";}}
          onMouseLeave={e=>{e.target.style.background="rgba(255,71,87,.06)";e.target.style.color="rgba(255,71,87,.7)";}}>
            ⎋ Logout
          </button>
        </div>
        <div style={{color:"rgba(0,212,255,.5)",fontSize:".72rem",letterSpacing:".28em",textTransform:"uppercase",marginTop:".25rem"}}>
          <Typewriter text="Intelligent Health Assistant · Powered by AI" speed={48}/>
        </div>
      </div>

      {/* ── MODE TOGGLE ── */}
      <div style={{display:"flex",justifyContent:"center",margin:"1.1rem 1.5rem 0",position:"relative",zIndex:10,opacity:mounted?1:0,transform:mounted?"translateY(0)":"translateY(18px)",transition:"all .75s cubic-bezier(.16,1,.3,1) .12s"}}>
        <div style={{display:"inline-flex",background:"rgba(0,0,0,.45)",border:"1px solid rgba(0,212,255,.18)",borderRadius:50,padding:4,backdropFilter:"blur(24px)",boxShadow:"0 6px 36px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.04)"}}>
          {[["user","👤","User Mode","#00d4ff"],["doctor","👨‍⚕️","Doctor Mode","#7effd4"]].map(([mode,icon,label,color])=>(
            <RippleBtn key={mode} className="ripple-btn"
              style={{padding:".58rem 1.75rem",borderRadius:50,border:"none",cursor:"pointer",fontWeight:700,fontSize:".84rem",background:appMode===mode?`linear-gradient(135deg,${color},${color}bb)`:"transparent",color:appMode===mode?"#010c17":"rgba(180,210,240,.42)",transition:"all .32s cubic-bezier(.16,1,.3,1)",display:"flex",alignItems:"center",gap:".42rem",boxShadow:appMode===mode?`0 0 22px ${color}44,0 2px 12px rgba(0,0,0,.3)`:"none",transform:appMode===mode?"scale(1.03)":"scale(1)"}}
              onClick={()=>switchMode(mode)}>
              <span style={{fontSize:"1rem"}}>{icon}</span>{label}
            </RippleBtn>
          ))}
        </div>
      </div>

      {/* ── ECG ── */}
      <div style={{margin:".7rem 1.5rem 0",opacity:mounted?.72:0,transition:"opacity 1s ease .45s",position:"relative",zIndex:10}}>
        <ECGLine/>
      </div>

      {/* ── TIP BAR ── */}
      <div style={{margin:".5rem 1.5rem 0",padding:".65rem 1.2rem",background:"linear-gradient(135deg,rgba(0,212,255,.065),rgba(126,255,212,.065))",border:"1px solid rgba(0,212,255,.11)",borderRadius:12,fontSize:".8rem",color:"rgba(126,255,212,.8)",position:"relative",zIndex:10,overflow:"hidden"}}>
        <div style={{position:"absolute",inset:0,background:"linear-gradient(90deg,transparent 0%,rgba(0,212,255,.07) 50%,transparent 100%)",backgroundSize:"200% 100%",animation:"shimmer 3.5s linear infinite",pointerEvents:"none"}} />
        {healthTip}
      </div>

      {/* ═══ USER MODE ═══ */}
      {appMode==="user" && (
        <div className="panel" style={panelAnim}>
          <div style={{display:"flex",gap:".5rem",padding:"1rem 1.5rem 0",position:"relative",zIndex:10,overflowX:"auto"}}>
            {TABS.map((t,i)=>(
              <RippleBtn key={t.id} className="ripple-btn tab-btn"
                style={{flex:1,minWidth:72,padding:".72rem .4rem",background:activeTab===t.id?"linear-gradient(135deg,rgba(0,212,255,.16),rgba(126,255,212,.07))":"rgba(255,255,255,.02)",border:activeTab===t.id?"1px solid rgba(0,212,255,.42)":"1px solid rgba(255,255,255,.045)",borderRadius:14,color:activeTab===t.id?"#00d4ff":"#3a5a78",cursor:"pointer",fontSize:".7rem",fontWeight:activeTab===t.id?700:400,textAlign:"center",transition:"all .22s cubic-bezier(.16,1,.3,1)",whiteSpace:"nowrap",boxShadow:activeTab===t.id?"0 4px 22px rgba(0,212,255,.13),inset 0 1px 0 rgba(0,212,255,.09)":"none",transform:activeTab===t.id?"translateY(-1px)":"translateY(0)",opacity:mounted?1:0,transitionDelay:`${i*.06}s`}}
                onClick={()=>setActiveTab(t.id)}>
                <div style={{fontSize:"1.2rem",marginBottom:".18rem",transition:"transform .2s",transform:activeTab===t.id?"scale(1.18)":"scale(1)"}}>{t.icon}</div>
                <div>{t.label}</div>
                {activeTab===t.id&&<div style={{height:2,background:"linear-gradient(90deg,transparent,#00d4ff,transparent)",borderRadius:2,marginTop:".28rem",animation:"progressBar .3s ease"}} />}
              </RippleBtn>
            ))}
          </div>

          <div style={{padding:"1rem 1.5rem 2rem",position:"relative",zIndex:10,maxWidth:900,margin:"0 auto"}}>

            {/* ── CHAT ── */}
            {activeTab==="chat" && (
              <HoloCard>
                <div style={{fontSize:"1rem",fontWeight:700,color:"#7effd4",marginBottom:".85rem",display:"flex",alignItems:"center",gap:".5rem"}}>
                  <span>💬</span> Chat with AI Doctor
                  <span style={{marginLeft:"auto",fontSize:".7rem",color:"#2a4a62",fontFamily:"monospace"}}>{MODEL}</span>
                </div>
                {isLoading&&<div style={{height:2,background:"linear-gradient(90deg,transparent,#00d4ff,#7effd4,transparent)",animation:"progressBar 1.8s ease-in-out infinite",borderRadius:2,marginBottom:".5rem"}} />}
                <div style={{height:"52vh",overflowY:"auto",display:"flex",flexDirection:"column",gap:"1rem",paddingRight:".5rem"}}>
                  {chatMessages.map((m,i)=>(
                    <div key={i} className="msg-anim" style={m.role==="user"?{
                      alignSelf:"flex-end",background:"linear-gradient(135deg,rgba(0,212,255,.16),rgba(126,255,212,.07))",border:"1px solid rgba(0,212,255,.23)",borderRadius:"18px 18px 4px 18px",padding:".82rem 1.15rem",maxWidth:"75%",fontSize:".9rem",boxShadow:"0 4px 22px rgba(0,212,255,.09)"}:{
                      alignSelf:"flex-start",background:"rgba(255,255,255,.027)",border:"1px solid rgba(255,255,255,.065)",borderRadius:"4px 18px 18px 18px",padding:".82rem 1.15rem",maxWidth:"85%",fontSize:".9rem",backdropFilter:"blur(8px)"}}>
                      {m.role==="assistant"&&m.content===""?(
                        <div style={{display:"flex",gap:5,alignItems:"center",padding:".2rem 0"}}>
                          {[0,1,2].map(j=><div key={j} style={{width:7,height:7,background:`hsl(${185+j*22},100%,62%)`,borderRadius:"50%",animation:`bounceDot 1s ${j*.15}s ease-in-out infinite alternate`,boxShadow:`0 0 8px hsl(${185+j*22},100%,62%)`}} />)}
                        </div>
                      ):m.role==="user"?<span>{m.content}</span>:(
                        <div className="prose-md"><ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown></div>
                      )}
                    </div>
                  ))}
                  <div ref={chatEndRef}/>
                </div>
                <div style={{display:"flex",gap:".7rem",marginTop:".85rem"}}>
                  <input style={{flex:1,background:"rgba(0,0,0,.32)",border:"1px solid rgba(0,212,255,.18)",borderRadius:14,padding:".82rem 1.15rem",color:"#ddeeff",fontSize:".9rem",outline:"none",backdropFilter:"blur(10px)",transition:"border-color .2s,box-shadow .2s",fontFamily:"'DM Sans','Segoe UI',sans-serif"}}
                    placeholder="Koi bhi health sawaal puchiye... (Hindi/English)" value={chatInput}
                    onChange={e=>setChatInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&sendChat()} />
                  <RippleBtn className="ripple-btn" disabled={isLoading}
                    style={{padding:".82rem 1.45rem",background:"linear-gradient(135deg,#00d4ff,#00d4ffcc)",border:"1px solid rgba(0,212,255,.35)",borderRadius:14,color:"#010c17",fontWeight:700,cursor:"pointer",fontSize:".85rem",boxShadow:"0 4px 22px rgba(0,212,255,.28)"}}
                    onClick={sendChat}>{isLoading?"⏳":"Send ➤"}</RippleBtn>
                </div>
                <div style={{display:"flex",flexWrap:"wrap",gap:".5rem",marginTop:".8rem"}}>
                  {["Fever aur headache","Blood pressure kya hai?","Diabetes symptoms","Back pain relief","Cold and cough"].map(q=>(
                    <span key={q} className="chip" style={{padding:".38rem .88rem",background:"rgba(0,212,255,.055)",border:"1px solid rgba(0,212,255,.16)",borderRadius:20,fontSize:".78rem",cursor:"pointer",color:"#7effd4",transition:"all .2s"}} onClick={()=>setChatInput(q)}>{q}</span>
                  ))}
                </div>
              </HoloCard>
            )}

            {/* ── SYMPTOM (camera removed) ── */}
            {activeTab==="symptom" && (
              <div>
                <HoloCard>
                  <div style={{fontSize:"1rem",fontWeight:700,color:"#7effd4",marginBottom:".85rem",display:"flex",alignItems:"center",gap:".5rem"}}><span>🔬</span>AI Symptom Analyzer</div>
                  <p style={{color:"#2a4a62",fontSize:".82rem",marginBottom:"1rem"}}>Apne symptoms type karein — AI analyze karega</p>

                  <textarea
                    style={{width:"100%",background:"rgba(0,0,0,.3)",border:"1px solid rgba(0,212,255,.18)",borderRadius:14,padding:"1rem",color:"#ddeeff",fontSize:".9rem",outline:"none",resize:"vertical",minHeight:110,boxSizing:"border-box",backdropFilter:"blur(10px)",fontFamily:"'DM Sans','Segoe UI',sans-serif",transition:"border-color .2s,box-shadow .2s"}}
                    placeholder="Symptoms describe karein, e.g. 'Subah se bukhar hai, sar dard aur khasi bhi...' "
                    value={symptoms}
                    onChange={e=>setSymptoms(e.target.value)}
                    onKeyDown={e=>{ if(e.key==="Enter"&&e.ctrlKey) analyzeSymptoms(); }}
                  />

                  <div style={{display:"flex",flexWrap:"wrap",gap:".5rem",marginTop:".8rem"}}>
                    {QUICK_SYMPTOMS.map(s=>(
                      <span key={s} className="chip"
                        style={{padding:".38rem .88rem",background:"rgba(0,212,255,.055)",border:"1px solid rgba(0,212,255,.16)",borderRadius:20,fontSize:".78rem",cursor:"pointer",color:"#7effd4",transition:"all .2s"}}
                        onClick={()=>setSymptoms(p=>p?`${p}, ${s}`:s)}>+{s}</span>
                    ))}
                  </div>

                  <div style={{display:"flex",gap:".7rem",marginTop:"1rem",alignItems:"center"}}>
                    <RippleBtn className="ripple-btn" disabled={symptomLoading||!symptoms.trim()}
                      style={{flex:1,padding:".9rem",background:"linear-gradient(135deg,#7effd4,#7effd4cc)",border:"1px solid rgba(126,255,212,.35)",borderRadius:14,color:"#010c17",fontWeight:700,cursor:"pointer",fontSize:".85rem",boxShadow:"0 4px 22px rgba(126,255,212,.22)",transition:"all .25s"}}
                      onClick={analyzeSymptoms}>
                      {symptomLoading?"🔬 Analyzing...":"🔍 Analyze Symptoms"}
                    </RippleBtn>
                    {symptoms&&(
                      <RippleBtn className="ripple-btn"
                        style={{padding:".9rem 1.1rem",background:"transparent",border:"1px solid rgba(255,71,87,.25)",borderRadius:14,color:"rgba(255,71,87,.7)",cursor:"pointer",fontSize:".84rem",transition:"all .25s"}}
                        onClick={()=>{setSymptoms("");setSymptomResult("");}}>
                        ✕ Clear
                      </RippleBtn>
                    )}
                  </div>
                  <div style={{marginTop:".5rem",fontSize:".72rem",color:"rgba(0,212,255,.28)",textAlign:"center"}}>Ctrl+Enter to analyze quickly</div>
                </HoloCard>

                {(symptomResult||symptomLoading)&&(
                  <HoloCard style={{animation:"fadeUp .4s cubic-bezier(.16,1,.3,1)"}}>
                    <div style={{fontSize:"1rem",fontWeight:700,color:"#7effd4",marginBottom:".85rem",display:"flex",alignItems:"center",gap:".5rem"}}>
                      <span>📋</span>Analysis Result
                      {symptomResult&&!symptomLoading&&<span style={{marginLeft:"auto",fontSize:".7rem",padding:".22rem .6rem",background:"rgba(0,255,127,.08)",border:"1px solid rgba(0,255,127,.2)",borderRadius:10,color:"#00ff7f",fontWeight:700}}>✓ Complete</span>}
                    </div>
                    {symptomLoading&&<div style={{height:2,background:"linear-gradient(90deg,transparent,#00d4ff,#7effd4,transparent)",animation:"progressBar 1.8s ease-in-out infinite",borderRadius:2,marginBottom:".5rem"}} />}
                    <div style={{background:"rgba(0,0,0,.38)",border:"1px solid rgba(0,212,255,.1)",borderRadius:14,padding:"1.2rem",maxHeight:"55vh",overflowY:"auto"}}>
                      {symptomLoading&&!symptomResult?(
                        <div style={{display:"flex",gap:5,padding:".5rem 0",alignItems:"center"}}>
                          {[0,1,2].map(j=><div key={j} style={{width:7,height:7,background:`hsl(${185+j*22},100%,62%)`,borderRadius:"50%",animation:`bounceDot 1s ${j*.15}s ease-in-out infinite alternate`,boxShadow:`0 0 8px hsl(${185+j*22},100%,62%)`}} />)}
                          <span style={{marginLeft:".6rem",color:"rgba(0,212,255,.4)",fontSize:".8rem"}}>Analyzing your symptoms...</span>
                        </div>
                      ):(
                        <div className="prose-md"><ReactMarkdown remarkPlugins={[remarkGfm]}>{symptomResult}</ReactMarkdown></div>
                      )}
                    </div>
                  </HoloCard>
                )}
              </div>
            )}

            {/* ── DRUG ── */}
            {activeTab==="drug" && (
              <div>
                <HoloCard>
                  <div style={{fontSize:"1rem",fontWeight:700,color:"#7effd4",marginBottom:".85rem",display:"flex",alignItems:"center",gap:".5rem"}}><span>💊</span>Drug & Medicine Database</div>
                  <p style={{color:"#2a4a62",fontSize:".82rem",marginBottom:"1rem"}}>Kisi bhi davayi ke baare mein puri jaankari le</p>
                  <div style={{display:"flex",gap:".7rem"}}>
                    <input style={{flex:1,background:"rgba(0,0,0,.32)",border:"1px solid rgba(0,212,255,.18)",borderRadius:14,padding:".82rem 1.15rem",color:"#ddeeff",fontSize:".9rem",outline:"none",backdropFilter:"blur(10px)",transition:"border-color .2s,box-shadow .2s",fontFamily:"'DM Sans','Segoe UI',sans-serif"}}
                      placeholder="Medicine name... e.g. Paracetamol, Metformin" value={drugQuery}
                      onChange={e=>setDrugQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&searchDrug()} />
                    <RippleBtn className="ripple-btn" disabled={drugLoading}
                      style={{padding:".82rem 1.45rem",background:"linear-gradient(135deg,#ffd700,#ffd700cc)",border:"1px solid rgba(255,215,0,.35)",borderRadius:14,color:"#010c17",fontWeight:700,cursor:"pointer",fontSize:".85rem",boxShadow:"0 4px 22px rgba(255,215,0,.22)"}}
                      onClick={searchDrug}>{drugLoading?"⏳":"🔍 Search"}</RippleBtn>
                  </div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:".5rem",marginTop:".8rem"}}>
                    {["Paracetamol","Ibuprofen","Metformin","Aspirin","Omeprazole","Amoxicillin"].map(d=>(
                      <span key={d} className="chip" style={{padding:".38rem .88rem",background:"rgba(0,212,255,.055)",border:"1px solid rgba(0,212,255,.16)",borderRadius:20,fontSize:".78rem",cursor:"pointer",color:"#7effd4",transition:"all .2s"}} onClick={()=>setDrugQuery(d)}>{d}</span>
                    ))}
                  </div>
                </HoloCard>
                {(drugResult||drugLoading)&&(
                  <HoloCard>
                    <div style={{fontSize:"1rem",fontWeight:700,color:"#7effd4",marginBottom:".85rem",display:"flex",alignItems:"center",gap:".5rem"}}><span>💊</span>{drugQuery} — Drug Info</div>
                    {drugLoading&&<div style={{height:2,background:"linear-gradient(90deg,transparent,#ffd700,transparent)",animation:"progressBar 1.8s ease-in-out infinite",borderRadius:2,marginBottom:".5rem"}} />}
                    <div style={{background:"rgba(0,0,0,.38)",border:"1px solid rgba(0,212,255,.1)",borderRadius:14,padding:"1.2rem",maxHeight:"50vh",overflowY:"auto"}}>
                      {drugLoading&&!drugResult?<div style={{display:"flex",gap:5,padding:".5rem 0"}}>{[0,1,2].map(j=><div key={j} style={{width:7,height:7,background:`hsl(${185+j*22},100%,62%)`,borderRadius:"50%",animation:`bounceDot 1s ${j*.15}s ease-in-out infinite alternate`}} />)}</div>
                        :<div className="prose-md"><ReactMarkdown remarkPlugins={[remarkGfm]}>{drugResult}</ReactMarkdown></div>}
                    </div>
                  </HoloCard>
                )}
              </div>
            )}

            {/* ── FIND DOCTORS ── */}
            {activeTab==="doctors" && <FindDoctorsPanel />}

            {/* ── EMERGENCY ── */}
            {activeTab==="emergency" && (
              <div>
                <HoloCard>
                  <div style={{fontSize:"1rem",fontWeight:700,color:"#7effd4",marginBottom:".85rem",display:"flex",alignItems:"center",gap:".5rem"}}><span>🚨</span>Emergency Numbers</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:".8rem"}}>
                    {EMERGENCY_NUMBERS.map(e=>(
                      <div key={e.country} className="fa-card" style={{background:"rgba(255,71,87,.055)",border:"1px solid rgba(255,71,87,.18)",borderRadius:14,padding:"1rem",transition:"all .25s"}}>
                        <div style={{fontWeight:800,marginBottom:".6rem",color:"#ff4757",fontSize:".88rem"}}>{e.country}</div>
                        {[["🚔 Police",e.police],["🚑 Ambulance",e.ambulance],["🔥 Fire",e.fire],["👩 Women",e.women]].map(([label,num])=>(
                          <div key={label} style={{display:"flex",justifyContent:"space-between",fontSize:".82rem",marginBottom:".32rem"}}>
                            <span style={{color:"#2a4a62"}}>{label}</span>
                            <a href={`tel:${num.split("/")[0]}`} style={{color:"#ffd700",fontWeight:700,textDecoration:"none"}}>{num}</a>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </HoloCard>
                <HoloCard>
                  <div style={{fontSize:"1rem",fontWeight:700,color:"#7effd4",marginBottom:".85rem",display:"flex",alignItems:"center",gap:".5rem"}}><span>🏥</span>First Aid Quick Guide</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(195px,1fr))",gap:".8rem"}}>
                    {FIRST_AID.map((fa,i)=>(
                      <div key={fa.title} className="fa-card" style={{background:`${fa.color}10`,border:`1px solid ${fa.color}30`,borderRadius:16,padding:"1rem",transition:"all .28s",animationDelay:`${i*.1}s`}}>
                        <div style={{fontSize:"1.6rem",marginBottom:".45rem",animation:"floatLogo 3s ease-in-out infinite",animationDelay:`${i*.5}s`}}>{fa.icon}</div>
                        <div style={{fontWeight:800,color:fa.color,marginBottom:".65rem",fontSize:".9rem"}}>{fa.title}</div>
                        {fa.steps.map((s,j)=>(
                          <div key={j} style={{display:"flex",gap:".45rem",fontSize:".78rem",marginBottom:".28rem",color:"#a0b8d0"}}>
                            <span style={{color:fa.color,fontWeight:700,minWidth:16}}>{j+1}.</span><span>{s}</span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </HoloCard>
                <div style={{background:"rgba(255,165,0,.035)",border:"1px solid rgba(255,165,0,.18)",borderRadius:14,padding:"1rem",textAlign:"center",fontSize:".8rem",color:"rgba(255,170,68,.82)",backdropFilter:"blur(10px)"}}>
                  ⚠️ <strong>Disclaimer:</strong> MedAI is for informational purposes only. Always consult a qualified healthcare professional. In emergency, call 108 immediately.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ DOCTOR MODE ═══ */}
      {appMode==="doctor" && (
        <div className="panel" style={panelAnim}>
          <div style={{display:"flex",gap:".5rem",padding:"1rem 1.5rem 0",position:"relative",zIndex:10,overflowX:"auto"}}>
            {DOCTOR_TABS.map((t,i)=>(
              <RippleBtn key={t.id} className="ripple-btn doc-tab-btn"
                style={{flex:1,minWidth:90,padding:".72rem .5rem",background:activeDoctorTab===t.id?"linear-gradient(135deg,rgba(126,255,212,.16),rgba(0,212,255,.08))":"rgba(255,255,255,.02)",border:activeDoctorTab===t.id?"1px solid rgba(126,255,212,.42)":"1px solid rgba(255,255,255,.045)",borderRadius:14,color:activeDoctorTab===t.id?"#7effd4":"#3a5a78",cursor:"pointer",fontSize:".74rem",fontWeight:activeDoctorTab===t.id?700:400,textAlign:"center",transition:"all .22s cubic-bezier(.16,1,.3,1)",whiteSpace:"nowrap",boxShadow:activeDoctorTab===t.id?"0 4px 22px rgba(126,255,212,.12),inset 0 1px 0 rgba(126,255,212,.09)":"none",transform:activeDoctorTab===t.id?"translateY(-1px)":"translateY(0)"}}
                onClick={()=>setActiveDoctorTab(t.id)}>
                <div style={{fontSize:"1.25rem",marginBottom:".18rem",transition:"transform .2s",transform:activeDoctorTab===t.id?"scale(1.18)":"scale(1)"}}>{t.icon}</div>
                <div>{t.label}</div>
                {activeDoctorTab===t.id&&<div style={{height:2,background:"linear-gradient(90deg,transparent,#7effd4,transparent)",borderRadius:2,marginTop:".28rem",animation:"progressBar .3s ease"}} />}
              </RippleBtn>
            ))}
          </div>

          <div style={{padding:"1rem 1.5rem 2rem",position:"relative",zIndex:10,maxWidth:900,margin:"0 auto"}}>

            {/* ═══ ALL PROFILES TAB ═══ */}
            {activeDoctorTab==="profiles" && (
              <div>
                <HoloCard docMode>
                  <div style={{display:"flex",alignItems:"center",gap:".8rem",marginBottom:"1rem"}}>
                    <span style={{fontSize:"1.2rem"}}>👥</span>
                    <div style={{fontWeight:800,fontSize:"1rem",color:"#7effd4"}}>My Doctor Profiles</div>
                    <span style={{marginLeft:"auto",padding:".2rem .65rem",background:"rgba(126,255,212,.1)",border:"1px solid rgba(126,255,212,.25)",borderRadius:20,fontSize:".72rem",color:"#7effd4",fontWeight:700}}>
                      {myProfiles.length} profile{myProfiles.length!==1?"s":""}
                    </span>
                  </div>
                  <p style={{color:"#2a4a62",fontSize:".82rem",marginBottom:"1rem"}}>
                    Manage multiple doctor profiles. Each saved profile is published to "Find Doctors" for patients to discover.
                  </p>

                  {myProfiles.length === 0 ? (
                    <div style={{textAlign:"center",padding:"2.5rem 1.5rem",background:"rgba(0,0,0,.2)",borderRadius:14,border:"1px solid rgba(126,255,212,.08)"}}>
                      <div style={{fontSize:"2.8rem",marginBottom:"1rem",opacity:.4}}>👨‍⚕️</div>
                      <div style={{fontWeight:700,color:"rgba(221,238,255,.4)",marginBottom:".4rem"}}>No profiles yet</div>
                      <div style={{fontSize:".8rem",color:"rgba(0,212,255,.3)"}}>Create your first doctor profile to get started</div>
                    </div>
                  ) : (
                    <div style={{display:"flex",flexDirection:"column",gap:".7rem",marginBottom:"1rem"}}>
                      {myProfiles.map((prof, idx) => {
                        const specColors={"Cardiologist":"#ff4757","Neurologist":"#5352ed","Dermatologist":"#ff6b81","Orthopedist":"#ffa502","General Physician":"#00d4ff","Pediatrician":"#2ed573","Psychiatrist":"#a29bfe","Gynecologist":"#fd79a8","Oncologist":"#e17055"};
                        const ac = specColors[prof.specialization] || "#00d4ff";
                        const isActive = idx === activeProfileIdx;
                        return (
                          <div key={prof._id||idx}
                            style={{display:"flex",alignItems:"center",gap:".9rem",padding:"1rem 1.1rem",background:isActive?`${ac}10`:"rgba(0,0,0,.25)",border:`1px solid ${isActive?ac+"45":"rgba(255,255,255,.07)"}`,borderRadius:14,transition:"all .2s",cursor:"pointer",animation:`fadeUp .35s ease ${idx*.07}s both`}}
                            onClick={()=>{setActiveProfileIdx(idx);setActiveDoctorTab("profile");setEditMode(false);}}>
                            <div style={{width:46,height:46,borderRadius:"50%",background:`linear-gradient(135deg,${ac}22,${ac}0a)`,border:`2px solid ${ac}38`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.3rem",flexShrink:0}}>
                              {prof.fullName ? prof.fullName.charAt(0).toUpperCase() : "👨‍⚕️"}
                            </div>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontWeight:700,fontSize:".9rem",color:"#ddeeff",display:"flex",alignItems:"center",gap:".5rem",flexWrap:"wrap"}}>
                                {prof.fullName ? `Dr. ${prof.fullName}` : "Unnamed Profile"}
                                {isActive && <span style={{fontSize:".65rem",padding:".15rem .5rem",background:"rgba(126,255,212,.12)",border:"1px solid rgba(126,255,212,.3)",borderRadius:10,color:"#7effd4",fontWeight:700}}>Active</span>}
                                {prof.regNumber && <span style={{fontSize:".65rem",padding:".15rem .5rem",background:"rgba(0,255,127,.08)",border:"1px solid rgba(0,255,127,.22)",borderRadius:10,color:"#00ff7f",fontWeight:700}}>✓</span>}
                              </div>
                              <div style={{fontSize:".78rem",color:ac,marginTop:".12rem"}}>{prof.specialization||"No specialization set"}</div>
                              <div style={{fontSize:".74rem",color:"#2a4a62",marginTop:".1rem"}}>
                                {[prof.hospital,prof.city].filter(Boolean).join(" · ")||"No details set"}
                              </div>
                            </div>
                            <div style={{display:"flex",gap:".5rem",flexShrink:0}}>
                              <RippleBtn style={{padding:".38rem .75rem",background:"transparent",border:`1px solid ${ac}32`,borderRadius:9,color:ac,cursor:"pointer",fontSize:".72rem",fontWeight:700}}
                                onClick={e=>{e.stopPropagation();setActiveProfileIdx(idx);setActiveDoctorTab("profile");setEditMode(true);}}>
                                ✏️ Edit
                              </RippleBtn>
                              <RippleBtn style={{padding:".38rem .65rem",background:"transparent",border:"1px solid rgba(255,71,87,.25)",borderRadius:9,color:"rgba(255,71,87,.7)",cursor:"pointer",fontSize:".72rem",fontWeight:700}}
                                onClick={e=>{e.stopPropagation();if(window.confirm("Delete this profile?"))deleteProfile(idx);}}>
                                🗑️
                              </RippleBtn>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <RippleBtn className="ripple-btn"
                    style={{width:"100%",padding:".88rem",background:"linear-gradient(135deg,rgba(126,255,212,.12),rgba(0,212,255,.08))",border:"1px solid rgba(126,255,212,.32)",borderRadius:14,color:"#7effd4",fontWeight:700,cursor:"pointer",fontSize:".88rem",boxShadow:"0 4px 22px rgba(126,255,212,.1)",display:"flex",alignItems:"center",justifyContent:"center",gap:".5rem"}}
                    onClick={addNewProfile}>
                    <span style={{fontSize:"1.2rem"}}>＋</span> Add New Doctor Profile
                  </RippleBtn>
                </HoloCard>

                <div style={{background:"rgba(0,212,255,.025)",border:"1px solid rgba(0,212,255,.12)",borderRadius:14,padding:".85rem 1rem",fontSize:".78rem",color:"rgba(0,212,255,.6)",backdropFilter:"blur(10px)"}}>
                  💡 Each profile is published independently. You can add profiles for different hospitals, specializations, or locations.
                </div>
              </div>
            )}

            {/* ═══ PROFILE EDIT TAB ═══ */}
            {activeDoctorTab==="profile" && (
              <div>
                {/* Profile selector bar */}
                {myProfiles.length > 0 && (
                  <div style={{marginBottom:"1rem",display:"flex",gap:".5rem",flexWrap:"wrap",alignItems:"center"}}>
                    <span style={{fontSize:".72rem",color:"#2a4a62",whiteSpace:"nowrap"}}>Editing:</span>
                    {myProfiles.map((p,i)=>(
                      <span key={p._id||i} className="profile-pill"
                        style={{padding:".3rem .85rem",background:i===activeProfileIdx?"rgba(126,255,212,.14)":"rgba(0,0,0,.25)",border:i===activeProfileIdx?"1px solid rgba(126,255,212,.42)":"1px solid rgba(255,255,255,.07)",borderRadius:20,fontSize:".76rem",color:i===activeProfileIdx?"#7effd4":"#3a5a78",fontWeight:i===activeProfileIdx?700:400}}
                        onClick={()=>{setActiveProfileIdx(i);setEditMode(false);}}>
                        {p.fullName?`Dr. ${p.fullName.split(" ")[0]}`:`Profile ${i+1}`}
                      </span>
                    ))}
                    <RippleBtn style={{padding:".28rem .75rem",background:"transparent",border:"1px solid rgba(126,255,212,.2)",borderRadius:10,color:"rgba(126,255,212,.6)",cursor:"pointer",fontSize:".72rem",fontWeight:700}}
                      onClick={addNewProfile}>＋ New</RippleBtn>
                  </div>
                )}

                {myProfiles.length === 0 ? (
                  <HoloCard docMode>
                    <div style={{textAlign:"center",padding:"2rem"}}>
                      <div style={{fontSize:"2.5rem",marginBottom:"1rem",opacity:.4}}>👨‍⚕️</div>
                      <div style={{fontWeight:700,color:"rgba(221,238,255,.4)",marginBottom:.8+"rem"}}>No profiles yet</div>
                      <RippleBtn className="ripple-btn"
                        style={{padding:".88rem 2rem",background:"linear-gradient(135deg,#7effd4,#7effd4cc)",border:"1px solid rgba(126,255,212,.35)",borderRadius:14,color:"#010c17",fontWeight:700,cursor:"pointer",fontSize:".85rem"}}
                        onClick={addNewProfile}>＋ Create First Profile</RippleBtn>
                    </div>
                  </HoloCard>
                ) : currentProfile && (
                  <>
                    <HoloCard docMode>
                      <div style={{display:"flex",alignItems:"center",gap:"1rem",marginBottom:"1.2rem"}}>
                        <div style={{width:56,height:56,borderRadius:"50%",background:"linear-gradient(135deg,rgba(0,212,255,.22),rgba(126,255,212,.13))",border:"2px solid rgba(0,212,255,.32)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.4rem",flexShrink:0,boxShadow:"0 0 22px rgba(0,212,255,.18)"}}>
                          {currentProfile.fullName?currentProfile.fullName.charAt(0).toUpperCase():"👨‍⚕️"}
                        </div>
                        <div style={{flex:1}}>
                          <div style={{fontWeight:800,fontSize:"1.1rem",color:"#7effd4"}}>
                            {currentProfile.fullName||"Dr. Your Name"}
                            {currentProfile.degree&&<span style={{fontSize:".8rem",color:"#00d4ff",marginLeft:".45rem"}}>({currentProfile.degree})</span>}
                          </div>
                          <div style={{color:"#2a4a62",fontSize:".8rem",marginTop:".18rem"}}>{currentProfile.specialization||"Specialization not set"}{currentProfile.hospital&&` · ${currentProfile.hospital}`}</div>
                          {currentProfile.regNumber&&<span style={{fontSize:".7rem",padding:".15rem .55rem",background:"rgba(0,255,127,.08)",border:"1px solid rgba(0,255,127,.22)",borderRadius:20,color:"#00ff7f",fontWeight:700,marginTop:".3rem",display:"inline-block"}}>✓ Verified</span>}
                        </div>
                        <div style={{display:"flex",gap:".5rem",flexShrink:0}}>
                          <RippleBtn className="ripple-btn" style={{padding:".48rem .95rem",background:"transparent",border:"1px solid rgba(126,255,212,.3)",borderRadius:10,color:"#7effd4",cursor:"pointer",fontWeight:700,fontSize:".76rem"}} onClick={()=>setEditMode(!editMode)}>
                            {editMode?"👁 Preview":"✏️ Edit"}
                          </RippleBtn>
                          <RippleBtn style={{padding:".48rem .65rem",background:"transparent",border:"1px solid rgba(255,71,87,.2)",borderRadius:10,color:"rgba(255,71,87,.6)",cursor:"pointer",fontSize:".76rem",fontWeight:700}}
                            onClick={()=>{if(window.confirm("Delete this profile?"))deleteProfile(activeProfileIdx);}}>
                            🗑️
                          </RippleBtn>
                        </div>
                      </div>

                      {(currentProfile.experience||currentProfile.consultFee||currentProfile.gpa) && (
                        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:".7rem",marginBottom:"1rem"}}>
                          {[["#00d4ff",currentProfile.experience,"Yrs Exp."],["#7effd4",currentProfile.consultFee?"₹"+currentProfile.consultFee:"—","Consult Fee"],["#ffd700",currentProfile.gpa,"GPA / %"]].map(([c,val,label])=>(
                            <div key={label} className="stat-box" style={{background:`${c}07`,border:`1px solid ${c}22`,borderRadius:14,padding:".88rem",textAlign:"center",transition:"all .28s"}}>
                              <div style={{fontSize:"1.45rem",fontWeight:900,color:c,lineHeight:1,marginBottom:".22rem"}}>
                                {val&&val!=="—"?<AnimCounter value={parseFloat(val)||val} />:(val||"—")}
                              </div>
                              <div style={{fontSize:".68rem",color:"#2a4a62"}}>{label}</div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div style={{padding:".65rem 1rem",background:"rgba(0,212,255,.06)",border:"1px solid rgba(0,212,255,.14)",borderRadius:10,fontSize:".78rem",color:"rgba(0,212,255,.7)",display:"flex",gap:".5rem",alignItems:"center"}}>
                        <span>🏥</span>
                        <span>Saving will <strong style={{color:"#00d4ff"}}>publish this profile to "Find Doctors"</strong> for patients.</span>
                      </div>
                    </HoloCard>

                    {editMode && (
                      <HoloCard docMode>
                        <div style={{fontSize:"1rem",fontWeight:700,color:"#00d4ff",marginBottom:".85rem",display:"flex",alignItems:"center",gap:".5rem"}}><span>👤</span>Personal Information</div>
                        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(218px,1fr))",gap:".88rem"}}>
                          {[["Full Name","fullName","Dr. Firstname Lastname"],["Phone Number","phone","+91 98765 43210"],["Email Address","email","doctor@hospital.com"],["City / Location","city","Mumbai, Maharashtra"],["Hospital / Clinic","hospital","Apollo Hospital"],["Years of Experience","experience","e.g. 10"],["Consultation Fee (₹)","consultFee","e.g. 500"]].map(([label,field,ph])=>(
                            <div key={field} style={{display:"flex",flexDirection:"column"}}>
                              <div style={{fontSize:".7rem",color:"rgba(126,255,212,.58)",marginBottom:".32rem",letterSpacing:".08em",textTransform:"uppercase",fontWeight:600}}>{label}</div>
                              <input className="doc-input" style={docInputStyle}
                                placeholder={ph} value={currentProfile[field]||""} onChange={e=>handleProfileChange(field,e.target.value)} />
                            </div>
                          ))}
                        </div>
                        <div style={{display:"flex",flexDirection:"column",marginTop:".88rem"}}>
                          <div style={{fontSize:".7rem",color:"rgba(126,255,212,.58)",marginBottom:".32rem",letterSpacing:".08em",textTransform:"uppercase",fontWeight:600}}>Professional Bio</div>
                          <textarea className="doc-input" style={{...docInputStyle,resize:"vertical",minHeight:90}}
                            placeholder="Brief description of your expertise..." value={currentProfile.bio||""} onChange={e=>handleProfileChange("bio",e.target.value)} />
                        </div>
                        <RippleBtn className="ripple-btn" style={{marginTop:"1rem",width:"100%",padding:".92rem",background:"linear-gradient(135deg,#7effd4,#7effd4cc)",border:"1px solid rgba(126,255,212,.35)",borderRadius:14,color:"#010c17",fontWeight:700,cursor:"pointer",fontSize:".85rem",boxShadow:"0 4px 22px rgba(126,255,212,.22)"}} onClick={saveCurrentProfile}>
                          💾 Save & Publish Profile
                        </RippleBtn>
                      </HoloCard>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ═══ CREDENTIALS TAB ═══ */}
            {activeDoctorTab==="credentials" && (
              <div>
                {myProfiles.length > 0 && (
                  <div style={{marginBottom:"1rem",display:"flex",gap:".5rem",flexWrap:"wrap",alignItems:"center"}}>
                    <span style={{fontSize:".72rem",color:"#2a4a62",whiteSpace:"nowrap"}}>Profile:</span>
                    {myProfiles.map((p,i)=>(
                      <span key={p._id||i} className="profile-pill"
                        style={{padding:".3rem .85rem",background:i===activeProfileIdx?"rgba(126,255,212,.14)":"rgba(0,0,0,.25)",border:i===activeProfileIdx?"1px solid rgba(126,255,212,.42)":"1px solid rgba(255,255,255,.07)",borderRadius:20,fontSize:".76rem",color:i===activeProfileIdx?"#7effd4":"#3a5a78",fontWeight:i===activeProfileIdx?700:400}}
                        onClick={()=>setActiveProfileIdx(i)}>
                        {p.fullName?`Dr. ${p.fullName.split(" ")[0]}`:`Profile ${i+1}`}
                      </span>
                    ))}
                  </div>
                )}

                {myProfiles.length === 0 ? (
                  <HoloCard docMode>
                    <div style={{textAlign:"center",padding:"2rem"}}>
                      <div style={{fontSize:"2.5rem",opacity:.4,marginBottom:"1rem"}}>🎓</div>
                      <div style={{color:"rgba(221,238,255,.4)",fontWeight:700,marginBottom:".6rem"}}>Create a profile first</div>
                      <RippleBtn className="ripple-btn" style={{padding:".78rem 1.5rem",background:"linear-gradient(135deg,#7effd4,#7effd4cc)",border:"1px solid rgba(126,255,212,.35)",borderRadius:14,color:"#010c17",fontWeight:700,cursor:"pointer",fontSize:".84rem"}}
                        onClick={()=>{addNewProfile();setActiveDoctorTab("profile");}}>Create Profile</RippleBtn>
                    </div>
                  </HoloCard>
                ) : currentProfile && (
                  <>
                    <HoloCard docMode>
                      <div style={{fontSize:"1rem",fontWeight:700,color:"#00d4ff",marginBottom:".85rem",display:"flex",alignItems:"center",gap:".5rem"}}><span>🎓</span>Academic Credentials & Specialization</div>
                      <p style={{color:"#2a4a62",fontSize:".8rem",marginBottom:"1.2rem"}}>Credentials for: <strong style={{color:"#7effd4"}}>{currentProfile.fullName?`Dr. ${currentProfile.fullName}`:"this profile"}</strong></p>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(218px,1fr))",gap:".88rem"}}>
                        {[["Primary Degree","degree","select-degree"],["Specialization","specialization","select-spec"],["University / Medical College","university","e.g. AIIMS Delhi"],["Year of Passing","passingYear","e.g. 2015"],["GPA / Percentage / Grade","gpa","e.g. 8.7 / 87% / A+"],["Medical Registration No.","regNumber","e.g. MCI-2015-12345"]].map(([label,field,ph])=>(
                          <div key={field} style={{display:"flex",flexDirection:"column"}}>
                            <div style={{fontSize:".7rem",color:"rgba(126,255,212,.58)",marginBottom:".32rem",letterSpacing:".08em",textTransform:"uppercase",fontWeight:600}}>{label}</div>
                            {ph==="select-degree"?(
                              <select className="doc-input" style={{...docInputStyle,cursor:"pointer"}} value={currentProfile.degree||""} onChange={e=>handleProfileChange("degree",e.target.value)}>
                                <option value="">Select Degree</option>{DEGREES.map(d=><option key={d} value={d}>{d}</option>)}
                              </select>
                            ):ph==="select-spec"?(
                              <select className="doc-input" style={{...docInputStyle,cursor:"pointer"}} value={currentProfile.specialization||""} onChange={e=>handleProfileChange("specialization",e.target.value)}>
                                <option value="">Select Specialization</option>{SPECIALIZATIONS.map(s=><option key={s} value={s}>{s}</option>)}
                              </select>
                            ):(
                              <input className="doc-input" style={docInputStyle} placeholder={ph} value={currentProfile[field]||""} onChange={e=>handleProfileChange(field,e.target.value)} />
                            )}
                          </div>
                        ))}
                      </div>
                      <RippleBtn className="ripple-btn" style={{marginTop:"1.2rem",width:"100%",padding:".92rem",background:"linear-gradient(135deg,#7effd4,#7effd4cc)",border:"1px solid rgba(126,255,212,.35)",borderRadius:14,color:"#010c17",fontWeight:700,cursor:"pointer",fontSize:".85rem",boxShadow:"0 4px 22px rgba(126,255,212,.22)"}} onClick={saveCredentials}>
                        🎓 Save & Verify Credentials
                      </RippleBtn>
                    </HoloCard>

                    {currentProfile.regNumber && (
                      <HoloCard docMode style={{borderColor:"rgba(0,255,127,.22)",background:"rgba(0,255,127,.025)"}}>
                        <div style={{fontSize:"1rem",fontWeight:700,color:"#00d4ff",marginBottom:".85rem",display:"flex",alignItems:"center",gap:".5rem"}}><span>✅</span>Verified Credential Card</div>
                        <div style={{display:"flex",flexDirection:"column",gap:".62rem"}}>
                          {[["🎓 Degree",currentProfile.degree],["🏥 Specialization",currentProfile.specialization],["🏛️ University",currentProfile.university],["📅 Passing Year",currentProfile.passingYear],["📊 Academic Score",currentProfile.gpa],["📋 Reg. Number",currentProfile.regNumber]].map(([label,value],i)=>value&&(
                            <div key={label} style={{display:"flex",justifyContent:"space-between",fontSize:".87rem",borderBottom:"1px solid rgba(0,255,127,.065)",paddingBottom:".42rem",animation:`fadeUp .35s ease ${i*.06}s both`}}>
                              <span style={{color:"#2a4a62"}}>{label}</span>
                              <span style={{color:"#7effd4",fontWeight:700}}>{value}</span>
                            </div>
                          ))}
                        </div>
                        <div style={{marginTop:"1rem",textAlign:"center"}}>
                          <span style={badge("#00ff7f")}>✓ Credentials Verified by MedAI</span>
                        </div>
                      </HoloCard>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ═══ SCHEDULE TAB ═══ */}
            {activeDoctorTab==="schedule" && (
              <div>
                {myProfiles.length > 0 && (
                  <div style={{marginBottom:"1rem",display:"flex",gap:".5rem",flexWrap:"wrap",alignItems:"center"}}>
                    <span style={{fontSize:".72rem",color:"#2a4a62",whiteSpace:"nowrap"}}>Profile:</span>
                    {myProfiles.map((p,i)=>(
                      <span key={p._id||i} className="profile-pill"
                        style={{padding:".3rem .85rem",background:i===activeProfileIdx?"rgba(126,255,212,.14)":"rgba(0,0,0,.25)",border:i===activeProfileIdx?"1px solid rgba(126,255,212,.42)":"1px solid rgba(255,255,255,.07)",borderRadius:20,fontSize:".76rem",color:i===activeProfileIdx?"#7effd4":"#3a5a78",fontWeight:i===activeProfileIdx?700:400}}
                        onClick={()=>setActiveProfileIdx(i)}>
                        {p.fullName?`Dr. ${p.fullName.split(" ")[0]}`:`Profile ${i+1}`}
                      </span>
                    ))}
                  </div>
                )}

                {myProfiles.length === 0 ? (
                  <HoloCard docMode>
                    <div style={{textAlign:"center",padding:"2rem"}}>
                      <div style={{fontSize:"2.5rem",opacity:.4,marginBottom:"1rem"}}>📅</div>
                      <div style={{color:"rgba(221,238,255,.4)",fontWeight:700,marginBottom:".6rem"}}>Create a profile first</div>
                      <RippleBtn className="ripple-btn" style={{padding:".78rem 1.5rem",background:"linear-gradient(135deg,#7effd4,#7effd4cc)",border:"1px solid rgba(126,255,212,.35)",borderRadius:14,color:"#010c17",fontWeight:700,cursor:"pointer",fontSize:".84rem"}}
                        onClick={()=>{addNewProfile();setActiveDoctorTab("profile");}}>Create Profile</RippleBtn>
                    </div>
                  </HoloCard>
                ) : currentProfile && (
                  <>
                    <HoloCard docMode>
                      <div style={{fontSize:"1rem",fontWeight:700,color:"#00d4ff",marginBottom:".85rem",display:"flex",alignItems:"center",gap:".5rem"}}><span>📅</span>Availability & Schedule</div>
                      <p style={{color:"#2a4a62",fontSize:".8rem",marginBottom:"1rem"}}>Schedule for: <strong style={{color:"#7effd4"}}>{currentProfile.fullName?`Dr. ${currentProfile.fullName}`:"this profile"}</strong></p>

                      <div style={{marginBottom:"1.2rem"}}>
                        <div style={{fontSize:".7rem",color:"rgba(126,255,212,.58)",marginBottom:".45rem",letterSpacing:".08em",textTransform:"uppercase",fontWeight:600}}>Available Days</div>
                        <div style={{display:"flex",gap:".48rem",flexWrap:"wrap"}}>
                          {Object.entries(currentProfile.availability||{}).map(([day,active])=>(
                            <RippleBtn key={day} className="ripple-btn day-btn"
                              style={{padding:".48rem .88rem",borderRadius:10,border:active?"1px solid rgba(126,255,212,.45)":"1px solid rgba(255,255,255,.07)",background:active?"rgba(126,255,212,.11)":"rgba(255,255,255,.02)",color:active?"#7effd4":"#3a5a78",cursor:"pointer",fontSize:".78rem",fontWeight:active?700:400,transition:"all .2s",boxShadow:active?"0 0 14px rgba(126,255,212,.13)":"none"}}
                              onClick={()=>handleAvail(day)}>{day.charAt(0).toUpperCase()+day.slice(1)}</RippleBtn>
                          ))}
                        </div>
                      </div>

                      <div style={{display:"flex",flexDirection:"column"}}>
                        <div style={{fontSize:".7rem",color:"rgba(126,255,212,.58)",marginBottom:".32rem",letterSpacing:".08em",textTransform:"uppercase",fontWeight:600}}>Consultation Hours</div>
                        <input className="doc-input" style={docInputStyle}
                          placeholder="e.g. 9:00 AM - 1:00 PM, 5:00 PM - 8:00 PM" value={currentProfile.timeSlots||""} onChange={e=>handleProfileChange("timeSlots",e.target.value)} />
                      </div>

                      <div style={{marginTop:"1.2rem",padding:"1rem",background:"rgba(0,212,255,.04)",borderRadius:12,border:"1px solid rgba(0,212,255,.1)"}}>
                        <div style={{fontSize:".72rem",color:"#2a4a62",marginBottom:".45rem",textTransform:"uppercase",letterSpacing:".07em"}}>📋 Schedule Summary</div>
                        <div style={{fontSize:".86rem",color:"#ddeeff",marginBottom:".28rem"}}>
                          <strong style={{color:"#00d4ff"}}>Days: </strong>
                          {Object.entries(currentProfile.availability||{}).filter(([,v])=>v).map(([d])=>d.charAt(0).toUpperCase()+d.slice(1)).join(", ")||"No days selected"}
                        </div>
                        <div style={{fontSize:".86rem",color:"#ddeeff"}}><strong style={{color:"#00d4ff"}}>Time: </strong>{currentProfile.timeSlots||"Not set"}</div>
                      </div>

                      <RippleBtn className="ripple-btn" style={{marginTop:"1rem",width:"100%",padding:".92rem",background:"linear-gradient(135deg,#00d4ff,#00d4ffcc)",border:"1px solid rgba(0,212,255,.35)",borderRadius:14,color:"#010c17",fontWeight:700,cursor:"pointer",fontSize:".85rem",boxShadow:"0 4px 22px rgba(0,212,255,.25)"}}
                        onClick={saveSchedule}>
                        📅 Save Schedule
                      </RippleBtn>
                    </HoloCard>

                    <HoloCard docMode>
                      <div style={{fontSize:"1rem",fontWeight:700,color:"#00d4ff",marginBottom:".85rem",display:"flex",alignItems:"center",gap:".5rem"}}><span>⏰</span>Today's Appointments</div>
                      <div style={{display:"flex",flexDirection:"column",gap:".7rem"}}>
                        {SAMPLE_PATIENTS.filter(p=>p.date.startsWith("Today")).map((p,i)=>(
                          <div key={p.id} className="patient-row" style={{background:"rgba(0,212,255,.04)",border:"1px solid rgba(0,212,255,.16)",borderRadius:13,padding:"1rem",display:"flex",justifyContent:"space-between",alignItems:"center",gap:"1rem",transition:"all .22s",animation:`fadeUp .35s ease ${i*.1}s both`}}>
                            <div style={{fontSize:"1.5rem"}}>🧑‍🦱</div>
                            <div style={{flex:1}}><div style={{fontWeight:700,fontSize:".88rem"}}>{p.name}</div><div style={{color:"#2a4a62",fontSize:".78rem"}}>{p.issue}</div></div>
                            <div style={{textAlign:"right"}}><div style={{fontSize:".76rem",color:"#00d4ff",marginBottom:".28rem"}}>{p.date}</div><span style={badge(p.status==="upcoming"?"#00d4ff":"#5a7a9a")}>{p.status}</span></div>
                          </div>
                        ))}
                      </div>
                    </HoloCard>
                  </>
                )}
              </div>
            )}

            {/* ═══ PATIENTS TAB ═══ */}
            {activeDoctorTab==="patients" && (
              <div>
                <HoloCard docMode>
                  <div style={{fontSize:"1rem",fontWeight:700,color:"#00d4ff",marginBottom:".85rem",display:"flex",alignItems:"center",gap:".5rem"}}><span>🩺</span>Patient Records</div>
                  <div style={{display:"flex",flexDirection:"column",gap:".7rem"}}>
                    {SAMPLE_PATIENTS.map((p,i)=>(
                      <div key={p.id} className="patient-row" style={{background:p.status==="upcoming"?"rgba(0,212,255,.038)":"rgba(255,255,255,.015)",border:p.status==="upcoming"?"1px solid rgba(0,212,255,.16)":"1px solid rgba(255,255,255,.045)",borderRadius:13,padding:"1rem",display:"flex",justifyContent:"space-between",alignItems:"center",gap:"1rem",transition:"all .22s",animation:`fadeUp .38s ease ${i*.08}s both`}}>
                        <div style={{width:42,height:42,borderRadius:"50%",background:p.status==="upcoming"?"rgba(0,212,255,.11)":"rgba(255,255,255,.04)",border:"1px solid rgba(0,212,255,.16)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.1rem",flexShrink:0}}>👤</div>
                        <div style={{flex:1}}>
                          <div style={{fontWeight:700,fontSize:".88rem"}}>{p.name}, <span style={{color:"#2a4a62",fontWeight:400}}>Age {p.age}</span></div>
                          <div style={{color:"#7effd4",fontSize:".8rem"}}>{p.issue}</div>
                          <div style={{color:"#2a4a62",fontSize:".73rem",marginTop:".18rem"}}>📅 {p.date}</div>
                        </div>
                        <div style={{display:"flex",flexDirection:"column",gap:".38rem",alignItems:"flex-end"}}>
                          <span style={badge(p.status==="upcoming"?"#00d4ff":"#00ff7f")}>{p.status==="upcoming"?"📌 Upcoming":"✅ Done"}</span>
                          <RippleBtn className="ripple-btn" style={{padding:".28rem .72rem",background:"transparent",border:"1px solid rgba(126,255,212,.28)",borderRadius:8,color:"#7effd4",cursor:"pointer",fontSize:".7rem",fontWeight:700}}>View</RippleBtn>
                        </div>
                      </div>
                    ))}
                  </div>
                </HoloCard>
                <div style={{background:"rgba(255,165,0,.03)",border:"1px solid rgba(255,165,0,.15)",borderRadius:14,padding:"1rem",textAlign:"center",fontSize:".8rem",color:"rgba(255,170,68,.78)",backdropFilter:"blur(10px)"}}>
                  ℹ️ Patient records shown here are demo data. Connect with MedAI backend to manage real appointments.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast */}
      {saveMsg&&<div style={{position:"fixed",bottom:28,left:"50%",background:"linear-gradient(135deg,rgba(0,255,127,.1),rgba(0,212,255,.07))",border:"1px solid rgba(0,255,127,.32)",borderRadius:14,padding:".82rem 2rem",fontSize:".9rem",color:"#00ff7f",fontWeight:700,zIndex:9999,backdropFilter:"blur(18px)",animation:"toastSlide .42s cubic-bezier(.16,1,.3,1)",boxShadow:"0 8px 42px rgba(0,255,127,.14)"}}>{saveMsg}</div>}
    </div>
  );
}
