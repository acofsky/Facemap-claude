import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="text-left max-w-sm">
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">404</p>
        <h1 className="font-display text-foreground leading-tight mb-3" style={{ fontSize: '36px' }}>
          Page not found.
        </h1>
        <p className="text-[15px] text-muted-foreground mb-6">
          The page you're looking for doesn't exist.
        </p>
        <a
          href="/"
          className="inline-flex items-center px-4 py-2 rounded-button bg-primary text-primary-foreground text-[14px] font-semibold hover:opacity-90 transition-opacity"
        >
          Back to home
        </a>
      </div>
    </div>
  );
};

export default NotFound;
