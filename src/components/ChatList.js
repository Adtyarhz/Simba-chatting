import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase-config";

export const ChatList = ({ posts, setPosts }) => {
  const [search, setSearch] = useState("");
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const response = await fetch("http://localhost:8080/posts");
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to fetch posts: ${errorText}`);
        }
        const data = await response.json();
        setPosts(data);
      } catch (err) {
        console.error("Fetch error:", err);
        setError(err.message);
      }
    };

    fetchPosts();
  }, [setPosts]);

  const filteredPosts = posts.filter((post) =>
    (post.title.toLowerCase() + " " + post.description.toLowerCase()).includes(search.toLowerCase())
  );

  const handleLike = async (postId) => {
    if (!auth.currentUser) return;

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
        const updatedResponse = await fetch("http://localhost:8080/posts");
        const updatedData = await updatedResponse.json();
        setPosts(updatedData);
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-white">Posts</h2>
        <div className="text-2xl cursor-pointer text-gray-400 hover:text-white">⋮</div>
      </div>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search posts..."
        className="w-full p-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {error && <p className="text-red-500">{error}</p>}
      {filteredPosts.length === 0 && !error && <p className="text-gray-400">No posts found.</p>}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {filteredPosts.map((post) => (
          <div
            key={post.id}
            className="relative bg-gray-800 rounded-lg overflow-hidden shadow-lg group cursor-pointer"
            onClick={() => navigate(`/chat/${post.id}`)}
          >
            <img
              src={`data:image/png;base64,${post.image_data}`}
              alt={post.description}
              className="w-full h-48 object-cover"
              onError={(e) => console.error("Error loading image:", post.image_data)}
            />
            <div className="absolute inset-0 bg-black bg-opacity-70 opacity-0 group-hover:opacity-100 flex flex-col justify-between p-4 transition-opacity duration-200">
              <h3 className="text-lg font-semibold text-white">{post.title}</h3>
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-300">Likes: {post.like_count}</p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLike(post.id);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg text-sm"
                >
                  Like
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};