async function submitEnquiry() {
  const name     = document.getElementById('formName').value.trim();
  const contact  = document.getElementById('formContact').value.trim();
  const dept     = document.getElementById('formDept').value;
  const caseNo   = document.getElementById('formCaseNo').value.trim();
  const message  = document.getElementById('formMessage').value.trim();
  const honeypot = document.getElementById('formHoneypot').value;
  const status   = document.getElementById('formStatus');
  const btn      = document.getElementById('submitBtn');

  // Bot check — a real visitor never fills this hidden field
  if (honeypot) { console.warn('Enquiry blocked: honeypot field was filled (likely a bot).'); return; }

  if (!name || !contact) {
    status.style.display = 'block';
    status.style.color   = '#EF4444';
    status.textContent   = '⚠️ Please fill in your Name and Contact Number.';
    return;
  }

  const digitsOnly = contact.replace(/\D/g, '');
  if (digitsOnly.length < 10) {
    status.style.display = 'block';
    status.style.color   = '#EF4444';
    status.textContent   = '⚠️ Please enter a valid contact number.';
    return;
  }

  btn.textContent  = 'Submitting...';
  btn.disabled     = true;
  status.style.display = 'none';

  try {
    const { error } = await sb.from('enquiries').insert({
      name: name.slice(0, 80),
      contact: contact.slice(0, 15),
      department: dept,
      case_no: caseNo.slice(0, 40),
      message: message.slice(0, 1000)
    });
    if (error) throw error;

    status.style.display = 'block';
    status.style.color   = '#4ADE80';
    status.textContent   = '✅ Enquiry submitted successfully! We will contact you soon.';
    btn.textContent      = 'Submitted ✓';

    // Clear form
    ['formName','formContact','formCaseNo','formMessage'].forEach(id => document.getElementById(id).value='');
    document.getElementById('formDept').value = '';

    setTimeout(()=>{ btn.textContent='Submit Enquiry'; btn.disabled=false; status.style.display='none'; }, 5000);

  } catch(e) {
    console.error('Enquiry submission error:', e);
    status.style.display = 'block';
    status.style.color   = '#EF4444';
    status.textContent   = '⚠️ Submission failed. Please email us directly at districtlitigationofficekupwar@gmail.com.';
    btn.textContent      = 'Submit Enquiry';
    btn.disabled         = false;
  }
}

async function pageInit(){
  await fetchSheetData();
  checkAlerts();
  updateTicker();
}
document.addEventListener('DOMContentLoaded', pageInit);
