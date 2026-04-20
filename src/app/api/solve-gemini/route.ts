import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { imageUrl, apiKey, model } = await request.json();

    if (!imageUrl || !apiKey || !model) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    // 1. Fetch the image and convert to Base64
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

    // 2. Call Gemini API
    // Using v1beta for newest models like 2.5-flash-lite
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: "Analyze the image of this academic multiple-choice question. Identify the correct answer letter and the total number of options present (A-D, A-E, or A-F). Return a JSON object with: 'answer' (letter A-F) and 'optionsCount' (number 4, 5, or 6)." },
              {
                inline_data: {
                  mime_type: contentType,
                  data: base64Image
                }
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 50,
          responseMimeType: "application/json",
        }
      })
    });

    if (!geminiResponse.ok) {
      const errorData = await geminiResponse.json();
      return NextResponse.json({ 
        error: errorData.error?.message || "Gemini API error"
      }, { status: geminiResponse.status });
    }

    const data = await geminiResponse.json();
    let result = { answer: "", optionsCount: 4 };

    try {
      const parsed = JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text || "{}");
      result.answer = (parsed.answer || "").trim().toUpperCase();
      result.optionsCount = parseInt(parsed.optionsCount) || 4;
    } catch (e) {
      const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
      const match = raw.match(/[A-F]/);
      if (match) result.answer = match[0];
    }
    
    // Final validation of answer
    if (!result.answer || !/^[A-F]$/.test(result.answer)) {
      return NextResponse.json({ error: "AI returned invalid answer format" }, { status: 422 });
    }

    return NextResponse.json(result);

  } catch (error: any) {
    console.error("Gemini Solve Error:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
