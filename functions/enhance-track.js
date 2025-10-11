const { Configuration, OpenAIApi } = require("openai");

// Configure OpenAI API
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Function to validate that the user has Pro access
async function validateProAccess(event) {
  // You'll need to implement proper authentication
  // This is a placeholder for now - we'll improve it later
  return true;
}

exports.handler = async function(event, context) {
  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }
  
  try {
    // Validate that the user has Pro access
    const hasAccess = await validateProAccess(event);
    if (!hasAccess) {
      return { 
        statusCode: 403, 
        body: JSON.stringify({ error: "Pro subscription required for this feature" })
      };
    }
    
    // Parse the request body
    const { title, artist } = JSON.parse(event.body);
    
    if (!title || !artist) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: "Missing required parameters" })
      };
    }
    
    // Craft the prompt for OpenAI
    const prompt = `
For this song request:
Title: ${title}
Artist: ${artist}

Provide the following information in a JSON format:
1. The standardized song title with proper capitalization
2. The standardized artist name with proper capitalization
3. The musical key in Camelot notation (e.g., "8A", "11B") if you know it
4. The BPM (Beats Per Minute) if you know it

Only return data you're confident about. For key and BPM, return null if uncertain.
Don't make up information or guess wildly. It's better to return null than incorrect data.

Return a JSON object like this:
{
  "title": "Standardized Song Title",
  "artist": "Standardized Artist Name",
  "key": "8A", // or null if unknown
  "bpm": 128, // or null if unknown
  "confidence": "high" // or "medium" or "low"
}
`;

    // Call the OpenAI API
    const response = await openai.createCompletion({
      model: "gpt-3.5-turbo-instruct", // Use appropriate model
      prompt: prompt,
      max_tokens: 150,
      temperature: 0.3, // Low temperature for more deterministic responses
    });
    
    // Process the response
    let result;
    try {
      // Extract the JSON from the response
      const text = response.data.choices[0].text.trim();
      result = JSON.parse(text);
      
      // Validate the result
      if (!result.title || !result.artist) {
        throw new Error("Invalid response format");
      }
      
      // Add a flag indicating this was enhanced by AI
      result.enhanced_by_ai = true;
      
    } catch (error) {
      console.error("Error parsing OpenAI response:", error);
      // Return original data on parsing error
      result = { 
        title: title, 
        artist: artist, 
        key: null, 
        bpm: null, 
        confidence: "low",
        enhanced_by_ai: false,
        error: "Could not process metadata"
      };
    }
    
    // Return the processed data
    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };
    
  } catch (error) {
    console.error("Function error:", error);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: "Server error processing request" }) 
    };
  }
};