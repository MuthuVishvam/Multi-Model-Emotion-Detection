import { Navigate, useLocation } from "react-router-dom";

import useAuth from "../hooks/useAuth";

export default function PrivateRoute({ children }) {
  const location = useLocation();
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="container">
        <div className="card">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
