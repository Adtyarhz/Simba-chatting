import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { db, auth } from "../firebase-config";
import {
  collection,
  addDoc,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";

const ChatPage = () => {
  const { postId } = useParams();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [post, setPost] = useState(null);
  const [error, setError] = useState(null);

  const messagesRef = useMemo(() => collection(db, `posts/${postId}/comments`), [postId]);

  useEffect(() => {
    if (!postId) {
      navigate("/");
      return;
    }

    const abortController = new AbortController();
    const signal = abortController.signal;

    const fetchPost = async () => {
      try {
        const response = await fetch(`http://localhost:8080/posts/${postId}`, { signal });
        if (!response.ok) {
          if (response.status === 404) {
            setError("Post not found.");
            navigate("/");
            return;
          }
          throw new Error(`Failed to fetch post: ${response.statusText}`);
        }
        const data = await response.json();
        setPost(data);
        setError(null);
      } catch (err) {
        if (err.name === 'AbortError') {
          console.log("Fetch aborted for post:", postId);
          return;
        }
        setError(`Failed to fetch post: ${err.message}`);
        navigate("/");
        console.error("Fetch error:", err);
      }
    };

    fetchPost();

    const queryMessages = query(messagesRef, orderBy("createdAt"));
    const unsubscribe = onSnapshot(queryMessages, (snapshot) => {
      let messages = [];
      snapshot.forEach((doc) => {
        messages.push({ ...doc.data(), id: doc.id });
      });
      setMessages(messages);
    }, (error) => {
      console.error("Error fetching comments:", error);
      setError(`Failed to load comments: ${error.message}`);
    });

    return () => {
      abortController.abort();
      unsubscribe();
    };
  }, [postId, messagesRef, navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (newMessage === "" || !postId || !auth.currentUser) return;

    try {
      await addDoc(messagesRef, {
        text: newMessage,
        createdAt: serverTimestamp(),
        user: auth.currentUser.displayName || "Anonymous",
        userId: auth.currentUser.uid,
        postId,
      });
      setNewMessage("");
    } catch (error) {
      console.error("Error adding comment:", error);
      setError(`Failed to add comment: ${error.message}`);
    }
  };

  const handleLike = async () => {
    if (!postId || !auth.currentUser) return;

    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const token = await auth.currentUser.getIdToken();
        const response = await fetch(`http://localhost:8080/posts/${postId}/like`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });
        if (!response.ok) {
          throw new Error(`Failed to like post: ${response.statusText}`);
        }
        const updatedPost = await response.json();
        setPost(updatedPost);
        return;
      } catch (err) {
        if (attempt === maxRetries - 1) {
          console.error("Like error after retries:", err);
          setError(`Failed to like post after ${maxRetries} attempts: ${err.message}`);
        } else {
          console.warn(`Like attempt ${attempt + 1} failed, retrying...`, err);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
  };

  if (!post && !error) {
    return <div className="text-center text-gray-400">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition duration-200"
        >
          ← Back
        </button>
        <h1 className="text-2xl font-bold text-white">Live Chat for Post</h1>
      </div>
      {error && <p className="text-red-500">{error}</p>}
      {post && (
        <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
          <h2 className="text-xl font-semibold text-white mb-4">{post.title}</h2>
          <img
            src={`data:image/png;base64,${post.image_data}`}
            alt={post.description}
            className="w-full max-w-md h-auto rounded-lg mb-4"
            onError={(e) => console.error("Error loading image:", post.image_data)}
          />
          <p className="text-gray-300 mb-4">{post.description}</p>
          <button
            onClick={handleLike}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition duration-200"
          >
            Like ({post ? post.like_count : 0})
          </button>
        </div>
      )}
      <div className="bg-gray-800 rounded-lg p-6 shadow-lg">
        <h2 className="text-xl font-semibold mb-4 text-white">Comments</h2>
        <div className="max-h-96 overflow-y-auto mb-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className="flex items-start p-3 border-b border-gray-700"
            >
              <span className="font-bold text-blue-400 mr-2">{message.user}:</span>
              <p className="text-gray-200">{message.text}</p>
            </div>
          ))}
        </div>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(event) => setNewMessage(event.target.value)}
            className="flex-1 p-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Type your comment here..."
          />
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition duration-200"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatPage;