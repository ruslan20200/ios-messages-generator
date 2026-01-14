export default function DesktopOnly() {
  return (
    <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6">
      <div className="max-w-md text-center space-y-6">
        <div className="space-y-4">
          <div className="text-6xl mb-4">📱</div>
          <h1 className="text-3xl font-bold tracking-tight">Только для мобильных устройств</h1>
          <p className="text-gray-400 text-lg">
            Это приложение предназначено только для использования на мобильных устройствах.
            Пожалуйста, откройте его на вашем смартфоне или планшете.
          </p>
        </div>
      </div>
    </div>
  );
}

