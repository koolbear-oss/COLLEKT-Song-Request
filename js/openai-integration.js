// js/openai-integration.js

// Function to check if user has Pro access
function hasProAccess() {
  const userRole = localStorage.getItem('userRole');
  return userRole === 'Pro DJ' || userRole === 'Admin';
}

// Function to enhance track metadata using OpenAI
async function enhanceTrackMetadata(title, artist, openaiKey) {
  // Only process for Pro users
  if (!hasProAccess()) {
    console.log('Pro subscription required for AI enhancement');
    return {
      title: title,
      artist: artist,
      key: null,
      bpm: null,
      enhanced_by_ai: false
    };
  }
  
  // Validate API key
  if (!openaiKey) {
    console.error('OpenAI API key is required');
    return {
      title: title,
      artist: artist,
      key: null,
      bpm: null,
      enhanced_by_ai: false
    };
  }
  
  try {
    // Create the prompt for OpenAI
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

    // Call OpenAI API
    const response = await fetch('https://api.openai.com/v1/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo-instruct',
        prompt: prompt,
        max_tokens: 150,
        temperature: 0.3
      })
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI API returned ${response.status}`);
    }
    
    const data = await response.json();
    
    // Parse the response text to get the JSON object
    const responseText = data.choices[0].text.trim();
    const result = JSON.parse(responseText);
    
    // Return the enhanced metadata
    return {
      title: result.title || title,
      artist: result.artist || artist,
      key: result.key || null,
      bpm: result.bpm || null,
      enhanced_by_ai: true
    };
    
  } catch (error) {
    console.error('Error enhancing track metadata:', error);
    // Return original data on error
    return {
      title: title,
      artist: artist,
      key: null,
      bpm: null,
      enhanced_by_ai: false
    };
  }
}