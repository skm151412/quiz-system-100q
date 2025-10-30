// auth.js - Centralized Authentication and Role-Based Routing
// This module handles Firebase Auth state changes and role-based redirects

import { 
  getDoc, 
  doc, 
  setDoc, 
  serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

// Get Firebase instances from global scope (set by firebase-init.js)
const auth = window.firebaseAuth;
const db = window.firebaseDb;
const authHelpers = window.firebaseAuthHelpers;

// Configuration
const ROLE_CONFIG = {
  teacher: {
    defaultPage: '/teacher.html',
    allowedPages: ['/teacher.html']
  },
  student: {
    defaultPage: '/index.html',
    allowedPages: ['/index.html', '/']
  }
};

/**
 * Fetch user role from Firestore
 * @param {string} uid - User ID
 * @returns {Promise<string>} - Role (teacher/student)
 */
async function getUserRole(uid) {
  try {
    const userDocRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      const role = userDoc.data().role || 'student';
      console.log(`[Auth] User ${uid} has role: ${role}`);
      return role;
    } else {
      // User document doesn't exist yet - default to student
      console.log(`[Auth] No user document found for ${uid}, defaulting to student`);
      return 'student';
    }
  } catch (error) {
    console.error('[Auth] Error fetching user role:', error);
    // Default to student on error to avoid blocking access
    return 'student';
  }
}

/**
 * Create or update user document in Firestore
 * @param {Object} user - Firebase User object
 * @param {string} role - User role (teacher/student)
 */
async function ensureUserDocument(user, role = 'student') {
  try {
    const userDocRef = doc(db, 'users', user.uid);
    await setDoc(userDocRef, {
      email: user.email || null,
      displayName: user.displayName || null,
      role: role,
      lastLogin: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    console.log(`[Auth] User document updated for ${user.uid} with role: ${role}`);
  } catch (error) {
    console.error('[Auth] Error creating/updating user document:', error);
  }
}

/**
 * Get current page path (normalized)
 */
function getCurrentPage() {
  const path = window.location.pathname;
  // Normalize paths
  if (path === '/' || path === '/index.html' || path === '') {
    return '/index.html';
  }
  if (path === '/teacher.html') {
    return '/teacher.html';
  }
  return path;
}

/**
 * Check if user with given role can access current page
 * @param {string} role - User role
 * @returns {boolean}
 */
function canAccessCurrentPage(role) {
  const currentPage = getCurrentPage();
  const roleConfig = ROLE_CONFIG[role];
  
  if (!roleConfig) {
    console.warn(`[Auth] Unknown role: ${role}`);
    return false;
  }
  
  return roleConfig.allowedPages.includes(currentPage);
}

/**
 * Redirect user to appropriate page based on role
 * @param {string} role - User role
 */
function redirectToRolePage(role) {
  const roleConfig = ROLE_CONFIG[role];
  if (!roleConfig) {
    console.error(`[Auth] Unknown role: ${role}, redirecting to index`);
    window.location.href = '/index.html';
    return;
  }
  
  const currentPage = getCurrentPage();
  const targetPage = roleConfig.defaultPage;
  
  // Only redirect if current page is not allowed for this role
  if (!roleConfig.allowedPages.includes(currentPage)) {
    console.log(`[Auth] Redirecting ${role} from ${currentPage} to ${targetPage}`);
    window.location.href = targetPage;
  } else {
    console.log(`[Auth] User ${role} already on correct page: ${currentPage}`);
  }
}

/**
 * Handle authentication state change
 * @param {Function} onAuthenticated - Callback when user is authenticated and on correct page
 * @param {Function} onUnauthenticated - Callback when no user is authenticated
 */
async function handleAuthStateChange(onAuthenticated, onUnauthenticated) {
  if (!authHelpers) {
    console.error('[Auth] Firebase Auth helpers not available');
    if (onUnauthenticated) onUnauthenticated();
    return;
  }

  authHelpers.onAuthStateChanged(async (user) => {
    if (user) {
      console.log(`[Auth] User authenticated: ${user.email} (${user.uid})`);
      
      try {
        // Fetch user role from Firestore
        const role = await getUserRole(user.uid);
        
        // Ensure user document exists with current info
        await ensureUserDocument(user, role);
        
        // Store role globally for scripts to use
        window.currentUser = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          role: role
        };
        
        // Check if user can access current page
        if (canAccessCurrentPage(role)) {
          console.log(`[Auth] User ${role} authorized for current page`);
          if (onAuthenticated) {
            onAuthenticated(user, role);
          }
        } else {
          console.log(`[Auth] User ${role} not authorized for current page, redirecting...`);
          redirectToRolePage(role);
        }
      } catch (error) {
        console.error('[Auth] Error in auth state handler:', error);
        // On error, sign out to be safe
        try {
          await authHelpers.signOut();
        } catch (_) {}
        if (onUnauthenticated) onUnauthenticated();
      }
    } else {
      console.log('[Auth] No user authenticated');
      window.currentUser = null;
      
      // If on protected page, redirect to login (index.html shows login)
      const currentPage = getCurrentPage();
      if (currentPage === '/teacher.html') {
        console.log('[Auth] Redirecting to index.html for login');
        window.location.href = '/index.html';
      } else {
        if (onUnauthenticated) onUnauthenticated();
      }
    }
  });
}

/**
 * Protect a page - redirect if not authenticated or wrong role
 * @param {string} requiredRole - Required role to access page
 * @param {Function} onAuthorized - Callback when user is authorized
 */
async function protectPage(requiredRole, onAuthorized) {
  await handleAuthStateChange(
    async (user, role) => {
      if (role === requiredRole) {
        console.log(`[Auth] Page access granted for ${requiredRole}`);
        if (onAuthorized) onAuthorized(user, role);
      } else {
        console.log(`[Auth] Access denied. Required: ${requiredRole}, Got: ${role}`);
        redirectToRolePage(role);
      }
    },
    () => {
      console.log('[Auth] Not authenticated, redirecting to login');
      window.location.href = '/index.html';
    }
  );
}

/**
 * Sign out current user
 */
async function signOutUser() {
  try {
    await authHelpers.signOut();
    console.log('[Auth] User signed out');
    window.currentUser = null;
    window.location.href = '/index.html';
  } catch (error) {
    console.error('[Auth] Sign out error:', error);
    // Force redirect anyway
    window.location.href = '/index.html';
  }
}

/**
 * Update user role (for signup or role changes)
 * @param {string} uid - User ID
 * @param {string} role - New role
 */
async function updateUserRole(uid, role) {
  try {
    const userDocRef = doc(db, 'users', uid);
    await setDoc(userDocRef, {
      role: role,
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    console.log(`[Auth] User ${uid} role updated to: ${role}`);
    return true;
  } catch (error) {
    console.error('[Auth] Error updating user role:', error);
    return false;
  }
}

// Export functions for use in other scripts
window.authModule = {
  getUserRole,
  ensureUserDocument,
  handleAuthStateChange,
  protectPage,
  signOutUser,
  updateUserRole,
  redirectToRolePage,
  canAccessCurrentPage
};

console.log('[Auth] Authentication module loaded');
