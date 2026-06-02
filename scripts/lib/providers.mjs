import { configuredModel } from "./env.mjs";

export async function callContestant(contestant, prompt, options = {}) {
  const apiKey = process.env[contestant.apiKeyEnv];
  if (!apiKey) {
    throw new Error(`Missing ${contestant.apiKeyEnv}`);
  }

  const request = {
    apiKey,
    model: configuredModel(contestant),
    system: prompt.system,
    user: prompt.user,
    json: options.json ?? true,
    temperature: options.temperature ?? 0.9,
    maxTokens: options.maxTokens ?? 700
  };

  switch (contestant.provider) {
    case "openai":
      return callOpenAiCompatible({
        ...request,
        baseUrl: "https://api.openai.com/v1"
      });
    case "openai-compatible":
      return callOpenAiCompatible({
        ...request,
        baseUrl: contestant.baseUrl
      });
    case "anthropic":
      return callAnthropic(request);
    case "google":
      return callGoogle(request);
    default:
      throw new Error(`Unknown provider ${contestant.provider}`);
  }
}

export function parseModelJson(text, fallback = {}) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) {
      return fallback;
    }
    try {
      return JSON.parse(match[0]);
    } catch {
      return fallback;
    }
  }
}

async function callOpenAiCompatible({
  apiKey,
  baseUrl,
  model,
  system,
  user,
  json,
  temperature,
  maxTokens
}) {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      temperature,
      max_tokens: maxTokens,
      ...(json ? { response_format: { type: "json_object" } } : {})
    })
  });

  const data = await readJsonResponse(response);
  return data.choices?.[0]?.message?.content?.trim() || "";
}

async function callAnthropic({
  apiKey,
  model,
  system,
  user,
  temperature,
  maxTokens
}) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      system,
      messages: [{ role: "user", content: user }],
      temperature,
      max_tokens: maxTokens
    })
  });

  const data = await readJsonResponse(response);
  return data.content
    ?.filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim() || "";
}

async function callGoogle({ apiKey, model, system, user, json, temperature, maxTokens }) {
  const url = new URL(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`
  );
  url.searchParams.set("key", apiKey);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: system }]
      },
      contents: [
        {
          role: "user",
          parts: [{ text: user }]
        }
      ],
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
        ...(json ? { responseMimeType: "application/json" } : {})
      }
    })
  });

  const data = await readJsonResponse(response);
  return data.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("\n")
    .trim() || "";
}

async function readJsonResponse(response) {
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    const detail = data.error?.message || data.message || text;
    throw new Error(`Provider request failed (${response.status}): ${detail}`);
  }

  return data;
}

