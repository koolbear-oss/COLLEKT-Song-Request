// Initialize Supabase client
const supabaseUrl = 'https://ljekmnuflfotwznxeexc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxqZWttbnVmbGZvdHd6bnhlZXhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5MjU1NzksImV4cCI6MjA3NTUwMTU3OX0.S6yzIIKRv1YlKPHstMpTFqqSpAQOuFUOqC0G27zE4FE';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// Base URLs for our app
const baseUrl = window.location.origin + window.location.pathname.replace('/admin/', '/').replace('/admin/index.html', '/').replace('index.html', '');
const guestUrl = baseUrl + 'guest/';
const djUrl = baseUrl + 'dj/';
const displayUrl = window.location.origin + '/display.html';

// DOM Elements
const createButton = document.getElementById('createButton');
const eventNameInput = document.getElementById('eventName');
const qrResult = document.getElementById('qrResult');
const displayEventName = document.getElementById('displayEventName');
const eventIdElement = document.getElementById('eventId');
const requestUrlElement = document.getElementById('requestUrl');
const copyButton = document.getElementById('copyButton');
const printButton = document.getElementById('printButton');
const dashboardButton = document.getElementById('dashboardButton');
const eventsList = document.getElementById('eventsList');

// Function to create a new event
async function createEvent() {
  const eventName = eventNameInput.value.trim();
  
  if (!eventName) {
    alert('Please enter an event name');
    return;
  }
  
  try {
    // Insert new event
    const { data, error } = await supabase
      .from('events')
      .insert([{ name: eventName, active: true }]) // Set active to true for new events
      .select()
      .single();
    
    if (error) throw error;
    
    // Generate QR code
    generateQR(data);
    
    // Refresh events list
    loadEvents();
    
  } catch (error) {
    console.error('Error creating event:', error);
    alert('Failed to create event');
  }
}

// Function to generate QR code
function generateQR(event) {
  const eventId = event.id;
  
  // This is the important fix - use an absolute URL for the request URL
  const requestUrl = window.location.origin + "/guest/?event=" + eventId;
  
  // Display event details
  displayEventName.textContent = event.name;
  eventIdElement.textContent = eventId;
  requestUrlElement.value = requestUrl;
  
  // Generate QR code on the canvas element
  QRCode.toCanvas(document.getElementById('qrcode'), requestUrl, {
    width: 200,
    margin: 1,
    color: {
      dark: '#000000',
      light: '#ffffff'
    }
  }, function(error) {
    if (error) {
      console.error(error);
      alert('Error generating QR code');
    }
  });
  
  // Show QR result section
  qrResult.classList.remove('hidden');
  
  // Set dashboard button URL
  dashboardButton.onclick = function() {
    window.open(window.location.origin + "/dj/?event=" + eventId, '_blank');
  };
}

// Function to share QR code URL
function shareQrUrl(eventId, eventName) {
  // Create modal for custom message input
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-content">
      <h3>Share QR Display</h3>
      <p>Create a shareable link to display this QR code on any screen:</p>
      <div class="form-group">
        <label for="customMessage">Custom Message:</label>
        <input type="text" id="customMessage" value="Request Your Song" maxlength="50">
      </div>
      <div class="link-container">
        <input type="text" id="displayUrl" readonly>
        <button id="copyDisplayUrl">Copy</button>
      </div>
      <div class="button-group">
        <button id="openDisplayUrl">Open Display</button>
        <button id="closeModal">Close</button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Set up event listeners
  const customMessageInput = document.getElementById('customMessage');
  const displayUrlInput = document.getElementById('displayUrl');
  const copyDisplayUrlButton = document.getElementById('copyDisplayUrl');
  const openDisplayUrlButton = document.getElementById('openDisplayUrl');
  const closeModalButton = document.getElementById('closeModal');
  
  // Function to update the URL
  function updateDisplayUrl() {
    const message = encodeURIComponent(customMessageInput.value.trim() || 'Request Your Song');
    displayUrlInput.value = `${displayUrl}?event=${eventId}&message=${message}`;
  }
  
  // Initial URL
  updateDisplayUrl();
  
  // Update URL when message changes
  customMessageInput.addEventListener('input', updateDisplayUrl);
  
  // Copy URL button
  copyDisplayUrlButton.addEventListener('click', () => {
    displayUrlInput.select();
    document.execCommand('copy');
    copyDisplayUrlButton.textContent = 'Copied!';
    setTimeout(() => {
      copyDisplayUrlButton.textContent = 'Copy';
    }, 2000);
  });
  
  // Open display button
  openDisplayUrlButton.addEventListener('click', () => {
    window.open(displayUrlInput.value, '_blank');
  });
  
  // Close modal button
  closeModalButton.addEventListener('click', () => {
    document.body.removeChild(modal);
  });
}

// Function to toggle event archive status
async function toggleArchiveEvent(eventId, currentStatus) {
  try {
    // Update event status
    const { error } = await supabase
      .from('events')
      .update({ active: !currentStatus })
      .eq('id', eventId);
    
    if (error) throw error;
    
    // Refresh events list
    loadEvents();
    
  } catch (error) {
    console.error('Error updating event:', error);
    alert('Failed to update event status');
  }
}

// Function to format date
function formatDate(date) {
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Modified loadEvents function to handle archived events
// Modified loadEvents function to handle archived events and user filtering
async function loadEvents() {
  try {
    // Add a toggle for archived events - only if it doesn't exist
    if (!document.querySelector('.archive-toggle input')) {
      const toggleContainer = document.createElement('div');
      toggleContainer.className = 'archive-toggle';
      toggleContainer.innerHTML = `
        <label>
          <input type="checkbox" id="showArchived"> Show archived events
        </label>
      `;
      
      // Replace the existing archive toggle
      const existingToggle = document.querySelector('.archive-toggle');
      if (existingToggle) {
        existingToggle.replaceWith(toggleContainer);
      } else {
        // Insert before the events list
        eventsList.parentNode.insertBefore(toggleContainer, eventsList);
      }
      
      // Add event listener
      document.getElementById('showArchived').addEventListener('change', loadEvents);
    }
    
    const showArchived = document.getElementById('showArchived') && document.getElementById('showArchived').checked;
    
    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      // Not logged in, redirect to login page
      window.location.href = 'login.html';
      return;
    }
    
    // Start building the query
    let query = supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false });
    
    // Get user's events from dj_users table
    const { data: userEvents, error: userError } = await supabase
      .from('dj_users')
      .select('event_id')
      .eq('auth_id', user.id);
    
    // Filter events by user if we found their associated events
    if (!userError && userEvents && userEvents.length > 0) {
      // Extract event IDs
      const eventIds = userEvents.map(ue => ue.event_id).filter(id => id !== null);
      
      // If user has associated events, filter by them
      if (eventIds.length > 0) {
        query = query.in('id', eventIds);
      }
    }
    
    // Filter active/archived events
    if (!showArchived) {
      query = query.eq('active', true);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    
    // Clear events list
    eventsList.innerHTML = '';
    
    if (!data || data.length === 0) {
      const noEvents = document.createElement('p');
      noEvents.textContent = showArchived 
        ? 'No events found' 
        : 'No active events found. Check "Show archived events" to see archived events.';
      noEvents.className = 'loading';
      eventsList.appendChild(noEvents);
      return;
    }
    
    // Display events
    data.forEach(event => {
      const isArchived = event.active === false;
      
      const eventCard = document.createElement('div');
      eventCard.className = `event-card ${isArchived ? 'archived' : ''}`;
      eventCard.innerHTML = `
          <div class="event-info">
          <h3>${event.name} ${isArchived ? '<span class="archived-badge">Archived</span>' : ''}</h3>
          <p>Created: ${formatDate(new Date(event.created_at))}</p>
          </div>
          <div class="event-actions">
          <button class="display-button" data-id="${event.id}" data-name="${event.name}">QR Display</button>
          <button class="guest-button" data-id="${event.id}">Guest Form</button>
          <button class="dashboard-button" data-id="${event.id}">DJ Dashboard</button>
          <button class="archive-button" data-id="${event.id}" data-active="${event.active}">
              ${isArchived ? 'Unarchive' : 'Archive'}
          </button>
          </div>
      `;
      
      // Direct access to QR Display page
      eventCard.querySelector('.display-button').addEventListener('click', () => {
          const displayUrl = `${window.location.origin}/display.html?event=${event.id}&message=Request%20Your%20Song`;
          window.open(displayUrl, '_blank');
      });
      
      // Direct access to Guest Form
      eventCard.querySelector('.guest-button').addEventListener('click', () => {
          window.open(`${window.location.origin}/guest/?event=${event.id}`, '_blank');
      });
      
      // Direct access to DJ Dashboard
      eventCard.querySelector('.dashboard-button').addEventListener('click', () => {
          window.open(`${window.location.origin}/dj/?event=${event.id}`, '_blank');
      });
      
      eventCard.querySelector('.archive-button').addEventListener('click', () => {
          toggleArchiveEvent(event.id, event.active);
      });
      
      eventsList.appendChild(eventCard);
    });
    
  } catch (error) {
    console.error('Error loading events:', error);
    eventsList.innerHTML = '<p class="loading">Error loading events</p>';
  }
}

// Event listeners
createButton.addEventListener('click', createEvent);

copyButton.addEventListener('click', () => {
  requestUrlElement.select();
  document.execCommand('copy');
  copyButton.textContent = 'Copied!';
  setTimeout(() => {
    copyButton.textContent = 'Copy';
  }, 2000);
});

printButton.addEventListener('click', () => {
  window.print();
});

// Load events on page load
document.addEventListener('DOMContentLoaded', loadEvents);