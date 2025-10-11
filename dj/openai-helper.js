// dj/openai-helper.js

// Function to enhance track metadata with OpenAI
async function enhanceTrackWithOpenAI(title, artist, apiKey) {
  // Exit early if no API key
  if (!apiKey) {
    console.error("OpenAI API key is required");
    return null;
  }

  try {
    // Create OpenAI API request
    const response = await fetch("https://api.openai.com/v1/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo-instruct",
        prompt: `For this song request:
Title: ${title}
Artist: ${artist}

Provide the following information in a JSON format:
1. The standardized song title with proper capitalization
2. The standardized artist name with proper capitalization
3. The musical key in Camelot notation (e.g., "8A", "11B") if you know it
4. The BPM (Beats Per Minute) if you know it

Only return data you're confident about. For key and BPM, return null if unknown.
Don't make up information or guess wildly. It's better to return null than incorrect data.

Return a JSON object like this:
{
  "title": "Standardized Song Title",
  "artist": "Standardized Artist Name",
  "key": "8A", // or null if unknown
  "bpm": 128, // or null if unknown
  "confidence": "high" // or "medium" or "low"
}`,
        max_tokens: 300,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.choices || data.choices.length === 0) {
      throw new Error("No response from OpenAI");
    }

    // Extract and parse the JSON response
    const responseText = data.choices[0].text.trim();
    let result;
    
    try {
      result = JSON.parse(responseText);
      return result;
    } catch (parseError) {
      console.error("Error parsing OpenAI response:", parseError);
      console.log("Raw response:", responseText);
      return null;
    }

  } catch (error) {
    console.error("Error calling OpenAI:", error);
    return null;
  }
}