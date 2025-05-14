import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { db, auth } from "../firebase-config";
import {
  collection,
  addDoc,
  serverTimestamp,
  onSnapshot,
  query,
  orderBy,
  doc,
} from "firebase/firestore";
import "../styles/ChatPage.css";

const ChatPage = () => {
  const { postId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [post, setPost] = useState(null);
  const [error, setError] = useState(null);
  const [isLiking, setIsLiking] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(location.search.includes("edit=true"));
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const userId = auth.currentUser?.uid;

  const messagesRef = useMemo(() => collection(db, `posts/${postId}/comments`), [postId]);
  const postRef = useMemo(() => doc(db, "posts", postId), [postId]);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      console.log("ChatPage: Auth state changed, user:", user);
      if (!user) {
        console.log("ChatPage: User not authenticated, redirecting to /");
        navigate("/");
      } else {
        setIsAuthenticated(true);
      }
    });

    return () => unsubscribeAuth();
  }, [navigate]);

  useEffect(() => {
    if (!isAuthenticated) {
      console.log("ChatPage: Waiting for authentication...");
      return;
    }

    if (!postId) {
      console.log("ChatPage: No postId provided, redirecting to /");
      navigate("/");
      return;
    }

    const fetchPost = async () => {
      if (!auth.currentUser) {
        setError("User not authenticated. Please log in.");
        navigate("/");
        return;
      }

      try {
        const token = await auth.currentUser.getIdToken();
        console.log("ChatPage: Fetching post from Go API with ID:", postId);
        const response = await fetch(`http://localhost:8080/posts/${postId}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        });
        if (!response.ok) {
          if (response.status === 404) {
            console.log("ChatPage: Post not found in Go API (404), redirecting to /");
            setError("Post not found.");
            navigate("/");
            return;
          }
          throw new Error(`Failed to fetch post: ${response.statusText}`);
        }
        const postData = await response.json();
        console.log("ChatPage: Fetched post from Go API:", postData);
        setPost(postData);
        if (isEditing) {
          setEditTitle(postData.title || "");
          setEditDescription(postData.description || "");
        }
        setError(null);
      } catch (err) {
        console.error("ChatPage: Fetch post error:", err);
        setError(
          `Failed to load post: ${
            err.message.includes("Failed to fetch")
              ? "Backend server is not running. Please start the server to view this post."
              : err.message
          }`
        );
        navigate("/");
      }
    };

    const unsubscribePost = onSnapshot(
      postRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const postData = { id: docSnap.id, ...docSnap.data() };
          console.log("ChatPage: Real-time post data from Firestore:", postData);
          setPost(postData);
          setLoading(false);
        } else {
          console.log("ChatPage: Post not found in Firestore, redirecting to /");
          setError("Post not found.");
          navigate("/");
        }
      },
      (error) => {
        console.error("ChatPage: Error fetching post in real-time:", error);
        setError(`Failed to load post in real-time: ${error.message}`);
        navigate("/");
      }
    );

    const unsubscribeMessages = onSnapshot(
      query(messagesRef, orderBy("createdAt")),
      (snapshot) => {
        const comments = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        console.log("ChatPage: Fetched comments from Firestore:", comments);
        setMessages(comments);
      },
      (error) => {
        console.error("ChatPage: Error fetching comments from Firestore:", error);
        setError(`Failed to load comments: ${error.message}`);
      }
    );

    const fetchData = async () => {
      setLoading(true);
      await fetchPost();
      setLoading(false);
    };

    fetchData();

    return () => {
      unsubscribePost();
      unsubscribeMessages();
    };
  }, [postId, navigate, isAuthenticated, messagesRef, postRef, isEditing]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (newMessage === "" || !postId || !auth.currentUser) {
      setError("User not authenticated or comment is empty. Please log in and try again.");
      return;
    }

    try {
      console.log("ChatPage: Submitting comment to Firestore:", newMessage);
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
      console.error("ChatPage: Error adding comment to Firestore:", error);
      setError(`Failed to add comment: ${error.message}`);
    }
  };

  const handleLike = async () => {
    console.log("ChatPage: Like was pressed");
    if (!postId || !auth.currentUser || isLiking) {
      setError("User not authenticated or liking in progress. Please log in and try again.");
      return;
    }

    if (post && post.likedBy && post.likedBy.includes(userId)) {
      console.log("ChatPage: User has already liked this post:", postId);
      return;
    }

    setIsLiking(true);
    try {
      const token = await auth.currentUser.getIdToken();
      console.log("ChatPage: Sending like request to Go API for post:", postId);
      const response = await fetch(`http://localhost:8080/posts/${postId}/like`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        throw new Error(`Failed to like post: ${response.statusText}`);
      }
      const updatedPost = await response.json();
      console.log("ChatPage: Go API response after like:", updatedPost);

      const refreshResponse = await fetch(`http://localhost:8080/posts/${postId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (refreshResponse.ok) {
        const refreshedPost = await refreshResponse.json();
        setPost(refreshedPost);
      }

      setError(null);
    } catch (err) {
      console.error("ChatPage: Like error:", err);
      setError(
        `Failed to like post: ${
          err.message.includes("Failed to fetch")
            ? "Backend server is not running. Please start the server to use this feature."
            : err.message
        }`
      );
    } finally {
      setIsLiking(false);
    }
  };

  const handleDelete = async () => {
    if (!auth.currentUser || !userId) {
      setError("User not authenticated. Please log in.");
      return;
    }

    try {
      const token = await auth.currentUser.getIdToken();
      console.log("ChatPage: Sending delete request to Go API for post:", postId);
      const response = await fetch(`http://localhost:8080/posts/${postId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        throw new Error(`Failed to delete post: ${response.statusText}`);
      }
      console.log("ChatPage: Post deleted successfully:", postId);
      navigate("/chat");
      setError(null);
    } catch (err) {
      console.error("ChatPage: Delete error:", err);
      setError(
        `Failed to delete post: ${
          err.message.includes("Failed to fetch")
            ? "Backend server is not running. Please start the server to use this feature."
            : err.message
        }`
      );
    }
  };

  const handleUpdate = async () => {
    if (!auth.currentUser || !userId) {
      setError("User not authenticated. Please log in.");
      return;
    }

    try {
      const token = await auth.currentUser.getIdToken();
      console.log("ChatPage: Sending update request to Go API for post:", postId);
      const response = await fetch(`http://localhost:8080/posts/${postId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription,
        }),
      });
      if (!response.ok) {
        throw new Error(`Failed to update post: ${response.statusText}`);
      }
      const updatedPost = await response.json();
      console.log("ChatPage: Post updated successfully:", updatedPost);
      setPost(updatedPost);
      setIsEditing(false);
      setError(null);
    } catch (err) {
      console.error("ChatPage: Update error:", err);
      setError(
        `Failed to update post: ${
          err.message.includes("Failed to fetch")
            ? "Backend server is not running. Please start the server to use this feature."
            : err.message
        }`
      );
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditTitle(post?.title || "");
    setEditDescription(post?.description || "");
  };

  if (loading) {
    return <div className="text-center text-gray-400">Loading...</div>;
  }

  if (error) {
    return (
      <div className="text-center text-red-500">
        <p>{error}</p>
        <button onClick={() => navigate(-1)} className="back-button">
          ← Back
        </button>
      </div>
    );
  }

  const imageData = post?.image_data || post?.ImageData;
  const mimeType = post?.image_mime_type || post?.ImageMimeType || "image/png";
  const imageSrc = imageData
    ? `data:${mimeType};base64,${imageData.replace(/\s/g, "")}`
    : null;

  const isOwnPost = post?.user_id === userId;

  return (
    <div className="chat-page">
      <div className="header">
        <button onClick={() => navigate(-1)} className="back-button">
          Back
        </button>
        <h1>Live Chat for Post</h1>
      </div>
      {error && <p className="error">{error}</p>}
      {post && (
        <div className="post-container">
          {isEditing ? (
            <div className="edit-form">
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="edit-input"
              />
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="edit-textarea"
              />
              <div className="edit-buttons">
                <button onClick={handleUpdate} className="save-button">
                  💾
                </button>
                <button onClick={handleCancel} className="cancel-button">
                  ❌
                </button>
              </div>
            </div>
          ) : (
            <>
              <h2>{post.title}</h2>
              {imageSrc ? (
                <img
                  src={imageSrc}
                  alt={post.description || "Post image"}
                  className="post-image"
                  onError={(e) =>
                    console.error("ChatPage: Error loading image:", imageData, e)
                  }
                />
              ) : (
                <p className="text-gray-400">Image unavailable</p>
              )}
              <p className="post-description">{post.description}</p>
            </>
          )}
          <div className="post-actions">
            <button
              onClick={handleLike}
              className="like-button"
              disabled={isLiking || (post.likedBy && post.likedBy.includes(userId))}
            >
              👍 {isLiking ? "Liking..." : `(${post?.like_count || 0})`}
            </button>
            {isOwnPost && (
              <>
                <button onClick={() => setIsEditing(true)} className="edit-button">
                  ✏️
                </button>
                <button onClick={handleDelete} className="delete-button">
                  🗑️
                </button>
              </>
            )}
          </div>
        </div>
      )}
      <div className="comments-container">
        <h2>Comments</h2>
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
          <button type="submit" className="send-button">
            Send
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatPage;


