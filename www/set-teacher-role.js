// Script to set user role to teacher in Firestore
// Run this in browser console on https://quiz-app-f2d9e.web.app if you need to make an existing user a teacher

async function setUserAsTeacher(email) {
  try {
    // First, find the user by email (you need to know their email)
    const auth = window.firebaseAuth;
    const db = window.firebaseDb;
    
    if (!auth || !auth.currentUser) {
      console.error('You must be logged in first');
      return;
    }
    
    const currentUid = auth.currentUser.uid;
    console.log('Current user UID:', currentUid);
    console.log('Current user email:', auth.currentUser.email);
    
    // Import Firestore functions
    const { doc, setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
    
    // Set current user as teacher
    const userRef = doc(db, 'users', currentUid);
    await setDoc(userRef, {
      role: 'teacher',
      email: auth.currentUser.email,
      updatedAt: serverTimestamp()
    }, { merge: true });
    
    console.log('✅ Successfully set role to teacher!');
    console.log('Please reload the page to see changes');
    
    // Automatically reload after 2 seconds
    setTimeout(() => {
      window.location.reload();
    }, 2000);
    
  } catch (error) {
    console.error('❌ Error setting teacher role:', error);
  }
}

// Instructions
console.log('=== Set User as Teacher ===');
console.log('1. Log in to the website first');
console.log('2. Run: setUserAsTeacher()');
console.log('3. The page will reload and redirect you to teacher dashboard');

// Make function available globally
window.setUserAsTeacher = setUserAsTeacher;
