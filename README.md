# Spoty Android

Android-клиент Spoty 0.2.3: общий аккаунт и библиотека, вход через Telegram, нативное воспроизведение Media3, управление из уведомления и фоновая музыка. Интерфейс React поставляется внутри APK. Есть настройки оформления и нагрузки на систему.

## Установка

Скачайте APK из [Releases](https://github.com/kabachok-hub/spoty-android/releases). Разрешите установку из выбранного источника и войдите через Telegram. Готовый APK подключён к существующему сервису Spoty. Android 6.0 или новее; проверка пользователем проводилась на POCO F5 / Android 15.

Это текущая предварительная версия: APK подписан существующим ключом отладочной сборки для совместимости с установленной версией. Автоматического обновления нет. Ключ подписи в репозиторий не входит. Сохранение совместимости следующих сборок требует того же закрытого ключа; самостоятельно собранный APK будет подписан вашим локальным ключом.

## Исходники и сервер

`android/` — оболочка Kotlin/WebView, Media3, очередь, кеш и защищённое хранение сессии через Android Keystore. `frontend/` — общий React-интерфейс. `scripts/` — упаковка интерфейса.

Сервер, Telegram-бот, Windows-приложение, базы, пользовательские данные и эксплуатационные документы сюда не входят. Клиенту нужен совместимый API Spoty; этот репозиторий сам сервер не разворачивает. В исходниках адрес сервиса задаётся при сборке. В готовом APK адрес API виден по необходимости, но личные сессии и серверные ключи не должны поставляться вместе с приложением. Авторизация API проверяется сервером.

## Сборка

Требуются Node.js 20+, JDK 17, Android SDK 36 и Build Tools 35.0.0. Gradle загружается wrapper-скриптом. Установите `JAVA_HOME` и `ANDROID_HOME` для своей машины. `.env.example` — образец, автоматически он не читается.

PowerShell из корня репозитория:

```powershell
$env:SPOTY_API_ORIGIN = 'https://your-server.example'
$env:SPOTY_PUBLIC_SITE_URL = $env:SPOTY_API_ORIGIN
npm --prefix frontend ci
node scripts/build-android.mjs
powershell -ExecutionPolicy Bypass -File android/tools/build-windows.ps1
```

Windows helper собирает временную копию по ASCII-пути, запускает JUnit, сборку и lint. Результат: `android/app/build/outputs/apk/debug/app-debug.apk`. При необходимости передайте `-StageRoot C:\temp`.

Linux/macOS после упаковки интерфейса:

```sh
cd android
sh gradlew :app:testDebugUnitTest :app:assembleDebug :app:lintDebug
```

Переменная `SPOTY_API_ORIGIN` должна быть экспортирована и для Gradle. Используйте HTTPS origin без завершающего слеша. Генерируемые assets, APK, зависимости и ключи не коммитятся. Для публикации собственного приложения настройте собственную release-подпись; не добавляйте keystore или пароли в Git.

Пример проверки интерфейса: `cd frontend; node tests/nativeClients.cjs`. Остальные регрессионные проверки находятся в `frontend/tests/`.
