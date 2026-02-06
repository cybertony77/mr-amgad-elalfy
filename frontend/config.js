// API configuration

// Internal helper: decide the API base URL
const getApiUrl = () => {
  // Running in the browser
  if (typeof window !== "undefined") {
    // ✅ Use relative path in browser (same domain as the site)
    return "";
  }

  // Running on the server (SSR / Next.js backend)
  // ✅ Always use localhost internally
  return "http://localhost:3000";
};

// Exported function (use this everywhere in your code)
export const getApiBaseUrl = () => {
  return getApiUrl();
};

// Debug helper (only runs in browser)
export const debugApiUrl = () => {
  if (typeof window !== "undefined") {
    console.log("Current URL:", window.location.href);
    console.log("Protocol:", window.location.protocol);
    console.log("Hostname:", window.location.hostname);
    console.log("API URL:", getApiUrl());
  }
};