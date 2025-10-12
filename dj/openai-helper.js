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
        prompt: `You are a music metadata expert for a DJ request system.

        INPUT:
        Title: ${title}
        Artist: ${artist}

        TASK:
        Fix ONLY obvious spelling/capitalization errors. Do NOT change the artist to a different person.

        CRITICAL RULES:
        ✓ Fix spelling: "paulo pepstsy" → "Paulo Pepstsy" or best guess at correct spelling
        ✓ Fix capitalization: "babylove" → "Baby Love"
        ✓ Fix punctuation: "dont stop" → "Don't Stop"
        ✗ DO NOT assume famous songs: If input is "Baby Love" by "Paulo Pepstsy", keep that artist
        ✗ DO NOT replace artist with someone more famous
        ✗ DO NOT change to a different song with the same title

        CONFIDENCE RULES:
        - If the artist name seems real but you're unsure of exact spelling → Keep it close to original
        - If you're not 100% confident this exact combination exists → Mark confidence as "low"
        - Only return metadata (key/BPM) if you're certain about THIS specific track

        EXAMPLES OF CORRECT BEHAVIOR:
        Input: "babylove" by "paulo pepstsy"
        Output: "Baby Love" by "Paulo Pepstasy" (fix spelling because artist and track match)

        Input: "baby love" by "supremes"  
        Output: "Baby Love" by "The Supremes" (this IS the famous one)

        Input: "dont stop believing" by "journey"
        Output: "Don't Stop Believin'" by "Journey"

        Return ONLY valid JSON (no markdown):
        {
          "title": "Corrected Title",
          "artist": "Corrected Artist Name (preserve identity)",
          "key": null,
          "bpm": null,
          "confidence": "high",
          "is_real_song": true
        }`,
        temperature: 0.1
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

async function bulkEnhanceRequests(requests, progressCallback) {
  const results = {
    total: requests.length,
    enhanced: 0,
    failed: 0,
    errors: []
  };
  
  // Check for API key first
  const apiKey = localStorage.getItem('openaiApiKey');
  if (!apiKey) {
    throw new Error('OpenAI API key not found. Please add it in Settings.');
  }
  
  // Process sequentially with delay
  for (let i = 0; i < requests.length; i++) {
    const request = requests[i];
    
    // Update progress
    if (progressCallback) {
      progressCallback({
        current: i + 1,
        total: results.total,
        currentTrack: `${request.title} - ${request.artist}`
      });
    }
    
    try {
      // Enhance the track
      await enhanceAndUpdateTrack(request);
      results.enhanced++;
      
      // Rate limiting: 1 second delay between requests
      // OpenAI free tier: 3 RPM (20 second intervals)
      // Paid tier: 60+ RPM (1 second intervals is safe)
      if (i < requests.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
    } catch (error) {
      console.error(`Failed to enhance: ${request.title}`, error);
      results.failed++;
      results.errors.push({
        track: `${request.title} - ${request.artist}`,
        error: error.message
      });
      
      // Continue processing even if one fails
    }
  }
  
  return results;
}