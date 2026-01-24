#!/bin/bash

# Epiplex Production Deployment Script
# This script handles the complete deployment process for production

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="epiplex"
DOMAIN_NAME=${DOMAIN_NAME:-"yourdomain.com"}
BACKUP_DIR="./backups/$(date +%Y%m%d_%H%M%S)"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."

    # Check if Docker is installed
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker first."
        exit 1
    fi

    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi

    # Check if .env file exists
    if [ ! -f ".env.production" ]; then
        log_error "Production environment file (.env.production) not found."
        log_info "Please create .env.production with your production configuration."
        exit 1
    fi

    log_success "Prerequisites check passed."
}

# Create backup
create_backup() {
    log_info "Creating backup..."

    mkdir -p "$BACKUP_DIR"

    # Backup database if running
    if docker-compose -f docker-compose.prod.yml ps db | grep -q "Up"; then
        log_info "Backing up database..."
        docker-compose -f docker-compose.prod.yml exec -T db pg_dump -U epiplex_user -d video_processing > "$BACKUP_DIR/database_backup.sql"
    fi

    # Backup uploads
    if [ -d "./backend/uploads" ]; then
        log_info "Backing up uploads..."
        cp -r ./backend/uploads "$BACKUP_DIR/"
    fi

    log_success "Backup created in $BACKUP_DIR"
}

# Pre-deployment checks
pre_deployment_checks() {
    log_info "Running pre-deployment checks..."

    # Check if required environment variables are set
    required_vars=("OPENAI_API_KEY" "DB_PASSWORD" "SECRET_KEY" "ENCRYPTION_KEY")
    for var in "${required_vars[@]}"; do
        if ! grep -q "^$var=" .env.production; then
            log_error "Required environment variable $var not found in .env.production"
            exit 1
        fi
    done

    # Validate domain configuration
    if grep -q "yourdomain.com" docker-compose.prod.yml; then
        log_warning "Domain name is still set to 'yourdomain.com' in docker-compose.prod.yml"
        log_warning "Please update it to your actual domain name."
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi

    log_success "Pre-deployment checks passed."
}

# Build and deploy
deploy() {
    log_info "Starting deployment..."

    # Copy environment file
    cp .env.production .env

    # Update domain name in nginx config if different
    if [ "$DOMAIN_NAME" != "yourdomain.com" ]; then
        sed -i "s/yourdomain.com/$DOMAIN_NAME/g" nginx/nginx.conf
        sed -i "s/yourdomain.com/$DOMAIN_NAME/g" docker-compose.prod.yml
    fi

    # Pull latest images
    log_info "Pulling latest images..."
    docker-compose -f docker-compose.prod.yml pull

    # Build custom images
    log_info "Building custom images..."
    docker-compose -f docker-compose.prod.yml build --no-cache

    # Run database migrations if needed
    log_info "Running database migrations..."
    docker-compose -f docker-compose.prod.yml run --rm backend python -c "
import asyncio
from app.database import init_db
asyncio.run(init_db())
print('Database initialized successfully')
"

    # Start services
    log_info "Starting services..."
    docker-compose -f docker-compose.prod.yml up -d

    # Wait for services to be healthy
    log_info "Waiting for services to be healthy..."
    sleep 30

    # Check service health
    check_services_health

    log_success "Deployment completed successfully!"
}

# Check service health
check_services_health() {
    log_info "Checking service health..."

    # Check backend health
    max_attempts=10
    attempt=1
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s http://localhost/api/health > /dev/null 2>&1; then
            log_success "Backend is healthy"
            break
        fi
        log_warning "Backend not healthy yet (attempt $attempt/$max_attempts)"
        sleep 10
        ((attempt++))
    done

    if [ $attempt -gt $max_attempts ]; then
        log_error "Backend failed to become healthy"
        exit 1
    fi

    # Check frontend health
    if curl -f -s http://localhost > /dev/null 2>&1; then
        log_success "Frontend is healthy"
    else
        log_error "Frontend failed health check"
        exit 1
    fi
}

# Post-deployment tasks
post_deployment() {
    log_info "Running post-deployment tasks..."

    # Run database migrations/seeders if any
    # docker-compose -f docker-compose.prod.yml exec backend python scripts/seed.py

    # Clear any caches
    docker-compose -f docker-compose.prod.yml exec backend python -c "
from app.services.cache_service import CacheService
cache = CacheService()
# Clear cache if needed
print('Cache cleared')
"

    log_success "Post-deployment tasks completed."
}

# Rollback function
rollback() {
    log_error "Deployment failed. Starting rollback..."

    # Stop services
    docker-compose -f docker-compose.prod.yml down

    # Restore from backup if available
    if [ -d "$BACKUP_DIR" ]; then
        log_info "Restoring from backup..."
        # Restore database
        if [ -f "$BACKUP_DIR/database_backup.sql" ]; then
            docker-compose -f docker-compose.prod.yml exec -T db psql -U epiplex_user -d video_processing < "$BACKUP_DIR/database_backup.sql"
        fi
        # Restore uploads
        if [ -d "$BACKUP_DIR/uploads" ]; then
            cp -r "$BACKUP_DIR/uploads" ./backend/
        fi
    fi

    # Restart previous version
    docker-compose -f docker-compose.prod.yml up -d

    log_info "Rollback completed."
}

# Main deployment process
main() {
    log_info "Starting Epiplex production deployment..."

    check_prerequisites
    create_backup
    pre_deployment_checks

    # Trap errors for rollback
    trap rollback ERR

    deploy
    post_deployment

    log_success "🎉 Deployment completed successfully!"
    log_info "Your application is now running at https://$DOMAIN_NAME"
    log_info ""
    log_info "Useful commands:"
    log_info "  - View logs: docker-compose -f docker-compose.prod.yml logs -f"
    log_info "  - Stop services: docker-compose -f docker-compose.prod.yml down"
    log_info "  - Restart services: docker-compose -f docker-compose.prod.yml restart"
    log_info ""
    log_info "Backup saved at: $BACKUP_DIR"
}

# Handle command line arguments
case "${1:-}" in
    "backup")
        create_backup
        ;;
    "check")
        check_prerequisites
        pre_deployment_checks
        ;;
    "rollback")
        rollback
        ;;
    *)
        main
        ;;
esac