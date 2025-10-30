import React from "react";

export function Button({ children, onClick, className = "" }: any) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded bg-yellow-500 hover:bg-yellow-600 text-white font-semibold ${className}`}
    >
      {children}
    </button>
  );
}
