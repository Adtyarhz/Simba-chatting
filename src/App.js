import { useState, useEffect } from "react";
import { Auth } from "./components/Auth";
import PostForm from "./components/PostForm";
import ChatList from "./components/ChatList";
import { BrowserRouter as Router, Route, Routes, Navigate } from "react-router-dom";
import ChatPage from "./components/ChatPage";
import { auth } from "./firebase-config";
import Cookies from "universal-cookie";
import { signOut, onAuthStateChanged } from "firebase/auth";
import "./App.css";

const cookies = new Cookies();

function App() {
  const [isAuth, setIsAuth] = useState(null); // Start with null to indicate loading
  const [posts, setPosts] = useState([]); // Manage posts state

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        user
          .getIdToken()
          .then((token) => {
            cookies.set("auth-token", token);
            setIsAuth(true);
            console.log("User authenticated:", user);
          })
          .catch((err) => {
            console.error("Error getting ID token:", err);
            setIsAuth(false);
            cookies.remove("auth-token");
          });
      } else {
        cookies.remove("auth-token");
        setIsAuth(false);
        console.log("User not authenticated");
      }
    });
    return () => unsubscribe();
  }, []);

  const signOutUser = async () => {
    try {
      await signOut(auth);
      cookies.remove("auth-token");
      setIsAuth(false);
      console.log("User signed out");
    } catch (err) {
      console.error("Sign-out error:", err);
    }
  };

  const addPost = (newPost) => {
    console.log("Added new post in App.js:", newPost);
    setPosts((prevPosts) => [newPost, ...prevPosts]); // Update posts state
  };

  if (isAuth === null) {
    return <div className="text-center text-gray-400">Loading authentication...</div>; // Show loading state
  }

  if (!isAuth) {
    return <Auth setIsAuth={setIsAuth} />;
  }

  return (
    <Router>
      <div className="app-container">
        <header className="header">
          <h1>Chat App</h1>
          <button onClick={signOutUser} className="sign-out-button">
            Sign Out
          </button>
        </header>
        <main className="main-content">
          <PostForm addPost={addPost} />
          <Routes>
            <Route path="/" element={<ChatList posts={posts} setPosts={setPosts} />} />
            <Route path="/chat/:postId" element={<ChatPage />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;