-- Create database
CREATE DATABASE IF NOT EXISTS kongkwun_bot CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create conversations table
USE kongkwun_bot;

CREATE TABLE IF NOT EXISTS conversations (
    id BIGINT NOT NULL AUTO_INCREMENT,
    line_user_id VARCHAR(64) NOT NULL,
    direction VARCHAR(20) NOT NULL,
    message_type VARCHAR(20) NOT NULL,
    content JSON NOT NULL,
    media_url TEXT NULL,
    reply_token VARCHAR(64) NULL,
    source_type VARCHAR(20) NULL,
    source_id VARCHAR(64) NULL,
    timestamp DATETIME(3) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    INDEX idx_user_timestamp (line_user_id, timestamp),
    INDEX idx_direction (direction),
    INDEX idx_timestamp (timestamp)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
