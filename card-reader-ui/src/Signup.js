import React, { useState } from "react";
import axios from "axios";

function Signup({ onSignupSuccess, onNavigateToLogin, apiBaseUrl }) {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMsg("");

    if (!email.trim() || !username.trim() || !password.trim()) {
      setError("Please fill in all fields.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${apiBaseUrl}/signup`, {
        email,
        username,
        password,
      });
      const data = response.data;
      if (data.status === "success") {
        setSuccessMsg("🎉 Registration submitted! Please ask your administrator to verify your account before logging in.");
        setTimeout(() => {
          onSignupSuccess();
        }, 4000);
      } else {
        setError(data.message || "Signup failed.");
      }
    } catch (err) {
      console.error("Signup failed", err);
      setError(
        err.response?.data?.detail || "Registration failed. Try a different username/email."
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
            Create an account to get started
          </p>
        </header>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm p-4 rounded-xl mb-6 border border-red-100 font-medium">
            ⚠️ {error}
          </div>
        )}

        {successMsg && (
          <div className="bg-green-50 text-green-700 text-sm p-4 rounded-xl mb-6 border border-green-100 font-medium">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest ml-1 mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full border-gray-200 bg-gray-50 border p-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition text-sm"
              placeholder="name@example.com"
              disabled={loading}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest ml-1 mb-2">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full border-gray-200 bg-gray-50 border p-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition text-sm"
              placeholder="Choose a username"
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
              placeholder="Min 6 characters"
              disabled={loading}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest ml-1 mb-2">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border-gray-200 bg-gray-50 border p-3 rounded-xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition text-sm"
              placeholder="Confirm password"
              disabled={loading}
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 shadow-lg active:scale-95 transition min-h-[56px] flex items-center justify-center text-base disabled:bg-gray-400"
          >
            {loading ? "Registering..." : "Sign Up"}
          </button>
        </form>

        <footer className="text-center mt-8 pt-6 border-t border-gray-100">
          <p className="text-gray-500 text-sm">
            Already have an account?{" "}
            <button
              onClick={onNavigateToLogin}
              className="text-blue-600 hover:underline font-bold transition"
              disabled={loading}
            >
              Sign In
            </button>
          </p>
        </footer>
      </div>
    </div>
  );
}

export default Signup;
