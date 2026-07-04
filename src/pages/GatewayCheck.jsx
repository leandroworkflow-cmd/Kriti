import { db } from "@/lib/db";
import React, { useEffect, useState } from "react";

import { Navigate, Outlet } from "react-router-dom";
import { Loader2 } from "lucide-react";

export default function GatewayCheck({ children }) {
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    const check = async () => {
      try {
        const me = await db.auth.me();
        if (me.role === "admin") {
          setStatus("passed");
          return;
        }
        const profiles = await db.entities.UserProfile.filter({ user_id: me.id });
        if (profiles.length > 0 && profiles[0].banned) {
          setStatus("banned");
          return;
        }
        if (profiles.length > 0 && profiles[0].test_passed) {
          setStatus("passed");
        } else {
          setStatus("not_passed");
        }
      } catch (e) {
        setStatus("not_passed");
      }
    };
    check();
  }, []);

  if (status === "loading") {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (status === "not_passed") {
    return <Navigate to="/iq-test" replace />;
  }

  if (status === "banned") {
    return <Navigate to="/banned" replace />;
  }

  return children;
}