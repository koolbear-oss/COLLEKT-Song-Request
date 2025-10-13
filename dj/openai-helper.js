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
        model: "gpt-4-turbo",
        prompt: `You are a music expert identifying and correcting song requests from a DJ event.

      INPUT:
      Title: ${title}
      Artist: ${artist}

      TASK:
      1. Identify if this is a real song (correct common typos, spelling errors, and word variations)
      2. Return the OFFICIAL/CORRECT title and artist name as they appear on the actual release
      3. Provide musical metadata (key, BPM) only if you're highly confident

      CORRECTION EXAMPLES:
      - "peach & cream" → "Peaches & Cream"
      - "dont stop believing" → "Don't Stop Believin'"
      - "Mr Brightside" → "Mr. Brightside"
      - "Billie Jean" by "MJ" → "Billie Jean" by "Michael Jackson"

      CRITICAL RULES:
      ✓ CORRECT spelling errors, plurals, punctuation, and abbreviations
      ✓ Use the OFFICIAL title/artist from the actual music release
      ✓ For key: Use Camelot notation (e.g., "8A", "11B") - only if confident
      ✓ For BPM: Use exact tempo - only if confident
      ✗ Do NOT guess key/BPM if unsure - return null instead
      ✗ Do NOT make up songs that don't exist

      Return ONLY valid JSON (no markdown, no explanations):
      {
        "title": "Official Song Title With Correct Spelling",
        "artist": "Official Artist Name",
        "key": "8A",
        "bpm": 102,
        "confidence": "high",
        "is_real_song": true
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