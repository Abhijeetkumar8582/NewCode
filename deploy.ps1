# Epiplex Production Deployment Script for Windows
# This script handles the complete deployment process for production

param(
    [string]$Action = "deploy",
    [string]$DomainName = "yourdomain.com"
)

# Configuration
$ProjectName = "epiplex"
$BackupDir = "./backups/$(Get-Date -Format 'yyyyMMdd_HHmmss')"
$ErrorActionPreference = "Stop"

# Colors for output (PowerShell)
$Red = "Red"
$Green = "Green"
$Yellow = "Yellow"
$Blue = "Cyan"

function Write-ColorOutput {
    param([string]$Color, [string]$Message)
    Write-Host "[$Color]$Message" -ForegroundColor $Color
}

function Write-Info {
    param([string]$Message)
    Write-ColorOutput $Blue "INFO: $Message"
}

function Write-Success {
    param([string]$Message)
    Write-ColorOutput $Green "SUCCESS: $Message"
}

function Write-Warning {
    param([string]$Message)
    Write-ColorOutput $Yellow "WARNING: $Message"
}

function Write-Error {
    param([string]$Message)
    Write-ColorOutput $Red "ERROR: $Message"
}

# Check prerequisites
function Test-Prerequisites {
    Write-Info "Checking prerequisites..."

    # Check if Docker is installed
    try {
        $null = Get-Command docker -ErrorAction Stop
        Write-Info "Docker found"
    }
    catch {
        Write-Error "Docker is not installed. Please install Docker Desktop first."
        exit 1
    }

    # Check if Docker Compose is available
    try {
        if (Get-Command docker-compose -ErrorAction SilentlyContinue) {
            Write-Info "Docker Compose (v1) found"
        }
        elseif (docker compose version 2>$null) {
            Write-Info "Docker Compose (v2) found"
        }
        else {
            throw "No Docker Compose found"
        }
    }
    catch {
        Write-Error "Docker Compose is not available. Please install Docker Compose."
        exit 1
    }

    # Check if production environment file exists
    if (-not (Test-Path ".env.production")) {
        Write-Error "Production environment file (.env.production) not found."
        Write-Info "Please create .env.production with your production configuration."
        exit 1
    }

    Write-Success "Prerequisites check passed."
}

# Create backup
function New-Backup {
    Write-Info "Creating backup..."

    New-Item -ItemType Directory -Path $BackupDir -Force | Out-Null

    # Backup database if running
    try {
        $dbStatus = docker-compose -f docker-compose.prod.yml ps db 2>$null
        if ($dbStatus -match "Up") {
            Write-Info "Backing up database..."
            docker-compose -f docker-compose.prod.yml exec -T db pg_dump -U epiplex_user -d video_processing > "$BackupDir/database_backup.sql"
        }
    }
    catch {
        Write-Warning "Could not backup database (may not be running)"
    }

    # Backup uploads
    if (Test-Path "./backend/uploads") {
        Write-Info "Backing up uploads..."
        Copy-Item -Path "./backend/uploads" -Destination "$BackupDir/uploads" -Recurse -Force
    }

    Write-Success "Backup created in $BackupDir"
}

# Pre-deployment checks
function Test-PreDeployment {
    Write-Info "Running pre-deployment checks..."

    # Check required environment variables
    $requiredVars = @("OPENAI_API_KEY", "DB_PASSWORD", "SECRET_KEY", "ENCRYPTION_KEY")
    $envContent = Get-Content ".env.production" -Raw

    foreach ($var in $requiredVars) {
        if ($envContent -notmatch "^$var=") {
            Write-Error "Required environment variable $var not found in .env.production"
            exit 1
        }
    }

    # Check domain configuration
    $composeContent = Get-Content "docker-compose.prod.yml" -Raw
    if ($composeContent -match "yourdomain\.com") {
        Write-Warning "Domain name is still set to 'yourdomain.com' in docker-compose.prod.yml"
        Write-Warning "Please update it to your actual domain name."
        $response = Read-Host "Continue anyway? (y/N)"
        if ($response -notmatch "^[Yy]$") {
            exit 1
        }
    }

    Write-Success "Pre-deployment checks passed."
}

# Build and deploy
function Start-Deployment {
    Write-Info "Starting deployment..."

    # Copy environment file
    Copy-Item ".env.production" ".env" -Force

    # Update domain name in configurations
    if ($DomainName -ne "yourdomain.com") {
        Write-Info "Updating domain name to $DomainName"

        # Update nginx config
        $nginxContent = Get-Content "nginx/nginx.conf" -Raw
        $nginxContent = $nginxContent -replace "yourdomain\.com", $DomainName
        Set-Content "nginx/nginx.conf" $nginxContent

        # Update docker-compose
        $composeContent = Get-Content "docker-compose.prod.yml" -Raw
        $composeContent = $composeContent -replace "yourdomain\.com", $DomainName
        Set-Content "docker-compose.prod.yml" $composeContent
    }

    # Pull latest images
    Write-Info "Pulling latest images..."
    docker-compose -f docker-compose.prod.yml pull

    # Build custom images
    Write-Info "Building custom images..."
    docker-compose -f docker-compose.prod.yml build --no-cache

    # Run database migrations
    Write-Info "Running database migrations..."
    docker-compose -f docker-compose.prod.yml run --rm backend python -c "
import asyncio
from app.database import init_db
asyncio.run(init_db())
print('Database initialized successfully')
"

    # Start services
    Write-Info "Starting services..."
    docker-compose -f docker-compose.prod.yml up -d

    # Wait for services to be healthy
    Write-Info "Waiting for services to be healthy..."
    Start-Sleep -Seconds 30

    # Check service health
    Test-ServiceHealth

    Write-Success "Deployment completed successfully!"
}

# Check service health
function Test-ServiceHealth {
    Write-Info "Checking service health..."

    # Check backend health
    $maxAttempts = 10
    for ($attempt = 1; $attempt -le $maxAttempts; $attempt++) {
        try {
            $response = Invoke-WebRequest -Uri "http://localhost/api/health" -TimeoutSec 10 -ErrorAction Stop
            if ($response.StatusCode -eq 200) {
                Write-Success "Backend is healthy"
                break
            }
        }
        catch {
            Write-Warning "Backend not healthy yet (attempt $attempt/$maxAttempts)"
            Start-Sleep -Seconds 10
        }
    }

    if ($attempt -gt $maxAttempts) {
        Write-Error "Backend failed to become healthy"
        exit 1
    }

    # Check frontend health
    try {
        $response = Invoke-WebRequest -Uri "http://localhost" -TimeoutSec 10 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Success "Frontend is healthy"
        }
        else {
            Write-Error "Frontend returned status code $($response.StatusCode)"
            exit 1
        }
    }
    catch {
        Write-Error "Frontend failed health check: $($_.Exception.Message)"
        exit 1
    }
}

# Post-deployment tasks
function Invoke-PostDeployment {
    Write-Info "Running post-deployment tasks..."

    # Clear any caches if needed
    try {
        docker-compose -f docker-compose.prod.yml exec backend python -c "
from app.services.cache_service import CacheService
cache = CacheService()
print('Cache service initialized')
" 2>$null
        Write-Success "Cache service checked"
    }
    catch {
        Write-Warning "Could not check cache service"
    }

    Write-Success "Post-deployment tasks completed."
}

# Rollback function
function Invoke-Rollback {
    Write-Error "Deployment failed. Starting rollback..."

    # Stop services
    docker-compose -f docker-compose.prod.yml down 2>$null

    # Restore from backup if available
    if (Test-Path $BackupDir) {
        Write-Info "Restoring from backup..."

        # Restore database
        if (Test-Path "$BackupDir/database_backup.sql") {
            try {
                Get-Content "$BackupDir/database_backup.sql" | docker-compose -f docker-compose.prod.yml exec -T db psql -U epiplex_user -d video_processing
            }
            catch {
                Write-Warning "Could not restore database from backup"
            }
        }

        # Restore uploads
        if (Test-Path "$BackupDir/uploads") {
            Copy-Item -Path "$BackupDir/uploads/*" -Destination "./backend/uploads" -Recurse -Force
        }
    }

    # Restart previous version
    docker-compose -f docker-compose.prod.yml up -d 2>$null

    Write-Info "Rollback completed."
}

# Main deployment process
function Start-MainDeployment {
    Write-Info "Starting Epiplex production deployment..."

    Test-Prerequisites
    New-Backup
    Test-PreDeployment

    try {
        Start-Deployment
        Invoke-PostDeployment

        Write-Success "Deployment completed successfully!"
        Write-Info "Your application is now running at https://$DomainName"
        Write-Host ""
        Write-Info "Useful commands:"
        Write-Info "  - View logs: docker-compose -f docker-compose.prod.yml logs -f"
        Write-Info "  - Stop services: docker-compose -f docker-compose.prod.yml down"
        Write-Info "  - Restart services: docker-compose -f docker-compose.prod.yml restart"
        Write-Host ""
        Write-Info "Backup saved at: $BackupDir"
    }
    catch {
        Write-Error "Deployment failed: $($_.Exception.Message)"
        Invoke-Rollback
        exit 1
    }
}

# Handle command line actions
switch ($Action) {
    "backup" {
        New-Backup
    }
    "check" {
        Test-Prerequisites
        Test-PreDeployment
    }
    "rollback" {
        Invoke-Rollback
    }
    default {
        Start-MainDeployment
    }
}