import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { imageUrl, apiKey, model } = await request.json();

    if (!imageUrl || !apiKey || !model) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    // 1. Fetch the image from the source URL on the server-side
    // We use a browser-like User-Agent to avoid 403 Forbidden errors
    const imageResponse = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!imageResponse.ok) {
      return NextResponse.json({ error: `Failed to fetch image: ${imageResponse.status}` }, { status: 502 });
    }

    const imageArrayBuffer = await imageResponse.arrayBuffer();
    const contentType = imageResponse.headers.get('content-type') || 'image/jpeg';
    const base64Image = Buffer.from(imageArrayBuffer).toString('base64');
    const dataUrl = `data:${contentType};base64,${base64Image}`;

    // 2. Call the Groq API with the Base64 image data
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze the image of this academic multiple-choice question. Identify the correct answer letter and the total number of options present (A-D, A-E, or A-F). Return a JSON object with: 'answer' (letter A-F) and 'optionsCount' (number 4, 5, or 6)."
              },
              {
                type: "image_url",
                image_url: { url: dataUrl },
              },
            ],
          },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 50,
      }),
    });

    if (!groqResponse.ok) {
      const errorData = await groqResponse.json();
      return NextResponse.json({ error: errorData.error?.message || "Groq API error" }, { status: groqResponse.status });
    }

    const data = await groqResponse.json();
    let result = { answer: "", optionsCount: 4 };
    
    try {
      const parsed = JSON.parse(data.choices[0]?.message?.content || "{}");
      result.answer = (parsed.answer || "").trim().toUpperCase();
      result.optionsCount = parseInt(parsed.optionsCount) || 4;
    } catch (e) {
      // Fallback if not valid JSON
      const raw = data.choices[0]?.message?.content || "";
      const match = raw.match(/[A-F]/);
      if (match) result.answer = match[0];
    }
    
    // Final validation of answer
    if (!result.answer || !/^[A-F]$/.test(result.answer)) {
      return NextResponse.json({ error: "AI returned invalid answer format" }, { status: 422 });
    }

    return NextResponse.json(result);

  } catch (error: any) {
    console.error("AI Solve Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
