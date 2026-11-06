# Spoty

Музыкальное приложение для Windows и Android. Поиск треков, плейлисты, рекомендации, тексты песен и фоновое воспроизведение. Общий аккаунт и библиотека на всех устройствах, вход через Telegram.

## Скачать

**[Windows x64](https://github.com/kabachok-hub/spoty-android/releases/download/v0.2.3/Spoty-Windows-0.2.3-x64.zip)** · **[Android APK](https://github.com/kabachok-hub/spoty-android/releases/download/v0.2.3/Spoty-Android-0.2.3.apk)**

Все версии — в [Releases](https://github.com/kabachok-hub/spoty-android/releases).

## Установка

**Windows 10/11:** распакуйте архив целиком и запустите `Spoty.exe`. Перед обновлением завершите приложение через меню трея.

**Android 6+:** скачайте и установите APK. При обновлении установите его поверх предыдущей версии.

После запуска войдите через Telegram. Обновления пока устанавливаются вручную.

## Разработка

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
```

Результат: `windows/releases/0.2.3/Spoty-win32-x64/`.

**Android:** задайте `JAVA_HOME` и `ANDROID_HOME`, затем выполните:

```powershell
node scripts/build-android.mjs
powershell -ExecutionPolicy Bypass -File android/tools/build-windows.ps1
```

Результат: `android/app/build/outputs/apk/debug/app-debug.apk`.
