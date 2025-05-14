import React from "react";
import "./Post.css";

function Post({ post, onLike, selectedPostId }) {
  const isSelected = post.id === selectedPostId;
  const imageSrc = post?.image_data
    ? `data:image/png;base64,${post.image_data.replace(/\s/g, "")}`
    : null;

  return (
    <div className={`post-container ${isSelected ? "post-container-selected" : ""}`}>
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={post.description || "Post image"}
          className="post-image"
          onError={(e) => console.error("Error loading image:", post.image_data)}
        />
      ) : (
        <p className="text-gray-400">Image unavailable</p>
      )}
      <p className="post-description">{post.description}</p>
      <p className="like-count">Likes: {post.like_count || 0}</p>
      <button onClick={() => onLike(post.id)} className="like-button">
        Like
      </button>
    </div>
  );
}

export default Post;