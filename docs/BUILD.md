# Сборка Spoty


Общий интерфейс — React и TypeScript. Android — Kotlin и Media3, Windows — Electron.

Для сборки нужны Node.js 22.12+, а для Android — JDK 17 и Android SDK 36. Укажите адрес совместимого API Spoty в переменной `SPOTY_API_ORIGIN` (HTTPS, без завершающего слеша). Пример настройки — в `.env.example`.

```powershell
$env:SPOTY_API_ORIGIN = 'https://your-server.example'
npm --prefix frontend ci
```

**Windows:**

```powershell
node scripts/build-windows.mjs
npm --prefix windows ci
npm --prefix windows test
npm --prefix windows run package
npm --prefix windows run installer
```

Установщик: `windows/installers/0.2.4/Spoty-Setup.exe`. Портативная сборка: `windows/releases/0.2.4/Spoty-win32-x64/`.

**Android:** задайте `JAVA_HOME` и `ANDROID_HOME`, затем выполните:

```powershell
node scripts/build-android.mjs
powershell -ExecutionPolicy Bypass -File android/tools/build-windows.ps1
```

Результат: `android/app/build/outputs/apk/debug/app-debug.apk`.
