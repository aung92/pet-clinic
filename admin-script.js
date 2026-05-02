// ============================================
// ADMIN DASHBOARD - COMPLETE SCRIPT
// A to Z Workable | All Features Enabled
// ============================================

// ============================================
// CONFIGURATION
// ============================================
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyL1X_hZMifdg1DKPT4lcGKIig022HceElgtrvV63VLM6gUxhiK7YbuT1l3j-9YM8a6Ng/exec";

// Global Variables
let allAppointments = [];
let doctors = [];
let services = [];
let currentPage = 1;
let itemsPerPage = 20;
let reportChart = null;

// ============================================
// AUTHENTICATION CHECK
// ============================================
(function() {
  const isLoggedIn = sessionStorage.getItem('admin_logged_in');
  if (!isLoggedIn || isLoggedIn !== 'true') {
    window.location.href = 'admin-login.html';
    return;
  }
  
  const adminName = sessionStorage.getItem('admin_name') || 'Admin';
  const adminRole = sessionStorage.getItem('admin_role') || 'Administrator';
  
  document.getElementById('welcomeName').innerText = adminName;
  document.getElementById('adminName').innerText = adminName;
  document.getElementById('adminRole').innerText = adminRole;
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
  
  // Setup date picker for reports
  const reportDate = document.getElementById('reportDate');
  if (reportDate) {
    reportDate.value = new Date().toISOString().split('T')[0];
  }
});

// Live Date & Time
function updateDateTime() {
  const now = new Date();
  document.getElementById('currentDate').innerText = now.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  });
  document.getElementById('currentTime').innerText = now.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit'
  });
}

// ============================================
// NAVIGATION
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
      document.getElementById(page + 'Page').classList.add('active');
      
      const pageTitle = item.querySelector('span')?.innerText || page;
      document.getElementById('pageTitle').innerText = pageTitle;
      
      // Load page-specific data
      if (page === 'appointments') loadAllAppointmentsList();
      if (page === 'reports') loadReport();
    });
  });
}

function goToPage(pageId) {
  const navItem = document.querySelector(`.nav-item[data-page="${pageId}"]`);
  if (navItem) navItem.click();
}

function refreshAllData() {
  loadAllData();
  loadAllAppointmentsList();
  showToast('All data refreshed successfully!', 'success');
}

// ============================================
// API CALLS (Google Sheets)
// ============================================
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

// ============================================
// LOAD APPOINTMENTS DATA
// ============================================
async function loadAllData() {
  showToast('Loading data...', 'info');
  
  const data = await fetchFromAPI('getAppointments');
  if (data && data.appointments) {
    allAppointments = data.appointments;
    updateDashboardStats();
    loadRecentAppointments();
    updateQuickStats();
    
    // Update appointment badge
    const today = new Date().toISOString().split('T')[0];
    const todayCount = allAppointments.filter(a => a.date === today).length;
    const badge = document.getElementById('appointmentBadge');
    if (badge) badge.innerText = todayCount;
    
    // Update total records in backup page
    document.getElementById('totalRecords').innerText = allAppointments.length;
  }
  
  showToast('Data loaded successfully!', 'success');
}

function updateDashboardStats() {
  const today = new Date().toISOString().split('T')[0];
  const todayApps = allAppointments.filter(a => a.date === today);
  
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weeklyApps = allAppointments.filter(a => new Date(a.date) >= weekAgo);
  
  const monthAgo = new Date();
  monthAgo.setMonth(monthAgo.getMonth() - 1);
  const monthlyApps = allAppointments.filter(a => new Date(a.date) >= monthAgo);
  
  const uniquePets = [...new Set(allAppointments.map(a => a.petName))];
  const completedApps = allAppointments.filter(a => a.status === 'Completed');
  const pendingApps = allAppointments.filter(a => a.status === 'Confirmed' || a.status === 'In Progress');
  
  document.getElementById('totalToday').innerText = todayApps.length;
  document.getElementById('totalWeekly').innerText = weeklyApps.length;
  document.getElementById('totalMonthly').innerText = monthlyApps.length;
  document.getElementById('totalPets').innerText = uniquePets.length;
  document.getElementById('totalCompleted').innerText = completedApps.length;
  document.getElementById('totalPending').innerText = pendingApps.length;
}

function updateQuickStats() {
  // Calculate total revenue (assuming each appointment = 500 BDT average)
  const totalRevenue = allAppointments.length * 500;
  document.getElementById('totalRevenue').innerText = totalRevenue.toLocaleString();
  
  // Completion rate
  const completed = allAppointments.filter(a => a.status === 'Completed').length;
  const completionRate = allAppointments.length > 0 ? Math.round((completed / allAppointments.length) * 100) : 0;
  document.getElementById('completionRate').innerText = completionRate;
  
  // Active doctors count
  document.getElementById('activeDoctors').innerText = doctors.length || 1;
}

function loadRecentAppointments() {
  const container = document.getElementById('recentAppointments');
  const recent = [...allAppointments]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 5);
  
  if (recent.length === 0) {
    container.innerHTML = '<div class="empty-state">No appointments yet</div>';
    return;
  }
  
  container.innerHTML = recent.map(app => `
    <div class="history-item" onclick="viewAppointment('${app.bookingId}')">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <strong>🐾 ${escapeHtml(app.petName)}</strong>
          <div style="font-size: 0.8rem; color: #64748b;">📅 ${app.date} | ⏰ ${app.time}</div>
        </div>
        <div>
          <span class="token">${app.token}</span>
          <span class="status ${getStatusClass(app.status)}">${app.status || 'Confirmed'}</span>
        </div>
      </div>
      <div style="margin-top: 8px;">
        👤 ${escapeHtml(app.ownerName)} | 📞 ${app.ownerPhone}
      </div>
    </div>
  `).join('');
}

// ============================================
// ALL APPOINTMENTS LIST (with Pagination & Filters)
// ============================================
function loadAllAppointmentsList() {
  const filterText = document.getElementById('filterInput')?.value.toLowerCase() || '';
  const statusFilter = document.getElementById('statusFilter')?.value || 'all';
  const dateFilter = document.getElementById('dateFilter')?.value || 'all';
  
  let filtered = [...allAppointments];
  
  // Apply text filter
  if (filterText) {
    filtered = filtered.filter(a => 
      a.petName.toLowerCase().includes(filterText) ||
      a.ownerName.toLowerCase().includes(filterText) ||
      a.ownerPhone.includes(filterText) ||
      a.token.toLowerCase().includes(filterText)
    );
  }
  
  // Apply status filter
  if (statusFilter !== 'all') {
    filtered = filtered.filter(a => a.status === statusFilter);
  }
  
  // Apply date filter
  const today = new Date().toISOString().split('T')[0];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  
  const monthAgo = new Date();
  monthAgo.setMonth(monthAgo.getMonth() - 1);
  
  switch(dateFilter) {
    case 'today':
      filtered = filtered.filter(a => a.date === today);
      break;
    case 'tomorrow':
      filtered = filtered.filter(a => a.date === tomorrowStr);
      break;
    case 'week':
      filtered = filtered.filter(a => new Date(a.date) >= weekAgo);
      break;
    case 'month':
      filtered = filtered.filter(a => new Date(a.date) >= monthAgo);
      break;
  }
  
  // Sort by date (newest first)
  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  // Pagination
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const start = (currentPage - 1) * itemsPerPage;
  const paginated = filtered.slice(start, start + itemsPerPage);
  
  // Render appointments
  const container = document.getElementById('allAppointmentsList');
  if (paginated.length === 0) {
    container.innerHTML = '<div class="empty-state">No appointments found</div>';
  } else {
    container.innerHTML = paginated.map(app => `
      <div class="history-item" onclick="viewAppointment('${app.bookingId}')">
        <div style="display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
          <div>
            <strong>🐾 ${escapeHtml(app.petName)}</strong>
            <div style="font-size: 0.8rem; color: #64748b;">📅 ${app.date} | ⏰ ${app.time}</div>
          </div>
          <div>
            <span class="token">${app.token}</span>
            <span class="status ${getStatusClass(app.status)}">${app.status || 'Confirmed'}</span>
          </div>
        </div>
        <div style="margin: 8px 0;">
          👤 ${escapeHtml(app.ownerName)} | 📞 ${app.ownerPhone}
        </div>
        <div style="font-size: 0.85rem;">
          📋 Symptoms: ${escapeHtml(app.symptoms || 'N/A')}
          ${app.diagnosis ? `<br>🩺 Diagnosis: ${escapeHtml(app.diagnosis)}` : ''}
        </div>
      </div>
    `).join('');
  }
  
  // Render pagination
  renderPagination(totalPages);
}

function renderPagination(totalPages) {
  const container = document.getElementById('pagination');
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

function goToPageNum(page) {
  currentPage = page;
  loadAllAppointmentsList();
}

function filterAppointments() {
  currentPage = 1;
  loadAllAppointmentsList();
}

function getStatusClass(status) {
  if (status === 'Completed') return 'completed';
  if (status === 'Cancelled') return 'cancelled';
  if (status === 'In Progress') return 'progress';
  return 'confirmed';
}

// ============================================
// VIEW, EDIT, DELETE APPOINTMENT
// ============================================
function viewAppointment(bookingId) {
  const appointment = allAppointments.find(a => a.bookingId === bookingId);
  if (!appointment) return;
  
  const modal = document.getElementById('viewAppointmentModal');
  const detailsDiv = document.getElementById('appointmentDetails');
  
  detailsDiv.innerHTML = `
    <div class="appointment-full-details">
      <div class="detail-row"><strong>🆔 Token:</strong> ${appointment.token}</div>
      <div class="detail-row"><strong>📅 Date:</strong> ${appointment.date}</div>
      <div class="detail-row"><strong>⏰ Time:</strong> ${appointment.time}</div>
      <div class="detail-row"><strong>🐾 Pet Name:</strong> ${escapeHtml(appointment.petName)}</div>
      <div class="detail-row"><strong>🎂 Pet Age:</strong> ${appointment.petAge || 'N/A'}</div>
      <div class="detail-row"><strong>⚖️ Weight:</strong> ${appointment.weight || 'N/A'} kg</div>
      <div class="detail-row"><strong>👤 Owner Name:</strong> ${escapeHtml(appointment.ownerName)}</div>
      <div class="detail-row"><strong>📞 Phone:</strong> ${appointment.ownerPhone}</div>
      <div class="detail-row"><strong>📋 Symptoms:</strong> ${escapeHtml(appointment.symptoms || 'N/A')}</div>
      <div class="detail-row"><strong>🩺 Diagnosis:</strong> ${escapeHtml(appointment.diagnosis || 'N/A')}</div>
      <div class="detail-row"><strong>💊 Prescription:</strong><br>${escapeHtml(appointment.prescription || 'N/A')}</div>
      <div class="detail-row"><strong>📝 Treatment Plan:</strong> ${escapeHtml(appointment.treatmentPlan || 'N/A')}</div>
      <div class="detail-row"><strong>📅 Follow-up Date:</strong> ${appointment.followUpDate || 'N/A'}</div>
      <div class="detail-row"><strong>✅ Status:</strong> <span class="status ${getStatusClass(appointment.status)}">${appointment.status || 'Confirmed'}</span></div>
      <div class="detail-row"><strong>📆 Booked On:</strong> ${new Date(appointment.timestamp).toLocaleString()}</div>
    </div>
  `;
  
  modal.classList.add('show');
  modal.style.display = 'flex';
  window.currentViewBookingId = bookingId;
}

function closeViewAppointmentModal() {
  const modal = document.getElementById('viewAppointmentModal');
  modal.classList.remove('show');
  modal.style.display = 'none';
}

function printAppointmentFromModal() {
  const appointment = allAppointments.find(a => a.bookingId === window.currentViewBookingId);
  if (!appointment) return;
  
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html>
      <head><title>Appointment Details</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        .header { text-align: center; margin-bottom: 20px; }
        .details { border: 1px solid #ccc; padding: 15px; border-radius: 8px; }
        .row { margin: 8px 0; }
      </style>
      </head>
      <body>
        <div class="header">
          <h2>VET FOR PET CLINIC</h2>
          <p>Dhaka, Bangladesh | 📞 01609-420061</p>
        </div>
        <div class="details">
          <h3>Appointment Details</h3>
          <div class="row"><strong>Token:</strong> ${appointment.token}</div>
          <div class="row"><strong>Date:</strong> ${appointment.date} | <strong>Time:</strong> ${appointment.time}</div>
          <div class="row"><strong>Pet:</strong> ${appointment.petName} (${appointment.petAge || 'N/A'})</div>
          <div class="row"><strong>Owner:</strong> ${appointment.ownerName}</div>
          <div class="row"><strong>Phone:</strong> ${appointment.ownerPhone}</div>
          <div class="row"><strong>Symptoms:</strong> ${appointment.symptoms || 'N/A'}</div>
          <div class="row"><strong>Diagnosis:</strong> ${appointment.diagnosis || 'N/A'}</div>
          <div class="row"><strong>Prescription:</strong><br>${appointment.prescription || 'N/A'}</div>
          <div class="row"><strong>Status:</strong> ${appointment.status || 'Confirmed'}</div>
        </div>
        <p style="text-align: center; margin-top: 20px;">Thank you for choosing VET FOR PET</p>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
}

function deleteAppointmentFromModal() {
  if (confirm('Are you sure you want to delete this appointment? This action cannot be undone.')) {
    // Remove from local array
    allAppointments = allAppointments.filter(a => a.bookingId !== window.currentViewBookingId);
    
    // Update localStorage backup
    const bookings = {};
    allAppointments.forEach(a => {
      if (!bookings[a.date]) bookings[a.date] = [];
      bookings[a.date].push(a.timeSlot);
    });
    localStorage.setItem('vet_bookings', JSON.stringify(bookings));
    
    closeViewAppointmentModal();
    refreshAllData();
    showToast('Appointment deleted successfully', 'success');
  }
}

// ============================================
// DOCTOR MANAGEMENT (CRUD)
// ============================================
function loadDoctors() {
  const stored = localStorage.getItem('clinic_doctors');
  if (stored) {
    doctors = JSON.parse(stored);
  } else {
    doctors = [
      { id: 1, name: 'Dr. Mitesh Tripura', email: 'doctor@vetforpet.com', specialization: 'Senior Veterinary Surgeon', phone: '01406779238', schedule: 'Sat-Wed 9AM-9PM' }
    ];
    localStorage.setItem('clinic_doctors', JSON.stringify(doctors));
  }
  renderDoctors();
}

function renderDoctors() {
  const container = document.getElementById('doctorsList');
  if (doctors.length === 0) {
    container.innerHTML = '<div class="empty-state">No doctors added yet</div>';
    return;
  }
  
  container.innerHTML = doctors.map(doc => `
    <div class="history-item">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap;">
        <div>
          <strong><i class="fas fa-user-md"></i> ${escapeHtml(doc.name)}</strong>
          <div style="font-size: 0.85rem; color: #64748b;">🔬 ${escapeHtml(doc.specialization)}</div>
          <div style="font-size: 0.8rem;">📧 ${doc.email} | 📞 ${doc.phone || 'N/A'}</div>
          <div style="font-size: 0.8rem;">⏰ ${doc.schedule || 'Flexible'}</div>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn-secondary" onclick="editDoctor(${doc.id})"><i class="fas fa-edit"></i> Edit</button>
          <button class="btn-danger" onclick="deleteDoctor(${doc.id})"><i class="fas fa-trash"></i> Delete</button>
        </div>
      </div>
    </div>
  `).join('');
}

function showAddDoctorModal() {
  document.getElementById('addDoctorModal').classList.add('show');
  document.getElementById('addDoctorModal').style.display = 'flex';
}

function closeAddDoctorModal() {
  document.getElementById('addDoctorModal').classList.remove('show');
  document.getElementById('addDoctorModal').style.display = 'none';
  document.getElementById('newDoctorName').value = '';
  document.getElementById('newDoctorEmail').value = '';
  document.getElementById('newDoctorPassword').value = '';
  document.getElementById('newDoctorSpecialization').value = '';
  document.getElementById('newDoctorPhone').value = '';
  document.getElementById('newDoctorSchedule').value = '';
}

function addDoctor() {
  const newDoctor = {
    id: Date.now(),
    name: document.getElementById('newDoctorName').value,
    email: document.getElementById('newDoctorEmail').value,
    password: document.getElementById('newDoctorPassword').value,
    specialization: document.getElementById('newDoctorSpecialization').value,
    phone: document.getElementById('newDoctorPhone').value,
    schedule: document.getElementById('newDoctorSchedule').value
  };
  
  if (!newDoctor.name || !newDoctor.email) {
    showToast('Please fill required fields', 'error');
    return;
  }
  
  doctors.push(newDoctor);
  localStorage.setItem('clinic_doctors', JSON.stringify(doctors));
  renderDoctors();
  closeAddDoctorModal();
  showToast('Doctor added successfully', 'success');
}

function editDoctor(id) {
  const doctor = doctors.find(d => d.id === id);
  if (!doctor) return;
  
  document.getElementById('editDoctorId').value = doctor.id;
  document.getElementById('editDoctorName').value = doctor.name;
  document.getElementById('editDoctorEmail').value = doctor.email;
  document.getElementById('editDoctorSpecialization').value = doctor.specialization || '';
  document.getElementById('editDoctorPhone').value = doctor.phone || '';
  document.getElementById('editDoctorSchedule').value = doctor.schedule || '';
  
  document.getElementById('editDoctorModal').classList.add('show');
  document.getElementById('editDoctorModal').style.display = 'flex';
}

function closeEditDoctorModal() {
  document.getElementById('editDoctorModal').classList.remove('show');
  document.getElementById('editDoctorModal').style.display = 'none';
}

function updateDoctor() {
  const id = parseInt(document.getElementById('editDoctorId').value);
  const index = doctors.findIndex(d => d.id === id);
  
  if (index !== -1) {
    doctors[index] = {
      ...doctors[index],
      name: document.getElementById('editDoctorName').value,
      email: document.getElementById('editDoctorEmail').value,
      specialization: document.getElementById('editDoctorSpecialization').value,
      phone: document.getElementById('editDoctorPhone').value,
      schedule: document.getElementById('editDoctorSchedule').value
    };
    
    const newPassword = document.getElementById('editDoctorPassword').value;
    if (newPassword) {
      doctors[index].password = newPassword;
    }
    
    localStorage.setItem('clinic_doctors', JSON.stringify(doctors));
    renderDoctors();
    closeEditDoctorModal();
    showToast('Doctor updated successfully', 'success');
  }
}

function deleteDoctor(id) {
  if (confirm('Are you sure you want to delete this doctor?')) {
    doctors = doctors.filter(d => d.id !== id);
    localStorage.setItem('clinic_doctors', JSON.stringify(doctors));
    renderDoctors();
    showToast('Doctor deleted successfully', 'success');
  }
}

// ============================================
// SERVICES MANAGEMENT (CRUD)
// ============================================
function loadServices() {
  const stored = localStorage.getItem('clinic_services');
  if (stored) {
    services = JSON.parse(stored);
  } else {
    services = [
      { id: 1, name: 'General Checkup', icon: 'fa-stethoscope', desc: 'Complete physical exam & health screening', price: 500, duration: 30 },
      { id: 2, name: 'Vaccination', icon: 'fa-syringe', desc: 'Core & lifestyle vaccines', price: 800, duration: 20 },
      { id: 3, name: 'Dental Care', icon: 'fa-tooth', desc: 'Scaling & oral hygiene', price: 1000, duration: 45 }
    ];
    localStorage.setItem('clinic_services', JSON.stringify(services));
  }
  renderServices();
}

function renderServices() {
  const container = document.getElementById('servicesList');
  if (services.length === 0) {
    container.innerHTML = '<div class="empty-state">No services added yet</div>';
    return;
  }
  
  container.innerHTML = services.map(service => `
    <div class="history-item">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap;">
        <div>
          <strong><i class="fas ${service.icon}"></i> ${escapeHtml(service.name)}</strong>
          <div style="font-size: 0.85rem;">${escapeHtml(service.desc)}</div>
          <div style="font-size: 0.8rem; color: #64748b;">💰 ৳${service.price} | ⏱️ ${service.duration} min</div>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn-secondary" onclick="editService(${service.id})"><i class="fas fa-edit"></i> Edit</button>
          <button class="btn-danger" onclick="deleteService(${service.id})"><i class="fas fa-trash"></i> Delete</button>
        </div>
      </div>
    </div>
  `).join('');
}

function showAddServiceModal() {
  document.getElementById('addServiceModal').classList.add('show');
  document.getElementById('addServiceModal').style.display = 'flex';
}

function closeAddServiceModal() {
  document.getElementById('addServiceModal').classList.remove('show');
  document.getElementById('addServiceModal').style.display = 'none';
  document.getElementById('newServiceName').value = '';
  document.getElementById('newServiceIcon').value = '';
  document.getElementById('newServiceDesc').value = '';
  document.getElementById('newServicePrice').value = '';
  document.getElementById('newServiceDuration').value = '';
}

function addService() {
  const newService = {
    id: Date.now(),
    name: document.getElementById('newServiceName').value,
    icon: document.getElementById('newServiceIcon').value || 'fa-stethoscope',
    desc: document.getElementById('newServiceDesc').value,
    price: parseInt(document.getElementById('newServicePrice').value) || 0,
    duration: parseInt(document.getElementById('newServiceDuration').value) || 30
  };
  
  if (!newService.name) {
    showToast('Please enter service name', 'error');
    return;
  }
  
  services.push(newService);
  localStorage.setItem('clinic_services', JSON.stringify(services));
  renderServices();
  closeAddServiceModal();
  showToast('Service added successfully', 'success');
}

function editService(id) {
  const service = services.find(s => s.id === id);
  if (!service) return;
  
  document.getElementById('editServiceId').value = service.id;
  document.getElementById('editServiceName').value = service.name;
  document.getElementById('editServiceIcon').value = service.icon;
  document.getElementById('editServiceDesc').value = service.desc;
  document.getElementById('editServicePrice').value = service.price;
  document.getElementById('editServiceDuration').value = service.duration;
  
  document.getElementById('editServiceModal').classList.add('show');
  document.getElementById('editServiceModal').style.display = 'flex';
}

function closeEditServiceModal() {
  document.getElementById('editServiceModal').classList.remove('show');
  document.getElementById('editServiceModal').style.display = 'none';
}

function updateService() {
  const id = parseInt(document.getElementById('editServiceId').value);
  const index = services.findIndex(s => s.id === id);
  
  if (index !== -1) {
    services[index] = {
      ...services[index],
      name: document.getElementById('editServiceName').value,
      icon: document.getElementById('editServiceIcon').value,
      desc: document.getElementById('editServiceDesc').value,
      price: parseInt(document.getElementById('editServicePrice').value) || 0,
      duration: parseInt(document.getElementById('editServiceDuration').value) || 30
    };
    
    localStorage.setItem('clinic_services', JSON.stringify(services));
    renderServices();
    closeEditServiceModal();
    showToast('Service updated successfully', 'success');
  }
}

function deleteService(id) {
  if (confirm('Are you sure you want to delete this service?')) {
    services = services.filter(s => s.id !== id);
    localStorage.setItem('clinic_services', JSON.stringify(services));
    renderServices();
    showToast('Service deleted successfully', 'success');
  }
}

// ============================================
// SETTINGS & CONFIGURATION
// ============================================
function loadSettings() {
  const settings = JSON.parse(localStorage.getItem('clinic_settings') || '{}');
  document.getElementById('clinicName').value = settings.clinicName || 'VET FOR PET CLINIC';
  document.getElementById('clinicAddress').value = settings.clinicAddress || 'Dhaka, Bangladesh';
  document.getElementById('clinicPhone').value = settings.clinicPhone || '01406-779238';
  document.getElementById('clinicEmergency').value = settings.clinicEmergency || '01609-420061';
  document.getElementById('clinicEmail').value = settings.clinicEmail || 'info@vetforpet.com';
}

function saveSettings() {
  const settings = {
    clinicName: document.getElementById('clinicName').value,
    clinicAddress: document.getElementById('clinicAddress').value,
    clinicPhone: document.getElementById('clinicPhone').value,
    clinicEmergency: document.getElementById('clinicEmergency').value,
    clinicEmail: document.getElementById('clinicEmail').value
  };
  localStorage.setItem('clinic_settings', JSON.stringify(settings));
  showToast('Settings saved successfully', 'success');
}

function loadSlotConfig() {
  const defaultConfig = {
    "Saturday": { start: 9, end: 21 },
    "Sunday": { start: 9, end: 15 },
    "Monday": { start: 9, end: 15 },
    "Tuesday": { start: 9, end: 21 },
    "Wednesday": { start: 9, end: 15 },
    "Thursday": { start: 9, end: 15 },
    "Friday": { start: 9, end: 15 }
  };
  
  const config = JSON.parse(localStorage.getItem('slot_config') || JSON.stringify(defaultConfig));
  const container = document.getElementById('slotConfig');
  
  container.innerHTML = Object.entries(config).map(([day, cfg]) => `
    <div class="slot-item">
      <label>${day}</label>
      <input type="number" id="${day}_start" value="${cfg.start}" placeholder="Start" min="0" max="23"> -
      <input type="number" id="${day}_end" value="${cfg.end}" placeholder="End" min="0" max="23">
    </div>
  `).join('');
  
  window.slotConfigData = config;
}

function saveSlotConfig() {
  const newConfig = {};
  const days = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
  
  days.forEach(day => {
    newConfig[day] = {
      start: parseInt(document.getElementById(`${day}_start`).value) || 9,
      end: parseInt(document.getElementById(`${day}_end`).value) || 17
    };
  });
  
  localStorage.setItem('slot_config', JSON.stringify(newConfig));
  showToast('Slot configuration saved successfully', 'success');
}

function loadPricing() {
  const pricing = JSON.parse(localStorage.getItem('service_pricing') || '{}');
  const container = document.getElementById('pricingConfig');
  
  if (services.length > 0) {
    container.innerHTML = services.map(service => `
      <div class="slot-item">
        <label>${escapeHtml(service.name)}</label>
        <input type="number" id="price_${service.id}" value="${pricing[service.id] || service.price || 500}" placeholder="Price (BDT)">
      </div>
    `).join('');
  } else {
    container.innerHTML = '<p>Add services first to set pricing</p>';
  }
}

function savePricing() {
  const pricing = {};
  services.forEach(service => {
    const priceInput = document.getElementById(`price_${service.id}`);
    if (priceInput) {
      pricing[service.id] = parseInt(priceInput.value) || 0;
    }
  });
  localStorage.setItem('service_pricing', JSON.stringify(pricing));
  showToast('Pricing saved successfully', 'success');
}

// ============================================
// BACKUP & EXPORT
// ============================================
function exportToCSV() {
  if (allAppointments.length === 0) {
    showToast('No data to export', 'error');
    return;
  }
  
  let csv = "Date,Time,Token,Pet Name,Pet Age,Weight,Owner Name,Phone,Symptoms,Diagnosis,Prescription,Status\n";
  allAppointments.forEach(a => {
    csv += `"${a.date}","${a.time}","${a.token}","${escapeCsv(a.petName)}","${escapeCsv(a.petAge || '')}","${escapeCsv(a.weight || '')}","${escapeCsv(a.ownerName)}","${a.ownerPhone}","${escapeCsv(a.symptoms || '')}","${escapeCsv(a.diagnosis || '')}","${escapeCsv(a.prescription || '')}","${a.status || 'Confirmed'}"\n`;
  });
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `appointments_${new Date().toISOString().split('T')[0]}.csv`;
  link.click();
  showToast('CSV exported successfully', 'success');
}

function escapeCsv(str) {
  if (!str) return '';
  return str.replace(/"/g, '""');
}

function backupData() {
  const backup = {
    appointments: allAppointments,
    doctors: doctors,
    services: services,
    settings: localStorage.getItem('clinic_settings'),
    slotConfig: localStorage.getItem('slot_config'),
    pricing: localStorage.getItem('service_pricing'),
    date: new Date().toISOString()
  };
  
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `vet_clinic_backup_${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  
  localStorage.setItem('lastBackup', new Date().toLocaleString());
  document.getElementById('lastBackup').innerText = new Date().toLocaleString();
  showToast('Backup downloaded successfully', 'success');
}

function triggerRestore() {
  document.getElementById('restoreFile').click();
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
      }
      if (data.doctors) {
        localStorage.setItem('clinic_doctors', JSON.stringify(data.doctors));
        doctors = data.doctors;
      }
      if (data.services) {
        localStorage.setItem('clinic_services', JSON.stringify(data.services));
        services = data.services;
      }
      if (data.settings) localStorage.setItem('clinic_settings', data.settings);
      if (data.slotConfig) localStorage.setItem('slot_config', data.slotConfig);
      if (data.pricing) localStorage.setItem('service_pricing', data.pricing);
      
      showToast('Restore successful! Refreshing...', 'success');
      setTimeout(() => location.reload(), 1500);
    } catch (err) {
      showToast('Invalid backup file', 'error');
    }
  };
  reader.readAsText(file);
});

// ============================================
// REPORTS & CHARTS
// ============================================
async function loadReport() {
  const reportType = document.getElementById('reportType').value;
  const reportDate = document.getElementById('reportDate').value;
  
  let filteredApps = [...allAppointments];
  let title = '';
  
  if (reportType === 'daily' && reportDate) {
    filteredApps = filteredApps.filter(a => a.date === reportDate);
    title = `Daily Report - ${reportDate}`;
  } else if (reportType === 'weekly') {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    filteredApps = filteredApps.filter(a => new Date(a.date) >= weekAgo);
    title = 'Weekly Report (Last 7 days)';
  } else if (reportType === 'monthly') {
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    filteredApps = filteredApps.filter(a => new Date(a.date) >= monthAgo);
    title = 'Monthly Report (Last 30 days)';
  } else if (reportType === 'yearly') {
    const yearAgo = new Date();
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);
    filteredApps = filteredApps.filter(a => new Date(a.date) >= yearAgo);
    title = 'Yearly Report (Last 12 months)';
  }
  
  // Update report container
  const container = document.getElementById('reportContainer');
  const completed = filteredApps.filter(a => a.status === 'Completed').length;
  const pending = filteredApps.filter(a => a.status !== 'Completed').length;
  const totalRevenue = filteredApps.length * 500;
  
  container.innerHTML = `
    <div class="report-summary">
      <h3>${title}</h3>
      <div class="report-stats">
        <div class="report-stat"><strong>Total Appointments:</strong> ${filteredApps.length}</div>
        <div class="report-stat"><strong>Completed:</strong> ${completed}</div>
        <div class="report-stat"><strong>Pending:</strong> ${pending}</div>
        <div class="report-stat"><strong>Estimated Revenue:</strong> ৳${totalRevenue.toLocaleString()}</div>
      </div>
      <div class="report-list">
        <h4>Appointment List</h4>
        <table class="report-table">
          <thead><tr><th>Date</th><th>Pet</th><th>Owner</th><th>Status</th></tr></thead>
          <tbody>
            ${filteredApps.slice(0, 20).map(a => `
              <tr><td>${a.date}</td><td>${escapeHtml(a.petName)}</td><td>${escapeHtml(a.ownerName)}</td><td>${a.status || 'Confirmed'}</td></tr>
            `).join('')}
          </tbody>
        </table>
        ${filteredApps.length > 20 ? '<p>... and more</p>' : ''}
      </div>
    </div>
  `;
  
  // Update chart
  updateReportChart(filteredApps);
}

function updateReportChart(appointments) {
  const last7Days = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    last7Days.push(date.toISOString().split('T')[0]);
  }
  
  const dailyCounts = last7Days.map(date => appointments.filter(a => a.date === date).length);
  
  const ctx = document.getElementById('reportChart').getContext('2d');
  if (reportChart) reportChart.destroy();
  
  reportChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: last7Days.map(d => new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })),
      datasets: [{
        label: 'Appointments',
        data: dailyCounts,
        backgroundColor: '#f97316',
        borderRadius: 8,
        barPercentage: 0.6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: { legend: { display: false } }
    }
  });
}

function printReport() {
  const reportContent = document.getElementById('reportContainer').innerHTML;
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html>
      <head>
        <title>Clinic Report</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .report-summary { margin-bottom: 20px; }
          .report-table { width: 100%; border-collapse: collapse; }
          .report-table th, .report-table td { border: 1px solid #ccc; padding: 8px; text-align: left; }
        </style>
      </head>
      <body>${reportContent}</body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
}

function printAllAppointments() {
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html>
      <head><title>All Appointments</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
        th { background: #f97316; color: white; }
      </style>
      </head>
      <body>
        <h2>VET FOR PET CLINIC - All Appointments</h2>
        <p>Generated on: ${new Date().toLocaleString()}</p>
        <table>
          <thead><tr><th>Date</th><th>Time</th><th>Token</th><th>Pet</th><th>Owner</th><th>Phone</th><th>Status</th></tr></thead>
          <tbody>
            ${allAppointments.map(a => `
              <tr><td>${a.date}</td><td>${a.time}</td><td>${a.token}</td><td>${escapeHtml(a.petName)}</td><td>${escapeHtml(a.ownerName)}</td><td>${a.ownerPhone}</td><td>${a.status || 'Confirmed'}</td></tr>
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
// LOGOUT FUNCTIONS
// ============================================
function showLogoutModal() {
  document.getElementById('logoutModal').classList.add('show');
  document.getElementById('logoutModal').style.display = 'flex';
}

function closeLogoutModal() {
  document.getElementById('logoutModal').classList.remove('show');
  document.getElementById('logoutModal').style.display = 'none';
}

function confirmLogout() {
  sessionStorage.clear();
  window.location.href = 'admin-login.html';
}

// ============================================
// UTILITY FUNCTIONS
// ============================================
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showToast(message, type) {
  const toast = document.getElementById('toast');
  toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : (type === 'error' ? 'exclamation-circle' : 'info-circle')}"></i> ${message}`;
  toast.style.background = type === 'success' ? '#15803d' : (type === 'error' ? '#ef4444' : '#0ea5e9');
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}