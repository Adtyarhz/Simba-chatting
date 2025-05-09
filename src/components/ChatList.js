import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase-config";
import "../styles/ChatList.css";

export const ChatList = ({ posts, setPosts }) => {
	const [search, setSearch] = useState("");
	const [error, setError] = useState(null);
	const [currentPage, setCurrentPage] = useState(1);
	const postsPerPage = 8;
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
		(post.title.toLowerCase() + " " + post.description.toLowerCase()).includes(
			search.toLowerCase()
		)
	);

	const handleLike = async (postId) => {
		if (!auth.currentUser) return;

		const maxRetries = 3;
		for (let attempt = 0; attempt < maxRetries; attempt++) {
			try {
				const token = await auth.currentUser.getIdToken();
				const response = await fetch(
					`http://localhost:8080/posts/${postId}/like`,
					{
						method: "POST",
						headers: {
							Authorization: `Bearer ${token}`,
							"Content-Type": "application/json",
						},
					}
				);
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
					setError(
						`Failed to like post after ${maxRetries} attempts: ${err.message}`
					);
				} else {
					console.warn(`Like attempt ${attempt + 1} failed, retrying...`, err);
					await new Promise((resolve) => setTimeout(resolve, 1000));
				}
			}
		}
	};

	// Pagination logic
	const indexOfLastPost = currentPage * postsPerPage;
	const indexOfFirstPost = indexOfLastPost - postsPerPage;
	const currentPosts = filteredPosts.slice(indexOfFirstPost, indexOfLastPost);
	const totalPages = Math.ceil(filteredPosts.length / postsPerPage);

	const paginate = (pageNumber) => setCurrentPage(pageNumber);

	return (
		<div className="chat-list-container">
			<div className="header">
				<h2>Explore Posts</h2>
				<div className="menu-icon">⋮</div>
			</div>
      
			<div className="chat-list">
				<input
					type="text"
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					placeholder="Search posts..."
					className="search-bar"
				/>
				{error && <p className="error">{error}</p>}
				{filteredPosts.length === 0 && !error && (
					<p className="no-posts">No posts found.</p>
				)}
				<div className="posts-grid">
					{currentPosts.map((post) => (
						<div
							key={post.id}
							className="post-card"
							onClick={() => navigate(`/chat/${post.id}`)}
						>
							<img
								src={`data:image/png;base64,${post.image_data}`}
								alt={post.description}
								className="post-image"
								onError={(e) =>
									console.error("Error loading image:", post.image_data)
								}
							/>
							<div className="post-overlay">
								<h3>{post.title}</h3>
								<div className="post-overlay-footer">
									<p className="like-count">Likes: {post.like_count}</p>
									<button
										onClick={(e) => {
											e.stopPropagation();
											handleLike(post.id);
										}}
										className="like-button"
									>
										Like
									</button>
								</div>
							</div>
						</div>
					))}
				</div>
			</div>
			{totalPages > 1 && (
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
							className={`pagination-button ${
								currentPage === page ? "active" : ""
							}`}
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
