import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { CubOSBear } from "@/components/CubOSBear";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <CubOSBear size={48} className="text-muted-foreground mx-auto mb-4" />
        <h1 className="mb-2 text-2xl font-semibold text-foreground">404</h1>
        <p className="mb-4 text-sm text-muted-foreground">Page not found</p>
        <Link to="/" className="text-sm text-foreground underline underline-offset-4 hover:opacity-80">
          Return to Home
        </Link>
      </div>
    </div>
  );
};

export default NotFound;