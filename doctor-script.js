// ============================================
// DOCTOR DASHBOARD - COMPLETE SCRIPT
// Version: 6.0 | Fixed New Booking Popup Notification
// Last Updated: 2026
// ============================================

// ============================================
// SECTION 1: CONFIGURATION & GLOBAL VARIABLES
// ============================================

// Google Apps Script URL for backend API
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxxFwjqxDdC7uWqjF0CGbzYCHyZ1jZM_jsXz7P1FnNIANsAPpccZfvktQrFLrag3N1P/exec";

// Global state variables
let allAppointments = [];
let currentModalBookingId = null;
let currentViewBookingId = null;
let currentPage = 1;
let itemsPerPage = 10;
let doctorChart = null;
let isWelcomePopupShown = false;

// Track viewed appointments (notifications)
let viewedBookingIds = new Set();
let unviewedAppointments = [];

// Popup element reference
let welcomePopup = null;
let isPopupShowing = false;

// Auto check interval reference
let autoCheckInterval = null;

// Default slot configuration
const DEFAULT_SLOT_CONFIG = {
  "Saturday": { start: 9, end: 21 },
  "Sunday": { start: 9, end: 15 },
  "Monday": { start: 9, end: 15 },
  "Tuesday": { start: 9, end: 21 },
  "Wednesday": { start: 9, end: 15 },
  "Thursday": { start: 9, end: 15 },
  "Friday": { start: 9, end: 15 }
};

let slotConfig = { ...DEFAULT_SLOT_CONFIG };

// DOM cache
const domCache = {};

function getElement(id) {
  if (!domCache[id]) {
    domCache[id] = document.getElementById(id);
  }
  return domCache[id];
}

// ============================================
// SECTION 2: AUTHENTICATION CHECK (SIMPLIFIED)
// ============================================

/**
 * ডাক্তার লগইন চেক করে - শুধু sessionStorage চেক করে
 * কোনো অ্যাক্সেস কী ভেরিফিকেশন নেই
 */
(function() {
  // চেক করুন ডাক্তার লগইন করেছেন কিনা
  const doctorLoggedIn = sessionStorage.getItem('doctor_logged_in');
  
  if (!doctorLoggedIn || doctorLoggedIn !== 'true') {
    console.warn('🔒 No login found. Redirecting to login page...');
    window.location.href = 'doctor-login.html';
    return;
  }
  
  // লগইন সফল - স্বাগতম
  console.log('✅ Doctor authenticated successfully');
  
  // ডাক্তারের তথ্য UI তে দেখান
  const doctorName = sessionStorage.getItem('doctor_name') || 'Dr. Mitesh';
  const doctorRole = sessionStorage.getItem('doctor_role') || 'Senior Veterinarian';
  
  const welcomeName = getElement('welcomeName');
  const doctorNameSpan = getElement('doctorName');
  const doctorRoleSpan = getElement('doctorRole');
  const doctorWelcomeNameSpan = getElement('doctorWelcomeName');
  
  if (welcomeName) welcomeName.innerText = doctorName.split(' ')[0];
  if (doctorNameSpan) doctorNameSpan.innerText = doctorName;
  if (doctorRoleSpan) doctorRoleSpan.innerText = doctorRole;
  if (doctorWelcomeNameSpan) doctorWelcomeNameSpan.innerText = doctorName.split(' ')[0];
  
  // Viewed appointments লোড করুন
  loadViewedAppointments();
})();

// ============================================
// SECTION 3: API FUNCTIONS
// ============================================

/**
 * JSONP Request Helper
 */
function jsonpRequest(action, params = {}) {
  return new Promise((resolve, reject) => {
    const callbackName = `jsonp_callback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const script = document.createElement('script');
    
    let url = `${SCRIPT_URL}?action=${action}&callback=${callbackName}&t=${Date.now()}`;
    
    for (const key in params) {
      if (params[key] !== undefined && params[key] !== null) {
        url += `&${key}=${encodeURIComponent(params[key])}`;
      }
    }
    
    const timeout = setTimeout(() => {
      delete window[callbackName];
      if (document.body.contains(script)) document.body.removeChild(script);
      reject(new Error('JSONP request timeout'));
    }, 15000);
    
    window[callbackName] = function(data) {
      clearTimeout(timeout);
      delete window[callbackName];
      if (document.body.contains(script)) document.body.removeChild(script);
      resolve(data);
    };
    
    script.onerror = function() {
      clearTimeout(timeout);
      delete window[callbackName];
      if (document.body.contains(script)) document.body.removeChild(script);
      reject(new Error('JSONP request failed'));
    };
    
    script.src = url;
    document.body.appendChild(script);
  });
}

/**
 * POST to API
 */
async function postToAPI(data) {
  return new Promise((resolve) => {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = SCRIPT_URL;
    form.target = 'hidden_iframe';
    form.style.display = 'none';
    
    let iframe = document.querySelector('#hidden_iframe');
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.name = 'hidden_iframe';
      iframe.id = 'hidden_iframe';
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
    }
    
    iframe.onload = function() {
      resolve({ success: true });
    };
    
    for (const key in data) {
      const field = document.createElement('input');
      field.type = 'hidden';
      field.name = key;
      field.value = typeof data[key] === 'object' ? JSON.stringify(data[key]) : data[key];
      form.appendChild(field);
    }
    
    document.body.appendChild(form);
    form.submit();
    
    setTimeout(() => {
      if (document.body.contains(form)) document.body.removeChild(form);
    }, 100);
    
    setTimeout(() => {
      resolve({ success: true });
    }, 2000);
  });
}

async function fetchFromAPI(action, params = {}) {
  try {
    return await jsonpRequest(action, params);
  } catch (error) {
    console.error('API Error:', error);
    showToast('Network error. Please check your connection.', 'error');
    return null;
  }
}

// ============================================
// SECTION 4: SAVE MEDICAL INFO
// ============================================

async function saveMedicalInfo(bookingId, medicalData) {
  try {
    await postToAPI({ 
      action: 'updateMedicalInfo', 
      bookingId, 
      ...medicalData 
    });
    return true;
  } catch (error) {
    console.error('Save Error:', error);
    return false;
  }
}

// ============================================
// SECTION 5: LOAD ALL DATA
// ============================================

async function loadAllData(forceRefresh = false) {
  const data = await fetchFromAPI('getAppointments');
  
  if (data && data.appointments) {
    const oldUnviewedCount = getNewAppointmentsCount();
    
    allAppointments = data.appointments;
    
    updateDashboardStats();
    loadTodayPreview();
    loadRecentActivity();
    
    const todayPicker = getElement('todayDatePicker');
    if (todayPicker) loadTodayAppointments(todayPicker.value);
    
    const newUnviewedCount = getNewAppointmentsCount();
    
    console.log(`📊 Appointment stats - Unviewed: ${newUnviewedCount}`);
    
    // ============================================
    // FIXED: Show popup only for new bookings
    // ============================================
    if (!isPopupShowing && newUnviewedCount > 0) {
      console.log('🔔 New bookings detected! Showing popup...');
      setTimeout(() => showWelcomePopup(), 500);
    }
    
    updateNotificationBadge();
    
    // Start auto check for new appointments (only once)
    if (!window._autoCheckStarted) {
      startAutoNewAppointmentCheck();
      window._autoCheckStarted = true;
    }
  } else if (data && data.error) {
    showToast(data.error, 'error');
  } else {
    showToast('Could not load data', 'error');
  }
}

// ============================================
// SECTION 6: LOGOUT FUNCTION
// ============================================

function confirmLogout() {
  sessionStorage.clear();
  window.location.href = 'doctor-login.html';
}

// ============================================
// SECTION 7: VIEWED APPOINTMENTS TRACKING
// ============================================

function loadViewedAppointments() {
  const saved = localStorage.getItem('doctor_viewed_appointments');
  if (saved) {
    try {
      const viewedArray = JSON.parse(saved);
      viewedBookingIds = new Set(viewedArray);
      console.log('📋 Loaded viewed appointments:', viewedBookingIds.size);
    } catch (e) {
      console.error('Error loading viewed appointments:', e);
      viewedBookingIds = new Set();
    }
  } else {
    viewedBookingIds = new Set();
  }
}

function saveViewedAppointments() {
  const viewedArray = Array.from(viewedBookingIds);
  localStorage.setItem('doctor_viewed_appointments', JSON.stringify(viewedArray));
  console.log('💾 Saved viewed appointments:', viewedArray.length);
}

function markAppointmentAsViewed(bookingId) {
  if (!viewedBookingIds.has(bookingId)) {
    viewedBookingIds.add(bookingId);
    saveViewedAppointments();
    console.log('👁️ Marked appointment as viewed:', bookingId);
  }
}

function isAppointmentViewed(bookingId) {
  return viewedBookingIds.has(bookingId);
}

function getUnviewedAppointments() {
  return allAppointments.filter(app => !viewedBookingIds.has(app.bookingId));
}

function getNewAppointmentsCount() {
  return allAppointments.filter(app => !viewedBookingIds.has(app.bookingId)).length;
}

function markVisibleAppointmentsAsViewed() {
  const appointmentsList = document.querySelectorAll('.appointment-card, .history-item');
  let markedCount = 0;
  
  appointmentsList.forEach(item => {
    const onclickAttr = item.getAttribute('onclick');
    if (onclickAttr) {
      const match = onclickAttr.match(/viewAppointment\('([^']+)'\)/);
      if (match && match[1]) {
        const bookingId = match[1];
        if (!viewedBookingIds.has(bookingId)) {
          viewedBookingIds.add(bookingId);
          markedCount++;
        }
      }
    }
  });
  
  if (markedCount > 0) {
    saveViewedAppointments();
    console.log(`👁️ Marked ${markedCount} appointments as viewed from list`);
  }
}

// ============================================
// SECTION 8: WELCOME POPUP (FIXED - Only New Bookings)
// ============================================

/**
 * Show welcome popup with only new/unviewed appointments
 */
function showWelcomePopup() {
  unviewedAppointments = getUnviewedAppointments();
  const newCount = unviewedAppointments.length;
  
  console.log('🔔 showWelcomePopup called - New count:', newCount);
  
  // Don't show popup if already showing or no new appointments
  if (isPopupShowing || newCount === 0) {
    console.log('🚫 Not showing popup - no new appointments or already showing');
    return;
  }
  
  // Get today's Bangladesh date
  const today = getBangladeshDate();
  const todayNewAppointments = unviewedAppointments.filter(a => a.date === today).length;
  
  // Update popup statistics
  const newCountSpan = getElement('newAppointmentsCount');
  const todayCountSpan = getElement('todayAppointmentsCount');
  const totalCountSpan = getElement('totalAppointmentsCount');
  const popupMessageSpan = getElement('popupMessage');
  
  if (newCountSpan) newCountSpan.innerText = newCount;
  if (todayCountSpan) todayCountSpan.innerText = todayNewAppointments;
  if (totalCountSpan) totalCountSpan.innerText = allAppointments.length;
  
  // Set popup message based on number of new appointments
  if (popupMessageSpan) {
    if (newCount === 1) {
      popupMessageSpan.innerHTML = `🎉 You have <strong>1 new appointment</strong> waiting for you!`;
    } else if (newCount > 1) {
      popupMessageSpan.innerHTML = `🎉 You have <strong>${newCount} new appointments</strong> waiting for you!`;
    } else {
      popupMessageSpan.innerHTML = `📋 No new appointments. Total: ${allAppointments.length} appointments.`;
    }
  }
  
  // Show new appointments list (only new/unviewed ones)
  const newAppointmentsList = getElement('newAppointmentsList');
  if (newAppointmentsList) {
    if (unviewedAppointments.length > 0) {
      // Sort by date (newest first)
      const sortedNewApps = [...unviewedAppointments].sort((a, b) => {
        return new Date(b.timestamp) - new Date(a.timestamp);
      });
      
      newAppointmentsList.innerHTML = `
        <div class="new-appointment-header">
          <i class="fas fa-bell"></i> New Appointments (${unviewedAppointments.length}):
        </div>
        ${sortedNewApps.slice(0, 5).map(app => `
          <div class="new-appointment-item" onclick="closeWelcomePopupAndView('${app.bookingId}')">
            <div class="new-appointment-pet">
              <i class="fas fa-paw"></i> ${escapeHtml(app.petName)}
            </div>
            <div class="new-appointment-details">
              <span><i class="fas fa-calendar-alt"></i> ${app.date}</span>
              <span><i class="fas fa-clock"></i> ${app.time}</span>
              <span><i class="fas fa-user"></i> ${escapeHtml(app.ownerName)}</span>
            </div>
            <div class="new-appointment-token">Token: ${app.token}</div>
          </div>
        `).join('')}
      `;
      
      if (unviewedAppointments.length > 5) {
        newAppointmentsList.innerHTML += `<div class="new-appointment-more">+ ${unviewedAppointments.length - 5} more new appointments</div>`;
      }
    } else {
      newAppointmentsList.innerHTML = `<div class="no-new-appointments"><i class="fas fa-check-circle"></i> No new appointments</div>`;
    }
  }
  
  // Show the popup
  const popup = getElement('welcomePopup');
  if (popup) {
    popup.classList.add('active');
    isPopupShowing = true;
    isWelcomePopupShown = true;
    console.log('✅ Welcome popup shown with', newCount, 'new appointments');
  }
}

/**
 * Close welcome popup
 * @param {boolean} markAsViewed - Whether to mark all unviewed appointments as viewed
 */
function closeWelcomePopup(markAsViewed = true) {
  const popup = getElement('welcomePopup');
  if (popup) {
    popup.classList.remove('active');
    isPopupShowing = false;
  }
  
  if (markAsViewed && unviewedAppointments.length > 0) {
    unviewedAppointments.forEach(app => {
      if (!viewedBookingIds.has(app.bookingId)) {
        viewedBookingIds.add(app.bookingId);
      }
    });
    saveViewedAppointments();
    console.log(`✅ Marked ${unviewedAppointments.length} appointments as viewed`);
    unviewedAppointments = [];
    
    // Update notification badge after marking as viewed
    updateNotificationBadge();
  }
}

/**
 * Close popup and view specific appointment
 * @param {string} bookingId - The booking ID to view
 */
function closeWelcomePopupAndView(bookingId) {
  console.log('🔍 Opening appointment from popup:', bookingId);
  
  // Mark this specific appointment as viewed
  markAppointmentAsViewed(bookingId);
  
  // Update the unviewed list
  unviewedAppointments = getUnviewedAppointments();
  
  // Close popup
  const popup = getElement('welcomePopup');
  if (popup) {
    popup.classList.remove('active');
    isPopupShowing = false;
  }
  
  // Update notification badge
  updateNotificationBadge();
  
  // Open the appointment
  viewAppointment(bookingId);
}

/**
 * Auto check for new appointments periodically
 */
function startAutoNewAppointmentCheck() {
  if (autoCheckInterval) {
    clearInterval(autoCheckInterval);
  }
  
  autoCheckInterval = setInterval(() => {
    const newCount = getNewAppointmentsCount();
    console.log('🔍 Auto check - New appointments count:', newCount);
    
    if (!isPopupShowing && newCount > 0 && !isWelcomePopupShown) {
      console.log('🔔 Auto showing popup for new appointments');
      showWelcomePopup();
    }
  }, 30000); // Check every 30 seconds
}

/**
 * Check and show popup for new appointments
 */
function checkAndShowNewAppointmentsPopup() {
  const newCount = getNewAppointmentsCount();
  console.log('📊 Checking for new appointments - Count:', newCount);
  
  if (!isPopupShowing && newCount > 0) {
    setTimeout(() => showWelcomePopup(), 500);
  }
}

// ============================================
// SECTION 9: BANGLADESH TIME ZONE FUNCTIONS (FIXED)
// ============================================

/**
 * বাংলাদেশের বর্তমান সময় রিটার্ন করে (Date object)
 * বাংলাদেশ সময় UTC+6:00
 */
function getBangladeshTime() {
  const now = new Date();
  // বাংলাদেশের সময় UTC+6 ঘন্টা
  const bangladeshOffsetMs = 6 * 60 * 60 * 1000;
  const bangladeshMs = now.getTime() + bangladeshOffsetMs;
  return new Date(bangladeshMs);
}

/**
 * বাংলাদেশের বর্তমান তারিখ রিটার্ন করে (YYYY-MM-DD ফরম্যাটে)
 */
function getBangladeshDate() {
  const now = new Date();
  const bdTime = new Date(now.getTime() + (6 * 60 * 60 * 1000));
  const year = bdTime.getUTCFullYear();
  const month = String(bdTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(bdTime.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * বাংলাদেশের বর্তমান সময় রিটার্ন করে (ফরম্যাটেড - যেমন: 07:16 PM)
 */
function getBangladeshFormattedTime() {
  const now = new Date();
  const bdTime = new Date(now.getTime() + (6 * 60 * 60 * 1000));
  
  let hours = bdTime.getUTCHours();
  const minutes = bdTime.getUTCMinutes();
  const seconds = bdTime.getUTCSeconds();
  
  // AM/PM নির্ধারণ
  const ampm = hours >= 12 ? 'PM' : 'AM';
  
  // 12-ঘন্টা ফরম্যাটে রূপান্তর
  hours = hours % 12;
  hours = hours ? hours : 12; // 0 কে 12 এ রূপান্তর
  
  // মিনিট এবং সেকেন্ড প্যাডিং
  const minutesStr = String(minutes).padStart(2, '0');
  const secondsStr = String(seconds).padStart(2, '0');
  
  return `${String(hours).padStart(2, '0')}:${minutesStr}:${secondsStr} ${ampm}`;
}

/**
 * শুধু সময় (সেকেন্ড ছাড়া) রিটার্ন করে
 */
function getBangladeshTimeShort() {
  const now = new Date();
  const bdTime = new Date(now.getTime() + (6 * 60 * 60 * 1000));
  
  let hours = bdTime.getUTCHours();
  const minutes = bdTime.getUTCMinutes();
  
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${ampm}`;
}

/**
 * সম্পূর্ণ তারিখ এবং সময় রিটার্ন করে (ডিসপ্লের জন্য)
 */
function getBangladeshDateTimeDisplay() {
  const now = new Date();
  const bdTime = new Date(now.getTime() + (6 * 60 * 60 * 1000));
  
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const dayName = days[bdTime.getUTCDay()];
  const monthName = months[bdTime.getUTCMonth()];
  const date = bdTime.getUTCDate();
  const year = bdTime.getUTCFullYear();
  
  let hours = bdTime.getUTCHours();
  const minutes = String(bdTime.getUTCMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hoursStr = String(hours).padStart(2, '0');
  
  return {
    date: `${dayName}, ${monthName} ${date}, ${year}`,
    time: `${hoursStr}:${minutes} ${ampm}`,
    full: `${dayName}, ${monthName} ${date}, ${year} - ${hoursStr}:${minutes} ${ampm}`
  };
}

// ============================================
// SECTION 10: SLOT CONFIGURATION
// ============================================

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
    
    slots.push(`${displayHour}:${minute.toString().padStart(2, '0')} ${ampm}`);
    minute += 30;
    if (minute >= 60) {
      hour++;
      minute = 0;
    }
  }
  return slots;
}

// ============================================
// SECTION 11: PROFILE DATA MANAGEMENT
// ============================================

function loadProfileData() {
  const profileName = getElement('profileName');
  const profileEmail = getElement('profileEmail');
  const profileRole = getElement('profileRole');
  const profileSpecialization = getElement('profileSpecialization');
  const profilePhone = getElement('profilePhone');
  const profileSchedule = getElement('profileSchedule');
  const profileJoined = getElement('profileJoined');
  
  if (profileName) profileName.innerText = sessionStorage.getItem('doctor_name') || 'Dr. Mitesh Tripura';
  if (profileEmail) profileEmail.innerText = sessionStorage.getItem('doctor_email') || 'doctor@vetforpet.com';
  if (profileRole) profileRole.innerText = sessionStorage.getItem('doctor_role') || 'Senior Veterinarian';
  if (profileSpecialization) profileSpecialization.innerText = sessionStorage.getItem('doctor_specialization') || 'General Veterinary';
  if (profilePhone) profilePhone.innerText = sessionStorage.getItem('doctor_phone') || '01406779238';
  if (profileSchedule) profileSchedule.innerText = sessionStorage.getItem('doctor_schedule') || 'Sat-Wed 9AM-9PM';
  if (profileJoined) profileJoined.innerText = '2024';
}

function openAvatarUploadModal() {
  const fileInput = getElement('profileImageUpload');
  if (fileInput) fileInput.click();
  else showToast('Image upload feature coming soon!', 'info');
}

function loadProfileImage() {
  const savedImage = localStorage.getItem('doctor_profile_image');
  const avatarImg = getElement('profileAvatarImg');
  const avatarIcon = getElement('avatarIcon');
  const editAvatarImg = getElement('editAvatarImg');
  const editAvatarIcon = getElement('editAvatarIcon');
  
  if (savedImage && savedImage !== '') {
    if (avatarImg) {
      avatarImg.src = savedImage;
      avatarImg.style.display = 'block';
      if (avatarIcon) avatarIcon.style.display = 'none';
    }
    if (editAvatarImg) {
      editAvatarImg.src = savedImage;
      editAvatarImg.style.display = 'block';
      if (editAvatarIcon) editAvatarIcon.style.display = 'none';
    }
  } else {
    if (avatarImg) {
      avatarImg.src = '';
      avatarImg.style.display = 'none';
      if (avatarIcon) avatarIcon.style.display = 'flex';
    }
    if (editAvatarImg) {
      editAvatarImg.src = '';
      editAvatarImg.style.display = 'none';
      if (editAvatarIcon) editAvatarIcon.style.display = 'flex';
    }
  }
}

// ============================================
// SECTION 12: INITIALIZATION & DATE TIME UPDATE (FIXED)
// ============================================

/**
 * ডেট এবং টাইম আপডেট করে (প্রতি সেকেন্ডে)
 * বাংলাদেশ সময় সঠিকভাবে দেখানোর জন্য ফিক্স করা হয়েছে
 */
function updateDateTime() {
  const dateTimeDisplay = getBangladeshDateTimeDisplay();
  const timeShort = getBangladeshTimeShort();
  
  const dateElem = getElement('currentDate');
  const timeElem = getElement('currentTime');
  
  if (dateElem) {
    dateElem.innerText = dateTimeDisplay.date;
  }
  
  if (timeElem) {
    timeElem.innerText = timeShort;
  }
  
  // সিংক স্ট্যাটাস আপডেট (ঐচ্ছিক)
  const syncStatus = getElement('syncStatus');
  if (syncStatus && syncStatus.innerHTML && !syncStatus.innerHTML.includes('Synced at')) {
    // শুধু মাঝে মাঝে আপডেট
    const seconds = new Date().getSeconds();
    if (seconds === 0 || seconds === 30) {
      syncStatus.innerHTML = `<i class="fas fa-check-circle"></i> Synced at ${getBangladeshTimeShort()}`;
      setTimeout(() => {
        if (syncStatus) syncStatus.innerHTML = `<i class="fas fa-check-circle"></i> Synced`;
      }, 2000);
    }
  }
}

// পেজ লোড হওয়ার পর সবকিছু সেটআপ করুন
document.addEventListener('DOMContentLoaded', function() {
  // স্লট কনফিগারেশন লোড করুন
  loadSlotConfig();
  
  // ডেট টাইম আপডেট করুন (প্রথম বার কল)
  updateDateTime();
  
  // প্রতি ১ সেকেন্ড পর পর ডেট টাইম আপডেট করুন
  setInterval(updateDateTime, 1000);
  
  // নেভিগেশন সেটআপ করুন
  setupNavigation();
  
  // সব ডাটা লোড করুন
  loadAllData();
  
  // প্রোফাইল ডাটা লোড করুন
  loadProfileData();
  
  // প্রোফাইল ইমেজ লোড করুন
  loadProfileImage();
  
  // ইমেজ আপলোড সেটআপ করুন
  setupImageUpload();
  
  // রিয়েল টাইম সার্চ সেটআপ করুন
  setupRealTimeSearch();
  
  // স্টোরেজ লিসেনার সেটআপ করুন
  setupStorageListener();
  
  // টুডে ডেট পিকার সেটআপ করুন
  const todayPicker = getElement('todayDatePicker');
  if (todayPicker) {
    todayPicker.value = getBangladeshDate();
    todayPicker.addEventListener('change', () => loadTodayAppointments());
  }
  
  // মোডাল ক্লোজ সেটআপ করুন
  setupModalClose();
});

function setupStorageListener() {
  window.addEventListener('storage', function(e) {
    if (e.key === 'doctor_notification_trigger' || e.key === 'vet_bookings') {
      console.log('🔄 New booking detected from another tab!');
      setTimeout(() => {
        loadAllData(true);
      }, 500);
    }
  });
}

// ============================================
// SECTION 13: NAVIGATION
// ============================================

function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const pages = document.querySelectorAll('.page-content');
  
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.getAttribute('data-page');
      
      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');
      
      pages.forEach(p => p.classList.remove('active'));
      const targetPage = getElement(page + 'Page');
      if (targetPage) targetPage.classList.add('active');
      
      const pageTitle = getElement('pageTitle');
      if (pageTitle) pageTitle.innerText = item.querySelector('span')?.innerText || page;
      
      if (page === 'today') loadTodayAppointments();
      if (page === 'all') loadAllAppointments();
      if (page === 'prescriptions') loadPrescriptions();
      if (page === 'medical') loadMedicalRecords();
      if (page === 'reports') loadDoctorReport();
      if (page === 'search') {
        setTimeout(() => markVisibleAppointmentsAsViewed(), 500);
      }
    });
  });
}

function goToPage(pageId) {
  const navItem = document.querySelector(`.nav-item[data-page="${pageId}"]`);
  if (navItem) navItem.click();
}

function refreshAllData() {
  loadAllData(true);
  showToast('Data refreshed!', 'success');
}

// ============================================
// SECTION 14: STATS & DISPLAY FUNCTIONS
// ============================================

function updateDashboardStats() {
  const today = getBangladeshDate();
  const todayApps = allAppointments.filter(a => a.date === today);
  const completedApps = allAppointments.filter(a => a.status === 'Completed');
  const pendingApps = allAppointments.filter(a => a.status === 'Confirmed' || a.status === 'In Progress');
  const uniquePets = [...new Set(allAppointments.map(a => a.petName))];
  
  const todayStats = getElement('todayStatsCount');
  const todayBadge = getElement('todayBadge');
  const completedCount = getElement('completedCount');
  const pendingCount = getElement('pendingCount');
  const totalPets = getElement('totalPetsCount');
  
  if (todayStats) todayStats.innerText = todayApps.length;
  if (todayBadge) {
    const newCount = getNewAppointmentsCount();
    if (newCount > 0) {
      todayBadge.innerText = newCount;
      todayBadge.style.backgroundColor = '#ef4444';
    } else {
      todayBadge.innerText = todayApps.length;
      todayBadge.style.backgroundColor = '';
    }
  }
  if (completedCount) completedCount.innerText = completedApps.length;
  if (pendingCount) pendingCount.innerText = pendingApps.length;
  if (totalPets) totalPets.innerText = uniquePets.length;
}

function updateNotificationBadge() {
  const newCount = getNewAppointmentsCount();
  const todayBadge = getElement('todayBadge');
  if (todayBadge) {
    if (newCount > 0) {
      todayBadge.innerText = newCount;
      todayBadge.style.backgroundColor = '#ef4444';
    } else {
      const todayCount = allAppointments.filter(a => a.date === getBangladeshDate()).length;
      todayBadge.innerText = todayCount;
      todayBadge.style.backgroundColor = '';
    }
  }
}

function loadTodayPreview() {
  const container = getElement('todayPreview');
  if (!container) return;
  
  const today = getBangladeshDate();
  const todayApps = allAppointments.filter(a => a.date === today).slice(0, 5);
  
  if (todayApps.length === 0) {
    container.innerHTML = '<div class="empty-state">No appointments today</div>';
    return;
  }
  
  container.innerHTML = todayApps.map(app => `
    <div class="history-item" onclick="viewAppointment('${app.bookingId}')">
      <div style="display: flex; justify-content: space-between;">
        <strong>${escapeHtml(app.petName)}</strong>
        <span class="token">${app.token}</span>
      </div>
      <div style="font-size: 0.85rem;">${app.time} | ${escapeHtml(app.ownerName)}</div>
    </div>
  `).join('');
}

function loadRecentActivity() {
  const container = getElement('recentActivity');
  if (!container) return;
  
  const recent = [...allAppointments]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 5);
  
  if (recent.length === 0) {
    container.innerHTML = '<div class="empty-state">No recent activity</div>';
    return;
  }
  
  container.innerHTML = recent.map(app => `
    <div class="history-item" style="border-left-color: #22c55e;" onclick="viewAppointment('${app.bookingId}')">
      <div style="display: flex; justify-content: space-between;">
        <strong>${escapeHtml(app.petName)}</strong>
        <span class="status ${app.status === 'Completed' ? 'completed' : 'confirmed'}">${app.status || 'Confirmed'}</span>
      </div>
      <div style="font-size: 0.85rem;">${escapeHtml(app.ownerName)} | ${app.time} | ${app.date}</div>
    </div>
  `).join('');
}

// ============================================
// SECTION 15: TODAY'S APPOINTMENTS
// ============================================

async function loadTodayAppointments() {
  const container = getElement('todayAppointments');
  if (!container) return;
  
  const selectedDate = getElement('todayDatePicker')?.value || getBangladeshDate();
  container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
  
  const filteredApps = allAppointments.filter(a => a.date === selectedDate);
  
  if (filteredApps.length === 0) {
    container.innerHTML = `<div class="empty-state"><i class="fas fa-calendar-day"></i> No appointments for ${selectedDate}</div>`;
    return;
  }
  
  filteredApps.sort((a, b) => a.time.localeCompare(b.time));
  container.innerHTML = filteredApps.map(app => createAppointmentCard(app)).join('');
  
  setTimeout(() => markVisibleAppointmentsAsViewed(), 1000);
}

// ============================================
// SECTION 16: ALL APPOINTMENTS
// ============================================

async function loadAllAppointments() {
  const container = getElement('allAppointments');
  if (!container) return;
  
  const filterText = getElement('allFilterInput')?.value.toLowerCase() || '';
  const statusFilter = getElement('statusFilter')?.value || 'all';
  
  let filtered = [...allAppointments];
  
  if (filterText) {
    filtered = filtered.filter(a => 
      a.petName.toLowerCase().includes(filterText) ||
      a.ownerName.toLowerCase().includes(filterText) ||
      a.ownerPhone.includes(filterText) ||
      a.token.toLowerCase().includes(filterText)
    );
  }
  
  if (statusFilter !== 'all') {
    filtered = filtered.filter(a => a.status === statusFilter);
  }
  
  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const start = (currentPage - 1) * itemsPerPage;
  const paginated = filtered.slice(start, start + itemsPerPage);
  
  if (paginated.length === 0) {
    container.innerHTML = '<div class="empty-state">No appointments found</div>';
  } else {
    container.innerHTML = paginated.map(app => createHistoryItem(app)).join('');
  }
  
  renderPagination(totalPages);
  setTimeout(() => markVisibleAppointmentsAsViewed(), 1000);
}

function renderPagination(totalPages) {
  const container = getElement('pagination');
  if (!container) return;
  if (totalPages <= 1) { container.innerHTML = ''; return; }
  let html = '';
  for (let i = 1; i <= Math.min(totalPages, 10); i++) {
    html += `<button class="${i === currentPage ? 'active' : ''}" onclick="goToPageNum(${i})">${i}</button>`;
  }
  container.innerHTML = html;
}

function goToPageNum(page) {
  currentPage = page;
  loadAllAppointments();
}

function filterAllAppointments() {
  currentPage = 1;
  loadAllAppointments();
}

// ============================================
// SECTION 17: SEARCH PATIENT
// ============================================

function setupRealTimeSearch() {
  const searchInput = getElement('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      performSearch();
    });
  }
}

function clearSearch() {
  const searchInput = getElement('searchInput');
  if (searchInput) {
    searchInput.value = '';
  }
  performSearch();
}

async function performSearch() {
  const searchInput = getElement('searchInput');
  const container = getElement('searchResults');
  
  if (!searchInput || !container) return;
  
  const term = searchInput.value.trim();
  
  if (!term) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-search"></i>
        <h4>Start Searching</h4>
        <p>Enter pet name, owner name, phone number or token to search</p>
        <small>Try searching with any keyword</small>
      </div>`;
    return;
  }
  
  container.innerHTML = `
    <div class="search-loading">
      <div class="loading-spinner"></div>
      <p><i class="fas fa-spinner fa-spin"></i> Searching for "${escapeHtml(term)}"...</p>
    </div>`;
  
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const searchTermLower = term.toLowerCase();
  const results = allAppointments.filter(app => {
    const petNameMatch = app.petName?.toLowerCase().includes(searchTermLower);
    const ownerNameMatch = app.ownerName?.toLowerCase().includes(searchTermLower);
    const phoneMatch = app.ownerPhone?.toString().includes(term);
    const tokenMatch = app.token?.toLowerCase().includes(searchTermLower);
    const symptomsMatch = app.symptoms?.toLowerCase().includes(searchTermLower);
    const diagnosisMatch = app.diagnosis?.toLowerCase().includes(searchTermLower);
    
    return petNameMatch || ownerNameMatch || phoneMatch || tokenMatch || symptomsMatch || diagnosisMatch;
  });
  
  if (results.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-user-slash"></i>
        <h4>No Patients Found</h4>
        <p>No results found for "${escapeHtml(term)}"</p>
        <small>Try searching with pet name, owner name, phone number or token</small>
      </div>`;
    return;
  }
  
  container.innerHTML = `
    <div class="search-results-header">
      <h4><i class="fas fa-list"></i> Search Results (${results.length})</h4>
      <p>Found ${results.length} appointment(s) for "${escapeHtml(term)}"</p>
    </div>
    <div class="appointments-grid">
      ${results.map(app => createAppointmentCard(app)).join('')}
    </div>
  `;
  
  showToast(`✅ Found ${results.length} result(s) for "${escapeHtml(term)}"`, 'success');
}

async function searchPatients() {
  await performSearch();
}

// ============================================
// SECTION 18: PRESCRIPTIONS & MEDICAL RECORDS
// ============================================

async function loadPrescriptions() {
  const container = getElement('prescriptionsList');
  if (!container) return;
  
  const prescriptions = allAppointments.filter(a => a.prescription && a.prescription !== '');
  
  if (prescriptions.length === 0) {
    container.innerHTML = '<div class="empty-state">No prescriptions yet</div>';
    return;
  }
  
  container.innerHTML = prescriptions.map(app => `
    <div class="history-item" onclick="viewAppointment('${app.bookingId}')">
      <div style="display: flex; justify-content: space-between;">
        <strong>${escapeHtml(app.petName)}</strong>
        <span class="token">${app.token}</span>
      </div>
      <div style="margin-top: 10px;">
        <strong>Prescription:</strong><br>
        <div style="background: #f1f5f9; padding: 10px; border-radius: 8px; margin-top: 5px;">${escapeHtml(app.prescription)}</div>
      </div>
      ${app.diagnosis ? `<div style="margin-top: 8px;"><strong>Diagnosis:</strong> ${escapeHtml(app.diagnosis)}</div>` : ''}
    </div>
  `).join('');
}

async function loadMedicalRecords() {
  const container = getElement('medicalRecordsList');
  if (!container) return;
  
  const records = allAppointments.filter(a => a.diagnosis || a.prescription);
  
  if (records.length === 0) {
    container.innerHTML = '<div class="empty-state">No medical records yet</div>';
    return;
  }
  
  container.innerHTML = records.map(app => `
    <div class="history-item" onclick="viewAppointment('${app.bookingId}')">
      <div style="display: flex; justify-content: space-between;">
        <strong>${escapeHtml(app.petName)}</strong>
        <span class="token">${app.token}</span>
      </div>
      <div><strong>Diagnosis:</strong> ${escapeHtml(app.diagnosis || 'N/A')}</div>
      <div><strong>Prescription:</strong> ${escapeHtml((app.prescription || '').substring(0, 100))}${(app.prescription || '').length > 100 ? '...' : ''}</div>
    </div>
  `).join('');
}

// ============================================
// SECTION 19: DOCTOR REPORT & CHART
// ============================================

async function loadDoctorReport() {
  const period = getElement('reportPeriod')?.value || 'weekly';
  let filtered = [...allAppointments];
  
  if (period === 'weekly') {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    filtered = filtered.filter(a => new Date(a.date) >= weekAgo);
  } else if (period === 'monthly') {
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    filtered = filtered.filter(a => new Date(a.date) >= monthAgo);
  } else {
    const yearAgo = new Date();
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);
    filtered = filtered.filter(a => new Date(a.date) >= yearAgo);
  }
  
  const totalElem = getElement('reportTotal');
  const completedElem = getElement('reportCompleted');
  const cancelledElem = getElement('reportCancelled');
  
  if (totalElem) totalElem.innerText = filtered.length;
  if (completedElem) completedElem.innerText = filtered.filter(a => a.status === 'Completed').length;
  if (cancelledElem) cancelledElem.innerText = filtered.filter(a => a.status === 'Cancelled').length;
  
  updateDoctorChart(filtered);
}

function updateDoctorChart(appointments) {
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    last7Days.push(date.toISOString().split('T')[0]);
  }
  
  const dailyCounts = last7Days.map(date => appointments.filter(a => a.date === date).length);
  
  const ctx = getElement('doctorChart')?.getContext('2d');
  if (!ctx) return;
  
  if (doctorChart) doctorChart.destroy();
  
  doctorChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: last7Days.map(d => new Date(d).toLocaleDateString('en-US', { weekday: 'short' })),
      datasets: [{
        label: 'Appointments',
        data: dailyCounts,
        backgroundColor: '#f97316',
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: { legend: { display: false } }
    }
  });
}

// ============================================
// SECTION 20: VIEW APPOINTMENT
// ============================================

function viewAppointment(bookingId) {
  const app = allAppointments.find(a => a.bookingId === bookingId);
  if (!app) return;
  
  currentViewBookingId = bookingId;
  const detailsDiv = getElement('viewAppointmentDetails');
  
  if (!detailsDiv) return;
  
  detailsDiv.innerHTML = `
    <div style="margin-bottom: 8px;"><strong>Token:</strong> ${app.token}</div>
    <div style="margin-bottom: 8px;"><strong>Date:</strong> ${app.date} | <strong>Time:</strong> ${app.time}</div>
    <div style="margin-bottom: 8px;"><strong>Pet:</strong> ${escapeHtml(app.petName)} (${app.petAge || 'N/A'})</div>
    <div style="margin-bottom: 8px;"><strong>Owner:</strong> ${escapeHtml(app.ownerName)} | <strong>Phone:</strong> ${app.ownerPhone}</div>
    <div style="margin-bottom: 8px;"><strong>Symptoms:</strong> ${escapeHtml(app.symptoms || 'N/A')}</div>
    <div style="margin-bottom: 8px;"><strong>Diagnosis:</strong> ${escapeHtml(app.diagnosis || 'N/A')}</div>
    <div style="margin-bottom: 8px;"><strong>Prescription:</strong><br>${escapeHtml(app.prescription || 'N/A')}</div>
    <div style="margin-bottom: 8px;"><strong>Status:</strong> <span class="status ${app.status === 'Completed' ? 'completed' : 'confirmed'}">${app.status || 'Confirmed'}</span></div>
  `;
  
  const modal = getElement('viewAppointmentModal');
  if (modal) {
    modal.classList.add('show');
    modal.style.display = 'flex';
  }
}

function closeViewModal() {
  const modal = getElement('viewAppointmentModal');
  if (modal) {
    modal.classList.remove('show');
    modal.style.display = 'none';
  }
}

function openMedicalFromView() {
  closeViewModal();
  openMedicalModal(currentViewBookingId);
}

function printAppointmentFromView() {
  const app = allAppointments.find(a => a.bookingId === currentViewBookingId);
  if (!app) return;
  
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head><title>Appointment - ${app.token}</title>
    <style>body{font-family:Arial;padding:20px}.header{text-align:center;margin-bottom:20px}</style>
    </head>
    <body>
      <div class="header"><h2>VET FOR PET CLINIC</h2><p>Dhaka, Bangladesh | 01609-420061</p></div>
      <h3>Appointment Details</h3>
      <p><strong>Token:</strong> ${app.token}<br><strong>Date:</strong> ${app.date}<br><strong>Pet:</strong> ${app.petName}<br><strong>Owner:</strong> ${app.ownerName}<br><strong>Phone:</strong> ${app.ownerPhone}<br><strong>Symptoms:</strong> ${app.symptoms||'N/A'}<br><strong>Diagnosis:</strong> ${app.diagnosis||'N/A'}<br><strong>Prescription:</strong><br>${app.prescription||'N/A'}</p>
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
}

// ============================================
// SECTION 21: MEDICAL MODAL FUNCTIONS
// ============================================

function openMedicalModal(bookingId) {
  const app = allAppointments.find(a => a.bookingId === bookingId);
  if (!app) return;
  
  currentModalBookingId = bookingId;
  
  const summaryPetName = getElement('summaryPetName');
  const summaryDate = getElement('summaryDate');
  const summaryTime = getElement('summaryTime');
  const summaryToken = getElement('summaryToken');
  const summaryOwner = getElement('summaryOwner');
  const summaryPhone = getElement('summaryPhone');
  const modalSymptoms = getElement('modalSymptoms');
  const modalTemperature = getElement('modalTemperature');
  const modalHeartRate = getElement('modalHeartRate');
  const modalRespiratory = getElement('modalRespiratory');
  const modalDiagnosis = getElement('modalDiagnosis');
  const modalClinicalFindings = getElement('modalClinicalFindings');
  const modalTreatmentPlan = getElement('modalTreatmentPlan');
  const modalFollowup = getElement('modalFollowup');
  const modalNotes = getElement('modalNotes');
  const modalStatus = getElement('modalStatus');
  const modalOwnerEmail = getElement('modalOwnerEmail');
  const modalEmailReminder = getElement('modalEmailReminder');
  
  if (summaryPetName) summaryPetName.innerHTML = app.petName;
  if (summaryDate) summaryDate.innerText = app.date;
  if (summaryTime) summaryTime.innerText = app.time;
  if (summaryToken) summaryToken.innerHTML = app.token;
  if (summaryOwner) summaryOwner.innerHTML = app.ownerName;
  if (summaryPhone) summaryPhone.innerHTML = app.ownerPhone;
  if (modalSymptoms) modalSymptoms.innerHTML = app.symptoms || 'No symptoms recorded';
  if (modalTemperature) modalTemperature.value = app.temperature || '';
  if (modalHeartRate) modalHeartRate.value = app.heartRate || '';
  if (modalRespiratory) modalRespiratory.value = app.respiratoryRate || '';
  if (modalDiagnosis) modalDiagnosis.value = app.diagnosis || '';
  if (modalClinicalFindings) modalClinicalFindings.value = app.clinicalFindings || '';
  if (modalTreatmentPlan) modalTreatmentPlan.value = app.treatmentPlan || '';
  if (modalFollowup) modalFollowup.value = app.followUpDate || '';
  if (modalNotes) modalNotes.value = app.notes || '';
  if (modalStatus) modalStatus.value = app.status || 'Confirmed';
  if (modalOwnerEmail) modalOwnerEmail.value = app.ownerEmail || '';
  if (modalEmailReminder) modalEmailReminder.checked = app.emailReminder === 'true';
  
  loadPrescriptionList(app.prescription || '');
  
  const modal = getElement('medicalModal');
  if (modal) {
    modal.classList.add('show');
    modal.style.display = 'flex';
  }
}

function closeMedicalModal() {
  const modal = getElement('medicalModal');
  if (modal) {
    modal.classList.remove('show');
    modal.style.display = 'none';
  }
}

function closeModal() {
  closeMedicalModal();
}

async function saveModalMedicalInfo() {
  const prescriptionText = getPrescriptionText();
  const ownerEmail = getElement('modalOwnerEmail')?.value || '';
  const emailReminder = getElement('modalEmailReminder')?.checked || false;
  
  const medicalData = {
    temperature: getElement('modalTemperature')?.value || '',
    heartRate: getElement('modalHeartRate')?.value || '',
    respiratoryRate: getElement('modalRespiratory')?.value || '',
    diagnosis: getElement('modalDiagnosis')?.value || '',
    clinicalFindings: getElement('modalClinicalFindings')?.value || '',
    prescription: prescriptionText,
    treatmentPlan: getElement('modalTreatmentPlan')?.value || '',
    followUpDate: getElement('modalFollowup')?.value || '',
    notes: getElement('modalNotes')?.value || '',
    status: getElement('modalStatus')?.value || 'Confirmed',
    ownerEmail: ownerEmail,
    emailReminder: emailReminder
  };
  
  const saveBtn = document.querySelector('#medicalModal .btn-primary-custom');
  if (!saveBtn) return;
  
  const originalText = saveBtn.innerHTML;
  saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
  saveBtn.disabled = true;
  
  const success = await saveMedicalInfo(currentModalBookingId, medicalData);
  
  if (success) {
    saveBtn.innerHTML = '<i class="fas fa-check"></i> Saved!';
    setTimeout(() => {
      saveBtn.innerHTML = originalText;
      saveBtn.disabled = false;
    }, 1500);
    closeMedicalModal();
    await loadAllData();
    showToast('Medical information saved successfully!', 'success');
    
    if (emailReminder && ownerEmail) {
      sendPrescriptionEmailManual(ownerEmail, medicalData.diagnosis, prescriptionText);
    }
  } else {
    saveBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error!';
    setTimeout(() => {
      saveBtn.innerHTML = originalText;
      saveBtn.disabled = false;
    }, 2000);
    showToast('Error saving medical information', 'error');
  }
}

// ============================================
// SECTION 22: EMAIL & PRINT FUNCTIONS
// ============================================

function sendPrescriptionEmail() {
  const email = getElement('modalOwnerEmail')?.value;
  const diagnosis = getElement('modalDiagnosis')?.value;
  const prescription = getPrescriptionText();
  
  if (!email) {
    showToast('Please enter patient email address', 'error');
    return;
  }
  
  sendPrescriptionEmailManual(email, diagnosis, prescription);
}

function sendPrescriptionEmailManual(email, diagnosis, prescription) {
  const doctor = sessionStorage.getItem('doctor_name') || 'Dr. Mitesh Tripura';
  const clinicName = "VET FOR PET CLINIC";
  const clinicAddress = "PCXR+55F, Titash Road, Dhaka, Bangladesh";
  const clinicPhone = "01406-779238";
  const clinicEmergency = "01609-420061";
  const clinicEmail = "info@vetforpet.com";
  
  const subject = `Prescription from ${clinicName}`;
  const body = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                    ${clinicName}
            Advanced Veterinary Care | Compassion at Heart
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📍 Address: ${clinicAddress}
📞 Phone: ${clinicPhone} | 🚨 Emergency: ${clinicEmergency}
✉️ Email: ${clinicEmail}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

                    📋 PRESCRIPTION

👨‍⚕️ Doctor: ${doctor}
📅 Date: ${getBangladeshDate()}

🔬 DIAGNOSIS:
${diagnosis || 'As per consultation'}

💊 PRESCRIPTION / MEDICINES:
${prescription || 'No medicines prescribed'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ Important Notes:
• Please follow the prescription as advised
• Complete the full course of medication
• Contact us for any side effects or concerns
• Keep follow-up appointment if scheduled

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Thank you for choosing ${clinicName}
We wish your pet a speedy recovery! 🐾

© ${new Date().getFullYear()} ${clinicName} | All Rights Reserved
  `;
  
  window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  showToast('Email client opened with company details!', 'success');
}

function printMedicalInfo() {
  const pet = getElement('summaryPetName')?.innerHTML || 'N/A';
  const diagnosis = getElement('modalDiagnosis')?.value || 'N/A';
  const prescription = getPrescriptionText() || 'No medicines prescribed';
  const temp = getElement('modalTemperature')?.value || '--';
  const hr = getElement('modalHeartRate')?.value || '--';
  const doctor = sessionStorage.getItem('doctor_name') || 'Dr. Mitesh Tripura';
  const owner = getElement('summaryOwner')?.innerHTML || 'N/A';
  const token = getElement('summaryToken')?.innerHTML || 'N/A';
  const symptoms = getElement('modalSymptoms')?.innerHTML || 'No symptoms recorded';
  
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head><title>Medical Record - VET FOR PET CLINIC</title>
    <style>body{font-family:Arial;padding:20px}.header{text-align:center;margin-bottom:20px}</style>
    </head>
    <body>
      <div class="header"><h2>VET FOR PET CLINIC</h2><p>Dhaka, Bangladesh | 01609-420061</p><hr></div>
      <h3>Medical Record</h3>
      <p><strong>Pet:</strong> ${pet}<br><strong>Owner:</strong> ${owner}<br><strong>Token:</strong> ${token}<br><strong>Symptoms:</strong> ${symptoms}<br><strong>Temperature:</strong> ${temp}°C | <strong>Heart Rate:</strong> ${hr} bpm<br><strong>Diagnosis:</strong> ${diagnosis}<br><strong>Prescription:</strong><br>${prescription}<br><strong>Doctor:</strong> ${doctor}<br><strong>Date:</strong> ${getBangladeshDate()}</p>
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
}

// ============================================
// SECTION 23: PRESCRIPTION FUNCTIONS
// ============================================

function loadPrescriptionList(savedPrescription) {
  const container = getElement('prescriptionList');
  if (!container) return;
  container.innerHTML = '';
  
  if (savedPrescription && savedPrescription.trim()) {
    const lines = savedPrescription.split('\n');
    lines.forEach(line => {
      const cleanLine = line.replace(/^•\s*/, '').trim();
      if (cleanLine) addPrescriptionField(cleanLine, '', '');
    });
  }
  
  if (container.children.length === 0) {
    addPrescriptionField('', '', '');
  }
}

function addPrescriptionField(medName = '', dosage = '', duration = '') {
  const container = getElement('prescriptionList');
  if (!container) return;
  
  const div = document.createElement('div');
  div.className = 'prescription-item';
  div.innerHTML = `
    <input type="text" class="clean-input med-name" placeholder="Medicine name" value="${escapeHtml(medName)}">
    <input type="text" class="clean-input med-dosage" placeholder="Dosage" value="${escapeHtml(dosage)}">
    <input type="text" class="clean-input med-duration" placeholder="Duration" value="${escapeHtml(duration)}">
    <button type="button" class="remove-prescription" onclick="removePrescription(this)"><i class="fas fa-trash-alt"></i></button>
  `;
  container.appendChild(div);
}

function removePrescription(btn) {
  const container = getElement('prescriptionList');
  if (!container) return;
  
  if (container.children.length > 1) {
    btn.closest('.prescription-item').remove();
  } else {
    const item = btn.closest('.prescription-item');
    if (item) {
      item.querySelector('.med-name').value = '';
      item.querySelector('.med-dosage').value = '';
      item.querySelector('.med-duration').value = '';
    }
  }
}

function getPrescriptionText() {
  const items = document.querySelectorAll('#prescriptionList .prescription-item');
  const lines = [];
  
  items.forEach(item => {
    const name = item.querySelector('.med-name')?.value.trim();
    if (name) {
      let line = `• ${name}`;
      const dosage = item.querySelector('.med-dosage')?.value.trim();
      const duration = item.querySelector('.med-duration')?.value.trim();
      if (dosage) line += `: ${dosage}`;
      if (duration) line += ` (${duration})`;
      lines.push(line);
    }
  });
  
  return lines.join('\n');
}

// ============================================
// SECTION 24: PRINT FUNCTIONS
// ============================================

function printTodayAppointments() {
  const date = getElement('todayDatePicker')?.value || getBangladeshDate();
  const apps = allAppointments.filter(a => a.date === date);
  
  if (apps.length === 0) {
    showToast('No appointments for this date', 'error');
    return;
  }
  
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head><title>Today's Appointments</title>
    <style>body{font-family:Arial;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:8px;text-align:left}th{background:#f97316;color:white}</style>
    </head>
    <body>
      <h2>VET FOR PET CLINIC - Appointments for ${date}</h2>
      <table><thead><tr><th>Time</th><th>Pet</th><th>Owner</th><th>Token</th><th>Status</th></tr></thead>
      <tbody>${apps.map(a => `<tr><td>${a.time}</td><td>${escapeHtml(a.petName)}</td><td>${escapeHtml(a.ownerName)}</td><td>${a.token}</td><td>${a.status || 'Confirmed'}</td></tr>`).join('')}</tbody>
      </table>
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
}

function printAllAppointments() {
  if (allAppointments.length === 0) {
    showToast('No appointments to print', 'error');
    return;
  }
  
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head><title>All Appointments</title>
    <style>body{font-family:Arial;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:8px;text-align:left}th{background:#f97316;color:white}</style>
    </head>
    <body>
      <h2>VET FOR PET CLINIC - All Appointments</h2>
      <p>Generated on: ${new Date().toLocaleString()}</p>
      <table><thead><tr><th>Date</th><th>Time</th><th>Pet</th><th>Owner</th><th>Token</th><th>Status</th></tr></thead>
      <tbody>${allAppointments.map(a => `<tr><td>${a.date}</td><td>${a.time}</td><td>${escapeHtml(a.petName)}</td><td>${escapeHtml(a.ownerName)}</td><td>${a.token}</td><td>${a.status || 'Confirmed'}</td></tr>`).join('')}</tbody>
      </table>
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
}

function printPrescriptions() {
  const prescriptions = allAppointments.filter(a => a.prescription && a.prescription !== '');
  
  if (prescriptions.length === 0) {
    showToast('No prescriptions to print', 'error');
    return;
  }
  
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head><title>Prescriptions</title>
    <style>body{font-family:Arial;padding:20px}.prescription{border:1px solid #ccc;padding:15px;margin-bottom:20px;border-radius:8px}</style>
    </head>
    <body>
      <h2>VET FOR PET CLINIC - Prescriptions</h2>
      ${prescriptions.map(a => `<div class="prescription"><h3>${escapeHtml(a.petName)} (${a.token})</h3><p><strong>Date:</strong> ${a.date}</p><p><strong>Diagnosis:</strong> ${escapeHtml(a.diagnosis || 'N/A')}</p><p><strong>Prescription:</strong><br>${escapeHtml(a.prescription)}</p></div>`).join('')}
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
}

function printDoctorReport() {
  const total = getElement('reportTotal')?.innerText || '0';
  const completed = getElement('reportCompleted')?.innerText || '0';
  
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head><title>Doctor Report</title>
    <style>body{font-family:Arial;padding:20px}</style>
    </head>
    <body>
      <h2>VET FOR PET CLINIC - Doctor Performance Report</h2>
      <p><strong>Total Patients:</strong> ${total}</p>
      <p><strong>Completed:</strong> ${completed}</p>
      <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
}

function printSingleAppointment(bookingId) {
  const app = allAppointments.find(a => a.bookingId === bookingId);
  if (!app) return;
  
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head><title>Appointment - ${app.token}</title>
    <style>body{font-family:Arial;padding:20px}.header{text-align:center;margin-bottom:20px}</style>
    </head>
    <body>
      <div class="header"><h2>VET FOR PET CLINIC</h2><p>Dhaka, Bangladesh | 01609-420061</p></div>
      <h3>Appointment Details</h3>
      <p><strong>Token:</strong> ${app.token}<br><strong>Date:</strong> ${app.date}<br><strong>Pet:</strong> ${app.petName}<br><strong>Owner:</strong> ${app.ownerName}<br><strong>Phone:</strong> ${app.ownerPhone}<br><strong>Symptoms:</strong> ${app.symptoms||'N/A'}<br><strong>Diagnosis:</strong> ${app.diagnosis||'N/A'}<br><strong>Prescription:</strong><br>${app.prescription||'N/A'}</p>
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
}

function editProfile() {
  openEditProfileModal();
}

// ============================================
// SECTION 25: UI CARD GENERATORS
// ============================================

function createAppointmentCard(app) {
  const statusClass = app.status === 'Completed' ? 'completed' : (app.status === 'Cancelled' ? 'cancelled' : 'confirmed');
  const isNew = !isAppointmentViewed(app.bookingId);
  const newClass = isNew ? 'new-appointment' : '';
  
  return `
    <div class="appointment-card ${newClass}" onclick="viewAppointment('${app.bookingId}')">
      <div class="card-header">
        <span class="token">${app.token}</span>
        <span class="status ${statusClass}">${app.status || 'Confirmed'}</span>
        <small>${app.time}</small>
      </div>
      <div><strong>${escapeHtml(app.petName)}</strong> (${escapeHtml(app.petAge || 'N/A')})</div>
      <div>${escapeHtml(app.ownerName)} | ${app.ownerPhone}</div>
      <div><strong>Symptoms:</strong> ${escapeHtml(app.symptoms || 'N/A')}</div>
      ${app.diagnosis ? `<div><strong>Diagnosis:</strong> ${escapeHtml(app.diagnosis)}</div>` : ''}
      <div style="display: flex; gap: 8px; margin-top: 12px;">
        <button class="btn-primary" onclick="event.stopPropagation(); openMedicalModal('${app.bookingId}')">Medical</button>
        <button class="btn-print" onclick="event.stopPropagation(); printSingleAppointment('${app.bookingId}')">Print</button>
      </div>
    </div>
  `;
}

function createHistoryItem(app) {
  const statusClass = app.status === 'Completed' ? 'completed' : (app.status === 'Cancelled' ? 'cancelled' : 'confirmed');
  const isNew = !isAppointmentViewed(app.bookingId);
  const newClass = isNew ? 'new-appointment' : '';
  
  return `
    <div class="history-item ${newClass}" onclick="viewAppointment('${app.bookingId}')">
      <div style="display: flex; justify-content: space-between; flex-wrap: wrap;">
        <div>
          <strong>${escapeHtml(app.petName)}</strong>
          <div style="font-size: 0.8rem;">📅 ${app.date} | ⏰ ${app.time}</div>
        </div>
        <div>
          <span class="token">${app.token}</span>
          <span class="status ${statusClass}" style="margin-left: 8px;">${app.status || 'Confirmed'}</span>
        </div>
      </div>
      <div style="margin: 8px 0;">👤 ${escapeHtml(app.ownerName)} | 📞 ${app.ownerPhone}</div>
      ${app.diagnosis ? `<div>🩺 ${escapeHtml(app.diagnosis)}</div>` : ''}
    </div>
  `;
}

// ============================================
// SECTION 26: UTILITY FUNCTIONS
// ============================================

function setupImageUpload() {
  const fileInput = getElement('profileImageUpload');
  if (!fileInput) return;
  
  const newFileInput = fileInput.cloneNode(true);
  fileInput.parentNode.replaceChild(newFileInput, fileInput);
  
  newFileInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/jpg', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      showToast('Please select a valid image (JPG, PNG, GIF, WEBP)', 'error');
      return;
    }
    
    if (file.size > 2 * 1024 * 1024) {
      showToast('Image size should be less than 2MB', 'error');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = function(ev) {
      const imageData = ev.target.result;
      const editAvatarImg = getElement('editAvatarImg');
      const editAvatarIcon = getElement('editAvatarIcon');
      if (editAvatarImg) {
        editAvatarImg.src = imageData;
        editAvatarImg.style.display = 'block';
        if (editAvatarIcon) editAvatarIcon.style.display = 'none';
      }
      const profileAvatarImg = getElement('profileAvatarImg');
      const avatarIcon = getElement('avatarIcon');
      if (profileAvatarImg) {
        profileAvatarImg.src = imageData;
        profileAvatarImg.style.display = 'block';
        if (avatarIcon) avatarIcon.style.display = 'none';
      }
      window.tempProfileImage = imageData;
      showToast('Image uploaded successfully! Click Save to update profile.', 'success');
    };
    reader.readAsDataURL(file);
  });
}

function removeProfileImage() {
  if (confirm('Are you sure you want to remove your profile picture?')) {
    const editAvatarImg = getElement('editAvatarImg');
    const editAvatarIcon = getElement('editAvatarIcon');
    const profileAvatarImg = getElement('profileAvatarImg');
    const avatarIcon = getElement('avatarIcon');
    
    if (editAvatarImg) {
      editAvatarImg.src = '';
      editAvatarImg.style.display = 'none';
      if (editAvatarIcon) editAvatarIcon.style.display = 'flex';
    }
    if (profileAvatarImg) {
      profileAvatarImg.src = '';
      profileAvatarImg.style.display = 'none';
      if (avatarIcon) avatarIcon.style.display = 'flex';
    }
    window.tempProfileImage = null;
    showToast('Profile image removed', 'success');
  }
}

function openEditProfileModal() {
  const editName = getElement('editProfileName');
  const editEmail = getElement('editProfileEmail');
  const editSpecialization = getElement('editProfileSpecialization');
  const editPhone = getElement('editProfilePhone');
  const editSchedule = getElement('editProfileSchedule');
  const editPassword = getElement('editProfilePassword');
  
  if (editName) editName.value = sessionStorage.getItem('doctor_name') || '';
  if (editEmail) editEmail.value = sessionStorage.getItem('doctor_email') || '';
  if (editSpecialization) editSpecialization.value = sessionStorage.getItem('doctor_specialization') || '';
  if (editPhone) editPhone.value = sessionStorage.getItem('doctor_phone') || '';
  if (editSchedule) editSchedule.value = sessionStorage.getItem('doctor_schedule') || '';
  if (editPassword) editPassword.value = '';
  
  const savedImage = localStorage.getItem('doctor_profile_image');
  const editAvatarImg = getElement('editAvatarImg');
  const editAvatarIcon = getElement('editAvatarIcon');
  
  if (savedImage && savedImage !== '') {
    if (editAvatarImg) {
      editAvatarImg.src = savedImage;
      editAvatarImg.style.display = 'block';
      if (editAvatarIcon) editAvatarIcon.style.display = 'none';
    }
  } else {
    if (editAvatarImg) {
      editAvatarImg.src = '';
      editAvatarImg.style.display = 'none';
      if (editAvatarIcon) editAvatarIcon.style.display = 'flex';
    }
  }
  
  window.tempProfileImage = null;
  
  const modal = getElement('editProfileModal');
  if (modal) {
    modal.classList.add('show');
    modal.style.display = 'flex';
  }
}

function closeEditProfileModal() {
  const modal = getElement('editProfileModal');
  if (modal) {
    modal.classList.remove('show');
    modal.style.display = 'none';
  }
}

function saveProfileChanges() {
  const newName = getElement('editProfileName')?.value || '';
  const newEmail = getElement('editProfileEmail')?.value || '';
  const newSpecialization = getElement('editProfileSpecialization')?.value || '';
  const newPhone = getElement('editProfilePhone')?.value || '';
  const newSchedule = getElement('editProfileSchedule')?.value || '';
  const newPassword = getElement('editProfilePassword')?.value || '';
  const newImage = window.tempProfileImage || null;

  if (!newName || !newEmail) {
    showToast('Please fill required fields', 'error');
    return;
  }

  sessionStorage.setItem('doctor_name', newName);
  sessionStorage.setItem('doctor_email', newEmail);
  sessionStorage.setItem('doctor_specialization', newSpecialization);
  sessionStorage.setItem('doctor_phone', newPhone);
  sessionStorage.setItem('doctor_schedule', newSchedule);
  if (newPassword) sessionStorage.setItem('doctor_password', newPassword);
  
  if (newImage) {
    localStorage.setItem('doctor_profile_image', newImage);
    window.tempProfileImage = null;
  }

  let doctors = JSON.parse(localStorage.getItem('clinic_doctors') || '[]');
  const currentEmail = sessionStorage.getItem('doctor_email');
  const index = doctors.findIndex(d => d.email === currentEmail);
  
  if (index !== -1) {
    doctors[index] = {
      ...doctors[index],
      name: newName,
      email: newEmail,
      specialization: newSpecialization,
      phone: newPhone,
      schedule: newSchedule,
      profileImage: newImage || doctors[index].profileImage
    };
    if (newPassword) doctors[index].password = newPassword;
  } else {
    doctors.push({
      id: Date.now(),
      name: newName,
      email: newEmail,
      specialization: newSpecialization,
      phone: newPhone,
      schedule: newSchedule,
      password: newPassword || 'doctor123',
      profileImage: newImage
    });
  }
  localStorage.setItem('clinic_doctors', JSON.stringify(doctors));

  loadProfileData();
  loadProfileImage();
  
  const doctorNameSpan = getElement('doctorName');
  const welcomeNameSpan = getElement('welcomeName');
  if (doctorNameSpan) doctorNameSpan.innerText = newName;
  if (welcomeNameSpan) welcomeNameSpan.innerText = newName.split(' ')[0];
  
  closeEditProfileModal();
  showToast('Profile updated successfully!', 'success');
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showToast(message, type) {
  let toast = getElement('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast-notification';
    document.body.appendChild(toast);
    toast.style.cssText = 'position: fixed; bottom: 30px; right: 30px; padding: 12px 24px; border-radius: 50px; color: white; z-index: 9999; transition: transform 0.3s ease;';
  }
  
  toast.style.background = type === 'success' ? '#15803d' : (type === 'error' ? '#ef4444' : '#0ea5e9');
  toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : (type === 'error' ? 'exclamation-circle' : 'info-circle')}"></i> ${message}`;
  toast.style.transform = 'translateX(0)';
  
  setTimeout(() => {
    toast.style.transform = 'translateX(400px)';
  }, 3000);
}

function setupModalClose() {
  const closeButtons = document.querySelectorAll('.modal-close, .close-modal');
  closeButtons.forEach(btn => {
    if (btn) {
      btn.onclick = function() {
        closeMedicalModal();
        closeViewModal();
        closeLogoutModal();
        closeEditProfileModal();
      };
    }
  });
  
  window.onclick = function(e) {
    if (e.target.classList && e.target.classList.contains('modal')) {
      closeMedicalModal();
      closeViewModal();
      closeLogoutModal();
      closeEditProfileModal();
    }
  };
  
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      closeMedicalModal();
      closeViewModal();
      closeLogoutModal();
      closeEditProfileModal();
    }
  });
}

function showLogoutModal() {
  const modal = getElement('logoutModal');
  if (modal) {
    modal.classList.add('show');
    modal.style.display = 'flex';
  }
}

function closeLogoutModal() {
  const modal = getElement('logoutModal');
  if (modal) {
    modal.classList.remove('show');
    modal.style.display = 'none';
  }
}