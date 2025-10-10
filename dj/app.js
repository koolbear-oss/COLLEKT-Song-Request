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
async function fetchRequests(resetStarred = true) {
  if (!eventId) return;
  
  try {
    // Fetch active requests
    const { data: activeRequests, error: activeError } = await supabase
      .from('requests')
      .select('*')
      .eq('event_id', eventId)
      .eq('played', false)
      .order('is_starred', { ascending: false }) // Starred items first
      .order('position', { ascending: true });   // Then by position
    
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
    
    // Mark starred items based on is_starred flag
    if (!isPlayed && request.is_starred) {
      requestCard.classList.add('starred');
    }
    
    // Fill in request details
    requestCard.querySelector('.song-title').textContent = request.title;
    requestCard.querySelector('.artist-name').textContent = request.artist;
    
    // Handle message - truncate if needed
    const message = request.message || '';
    requestCard.querySelector('.message').textContent = truncateComment(message);
    
    // Add title for tooltip on hover for long messages
    if (message.length > 40) {
      requestCard.querySelector('.message').setAttribute('title', message);
    }
    
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

// Function to truncate comments to specified length
function truncateComment(comment, maxLength = 40) {
  if (!comment || comment.length <= maxLength) {
    return comment;
  }
  
  // Find a good break point around the middle
  const breakPoint = Math.min(maxLength, Math.floor(maxLength / 2) + 
                             comment.substring(Math.floor(maxLength / 2), maxLength).indexOf(' '));
  
  if (breakPoint <= 0 || breakPoint >= maxLength) {
    // If no good break point found, just truncate
    return comment.substring(0, maxLength) + '...';
  }
  
  return comment.substring(0, breakPoint) + '...';
}

// Initialize SortableJS for drag-and-drop with anchor points
function initializeSortable() {
  new Sortable(requestsListElement, {
    animation: 150,
    ghostClass: 'sortable-ghost',
    chosenClass: 'sortable-chosen',
    dragClass: 'sortable-drag',
    
    // Prevent grid disruption during drag
    forceFallback: true,
    fallbackClass: 'sortable-fallback',
    fallbackOnBody: false, // Keep the ghost element within the container
    
    // Prevent text selection
    preventDefaultOnFilter: true,
    
    // Use a customized approach for indicators
    onStart: function(evt) {
      document.body.classList.add('dragging');
      
      // Create a single indicator that follows the mouse
      const indicator = document.createElement('div');
      indicator.className = 'active-drop-indicator';
      document.body.appendChild(indicator);
      
      // Store the original item dimensions for proper placeholder
      const rect = evt.item.getBoundingClientRect();
      evt.item.style.width = rect.width + 'px';
      evt.item.style.height = rect.height + 'px';
    },
    
    onMove: function(evt) {
      // Update indicator position
      const indicator = document.querySelector('.active-drop-indicator');
      if (indicator) {
        const mousePosition = evt.originalEvent;
        
        // Find the nearest drop point in the grid
        const dropPoint = findNearestDropPoint(evt, mousePosition);
        
        if (dropPoint) {
          // Position the indicator at the drop point
          indicator.style.top = dropPoint.top + 'px';
          indicator.style.left = dropPoint.left + 'px';
          indicator.style.width = dropPoint.width + 'px';
          indicator.style.height = '4px';
          indicator.style.display = 'block';
          
          // Store the target index
          indicator.dataset.targetIndex = dropPoint.index;
        } else {
          indicator.style.display = 'none';
        }
      }
      
      // Allow the move
      return true;
    },
    
    onEnd: async function(evt) {
      document.body.classList.remove('dragging');
      
      // Get the active indicator
      const indicator = document.querySelector('.active-drop-indicator');
      let targetIndex = evt.newIndex; // Default
      
      // Use the indicator's target index if available
      if (indicator && indicator.dataset.targetIndex) {
        targetIndex = parseInt(indicator.dataset.targetIndex);
        indicator.remove();
      }
      
      // Skip if nothing changed
      if (evt.oldIndex === targetIndex) return;
      
      const requestId = evt.item.dataset.id;
      
      try {
        // Get all requests to calculate new position
        const { data: requests, error: fetchError } = await supabase
          .from('requests')
          .select('id, position, is_starred')
          .eq('event_id', eventId)
          .eq('played', false)
          .order('is_starred', { ascending: false })
          .order('position', { ascending: true });
        
        if (fetchError) throw fetchError;
        
        const newPosition = calculateNewPosition(requests, targetIndex);
        
        // Update the position
        const { error: updateError } = await supabase
          .from('requests')
          .update({ position: newPosition })
          .eq('id', requestId);
        
        if (updateError) throw updateError;
        
        // Refresh the request list
        fetchRequests();
      } catch (error) {
        console.error('Error updating position:', error);
      }
    }
  });
}

// Find the nearest drop point in the grid
function findNearestDropPoint(evt, mousePosition) {
  const container = requestsListElement;
  const cards = Array.from(container.querySelectorAll('.request-card'));
  
  if (cards.length === 0) {
    // If no cards, return position for first card
    const containerRect = container.getBoundingClientRect();
    return {
      top: containerRect.top + 10,
      left: containerRect.left + 10,
      width: containerRect.width - 20,
      index: 0
    };
  }
  
  // Get mouse position
  const mouseX = mousePosition.clientX;
  const mouseY = mousePosition.clientY;
  
  // Map all possible drop positions (between cards)
  const dropPositions = [];
  
  // First position (before first card)
  const firstCard = cards[0];
  const firstRect = firstCard.getBoundingClientRect();
  dropPositions.push({
    top: firstRect.top - 5,
    left: firstRect.left,
    width: firstRect.width,
    index: 0,
    distance: Math.abs(mouseY - (firstRect.top - 5))
  });
  
  // Between cards
  for (let i = 0; i < cards.length - 1; i++) {
    const card = cards[i];
    const nextCard = cards[i + 1];
    const rect = card.getBoundingClientRect();
    const nextRect = nextCard.getBoundingClientRect();
    
    // If cards are on the same row
    if (Math.abs(rect.top - nextRect.top) < 20) {
      dropPositions.push({
        top: rect.top + rect.height / 2,
        left: rect.right + 5,
        width: nextRect.left - rect.right - 10,
        index: i + 1,
        distance: Math.abs(mouseX - (rect.right + (nextRect.left - rect.right) / 2))
      });
    } else {
      // End of row
      dropPositions.push({
        top: rect.bottom + 5,
        left: rect.left,
        width: rect.width,
        index: i + 1,
        distance: Math.abs(mouseY - (rect.bottom + 5))
      });
    }
  }
  
  // Last position (after last card)
  const lastCard = cards[cards.length - 1];
  const lastRect = lastCard.getBoundingClientRect();
  dropPositions.push({
    top: lastRect.bottom + 5,
    left: lastRect.left,
    width: lastRect.width,
    index: cards.length,
    distance: Math.abs(mouseY - (lastRect.bottom + 5))
  });
  
  // Find the closest drop position
  dropPositions.sort((a, b) => a.distance - b.distance);
  return dropPositions[0];
}

// Add drop indicators between items
function addDropIndicators() {
  const cards = requestsListElement.querySelectorAll('.request-card');
  
  // Add indicator before first card
  const firstIndicator = document.createElement('div');
  firstIndicator.className = 'drop-indicator';
  firstIndicator.dataset.position = 0;
  requestsListElement.insertBefore(firstIndicator, cards[0]);
  
  // Add indicators between cards
  cards.forEach((card, index) => {
    if (index < cards.length - 1) {
      const indicator = document.createElement('div');
      indicator.className = 'drop-indicator';
      indicator.dataset.position = index + 1;
      requestsListElement.insertBefore(indicator, card.nextSibling);
    }
  });
  
  // Add indicator after last card
  const lastIndicator = document.createElement('div');
  lastIndicator.className = 'drop-indicator';
  lastIndicator.dataset.position = cards.length;
  requestsListElement.appendChild(lastIndicator);
}

// Update which drop indicator is highlighted
function updateDropIndicatorHighlight(evt) {
  // Clear previous highlights
  document.querySelectorAll('.drop-indicator.highlight').forEach(el => {
    el.classList.remove('highlight');
  });
  
  // Get mouse position
  const mouseY = evt.originalEvent.clientY;
  const mouseX = evt.originalEvent.clientX;
  
  // Find closest indicator
  const indicators = document.querySelectorAll('.drop-indicator');
  let closestIndicator = null;
  let closestDistance = Infinity;
  
  indicators.forEach(indicator => {
    const rect = indicator.getBoundingClientRect();
    const indicatorX = rect.left + rect.width / 2;
    const indicatorY = rect.top + rect.height / 2;
    
    const distance = Math.sqrt(
      Math.pow(mouseX - indicatorX, 2) + 
      Math.pow(mouseY - indicatorY, 2)
    );
    
    if (distance < closestDistance) {
      closestDistance = distance;
      closestIndicator = indicator;
    }
  });
  
  if (closestIndicator) {
    closestIndicator.classList.add('highlight');
  }
}

// Remove all drop indicators
function removeDropIndicators() {
  document.querySelectorAll('.drop-indicator').forEach(el => {
    el.remove();
  });
}

// Calculate position value based on surrounding items
function calculateNewPosition(requests, newIndex) {
  if (!requests || requests.length === 0) return 0;
  
  // Sort by position
  const sorted = [...requests].sort((a, b) => a.position - b.position);
  
  // Keep starred items at top
  const starredItems = sorted.filter(item => item.is_starred);
  const unstarredItems = sorted.filter(item => !item.is_starred);
  
  // If dropping at position 0
  if (newIndex <= 0) {
    return (sorted[0].position || 0) - 10;
  }
  
  // If dropping at last position
  if (newIndex >= sorted.length) {
    return (sorted[sorted.length - 1].position || 0) + 10;
  }
  
  // Dropping in the middle - calculate position between items
  const beforePos = sorted[newIndex - 1].position || 0;
  const afterPos = sorted[newIndex].position || 0;
  return (beforePos + afterPos) / 2;
}

// Helper function to calculate new position
function calculateNewPosition(requests, newIndex) {
  if (!requests || requests.length === 0) return 0;
  
  // Sort by position
  const sorted = [...requests].sort((a, b) => a.position - b.position);
  
  if (newIndex <= 0) {
    // Moving to start - use position smaller than first item
    return sorted[0].position - 10;
  } else if (newIndex >= sorted.length) {
    // Moving to end - use position larger than last item
    return sorted[sorted.length - 1].position + 10;
  } else {
    // Moving to middle - use position between two items
    return (sorted[newIndex - 1].position + sorted[newIndex].position) / 2;
  }
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
    // Add visual feedback immediately
    const requestCard = document.querySelector(`.request-card[data-id="${requestId}"]`);
    
    // Toggle starred status
    const isCurrentlyStarred = requestCard.classList.contains('starred');
    
    if (isCurrentlyStarred) {
      // Unstar the item
      requestCard.classList.remove('starred');
      
      // Update in database - assign normal position
      const { error } = await supabase
        .from('requests')
        .update({ 
          is_starred: false,
          // No need to change position
        })
        .eq('id', requestId);
      
      if (error) throw error;
    } else {
      // Star the item
      requestCard.classList.add('starred');
      
      const starButton = requestCard.querySelector('.star-button');
      starButton.classList.add('animate');
      
      // Remove animation class after it completes
      setTimeout(() => {
        starButton.classList.remove('animate');
      }, 300);
      
      // Get all starred requests to find lowest position
      const { data: starredRequests, error: starredError } = await supabase
        .from('requests')
        .select('position')
        .eq('event_id', eventId)
        .eq('played', false)
        .eq('is_starred', true)
        .order('position', { ascending: true });
      
      if (starredError) throw starredError;
      
      // Calculate position to put at top of starred items
      let topPosition = -1000; // Default position for first starred item
      
      if (starredRequests && starredRequests.length > 0) {
        // Put before the first starred item
        topPosition = Math.min(...starredRequests.map(r => r.position || 0)) - 10;
      }
      
      // Update in database
      const { error } = await supabase
        .from('requests')
        .update({ 
          is_starred: true,
          position: topPosition
        })
        .eq('id', requestId);
      
      if (error) throw error;
    }
    
    // Re-fetch requests
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

// Navigation button event listeners
document.getElementById('backToEventsButton').addEventListener('click', navigateToEvents);
document.getElementById('viewQrButton').addEventListener('click', openQrDisplay);
document.getElementById('guestFormButton').addEventListener('click', openGuestForm);

// Navigation functions
function navigateToEvents() {
  window.location.href = '../admin/';
}

function openQrDisplay() {
  if (!eventId) return;
  
  // Open QR display in new tab
  window.open(`../display.html?event=${eventId}&message=Request%20Your%20Song`, '_blank');
}

function openGuestForm() {
  if (!eventId) return;
  
  // Open guest form in new tab
  window.open(`../guest/?event=${eventId}`, '_blank');
}