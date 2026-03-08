from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import httpx
import base64
import json

app = FastAPI(title="MedAI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


MEDICAL_SYSTEM_PROMPT = """You are MedAI - an advanced medical AI assistant. You help users with:
1. Medical information about diseases, symptoms, medications
2. Symptom analysis and possible conditions
3. Drug information, interactions, dosage
4. Health advice and preventive care
5. First aid guidance

IMPORTANT RULES:
- Always recommend consulting a real doctor for diagnosis/treatment
- Be empathetic, clear, and accurate
- For serious symptoms, urge immediate medical attention
- Format responses with clear sections using markdown
- Include severity indicators: 🟢 Mild | 🟡 Moderate | 🔴 Severe
- Always end with a disclaimer about professional medical advice

Respond in the same language the user writes in (Hindi or English)."""

SYMPTOM_ANALYSIS_PROMPT = """You are a medical symptom analyzer. Analyze the provided symptoms (text or image description) and:

1. **Possible Conditions** - List top 3-5 most likely conditions with probability
2. **Severity Assessment** - Rate overall severity (Mild/Moderate/Severe/Emergency)
3. **Key Warning Signs** - What to watch out for
4. **Immediate Actions** - What to do right now
5. **When to See Doctor** - Timeline recommendation
6. **Do's and Don'ts** - Quick actionable advice

Format with clear headers and emojis. Be thorough but accessible.
ALWAYS include: "⚠️ This is AI analysis only. Please consult a qualified doctor for proper diagnosis."

Respond in the same language as the user."""

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    is_symptom_check: bool = False

class SymptomRequest(BaseModel):
    symptoms: str
    image_base64: Optional[str] = None
    image_type: Optional[str] = "image/jpeg"

class DrugSearchRequest(BaseModel):
    query: str

async def call_openrouter(messages: list, system_prompt: str, model: str = "anthropic/claude-3.5-sonnet"):
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://medai-hackathon.app",
        "X-Title": "MedAI Health Assistant"
    }
    
    payload = {
        "model": model,
        "messages": [{"role": "system", "content": system_prompt}] + messages,
        "max_tokens": 2000,
        "temperature": 0.3
    }
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(OPENROUTER_URL, headers=headers, json=payload)
        if response.status_code != 200:
            raise HTTPException(status_code=response.status_code, detail=f"OpenRouter error: {response.text}")
        data = response.json()
        return data["choices"][0]["message"]["content"]

@app.get("/")
async def root():
    return {"status": "MedAI Backend Running", "version": "1.0.0"}

@app.post("/api/chat")
async def chat(request: ChatRequest):
    try:
        messages = [{"role": m.role, "content": m.content} for m in request.messages]
        system = SYMPTOM_ANALYSIS_PROMPT if request.is_symptom_check else MEDICAL_SYSTEM_PROMPT
        response = await call_openrouter(messages, system)
        return {"response": response, "status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analyze-symptoms")
async def analyze_symptoms(request: SymptomRequest):
    try:
        if request.image_base64:
            # Vision model for image analysis
            messages = [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{request.image_type};base64,{request.image_base64}"
                            }
                        },
                        {
                            "type": "text",
                            "text": f"Analyze this medical image/symptom photo. Additional context: {request.symptoms if request.symptoms else 'Please analyze what you see'}"
                        }
                    ]
                }
            ]
            response = await call_openrouter(messages, SYMPTOM_ANALYSIS_PROMPT, model="anthropic/claude-3.5-sonnet")
        else:
            messages = [{"role": "user", "content": f"Analyze these symptoms: {request.symptoms}"}]
            response = await call_openrouter(messages, SYMPTOM_ANALYSIS_PROMPT)
        
        return {"analysis": response, "status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/drug-search")
async def drug_search(request: DrugSearchRequest):
    try:
        system = """You are a pharmaceutical expert. For any drug/medication query, provide:
        1. **Drug Overview** - What it is and what it treats
        2. **How It Works** - Mechanism of action (simple terms)
        3. **Common Dosage** - Standard doses (always say consult doctor)
        4. **Side Effects** - Common and serious ones
        5. **Drug Interactions** - Important interactions to know
        6. **Precautions** - Who should avoid it
        7. **Storage** - How to store properly
        
        Format nicely with emojis and clear sections. Always recommend consulting a pharmacist/doctor."""
        
        messages = [{"role": "user", "content": f"Tell me about: {request.query}"}]
        response = await call_openrouter(messages, system)
        return {"info": response, "status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/health-tip")
async def health_tip():
    try:
        system = "You are a health coach. Give ONE specific, actionable daily health tip. Keep it under 100 words. Include an emoji. Be motivating and practical."
        messages = [{"role": "user", "content": "Give me today's health tip"}]
        response = await call_openrouter(messages, system)
        return {"tip": response, "status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)