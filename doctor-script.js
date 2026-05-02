// ============================================
// DOCTOR DASHBOARD - COMPLETE SCRIPT
// A to Z Workable | Bangladesh Time Zone (UTC+6)
// ============================================

const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyL1X_hZMifdg1DKPT4lcGKIig022HceElgtrvV63VLM6gUxhiK7YbuT1l3j-9YM8a6Ng/exec";

let allAppointments = [];
let currentModalBookingId = null;
let currentViewBookingId = null;
let currentPage = 1;
let itemsPerPage = 10;
let doctorChart = null;

// ============================================
// BANGLADESH TIME ZONE (UTC+6)
// ============================================
function getBangladeshTime() {
  const now = new Date();
  const bangladeshTime = new Date(now.getTime() + (6 * 60 * 60 * 1000));
  return bangladeshTime;
}
function getBangladeshDate() {
  const bdTime = getBangladeshTime();
  return `${bdTime.getFullYear()}-${String(bdTime.getMonth() + 1).padStart(2, '0')}-${String(bdTime.getDate()).padStart(2, '0')}`;
}

// ============================================
// AUTHENTICATION CHECK
// ============================================
(function() {
  if (!sessionStorage.getItem('doctor_logged_in')) window.location.href = 'doctor-login.html';
  document.getElementById('welcomeName').innerText = (sessionStorage.getItem('doctor_name') || 'Dr. Mitesh').split(' ')[0];
  document.getElementById('doctorName').innerText = sessionStorage.getItem('doctor_name') || 'Dr. Mitesh';
  document.getElementById('doctorRole').innerText = sessionStorage.getItem('doctor_role') || 'Senior Veterinarian';
  document.getElementById('profileName').innerText = sessionStorage.getItem('doctor_name') || 'Dr. Mitesh';
  document.getElementById('profileEmail').innerText = sessionStorage.getItem('doctor_email') || 'doctor@vetforpet.com';
  document.getElementById('profileRole').innerText = sessionStorage.getItem('doctor_role') || 'Senior Veterinarian';
  document.getElementById('profileSpecialization').innerText = sessionStorage.getItem('doctor_specialization') || 'General Veterinary';
  document.getElementById('profileJoined').innerText = '2024';
})();

// ============================================
// INITIALIZATION
// ============================================
document.addEventListener('DOMContentLoaded', function() {
  updateDateTime();
  setInterval(updateDateTime, 1000);
  setupNavigation();
  loadAllData();
  const todayPicker = document.getElementById('todayDatePicker');
  if (todayPicker) { todayPicker.value = getBangladeshDate(); todayPicker.addEventListener('change', () => loadTodayAppointments()); }
  setupModalClose();
  
  // Medical Modal Button Listeners
  const medicalModalClose = document.getElementById('medicalModalCloseBtn');
  if (medicalModalClose) medicalModalClose.onclick = closeMedicalModal;
  const medicalModalCancel = document.getElementById('medicalModalCancelBtn');
  if (medicalModalCancel) medicalModalCancel.onclick = closeMedicalModal;
});
function updateDateTime() {
  const bdTime = getBangladeshTime();
  document.getElementById('currentDate').innerText = bdTime.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  document.getElementById('currentTime').innerText = bdTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

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
      document.getElementById(page + 'Page').classList.add('active');
      document.getElementById('pageTitle').innerText = item.querySelector('span')?.innerText || page;
      if (page === 'today') loadTodayAppointments();
      if (page === 'all') loadAllAppointments();
      if (page === 'prescriptions') loadPrescriptions();
      if (page === 'medical') loadMedicalRecords();
      if (page === 'reports') loadDoctorReport();
    });
  });
}
function goToPage(pageId) { document.querySelector(`.nav-item[data-page="${pageId}"]`).click(); }
function refreshAllData() { loadAllData(); showToast('Data refreshed!', 'success'); }

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
  } catch (error) { console.error(error); return null; }
}
async function saveMedicalInfo(bookingId, medicalData) {
  try {
    await fetch(SCRIPT_URL, { 
      method: 'POST', 
      mode: 'no-cors', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ action: 'updateMedicalInfo', bookingId, ...medicalData }) 
    });
    return true;
  } catch (error) { console.error(error); return false; }
}

// ============================================
// LOAD DATA
// ============================================
async function loadAllData() {
  const data = await fetchFromAPI('getAppointments');
  if (data && data.appointments) {
    allAppointments = data.appointments;
    updateDashboardStats();
    loadTodayPreview();
    loadRecentActivity();
    const todayPicker = document.getElementById('todayDatePicker');
    if (todayPicker) loadTodayAppointments(todayPicker.value);
  }
}
function updateDashboardStats() {
  const today = getBangladeshDate();
  const todayApps = allAppointments.filter(a => a.date === today);
  const completedApps = allAppointments.filter(a => a.status === 'Completed');
  const pendingApps = allAppointments.filter(a => a.status === 'Confirmed' || a.status === 'In Progress');
  const uniquePets = [...new Set(allAppointments.map(a => a.petName))];
  document.getElementById('todayStatsCount').innerText = todayApps.length;
  document.getElementById('todayBadge').innerText = todayApps.length;
  document.getElementById('completedCount').innerText = completedApps.length;
  document.getElementById('pendingCount').innerText = pendingApps.length;
  document.getElementById('totalPetsCount').innerText = uniquePets.length;
}

// ============================================
// TODAY'S APPOINTMENTS
// ============================================
async function loadTodayAppointments() {
  const container = document.getElementById('todayAppointments');
  if (!container) return;
  const selectedDate = document.getElementById('todayDatePicker')?.value || getBangladeshDate();
  container.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
  const filteredApps = allAppointments.filter(a => a.date === selectedDate);
  if (filteredApps.length === 0) { 
    container.innerHTML = `<div class="empty-state"><i class="fas fa-calendar-day"></i><p>No appointments for ${selectedDate}</p></div>`; 
    return; 
  }
  filteredApps.sort((a, b) => a.time.localeCompare(b.time));
  container.innerHTML = filteredApps.map(app => createAppointmentCard(app)).join('');
}
function loadTodayPreview() {
  const container = document.getElementById('todayPreview');
  if (!container) return;
  const today = getBangladeshDate();
  const todayApps = allAppointments.filter(a => a.date === today).slice(0, 5);
  if (todayApps.length === 0) { container.innerHTML = '<div class="empty-state">No appointments today</div>'; return; }
  container.innerHTML = todayApps.map(app => `<div class="history-item" onclick="viewAppointment('${app.bookingId}')"><div style="display:flex;justify-content:space-between"><strong>🐾 ${escapeHtml(app.petName)}</strong><span class="token">${app.token}</span></div><div>⏰ ${app.time} | 👤 ${escapeHtml(app.ownerName)}</div></div>`).join('');
}
function loadRecentActivity() {
  const container = document.getElementById('recentActivity');
  if (!container) return;
  const recent = [...allAppointments].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0,5);
  if (recent.length === 0) { container.innerHTML = '<div class="empty-state">No recent activity</div>'; return; }
  container.innerHTML = recent.map(app => `<div class="history-item" style="border-left-color:#22c55e" onclick="viewAppointment('${app.bookingId}')"><div style="display:flex;justify-content:space-between"><strong>🐾 ${escapeHtml(app.petName)}</strong><span class="status ${app.status === 'Completed' ? 'completed' : 'confirmed'}">${app.status || 'Confirmed'}</span></div><div>👤 ${escapeHtml(app.ownerName)} | ⏰ ${app.time} | 📅 ${app.date}</div></div>`).join('');
}

// ============================================
// ALL APPOINTMENTS
// ============================================
async function loadAllAppointments() {
  const container = document.getElementById('allAppointments');
  if (!container) return;
  const filterText = document.getElementById('allFilterInput')?.value.toLowerCase() || '';
  const statusFilter = document.getElementById('statusFilter')?.value || 'all';
  let filtered = allAppointments.filter(a => (!filterText || a.petName.toLowerCase().includes(filterText) || a.ownerName.toLowerCase().includes(filterText) || a.ownerPhone.includes(filterText) || a.token.toLowerCase().includes(filterText)) && (statusFilter === 'all' || a.status === statusFilter));
  filtered.sort((a,b) => new Date(b.date) - new Date(a.date));
  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage-1)*itemsPerPage, currentPage*itemsPerPage);
  container.innerHTML = paginated.length ? paginated.map(app => createHistoryItem(app)).join('') : '<div class="empty-state">No appointments found</div>';
  const pagination = document.getElementById('pagination');
  if (pagination && totalPages > 1) {
    let html = '';
    for (let i=1; i<=Math.min(totalPages,10); i++) html += `<button class="${i===currentPage?'active':''}" onclick="goToPageNum(${i})">${i}</button>`;
    pagination.innerHTML = html;
  } else if (pagination) pagination.innerHTML = '';
}
function goToPageNum(page) { currentPage = page; loadAllAppointments(); }
function filterAllAppointments() { currentPage = 1; loadAllAppointments(); }

// ============================================
// SEARCH
// ============================================
async function searchPatients() {
  const term = document.getElementById('searchInput')?.value.toLowerCase().trim() || '';
  const container = document.getElementById('searchResults');
  if (!term) { container.innerHTML = '<div class="empty-state">Enter search term</div>'; return; }
  container.innerHTML = '<div class="loading">Searching...</div>';
  const results = allAppointments.filter(a => a.petName.toLowerCase().includes(term) || a.ownerName.toLowerCase().includes(term) || a.ownerPhone.includes(term));
  if (results.length === 0) { container.innerHTML = '<div class="empty-state">No patients found</div>'; return; }
  container.innerHTML = results.map(app => createAppointmentCard(app)).join('');
}

// ============================================
// PRESCRIPTIONS & MEDICAL RECORDS
// ============================================
async function loadPrescriptions() {
  const container = document.getElementById('prescriptionsList');
  if (!container) return;
  const prescriptions = allAppointments.filter(a => a.prescription && a.prescription !== '');
  if (prescriptions.length === 0) { container.innerHTML = '<div class="empty-state">No prescriptions yet</div>'; return; }
  container.innerHTML = prescriptions.map(app => `<div class="history-item" onclick="viewAppointment('${app.bookingId}')"><div style="display:flex;justify-content:space-between"><strong>🐾 ${escapeHtml(app.petName)}</strong><span class="token">${app.token}</span></div><div><strong>💊 Prescription:</strong><br><div style="background:#f1f5f9;padding:10px;border-radius:8px;margin-top:5px">${escapeHtml(app.prescription)}</div></div>${app.diagnosis?`<div><strong>📝 Diagnosis:</strong> ${escapeHtml(app.diagnosis)}</div>`:''}</div>`).join('');
}
async function loadMedicalRecords() {
  const container = document.getElementById('medicalRecordsList');
  if (!container) return;
  const records = allAppointments.filter(a => a.diagnosis || a.prescription);
  if (records.length === 0) { container.innerHTML = '<div class="empty-state">No medical records yet</div>'; return; }
  container.innerHTML = records.map(app => `<div class="history-item" onclick="viewAppointment('${app.bookingId}')"><div style="display:flex;justify-content:space-between"><strong>🐾 ${escapeHtml(app.petName)}</strong><span class="token">${app.token}</span></div><div><strong>Diagnosis:</strong> ${escapeHtml(app.diagnosis || 'N/A')}</div><div><strong>Prescription:</strong> ${escapeHtml((app.prescription||'').substring(0,100))}${(app.prescription||'').length>100?'...':''}</div></div>`).join('');
}

// ============================================
// DOCTOR REPORT
// ============================================
async function loadDoctorReport() {
  const period = document.getElementById('reportPeriod')?.value || 'weekly';
  let filtered = [...allAppointments];
  if (period === 'weekly') { const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate()-7); filtered = filtered.filter(a => new Date(a.date) >= weekAgo); }
  else if (period === 'monthly') { const monthAgo = new Date(); monthAgo.setMonth(monthAgo.getMonth()-1); filtered = filtered.filter(a => new Date(a.date) >= monthAgo); }
  else { const yearAgo = new Date(); yearAgo.setFullYear(yearAgo.getFullYear()-1); filtered = filtered.filter(a => new Date(a.date) >= yearAgo); }
  document.getElementById('reportTotal').innerText = filtered.length;
  document.getElementById('reportCompleted').innerText = filtered.filter(a => a.status === 'Completed').length;
  document.getElementById('reportCancelled').innerText = filtered.filter(a => a.status === 'Cancelled').length;
  updateDoctorChart(filtered);
}
function updateDoctorChart(appointments) {
  const last7Days = [];
  for (let i=6; i>=0; i--) { const d = new Date(); d.setDate(d.getDate()-i); last7Days.push(d.toISOString().split('T')[0]); }
  const counts = last7Days.map(d => appointments.filter(a => a.date === d).length);
  const ctx = document.getElementById('doctorChart')?.getContext('2d');
  if (!ctx) return;
  if (doctorChart) doctorChart.destroy();
  doctorChart = new Chart(ctx, { type: 'bar', data: { labels: last7Days.map(d => new Date(d).toLocaleDateString('en-US',{weekday:'short'})), datasets: [{ label: 'Appointments', data: counts, backgroundColor: '#f97316', borderRadius: 8 }] }, options: { responsive: true, plugins: { legend: { display: false } } } });
}

// ============================================
// VIEW APPOINTMENT
// ============================================
function viewAppointment(bookingId) {
  const app = allAppointments.find(a => a.bookingId === bookingId);
  if (!app) return;
  currentViewBookingId = bookingId;
  document.getElementById('viewAppointmentDetails').innerHTML = `
    <div><strong>Token:</strong> ${app.token}</div>
    <div><strong>Date:</strong> ${app.date} | <strong>Time:</strong> ${app.time}</div>
    <div><strong>Pet:</strong> ${escapeHtml(app.petName)} (${app.petAge||'N/A'})</div>
    <div><strong>Owner:</strong> ${escapeHtml(app.ownerName)} | <strong>Phone:</strong> ${app.ownerPhone}</div>
    <div><strong>Symptoms:</strong> ${escapeHtml(app.symptoms||'N/A')}</div>
    <div><strong>Diagnosis:</strong> ${escapeHtml(app.diagnosis||'N/A')}</div>
    <div><strong>Prescription:</strong><br>${escapeHtml(app.prescription||'N/A')}</div>
    <div><strong>Status:</strong> <span class="status ${app.status === 'Completed' ? 'completed' : 'confirmed'}">${app.status || 'Confirmed'}</span></div>
  `;
  document.getElementById('viewAppointmentModal').classList.add('show');
  document.getElementById('viewAppointmentModal').style.display = 'flex';
}
function closeViewModal() { const m = document.getElementById('viewAppointmentModal'); m.classList.remove('show'); m.style.display = 'none'; }
function openMedicalFromView() { closeViewModal(); openMedicalModal(currentViewBookingId); }

// ============================================
// PRINT APPOINTMENT FROM VIEW
// ============================================
function printAppointmentFromView() {
  const app = allAppointments.find(a => a.bookingId === currentViewBookingId);
  if(!app) return;
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Appointment Details - ${app.token}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Times New Roman',Arial,sans-serif;padding:40px;background:white}
.print-container{max-width:800px;margin:0 auto}
.header{text-align:center;margin-bottom:30px;padding-bottom:20px;border-bottom:2px solid #f97316}
.clinic-name{font-size:28px;font-weight:800;color:#f97316}
.clinic-tagline{font-size:12px;color:#64748b;margin-bottom:15px}
.clinic-details{display:flex;justify-content:center;gap:30px;flex-wrap:wrap;font-size:11px;color:#475569;margin-top:10px}
.doc-title{text-align:center;margin:20px 0}
.doc-title h2{background:#f97316;color:white;display:inline-block;padding:8px 30px;border-radius:50px;font-size:18px}
.info-table{width:100%;border-collapse:collapse;margin:20px 0}
.info-table td{padding:10px;border-bottom:1px solid #e2e8f0}
.info-label{font-weight:700;width:180px;background:#f8fafc}
.footer{margin-top:30px;padding-top:20px;text-align:center;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8}
</style>
</head>
<body>
<div class="print-container">
<div class="header"><div class="clinic-name">🐾 VET FOR PET CLINIC</div><div class="clinic-tagline">Advanced Veterinary Care | Compassion at Heart</div>
<div class="clinic-details"><div>📍 PCXR+55F, Titash Road, Dhaka, Bangladesh</div><div>📞 01406-779238 | 🚨 01609-420061</div><div>✉️ info@vetforpet.com</div></div></div>
<div class="doc-title"><h2>📋 COMPLETE APPOINTMENT DETAILS 📋</h2></div>
<table class="info-table">
<tr><td class="info-label">🆔 Token ID</td><td>${app.token}</td></tr>
<tr><td class="info-label">📅 Appointment Date</td><td>${app.date}</td></tr>
<tr><td class="info-label">⏰ Appointment Time</td><td>${app.time}</td></tr>
<tr><td class="info-label">🐾 Pet Name</td><td>${escapeHtml(app.petName)}</td></tr>
<tr><td class="info-label">🎂 Pet Age</td><td>${app.petAge || 'N/A'}</td></tr>
<tr><td class="info-label">⚖️ Weight</td><td>${app.weight || 'N/A'} kg</td></tr>
<tr><td class="info-label">👤 Owner Name</td><td>${escapeHtml(app.ownerName)}</td></tr>
<tr><td class="info-label">📞 Phone Number</td><td>${app.ownerPhone}</td></tr>
<tr><td class="info-label">📋 Symptoms / Reason</td><td>${escapeHtml(app.symptoms || 'N/A')}</td></tr>
<tr><td class="info-label">🩺 Diagnosis</td><td>${escapeHtml(app.diagnosis || 'N/A')}</td></tr>
<tr><td class="info-label">💊 Prescription</td><td><pre style="white-space:pre-wrap; margin:0;">${escapeHtml(app.prescription || 'N/A')}</pre></td></tr>
<tr><td class="info-label">📝 Treatment Plan</td><td>${escapeHtml(app.treatmentPlan || 'N/A')}</td></tr>
<tr><td class="info-label">📅 Follow-up Date</td><td>${app.followUpDate || 'N/A'}</td></tr>
<tr><td class="info-label">✅ Status</td><td>${app.status || 'Confirmed'}</td></tr>
</table>
<div class="footer"><p>This is a computer generated document. For any queries, please contact our clinic.</p><p>Generated on: ${new Date().toLocaleString()} | © ${new Date().getFullYear()} VET FOR PET CLINIC</p></div>
</div>
</body></html>`);
  printWindow.document.close();
  printWindow.print();
}

// ============================================
// MEDICAL MODAL - COMPLETE WORKING VERSION
// ============================================
function openMedicalModal(bookingId) {
  const appointment = allAppointments.find(a => a.bookingId === bookingId);
  if (!appointment) {
    showToast('Appointment not found!', 'error');
    return;
  }
  
  currentModalBookingId = bookingId;
  
  // Patient Summary
  document.getElementById('summaryPetName').innerHTML = `<i class="fas fa-paw"></i> ${escapeHtml(appointment.petName || 'Unknown')}`;
  document.getElementById('summaryDate').innerText = appointment.date || 'N/A';
  document.getElementById('summaryTime').innerText = appointment.time || 'N/A';
  document.getElementById('summaryToken').innerHTML = `<i class="fas fa-ticket-alt"></i> ${appointment.token || 'N/A'}`;
  document.getElementById('summaryOwner').innerHTML = escapeHtml(appointment.ownerName || 'Unknown');
  document.getElementById('summaryPhone').innerHTML = appointment.ownerPhone || 'N/A';
  document.getElementById('modalSymptoms').innerHTML = escapeHtml(appointment.symptoms || 'No symptoms recorded');
  
  // Medical Form Fields
  document.getElementById('modalTemperature').value = appointment.temperature || '';
  document.getElementById('modalHeartRate').value = appointment.heartRate || '';
  document.getElementById('modalRespiratory').value = appointment.respiratoryRate || '';
  document.getElementById('modalDiagnosis').value = appointment.diagnosis || '';
  document.getElementById('modalClinicalFindings').value = appointment.clinicalFindings || '';
  document.getElementById('modalTreatmentPlan').value = appointment.treatmentPlan || '';
  document.getElementById('modalFollowup').value = appointment.followUpDate || '';
  document.getElementById('modalNotes').value = appointment.notes || '';
  document.getElementById('modalStatus').value = appointment.status || 'Confirmed';
  document.getElementById('modalOwnerEmail').value = appointment.ownerEmail || '';
  
  // Load prescription list
  loadPrescriptionList(appointment.prescription || '');
  
  // Load reminder preferences
  const smsCheckbox = document.getElementById('modalSmsReminder');
  const emailCheckbox = document.getElementById('modalEmailReminder');
  if (smsCheckbox) smsCheckbox.checked = appointment.smsReminder === 'true';
  if (emailCheckbox) emailCheckbox.checked = appointment.emailReminder === 'true';
  
  // Show modal
  const modal = document.getElementById('medicalModal');
  if (modal) {
    modal.classList.add('show');
    modal.style.display = 'flex';
  }
}

function closeMedicalModal() {
  const modal = document.getElementById('medicalModal');
  if (modal) {
    modal.classList.remove('show');
    modal.style.display = 'none';
  }
}
function closeModal() { closeMedicalModal(); }

async function saveModalMedicalInfo() {
  const prescriptionText = getPrescriptionText();
  const ownerEmail = document.getElementById('modalOwnerEmail')?.value || '';
  
  const medicalData = {
    temperature: document.getElementById('modalTemperature')?.value || '',
    heartRate: document.getElementById('modalHeartRate')?.value || '',
    respiratoryRate: document.getElementById('modalRespiratory')?.value || '',
    diagnosis: document.getElementById('modalDiagnosis')?.value || '',
    clinicalFindings: document.getElementById('modalClinicalFindings')?.value || '',
    prescription: prescriptionText,
    treatmentPlan: document.getElementById('modalTreatmentPlan')?.value || '',
    followUpDate: document.getElementById('modalFollowup')?.value || '',
    notes: document.getElementById('modalNotes')?.value || '',
    status: document.getElementById('modalStatus')?.value || 'Confirmed',
    ownerEmail: ownerEmail,
    smsReminder: document.getElementById('modalSmsReminder')?.checked || false,
    emailReminder: document.getElementById('modalEmailReminder')?.checked || false
  };
  
  const saveBtn = document.querySelector('#medicalModal .btn-primary');
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
    showToast('✅ Medical information saved successfully!', 'success');
    
    if (medicalData.emailReminder && ownerEmail) {
      sendPrescriptionEmailManual(ownerEmail, medicalData.diagnosis, prescriptionText);
    }
  } else {
    saveBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error!';
    setTimeout(() => {
      saveBtn.innerHTML = originalText;
      saveBtn.disabled = false;
    }, 2000);
    showToast('❌ Error saving medical information', 'error');
  }
}

function sendPrescriptionEmail() {
  const email = document.getElementById('modalOwnerEmail')?.value;
  const diagnosis = document.getElementById('modalDiagnosis')?.value;
  const prescription = getPrescriptionText();
  if (!email) { showToast('Enter email address', 'error'); return; }
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
  const pet = document.getElementById('summaryPetName')?.innerHTML.replace(/<[^>]*>/g, '') || 'N/A';
  const diagnosis = document.getElementById('modalDiagnosis')?.value || 'N/A';
  const prescription = getPrescriptionText() || 'No medicines prescribed';
  const temp = document.getElementById('modalTemperature')?.value || '--';
  const hr = document.getElementById('modalHeartRate')?.value || '--';
  const resp = document.getElementById('modalRespiratory')?.value || '--';
  const clinicalFindings = document.getElementById('modalClinicalFindings')?.value || '';
  const treatmentPlan = document.getElementById('modalTreatmentPlan')?.value || '';
  const followUp = document.getElementById('modalFollowup')?.value || '';
  const status = document.getElementById('modalStatus')?.value || 'Confirmed';
  const doctor = sessionStorage.getItem('doctor_name') || 'Dr. Mitesh Tripura';
  const owner = document.getElementById('summaryOwner')?.innerText || 'N/A';
  const token = document.getElementById('summaryToken')?.innerText.replace(/<[^>]*>/g, '') || 'N/A';
  const symptoms = document.getElementById('modalSymptoms')?.innerText || 'No symptoms recorded';
  const notes = document.getElementById('modalNotes')?.value || '';
  
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Medical Record - VET FOR PET CLINIC</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Times New Roman',Arial,sans-serif;padding:40px;background:white}
.print-container{max-width:800px;margin:0 auto}
.header{text-align:center;margin-bottom:30px;padding-bottom:20px;border-bottom:2px solid #f97316}
.clinic-name{font-size:28px;font-weight:800;color:#f97316}
.clinic-tagline{font-size:12px;color:#64748b;margin-bottom:15px}
.clinic-details{display:flex;justify-content:center;gap:30px;flex-wrap:wrap;font-size:11px;color:#475569;margin-top:10px}
.doc-title{text-align:center;margin:20px 0}
.doc-title h2{background:#f97316;color:white;display:inline-block;padding:8px 30px;border-radius:50px;font-size:18px}
.patient-info{background:#f8fafc;padding:15px;border-radius:12px;margin-bottom:20px;border-left:4px solid #f97316}
.section-title{background:#f1f5f9;padding:8px 15px;border-radius:8px;font-size:14px;font-weight:700;color:#f97316;margin:15px 0 10px;border-left:3px solid #f97316}
.vitals-grid{display:flex;gap:20px;margin-bottom:20px}
.vital-card{background:#f8fafc;padding:10px;border-radius:8px;text-align:center;flex:1;border:1px solid #e2e8f0}
.vital-label{font-size:11px;color:#64748b;text-transform:uppercase}
.vital-value{font-size:18px;font-weight:700;color:#f97316}
.content-box{background:#f8fafc;padding:12px 15px;border-radius:8px;margin-bottom:15px;font-size:13px;border:1px solid #e2e8f0}
.prescription-box{background:#fef3c7;padding:15px;border-radius:8px;margin-bottom:15px;border-left:3px solid #f97316}
.prescription-text{white-space:pre-wrap;font-family:monospace;font-size:12px}
.footer{margin-top:30px;padding-top:20px;text-align:center;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8}
.signature-box{margin-top:30px;display:flex;justify-content:space-between}
.signature-line{text-align:center;width:200px}
.signature-line .line{border-top:1px solid #1e293b;margin-top:40px;padding-top:5px;font-size:11px}
@media print{body{padding:20px}}
</style>
</head>
<body>
<div class="print-container">
<div class="header">
<div class="clinic-name">🐾 VET FOR PET CLINIC</div>
<div class="clinic-tagline">Advanced Veterinary Care | Compassion at Heart</div>
<div class="clinic-details"><div>📍 PCXR+55F, Titash Road, Dhaka, Bangladesh</div><div>📞 01406-779238 | 🚨 01609-420061</div><div>✉️ info@vetforpet.com</div></div></div>
<div class="doc-title"><h2>🏥 MEDICAL RECORD 🏥</h2></div>
<div class="patient-info"><strong>🐾 PATIENT INFORMATION</strong><br><br>📌 Pet Name: ${pet}<br>📌 Token ID: ${token}<br>📌 Owner Name: ${owner}<br>📌 Date: ${getBangladeshDate()}</div>
<div class="section-title">📋 Symptoms / Reason for Visit</div><div class="content-box">${symptoms}</div>
<div class="section-title">❤️ Vital Signs</div><div class="vitals-grid"><div class="vital-card"><div class="vital-label">🌡️ Temperature</div><div class="vital-value">${temp} °C</div></div><div class="vital-card"><div class="vital-label">💓 Heart Rate</div><div class="vital-value">${hr} bpm</div></div><div class="vital-card"><div class="vital-label">🌬️ Respiratory Rate</div><div class="vital-value">${resp} /min</div></div></div>
<div class="section-title">🩺 Diagnosis</div><div class="content-box">${diagnosis}</div>
${clinicalFindings ? `<div class="section-title">🔬 Clinical Findings</div><div class="content-box">${clinicalFindings.replace(/\n/g, '<br>')}</div>` : ''}
<div class="section-title">💊 Prescription / Medicines</div><div class="prescription-box"><div class="prescription-text">${prescription.replace(/\n/g, '<br>')}</div></div>
${treatmentPlan ? `<div class="section-title">📝 Treatment Plan</div><div class="content-box">${treatmentPlan.replace(/\n/g, '<br>')}</div>` : ''}
${followUp ? `<div class="section-title">📅 Follow-up Information</div><div class="content-box"><strong>Next Visit Date:</strong> ${followUp}</div>` : ''}
${notes ? `<div class="section-title">📝 Additional Notes</div><div class="content-box">${notes.replace(/\n/g, '<br>')}</div>` : ''}
<div class="section-title">✅ Appointment Status</div><div class="content-box">${status}</div>
<div class="signature-box"><div class="signature-line"><div class="line">Doctor's Signature</div></div><div class="signature-line"><div class="line">Patient's Signature</div></div></div>
<div class="footer"><p>This is a computer generated medical record. No signature required for digital copy.</p><p>Generated on: ${new Date().toLocaleString()} | For queries, contact: 01609-420061</p><p>© ${new Date().getFullYear()} VET FOR PET CLINIC | All Rights Reserved</p></div>
</div>
</body></html>`);
  printWindow.document.close();
  printWindow.print();
}

// ============================================
// PRESCRIPTION FUNCTIONS
// ============================================
function loadPrescriptionList(savedPrescription) {
  const container = document.getElementById('prescriptionList');
  if (!container) return;
  container.innerHTML = '';
  
  if (savedPrescription && savedPrescription.trim()) {
    try {
      const prescriptions = JSON.parse(savedPrescription);
      if (Array.isArray(prescriptions) && prescriptions.length) {
        prescriptions.forEach(pres => {
          addPrescriptionField(pres.name || '', pres.dosage || '', pres.duration || '');
        });
        return;
      }
    } catch(e) {
      const lines = savedPrescription.split('\n');
      lines.forEach(line => {
        const cleanLine = line.replace(/^•\s*/, '').trim();
        if (cleanLine) addPrescriptionField(cleanLine, '', '');
      });
    }
  }
  if (container.children.length === 0) addPrescriptionField('', '', '');
}

function addPrescriptionField(medName = '', dosage = '', duration = '') {
  const container = document.getElementById('prescriptionList');
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
  const container = document.getElementById('prescriptionList');
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
// PRINT FUNCTIONS
// ============================================
function printTodayAppointments() {
  const date = document.getElementById('todayDatePicker')?.value || getBangladeshDate();
  const apps = allAppointments.filter(a => a.date === date);
  if (apps.length === 0) { showToast('No appointments', 'error'); return; }
  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head><title>Today's Appointments</title><style>table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:8px}th{background:#f97316;color:white}</style></head><body><h2>VET FOR PET CLINIC - Appointments for ${date}</h2><table><thead><tr><th>Time</th><th>Pet</th><th>Owner</th><th>Token</th><th>Status</th></tr></thead><tbody>${apps.map(a => `<tr><td>${a.time}</td><td>${escapeHtml(a.petName)}</td><td>${escapeHtml(a.ownerName)}</td><td>${a.token}</td><td>${a.status||'Confirmed'}</td></tr>`).join('')}</tbody></table></body></html>`);
  w.document.close(); w.print();
}

function printAllAppointments() {
  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head><title>All Appointments</title><style>table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:8px}th{background:#f97316;color:white}</style></head><body><h2>VET FOR PET CLINIC - All Appointments</h2><p>Generated: ${new Date().toLocaleString()}</p><td><thead><tr><th>Date</th><th>Time</th><th>Pet</th><th>Owner</th><th>Token</th><th>Status</th></tr></thead><tbody>${allAppointments.map(a => `<tr><td>${a.date}</td><td>${a.time}</td><td>${escapeHtml(a.petName)}</td><td>${escapeHtml(a.ownerName)}</td><td>${a.token}</td><td>${a.status||'Confirmed'}</td></tr>`).join('')}</tbody></table></body></html>`);
  w.document.close(); w.print();
}

function printPrescriptions() {
  const prescriptions = allAppointments.filter(a => a.prescription && a.prescription !== '');
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`<!DOCTYPE html><html><head><title>Prescriptions - VET FOR PET CLINIC</title><style>body{font-family:Arial;padding:20px}.prescription{border:1px solid #ccc;padding:15px;margin-bottom:20px;border-radius:8px}</style></head><body><h2>🐾 VET FOR PET CLINIC - Prescriptions</h2>${prescriptions.map(a => `<div class="prescription"><h3>${escapeHtml(a.petName)} (${a.token})</h3><p><strong>Date:</strong> ${a.date}</p><p><strong>Diagnosis:</strong> ${escapeHtml(a.diagnosis || 'N/A')}</p><p><strong>Prescription:</strong><br>${escapeHtml(a.prescription)}</p><hr><p>Dr. ${sessionStorage.getItem('doctor_name') || 'Mitesh'}</p></div>`).join('')}</body></html>`);
  printWindow.document.close(); printWindow.print();
}

function printDoctorReport() {
  const total = document.getElementById('reportTotal')?.innerText || '0';
  const completed = document.getElementById('reportCompleted')?.innerText || '0';
  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head><title>Doctor Report</title></head><body><h2>VET FOR PET CLINIC - Doctor Performance Report</h2><p><strong>Total Patients:</strong> ${total}</p><p><strong>Completed:</strong> ${completed}</p><p><strong>Generated:</strong> ${new Date().toLocaleString()}</p></body></html>`);
  w.document.close(); w.print();
}

function editProfile() { showToast('Profile edit coming soon!', 'info'); }

// ============================================
// UI CARD GENERATORS
// ============================================
function createAppointmentCard(app) {
  const statusClass = app.status === 'Completed' ? 'completed' : (app.status === 'Cancelled' ? 'cancelled' : 'confirmed');
  return `<div class="appointment-card" onclick="viewAppointment('${app.bookingId}')">
    <div class="card-header"><span class="token">${app.token}</span><span class="status ${statusClass}">${app.status || 'Confirmed'}</span><small>⏰ ${app.time}</small></div>
    <div><strong>🐾 ${escapeHtml(app.petName)}</strong> (${escapeHtml(app.petAge||'N/A')})</div>
    <div><i class="fas fa-user"></i> ${escapeHtml(app.ownerName)} | <i class="fas fa-phone"></i> ${escapeHtml(app.ownerPhone)}</div>
    <div><strong>Symptoms:</strong> ${escapeHtml(app.symptoms||'N/A')}</div>
    ${app.diagnosis ? `<div><strong>Diagnosis:</strong> ${escapeHtml(app.diagnosis)}</div>` : ''}
    <div style="display:flex;gap:8px;margin-top:12px">
      <button class="btn-primary" onclick="event.stopPropagation(); openMedicalModal('${app.bookingId}')"><i class="fas fa-stethoscope"></i> Medical</button>
      <button class="btn-print" onclick="event.stopPropagation(); printSingleAppointment('${app.bookingId}')"><i class="fas fa-print"></i> Print</button>
    </div>
  </div>`;
}

function createHistoryItem(app) {
  const statusClass = app.status === 'Completed' ? 'completed' : (app.status === 'Cancelled' ? 'cancelled' : 'confirmed');
  return `<div class="history-item" onclick="viewAppointment('${app.bookingId}')">
    <div style="display:flex;justify-content:space-between">
      <strong>🐾 ${escapeHtml(app.petName)}</strong>
      <span class="token">${app.token}</span>
      <span class="status ${statusClass}">${app.status||'Confirmed'}</span>
    </div>
    <div>👤 ${escapeHtml(app.ownerName)} | 📞 ${escapeHtml(app.ownerPhone)} | 📅 ${app.date} | ⏰ ${app.time}</div>
    ${app.diagnosis ? `<div>🩺 ${escapeHtml(app.diagnosis)}</div>` : ''}
  </div>`;
}

function printSingleAppointment(bookingId) {
  const app = allAppointments.find(a => a.bookingId === bookingId);
  if(!app) return;
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`<!DOCTYPE html><html><head><title>Appointment - ${app.token}</title><style>body{font-family:Arial;padding:20px}.header{text-align:center}</style></head><body><div class="header"><h2>🐾 VET FOR PET CLINIC</h2><p>PCXR+55F, Titash Road, Dhaka | 📞 01406-779238</p></div><h3>Appointment Details</h3><p><strong>Token:</strong> ${app.token}<br><strong>Date:</strong> ${app.date}<br><strong>Time:</strong> ${app.time}<br><strong>Pet:</strong> ${app.petName}<br><strong>Owner:</strong> ${app.ownerName}<br><strong>Phone:</strong> ${app.ownerPhone}<br><strong>Symptoms:</strong> ${app.symptoms||'N/A'}<br><strong>Diagnosis:</strong> ${app.diagnosis||'N/A'}<br><strong>Prescription:</strong><br>${app.prescription||'N/A'}</p></body></html>`);
  printWindow.document.close(); printWindow.print();
}

// ============================================
// UTILITIES
// ============================================
function escapeHtml(t) { if(!t) return ''; const d=document.createElement('div'); d.textContent=t; return d.innerHTML; }
function showToast(msg,type) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.innerHTML = `<i class="fas fa-${type==='success'?'check-circle':'exclamation-circle'}"></i> ${msg}`;
  toast.style.background = type==='success'?'#15803d':'#ef4444';
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}
function setupModalClose() {
  document.querySelectorAll('.close-modal, .close-modal-btn').forEach(btn => {
    if (btn) btn.onclick = function() { closeMedicalModal(); closeViewModal(); closeLogoutModal(); };
  });
  window.onclick = function(e) { if(e.target.classList && e.target.classList.contains('modal')) { closeMedicalModal(); closeViewModal(); closeLogoutModal(); } };
  document.addEventListener('keydown', e => { if(e.key === 'Escape') { closeMedicalModal(); closeViewModal(); closeLogoutModal(); } });
}
function showLogoutModal() { const m = document.getElementById('logoutModal'); if(m) { m.classList.add('show'); m.style.display = 'flex'; } }
function closeLogoutModal() { const m = document.getElementById('logoutModal'); if(m) { m.classList.remove('show'); m.style.display = 'none'; } }
function confirmLogout() { sessionStorage.clear(); window.location.href = 'doctor-login.html'; }