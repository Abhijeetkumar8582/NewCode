# AWS S3 Configuration Guide

## Problem
Videos are returning 200 OK from `/api/upload` but are **not being uploaded to S3 bucket**. This happens when AWS S3 credentials are not configured.

## Solution: Configure AWS S3 Credentials

You need to add the following environment variables to your `backend/.env` file:

```bash
# AWS S3 Configuration (REQUIRED for video uploads)
S3_BUCKET_NAME=your-actual-bucket-name
AWS_ACCESS_KEY_ID=your-actual-access-key-id
AWS_SECRET_ACCESS_KEY=your-actual-secret-access-key
AWS_REGION=ap-south-1
```

## Steps to Configure

### 1. Create or Use Existing S3 Bucket

1. Go to AWS Console → S3
2. Create a new bucket or use an existing one
3. Note the bucket name (e.g., `my-video-uploads-bucket`)

### 2. Create IAM User with S3 Permissions

1. Go to AWS Console → IAM → Users
2. Create a new user (e.g., `video-upload-service`)
3. Attach policy: `AmazonS3FullAccess` (or create custom policy with only PutObject, GetObject permissions)
4. Create Access Key for the user
5. **Save the Access Key ID and Secret Access Key** (you won't be able to see the secret again)

### 3. Update backend/.env File

Create or edit `backend/.env` file and add:

```bash
# AWS S3 Configuration
S3_BUCKET_NAME=my-video-uploads-bucket
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=ap-south-1
```

**Important:**
- Replace with your actual values
- Never commit `.env` file to version control
- Use environment variables in production (not .env file)

### 4. Restart Backend Server

After updating the `.env` file, restart your backend server:

```bash
# If using Docker
docker-compose restart backend

# If running directly
# Stop the server (Ctrl+C) and restart it
python backend/start.py
```

## Verification

After configuration, check the backend logs when uploading a video. You should see:

```
INFO: S3 client initialized, bucket=my-video-uploads-bucket, region=ap-south-1
INFO: Uploading file directly to S3 from stream, bucket=my-video-uploads-bucket, s3_key=...
INFO: File uploaded to S3 successfully from stream, s3_key=..., s3_url=s3://...
```

If you see warnings like:
```
WARNING: AWS S3 credentials are placeholders. S3 uploads will be disabled.
WARNING: S3 not configured, skipping upload
```

Then the credentials are not properly configured.

## Current Status Check

The S3 service checks for:
- ✅ `S3_BUCKET_NAME` is set and not a placeholder
- ✅ `AWS_ACCESS_KEY_ID` is set and not a placeholder  
- ✅ `AWS_SECRET_ACCESS_KEY` is set and not a placeholder

If any of these are missing or are placeholder values (`your_s3_bucket_name`, `your_aws_access_key_id`, etc.), S3 uploads will be disabled.

## Troubleshooting

### Issue: Still getting 200 OK but no S3 upload

1. **Check backend logs** - Look for S3-related warnings
2. **Verify .env file** - Make sure variables are set correctly
3. **Check for typos** - Variable names must be exact:
   - `S3_BUCKET_NAME` (not `S3_BUCKET` or `BUCKET_NAME`)
   - `AWS_ACCESS_KEY_ID` (not `AWS_ACCESS_KEY`)
   - `AWS_SECRET_ACCESS_KEY` (not `AWS_SECRET_KEY`)
4. **Restart server** - Environment variables are loaded at startup
5. **Check IAM permissions** - User must have PutObject permission on the bucket

### Issue: S3 upload fails with AccessDenied

- Check IAM user has proper permissions
- Verify bucket name is correct
- Ensure bucket exists in the specified region

### Issue: S3 upload fails with InvalidAccessKeyId

- Verify Access Key ID is correct
- Check if the IAM user still exists
- Regenerate access keys if needed

## Security Best Practices

1. **Use IAM roles** in production (EC2, ECS, Lambda) instead of access keys
2. **Limit permissions** - Only grant PutObject, GetObject, DeleteObject as needed
3. **Rotate keys regularly** - Change access keys periodically
4. **Use secrets manager** - Store credentials in AWS Secrets Manager or similar
5. **Never commit credentials** - Always use `.gitignore` for `.env` files

## Testing S3 Configuration

After configuration, test by uploading a video. Check:

1. **Backend logs** - Should show S3 upload success
2. **AWS S3 Console** - File should appear in the bucket
3. **Database** - `video_url` field should contain `s3://bucket-name/key` format
