package main

import (
	"context"
	"encoding/base64"
	"fmt"
	"log"
	"net/http"
	"time"

	"cloud.google.com/go/firestore"
	"github.com/gin-gonic/gin"
)

// Post represents the structure of a post stored in Firestore
type Post struct {
    ID           string   `json:"id"`
    UserID       string   `json:"user_id" firestore:"user_id"`
    Title        string   `json:"title"`
    ImageData    string   `json:"image_data"`
    ImageMimeType string  `json:"image_mime_type"`
    Description  string   `json:"description"`
    LikeCount    int      `json:"like_count" firestore:"like_count"`
    CreatedAt    string   `json:"created_at"`
    LikedBy      []string `json:"likedBy" firestore:"likedBy"`
}

func createPostHandler(c *gin.Context, ctx context.Context, client *firestore.Client, storageClient interface{}) {
	// Parse multipart form data
	err := c.Request.ParseMultipartForm(32 << 20) // 32MB limit
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to parse form: " + err.Error()})
		log.Printf("Failed to parse form: %v", err)
		return
	}

	title := c.PostForm("title")
	description := c.PostForm("description")
	imageData := c.PostForm("image_data")
	imageMimeType := c.PostForm("image_mime_type")
	userID := c.GetString("user_id")

	if title == "" || description == "" || imageData == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Title, description, and image data are required"})
		log.Printf("Validation failed: Missing required fields - title: %q, description: %q, image_data length: %d", title, description, len(imageData))
		return
	}

	// Default MIME type to image/png if not provided
	if imageMimeType == "" {
		log.Printf("No image_mime_type provided, defaulting to image/png")
		imageMimeType = "image/png"
	}

	// Validate Base64
	if _, err := base64.StdEncoding.DecodeString(imageData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid Base64 image data"})
		log.Printf("Invalid Base64 data: %v", err)
		return
	}

	// Log the full length of the base64 string
	log.Printf("Received image_data length: %d", len(imageData))

	// Save post to Firestore
	postID := fmt.Sprintf("post_%d", time.Now().UnixNano())
	log.Printf("Creating post with ID: %s for user: %s", postID, userID)
	post := Post{
		ID:           postID,
		UserID:       userID,
		Title:        title,
		ImageData:    imageData,
		ImageMimeType: imageMimeType,
		Description:  description,
		LikeCount:    0,
		CreatedAt:    time.Now().Format(time.RFC3339),
		LikedBy:      []string{},
	}
	_, err = client.Collection("posts").Doc(postID).Set(ctx, post)
	if err != nil {
		log.Printf("Failed to save post %s to Firestore: %v", postID, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save post: " + err.Error()})
		return
	}
	log.Printf("Successfully saved post with ID: %s", postID)

	c.JSON(http.StatusCreated, post)
}

func listPostsHandler(c *gin.Context, ctx context.Context, client *firestore.Client) {
	posts := []Post{}
	iter := client.Collection("posts").Documents(ctx)
	for {
		doc, err := iter.Next()
		if err != nil {
			if err.Error() != "iterator finished" {
				log.Printf("Error iterating posts: %v", err)
			}
			break
		}
		var post Post
		if err := doc.DataTo(&post); err != nil {
			log.Printf("Failed to parse post from document %s: %v", doc.Ref.ID, err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse post"})
			return
		}
		posts = append(posts, post)
	}
	log.Printf("Retrieved %d posts", len(posts))
	c.JSON(http.StatusOK, posts)
}

func getPostHandler(c *gin.Context, ctx context.Context, client *firestore.Client) {
	id := c.Param("id")

	// Set a timeout for Firestore request (increased to 10 seconds for debugging)
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	doc, err := client.Collection("posts").Doc(id).Get(ctx)
	if err != nil {
		log.Printf("Failed to get post %s: %v", id, err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Post not found: " + err.Error()})
		return
	}
	var post Post
	if err := doc.DataTo(&post); err != nil {
		log.Printf("Failed to parse post %s: %v", id, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse post: " + err.Error()})
		return
	}
	log.Printf("Successfully retrieved post %s", id)
	c.JSON(http.StatusOK, post)
}

func likePostHandler(c *gin.Context, ctx context.Context, client *firestore.Client) {
	id := c.Param("id")
	userID := c.GetString("user_id")

	log.Printf("Like request for post: %s by user: %s", id, userID)

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Set a timeout for Firestore request (increased to 10 seconds for debugging)
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	// Get the post
	docRef := client.Collection("posts").Doc(id)
	doc, err := docRef.Get(ctx)
	if err != nil {
		log.Printf("Failed to get post %s for like: %v", id, err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Post not found: " + err.Error()})
		return
	}

	var post Post
	if err := doc.DataTo(&post); err != nil {
		log.Printf("Failed to parse post %s for like: %v", id, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse post: " + err.Error()})
		return
	}

	// Check if user has already liked the post
	for _, likedUserID := range post.LikedBy {
		if likedUserID == userID {
			c.JSON(http.StatusBadRequest, gin.H{"error": "User has already liked this post"})
			return
		}
	}

	// Update like count and add user to likedBy
	_, err = docRef.Update(ctx, []firestore.Update{
		{Path: "like_count", Value: firestore.Increment(1)},
		{Path: "likedBy", Value: firestore.ArrayUnion(userID)},
	})
	if err != nil {
		log.Printf("Failed to update like for post %s: %v", id, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to like post: " + err.Error()})
		return
	}

	// Fetch updated post
	updatedDoc, err := docRef.Get(ctx)
	if err != nil {
		log.Printf("Failed to get updated post %s: %v", id, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch updated post: " + err.Error()})
		return
	}
	var updatedPost Post
	if err := updatedDoc.DataTo(&updatedPost); err != nil {
		log.Printf("Failed to parse updated post %s: %v", id, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse updated post: " + err.Error()})
		return
	}

	log.Printf("Successfully liked post %s by user %s", id, userID)
	c.JSON(http.StatusOK, updatedPost) // Return updated post
}

func updatePostHandler(c *gin.Context, ctx context.Context, client *firestore.Client) {
	id := c.Param("id")
	userID := c.GetString("user_id")

	log.Printf("Update request for post: %s by user: %s", id, userID)

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Parse the request body
	var updateData struct {
		Title       string `json:"title"`
		Description string `json:"description"`
	}
	if err := c.ShouldBindJSON(&updateData); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body: " + err.Error()})
		log.Printf("Failed to parse update request body: %v", err)
		return
	}

	if updateData.Title == "" || updateData.Description == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Title and description are required"})
		log.Printf("Validation failed: Missing required fields - title: %q, description: %q", updateData.Title, updateData.Description)
		return
	}

	// Set a timeout for Firestore request
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	// Get the post
	docRef := client.Collection("posts").Doc(id)
	doc, err := docRef.Get(ctx)
	if err != nil {
		log.Printf("Failed to get post %s for update: %v", id, err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Post not found: " + err.Error()})
		return
	}

	var post Post
	if err := doc.DataTo(&post); err != nil {
		log.Printf("Failed to parse post %s for update: %v", id, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse post: " + err.Error()})
		return
	}

	// Verify the user is the owner of the post
	if post.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "You can only edit your own posts"})
		log.Printf("User %s attempted to edit post %s owned by %s", userID, id, post.UserID)
		return
	}

	// Update the post
	_, err = docRef.Update(ctx, []firestore.Update{
		{Path: "title", Value: updateData.Title},
		{Path: "description", Value: updateData.Description},
	})
	if err != nil {
		log.Printf("Failed to update post %s: %v", id, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update post: " + err.Error()})
		return
	}

	// Fetch updated post
	updatedDoc, err := docRef.Get(ctx)
	if err != nil {
		log.Printf("Failed to get updated post %s: %v", id, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch updated post: " + err.Error()})
		return
	}
	var updatedPost Post
	if err := updatedDoc.DataTo(&updatedPost); err != nil {
		log.Printf("Failed to parse updated post %s: %v", id, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse updated post: " + err.Error()})
		return
	}

	log.Printf("Successfully updated post %s by user %s", id, userID)
	c.JSON(http.StatusOK, updatedPost)
}

func deletePostHandler(c *gin.Context, ctx context.Context, client *firestore.Client) {
	id := c.Param("id")
	userID := c.GetString("user_id")

	log.Printf("Delete request for post: %s by user: %s", id, userID)

	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Set a timeout for Firestore request
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	// Get the post
	docRef := client.Collection("posts").Doc(id)
	doc, err := docRef.Get(ctx)
	if err != nil {
		log.Printf("Failed to get post %s for delete: %v", id, err)
		c.JSON(http.StatusNotFound, gin.H{"error": "Post not found: " + err.Error()})
		return
	}

	var post Post
	if err := doc.DataTo(&post); err != nil {
		log.Printf("Failed to parse post %s for delete: %v", id, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse post: " + err.Error()})
		return
	}

	// Verify the user is the owner of the post
	if post.UserID != userID {
		c.JSON(http.StatusForbidden, gin.H{"error": "You can only delete your own posts"})
		log.Printf("User %s attempted to delete post %s owned by %s", userID, id, post.UserID)
		return
	}

	// Delete the post (handle both return values)
	_, err = docRef.Delete(ctx)
	if err != nil {
		log.Printf("Failed to delete post %s: %v", id, err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete post: " + err.Error()})
		return
	}

	log.Printf("Successfully deleted post %s by user %s", id, userID)
	c.JSON(http.StatusOK, gin.H{"message": "Post deleted successfully"})
}