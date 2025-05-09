import { useState, useEffect } from 'react';
import { Auth } from './components/Auth';
import PostForm from './components/PostForm';
import { ChatList } from './components/ChatList';
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import ChatPage from './components/ChatPage';
import { auth } from './firebase-config';
import Cookies from 'universal-cookie';
import { signOut } from 'firebase/auth';

const cookies = new Cookies();

function App() {
  const [isAuth, setIsAuth] = useState(cookies.get('auth-token'));
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      if (user) {
        user.getIdToken().then(token => {
          cookies.set('auth-token', token);
          setIsAuth(true);
        });
      } else {
        cookies.remove('auth-token');
        setIsAuth(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const signOutUser = async () => {
    await signOut(auth);
    cookies.remove('auth-token');
    setIsAuth(false);
  };

  const addPost = (newPost) => {
    setPosts(prevPosts => [...prevPosts, newPost]);
  };

  if (!isAuth) {
    return <Auth setIsAuth={setIsAuth} />;
  }

  return (
    <Router>
      <div className="min-h-screen bg-gray-900">
        <header className="bg-gray-800 p-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white">Chat App</h1>
          <button
            onClick={signOutUser}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition duration-200"
          >
            Sign Out
          </button>
        </header>
        <main className="container mx-auto p-4">
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