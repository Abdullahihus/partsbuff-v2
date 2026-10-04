import { NextResponse } from "next/server";
import { getCatalogCandidates, type VehicleContext } from "../../../lib/catalog-provider";
import type { Part } from "../../../lib/parts";

function normalize(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
}

function localScore(part: Part, query: string) {
  const q = normalize(query);
  const tokens = q.split(" ").filter((t) => t.length > 2);
  const fields = [part.name, part.category, part.location, part.description, ...part.aliases, ...part.symptoms, part.side ?? "", part.oemNumber, ...(part.previousOemNumbers ?? [])];
  const searchable = normalize(fields.join(" "));
  let score = 0;

  for (const token of tokens) {
    if (searchable.includes(token)) score += 2;
    if (normalize(part.name).includes(token)) score += 3;
    if (part.aliases.some((a) => normalize(a).includes(token))) score += 4;
    if (part.symptoms.some((s) => normalize(s).includes(token))) score += 4;
  }

  for (const phrase of [...part.aliases, ...part.symptoms, part.name]) {
    const p = normalize(phrase);
    if (p.length > 4 && q.includes(p)) score += 12;
  }

  const driver = ["driver", "left", "lh"].some((w) => q.includes(w));
  const passenger = ["passenger", "right", "rh"].some((w) => q.includes(w));
  if (part.side === "Driver" && driver) score += 10;
  if (part.side === "Passenger" && passenger) score += 10;
  if (part.side === "Driver" && passenger) score -= 10;
  if (part.side === "Passenger" && driver) score -= 10;

  if (part.oemNumber && q.includes(normalize(part.oemNumber))) score += 30;
  if ((part.previousOemNumbers ?? []).some((n) => q.includes(normalize(n)))) score += 25;

  return score;
}

function localMatches(parts: Part[], query: string) {
  return parts
    .map((part) => ({ part, score: localScore(part, query) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((x, index) => ({
      ...x.part,
      confidence: Math.max(45, Math.min(96, 90 - index * 9 + Math.min(x.score, 15))),
      reason: x.part.verification === "lookup-required"
        ? "Starter part topic matching your description. OEM number and exact fitment still need confirmation."
        : index === 0
        ? "Best match based on your words, location, side, and the selected BMW catalog reference."
        : "Related catalog candidate that also matches part of your description."
    }));
}

function getOutputText(data: any) {
  if (typeof data?.output_text === "string") return data.output_text;
  const chunks: string[] = [];
  for (const item of data?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (content?.type === "output_text" && typeof content?.text === "string") chunks.push(content.text);
    }
  }
  return chunks.join("\n");
}

async function aiMatches(vehicle: VehicleContext, query: string, parts: Part[]) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const slim = parts.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category,
    location: p.location,
    aliases: p.aliases,
    symptoms: p.symptoms,
    side: p.side,
    oemNumber: p.oemNumber,
    fitmentNotes: p.fitmentNotes,
    verification: p.verification,
    sourceRestrictions: p.sourceRestrictions
  }));

  const prompt = `You are the language-matching layer for PartsBuff.\n\nVehicle context: ${JSON.stringify(vehicle)}\nCustomer description: ${JSON.stringify(query)}\nCatalog references and unverified starter topics: ${JSON.stringify(slim)}\n\nChoose up to 5 likely candidate IDs. Never invent a part, OEM number, or fitment that is not in the candidate list. If the request is ambiguous, return a short clarifying question. Return ONLY valid JSON with this exact shape: {"matches":[{"id":"candidate-id","confidence":0-100,"reason":"short plain-English reason"}],"clarifyingQuestion":"optional question or empty string"}.`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5.6-luna",
      input: prompt
    })
  });

  if (!response.ok) return null;
  const data: any = await response.json();
  const text = getOutputText(data).trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  try {
    const parsed = JSON.parse(text);
    const byId = new Map(parts.map((p) => [p.id, p]));
    const matches = (parsed.matches ?? [])
      .map((m: any) => {
        const part = byId.get(String(m.id));
        if (!part) return null;
        return {
          ...part,
          confidence: Math.max(0, Math.min(100, Number(m.confidence) || 0)),
          reason: String(m.reason || "AI matched this catalog reference to your description.")
        };
      })
      .filter(Boolean)
      .slice(0, 5);
    return { matches, clarifyingQuestion: String(parsed.clarifyingQuestion || "") };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const body: any = await request.json();
    const query = String(body?.query ?? "").trim();
    const vehicle = (body?.vehicle ?? {}) as VehicleContext;

    if (!query || query.length > 1000) {
      return NextResponse.json({ error: "Describe the part in 1–1000 characters." }, { status: 400 });
    }

    const catalog = await getCatalogCandidates(vehicle);
    if (!catalog.supported) {
      return NextResponse.json({
        error: catalog.message,
        supportedProfile: catalog.profile
      }, { status: 422 });
    }

    const ai = await aiMatches(vehicle, query, catalog.parts);
    if (ai && ai.matches.length) {
      return NextResponse.json({
        ...ai,
        mode: "ai",
        catalogSource: catalog.source,
        catalogProfile: catalog.profile
      });
    }

    const matches = localMatches(catalog.parts, query);
    return NextResponse.json({
      matches,
      clarifyingQuestion: matches.length === 0
        ? "I could not find that in the selected BMW catalog. Try describing its location, side, shape, or what it connects to."
        : matches.length === 1
          ? "If this does not look right, tell me which side of the car it is on and what is around it."
          : "",
      mode: "local",
      catalogSource: catalog.source,
      catalogProfile: catalog.profile
    });
  } catch {
    return NextResponse.json({ error: "Could not match that description right now." }, { status: 500 });
  }
}
