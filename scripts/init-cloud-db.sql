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
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    timestamp DATETIME(3) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    quote_token VARCHAR(500) NULL,
    quoted_message_id BIGINT NULL,
    PRIMARY KEY (id),
    INDEX idx_user_timestamp (line_user_id, timestamp),
    INDEX idx_direction (direction),
    INDEX idx_timestamp (timestamp),
    INDEX idx_user_direction_read (line_user_id, direction, is_read)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS chat_status (
    line_user_id VARCHAR(64) NOT NULL,
    pinned BOOLEAN NOT NULL DEFAULT FALSE,
    pinned_at DATETIME(3) NULL,
    is_spam BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (line_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS note_categories (
    `key` VARCHAR(80) NOT NULL,
    label VARCHAR(120) NOT NULL,
    color VARCHAR(20) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_notes (
    id VARCHAR(80) NOT NULL,
    line_user_id VARCHAR(64) NOT NULL,
    category VARCHAR(80) NOT NULL,
    custom_label VARCHAR(120) NULL,
    body TEXT NOT NULL,
    author VARCHAR(80) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    INDEX idx_user_notes_user_created (line_user_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS message_templates (
    `key` VARCHAR(80) NOT NULL,
    items JSON NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
