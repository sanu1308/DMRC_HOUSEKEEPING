/**
 * Main JavaScript for DMRC Housekeeping Management System
 * Handles general functionality for the landing page
 */

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  });
});

// Add scroll event listener for header
window.addEventListener('scroll', () => {
  const header = document.querySelector('header');
  if (window.scrollY > 50) {
    header.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.1)';
  } else {
    header.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)';
  }
});

// Check if user is already logged in
window.addEventListener('load', () => {
  const token = localStorage.getItem('token');
  if (token) {
    const user = localStorage.getItem('user');
    if (user) {
      const userData = JSON.parse(user);
      // Optionally redirect if already logged in
      console.log('User already logged in:', userData.email);
    }
  }
});
