// ============================================
// ADMIN DASHBOARD - COMPLETE SCRIPT
// Role Based Access | Full Permissions Control
// Version: 2.1 | Fixed Delete Issue | Last Updated: 2025
// ============================================

// ============================================
// SECTION 1: CONFIGURATION & GLOBAL VARIABLES
// ============================================

// Google Apps Script URL for backend API
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyL1X_hZMifdg1DKPT4lcGKIig022HceElgtrvV63VLM6gUxhiK7YbuT1l3j-9YM8a6Ng/exec";

// Global state variables
let allAppointments = [];      // All appointments data
let doctors = [];              // List of doctors
let services = [];             // List of services
let users = [];                // List of system users
let permissions = [];          // Role permissions configuration
let currentPage = 1;           // Current page for pagination
let itemsPerPage = 20;         // Number of items per page
let adminChart = null;         // Chart.js instance for reports
let autoSyncInterval = null;    // Auto sync interval ID
let currentUserRole = '';       // Current logged in user role
let currentUserPermissions = []; // Current user permissions array

// ============================================
// SECTION 2: PERMISSION CHECK FUNCTIONS
// ============================================

/**
 * Check if current user has specific permission
 * @param {string} permission - Permission to check
 * @returns {boolean} True if user has permission
 */
function hasPermission(permission) {
  if (currentUserRole === 'super_admin') return true;
  return currentUserPermissions.includes(permission);
}

/**
 * Check permission and execute callback or show denied modal
 * @param {string} permission - Required permission
 * @param {Function} callback - Function to execute if permission granted
 * @returns {boolean} True if permission granted
 */
function checkPermissionAndRedirect(permission, callback) {
  if (hasPermission(permission)) {
    if (callback) callback();
    return true;
  } else {
    showPermissionDenied();
    return false;
  }
}

/**
 * Show permission denied modal
 */
function showPermissionDenied() {
  const modal = document.getElementById('permissionDeniedModal');
  if (modal) {
    modal.classList.add('show');
    modal.style.display = 'flex';
    setTimeout(() => {
      if (modal.classList.contains('show')) {
        modal.classList.remove('show');
        modal.style.display = 'none';
      }
    }, 2000);
  }
}

/**
 * Close permission denied modal
 */
function closePermissionModal() {
  const modal = document.getElementById('permissionDeniedModal');
  if (modal) {
    modal.classList.remove('show');
    modal.style.display = 'none';
  }
}

/**
 * Show toast notification message
 * @param {string} message - Message to display
 * @param {string} type - Message type ('success' or 'error')
 */
function showToast(message, type) {
  const toastId = type === 'success' ? 'successToast' : 'errorToast';
  let toast = document.getElementById(toastId);
  if (!toast) {
    toast = document.createElement('div');
    toast.id = toastId;
    toast.className = 'toast-notification ' + type;
    document.body.appendChild(toast);
  }
  const msgSpan = toast.querySelector('span');
  if (msgSpan) {
    msgSpan.innerText = message;
  } else {
    toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> <span>${message}</span>`;
  }
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// ============================================
// SECTION 3: LOAD USER PERMISSIONS
// ============================================

/**
 * Load user permissions based on role from sessionStorage
 */
function loadUserPermissions() {
  currentUserRole = sessionStorage.getItem('admin_role') || 'super_admin';
  const permissionsStr = sessionStorage.getItem('admin_permissions') || '';
  currentUserPermissions = permissionsStr === 'full' ? 
    ['full', 'view_appointments', 'add_appointments', 'edit_appointments', 'manage_doctors', 'manage_services', 'reports'] : 
    permissionsStr.split(',');
  
  // Apply UI restrictions based on permissions
  document.querySelectorAll('.nav-item').forEach(item => {
    const requiredPerm = item.getAttribute('data-permission');
    if (requiredPerm && requiredPerm !== 'full') {
      if (!hasPermission(requiredPerm) && currentUserRole !== 'super_admin') {
        item.classList.add('disabled');
        item.style.pointerEvents = 'none';
        item.style.opacity = '0.5';
      } else {
        item.classList.remove('disabled');
        item.style.pointerEvents = 'auto';
        item.style.opacity = '1';
      }
    }
  });
  
  const userRoleBadge = document.getElementById('userRoleBadge');
  if (userRoleBadge) {
    userRoleBadge.innerText = currentUserRole === 'super_admin' ? 'Super Admin' : 
                              (currentUserRole === 'manager' ? 'Manager' : 'Receptionist');
  }
}

// ============================================
// SECTION 4: BANGLADESH TIME ZONE (UTC+6)
// ============================================

/**
 * Get current time in Bangladesh Time Zone (UTC+6)
 * @returns {Date} Current date and time in Bangladesh
 */
function getBangladeshTime() {
  const now = new Date();
  return new Date(now.getTime() + (6 * 60 * 60 * 1000));
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
// SECTION 5: AUTHENTICATION CHECK
// ============================================

/**
 * Check if admin is logged in, redirect to login page if not
 */
(function() {
  if (!sessionStorage.getItem('admin_logged_in')) {
    window.location.href = 'admin-login.html';
    return;
  }
  loadUserPermissions();
  
  const adminName = sessionStorage.getItem('admin_name') || 'Admin';
  const adminRole = sessionStorage.getItem('admin_role') || 'Administrator';
  
  const welcomeName = document.getElementById('welcomeName');
  const adminNameSpan = document.getElementById('adminName');
  const adminRoleSpan = document.getElementById('adminRole');
  
  if (welcomeName) welcomeName.innerText = adminName;
  if (adminNameSpan) adminNameSpan.innerText = adminName;
  if (adminRoleSpan) adminRoleSpan.innerText = adminRole === 'super_admin' ? 'Super Admin' : (adminRole === 'manager' ? 'Manager' : 'Receptionist');
  
  loadUsers();
  loadPermissionsConfig();
})();

// ============================================
// SECTION 6: INITIALIZATION
// ============================================

/**
 * Main initialization function - runs when page loads
 */
document.addEventListener('DOMContentLoaded', function() {
  updateDateTime();
  setInterval(updateDateTime, 1000);
  setupNavigation();
  loadAllData();
  loadDoctors();
  loadServices();
  loadSettings();
  loadSlotConfig();
  loadPricing();
  startAutoSync();
  
  const refreshBtn = document.querySelector('.refresh-btn');
  if (refreshBtn) refreshBtn.onclick = () => refreshAllData();
  
  const reportDate = document.getElementById('reportDate');
  if (reportDate) reportDate.value = getBangladeshDate();
});

/**
 * Update date and time display in header
 */
function updateDateTime() {
  const bdTime = getBangladeshTime();
  const dateElem = document.getElementById('currentDate');
  const timeElem = document.getElementById('currentTime');
  if (dateElem) dateElem.innerText = bdTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  if (timeElem) timeElem.innerText = bdTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

// ============================================
// SECTION 7: AUTO SYNC FUNCTION
// ============================================

/**
 * Start auto sync interval (every 15 seconds)
 */
function startAutoSync() {
  if (autoSyncInterval) clearInterval(autoSyncInterval);
  autoSyncInterval = setInterval(autoSyncData, 15000);
}

/**
 * Auto sync data from Google Sheets API
 */
async function autoSyncData() {
  if (!hasPermission('view_appointments')) return;
  try {
    const response = await fetch(`${SCRIPT_URL}?action=getAppointments&t=${Date.now()}`);
    const text = await response.text();
    const jsonStr = text.match(/\((.*)\)/)[1];
    const data = JSON.parse(jsonStr);
    if (data && data.appointments) {
      allAppointments = data.appointments;
      updateDashboardStats();
      loadRecentAppointments();
      updateQuickStats();
      const today = getBangladeshDate();
      const todayCount = allAppointments.filter(a => a.date === today).length;
      const badge = document.getElementById('appointmentBadge');
      if (badge) badge.innerText = todayCount;
      const totalRecords = document.getElementById('totalRecords');
      if (totalRecords) totalRecords.innerText = allAppointments.length;
      const syncStatus = document.getElementById('syncStatus');
      if (syncStatus) {
        syncStatus.innerHTML = `<i class="fas fa-check-circle"></i> Synced at ${new Date().toLocaleTimeString()}`;
        syncStatus.style.opacity = '1';
        setTimeout(() => { if (syncStatus) syncStatus.style.opacity = '0'; }, 2000);
      }
      if (document.getElementById('appointmentsPage')?.classList.contains('active')) loadAllAppointmentsList();
    }
  } catch (error) { console.error('Auto sync error:', error); }
}

/**
 * Refresh all data manually
 */
function refreshAllData() { 
  autoSyncData(); 
  loadDoctors(); 
  loadServices(); 
  showToast('Data refreshed successfully!', 'success'); 
}

// ============================================
// SECTION 8: NAVIGATION
// ============================================

/**
 * Setup sidebar navigation event listeners
 */
function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      if (item.classList.contains('disabled')) {
        showPermissionDenied();
        return;
      }
      const page = item.getAttribute('data-page');
      document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');
      document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
      const targetPage = document.getElementById(page + 'Page');
      if (targetPage) targetPage.classList.add('active');
      const pageTitle = document.getElementById('pageTitle');
      if (pageTitle) pageTitle.innerText = item.querySelector('span')?.innerText || page;
      if (page === 'appointments') loadAllAppointmentsList();
      if (page === 'reports') { updateReportStats(); createWeeklyChart(); loadReport(); }
      if (page === 'permissions') loadPermissionsUI();
    });
  });
}

/**
 * Navigate to specific page by ID
 * @param {string} pageId - ID of the page to navigate to
 */
function goToPage(pageId) {
  const navItem = document.querySelector(`.nav-item[data-page="${pageId}"]`);
  if (navItem && !navItem.classList.contains('disabled')) navItem.click();
  else showPermissionDenied();
}

// ============================================
// SECTION 9: API CALLS
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
  } catch (error) { console.error('API Error:', error); return null; }
}

// ============================================
// SECTION 10: LOAD APPOINTMENTS DATA
// ============================================

/**
 * Load all appointment data from API
 */
async function loadAllData() {
  if (!hasPermission('view_appointments')) return;
  const data = await fetchFromAPI('getAppointments');
  if (data && data.appointments) {
    allAppointments = data.appointments;
    updateDashboardStats();
    loadRecentAppointments();
    updateQuickStats();
    const today = getBangladeshDate();
    const todayCount = allAppointments.filter(a => a.date === today).length;
    const badge = document.getElementById('appointmentBadge');
    if (badge) badge.innerText = todayCount;
    const totalRecords = document.getElementById('totalRecords');
    if (totalRecords) totalRecords.innerText = allAppointments.length;
    if (document.getElementById('appointmentsPage')?.classList.contains('active')) loadAllAppointmentsList();
  } else { showToast('Could not load data from server', 'error'); }
}

/**
 * Update dashboard statistics cards
 */
function updateDashboardStats() {
  const today = getBangladeshDate();
  const todayApps = allAppointments.filter(a => a.date === today);
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const weeklyApps = allAppointments.filter(a => new Date(a.date) >= weekAgo);
  const monthAgo = new Date(); monthAgo.setMonth(monthAgo.getMonth() - 1);
  const monthlyApps = allAppointments.filter(a => new Date(a.date) >= monthAgo);
  const uniquePets = [...new Set(allAppointments.map(a => a.petName))];
  const completedApps = allAppointments.filter(a => a.status === 'Completed');
  const pendingApps = allAppointments.filter(a => a.status === 'Confirmed' || a.status === 'In Progress');
  
  const totalToday = document.getElementById('totalToday');
  const totalWeekly = document.getElementById('totalWeekly');
  const totalMonthly = document.getElementById('totalMonthly');
  const totalPets = document.getElementById('totalPets');
  const totalCompleted = document.getElementById('totalCompleted');
  const totalPending = document.getElementById('totalPending');
  
  if (totalToday) totalToday.innerText = todayApps.length;
  if (totalWeekly) totalWeekly.innerText = weeklyApps.length;
  if (totalMonthly) totalMonthly.innerText = monthlyApps.length;
  if (totalPets) totalPets.innerText = uniquePets.length;
  if (totalCompleted) totalCompleted.innerText = completedApps.length;
  if (totalPending) totalPending.innerText = pendingApps.length;
}

/**
 * Update quick statistics in sidebar
 */
function updateQuickStats() {
  const revenueElem = document.getElementById('totalRevenue');
  const rateElem = document.getElementById('completionRate');
  const doctorsElem = document.getElementById('activeDoctors');
  const completed = allAppointments.filter(a => a.status === 'Completed').length;
  const completionRate = allAppointments.length > 0 ? Math.round((completed / allAppointments.length) * 100) : 0;
  if (revenueElem) revenueElem.innerText = (allAppointments.length * 500).toLocaleString();
  if (rateElem) rateElem.innerText = completionRate;
  if (doctorsElem) doctorsElem.innerText = doctors.length || 1;
}

/**
 * Load recent appointments for dashboard
 */
function loadRecentAppointments() {
  const container = document.getElementById('recentAppointments');
  if (!container) return;
  const recent = [...allAppointments].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0,5);
  if (recent.length === 0) { container.innerHTML = '<div class="empty-state">No appointments yet</div>'; return; }
  container.innerHTML = recent.map(app => `
    <div class="history-item" onclick="viewAppointment('${app.bookingId}')" style="cursor:pointer">
      <div style="display:flex;justify-content:space-between"><strong>${escapeHtml(app.petName)}</strong><span class="token">${app.token}</span><span class="status ${app.status === 'Completed' ? 'completed' : 'confirmed'}">${app.status || 'Confirmed'}</span></div>
      <div>${escapeHtml(app.ownerName)} | ${app.ownerPhone} | ${app.date} | ${app.time}</div>
    </div>
  `).join('');
}

// ============================================
// SECTION 11: ALL APPOINTMENTS LIST (FIXED LOADING ISSUE)
// ============================================

/**
 * Load all appointments list with filters and pagination
 */
function loadAllAppointmentsList() {
  if (!hasPermission('view_appointments')) return;
  const container = document.getElementById('allAppointmentsList');
  if (!container) return;
  
  // Show loading state
  container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading appointments...</div>';
  
  const filterText = document.getElementById('filterInput')?.value.toLowerCase() || '';
  const statusFilter = document.getElementById('statusFilter')?.value || 'all';
  const dateFilter = document.getElementById('dateFilter')?.value || 'all';
  
  let filtered = [...allAppointments];
  if (filterText) filtered = filtered.filter(a => a.petName.toLowerCase().includes(filterText) || a.ownerName.toLowerCase().includes(filterText) || a.ownerPhone.includes(filterText) || a.token.toLowerCase().includes(filterText));
  if (statusFilter !== 'all') filtered = filtered.filter(a => a.status === statusFilter);
  
  const today = getBangladeshDate();
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(); monthAgo.setMonth(monthAgo.getMonth() - 1);
  
  switch(dateFilter) {
    case 'today': filtered = filtered.filter(a => a.date === today); break;
    case 'tomorrow': filtered = filtered.filter(a => a.date === tomorrowStr); break;
    case 'week': filtered = filtered.filter(a => new Date(a.date) >= weekAgo); break;
    case 'month': filtered = filtered.filter(a => new Date(a.date) >= monthAgo); break;
  }
  
  filtered.sort((a,b) => new Date(b.date) - new Date(a.date));
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage-1)*itemsPerPage, currentPage*itemsPerPage);
  
  const hasEditPerm = hasPermission('edit_appointments');
  
  if (paginated.length === 0) { 
    container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i> No appointments found</div>'; 
  } else {
    container.innerHTML = paginated.map(app => `
      <div class="history-item" ${hasEditPerm ? `onclick="viewAppointment('${app.bookingId}')"` : ''} style="${!hasEditPerm ? 'cursor:default' : 'cursor:pointer'}">
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap">
          <div><strong>${escapeHtml(app.petName)}</strong><div style="font-size:0.8rem">📅 ${app.date} | ⏰ ${app.time}</div></div>
          <div><span class="token">${app.token}</span><span class="status ${app.status === 'Completed' ? 'completed' : 'confirmed'}">${app.status || 'Confirmed'}</span></div>
        </div>
        <div>👤 ${escapeHtml(app.ownerName)} | 📞 ${app.ownerPhone}</div>
        <div>📋 ${escapeHtml(app.symptoms || 'N/A')}${app.diagnosis ? `<br>🩺 ${escapeHtml(app.diagnosis)}` : ''}</div>
        ${hasEditPerm ? `<div style="margin-top:12px; display:flex; gap:8px;">
          <button class="btn-secondary" onclick="event.stopPropagation(); editAppointment('${app.bookingId}')"><i class="fas fa-edit"></i> Edit</button>
          <button class="btn-danger" onclick="event.stopPropagation(); hardDeleteAppointment('${app.bookingId}')"><i class="fas fa-trash-alt"></i> Delete</button>
        </div>` : ''}
      </div>
    `).join('');
  }
  renderPagination(totalPages);
}

/**
 * Render pagination buttons
 * @param {number} totalPages - Total number of pages
 */
function renderPagination(totalPages) {
  const container = document.getElementById('pagination');
  if (!container) return;
  if (totalPages <= 1) { container.innerHTML = ''; return; }
  let html = '';
  for (let i = 1; i <= Math.min(totalPages, 10); i++) {
    html += `<button class="${i === currentPage ? 'active' : ''}" onclick="goToPageNum(${i})">📄 ${i}</button>`;
  }
  container.innerHTML = html;
}

/**
 * Go to specific page number
 * @param {number} page - Page number to navigate to
 */
function goToPageNum(page) { 
  currentPage = page; 
  loadAllAppointmentsList(); 
}

/**
 * Filter appointments (reset to page 1)
 */
function filterAppointments() { 
  currentPage = 1; 
  loadAllAppointmentsList(); 
}

// ============================================
// SECTION 12: VIEW APPOINTMENT DETAILS (FIXED)
// ============================================

/**
 * View appointment details in modal
 * @param {string} bookingId - Booking ID to view
 */
function viewAppointment(bookingId) {
  const app = allAppointments.find(a => a.bookingId === bookingId);
  if (!app) {
    showToast('Appointment not found!', 'error');
    return;
  }
  
  const modal = document.getElementById('viewAppointmentModal');
  const detailsDiv = document.getElementById('appointmentDetails');
  
  if (!modal || !detailsDiv) {
    console.error('Modal or details div not found');
    return;
  }
  
  detailsDiv.innerHTML = `
    <div class="appointment-full-details" style="padding: 10px;">
      <div class="detail-row" style="display: flex; padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong style="width: 140px;">🆔 Token:</strong> <span>${app.token}</span></div>
      <div class="detail-row" style="display: flex; padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong style="width: 140px;">📅 Date:</strong> <span>${app.date}</span></div>
      <div class="detail-row" style="display: flex; padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong style="width: 140px;">⏰ Time:</strong> <span>${app.time}</span></div>
      <div class="detail-row" style="display: flex; padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong style="width: 140px;">🐾 Pet Name:</strong> <span>${escapeHtml(app.petName)}</span></div>
      <div class="detail-row" style="display: flex; padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong style="width: 140px;">🎂 Pet Age:</strong> <span>${app.petAge || 'N/A'}</span></div>
      <div class="detail-row" style="display: flex; padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong style="width: 140px;">⚖️ Weight:</strong> <span>${app.weight || 'N/A'} kg</span></div>
      <div class="detail-row" style="display: flex; padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong style="width: 140px;">👤 Owner Name:</strong> <span>${escapeHtml(app.ownerName)}</span></div>
      <div class="detail-row" style="display: flex; padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong style="width: 140px;">📞 Phone:</strong> <span>${app.ownerPhone}</span></div>
      <div class="detail-row" style="display: flex; padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong style="width: 140px;">📋 Symptoms:</strong> <span>${escapeHtml(app.symptoms || 'N/A')}</span></div>
      <div class="detail-row" style="display: flex; padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong style="width: 140px;">🩺 Diagnosis:</strong> <span>${escapeHtml(app.diagnosis || 'N/A')}</span></div>
      <div class="detail-row" style="display: flex; padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong style="width: 140px;">💊 Prescription:</strong> <span>${escapeHtml(app.prescription || 'N/A')}</span></div>
      <div class="detail-row" style="display: flex; padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong style="width: 140px;">📝 Treatment Plan:</strong> <span>${escapeHtml(app.treatmentPlan || 'N/A')}</span></div>
      <div class="detail-row" style="display: flex; padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong style="width: 140px;">📅 Follow-up Date:</strong> <span>${app.followUpDate || 'N/A'}</span></div>
      <div class="detail-row" style="display: flex; padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong style="width: 140px;">✅ Status:</strong> <span class="status ${app.status === 'Completed' ? 'completed' : 'confirmed'}">${app.status || 'Confirmed'}</span></div>
    </div>
  `;
  
  modal.classList.add('show');
  modal.style.display = 'flex';
  window.currentViewBookingId = bookingId;
}

/**
 * Close view appointment modal
 */
function closeViewAppointmentModal() {
  const modal = document.getElementById('viewAppointmentModal');
  if (modal) {
    modal.classList.remove('show');
    modal.style.display = 'none';
  }
}

/**
 * Delete appointment from modal
 */
function deleteAppointmentFromModal() { 
  if (confirm('Are you sure you want to delete this appointment?')) {
    hardDeleteAppointment(window.currentViewBookingId); 
    closeViewAppointmentModal(); 
  } 
}

/**
 * Edit appointment status
 * @param {string} bookingId - Booking ID to edit
 */
function editAppointment(bookingId) {
  const newStatus = prompt('Change status (Confirmed/In Progress/Completed/Cancelled):');
  if (newStatus && ['Confirmed', 'In Progress', 'Completed', 'Cancelled'].includes(newStatus)) {
    const app = allAppointments.find(a => a.bookingId === bookingId);
    if (app) app.status = newStatus;
    refreshAllData();
    showToast('✅ Status updated!', 'success');
  }
}

// ============================================
// SECTION 12.1: FIXED DELETE APPOINTMENT FUNCTION
// ============================================

/**
 * Hard delete appointment from all storage locations
 * @param {string} bookingId - Booking ID to delete
 */
function hardDeleteAppointment(bookingId) {
  if (confirm('⚠️ PERMANENT DELETE: This will remove the appointment from all records. Continue?')) {
    
    // Find the appointment to delete for logging
    const appointmentToDelete = allAppointments.find(a => a.bookingId === bookingId);
    const initialLength = allAppointments.length;
    
    // 1. Remove from allAppointments array
    allAppointments = allAppointments.filter(a => a.bookingId !== bookingId);
    
    // 2. Update localStorage backup (vet_bookings)
    const bookings = {};
    allAppointments.forEach(a => {
      if (!bookings[a.date]) bookings[a.date] = [];
      bookings[a.date].push(a.timeSlot);
    });
    localStorage.setItem('vet_bookings', JSON.stringify(bookings));
    
    // 3. Force refresh the UI
    refreshAllData();
    
    // 4. Reload current page view
    if (document.getElementById('appointmentsPage')?.classList.contains('active')) {
      setTimeout(() => {
        loadAllAppointmentsList();
      }, 100);
    }
    
    // 5. Update dashboard stats
    updateDashboardStats();
    loadRecentAppointments();
    updateQuickStats();
    
    // 6. Update appointment badge
    const today = getBangladeshDate();
    const todayCount = allAppointments.filter(a => a.date === today).length;
    const badge = document.getElementById('appointmentBadge');
    if (badge) badge.innerText = todayCount;
    
    // 7. Update total records count
    const totalRecords = document.getElementById('totalRecords');
    if (totalRecords) totalRecords.innerText = allAppointments.length;
    
    // 8. Show success message with details
    if (appointmentToDelete) {
      showToast(`✅ Appointment for "${appointmentToDelete.petName}" deleted successfully! Removed from ${initialLength - allAppointments.length} record(s).`, 'success');
    } else {
      showToast(`✅ Appointment deleted successfully! Removed from ${initialLength - allAppointments.length} record(s).`, 'success');
    }
    
    // 9. Log for debugging
    console.log(`Deleted appointment: ${bookingId}. Remaining appointments: ${allAppointments.length}`);
    
    // 10. Close modal if open
    closeViewAppointmentModal();
  }
}

/**
 * Alternative: Simple delete with confirmation
 * @param {string} bookingId - Booking ID to delete
 */
function deleteAppointment(bookingId) {
  hardDeleteAppointment(bookingId);
}

// ============================================
// SECTION 13: DOCTOR MANAGEMENT (CRUD)
// ============================================

/**
 * Load doctors from localStorage
 */
function loadDoctors() {
  if (!hasPermission('manage_doctors')) return;
  const stored = localStorage.getItem('clinic_doctors');
  doctors = stored ? JSON.parse(stored) : [];
  localStorage.setItem('clinic_doctors', JSON.stringify(doctors));
  renderDoctors();
}

/**
 * Render doctors list in UI
 */
function renderDoctors() {
  const container = document.getElementById('doctorsList');
  if (!container) return;
  if (!doctors.length) { container.innerHTML = '<div class="empty-state"><i class="fas fa-user-md"></i> No doctors added</div>'; return; }
  container.innerHTML = doctors.map(doc => `
    <div class="history-item">
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap">
        <div>
          <div><i class="fas fa-user-md" style="color:#f97316"></i> <strong>${escapeHtml(doc.name)}</strong></div>
          <div style="font-size:0.85rem">🔬 ${escapeHtml(doc.specialization)}</div>
          <div style="font-size:0.8rem">📧 ${doc.email} | 📞 ${doc.phone || 'N/A'}</div>
          <div style="font-size:0.8rem">⏰ ${doc.schedule || 'Flexible'}</div>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn-secondary" onclick="openEditDoctorModal(${doc.id})"><i class="fas fa-edit"></i> Edit</button>
          <button class="btn-danger" onclick="deleteDoctor(${doc.id})"><i class="fas fa-trash-alt"></i> Delete</button>
        </div>
      </div>
    </div>
  `).join('');
}

/**
 * Show add doctor modal
 */
function showAddDoctorModal() { 
  const m = document.getElementById('addDoctorModal'); 
  if(m) { 
    m.classList.add('show'); 
    m.style.display = 'flex'; 
  } 
}

/**
 * Close add doctor modal
 */
function closeAddDoctorModal() { 
  const m = document.getElementById('addDoctorModal'); 
  if(m) { 
    m.classList.remove('show'); 
    m.style.display = 'none'; 
    document.querySelectorAll('#addDoctorModal input').forEach(inp => inp.value = '');
  } 
}

/**
 * Add new doctor
 */
function addDoctor() {
  const newDoctor = { 
    id: Date.now(), 
    name: document.getElementById('newDoctorName')?.value, 
    email: document.getElementById('newDoctorEmail')?.value, 
    password: document.getElementById('newDoctorPassword')?.value, 
    specialization: document.getElementById('newDoctorSpecialization')?.value, 
    phone: document.getElementById('newDoctorPhone')?.value, 
    schedule: document.getElementById('newDoctorSchedule')?.value 
  };
  if (!newDoctor.name || !newDoctor.email) { 
    showToast('⚠️ Please fill required fields', 'error'); 
    return; 
  }
  doctors.push(newDoctor);
  localStorage.setItem('clinic_doctors', JSON.stringify(doctors));
  renderDoctors();
  closeAddDoctorModal();
  showToast('✅ Doctor added successfully!', 'success');
}

/**
 * Open edit doctor modal
 * @param {number} id - Doctor ID to edit
 */
function openEditDoctorModal(id) {
  const doctor = doctors.find(d => d.id === id);
  if (!doctor) return;
  document.getElementById('editDoctorId').value = doctor.id;
  document.getElementById('editDoctorName').value = doctor.name;
  document.getElementById('editDoctorEmail').value = doctor.email;
  document.getElementById('editDoctorSpecialization').value = doctor.specialization || '';
  document.getElementById('editDoctorPhone').value = doctor.phone || '';
  document.getElementById('editDoctorSchedule').value = doctor.schedule || '';
  document.getElementById('editDoctorPassword').value = '';
  const modal = document.getElementById('editDoctorModal');
  if (modal) { 
    modal.classList.add('show'); 
    modal.style.display = 'flex'; 
  }
}

/**
 * Close edit doctor modal
 */
function closeEditDoctorModal() { 
  const m = document.getElementById('editDoctorModal'); 
  if(m) { 
    m.classList.remove('show'); 
    m.style.display = 'none'; 
  } 
}

/**
 * Update doctor information
 */
function updateDoctor() {
  const id = parseInt(document.getElementById('editDoctorId')?.value);
  const index = doctors.findIndex(d => d.id === id);
  if (index !== -1) {
    doctors[index] = { 
      ...doctors[index], 
      name: document.getElementById('editDoctorName')?.value, 
      email: document.getElementById('editDoctorEmail')?.value, 
      specialization: document.getElementById('editDoctorSpecialization')?.value, 
      phone: document.getElementById('editDoctorPhone')?.value, 
      schedule: document.getElementById('editDoctorSchedule')?.value 
    };
    const newPassword = document.getElementById('editDoctorPassword')?.value;
    if (newPassword) doctors[index].password = newPassword;
    localStorage.setItem('clinic_doctors', JSON.stringify(doctors));
    renderDoctors();
    closeEditDoctorModal();
    showToast('✅ Doctor updated successfully!', 'success');
  }
}

/**
 * Delete doctor
 * @param {number} id - Doctor ID to delete
 */
function deleteDoctor(id) { 
  if (confirm('⚠️ Delete this doctor permanently?')) { 
    doctors = doctors.filter(d => d.id !== id); 
    localStorage.setItem('clinic_doctors', JSON.stringify(doctors)); 
    renderDoctors(); 
    showToast('🗑️ Doctor deleted', 'success'); 
  } 
}

// ============================================
// SECTION 14: SERVICES MANAGEMENT (CRUD)
// ============================================

/**
 * Load services from localStorage
 */
function loadServices() {
  if (!hasPermission('manage_services')) return;
  const stored = localStorage.getItem('clinic_services');
  services = stored ? JSON.parse(stored) : [];
  localStorage.setItem('clinic_services', JSON.stringify(services));
  renderServices();
}

/**
 * Render services list in UI
 */
function renderServices() {
  const container = document.getElementById('servicesList');
  if (!container) return;
  if (!services.length) { container.innerHTML = '<div class="empty-state"><i class="fas fa-stethoscope"></i> No services added</div>'; return; }
  container.innerHTML = services.map(service => `
    <div class="history-item">
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap">
        <div>
          <div><i class="fas ${service.icon}" style="color:#f97316"></i> <strong>${escapeHtml(service.name)}</strong></div>
          <div style="font-size:0.85rem">📝 ${escapeHtml(service.desc)}</div>
          <div style="font-size:0.8rem">💰 ৳${service.price} | ⏱️ ${service.duration} min</div>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn-secondary" onclick="openEditServiceModal(${service.id})"><i class="fas fa-edit"></i> Edit</button>
          <button class="btn-danger" onclick="deleteService(${service.id})"><i class="fas fa-trash-alt"></i> Delete</button>
        </div>
      </div>
    </div>
  `).join('');
}

/**
 * Show add service modal
 */
function showAddServiceModal() { 
  const m = document.getElementById('addServiceModal'); 
  if(m) { 
    m.classList.add('show'); 
    m.style.display = 'flex'; 
  } 
}

/**
 * Close add service modal
 */
function closeAddServiceModal() { 
  const m = document.getElementById('addServiceModal'); 
  if(m) { 
    m.classList.remove('show'); 
    m.style.display = 'none'; 
    document.querySelectorAll('#addServiceModal input, #addServiceModal textarea').forEach(inp => inp.value = '');
  } 
}

/**
 * Add new service
 */
function addService() {
  const newService = { 
    id: Date.now(), 
    name: document.getElementById('newServiceName')?.value, 
    icon: document.getElementById('newServiceIcon')?.value || 'fa-stethoscope', 
    desc: document.getElementById('newServiceDesc')?.value, 
    price: parseInt(document.getElementById('newServicePrice')?.value) || 0, 
    duration: parseInt(document.getElementById('newServiceDuration')?.value) || 30 
  };
  if (!newService.name) { 
    showToast('⚠️ Please enter service name', 'error'); 
    return; 
  }
  services.push(newService);
  localStorage.setItem('clinic_services', JSON.stringify(services));
  renderServices();
  closeAddServiceModal();
  showToast('✅ Service added successfully!', 'success');
}

/**
 * Open edit service modal
 * @param {number} id - Service ID to edit
 */
function openEditServiceModal(id) {
  const service = services.find(s => s.id === id);
  if (!service) return;
  document.getElementById('editServiceId').value = service.id;
  document.getElementById('editServiceName').value = service.name;
  document.getElementById('editServiceIcon').value = service.icon;
  document.getElementById('editServiceDesc').value = service.desc;
  document.getElementById('editServicePrice').value = service.price;
  document.getElementById('editServiceDuration').value = service.duration;
  const modal = document.getElementById('editServiceModal');
  if (modal) { 
    modal.classList.add('show'); 
    modal.style.display = 'flex'; 
  }
}

/**
 * Close edit service modal
 */
function closeEditServiceModal() { 
  const m = document.getElementById('editServiceModal'); 
  if(m) { 
    m.classList.remove('show'); 
    m.style.display = 'none'; 
  } 
}

/**
 * Update service information
 */
function updateService() {
  const id = parseInt(document.getElementById('editServiceId')?.value);
  const index = services.findIndex(s => s.id === id);
  if (index !== -1) {
    services[index] = { 
      ...services[index], 
      name: document.getElementById('editServiceName')?.value, 
      icon: document.getElementById('editServiceIcon')?.value, 
      desc: document.getElementById('editServiceDesc')?.value, 
      price: parseInt(document.getElementById('editServicePrice')?.value) || 0, 
      duration: parseInt(document.getElementById('editServiceDuration')?.value) || 30 
    };
    localStorage.setItem('clinic_services', JSON.stringify(services));
    renderServices();
    closeEditServiceModal();
    showToast('✅ Service updated successfully!', 'success');
  }
}

/**
 * Delete service
 * @param {number} id - Service ID to delete
 */
function deleteService(id) { 
  if (confirm('⚠️ Delete this service permanently?')) { 
    services = services.filter(s => s.id !== id); 
    localStorage.setItem('clinic_services', JSON.stringify(services)); 
    renderServices(); 
    showToast('🗑️ Service deleted', 'success'); 
  } 
}

// ============================================
// SECTION 15: USER MANAGEMENT (Only Super Admin)
// ============================================

/**
 * Load users from localStorage
 */
function loadUsers() {
  if (currentUserRole !== 'super_admin') return;
  const stored = localStorage.getItem('system_users');
  if (stored) {
    users = JSON.parse(stored);
  } else {
    users = [
      { id: 1, name: 'Super Admin', email: 'admin@vetforpet.com', role: 'super_admin', password: 'admin123', permissions: 'full' },
      { id: 2, name: 'Clinic Manager', email: 'manager@vetforpet.com', role: 'manager', password: 'manager123', permissions: 'view_appointments,add_appointments,edit_appointments,manage_doctors,manage_services,reports' },
      { id: 3, name: 'Receptionist', email: 'reception@vetforpet.com', role: 'receptionist', password: 'reception123', permissions: 'view_appointments,add_appointments,edit_appointments' }
    ];
    localStorage.setItem('system_users', JSON.stringify(users));
  }
  renderUsers();
}

/**
 * Render users list in UI
 */
function renderUsers() {
  const container = document.getElementById('usersList');
  if (!container) return;
  if (!users.length) { container.innerHTML = '<div class="empty-state"><i class="fas fa-users"></i> No users found</div>'; return; }
  container.innerHTML = users.map(user => `
    <div class="history-item">
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap">
        <div>
          <div><i class="fas fa-user" style="color:#f97316"></i> <strong>${escapeHtml(user.name)}</strong></div>
          <div style="font-size:0.85rem">📧 ${user.email}</div>
          <div style="font-size:0.8rem">👑 Role: ${user.role === 'super_admin' ? 'Super Admin' : (user.role === 'manager' ? 'Manager' : 'Receptionist')}</div>
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn-secondary" onclick="openEditUserModal(${user.id})"><i class="fas fa-edit"></i> Edit</button>
          ${user.role !== 'super_admin' ? `<button class="btn-danger" onclick="deleteUser(${user.id})"><i class="fas fa-trash-alt"></i> Delete</button>` : ''}
        </div>
      </div>
    </div>
  `).join('');
}

/**
 * Show add user modal
 */
function showAddUserModal() { 
  if (currentUserRole !== 'super_admin') { 
    showPermissionDenied(); 
    return; 
  }
  const m = document.getElementById('addUserModal'); 
  if(m) { 
    m.classList.add('show'); 
    m.style.display = 'flex'; 
  } 
}

/**
 * Close add user modal
 */
function closeAddUserModal() { 
  const m = document.getElementById('addUserModal'); 
  if(m) { 
    m.classList.remove('show'); 
    m.style.display = 'none'; 
    document.querySelectorAll('#addUserModal input, #addUserModal select').forEach(inp => inp.value = '');
  } 
}

/**
 * Add new user
 */
function addUser() {
  const newUser = { 
    id: Date.now(), 
    name: document.getElementById('newUserName')?.value, 
    email: document.getElementById('newUserEmail')?.value, 
    password: document.getElementById('newUserPassword')?.value, 
    role: document.getElementById('newUserRole')?.value 
  };
  if (!newUser.name || !newUser.email) { 
    showToast('⚠️ Please fill required fields', 'error'); 
    return; 
  }
  users.push(newUser);
  localStorage.setItem('system_users', JSON.stringify(users));
  renderUsers();
  closeAddUserModal();
  showToast('✅ User added successfully!', 'success');
}

/**
 * Open edit user modal
 * @param {number} id - User ID to edit
 */
function openEditUserModal(id) {
  const user = users.find(u => u.id === id);
  if (!user) return;
  document.getElementById('editUserId').value = user.id;
  document.getElementById('editUserName').value = user.name;
  document.getElementById('editUserEmail').value = user.email;
  document.getElementById('editUserRole').value = user.role;
  document.getElementById('editUserPassword').value = '';
  const modal = document.getElementById('editUserModal');
  if (modal) { 
    modal.classList.add('show'); 
    modal.style.display = 'flex'; 
  }
}

/**
 * Close edit user modal
 */
function closeEditUserModal() { 
  const m = document.getElementById('editUserModal'); 
  if(m) { 
    m.classList.remove('show'); 
    m.style.display = 'none'; 
  } 
}

/**
 * Update user information
 */
function updateUser() {
  const id = parseInt(document.getElementById('editUserId')?.value);
  const index = users.findIndex(u => u.id === id);
  if (index !== -1) {
    users[index] = { 
      ...users[index], 
      name: document.getElementById('editUserName')?.value, 
      email: document.getElementById('editUserEmail')?.value, 
      role: document.getElementById('editUserRole')?.value 
    };
    const newPassword = document.getElementById('editUserPassword')?.value;
    if (newPassword) users[index].password = newPassword;
    localStorage.setItem('system_users', JSON.stringify(users));
    renderUsers();
    closeEditUserModal();
    showToast('✅ User updated successfully!', 'success');
  }
}

/**
 * Delete user
 * @param {number} id - User ID to delete
 */
function deleteUser(id) { 
  if (confirm('⚠️ Delete this user permanently?')) { 
    users = users.filter(u => u.id !== id); 
    localStorage.setItem('system_users', JSON.stringify(users)); 
    renderUsers(); 
    showToast('🗑️ User deleted', 'success'); 
  } 
}

// ============================================
// SECTION 16: PERMISSIONS MANAGEMENT
// ============================================

/**
 * Load permissions configuration from localStorage
 */
function loadPermissionsConfig() {
  const stored = localStorage.getItem('role_permissions');
  if (stored) {
    permissions = JSON.parse(stored);
  } else {
    permissions = [
      { role: 'super_admin', permissions: ['full'] },
      { role: 'manager', permissions: ['view_appointments', 'add_appointments', 'edit_appointments', 'manage_doctors', 'manage_services', 'reports'] },
      { role: 'receptionist', permissions: ['view_appointments', 'add_appointments', 'edit_appointments'] }
    ];
    localStorage.setItem('role_permissions', JSON.stringify(permissions));
  }
}

/**
 * Load permissions UI for configuration
 */
function loadPermissionsUI() {
  if (currentUserRole !== 'super_admin') { 
    showPermissionDenied(); 
    return; 
  }
  const container = document.getElementById('permissionsList');
  if (!container) return;
  
  const allPermissions = [
    { key: 'view_appointments', label: 'View Appointments', description: 'Can view all appointments' },
    { key: 'add_appointments', label: 'Add Appointments', description: 'Can create new appointments' },
    { key: 'edit_appointments', label: 'Edit Appointments', description: 'Can modify existing appointments' },
    { key: 'manage_doctors', label: 'Manage Doctors', description: 'Can add, edit, delete doctors' },
    { key: 'manage_services', label: 'Manage Services', description: 'Can add, edit, delete services' },
    { key: 'reports', label: 'View Reports', description: 'Can access reports section' }
  ];
  
  container.innerHTML = permissions.map(rolePerm => `
    <div class="permission-group">
      <h4><i class="fas fa-shield-alt"></i> ${rolePerm.role === 'super_admin' ? 'Super Admin' : (rolePerm.role === 'manager' ? 'Manager' : 'Receptionist')} Permissions</h4>
      ${allPermissions.map(perm => `
        <div class="permission-item">
          <input type="checkbox" id="perm_${rolePerm.role}_${perm.key}" data-role="${rolePerm.role}" data-perm="${perm.key}" 
            ${rolePerm.permissions.includes(perm.key) || rolePerm.role === 'super_admin' ? 'checked' : ''} ${rolePerm.role === 'super_admin' ? 'disabled' : ''}>
          <label for="perm_${rolePerm.role}_${perm.key}">
            <strong><i class="fas fa-key"></i> ${perm.label}</strong> - ${perm.description}
          </label>
        </div>
      `).join('')}
    </div>
  `).join('');
}

/**
 * Save permissions configuration
 */
function savePermissions() {
  const newPermissions = [];
  document.querySelectorAll('.permission-item input[type="checkbox"]:not([disabled])').forEach(checkbox => {
    const role = checkbox.getAttribute('data-role');
    const perm = checkbox.getAttribute('data-perm');
    let rolePerm = newPermissions.find(rp => rp.role === role);
    if (!rolePerm) { 
      rolePerm = { role: role, permissions: [] }; 
      newPermissions.push(rolePerm); 
    }
    if (checkbox.checked) rolePerm.permissions.push(perm);
  });
  permissions = newPermissions;
  localStorage.setItem('role_permissions', JSON.stringify(permissions));
  showToast('✅ Permissions saved successfully!', 'success');
}

// ============================================
// SECTION 17: SETTINGS & CONFIGURATION
// ============================================

/**
 * Load settings from localStorage
 */
function loadSettings() {
  const settings = JSON.parse(localStorage.getItem('clinic_settings') || '{}');
  const nameEl = document.getElementById('clinicName'); if(nameEl) nameEl.value = settings.clinicName || 'VET FOR PET CLINIC';
  const addressEl = document.getElementById('clinicAddress'); if(addressEl) addressEl.value = settings.clinicAddress || 'Dhaka, Bangladesh';
  const phoneEl = document.getElementById('clinicPhone'); if(phoneEl) phoneEl.value = settings.clinicPhone || '01406-779238';
  const emergencyEl = document.getElementById('clinicEmergency'); if(emergencyEl) emergencyEl.value = settings.clinicEmergency || '01609-420061';
  const emailEl = document.getElementById('clinicEmail'); if(emailEl) emailEl.value = settings.clinicEmail || 'info@vetforpet.com';
}

/**
 * Save clinic settings to localStorage
 */
function saveSettings() {
  const settings = { 
    clinicName: document.getElementById('clinicName')?.value, 
    clinicAddress: document.getElementById('clinicAddress')?.value, 
    clinicPhone: document.getElementById('clinicPhone')?.value, 
    clinicEmergency: document.getElementById('clinicEmergency')?.value, 
    clinicEmail: document.getElementById('clinicEmail')?.value 
  };
  localStorage.setItem('clinic_settings', JSON.stringify(settings));
  showToast('✅ Settings saved successfully!', 'success');
}

/**
 * Load slot configuration from localStorage
 */
function loadSlotConfig() {
  const defaultConfig = { 
    Saturday: { start: 9, end: 21 }, 
    Sunday: { start: 9, end: 15 }, 
    Monday: { start: 9, end: 15 }, 
    Tuesday: { start: 9, end: 21 }, 
    Wednesday: { start: 9, end: 15 }, 
    Thursday: { start: 9, end: 15 }, 
    Friday: { start: 9, end: 15 } 
  };
  const config = JSON.parse(localStorage.getItem('slot_config') || JSON.stringify(defaultConfig));
  const container = document.getElementById('slotConfig');
  if (!container) return;
  container.innerHTML = Object.entries(config).map(([day, cfg]) => `
    <div class="slot-item">
      <label><i class="fas fa-calendar"></i> ${day}</label>
      <input type="number" id="${day}_start" value="${cfg.start}" min="0" max="23" class="slot-input"> - 
      <input type="number" id="${day}_end" value="${cfg.end}" min="0" max="23" class="slot-input">
    </div>
  `).join('');
}

/**
 * Save slot configuration to localStorage
 */
function saveSlotConfig() {
  const newConfig = {};
  const days = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  days.forEach(day => { 
    const startEl = document.getElementById(`${day}_start`); 
    const endEl = document.getElementById(`${day}_end`); 
    newConfig[day] = { 
      start: startEl ? parseInt(startEl.value) || 9 : 9, 
      end: endEl ? parseInt(endEl.value) || 17 : 17 
    }; 
  });
  localStorage.setItem('slot_config', JSON.stringify(newConfig));
  showToast('✅ Slot configuration saved!', 'success');
}

/**
 * Load pricing configuration from localStorage
 */
function loadPricing() {
  const pricing = JSON.parse(localStorage.getItem('service_pricing') || '{}');
  const container = document.getElementById('pricingConfig');
  if (!container) return;
  if (services.length > 0) { 
    container.innerHTML = services.map(service => `
      <div class="slot-item">
        <label><i class="fas fa-money-bill-wave"></i> ${escapeHtml(service.name)}</label>
        <input type="number" id="price_${service.id}" value="${pricing[service.id] || service.price || 500}" class="price-input" min="0">
      </div>
    `).join(''); 
  } else { 
    container.innerHTML = '<p><i class="fas fa-info-circle"></i> Add services first to set pricing</p>'; 
  }
}

/**
 * Save pricing configuration to localStorage
 */
function savePricing() {
  const pricing = {};
  services.forEach(service => { 
    const priceInput = document.getElementById(`price_${service.id}`); 
    if(priceInput) pricing[service.id] = parseInt(priceInput.value) || 0; 
  });
  localStorage.setItem('service_pricing', JSON.stringify(pricing));
  showToast('✅ Pricing saved successfully!', 'success');
}

// ============================================
// SECTION 18: BACKUP & EXPORT
// ============================================

/**
 * Export appointments to CSV file
 */
function exportToCSV() {
  if (!allAppointments.length) { 
    showToast('❌ No data to export', 'error'); 
    return; 
  }
  let csv = "Date,Time,Token,Pet Name,Owner Name,Phone,Symptoms,Diagnosis,Prescription,Status\n";
  allAppointments.forEach(a => { 
    csv += `"${a.date}","${a.time}","${a.token}","${escapeCsv(a.petName)}","${escapeCsv(a.ownerName)}","${a.ownerPhone}","${escapeCsv(a.symptoms||'')}","${escapeCsv(a.diagnosis||'')}","${escapeCsv(a.prescription||'')}","${a.status||'Confirmed'}"\n`; 
  });
  const blob = new Blob([csv], { type: 'text/csv' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `appointments_${getBangladeshDate()}.csv`;
  link.click();
  showToast('📄 CSV exported successfully!', 'success');
}

/**
 * Escape string for CSV export
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeCsv(str) { 
  if(!str) return ''; 
  return str.replace(/"/g, '""'); 
}

/**
 * Download full backup as JSON file
 */
function backupData() {
  const backup = { 
    appointments: allAppointments, 
    doctors: doctors, 
    services: services, 
    users: users, 
    permissions: permissions, 
    settings: localStorage.getItem('clinic_settings'), 
    slotConfig: localStorage.getItem('slot_config'), 
    pricing: localStorage.getItem('service_pricing'), 
    date: new Date().toISOString() 
  };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `vet_clinic_backup_${getBangladeshDate()}.json`;
  link.click();
  localStorage.setItem('lastBackup', new Date().toLocaleString());
  const lastBackupSpan = document.getElementById('lastBackup');
  if (lastBackupSpan) lastBackupSpan.innerText = new Date().toLocaleString();
  showToast('💾 Backup downloaded successfully!', 'success');
}

/**
 * Trigger restore file picker
 */
function triggerRestore() { 
  const rf = document.getElementById('restoreFile'); 
  if(rf) rf.click(); 
}

/**
 * Restore from backup file
 */
document.getElementById('restoreFile')?.addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(ev) {
    try {
      const data = JSON.parse(ev.target.result);
      if (data.appointments) { 
        const bookings = {}; 
        data.appointments.forEach(a => { 
          if (!bookings[a.date]) bookings[a.date] = []; 
          bookings[a.date].push(a.timeSlot); 
        }); 
        localStorage.setItem('vet_bookings', JSON.stringify(bookings)); 
        allAppointments = data.appointments; 
        refreshAllData(); 
      }
      if (data.doctors) { 
        localStorage.setItem('clinic_doctors', JSON.stringify(data.doctors)); 
        doctors = data.doctors; 
        renderDoctors(); 
      }
      if (data.services) { 
        localStorage.setItem('clinic_services', JSON.stringify(data.services)); 
        services = data.services; 
        renderServices(); 
      }
      if (data.users && currentUserRole === 'super_admin') { 
        localStorage.setItem('system_users', JSON.stringify(data.users)); 
        users = data.users; 
        renderUsers(); 
      }
      if (data.permissions && currentUserRole === 'super_admin') { 
        localStorage.setItem('role_permissions', JSON.stringify(data.permissions)); 
        permissions = data.permissions; 
      }
      if (data.settings) localStorage.setItem('clinic_settings', data.settings);
      if (data.slotConfig) localStorage.setItem('slot_config', data.slotConfig);
      if (data.pricing) localStorage.setItem('service_pricing', data.pricing);
      showToast('✅ Restore successful! Refreshing...', 'success');
      setTimeout(() => location.reload(), 1500);
    } catch(err) { 
      showToast('❌ Invalid backup file', 'error'); 
    }
  };
  reader.readAsText(file);
});

// ============================================
// SECTION 19: REPORTS & CHARTS
// ============================================

/**
 * Update report statistics
 */
function updateReportStats() {
  if (!hasPermission('reports')) return;
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
  const weeklyApps = allAppointments.filter(a => new Date(a.date) >= weekAgo);
  const weeklyElem = document.getElementById('weeklyCount'); if(weeklyElem) weeklyElem.innerText = weeklyApps.length;
  const monthAgo = new Date(); monthAgo.setMonth(monthAgo.getMonth() - 1);
  const monthlyApps = allAppointments.filter(a => new Date(a.date) >= monthAgo);
  const monthlyElem = document.getElementById('monthlyCount'); if(monthlyElem) monthlyElem.innerText = monthlyApps.length;
  const completedApps = allAppointments.filter(a => a.status === 'Completed');
  const completedElem = document.getElementById('completedReportCount'); if(completedElem) completedElem.innerText = completedApps.length;
  const uniquePets = [...new Set(allAppointments.map(a => a.petName))];
  const petsElem = document.getElementById('totalPetsReportCount'); if(petsElem) petsElem.innerText = uniquePets.length;
  createWeeklyChart();
}

/**
 * Create weekly appointments chart
 */
function createWeeklyChart() {
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    last7Days.push(date.toISOString().split('T')[0]);
  }
  const counts = last7Days.map(date => allAppointments.filter(a => a.date === date).length);
  const ctx = document.getElementById('weeklyChart')?.getContext('2d');
  if (!ctx) return;
  if (adminChart) adminChart.destroy();
  adminChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: last7Days.map(d => new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })),
      datasets: [{ label: '📊 Appointments', data: counts, backgroundColor: '#f97316', borderRadius: 8 }]
    },
    options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { display: false } } }
  });
}

/**
 * Load report based on type and date
 */
async function loadReport() {
  if (!hasPermission('reports')) { 
    showPermissionDenied(); 
    return; 
  }
  const type = document.getElementById('reportType')?.value || 'daily';
  const date = document.getElementById('reportDate')?.value || getBangladeshDate();
  let filtered = allAppointments;
  let title = '';
  if (type === 'daily') { 
    filtered = allAppointments.filter(a => a.date === date); 
    title = `📅 Daily Report - ${date}`; 
  } else if (type === 'weekly') { 
    const weekAgo = new Date(); 
    weekAgo.setDate(weekAgo.getDate() - 7); 
    filtered = allAppointments.filter(a => new Date(a.date) >= weekAgo); 
    title = '📊 Weekly Report'; 
  } else if (type === 'monthly') { 
    const monthAgo = new Date(); 
    monthAgo.setMonth(monthAgo.getMonth() - 1); 
    filtered = allAppointments.filter(a => new Date(a.date) >= monthAgo); 
    title = '📈 Monthly Report'; 
  } else { 
    const yearAgo = new Date(); 
    yearAgo.setFullYear(yearAgo.getFullYear() - 1); 
    filtered = allAppointments.filter(a => new Date(a.date) >= yearAgo); 
    title = '📉 Yearly Report'; 
  }
  const container = document.getElementById('reportContainer');
  if (!container) return;
  container.innerHTML = `
    <div class="report-summary">
      <h3><i class="fas fa-chart-line"></i> ${title}</h3>
      <p><i class="fas fa-calendar"></i> Total: ${filtered.length} | <i class="fas fa-check-circle"></i> Completed: ${filtered.filter(a => a.status === 'Completed').length} | <i class="fas fa-clock"></i> Pending: ${filtered.filter(a => a.status !== 'Completed').length}</p>
      <div class="report-list">
        <table class="report-table">
          <thead><tr><th><i class="fas fa-calendar"></i> Date</th><th><i class="fas fa-paw"></i> Pet</th><th><i class="fas fa-user"></i> Owner</th><th><i class="fas fa-flag-checkered"></i> Status</th></tr></thead>
          <tbody>
            ${filtered.slice(0, 20).map(a => `
              <tr><td>${a.date}侧<td><i class="fas fa-paw"></i> ${escapeHtml(a.petName)}侧<td><i class="fas fa-user"></i> ${escapeHtml(a.ownerName)}侧<td><span class="status ${a.status === 'Completed' ? 'completed' : 'confirmed'}">${a.status || 'Confirmed'}</span>侧)`).join('')}
          </tbody>
        </table>
        ${filtered.length > 20 ? '<p><i class="fas fa-ellipsis-h"></i> ... and more</p>' : ''}
      </div>
    </div>
  `;
}

/**
 * Print report
 */
function printReport() {
  const container = document.getElementById('reportContainer');
  if (!container) return;
  const win = window.open('', '_blank');
  win.document.write(`<html><head><title>Report</title><style>body{font-family:Arial;padding:20px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:8px}</style></head><body>${container.innerHTML}</body></html>`);
  win.document.close(); 
  win.print();
  showToast('🖨️ Report sent to printer', 'success');
}

/**
 * Print all appointments
 */
function printAllAppointments() {
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>All Appointments</title><style>table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:8px}th{background:#f97316;color:white}</style></head><body><h2><i class="fas fa-clinic-medical"></i> VET FOR PET CLINIC - All Appointments</h2><p>Generated: ${new Date().toLocaleString()}</p><table><thead><tr><th><i class="fas fa-calendar"></i> Date</th><th><i class="fas fa-clock"></i> Time</th><th><i class="fas fa-paw"></i> Pet</th><th><i class="fas fa-user"></i> Owner</th><th><i class="fas fa-ticket-alt"></i> Token</th><th><i class="fas fa-flag-checkered"></i> Status</th></tr></thead><tbody>${allAppointments.map(a => `<tr><td>${a.date}侧<td>${a.time}侧<td><i class="fas fa-paw"></i> ${escapeHtml(a.petName)}侧<td><i class="fas fa-user"></i> ${escapeHtml(a.ownerName)}侧<td>${a.token}侧<td><span class="status ${a.status === 'Completed' ? 'completed' : 'confirmed'}">${a.status || 'Confirmed'}</span>侧)`).join('')}</tbody></table></body></html>`);
  win.document.close(); 
  win.print();
  showToast('🖨️ All appointments sent to printer', 'success');
}

// ============================================
// SECTION 20: LOGOUT FUNCTIONS
// ============================================

/**
 * Show logout confirmation modal
 */
function showLogoutModal() { 
  const modal = document.getElementById('logoutModal'); 
  if (modal) { 
    modal.classList.add('show'); 
    modal.style.display = 'flex'; 
  } 
}

/**
 * Close logout confirmation modal
 */
function closeLogoutModal() { 
  const modal = document.getElementById('logoutModal'); 
  if (modal) { 
    modal.classList.remove('show'); 
    modal.style.display = 'none'; 
  } 
}

/**
 * Confirm logout and redirect to login page
 */
function confirmLogout() { 
  if (autoSyncInterval) clearInterval(autoSyncInterval); 
  sessionStorage.clear(); 
  window.location.href = 'admin-login.html'; 
}

// ============================================
// SECTION 21: UTILITY FUNCTIONS
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