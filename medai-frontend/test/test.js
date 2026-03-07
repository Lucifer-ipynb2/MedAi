const OPENROUTER_API_KEY = import.meta.env.OPENROUTER_API_KEY;

async function callAI(messages, systemPrompt) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://medai.health",
      "X-OpenRouter-Title": "MedAI Health Assistant",
    },
    body: JSON.stringify({
      model: "google/gemma-3-27b-it:free",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      max_tokens: 2000,
      temperature: 0.3,
      stream: true,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  let buffer = "";
  let full = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop(); // keep incomplete line

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;

      const data = line.slice(6).trim();

      if (data === "[DONE]") return full;

      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) full += delta;
      } catch (err) {
        console.error("Parse error:", err);
      }
    }
  }

  return full;
}

const result = await callAI(
  [
    {
      role: "user",
      content: "What is the capital of France?",
    },
  ],
  "You are helpful ai",
);

console.log(result);
