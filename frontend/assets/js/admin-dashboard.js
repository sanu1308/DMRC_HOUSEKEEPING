// API base URL for backend
const API_BASE_URL = 'http://localhost:5000/api';

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
  checkAuthentication();
  displayUserInfo();
  loadDashboardData();
  setupFormListeners();
});

/**
 * Check if user is authenticated and is super admin
 */
function checkAuthentication() {
  if (!isAuthenticated()) {
    window.location.href = 'login.html';
    return;
  }

  const user = getCurrentUser();
  if (user.role !== 'superadmin') {
    window.location.href = 'user-dashboard.html';
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
  const fetchAPI = async (endpoint) => {
    const response = await authFetch(`${API_BASE_URL}${endpoint}`);
    const data = await response.json();
    return data.data || [];
  };

  try {
    const [stations, chemicals, machinery, logs] = await Promise.all([
      fetchAPI('/stations'),
      fetchAPI('/chemicals'),
      fetchAPI('/machinery'),
      fetchAPI('/housekeeping-logs')
    ]);

    document.getElementById('stationCount').textContent = stations?.length || 0;
    document.getElementById('chemicalCount').textContent = chemicals?.length || 0;
    document.getElementById('machineryCount').textContent = machinery?.length || 0;
    document.getElementById('logCount').textContent = logs?.length || 0;

    // Populate station selects
    populateStationSelects(stations);
  } catch (error) {
    console.error('Error loading dashboard data:', error);
  }
}

/**
 * Populate station select dropdowns
 */
async function populateStationSelects(stations = null) {
  const fetchAPI = async (endpoint) => {
    const response = await authFetch(`${API_BASE_URL}${endpoint}`);
    const data = await response.json();
    return data.data || [];
  };

  if (!stations) {
    stations = await fetchAPI('/stations');
  }

  const selects = ['machineryStation', 'pestStation'];
  selects.forEach(selectId => {
    const select = document.getElementById(selectId);
    if (select) {
      select.innerHTML = '<option value="">Select a station</option>';
      stations.forEach(station => {
        const option = document.createElement('option');
        option.value = station.id;
        option.textContent = station.station_name;
        select.appendChild(option);
      });
    }
  });
}

/**
 * Load a specific section
 */
async function loadSection(section) {
  // Hide all sections
  document.querySelectorAll('.content-section').forEach(el => el.style.display = 'none');
  
  // Update menu
  document.querySelectorAll('.menu-link').forEach(el => el.classList.remove('active'));
  document.querySelector(`[data-section="${section}"]`).classList.add('active');

  // Show selected section
  const sectionId = section.charAt(0).toUpperCase() + section.slice(1).replace('-', '');
  document.getElementById(sectionId + 'Section').style.display = 'block';

  // Load data for section
  switch(section) {
    case 'stations':
      await loadStations();
      break;
    case 'chemicals':
      await loadChemicals();
      break;
    case 'machinery':
      await loadMachinery();
      break;
    case 'staff':
      await loadStaff();
      break;
    case 'pest-control':
      await loadPestControl();
      break;
    case 'logs':
      await loadLogs();
      break;
  }
}

/**
 * Load and display stations
 */
async function loadStations() {
  const fetchAPI = async (endpoint) => {
    const response = await authFetch(`${API_BASE_URL}${endpoint}`);
    const data = await response.json();
    return data.data || [];
  };

  try {
    const stations = await fetchAPI('/stations');
    const tbody = document.querySelector('#stationsTable tbody');
    tbody.innerHTML = '';

    stations.forEach(station => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${station.station_name}</td>
        <td>${station.station_code}</td>
        <td>${new Date(station.created_at).toLocaleDateString()}</td>
        <td>
          <button class="btn-action btn-edit" onclick="editStation(${station.id})">Edit</button>
          <button class="btn-action btn-delete" onclick="deleteStation(${station.id})">Delete</button>
        </td>
      `;
      tbody.appendChild(row);
    });
  } catch (error) {
    console.error('Error loading stations:', error);
    showMessage('error', 'Failed to load stations.');
  }
}

/**
 * Load and display chemicals
 */
async function loadChemicals() {
  const fetchAPI = async (endpoint) => {
    const response = await authFetch(`${API_BASE_URL}${endpoint}`);
    const data = await response.json();
    return data.data || [];
  };

  try {
    const chemicals = await fetchAPI('/chemicals');
    const tbody = document.querySelector('#chemicalsTable tbody');
    tbody.innerHTML = '';

    chemicals.forEach(chemical => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${chemical.chemical_name}</td>
        <td>${chemical.measuring_unit}</td>
        <td>${chemical.quantity}</td>
        <td>${chemical.monthly_quantity}</td>
        <td>${chemical.daily_utilized}</td>
        <td>
          <button class="btn-action btn-edit" onclick="editChemical(${chemical.id})">Edit</button>
          <button class="btn-action btn-delete" onclick="deleteChemical(${chemical.id})">Delete</button>
        </td>
      `;
      tbody.appendChild(row);
    });
  } catch (error) {
    console.error('Error loading chemicals:', error);
    showMessage('error', 'Failed to load chemicals.');
  }
}

/**
 * Load and display machinery
 */
async function loadMachinery() {
  const fetchAPI = async (endpoint) => {
    const response = await authFetch(`${API_BASE_URL}${endpoint}`);
    const data = await response.json();
    return data.data || [];
  };

  try {
    const machinery = await fetchAPI('/machinery');
    const tbody = document.querySelector('#machineryTable tbody');
    tbody.innerHTML = '';

    machinery.forEach(item => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${item.machinery_name}</td>
        <td>${item.number_of_days}</td>
        <td>${item.station_name || 'N/A'}</td>
        <td>${new Date(item.created_at).toLocaleDateString()}</td>
        <td>
          <button class="btn-action btn-edit" onclick="editMachinery(${item.id})">Edit</button>
          <button class="btn-action btn-delete" onclick="deleteMachinery(${item.id})">Delete</button>
        </td>
      `;
      tbody.appendChild(row);
    });
  } catch (error) {
    console.error('Error loading machinery:', error);
    showMessage('error', 'Failed to load machinery.');
  }
}

/**
 * Load and display staff
 */
async function loadStaff() {
  const fetchAPI = async (endpoint) => {
    const response = await authFetch(`${API_BASE_URL}${endpoint}`);
    const data = await response.json();
    return data.data || [];
  };

  try {
    const staff = await fetchAPI('/staff');
    const tbody = document.querySelector('#staffTable tbody');
    tbody.innerHTML = '';

    staff.forEach(record => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${new Date(record.date).toLocaleDateString()}</td>
        <td>${record.station_name}</td>
        <td>${record.shift}</td>
        <td>${record.manpower}</td>
        <td>${record.number_of_persons}</td>
        <td>
          <button class="btn-action btn-edit" onclick="editStaff(${record.id})">Edit</button>
          <button class="btn-action btn-delete" onclick="deleteStaff(${record.id})">Delete</button>
        </td>
      `;
      tbody.appendChild(row);
    });
  } catch (error) {
    console.error('Error loading staff:', error);
    showMessage('error', 'Failed to load staff records.');
  }
}

/**
 * Load and display pest control
 */
async function loadPestControl() {
  const fetchAPI = async (endpoint) => {
    const response = await authFetch(`${API_BASE_URL}${endpoint}`);
    const data = await response.json();
    return data.data || [];
  };

  try {
    const records = await fetchAPI('/pest-control');
    const tbody = document.querySelector('#pestControlTable tbody');
    tbody.innerHTML = '';

    records.forEach(record => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${new Date(record.date).toLocaleDateString()}</td>
        <td>${record.pest_control_type}</td>
        <td>${record.chemical_used}</td>
        <td>${record.quantity_used} ${record.measuring_unit}</td>
        <td>${record.station_name || 'N/A'}</td>
        <td>
          <button class="btn-action btn-edit" onclick="editPestControl(${record.id})">Edit</button>
          <button class="btn-action btn-delete" onclick="deletePestControl(${record.id})">Delete</button>
        </td>
      `;
      tbody.appendChild(row);
    });
  } catch (error) {
    console.error('Error loading pest control:', error);
    showMessage('error', 'Failed to load pest control records.');
  }
}

/**
 * Load and display housekeeping logs
 */
async function loadLogs() {
  const fetchAPI = async (endpoint) => {
    const response = await authFetch(`${API_BASE_URL}${endpoint}`);
    const data = await response.json();
    return data.data || [];
  };

  try {
    const logs = await fetchAPI('/housekeeping-logs');
    const tbody = document.querySelector('#logsTable tbody');
    tbody.innerHTML = '';

    logs.forEach(log => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${new Date(log.date).toLocaleDateString()}</td>
        <td>${log.time}</td>
        <td>${log.user_name || 'N/A'}</td>
        <td>${log.station_name || 'N/A'}</td>
        <td>${log.cleaning_type}</td>
        <td>${log.cleaning_area}</td>
        <td>${log.remarks || '-'}</td>
      `;
      tbody.appendChild(row);
    });
  } catch (error) {
    console.error('Error loading logs:', error);
    showMessage('error', 'Failed to load housekeeping logs.');
  }
}

/**
 * Setup form listeners
 */
function setupFormListeners() {
  document.getElementById('stationForm').addEventListener('submit', handleStationSubmit);
  document.getElementById('chemicalForm').addEventListener('submit', handleChemicalSubmit);
  document.getElementById('machineryForm').addEventListener('submit', handleMachinerySubmit);
  document.getElementById('staffForm').addEventListener('submit', handleStaffSubmit);
  document.getElementById('pestControlForm').addEventListener('submit', handlePestControlSubmit);
}

/**
 * Handle station form submission
 */
async function handleStationSubmit(e) {
  e.preventDefault();

  const data = {
    station_name: document.getElementById('stationName').value,
    station_code: document.getElementById('stationCode').value
  };

  try {
    const response = await authFetch(`${API_BASE_URL}/stations`, {
      method: 'POST',
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (response.ok) {
      showMessage('success', 'Station added successfully!');
      closeModal('stationModal');
      document.getElementById('stationForm').reset();
      loadStations();
    } else {
      showMessage('error', result.message || 'Failed to add station.');
    }
  } catch (error) {
    console.error('Error:', error);
    showMessage('error', 'Server error.');
  }
}

/**
 * Handle chemical form submission
 */
async function handleChemicalSubmit(e) {
  e.preventDefault();

  const data = {
    chemical_name: document.getElementById('chemicalName').value,
    measuring_unit: document.getElementById('chemicalUnit').value,
    quantity: parseInt(document.getElementById('chemicalQuantity').value),
    monthly_quantity: parseInt(document.getElementById('chemicalMonthlyQuantity').value)
  };

  try {
    const response = await authFetch(`${API_BASE_URL}/chemicals`, {
      method: 'POST',
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (response.ok) {
      showMessage('success', 'Chemical added successfully!');
      closeModal('chemicalModal');
      document.getElementById('chemicalForm').reset();
      loadChemicals();
    } else {
      showMessage('error', result.message || 'Failed to add chemical.');
    }
  } catch (error) {
    console.error('Error:', error);
    showMessage('error', 'Server error.');
  }
}

/**
 * Handle machinery form submission
 */
async function handleMachinerySubmit(e) {
  e.preventDefault();

  const data = {
    machinery_name: document.getElementById('machineryName').value,
    number_of_days: parseInt(document.getElementById('machineryDays').value),
    station_id: parseInt(document.getElementById('machineryStation').value)
  };

  try {
    const response = await authFetch(`${API_BASE_URL}/machinery`, {
      method: 'POST',
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (response.ok) {
      showMessage('success', 'Machinery added successfully!');
      closeModal('machineryModal');
      document.getElementById('machineryForm').reset();
      loadMachinery();
    } else {
      showMessage('error', result.message || 'Failed to add machinery.');
    }
  } catch (error) {
    console.error('Error:', error);
    showMessage('error', 'Server error.');
  }
}

/**
 * Handle staff form submission
 */
async function handleStaffSubmit(e) {
  e.preventDefault();

  const date = new Date(document.getElementById('staffDate').value);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const data = {
    date: document.getElementById('staffDate').value,
    day: days[date.getDay()],
    station_name: document.getElementById('staffStation').value,
    shift: document.getElementById('staffShift').value,
    manpower: document.getElementById('staffManpower').value,
    number_of_persons: parseInt(document.getElementById('staffPersons').value)
  };

  try {
    const response = await authFetch(`${API_BASE_URL}/staff`, {
      method: 'POST',
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (response.ok) {
      showMessage('success', 'Staff record added successfully!');
      closeModal('staffModal');
      document.getElementById('staffForm').reset();
      loadStaff();
    } else {
      showMessage('error', result.message || 'Failed to add staff record.');
    }
  } catch (error) {
    console.error('Error:', error);
    showMessage('error', 'Server error.');
  }
}

/**
 * Handle pest control form submission
 */
async function handlePestControlSubmit(e) {
  e.preventDefault();

  const data = {
    pest_control_type: document.getElementById('pestType').value,
    chemical_used: document.getElementById('pestChemical').value,
    measuring_unit: document.getElementById('pestUnit').value,
    quantity_used: parseFloat(document.getElementById('pestQuantity').value),
    station_id: parseInt(document.getElementById('pestStation').value),
    date: document.getElementById('pestDate').value
  };

  try {
    const response = await authFetch(`${API_BASE_URL}/pest-control`, {
      method: 'POST',
      body: JSON.stringify(data)
    });

    const result = await response.json();

    if (response.ok) {
      showMessage('success', 'Pest control record added successfully!');
      closeModal('pestControlModal');
      document.getElementById('pestControlForm').reset();
      loadPestControl();
    } else {
      showMessage('error', result.message || 'Failed to add pest control record.');
    }
  } catch (error) {
    console.error('Error:', error);
    showMessage('error', 'Server error.');
  }
}

/**
 * Delete operations
 */
async function deleteStation(id) {
  if (confirm('Are you sure you want to delete this station?')) {
    await deleteResource(`/api/stations/${id}`, 'Station');
    loadStations();
  }
}

async function deleteChemical(id) {
  if (confirm('Are you sure you want to delete this chemical?')) {
    await deleteResource(`/api/chemicals/${id}`, 'Chemical');
    loadChemicals();
  }
}

async function deleteMachinery(id) {
  if (confirm('Are you sure you want to delete this machinery?')) {
    await deleteResource(`/api/machinery/${id}`, 'Machinery');
    loadMachinery();
  }
}

async function deleteStaff(id) {
  if (confirm('Are you sure you want to delete this staff record?')) {
    await deleteResource(`/api/staff/${id}`, 'Staff record');
    loadStaff();
  }
}

async function deletePestControl(id) {
  if (confirm('Are you sure you want to delete this pest control record?')) {
    await deleteResource(`/api/pest-control/${id}`, 'Pest control record');
    loadPestControl();
  }
}

/**
 * Generic delete resource function
 */
async function deleteResource(endpoint, resourceName) {
  try {
    const response = await authFetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE'
    });

    const result = await response.json();

    if (response.ok) {
      showMessage('success', `${resourceName} deleted successfully!`);
    } else {
      showMessage('error', result.message || `Failed to delete ${resourceName}.`);
    }
  } catch (error) {
    console.error('Error:', error);
    showMessage('error', 'Server error.');
  }
}

/**
 * Modal functions
 */
function openModal(modalId) {
  document.getElementById(modalId).classList.add('show');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('show');
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
