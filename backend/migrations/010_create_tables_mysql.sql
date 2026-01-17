-- ============================================================================
-- MySQL/AWS RDS MySQL Table Creation Script
-- ============================================================================
-- This script creates the frame_analyses table for MySQL/AWS RDS MySQL
-- Compatible with MySQL 5.7+ and MariaDB 10.2+

-- ============================================================================
-- FRAME ANALYSES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS frame_analyses (
    id                  CHAR(36) PRIMARY KEY,
    video_id            CHAR(36) NOT NULL,
    
    -- Frame metadata
    timestamp           DOUBLE NOT NULL,
    frame_number        INT NULL,
    image_path          TEXT NOT NULL,
    
    -- Analysis results
    description         TEXT NULL,
    ocr_text            TEXT NULL,
    gpt_response        JSON NULL,
    
    -- Processing metadata
    processing_time_ms  INT NULL,
    
    -- Timestamps
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraint
    CONSTRAINT FK_frame_analyses_video_id 
        FOREIGN KEY (video_id) 
        REFERENCES video_uploads(id) 
        ON DELETE CASCADE,
    
    -- Indexes
    INDEX idx_frame_analyses_video_id (video_id),
    INDEX idx_frame_analyses_timestamp (video_id, timestamp),
    INDEX idx_frame_analyses_created_at (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- For MySQL versions < 5.7 that don't support JSON type, use TEXT instead:
-- ALTER TABLE frame_analyses MODIFY COLUMN gpt_response TEXT NULL;

-- Add comments (MySQL 5.7+)
-- ALTER TABLE frame_analyses COMMENT = 'Stores frame-by-frame analysis results from video processing';
