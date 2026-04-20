import type { NextConfig } from "next";

// Proxy/antivirus local qui intercepte HTTPS → Node ne reconnaît pas le certificat intermédiaire.
// Désactivé uniquement en dev (jamais en production).
if (process.env.NODE_ENV !== "production") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "yfwkavupjnnvmchidujw.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
