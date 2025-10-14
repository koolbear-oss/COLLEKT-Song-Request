// Initialize Supabase client
const supabaseUrl = 'https://ljekmnuflfotwznxeexc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxqZWttbnVmbGZvdHd6bnhlZXhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5MjU1NzksImV4cCI6MjA3NTUwMTU3OX0.S6yzIIKRv1YlKPHstMpTFqqSpAQOuFUOqC0G27zE4FE';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Get event ID from URL parameter
const urlParams = new URLSearchParams(window.location.search);
const eventId = urlParams.get('event');

// Camelot color wheel mapping for harmonic mixing
const CAMELOT_COLORS = {
  // A (Minor) Keys - Cool tones (Blues, Purples, Greens)
  '1A': '#4A90E2',  '2A': '#5B9BD5',  '3A': '#6CA6D8',  '4A': '#7DB1DB',
  '5A': '#8E5BA8',  '6A': '#9F66B3',  '7A': '#B071BE',  '8A': '#C17CC9',
  '9A': '#52B788',  '10A': '#63C294', '11A': '#74CD9F', '12A': '#85D8AB',
  
  // B (Major) Keys - Warm tones (Yellows, Oranges, Reds)
  '1B': '#F4D03F',  '2B': '#F5D752',  '3B': '#F6DE65',  '4B': '#F7E578',
  '5B': '#E67E22',  '6B': '#E88B35',  '7B': '#EA9848',  '8B': '#ECA55B',
  '9B': '#E74C3C',  '10B': '#E95D4F', '11B': '#EB6E62', '12B': '#ED7F75'
};

// Helper function to get Camelot color
function getCamelotColor(key) {
  if (!key) return null;
  
  // Keep existing background color logic
  const bgColor = CAMELOT_COLORS[key.toUpperCase()] || null;
  
  // Get text color from CSS variables
  const textVarName = `--key-${key.toUpperCase()}-text`;
  const rootStyles = getComputedStyle(document.documentElement);
  const textColor = rootStyles.getPropertyValue(textVarName).trim() || 'white';
  
  return { 
    backgroundColor: bgColor, 
    color: textColor 
  };
}

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

let currentlyExpandedCard = null;

function initializeCardExpansion() {
  // Add click event to all request cards (delegated to the container for dynamic content)
  document.getElementById('requestsList').addEventListener('click', function(e) {
    // Find the closest request-card ancestor from the clicked element
    const card = e.target.closest('.request-card');
    
    // Only proceed if we found a card and the click wasn't on a button
    if (card && !e.target.closest('button')) {
      // Check if another card is already expanded
      if (currentlyExpandedCard && currentlyExpandedCard !== card) {
        // Collapse the other card first
        collapseCard(currentlyExpandedCard);
      }
      
      // Toggle the current card
      toggleCardExpansion(card);
    }
  });

  // Also add click handling for played cards
  document.getElementById('playedList').addEventListener('click', function(e) {
    const card = e.target.closest('.request-card');
    if (card && !e.target.closest('button')) {
      // Check if another card is already expanded
      if (currentlyExpandedCard && currentlyExpandedCard !== card) {
        // Collapse the other card first
        collapseCard(currentlyExpandedCard);
      }
      
      // Toggle the current card
      toggleCardExpansion(card);
    }
  });
}

// Helper function to toggle card expansion state
function toggleCardExpansion(card) {
  const wasCollapsed = card.classList.contains('collapsed');
  
  if (wasCollapsed) {
    // Expand the card
    card.classList.remove('collapsed');
    card.classList.add('expanded');
    
    const expandedContent = card.querySelector('.expanded-content');
    if (expandedContent) {
      expandedContent.style.display = 'block';
    }
    
    // Update current expanded card reference
    currentlyExpandedCard = card;
  } else {
    // Collapse the card
    collapseCard(card);
  }
}

// Helper function to collapse a card
function collapseCard(card) {
  if (!card) return;
  
  card.classList.add('collapsed');
  card.classList.remove('expanded');
  
  const expandedContent = card.querySelector('.expanded-content');
  if (expandedContent) {
    expandedContent.style.display = 'none';
  }
  
  // Clear current expanded card reference if this was it
  if (currentlyExpandedCard === card) {
    currentlyExpandedCard = null;
  }
}

// Fetch requests from Supabase
async function fetchRequests(resetStarred = true) {
  if (!eventId) return;
  
  console.log("Fetching requests for event:", eventId);

  // Save expanded card ID before refresh
  const expandedCardId = currentlyExpandedCard ? currentlyExpandedCard.dataset.id : null;
  
  try {
    // Fetch active requests
    const { data: activeRequests, error: activeError } = await supabase
      .from('requests')
      .select('*')
      .eq('event_id', eventId)
      .eq('played', false)
      .order('is_starred', { ascending: false }) // Starred items first
      .order('position', { ascending: true });   // Then by position
    
    console.log("Active requests fetched:", activeRequests?.length || 0);
    
    // Fetch played requests
    const { data: playedRequests, error: playedError } = await supabase
      .from('requests')
      .select('*')
      .eq('event_id', eventId)
      .eq('played', true)
      .order('played_at', { ascending: false });
    
    console.log("Played requests fetched:", playedRequests?.length || 0);
    
    if (activeError) throw activeError;
    if (playedError) throw playedError;
    
    // Identify new requests (added since last check)
    const twoMinutesAgo = new Date().getTime() - (2 * 60 * 1000);
    const newRequests = activeRequests ? activeRequests.filter(req => {
      const requestTime = new Date(req.created_at).getTime();
      return requestTime > twoMinutesAgo;
    }) : [];

    // Still update lastRequestsCheck for other purposes (like notifications)
    lastRequestsCheck = new Date().getTime();

    // Display requests and highlight new ones
    displayRequests(requestsListElement, activeRequests || [], false, newRequests.map(r => r.id));
    displayRequests(playedListElement, playedRequests || [], true);
    
    // Update counters
    if (requestCountElement) {
      requestCountElement.textContent = activeRequests ? activeRequests.length : 0;
    }
    
    if (playedCountElement) {
      playedCountElement.textContent = playedRequests ? playedRequests.length : 0;
    }
    
    console.log("Requests displayed successfully");
    
  } catch (error) {
    console.error('Error fetching requests:', error);
    if (requestsListElement) {
      requestsListElement.innerHTML = '<p class="loading">Error loading requests</p>';
    }
  }

  // Update enhance button visibility
  await updateEnhanceAllButton();

  // Restore expanded card state if needed
  if (expandedCardId) {
    const card = document.querySelector(`.request-card[data-id="${expandedCardId}"]`);
    if (card) {
      // Re-expand this card without animation
      card.classList.remove('collapsed');
      card.classList.add('expanded');
      const expandedContent = card.querySelector('.expanded-content');
      if (expandedContent) {
        expandedContent.style.display = 'block';
      }
      currentlyExpandedCard = card;
    } else {
      currentlyExpandedCard = null;
    }
  }
}

// Display requests in the specified container
function displayRequests(container, requests, isPlayed = false, newRequestIds = []) {
  if (!container) {
    console.error("Container element is null!");
    return;
  }
  
  console.log(`Displaying ${isPlayed ? 'played' : 'active'} requests in container:`, container.id);
  console.log("Number of requests to display:", requests.length);
  
  // Add individual request logging
  requests.forEach((req, index) => {
    console.log(`Request ${index}:`, req.title, "by", req.artist, "played:", req.played);
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
    if (!template) {
      console.error("Request template element is null!");
      return;
    }
    
    const requestCard = document.importNode(template.content, true).querySelector('.request-card');
    if (!requestCard) {
      console.error("Request card element is null after importing template!");
      return;
    }
    
    // Set data attribute for identification
    requestCard.dataset.id = request.id;
    requestCard.dataset.position = request.position;

    // Start collapsed by default
    requestCard.classList.add('collapsed');

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
    const songTitle = requestCard.querySelector('.song-title');
    const artistName = requestCard.querySelector('.artist-name');
    const messageEl = requestCard.querySelector('.message');
    
    if (songTitle) songTitle.textContent = request.title;
    if (artistName) artistName.textContent = request.artist;
    
    // Handle message - truncate if needed
    const message = request.message || '';
    if (messageEl) {
      messageEl.textContent = truncateComment(message);
      // Add title for tooltip on hover for long messages
      if (message.length > 40) {
        messageEl.setAttribute('title', message);
      }
    }
    
    // Show metadata for Pro users if available
    const isPro = localStorage.getItem('userRole') === 'Pro DJ' || localStorage.getItem('userRole') === 'Admin';
    const keyBadge = requestCard.querySelector('.key-badge');
    const bpmBadge = requestCard.querySelector('.bpm-badge');
    const keyBadgeLarge = requestCard.querySelector('.key-badge-large');
    const bpmBadgeLarge = requestCard.querySelector('.bpm-badge-large');

    if (isPro) {
      // Show key if available (collapsed state)
      if (request.key) {
        if (keyBadge) {
          keyBadge.textContent = request.key;
          keyBadge.setAttribute('data-value', request.key);
          // Apply Camelot colors with text contrast
          const keyColors = getCamelotColor(request.key);
          if (keyColors) {
            keyBadge.style.backgroundColor = keyColors.backgroundColor;
            keyBadge.style.color = keyColors.color;
          }
        }
        
        if (keyBadgeLarge) {
          keyBadgeLarge.textContent = request.key;
          // Apply Camelot colors with text contrast
          const keyColors = getCamelotColor(request.key);
          if (keyColors) {
            keyBadgeLarge.style.backgroundColor = keyColors.backgroundColor;
            keyBadgeLarge.style.color = keyColors.color;
          }
        }
      }
      
      // Show BPM if available
      if (request.bpm) {
        if (bpmBadge) bpmBadge.textContent = request.bpm;
        bpmBadge.setAttribute('data-value', request.bpm);
        if (bpmBadgeLarge) bpmBadgeLarge.textContent = request.bpm;
      } else {
        if (bpmBadge) bpmBadge.textContent = '';
        if (bpmBadgeLarge) bpmBadgeLarge.textContent = '';
      }
    } else {
      // Hide metadata for non-Pro users
      if (keyBadge) keyBadge.style.display = 'none';
      if (bpmBadge) bpmBadge.style.display = 'none';
    }
    
    // Format timestamp
    const timestampElement = requestCard.querySelector('.timestamp');
    if (timestampElement) {
      const timestamp = new Date(isPlayed ? request.played_at : request.created_at);
      timestampElement.textContent = formatDate(timestamp);
    }
    
    // Set up button actions with null checks
    if (!isPlayed) {
      // For active requests - quick action buttons
      const playButton = requestCard.querySelector('.quick-actions .play-button');
      if (playButton) {
        playButton.addEventListener('click', (e) => {
          e.stopPropagation(); // Prevent card expansion
          markAsPlayed(request.id);
        });
      }
      
      // Expanded view buttons
      const starButton = requestCard.querySelector('.star-button');
      if (starButton) {
        starButton.addEventListener('click', () => starRequest(request.id));
      }
      
      const playButtonExpanded = requestCard.querySelector('.play-button-expanded');
      if (playButtonExpanded) {
        playButtonExpanded.addEventListener('click', () => markAsPlayed(request.id));
      }
    } else {
      // For played requests
      const restoreButton = requestCard.querySelector('.restore-button');
      if (restoreButton) {
        restoreButton.addEventListener('click', () => restoreRequest(request.id));
      }
      
      // Hide star and play buttons in the played section
      const starButton = requestCard.querySelector('.star-button');
      const playButton = requestCard.querySelector('.play-button-expanded');
      if (starButton) starButton.style.display = 'none';
      if (playButton) playButton.style.display = 'none';
    }

    // Add enhance button for debugging (Pro users only)
    if (isPro && !isPlayed) {
      const enhanceButton = requestCard.querySelector('.quick-actions .enhance-button');
      const enhanceButtonExpanded = requestCard.querySelector('.enhance-button-expanded');
      
      if (!request.enhanced_by_ai) {
        // Show enhance buttons for unenhanced tracks
        if (enhanceButton) {
          enhanceButton.style.display = 'flex';
          enhanceButton.addEventListener('click', async (e) => {
            e.stopPropagation(); // Prevent card expansion
            console.log('Manually enhancing request:', request.title);
            enhanceButton.disabled = true;
            enhanceButton.innerText = '⏳';
            const enhanced = await enhanceAndUpdateTrack(request);
            console.log('Enhancement result:', enhanced);
            fetchRequests(false);
          });
        }
        
        if (enhanceButtonExpanded) {
          enhanceButtonExpanded.style.display = 'inline-block';
          enhanceButtonExpanded.addEventListener('click', async () => {
            console.log('Manually enhancing request:', request.title);
            enhanceButtonExpanded.disabled = true;
            enhanceButtonExpanded.innerText = '⏳';
            const enhanced = await enhanceAndUpdateTrack(request);
            console.log('Enhancement result:', enhanced);
            fetchRequests(false);
          });
        }
      } else {
        // Hide enhance buttons for already enhanced tracks
        if (enhanceButton) enhanceButton.style.display = 'none';
        if (enhanceButtonExpanded) enhanceButtonExpanded.style.display = 'none';
      }
    }
    
    const deleteButton = requestCard.querySelector('.delete-button');
    if (deleteButton) {
      deleteButton.addEventListener('click', () => deleteRequest(request.id));
    }

    const copyButton = requestCard.querySelector('.copy-button');
    if (copyButton) {
      copyButton.addEventListener('click', () => {
        const songTitle = request.title;
        const artistName = request.artist;
        copyForSeratoSearch(songTitle, artistName);
      });
    }
    
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
    bottom: 20px;
    right: 20px;
    padding: 12px 20px;
    background: ${type === 'error' ? 'linear-gradient(135deg, #f44336, #d32f2f)' : 
                 type === 'warning' ? 'linear-gradient(135deg, #ff9800, #f57c00)' : 
                 'linear-gradient(135deg, #4caf50, #2e7d32)'};
    color: white;
    border-radius: 8px;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    font-weight: 500;
    font-family: 'Montserrat', sans-serif;
    transform: translateY(20px);
    opacity: 0;
    transition: transform 0.3s ease, opacity 0.3s ease;
  `;
  
  document.body.appendChild(messageEl);
  
  // Trigger animation
  setTimeout(() => {
    messageEl.style.transform = 'translateY(0)';
    messageEl.style.opacity = '1';
  }, 10);
  
  setTimeout(() => {
    messageEl.style.transform = 'translateY(20px)';
    messageEl.style.opacity = '0';
    
    // Remove element after fade out
    setTimeout(() => {
      if (document.body.contains(messageEl)) {
        document.body.removeChild(messageEl);
      }
    }, 300);
  }, 3000);
}

// Mark request as played
async function markAsPlayed(requestId) {
  try {
    console.log("Marking request as played:", requestId);
    
    const { error } = await supabase
      .from('requests')
      .update({ 
        played: true,
        played_at: new Date().toISOString()
      })
      .eq('id', requestId);
    
    if (error) throw error;
    
    console.log("Successfully marked as played");
    
    // Re-fetch requests to update both active and played lists
    await fetchRequests();
    
  } catch (error) {
    console.error('Error marking as played:', error);
  }
}

// Helper function to safely convert timestamps
function safeTimestamp(timestamp) {
  if (!timestamp) return null;
  
  const date = new Date(timestamp);
  
  // Check if date is valid
  if (isNaN(date.getTime())) {
    console.warn('Invalid timestamp:', timestamp, '- using current time');
    return new Date().toISOString();
  }
  
  return date.toISOString();
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
    
    if (fetchError) {
      console.error('Error fetching request:', fetchError);
      throw fetchError;
    }
    
    console.log('Request to archive:', request); // DEBUG
    
    // STEP 2: Prepare archive data (now timestamps are guaranteed valid)
    const archiveData = {
      original_request_id: request.id,
      event_id: request.event_id,
      title: request.title,
      artist: request.artist,
      message: request.message || null,
      original_title: request.original_title || null,
      original_artist: request.original_artist || null,
      key: request.key || null,
      bpm: request.bpm || null,
      enhanced_by_ai: request.enhanced_by_ai || false,
      is_starred: request.is_starred || false,
      position: request.position || 0,
      
      // Now these work properly since created_at is a real timestamp
      created_at: request.created_at,
      
      played: request.played || false,
      played_at: request.played_at || null,
      
      deleted_by: localStorage.getItem('userEmail') || 'unknown',
      deletion_reason: 'manual_delete'
    };
    
    console.log('Archive data:', archiveData); // DEBUG
    
    // STEP 3: Insert into deleted_requests table
    const { data: archiveResult, error: archiveError } = await supabase
      .from('deleted_requests')
      .insert([archiveData]);
    
    if (archiveError) {
      console.error('Archive error details:', archiveError);
      throw archiveError;
    }
    
    console.log('Archive successful'); // DEBUG
    
    // STEP 4: Now delete from requests table
    const { error: deleteError } = await supabase
      .from('requests')
      .delete()
      .eq('id', requestId);
    
    if (deleteError) {
      console.error('Delete error:', deleteError);
      throw deleteError;
    }
    
    // STEP 5: Show success feedback
    showTempMessage('Request archived', 'success');
    
    // STEP 6: Refresh display
    fetchRequests();
    
  } catch (error) {
    console.error('Error archiving request:', error);
    
    // Show detailed error to user
    let errorMessage = 'Failed to delete request';
    if (error.message) {
      errorMessage += ': ' + error.message;
    }
    
    showTempMessage(errorMessage, 'error');
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
      // Star the item with animation
      requestCard.classList.add('starred');
      
      // Animate the star button
      const starButton = requestCard.querySelector('.star-button');
      if (starButton) {
        starButton.classList.add('animate');
        
        // Add a visual pulse to the card
        requestCard.style.boxShadow = '0 0 15px rgba(255, 235, 59, 0.5)';
        setTimeout(() => {
          requestCard.style.boxShadow = '';
          starButton.classList.remove('animate');
        }, 300);
      }
      
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
  // Toggle the class
  dashboardContent.classList.toggle('sidebar-collapsed');
  
  // Add animation to the toggle button
  sidebarToggle.classList.add('toggling');
  setTimeout(() => {
    sidebarToggle.classList.remove('toggling');
  }, 300);
  
  // Re-fetch requests when sidebar is toggled to ensure proper layout
  setTimeout(() => {
    fetchRequests(false); // Pass false to prevent resetting starred items
  }, 300); // Wait for transition to complete
  
  // Add this class to the CSS
  const style = document.createElement('style');
  style.innerHTML = `
    .sidebar-toggle.toggling {
      box-shadow: 0 0 15px rgba(138, 43, 226, 0.6);
      transition: all 0.3s ease;
    }
  `;
  document.head.appendChild(style);
});

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

function showEnhancementModal() {
  // Get the template and clone it
  const template = document.getElementById('enhancementModalTemplate');
  if (template) {
    const modalClone = document.importNode(template.content, true);
    document.body.appendChild(modalClone);
    return document.querySelector('.enhancement-modal');
  }
  
  // Fallback to creating the modal manually if template is not available
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
  // Assign dashboardContent reference
  dashboardContent = document.querySelector('.dashboard-content');

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
  
  // Initialize Enhance All button
  const enhanceAllButton = document.getElementById('enhanceAllButton');
  if (enhanceAllButton) {
    enhanceAllButton.addEventListener('click', handleBulkEnhancement);
  }

  // Initialize card expansion functionality
  initializeCardExpansion();

  // Initialize the dashboard
  initializeDashboard();

  // Initialize key filter listeners
  initializeKeyFilterListeners();
  
  // Initialize BPM filter listeners
  initializeBpmFilterListeners();
  
  // Re-initialize listeners after requests are loaded
  // This ensures new cards have listeners too
  const originalFetchRequests = fetchRequests;
  fetchRequests = async function(...args) {
    await originalFetchRequests.apply(this, args);
    initializeKeyFilterListeners();
    initializeBpmFilterListeners();
  };

  // Add global ESC key handler
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      // Close expanded card if any
      if (currentlyExpandedCard) {
        collapseCard(currentlyExpandedCard);
      }
      
      // Close sidebar if open
      if (dashboardContent && !dashboardContent.classList.contains('sidebar-collapsed')) {
        dashboardContent.classList.add('sidebar-collapsed');
      }
      
      // Close any active filtering
      if (document.body.classList.contains('filtering-active')) {
        clearFiltering();
      }
    }
  });
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

// ADD to app.js - Key compatibility calculation
function calculateKeyCompatibility(key1, key2) {
  if (!key1 || !key2) return 0;
  
  // Strip any potential spaces
  key1 = key1.trim();
  key2 = key2.trim();
  
  // If keys are identical, they're perfectly compatible
  if (key1 === key2) return 1.0;
  
  // Extract number and letter from each key
  const keyPattern = /(\d+)([AB])/;
  const match1 = key1.match(keyPattern);
  const match2 = key2.match(keyPattern);
  
  if (!match1 || !match2) return 0;
  
  const num1 = parseInt(match1[1]);
  const type1 = match1[2];
  const num2 = parseInt(match2[1]);
  const type2 = match2[2];
  
  // Perfect compatibility for relative major/minor (same number, different letter)
  if (num1 === num2 && type1 !== type2) return 0.9;
  
  // Adjacent keys on the Camelot wheel (one step away)
  const isAdjacent = (
    // Same letter type, number differs by 1 or 11 (wrap around)
    (type1 === type2 && (Math.abs(num1 - num2) === 1 || Math.abs(num1 - num2) === 11)) ||
    // For perfect fifth/fourth relationships
    (Math.abs(num1 - num2) === 7 && type1 === type2)
  );
  
  if (isAdjacent) return 0.7;
  
  // Two steps away = moderate compatibility
  const isTwoStepsAway = (
    (type1 === type2 && (Math.abs(num1 - num2) === 2 || Math.abs(num1 - num2) === 10))
  );
  
  if (isTwoStepsAway) return 0.4;
  
  // Default: low compatibility
  return 0.1;
}

function applyFilterEffect(card, compatibilityScore) {
  // More dramatic opacity range - 0.1 to 1
  const opacity = 0.1 + (compatibilityScore * 0.9);
  
  // Apply visual effects
  card.style.opacity = opacity.toString();
  card.style.transition = 'all 0.3s ease-in-out';
  
  // Scale effect based on compatibility
  const scale = 1 + (compatibilityScore * 0.05); // 1.00 to 1.05 scale
  
  if (compatibilityScore > 0.8) {
    // Highly compatible cards get highlight effect
    card.style.transform = `scale(${scale})`;
    card.style.boxShadow = '0 0 15px rgba(138, 43, 226, 0.7)';
    card.style.zIndex = '5'; // Bring to front
    card.style.borderLeftColor = 'rgba(138, 43, 226, 0.8)';
  } 
  else if (compatibilityScore > 0.6) {
    // Medium compatibility
    card.style.transform = `scale(${scale * 0.99})`;
    card.style.boxShadow = '0 0 10px rgba(138, 43, 226, 0.4)';
    card.style.zIndex = '4';
    card.style.borderLeftColor = 'rgba(138, 43, 226, 0.6)';
  }
  else if (compatibilityScore > 0.4) {
    // Low compatibility
    card.style.transform = `scale(${scale * 0.98})`;
    card.style.boxShadow = '0 0 5px rgba(138, 43, 226, 0.2)';
    card.style.zIndex = '3';
    card.style.borderLeftColor = 'rgba(138, 43, 226, 0.3)';
  }
  else {
    // Minimal compatibility
    card.style.transform = 'scale(1)';
    card.style.boxShadow = 'none';
    card.style.zIndex = '2';
    card.style.borderLeftColor = 'transparent';
  }
}

// ADD to app.js - Key filtering implementation
function filterByKey(selectedKey) {
  if (!selectedKey) return;
  
  // Set filtering state
  document.body.classList.add('filtering-active');
  
  // Store the active filter for potential clear button
  window.activeFilter = {
    type: 'key',
    value: selectedKey
  };
  
  // Find the selected card's BPM for secondary matching
  const selectedKeyElement = document.querySelector(`.key-badge[data-value="${selectedKey}"]`);
  let selectedBpm = null;
  
  if (selectedKeyElement) {
    const selectedCard = selectedKeyElement.closest('.request-card');
    if (selectedCard) {
      const bpmElement = selectedCard.querySelector('.bpm-badge');
      if (bpmElement && bpmElement.textContent) {
        selectedBpm = parseInt(bpmElement.textContent.trim());
      }
    }
  }
  
  // Process all cards
  document.querySelectorAll('.request-card').forEach(card => {
    const cardKeyElement = card.querySelector('.key-badge');
    if (!cardKeyElement) return;
    
    const cardKey = cardKeyElement.textContent.trim();
    if (!cardKey) return;
    
    // Calculate key compatibility (0-1)
    const keyCompatibility = calculateKeyCompatibility(selectedKey, cardKey);
    
    // Calculate BPM compatibility if we have BPM data
    let bpmCompatibility = 1; // Default if we can't calculate
    
    if (selectedBpm) {
      const cardBpmElement = card.querySelector('.bpm-badge');
      if (cardBpmElement && cardBpmElement.textContent) {
        const cardBpm = parseInt(cardBpmElement.textContent.trim());
        if (!isNaN(cardBpm)) {
          // Calculate BPM difference percentage
          const bpmDiff = Math.abs(selectedBpm - cardBpm) / selectedBpm;
          
          // Map to 0-1 scale (0% diff = 1, 8%+ diff = 0)
          bpmCompatibility = bpmDiff <= 0.08 ? Math.max(0, 1 - (bpmDiff / 0.08)) : 0;
        }
      }
    }
    
    // Create weighted compatibility score (70% key, 30% BPM)
    const combinedCompatibility = (keyCompatibility * 0.7) + (bpmCompatibility * 0.3);
    
    // Apply visual effect based on combined score
    applyFilterEffect(card, combinedCompatibility);
  });
  
  // Show clear filter button
  showClearFilterButton();
}

function filterByBpm(selectedBpm) {
  if (!selectedBpm) return;
  
  // Set filtering state
  document.body.classList.add('filtering-active');
  
  // Store the active filter for potential clear button
  window.activeFilter = {
    type: 'bpm',
    value: selectedBpm
  };
  
  // Find the selected card's key for secondary matching
  const selectedBpmElement = document.querySelector(`.bpm-badge[data-value="${selectedBpm}"]`);
  let selectedKey = null;
  
  if (selectedBpmElement) {
    const selectedCard = selectedBpmElement.closest('.request-card');
    if (selectedCard) {
      const keyElement = selectedCard.querySelector('.key-badge');
      if (keyElement && keyElement.textContent) {
        selectedKey = keyElement.textContent.trim();
      }
    }
  }
  
  // Process all cards
  document.querySelectorAll('.request-card').forEach(card => {
    const cardBpmElement = card.querySelector('.bpm-badge');
    if (!cardBpmElement) return;
    
    const cardBpmText = cardBpmElement.textContent.trim();
    if (!cardBpmText) return;
    
    const cardBpm = parseInt(cardBpmText);
    if (isNaN(cardBpm)) return;
    
    // Calculate BPM compatibility (0-1)
    const percentDifference = Math.abs(cardBpm - selectedBpm) / selectedBpm;
    const bpmCompatibility = percentDifference <= 0.05 ? 
                            Math.max(0, 1 - (percentDifference / 0.05)) : 0;
    
    // Calculate key compatibility if we have key data
    let keyCompatibility = 1; // Default if we can't calculate
    
    if (selectedKey) {
      const cardKeyElement = card.querySelector('.key-badge');
      if (cardKeyElement && cardKeyElement.textContent) {
        const cardKey = cardKeyElement.textContent.trim();
        if (cardKey) {
          keyCompatibility = calculateKeyCompatibility(selectedKey, cardKey);
        }
      }
    }
    
    // Create weighted compatibility score (70% BPM, 30% key)
    // Note: For BPM filtering, we weight BPM higher than key
    const combinedCompatibility = (keyCompatibility * 0.3) + (bpmCompatibility * 0.7);
    
    // Apply visual effect based on combined score
    applyFilterEffect(card, combinedCompatibility);
  });
  
  // Show clear filter button
  showClearFilterButton();
}

// ADD to app.js - Add event listeners for key badges
function initializeKeyFilterListeners() {
  document.querySelectorAll('.key-badge, .key-badge-large').forEach(badge => {
    if (badge.textContent.trim()) {  // Only add if badge has content
      badge.classList.add('interactive-badge');
      badge.setAttribute('title', 'Click to show compatible keys');
      
      // Remove any existing listeners to avoid duplicates
      badge.removeEventListener('click', keyBadgeClickHandler);
      
      // Add click event
      badge.addEventListener('click', keyBadgeClickHandler);
    }
  });
}

function initializeBpmFilterListeners() {
  document.querySelectorAll('.bpm-badge, .bpm-badge-large').forEach(badge => {
    if (badge.textContent.trim()) {  // Only add if badge has content
      badge.classList.add('interactive-badge');
      badge.setAttribute('title', 'Click to show compatible BPMs');
      
      // Remove any existing listeners to avoid duplicates
      badge.removeEventListener('click', bpmBadgeClickHandler);
      
      // Add click event
      badge.addEventListener('click', bpmBadgeClickHandler);
    }
  });
}

// BPM badge click handler
function bpmBadgeClickHandler(e) {
  e.stopPropagation(); // Prevent card expansion
  const bpm = parseInt(this.textContent.trim());
  if (!isNaN(bpm)) {
    filterByBpm(bpm);
  }
}

// Key badge click handler
function keyBadgeClickHandler(e) {
  e.stopPropagation(); // Prevent card expansion
  const key = this.textContent.trim();
  filterByKey(key);
}

// ADD to app.js - Clear filtering function and button
function clearFiltering() {
  // Remove filtering state
  document.body.classList.remove('filtering-active');
  window.activeFilter = null;
  
  // Reset all cards
  document.querySelectorAll('.request-card').forEach(card => {
    card.style.opacity = '1';
    card.style.transform = 'scale(1)';
    card.style.boxShadow = '';
  });
  
  // Hide clear button
  const clearButton = document.getElementById('clearFilterButton');
  if (clearButton) {
    clearButton.style.display = 'none';
  }
}

function showClearFilterButton() {
  let clearButton = document.getElementById('clearFilterButton');
  
  // Create button if it doesn't exist
  if (!clearButton) {
    clearButton = document.createElement('button');
    clearButton.id = 'clearFilterButton';
    clearButton.className = 'clear-filter-global';
    clearButton.textContent = 'Clear Filter';
    clearButton.addEventListener('click', clearFiltering);
    
    // Add to DOM - position it near the filter controls
    const headerControls = document.querySelector('.header-controls-right');
    if (headerControls) {
      headerControls.appendChild(clearButton);
    } else {
      document.querySelector('.section-header').appendChild(clearButton);
    }
  }
  
  // Show the button
  clearButton.style.display = 'block';
}

// Global document-level event listener for keyboard shortcuts
document.addEventListener('keydown', function(e) {
  // Check if ESC key (key code 27) is pressed
  if (e.key === 'Escape' || e.key === 'Esc' || e.keyCode === 27) {
    // Check if filtering is active before trying to clear
    if (document.body.classList.contains('filtering-active')) {
      clearFiltering();
    }
  }
});