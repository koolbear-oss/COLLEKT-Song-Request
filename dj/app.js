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
const settingsButton = document.getElementById('settingsButton');
const settingsPopup = document.getElementById('settingsPopup');

// Auto-refresh timer
let refreshTimer;
let refreshInterval = 30; // Default refresh time in seconds
let lastRequestsCheck = new Date().getTime();

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
  // Check if user is logged in
  if (!localStorage.getItem('isLoggedIn')) {
    alert('Your session has expired. Please log in again.');
    window.location.href = '../admin/login.html';
    return;
  }
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
    
    // Identify new requests (added since last check)
    const newRequests = activeRequests ? activeRequests.filter(req => {
      const requestTime = new Date(req.created_at).getTime();
      return requestTime > lastRequestsCheck;
    }) : [];

    // Update the last check time
    lastRequestsCheck = new Date().getTime();

    // Display requests and highlight new ones
    displayRequests(requestsListElement, activeRequests || [], false, newRequests.map(r => r.id));

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
function displayRequests(container, requests, isPlayed = false, newRequestIds = []) {
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

    // Highlight new requests
    if (!isPlayed && newRequestIds.includes(request.id)) {
      requestCard.classList.add('new-request');
      // Auto-remove highlight after 30 seconds
      setTimeout(() => {
        const card = document.querySelector(`.request-card[data-id="${request.id}"]`);
        if (card) {
          card.classList.remove('new-request');
        }
      }, 30000);
    }
    
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

    requestCard.querySelector('.copy-button').addEventListener('click', () => {
      const songTitle = request.title;
      const artistName = request.artist;
      copyForSeratoSearch(songTitle, artistName);
    });
    
    // Add to container
    container.appendChild(requestCard);
  });
}

// Function to copy song and artist for Serato search
function copyForSeratoSearch(songTitle, artistName) {
  const searchText = `${songTitle} ${artistName}`;
  
  // Create a temporary textarea element to copy the text
  const textarea = document.createElement('textarea');
  textarea.value = searchText;
  document.body.appendChild(textarea);
  
  // Select and copy the text
  textarea.select();
  document.execCommand('copy');
  
  // Remove the temporary textarea
  document.body.removeChild(textarea);
  
  // Show feedback
  showTempMessage('Copied for Serato search', 'info');
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

// Initialize SortableJS for drag-and-drop
function initializeSortable() {
  new Sortable(requestsListElement, {
    animation: 200,
    ghostClass: 'sortable-ghost',
    chosenClass: 'sortable-chosen',
    dragClass: 'sortable-drag',
    
    // Enhanced drag settings
    forceFallback: false,
    fallbackTolerance: 3,
    fallbackOnBody: false,
    
    // CRITICAL: Disable swap behavior to enable insertion between cards
    swap: false,
    invertSwap: false,
    
    // Enable insertion between items
    direction: 'horizontal', // This enables horizontal insertion
    dragClass: 'sortable-drag',
    
    // Make entire card draggable
    handle: '.request-card',
    
    // Touch settings
    touchStartThreshold: 5,
    supportPointer: true,
    
    onStart: function(evt) {
      document.body.classList.add('dragging');
      evt.item.classList.add('being-dragged');
      
      // Add visual feedback for all cards during drag
      const allCards = requestsListElement.querySelectorAll('.request-card');
      allCards.forEach(card => {
        if (card !== evt.item) {
          card.classList.add('drag-inactive');
        }
      });
    },
    
    onMove: function(evt) {
      // This creates the insertion point visual feedback
      return true; // Allow moving between all containers
    },
    
    onEnd: async function(evt) {
      document.body.classList.remove('dragging');
      evt.item.classList.remove('being-dragged');
      
      // Remove visual feedback from all cards
      const allCards = requestsListElement.querySelectorAll('.request-card');
      allCards.forEach(card => {
        card.classList.remove('drag-inactive');
      });
      
      // Skip if nothing changed or dropped outside
      if (evt.oldIndex === evt.newIndex || evt.newIndex === undefined || evt.newIndex === null) return;
      
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
        
        // Use the enhanced position calculation
        const newPosition = calculateNewPosition(requests, evt.newIndex, requestId);
        
        if (newPosition === 'bulk_update_needed') {
          // Bulk renumber all items for clean positions
          await renumberAllPositions(requests, requestId, evt.newIndex);
        } else {
          // Single item update
          const { error: updateError } = await supabase
            .from('requests')
            .update({ position: newPosition })
            .eq('id', requestId);
          
          if (updateError) throw updateError;
        }
        
        // Refresh the request list
        await fetchRequests();
      } catch (error) {
        console.error('Error updating position:', error);
        // Show user feedback
        showTempMessage('Failed to update order. Reverting...', 'error');
        // Revert on error
        await fetchRequests();
      }
    }
  });
}

// Helper function to calculate new position
function calculateNewPosition(requests, newIndex, draggedId) {
  if (!requests || requests.length === 0) return 100; // Start with 100
  
  // Filter out the dragged item and sort by position
  const otherRequests = requests.filter(req => req.id !== draggedId)
    .sort((a, b) => a.position - b.position);
  
  if (newIndex <= 0) {
    // Moving to start - position before first item
    return otherRequests[0].position - 100;
  } else if (newIndex >= otherRequests.length) {
    // Moving to end - position after last item
    return otherRequests[otherRequests.length - 1].position + 100;
  } else {
    // Moving between items - calculate position between two adjacent items
    const prevItem = otherRequests[newIndex - 1];
    const nextItem = otherRequests[newIndex];
    
    // If positions are sequential, use midpoint
    if (nextItem.position - prevItem.position > 1) {
      return Math.round((prevItem.position + nextItem.position) / 2);
    } else {
      // Positions are too close, need to renumber
      return 'bulk_update_needed';
    }
  }
}

// Bulk renumber all positions to ensure clean ordering
async function renumberAllPositions(requests, draggedId, newIndex) {
  try {
    // Simple approach: assign clean positions to all items
    const allRequests = [...requests];
    const draggedItem = allRequests.find(req => req.id === draggedId);
    
    // Remove dragged item and reinsert at new position
    const otherRequests = allRequests.filter(req => req.id !== draggedId);
    const reorderedRequests = [
      ...otherRequests.slice(0, newIndex),
      draggedItem,
      ...otherRequests.slice(newIndex)
    ];
    
    // Assign clean positions (100, 200, 300, etc.)
    const updates = reorderedRequests.map((request, index) => ({
      id: request.id,
      position: (index + 1) * 100
    }));
    
    // Update positions one by one to avoid complex upsert
    for (const update of updates) {
      const { error } = await supabase
        .from('requests')
        .update({ position: update.position })
        .eq('id', update.id)
        .eq('event_id', eventId);
      
      if (error) throw error;
    }
    
  } catch (error) {
    console.error('Error in bulk renumbering:', error);
    throw error;
  }
}

// Show temporary message to user
function showTempMessage(message, type = 'info') {
  const messageEl = document.createElement('div');
  messageEl.textContent = message;
  messageEl.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    background: ${type === 'error' ? '#f44336' : '#4caf50'};
    color: white;
    border-radius: 4px;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    font-weight: bold;
  `;
  
  document.body.appendChild(messageEl);
  
  setTimeout(() => {
    document.body.removeChild(messageEl);
  }, 3000);
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
  
  cards.forEach(card => {
    // First check if the card should be hidden by quick filter
    let showByQuickFilter = true;
    if (activeFilter === 'starred' && !card.classList.contains('starred')) {
      showByQuickFilter = false;
    } else if (activeFilter === 'new' && !card.classList.contains('new-request')) {
      showByQuickFilter = false;
    }
    
    // If it passes the quick filter, then check text filter
    if (showByQuickFilter) {
      if (!filterText) {
        card.style.display = '';
        return;
      }
      
      const title = card.querySelector('.song-title').textContent.toLowerCase();
      const artist = card.querySelector('.artist-name').textContent.toLowerCase();
      const message = card.querySelector('.message').textContent.toLowerCase();
      
      if (title.includes(filterText) || artist.includes(filterText) || message.includes(filterText)) {
        card.style.display = '';
      } else {
        card.style.display = 'none';
      }
    } else {
      card.style.display = 'none';
    }
  });
}

const quickFilterButtons = document.querySelectorAll('.quick-filter-button');

// Initialize active filter
let activeFilter = 'all';

quickFilterButtons.forEach(button => {
  button.addEventListener('click', () => {
    const filterType = button.getAttribute('data-filter');
    
    // Toggle active class on buttons
    quickFilterButtons.forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
    
    // Apply filter
    applyQuickFilter(filterType);
  });
});

function applyQuickFilter(filterType) {
  activeFilter = filterType;
  const cards = requestsListElement.querySelectorAll('.request-card');
  
  cards.forEach(card => {
    switch (filterType) {
      case 'starred':
        card.style.display = card.classList.contains('starred') ? '' : 'none';
        break;
      case 'new':
        card.style.display = card.classList.contains('new-request') ? '' : 'none';
        break;
      case 'all':
      default:
        card.style.display = '';
        break;
    }
  });
  
  // If text filter is also active, re-apply it
  if (filterInput.value) {
    filterRequests();
  }
}

function clearFilter() {
  filterInput.value = '';
  
  // Reset active quick filter
  activeFilter = 'all';
  quickFilterButtons.forEach(btn => {
    btn.classList.remove('active');
    if (btn.getAttribute('data-filter') === 'all') {
      btn.classList.add('active');
    }
  });
  
  // Show all cards
  const cards = requestsListElement.querySelectorAll('.request-card');
  cards.forEach(card => card.style.display = '');
  
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

// Toggle settings popup
settingsButton.addEventListener('click', function(e) {
    e.stopPropagation();
    settingsPopup.classList.toggle('show');
});

// Close popup when clicking outside
document.addEventListener('click', function(e) {
    if (!settingsPopup.contains(e.target) && 
        e.target !== settingsButton && 
        !settingsButton.contains(e.target)) {
        settingsPopup.classList.remove('show');
    }
});

// Close popup when pressing Escape key
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && settingsPopup.classList.contains('show')) {
        settingsPopup.classList.remove('show');
        settingsButton.focus();
    }
});

// Prevent popup from closing when clicking inside it
settingsPopup.addEventListener('click', function(e) {
    e.stopPropagation();
});