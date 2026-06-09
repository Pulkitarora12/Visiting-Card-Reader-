import React, { useState } from "react";
import CardUpload from "./CardUpload";
import Login from "./Login";
import Signup from "./Signup";

function App() {
  const API_BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:8000";
  
  const [authToken, setAuthToken] = useState(() => {
    return localStorage.getItem("accosoft_auth_token") || "";
  });
  
  const [currentUser, setCurrentUser] = useState(() => {
    const user = localStorage.getItem("accosoft_user");
    return user ? JSON.parse(user) : null;
  });

  const [screen, setScreen] = useState(() => {
    return localStorage.getItem("accosoft_auth_token") ? "dashboard" : "login";
  });

  const handleLoginSuccess = (token, user) => {
    localStorage.setItem("accosoft_auth_token", token);
    localStorage.setItem("accosoft_user", JSON.stringify(user));
    setAuthToken(token);
    setCurrentUser(user);
    setScreen("dashboard");
  };

  const handleLogout = () => {
    localStorage.removeItem("accosoft_auth_token");
    localStorage.removeItem("accosoft_user");
    setAuthToken("");
    setCurrentUser(null);
    setScreen("login");
  };

  return (
    <div>
      {screen === "login" && (
        <Login
          apiBaseUrl={API_BASE_URL}
          onLoginSuccess={handleLoginSuccess}
          onNavigateToSignup={() => setScreen("signup")}
        />
      )}
      {screen === "signup" && (
        <Signup
          apiBaseUrl={API_BASE_URL}
          onSignupSuccess={() => setScreen("login")}
          onNavigateToLogin={() => setScreen("login")}
        />
      )}
      {screen === "dashboard" && (
        <CardUpload
          authToken={authToken}
          currentUser={currentUser}
          onLogout={handleLogout}
        />
      )}
    </div>
  );
}

export default App;
