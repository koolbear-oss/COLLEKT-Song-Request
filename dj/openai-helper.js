// dj/openai-helper.js
// Function to check if user has Pro access
function hasProAccess() {
  const userRole = localStorage.getItem('userRole');
  return userRole === 'Pro DJ' || userRole === 'Admin';
}

// Function to enhance track metadata with OpenAI
async function enhanceTrackWithOpenAI(title, artist, apiKey) {
  // Only allow Pro users
  if (!hasProAccess()) {
    console.log("Pro subscription required for AI enhancement");
    return null;
  }
  
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
        1. The standardized song title with proper capitalization, BUT PRESERVE original spelling variants like "Ur" instead of "Your" or stylistic choices
        2. The standardized artist name with proper capitalization
        3. The musical key in Camelot notation (e.g., "8A", "11B") if you know it
        4. The BPM (Beats Per Minute) if you know it

        Only return data you're confident about. For key and BPM, return null if unknown.
        Don't make up information or guess wildly. It's better to return null than incorrect data.
        Don't "correct" unique stylistic choices in spelling - maintain the artist's original intent.

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

// Function to enhance a track and update database
async function enhanceAndUpdateTrack(request) {
  // Get API key from localStorage
  const apiKey = localStorage.getItem('openaiApiKey');
  if (!apiKey) {
    console.log("No OpenAI API key found");
    return request;
  }
  
  try {
    // Get original title and artist
    const title = request.original_title || request.title;
    const artist = request.original_artist || request.artist;
    
    // Add detailed logging
    console.log("Enhancing track details:", {
      requestId: request.id,
      title: title,
      artist: artist,
      apiKeyPresent: apiKey ? "Yes (length: " + apiKey.length + ")" : "No"
    });

    // Call OpenAI
    const enhancedData = await enhanceTrackWithOpenAI(title, artist, apiKey);
    if (!enhancedData) {
      return request;
    }

    console.log("Enhanced data:", enhancedData);
    
    // Update database with enhanced data
    const { data, error } = await supabase
      .from('requests')
      .update({
        // Only update if we have valid data
        title: enhancedData.title || request.title,
        artist: enhancedData.artist || request.artist,
        key: enhancedData.key,
        bpm: enhancedData.bpm ? parseInt(enhancedData.bpm) : null,
        enhanced_by_ai: true
      })
      .eq('id', request.id);
    
    if (error) {
      console.error("Error updating track in database:", error);
      return request;
    }
    
    // Return updated request object
    return {
      ...request,
      title: enhancedData.title || request.title,
      artist: enhancedData.artist || request.artist,
      key: enhancedData.key,
      bpm: enhancedData.bpm ? parseInt(enhancedData.bpm) : null,
      enhanced_by_ai: true
    };
    
  } catch (error) {
    console.error("Error enhancing track:", error);
    return request;
  }
}