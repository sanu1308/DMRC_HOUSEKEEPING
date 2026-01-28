// Configuration
// NOTE:
// - API_BASE_URL and auth helpers (isAuthenticated, getCurrentUser, authFetch)
//   are defined in assets/js/auth.js, which is loaded before this file.

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
  checkAuthentication();
  displayUserInfo();
  loadDashboardData();
  setupFormListeners();
  populateStations();
  populateChemicals();
  setTodayDate();
  loadHistory();
  loadSection('overview');
  setupChemicalUsageModal();
  setupUserPestControlModal();
  setupMachineryUsageModal();
});

/**
 * Check if user is authenticated and is user role
 */
function checkAuthentication() {
  if (!isAuthenticated()) {
    window.location.href = 'login.html';
    return;
  }

  const user = getCurrentUser();
  if (user.role !== 'user') {
    window.location.href = 'admin-dashboard.html';
  }
}

/**
 * Display user information
 */
function displayUserInfo() {
  const user = getCurrentUser();
  const userInfoDiv = document.getElementById('userInfo');
  userInfoDiv.innerHTML = `<span>Welcome, ${user.name}!</span>`;
}

/**
 * Load initial dashboard data
 */
async function loadDashboardData() {
  try {
    const response = await authFetch(`${API_BASE_URL}/housekeeping-logs/user/my-logs`);
    const data = await response.json();
    const logs = data.data || [];

    document.getElementById('totalSubmissions').textContent = logs.length;

    // Count today's submissions
    const today = new Date().toISOString().split('T')[0];
    const todayCount = logs.filter(log => log.date === today).length;
    document.getElementById('todaySubmissions').textContent = todayCount;
  } catch (error) {
    console.error('Error loading dashboard data:', error);
  }
}

/**
 * Load a specific section
 */
function loadSection(section) {
  // Hide all sections
  document.querySelectorAll('.content-section').forEach(el => el.style.display = 'none');
  
  // Update menu
  document.querySelectorAll('.menu-link').forEach(el => el.classList.remove('active'));
  document.querySelector(`[data-section="${section}"]`).classList.add('active');

  // Show selected section - HTML uses ids like "overviewSection", "housekeepingSection" etc.
  const sectionId = `${section}Section`;
  const target = document.getElementById(sectionId);
  if (target) {
    target.style.display = 'block';
  }

  // Load data for section
  if (section === 'overview') {
    loadDashboardData();
    loadHistory();
  } else if (section === 'chemicals') {
    loadChemicalUsage();
  } else if (section === 'machinery') {
    loadMachineryOverview();
  } else if (section === 'pest-control') {
    loadPestControlOverview();
  }
}

/**
 * Populate station select
 */
async function populateStations() {
  try {
    const response = await authFetch(`${API_BASE_URL}/stations`);
    const data = await response.json();
    const stations = data.data || [];

    const select = document.getElementById('station');
    if (!stations.length) {
      select.innerHTML = '<option value="">No stations available – contact your admin</option>';
      return;
    }

    select.innerHTML = '<option value="">Select a station</option>';

    stations.forEach(station => {
      const option = document.createElement('option');
      option.value = station.id;
      option.textContent = station.station_name;
      select.appendChild(option);
    });
  } catch (error) {
    console.error('Error loading stations:', error);
    const select = document.getElementById('station');
    if (select) {
      select.innerHTML = '<option value="">Error loading stations</option>';
    }
  }
}

/**
 * Populate chemicals select
 */
async function populateChemicals() {
  try {
    const response = await authFetch(`${API_BASE_URL}/chemicals`);
    const data = await response.json();
    const chemicals = data.data || [];

    const select = document.getElementById('chemicalUsed');
    if (!chemicals.length) {
      select.innerHTML = '<option value="">No chemicals configured (optional)</option>';
      return;
    }

    select.innerHTML = '<option value="">Select a chemical (optional)</option>';

    chemicals.forEach(chemical => {
      const option = document.createElement('option');
      option.value = chemical.id;
      option.textContent = `${chemical.chemical_name} (${chemical.measuring_unit})`;
      select.appendChild(option);
    });
  } catch (error) {
    console.error('Error loading chemicals:', error);
    const select = document.getElementById('chemicalUsed');
    if (select) {
      select.innerHTML = '<option value="">Error loading chemicals</option>';
    }
  }
}

/**
 * Set today's date in date input
 */
function setTodayDate() {
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('date').value = today;
}

/**
 * Setup form listeners
 */
function setupFormListeners() {
  document.getElementById('housekeepingForm').addEventListener('submit', handleFormSubmit);
  const filter = document.getElementById('filterDate');
  if (filter) {
    filter.addEventListener('change', filterHistory);
  }
}

// ==================== MODALS (USER) ====================

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('show');
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('show');
  }
}

function setupChemicalUsageModal() {
  const form = document.getElementById('chemicalUsageForm');
  if (!form) return;

  form.addEventListener('submit', handleChemicalUsageSubmit);
}

async function handleChemicalUsageSubmit(e) {
  e.preventDefault();

  const category = document.getElementById('chemicalUsageCategory').value;
  const chemicalName = document.getElementById('chemicalUsageChemical').value;
  const quantity = document.getElementById('chemicalUsageQuantity').value;
  const unit = document.getElementById('chemicalUsageUnit').value;
  const usageDate = document.getElementById('chemicalUsageDate').value;
  const notes = document.getElementById('chemicalUsageNotes').value;

  if (!category || !chemicalName || !quantity || !unit || !usageDate) {
    showMessage('error', 'Please fill all required chemical usage fields.');
    return;
  }

  const payload = {
    chemical_name: chemicalName,
    quantity: parseFloat(quantity),
    unit,
    // Map category to area/category label
    area: category,
    // Default shift for now; can be extended later
    shift: 'Day',
    usage_date: usageDate,
    notes: notes || null
  };

  try {
    const response = await authFetch(`${API_BASE_URL}/chemical-usage`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      showMessage('error', result.message || 'Failed to add chemical usage record.');
      return;
    }

    showMessage('success', 'Chemical usage record added successfully.');
    closeModal('chemicalUsageModal');
    e.target.reset();
    loadChemicalUsage();
  } catch (error) {
    console.error('Error adding chemical usage record:', error);
    showMessage('error', 'Server error. Please try again later.');
  }
}

function setupUserPestControlModal() {
  const form = document.getElementById('userPestControlForm');
  if (!form) return;

  form.addEventListener('submit', handleUserPestControlSubmit);
  populateUserPestStations();
}

async function populateUserPestStations() {
  try {
    const select = document.getElementById('userPestStation');
    if (!select) return;

    const response = await authFetch(`${API_BASE_URL}/stations`);
    const data = await response.json();
    const stations = data.data || [];

    if (!stations.length) {
      select.innerHTML = '<option value="">No stations available – contact your admin</option>';
      return;
    }

    select.innerHTML = '<option value="">Select a station</option>';
    stations.forEach(station => {
      const option = document.createElement('option');
      option.value = station.id;
      option.textContent = station.station_name;
      select.appendChild(option);
    });
  } catch (error) {
    console.error('Error loading stations for pest control modal:', error);
  }
}

async function handleUserPestControlSubmit(e) {
  e.preventDefault();

  const shift = document.getElementById('userPestShift').value;
  const pestType = document.getElementById('userPestType').value;
  const method = document.getElementById('userPestMethod').value;
  const chemical = document.getElementById('userPestChemical').value;
  const quantity = document.getElementById('userPestQuantity').value;
  const unit = document.getElementById('userPestUnit').value;
  const stationId = document.getElementById('userPestStation').value;
  const area = document.getElementById('userPestArea').value;
  const date = document.getElementById('userPestDate').value;
  const notes = document.getElementById('userPestNotes').value;

  if (!shift || !pestType || !method || !chemical || !quantity || !unit || !stationId || !area || !date) {
    showMessage('error', 'Please fill all required pest control fields.');
    return;
  }

  const payload = {
    shift,
    pest_type: pestType,
    control_method: method,
    chemical_used: chemical,
    measuring_unit: unit,
    quantity_used: parseFloat(quantity),
    station_id: parseInt(stationId, 10),
    area_covered: area,
    service_date: date,
    date,
    pest_control_type: pestType,
    status: 'Completed',
    notes: notes || null
  };

  try {
    const response = await authFetch(`${API_BASE_URL}/pest-control`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      showMessage('error', result.message || 'Failed to add pest control record.');
      return;
    }

    showMessage('success', 'Pest control record added successfully.');
    closeModal('userPestControlModal');
    e.target.reset();
    loadPestControlOverview();
  } catch (error) {
    console.error('Error adding pest control record:', error);
    showMessage('error', 'Server error. Please try again later.');
  }
}

function setupMachineryUsageModal() {
  const form = document.getElementById('machineryUsageForm');
  if (!form) return;

  form.addEventListener('submit', handleMachineryUsageSubmit);
}

async function handleMachineryUsageSubmit(e) {
  e.preventDefault();

  const machineType = document.getElementById('machineryUsageType').value;
  const machineName = document.getElementById('machineryUsageName').value;
  const hours = document.getElementById('machineryUsageHours').value;
  const status = document.getElementById('machineryUsageStatus').value;
  const usageDate = document.getElementById('machineryUsageDate').value;
  const shift = document.getElementById('machineryUsageShift').value;
  const notes = document.getElementById('machineryUsageNotes').value;

  if (!machineType || !machineName || !hours || !status || !usageDate || !shift) {
    showMessage('error', 'Please fill all required machinery usage fields.');
    return;
  }

  const payload = {
    machine_type: machineType,
    machine_name: machineName,
    usage_hours: parseFloat(hours),
    status,
    usage_date: usageDate,
    shift,
    notes: notes || null
  };

  try {
    const response = await authFetch(`${API_BASE_URL}/machinery-usage`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (!response.ok) {
      showMessage('error', result.message || 'Failed to add machinery usage record.');
      return;
    }

    showMessage('success', 'Machinery usage record added successfully.');
    closeModal('machineryUsageModal');
    e.target.reset();
  } catch (error) {
    console.error('Error adding machinery usage record:', error);
    showMessage('error', 'Server error. Please try again later.');
  }
}

/**
 * Handle housekeeping form submission
 */
async function handleFormSubmit(e) {
  e.preventDefault();

  const data = {
    station_id: parseInt(document.getElementById('station').value),
    chemical_id: document.getElementById('chemicalUsed').value ? parseInt(document.getElementById('chemicalUsed').value) : null,
    cleaning_type: document.getElementById('cleaningType').value,
    cleaning_area: document.getElementById('cleaningArea').value,
    date: document.getElementById('date').value,
    time: document.getElementById('time').value,
    remarks: document.getElementById('remarks').value || null
  };

  try {
    const response = await authFetch(`${API_BASE_URL}/housekeeping-logs`, {
      method: 'POST',
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (response.ok) {
      showMessage('success', 'Housekeeping details submitted successfully!');
      document.getElementById('housekeepingForm').reset();
      setTodayDate();
      loadDashboardData();
    } else {
      showMessage('error', result.message || 'Failed to submit. Please try again.');
    }
  } catch (error) {
    console.error('Error:', error);
    showMessage('error', 'Server error. Please try again later.');
  }
}

/**
 * Load chemical usage table (based on housekeeping logs with a chemical_id)
 */
async function loadChemicalUsage() {
  try {
    const from = document.getElementById('chemicalsFromDate')?.value;
    const to = document.getElementById('chemicalsToDate')?.value;

    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);

    const response = await authFetch(`${API_BASE_URL}/chemical-usage?${params.toString()}`);
    const data = await response.json();
    const records = data.data || [];

    const tbody = document.querySelector('#chemicalsTable tbody');
    tbody.innerHTML = '';

    if (!records.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 2rem;">No chemical usage records found.</td></tr>';
      return;
    }

    records.forEach(record => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${new Date(record.usage_date).toLocaleDateString()}</td>
        <td>${record.chemical_name}</td>
        <td>${record.quantity}</td>
        <td>${record.unit}</td>
        <td>${record.shift}</td>
        <td>${record.area}</td>
      `;
      tbody.appendChild(row);
    });
  } catch (error) {
    console.error('Error loading chemical usage:', error);
  }
}

/**
 * Load machinery overview (read-only from machinery master data)
 */
async function loadMachineryOverview() {
  try {
    const response = await authFetch(`${API_BASE_URL}/machinery`);
    const data = await response.json();
    const machinery = data.data || [];

    const tbody = document.querySelector('#machineryTable tbody');
    tbody.innerHTML = '';

    if (!machinery.length) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 2rem;">No machinery configured.</td></tr>';
      return;
    }

    machinery.forEach(item => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${item.machinery_name}</td>
        <td>${item.number_of_days}</td>
        <td>${item.station_name || 'N/A'}</td>
        <td>${new Date(item.created_at).toLocaleDateString()}</td>
      `;
      tbody.appendChild(row);
    });
  } catch (error) {
    console.error('Error loading machinery overview:', error);
  }
}

/**
 * Load pest control overview (read-only from pest_control master data)
 */
async function loadPestControlOverview() {
  try {
    const response = await authFetch(`${API_BASE_URL}/pest-control`);
    const data = await response.json();
    const records = data.data || [];

    const tbody = document.querySelector('#pestControlTable tbody');
    tbody.innerHTML = '';

    if (!records.length) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 2rem;">No pest control records configured.</td></tr>';
      return;
    }

    records.forEach(record => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${new Date(record.date).toLocaleDateString()}</td>
        <td>${record.pest_control_type}</td>
        <td>${record.chemical_used}</td>
        <td>${record.quantity_used} ${record.measuring_unit}</td>
        <td>${record.station_name || 'N/A'}</td>
      `;
      tbody.appendChild(row);
    });
  } catch (error) {
    console.error('Error loading pest control overview:', error);
  }
}

/**
 * Load submission history
 */
async function loadHistory() {
  try {
    const response = await authFetch(`${API_BASE_URL}/housekeeping-logs/user/my-logs`);
    const data = await response.json();
    const logs = data.data || [];

    const tbody = document.querySelector('#historyTable tbody');
    tbody.innerHTML = '';

    if (logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">No submissions found.</td></tr>';
      return;
    }

    logs.forEach(log => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${new Date(log.date).toLocaleDateString()}</td>
        <td>${log.time}</td>
        <td>${log.station_name || 'N/A'}</td>
        <td>${log.cleaning_type}</td>
        <td>${log.cleaning_area}</td>
        <td>${log.remarks || '-'}</td>
      `;
      tbody.appendChild(row);
    });
  } catch (error) {
    console.error('Error loading history:', error);
    showMessage('error', 'Failed to load submission history.');
  }
}

/**
 * Filter history by date
 */
async function filterHistory() {
  const filterDate = document.getElementById('filterDate').value;

  try {
    const response = await authFetch(`${API_BASE_URL}/housekeeping-logs/user/my-logs?date=${filterDate}`);
    const data = await response.json();
    const logs = data.data || [];

    const tbody = document.querySelector('#historyTable tbody');
    tbody.innerHTML = '';

    if (logs.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 2rem;">No submissions found for this date.</td></tr>';
      return;
    }

    logs.forEach(log => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${new Date(log.date).toLocaleDateString()}</td>
        <td>${log.time}</td>
        <td>${log.station_name || 'N/A'}</td>
        <td>${log.cleaning_type}</td>
        <td>${log.cleaning_area}</td>
        <td>${log.remarks || '-'}</td>
      `;
      tbody.appendChild(row);
    });
  } catch (error) {
    console.error('Error filtering history:', error);
    showMessage('error', 'Failed to filter submissions.');
  }
}

/**
 * Show message
 */
function showMessage(type, message) {
  const messageDiv = document.getElementById('message');
  messageDiv.textContent = message;
  messageDiv.classList.add('show', type);
  
  setTimeout(() => {
    messageDiv.classList.remove('show', type);
  }, 3000);
}
