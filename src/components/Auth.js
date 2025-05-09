import { auth, provider } from "../firebase-config.js";
import { signInWithPopup } from "firebase/auth";
import Cookies from 'universal-cookie';
import "../styles/Auth.css";

const cookies = new Cookies();

export const Auth = ({ setIsAuth }) => {
  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      cookies.set("auth-token", result.user.refreshToken);
      setIsAuth(true);
    } catch (err) {
      console.error(err);
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