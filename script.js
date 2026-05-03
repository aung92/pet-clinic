// ============================================
// VET FOR PET CLINIC - CLIENT SIDE SCRIPT
// Google Sheets API Integration | Slot Configuration
// Version: 3.0 | Performance Optimized | Last Updated: 2025
// ============================================

// ============================================
// SECTION 1: CONFIGURATION & GLOBAL VARIABLES
// ============================================

// Google Apps Script URL for backend API
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxxFwjqxDdC7uWqjF0CGbzYCHyZ1jZM_jsXz7P1FnNIANsAPpccZfvktQrFLrag3N1P/exec";

// Default Slot Configuration (30-min intervals per day)
// This will be overridden by localStorage if admin changes it
const DEFAULT_SLOT_CONFIG = {
  "Saturday": { start: 9, end: 21 },
  "Sunday": { start: 9, end: 15 },
  "Monday": { start: 9, end: 15 },
  "Tuesday": { start: 9, end: 21 },
  "Wednesday": { start: 9, end: 15 },
  "Thursday": { start: 9, end: 15 },
  "Friday": { start: 9, end: 15 }
};

// Dynamic slot configuration (loaded from localStorage)
let slotConfig = { ...DEFAULT_SLOT_CONFIG };

// Global variables
let bookedCache = {};        // Cache for booked appointments
let currentDate = null;      // Currently selected date
let selectedTime = null;     // Currently selected time slot
let datePicker = null;       // Flatpickr instance
let serialCounter = 1;       // Serial number counter

// DOM element cache for performance
const domCache = {};

/**
 * Get DOM element with caching for better performance
 * @param {string} id - Element ID
 * @returns {HTMLElement} DOM element
 */
function getElement(id) {
  if (!domCache[id]) {
    domCache[id] = document.getElementById(id);
  }
  return domCache[id];
}

// ============================================
// SECTION 2: SLOT CONFIGURATION MANAGEMENT
// ============================================

/**
 * Load slot configuration from localStorage
 * If admin has changed slots, it will be reflected here
 */
function loadSlotConfig() {
  const savedConfig = localStorage.getItem('slot_config');
  if (savedConfig) {
    try {
      slotConfig = JSON.parse(savedConfig);
      console.log('✅ Slot config loaded from localStorage:', slotConfig);
    } catch (error) {
      console.error('❌ Error parsing slot config:', error);
      slotConfig = { ...DEFAULT_SLOT_CONFIG };
    }
  } else {
    slotConfig = { ...DEFAULT_SLOT_CONFIG };
    console.log('📋 Using default slot configuration');
  }
}

/**
 * Load serial counter from localStorage
 */
function loadSerialCounter() {
  const savedSerial = localStorage.getItem('appointment_serial');
  if (savedSerial) {
    serialCounter = parseInt(savedSerial) + 1;
  } else {
    serialCounter = 1;
  }
}

/**
 * Save serial counter to localStorage
 */
function saveSerialCounter() {
  localStorage.setItem('appointment_serial', serialCounter);
}

/**
 * Generate unique serial number for appointment
 * @returns {number} Unique serial number
 */
function generateSerialNumber() {
  const serial = serialCounter;
  serialCounter++;
  saveSerialCounter();
  return serial;
}

/**
 * Generate time slots based on day using dynamic config
 * @param {string} dayName - Name of the day (e.g., "Monday")
 * @returns {Array} Array of time slots (e.g., ["9:00 AM", "9:30 AM"])
 */
function generateTimeSlots(dayName) {
  const cfg = slotConfig[dayName];
  if (!cfg) return [];
  
  const slots = [];
  let hour = cfg.start;
  let minute = 0;
  
  while (hour < cfg.end || (hour === cfg.end && minute === 0)) {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    let displayHour = hour % 12;
    if (displayHour === 0) displayHour = 12;
    
    const timeString = `${displayHour}:${minute.toString().padStart(2, '0')} ${ampm}`;
    slots.push(timeString);
    
    minute += 30;
    if (minute >= 60) {
      hour++;
      minute = 0;
    }
  }
  
  return slots;
}

// ============================================
// SECTION 3: INITIALIZATION
// ============================================

/**
 * Main initialization function - runs when page loads
 */
document.addEventListener('DOMContentLoaded', function() {
  // Load slot configuration first
  loadSlotConfig();
  
  // Load serial counter
  loadSerialCounter();
  
  // Initialize AOS animations (with lazy load for mobile)
  if (typeof AOS !== 'undefined') {
    AOS.init({ 
      duration: 800, 
      once: true,
      disable: window.innerWidth < 768 // Disable on mobile for performance
    });
  }
  
  // Hide loader faster for better UX
  setTimeout(() => {
    const loader = getElement('loader');
    if (loader) loader.style.display = 'none';
  }, 500);
  
  // Initialize date & time display
  updateDateTime();
  setInterval(updateDateTime, 1000);
  
  // Initialize flatpickr date picker
  initializeDatePicker();
  
  // Setup event listeners
  setupEventListeners();
  
  // Fetch existing bookings from Google Sheets
  fetchBookings();
});

/**
 * Live Date & Time Update for Top Bar
 */
function updateDateTime() {
  const now = new Date();
  const dateElem = getElement('currentDate');
  const timeElem = getElement('currentTime');
  
  if (dateElem) {
    dateElem.innerText = now.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
  }
  
  if (timeElem) {
    timeElem.innerText = now.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  }
}

// ============================================
// SECTION 4: API COMMUNICATION (Optimized)
// ============================================

// Cache variables for API calls
let lastFetchTime = 0;
let fetchPromise = null;
const CACHE_DURATION = 30000; // 30 seconds cache

/**
 * JSONP Request Helper (Bypasses CORS restrictions)
 * @param {string} url - API endpoint URL
 * @param {string} callbackName - Callback function name
 * @param {number} timeout - Request timeout in milliseconds
 * @returns {Promise} Promise that resolves with API response
 */
function jsonpRequest(url, callbackName, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const callbackFunction = `jsonp_callback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    window[callbackFunction] = function(data) {
      delete window[callbackFunction];
      document.body.removeChild(script);
      clearTimeout(timer);
      resolve(data);
    };
    
    const separator = url.includes('?') ? '&' : '?';
    script.src = `${url}${separator}callback=${callbackFunction}`;
    
    const timer = setTimeout(() => {
      delete window[callbackFunction];
      document.body.removeChild(script);
      reject(new Error('JSONP request timeout'));
    }, timeout);
    
    script.onerror = () => {
      delete window[callbackFunction];
      document.body.removeChild(script);
      clearTimeout(timer);
      reject(new Error('JSONP request failed'));
    };
    
    document.body.appendChild(script);
  });
}

/**
 * Fetch existing bookings from Google Sheets with caching
 * Updates the bookedCache with already booked slots
 * @param {boolean} force - Force refresh cache
 * @returns {Promise<Object>} Booked cache
 */
async function fetchBookings(force = false) {
  const now = Date.now();
  
  // Return cached data if within cache duration
  if (!force && (now - lastFetchTime < CACHE_DURATION) && Object.keys(bookedCache).length > 0) {
    return bookedCache;
  }
  
  // Prevent multiple simultaneous requests
  if (fetchPromise) return fetchPromise;
  
  fetchPromise = (async () => {
    try {
      const data = await jsonpRequest(`${SCRIPT_URL}?action=getBookings&t=${now}`, 'callback');
      if (data && data.bookings) {
        bookedCache = data.bookings;
        lastFetchTime = now;
        // Save to localStorage as backup
        localStorage.setItem('vet_bookings', JSON.stringify(bookedCache));
        console.log('📅 Bookings fetched:', Object.keys(bookedCache).length, 'dates');
      }
    } catch (error) {
      console.warn('⚠️ Fetch error - using localStorage backup:', error);
      const local = localStorage.getItem('vet_bookings');
      if (local) bookedCache = JSON.parse(local);
    } finally {
      fetchPromise = null;
    }
    return bookedCache;
  })();
  
  return fetchPromise;
}

/**
 * Save booking to Google Sheets and local cache
 * @param {Object} bookingData - Booking information
 * @param {number} serialNumber - Generated serial number for the booking
 * @returns {Promise<boolean>} Success status
 */
async function saveBookingToSheet(bookingData, serialNumber) {
  try {
    await fetch(SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'addBooking', ...bookingData, serialNumber })
    });
    
    // Update local cache
    if (!bookedCache[bookingData.date]) bookedCache[bookingData.date] = [];
    bookedCache[bookingData.date].push(bookingData.timeSlot);
    localStorage.setItem('vet_bookings', JSON.stringify(bookedCache));
    
    return true;
  } catch (error) {
    console.error('❌ Save error:', error);
    // Save to localStorage as backup
    if (!bookedCache[bookingData.date]) bookedCache[bookingData.date] = [];
    bookedCache[bookingData.date].push(bookingData.timeSlot);
    localStorage.setItem('vet_bookings', JSON.stringify(bookedCache));
    return true;
  }
}

// ============================================
// SECTION 5: DATE PICKER & TIME SLOTS (FIXED)
// ============================================

/**
 * Initialize Flatpickr Date Picker with dynamic time slots
 * Time slots are generated based on selected date and admin configuration
 */
function initializeDatePicker() {
  datePicker = flatpickr("#datePicker", {
    dateFormat: "Y-m-d",
    minDate: "today",
    onChange: async (selectedDates, dateStr) => {
      if (!dateStr) return;
      
      currentDate = dateStr;
      const selectedDate = new Date(dateStr);
      const dayName = selectedDate.toLocaleDateString('en-US', { weekday: 'long' });
      
      // Generate slots using dynamic configuration
      const slots = generateTimeSlots(dayName);
      
      const container = getElement('timeSlotsContainer');
      if (!container) return;
      
      // Show loading state
      container.innerHTML = '<div class="time-slots-loading"><i class="fas fa-spinner fa-spin"></i> Loading available slots...</div>';
      
      // Fetch latest bookings
      await fetchBookings(true); // Force refresh
      const booked = bookedCache[dateStr] || [];
      
      // Clear container
      container.innerHTML = '';
      
      // Check if slots are available for this day
      if (slots.length === 0) {
        container.innerHTML = '<div class="time-slots-empty"><i class="fas fa-calendar-times"></i> No slots available for this day</div>';
        return;
      }
      
      // Use DocumentFragment for better performance
      const fragment = document.createDocumentFragment();
      
      // Create time slot buttons
      slots.forEach(slot => {
        const btn = document.createElement('div');
        const isBooked = booked.includes(slot);
        btn.className = `time-slot ${isBooked ? 'booked' : 'available'}`;
        btn.innerHTML = `<i class="fas fa-clock"></i> ${slot}`;
        
        if (!isBooked) {
          btn.onclick = () => {
            // Remove selected class from all slots
            document.querySelectorAll('.time-slot').forEach(el => {
              el.classList.remove('selected');
            });
            // Add selected class to clicked slot
            btn.classList.add('selected');
            selectedTime = slot;
            const selectedSlotInput = getElement('selectedSlot');
            if (selectedSlotInput) selectedSlotInput.value = slot;
          };
        }
        fragment.appendChild(btn);
      });
      
      container.appendChild(fragment);
      
      // Show message if all slots are booked
      const availableSlots = slots.filter(slot => !booked.includes(slot));
      if (availableSlots.length === 0) {
        const infoMsg = document.createElement('div');
        infoMsg.className = 'time-slots-empty';
        infoMsg.innerHTML = '<i class="fas fa-info-circle"></i> All slots are booked for this day. Please select another date.';
        container.appendChild(infoMsg);
      } else {
        // Show available slots count
        const infoMsg = document.createElement('div');
        infoMsg.className = 'slots-info';
        infoMsg.innerHTML = `<i class="fas fa-info-circle"></i> ${availableSlots.length} slot(s) available out of ${slots.length}`;
        container.appendChild(infoMsg);
      }
    }
  });
}

// ============================================
// SECTION 6: FORM HANDLING & VALIDATION
// ============================================

/**
 * Show message to user
 * @param {string} msg - Message to display
 * @param {string} type - Message type ('success' or 'error')
 */
function showMessage(msg, type) {
  const div = getElement('formMessage');
  if (!div) return;
  
  const bgColor = type === 'error' ? '#fef2f2' : '#f0fdf4';
  const textColor = type === 'error' ? '#ef4444' : '#15803d';
  const icon = type === 'error' ? '<i class="fas fa-exclamation-circle"></i>' : '<i class="fas fa-check-circle"></i>';
  
  div.innerHTML = `<div style="background:${bgColor};color:${textColor};padding:12px;border-radius:28px;display:flex;align-items:center;gap:8px;">${icon} ${msg}</div>`;
  setTimeout(() => div.innerHTML = '', 3000);
}

/**
 * Handle booking form submission
 * @param {Event} e - Form submit event
 */
async function handleBookingSubmit(e) {
  e.preventDefault();
  
  // Get form values
  const petName = getElement('petName')?.value.trim();
  const petAge = getElement('petAge')?.value.trim() || 'N/A';
  const petWeight = getElement('petWeight')?.value.trim() || 'N/A';
  const ownerName = getElement('ownerName')?.value.trim();
  const phone = getElement('phone')?.value.trim();
  const symptoms = getElement('symptoms')?.value.trim();
  
  // Validation
  if (!petName || !ownerName || !phone || !symptoms) {
    showMessage('Please fill all required fields', 'error');
    return;
  }
  
  if (!currentDate || !selectedTime) {
    showMessage('Please select a date and time slot', 'error');
    return;
  }
  
  // Check if slot is still available (double booking prevention)
  await fetchBookings(true); // Force refresh
  if (bookedCache[currentDate]?.includes(selectedTime)) {
    showMessage('This slot was just booked! Please select another time.', 'error');
    if (datePicker) datePicker.setDate(currentDate);
    return;
  }
  
  // Generate serial number and save booking
  const serialNumber = generateSerialNumber();
  const bookingData = { 
    petName, 
    petAge, 
    petWeight, 
    ownerName, 
    phone, 
    symptoms, 
    date: currentDate, 
    timeSlot: selectedTime, 
    timestamp: new Date().toISOString() 
  };
  
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.innerHTML;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
  submitBtn.disabled = true;
  
  try {
    await saveBookingToSheet(bookingData, serialNumber);
    
    const formattedDate = new Date(currentDate).toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    // Update popup with booking details
    const popupDetails = getElement('popupDetails');
    if (popupDetails) {
      popupDetails.innerHTML = `
        <div style="text-align:left; margin-top:16px;">
          <p><strong>🐾 Pet:</strong> ${escapeHtml(petName)}</p>
          <p><strong>👤 Owner:</strong> ${escapeHtml(ownerName)}</p>
          <p><strong>📞 Phone:</strong> ${escapeHtml(phone)}</p>
          <p><strong>📅 Date:</strong> ${formattedDate}</p>
          <p><strong>⏰ Time:</strong> ${selectedTime}</p>
          <p><strong>📝 Symptoms:</strong> ${escapeHtml(symptoms)}</p>
          <p><strong>👨‍⚕️ Doctor:</strong> Dr. Mitesh Tripura</p>
        </div>
      `;
    }
    
    // Update popup with serial number (🔢 SERIAL NO instead of TOKEN)
    const popupSerial = getElement('popupSerial');
    if (popupSerial) {
      popupSerial.innerHTML = `<strong>🔢 SERIAL NO:</strong> ${serialNumber}`;
      popupSerial.style.display = 'block';
    }
    
    const successPopup = getElement('successPopup');
    if (successPopup) successPopup.classList.add('active');
    
    // Reset form
    const bookingForm = getElement('bookingForm');
    if (bookingForm) bookingForm.reset();
    selectedTime = null;
    currentDate = null;
    if (datePicker) datePicker.clear();
    
    // Reset time slots container with proper empty state
    const timeSlotsContainer = getElement('timeSlotsContainer');
    if (timeSlotsContainer) {
      timeSlotsContainer.innerHTML = '<div class="time-slots-empty"><i class="fas fa-calendar-alt"></i> Select a date to see available time slots</div>';
    }
    
    const selectedSlotInput = getElement('selectedSlot');
    if (selectedSlotInput) selectedSlotInput.value = '';
    
    // Refresh bookings cache
    await fetchBookings(true);
    
    // Trigger notification for doctor portal (cross-tab communication)
    localStorage.setItem('doctor_notification_trigger', Date.now().toString());
    
  } catch (error) {
    console.error('❌ Booking error:', error);
    showMessage('Network error. Please try again.', 'error');
  } finally {
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
  }
}

// ============================================
// SECTION 7: HELPER FUNCTIONS
// ============================================

/**
 * Escape HTML to prevent XSS attacks
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Print appointment confirmation
 */
function printAppointment() { 
  window.print(); 
}

/**
 * Close success popup
 */
function closePopup() { 
  const successPopup = getElement('successPopup');
  if (successPopup) successPopup.classList.remove('active'); 
}

/**
 * Check available slots for a specific date
 * @param {string} date - Date string (YYYY-MM-DD)
 * @param {string} selectedTimeSlot - Optional time slot to check
 * @returns {Promise<Object>} Slot availability information
 */
async function checkAvailableSlots(date, selectedTimeSlot = null) {
  await fetchBookings();
  const dayName = new Date(date).toLocaleDateString('en-US', { weekday: 'long' });
  const allSlots = generateTimeSlots(dayName);
  const bookedSlots = bookedCache[date] || [];
  const availableSlots = allSlots.filter(slot => !bookedSlots.includes(slot));
  
  return {
    allSlots,
    bookedSlots,
    availableSlots,
    isAvailable: selectedTimeSlot ? !bookedSlots.includes(selectedTimeSlot) : null
  };
}

// ============================================
// SECTION 8: EVENT LISTENERS
// ============================================

/**
 * Setup all event listeners for the page
 */
function setupEventListeners() {
  // Booking form submit
  const bookingForm = getElement('bookingForm');
  if (bookingForm) {
    bookingForm.addEventListener('submit', handleBookingSubmit);
  }
  
  // Close popup button
  const closePopupBtn = getElement('closePopup');
  if (closePopupBtn) {
    closePopupBtn.addEventListener('click', closePopup);
  }
  
  // Print popup button
  const printPopupBtn = getElement('printPopupBtn');
  if (printPopupBtn) {
    printPopupBtn.addEventListener('click', printAppointment);
  }
  
  // Mobile menu toggle
  const menuIcon = getElement('menuIcon');
  const navLinks = getElement('navLinks');
  if (menuIcon && navLinks) {
    menuIcon.addEventListener('click', () => navLinks.classList.toggle('active'));
    document.querySelectorAll('.nav-links a').forEach(link => {
      link.addEventListener('click', () => {
        if (navLinks.classList.contains('active')) {
          navLinks.classList.remove('active');
        }
      });
    });
  }
  
  // Scroll to top button
  const scrollBtn = getElement('scrollTopBtn');
  if (scrollBtn) {
    window.addEventListener('scroll', () => {
      scrollBtn.classList.toggle('show', window.scrollY > 500);
    });
    scrollBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
  
  // Close popup on click outside
  const successPopup = getElement('successPopup');
  if (successPopup) {
    successPopup.addEventListener('click', (e) => {
      if (e.target === successPopup) closePopup();
    });
  }
}

// ============================================
// SECTION 9: EXPORT FUNCTIONS (for debugging)
// ============================================

// Expose functions to global scope for debugging (optional)
if (typeof window !== 'undefined') {
  window.debugBooking = {
    fetchBookings,
    checkAvailableSlots,
    getSlotConfig: () => slotConfig,
    getBookedCache: () => bookedCache,
    forceRefresh: () => fetchBookings(true),
    resetSerialCounter: () => { serialCounter = 1; saveSerialCounter(); }
  };
}


// ============================================
// SECTION 10: SERIAL NUMBER DISPLAY FIX
// ============================================

// Updated handleBookingSubmit function with proper serial number display
// Replace your existing handleBookingSubmit function with this:

async function handleBookingSubmit(e) {
  e.preventDefault();
  
  // Get form values
  const petName = getElement('petName')?.value.trim();
  const petAge = getElement('petAge')?.value.trim() || 'N/A';
  const petWeight = getElement('petWeight')?.value.trim() || 'N/A';
  const ownerName = getElement('ownerName')?.value.trim();
  const phone = getElement('phone')?.value.trim();
  const symptoms = getElement('symptoms')?.value.trim();
  
  // Validation
  if (!petName || !ownerName || !phone || !symptoms) {
    showMessage('Please fill all required fields', 'error');
    return;
  }
  
  if (!currentDate || !selectedTime) {
    showMessage('Please select a date and time slot', 'error');
    return;
  }
  
  // Check if slot is still available
  await fetchBookings(true);
  if (bookedCache[currentDate]?.includes(selectedTime)) {
    showMessage('This slot was just booked! Please select another time.', 'error');
    if (datePicker) datePicker.setDate(currentDate);
    return;
  }
  
  // Generate serial number
  const serialNumber = generateSerialNumber();
  const bookingData = { 
    petName, 
    petAge, 
    petWeight, 
    ownerName, 
    phone, 
    symptoms, 
    date: currentDate, 
    timeSlot: selectedTime, 
    timestamp: new Date().toISOString() 
  };
  
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.innerHTML;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
  submitBtn.disabled = true;
  
  try {
    await saveBookingToSheet(bookingData, serialNumber);
    
    const formattedDate = new Date(currentDate).toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    // Update popup with booking details
    const popupDetails = getElement('popupDetails');
    if (popupDetails) {
      popupDetails.innerHTML = `
        <div style="text-align:left; margin-top:16px;">
          <p><strong>🐾 Pet:</strong> ${escapeHtml(petName)}</p>
          <p><strong>👤 Owner:</strong> ${escapeHtml(ownerName)}</p>
          <p><strong>📞 Phone:</strong> ${escapeHtml(phone)}</p>
          <p><strong>📅 Date:</strong> ${formattedDate}</p>
          <p><strong>⏰ Time:</strong> ${selectedTime}</p>
          <p><strong>📝 Symptoms:</strong> ${escapeHtml(symptoms)}</p>
          <p><strong>👨‍⚕️ Doctor:</strong> Dr. Mitesh Tripura</p>
        </div>
      `;
    }
    
    // Update popup with serial number
    const popupSerial = getElement('popupSerial');
    if (popupSerial) {
      popupSerial.innerHTML = `<strong>🔢 SERIAL NO:</strong> ${serialNumber}`;
      popupSerial.style.display = 'block';
    }
    
    // Show success popup
    const successPopup = getElement('successPopup');
    if (successPopup) successPopup.classList.add('active');
    
    // Reset form
    const bookingForm = getElement('bookingForm');
    if (bookingForm) bookingForm.reset();
    selectedTime = null;
    currentDate = null;
    if (datePicker) datePicker.clear();
    
    // Reset time slots container
    const timeSlotsContainer = getElement('timeSlotsContainer');
    if (timeSlotsContainer) {
      timeSlotsContainer.innerHTML = '<div class="time-slots-empty"><i class="fas fa-calendar-alt"></i> Select a date to see available time slots</div>';
    }
    
    const selectedSlotInput = getElement('selectedSlot');
    if (selectedSlotInput) selectedSlotInput.value = '';
    
    // Refresh bookings cache
    await fetchBookings(true);
    
    // Trigger notification for doctor portal
    localStorage.setItem('doctor_notification_trigger', Date.now().toString());
    
  } catch (error) {
    console.error('❌ Booking error:', error);
    showMessage('Network error. Please try again.', 'error');
  } finally {
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
  }
}