// Firebase configuration using compat SDK
const firebaseConfig = {
  apiKey: "AIzaSyC9K6PNc4-SfsIGedU4LZZ5g6W-NLTW52s",
  authDomain: "operaciones-9b48a.firebaseapp.com",
  projectId: "operaciones-9b48a",
  storageBucket: "operaciones-9b48a.firebasestorage.app",
  messagingSenderId: "588176258524",
  appId: "1:588176258524:web:295fcc3fefaa5dcc954b19",
  measurementId: "G-NJN2MY5GV1"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize services (solo Authentication)
const auth = firebase.auth();

console.log('Firebase inicializado correctamente');