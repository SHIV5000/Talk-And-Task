import React, { useState, useEffect } from 'react';
import { auth, onAuthStateChanged } from './firebase.js';
import ChatApp from './components/ChatApp.jsx';

export default function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return unsubscribe;
  }, []);

  if (!user) {
    return <LoginScreen />; // you can move the login UI here
  }
  return <ChatApp user={user} />;
}
