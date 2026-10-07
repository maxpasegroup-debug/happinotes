# Run from any directory. Reapply the Android 12 mask-safe drawable after generation.
$ErrorActionPreference = 'Stop'
$splashProject = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $splashProject
try {
    dart run flutter_native_splash:create
    if ($LASTEXITCODE -ne 0) { throw 'Native splash generation failed.' }
    foreach ($themeFolder in @('values-v31', 'values-night-v31')) {
        $themeFile = Join-Path $splashProject "android/app/src/main/res/$themeFolder/styles.xml"
        $themeContent = [System.IO.File]::ReadAllText($themeFile)
        $themeContent = $themeContent.Replace(
            '<item name="android:windowSplashScreenAnimatedIcon">@drawable/android12splash</item>',
            '<item name="android:windowSplashScreenAnimatedIcon">@drawable/splash_icon_safe</item>')
        [System.IO.File]::WriteAllText($themeFile, $themeContent)
    }
} finally {
    Pop-Location
}
