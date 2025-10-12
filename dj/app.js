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

// With this more precise declaration:
let filterInput = null;
let clearFilterButton = null;
let activeFilter = 'all';  // This needs to be globally available for filter functions

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

  // Simple, safe filter clear operation
  try {
    const filterInput = document.getElementById('requestFilter');
    if (filterInput) {
      filterInput.value = '';
      console.log("Cleared filter field on initialization");
    }
  } catch (e) {
    console.error("Error clearing filter:", e);
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
    console.log("All active requests:", activeRequests);

    // Display requests and highlight new ones
    displayRequests(requestsListElement, activeRequests || [], false, newRequests.map(r => r.id));
    displayRequests(playedListElement, playedRequests || [], true);
    
    // Update counters
    requestCountElement.textContent = activeRequests ? activeRequests.length : 0;
    playedCountElement.textContent = playedRequests ? playedRequests.length : 0;
    
  } catch (error) {
    console.error('Error fetching requests:', error);
  }

  // NEW: Update enhance button visibility
  await updateEnhanceAllButton();
}

// Display requests in the specified container
function displayRequests(container, requests, isPlayed = false, newRequestIds = []) {
  console.log("Displaying requests in container:", container.id);
  console.log("Number of requests to display:", requests.length);
  
  // Add individual request logging
  requests.forEach((req, index) => {
    console.log(`Request ${index}:`, req.title, "by", req.artist);
  });
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
    
    // Show metadata for Pro users if available
    const isPro = localStorage.getItem('userRole') === 'Pro DJ' || localStorage.getItem('userRole') === 'Admin';
    const metadataContainer = requestCard.querySelector('.metadata-container');
    const keyBadge = requestCard.querySelector('.key-badge');
    const bpmBadge = requestCard.querySelector('.bpm-badge');

    if (isPro && !isPlayed) {
      // Show key if available
      if (request.key) {
        keyBadge.textContent = request.key;
        keyBadge.style.display = 'inline-block';
      } else {
        keyBadge.style.display = 'none';
      }
      
      // Show BPM if available
      if (request.bpm) {
        bpmBadge.textContent = request.bpm;
        bpmBadge.style.display = 'inline-block';
      } else {
        bpmBadge.style.display = 'none';
      }
      
      // Only show container if we have data
      metadataContainer.style.display = (request.key || request.bpm) ? 'flex' : 'none';
    } else {
      // Hide metadata for non-Pro users
      metadataContainer.style.display = 'none';
    }

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

    // Add enhance button for debugging (Pro users only)
    if (isPro && !isPlayed && !request.enhanced_by_ai) {
      // Create enhance button
      const enhanceButton = document.createElement('button');
      enhanceButton.innerText = '🧠';
      enhanceButton.title = 'Enhance with AI';
      enhanceButton.className = 'enhance-button'; // Add this class
      
      // Improve visibility
      enhanceButton.style.fontSize = '16px'; // Make slightly larger
      enhanceButton.style.padding = '0';
      enhanceButton.style.width = '28px';
      enhanceButton.style.height = '28px';
      enhanceButton.style.borderRadius = '50%';
      enhanceButton.style.backgroundColor = 'rgba(138, 43, 226, 0.2)'; // Add background color
      enhanceButton.style.border = '1px solid rgba(138, 43, 226, 0.5)'; // Add border color
      enhanceButton.style.color = '#8a2be2';
      enhanceButton.style.display = 'flex';
      enhanceButton.style.alignItems = 'center';
      enhanceButton.style.justifyContent = 'center';
      enhanceButton.style.marginLeft = '5px';
      
      // Add click event
      enhanceButton.addEventListener('click', async () => {
        console.log('Manually enhancing request:', request.title);
        enhanceButton.disabled = true;
        enhanceButton.innerText = '⏳';
        const enhanced = await enhanceAndUpdateTrack(request);
        console.log('Enhancement result:', enhanced);
        fetchRequests(false); // Refresh display
      });
      
      // Add to actions
      requestCard.querySelector('.request-actions').appendChild(enhanceButton);
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

// Archive (soft delete) request instead of permanently deleting
async function deleteRequest(requestId) {
  if (!confirm('Delete this request? It will be moved to archive.')) return;
  
  try {
    // STEP 1: Get the full request data before deleting
    const { data: request, error: fetchError } = await supabase
      .from('requests')
      .select('*')
      .eq('id', requestId)
      .single();
    
    if (fetchError) throw fetchError;
    
    // STEP 2: Insert into deleted_requests table
    const { error: archiveError } = await supabase
      .from('deleted_requests')
      .insert([{
        original_request_id: request.id,
        event_id: request.event_id,
        title: request.title,
        artist: request.artist,
        message: request.message,
        original_title: request.original_title,
        original_artist: request.original_artist,
        key: request.key,
        bpm: request.bpm,
        enhanced_by_ai: request.enhanced_by_ai,
        is_starred: request.is_starred,
        position: request.position,
        created_at: request.created_at,
        played: request.played,
        played_at: request.played_at,
        deleted_by: localStorage.getItem('userEmail'),
        deletion_reason: 'manual_delete' // Can be made dynamic later
      }]);
    
    if (archiveError) throw archiveError;
    
    // STEP 3: Now delete from requests table
    const { error: deleteError } = await supabase
      .from('requests')
      .delete()
      .eq('id', requestId);
    
    if (deleteError) throw deleteError;
    
    // STEP 4: Show success feedback
    showTempMessage('Request archived', 'success');
    
    // STEP 5: Refresh display
    fetchRequests();
    
  } catch (error) {
    console.error('Error archiving request:', error);
    showTempMessage('Failed to delete request: ' + error.message, 'error');
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

// Show/hide Enhance All button based on unenhanced tracks
async function updateEnhanceAllButton() {
  // Only for Pro/Admin users
  const isPro = localStorage.getItem('userRole') === 'Pro DJ' || 
                localStorage.getItem('userRole') === 'Admin';
  
  if (!isPro) return;
  
  const enhanceAllButton = document.getElementById('enhanceAllButton');
  if (!enhanceAllButton) return;
  
  try {
    // Get count of unenhanced tracks
    const unenhanced = await getUnenhancedTracks();
    const count = unenhanced.length;
    
    if (count > 0) {
      document.getElementById('enhanceCount').textContent = count;
      enhanceAllButton.style.display = 'flex';
    } else {
      enhanceAllButton.style.display = 'none';
    }
  } catch (error) {
    console.error('Error updating enhance button:', error);
    enhanceAllButton.style.display = 'none';
  }
}

// Create and show progress modal
function showEnhancementModal() {
  const modal = document.createElement('div');
  modal.className = 'enhancement-modal';
  modal.id = 'enhancementModal';
  modal.innerHTML = `
    <div class="enhancement-modal-content">
      <h2>Enhancing Tracks</h2>
      <div class="enhancement-progress">
        <div class="progress-bar">
          <div class="progress-fill" id="progressFill" style="width: 0%"></div>
        </div>
        <p id="progressText">Starting...</p>
        <p class="current-track" id="currentTrack"></p>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  return modal;
}

// Update progress modal
function updateEnhancementProgress(progress) {
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');
  const currentTrack = document.getElementById('currentTrack');
  
  if (progressFill && progressText && currentTrack) {
    const percentage = Math.round((progress.current / progress.total) * 100);
    progressFill.style.width = `${percentage}%`;
    progressText.textContent = `Enhancing ${progress.current} of ${progress.total}`;
    currentTrack.textContent = progress.currentTrack;
  }
}

// Close progress modal
function closeEnhancementModal() {
  const modal = document.getElementById('enhancementModal');
  if (modal) {
    modal.remove();
  }
}

// Main bulk enhancement handler
async function handleBulkEnhancement() {
  const enhanceAllButton = document.getElementById('enhanceAllButton');
  
  // STEP 1: Create processing flag for beforeunload
  let isProcessing = false;
  
  // STEP 2: Define the beforeunload handler
  const beforeUnloadHandler = (e) => {
    if (isProcessing) {
      e.preventDefault();
      e.returnValue = 'Enhancement in progress. Are you sure you want to leave?';
      return e.returnValue; // Some browsers need this
    }
  };
  
  try {
    // Disable button
    enhanceAllButton.disabled = true;
    
    // Get unenhanced tracks
    const unenhanced = await getUnenhancedTracks();
    
    if (unenhanced.length === 0) {
      showTempMessage('No tracks to enhance', 'info');
      return;
    }
    
    // Confirm with user
    if (!confirm(`Enhance ${unenhanced.length} track(s)? This may take a few minutes.`)) {
      return;
    }
    
    // STEP 3: Set processing flag to TRUE and add listener BEFORE processing starts
    isProcessing = true;
    window.addEventListener('beforeunload', beforeUnloadHandler);
    
    // Show progress modal
    const modal = showEnhancementModal();
    
    // STEP 4: Process tracks (this is the part that takes time)
    const results = await bulkEnhanceRequests(unenhanced, updateEnhancementProgress);
    
    // STEP 5: Set processing flag to FALSE and remove listener AFTER processing completes
    isProcessing = false;
    window.removeEventListener('beforeunload', beforeUnloadHandler);
    
    // Close modal
    closeEnhancementModal();
    
    // Show results
    let message = `Enhanced ${results.enhanced} track(s)`;
    if (results.failed > 0) {
      message += `, ${results.failed} failed`;
      console.error('Enhancement errors:', results.errors);
    }
    
    showTempMessage(message, results.failed > 0 ? 'warning' : 'success');
    
    // Refresh display
    await fetchRequests(false);
    
  } catch (error) {
    console.error('Bulk enhancement error:', error);
    
    // STEP 6: IMPORTANT - Clean up listener even if error occurs
    isProcessing = false;
    window.removeEventListener('beforeunload', beforeUnloadHandler);
    
    closeEnhancementModal();
    showTempMessage(error.message || 'Enhancement failed', 'error');
    
  } finally {
    // STEP 7: Always re-enable button
    enhanceAllButton.disabled = false;
    
    // STEP 8: Extra safety - ensure listener is removed
    window.removeEventListener('beforeunload', beforeUnloadHandler);
  }
}

document.addEventListener('DOMContentLoaded', function() {
  // Initialize filter elements
  filterInput = document.getElementById('requestFilter');
  clearFilterButton = document.getElementById('clearFilter');
  
  // Clear the filter immediately
  if (filterInput) {
    filterInput.value = '';
    console.log("Filter cleared on page load");
  }

  // Add filter event listeners
  if (filterInput && clearFilterButton) {
    filterInput.addEventListener('input', filterRequests);
    clearFilterButton.addEventListener('click', clearFilter);
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && document.activeElement === filterInput) {
        clearFilter();
      }
    });
  }
  
  // Initialize quick filter buttons
  const quickFilterButtons = document.querySelectorAll('.quick-filter-button');
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
  
  // Check if user is Pro DJ or Admin
  const userRole = localStorage.getItem('userRole');
  console.log("User role:", userRole);
  
  const isPro = userRole === 'Pro DJ' || userRole === 'Admin';
  console.log("Is Pro/Admin:", isPro);
  
  if (isPro) {
    console.log("Showing Pro settings");
    // Show Pro settings
    document.getElementById('proSettings').style.display = 'block';
    
    // Load saved API key if any
    const savedKey = localStorage.getItem('openaiApiKey');
    if (savedKey) {
      document.getElementById('openaiKey').value = savedKey;
    }
    
    // Handle save button click
    document.getElementById('saveKeyButton').addEventListener('click', function() {
      const apiKey = document.getElementById('openaiKey').value.trim();
      
      if (apiKey) {
        localStorage.setItem('openaiApiKey', apiKey);
        alert('API key saved successfully!');
      } else {
        alert('Please enter a valid API key.');
      }
    });
  }
  
  // NEW: Initialize Enhance All button
  const enhanceAllButton = document.getElementById('enhanceAllButton');
  if (enhanceAllButton) {
    enhanceAllButton.addEventListener('click', handleBulkEnhancement);
  }

  // Initialize the dashboard
  initializeDashboard();
});

async function getUnenhancedTracks() {
  const { data, error } = await supabase
    .from('requests')
    .select('id, title, artist, original_title, original_artist, enhanced_by_ai')
    .eq('event_id', eventId)
    .eq('played', false)  // Only active requests
    .or('enhanced_by_ai.is.null,enhanced_by_ai.eq.false')  // Not yet enhanced
    .order('position', { ascending: true });  // Maintain queue order
    
  if (error) throw error;
  return data || [];
}

