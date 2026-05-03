// ============================================
// RECEPTION DASHBOARD - COMPLETE SCRIPT
// Role: Receptionist (VIEW ONLY + NEW BOOKING)
// Version: 2.0 | Last Updated: 2026
// ============================================

// ============================================
// SECTION 1: CONFIGURATION & GLOBAL VARIABLES
// ============================================

// Google Apps Script URL for backend API
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxxFwjqxDdC7uWqjF0CGbzYCHyZ1jZM_jsXz7P1FnNIANsAPpccZfvktQrFLrag3N1P/exec";

// Global state variables
let allAppointments = [];
let currentPage = 1;
let itemsPerPage = 20;
let receptionChart = null;
let autoSyncInterval = null;
let selectedTimeSlot = null;

// ============================================
// SECTION 2: BANGLADESH TIME ZONE FUNCTIONS
// ============================================

/**
 * বাংলাদেশ সময় রিটার্ন করে
 */
function getBangladeshTime() {
  const now = new Date();
  const utcTime = now.getTime();
  const bangladeshOffsetMs = 6 * 60 * 60 * 1000;
  const bangladeshMs = utcTime + bangladeshOffsetMs;
  return new Date(bangladeshMs);
}

/**
 * বাংলাদেশ তারিখ রিটার্ন করে (YYYY-MM-DD ফরম্যাটে)
 */
function getBangladeshDate() {
  const bdTime = getBangladeshTime();
  return `${bdTime.getUTCFullYear()}-${String(bdTime.getUTCMonth() + 1).padStart(2, '0')}-${String(bdTime.getUTCDate()).padStart(2, '0')}`;
}

/**
 * বাংলাদেশ সময় রিটার্ন করে (ফরম্যাটেড)
 */
function getBangladeshFormattedTime() {
  const bdTime = getBangladeshTime();
  let hours = bdTime.getUTCHours();
  const minutes = bdTime.getUTCMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const minutesStr = String(minutes).padStart(2, '0');
  return `${hours}:${minutesStr} ${ampm}`;
}

// ============================================
// SECTION 3: JSONP API HELPER FUNCTIONS
// ============================================

/**
 * JSONP রিকোয়েস্ট হেল্পার (CORS সমস্যা সমাধানের জন্য)
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

/**
 * API থেকে ডাটা ফেচ করে
 */
async function fetchFromAPI(action, params = {}) {
  try {
    return await jsonpRequest(action, params);
  } catch (error) {
    console.error('API Error:', error);
    showToast('Network error. Please check your connection.', 'error');
    return null;
  }
}

/**
 * POST রিকোয়েস্ট পাঠায় (নতুন বুকিংয়ের জন্য)
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

// ============================================
// SECTION 4: AUTHENTICATION CHECK
// ============================================

/**
 * লগইন চেক করে - শুধু রিসেপশনিস্ট রোল allowed
 */
(function() {
  const adminLoggedIn = sessionStorage.getItem('admin_logged_in');
  const adminRole = sessionStorage.getItem('admin_role');
  
  if (!adminLoggedIn || adminLoggedIn !== 'true') {
    window.location.href = 'admin-login.html';
    return;
  }
  
  if (adminRole !== 'receptionist') {
    console.warn('Access denied: Not a receptionist');
    window.location.href = 'admin-login.html?error=access_denied';
    return;
  }
  
  const adminName = sessionStorage.getItem('admin_name') || 'Receptionist';
  document.getElementById('welcomeName').innerText = adminName;
  document.getElementById('adminName').innerText = adminName;
  document.getElementById('adminRole').innerText = 'Receptionist';
  document.getElementById('userRoleBadge').innerText = 'Receptionist';
  
  loadAllData();
  setupNavigation();
  updateDateTime();
  setInterval(updateDateTime, 1000);
  loadProfileData();
  loadProfileImage();
  setupImageUpload();
  startAutoSync();
})();

// ============================================
// SECTION 5: NAVIGATION SETUP
// ============================================

/**
 * নেভিগেশন মেনু সেটআপ করে
 */
function setupNavigation() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
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
    });
  });
}

/**
 * নির্দিষ্ট পেজে নেভিগেট করে
 */
function goToPage(pageId) {
  const navItem = document.querySelector(`.nav-item[data-page="${pageId}"]`);
  if (navItem) navItem.click();
}

// ============================================
// SECTION 6: DATE & TIME UPDATE
// ============================================

/**
 * ডেট এবং টাইম আপডেট করে (প্রতি সেকেন্ডে)
 */
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
// SECTION 7: AUTO SYNC
// ============================================

/**
 * অটো সিঙ্ক স্টার্ট করে (প্রতি ১৫ সেকেন্ডে)
 */
function startAutoSync() {
  if (autoSyncInterval) clearInterval(autoSyncInterval);
  autoSyncInterval = setInterval(autoSyncData, 15000);
}

/**
 * ডাটা অটো সিঙ্ক করে
 */
async function autoSyncData() {
  try {
    const data = await fetchFromAPI('getAppointments');
    if (data && data.appointments) {
      allAppointments = data.appointments;
      updateDashboardStats();
      loadRecentAppointments();
      
      const today = getBangladeshDate();
      const todayCount = allAppointments.filter(a => a.date === today).length;
      const badge = document.getElementById('appointmentBadge');
      if (badge) badge.innerText = todayCount;
      
      const syncStatus = document.getElementById('syncStatus');
      if (syncStatus) {
        syncStatus.innerHTML = `<i class="fas fa-check-circle"></i> Synced at ${getBangladeshFormattedTime()}`;
        syncStatus.style.opacity = '1';
        setTimeout(() => { if (syncStatus) syncStatus.style.opacity = '0'; }, 2000);
      }
      
      if (document.getElementById('appointmentsPage')?.classList.contains('active')) {
        loadAllAppointmentsList();
      }
    }
  } catch (error) {
    console.error('Auto sync error:', error);
  }
}

// ============================================
// SECTION 8: REFRESH FUNCTIONS
// ============================================

/**
 * সব ডাটা রিফ্রেশ করে
 */
async function refreshAllData() {
  await loadAllData();
  showToast('Data refreshed successfully!', 'success');
}

/**
 * সব ডাটা লোড করে
 */
async function loadAllData() {
  const data = await fetchFromAPI('getAppointments');
  if (data && data.appointments) {
    allAppointments = data.appointments;
    updateDashboardStats();
    loadRecentAppointments();
    
    const today = getBangladeshDate();
    const todayCount = allAppointments.filter(a => a.date === today).length;
    const badge = document.getElementById('appointmentBadge');
    if (badge) badge.innerText = todayCount;
    
    if (document.getElementById('appointmentsPage')?.classList.contains('active')) {
      loadAllAppointmentsList();
    }
  } else {
    showToast('Could not load data from server', 'error');
  }
}

// ============================================
// SECTION 9: DASHBOARD STATS
// ============================================

/**
 * ড্যাশবোর্ডের স্ট্যাটিস্টিক্স আপডেট করে
 */
function updateDashboardStats() {
  const today = getBangladeshDate();
  const todayApps = allAppointments.filter(a => a.date === today);
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weeklyApps = allAppointments.filter(a => new Date(a.date) >= weekAgo);
  const monthAgo = new Date();
  monthAgo.setMonth(monthAgo.getMonth() - 1);
  const monthlyApps = allAppointments.filter(a => new Date(a.date) >= monthAgo);
  const uniquePets = [...new Set(allAppointments.map(a => a.petName))];
  const todayCompleted = todayApps.filter(a => a.status === 'Completed').length;
  const pendingApps = allAppointments.filter(a => a.status !== 'Completed');
  
  const totalToday = document.getElementById('totalToday');
  const totalWeekly = document.getElementById('totalWeekly');
  const totalMonthly = document.getElementById('totalMonthly');
  const totalPets = document.getElementById('totalPets');
  const todayCompletedElem = document.getElementById('todayCompleted');
  const pendingCountElem = document.getElementById('pendingCount');
  
  if (totalToday) totalToday.innerText = todayApps.length;
  if (totalWeekly) totalWeekly.innerText = weeklyApps.length;
  if (totalMonthly) totalMonthly.innerText = monthlyApps.length;
  if (totalPets) totalPets.innerText = uniquePets.length;
  if (todayCompletedElem) todayCompletedElem.innerText = todayCompleted;
  if (pendingCountElem) pendingCountElem.innerText = pendingApps.length;
}

/**
 * সাম্প্রতিক অ্যাপয়েন্টমেন্ট লোড করে
 */
function loadRecentAppointments() {
  const container = document.getElementById('recentAppointments');
  if (!container) return;
  
  const recent = [...allAppointments]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 5);
  
  if (recent.length === 0) {
    container.innerHTML = '<div class="empty-state">No appointments yet</div>';
    return;
  }
  
  container.innerHTML = recent.map(app => `
    <div class="history-item" onclick="viewAppointment('${app.bookingId}')" style="cursor:pointer">
      <div style="display:flex; justify-content:space-between; flex-wrap:wrap;">
        <div>
          <strong><i class="fas fa-paw"></i> ${escapeHtml(app.petName)}</strong>
          <div style="font-size:0.75rem; color: #64748b;">${app.date} | ${app.time}</div>
        </div>
        <span class="status-badge ${getStatusClass(app.status)}">
          ${app.status || 'Confirmed'}
        </span>
      </div>
      <div style="margin-top: 8px; font-size:0.85rem;">
        👤 ${escapeHtml(app.ownerName)} | 📞 ${app.ownerPhone}
      </div>
    </div>
  `).join('');
}

/**
 * স্ট্যাটাস অনুযায়ী CSS ক্লাস রিটার্ন করে
 */
function getStatusClass(status) {
  if (status === 'Completed') return 'completed';
  if (status === 'Cancelled') return 'cancelled';
  if (status === 'In Progress') return 'progress';
  return 'confirmed';
}

// ============================================
// SECTION 10: ALL APPOINTMENTS LIST (VIEW ONLY)
// ============================================

/**
 * সব অ্যাপয়েন্টমেন্ট লোড করে (ফিল্টার + পেজিনেশন সহ) - রিয়েল টাইম সার্চ
 */
async function loadAllAppointmentsList() {
  const container = document.getElementById('allAppointmentsList');
  if (!container) return;
  
  container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading appointments...</div>';
  
  // রিয়েল টাইম সার্চ টেক্সট
  const filterText = document.getElementById('filterInput')?.value.toLowerCase() || '';
  const statusFilter = document.getElementById('statusFilter')?.value || 'all';
  const dateFilter = document.getElementById('dateFilter')?.value || 'all';
  
  let filtered = [...allAppointments];
  
  // রিয়েল টাইম টেক্সট ফিল্টার
  if (filterText) {
    filtered = filtered.filter(a => 
      a.petName?.toLowerCase().includes(filterText) ||
      a.ownerName?.toLowerCase().includes(filterText) ||
      a.ownerPhone?.toString().includes(filterText) ||
      a.token?.toLowerCase().includes(filterText)
    );
  }
  
  // স্ট্যাটাস ফিল্টার
  if (statusFilter !== 'all') {
    filtered = filtered.filter(a => a.status === statusFilter);
  }
  
  // ডেট ফিল্টার
  const today = getBangladeshDate();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date();
  monthAgo.setMonth(monthAgo.getMonth() - 1);
  
  switch(dateFilter) {
    case 'today': filtered = filtered.filter(a => a.date === today); break;
    case 'tomorrow': filtered = filtered.filter(a => a.date === tomorrowStr); break;
    case 'week': filtered = filtered.filter(a => new Date(a.date) >= weekAgo); break;
    case 'month': filtered = filtered.filter(a => new Date(a.date) >= monthAgo); break;
  }
  
  // সর্টিং (নতুন থেকে পুরনো)
  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  // পেজিনেশন
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  
  if (paginated.length === 0) {
    container.innerHTML = '<div class="empty-state"><i class="fas fa-inbox"></i> No appointments found</div>';
  } else {
    container.innerHTML = paginated.map(app => `
      <div class="history-item" onclick="viewAppointment('${app.bookingId}')" style="cursor:pointer">
        <div style="display:flex; justify-content:space-between; flex-wrap:wrap; margin-bottom: 8px;">
          <div>
            <strong><i class="fas fa-paw"></i> ${escapeHtml(app.petName)}</strong>
            <div style="font-size:0.75rem; color: #64748b;">📅 ${app.date} | ⏰ ${app.time}</div>
          </div>
          <div>
            <span class="token">${app.token}</span>
            <span class="status-badge ${getStatusClass(app.status)}" style="margin-left: 8px;">
              ${app.status || 'Confirmed'}
            </span>
          </div>
        </div>
        <div style="margin-bottom: 4px;">👤 ${escapeHtml(app.ownerName)} | 📞 ${app.ownerPhone}</div>
        ${app.symptoms ? `<div style="font-size:0.8rem; color: #64748b;">📋 ${escapeHtml(app.symptoms.substring(0, 60))}${app.symptoms.length > 60 ? '...' : ''}</div>` : ''}
      </div>
    `).join('');
  }
  
  renderPagination(totalPages);
}

/**
 * পেজিনেশন রেন্ডার করে
 */
function renderPagination(totalPages) {
  const container = document.getElementById('pagination');
  if (!container) return;
  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }
  
  let html = '';
  for (let i = 1; i <= Math.min(totalPages, 10); i++) {
    html += `<button class="${i === currentPage ? 'active' : ''}" onclick="goToPageNum(${i})">📄 ${i}</button>`;
  }
  container.innerHTML = html;
}

/**
 * নির্দিষ্ট পেজে যায়
 */
function goToPageNum(page) {
  currentPage = page;
  loadAllAppointmentsList();
}

/**
 * ফিল্টার প্রয়োগ করে (পেজিনেশন রিসেট সহ) - রিয়েল টাইম সার্চের জন্য
 */
function filterAppointments() {
  currentPage = 1;
  loadAllAppointmentsList();
}

// ============================================
// SECTION 11: VIEW APPOINTMENT (VIEW ONLY)
// ============================================

/**
 * অ্যাপয়েন্টমেন্টের বিস্তারিত দেখায় (এডিট/ডিলিট বাটন ছাড়া)
 */
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
    <div style="padding: 10px;">
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
        <div><strong><i class="fas fa-ticket-alt"></i> Token:</strong> ${app.token}</div>
        <div><strong><i class="fas fa-calendar-alt"></i> Date:</strong> ${app.date}</div>
        <div><strong><i class="fas fa-clock"></i> Time:</strong> ${app.time}</div>
        <div><strong><i class="fas fa-paw"></i> Pet Name:</strong> ${escapeHtml(app.petName)}</div>
        <div><strong><i class="fas fa-birthday-cake"></i> Pet Age:</strong> ${app.petAge || 'N/A'}</div>
        <div><strong><i class="fas fa-weight"></i> Weight:</strong> ${app.weight || 'N/A'} kg</div>
        <div><strong><i class="fas fa-user"></i> Owner:</strong> ${escapeHtml(app.ownerName)}</div>
        <div><strong><i class="fas fa-phone"></i> Phone:</strong> ${app.ownerPhone}</div>
      </div>
      <div style="margin-bottom: 12px;">
        <strong><i class="fas fa-stethoscope"></i> Symptoms:</strong><br>
        <div style="background: #f1f5f9; padding: 10px; border-radius: 8px; margin-top: 5px;">${escapeHtml(app.symptoms || 'N/A')}</div>
      </div>
      ${app.diagnosis ? `<div style="margin-bottom: 12px;"><strong><i class="fas fa-diagnoses"></i> Diagnosis:</strong><br><div style="background: #f1f5f9; padding: 10px; border-radius: 8px; margin-top: 5px;">${escapeHtml(app.diagnosis)}</div></div>` : ''}
      ${app.prescription ? `<div style="margin-bottom: 12px;"><strong><i class="fas fa-prescription-bottle"></i> Prescription:</strong><br><div style="background: #f1f5f9; padding: 10px; border-radius: 8px; margin-top: 5px;">${escapeHtml(app.prescription)}</div></div>` : ''}
      <div><strong><i class="fas fa-flag-checkered"></i> Status:</strong> <span class="status-badge ${getStatusClass(app.status)}">${app.status || 'Confirmed'}</span></div>
    </div>
  `;
  
  window.currentViewBookingId = bookingId;
  modal.classList.add('show');
  modal.style.display = 'flex';
}

/**
 * ভিউ মডাল বন্ধ করে
 */
function closeViewAppointmentModal() {
  const modal = document.getElementById('viewAppointmentModal');
  if (modal) {
    modal.classList.remove('show');
    modal.style.display = 'none';
  }
}

/**
 * অ্যাপয়েন্টমেন্ট ডিটেইলস প্রিন্ট করে
 */
function printAppointmentDetails() {
  const details = document.getElementById('appointmentDetails')?.innerHTML;
  if (!details) return;
  
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Appointment Details</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        .header { text-align: center; margin-bottom: 20px; }
        .details { border: 1px solid #ccc; padding: 20px; border-radius: 10px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>VET FOR PET CLINIC</h2>
        <p>Dhaka, Bangladesh | 01609-420061</p>
        <hr>
      </div>
      <div class="details">${details}</div>
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
}

// ============================================
// SECTION 12: NEW BOOKING MODAL
// ============================================

/**
 * নিউ বুকিং মডাল খোলে
 */
function openNewBookingModal() {
  const modal = document.getElementById('newBookingModal');
  if (!modal) return;
  
  const dateInput = document.getElementById('newBookingDate');
  if (dateInput) {
    dateInput.value = getBangladeshDate();
    dateInput.min = getBangladeshDate();
    loadTimeSlotsForDate(dateInput.value);
  }
  
  document.getElementById('newPetName').value = '';
  document.getElementById('newPetAge').value = '';
  document.getElementById('newOwnerName').value = '';
  document.getElementById('newOwnerPhone').value = '';
  document.getElementById('newSymptoms').value = '';
  document.getElementById('newServiceType').value = 'General Consultation';
  selectedTimeSlot = null;
  
  modal.classList.add('show');
  modal.style.display = 'flex';
}

/**
 * নিউ বুকিং মডাল বন্ধ করে
 */
function closeNewBookingModal() {
  const modal = document.getElementById('newBookingModal');
  if (modal) {
    modal.classList.remove('show');
    modal.style.display = 'none';
  }
}

/**
 * নির্দিষ্ট ডেটের জন্য টাইম স্লট লোড করে
 */
async function loadTimeSlotsForDate(date) {
  const container = document.getElementById('timeSlotContainer');
  if (!container) return;
  
  const slots = [];
  for (let hour = 9; hour <= 20; hour++) {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    slots.push(`${displayHour}:00 ${ampm}`);
    slots.push(`${displayHour}:30 ${ampm}`);
  }
  
  const bookedForDate = allAppointments.filter(a => a.date === date).map(a => a.time);
  
  container.innerHTML = slots.map(slot => `
    <div class="time-slot ${bookedForDate.includes(slot) ? 'booked' : ''}" 
         data-time="${slot}"
         onclick="${!bookedForDate.includes(slot) ? `selectTimeSlot('${slot}')` : ''}">
      ${slot}
    </div>
  `).join('');
}

/**
 * টাইম স্লট সিলেক্ট করে
 */
function selectTimeSlot(time) {
  document.querySelectorAll('.time-slot').forEach(slot => {
    slot.classList.remove('selected');
  });
  
  const selectedDiv = document.querySelector(`.time-slot[data-time="${time}"]`);
  if (selectedDiv) {
    selectedDiv.classList.add('selected');
    selectedTimeSlot = time;
  }
}

/**
 * নতুন বুকিং ক্রিয়েট করে
 */
async function createNewBooking() {
  const petName = document.getElementById('newPetName').value.trim();
  const ownerName = document.getElementById('newOwnerName').value.trim();
  const ownerPhone = document.getElementById('newOwnerPhone').value.trim();
  const bookingDate = document.getElementById('newBookingDate').value;
  
  if (!petName) { showToast('Please enter pet name', 'error'); return; }
  if (!ownerName) { showToast('Please enter owner name', 'error'); return; }
  if (!ownerPhone) { showToast('Please enter phone number', 'error'); return; }
  if (!bookingDate) { showToast('Please select a date', 'error'); return; }
  if (!selectedTimeSlot) { showToast('Please select a time slot', 'error'); return; }
  
  const alreadyBooked = allAppointments.some(a => a.date === bookingDate && a.time === selectedTimeSlot);
  if (alreadyBooked) {
    showToast('This time slot is already booked!', 'error');
    return;
  }
  
  const token = `T${String(allAppointments.length + 1).padStart(3, '0')}`;
  const bookingId = `BK${Date.now()}`;
  
  const newAppointment = {
    bookingId: bookingId,
    token: token,
    date: bookingDate,
    time: selectedTimeSlot,
    petName: petName,
    petAge: document.getElementById('newPetAge').value.trim() || 'N/A',
    ownerName: ownerName,
    ownerPhone: ownerPhone,
    symptoms: document.getElementById('newSymptoms').value.trim() || 'N/A',
    serviceType: document.getElementById('newServiceType').value,
    status: 'Confirmed',
    timestamp: new Date().toISOString()
  };
  
  const saveBtn = document.querySelector('#newBookingModal .btn-primary-custom');
  const originalText = saveBtn.innerHTML;
  saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Booking...';
  saveBtn.disabled = true;
  
  try {
    await postToAPI({
      action: 'saveBooking',
      bookingData: newAppointment
    });
    
    allAppointments.unshift(newAppointment);
    
    const bookings = JSON.parse(localStorage.getItem('vet_bookings') || '{}');
    if (!bookings[bookingDate]) bookings[bookingDate] = [];
    bookings[bookingDate].push(selectedTimeSlot);
    localStorage.setItem('vet_bookings', JSON.stringify(bookings));
    
    showToast('✅ Appointment booked successfully!', 'success');
    closeNewBookingModal();
    refreshAllData();
    
  } catch (error) {
    console.error('Booking error:', error);
    showToast('Failed to book appointment', 'error');
  } finally {
    saveBtn.innerHTML = originalText;
    saveBtn.disabled = false;
  }
}

// ডেট পরিবর্তনে টাইম স্লট রিলোড
document.addEventListener('DOMContentLoaded', function() {
  const dateInput = document.getElementById('newBookingDate');
  if (dateInput) {
    dateInput.addEventListener('change', function() {
      loadTimeSlotsForDate(this.value);
    });
  }
});

// ============================================
// SECTION 13: REPORTS & CHARTS
// ============================================

/**
 * উইকলি চার্ট তৈরি করে
 */
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
  
  if (receptionChart) receptionChart.destroy();
  
  receptionChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: last7Days.map(d => new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })),
      datasets: [{
        label: '📊 Appointments',
        data: counts,
        backgroundColor: '#f97316',
        borderRadius: 8,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => `${ctx.raw} appointments` } }
      }
    }
  });
}

/**
 * রিপোর্ট লোড করে
 */
async function loadReport() {
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
  }
  
  const container = document.getElementById('reportContainer');
  if (!container) return;
  
  const completed = filtered.filter(a => a.status === 'Completed').length;
  const pending = filtered.filter(a => a.status !== 'Completed').length;
  
  container.innerHTML = `
    <div class="report-summary">
      <h3><i class="fas fa-chart-line"></i> ${title}</h3>
      <p><i class="fas fa-calendar"></i> Total: ${filtered.length} | 
         <i class="fas fa-check-circle"></i> Completed: ${completed} | 
         <i class="fas fa-clock"></i> Pending: ${pending}</p>
      <div class="report-list">
        <table class="report-table">
          <thead>
            <tr><th>Date</th><th>Pet</th><th>Owner</th><th>Phone</th><th>Status</th></tr>
          </thead>
          <tbody>
            ${filtered.slice(0, 20).map(a => `
              <tr>
                <td>${a.date}</td>
                <td><i class="fas fa-paw"></i> ${escapeHtml(a.petName)}</td>
                <td><i class="fas fa-user"></i> ${escapeHtml(a.ownerName)}</td>
                <td>${a.ownerPhone}</td>
                <td><span class="status-badge ${getStatusClass(a.status)}">${a.status || 'Confirmed'}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        ${filtered.length > 20 ? '<p><i class="fas fa-ellipsis-h"></i> ... and more</p>' : ''}
      </div>
    </div>
  `;
}

/**
 * রিপোর্ট প্রিন্ট করে
 */
function printReport() {
  const container = document.getElementById('reportContainer');
  if (!container) return;
  
  const win = window.open('', '_blank');
  win.document.write(`
    <html>
    <head>
      <title>Appointment Report</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
        th { background: #f97316; color: white; }
      </style>
    </head>
    <body>${container.innerHTML}</body>
    </html>
  `);
  win.document.close();
  win.print();
}

/**
 * রিপোর্ট স্ট্যাট্স আপডেট করে
 */
function updateReportStats() {
  // চার্ট আপডেটের জন্য (খালি রাখা হয়েছে)
}

// ============================================
// SECTION 14: PROFILE MANAGEMENT
// ============================================

/**
 * প্রোফাইল ডাটা লোড করে
 */
function loadProfileData() {
  const profileName = document.getElementById('profileName');
  const profileEmail = document.getElementById('profileEmail');
  const profileRole = document.getElementById('profileRole');
  const profilePhone = document.getElementById('profilePhone');
  const profileJoined = document.getElementById('profileJoined');
  
  if (profileName) profileName.innerText = sessionStorage.getItem('admin_name') || 'Receptionist';
  if (profileEmail) profileEmail.innerText = sessionStorage.getItem('admin_email') || 'reception@vetforpet.com';
  if (profileRole) profileRole.innerText = 'Receptionist';
  if (profilePhone) profilePhone.innerText = sessionStorage.getItem('admin_phone') || '01XXXXXXXXX';
  if (profileJoined) profileJoined.innerText = '2024';
}

/**
 * প্রোফাইল ইমেজ লোড করে
 */
function loadProfileImage() {
  const savedImage = localStorage.getItem('reception_profile_image');
  const avatarImg = document.getElementById('profileAvatarImg');
  const avatarIcon = document.getElementById('avatarIcon');
  const editAvatarImg = document.getElementById('editAvatarImg');
  const editAvatarIcon = document.getElementById('editAvatarIcon');
  
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
 * ইমেজ আপলোড সেটআপ করে
 */
function setupImageUpload() {
  const fileInput = document.getElementById('profileImageUpload');
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
      const editAvatarImg = document.getElementById('editAvatarImg');
      const editAvatarIcon = document.getElementById('editAvatarIcon');
      if (editAvatarImg) {
        editAvatarImg.src = imageData;
        editAvatarImg.style.display = 'block';
        if (editAvatarIcon) editAvatarIcon.style.display = 'none';
      }
      const profileAvatarImg = document.getElementById('profileAvatarImg');
      const avatarIcon = document.getElementById('avatarIcon');
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

/**
 * অ্যাভাটার আপলোড মডাল খোলে
 */
function openAvatarUploadModal() {
  const fileInput = document.getElementById('profileImageUpload');
  if (fileInput) fileInput.click();
  else showToast('Image upload feature coming soon!', 'info');
}

/**
 * প্রোফাইল ইমেজ রিমুভ করে
 */
function removeProfileImage() {
  if (confirm('Are you sure you want to remove your profile picture?')) {
    const editAvatarImg = document.getElementById('editAvatarImg');
    const editAvatarIcon = document.getElementById('editAvatarIcon');
    const profileAvatarImg = document.getElementById('profileAvatarImg');
    const avatarIcon = document.getElementById('avatarIcon');
    
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

/**
 * এডিট প্রোফাইল মডাল খোলে
 */
function openEditProfileModal() {
  const editName = document.getElementById('editProfileName');
  const editEmail = document.getElementById('editProfileEmail');
  const editPhone = document.getElementById('editProfilePhone');
  const editPassword = document.getElementById('editProfilePassword');
  
  if (editName) editName.value = sessionStorage.getItem('admin_name') || '';
  if (editEmail) editEmail.value = sessionStorage.getItem('admin_email') || '';
  if (editPhone) editPhone.value = sessionStorage.getItem('admin_phone') || '';
  if (editPassword) editPassword.value = '';
  
  const savedImage = localStorage.getItem('reception_profile_image');
  const editAvatarImg = document.getElementById('editAvatarImg');
  const editAvatarIcon = document.getElementById('editAvatarIcon');
  
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
  
  const modal = document.getElementById('editProfileModal');
  if (modal) {
    modal.classList.add('show');
    modal.style.display = 'flex';
  }
}

/**
 * এডিট প্রোফাইল মডাল বন্ধ করে
 */
function closeEditProfileModal() {
  const modal = document.getElementById('editProfileModal');
  if (modal) {
    modal.classList.remove('show');
    modal.style.display = 'none';
  }
}

/**
 * প্রোফাইল চেইঞ্জ সেভ করে
 */
function saveProfileChanges() {
  const newName = document.getElementById('editProfileName')?.value || '';
  const newEmail = document.getElementById('editProfileEmail')?.value || '';
  const newPhone = document.getElementById('editProfilePhone')?.value || '';
  const newPassword = document.getElementById('editProfilePassword')?.value || '';
  const newImage = window.tempProfileImage || null;
  
  if (!newName || !newEmail) {
    showToast('Please fill required fields', 'error');
    return;
  }
  
  sessionStorage.setItem('admin_name', newName);
  sessionStorage.setItem('admin_email', newEmail);
  sessionStorage.setItem('admin_phone', newPhone);
  if (newPassword) sessionStorage.setItem('admin_password', newPassword);
  
  if (newImage) {
    localStorage.setItem('reception_profile_image', newImage);
    window.tempProfileImage = null;
  }
  
  const users = JSON.parse(localStorage.getItem('system_users') || '[]');
  const currentEmail = sessionStorage.getItem('admin_email');
  const index = users.findIndex(u => u.email === currentEmail);
  if (index !== -1) {
    users[index].name = newName;
    users[index].email = newEmail;
    users[index].phone = newPhone;
    if (newPassword) users[index].password = newPassword;
    if (newImage) users[index].profileImage = newImage;
    localStorage.setItem('system_users', JSON.stringify(users));
  }
  
  loadProfileData();
  loadProfileImage();
  
  const welcomeName = document.getElementById('welcomeName');
  const adminNameSpan = document.getElementById('adminName');
  if (welcomeName) welcomeName.innerText = newName;
  if (adminNameSpan) adminNameSpan.innerText = newName;
  
  closeEditProfileModal();
  showToast('Profile updated successfully!', 'success');
}

// ============================================
// SECTION 15: EXPORT FUNCTIONS
// ============================================

/**
 * CSV এক্সপোর্ট করে
 */
function exportToCSV() {
  if (!allAppointments.length) {
    showToast('No data to export', 'error');
    return;
  }
  
  let csv = "Date,Time,Token,Pet Name,Owner Name,Phone,Symptoms,Status,Diagnosis,Prescription\n";
  allAppointments.forEach(a => {
    csv += `"${a.date}","${a.time}","${a.token}","${escapeCsv(a.petName)}","${escapeCsv(a.ownerName)}","${a.ownerPhone}","${escapeCsv(a.symptoms || '')}","${a.status || 'Confirmed'}","${escapeCsv(a.diagnosis || '')}","${escapeCsv(a.prescription || '')}"\n`;
  });
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `appointments_${getBangladeshDate()}.csv`;
  link.click();
  showToast('CSV exported successfully!', 'success');
}

/**
 * CSV ফরম্যাটিং ইউটিলিটি
 */
function escapeCsv(str) {
  if (!str) return '';
  return str.replace(/"/g, '""');
}

/**
 * সব অ্যাপয়েন্টমেন্ট প্রিন্ট করে
 */
function printAllAppointments() {
  if (!allAppointments.length) {
    showToast('No appointments to print', 'error');
    return;
  }
  
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>All Appointments</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        table { border-collapse: collapse; width: 100%; }
        th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
        th { background: #f97316; color: white; }
      </style>
    </head>
    <body>
      <h2>VET FOR PET CLINIC - All Appointments</h2>
      <p>Generated on: ${new Date().toLocaleString()}</p>
      <tr>
        <thead>
          <tr><th>Date</th><th>Time</th><th>Pet</th><th>Owner</th><th>Phone</th><th>Token</th><th>Status</th></tr>
        </thead>
        <tbody>
          ${allAppointments.map(a => `
            <tr>
              <td>${a.date}</td>
              <td>${a.time}</td>
              <td>${escapeHtml(a.petName)}</td>
              <td>${escapeHtml(a.ownerName)}</td>
              <td>${a.ownerPhone}</td>
              <td>${a.token}</td>
              <td>${a.status || 'Confirmed'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
}

// ============================================
// SECTION 16: LOGOUT FUNCTIONS
// ============================================

/**
 * লগআউট মডাল দেখায়
 */
function showLogoutModal() {
  const modal = document.getElementById('logoutModal');
  if (modal) {
    modal.classList.add('show');
    modal.style.display = 'flex';
  }
}

/**
 * লগআউট মডাল বন্ধ করে
 */
function closeLogoutModal() {
  const modal = document.getElementById('logoutModal');
  if (modal) {
    modal.classList.remove('show');
    modal.style.display = 'none';
  }
}

/**
 * লগআউট কনফার্মেশন
 */
function confirmLogout() {
  if (autoSyncInterval) clearInterval(autoSyncInterval);
  sessionStorage.clear();
  window.location.href = 'admin-login.html';
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
// SECTION 17: UTILITY FUNCTIONS
// ============================================

/**
 * HTML এস্কেপ ফাংশন (XSS প্রোটেকশন)
 */
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * টোস্ট নোটিফিকেশন দেখায়
 */
function showToast(message, type) {
  const toastId = type === 'success' ? 'successToast' : 'errorToast';
  let toast = document.getElementById(toastId);
  if (!toast) {
    toast = document.createElement('div');
    toast.id = toastId;
    toast.className = 'toast-notification ' + (type === 'success' ? 'success' : 'error');
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
// SECTION 18: MODAL CLOSE EVENT SETUP
// ============================================

document.addEventListener('DOMContentLoaded', function() {
  const closeButtons = document.querySelectorAll('.modal-close, .close-modal');
  closeButtons.forEach(btn => {
    btn.onclick = function() {
      closeNewBookingModal();
      closeViewAppointmentModal();
      closeLogoutModal();
      closeEditProfileModal();
    };
  });
  
  window.onclick = function(e) {
    if (e.target.classList && e.target.classList.contains('modal')) {
      closeNewBookingModal();
      closeViewAppointmentModal();
      closeLogoutModal();
      closeEditProfileModal();
    }
  };
  
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      closeNewBookingModal();
      closeViewAppointmentModal();
      closeLogoutModal();
      closeEditProfileModal();
    }
  });
});

// ============================================
// SECTION 19: HIDDEN IFRAME FOR POST
// ============================================
(function() {
  if (!document.querySelector('#hidden_iframe')) {
    const iframe = document.createElement('iframe');
    iframe.name = 'hidden_iframe';
    iframe.id = 'hidden_iframe';
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
  }
})();