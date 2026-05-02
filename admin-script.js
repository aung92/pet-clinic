// ============================================
// ADMIN DASHBOARD - COMPLETE SCRIPT
// Modern Edit Sections | Dynamic Popups | A to Z
// ============================================

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyL1X_hZMifdg1DKPT4lcGKIig022HceElgtrvV63VLM6gUxhiK7YbuT1l3j-9YM8a6Ng/exec";

let allAppointments = [];
let doctors = [];
let services = [];
let currentPage = 1;
let itemsPerPage = 20;
let adminChart = null;
let autoSyncInterval = null;

// ============================================
// BANGLADESH TIME ZONE
// ============================================
function getBangladeshTime() {
  const now = new Date();
  return new Date(now.getTime() + (6 * 60 * 60 * 1000));
}

function getBangladeshDate() {
  const bdTime = getBangladeshTime();
  return `${bdTime.getFullYear()}-${String(bdTime.getMonth() + 1).padStart(2, '0')}-${String(bdTime.getDate()).padStart(2, '0')}`;
}

// ============================================
// AUTHENTICATION CHECK
// ============================================
(function() {
  if (!sessionStorage.getItem('admin_logged_in')) {
    window.location.href = 'admin-login.html';
    return;
  }
  const adminName = sessionStorage.getItem('admin_name') || 'Admin';
  const adminRole = sessionStorage.getItem('admin_role') || 'Administrator';
  const welcomeName = document.getElementById('welcomeName');
  const adminNameSpan = document.getElementById('adminName');
  const adminRoleSpan = document.getElementById('adminRole');
  if (welcomeName) welcomeName.innerText = adminName;
  if (adminNameSpan) adminNameSpan.innerText = adminName;
  if (adminRoleSpan) adminRoleSpan.innerText = adminRole;
})();

// ============================================
// INITIALIZATION
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
  
  const refreshBtn = document.querySelector('.refresh-btn');
  if (refreshBtn) refreshBtn.onclick = () => refreshAllData();
  
  const reportDate = document.getElementById('reportDate');
  if (reportDate) reportDate.value = getBangladeshDate();
});

function updateDateTime() {
  const bdTime = getBangladeshTime();
  const dateElem = document.getElementById('currentDate');
  const timeElem = document.getElementById('currentTime');
  if (dateElem) dateElem.innerText = bdTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  if (timeElem) timeElem.innerText = bdTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

// ============================================
// AUTO SYNC
// ============================================
function startAutoSync() {
  if (autoSyncInterval) clearInterval(autoSyncInterval);
  autoSyncInterval = setInterval(autoSyncData, 15000);
}

async function autoSyncData() {
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

function refreshAllData() { autoSyncData(); loadDoctors(); loadServices(); showToast('Data refreshed!', 'success'); }

// ============================================
// NAVIGATION
// ============================================
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

function goToPage(pageId) {
  const navItem = document.querySelector(`.nav-item[data-page="${pageId}"]`);
  if (navItem) navItem.click();
}

// ============================================
// API CALLS
// ============================================
async function fetchFromAPI(action, params = {}) {
  try {
    let url = `${SCRIPT_URL}?action=${action}&t=${Date.now()}`;
    if (action === 'getClientBookings' && params.phone) url += `&phone=${encodeURIComponent(params.phone)}`;
    const response = await fetch(url);
    const text = await response.text();
    const jsonStr = text.match(/\((.*)\)/)[1];
    return JSON.parse(jsonStr);
  } catch (error) { console.error('API Error:', error); return null; }
}

// ============================================
// LOAD APPOINTMENTS
// ============================================
async function loadAllData() {
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
  } else { showToast('Could not load data', 'error'); }
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
    <div class="history-item" onclick="openEditAppointmentModal('${app.bookingId}')">
      <div style="display:flex;justify-content:space-between"><strong>🐾 ${escapeHtml(app.petName)}</strong><span class="token">${app.token}</span><span class="status ${getStatusClass(app.status)}">${app.status || 'Confirmed'}</span></div>
      <div>👤 ${escapeHtml(app.ownerName)} | 📞 ${app.ownerPhone} | 📅 ${app.date} | ⏰ ${app.time}</div>
    </div>
  `).join('');
}

// ============================================
// ALL APPOINTMENTS (with Edit/Delete)
// ============================================
function loadAllAppointmentsList() {
  const container = document.getElementById('allAppointmentsList');
  if (!container) return;
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
  
  if (paginated.length === 0) { container.innerHTML = '<div class="empty-state">No appointments found</div>'; }
  else {
    container.innerHTML = paginated.map(app => `
      <div class="history-item" onclick="openEditAppointmentModal('${app.bookingId}')">
        <div style="display:flex;justify-content:space-between;flex-wrap:wrap"><div><strong>🐾 ${escapeHtml(app.petName)}</strong><div style="font-size:0.8rem">📅 ${app.date} | ⏰ ${app.time}</div></div><div><span class="token">${app.token}</span><span class="status ${getStatusClass(app.status)}">${app.status || 'Confirmed'}</span></div></div>
        <div>👤 ${escapeHtml(app.ownerName)} | 📞 ${app.ownerPhone}</div>
        <div>📋 ${escapeHtml(app.symptoms || 'N/A')}${app.diagnosis ? `<br>🩺 ${escapeHtml(app.diagnosis)}` : ''}</div>
        <div style="margin-top:12px; display:flex; gap:8px;">
          <button class="btn-edit-sm" onclick="event.stopPropagation(); openEditAppointmentModal('${app.bookingId}')"><i class="fas fa-edit"></i> Edit</button>
          <button class="btn-delete-sm" onclick="event.stopPropagation(); deleteAppointment('${app.bookingId}')"><i class="fas fa-trash-alt"></i> Delete</button>
        </div>
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
  for (let i = 1; i <= Math.min(totalPages, 10); i++) html += `<button class="${i === currentPage ? 'active' : ''}" onclick="goToPageNum(${i})">${i}</button>`;
  container.innerHTML = html;
}

function goToPageNum(page) { currentPage = page; loadAllAppointmentsList(); }
function filterAppointments() { currentPage = 1; loadAllAppointmentsList(); }
function getStatusClass(status) {
  if (status === 'Completed') return 'completed';
  if (status === 'Cancelled') return 'cancelled';
  if (status === 'In Progress') return 'progress';
  return 'confirmed';
}

// ============================================
// EDIT APPOINTMENT MODAL (MODERN)
// ============================================
function openEditAppointmentModal(bookingId) {
  const app = allAppointments.find(a => a.bookingId === bookingId);
  if (!app) return;
  
  // Create modal dynamically
  const modalHtml = `
    <div id="editAppointmentModal" class="modal modern-modal show" style="display:flex">
      <div class="modal-card">
        <div class="modal-header-custom">
          <div class="modal-title-custom">
            <i class="fas fa-calendar-edit"></i>
            <h3>Edit Appointment</h3>
          </div>
          <button class="modal-close" onclick="closeEditAppointmentModal()">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body-custom">
          <div class="form-group-custom">
            <label><i class="fas fa-tag"></i> Token</label>
            <input type="text" id="editToken" class="input-custom" value="${app.token}" readonly>
          </div>
          <div class="form-group-custom">
            <label><i class="fas fa-paw"></i> Pet Name</label>
            <input type="text" id="editPetName" class="input-custom" value="${escapeHtml(app.petName)}">
          </div>
          <div class="form-group-custom">
            <label><i class="fas fa-user"></i> Owner Name</label>
            <input type="text" id="editOwnerName" class="input-custom" value="${escapeHtml(app.ownerName)}">
          </div>
          <div class="form-group-custom">
            <label><i class="fas fa-phone"></i> Phone Number</label>
            <input type="text" id="editPhone" class="input-custom" value="${app.ownerPhone}">
          </div>
          <div class="form-row-custom">
            <div class="form-group-custom">
              <label><i class="fas fa-calendar"></i> Date</label>
              <input type="date" id="editDate" class="input-custom" value="${app.date}">
            </div>
            <div class="form-group-custom">
              <label><i class="fas fa-clock"></i> Time</label>
              <input type="time" id="editTime" class="input-custom" value="${app.time}">
            </div>
          </div>
          <div class="form-group-custom">
            <label><i class="fas fa-notes-medical"></i> Symptoms</label>
            <textarea id="editSymptoms" rows="2" class="textarea-custom">${escapeHtml(app.symptoms || '')}</textarea>
          </div>
          <div class="form-group-custom">
            <label><i class="fas fa-stethoscope"></i> Diagnosis</label>
            <textarea id="editDiagnosis" rows="2" class="textarea-custom">${escapeHtml(app.diagnosis || '')}</textarea>
          </div>
          <div class="form-group-custom">
            <label><i class="fas fa-prescription-bottle"></i> Prescription</label>
            <textarea id="editPrescription" rows="3" class="textarea-custom">${escapeHtml(app.prescription || '')}</textarea>
          </div>
          <div class="form-group-custom">
            <label><i class="fas fa-flag-checkered"></i> Status</label>
            <select id="editStatus" class="input-custom">
              <option value="Confirmed" ${app.status === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
              <option value="In Progress" ${app.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
              <option value="Completed" ${app.status === 'Completed' ? 'selected' : ''}>Completed</option>
              <option value="Cancelled" ${app.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
            </select>
          </div>
        </div>
        <div class="modal-footer-custom">
          <button class="btn-secondary-custom" onclick="closeEditAppointmentModal()">Cancel</button>
          <button class="btn-primary-custom" onclick="saveEditAppointment('${bookingId}')">
            <i class="fas fa-save"></i> Save Changes
          </button>
        </div>
      </div>
    </div>
  `;
  
  // Remove existing modal if any
  const existingModal = document.getElementById('editAppointmentModal');
  if (existingModal) existingModal.remove();
  
  // Add modal to body
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closeEditAppointmentModal() {
  const modal = document.getElementById('editAppointmentModal');
  if (modal) modal.remove();
}

function saveEditAppointment(bookingId) {
  const index = allAppointments.findIndex(a => a.bookingId === bookingId);
  if (index !== -1) {
    allAppointments[index] = {
      ...allAppointments[index],
      petName: document.getElementById('editPetName')?.value || '',
      ownerName: document.getElementById('editOwnerName')?.value || '',
      ownerPhone: document.getElementById('editPhone')?.value || '',
      date: document.getElementById('editDate')?.value || '',
      time: document.getElementById('editTime')?.value || '',
      symptoms: document.getElementById('editSymptoms')?.value || '',
      diagnosis: document.getElementById('editDiagnosis')?.value || '',
      prescription: document.getElementById('editPrescription')?.value || '',
      status: document.getElementById('editStatus')?.value || 'Confirmed'
    };
    
    // Update localStorage
    const bookings = {};
    allAppointments.forEach(a => {
      if (!bookings[a.date]) bookings[a.date] = [];
      bookings[a.date].push(a.timeSlot);
    });
    localStorage.setItem('vet_bookings', JSON.stringify(bookings));
    
    closeEditAppointmentModal();
    refreshAllData();
    showToast('Appointment updated successfully!', 'success');
  }
}

function deleteAppointment(bookingId) {
  if (confirm('⚠️ Are you sure you want to delete this appointment permanently?')) {
    allAppointments = allAppointments.filter(a => a.bookingId !== bookingId);
    const bookings = {};
    allAppointments.forEach(a => {
      if (!bookings[a.date]) bookings[a.date] = [];
      bookings[a.date].push(a.timeSlot);
    });
    localStorage.setItem('vet_bookings', JSON.stringify(bookings));
    refreshAllData();
    showToast('Appointment deleted successfully!', 'success');
  }
}

// ============================================
// DOCTOR MANAGEMENT (MODERN EDIT MODAL)
// ============================================
function loadDoctors() {
  const stored = localStorage.getItem('clinic_doctors');
  doctors = stored ? JSON.parse(stored) : [{ id: 1, name: 'Dr. Mitesh Tripura', email: 'doctor@vetforpet.com', specialization: 'Senior Veterinary Surgeon', phone: '01406779238', schedule: 'Sat-Wed 9AM-9PM' }];
  localStorage.setItem('clinic_doctors', JSON.stringify(doctors));
  renderDoctors();
}

function renderDoctors() {
  const container = document.getElementById('doctorsList');
  if (!container) return;
  if (!doctors.length) { container.innerHTML = '<div class="empty-state">No doctors added</div>'; return; }
  container.innerHTML = doctors.map(doc => `
    <div class="history-item">
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap">
        <div><strong><i class="fas fa-user-md"></i> ${escapeHtml(doc.name)}</strong><div>🔬 ${escapeHtml(doc.specialization)}</div><div>📧 ${doc.email} | 📞 ${doc.phone || 'N/A'}</div><div>⏰ ${doc.schedule || 'Flexible'}</div></div>
        <div><button class="btn-edit-sm" onclick="openEditDoctorModal(${doc.id})"><i class="fas fa-edit"></i> Edit</button> <button class="btn-delete-sm" onclick="deleteDoctor(${doc.id})"><i class="fas fa-trash-alt"></i> Delete</button></div>
      </div>
    </div>
  `).join('');
}

function openEditDoctorModal(id) {
  const doctor = doctors.find(d => d.id === id);
  if (!doctor) return;
  
  const modalHtml = `
    <div id="editDoctorModalNew" class="modal modern-modal show" style="display:flex">
      <div class="modal-card">
        <div class="modal-header-custom">
          <div class="modal-title-custom">
            <i class="fas fa-user-edit"></i>
            <h3>Edit Doctor</h3>
          </div>
          <button class="modal-close" onclick="closeEditDoctorModalNew()">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body-custom">
          <div class="form-group-custom">
            <label><i class="fas fa-user"></i> Full Name</label>
            <input type="text" id="editDoctorNameNew" class="input-custom" value="${escapeHtml(doctor.name)}">
          </div>
          <div class="form-group-custom">
            <label><i class="fas fa-envelope"></i> Email</label>
            <input type="email" id="editDoctorEmailNew" class="input-custom" value="${doctor.email}">
          </div>
          <div class="form-group-custom">
            <label><i class="fas fa-stethoscope"></i> Specialization</label>
            <input type="text" id="editDoctorSpecializationNew" class="input-custom" value="${escapeHtml(doctor.specialization)}">
          </div>
          <div class="form-row-custom">
            <div class="form-group-custom">
              <label><i class="fas fa-phone"></i> Phone</label>
              <input type="text" id="editDoctorPhoneNew" class="input-custom" value="${doctor.phone || ''}">
            </div>
            <div class="form-group-custom">
              <label><i class="fas fa-calendar-alt"></i> Schedule</label>
              <input type="text" id="editDoctorScheduleNew" class="input-custom" value="${doctor.schedule || ''}">
            </div>
          </div>
          <div class="form-group-custom">
            <label><i class="fas fa-lock"></i> New Password (optional)</label>
            <input type="password" id="editDoctorPasswordNew" class="input-custom" placeholder="Leave blank to keep same">
          </div>
        </div>
        <div class="modal-footer-custom">
          <button class="btn-secondary-custom" onclick="closeEditDoctorModalNew()">Cancel</button>
          <button class="btn-primary-custom" onclick="saveEditDoctor(${doctor.id})">
            <i class="fas fa-save"></i> Save Changes
          </button>
        </div>
      </div>
    </div>
  `;
  
  const existingModal = document.getElementById('editDoctorModalNew');
  if (existingModal) existingModal.remove();
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closeEditDoctorModalNew() {
  const modal = document.getElementById('editDoctorModalNew');
  if (modal) modal.remove();
}

function saveEditDoctor(id) {
  const index = doctors.findIndex(d => d.id === id);
  if (index !== -1) {
    doctors[index] = {
      ...doctors[index],
      name: document.getElementById('editDoctorNameNew')?.value || '',
      email: document.getElementById('editDoctorEmailNew')?.value || '',
      specialization: document.getElementById('editDoctorSpecializationNew')?.value || '',
      phone: document.getElementById('editDoctorPhoneNew')?.value || '',
      schedule: document.getElementById('editDoctorScheduleNew')?.value || ''
    };
    const newPassword = document.getElementById('editDoctorPasswordNew')?.value;
    if (newPassword) doctors[index].password = newPassword;
    
    localStorage.setItem('clinic_doctors', JSON.stringify(doctors));
    renderDoctors();
    closeEditDoctorModalNew();
    showToast('Doctor updated successfully!', 'success');
  }
}

function deleteDoctor(id) {
  if (confirm('⚠️ Delete this doctor permanently?')) {
    doctors = doctors.filter(d => d.id !== id);
    localStorage.setItem('clinic_doctors', JSON.stringify(doctors));
    renderDoctors();
    showToast('Doctor deleted', 'success');
  }
}

// ============================================
// SERVICES MANAGEMENT (MODERN EDIT MODAL)
// ============================================
function loadServices() {
  const stored = localStorage.getItem('clinic_services');
  services = stored ? JSON.parse(stored) : [{ id: 1, name: 'General Checkup', icon: 'fa-stethoscope', desc: 'Complete physical exam', price: 500, duration: 30 }, { id: 2, name: 'Vaccination', icon: 'fa-syringe', desc: 'Core vaccines', price: 800, duration: 20 }, { id: 3, name: 'Dental Care', icon: 'fa-tooth', desc: 'Scaling & hygiene', price: 1000, duration: 45 }];
  localStorage.setItem('clinic_services', JSON.stringify(services));
  renderServices();
}

function renderServices() {
  const container = document.getElementById('servicesList');
  if (!container) return;
  if (!services.length) { container.innerHTML = '<div class="empty-state">No services added</div>'; return; }
  container.innerHTML = services.map(service => `
    <div class="history-item">
      <div style="display:flex;justify-content:space-between;flex-wrap:wrap">
        <div><strong><i class="fas ${service.icon}"></i> ${escapeHtml(service.name)}</strong><div>${escapeHtml(service.desc)}</div><div>💰 ৳${service.price} | ⏱️ ${service.duration} min</div></div>
        <div><button class="btn-edit-sm" onclick="openEditServiceModal(${service.id})"><i class="fas fa-edit"></i> Edit</button> <button class="btn-delete-sm" onclick="deleteService(${service.id})"><i class="fas fa-trash-alt"></i> Delete</button></div>
      </div>
    </div>
  `).join('');
}

function openEditServiceModal(id) {
  const service = services.find(s => s.id === id);
  if (!service) return;
  
  const modalHtml = `
    <div id="editServiceModalNew" class="modal modern-modal show" style="display:flex">
      <div class="modal-card">
        <div class="modal-header-custom">
          <div class="modal-title-custom">
            <i class="fas fa-edit"></i>
            <h3>Edit Service</h3>
          </div>
          <button class="modal-close" onclick="closeEditServiceModalNew()">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body-custom">
          <div class="form-group-custom">
            <label><i class="fas fa-tag"></i> Service Name</label>
            <input type="text" id="editServiceNameNew" class="input-custom" value="${escapeHtml(service.name)}">
          </div>
          <div class="form-group-custom">
            <label><i class="fas fa-icons"></i> Icon</label>
            <input type="text" id="editServiceIconNew" class="input-custom" value="${service.icon}">
          </div>
          <div class="form-group-custom">
            <label><i class="fas fa-align-left"></i> Description</label>
            <textarea id="editServiceDescNew" rows="3" class="textarea-custom">${escapeHtml(service.desc)}</textarea>
          </div>
          <div class="form-row-custom">
            <div class="form-group-custom">
              <label><i class="fas fa-money-bill-wave"></i> Price (BDT)</label>
              <input type="number" id="editServicePriceNew" class="input-custom" value="${service.price}">
            </div>
            <div class="form-group-custom">
              <label><i class="fas fa-hourglass-half"></i> Duration (mins)</label>
              <input type="number" id="editServiceDurationNew" class="input-custom" value="${service.duration}">
            </div>
          </div>
        </div>
        <div class="modal-footer-custom">
          <button class="btn-secondary-custom" onclick="closeEditServiceModalNew()">Cancel</button>
          <button class="btn-primary-custom" onclick="saveEditService(${service.id})">
            <i class="fas fa-save"></i> Save Changes
          </button>
        </div>
      </div>
    </div>
  `;
  
  const existingModal = document.getElementById('editServiceModalNew');
  if (existingModal) existingModal.remove();
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closeEditServiceModalNew() {
  const modal = document.getElementById('editServiceModalNew');
  if (modal) modal.remove();
}

function saveEditService(id) {
  const index = services.findIndex(s => s.id === id);
  if (index !== -1) {
    services[index] = {
      ...services[index],
      name: document.getElementById('editServiceNameNew')?.value || '',
      icon: document.getElementById('editServiceIconNew')?.value || 'fa-stethoscope',
      desc: document.getElementById('editServiceDescNew')?.value || '',
      price: parseInt(document.getElementById('editServicePriceNew')?.value) || 0,
      duration: parseInt(document.getElementById('editServiceDurationNew')?.value) || 30
    };
    
    localStorage.setItem('clinic_services', JSON.stringify(services));
    renderServices();
    closeEditServiceModalNew();
    showToast('Service updated successfully!', 'success');
  }
}

function deleteService(id) {
  if (confirm('⚠️ Delete this service permanently?')) {
    services = services.filter(s => s.id !== id);
    localStorage.setItem('clinic_services', JSON.stringify(services));
    renderServices();
    showToast('Service deleted', 'success');
  }
}

// ============================================
// ADD FUNCTIONS (Modern Modals)
// ============================================
function showAddDoctorModal() {
  const modalHtml = `
    <div id="addDoctorModalNew" class="modal modern-modal show" style="display:flex">
      <div class="modal-card">
        <div class="modal-header-custom">
          <div class="modal-title-custom">
            <i class="fas fa-user-md"></i>
            <h3>Add New Doctor</h3>
          </div>
          <button class="modal-close" onclick="closeAddDoctorModalNew()">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body-custom">
          <div class="form-group-custom"><label><i class="fas fa-user"></i> Full Name</label><input type="text" id="newDoctorNameNew" class="input-custom" placeholder="Dr. John Doe"></div>
          <div class="form-group-custom"><label><i class="fas fa-envelope"></i> Email</label><input type="email" id="newDoctorEmailNew" class="input-custom" placeholder="doctor@vetforpet.com"></div>
          <div class="form-group-custom"><label><i class="fas fa-lock"></i> Password</label><input type="password" id="newDoctorPasswordNew" class="input-custom" placeholder="Enter password"></div>
          <div class="form-group-custom"><label><i class="fas fa-stethoscope"></i> Specialization</label><input type="text" id="newDoctorSpecializationNew" class="input-custom" placeholder="Cardiology, Surgery"></div>
          <div class="form-row-custom"><div class="form-group-custom"><label><i class="fas fa-phone"></i> Phone</label><input type="text" id="newDoctorPhoneNew" class="input-custom" placeholder="01XXXXXXXXX"></div><div class="form-group-custom"><label><i class="fas fa-calendar-alt"></i> Schedule</label><input type="text" id="newDoctorScheduleNew" class="input-custom" placeholder="Sat-Wed 9AM-5PM"></div></div>
        </div>
        <div class="modal-footer-custom">
          <button class="btn-secondary-custom" onclick="closeAddDoctorModalNew()">Cancel</button>
          <button class="btn-primary-custom" onclick="addDoctorNew()"><i class="fas fa-plus"></i> Add Doctor</button>
        </div>
      </div>
    </div>
  `;
  
  const existingModal = document.getElementById('addDoctorModalNew');
  if (existingModal) existingModal.remove();
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closeAddDoctorModalNew() {
  const modal = document.getElementById('addDoctorModalNew');
  if (modal) modal.remove();
}

function addDoctorNew() {
  const newDoctor = {
    id: Date.now(),
    name: document.getElementById('newDoctorNameNew')?.value || '',
    email: document.getElementById('newDoctorEmailNew')?.value || '',
    password: document.getElementById('newDoctorPasswordNew')?.value || '',
    specialization: document.getElementById('newDoctorSpecializationNew')?.value || '',
    phone: document.getElementById('newDoctorPhoneNew')?.value || '',
    schedule: document.getElementById('newDoctorScheduleNew')?.value || ''
  };
  
  if (!newDoctor.name || !newDoctor.email) {
    showToast('Please fill required fields', 'error');
    return;
  }
  
  doctors.push(newDoctor);
  localStorage.setItem('clinic_doctors', JSON.stringify(doctors));
  renderDoctors();
  closeAddDoctorModalNew();
  showToast('Doctor added successfully!', 'success');
}

function showAddServiceModal() {
  const modalHtml = `
    <div id="addServiceModalNew" class="modal modern-modal show" style="display:flex">
      <div class="modal-card">
        <div class="modal-header-custom">
          <div class="modal-title-custom">
            <i class="fas fa-stethoscope"></i>
            <h3>Add New Service</h3>
          </div>
          <button class="modal-close" onclick="closeAddServiceModalNew()">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="modal-body-custom">
          <div class="form-group-custom"><label><i class="fas fa-tag"></i> Service Name</label><input type="text" id="newServiceNameNew" class="input-custom" placeholder="e.g., General Checkup"></div>
          <div class="form-group-custom"><label><i class="fas fa-icons"></i> Icon</label><input type="text" id="newServiceIconNew" class="input-custom" placeholder="fa-stethoscope"></div>
          <div class="form-group-custom"><label><i class="fas fa-align-left"></i> Description</label><textarea id="newServiceDescNew" rows="3" class="textarea-custom" placeholder="Service description..."></textarea></div>
          <div class="form-row-custom"><div class="form-group-custom"><label><i class="fas fa-money-bill-wave"></i> Price (BDT)</label><input type="number" id="newServicePriceNew" class="input-custom" placeholder="0"></div><div class="form-group-custom"><label><i class="fas fa-hourglass-half"></i> Duration (mins)</label><input type="number" id="newServiceDurationNew" class="input-custom" placeholder="30"></div></div>
        </div>
        <div class="modal-footer-custom">
          <button class="btn-secondary-custom" onclick="closeAddServiceModalNew()">Cancel</button>
          <button class="btn-primary-custom" onclick="addServiceNew()"><i class="fas fa-plus"></i> Add Service</button>
        </div>
      </div>
    </div>
  `;
  
  const existingModal = document.getElementById('addServiceModalNew');
  if (existingModal) existingModal.remove();
  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closeAddServiceModalNew() {
  const modal = document.getElementById('addServiceModalNew');
  if (modal) modal.remove();
}

function addServiceNew() {
  const newService = {
    id: Date.now(),
    name: document.getElementById('newServiceNameNew')?.value || '',
    icon: document.getElementById('newServiceIconNew')?.value || 'fa-stethoscope',
    desc: document.getElementById('newServiceDescNew')?.value || '',
    price: parseInt(document.getElementById('newServicePriceNew')?.value) || 0,
    duration: parseInt(document.getElementById('newServiceDurationNew')?.value) || 30
  };
  
  if (!newService.name) {
    showToast('Please enter service name', 'error');
    return;
  }
  
  services.push(newService);
  localStorage.setItem('clinic_services', JSON.stringify(services));
  renderServices();
  closeAddServiceModalNew();
  showToast('Service added successfully!', 'success');
}

// ============================================
// SETTINGS (Already have functions)
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
  const settings = { clinicName: document.getElementById('clinicName')?.value || '', clinicAddress: document.getElementById('clinicAddress')?.value || '', clinicPhone: document.getElementById('clinicPhone')?.value || '', clinicEmergency: document.getElementById('clinicEmergency')?.value || '', clinicEmail: document.getElementById('clinicEmail')?.value || '' };
  localStorage.setItem('clinic_settings', JSON.stringify(settings));
  showToast('Settings saved', 'success');
}

function loadSlotConfig() {
  const defaultConfig = { Saturday: { start: 9, end: 21 }, Sunday: { start: 9, end: 15 }, Monday: { start: 9, end: 15 }, Tuesday: { start: 9, end: 21 }, Wednesday: { start: 9, end: 15 }, Thursday: { start: 9, end: 15 }, Friday: { start: 9, end: 15 } };
  const config = JSON.parse(localStorage.getItem('slot_config') || JSON.stringify(defaultConfig));
  const container = document.getElementById('slotConfig');
  if (!container) return;
  container.innerHTML = Object.entries(config).map(([day, cfg]) => `<div class="slot-item"><label>${day}</label><input type="number" id="${day}_start" value="${cfg.start}" min="0" max="23" class="slot-input"> - <input type="number" id="${day}_end" value="${cfg.end}" min="0" max="23" class="slot-input"></div>`).join('');
}

function saveSlotConfig() {
  const newConfig = {};
  const days = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  days.forEach(day => { const startEl = document.getElementById(`${day}_start`); const endEl = document.getElementById(`${day}_end`); newConfig[day] = { start: startEl ? parseInt(startEl.value) || 9 : 9, end: endEl ? parseInt(endEl.value) || 17 : 17 }; });
  localStorage.setItem('slot_config', JSON.stringify(newConfig));
  showToast('Slot config saved', 'success');
}

function loadPricing() {
  const pricing = JSON.parse(localStorage.getItem('service_pricing') || '{}');
  const container = document.getElementById('pricingConfig');
  if (!container) return;
  if (services.length > 0) { container.innerHTML = services.map(service => `<div class="slot-item"><label>${escapeHtml(service.name)}</label><input type="number" id="price_${service.id}" value="${pricing[service.id] || service.price || 500}" class="price-input" min="0"></div>`).join(''); }
  else { container.innerHTML = '<p>Add services first</p>'; }
}

function savePricing() {
  const pricing = {};
  services.forEach(service => { const priceInput = document.getElementById(`price_${service.id}`); if(priceInput) pricing[service.id] = parseInt(priceInput.value) || 0; });
  localStorage.setItem('service_pricing', JSON.stringify(pricing));
  showToast('Pricing saved', 'success');
}

// ============================================
// BACKUP & EXPORT
// ============================================
function exportToCSV() {
  if (!allAppointments.length) { showToast('No data to export', 'error'); return; }
  let csv = "Date,Time,Token,Pet Name,Owner Name,Phone,Symptoms,Diagnosis,Prescription,Status\n";
  allAppointments.forEach(a => { csv += `"${a.date}","${a.time}","${a.token}","${escapeCsv(a.petName)}","${escapeCsv(a.ownerName)}","${a.ownerPhone}","${escapeCsv(a.symptoms||'')}","${escapeCsv(a.diagnosis||'')}","${escapeCsv(a.prescription||'')}","${a.status||'Confirmed'}"\n`; });
  const blob = new Blob([csv], { type: 'text/csv' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `appointments_${getBangladeshDate()}.csv`;
  link.click();
  showToast('CSV exported', 'success');
}

function escapeCsv(str) { if(!str) return ''; return str.replace(/"/g, '""'); }

function backupData() {
  const backup = { appointments: allAppointments, doctors: doctors, services: services, settings: localStorage.getItem('clinic_settings'), slotConfig: localStorage.getItem('slot_config'), pricing: localStorage.getItem('service_pricing'), date: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `backup_${getBangladeshDate()}.json`;
  link.click();
  localStorage.setItem('lastBackup', new Date().toLocaleString());
  const lastBackupSpan = document.getElementById('lastBackup');
  if (lastBackupSpan) lastBackupSpan.innerText = new Date().toLocaleString();
  showToast('Backup downloaded', 'success');
}

function triggerRestore() { const rf = document.getElementById('restoreFile'); if(rf) rf.click(); }
document.getElementById('restoreFile')?.addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(ev) {
    try {
      const data = JSON.parse(ev.target.result);
      if (data.appointments) { const bookings = {}; data.appointments.forEach(a => { if (!bookings[a.date]) bookings[a.date] = []; bookings[a.date].push(a.timeSlot); }); localStorage.setItem('vet_bookings', JSON.stringify(bookings)); allAppointments = data.appointments; refreshAllData(); }
      if (data.doctors) { localStorage.setItem('clinic_doctors', JSON.stringify(data.doctors)); doctors = data.doctors; renderDoctors(); }
      if (data.services) { localStorage.setItem('clinic_services', JSON.stringify(data.services)); services = data.services; renderServices(); }
      if (data.settings) localStorage.setItem('clinic_settings', data.settings);
      if (data.slotConfig) localStorage.setItem('slot_config', data.slotConfig);
      if (data.pricing) localStorage.setItem('service_pricing', data.pricing);
      showToast('Restore successful!', 'success');
      setTimeout(() => location.reload(), 1500);
    } catch(err) { showToast('Invalid backup', 'error'); }
  };
  reader.readAsText(file);
});

// ============================================
// REPORTS
// ============================================
function updateReportStats() {
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
  for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); last7Days.push(d.toISOString().split('T')[0]); }
  const counts = last7Days.map(d => allAppointments.filter(a => a.date === d).length);
  const ctx = document.getElementById('weeklyChart')?.getContext('2d');
  if (!ctx) return;
  if (adminChart) adminChart.destroy();
  adminChart = new Chart(ctx, { type: 'bar', data: { labels: last7Days.map(d => new Date(d).toLocaleDateString('en-US', { weekday: 'short' })), datasets: [{ label: 'Appointments', data: counts, backgroundColor: '#f97316', borderRadius: 8 }] }, options: { responsive: true, plugins: { legend: { display: false } } } });
}

async function loadReport() {
  const type = document.getElementById('reportType')?.value || 'daily';
  const date = document.getElementById('reportDate')?.value || getBangladeshDate();
  let filtered = allAppointments;
  let title = '';
  if (type === 'daily') { filtered = allAppointments.filter(a => a.date === date); title = `Daily Report - ${date}`; }
  else if (type === 'weekly') { const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7); filtered = allAppointments.filter(a => new Date(a.date) >= weekAgo); title = 'Weekly Report'; }
  else if (type === 'monthly') { const monthAgo = new Date(); monthAgo.setMonth(monthAgo.getMonth() - 1); filtered = allAppointments.filter(a => new Date(a.date) >= monthAgo); title = 'Monthly Report'; }
  else { const yearAgo = new Date(); yearAgo.setFullYear(yearAgo.getFullYear() - 1); filtered = allAppointments.filter(a => new Date(a.date) >= yearAgo); title = 'Yearly Report'; }
  const container = document.getElementById('reportContainer');
  if (!container) return;
  container.innerHTML = `<div class="report-summary"><h3>${title}</h3><p>Total: ${filtered.length} | Completed: ${filtered.filter(a => a.status === 'Completed').length} | Pending: ${filtered.filter(a => a.status !== 'Completed').length}</p><div class="report-list"><table class="report-table"><thead><tr><th>Date</th><th>Pet</th><th>Owner</th><th>Status</th></tr></thead><tbody>${filtered.slice(0,20).map(a => `<tr><td>${a.date}</td><td>${escapeHtml(a.petName)}</td><td>${escapeHtml(a.ownerName)}</td><td>${a.status || 'Confirmed'}</td></tr>`).join('')}</tbody></table>${filtered.length > 20 ? '<p>... and more</p>' : ''}</div></div>`;
}

function printReport() {
  const container = document.getElementById('reportContainer');
  if (!container) return;
  const win = window.open('', '_blank');
  win.document.write(`<html><head><title>Report</title><style>body{font-family:Arial;padding:20px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:8px}</style></head><body>${container.innerHTML}</body></html>`);
  win.document.close(); win.print();
}

function printAllAppointments() {
  const win = window.open('', '_blank');
  win.document.write(`<html><head><title>All Appointments</title><style>table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:8px}th{background:#f97316;color:white}</style></head><body><h2>VET FOR PET CLINIC - All Appointments</h2><p>Generated: ${new Date().toLocaleString()}</p><td><thead><tr><th>Date</th><th>Time</th><th>Pet</th><th>Owner</th><th>Token</th><th>Status</th></tr></thead><tbody>${allAppointments.map(a => `<tr><td>${a.date}</td><td>${a.time}</td><td>${escapeHtml(a.petName)}</td><td>${escapeHtml(a.ownerName)}</td><td>${a.token}</td><td>${a.status || 'Confirmed'}</td></tr>`).join('')}</tbody></table></body></html>`);
  win.document.close(); win.print();
}

// ============================================
// MODAL FUNCTIONS (Logout, View)
// ============================================
function showLogoutModal() { const m = document.getElementById('logoutModal'); if(m) { m.classList.add('show'); m.style.display = 'flex'; } }
function closeLogoutModal() { const m = document.getElementById('logoutModal'); if(m) { m.classList.remove('show'); m.style.display = 'none'; } }
function confirmLogout() { if (autoSyncInterval) clearInterval(autoSyncInterval); sessionStorage.clear(); window.location.href = 'admin-login.html'; }

function viewAppointment(bookingId) {
  const app = allAppointments.find(a => a.bookingId === bookingId);
  if (!app) return;
  const modal = document.getElementById('viewAppointmentModal');
  const detailsDiv = document.getElementById('appointmentDetails');
  if (!modal || !detailsDiv) return;
  detailsDiv.innerHTML = `
    <div class="appointment-full-details">
      <div class="detail-row"><strong>🆔 Token:</strong> ${app.token}</div>
      <div class="detail-row"><strong>📅 Date:</strong> ${app.date}</div>
      <div class="detail-row"><strong>⏰ Time:</strong> ${app.time}</div>
      <div class="detail-row"><strong>🐾 Pet Name:</strong> ${escapeHtml(app.petName)}</div>
      <div class="detail-row"><strong>🎂 Pet Age:</strong> ${app.petAge || 'N/A'}</div>
      <div class="detail-row"><strong>⚖️ Weight:</strong> ${app.weight || 'N/A'} kg</div>
      <div class="detail-row"><strong>👤 Owner Name:</strong> ${escapeHtml(app.ownerName)}</div>
      <div class="detail-row"><strong>📞 Phone:</strong> ${app.ownerPhone}</div>
      <div class="detail-row"><strong>📋 Symptoms:</strong> ${escapeHtml(app.symptoms || 'N/A')}</div>
      <div class="detail-row"><strong>🩺 Diagnosis:</strong> ${escapeHtml(app.diagnosis || 'N/A')}</div>
      <div class="detail-row"><strong>💊 Prescription:</strong><br>${escapeHtml(app.prescription || 'N/A')}</div>
      <div class="detail-row"><strong>📝 Treatment Plan:</strong> ${escapeHtml(app.treatmentPlan || 'N/A')}</div>
      <div class="detail-row"><strong>📅 Follow-up Date:</strong> ${app.followUpDate || 'N/A'}</div>
      <div class="detail-row"><strong>✅ Status:</strong> <span class="status ${getStatusClass(app.status)}">${app.status || 'Confirmed'}</span></div>
    </div>
  `;
  modal.classList.add('show');
  modal.style.display = 'flex';
  window.currentViewBookingId = bookingId;
}

function closeViewAppointmentModal() { const m = document.getElementById('viewAppointmentModal'); if(m) { m.classList.remove('show'); m.style.display = 'none'; } }
function deleteAppointmentFromModal() { deleteAppointment(window.currentViewBookingId); closeViewAppointmentModal(); }

// ============================================
// UTILITIES
// ============================================
function escapeHtml(t) { if(!t) return ''; const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

function showToast(msg, type) {
  let toast = document.getElementById('toast');
  if (!toast) { toast = document.createElement('div'); toast.id = 'toast'; toast.className = 'toast-notification'; document.body.appendChild(toast); toast.style.cssText = 'position:fixed;bottom:30px;right:30px;padding:12px 24px;border-radius:50px;color:white;z-index:9999;transition:0.3s'; }
  toast.style.background = type === 'success' ? '#15803d' : '#ef4444';
  toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${msg}`;
  toast.style.transform = 'translateX(0)';
  setTimeout(() => { if(toast) toast.style.transform = 'translateX(400px)'; }, 3000);
}