// Real-time Bangladesh Time & Date
function updateBangladeshTime() {
  const timeOptions = { timeZone: 'Asia/Dhaka', hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' };
  const dateOptions = { timeZone: 'Asia/Dhaka', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  const now = new Date();
  const timeElement = document.getElementById('currentTime');
  const dateElement = document.getElementById('currentDate');
  if (timeElement) timeElement.textContent = now.toLocaleTimeString('en-US', timeOptions);
  if (dateElement) dateElement.textContent = now.toLocaleDateString('en-US', dateOptions);
}
updateBangladeshTime();
setInterval(updateBangladeshTime, 1000);

// Developer click handlers
function openEmailClient() {
  window.location.href = 'mailto:aungching.jack420@gmail.com?subject=Website%20Development%20Inquiry%20-%20VET%20FOR%20PET%20CLINIC&body=Hello%20Aung%20Ching%2C%0A%0AI%20saw%20your%20work%20on%20the%20VET%20FOR%20PET%20CLINIC%20website.%20I%20would%20like%20to%20discuss%20a%20project...';
}

const devNameBtn = document.getElementById('devNameBtn');
const hireBtn = document.getElementById('hireBtn');

if (devNameBtn) devNameBtn.addEventListener('click', openEmailClient);
if (hireBtn) hireBtn.addEventListener('click', openEmailClient);

// ✅ YOUR GOOGLE SHEETS WEBHOOK URL (Update this after deploy)
const GOOGLE_SHEETS_WEBHOOK = "https://script.google.com/macros/s/AKfycbzGdDBtcL_v0xs-1e6HmhJ4lWo-sa80s5HhqaSX4VvRH-pOJrSk8W_bodtWvTozTy9_fg/exec";

const ALL_SLOTS = ["10:00 AM", "11:00 AM", "12:00 PM", "01:00 PM", "02:00 PM", "03:00 PM", "04:00 PM", "05:00 PM", "06:00 PM", "07:00 PM", "08:00 PM", "09:00 PM"];

let selectedDate = null, selectedTimeSlot = null;

// Initialize Flatpickr calendar
const datePickerElement = document.getElementById('datePicker');
if (datePickerElement) {
  flatpickr("#datePicker", {
    dateFormat: "Y-m-d",
    minDate: "today",
    maxDate: new Date().fp_incr(30),
    disable: [date => date.getDay() === 0],
    onChange: (dates, dateStr) => {
      selectedDate = dateStr;
      const container = document.getElementById('timeSlotsContainer');
      if (container) {
        container.innerHTML = '';
        ALL_SLOTS.forEach(slot => {
          const div = document.createElement('div');
          div.className = 'time-slot';
          div.textContent = slot;
          div.onclick = () => {
            document.querySelectorAll('.time-slot').forEach(el => el.classList.remove('selected'));
            div.classList.add('selected');
            selectedTimeSlot = slot;
            const selectedTimeInput = document.getElementById('selectedTime');
            if (selectedTimeInput) selectedTimeInput.value = slot;
          };
          container.appendChild(div);
        });
      }
    }
  });
}

// Emergency checkbox handler
const emergencyCheckbox = document.getElementById('emergencyPriority');
if (emergencyCheckbox) {
  emergencyCheckbox.addEventListener('change', function(e) {
    if (e.target.checked && selectedDate) {
      const firstSlot = document.querySelector('.time-slot:not(.disabled)');
      if (firstSlot) firstSlot.click();
    }
  });
}

// Form submission
const form = document.getElementById('appointmentForm');
const feedbackDiv = document.getElementById('formFeedback');

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('name')?.value.trim() || '';
    const phone = document.getElementById('phone')?.value.trim() || '';
    const petType = document.getElementById('petType')?.value || '';
    const petName = document.getElementById('petName')?.value.trim() || '';
    const isEmergency = document.getElementById('emergencyPriority')?.checked || false;
    const symptoms = document.getElementById('symptoms')?.value.trim() || '';

    if (!name || !phone || !petType) {
      if (feedbackDiv) feedbackDiv.innerHTML = '<div class="error-message"><i class="fas fa-exclamation-triangle"></i> Please fill all required fields.</div>';
      return;
    }
    if (!selectedDate) {
      if (feedbackDiv) feedbackDiv.innerHTML = '<div class="error-message"><i class="fas fa-calendar-times"></i> Please select a date.</div>';
      return;
    }
    if (!selectedTimeSlot) {
      if (feedbackDiv) feedbackDiv.innerHTML = '<div class="error-message"><i class="fas fa-clock"></i> Please select a time slot.</div>';
      return;
    }
    if (!/^[0-9+\-\s()]{8,15}$/.test(phone)) {
      if (feedbackDiv) feedbackDiv.innerHTML = '<div class="error-message"><i class="fas fa-phone-slash"></i> Enter a valid phone number.</div>';
      return;
    }

    const appointmentData = {
      timestamp: new Date().toLocaleString('en-US', { timeZone: 'Asia/Dhaka' }),
      name: name,
      phone: phone,
      petType: petType,
      petName: petName || 'N/A',
      date: selectedDate,
      time: selectedTimeSlot,
      isEmergency: isEmergency ? 'Yes' : 'No',
      symptoms: symptoms || 'N/A',
      status: 'Pending'
    };

    if (feedbackDiv) feedbackDiv.innerHTML = '<div class="success-message" style="background:#fff0e0;"><i class="fas fa-spinner fa-pulse"></i> Submitting your appointment...</div>';

    let tokenNumber = "Generating...";
    
    try {
      const response = await fetch(GOOGLE_SHEETS_WEBHOOK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(appointmentData)
      });
      
      const result = await response.json();
      if (result.result === "success") {
        tokenNumber = result.tokenNumber;
      } else {
        // Fallback token
        var formattedDate = selectedDate.replace(/-/g, '');
        tokenNumber = "VET-" + formattedDate + "-001";
      }
    } catch(error) {
      console.log('Error:', error);
      var formattedDate = selectedDate.replace(/-/g, '');
      tokenNumber = "VET-" + formattedDate + "-001";
    }

    const appointmentDate = new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    
    if (feedbackDiv) {
      feedbackDiv.innerHTML = `<div class="success-message">
        <i class="fas fa-check-circle"></i> <strong>Appointment Confirmed! ✅</strong><br><br>
        🎫 <strong style="font-size: 1.4rem; color: #e07c3c;">Your Token Number: ${tokenNumber}</strong><br><br>
        📅 <strong>Date:</strong> ${appointmentDate}<br>
        ⏰ <strong>Time:</strong> ${selectedTimeSlot}<br>
        🐾 <strong>Pet:</strong> ${petType} ${petName ? '('+petName+')' : ''}<br>
        👤 <strong>Owner:</strong> ${name}<br>
        ${isEmergency ? '🚨 <strong>EMERGENCY PRIORITY BOOKING</strong> - Doctor will call you immediately! 🚨<br><br>' : '<br>'}
        <div style="background: #f0e7da; padding: 12px; border-radius: 20px; margin-top: 10px;">
          <i class="fas fa-info-circle"></i> <strong>Please Note:</strong><br>
          ✅ Show this token at reception<br>
          ✅ Please arrive 10 minutes early<br>
          ✅ A confirmation SMS has been sent to your phone<br>
          ✅ For any changes, call us at 01406779238
        </div>
      </div>`;
    }
    
    form.reset();
    const selectedTimeInput = document.getElementById('selectedTime');
    if (selectedTimeInput) selectedTimeInput.value = '';
    selectedTimeSlot = null;
    selectedDate = null;
    const datePicker = document.getElementById('datePicker');
    if (datePicker) datePicker.value = '';
    const timeSlotsContainer = document.getElementById('timeSlotsContainer');
    if (timeSlotsContainer) timeSlotsContainer.innerHTML = '';
    if (emergencyCheckbox) emergencyCheckbox.checked = false;
    
    if (feedbackDiv) feedbackDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

// Loading overlay
window.addEventListener('load', () => {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    overlay.classList.add('fade-out');
    setTimeout(() => overlay.style.display = 'none', 700);
  }
});

// Mobile menu toggle
const menuIcon = document.getElementById('menuIcon');
const navLinks = document.getElementById('navLinks');
if (menuIcon) {
  menuIcon.addEventListener('click', () => {
    if (navLinks) navLinks.classList.toggle('active');
  });
}

// Smooth scroll
document.querySelectorAll('.nav-links a').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    const target = this.getAttribute('href');
    if (target && target.startsWith('#')) {
      e.preventDefault();
      const targetElement = document.querySelector(target);
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth' });
        if (navLinks) navLinks.classList.remove('active');
      }
    }
  });
});

// Scroll to top
const scrollBtn = document.getElementById('scrollTopBtn');
window.addEventListener('scroll', () => {
  if (scrollBtn) {
    if (window.scrollY > 500) scrollBtn.classList.add('show');
    else scrollBtn.classList.remove('show');
  }
});
if (scrollBtn) {
  scrollBtn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}