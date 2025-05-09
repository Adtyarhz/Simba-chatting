import React from 'react';
import './Post.css';

function Post({ post, onLike, selectedPostId }) {
  const isSelected = post.id === selectedPostId;

  return (
    <div className={`post-container ${isSelected ? 'post-container-selected' : ''}`}>
      <img
        src={`data:image/png;base64,${post.image_data}`}
        alt="Post"
        className="post-image"
        onError={(e) => console.error('Error loading image:', post.image_data)}
      />
      <p className="post-description">{post.description}</p>
      <p className="like-count">Likes: {post.like_count}</p>
      <button onClick={() => onLike(post.id)} className="like-button">Like</button>
    </div>
  );
}

export default Post;