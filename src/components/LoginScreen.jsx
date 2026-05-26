import { useAuth } from '../contexts/AuthContext';

export default function LoginScreen() {
  const { login } = useAuth();
  return (
    <div className="flex h-screen items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md text-center">
        <h1 className="text-2xl font-bold mb-4">Talk & Task</h1>
        <button
          onClick={login}
          className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
        >
          Sign in with Google
        </button>
      </div>
    </div>
  );
}
