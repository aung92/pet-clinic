// ============================================
// DOCTOR DASHBOARD - COMPLETE SCRIPT
// ============================================
// Version: 2.1
// Author: VET FOR PET CLINIC
// Description: Modern & Dynamic Doctor Portal with Bangladesh Time Zone
// Last Updated: 2025
// ============================================

// ============================================
// SECTION 1: CONFIGURATION & GLOBAL VARIABLES
// ============================================

// Google Apps Script URL for backend API
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyL1X_hZMifdg1DKPT4lcGKIig022HceElgtrvV63VLM6gUxhiK7YbuT1l3j-9YM8a6Ng/exec";

// Global state variables
let allAppointments = [];           // All appointments data
let currentModalBookingId = null;   // Currently selected booking ID for medical modal
let currentViewBookingId = null;    // Currently selected booking ID for view modal
let currentPage = 1;                // Current page for pagination
let itemsPerPage = 10;              // Number of items per page
let doctorChart = null;             // Chart.js instance for doctor report

// Default slot configuration (load from localStorage if available)
const DEFAULT_SLOT_CONFIG = {
  "Saturday": { start: 9, end: 21 },
  "Sunday": { start: 9, end: 15 },
  "Monday": { start: 9, end: 15 },
  "Tuesday": { start: 9, end: 21 },
  "Wednesday": { start: 9, end: 15 },
  "Thursday": { start: 9, end: 15 },
  "Friday": { start: 9, end: 15 }
};

// Dynamic slot configuration
let slotConfig = { ...DEFAULT_SLOT_CONFIG };

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
// SECTION 2: BANGLADESH TIME ZONE (UTC+6)
// ============================================

/**
 * Get current time in Bangladesh Time Zone (UTC+6)
 * @returns {Date} Current date and time in Bangladesh
 */
function getBangladeshTime() {
  const now = new Date();
  const bangladeshTime = new Date(now.getTime() + (6 * 60 * 60 * 1000));
  return bangladeshTime;
}

/**
 * Get current date in Bangladesh Time Zone formatted as YYYY-MM-DD
 * @returns {string} Formatted date string
 */
function getBangladeshDate() {
  const bdTime = getBangladeshTime();
  return `${bdTime.getFullYear()}-${String(bdTime.getMonth() + 1).padStart(2, '0')}-${String(bdTime.getDate()).padStart(2, '0')}`;
}

// ============================================
// SECTION 3: AUTHENTICATION CHECK
// ============================================

/**
 * Check if doctor is logged in, redirect to login page if not
 */
(function() {
  const doctorLoggedIn = sessionStorage.getItem('doctor_logged_in');
  if (!doctorLoggedIn || doctorLoggedIn !== 'true') {
    window.location.href = 'doctor-login.html';
    return;
  }
  
  const doctorName = sessionStorage.getItem('doctor_name') || 'Dr. Mitesh';
  const doctorRole = sessionStorage.getItem('doctor_role') || 'Senior Veterinarian';
  
  const welcomeName = getElement('welcomeName');
  const doctorNameSpan = getElement('doctorName');
  const doctorRoleSpan = getElement('doctorRole');
  
  if (welcomeName) welcomeName.innerText = doctorName.split(' ')[0];
  if (doctorNameSpan) doctorNameSpan.innerText = doctorName;
  if (doctorRoleSpan) doctorRoleSpan.innerText = doctorRole;
})();

// ============================================
// SECTION 4: SLOT CONFIGURATION MANAGEMENT
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
 * Generate time slots based on day using dynamic config
 * @param {string} dayName - Name of the day (e.g., "Monday")
 * @returns {Array} Array of time slots
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
// SECTION 5: PROFILE DATA MANAGEMENT
// ============================================

/**
 * Load and display doctor profile data from sessionStorage
 */
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

// ============================================
// SECTION 6: PROFILE IMAGE UPLOAD FUNCTIONS
// ============================================

/**
 * Open file picker for avatar upload
 */
function openAvatarUploadModal() {
  const fileInput = getElement('profileImageUpload');
  if (fileInput) {
    fileInput.click();
  } else {
    showToast('Image upload feature coming soon!', 'info');
  }
}

/**
 * Load profile image from localStorage and display it
 */
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

/**
 * Setup image upload event listener
 */
function setupImageUpload() {
  const fileInput = getElement('profileImageUpload');
  if (!fileInput) return;
  
  // Remove existing listener to avoid duplicates
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
      
      // Update preview in edit modal
      const editAvatarImg = getElement('editAvatarImg');
      const editAvatarIcon = getElement('editAvatarIcon');
      if (editAvatarImg) {
        editAvatarImg.src = imageData;
        editAvatarImg.style.display = 'block';
        if (editAvatarIcon) editAvatarIcon.style.display = 'none';
      }
      
      // Update main profile preview
      const profileAvatarImg = getElement('profileAvatarImg');
      const avatarIcon = getElement('avatarIcon');
      if (profileAvatarImg) {
        profileAvatarImg.src = imageData;
        profileAvatarImg.style.display = 'block';
        if (avatarIcon) avatarIcon.style.display = 'none';
      }
      
      // Store temporarily
      window.tempProfileImage = imageData;
      showToast('Image uploaded successfully! Click Save to update profile.', 'success');
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Remove profile image
 */
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

// ============================================
// SECTION 7: EDIT PROFILE FUNCTIONS
// ============================================

/**
 * Open edit profile modal with current data
 */
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

/**
 * Close edit profile modal
 */
function closeEditProfileModal() {
  const modal = getElement('editProfileModal');
  if (modal) {
    modal.classList.remove('show');
    modal.style.display = 'none';
  }
}

/**
 * Save profile changes to localStorage and sessionStorage
 */
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

// ============================================
// SECTION 8: INITIALIZATION
// ============================================

/**
 * Main initialization function - runs when page loads
 */
document.addEventListener('DOMContentLoaded', function() {
  // Load slot configuration first
  loadSlotConfig();
  
  updateDateTime();
  setInterval(updateDateTime, 1000);
  setupNavigation();
  loadAllData();
  loadProfileData();
  loadProfileImage();
  setupImageUpload();
  
  const todayPicker = getElement('todayDatePicker');
  if (todayPicker) {
    todayPicker.value = getBangladeshDate();
    todayPicker.addEventListener('change', () => loadTodayAppointments());
  }
  
  setupModalClose();
});

/**
 * Update date and time display in header
 */
function updateDateTime() {
  const bdTime = getBangladeshTime();
  const dateElem = getElement('currentDate');
  const timeElem = getElement('currentTime');
  
  if (dateElem) {
    dateElem.innerText = bdTime.toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
    });
  }
  if (timeElem) {
    timeElem.innerText = bdTime.toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit'
    });
  }
}

// ============================================
// SECTION 9: NAVIGATION
// ============================================

/**
 * Setup sidebar navigation event listeners
 */
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
    });
  });
}

/**
 * Navigate to specific page by ID
 * @param {string} pageId - ID of the page to navigate to
 */
function goToPage(pageId) {
  const navItem = document.querySelector(`.nav-item[data-page="${pageId}"]`);
  if (navItem) navItem.click();
}

/**
 * Refresh all data
 */
function refreshAllData() {
  loadAllData();
  showToast('Data refreshed!', 'success');
}

// ============================================
// SECTION 10: API CALLS
// ============================================

/**
 * Fetch data from Google Apps Script API
 * @param {string} action - API action name
 * @param {Object} params - Additional parameters
 * @returns {Promise<Object>} API response
 */
async function fetchFromAPI(action, params = {}) {
  try {
    let url = `${SCRIPT_URL}?action=${action}&t=${Date.now()}`;
    if (action === 'getClientBookings' && params.phone) {
      url += `&phone=${encodeURIComponent(params.phone)}`;
    }
    
    const response = await fetch(url);
    const text = await response.text();
    const jsonStr = text.match(/\((.*)\)/)[1];
    return JSON.parse(jsonStr);
  } catch (error) {
    console.error('API Error:', error);
    return null;
  }
}

/**
 * Save medical information to Google Sheets
 * @param {string} bookingId - Booking ID
 * @param {Object} medicalData - Medical data to save
 * @returns {Promise<boolean>} Success status
 */
async function saveMedicalInfo(bookingId, medicalData) {
  try {
    await fetch(SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'updateMedicalInfo', bookingId, ...medicalData })
    });
    return true;
  } catch (error) {
    console.error('Save Error:', error);
    return false;
  }
}

// ============================================
// SECTION 11: LOAD & DISPLAY DATA
// ============================================

/**
 * Load all appointment data from API
 */
async function loadAllData() {
  const data = await fetchFromAPI('getAppointments');
  if (data && data.appointments) {
    allAppointments = data.appointments;
    updateDashboardStats();
    loadTodayPreview();
    loadRecentActivity();
    
    const todayPicker = getElement('todayDatePicker');
    if (todayPicker) loadTodayAppointments(todayPicker.value);
  } else {
    showToast('Could not load data', 'error');
  }
}

/**
 * Update dashboard statistics cards
 */
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
  if (todayBadge) todayBadge.innerText = todayApps.length;
  if (completedCount) completedCount.innerText = completedApps.length;
  if (pendingCount) pendingCount.innerText = pendingApps.length;
  if (totalPets) totalPets.innerText = uniquePets.length;
}

// ============================================
// SECTION 12: TODAY'S APPOINTMENTS
// ============================================

/**
 * Load and display today's appointments
 */
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
}

/**
 * Load today's appointment preview for dashboard
 */
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

/**
 * Load recent activity for dashboard
 */
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
// SECTION 13: ALL APPOINTMENTS (PAGINATION & FILTERS)
// ============================================

/**
 * Load all appointments with pagination and filters
 */
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
}

/**
 * Render pagination buttons
 * @param {number} totalPages - Total number of pages
 */
function renderPagination(totalPages) {
  const container = getElement('pagination');
  if (!container) return;
  
  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }
  
  let html = '';
  for (let i = 1; i <= Math.min(totalPages, 10); i++) {
    html += `<button class="${i === currentPage ? 'active' : ''}" onclick="goToPageNum(${i})">${i}</button>`;
  }
  container.innerHTML = html;
}

/**
 * Go to specific page number
 * @param {number} page - Page number to navigate to
 */
function goToPageNum(page) {
  currentPage = page;
  loadAllAppointments();
}

/**
 * Filter all appointments (reset to page 1)
 */
function filterAllAppointments() {
  currentPage = 1;
  loadAllAppointments();
}

// ============================================
// SECTION 14: SEARCH PATIENTS (FIXED VERSION)
// ============================================

/**
 * Search patients by name, owner name, or phone number
 * Fixed: Shows proper loading state and handles empty results
 */
async function searchPatients() {
  const searchInput = getElement('searchInput');
  const container = getElement('searchResults');
  
  if (!searchInput || !container) return;
  
  const term = searchInput.value.trim();
  
  // Clear previous results and show validation message
  if (!term) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-search"></i>
        <h4>Enter Search Term</h4>
        <p>Please enter pet name, owner name or phone number to search</p>
      </div>`;
    return;
  }
  
  // Show loading state with spinner
  container.innerHTML = `
    <div class="search-loading">
      <div class="loading-spinner"></div>
      <p><i class="fas fa-spinner fa-spin"></i> Searching for "${escapeHtml(term)}"...</p>
    </div>`;
  
  // Small delay to ensure loading state shows (for better UX)
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Perform search on allAppointments data
  const searchTermLower = term.toLowerCase();
  const results = allAppointments.filter(app => 
    app.petName?.toLowerCase().includes(searchTermLower) ||
    app.ownerName?.toLowerCase().includes(searchTermLower) ||
    app.ownerPhone?.includes(term) ||
    app.token?.toLowerCase().includes(searchTermLower)
  );
  
  // Handle no results
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
  
  // Display results
  container.innerHTML = `
    <div class="search-results-header">
      <h4><i class="fas fa-list"></i> Search Results (${results.length})</h4>
      <p>Found ${results.length} appointment(s) for "${escapeHtml(term)}"</p>
    </div>
    <div class="appointments-grid">
      ${results.map(app => createAppointmentCard(app)).join('')}
    </div>
  `;
  
  // Show success toast
  showToast(`✅ Found ${results.length} result(s) for "${escapeHtml(term)}"`, 'success');
}

// ============================================
// SECTION 15: PRESCRIPTIONS & MEDICAL RECORDS
// ============================================

/**
 * Load prescriptions list
 */
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

/**
 * Load medical records list
 */
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
// SECTION 16: DOCTOR REPORT & CHART
// ============================================

/**
 * Load doctor performance report based on selected period
 */
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

/**
 * Update doctor performance chart
 * @param {Array} appointments - Appointments data for chart
 */
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
// SECTION 17: VIEW APPOINTMENT
// ============================================

/**
 * View appointment details
 * @param {string} bookingId - Booking ID to view
 */
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

/**
 * Close view appointment modal
 */
function closeViewModal() {
  const modal = getElement('viewAppointmentModal');
  if (modal) {
    modal.classList.remove('show');
    modal.style.display = 'none';
  }
}

/**
 * Open medical info modal from view modal
 */
function openMedicalFromView() {
  closeViewModal();
  openMedicalModal(currentViewBookingId);
}

/**
 * Print appointment from view modal
 */
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
// SECTION 18: MEDICAL MODAL - COMPLETE
// ============================================

/**
 * Open medical info modal for a booking
 * @param {string} bookingId - Booking ID to edit medical info
 */
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

/**
 * Close medical modal
 */
function closeMedicalModal() {
  const modal = getElement('medicalModal');
  if (modal) {
    modal.classList.remove('show');
    modal.style.display = 'none';
  }
}

/**
 * Alias for closeMedicalModal
 */
function closeModal() {
  closeMedicalModal();
}

/**
 * Save medical information from modal
 */
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

/**
 * Send prescription email from modal
 */
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

/**
 * Send prescription email manually
 * @param {string} email - Recipient email address
 * @param {string} diagnosis - Diagnosis text
 * @param {string} prescription - Prescription text
 */
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

/**
 * Print medical info
 */
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
// SECTION 19: PRESCRIPTION FUNCTIONS
// ============================================

/**
 * Load prescription list into modal
 * @param {string} savedPrescription - Saved prescription text
 */
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

/**
 * Add a prescription field to the list
 * @param {string} medName - Medicine name
 * @param {string} dosage - Dosage information
 * @param {string} duration - Duration information
 */
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

/**
 * Remove a prescription field
 * @param {HTMLElement} btn - The remove button element
 */
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

/**
 * Get prescription text from fields
 * @returns {string} Formatted prescription text
 */
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
// SECTION 20: PRINT FUNCTIONS
// ============================================

/**
 * Print today's appointments
 */
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
      <tbody>${apps.map(a => `<tr><td>${a.time} side-by-side: ${escapeHtml(a.petName)} side-by-side: ${escapeHtml(a.ownerName)} side-by-side: ${a.token} side-by-side: ${a.status || 'Confirmed'} side-by-side: `).join('')}</tbody>
    </table>
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
}

/**
 * Print all appointments
 */
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
      <td><thead><tr><th>Date</th><th>Time</th><th>Pet</th><th>Owner</th><th>Token</th><th>Status</th></tr></thead>
      <tbody>${allAppointments.map(a => `<tr><td>${a.date}侧<td>${a.time}侧<td>${escapeHtml(a.petName)}侧<td>${escapeHtml(a.ownerName)}侧<td>${a.token}侧<td>${a.status || 'Confirmed'}侧)`).join('')}</tbody>
    </table>
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
}

/**
 * Print prescriptions list
 */
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

/**
 * Print doctor performance report
 */
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

/**
 * Print single appointment
 * @param {string} bookingId - Booking ID to print
 */
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

/**
 * Edit profile - opens edit profile modal
 */
function editProfile() {
  openEditProfileModal();
}

// ============================================
// SECTION 21: UI CARD GENERATORS
// ============================================

/**
 * Create appointment card HTML
 * @param {Object} app - Appointment object
 * @returns {string} HTML string
 */
function createAppointmentCard(app) {
  const statusClass = app.status === 'Completed' ? 'completed' : (app.status === 'Cancelled' ? 'cancelled' : 'confirmed');
  
  return `
    <div class="appointment-card" onclick="viewAppointment('${app.bookingId}')">
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

/**
 * Create history item HTML
 * @param {Object} app - Appointment object
 * @returns {string} HTML string
 */
function createHistoryItem(app) {
  const statusClass = app.status === 'Completed' ? 'completed' : (app.status === 'Cancelled' ? 'cancelled' : 'confirmed');
  
  return `
    <div class="history-item" onclick="viewAppointment('${app.bookingId}')">
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
// SECTION 22: UTILITY FUNCTIONS
// ============================================

/**
 * Escape HTML to prevent XSS attacks
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Show toast notification
 * @param {string} message - Message to display
 * @param {string} type - Type ('success', 'error', 'info')
 */
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

/**
 * Setup modal close functionality (ESC key, click outside)
 */
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

/**
 * Show logout confirmation modal
 */
function showLogoutModal() {
  const modal = getElement('logoutModal');
  if (modal) {
    modal.classList.add('show');
    modal.style.display = 'flex';
  }
}

/**
 * Close logout confirmation modal
 */
function closeLogoutModal() {
  const modal = getElement('logoutModal');
  if (modal) {
    modal.classList.remove('show');
    modal.style.display = 'none';
  }
}

/**
 * Confirm logout and redirect to login page
 */
function confirmLogout() {
  sessionStorage.clear();
  window.location.href = 'doctor-login.html';
}