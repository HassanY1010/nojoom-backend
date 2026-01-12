/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: active_conversations
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `active_conversations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user1_id` int(11) NOT NULL,
  `user2_id` int(11) NOT NULL,
  `last_message_id` int(11) DEFAULT NULL,
  `last_message_content` text DEFAULT NULL,
  `last_message_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `unread_count` int(11) DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_conversation` (`user1_id`, `user2_id`),
  KEY `last_message_id` (`last_message_id`),
  KEY `idx_user1_id` (`user1_id`),
  KEY `idx_user2_id` (`user2_id`),
  KEY `idx_last_message_at` (`last_message_at`),
  CONSTRAINT `active_conversations_ibfk_1` FOREIGN KEY (`user1_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `active_conversations_ibfk_2` FOREIGN KEY (`user2_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `active_conversations_ibfk_3` FOREIGN KEY (`last_message_id`) REFERENCES `direct_messages` (`id`) ON DELETE
  SET
  NULL
) ENGINE = InnoDB AUTO_INCREMENT = 5 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: ai_training_data
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `ai_training_data` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `video_id` int(11) NOT NULL,
  `interaction_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`interaction_data`)),
  `prediction_score` decimal(5, 2) DEFAULT NULL,
  `actual_engagement` decimal(5, 2) DEFAULT NULL,
  `accuracy` decimal(5, 2) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `video_id` (`video_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `ai_training_data_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `ai_training_data_ibfk_2` FOREIGN KEY (`video_id`) REFERENCES `videos` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: ai_user_profiles
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `ai_user_profiles` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `eye_tracking_enabled` tinyint(1) DEFAULT 0,
  `voice_tracking_enabled` tinyint(1) DEFAULT 0,
  `scroll_tracking_enabled` tinyint(1) DEFAULT 1,
  `profile_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`profile_data`)),
  `preferences` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`preferences`)),
  `total_ai_score` decimal(8, 2) DEFAULT 0.00,
  `last_updated` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`),
  KEY `idx_user_id` (`user_id`),
  CONSTRAINT `ai_user_profiles_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: animated_messages
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `animated_messages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `sender_id` int(11) NOT NULL,
  `content` text NOT NULL,
  `animation_type` enum('fade', 'slide', 'bounce', 'glow') DEFAULT 'fade',
  `color` varchar(50) DEFAULT '#FFD700',
  `is_active` tinyint(1) DEFAULT 1,
  `views_count` int(11) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `expires_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_sender_id` (`sender_id`),
  KEY `idx_is_active` (`is_active`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `animated_messages_ibfk_1` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: broadcast_displays
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `broadcast_displays` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `broadcast_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `display_count` int(11) DEFAULT 1,
  `displayed_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_broadcast_user` (`broadcast_id`, `user_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `broadcast_displays_ibfk_1` FOREIGN KEY (`broadcast_id`) REFERENCES `broadcasts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `broadcast_displays_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: broadcasts
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `broadcasts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `admin_id` int(11) DEFAULT NULL,
  `content` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `admin_id` (`admin_id`),
  CONSTRAINT `broadcasts_ibfk_1` FOREIGN KEY (`admin_id`) REFERENCES `users` (`id`)
) ENGINE = InnoDB AUTO_INCREMENT = 4 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: challenge_entries
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `challenge_entries` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `challenge_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `video_id` int(11) DEFAULT NULL,
  `comment_id` int(11) DEFAULT NULL,
  `engagement_score` decimal(10, 2) DEFAULT 0.00,
  `submission_date` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_challenge` (`user_id`, `challenge_id`),
  KEY `video_id` (`video_id`),
  KEY `comment_id` (`comment_id`),
  KEY `idx_challenge_id` (`challenge_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_engagement_score` (`engagement_score`),
  CONSTRAINT `challenge_entries_ibfk_1` FOREIGN KEY (`challenge_id`) REFERENCES `challenges` (`id`) ON DELETE CASCADE,
  CONSTRAINT `challenge_entries_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `challenge_entries_ibfk_3` FOREIGN KEY (`video_id`) REFERENCES `videos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `challenge_entries_ibfk_4` FOREIGN KEY (`comment_id`) REFERENCES `comments` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: challenges
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `challenges` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `title_ar` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `description_ar` text DEFAULT NULL,
  `type` enum('10_second_video', 'best_editing', 'best_comment') NOT NULL,
  `start_date` datetime NOT NULL,
  `end_date` datetime NOT NULL,
  `status` enum('active', 'ended', 'archived') DEFAULT 'active',
  `winner_id` int(11) DEFAULT NULL,
  `winner_announced_at` datetime DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `winner_id` (`winner_id`),
  KEY `idx_status` (`status`),
  KEY `idx_type` (`type`),
  KEY `idx_dates` (`start_date`, `end_date`),
  CONSTRAINT `challenges_ibfk_1` FOREIGN KEY (`winner_id`) REFERENCES `users` (`id`) ON DELETE
  SET
  NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: comment_likes
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `comment_likes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `comment_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_comment_user` (`comment_id`, `user_id`),
  KEY `user_id` (`user_id`),
  KEY `idx_comment_id` (`comment_id`),
  CONSTRAINT `comment_likes_ibfk_1` FOREIGN KEY (`comment_id`) REFERENCES `comments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `comment_likes_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: comment_reports
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `comment_reports` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `comment_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `reason` text NOT NULL,
  `status` enum('pending', 'reviewed', 'resolved') DEFAULT 'pending',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_comment_user` (`comment_id`, `user_id`),
  KEY `user_id` (`user_id`),
  KEY `idx_comment_id` (`comment_id`),
  KEY `idx_status` (`status`),
  CONSTRAINT `comment_reports_ibfk_1` FOREIGN KEY (`comment_id`) REFERENCES `comments` (`id`) ON DELETE CASCADE,
  CONSTRAINT `comment_reports_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: comments
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `comments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `video_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `username` varchar(255) NOT NULL,
  `content` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT NULL ON UPDATE current_timestamp(),
  `deleted_by_admin` tinyint(1) DEFAULT 0,
  `deletion_reason` text DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT NULL,
  `status` enum('active', 'inactive') NOT NULL DEFAULT 'active',
  PRIMARY KEY (`id`),
  KEY `idx_video_id` (`video_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `comments_ibfk_1` FOREIGN KEY (`video_id`) REFERENCES `videos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `comments_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 19 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: deleted_messages_archive
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `deleted_messages_archive` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `original_id` int(11) NOT NULL,
  `sender_id` int(11) NOT NULL,
  `video_id` int(11) NOT NULL,
  `content` text NOT NULL,
  `type` enum('user', 'admin') DEFAULT 'user',
  `created_at` timestamp NULL DEFAULT NULL,
  `deleted_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_deleted_at` (`deleted_at`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: direct_messages
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `direct_messages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `sender_id` int(11) NOT NULL,
  `receiver_id` int(11) NOT NULL,
  `content` text NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `is_read` tinyint(1) DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `sender_id` (`sender_id`),
  KEY `receiver_id` (`receiver_id`),
  CONSTRAINT `direct_messages_ibfk_1` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `direct_messages_ibfk_2` FOREIGN KEY (`receiver_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 5 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: email_verification_tokens
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `email_verification_tokens` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `token` varchar(255) NOT NULL,
  `expires_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_token` (`token`),
  KEY `idx_user_id` (`user_id`),
  CONSTRAINT `email_verification_tokens_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 10 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: explore_views
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `explore_views` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) DEFAULT NULL,
  `video_id` int(11) DEFAULT NULL,
  `source` varchar(50) DEFAULT 'explore',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_user_source` (`user_id`, `source`),
  KEY `idx_video_source` (`video_id`, `source`),
  CONSTRAINT `explore_views_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `explore_views_ibfk_2` FOREIGN KEY (`video_id`) REFERENCES `videos` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: eye_tracking
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `eye_tracking` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `video_id` int(11) NOT NULL,
  `gaze_points` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`gaze_points`)),
  `attention_score` decimal(5, 2) DEFAULT 0.00,
  `focus_duration` int(11) DEFAULT 0,
  `viewport_data` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`viewport_data`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `video_id` (`video_id`),
  KEY `idx_user_video` (`user_id`, `video_id`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_attention_score` (`attention_score`),
  CONSTRAINT `eye_tracking_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `eye_tracking_ibfk_2` FOREIGN KEY (`video_id`) REFERENCES `videos` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: followers
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `followers` (
  `follower_id` int(11) NOT NULL,
  `following_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`follower_id`, `following_id`),
  KEY `following_id` (`following_id`),
  CONSTRAINT `followers_ibfk_1` FOREIGN KEY (`follower_id`) REFERENCES `users` (`id`),
  CONSTRAINT `followers_ibfk_2` FOREIGN KEY (`following_id`) REFERENCES `users` (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: follows
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `follows` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `follower_id` int(11) NOT NULL,
  `following_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_follow` (`follower_id`, `following_id`),
  KEY `idx_follower_id` (`follower_id`),
  KEY `idx_following_id` (`following_id`),
  CONSTRAINT `follows_ibfk_1` FOREIGN KEY (`follower_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `follows_ibfk_2` FOREIGN KEY (`following_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: likes
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `likes` (
  `user_id` int(11) NOT NULL,
  `video_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`user_id`, `video_id`),
  KEY `video_id` (`video_id`),
  CONSTRAINT `likes_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `likes_ibfk_2` FOREIGN KEY (`video_id`) REFERENCES `videos` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: message_displays
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `message_displays` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `message_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `display_count` int(11) DEFAULT 1,
  `displayed_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_message_user` (`message_id`, `user_id`),
  KEY `idx_user_id` (`user_id`),
  CONSTRAINT `message_displays_ibfk_1` FOREIGN KEY (`message_id`) REFERENCES `messages` (`id`) ON DELETE CASCADE,
  CONSTRAINT `message_displays_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: messages
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `messages` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `sender_id` int(11) DEFAULT NULL,
  `video_id` int(11) DEFAULT NULL,
  `content` text NOT NULL,
  `type` enum('user', 'admin') DEFAULT 'user',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `floating_displayed` tinyint(1) DEFAULT 0,
  `display_count` int(11) DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `sender_id` (`sender_id`),
  KEY `video_id` (`video_id`),
  CONSTRAINT `messages_ibfk_1` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE
  SET
  NULL,
  CONSTRAINT `messages_ibfk_2` FOREIGN KEY (`video_id`) REFERENCES `videos` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 30 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: notifications
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `notifications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `type` enum('follow', 'like', 'comment', 'mention') NOT NULL,
  `actor_id` int(11) NOT NULL,
  `target_id` int(11) DEFAULT NULL,
  `target_type` enum('video', 'comment', 'user') DEFAULT NULL,
  `message` text NOT NULL,
  `is_read` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `actor_id` (`actor_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_is_read` (`is_read`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `notifications_ibfk_2` FOREIGN KEY (`actor_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: refresh_tokens
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `refresh_tokens` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `token` varchar(512) NOT NULL,
  `expires_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `is_revoked` tinyint(1) DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token` (`token`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `refresh_tokens_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 291 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: reports
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `reports` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `reporter_id` int(11) NOT NULL,
  `reported_user_id` int(11) NOT NULL,
  `video_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `reason` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `status` enum('pending', 'reviewed', 'resolved') DEFAULT 'pending',
  `admin_id` int(11) DEFAULT NULL,
  `admin_notes` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `video_id` (`video_id`),
  KEY `user_id` (`user_id`),
  KEY `admin_id` (`admin_id`),
  CONSTRAINT `reports_ibfk_1` FOREIGN KEY (`video_id`) REFERENCES `videos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `reports_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `reports_ibfk_3` FOREIGN KEY (`admin_id`) REFERENCES `users` (`id`) ON DELETE
  SET
  NULL
) ENGINE = InnoDB AUTO_INCREMENT = 2 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: reset_codes
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `reset_codes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `code` varchar(10) NOT NULL,
  `expires_at` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: scroll_behavior
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `scroll_behavior` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `video_id` int(11) NOT NULL,
  `scroll_speed` decimal(8, 2) DEFAULT 0.00,
  `scroll_pattern` varchar(50) DEFAULT NULL,
  `pause_duration` int(11) DEFAULT 0,
  `engagement_score` decimal(5, 2) DEFAULT 0.00,
  `swipe_direction` varchar(20) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_video_id` (`video_id`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `scroll_behavior_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `scroll_behavior_ibfk_2` FOREIGN KEY (`video_id`) REFERENCES `videos` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: search_history
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `search_history` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `query` varchar(255) NOT NULL,
  `search_type` enum('all', 'videos', 'users') DEFAULT 'all',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `search_history_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 29 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: search_interactions
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `search_interactions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `video_id` int(11) NOT NULL,
  `interaction_type` enum(
  'like',
  'share',
  'watch',
  'comment',
  'report',
  'follow',
  'unfollow'
  ) NOT NULL,
  `weight` float DEFAULT 1,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_video_id` (`video_id`),
  KEY `idx_interaction_type` (`interaction_type`),
  CONSTRAINT `search_interactions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `search_interactions_ibfk_2` FOREIGN KEY (`video_id`) REFERENCES `videos` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: system_settings
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `system_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `site_name` varchar(255) NOT NULL DEFAULT 'Nojoom',
  `site_url` varchar(255) NOT NULL DEFAULT 'http://localhost:5173',
  `default_language` varchar(10) NOT NULL DEFAULT 'en',
  `theme` enum('light', 'dark') NOT NULL DEFAULT 'light',
  `allow_registration` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `maintenance_mode` tinyint(1) DEFAULT 0,
  `chat_enabled` tinyint(1) DEFAULT 1,
  `upload_enabled` tinyint(1) DEFAULT 1,
  `max_video_size` int(11) DEFAULT 500,
  `max_video_duration` int(11) DEFAULT 300,
  `allowed_video_formats` varchar(255) DEFAULT 'mp4',
  `user_registration_enabled` tinyint(1) DEFAULT 1,
  `auto_ban_reports_threshold` int(11) DEFAULT 5,
  PRIMARY KEY (`id`)
) ENGINE = InnoDB AUTO_INCREMENT = 2 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: user_badges
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `user_badges` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `badge_type` enum(
  '10_second_winner',
  'editing_winner',
  'comment_winner'
  ) NOT NULL,
  `challenge_id` int(11) NOT NULL,
  `awarded_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `challenge_id` (`challenge_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_badge_type` (`badge_type`),
  CONSTRAINT `user_badges_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_badges_ibfk_2` FOREIGN KEY (`challenge_id`) REFERENCES `challenges` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: user_interactions
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `user_interactions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `video_id` int(11) DEFAULT NULL,
  `target_user_id` int(11) DEFAULT NULL COMMENT 'للمتابعة/إلغاء المتابعة',
  `interaction_type` enum(
  'like',
  'share',
  'watch',
  'comment',
  'report',
  'follow',
  'unfollow'
  ) NOT NULL,
  `weight` decimal(3, 2) NOT NULL DEFAULT 1.00,
  `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_video_id` (`video_id`),
  KEY `idx_interaction_type` (`interaction_type`),
  KEY `target_user_id` (`target_user_id`),
  CONSTRAINT `user_interactions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_interactions_ibfk_2` FOREIGN KEY (`video_id`) REFERENCES `videos` (`id`) ON DELETE
  SET
  NULL,
  CONSTRAINT `user_interactions_ibfk_3` FOREIGN KEY (`target_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 70 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: user_preferences
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `user_preferences` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `preferred_categories` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`preferred_categories`)),
  `content_weights` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`content_weights`)),
  `excluded_users` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`excluded_users`)),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`),
  CONSTRAINT `user_preferences_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: user_watch_sessions
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `user_watch_sessions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `video_id` int(11) NOT NULL,
  `start_time` datetime NOT NULL,
  `last_activity` datetime NOT NULL,
  `total_watch_time` int(11) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_video_session` (`user_id`, `video_id`),
  KEY `idx_user_watch_sessions_user` (`user_id`),
  KEY `idx_user_watch_sessions_video` (`video_id`),
  KEY `idx_user_watch_sessions_activity` (`last_activity`),
  CONSTRAINT `user_watch_sessions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_watch_sessions_ibfk_2` FOREIGN KEY (`video_id`) REFERENCES `videos` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: user_watch_time
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `user_watch_time` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `video_id` int(11) NOT NULL,
  `watch_time` int(11) NOT NULL,
  `session_date` date NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_video_date` (`user_id`, `video_id`, `session_date`),
  KEY `video_id` (`video_id`),
  KEY `idx_user_watch_time_user` (`user_id`),
  KEY `idx_user_watch_time_date` (`session_date`),
  CONSTRAINT `user_watch_time_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_watch_time_ibfk_2` FOREIGN KEY (`video_id`) REFERENCES `videos` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: users
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `username` varchar(50) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `avatar` varchar(255) DEFAULT NULL,
  `role` enum('user', 'admin') DEFAULT 'user',
  `email_verified` tinyint(1) DEFAULT 0,
  `language` varchar(10) DEFAULT 'en',
  `theme` varchar(20) DEFAULT 'light',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `bio` text DEFAULT NULL,
  `followers_count` int(11) DEFAULT 0,
  `following_count` int(11) DEFAULT 0,
  `social_links` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`social_links`)),
  `likes_count` int(11) DEFAULT 0,
  `views_count` int(11) DEFAULT 0,
  `is_banned` tinyint(1) DEFAULT 0,
  `ban_reason` text DEFAULT NULL,
  `last_login` datetime DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `is_online` tinyint(1) DEFAULT 0,
  `total_watch_time` int(11) DEFAULT 0,
  `last_seen` datetime DEFAULT NULL,
  `birth_month` varchar(20) DEFAULT NULL,
  `birth_year` int(4) DEFAULT NULL,
  `birth_date` date DEFAULT NULL,
  `birth_day` int(2) DEFAULT NULL,
  `display_name` varchar(255) DEFAULT NULL,
  `is_private` tinyint(1) DEFAULT 0,
  `allow_comments` tinyint(1) DEFAULT 1,
  `two_factor_enabled` tinyint(1) DEFAULT 0,
  `login_notifications` tinyint(1) DEFAULT 1,
  `deleted_at` datetime DEFAULT NULL,
  `status` enum('active', 'inactive') NOT NULL DEFAULT 'active',
  `allow_dms` tinyint(1) DEFAULT 1,
  `show_activity_status` tinyint(1) DEFAULT 1,
  `otp_code` varchar(6) DEFAULT NULL,
  `otp_expires` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`),
  UNIQUE KEY `username_2` (`username`),
  KEY `idx_user_username` (`username`)
) ENGINE = InnoDB AUTO_INCREMENT = 21 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: video_chunks
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `video_chunks` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `video_id` int(11) NOT NULL,
  `quality` enum('360p', '480p', '720p') NOT NULL,
  `chunk_index` int(11) NOT NULL,
  `chunk_path` varchar(255) NOT NULL,
  `duration` decimal(5, 2) DEFAULT NULL,
  `file_size` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_video_quality` (`video_id`, `quality`),
  KEY `idx_chunk_index` (`chunk_index`),
  CONSTRAINT `video_chunks_ibfk_1` FOREIGN KEY (`video_id`) REFERENCES `videos` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: video_manifests
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `video_manifests` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `video_id` int(11) NOT NULL,
  `manifest_path` varchar(255) NOT NULL,
  `total_chunks` int(11) DEFAULT 0,
  `processing_status` enum('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
  `error_message` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_video` (`video_id`),
  KEY `idx_processing_status` (`processing_status`),
  CONSTRAINT `video_manifests_ibfk_1` FOREIGN KEY (`video_id`) REFERENCES `videos` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 3 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: video_shares
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `video_shares` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `video_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `share_method` varchar(50) DEFAULT 'direct',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_video_user_share` (`video_id`, `user_id`),
  KEY `idx_video_shares_video_id` (`video_id`),
  KEY `idx_video_shares_user_id` (`user_id`),
  KEY `idx_video_shares_created_at` (`created_at`),
  CONSTRAINT `video_shares_ibfk_1` FOREIGN KEY (`video_id`) REFERENCES `videos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `video_shares_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 2 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: video_views
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `video_views` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `video_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_view` (`video_id`, `user_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `video_views_ibfk_1` FOREIGN KEY (`video_id`) REFERENCES `videos` (`id`) ON DELETE CASCADE,
  CONSTRAINT `video_views_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: videos
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `videos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `path` varchar(255) NOT NULL,
  `url` varchar(255) NOT NULL,
  `thumbnail` varchar(500) DEFAULT NULL,
  `duration` int(11) DEFAULT 0,
  `description` text DEFAULT NULL,
  `is_chat_video` tinyint(1) DEFAULT 0,
  `views` int(11) DEFAULT 0,
  `shares` int(11) DEFAULT 0,
  `likes` int(11) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `is_public` tinyint(1) DEFAULT 1,
  `deleted_by_admin` tinyint(1) DEFAULT 0,
  `deletion_reason` text DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `hashtags` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`hashtags`)),
  `music` varchar(255) DEFAULT NULL,
  `status` enum('active', 'inactive') DEFAULT 'active',
  `is_pinned` tinyint(1) NOT NULL DEFAULT 0,
  `pinned_at` datetime DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `video_url` varchar(255) DEFAULT NULL,
  `subspace_video_id` varchar(255) DEFAULT NULL,
  `subspace_thumbnail_id` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `idx_video_description` (`description`(768)),
  KEY `idx_hashtags` (`hashtags`(255)),
  CONSTRAINT `videos_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 28 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: voice_interactions
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `voice_interactions` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `video_id` int(11) NOT NULL,
  `interaction_type` varchar(50) DEFAULT 'reaction',
  `duration` int(11) DEFAULT 0,
  `intensity` decimal(5, 2) DEFAULT 0.00,
  `timestamp_in_video` int(11) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_video_id` (`video_id`),
  KEY `idx_created_at` (`created_at`),
  CONSTRAINT `voice_interactions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `voice_interactions_ibfk_2` FOREIGN KEY (`video_id`) REFERENCES `videos` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

# ------------------------------------------------------------
# SCHEMA DUMP FOR TABLE: watch_history
# ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS `watch_history` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `video_id` int(11) NOT NULL,
  `watch_time` int(11) NOT NULL DEFAULT 0 COMMENT 'مدة المشاهدة بالثواني',
  `completed` tinyint(1) DEFAULT 0,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `last_position` decimal(10, 2) DEFAULT 0.00 COMMENT 'آخر ثانية تمت مشاهدتها للاستئناف',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_video` (`user_id`, `video_id`),
  KEY `video_id` (`video_id`),
  CONSTRAINT `watch_history_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `watch_history_ibfk_2` FOREIGN KEY (`video_id`) REFERENCES `videos` (`id`) ON DELETE CASCADE
) ENGINE = InnoDB AUTO_INCREMENT = 8726 DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

# ------------------------------------------------------------
# DATA DUMP FOR TABLE: active_conversations
# ------------------------------------------------------------

INSERT INTO
  `active_conversations` (
    `id`,
    `user1_id`,
    `user2_id`,
    `last_message_id`,
    `last_message_content`,
    `last_message_at`,
    `unread_count`
  )
VALUES
  (1, 19, 20, 4, '?', '2026-01-12 07:11:52', 0);

# ------------------------------------------------------------
# DATA DUMP FOR TABLE: ai_training_data
# ------------------------------------------------------------


# ------------------------------------------------------------
# DATA DUMP FOR TABLE: ai_user_profiles
# ------------------------------------------------------------


# ------------------------------------------------------------
# DATA DUMP FOR TABLE: animated_messages
# ------------------------------------------------------------


# ------------------------------------------------------------
# DATA DUMP FOR TABLE: broadcast_displays
# ------------------------------------------------------------


# ------------------------------------------------------------
# DATA DUMP FOR TABLE: broadcasts
# ------------------------------------------------------------


# ------------------------------------------------------------
# DATA DUMP FOR TABLE: challenge_entries
# ------------------------------------------------------------


# ------------------------------------------------------------
# DATA DUMP FOR TABLE: challenges
# ------------------------------------------------------------


# ------------------------------------------------------------
# DATA DUMP FOR TABLE: comment_likes
# ------------------------------------------------------------


# ------------------------------------------------------------
# DATA DUMP FOR TABLE: comment_reports
# ------------------------------------------------------------


# ------------------------------------------------------------
# DATA DUMP FOR TABLE: comments
# ------------------------------------------------------------

INSERT INTO
  `comments` (
    `id`,
    `video_id`,
    `user_id`,
    `username`,
    `content`,
    `created_at`,
    `updated_at`,
    `deleted_by_admin`,
    `deletion_reason`,
    `deleted_at`,
    `status`
  )
VALUES
  (
    17,
    25,
    19,
    'hassan',
    'روعة',
    '2026-01-10 19:47:45',
    NULL,
    0,
    NULL,
    NULL,
    'active'
  );
INSERT INTO
  `comments` (
    `id`,
    `video_id`,
    `user_id`,
    `username`,
    `content`,
    `created_at`,
    `updated_at`,
    `deleted_by_admin`,
    `deletion_reason`,
    `deleted_at`,
    `status`
  )
VALUES
  (
    18,
    27,
    20,
    'admin',
    'شكرا لك',
    '2026-01-12 08:38:59',
    NULL,
    0,
    NULL,
    NULL,
    'active'
  );

# ------------------------------------------------------------
# DATA DUMP FOR TABLE: deleted_messages_archive
# ------------------------------------------------------------


# ------------------------------------------------------------
# DATA DUMP FOR TABLE: direct_messages
# ------------------------------------------------------------

INSERT INTO
  `direct_messages` (
    `id`,
    `sender_id`,
    `receiver_id`,
    `content`,
    `created_at`,
    `is_read`
  )
VALUES
  (
    1,
    19,
    20,
    'Verification message at 2026-01-11T18:32:03.481Z',
    '2026-01-11 21:32:03',
    1
  );
INSERT INTO
  `direct_messages` (
    `id`,
    `sender_id`,
    `receiver_id`,
    `content`,
    `created_at`,
    `is_read`
  )
VALUES
  (2, 19, 20, 'هلا كيف الحال', '2026-01-12 07:10:29', 1);
INSERT INTO
  `direct_messages` (
    `id`,
    `sender_id`,
    `receiver_id`,
    `content`,
    `created_at`,
    `is_read`
  )
VALUES
  (3, 20, 19, 'الحمد لله', '2026-01-12 07:11:46', 1);
INSERT INTO
  `direct_messages` (
    `id`,
    `sender_id`,
    `receiver_id`,
    `content`,
    `created_at`,
    `is_read`
  )
VALUES
  (4, 20, 19, '?', '2026-01-12 07:11:52', 1);

# ------------------------------------------------------------
# DATA DUMP FOR TABLE: email_verification_tokens
# ------------------------------------------------------------


# ------------------------------------------------------------
# DATA DUMP FOR TABLE: explore_views
# ------------------------------------------------------------


# ------------------------------------------------------------
# DATA DUMP FOR TABLE: eye_tracking
# ------------------------------------------------------------


# ------------------------------------------------------------
# DATA DUMP FOR TABLE: followers
# ------------------------------------------------------------

INSERT INTO
  `followers` (`follower_id`, `following_id`, `created_at`)
VALUES
  (19, 20, '2026-01-12 08:49:53');

# ------------------------------------------------------------
# DATA DUMP FOR TABLE: follows
# ------------------------------------------------------------


# ------------------------------------------------------------
# DATA DUMP FOR TABLE: likes
# ------------------------------------------------------------

INSERT INTO
  `likes` (`user_id`, `video_id`, `created_at`)
VALUES
  (19, 25, '2026-01-10 19:47:47');
INSERT INTO
  `likes` (`user_id`, `video_id`, `created_at`)
VALUES
  (20, 27, '2026-01-12 08:38:50');

# ------------------------------------------------------------
# DATA DUMP FOR TABLE: message_displays
# ------------------------------------------------------------


# ------------------------------------------------------------
# DATA DUMP FOR TABLE: messages
# ------------------------------------------------------------


# ------------------------------------------------------------
# DATA DUMP FOR TABLE: notifications
# ------------------------------------------------------------


# ------------------------------------------------------------
# DATA DUMP FOR TABLE: refresh_tokens
# ------------------------------------------------------------

INSERT INTO
  `refresh_tokens` (
    `id`,
    `user_id`,
    `token`,
    `expires_at`,
    `created_at`,
    `is_revoked`
  )
VALUES
  (
    250,
    20,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjAsImlhdCI6MTc2ODA2MDU3OCwiZXhwIjoxNzY4NjY1Mzc4fQ.yH4fyCQ_0WJVz6has_zhF2ylftEgkjK29Dut4PJpbF0',
    '2026-01-10 18:56:18',
    '2026-01-10 18:56:18',
    0
  );
INSERT INTO
  `refresh_tokens` (
    `id`,
    `user_id`,
    `token`,
    `expires_at`,
    `created_at`,
    `is_revoked`
  )
VALUES
  (
    251,
    19,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTksImlhdCI6MTc2ODA2MTU4MSwiZXhwIjoxNzY4NjY2MzgxfQ.DIsFCLOR1_ZLQK7hd61aZgPUGR-XA3a0sCfPcRLh9Ek',
    '2026-01-17 19:13:01',
    '2026-01-10 18:56:24',
    0
  );
INSERT INTO
  `refresh_tokens` (
    `id`,
    `user_id`,
    `token`,
    `expires_at`,
    `created_at`,
    `is_revoked`
  )
VALUES
  (
    252,
    20,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjAsImlhdCI6MTc2ODA2MzM4NiwiZXhwIjoxNzY4NjY4MTg2fQ.n2easXlQLcN7RvkRDo3k0DfQjZKsfXfIOAIpZSI_PqA',
    '2026-01-10 19:43:06',
    '2026-01-10 19:43:06',
    0
  );
INSERT INTO
  `refresh_tokens` (
    `id`,
    `user_id`,
    `token`,
    `expires_at`,
    `created_at`,
    `is_revoked`
  )
VALUES
  (
    253,
    19,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTksImlhdCI6MTc2ODA2NDM1NywiZXhwIjoxNzY4NjY5MTU3fQ.nLDnAyEFIVh33jjKMZptuUvhbCTZASXIqdpXWwET4sM',
    '2026-01-17 19:59:17',
    '2026-01-10 19:43:11',
    0
  );
INSERT INTO
  `refresh_tokens` (
    `id`,
    `user_id`,
    `token`,
    `expires_at`,
    `created_at`,
    `is_revoked`
  )
VALUES
  (
    254,
    20,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjAsImlhdCI6MTc2ODA2NDY1MSwiZXhwIjoxNzY4NjY5NDUxfQ.c4dvoFmjwioO7APJlMJHdqcl-2lGyBSbPIMgR1yxGq0',
    '2026-01-10 20:04:11',
    '2026-01-10 20:04:11',
    0
  );
INSERT INTO
  `refresh_tokens` (
    `id`,
    `user_id`,
    `token`,
    `expires_at`,
    `created_at`,
    `is_revoked`
  )
VALUES
  (
    255,
    20,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjAsImlhdCI6MTc2ODA2ODMzNSwiZXhwIjoxNzY4NjczMTM1fQ.GE4tFnHKNIeO1KjbAn7KKw50rRj3srUbPbJzj3pxNtg',
    '2026-01-17 21:05:35',
    '2026-01-10 20:49:14',
    0
  );
INSERT INTO
  `refresh_tokens` (
    `id`,
    `user_id`,
    `token`,
    `expires_at`,
    `created_at`,
    `is_revoked`
  )
VALUES
  (
    256,
    20,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjAsImlhdCI6MTc2ODA2ODU5OCwiZXhwIjoxNzY4NjczMzk4fQ.0XHfarWgy9bbcx8uugvP2eejuDOGNS_6_hZgUjkIjoo',
    '2026-01-10 21:09:58',
    '2026-01-10 21:09:58',
    0
  );
INSERT INTO
  `refresh_tokens` (
    `id`,
    `user_id`,
    `token`,
    `expires_at`,
    `created_at`,
    `is_revoked`
  )
VALUES
  (
    257,
    19,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTksImlhdCI6MTc2ODA2ODg3NCwiZXhwIjoxNzY4NjczNjc0fQ.cCD0dyzxxNk4ElB92J07SGgJo_S9rvdNMO5XcnE3qE4',
    '2026-01-10 21:14:34',
    '2026-01-10 21:14:34',
    0
  );
INSERT INTO
  `refresh_tokens` (
    `id`,
    `user_id`,
    `token`,
    `expires_at`,
    `created_at`,
    `is_revoked`
  )
VALUES
  (
    258,
    19,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTksImlhdCI6MTc2ODEzNzQ5NywiZXhwIjoxNzY4NzQyMjk3fQ.pyZLrLpF73vJanZHzwlpoLyjFZcIiZlZMem1cR4dbCM',
    '2026-01-11 16:18:17',
    '2026-01-11 16:18:17',
    0
  );
INSERT INTO
  `refresh_tokens` (
    `id`,
    `user_id`,
    `token`,
    `expires_at`,
    `created_at`,
    `is_revoked`
  )
VALUES
  (
    259,
    19,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTksImlhdCI6MTc2ODE0MTMyMSwiZXhwIjoxNzY4NzQ2MTIxfQ.DuhBahrlHUSiNxrFSIL7ROqyG8J5FvEpwnlvbBmnDC8',
    '2026-01-11 17:22:01',
    '2026-01-11 17:22:01',
    0
  );
INSERT INTO
  `refresh_tokens` (
    `id`,
    `user_id`,
    `token`,
    `expires_at`,
    `created_at`,
    `is_revoked`
  )
VALUES
  (
    260,
    19,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTksImlhdCI6MTc2ODE0MTU2NCwiZXhwIjoxNzY4NzQ2MzY0fQ.sM880ZO9MXBGPx45twCyHgomHk57GdKugzEPEJ4d-Mk',
    '2026-01-11 17:26:04',
    '2026-01-11 17:26:04',
    0
  );
INSERT INTO
  `refresh_tokens` (
    `id`,
    `user_id`,
    `token`,
    `expires_at`,
    `created_at`,
    `is_revoked`
  )
VALUES
  (
    261,
    19,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTksImlhdCI6MTc2ODE0MzI3MCwiZXhwIjoxNzY4NzQ4MDcwfQ.kUDvDS3wLZwD7KlMcesxmuqkvsmazkR3f0eU32U6zbE',
    '2026-01-11 17:54:30',
    '2026-01-11 17:54:30',
    0
  );
INSERT INTO
  `refresh_tokens` (
    `id`,
    `user_id`,
    `token`,
    `expires_at`,
    `created_at`,
    `is_revoked`
  )
VALUES
  (
    262,
    19,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTksImlhdCI6MTc2ODE1MDYzNSwiZXhwIjoxNzY4NzU1NDM1fQ.HqLJsNMl6IbgPIzpDYdiKV2o764msVIUDqH-9dXv4xI',
    '2026-01-18 19:57:15',
    '2026-01-11 17:56:48',
    0
  );
INSERT INTO
  `refresh_tokens` (
    `id`,
    `user_id`,
    `token`,
    `expires_at`,
    `created_at`,
    `is_revoked`
  )
VALUES
  (
    263,
    19,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTksImlhdCI6MTc2ODE1MTQyNCwiZXhwIjoxNzY4NzU2MjI0fQ.YmF7pkNsJ9wTKGUZUSJI5DGnoAZu8OVu2nhRqVPfbMQ',
    '2026-01-18 20:10:24',
    '2026-01-11 19:57:20',
    0
  );
INSERT INTO
  `refresh_tokens` (
    `id`,
    `user_id`,
    `token`,
    `expires_at`,
    `created_at`,
    `is_revoked`
  )
VALUES
  (
    264,
    19,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTksImlhdCI6MTc2ODE1MTQzMiwiZXhwIjoxNzY4NzU2MjMyfQ.AuBUC7X1j0CYsPmbHY7t4kUxHFfakXSeazxzTMY0UA4',
    '2026-01-18 20:10:32',
    '2026-01-11 20:10:27',
    0
  );
INSERT INTO
  `refresh_tokens` (
    `id`,
    `user_id`,
    `token`,
    `expires_at`,
    `created_at`,
    `is_revoked`
  )
VALUES
  (
    265,
    19,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTksImlhdCI6MTc2ODE1MTU0OCwiZXhwIjoxNzY4NzU2MzQ4fQ._E5Esebi3iJSWdoDgiyuXDbYv4ef3tFtgqu1z-WS_gE',
    '2026-01-18 20:12:28',
    '2026-01-11 20:12:19',
    0
  );
INSERT INTO
  `refresh_tokens` (
    `id`,
    `user_id`,
    `token`,
    `expires_at`,
    `created_at`,
    `is_revoked`
  )
VALUES
  (
    266,
    19,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTksImlhdCI6MTc2ODE1MTU1OSwiZXhwIjoxNzY4NzU2MzU5fQ.u7NCnhKOTzHTJymEu9aMowsPtEocHBWn_xgHbG4o_Gs',
    '2026-01-18 20:12:39',
    '2026-01-11 20:12:31',
    0
  );
INSERT INTO
  `refresh_tokens` (
    `id`,
    `user_id`,
    `token`,
    `expires_at`,
    `created_at`,
    `is_revoked`
  )
VALUES
  (
    267,
    19,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTksImlhdCI6MTc2ODE1MTc2NSwiZXhwIjoxNzY4NzU2NTY1fQ.EgCB4eIsjMlL4rphz6g1KNQK7l2LgqZx7MP2fP2erfA',
    '2026-01-18 20:16:05',
    '2026-01-11 20:15:53',
    0
  );
INSERT INTO
  `refresh_tokens` (
    `id`,
    `user_id`,
    `token`,
    `expires_at`,
    `created_at`,
    `is_revoked`
  )
VALUES
  (
    268,
    19,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTksImlhdCI6MTc2ODE1MTk4OSwiZXhwIjoxNzY4NzU2Nzg5fQ.UPPC30RMZQ7tV4m6UAoG40aEqMTykrPgd6m8TeGunDo',
    '2026-01-18 20:19:49',
    '2026-01-11 20:19:49',
    0
  );
INSERT INTO
  `refresh_tokens` (
    `id`,
    `user_id`,
    `token`,
    `expires_at`,
    `created_at`,
    `is_revoked`
  )
VALUES
  (
    269,
    19,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTksImlhdCI6MTc2ODE1MjAyMiwiZXhwIjoxNzY4NzU2ODIyfQ.juV2Tzpxn-Xv2L8xNBU_d7JXj1M_LS0tdCa8l-05O1A',
    '2026-01-18 20:20:22',
    '2026-01-11 20:20:22',
    0
  );
INSERT INTO
  `refresh_tokens` (
    `id`,
    `user_id`,
    `token`,
    `expires_at`,
    `created_at`,
    `is_revoked`
  )
VALUES
  (
    270,
    19,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTksImlhdCI6MTc2ODE1MjkwNSwiZXhwIjoxNzY4NzU3NzA1fQ.H3_GPXWUd3FJyhY_XVtnPMO6xhrndMb95z-dhe2BEjU',
    '2026-01-18 20:35:05',
    '2026-01-11 20:35:05',
    0
  );
INSERT INTO
  `refresh_tokens` (
    `id`,
    `user_id`,
    `token`,
    `expires_at`,
    `created_at`,
    `is_revoked`
  )
VALUES
  (
    271,
    19,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTksImlhdCI6MTc2ODE1MzEyMCwiZXhwIjoxNzY4NzU3OTIwfQ.9RS26xOeuvTlY6nAkngc5yI9RWQ8AidWqmXz0lsgI-M',
    '2026-01-11 20:38:40',
    '2026-01-11 20:38:40',
    0
  );
INSERT INTO
  `refresh_tokens` (
    `id`,
    `user_id`,
    `token`,
    `expires_at`,
    `created_at`,
    `is_revoked`
  )
VALUES
  (
    272,
    19,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTksImlhdCI6MTc2ODE5MDk5MCwiZXhwIjoxNzY4Nzk1NzkwfQ.NJCYAutWalD6tja8tbs_EkUhBRJyLfJN_wNgm6V6s9s',
    '2026-01-19 07:09:50',
    '2026-01-12 07:09:50',
    0
  );
INSERT INTO
  `refresh_tokens` (
    `id`,
    `user_id`,
    `token`,
    `expires_at`,
    `created_at`,
    `is_revoked`
  )
VALUES
  (
    273,
    19,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTksImlhdCI6MTc2ODE5MTAxMiwiZXhwIjoxNzY4Nzk1ODEyfQ.sXW-5S4iAlq54IYesGTS1v4X1RXSn4Od_Yl3UP9WiXA',
    '2026-01-12 07:10:12',
    '2026-01-12 07:10:12',
    0
  );
INSERT INTO
  `refresh_tokens` (
    `id`,
    `user_id`,
    `token`,
    `expires_at`,
    `created_at`,
    `is_revoked`
  )
VALUES
  (
    274,
    19,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTksImlhdCI6MTc2ODE5MTA1OSwiZXhwIjoxNzY4Nzk1ODU5fQ.9yhOOIENXN1m5B9ACCbLhkxmPALf5XVrhm5W7bafRH0',
    '2026-01-12 07:10:59',
    '2026-01-12 07:10:59',
    0
  );
INSERT INTO
  `refresh_tokens` (
    `id`,
    `user_id`,
    `token`,
    `expires_at`,
    `created_at`,
    `is_revoked`
  )
VALUES
  (
    275,
    20,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjAsImlhdCI6MTc2ODE5MTA3NSwiZXhwIjoxNzY4Nzk1ODc1fQ.xpRk_CxwuQocdUzCDEG5-JJk9YnLjYPi6SI8XAbndTs',
    '2026-01-12 07:11:15',
    '2026-01-12 07:11:15',
    0
  );
INSERT INTO
  `refresh_tokens` (
    `id`,
    `user_id`,
    `token`,
    `expires_at`,
    `created_at`,
    `is_revoked`
  )
VALUES
  (
    276,
    19,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTksImlhdCI6MTc2ODE5MTIwNywiZXhwIjoxNzY4Nzk2MDA3fQ.qpR49qpacl0KinQqr1R_uQxCcK0brqYb_mrTf2k-1oo',
    '2026-01-12 07:13:27',
    '2026-01-12 07:13:27',
    0
  );
INSERT INTO
  `refresh_tokens` (
    `id`,
    `user_id`,
    `token`,
    `expires_at`,
    `created_at`,
    `is_revoked`
  )
VALUES
  (
    277,
    19,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTksImlhdCI6MTc2ODE5MTIxOSwiZXhwIjoxNzY4Nzk2MDE5fQ.9-tRzaEcZlnpn6peIoWotP_hLAWkquo5dn1RLkAG75A',
    '2026-01-19 07:13:39',
    '2026-01-12 07:13:39',
    0
  );
INSERT INTO
  `refresh_tokens` (
    `id`,
    `user_id`,
    `token`,
    `expires_at`,
    `created_at`,
    `is_revoked`
  )
VALUES
  (
    278,
    20,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjAsImlhdCI6MTc2ODE5NDU2NywiZXhwIjoxNzY4Nzk5MzY3fQ.iGemTzzyUnoLwjsEnV0p7jqyCfE1cC0tS6snKC-9NQw',
    '2026-01-12 08:09:27',
    '2026-01-12 08:09:27',
    0
  );
INSERT INTO
  `refresh_tokens` (
    `id`,
    `user_id`,
    `token`,
    `expires_at`,
    `created_at`,
    `is_revoked`
  )
VALUES
  (
    279,
    19,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTksImlhdCI6MTc2ODE5NDY0OCwiZXhwIjoxNzY4Nzk5NDQ4fQ.mSqeDB5vga6rtHBWinO37Gqv5Lw5xPArnE3_gmYqYao',
    '2026-01-12 08:10:48',
    '2026-01-12 08:10:48',
    0
  );
INSERT INTO
  `refresh_tokens` (
    `id`,
    `user_id`,
    `token`,
    `expires_at`,
    `created_at`,
    `is_revoked`
  )
VALUES
  (
    280,
    19,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTksImlhdCI6MTc2ODE5NDg1MCwiZXhwIjoxNzY4Nzk5NjUwfQ.kf-cgvAaly-oMUSCAmqcyigDjAACd-0YdH7pHmt7CSI',
    '2026-01-12 08:14:10',
    '2026-01-12 08:14:10',
    0
  );
INSERT INTO
  `refresh_tokens` (
    `id`,
    `user_id`,
    `token`,
    `expires_at`,
    `created_at`,
    `is_revoked`
  )
VALUES
  (
    281,
    19,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTksImlhdCI6MTc2ODE5NDg1NiwiZXhwIjoxNzY4Nzk5NjU2fQ.INiY6dlHbe2rdD2IX0dlchbTVMxWgFBM8gXBAJ-EHNA',
    '2026-01-12 08:14:16',
    '2026-01-12 08:14:16',
    0
  );
INSERT INTO
  `refresh_tokens` (
    `id`,
    `user_id`,
    `token`,
    `expires_at`,
    `created_at`,
    `is_revoked`
  )
VALUES
  (
    282,
    20,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjAsImlhdCI6MTc2ODE5NjU4NywiZXhwIjoxNzY4ODAxMzg3fQ.K09LzUyytbWsAMUGkCrQHdrCYM0Mh_c6Uai1hFpcHDU',
    '2026-01-19 08:43:07',
    '2026-01-12 08:43:07',
    0
  );
INSERT INTO
  `refresh_tokens` (
    `id`,
    `user_id`,
    `token`,
    `expires_at`,
    `created_at`,
    `is_revoked`
  )
VALUES
  (
    283,
    20,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjAsImlhdCI6MTc2ODE5NTA0NSwiZXhwIjoxNzY4Nzk5ODQ1fQ.Xi8LZ1_P84Yn0a2GG_4JPQW7vnaPIBAz7-sbff4-swU',
    '2026-01-12 08:17:25',
    '2026-01-12 08:17:25',
    0
  );
INSERT INTO
  `refresh_tokens` (
    `id`,
    `user_id`,
    `token`,
    `expires_at`,
    `created_at`,
    `is_revoked`
  )
VALUES
  (
    284,
    20,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MjAsImlhdCI6MTc2ODE5NTEwMiwiZXhwIjoxNzY4Nzk5OTAyfQ.xqkSc_Q7Tych9l8zt-oF4BeSHE947QaMuI6dV-VLmJw',
    '2026-01-12 08:18:22',
    '2026-01-12 08:18:22',
    0
  );
INSERT INTO
  `refresh_tokens` (
    `id`,
    `user_id`,
    `token`,
    `expires_at`,
    `created_at`,
    `is_revoked`
  )
VALUES
  (
    285,
    19,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTksImlhdCI6MTc2ODE5Njc3OSwiZXhwIjoxNzY4ODAxNTc5fQ.ewMK_Y_bBa6YPaVy6fb9jDOWEIeBJ06lCVQgAk7FiFY',
    '2026-01-12 08:46:19',
    '2026-01-12 08:46:19',
    0
  );
INSERT INTO
  `refresh_tokens` (
    `id`,
    `user_id`,
    `token`,
    `expires_at`,
    `created_at`,
    `is_revoked`
  )
VALUES
  (
    286,
    19,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTksImlhdCI6MTc2ODE5NzAzMCwiZXhwIjoxNzY4ODAxODMwfQ.lq0lvmrweGUp6Sr_dFA8S69Yhzv6vC64c4AIFo8Lgmw',
    '2026-01-19 08:50:30',
    '2026-01-12 08:50:30',
    0
  );
INSERT INTO
  `refresh_tokens` (
    `id`,
    `user_id`,
    `token`,
    `expires_at`,
    `created_at`,
    `is_revoked`
  )
VALUES
  (
    287,
    19,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTksImlhdCI6MTc2ODE5NzgzMywiZXhwIjoxNzY4ODAyNjMzfQ.7oWDFZf6IprplXKVmH0s6fsMrW7UH7p7YDdWr_d06fw',
    '2026-01-19 09:03:53',
    '2026-01-12 09:03:53',
    0
  );
INSERT INTO
  `refresh_tokens` (
    `id`,
    `user_id`,
    `token`,
    `expires_at`,
    `created_at`,
    `is_revoked`
  )
VALUES
  (
    288,
    19,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTksImlhdCI6MTc2ODE5ODI0MSwiZXhwIjoxNzY4ODAzMDQxfQ.Kz15qoEv2cMe0COZlWW3lFJ4GooLTYwcXqxsLxRLGhM',
    '2026-01-19 09:10:41',
    '2026-01-12 09:10:41',
    0
  );
INSERT INTO
  `refresh_tokens` (
    `id`,
    `user_id`,
    `token`,
    `expires_at`,
    `created_at`,
    `is_revoked`
  )
VALUES
  (
    289,
    19,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTksImlhdCI6MTc2ODE5ODkzNSwiZXhwIjoxNzY4ODAzNzM1fQ.V0tuIUMA9V6yOlCon_K86RPfob6gulDZ_vAM2-dWQ5A',
    '2026-01-19 09:22:15',
    '2026-01-12 09:22:15',
    0
  );
INSERT INTO
  `refresh_tokens` (
    `id`,
    `user_id`,
    `token`,
    `expires_at`,
    `created_at`,
    `is_revoked`
  )
VALUES
  (
    290,
    19,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTksImlhdCI6MTc2ODIwMjMwNywiZXhwIjoxNzY4ODA3MTA3fQ.a_kPBnEgsSFwtM6DkmvmrzQ4SjukT4lxRiU-qp5MSbs',
    '2026-01-12 10:18:27',
    '2026-01-12 10:18:27',
    0
  );

# ------------------------------------------------------------
# DATA DUMP FOR TABLE: reports
# ------------------------------------------------------------


# ------------------------------------------------------------
# DATA DUMP FOR TABLE: reset_codes
# ------------------------------------------------------------


# ------------------------------------------------------------
# DATA DUMP FOR TABLE: scroll_behavior
# ------------------------------------------------------------


# ------------------------------------------------------------
# DATA DUMP FOR TABLE: search_history
# ------------------------------------------------------------


# ------------------------------------------------------------
# DATA DUMP FOR TABLE: search_interactions
# ------------------------------------------------------------


# ------------------------------------------------------------
# DATA DUMP FOR TABLE: system_settings
# ------------------------------------------------------------

INSERT INTO
  `system_settings` (
    `id`,
    `site_name`,
    `site_url`,
    `default_language`,
    `theme`,
    `allow_registration`,
    `created_at`,
    `updated_at`,
    `maintenance_mode`,
    `chat_enabled`,
    `upload_enabled`,
    `max_video_size`,
    `max_video_duration`,
    `allowed_video_formats`,
    `user_registration_enabled`,
    `auto_ban_reports_threshold`
  )
VALUES
  (
    1,
    'Nojoom',
    'http://localhost:5173',
    'en',
    'light',
    1,
    '2026-01-10 21:08:18',
    '2026-01-10 21:08:18',
    1,
    0,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL
  );

# ------------------------------------------------------------
# DATA DUMP FOR TABLE: user_badges
# ------------------------------------------------------------


# ------------------------------------------------------------
# DATA DUMP FOR TABLE: user_interactions
# ------------------------------------------------------------

INSERT INTO
  `user_interactions` (
    `id`,
    `user_id`,
    `video_id`,
    `target_user_id`,
    `interaction_type`,
    `weight`,
    `metadata`,
    `created_at`
  )
VALUES
  (
    67,
    19,
    25,
    NULL,
    'like',
    1.00,
    '{}',
    '2026-01-10 19:47:47'
  );
INSERT INTO
  `user_interactions` (
    `id`,
    `user_id`,
    `video_id`,
    `target_user_id`,
    `interaction_type`,
    `weight`,
    `metadata`,
    `created_at`
  )
VALUES
  (
    68,
    20,
    27,
    NULL,
    'like',
    1.00,
    '{}',
    '2026-01-12 08:38:50'
  );
INSERT INTO
  `user_interactions` (
    `id`,
    `user_id`,
    `video_id`,
    `target_user_id`,
    `interaction_type`,
    `weight`,
    `metadata`,
    `created_at`
  )
VALUES
  (
    69,
    19,
    NULL,
    NULL,
    'follow',
    1.50,
    '{}',
    '2026-01-12 08:49:53'
  );

# ------------------------------------------------------------
# DATA DUMP FOR TABLE: user_preferences
# ------------------------------------------------------------


# ------------------------------------------------------------
# DATA DUMP FOR TABLE: user_watch_sessions
# ------------------------------------------------------------


# ------------------------------------------------------------
# DATA DUMP FOR TABLE: user_watch_time
# ------------------------------------------------------------


# ------------------------------------------------------------
# DATA DUMP FOR TABLE: users
# ------------------------------------------------------------

INSERT INTO
  `users` (
    `id`,
    `username`,
    `email`,
    `password`,
    `avatar`,
    `role`,
    `email_verified`,
    `language`,
    `theme`,
    `created_at`,
    `bio`,
    `followers_count`,
    `following_count`,
    `social_links`,
    `likes_count`,
    `views_count`,
    `is_banned`,
    `ban_reason`,
    `last_login`,
    `updated_at`,
    `is_online`,
    `total_watch_time`,
    `last_seen`,
    `birth_month`,
    `birth_year`,
    `birth_date`,
    `birth_day`,
    `display_name`,
    `is_private`,
    `allow_comments`,
    `two_factor_enabled`,
    `login_notifications`,
    `deleted_at`,
    `status`,
    `allow_dms`,
    `show_activity_status`,
    `otp_code`,
    `otp_expires`
  )
VALUES
  (
    19,
    'hassan',
    'hassan@gmail.com',
    'hhaall112233$',
    '/uploads/avatars/avatar-1768069054305-201968331.jpg',
    'user',
    0,
    'en',
    'light',
    '2026-01-10 18:53:21',
    'انا رائع جدا',
    0,
    1,
    NULL,
    2,
    272,
    0,
    NULL,
    NULL,
    '2026-01-12 10:34:09',
    1,
    3,
    '2026-01-12 10:34:09',
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    0,
    1,
    0,
    1,
    NULL,
    'active',
    1,
    1,
    NULL,
    NULL
  );
INSERT INTO
  `users` (
    `id`,
    `username`,
    `email`,
    `password`,
    `avatar`,
    `role`,
    `email_verified`,
    `language`,
    `theme`,
    `created_at`,
    `bio`,
    `followers_count`,
    `following_count`,
    `social_links`,
    `likes_count`,
    `views_count`,
    `is_banned`,
    `ban_reason`,
    `last_login`,
    `updated_at`,
    `is_online`,
    `total_watch_time`,
    `last_seen`,
    `birth_month`,
    `birth_year`,
    `birth_date`,
    `birth_day`,
    `display_name`,
    `is_private`,
    `allow_comments`,
    `two_factor_enabled`,
    `login_notifications`,
    `deleted_at`,
    `status`,
    `allow_dms`,
    `show_activity_status`,
    `otp_code`,
    `otp_expires`
  )
VALUES
  (
    20,
    'admin',
    'admin@admin.com',
    'hhaall112233$',
    '/uploads/avatars/avatar-1768196315194-38366292.png',
    'admin',
    0,
    'en',
    'light',
    '2026-01-10 18:53:21',
    NULL,
    1,
    0,
    NULL,
    0,
    0,
    0,
    NULL,
    NULL,
    '2026-01-12 08:49:53',
    0,
    3,
    '2026-01-12 08:46:14',
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    0,
    1,
    0,
    1,
    NULL,
    'active',
    1,
    1,
    NULL,
    NULL
  );

# ------------------------------------------------------------
# DATA DUMP FOR TABLE: video_chunks
# ------------------------------------------------------------


# ------------------------------------------------------------
# DATA DUMP FOR TABLE: video_manifests
# ------------------------------------------------------------


# ------------------------------------------------------------
# DATA DUMP FOR TABLE: video_shares
# ------------------------------------------------------------


# ------------------------------------------------------------
# DATA DUMP FOR TABLE: video_views
# ------------------------------------------------------------


# ------------------------------------------------------------
# DATA DUMP FOR TABLE: videos
# ------------------------------------------------------------

INSERT INTO
  `videos` (
    `id`,
    `user_id`,
    `path`,
    `url`,
    `thumbnail`,
    `duration`,
    `description`,
    `is_chat_video`,
    `views`,
    `shares`,
    `likes`,
    `created_at`,
    `is_public`,
    `deleted_by_admin`,
    `deletion_reason`,
    `title`,
    `hashtags`,
    `music`,
    `status`,
    `is_pinned`,
    `pinned_at`,
    `deleted_at`,
    `video_url`,
    `subspace_video_id`,
    `subspace_thumbnail_id`
  )
VALUES
  (
    25,
    19,
    '1768063634700_q8hyawlxtor.mp4',
    '/uploads/videos/1768063634700_q8hyawlxtor.mp4',
    '/uploads/videos/thumbnails/thumb_1768063634700_q8hyawlxtor.mp4.jpg',
    0,
    'روعة',
    0,
    108,
    0,
    0,
    '2026-01-10 19:47:17',
    1,
    0,
    NULL,
    'بدون عنوان',
    NULL,
    NULL,
    'active',
    0,
    NULL,
    NULL,
    '/uploads/videos/1768063634700_q8hyawlxtor.mp4',
    NULL,
    NULL
  );
INSERT INTO
  `videos` (
    `id`,
    `user_id`,
    `path`,
    `url`,
    `thumbnail`,
    `duration`,
    `description`,
    `is_chat_video`,
    `views`,
    `shares`,
    `likes`,
    `created_at`,
    `is_public`,
    `deleted_by_admin`,
    `deletion_reason`,
    `title`,
    `hashtags`,
    `music`,
    `status`,
    `is_pinned`,
    `pinned_at`,
    `deleted_at`,
    `video_url`,
    `subspace_video_id`,
    `subspace_thumbnail_id`
  )
VALUES
  (
    26,
    19,
    '1768137535567_i9k6gax20ke.mp4',
    '/uploads/videos/1768137535567_i9k6gax20ke.mp4',
    '/uploads/videos/thumbnails/thumb_1768137535567_i9k6gax20ke.mp4.jpg',
    0,
    'روعة',
    0,
    120,
    0,
    0,
    '2026-01-11 16:18:57',
    1,
    0,
    NULL,
    'بدون عنوان',
    NULL,
    NULL,
    'active',
    0,
    NULL,
    NULL,
    '/uploads/videos/1768137535567_i9k6gax20ke.mp4',
    NULL,
    NULL
  );
INSERT INTO
  `videos` (
    `id`,
    `user_id`,
    `path`,
    `url`,
    `thumbnail`,
    `duration`,
    `description`,
    `is_chat_video`,
    `views`,
    `shares`,
    `likes`,
    `created_at`,
    `is_public`,
    `deleted_by_admin`,
    `deletion_reason`,
    `title`,
    `hashtags`,
    `music`,
    `status`,
    `is_pinned`,
    `pinned_at`,
    `deleted_at`,
    `video_url`,
    `subspace_video_id`,
    `subspace_thumbnail_id`
  )
VALUES
  (
    27,
    19,
    '1768137575324_n7sb3buw6km.mp4',
    '/uploads/videos/1768137575324_n7sb3buw6km.mp4',
    '/uploads/videos/thumbnails/thumb_1768137575324_n7sb3buw6km.mp4.jpg',
    0,
    'ممتاز',
    0,
    222,
    0,
    0,
    '2026-01-11 16:19:35',
    1,
    0,
    NULL,
    'بدون عنوان',
    NULL,
    NULL,
    'active',
    0,
    NULL,
    NULL,
    '/uploads/videos/1768137575324_n7sb3buw6km.mp4',
    NULL,
    NULL
  );

# ------------------------------------------------------------
# DATA DUMP FOR TABLE: voice_interactions
# ------------------------------------------------------------


# ------------------------------------------------------------
# DATA DUMP FOR TABLE: watch_history
# ------------------------------------------------------------

INSERT INTO
  `watch_history` (
    `id`,
    `user_id`,
    `video_id`,
    `watch_time`,
    `completed`,
    `created_at`,
    `updated_at`,
    `last_position`
  )
VALUES
  (
    2027,
    19,
    25,
    17,
    0,
    '2026-01-10 19:47:31',
    '2026-01-12 10:19:36',
    8.46
  );
INSERT INTO
  `watch_history` (
    `id`,
    `user_id`,
    `video_id`,
    `watch_time`,
    `completed`,
    `created_at`,
    `updated_at`,
    `last_position`
  )
VALUES
  (
    2119,
    20,
    25,
    1,
    0,
    '2026-01-10 20:04:37',
    '2026-01-12 08:13:03',
    0.50
  );
INSERT INTO
  `watch_history` (
    `id`,
    `user_id`,
    `video_id`,
    `watch_time`,
    `completed`,
    `created_at`,
    `updated_at`,
    `last_position`
  )
VALUES
  (
    2185,
    19,
    26,
    13,
    0,
    '2026-01-11 16:19:04',
    '2026-01-12 10:34:00',
    0.00
  );
INSERT INTO
  `watch_history` (
    `id`,
    `user_id`,
    `video_id`,
    `watch_time`,
    `completed`,
    `created_at`,
    `updated_at`,
    `last_position`
  )
VALUES
  (
    2201,
    19,
    27,
    73,
    0,
    '2026-01-11 16:19:48',
    '2026-01-12 10:18:40',
    6.56
  );
INSERT INTO
  `watch_history` (
    `id`,
    `user_id`,
    `video_id`,
    `watch_time`,
    `completed`,
    `created_at`,
    `updated_at`,
    `last_position`
  )
VALUES
  (
    5406,
    20,
    27,
    105,
    0,
    '2026-01-12 07:11:22',
    '2026-01-12 08:42:47',
    1.29
  );
INSERT INTO
  `watch_history` (
    `id`,
    `user_id`,
    `video_id`,
    `watch_time`,
    `completed`,
    `created_at`,
    `updated_at`,
    `last_position`
  )
VALUES
  (
    5676,
    20,
    26,
    1,
    0,
    '2026-01-12 08:12:23',
    '2026-01-12 08:42:20',
    0.00
  );

/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;
/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
