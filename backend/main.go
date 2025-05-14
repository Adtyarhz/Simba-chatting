package main

import (
	"context"
	"log"
	"net/http"
	"os"

	firebase "firebase.google.com/go"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"google.golang.org/api/option"
)

func main() {
	// Get the credentials file path from an environment variable
	credentialsPath := os.Getenv("GOOGLE_APPLICATION_CREDENTIALS")
	if credentialsPath == "" {
		log.Fatalf("GOOGLE_APPLICATION_CREDENTIALS environment variable not set")
	}

	// Verify the credentials file exists
	if _, err := os.Stat(credentialsPath); os.IsNotExist(err) {
		log.Fatalf("Credentials file does not exist at path: %s", credentialsPath)
	}

	// Read the service account file to extract project ID
	data, err := os.ReadFile(credentialsPath)
	if err != nil {
		log.Fatalf("Failed to read credentials file: %v", err)
	}

	// Initialize Firebase with the service account and project configuration
	config := &firebase.Config{ProjectID: ""}
	app, err := firebase.NewApp(context.Background(), config, option.WithCredentialsJSON(data))
	if err != nil {
		log.Fatalf("Failed to initialize Firebase: %v", err)
	}

	// Initialize Firestore
	client, err := app.Firestore(context.Background())
	if err != nil {
		log.Fatalf("Failed to initialize Firestore: %v", err)
	}
	defer client.Close()

	// Initialize Firebase Auth client
	authClient, err := app.Auth(context.Background())
	if err != nil {
		log.Fatalf("Failed to initialize Firebase Auth client: %v", err)
	}

	// Explicitly use the auth package to avoid unused import error
	_ = authClient

	// Initialize Gin router
	r := gin.Default()

	// Configure CORS
	configCors := cors.DefaultConfig()
	configCors.AllowOrigins = []string{"http://localhost:3000"}
	configCors.AllowMethods = []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"}
	configCors.AllowHeaders = []string{"Authorization", "Content-Type"}
	r.Use(cors.New(configCors));

	// Authentication middleware
	r.Use(func(c *gin.Context) {
		// Skip authentication for GET requests (list and get posts)
		if c.Request.Method == "GET" {
			c.Next()
			return
		}

		authHeader := c.GetHeader("Authorization")
		log.Printf("Received Authorization header: %s", authHeader)
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "No authorization header"})
			c.Abort()
			return
		}

		// Extract token (format: "Bearer <token>")
		if len(authHeader) <= len("Bearer ") {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid authorization header"})
			c.Abort()
			return
		}
		token := authHeader[len("Bearer "):]
		log.Printf("Extracted token: %s", token)

		// Verify the token using Firebase Auth
		decodedToken, err := authClient.VerifyIDToken(context.Background(), token)
		if err != nil {
			log.Printf("Token verification failed: %v", err)
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token: " + err.Error()})
			c.Abort()
			return
		}

		// Set user_id in context
		userID := decodedToken.UID
		log.Printf("Verified user ID: %s", userID)
		c.Set("user_id", userID)
		c.Next()
	})

	// Setup routes
	r.POST("/posts", func(c *gin.Context) {
		createPostHandler(c, context.Background(), client, nil)
	})
	r.GET("/posts", func(c *gin.Context) {
		listPostsHandler(c, context.Background(), client)
	})
	r.GET("/posts/:id", func(c *gin.Context) {
		getPostHandler(c, context.Background(), client)
	})
	r.POST("/posts/:id/like", func(c *gin.Context) {
		likePostHandler(c, context.Background(), client)
	})
	r.PUT("/posts/:id", func(c *gin.Context) {
		updatePostHandler(c, context.Background(), client)
	})
	r.DELETE("/posts/:id", func(c *gin.Context) {
		deletePostHandler(c, context.Background(), client)
	})

	// Start server
	r.Run(":8080")
}