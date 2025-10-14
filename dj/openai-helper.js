// dj/openai-helper.js
// Function to check if user has Pro access
function hasProAccess() {
  const userRole = localStorage.getItem('userRole');
  return userRole === 'Pro DJ' || userRole === 'Admin';
}

// Function to enhance track metadata with OpenAI
async function enhanceTrackWithOpenAI(title, artist, apiKey) {
  // Keep existing code for access checks
  if (!hasProAccess()) {
    console.log("Pro subscription required for AI enhancement");
    return null;
  }
  
  if (!apiKey) {
    console.error("OpenAI API key is required");
    return null;
  }

  try {
    // Create OpenAI API request - Updated to use chat completions
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      
      body: JSON.stringify({
        model: "gpt-3.5-turbo", // Using 3.5-turbo which may be better for music metadata
        messages: [
          {
            role: "system",
            content: "You are a music expert with extensive knowledge of songs, artists, and technical details like key signatures and BPM. For popular songs, provide accurate metadata including Camelot notation for keys and precise BPM."
          },
          {
            role: "user",
            content: `INPUT:
Title: ${title}
Artist: ${artist}

TASK:
1. Identify if this is a real song (correct common typos, spelling errors, and word variations)
2. Return the OFFICIAL/CORRECT title and artist name as they appear on the actual release
3. Provide musical metadata (key, BPM) for this song - this is critically important

CORRECTION EXAMPLES:
- "peach & cream" → "Peaches & Cream"
- "dont stop believing" → "Don't Stop Believin'"
- "Mr Brightside" → "Mr. Brightside"
- "Billie Jean" by "MJ" → "Billie Jean" by "Michael Jackson"

TECHNICAL METADATA EXAMPLES:
- "Nikes on My Feet" by "Mac Miller" → Key: "11A", BPM: 85
- "Don't Stop Believin'" by "Journey" → Key: "1B", BPM: 118
- "Sweet Child O' Mine" by "Guns N' Roses" → Key: "10B", BPM: 125

CRITICAL RULES:
✓ CORRECT spelling errors, punctuation, and abbreviations in title/artist
✓ ALWAYS provide key and BPM for well-known songs
✓ For key: Use Camelot notation (e.g., "8A", "11B") preferred by DJs
✓ For BPM: Provide the tempo in beats per minute as a whole number
✓ Set confidence based on your certainty about the metadata
✓ Only return null for key/BPM if you absolutely cannot find information

Return ONLY valid JSON (no markdown, no explanations):
{
  "title": "Official Song Title With Correct Spelling",
  "artist": "Official Artist Name",
  "key": "8A", 
  "bpm": 102,
  "confidence": "high",
  "is_real_song": true
}`
          }
        ],
        max_tokens: 300,
        temperature: 0.2  // Lower temperature for more consistent responses
      })
    });

    // Rest of your existing code for response handling remains the same
    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.choices || data.choices.length === 0) {
      throw new Error("No response from OpenAI");
    }

    // Extract and parse the JSON response - Updated for chat format
    const responseText = data.choices[0].message.content.trim();
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