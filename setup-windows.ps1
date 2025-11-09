# Setup Script for Windows (Without Docker)

Write-Host "🔧 ETERNA Backend Setup - Windows (No Docker)" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "⚠️  Warning: Running without administrator privileges" -ForegroundColor Yellow
    Write-Host "   Some installations may require admin rights" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "Option 1: Install PostgreSQL" -ForegroundColor Green
Write-Host "   Download from: https://www.postgresql.org/download/windows/" -ForegroundColor White
Write-Host "   Or use Chocolatey: choco install postgresql" -ForegroundColor White
Write-Host ""

Write-Host "Option 2: Install Redis" -ForegroundColor Green
Write-Host "   Download from: https://github.com/microsoftarchive/redis/releases" -ForegroundColor White
Write-Host "   Or use Chocolatey: choco install redis-64" -ForegroundColor White
Write-Host ""

Write-Host "Option 3: Use Cloud Services (Easiest)" -ForegroundColor Green
Write-Host "   PostgreSQL: https://www.elephantsql.com/ (Free tier)" -ForegroundColor White
Write-Host "   Redis: https://redis.com/try-free/ (Free tier)" -ForegroundColor White
Write-Host ""

Write-Host "Option 4: Start Docker Desktop (Recommended)" -ForegroundColor Green
Write-Host "   1. Open Docker Desktop from Start menu" -ForegroundColor White
Write-Host "   2. Wait for Docker to start (check system tray)" -ForegroundColor White
Write-Host "   3. Run: docker-compose up -d postgres redis" -ForegroundColor White
Write-Host ""

# Check if services are running
Write-Host "Checking if services are running..." -ForegroundColor Cyan

# Check PostgreSQL
$pgRunning = $false
try {
    $pgTest = Test-NetConnection -ComputerName localhost -Port 5432 -WarningAction SilentlyContinue -ErrorAction SilentlyContinue
    if ($pgTest.TcpTestSucceeded) {
        Write-Host "✅ PostgreSQL is running on port 5432" -ForegroundColor Green
        $pgRunning = $true
    } else {
        Write-Host "❌ PostgreSQL is not running on port 5432" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ PostgreSQL is not running on port 5432" -ForegroundColor Red
}

# Check Redis
$redisRunning = $false
try {
    $redisTest = Test-NetConnection -ComputerName localhost -Port 6379 -WarningAction SilentlyContinue -ErrorAction SilentlyContinue
    if ($redisTest.TcpTestSucceeded) {
        Write-Host "✅ Redis is running on port 6379" -ForegroundColor Green
        $redisRunning = $true
    } else {
        Write-Host "❌ Redis is not running on port 6379" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Redis is not running on port 6379" -ForegroundColor Red
}

Write-Host ""

if ($pgRunning -and $redisRunning) {
    Write-Host "🎉 All services are running! You can now start the app with: npm run dev" -ForegroundColor Green
} else {
    Write-Host "⚠️  Please start the missing services before running the app" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Quick Start with Docker Desktop:" -ForegroundColor Cyan
Write-Host "  1. Start Docker Desktop" -ForegroundColor White
Write-Host "  2. docker-compose up -d postgres redis" -ForegroundColor White
Write-Host "  3. npm run dev" -ForegroundColor White
