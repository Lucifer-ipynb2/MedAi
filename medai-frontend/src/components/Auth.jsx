import { useState } from "react";


export default function Auth({ onLogin }) {

  const [mode,setMode]=useState("login");

  const [name,setName]=useState("");
  const [email,setEmail]=useState("");
  const [password,setPassword]=useState("");

  const [error,setError]=useState("");

  const signup=()=>{

    if(!name||!email||!password){
      setError("All fields required");
      return;
    }

    const patient={name,email,password};

    localStorage.setItem(
      "medai_patient",
      JSON.stringify(patient)
    );

    onLogin(patient);

  };

  const login=()=>{

    const saved=JSON.parse(
      localStorage.getItem("medai_patient")
    );

    if(!saved || saved.email!==email || saved.password!==password){

      setError("Invalid email or password");
      return;

    }

    onLogin(saved);

  };

  const styles={

    container:{
      minHeight:"100vh",
      display:"flex",
      alignItems:"center",
      justifyContent:"center",
      background:"#020b18",
      fontFamily:"DM Sans",
      color:"#e0f0ff"
    },

    card:{
      width:360,
      padding:"2rem",
      background:"rgba(255,255,255,0.04)",
      border:"1px solid rgba(0,212,255,0.2)",
      borderRadius:16
    },

    title:{
      textAlign:"center",
      marginBottom:20
    },

    input:{
      width:"100%",
      padding:"10px",
      marginBottom:"12px",
      borderRadius:8,
      border:"1px solid rgba(0,212,255,0.3)",
      background:"rgba(255,255,255,0.05)",
      color:"#e0f0ff"
    },

    button:{
      width:"100%",
      padding:"10px",
      borderRadius:8,
      border:"none",
      background:"#00d4ff",
      fontWeight:700,
      cursor:"pointer"
    },

    switch:{
      marginTop:14,
      textAlign:"center",
      fontSize:14
    },

    link:{
      color:"#00d4ff",
      cursor:"pointer"
    }

  };

  return(

    <div style={styles.container}>

      <div style={styles.card}>

        <h2 style={styles.title}>
          🩺 MedAI {mode==="login" ? "Login":"Sign Up"}
        </h2>

        {mode==="signup" && (

          <input
          placeholder="Full Name"
          value={name}
          onChange={(e)=>setName(e.target.value)}
          style={styles.input}
          />

        )}

        <input
        placeholder="Email"
        value={email}
        onChange={(e)=>setEmail(e.target.value)}
        style={styles.input}
        />

        <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e)=>setPassword(e.target.value)}
        style={styles.input}
        />

        {error && (

          <div style={{color:"red",marginBottom:10}}>
            {error}
          </div>

        )}

        <button
        style={styles.button}
        onClick={mode==="login" ? login : signup}
        >
        {mode==="login" ? "Login" : "Create Account"}
        </button>

        <div style={styles.switch}>

          {mode==="login" ? "No account?" : "Already have account?"}

          <span
          style={styles.link}
          onClick={()=>setMode(mode==="login" ? "signup":"login")}
          >
          {" "}
          {mode==="login" ? "Sign Up":"Login"}
          </span>

        </div>

      </div>

    </div>

  );

}