$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $projectRoot 'manifest.json'
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$destinationDirectory = Join-Path $projectRoot 'dist'
New-Item -ItemType Directory -Path $destinationDirectory -Force | Out-Null
$destination = Join-Path $destinationDirectory "chess-timer-alert-$($manifest.version).zip"
$files = @('manifest.json', 'core.js', 'settings.js', 'sites.js', 'content.js',
    'popup/popup.html', 'popup/popup.js', 'popup/popup.css', 'popup/popup.css.map',
    'icons/icon.png', 'icons/icon48.png', 'sounds/alert.wav',
    'popup/fonts/material-symbols-outlined.woff2', 'popup/fonts/LICENSE.txt', 'popup/fonts/README.md')
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$stream = [System.IO.File]::Open($destination, [System.IO.FileMode]::Create)
try {
    $archive = New-Object System.IO.Compression.ZipArchive($stream, [System.IO.Compression.ZipArchiveMode]::Create)
    try {
        foreach ($file in $files) {
            $source = Join-Path $projectRoot $file
            [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $source, $file) | Out-Null
        }
    } finally { $archive.Dispose() }
} finally { $stream.Dispose() }
Write-Output $destination
