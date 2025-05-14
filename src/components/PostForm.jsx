import React, { useState } from "react";
import { auth } from "../firebase-config";
import Compressor from "compressorjs";
import "../styles/PostForm.css";

const PostForm = ({ addPost }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [image, setImage] = useState(null); // Store { base64: "...", mimeType: "image/png" }
  const [error, setError] = useState(null);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    console.log("Selected file:", file);
    if (file) {
      new Compressor(file, {
        quality: 0.4,
        maxWidth: 400,
        maxHeight: 400,
        success(result) {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64String = reader.result.split(",")[1];
            const mimeType = result.type; // e.g., "image/png" or "image/jpeg"
            console.log("Compressed base64 image length:", base64String.length);
            console.log("Compressed base64 image (first 50 chars):", base64String.substring(0, 50) + "...");
            console.log("Compressed base64 image (last 50 chars):", base64String.substring(base64String.length - 50));
            console.log("Detected MIME type:", mimeType);
            setImage({ base64: base64String, mimeType });
          };
          reader.onerror = () => {
            console.error("FileReader error:", reader.error);
            setError("Failed to read image file.");
          };
          reader.readAsDataURL(result);
        },
        error(err) {
          console.error("Compression error:", err);
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64String = reader.result.split(",")[1];
            const mimeType = file.type; // Fallback to original file type
            console.log("Fallback base64 image length:", base64String.length);
            console.log("Fallback base64 image (first 50 chars):", base64String.substring(0, 50) + "...");
            console.log("Fallback base64 image (last 50 chars):", base64String.substring(base64String.length - 50));
            console.log("Detected MIME type (fallback):", mimeType);
            setImage({ base64: base64String, mimeType });
          };
          reader.onerror = () => {
            console.error("Fallback FileReader error:", reader.error);
            setError("Failed to process image.");
          };
          reader.readAsDataURL(file);
        },
      });
    }
  };

  const createPost = async (event) => {
    event.preventDefault();

    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    if (!trimmedTitle || !trimmedDescription || !image || !auth.currentUser) {
      setError(
        `Please fill in all fields${
          !trimmedTitle ? " (title is empty)" : ""
        }${!trimmedDescription ? " (description is empty)" : ""}${
          !image ? " and upload an image" : ""
        }${!auth.currentUser ? " and log in" : ""}.`
      );
      return;
    }

    try {
      const token = await auth.currentUser.getIdToken();
      const formData = new FormData();
      formData.append("title", trimmedTitle);
      formData.append("description", trimmedDescription);
      formData.append("image_data", image.base64);
      formData.append("image_mime_type", image.mimeType);

      console.log("Sending post data:", {
        title: trimmedTitle,
        description: trimmedDescription,
        image_data_length: image.base64.length,
        image_mime_type: image.mimeType,
      });

      const response = await fetch("http://localhost:8080/posts", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.log("Microservice error response:", errorText);
        throw new Error(`Failed to create post: ${errorText}`);
      }

      const newPost = await response.json();
      console.log("Full microservice response:", newPost);
      console.log("Returned image_data length:", newPost.image_data ? newPost.image_data.length : "missing");
      if (!newPost.image_data || newPost.image_data !== image.base64) {
        console.warn("Image data mismatch or missing in response:", newPost.image_data);
      }
      addPost(newPost);
      setTitle("");
      setDescription("");
      setImage(null);
      setError(null);
    } catch (err) {
      console.error("Error creating post:", err);
      setError(
        `Failed to create post: ${
          err.message.includes("Failed to fetch")
            ? "Backend server is not running. Please start the server to create a post."
            : err.message
        }`
      );
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
          required
        />
        <textarea
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="description-input"
          required
        />
        <input
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          className="image-input"
          required
        />
        {image && (
          <img
            src={`data:${image.mimeType};base64,${image.base64}`}
            alt="Preview"
            className="image-preview"
            style={{ maxWidth: "200px" }}
          />
        )}
        <button type="submit" className="submit-button">Post</button>
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  );
};

export default PostForm;