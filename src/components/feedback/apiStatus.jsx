import React from "react";
import { API_BASE } from "../../api";

export default function ApiStatus() {
  const [msg, setMsg] = React.useState("Checking…");
  React.useEffect(() => {
    fetch((API_BASE || "http://localhost:8001") + "/health")
      .then(r => r.json())
      .then(j => setMsg(j?.ok ? "API OK" : "API issue"))
      .catch(() => setMsg("API unreachable"));
  }, []);
  return <span className="badge">{msg}</span>;
}
