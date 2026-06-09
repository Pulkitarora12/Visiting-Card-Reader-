import React, { useState } from "react";
import axios from "axios";

function Login({ onLoginSuccess, onNavigateToSignup, apiBaseUrl }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError("Please fill in all fields.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await axios.post(`${apiBaseUrl}/login`, {
        username,
        password,
      });
      const data = response.data;
      if (data.status === "success") {
        onLoginSuccess(data.access_token, data.user);
      } else {
        setError(data.message || "Failed to log in.");
      }
    } catch (err) {
      console.error("Login failed", err);
      setError(
        err.response?.data?.detail || "Invalid credentials. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-100 p-8 md:p-10 animate-fade-in">
        <header className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-gray-800 tracking-tight">
            Accosoft Solution
          </h1>
          <p className="text-gray-400 text-sm mt-2">
            Sign in to access your Card Reader
          </p>
        </header>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm p-4 rounded-xl mb-6 border border-red-100 font-medium">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest ml-1 mb-2">
              Username or Email
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border-gray-200 bg-gray-50 border p-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition text-sm"
              placeholder="Enter username or email"
              disabled={loading}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest ml-1 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border-gray-200 bg-gray-50 border p-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition text-sm"
              placeholder="••••••••"
              disabled={loading}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 shadow-lg active:scale-95 transition min-h-[56px] flex items-center justify-center text-base disabled:bg-gray-400"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <footer className="text-center mt-8 pt-6 border-t border-gray-100">
          <p className="text-gray-500 text-sm">
            Don't have an account?{" "}
            <button
              onClick={onNavigateToSignup}
              className="text-blue-600 hover:underline font-bold transition"
              disabled={loading}
            >
              Sign Up
            </button>
          </p>
        </footer>
      </div>
    </div>
  );
}

export default Login;
