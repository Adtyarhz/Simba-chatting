import React, { useState, useEffect } from "react";
import Post from "./Post";
import { auth, db } from "../firebase-config";
import { collection, onSnapshot } from "firebase/firestore";
import Chat from "./Chat";

function PostList({ selectedPostId }) {
  const [posts, setPosts] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const postsRef = collection(db, "posts");
    const unsubscribe = onSnapshot(postsRef, (snapshot) => {
      const postsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      console.log("Fetched posts from Firestore:", postsData);
      setPosts(postsData);
    }, (err) => {
      console.error("Fetch error:", err);
      setError(err.message);
    });

    return () => unsubscribe();
  }, []);

  const handleLike = async (postId) => {
    console.log("Post was liked:", postId);
    if (!auth.currentUser) return;

    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(`http://localhost:8080/posts/${postId}/like`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      console.log("Response after liking:", response);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to like post: ${errorText}`);
      }
    } catch (err) {
      console.error("Like error:", err);
      setError(err.message);
    }
  };

  return (
    <div>
      {error && <p className="error">{error}</p>}
      {posts.map((post) => (
        <div key={post.id}>
          <Post
            post={post}
            onLike={handleLike}
            selectedPostId={selectedPostId}
          />
          <Chat postId={post.id} />
        </div>
      ))}
    </div>
  );
}

export default PostList;