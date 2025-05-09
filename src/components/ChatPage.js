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
import "../styles/ChatPage.css";

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
    <div className="chat-page">
      <div className="header">
        <button onClick={() => navigate(-1)} className="back-button">
          ← Back
        </button>
        <h1>Live Chat for Post</h1>
      </div>
      {error && <p className="error">{error}</p>}
      {post && (
        <div className="post-container">
          <h2>{post.title}</h2>
          <img
            src={`data:image/png;base64,${post.image_data}`}
            alt={post.description}
            className="post-image"
            onError={(e) => console.error("Error loading image:", post.image_data)}
          />
          <p className="post-description">{post.description}</p>
          <button onClick={handleLike} className="like-button">
            Like ({post ? post.like_count : 0})
          </button>
        </div>
      )}
      <div className="comments-container">
        <h2>Comments</h2>
        <div className="comments-list">
          {messages.map((message) => (
            <div key={message.id} className="comment">
              <span className="comment-user">{message.user}:</span>
              <p className="comment-text">{message.text}</p>
            </div>
          ))}
        </div>
        <form onSubmit={handleSubmit} className="comment-form">
          <input
            type="text"
            value={newMessage}
            onChange={(event) => setNewMessage(event.target.value)}
            className="comment-input"
            placeholder="Type your comment here..."
          />
          <button type="submit" className="submit-button">
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatPage;