import { auth, provider } from "../firebase-config";
import { signInWithPopup, onAuthStateChanged } from "firebase/auth";
import Cookies from "universal-cookie";
import { useEffect } from "react";
import "../styles/Auth.css";

const cookies = new Cookies();

export const Auth = ({ setIsAuth }) => {
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        cookies.set("auth-token", user.refreshToken);
        setIsAuth(true);
        console.log("User logged in:", user);
      } else {
        setIsAuth(false);
        console.log("User logged out");
      }
    });
    return () => unsubscribe();
  }, [setIsAuth]);

  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      cookies.set("auth-token", result.user.refreshToken);
      setIsAuth(true);
      console.log("Sign-in successful:", result.user);
    } catch (err) {
      console.error("Sign-in error:", err);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Welcome</h2>
        <p>Sign in with Google to continue</p>
        <button onClick={signInWithGoogle} className="sign-in-button">
          Sign In With Google
        </button>
      </div>
    </div>
  );
};