# Clear frontend caches
Write-Host "Clearing frontend caches..." -ForegroundColor Yellow

# Clear Vite cache
if (Test-Path "node_modules\.vite") {
    Remove-Item -Recurse -Force "node_modules\.vite"
    Write-Host "Cleared Vite cache" -ForegroundColor Green
} else {
    Write-Host "No Vite cache found" -ForegroundColor Gray
}

# Clear dist folder
if (Test-Path "dist") {
    Remove-Item -Recurse -Force "dist"
    Write-Host "Cleared dist folder" -ForegroundColor Green
} else {
    Write-Host "No dist folder found" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Cache clearing complete!" -ForegroundColor Green
Write-Host "Please restart your dev server: npm run dev" -ForegroundColor Cyan

