// ============================================
// ADMIN DASHBOARD - COMPLETE SCRIPT
// Role Based Access | Full Permissions Control
// Version: 3.3 | Updated with Permission Checks
// Last Updated: 2026
// ============================================

// ============================================
// SECTION 1: CONFIGURATION & GLOBAL VARIABLES
// ============================================

// Google Apps Script URL for backend API
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxxFwjqxDdC7uWqjF0CGbzYCHyZ1jZM_jsXz7P1FnNIANsAPpccZfvktQrFLrag3N1P/exec";

// Global state variables
let allAppointments = [];
let doctors = [];
let services = [];
let users = [];
let permissions = [];
let currentPage = 1;
let itemsPerPage = 20;
let adminChart = null;
let autoSyncInterval = null;
let currentUserRole = '';
let currentUserPermissions = [];

// ============================================
// SECTION 2: ROLE & PERMISSION CHECK
// ============================================

/**
 * ইউজারের রোল চেক করে (রিসেপশনিস্ট চেক সহ)
 */
function checkUserAccess() {
  const adminRole = sessionStorage.getItem('admin_role');
  const adminLoggedIn = sessionStorage.getItem('admin_logged_in');
  
  // লগইন চেক
  if (!adminLoggedIn || adminLoggedIn !== 'true') {
    console.warn('🔒 No login found. Redirecting to login page...');
    window.location.href = 'admin-login.html';
    return false;
  }
  
  // 🔥 গুরুত্বপূর্ণ: রিসেপশনিস্ট চেক 🔥
  // রিসেপশনিস্টরা যাতে অ্যাডমিন ড্যাশবোর্ডে ঢুকতে না পারে
  if (adminRole === 'receptionist') {
    console.warn('🚫 Receptionist access denied to Admin Dashboard. Redirecting to Reception Dashboard...');
    window.location.href = 'reception-dashboard.html';
    return false;
  }
  
  return true;
}

// মেইন ফাংশন শুরু হওয়ার আগে চেক করুন
(function() {
  if (!checkUserAccess()) {
    return;
  }
})();

/**
 * ইউজারের পারমিশন চেক করে
 */
function hasPermission(permission) {
  if (currentUserRole === 'super_admin') return true;
  return currentUserPermissions.includes(permission);
}

/**
 * পারমিশন ডিনাইড মেসেজ দেখায়
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
 * পারমিশন মডাল বন্ধ করে
 */
function closePermissionModal() {
  const modal = document.getElementById('permissionDeniedModal');
  if (modal) {
    modal.classList.remove('show');
    modal.style.display = 'none';
  }
}

// ============================================
// SECTION 3: USER PERMISSIONS LOAD
// ============================================

/**
 * ইউজারের পারমিশন লোড করে এবং মেনু আপডেট করে
 */
function loadUserPermissions() {
  currentUserRole = sessionStorage.getItem('admin_role') || 'manager';
  const permissionsStr = sessionStorage.getItem('admin_permissions') || '';
  
  currentUserPermissions = permissionsStr === 'full' ? 
    ['full', 'view_appointments', 'add_appointments', 'edit_appointments', 'manage_doctors', 'manage_services', 'reports'] : 
    permissionsStr.split(',');
  
  console.log('👤 User Role:', currentUserRole);
  console.log('🔑 User Permissions:', currentUserPermissions);
  
  // নেভিগেশন মেনু আপডেট - পারমিশন ভিত্তিক দেখানো/লুকানো
  document.querySelectorAll('.nav-item').forEach(item => {
    const requiredPerm = item.getAttribute('data-permission');
    
    // শুধু সুপার অ্যাডমিন দেখতে পারে এমন মেনু
    if (requiredPerm === 'full' && currentUserRole !== 'super_admin') {
      item.style.display = 'none';
      return;
    }
    
    // অন্যান্য পারমিশন চেক
    if (requiredPerm && requiredPerm !== 'full') {
      if (!hasPermission(requiredPerm) && currentUserRole !== 'super_admin') {
        item.classList.add('disabled');
        item.style.pointerEvents = 'none';
        item.style.opacity = '0.5';
      } else {
        item.classList.remove('disabled');
        item.style.pointerEvents = 'auto';
        item.style.opacity = '1';
        item.style.display = 'flex';
      }
    }
  });
  
  // ইউজার রোল ব্যাজ আপডেট
  const userRoleBadge = document.getElementById('userRoleBadge');
  if (userRoleBadge) {
    userRoleBadge.innerText = currentUserRole === 'super_admin' ? 'Super Admin' : 
                              (currentUserRole === 'manager' ? 'Manager' : 'Receptionist');
  }
}

// ============================================
// SECTION 4: AUTHENTICATION CHECK (MAIN)
// ============================================

/**
 * মেইন অথেনটিকেশন চেক - পেজ লোডের সময় রান করে
 */
(function() {
  // প্রথমে রিসেপশনিস্ট চেক
  if (!checkUserAccess()) {
    return;
  }
  
  // লোড ইউজার পারমিশন
  loadUserPermissions();
  
  // অ্যাডমিন তথ্য UI তে সেট করুন
  const adminName = sessionStorage.getItem('admin_name') || 'Admin';
  const adminRole = sessionStorage.getItem('admin_role') || 'Manager';
  
  const welcomeName = document.getElementById('welcomeName');
  const adminNameSpan = document.getElementById('adminName');
  const adminRoleSpan = document.getElementById('adminRole');
  
  if (welcomeName) welcomeName.innerText = adminName;
  if (adminNameSpan) adminNameSpan.innerText = adminName;
  if (adminRoleSpan) adminRoleSpan.innerText = adminRole === 'super_admin' ? 'Super Admin' : (adminRole === 'manager' ? 'Manager' : 'Receptionist');
  
  // সব ডাটা লোড করুন
  loadUsers();
  loadPermissionsConfig();
})();

// ============================================
// SECTION 5: BANGLADESH TIME ZONE
// ============================================

function getBangladeshTime() {
  const now = new Date();
  const utcTime = now.getTime();
  const bdTime = new Date(utcTime + (6 * 60 * 60 * 1000));
  return bdTime;
}

function getBangladeshDate() {
  const bdTime = getBangladeshTime();
  const year = bdTime.getUTCFullYear();
  const month = String(bdTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(bdTime.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getBangladeshFormattedTime() {
  const bdTime = getBangladeshTime();
  let hours = bdTime.getUTCHours();
  const minutes = bdTime.getUTCMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const minutesStr = minutes < 10 ? '0' + minutes : minutes;
  return `${hours}:${minutesStr} ${ampm}`;
}

// ============================================
// SECTION 6: INITIALIZATION
// ============================================

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
  loadActiveKeys();
  
  const refreshBtn = document.querySelector('.refresh-btn');
  if (refreshBtn) refreshBtn.onclick = () => refreshAllData();
  
  const reportDate = document.getElementById('reportDate');
  if (reportDate) reportDate.value = getBangladeshDate();
});

function updateDateTime() {
  const bdTime = getBangladeshTime();
  const dateElem = document.getElementById('currentDate');
  const timeElem = document.getElementById('currentTime');
  
  if (dateElem) {
    dateElem.innerText = bdTime.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC'
    });
  }
  
  if (timeElem) {
    timeElem.innerText = getBangladeshFormattedTime();
  }
}

// ============================================
// SECTION 7: NAVIGATION SETUP
// ============================================

function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    if (item.classList.contains('disabled')) return;
    
    item.addEventListener('click', (e) => {
      e.preventDefault();
      
      const requiredPerm = item.getAttribute('data-permission');
      if (requiredPerm && requiredPerm !== 'full') {
        if (!hasPermission(requiredPerm) && currentUserRole !== 'super_admin') {
          showPermissionDenied();
          return;
        }
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
      if (page === 'settings') loadActiveKeys();
    });
  });
}

function goToPage(pageId) {
  const navItem = document.querySelector(`.nav-item[data-page="${pageId}"]`);
  if (navItem && !navItem.classList.contains('disabled')) navItem.click();
  else showPermissionDenied();
}

// ============================================
// SECTION 8: JSONP API HELPER FUNCTIONS
// ============================================

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
      if (document.body.contains(script)) script.remove();
      reject(new Error('JSONP request timeout'));
    }, 15000);
    
    window[callbackName] = function(data) {
      clearTimeout(timeout);
      delete window[callbackName];
      if (document.body.contains(script)) script.remove();
      resolve(data);
    };
    
    script.onerror = function() {
      clearTimeout(timeout);
      delete window[callbackName];
      if (document.body.contains(script)) script.remove();
      reject(new Error('JSONP request failed'));
    };
    
    script.src = url;
    document.body.appendChild(script);
  });
}

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
// SECTION 9: AUTO SYNC
// ============================================

function startAutoSync() {
  if (autoSyncInterval) clearInterval(autoSyncInterval);
  autoSyncInterval = setInterval(autoSyncData, 15000);
}

async function autoSyncData() {
  if (!hasPermission('view_appointments')) return;
  try {
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
      const syncStatus = document.getElementById('syncStatus');
      if (syncStatus) {
        syncStatus.innerHTML = `<i class="fas fa-check-circle"></i> Synced at ${getBangladeshFormattedTime()}`;
        syncStatus.style.opacity = '1';
        setTimeout(() => { if (syncStatus) syncStatus.style.opacity = '0'; }, 2000);
      }
      if (document.getElementById('appointmentsPage')?.classList.contains('active')) loadAllAppointmentsList();
    }
  } catch (error) {
    console.error('Auto sync error:', error);
  }
}

function refreshAllData() { 
  loadAllData(); 
  loadDoctors(); 
  loadServices(); 
  showToast('Data refreshed successfully!', 'success'); 
}

// ============================================
// SECTION 10: LOAD APPOINTMENTS
// ============================================

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
  } else {
    showToast('Could not load data from server', 'error');
  }
}

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
// SECTION 11: ALL APPOINTMENTS LIST
// ============================================

function loadAllAppointmentsList() {
  if (!hasPermission('view_appointments')) return;
  const container = document.getElementById('allAppointmentsList');
  if (!container) return;
  
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

function goToPageNum(page) { 
  currentPage = page; 
  loadAllAppointmentsList(); 
}

function filterAppointments() { 
  currentPage = 1; 
  loadAllAppointmentsList(); 
}

// ============================================
// SECTION 12: VIEW APPOINTMENT
// ============================================

function viewAppointment(bookingId) {
  const app = allAppointments.find(a => a.bookingId === bookingId);
  if (!app) {
    showToast('Appointment not found!', 'error');
    return;
  }
  
  const modal = document.getElementById('viewAppointmentModal');
  const detailsDiv = document.getElementById('appointmentDetails');
  
  if (!modal || !detailsDiv) return;
  
  detailsDiv.innerHTML = `
    <div class="appointment-full-details" style="padding: 10px;">
      <div><strong>🆔 Token:</strong> ${app.token}</div>
      <div><strong>📅 Date:</strong> ${app.date}</div>
      <div><strong>⏰ Time:</strong> ${app.time}</div>
      <div><strong>🐾 Pet Name:</strong> ${escapeHtml(app.petName)}</div>
      <div><strong>🎂 Pet Age:</strong> ${app.petAge || 'N/A'}</div>
      <div><strong>⚖️ Weight:</strong> ${app.weight || 'N/A'} kg</div>
      <div><strong>👤 Owner Name:</strong> ${escapeHtml(app.ownerName)}</div>
      <div><strong>📞 Phone:</strong> ${app.ownerPhone}</div>
      <div><strong>📋 Symptoms:</strong> ${escapeHtml(app.symptoms || 'N/A')}</div>
      <div><strong>🩺 Diagnosis:</strong> ${escapeHtml(app.diagnosis || 'N/A')}</div>
      <div><strong>💊 Prescription:</strong> ${escapeHtml(app.prescription || 'N/A')}</div>
      <div><strong>✅ Status:</strong> <span class="status ${app.status === 'Completed' ? 'completed' : 'confirmed'}">${app.status || 'Confirmed'}</span></div>
    </div>
  `;
  
  modal.classList.add('show');
  modal.style.display = 'flex';
  window.currentViewBookingId = bookingId;
}

function closeViewAppointmentModal() {
  const modal = document.getElementById('viewAppointmentModal');
  if (modal) {
    modal.classList.remove('show');
    modal.style.display = 'none';
  }
}

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
// SECTION 13: DELETE APPOINTMENT
// ============================================

async function hardDeleteAppointment(bookingId) {
  if (confirm('⚠️ PERMANENT DELETE: This will remove the appointment from all records. Continue?')) {
    const appointmentToDelete = allAppointments.find(a => a.bookingId === bookingId);
    
    await postToAPI({ action: 'deleteBooking', bookingId: bookingId });
    
    allAppointments = allAppointments.filter(a => a.bookingId !== bookingId);
    
    const bookings = {};
    allAppointments.forEach(a => {
      if (!bookings[a.date]) bookings[a.date] = [];
      bookings[a.date].push(a.timeSlot);
    });
    localStorage.setItem('vet_bookings', JSON.stringify(bookings));
    
    refreshAllData();
    
    if (document.getElementById('appointmentsPage')?.classList.contains('active')) {
      setTimeout(() => loadAllAppointmentsList(), 100);
    }
    
    updateDashboardStats();
    loadRecentAppointments();
    updateQuickStats();
    
    const today = getBangladeshDate();
    const todayCount = allAppointments.filter(a => a.date === today).length;
    const badge = document.getElementById('appointmentBadge');
    if (badge) badge.innerText = todayCount;
    
    const totalRecords = document.getElementById('totalRecords');
    if (totalRecords) totalRecords.innerText = allAppointments.length;
    
    if (appointmentToDelete) {
      showToast(`✅ Appointment for "${appointmentToDelete.petName}" deleted successfully!`, 'success');
    } else {
      showToast(`✅ Appointment deleted successfully!`, 'success');
    }
    
    closeViewAppointmentModal();
  }
}

// ============================================
// SECTION 14: DOCTOR MANAGEMENT
// ============================================

function loadDoctors() {
  if (!hasPermission('manage_doctors')) return;
  const stored = localStorage.getItem('clinic_doctors');
  doctors = stored ? JSON.parse(stored) : [];
  localStorage.setItem('clinic_doctors', JSON.stringify(doctors));
  renderDoctors();
}

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
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn-secondary" onclick="openEditDoctorModal(${doc.id})"><i class="fas fa-edit"></i> Edit</button>
          <button class="btn-danger" onclick="deleteDoctor(${doc.id})"><i class="fas fa-trash-alt"></i> Delete</button>
        </div>
      </div>
    </div>
  `).join('');
}

function showAddDoctorModal() { 
  const m = document.getElementById('addDoctorModal'); 
  if(m) { 
    m.classList.add('show'); 
    m.style.display = 'flex'; 
  } 
}

function closeAddDoctorModal() { 
  const m = document.getElementById('addDoctorModal'); 
  if(m) { 
    m.classList.remove('show'); 
    m.style.display = 'none'; 
    document.querySelectorAll('#addDoctorModal input').forEach(inp => inp.value = '');
  } 
}

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

function closeEditDoctorModal() { 
  const m = document.getElementById('editDoctorModal'); 
  if(m) { 
    m.classList.remove('show'); 
    m.style.display = 'none'; 
  } 
}

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

function deleteDoctor(id) { 
  if (confirm('⚠️ Delete this doctor permanently?')) { 
    doctors = doctors.filter(d => d.id !== id); 
    localStorage.setItem('clinic_doctors', JSON.stringify(doctors)); 
    renderDoctors(); 
    showToast('🗑️ Doctor deleted', 'success'); 
  } 
}

// ============================================
// SECTION 15: SERVICES MANAGEMENT
// ============================================

function loadServices() {
  if (!hasPermission('manage_services')) return;
  const stored = localStorage.getItem('clinic_services');
  services = stored ? JSON.parse(stored) : [];
  localStorage.setItem('clinic_services', JSON.stringify(services));
  renderServices();
}

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

function showAddServiceModal() { 
  const m = document.getElementById('addServiceModal'); 
  if(m) { 
    m.classList.add('show'); 
    m.style.display = 'flex'; 
  } 
}

function closeAddServiceModal() { 
  const m = document.getElementById('addServiceModal'); 
  if(m) { 
    m.classList.remove('show'); 
    m.style.display = 'none'; 
    document.querySelectorAll('#addServiceModal input, #addServiceModal textarea').forEach(inp => inp.value = '');
  } 
}

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

function closeEditServiceModal() { 
  const m = document.getElementById('editServiceModal'); 
  if(m) { 
    m.classList.remove('show'); 
    m.style.display = 'none'; 
  } 
}

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

function deleteService(id) { 
  if (confirm('⚠️ Delete this service permanently?')) { 
    services = services.filter(s => s.id !== id); 
    localStorage.setItem('clinic_services', JSON.stringify(services)); 
    renderServices(); 
    showToast('🗑️ Service deleted', 'success'); 
  } 
}

// ============================================
// SECTION 16: USER MANAGEMENT
// ============================================

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

function closeAddUserModal() { 
  const m = document.getElementById('addUserModal'); 
  if(m) { 
    m.classList.remove('show'); 
    m.style.display = 'none'; 
    document.querySelectorAll('#addUserModal input, #addUserModal select').forEach(inp => inp.value = '');
  } 
}

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

function closeEditUserModal() { 
  const m = document.getElementById('editUserModal'); 
  if(m) { 
    m.classList.remove('show'); 
    m.style.display = 'none'; 
  } 
}

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

function deleteUser(id) { 
  if (confirm('⚠️ Delete this user permanently?')) { 
    users = users.filter(u => u.id !== id); 
    localStorage.setItem('system_users', JSON.stringify(users)); 
    renderUsers(); 
    showToast('🗑️ User deleted', 'success'); 
  } 
}

// ============================================
// SECTION 17: PERMISSIONS MANAGEMENT
// ============================================

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
// SECTION 18: SETTINGS
// ============================================

function loadSettings() {
  const settings = JSON.parse(localStorage.getItem('clinic_settings') || '{}');
  const nameEl = document.getElementById('clinicName'); if(nameEl) nameEl.value = settings.clinicName || 'VET FOR PET CLINIC';
  const addressEl = document.getElementById('clinicAddress'); if(addressEl) addressEl.value = settings.clinicAddress || 'Dhaka, Bangladesh';
  const phoneEl = document.getElementById('clinicPhone'); if(phoneEl) phoneEl.value = settings.clinicPhone || '01406-779238';
  const emergencyEl = document.getElementById('clinicEmergency'); if(emergencyEl) emergencyEl.value = settings.clinicEmergency || '01609-420061';
  const emailEl = document.getElementById('clinicEmail'); if(emailEl) emailEl.value = settings.clinicEmail || 'info@vetforpet.com';
}

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
// SECTION 19: ACCESS KEY GENERATOR
// ============================================

async function generateAccessKey() {
  const role = document.getElementById('keyRole')?.value;
  const expiryDays = parseInt(document.getElementById('keyExpiry')?.value);
  
  if (!role) {
    showToast('Please select a role', 'error');
    return;
  }
  
  if (currentUserRole !== 'super_admin') {
    showPermissionDenied();
    return;
  }
  
  showToast('Generating access key...', 'info');
  
  try {
    const result = await postToAPI({
      action: 'generateAccessKey',
      role: role,
      expiryDays: expiryDays,
      createdBy: sessionStorage.getItem('admin_name') || 'Admin'
    });
    
    if (result && result.success) {
      const newAccessKeySpan = document.getElementById('newAccessKey');
      const keyRoleDisplaySpan = document.getElementById('keyRoleDisplay');
      const keyExpiryDisplaySpan = document.getElementById('keyExpiryDisplay');
      const generatedKeyDisplay = document.getElementById('generatedKeyDisplay');
      
      if (newAccessKeySpan) newAccessKeySpan.innerText = result.key;
      if (keyRoleDisplaySpan) keyRoleDisplaySpan.innerText = role;
      if (keyExpiryDisplaySpan) keyExpiryDisplaySpan.innerText = new Date(result.expiryDate).toLocaleDateString();
      if (generatedKeyDisplay) generatedKeyDisplay.style.display = 'block';
      
      showToast(`✅ Key generated successfully! Valid for ${expiryDays} days`, 'success');
      loadActiveKeys();
      
      setTimeout(() => {
        if (generatedKeyDisplay) generatedKeyDisplay.style.display = 'none';
      }, 30000);
    } else {
      showToast(result?.error || 'Failed to generate key', 'error');
    }
  } catch (error) {
    console.error('Error generating key:', error);
    showToast('Error generating access key', 'error');
  }
}

function copyAccessKey() {
  const keyText = document.getElementById('newAccessKey')?.innerText;
  if (keyText && keyText !== 'KEY-XXXX-XXXX-XXXX') {
    navigator.clipboard.writeText(keyText);
    showToast('✅ Access key copied to clipboard!', 'success');
  } else {
    showToast('No key to copy. Generate a key first.', 'error');
  }
}

async function loadActiveKeys() {
  if (currentUserRole !== 'super_admin') return;
  
  try {
    const result = await fetchFromAPI('getAllAccessKeys');
    
    if (result && result.keys) {
      displayActiveKeys(result.keys);
    } else if (result && result.error) {
      console.log('No keys found or error:', result.error);
      displayActiveKeys([]);
    }
  } catch (error) {
    console.error('Error loading keys:', error);
    displayActiveKeys([]);
  }
}

function displayActiveKeys(keys) {
  const container = document.getElementById('keysTable');
  if (!container) return;
  
  if (!keys || keys.length === 0) {
    container.innerHTML = '<div class="empty-state"><i class="fas fa-key"></i> No active access keys</div>';
    return;
  }
  
  container.innerHTML = `
    <table class="keys-table">
      <thead>
        <tr><th>Access Key</th><th>Role</th><th>Created By</th><th>Expires</th><th>Action</th></tr>
      </thead>
      <tbody>
        ${keys.map(key => `
          <tr>
            <td><code>${maskKey(key.accessKey)}</code></td>
            <td><span class="role-badge-${key.role?.toLowerCase() || 'admin'}">${key.role || 'ADMIN'}</span></td>
            <td>${escapeHtml(key.createdBy || 'Admin')}</td>
            <td>${new Date(key.expiryDate).toLocaleDateString()}</td>
            <td><button onclick="revokeKey('${key.accessKey}')" class="btn-danger-small"><i class="fas fa-trash-alt"></i> Revoke</button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function maskKey(key) {
  if (!key || key.length < 12) return key || '';
  return key.substring(0, 8) + '...' + key.substring(key.length - 4);
}

async function revokeKey(accessKeyToRevoke) {
  if (!confirm('⚠️ Revoke this access key? It will no longer work for DELETE/CANCEL operations.')) {
    return;
  }
  
  try {
    const result = await postToAPI({
      action: 'revokeAccessKey',
      accessKeyToRevoke: accessKeyToRevoke,
      revokedBy: sessionStorage.getItem('admin_name') || 'Admin'
    });
    
    if (result && result.success) {
      showToast('✅ Access key revoked successfully', 'success');
      loadActiveKeys();
    } else {
      showToast(result?.error || 'Failed to revoke key', 'error');
    }
  } catch (error) {
    console.error('Error revoking key:', error);
    showToast('Error revoking access key', 'error');
  }
}

// ============================================
// SECTION 20: BACKUP & EXPORT
// ============================================

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

function escapeCsv(str) { 
  if(!str) return ''; 
  return str.replace(/"/g, '""'); 
}

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

function triggerRestore() { 
  const rf = document.getElementById('restoreFile'); 
  if(rf) rf.click(); 
}

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
// SECTION 21: REPORTS
// ============================================

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

function createWeeklyChart() {
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    last7Days.push(date.toISOString().split('T')[0]);
  }
  const counts = last7Days.map(date => allAppointments.filter(a => a.date === date).length);
  const ctx = document.getElementById('reportChart')?.getContext('2d');
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
          <thead><tr><th>Date</th><th>Pet</th><th>Owner</th><th>Status</th></tr></thead>
          <tbody>
            ${filtered.slice(0, 20).map(a => `
              <tr><td>${a.date}</td><td>${escapeHtml(a.petName)}</td><td>${escapeHtml(a.ownerName)}</td><td><span class="status ${a.status === 'Completed' ? 'completed' : 'confirmed'}">${a.status || 'Confirmed'}</span></td></tr>
            `).join('')}
          </tbody>
        </table>
        ${filtered.length > 20 ? '<p><i class="fas fa-ellipsis-h"></i> ... and more</p>' : ''}
      </div>
    </div>
  `;
}

function printReport() {
  const container = document.getElementById('reportContainer');
  if (!container) return;
  const win = window.open('', '_blank');
  win.document.write(`<html><head><title>Report</title><style>body{font-family:Arial;padding:20px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:8px}</style></head><body>${container.innerHTML}</body></html>`);
  win.document.close(); 
  win.print();
  showToast('🖨️ Report sent to printer', 'success');
}

function printAllAppointments() {
  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html><head><title>All Appointments</title><style>table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:8px}th{background:#f97316;color:white}</style></head><body><h2><i class="fas fa-clinic-medical"></i> VET FOR PET CLINIC - All Appointments</h2><p>Generated: ${getBangladeshFormattedTime()} on ${getBangladeshDate()}</p><table><thead><tr><th>Date</th><th>Time</th><th>Pet</th><th>Owner</th><th>Token</th><th>Status</th></tr></thead><tbody>${allAppointments.map(a => `<tr><td>${a.date}</td><td>${a.time}</td><td>${escapeHtml(a.petName)}</td><td>${escapeHtml(a.ownerName)}</td><td>${a.token}</td><td><span class="status ${a.status === 'Completed' ? 'completed' : 'confirmed'}">${a.status || 'Confirmed'}</span></td></tr>`).join('')}</tbody></table></body></html>`);
  win.document.close(); 
  win.print();
  showToast('🖨️ All appointments sent to printer', 'success');
}

// ============================================
// SECTION 22: LOGOUT FUNCTIONS
// ============================================

function showLogoutModal() { 
  const modal = document.getElementById('logoutModal'); 
  if (modal) { 
    modal.classList.add('show'); 
    modal.style.display = 'flex'; 
  } 
}

function closeLogoutModal() { 
  const modal = document.getElementById('logoutModal'); 
  if (modal) { 
    modal.classList.remove('show'); 
    modal.style.display = 'none'; 
  } 
}

function confirmLogout() { 
  if (autoSyncInterval) clearInterval(autoSyncInterval); 
  sessionStorage.clear(); 
  window.location.href = 'admin-login.html'; 
}

// ============================================
// SECTION 23: UTILITY FUNCTIONS
// ============================================

function escapeHtml(text) { 
  if (!text) return ''; 
  const div = document.createElement('div'); 
  div.textContent = text; 
  return div.innerHTML; 
}

function showToast(message, type) {
  const toastId = type === 'success' ? 'successToast' : (type === 'error' ? 'errorToast' : 'infoToast');
  let toast = document.getElementById(toastId);
  if (!toast) {
    toast = document.createElement('div');
    toast.id = toastId;
    toast.className = 'toast-notification ' + (type === 'success' ? 'success' : (type === 'error' ? 'error' : 'info'));
    document.body.appendChild(toast);
  }
  const msgSpan = toast.querySelector('span');
  if (msgSpan) {
    msgSpan.innerText = message;
  } else {
    toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : (type === 'error' ? 'exclamation-circle' : 'info-circle')}"></i> <span>${message}</span>`;
  }
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}