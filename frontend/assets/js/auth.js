// Configuration
const API_BASE_URL = 'http://localhost:5000/api';

// DOM Elements
const loginForm = document.getElementById('loginForm');
const messageDiv = document.getElementById('message');

// Event Listeners
if (loginForm) {
  loginForm.addEventListener('submit', handleLogin);
}

/**
 * Handle user login
 */
async function handleLogin(e) {
  e.preventDefault();

  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  // Clear previous message
  messageDiv.classList.remove('show', 'error', 'success');

  try {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (!response.ok) {
      showMessage('error', data.message || 'Login failed. Please try again.');
      return;
    }

    // Store token and user info
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));

    // Show success message
    showMessage('success', 'Login successful! Redirecting...');

    // Redirect based on role
    setTimeout(() => {
      if (data.user.role === 'superadmin') {
        window.location.href = 'admin-dashboard.html';
      } else {
        window.location.href = 'user-dashboard.html';
      }
    }, 1500);
  } catch (error) {
    console.error('Login error:', error);
    showMessage('error', 'Server error. Please try again later.');
  }
}

/**
 * Show message to user
 */
function showMessage(type, message) {
  messageDiv.textContent = message;
  messageDiv.classList.add('show', type);
}

/**
 * Get auth token from localStorage
 */
function getAuthToken() {
  return localStorage.getItem('token');
}

/**
 * Get current user from localStorage
 */
function getCurrentUser() {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
}

/**
 * Check if user is authenticated
 */
function isAuthenticated() {
  return !!getAuthToken();
}

/**
 * Logout user
 */
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = 'index.html';
}

/**
 * Fetch with authentication
 */
async function authFetch(url, options = {}) {
  const token = getAuthToken();

  if (!token) {
    window.location.href = 'login.html';
    return null;
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...options.headers
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers
    });

    // If unauthorized, logout and redirect
    if (response.status === 401) {
      logout();
      return null;
    }

    return response;
  } catch (error) {
    console.error('Fetch error:', error);
    throw error;
  }
}
