import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase-config";
import "../styles/ChatList.css";

const ChatList = ({ posts, setPosts }) => {
  const [search, setSearch] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const postsPerPage = 8;
  const navigate = useNavigate();
  const userId = auth.currentUser?.uid;

  const fetchPosts = async () => {
    setLoading(true);
    if (!auth.currentUser) {
      setError("User not authenticated. Please log in.");
      setLoading(false); // Fixed typo: was setaLoading(false)
      return;
    }

    try {
      const token = await auth.currentUser.getIdToken();
      console.log("ChatList: Fetching posts from Go API");
      const response = await fetch("http://localhost:8080/posts", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch posts: ${response.statusText}`);
      }
      const postsData = await response.json();
      console.log("ChatList: Fetched posts from Go API:", postsData);
      setPosts(postsData);
      setError(null);
    } catch (err) {
      console.error("ChatList: Fetch error:", err);
      setError("Failed to load posts. Please try again.");
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [setPosts]);

  const handleLike = async (postId) => {
    if (!auth.currentUser || !userId) {
      setError("User not authenticated. Please log in.");
      return;
    }

    const post = posts.find((p) => p.id === postId);
    if (post && post.likedBy && post.likedBy.includes(userId)) {
      console.log("User has already liked this post:", postId);
      return;
    }

    try {
      const token = await auth.currentUser.getIdToken();
      console.log("ChatList: Sending like request to Go API for post:", postId);
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
      console.log("ChatList: Go API response after like:", updatedPost);

      const refreshResponse = await fetch(`http://localhost:8080/posts/${postId}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (refreshResponse.ok) {
        const refreshedPost = await refreshResponse.json();
        console.log("ChatList: Refreshed post after like:", refreshedPost);
        setPosts((prevPosts) =>
          prevPosts.map((p) => (p.id === postId ? refreshedPost : p))
        );
      } else {
        throw new Error("Failed to refresh post after liking");
      }

      setError(null);
    } catch (err) {
      console.error("ChatList: Like error:", err);
      setError("Failed to like post. Please try again.");
    }
  };

  const handleDelete = async (postId) => {
    if (!auth.currentUser || !userId) {
      setError("User not authenticated. Please log in.");
      return;
    }

    try {
      const token = await auth.currentUser.getIdToken();
      console.log("ChatList: Sending delete request to Go API for post:", postId);
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
      console.log("ChatList: Post deleted successfully:", postId);
      setPosts((prevPosts) => prevPosts.filter((p) => p.id !== postId));
      setError(null);
    } catch (err) {
      console.error("ChatList: Delete error:", err);
      setError("Failed to delete post. Please try again.");
    }
  };

  const filteredPosts = posts?.filter((post) =>
    (post?.title?.toLowerCase() + " " + post?.description?.toLowerCase()).includes(
      search.toLowerCase()
    )
  ) || [];

  const indexOfLastPost = currentPage * postsPerPage;
  const indexOfFirstPost = indexOfLastPost - postsPerPage;
  const currentPosts = filteredPosts.slice(indexOfFirstPost, indexOfLastPost);
  const totalPages = Math.ceil(filteredPosts.length / postsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  return (
    <div className="chat-list">
      <div className="header">
        <h2>Explore Posts</h2>
        <div className="menu-icon">⋮</div>
      </div>
      <div className="chat-list-content">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search posts..."
          className="search-bar"
          aria-label="Search posts"
        />
        {error && (
          <div className="error-container">
            <p className="error">{error}</p>
          </div>
        )}
        {loading ? (
          <p className="loading-text">Loading posts...</p>
        ) : filteredPosts.length === 0 ? (
          <div className="no-posts-container">
            <p className="no-posts">No posts available.</p>
            <button onClick={fetchPosts} className="refresh-button rounded-full" aria-label="Refresh posts">
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
              >
                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="posts-grid">
            {currentPosts.map((post) => {
              const imageData = post.image_data || post.ImageData;
              const mimeType = post.image_mime_type || post.ImageMimeType || "image/png";
              const imageSrc = imageData
                ? `data:${mimeType};base64,${imageData.replace(/\s/g, "")}`
                : null;
              const isOwnPost = post.user_id === userId;
              console.log(
                "Rendering post:",
                post.id,
                "Like count:",
                post.like_count,
                "LikedBy:",
                post.likedBy,
                "UserID:",
                post.user_id,
                "IsOwnPost:",
                isOwnPost,
                "Image data:",
                imageData,
                "MIME type:",
                mimeType
              );
              return (
                <div
                  key={post.id}
                  className={`post-card ${isOwnPost ? "own-post" : "public-post"}`}
                  onClick={() => navigate(`/chat/${post.id}`)}
                >
                  {imageSrc ? (
                    <img
                      src={imageSrc}
                      alt={post.description || "Post image"}
                      className="post-image"
                      onError={(e) =>
                        console.error("Error loading image for post", post.id, ":", imageData, e)
                      }
                    />
                  ) : (
                    <p className="text-gray-400">Image unavailable</p>
                  )}
                  <div className="post-overlay">
                    {isOwnPost && <span className="own-post-label">Your Post</span>}
                    <h3>{post.title}</h3>
                    <div className="post-overlay-footer">
                      <p className="like-count">Likes: {post.like_count || 0}</p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLike(post.id);
                        }}
                        className="like-button"
                        disabled={post.likedBy && post.likedBy.includes(userId)}
                      >
                        👍
                      </button>
                      {isOwnPost && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/chat/${post.id}?edit=true`);
                            }}
                            className="edit-button"
                          >
                            ✏️
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(post.id);
                            }}
                            className="delete-button"
                          >
                            🗑️
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {!loading && totalPages > 1 && (
        <div className="pagination">
          <button
            className="pagination-button"
            onClick={() => paginate(currentPage - 1)}
            disabled={currentPage === 1}
          >
            Previous
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              className={`pagination-button ${currentPage === page ? "active" : ""}`}
              onClick={() => paginate(page)}
            >
              {page}
            </button>
          ))}
          <button
            className="pagination-button"
            onClick={() => paginate(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default ChatList;