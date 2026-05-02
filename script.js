// ============================================
// VET FOR PET CLINIC - CLIENT SIDE SCRIPT
// Google Sheets API Integration
// ============================================

// CONFIGURATION
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyL1X_hZMifdg1DKPT4lcGKIig022HceElgtrvV63VLM6gUxhiK7YbuT1l3j-9YM8a6Ng/exec";

// Slot Configuration (30-min intervals per day)
const slotConfig = {
  "Saturday": { start: 9, end: 21 },
  "Sunday": { start: 9, end: 15 },
  "Monday": { start: 9, end: 15 },
  "Tuesday": { start: 9, end: 21 },
  "Wednesday": { start: 9, end: 15 },
  "Thursday": { start: 9, end: 15 },
  "Friday": { start: 9, end: 15 }
};

// Global variables
let bookedCache = {};
let currentDate = null;
let selectedTime = null;
let datePicker = null;

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', function() {
  AOS.init({ duration: 800, once: true });
  setTimeout(() => { document.getElementById('loader').style.display = 'none'; }, 800);
  updateDateTime();
  setInterval(updateDateTime, 1000);
  initializeDatePicker();
  setupEventListeners();
  fetchBookings();
});

// Live Date & Time Update
function updateDateTime() {
  const now = new Date();
  const dateElem = document.getElementById('currentDate');
  const timeElem = document.getElementById('currentTime');
  if (dateElem) dateElem.innerText = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  if (timeElem) timeElem.innerText = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

// Generate Time Slots based on day
function generateTimeSlots(dayName) {
  const cfg = slotConfig[dayName];
  if (!cfg) return [];
  const slots = [];
  let hour = cfg.start, minute = 0;
  while (hour < cfg.end || (hour === cfg.end && minute === 0)) {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    let displayHour = hour % 12;
    if (displayHour === 0) displayHour = 12;
    slots.push(`${displayHour}:${minute.toString().padStart(2, '0')} ${ampm}`);
    minute += 30;
    if (minute >= 60) { hour++; minute = 0; }
  }
  return slots;
}

// JSONP Request Helper (CORS bypass)
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

// Fetch existing bookings from Google Sheets
async function fetchBookings() {
  try {
    const data = await jsonpRequest(`${SCRIPT_URL}?action=getBookings&t=${Date.now()}`, 'callback');
    if (data && data.bookings) bookedCache = data.bookings;
  } catch (error) {
    console.warn('Fetch error - using localStorage:', error);
    const local = localStorage.getItem('vet_bookings');
    if (local) bookedCache = JSON.parse(local);
  }
}

// Save booking to Google Sheets
async function saveBookingToSheet(bookingData, token) {
  try {
    await fetch(SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'addBooking', ...bookingData, token })
    });
    if (!bookedCache[bookingData.date]) bookedCache[bookingData.date] = [];
    bookedCache[bookingData.date].push(bookingData.timeSlot);
    localStorage.setItem('vet_bookings', JSON.stringify(bookedCache));
    return true;
  } catch (error) {
    if (!bookedCache[bookingData.date]) bookedCache[bookingData.date] = [];
    bookedCache[bookingData.date].push(bookingData.timeSlot);
    localStorage.setItem('vet_bookings', JSON.stringify(bookedCache));
    return true;
  }
}

// Date Picker Initialization
function initializeDatePicker() {
  datePicker = flatpickr("#datePicker", {
    dateFormat: "Y-m-d",
    minDate: "today",
    onChange: async (selectedDates, dateStr) => {
      currentDate = dateStr;
      const dayName = new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long' });
      const slots = generateTimeSlots(dayName);
      await fetchBookings();
      const booked = bookedCache[dateStr] || [];
      const container = document.getElementById('timeSlotsContainer');
      container.innerHTML = '';
      slots.forEach(slot => {
        const btn = document.createElement('div');
        const isBooked = booked.includes(slot);
        btn.className = `time-slot ${isBooked ? 'booked' : 'available'}`;
        btn.textContent = slot;
        if (!isBooked) {
          btn.onclick = () => {
            document.querySelectorAll('.time-slot').forEach(el => el.classList.remove('selected'));
            btn.classList.add('selected');
            selectedTime = slot;
            document.getElementById('selectedSlot').value = slot;
          };
        }
        container.appendChild(btn);
      });
      if (container.children.length === 0) container.innerHTML = '<div class="time-slot booked">No slots available</div>';
    }
  });
}

// Show Message
function showMessage(msg, type) {
  const div = document.getElementById('formMessage');
  const bgColor = type === 'error' ? '#fef2f2' : '#f0fdf4';
  const textColor = type === 'error' ? '#ef4444' : '#15803d';
  div.innerHTML = `<div style="background:${bgColor};color:${textColor};padding:12px;border-radius:28px;">${msg}</div>`;
  setTimeout(() => div.innerHTML = '', 3000);
}

// Generate Token
function generateToken() {
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 1000);
  return `VFP${timestamp}${random}`;
}

// Handle Booking Submit
async function handleBookingSubmit(e) {
  e.preventDefault();
  const petName = document.getElementById('petName').value.trim();
  const petAge = document.getElementById('petAge').value.trim() || 'N/A';
  const petWeight = document.getElementById('petWeight').value.trim() || 'N/A';
  const ownerName = document.getElementById('ownerName').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const symptoms = document.getElementById('symptoms').value.trim();
  
  if (!petName || !ownerName || !phone || !symptoms) {
    showMessage('Please fill all required fields', 'error');
    return;
  }
  if (!currentDate || !selectedTime) {
    showMessage('Please select date & time slot', 'error');
    return;
  }
  await fetchBookings();
  if (bookedCache[currentDate]?.includes(selectedTime)) {
    showMessage('This slot was just booked! Please select another time.', 'error');
    if (datePicker) datePicker.setDate(currentDate);
    return;
  }
  
  const token = generateToken();
  const bookingData = { petName, petAge, petWeight, ownerName, phone, symptoms, date: currentDate, timeSlot: selectedTime, timestamp: new Date().toISOString() };
  
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.innerHTML;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';
  submitBtn.disabled = true;
  
  try {
    await saveBookingToSheet(bookingData, token);
    const formattedDate = new Date(currentDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    document.getElementById('popupDetails').innerHTML = `<strong>🐾 Pet:</strong> ${petName}<br><strong>👤 Owner:</strong> ${ownerName}<br><strong>📞 Phone:</strong> ${phone}<br><strong>📅 Date:</strong> ${formattedDate}<br><strong>⏰ Time:</strong> ${selectedTime}<br><strong>📝 Symptoms:</strong> ${symptoms}<br><strong>👨‍⚕️ Doctor:</strong> Dr. Mitesh Tripura`;
    document.getElementById('popupToken').innerHTML = `<strong>🎫 TOKEN:</strong> ${token}`;
    document.getElementById('successPopup').classList.add('active');
    document.getElementById('bookingForm').reset();
    selectedTime = null;
    currentDate = null;
    if (datePicker) datePicker.clear();
    document.getElementById('timeSlotsContainer').innerHTML = '<div class="time-slot">Select a date</div>';
    await fetchBookings();
    // Trigger notification for doctor portal
    localStorage.setItem('doctor_notification_trigger', Date.now().toString());
  } catch (error) {
    showMessage('Network error. Please try again.', 'error');
  } finally {
    submitBtn.innerHTML = originalText;
    submitBtn.disabled = false;
  }
}

// Print Appointment
function printAppointment() { window.print(); }

// Close Popup
function closePopup() { document.getElementById('successPopup').classList.remove('active'); }

// Event Listeners Setup
function setupEventListeners() {
  document.getElementById('bookingForm').addEventListener('submit', handleBookingSubmit);
  document.getElementById('closePopup').addEventListener('click', closePopup);
  document.getElementById('printPopupBtn').addEventListener('click', printAppointment);
  
  const menuIcon = document.getElementById('menuIcon');
  const navLinks = document.getElementById('navLinks');
  if (menuIcon) menuIcon.addEventListener('click', () => navLinks.classList.toggle('active'));
  document.querySelectorAll('.nav-links a').forEach(link => link.addEventListener('click', () => navLinks.classList.remove('active')));
  
  const scrollBtn = document.getElementById('scrollTopBtn');
  window.addEventListener('scroll', () => scrollBtn.classList.toggle('show', window.scrollY > 500));
  if (scrollBtn) scrollBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}