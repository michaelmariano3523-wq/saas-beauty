@echo off
setlocal enabledelayedexpansion

echo ====================================
echo  KERNEL BEAUTY SHOPPER - Build APK
echo ====================================
echo.

REM Find JDK 21
set "JAVA_HOME="
for /d %%i in ("C:\Program Files\Eclipse Adoptium\jdk-21*") do set "JAVA_HOME=%%i"
if not defined JAVA_HOME (
    echo JDK 21 nao encontrado. Instale em:
    echo https://adoptium.net/temurin/releases/?version=21
    pause
    exit /b 1
)

echo JDK: %JAVA_HOME%
echo.

REM Build web app and sync
echo [1/3] Build web app...
call npm run build
if %errorlevel% neq 0 (
    echo Erro no build web!
    pause
    exit /b 1
)

echo [2/3] Sync com Capacitor...
call npx cap sync android
if %errorlevel% neq 0 (
    pause
    exit /b 1
)

echo [3/3] Compilando APK...
cd android
call "%JAVA_HOME%\bin\java" -version
call gradlew.bat assembleDebug --no-daemon
cd ..

echo.
echo ====================================
echo  APK gerado em:
echo  android\app\build\outputs\apk\debug\app-debug.apk
echo ====================================
pause
