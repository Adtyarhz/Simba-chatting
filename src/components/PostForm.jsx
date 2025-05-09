import React, { useState } from "react";
import { auth } from "../firebase-config";
import "../styles/PostForm.css";

const PostForm = ({ addPost }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState(null);
  const [error, setError] = useState(null);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result.split(",")[1]); // Get Base64 string without the prefix
      };
      reader.readAsDataURL(file);
    }
  };

  const createPost = async (event) => {
    event.preventDefault();

    if (!title || !description || !image) {
      setError("Please fill in all fields and upload an image.");
      return;
    }

    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch("http://localhost:8080/posts", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          title,
          description,
          image_data: image,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create post: ${errorText}`);
      }

      const newPost = await response.json();
      addPost(newPost); // Update parent state with new post
      setTitle("");
      setDescription("");
      setImage(null);
      setError(null);
    } catch (err) {
      console.error("Error creating post:", err);
      setError(`Failed to create post: ${err.message}`);
    }
  };

  return (
    <div className="post-form-container">
      <h2>Create a New Post</h2>
      <form onSubmit={createPost}>
        <input
          type="text"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="title-input"
        />
        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="description-input"
        />
        <input
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          className="image-input"
        />
        {image && (
          <img
            src={`data:image/png;base64,${image}`}
            alt="Preview"
            className="image-preview"
          />
        )}
        <button type="submit" className="submit-button">Post</button>
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  );
};

export default PostForm;