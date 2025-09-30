"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (isRegister) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) setError(error.message);
      else router.push("/");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setError(error.message);
      else router.push("/");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <h1 className="text-2xl font-bold mb-4">{isRegister ? "Registrati" : "Login"}</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2 w-64">
        <input
          type="email"
          placeholder="Email"
          className="border p-2 rounded"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          className="border p-2 rounded"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="text-red-500">{error}</p>}
        <button type="submit" className="bg-blue-600 text-white p-2 rounded">
          {isRegister ? "Registrati" : "Login"}
        </button>
      </form>
      <button
        onClick={() => setIsRegister(!isRegister)}
        className="mt-4 text-blue-500 underline"
      >
        {isRegister ? "Hai già un account? Login" : "Non hai un account? Registrati"}
      </button>
    </div>
  );
}
