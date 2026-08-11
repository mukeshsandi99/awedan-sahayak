@echo off
setlocal enabledelayedexpansion
set ADB=adb -s d7fc188a
set OUT=D:\awedan-sahayak-backup-20260802\awedan-sahayak\test-results
set PKG=com.mmenterprises.awedansahayak
set PASS=0
set FAIL=0

echo ================================================
echo   Android Production Regression Test
echo   Device: CPH2525 ^| App: AwedanSahayak v1.0.0
echo ================================================
echo.

REM ==== 1. Home Screen ====
echo [1/15] Home Screen Launch
%ADB% shell am start -n %PKG%/.MainActivity >nul 2>&1
timeout /t 4 /nobreak >nul
%ADB% exec-out screencap -p > "%OUT%\01_home.png"
%ADB% logcat -d -t 100 *:E *:F > "%OUT%\01_home_logcat.txt"
findstr /i "FATAL crash ANR" "%OUT%\01_home_logcat.txt" >nul
if %errorlevel%==0 (echo   FAIL - crash in logcat & set /a FAIL+=1) else (echo   PASS & set /a PASS+=1)
%ADB% logcat -c >nul 2>&1

REM ==== 2. Office Selection ====
echo [2/15] Office Selection
%ADB% shell input tap 540 650
timeout /t 3 /nobreak >nul
%ADB% exec-out screencap -p > "%OUT%\02_office_select.png"
%ADB% logcat -d -t 100 *:E *:F > "%OUT%\02_office_logcat.txt"
findstr /i "FATAL crash ANR" "%OUT%\02_office_logcat.txt" >nul
if %errorlevel%==0 (echo   FAIL & set /a FAIL+=1) else (echo   PASS & set /a PASS+=1)
%ADB% logcat -c >nul 2>&1
%ADB% shell input keyevent 4
timeout /t 1 /nobreak >nul

REM ==== 3. AI Application Generation (via office) ====
echo [3/15] AI Application Generation
%ADB% shell input tap 540 650
timeout /t 3 /nobreak >nul
REM Fill applicant name
%ADB% shell input tap 270 500
timeout /t 1 /nobreak >nul
%ADB% shell input text "Seema_Devi"
timeout /t 1 /nobreak >nul
REM Scroll down
%ADB% shell input swipe 540 1800 540 400 300
timeout /t 1 /nobreak >nul
REM Tap Generate
%ADB% shell input tap 540 2000
timeout /t 25 /nobreak >nul
%ADB% exec-out screencap -p > "%OUT%\03_ai_generate.png"
%ADB% logcat -d -t 200 *:E *:F > "%OUT%\03_ai_generate_logcat.txt"
findstr /i "FATAL crash ANR" "%OUT%\03_ai_generate_logcat.txt" >nul
if %errorlevel%==0 (echo   FAIL & set /a FAIL+=1) else (echo   PASS & set /a PASS+=1)
%ADB% logcat -c >nul 2>&1

REM ==== 4. AI Review ====
echo [4/15] AI Review Screen
%ADB% exec-out screencap -p > "%OUT%\04_ai_review.png"
%ADB% logcat -d -t 100 *:E *:F > "%OUT%\04_ai_review_logcat.txt"
findstr /i "FATAL crash ANR" "%OUT%\04_ai_review_logcat.txt" >nul
if %errorlevel%==0 (echo   FAIL & set /a FAIL+=1) else (echo   PASS & set /a PASS+=1)
%ADB% logcat -c >nul 2>&1

REM ==== 5-7. AI Edit actions (Grammar/Shorten/Expand) ====
for %%A in ("5:AI_Grammar:400" "6:AI_Shorten:600" "7:AI_Expand:800") do (
  for /f "tokens=1,2,3 delims=:" %%i in ("%%~A") do (
    echo [%%i/15] %%j
    %ADB% shell input tap 900 %%k
    timeout /t 12 /nobreak >nul
    %ADB% exec-out screencap -p > "%OUT%\%%i_%%j.png"
    %ADB% logcat -d -t 100 *:E *:F > "%OUT%\%%i_%%j_logcat.txt"
    findstr /i "FATAL crash ANR" "%OUT%\%%i_%%j_logcat.txt" >nul
    if !errorlevel!==0 (echo   FAIL & set /a FAIL+=1) else (echo   PASS & set /a PASS+=1)
    %ADB% logcat -c >nul 2>&1
  )
)

REM ==== 8. PDF Generation ====
echo [8/15] PDF Generation
%ADB% shell input tap 900 1000
timeout /t 5 /nobreak >nul
%ADB% exec-out screencap -p > "%OUT%\08_pdf_generate.png"
%ADB% logcat -d -t 100 *:E *:F > "%OUT%\08_pdf_logcat.txt"
findstr /i "FATAL crash ANR" "%OUT%\08_pdf_logcat.txt" >nul
if %errorlevel%==0 (echo   FAIL & set /a FAIL+=1) else (echo   PASS & set /a PASS+=1)
%ADB% logcat -c >nul 2>&1

REM ==== 9. PDF Share ====
echo [9/15] PDF Share
%ADB% shell input tap 900 1150
timeout /t 3 /nobreak >nul
%ADB% exec-out screencap -p > "%OUT%\09_pdf_share.png"
%ADB% logcat -d -t 100 *:E *:F > "%OUT%\09_share_logcat.txt"
findstr /i "FATAL crash ANR" "%OUT%\09_share_logcat.txt" >nul
if %errorlevel%==0 (echo   FAIL & set /a FAIL+=1) else (echo   PASS & set /a PASS+=1)
%ADB% logcat -c >nul 2>&1
%ADB% shell input keyevent 4
timeout /t 1 /nobreak >nul
%ADB% shell input keyevent 4
timeout /t 1 /nobreak >nul

REM ==== 10. Digital Locker ====
echo [10/15] Digital Locker
%ADB% shell am start -n %PKG%/.MainActivity >nul 2>&1
timeout /t 3 /nobreak >nul
%ADB% shell input swipe 540 2200 540 400 500
timeout /t 1 /nobreak >nul
%ADB% shell input tap 540 1900
timeout /t 4 /nobreak >nul
%ADB% exec-out screencap -p > "%OUT%\10_digital_locker.png"
%ADB% logcat -d -t 100 *:E *:F > "%OUT%\10_locker_logcat.txt"
findstr /i "FATAL crash ANR" "%OUT%\10_locker_logcat.txt" >nul
if %errorlevel%==0 (echo   FAIL & set /a FAIL+=1) else (echo   PASS & set /a PASS+=1)
%ADB% logcat -c >nul 2>&1
%ADB% shell input keyevent 4
timeout /t 1 /nobreak >nul

REM ==== 11. Document Scanner ====
echo [11/15] Document Scanner
%ADB% shell am start -n %PKG%/.MainActivity >nul 2>&1
timeout /t 3 /nobreak >nul
%ADB% shell input swipe 540 2200 540 400 500
timeout /t 1 /nobreak >nul
%ADB% shell input tap 540 1000
timeout /t 5 /nobreak >nul
%ADB% exec-out screencap -p > "%OUT%\11_document_scanner.png"
%ADB% logcat -d -t 100 *:E *:F > "%OUT%\11_scanner_logcat.txt"
findstr /i "FATAL crash ANR" "%OUT%\11_scanner_logcat.txt" >nul
if %errorlevel%==0 (echo   FAIL & set /a FAIL+=1) else (echo   PASS & set /a PASS+=1)
%ADB% logcat -c >nul 2>&1

REM ==== 12. Multi-page Scan ====
echo [12/15] Multi-page Scan
%ADB% shell input tap 540 2100
timeout /t 2 /nobreak >nul
%ADB% exec-out screencap -p > "%OUT%\12_multipage_scan.png"
%ADB% logcat -d -t 100 *:E *:F > "%OUT%\12_multipage_logcat.txt"
findstr /i "FATAL crash ANR" "%OUT%\12_multipage_logcat.txt" >nul
if %errorlevel%==0 (echo   FAIL & set /a FAIL+=1) else (echo   PASS & set /a PASS+=1)
%ADB% logcat -c >nul 2>&1

REM ==== 13. Image Editing / Perspective Crop ====
echo [13/15] Perspective Crop ^& Image Edit
%ADB% shell input tap 900 600
timeout /t 2 /nobreak >nul
%ADB% exec-out screencap -p > "%OUT%\13_perspective_crop.png"
%ADB% logcat -d -t 100 *:E *:F > "%OUT%\13_crop_logcat.txt"
findstr /i "FATAL crash ANR" "%OUT%\13_crop_logcat.txt" >nul
if %errorlevel%==0 (echo   FAIL & set /a FAIL+=1) else (echo   PASS & set /a PASS+=1)
%ADB% logcat -c >nul 2>&1

REM ==== 14. OCR ====
echo [14/15] OCR
%ADB% shell input tap 540 2200
timeout /t 8 /nobreak >nul
%ADB% exec-out screencap -p > "%OUT%\14_ocr.png"
%ADB% logcat -d -t 100 *:E *:F > "%OUT%\14_ocr_logcat.txt"
findstr /i "FATAL crash ANR" "%OUT%\14_ocr_logcat.txt" >nul
if %errorlevel%==0 (echo   FAIL & set /a FAIL+=1) else (echo   PASS & set /a PASS+=1)
%ADB% logcat -c >nul 2>&1
%ADB% shell input keyevent 4
timeout /t 1 /nobreak >nul

REM ==== 15. Offline Behavior + Crash Recovery ====
echo [15/15] Offline Behavior ^& Crash Recovery
%ADB% shell cmd connectivity airplane-mode enable
timeout /t 2 /nobreak >nul
%ADB% shell am start -n %PKG%/.MainActivity >nul 2>&1
timeout /t 4 /nobreak >nul
%ADB% exec-out screencap -p > "%OUT%\15_offline.png"
%ADB% logcat -d -t 200 *:E *:F *:W > "%OUT%\15_offline_logcat.txt"
findstr /i "FATAL crash ANR" "%OUT%\15_offline_logcat.txt" >nul
if %errorlevel%==0 (echo   FAIL & set /a FAIL+=1) else (echo   PASS & set /a PASS+=1)
%ADB% logcat -c >nul 2>&1
%ADB% shell cmd connectivity airplane-mode disable
timeout /t 2 /nobreak >nul

REM ==== FINAL ====
echo.
echo ================================================
echo   RESULTS: %PASS% PASS / %FAIL% FAIL / 15 TOTAL
echo ================================================
if %FAIL%==0 (echo   VERDICT: PRODUCTION-READY) else (echo   VERDICT: Fix %FAIL% failures before release)
echo   Screenshots: %OUT%\
echo   Logs: %OUT%\
