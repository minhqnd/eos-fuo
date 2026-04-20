export async function solveWithGroq(imageUrl: string, apiKey: string, model: string = "llama-3.2-11b-vision-preview") {
  if (!apiKey) throw new Error("Missing Groq API Key");

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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
              text: "This is a multiple-choice question from an academic exam. Analyze the image and provide the letter of the correct answer (A, B, C, D, E, or F). Return ONLY the letter, nothing else."
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
              },
            },
          ],
        },
      ],
      temperature: 0.1,
      max_tokens: 10,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || "Groq API error");
  }

  const data = await response.json();
  const result = data.choices[0]?.message?.content?.trim().toUpperCase();
  
  // Basic validation to ensure it's a valid letter
  if (/^[A-F]$/.test(result)) {
    return result;
  }
  
  // Try to find the letter if there's extra text
  const match = result.match(/[A-F]/);
  if (match) return match[0];

  throw new Error(`AI returned invalid answer format: ${result}`);
}
