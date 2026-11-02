/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Leaflet references `L` at module scope in some setups; keep client components
  // dynamically imported instead of transpiling leaflet on the server.
};

export default nextConfig;
