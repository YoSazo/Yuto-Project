import { useNavigate } from "react-router-dom";
import { YutoLogo } from "../components/YutoLogo";

export default function NotFoundScreen() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-white dark:bg-black text-center">
      <YutoLogo className="w-12 h-12 mb-6" />
      <h1 className="text-xl font-bold text-black dark:text-white mb-2">Page not found</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-xs">
        This page doesn't exist or may have been removed.
      </p>
      <button
        onClick={() => navigate("/home", { replace: true })}
        className="px-6 py-3 bg-black dark:bg-white text-white dark:text-black rounded-xl font-bold text-sm border-none"
      >
        Go Home
      </button>
    </div>
  );
}
