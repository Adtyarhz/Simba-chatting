import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase-config";
import {
  collection,
  addDoc,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy,
} from "firebase/firestore";
import "./Chat.css";

const Chat = ({ postId }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [error, setError] = useState(null);
  const messagesRef = collection(db, `posts/${postId}/comments`);
  const userId = auth.currentUser?.uid;

  useEffect(() => {
    if (!postId) {
      setError("Invalid post ID");
      return;
    }

    const queryMessages = query(messagesRef, orderBy("createdAt"));
    const unsubscribe = onSnapshot(queryMessages, (snapshot) => {
      let messages = [];
      snapshot.forEach((doc) => {
        messages.push({ ...doc.data(), id: doc.id });
      });
      setMessages(messages);
      setError(null);
    }, (error) => {
      console.error("Error fetching comments:", error);
      setError(`Failed to load comments: ${error.message}`);
    });

    return () => unsubscribe();
  }, [postId, messagesRef]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (newMessage.trim() === "" || !postId || !auth.currentUser) {
      setError(
        `Cannot submit: ${
          !auth.currentUser ? "Please log in" : ""
        }${!newMessage.trim() ? " Message is empty" : ""}.`
      );
      return;
    }

    try {
      await addDoc(messagesRef, {
        text: newMessage,
        createdAt: serverTimestamp(),
        user: auth.currentUser.displayName || "Anonymous",
        userId: auth.currentUser.uid,
        postId,
      });
      setNewMessage("");
      setError(null);
    } catch (error) {
      console.error("Error adding comment:", error);
      setError(`Failed to add comment: ${error.message}`);
    }
  };

  return (
    <div className="comments-container">
      <h2>Comments</h2>
      {error && <p className="error">{error}</p>}
      <div className="comments-list">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`comment ${message.userId === userId ? "own-comment" : "other-comment"}`}
          >
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
  );
};

export default Chat;