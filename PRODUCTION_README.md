# Epiplex Production Deployment Guide

This guide provides comprehensive instructions for deploying Epiplex to production.

## 🚀 Quick Start

### Prerequisites

- Docker and Docker Compose installed
- Domain name configured
- SSL certificate (Let's Encrypt will be configured automatically)
- Production environment variables prepared

### One-Command Deployment (Linux/Mac)

```bash
# 1. Clone/configure your repository
git clone <your-repo>
cd epiplex

# 2. Create production environment file
cp .env.production.example .env.production
# Edit .env.production with your actual values

# 3. Update domain name in configuration
export DOMAIN_NAME=yourdomain.com
sed -i "s/yourdomain.com/$DOMAIN_NAME/g" docker-compose.prod.yml nginx/nginx.conf

# 4. Deploy
chmod +x deploy.sh
./deploy.sh
```

### Windows Deployment

```powershell
# 1. Clone/configure your repository
git clone <your-repo>
cd epiplex

# 2. Create production environment file
copy .env.production.example .env.production
# Edit .env.production with your actual values

# 3. Deploy using PowerShell script
.\\deploy.ps1 -DomainName "yourdomain.com"
```

## 📋 Detailed Setup

### 1. Environment Configuration

Create `.env.production` from the example:

```bash
cp .env.production.example .env.production
```

**Required Variables:**
- `DB_PASSWORD` - Strong database password
- `OPENAI_API_KEY` - Your OpenAI API key
- `SECRET_KEY` - 256-bit hex key for JWT
- `ENCRYPTION_KEY` - 32-byte base64 key for encryption
- `S3_BUCKET_NAME` - AWS S3 bucket for file storage
- `AWS_ACCESS_KEY_ID` - AWS access key
- `AWS_SECRET_ACCESS_KEY` - AWS secret key

**Generate secure keys:**

```bash
# SECRET_KEY (256-bit hex)
python3 -c "import secrets; print(secrets.token_hex(32))"

# ENCRYPTION_KEY (32-byte base64)
python3 -c "import secrets, base64; print(base64.b64encode(secrets.token_bytes(32)).decode())"

# Strong password
python3 -c "import secrets, string; chars = string.ascii_letters + string.digits + string.punctuation; print(''.join(secrets.choice(chars) for _ in range(32)))"
```

### 2. Domain Configuration

Update all configuration files with your domain:

```bash
# Replace yourdomain.com with your actual domain
find . -name "*.yml" -o -name "*.conf" | xargs sed -i "s/yourdomain\.com/your.actual.domain/g"
```

### 3. SSL Certificate Setup

The deployment includes automatic SSL certificate management using Certbot.

**Manual SSL setup (alternative):**

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot certonly --nginx -d yourdomain.com -d www.yourdomain.com

# Certificates will be available at:
/etc/letsencrypt/live/yourdomain.com/fullchain.pem
/etc/letsencrypt/live/yourdomain.com/privkey.pem
```

### 4. AWS S3 Setup

Create an S3 bucket for file storage:

```bash
# Create bucket
aws s3 mb s3://your-epiplex-bucket --region ap-south-1

# Configure public access (for file serving)
aws s3api put-bucket-policy --bucket your-epiplex-bucket --policy '{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::your-epiplex-bucket/*"
        }
    ]
}'

# Enable versioning (recommended)
aws s3api put-bucket-versioning --bucket your-epiplex-bucket --versioning-configuration Status=Enabled
```

### 5. Database Setup

The PostgreSQL database is automatically configured. For manual setup:

```bash
# Connect to database
docker-compose -f docker-compose.prod.yml exec db psql -U epiplex_user -d video_processing

# Run migrations
docker-compose -f docker-compose.prod.yml run --rm backend python -c "
import asyncio
from app.database import init_db
asyncio.run(init_db())
"
```

## 🔧 Production Architecture

```
Internet
    ↓
[Nginx Reverse Proxy - SSL/TLS]
    ↓
┌─────────────────┬─────────────────┐
│   Frontend      │   Backend API   │
│   (Next.js)     │   (FastAPI)     │
│   Port 3000     │   Port 9001     │
└─────────────────┴─────────────────┘
    ↓
┌─────────────────┬─────────────────┐
│   PostgreSQL    │     Redis       │
│   Database      │   Cache         │
└─────────────────┴─────────────────┘
    ↓
[AWS S3 - File Storage]
```

### Services Overview

- **Nginx**: Reverse proxy, SSL termination, rate limiting, static file serving
- **Frontend**: Next.js React application with SSR
- **Backend**: FastAPI with async database operations
- **PostgreSQL**: Primary database for application data
- **Redis**: Caching and session storage
- **AWS S3**: File storage for uploads and generated content

## 🔒 Security Features

### Built-in Security

- **HTTPS Everywhere**: SSL/TLS encryption with HSTS
- **Rate Limiting**: API and upload rate limiting
- **Security Headers**: XSS protection, CSRF protection, content security policy
- **Input Validation**: Comprehensive input validation and sanitization
- **Authentication**: JWT-based authentication with secure storage
- **File Upload Security**: File type validation, size limits, virus scanning ready
- **Database Security**: Parameterized queries, encrypted sensitive data

### Additional Security Measures

1. **Firewall Configuration**:
   ```bash
   # Allow only necessary ports
   sudo ufw allow 80
   sudo ufw allow 443
   sudo ufw enable
   ```

2. **SSL Certificate Monitoring**:
   ```bash
   # Check certificate expiry
   openssl s_client -connect yourdomain.com:443 -servername yourdomain.com 2>/dev/null | openssl x509 -noout -dates
   ```

3. **Regular Backups**:
   ```bash
   # Automated backup script
   ./deploy.sh backup
   ```

## 📊 Monitoring & Maintenance

### Health Checks

```bash
# Check all services
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Health endpoints
curl https://yourdomain.com/health
curl https://yourdomain.com/api/health
```

### Metrics & Monitoring

The application includes built-in monitoring:

- **Performance Metrics**: Response times, error rates, throughput
- **System Metrics**: CPU, memory, disk usage
- **Business Metrics**: Video processing stats, user activity
- **Health Checks**: Database connectivity, external service availability

### Log Management

```bash
# View application logs
docker-compose -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.prod.yml logs -f frontend

# Nginx access logs
docker-compose -f docker-compose.prod.yml exec nginx tail -f /var/log/nginx/access.log

# Database logs
docker-compose -f docker-compose.prod.yml exec db tail -f /var/log/postgresql/postgresql.log
```

## 🔄 Updates & Rollbacks

### Zero-Downtime Updates

```bash
# Deploy new version
./deploy.sh

# Or with PowerShell
.\\deploy.ps1
```

### Rollback

```bash
# Automatic rollback on deployment failure
# Or manual rollback
./deploy.sh rollback
```

## 🚨 Troubleshooting

### Common Issues

1. **SSL Certificate Issues**
   ```bash
   # Renew certificates
   docker-compose -f docker-compose.prod.yml exec certbot certbot renew
   docker-compose -f docker-compose.prod.yml restart nginx
   ```

2. **Database Connection Issues**
   ```bash
   # Check database connectivity
   docker-compose -f docker-compose.prod.yml exec backend python -c "
   import asyncio
   from app.database import get_db
   async def test():
       async for session in get_db():
           result = await session.execute('SELECT 1')
           print('Database connection successful')
           break
   asyncio.run(test())
   "
   ```

3. **File Upload Issues**
   - Check S3 permissions
   - Verify bucket exists and is accessible
   - Check file size limits in nginx.conf

### Performance Optimization

1. **Database Optimization**
   - Monitor slow queries
   - Add appropriate indexes
   - Configure connection pooling

2. **Cache Optimization**
   - Adjust Redis memory limits
   - Configure cache TTL values
   - Monitor cache hit rates

3. **CDN Integration** (Recommended)
   - Use CloudFront or similar CDN for static assets
   - Configure proper cache headers

## 📞 Support

For production deployment support:
1. Check the logs using the commands above
2. Verify environment configuration
3. Test individual services
4. Review security settings
5. Check resource utilization

## 🔐 Production Checklist

- [ ] Domain name configured and DNS propagated
- [ ] SSL certificates installed and valid
- [ ] Environment variables set securely
- [ ] AWS S3 bucket created and configured
- [ ] Database backups configured
- [ ] Monitoring and alerting set up
- [ ] Firewall configured
- [ ] Regular security updates scheduled
- [ ] Backup and recovery procedures tested

## 📈 Scaling Considerations

### Horizontal Scaling

```yaml
# Add to docker-compose.prod.yml for scaling
services:
  backend:
    deploy:
      replicas: 3
    # Load balancer configuration needed
```

### Database Scaling

- Use read replicas for read-heavy workloads
- Implement database sharding if needed
- Consider database connection pooling

### File Storage Scaling

- Use CloudFront CDN for global distribution
- Implement multipart uploads for large files
- Configure proper S3 lifecycle policies

---

**Remember**: Always test deployments in a staging environment before production deployment!