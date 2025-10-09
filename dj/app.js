// Initialize Supabase client
const supabaseUrl = 'https://ljekmnuflfotwznxeexc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxqZWttbnVmbGZvdHd6bnhlZXhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5MjU1NzksImV4cCI6MjA3NTUwMTU3OX0.S6yzIIKRv1YlKPHstMpTFqqSpAQOuFUOqC0G27zE4FE';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Get event ID from URL parameter
const urlParams = new URLSearchParams(window.location.search);
const eventId = urlParams.get('event');

// DOM elements
const eventNameElement = document.getElementById('eventName');
const requestsListElement = document.getElementById('requestsList');
const playedListElement = document.getElementById('playedList');
const requestCountElement = document.getElementById('requestCount');
const playedCountElement = document.getElementById('playedCount');
const refreshButton = document.getElementById('refreshButton');
const exportButton = document.getElementById('exportButton');

// Auto-refresh timer
let refreshTimer;
let refreshInterval = 30; // Default refresh time in seconds

// Additional DOM elements for refresh timer
const refreshSlider = document.getElementById('refreshSlider');
const refreshIntervalDisplay = document.getElementById('refreshInterval');

// Function to start/restart the refresh timer
function startRefreshTimer() {
  // Clear any existing timer
  if (refreshTimer) {
    clearInterval(refreshTimer);
  }
  
  // Start a new timer with the current interval
  refreshTimer = setInterval(fetchRequests, refreshInterval * 1000);
  console.log(`Auto-refresh set to ${refreshInterval} seconds`);
}

// Check if event ID is provided
if (!eventId) {
  alert('No event ID provided. Please add ?event=YOUR_EVENT_ID to the URL.');
}

// Initialize the dashboard
async function initializeDashboard() {
  // Fetch event details
  if (eventId) {
    const { data: event, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();
    
    if (error) {
      console.error('Error fetching event:', error);
      eventNameElement.textContent = 'Event not found';
    } else {
      eventNameElement.textContent = event.name;
    }
  }
  
  // Fetch and display requests
  await fetchRequests();
  
  // Set up automatic refresh timer
  startRefreshTimer();
  
  // Initialize drag-and-drop for active requests
  initializeSortable();
}

// Fetch requests from Supabase
async function fetchRequests() {
  if (!eventId) return;
  
  try {
    // Fetch active requests
    const { data: activeRequests, error: activeError } = await supabase
      .from('requests')
      .select('*')
      .eq('event_id', eventId)
      .eq('played', false)
      .order('position', { ascending: true });
    
    // Fetch played requests
    const { data: playedRequests, error: playedError } = await supabase
      .from('requests')
      .select('*')
      .eq('event_id', eventId)
      .eq('played', true)
      .order('played_at', { ascending: false });
    
    if (activeError) throw activeError;
    if (playedError) throw playedError;
    
    // Display requests
    displayRequests(requestsListElement, activeRequests || []);
    displayRequests(playedListElement, playedRequests || [], true);
    
    // Update counters
    requestCountElement.textContent = activeRequests ? activeRequests.length : 0;
    playedCountElement.textContent = playedRequests ? playedRequests.length : 0;
    
  } catch (error) {
    console.error('Error fetching requests:', error);
  }
}

// Display requests in the specified container
function displayRequests(container, requests, isPlayed = false) {
  // Clear existing content
  container.innerHTML = '';
  
  // If no requests, show a message
  if (requests.length === 0) {
    const emptyMessage = document.createElement('p');
    emptyMessage.textContent = isPlayed 
      ? 'No tracks have been played yet.' 
      : 'No song requests yet.';
    emptyMessage.style.textAlign = 'center';
    emptyMessage.style.opacity = '0.7';
    container.appendChild(emptyMessage);
    return;
  }
  
  // Create request cards
  requests.forEach(request => {
    const template = document.getElementById('requestTemplate');
    const requestCard = document.importNode(template.content, true).querySelector('.request-card');
    
    // Set data attribute for identification
    requestCard.dataset.id = request.id;
    requestCard.dataset.position = request.position;
    
    // Fill in request details
    requestCard.querySelector('.song-title').textContent = request.title;
    requestCard.querySelector('.artist-name').textContent = request.artist;
    
    // Handle message - truncate if needed
    const message = request.message || '';
    requestCard.querySelector('.message').textContent = message;
    
    // Format timestamp
    const timestamp = new Date(isPlayed ? request.played_at : request.created_at);
    requestCard.querySelector('.timestamp').textContent = formatDate(timestamp);
    
    // Set up button actions
    if (!isPlayed) {
      // For active requests
      requestCard.querySelector('.star-button').addEventListener('click', () => starRequest(request.id));
      requestCard.querySelector('.play-button').addEventListener('click', () => markAsPlayed(request.id));
      requestCard.querySelector('.restore-button').style.display = 'none'; // Hide restore button
    } else {
      // For played requests
      requestCard.querySelector('.restore-button').addEventListener('click', () => restoreRequest(request.id));
      // Hide star and play buttons
      requestCard.querySelector('.star-button').style.display = 'none';
      requestCard.querySelector('.play-button').style.display = 'none';
    }
    
    requestCard.querySelector('.delete-button').addEventListener('click', () => deleteRequest(request.id));
    
    // Add to container
    container.appendChild(requestCard);
  });
}

// Initialize SortableJS for drag-and-drop
function initializeSortable() {
  new Sortable(requestsListElement, {
    animation: 150,
    ghostClass: 'sortable-ghost',
    chosenClass: 'sortable-chosen',
    onEnd: async function(evt) {
      const requestId = evt.item.dataset.id;
      const newPosition = evt.newIndex;
      
      try {
        // Update position in database
        const { error } = await supabase
          .from('requests')
          .update({ position: newPosition })
          .eq('id', requestId);
        
        if (error) throw error;
        
        // Re-fetch requests to ensure correct ordering
        fetchRequests();
      } catch (error) {
        console.error('Error updating position:', error);
      }
    }
  });
}

// Mark request as played
async function markAsPlayed(requestId) {
  try {
    const { error } = await supabase
      .from('requests')
      .update({ 
        played: true,
        played_at: new Date().toISOString()
      })
      .eq('id', requestId);
    
    if (error) throw error;
    
    // Re-fetch requests
    fetchRequests();
  } catch (error) {
    console.error('Error marking as played:', error);
  }
}

// Delete request
async function deleteRequest(requestId) {
  if (!confirm('Are you sure you want to delete this request?')) return;
  
  try {
    const { error } = await supabase
      .from('requests')
      .delete()
      .eq('id', requestId);
    
    if (error) throw error;
    
    // Re-fetch requests
    fetchRequests();
  } catch (error) {
    console.error('Error deleting request:', error);
  }
}

// Helper function to format dates
function formatDate(date) {
  // Check if date is valid
  if (!(date instanceof Date) || isNaN(date)) {
    // If date is invalid, try to parse it as string
    try {
      date = new Date(date);
    } catch (e) {
      return ""; // Return empty if can't parse
    }
  }
  
  // If date is still invalid, return a placeholder
  if (isNaN(date.getTime())) {
    return "";
  }
  
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

// Export playlist to text file
exportButton.addEventListener('click', async function() {
  try {
    // Fetch all requests
    const { data: allRequests, error } = await supabase
      .from('requests')
      .select('*')
      .eq('event_id', eventId)
      .order('played', { ascending: false })
      .order('position', { ascending: true });
    
    if (error) throw error;
    
    // Create text content
    let exportText = "DJ PLAYLIST\n\n";
    
    // Active requests
    exportText += "PENDING REQUESTS:\n";
    const activeRequests = allRequests.filter(req => !req.played);
    if (activeRequests.length === 0) {
      exportText += "- None\n";
    } else {
      activeRequests.forEach((req, index) => {
        exportText += `${index + 1}. "${req.title}" by ${req.artist}\n`;
      });
    }
    
    exportText += "\nPLAYED SONGS:\n";
    const playedRequests = allRequests.filter(req => req.played);
    if (playedRequests.length === 0) {
      exportText += "- None\n";
    } else {
      playedRequests.forEach((req, index) => {
        exportText += `${index + 1}. "${req.title}" by ${req.artist}\n`;
      });
    }
    
    // Create and download file
    const blob = new Blob([exportText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dj-playlist-${new Date().toISOString().slice(0,10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
  } catch (error) {
    console.error('Error exporting playlist:', error);
    alert('Failed to export playlist');
  }
});

// Refresh button handler
refreshButton.addEventListener('click', fetchRequests);

// Update interval when slider changes
refreshSlider.addEventListener('input', function() {
  refreshInterval = parseInt(this.value);
  refreshIntervalDisplay.textContent = refreshInterval;
});

refreshSlider.addEventListener('change', function() {
  startRefreshTimer();
});

// Initialize the dashboard when the page loads
document.addEventListener('DOMContentLoaded', initializeDashboard);

// Add these variables with other DOM elements
const filterInput = document.getElementById('requestFilter');
const clearFilterButton = document.getElementById('clearFilter');

// Add filter functionality
filterInput.addEventListener('input', filterRequests);
clearFilterButton.addEventListener('click', clearFilter);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && document.activeElement === filterInput) {
    clearFilter();
  }
});

function filterRequests() {
  const filterText = filterInput.value.toLowerCase();
  const cards = requestsListElement.querySelectorAll('.request-card');
  
  if (!filterText) {
    cards.forEach(card => card.style.display = '');
    return;
  }
  
  cards.forEach(card => {
    const title = card.querySelector('.song-title').textContent.toLowerCase();
    const artist = card.querySelector('.artist-name').textContent.toLowerCase();
    const message = card.querySelector('.message').textContent.toLowerCase();
    
    if (title.includes(filterText) || artist.includes(filterText) || message.includes(filterText)) {
      card.style.display = '';
    } else {
      card.style.display = 'none';
    }
  });
}

function clearFilter() {
  filterInput.value = '';
  filterRequests();
  filterInput.blur();
}

// Mark request as starred (move to top)
async function starRequest(requestId) {
  try {
    // Get all requests to find the lowest position
    const { data: requests, error: fetchError } = await supabase
      .from('requests')
      .select('position')
      .eq('event_id', eventId)
      .eq('played', false)
      .order('position', { ascending: true });
    
    if (fetchError) throw fetchError;
    
    // Calculate a position value that will put this at the top
    let topPosition = 0;
    if (requests && requests.length > 0) {
      const minPosition = Math.min(...requests.map(r => r.position || 0));
      topPosition = minPosition - 1;
    }
    
    // Update the position to move it to the top
    const { error: updateError } = await supabase
      .from('requests')
      .update({ position: topPosition })
      .eq('id', requestId);
    
    if (updateError) throw updateError;
    
    // Re-fetch requests to update the UI
    fetchRequests();
  } catch (error) {
    console.error('Error starring request:', error);
  }
}

// Restore request from played to active queue
async function restoreRequest(requestId) {
  try {
    const { error } = await supabase
      .from('requests')
      .update({ 
        played: false,
        played_at: null
      })
      .eq('id', requestId);
    
    if (error) throw error;
    
    // Re-fetch requests
    fetchRequests();
  } catch (error) {
    console.error('Error restoring request:', error);
  }
}

// Sidebar toggle functionality
const sidebarToggle = document.getElementById('sidebarToggle');
const dashboardContent = document.querySelector('.dashboard-content');

sidebarToggle.addEventListener('click', function() {
  dashboardContent.classList.toggle('sidebar-collapsed');
  
  // Re-fetch requests when sidebar is toggled to ensure proper layout
  setTimeout(() => {
    fetchRequests();
  }, 300); // Wait for transition to complete
});

// Start with sidebar expanded by default
// To start collapsed, uncomment the next line:
dashboardContent.classList.add('sidebar-collapsed');

// Add event listener for Restore All button
document.getElementById('restoreAllButton').addEventListener('click', restoreAllRequests);

// Function to restore all played requests
async function restoreAllRequests() {
  if (!confirm('Are you sure you want to move all played tracks back to the requests list?')) {
    return;
  }
  
  try {
    const { data: playedRequests, error: fetchError } = await supabase
      .from('requests')
      .select('id')
      .eq('event_id', eventId)
      .eq('played', true);
    
    if (fetchError) throw fetchError;
    
    if (!playedRequests || playedRequests.length === 0) {
      alert('No played tracks to restore.');
      return;
    }
    
    // Update all played requests to unplayed
    const { error: updateError } = await supabase
      .from('requests')
      .update({ 
        played: false,
        played_at: null
      })
      .eq('event_id', eventId)
      .eq('played', true);
    
    if (updateError) throw updateError;
    
    // Re-fetch requests
    fetchRequests();
    
  } catch (error) {
    console.error('Error restoring all requests:', error);
    alert('Failed to restore all requests: ' + error.message);
  }
}