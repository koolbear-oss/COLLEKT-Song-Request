// Initialize Supabase client
const supabaseUrl = 'https://ljekmnuflfotwznxeexc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxqZWttbnVmbGZvdHd6bnhlZXhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5MjU1NzksImV4cCI6MjA3NTUwMTU3OX0.S6yzIIKRv1YlKPHstMpTFqqSpAQOuFUOqC0G27zE4FE';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Get event ID from URL parameter (for QR code)
const urlParams = new URLSearchParams(window.location.search);
const eventId = urlParams.get('event');

// If no event ID is provided, show an error
if (!eventId) {
  document.body.innerHTML = `
    <div class="container" style="text-align: center;">
      <h1>Error</h1>
      <p>No event ID provided. Please scan a valid QR code.</p>
    </div>
  `;
}

// DOM elements
const requestForm = document.getElementById('requestForm');
const confirmation = document.getElementById('confirmation');
const newRequestButton = document.getElementById('newRequestButton');
const submitButton = document.getElementById('submitButton');
const loadingElement = document.getElementById('loading');

// Make sure loading is hidden initially
if (loadingElement) {
  loadingElement.classList.add('hidden');
}

// Helper function to show/hide loading
function showLoading(show) {
  if (!loadingElement) return;
  
  if (show) {
    loadingElement.classList.remove('hidden');
  } else {
    loadingElement.classList.add('hidden');
  }
}

// Form submission
requestForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  // Get form values
  const songTitle = document.getElementById('songTitle').value.trim();
  const artistName = document.getElementById('artistName').value.trim();
  const message = document.getElementById('message').value.trim();
  
  // Remove any previous error messages
  document.querySelectorAll('.error').forEach(el => el.remove());
  
  let hasError = false;
  
  // Validation logic (keep existing validation code)
  if (!songTitle) {
    addError('songTitle', 'Please enter a song title');
    hasError = true;
  } else if (songTitle.length < 2) {
    addError('songTitle', 'Song title must be at least 2 characters');
    hasError = true;
  }
  
  if (!artistName) {
    addError('artistName', 'Please enter an artist name');
    hasError = true;
  } else if (artistName.length < 2) {
    addError('artistName', 'Artist name must be at least 2 characters');
    hasError = true;
  }
  
  if (message && message.length > 100) {
    addError('message', 'Message must be less than 100 characters');
    hasError = true;
  }
  
  if (hasError) return;
  
  // Disable submit button during submission
  submitButton.disabled = true;
  submitButton.textContent = 'Submitting...';
  showLoading(true);
  
  try {
    // Format inputs before submission
    const formattedTitle = formatSongTitle(songTitle);
    const formattedArtist = formatArtistName(artistName);
    
    // Check if event exists and is active
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .select('active')
      .eq('id', eventId)
      .single();
    
    if (eventError) throw new Error('Event not found');
    if (!eventData.active) throw new Error('This event has been archived');
    
    // Get count of current requests to set position
    const { data: existingRequests, error: countError } = await supabase
      .from('requests')
      .select('id')
      .eq('event_id', eventId)
      .eq('played', false);
      
    const position = existingRequests ? existingRequests.length * 100 : 0;
    
    // Submit request to Supabase with formatted values
    const { data, error } = await supabase
      .from('requests')
      .insert([
        {
          event_id: eventId,
          title: formattedTitle,
          artist: formattedArtist,
          message: message,
          position: position
        }
      ]);
    
    if (error) throw error;
    
    // Show confirmation with formatted song details
    document.getElementById('confirmedSong').textContent = formattedTitle;
    document.getElementById('confirmedArtist').textContent = formattedArtist;
    
    // Show confirmation
    requestForm.classList.add('hidden');
    confirmation.classList.remove('hidden');
    
  } catch (error) {
    alert('Error submitting request: ' + error.message);
    console.error('Error:', error);
  } finally {
    // Re-enable submit button and hide loading
    submitButton.disabled = false;
    submitButton.textContent = 'Submit Request';
    showLoading(false);
  }
});

// Add a helper function for adding error messages
function addError(fieldId, message) {
  const errorEl = document.createElement('div');
  errorEl.className = 'error';
  errorEl.textContent = message;
  document.getElementById(fieldId).parentNode.appendChild(errorEl);
}

// Make another request button
newRequestButton.addEventListener('click', () => {
  requestForm.reset();
  confirmation.classList.add('hidden');
  requestForm.classList.remove('hidden');
});

// Add some visual feedback on input focus
const inputs = document.querySelectorAll('input, textarea');
inputs.forEach(input => {
  input.addEventListener('focus', () => {
    input.parentNode.classList.add('focused');
  });
  
  input.addEventListener('blur', () => {
    input.parentNode.classList.remove('focused');
  });
});