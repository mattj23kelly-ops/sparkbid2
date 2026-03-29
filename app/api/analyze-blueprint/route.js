import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 30; // Allow up to 30s for AI analysis

export async function POST(request) {
  try {
    const { fileBase64, mediaType, fileName } = await request.json();

    if (!fileBase64 || !mediaType) {
      return Response.json({ error: "Missing file data" }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return Response.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Build the content array — image or PDF
    const fileContent = mediaType === "application/pdf"
      ? {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: fileBase64 },
        }
      : {
          type: "image",
          source: { type: "base64", media_type: mediaType, data: fileBase64 },
        };

    const message = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            fileContent,
            {
              type: "text",
              text: `You are analyzing a construction blueprint or project document for an electrical contractor bidding platform.

Extract as much detail as possible and return ONLY a valid JSON object with these exact fields:

{
  "title": "concise project name based on building type and work (e.g. 'Office Building Electrical Rewiring')",
  "location": "full address or city/state if visible, otherwise null",
  "project_type": "one of: commercial, residential, industrial, institutional",
  "square_footage": number if shown on plans, otherwise null,
  "stories": number of floors/stories if shown, otherwise null,
  "scope_of_work": "2-4 sentence professional description of the electrical work required based on the plans. Include panel work, wiring, lighting, special systems if evident.",
  "tags": ["array of 2-6 relevant tags from: Rewiring, Panel Upgrade, LED Retrofit, Solar / PV, EV Chargers, Fire Alarm, Generator, Low Voltage, New Construction, Tenant Buildout, Emergency"]
}

Be specific and professional. Base your response strictly on what is visible in the document. Do not invent details not present in the plans.`,
            },
          ],
        },
      ],
    });

    const text = message.content[0].text;

    // Extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return Response.json({ error: "Could not parse AI response" }, { status: 500 });
    }

    const extracted = JSON.parse(jsonMatch[0]);
    return Response.json({ success: true, data: extracted });

  } catch (err) {
    console.error("Blueprint analysis error:", err);
    return Response.json(
      { error: err.message ?? "Analysis failed" },
      { status: 500 }
    );
  }
}
