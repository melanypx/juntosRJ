import LoginForm from '@/components/auth/LoginForm';

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Operativo</h1>
          <p className="text-sm text-gray-500 mt-1">
            Ingresa tus credenciales para continuar
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
