-- MariaDB dump 10.19  Distrib 10.4.32-MariaDB, for Win64 (AMD64)
--
-- Host: localhost    Database: facelog_db
-- ------------------------------------------------------
-- Server version	10.4.32-MariaDB

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `facelog_db`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `facelog_db` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */;

USE `facelog_db`;

--
-- Table structure for table `app_settings`
--

DROP TABLE IF EXISTS `app_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `app_settings` (
  `setting_key` varchar(120) NOT NULL,
  `setting_value` longtext NOT NULL,
  `value_type` enum('STRING','NUMBER','BOOLEAN','JSON') NOT NULL DEFAULT 'STRING',
  `description` varchar(500) DEFAULT NULL,
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `app_settings`
--

LOCK TABLES `app_settings` WRITE;
/*!40000 ALTER TABLE `app_settings` DISABLE KEYS */;
INSERT INTO `app_settings` VALUES ('attendance.late_grace_minutes','10','NUMBER','So phut cho phep di tre','2026-07-16 21:44:07'),('export.default_sort','{\"work_date\":\"desc\",\"employee_code\":\"asc\"}','JSON','Sap xep mac dinh khi xuat Excel','2026-07-16 21:44:07'),('face.default_threshold','0.70','NUMBER','Nguong nhan dien mac dinh','2026-07-16 21:44:07'),('face.min_quality_score','0.75','NUMBER','Diem chat luong anh toi thieu khi them FaceID','2026-07-16 21:44:07');
/*!40000 ALTER TABLE `app_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `attendance_daily_summary`
--

DROP TABLE IF EXISTS `attendance_daily_summary`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `attendance_daily_summary` (
  `summary_id` bigint(20) NOT NULL AUTO_INCREMENT,
  `employee_id` int(11) NOT NULL,
  `work_date` date NOT NULL,
  `shift_id` int(11) DEFAULT NULL,
  `first_check_in` datetime DEFAULT NULL,
  `last_check_out` datetime DEFAULT NULL,
  `worked_minutes` int(11) NOT NULL DEFAULT 0,
  `late_minutes` int(11) NOT NULL DEFAULT 0,
  `early_leave_minutes` int(11) NOT NULL DEFAULT 0,
  `overtime_minutes` int(11) NOT NULL DEFAULT 0,
  `missing_check_out` tinyint(1) NOT NULL DEFAULT 0,
  `status` enum('PRESENT','LATE','ABSENT','LEAVE','HOLIDAY','INCOMPLETE') NOT NULL DEFAULT 'ABSENT',
  `approval_status` enum('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  `approved_by` int(11) DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `note` varchar(1000) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`summary_id`),
  UNIQUE KEY `uq_daily_summary_employee_date` (`employee_id`,`work_date`),
  KEY `fk_daily_summary_shift` (`shift_id`),
  KEY `fk_daily_summary_approver` (`approved_by`),
  KEY `idx_daily_summary_date_status` (`work_date`,`status`),
  KEY `idx_daily_summary_employee_date` (`employee_id`,`work_date`),
  KEY `idx_daily_summary_export_sort` (`work_date`,`employee_id`,`status`),
  CONSTRAINT `fk_daily_summary_approver` FOREIGN KEY (`approved_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_daily_summary_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`employee_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_daily_summary_shift` FOREIGN KEY (`shift_id`) REFERENCES `shifts` (`shift_id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=61 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `attendance_daily_summary`
--

LOCK TABLES `attendance_daily_summary` WRITE;
/*!40000 ALTER TABLE `attendance_daily_summary` DISABLE KEYS */;
INSERT INTO `attendance_daily_summary` VALUES (1,1,'2026-07-16',1,'2026-07-16 07:55:00','2026-07-16 17:05:00',490,0,0,10,0,'PRESENT','APPROVED',1,'2026-07-16 21:45:17',NULL,'2026-07-16 21:44:07','2026-07-16 21:45:17'),(2,2,'2026-07-16',1,'2026-07-16 07:55:00',NULL,0,0,0,0,1,'INCOMPLETE','PENDING',1,NULL,NULL,'2026-07-16 21:44:07','2026-07-16 21:44:07'),(3,3,'2026-07-16',1,'2026-07-16 07:55:00','2026-07-16 17:05:00',490,0,0,10,0,'PRESENT','APPROVED',1,'2026-07-16 21:45:17',NULL,'2026-07-16 21:44:07','2026-07-16 21:45:17'),(4,4,'2026-07-16',1,'2026-07-16 07:55:00','2026-07-16 17:05:00',490,0,0,10,0,'PRESENT','APPROVED',1,'2026-07-16 21:45:17',NULL,'2026-07-16 21:44:07','2026-07-16 21:45:17'),(5,5,'2026-07-16',1,'2026-07-16 07:55:00','2026-07-16 17:05:00',490,0,0,10,0,'PRESENT','APPROVED',1,'2026-07-16 21:45:17',NULL,'2026-07-16 21:44:07','2026-07-16 21:45:17'),(6,6,'2026-07-16',1,NULL,NULL,0,0,0,0,0,'ABSENT','PENDING',NULL,NULL,NULL,'2026-07-16 21:44:07','2026-07-16 21:44:07'),(7,1,'2026-07-15',1,'2026-07-15 07:55:00','2026-07-15 17:05:00',490,0,0,10,0,'PRESENT','APPROVED',1,'2026-07-16 21:45:17',NULL,'2026-07-16 21:44:07','2026-07-16 21:45:17'),(8,2,'2026-07-15',1,'2026-07-15 07:55:00','2026-07-15 17:05:00',490,0,0,10,0,'PRESENT','APPROVED',1,'2026-07-16 21:45:17',NULL,'2026-07-16 21:44:07','2026-07-16 21:45:17'),(9,3,'2026-07-15',1,'2026-07-15 08:18:00','2026-07-15 17:05:00',467,18,0,0,0,'LATE','APPROVED',1,'2026-07-16 21:45:17',NULL,'2026-07-16 21:44:07','2026-07-16 21:45:17'),(10,4,'2026-07-15',1,'2026-07-15 07:55:00','2026-07-15 17:05:00',490,0,0,10,0,'PRESENT','APPROVED',1,'2026-07-16 21:45:17',NULL,'2026-07-16 21:44:07','2026-07-16 21:45:17'),(11,5,'2026-07-15',1,'2026-07-15 07:55:00','2026-07-15 17:05:00',490,0,0,10,0,'PRESENT','APPROVED',1,'2026-07-16 21:45:17',NULL,'2026-07-16 21:44:07','2026-07-16 21:45:17'),(12,6,'2026-07-15',1,'2026-07-15 07:55:00','2026-07-15 17:05:00',490,0,0,10,0,'PRESENT','APPROVED',1,'2026-07-16 21:45:17',NULL,'2026-07-16 21:44:07','2026-07-16 21:45:17'),(13,1,'2026-07-14',1,'2026-07-14 07:55:00','2026-07-14 17:05:00',490,0,0,10,0,'PRESENT','APPROVED',1,'2026-07-16 21:45:17',NULL,'2026-07-16 21:44:07','2026-07-16 21:45:17'),(14,2,'2026-07-14',1,'2026-07-14 07:55:00','2026-07-14 17:05:00',490,0,0,10,0,'PRESENT','APPROVED',1,'2026-07-16 21:45:17',NULL,'2026-07-16 21:44:07','2026-07-16 21:45:17'),(15,3,'2026-07-14',1,'2026-07-14 07:55:00','2026-07-14 17:05:00',490,0,0,10,0,'PRESENT','APPROVED',1,'2026-07-16 21:45:17',NULL,'2026-07-16 21:44:07','2026-07-16 21:45:17'),(16,4,'2026-07-14',1,'2026-07-14 07:55:00','2026-07-14 16:25:00',450,0,35,0,0,'PRESENT','APPROVED',1,'2026-07-16 21:45:17',NULL,'2026-07-16 21:44:07','2026-07-16 21:45:17'),(17,5,'2026-07-14',1,'2026-07-14 07:55:00','2026-07-14 17:05:00',490,0,0,10,0,'PRESENT','APPROVED',1,'2026-07-16 21:45:17',NULL,'2026-07-16 21:44:07','2026-07-16 21:45:17'),(18,6,'2026-07-14',1,NULL,NULL,0,0,0,0,0,'ABSENT','PENDING',NULL,NULL,NULL,'2026-07-16 21:44:07','2026-07-16 21:44:07'),(19,1,'2026-07-13',1,'2026-07-13 07:55:00','2026-07-13 17:05:00',490,0,0,10,0,'PRESENT','APPROVED',1,'2026-07-16 21:45:17',NULL,'2026-07-16 21:44:07','2026-07-16 21:45:17'),(20,2,'2026-07-13',1,'2026-07-13 07:55:00','2026-07-13 17:05:00',490,0,0,10,0,'PRESENT','APPROVED',1,'2026-07-16 21:45:17',NULL,'2026-07-16 21:44:07','2026-07-16 21:45:17'),(21,3,'2026-07-13',1,'2026-07-13 08:18:00','2026-07-13 17:05:00',467,18,0,0,0,'LATE','APPROVED',1,'2026-07-16 21:45:17',NULL,'2026-07-16 21:44:07','2026-07-16 21:45:17'),(22,4,'2026-07-13',1,'2026-07-13 07:55:00','2026-07-13 17:05:00',490,0,0,10,0,'PRESENT','APPROVED',1,'2026-07-16 21:45:17',NULL,'2026-07-16 21:44:07','2026-07-16 21:45:17'),(23,5,'2026-07-13',1,'2026-07-13 07:55:00','2026-07-13 17:05:00',490,0,0,10,0,'PRESENT','APPROVED',1,'2026-07-16 21:45:17',NULL,'2026-07-16 21:44:07','2026-07-16 21:45:17'),(24,6,'2026-07-13',1,'2026-07-13 07:55:00','2026-07-13 17:05:00',490,0,0,10,0,'PRESENT','APPROVED',1,'2026-07-16 21:45:17',NULL,'2026-07-16 21:44:07','2026-07-16 21:45:17'),(25,1,'2026-07-10',1,'2026-07-10 07:55:00','2026-07-10 17:05:00',490,0,0,10,0,'PRESENT','APPROVED',1,'2026-07-16 21:45:17',NULL,'2026-07-16 21:44:07','2026-07-16 21:45:17'),(26,2,'2026-07-10',1,'2026-07-10 07:55:00','2026-07-10 17:05:00',490,0,0,10,0,'PRESENT','APPROVED',1,'2026-07-16 21:45:17',NULL,'2026-07-16 21:44:07','2026-07-16 21:45:17'),(27,3,'2026-07-10',1,'2026-07-10 07:55:00','2026-07-10 17:05:00',490,0,0,10,0,'PRESENT','APPROVED',1,'2026-07-16 21:45:17',NULL,'2026-07-16 21:44:07','2026-07-16 21:45:17'),(28,4,'2026-07-10',1,'2026-07-10 07:55:00','2026-07-10 17:05:00',490,0,0,10,0,'PRESENT','APPROVED',1,'2026-07-16 21:45:17',NULL,'2026-07-16 21:44:07','2026-07-16 21:45:17'),(29,5,'2026-07-10',1,'2026-07-10 07:55:00','2026-07-10 17:05:00',490,0,0,10,0,'PRESENT','APPROVED',1,'2026-07-16 21:45:17',NULL,'2026-07-16 21:44:07','2026-07-16 21:45:17'),(30,6,'2026-07-10',1,NULL,NULL,0,0,0,0,0,'ABSENT','PENDING',NULL,NULL,NULL,'2026-07-16 21:44:07','2026-07-16 21:44:07');
/*!40000 ALTER TABLE `attendance_daily_summary` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `attendance_logs`
--

DROP TABLE IF EXISTS `attendance_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `attendance_logs` (
  `attendance_log_id` bigint(20) NOT NULL AUTO_INCREMENT,
  `employee_id` int(11) NOT NULL,
  `device_id` int(11) DEFAULT NULL,
  `event_type` enum('CHECK_IN','CHECK_OUT','BREAK_START','BREAK_END','MANUAL_ADJUSTMENT') NOT NULL,
  `event_time` datetime NOT NULL,
  `method` enum('FACE_ID','MANUAL','QR_CODE','IMPORT') NOT NULL DEFAULT 'FACE_ID',
  `recognition_confidence` decimal(5,4) DEFAULT NULL,
  `liveness_score` decimal(5,4) DEFAULT NULL,
  `face_quality_score` decimal(5,4) DEFAULT NULL,
  `latitude` decimal(10,7) DEFAULT NULL,
  `longitude` decimal(10,7) DEFAULT NULL,
  `image_path` varchar(500) DEFAULT NULL,
  `note` varchar(1000) DEFAULT NULL,
  `review_status` enum('AUTO_APPROVED','NEEDS_REVIEW','APPROVED','REJECTED') NOT NULL DEFAULT 'AUTO_APPROVED',
  `reviewed_by` int(11) DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`attendance_log_id`),
  KEY `fk_attendance_logs_device` (`device_id`),
  KEY `fk_attendance_logs_reviewer` (`reviewed_by`),
  KEY `idx_attendance_logs_employee_time` (`employee_id`,`event_time`),
  KEY `idx_attendance_logs_time_type` (`event_time`,`event_type`),
  KEY `idx_attendance_logs_review` (`review_status`,`event_time`),
  KEY `idx_attendance_logs_export_sort` (`event_time`,`employee_id`,`event_type`),
  CONSTRAINT `fk_attendance_logs_device` FOREIGN KEY (`device_id`) REFERENCES `devices` (`device_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_attendance_logs_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`employee_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_attendance_logs_reviewer` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=54 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `attendance_logs`
--

LOCK TABLES `attendance_logs` WRITE;
/*!40000 ALTER TABLE `attendance_logs` DISABLE KEYS */;
INSERT INTO `attendance_logs` VALUES (1,1,1,'CHECK_IN','2026-07-16 07:55:00','FACE_ID',0.9100,0.9600,0.9000,NULL,NULL,NULL,NULL,'AUTO_APPROVED',NULL,NULL,'2026-07-16 21:44:07'),(2,1,1,'CHECK_OUT','2026-07-16 17:05:00','FACE_ID',0.9300,0.9700,0.9100,NULL,NULL,NULL,NULL,'AUTO_APPROVED',NULL,NULL,'2026-07-16 21:44:07'),(3,2,1,'CHECK_IN','2026-07-16 07:55:00','FACE_ID',0.9100,0.9600,0.9000,NULL,NULL,NULL,NULL,'AUTO_APPROVED',NULL,NULL,'2026-07-16 21:44:07'),(4,3,1,'CHECK_IN','2026-07-16 07:55:00','FACE_ID',0.8200,0.9600,0.9000,NULL,NULL,NULL,NULL,'AUTO_APPROVED',NULL,NULL,'2026-07-16 21:44:07'),(5,3,1,'CHECK_OUT','2026-07-16 17:05:00','FACE_ID',0.8400,0.9700,0.9100,NULL,NULL,NULL,NULL,'AUTO_APPROVED',NULL,NULL,'2026-07-16 21:44:07'),(6,4,1,'CHECK_IN','2026-07-16 07:55:00','FACE_ID',0.6900,0.9600,0.9000,NULL,NULL,NULL,NULL,'NEEDS_REVIEW',NULL,NULL,'2026-07-16 21:44:07'),(7,4,1,'CHECK_OUT','2026-07-16 17:05:00','FACE_ID',0.7100,0.9700,0.9100,NULL,NULL,NULL,NULL,'AUTO_APPROVED',NULL,NULL,'2026-07-16 21:44:07'),(8,5,1,'CHECK_IN','2026-07-16 07:55:00','FACE_ID',0.9100,0.9600,0.9000,NULL,NULL,NULL,NULL,'AUTO_APPROVED',NULL,NULL,'2026-07-16 21:44:07'),(9,5,1,'CHECK_OUT','2026-07-16 17:05:00','FACE_ID',0.9300,0.9700,0.9100,NULL,NULL,NULL,NULL,'AUTO_APPROVED',NULL,NULL,'2026-07-16 21:44:07'),(10,1,1,'CHECK_IN','2026-07-15 07:55:00','FACE_ID',0.9100,0.9600,0.9000,NULL,NULL,NULL,NULL,'AUTO_APPROVED',NULL,NULL,'2026-07-16 21:44:07'),(11,1,1,'CHECK_OUT','2026-07-15 17:05:00','FACE_ID',0.9300,0.9700,0.9100,NULL,NULL,NULL,NULL,'AUTO_APPROVED',NULL,NULL,'2026-07-16 21:44:07'),(12,2,1,'CHECK_IN','2026-07-15 07:55:00','FACE_ID',0.9100,0.9600,0.9000,NULL,NULL,NULL,NULL,'AUTO_APPROVED',NULL,NULL,'2026-07-16 21:44:07'),(13,2,1,'CHECK_OUT','2026-07-15 17:05:00','FACE_ID',0.9300,0.9700,0.9100,NULL,NULL,NULL,NULL,'AUTO_APPROVED',NULL,NULL,'2026-07-16 21:44:07'),(14,3,1,'CHECK_IN','2026-07-15 08:18:00','FACE_ID',0.8200,0.9600,0.9000,NULL,NULL,NULL,NULL,'AUTO_APPROVED',NULL,NULL,'2026-07-16 21:44:07'),(15,3,1,'CHECK_OUT','2026-07-15 17:05:00','FACE_ID',0.8400,0.9700,0.9100,NULL,NULL,NULL,NULL,'AUTO_APPROVED',NULL,NULL,'2026-07-16 21:44:07'),(16,4,1,'CHECK_IN','2026-07-15 07:55:00','FACE_ID',0.6900,0.9600,0.9000,NULL,NULL,NULL,NULL,'NEEDS_REVIEW',NULL,NULL,'2026-07-16 21:44:07'),(17,4,1,'CHECK_OUT','2026-07-15 17:05:00','FACE_ID',0.7100,0.9700,0.9100,NULL,NULL,NULL,NULL,'AUTO_APPROVED',NULL,NULL,'2026-07-16 21:44:07'),(18,5,1,'CHECK_IN','2026-07-15 07:55:00','FACE_ID',0.9100,0.9600,0.9000,NULL,NULL,NULL,NULL,'AUTO_APPROVED',NULL,NULL,'2026-07-16 21:44:07'),(19,5,1,'CHECK_OUT','2026-07-15 17:05:00','FACE_ID',0.9300,0.9700,0.9100,NULL,NULL,NULL,NULL,'AUTO_APPROVED',NULL,NULL,'2026-07-16 21:44:07'),(20,6,1,'CHECK_IN','2026-07-15 07:55:00','FACE_ID',0.9100,0.9600,0.9000,NULL,NULL,NULL,NULL,'AUTO_APPROVED',NULL,NULL,'2026-07-16 21:44:07'),(21,6,1,'CHECK_OUT','2026-07-15 17:05:00','FACE_ID',0.9300,0.9700,0.9100,NULL,NULL,NULL,NULL,'AUTO_APPROVED',NULL,NULL,'2026-07-16 21:44:07'),(22,1,1,'CHECK_IN','2026-07-14 07:55:00','FACE_ID',0.9100,0.9600,0.9000,NULL,NULL,NULL,NULL,'AUTO_APPROVED',NULL,NULL,'2026-07-16 21:44:07'),(23,1,1,'CHECK_OUT','2026-07-14 17:05:00','FACE_ID',0.9300,0.9700,0.9100,NULL,NULL,NULL,NULL,'AUTO_APPROVED',NULL,NULL,'2026-07-16 21:44:07'),(24,2,1,'CHECK_IN','2026-07-14 07:55:00','FACE_ID',0.9100,0.9600,0.9000,NULL,NULL,NULL,NULL,'AUTO_APPROVED',NULL,NULL,'2026-07-16 21:44:07'),(25,2,1,'CHECK_OUT','2026-07-14 17:05:00','FACE_ID',0.9300,0.9700,0.9100,NULL,NULL,NULL,NULL,'AUTO_APPROVED',NULL,NULL,'2026-07-16 21:44:07'),(26,3,1,'CHECK_IN','2026-07-14 07:55:00','FACE_ID',0.8200,0.9600,0.9000,NULL,NULL,NULL,NULL,'AUTO_APPROVED',NULL,NULL,'2026-07-16 21:44:07'),(27,3,1,'CHECK_OUT','2026-07-14 17:05:00','FACE_ID',0.8400,0.9700,0.9100,NULL,NULL,NULL,NULL,'AUTO_APPROVED',NULL,NULL,'2026-07-16 21:44:07'),(28,4,1,'CHECK_IN','2026-07-14 07:55:00','FACE_ID',0.6900,0.9600,0.9000,NULL,NULL,NULL,NULL,'NEEDS_REVIEW',NULL,NULL,'2026-07-16 21:44:07'),(29,4,1,'CHECK_OUT','2026-07-14 16:25:00','FACE_ID',0.7100,0.9700,0.9100,NULL,NULL,NULL,NULL,'AUTO_APPROVED',NULL,NULL,'2026-07-16 21:44:07'),(30,5,1,'CHECK_IN','2026-07-14 07:55:00','FACE_ID',0.9100,0.9600,0.9000,NULL,NULL,NULL,NULL,'AUTO_APPROVED',NULL,NULL,'2026-07-16 21:44:07'),(31,5,1,'CHECK_OUT','2026-07-14 17:05:00','FACE_ID',0.9300,0.9700,0.9100,NULL,NULL,NULL,NULL,'AUTO_APPROVED',NULL,NULL,'2026-07-16 21:44:07'),(32,1,1,'CHECK_IN','2026-07-13 07:55:00','FACE_ID',0.9100,0.9600,0.9000,NULL,NULL,NULL,NULL,'AUTO_APPROVED',NULL,NULL,'2026-07-16 21:44:07'),(33,1,1,'CHECK_OUT','2026-07-13 17:05:00','FACE_ID',0.9300,0.9700,0.9100,NULL,NULL,NULL,NULL,'AUTO_APPROVED',NULL,NULL,'2026-07-16 21:44:07'),(34,2,1,'CHECK_IN','2026-07-13 07:55:00','FACE_ID',0.9100,0.9600,0.9000,NULL,NULL,NULL,NULL,'AUTO_APPROVED',NULL,NULL,'2026-07-16 21:44:07'),(35,2,1,'CHECK_OUT','2026-07-13 17:05:00','FACE_ID',0.9300,0.9700,0.9100,NULL,NULL,NULL,NULL,'AUTO_APPROVED',NULL,NULL,'2026-07-16 21:44:07'),(36,3,1,'CHECK_IN','2026-07-13 08:18:00','FACE_ID',0.8200,0.9600,0.9000,NULL,NULL,NULL,NULL,'AUTO_APPROVED',NULL,NULL,'2026-07-16 21:44:07'),(37,3,1,'CHECK_OUT','2026-07-13 17:05:00','FACE_ID',0.8400,0.9700,0.9100,NULL,NULL,NULL,NULL,'AUTO_APPROVED',NULL,NULL,'2026-07-16 21:44:07'),(38,4,1,'CHECK_IN','2026-07-13 07:55:00','FACE_ID',0.6900,0.9600,0.9000,NULL,NULL,NULL,NULL,'NEEDS_REVIEW',NULL,NULL,'2026-07-16 21:44:07'),(39,4,1,'CHECK_OUT','2026-07-13 17:05:00','FACE_ID',0.7100,0.9700,0.9100,NULL,NULL,NULL,NULL,'AUTO_APPROVED',NULL,NULL,'2026-07-16 21:44:07'),(40,5,1,'CHECK_IN','2026-07-13 07:55:00','FACE_ID',0.9100,0.9600,0.9000,NULL,NULL,NULL,NULL,'AUTO_APPROVED',NULL,NULL,'2026-07-16 21:44:07'),(41,5,1,'CHECK_OUT','2026-07-13 17:05:00','FACE_ID',0.9300,0.9700,0.9100,NULL,NULL,NULL,NULL,'AUTO_APPROVED',NULL,NULL,'2026-07-16 21:44:07'),(42,6,1,'CHECK_IN','2026-07-13 07:55:00','FACE_ID',0.9100,0.9600,0.9000,NULL,NULL,NULL,NULL,'AUTO_APPROVED',NULL,NULL,'2026-07-16 21:44:07'),(43,6,1,'CHECK_OUT','2026-07-13 17:05:00','FACE_ID',0.9300,0.9700,0.9100,NULL,NULL,NULL,NULL,'AUTO_APPROVED',NULL,NULL,'2026-07-16 21:44:07'),(44,1,1,'CHECK_IN','2026-07-10 07:55:00','FACE_ID',0.9100,0.9600,0.9000,NULL,NULL,NULL,NULL,'AUTO_APPROVED',NULL,NULL,'2026-07-16 21:44:07'),(45,1,1,'CHECK_OUT','2026-07-10 17:05:00','FACE_ID',0.9300,0.9700,0.9100,NULL,NULL,NULL,NULL,'AUTO_APPROVED',NULL,NULL,'2026-07-16 21:44:07'),(46,2,1,'CHECK_IN','2026-07-10 07:55:00','FACE_ID',0.9100,0.9600,0.9000,NULL,NULL,NULL,NULL,'AUTO_APPROVED',NULL,NULL,'2026-07-16 21:44:07'),(47,2,1,'CHECK_OUT','2026-07-10 17:05:00','FACE_ID',0.9300,0.9700,0.9100,NULL,NULL,NULL,NULL,'AUTO_APPROVED',NULL,NULL,'2026-07-16 21:44:07'),(48,3,1,'CHECK_IN','2026-07-10 07:55:00','FACE_ID',0.8200,0.9600,0.9000,NULL,NULL,NULL,NULL,'AUTO_APPROVED',NULL,NULL,'2026-07-16 21:44:07'),(49,3,1,'CHECK_OUT','2026-07-10 17:05:00','FACE_ID',0.8400,0.9700,0.9100,NULL,NULL,NULL,NULL,'AUTO_APPROVED',NULL,NULL,'2026-07-16 21:44:07'),(50,4,1,'CHECK_IN','2026-07-10 07:55:00','FACE_ID',0.6900,0.9600,0.9000,NULL,NULL,NULL,NULL,'NEEDS_REVIEW',NULL,NULL,'2026-07-16 21:44:07'),(51,4,1,'CHECK_OUT','2026-07-10 17:05:00','FACE_ID',0.7100,0.9700,0.9100,NULL,NULL,NULL,NULL,'AUTO_APPROVED',NULL,NULL,'2026-07-16 21:44:07'),(52,5,1,'CHECK_IN','2026-07-10 07:55:00','FACE_ID',0.9100,0.9600,0.9000,NULL,NULL,NULL,NULL,'AUTO_APPROVED',NULL,NULL,'2026-07-16 21:44:07'),(53,5,1,'CHECK_OUT','2026-07-10 17:05:00','FACE_ID',0.9300,0.9700,0.9100,NULL,NULL,NULL,NULL,'AUTO_APPROVED',NULL,NULL,'2026-07-16 21:44:07');
/*!40000 ALTER TABLE `attendance_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `audit_logs`
--

DROP TABLE IF EXISTS `audit_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `audit_logs` (
  `audit_log_id` bigint(20) NOT NULL AUTO_INCREMENT,
  `actor_user_id` int(11) DEFAULT NULL,
  `action` varchar(80) NOT NULL,
  `entity_type` varchar(80) NOT NULL,
  `entity_id` varchar(80) DEFAULT NULL,
  `before_json` longtext DEFAULT NULL,
  `after_json` longtext DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` varchar(500) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`audit_log_id`),
  KEY `idx_audit_logs_entity` (`entity_type`,`entity_id`),
  KEY `idx_audit_logs_actor_time` (`actor_user_id`,`created_at`),
  KEY `idx_audit_logs_action_time` (`action`,`created_at`),
  CONSTRAINT `fk_audit_logs_actor` FOREIGN KEY (`actor_user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `audit_logs`
--

LOCK TABLES `audit_logs` WRITE;
/*!40000 ALTER TABLE `audit_logs` DISABLE KEYS */;
INSERT INTO `audit_logs` VALUES (1,1,'SEED_DATABASE','DATABASE','facelog_db',NULL,'{\"status\":\"completed\"}','127.0.0.1',NULL,'2026-07-16 21:44:07'),(2,1,'SEED_DATABASE','DATABASE','facelog_db',NULL,'{\"status\":\"completed\"}','127.0.0.1',NULL,'2026-07-16 21:45:17');
/*!40000 ALTER TABLE `audit_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `departments`
--

DROP TABLE IF EXISTS `departments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `departments` (
  `department_id` int(11) NOT NULL AUTO_INCREMENT,
  `department_code` varchar(30) NOT NULL,
  `department_name` varchar(150) NOT NULL,
  `description` varchar(500) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`department_id`),
  UNIQUE KEY `department_code` (`department_code`),
  KEY `idx_departments_active_name` (`is_active`,`department_name`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `departments`
--

LOCK TABLES `departments` WRITE;
/*!40000 ALTER TABLE `departments` DISABLE KEYS */;
INSERT INTO `departments` VALUES (1,'HR','Phòng Nhân Sự','Quản lý nhân sự và chấm công',1,'2026-07-16 21:44:07','2026-07-16 21:44:07'),(2,'IT','Phòng Công Nghệ','Vận hành hệ thống và sản phẩm',1,'2026-07-16 21:44:07','2026-07-16 21:44:07'),(3,'OPS','Phòng Vận Hành','Điều phối vận hành hàng ngày',1,'2026-07-16 21:44:07','2026-07-16 21:44:07'),(4,'FIN','Phòng Tài Chính','Tài chính kế toán',1,'2026-07-16 21:44:07','2026-07-16 21:44:07');
/*!40000 ALTER TABLE `departments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `devices`
--

DROP TABLE IF EXISTS `devices`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `devices` (
  `device_id` int(11) NOT NULL AUTO_INCREMENT,
  `device_code` varchar(50) NOT NULL,
  `device_name` varchar(150) NOT NULL,
  `device_type` enum('CAMERA','KIOSK','MOBILE','WEB') NOT NULL DEFAULT 'CAMERA',
  `location_name` varchar(150) DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `status` enum('ONLINE','OFFLINE','MAINTENANCE') NOT NULL DEFAULT 'ONLINE',
  `last_seen_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`device_id`),
  UNIQUE KEY `device_code` (`device_code`),
  KEY `idx_devices_type_status` (`device_type`,`status`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `devices`
--

LOCK TABLES `devices` WRITE;
/*!40000 ALTER TABLE `devices` DISABLE KEYS */;
INSERT INTO `devices` VALUES (1,'CAM-MAIN-01','Camera Cổng Chính','CAMERA','Cổng Chính','192.168.1.50','ONLINE','2026-07-16 21:45:17','2026-07-16 21:44:07','2026-07-16 21:45:17'),(2,'KIOSK-HR-01','Kiosk Phòng Nhân Sự','KIOSK','Tầng 1 - HR','192.168.1.51','ONLINE','2026-07-16 21:45:17','2026-07-16 21:44:07','2026-07-16 21:45:17'),(3,'WEB-ADMIN','Web Admin','WEB','Nội bộ',NULL,'ONLINE','2026-07-16 21:45:17','2026-07-16 21:44:07','2026-07-16 21:45:17');
/*!40000 ALTER TABLE `devices` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `employee_shift_assignments`
--

DROP TABLE IF EXISTS `employee_shift_assignments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `employee_shift_assignments` (
  `assignment_id` int(11) NOT NULL AUTO_INCREMENT,
  `employee_id` int(11) NOT NULL,
  `shift_id` int(11) NOT NULL,
  `effective_from` date NOT NULL,
  `effective_to` date DEFAULT NULL,
  `repeat_type` enum('DAILY','WEEKDAYS','CUSTOM') NOT NULL DEFAULT 'WEEKDAYS',
  `custom_weekdays` varchar(30) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`assignment_id`),
  KEY `idx_shift_assignments_employee_date` (`employee_id`,`effective_from`,`effective_to`),
  KEY `idx_shift_assignments_shift_active` (`shift_id`,`is_active`),
  CONSTRAINT `fk_shift_assignments_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`employee_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_shift_assignments_shift` FOREIGN KEY (`shift_id`) REFERENCES `shifts` (`shift_id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employee_shift_assignments`
--

LOCK TABLES `employee_shift_assignments` WRITE;
/*!40000 ALTER TABLE `employee_shift_assignments` DISABLE KEYS */;
INSERT INTO `employee_shift_assignments` VALUES (1,1,1,'2026-04-17',NULL,'WEEKDAYS',NULL,1,'2026-07-16 21:44:07','2026-07-16 21:44:07'),(2,2,1,'2026-04-17',NULL,'WEEKDAYS',NULL,1,'2026-07-16 21:44:07','2026-07-16 21:44:07'),(3,3,1,'2026-04-17',NULL,'WEEKDAYS',NULL,1,'2026-07-16 21:44:07','2026-07-16 21:44:07'),(4,4,1,'2026-04-17',NULL,'WEEKDAYS',NULL,1,'2026-07-16 21:44:07','2026-07-16 21:44:07'),(5,5,1,'2026-04-17',NULL,'WEEKDAYS',NULL,1,'2026-07-16 21:44:07','2026-07-16 21:44:07'),(6,6,1,'2026-04-17',NULL,'WEEKDAYS',NULL,1,'2026-07-16 21:44:07','2026-07-16 21:44:07');
/*!40000 ALTER TABLE `employee_shift_assignments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `employees`
--

DROP TABLE IF EXISTS `employees`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `employees` (
  `employee_id` int(11) NOT NULL AUTO_INCREMENT,
  `employee_code` varchar(30) NOT NULL,
  `full_name` varchar(150) NOT NULL,
  `gender` enum('MALE','FEMALE','OTHER') DEFAULT NULL,
  `date_of_birth` date NOT NULL,
  `email` varchar(150) DEFAULT NULL,
  `phone` varchar(30) DEFAULT NULL,
  `address` varchar(500) DEFAULT NULL,
  `department_id` int(11) DEFAULT NULL,
  `position_id` int(11) DEFAULT NULL,
  `employment_type` enum('FULL_TIME','PART_TIME','INTERN','CONTRACTOR') NOT NULL DEFAULT 'FULL_TIME',
  `employment_status` enum('ACTIVE','ON_LEAVE','SUSPENDED','RESIGNED') NOT NULL DEFAULT 'ACTIVE',
  `hire_date` date NOT NULL,
  `termination_date` date DEFAULT NULL,
  `avatar_url` varchar(500) DEFAULT NULL,
  `note` varchar(1000) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`employee_id`),
  UNIQUE KEY `employee_code` (`employee_code`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_employees_name` (`full_name`),
  KEY `idx_employees_department_status` (`department_id`,`employment_status`),
  KEY `idx_employees_position` (`position_id`),
  KEY `idx_employees_hire_date` (`hire_date`),
  CONSTRAINT `fk_employees_department` FOREIGN KEY (`department_id`) REFERENCES `departments` (`department_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_employees_position` FOREIGN KEY (`position_id`) REFERENCES `positions` (`position_id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `employees`
--

LOCK TABLES `employees` WRITE;
/*!40000 ALTER TABLE `employees` DISABLE KEYS */;
INSERT INTO `employees` VALUES (1,'ANM0120592','Nguyễn Minh Anh','FEMALE','1992-05-12','anh.nguyen@hutech.local','0901000001',NULL,1,1,'FULL_TIME','ACTIVE','2021-03-15',NULL,NULL,NULL,'2026-07-16 21:44:07','2026-07-16 21:44:07'),(2,'BTQ0210894','Trần Quốc Bảo','MALE','1994-08-21','bao.tran@hutech.local','0901000002',NULL,2,3,'FULL_TIME','ACTIVE','2022-07-01',NULL,NULL,NULL,'2026-07-16 21:44:07','2026-07-16 21:44:07'),(3,'CLTN0090196','Lê Thị Ngọc Cẩm','FEMALE','1996-01-09','cam.le@hutech.local','0901000003',NULL,3,6,'FULL_TIME','ACTIVE','2023-02-10',NULL,NULL,NULL,'2026-07-16 21:44:07','2026-07-16 21:44:07'),(4,'HPG0301190','Pham Gia Huy','MALE','1990-11-30','huy.pham@hutech.local','0901000004',NULL,4,5,'FULL_TIME','ACTIVE','2020-09-05',NULL,NULL,NULL,'2026-07-16 21:44:07','2026-07-16 21:44:07'),(5,'LVN0180498','Vo Ngoc Lan','FEMALE','1998-04-18','lan.vo@hutech.local','0901000005',NULL,1,2,'FULL_TIME','ACTIVE','2024-01-08',NULL,NULL,NULL,'2026-07-16 21:44:07','2026-07-16 21:44:07'),(6,'SDT0031088','Dang Thanh Son','MALE','1988-10-03','son.dang@hutech.local','0901000006',NULL,3,4,'FULL_TIME','ACTIVE','2019-06-20',NULL,NULL,NULL,'2026-07-16 21:44:07','2026-07-16 21:44:07');
/*!40000 ALTER TABLE `employees` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `face_profiles`
--

DROP TABLE IF EXISTS `face_profiles`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `face_profiles` (
  `face_profile_id` int(11) NOT NULL AUTO_INCREMENT,
  `employee_id` int(11) NOT NULL,
  `embedding_model` varchar(80) NOT NULL DEFAULT 'face-recognition-v1',
  `embedding_version` varchar(30) NOT NULL DEFAULT '1.0',
  `embedding_dimension` int(11) NOT NULL DEFAULT 128,
  `face_embedding` longblob DEFAULT NULL,
  `quality_score` decimal(5,4) DEFAULT NULL,
  `liveness_score` decimal(5,4) DEFAULT NULL,
  `samples_count` int(11) NOT NULL DEFAULT 0,
  `threshold` decimal(5,4) NOT NULL DEFAULT 0.7000,
  `status` enum('NOT_ENROLLED','PENDING_REVIEW','ACTIVE','LOW_QUALITY','DISABLED') NOT NULL DEFAULT 'NOT_ENROLLED',
  `enrolled_at` datetime DEFAULT NULL,
  `last_verified_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`face_profile_id`),
  UNIQUE KEY `employee_id` (`employee_id`),
  KEY `idx_face_profiles_status_quality` (`status`,`quality_score`),
  KEY `idx_face_profiles_verified` (`last_verified_at`),
  CONSTRAINT `fk_face_profiles_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`employee_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `face_profiles`
--

LOCK TABLES `face_profiles` WRITE;
/*!40000 ALTER TABLE `face_profiles` DISABLE KEYS */;
INSERT INTO `face_profiles` VALUES (1,1,'face-recognition-v1','1.0',128,NULL,0.9430,0.9810,5,0.7000,'ACTIVE','2026-07-09 21:44:07','2026-07-15 21:45:17','2026-07-16 21:44:07','2026-07-16 21:45:17'),(2,2,'face-recognition-v1','1.0',128,NULL,0.9180,0.9640,4,0.7000,'ACTIVE','2026-07-09 21:44:07','2026-07-15 21:45:17','2026-07-16 21:44:07','2026-07-16 21:45:17'),(3,3,'face-recognition-v1','1.0',128,NULL,0.8720,0.9320,3,0.7200,'ACTIVE','2026-07-09 21:44:07','2026-07-15 21:45:17','2026-07-16 21:44:07','2026-07-16 21:45:17'),(4,4,'face-recognition-v1','1.0',128,NULL,0.6810,0.9040,2,0.7400,'LOW_QUALITY','2026-07-09 21:44:07','2026-07-15 21:45:17','2026-07-16 21:44:07','2026-07-16 21:45:17'),(5,5,'face-recognition-v1','1.0',128,NULL,0.9250,0.9700,4,0.7000,'ACTIVE','2026-07-09 21:44:07','2026-07-15 21:45:17','2026-07-16 21:44:07','2026-07-16 21:45:17'),(6,6,'face-recognition-v1','1.0',128,NULL,NULL,NULL,0,0.7000,'NOT_ENROLLED',NULL,NULL,'2026-07-16 21:44:07','2026-07-16 21:44:07');
/*!40000 ALTER TABLE `face_profiles` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `face_samples`
--

DROP TABLE IF EXISTS `face_samples`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `face_samples` (
  `face_sample_id` int(11) NOT NULL AUTO_INCREMENT,
  `face_profile_id` int(11) NOT NULL,
  `sample_type` enum('FRONT','LEFT','RIGHT','UP','DOWN','WITH_MASK','OTHER') NOT NULL DEFAULT 'FRONT',
  `image_path` varchar(500) DEFAULT NULL,
  `image_blob` longblob DEFAULT NULL,
  `embedding_blob` longblob DEFAULT NULL,
  `quality_score` decimal(5,4) DEFAULT NULL,
  `brightness_score` decimal(5,4) DEFAULT NULL,
  `sharpness_score` decimal(7,2) DEFAULT NULL,
  `pose_yaw` decimal(7,3) DEFAULT NULL,
  `pose_pitch` decimal(7,3) DEFAULT NULL,
  `pose_roll` decimal(7,3) DEFAULT NULL,
  `is_primary` tinyint(1) NOT NULL DEFAULT 0,
  `captured_at` datetime NOT NULL DEFAULT current_timestamp(),
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`face_sample_id`),
  KEY `idx_face_samples_profile_primary` (`face_profile_id`,`is_primary`),
  KEY `idx_face_samples_quality` (`quality_score`),
  CONSTRAINT `fk_face_samples_profile` FOREIGN KEY (`face_profile_id`) REFERENCES `face_profiles` (`face_profile_id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=16 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `face_samples`
--

LOCK TABLES `face_samples` WRITE;
/*!40000 ALTER TABLE `face_samples` DISABLE KEYS */;
INSERT INTO `face_samples` VALUES (1,1,'FRONT','uploads/faces/emp001_front.jpg',NULL,NULL,0.9100,NULL,NULL,NULL,NULL,NULL,1,'2026-07-16 21:44:07','2026-07-16 21:44:07'),(2,1,'LEFT','uploads/faces/emp001_left.jpg',NULL,NULL,0.8700,NULL,NULL,NULL,NULL,NULL,0,'2026-07-16 21:44:07','2026-07-16 21:44:07'),(3,1,'RIGHT','uploads/faces/emp001_right.jpg',NULL,NULL,0.8800,NULL,NULL,NULL,NULL,NULL,0,'2026-07-16 21:44:07','2026-07-16 21:44:07'),(4,2,'FRONT','uploads/faces/emp002_front.jpg',NULL,NULL,0.9100,NULL,NULL,NULL,NULL,NULL,1,'2026-07-16 21:44:07','2026-07-16 21:44:07'),(5,2,'LEFT','uploads/faces/emp002_left.jpg',NULL,NULL,0.8700,NULL,NULL,NULL,NULL,NULL,0,'2026-07-16 21:44:07','2026-07-16 21:44:07'),(6,2,'RIGHT','uploads/faces/emp002_right.jpg',NULL,NULL,0.8800,NULL,NULL,NULL,NULL,NULL,0,'2026-07-16 21:44:07','2026-07-16 21:44:07'),(7,3,'FRONT','uploads/faces/emp003_front.jpg',NULL,NULL,0.9100,NULL,NULL,NULL,NULL,NULL,1,'2026-07-16 21:44:07','2026-07-16 21:44:07'),(8,3,'LEFT','uploads/faces/emp003_left.jpg',NULL,NULL,0.8700,NULL,NULL,NULL,NULL,NULL,0,'2026-07-16 21:44:07','2026-07-16 21:44:07'),(9,3,'RIGHT','uploads/faces/emp003_right.jpg',NULL,NULL,0.8800,NULL,NULL,NULL,NULL,NULL,0,'2026-07-16 21:44:07','2026-07-16 21:44:07'),(10,4,'FRONT','uploads/faces/emp004_front.jpg',NULL,NULL,0.9100,NULL,NULL,NULL,NULL,NULL,1,'2026-07-16 21:44:07','2026-07-16 21:44:07'),(11,4,'LEFT','uploads/faces/emp004_left.jpg',NULL,NULL,0.8700,NULL,NULL,NULL,NULL,NULL,0,'2026-07-16 21:44:07','2026-07-16 21:44:07'),(12,4,'RIGHT','uploads/faces/emp004_right.jpg',NULL,NULL,0.8800,NULL,NULL,NULL,NULL,NULL,0,'2026-07-16 21:44:07','2026-07-16 21:44:07'),(13,5,'FRONT','uploads/faces/emp005_front.jpg',NULL,NULL,0.9100,NULL,NULL,NULL,NULL,NULL,1,'2026-07-16 21:44:07','2026-07-16 21:44:07'),(14,5,'LEFT','uploads/faces/emp005_left.jpg',NULL,NULL,0.8700,NULL,NULL,NULL,NULL,NULL,0,'2026-07-16 21:44:07','2026-07-16 21:44:07'),(15,5,'RIGHT','uploads/faces/emp005_right.jpg',NULL,NULL,0.8800,NULL,NULL,NULL,NULL,NULL,0,'2026-07-16 21:44:07','2026-07-16 21:44:07');
/*!40000 ALTER TABLE `face_samples` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `leave_requests`
--

DROP TABLE IF EXISTS `leave_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `leave_requests` (
  `leave_request_id` bigint(20) NOT NULL AUTO_INCREMENT,
  `employee_id` int(11) NOT NULL,
  `leave_type` enum('ANNUAL','SICK','UNPAID','BUSINESS_TRIP','OTHER') NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `total_days` decimal(5,2) NOT NULL,
  `reason` varchar(1000) DEFAULT NULL,
  `status` enum('PENDING','APPROVED','REJECTED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  `approved_by` int(11) DEFAULT NULL,
  `approved_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`leave_request_id`),
  KEY `fk_leave_requests_approver` (`approved_by`),
  KEY `idx_leave_requests_employee_date` (`employee_id`,`start_date`,`end_date`),
  KEY `idx_leave_requests_status_date` (`status`,`start_date`),
  CONSTRAINT `fk_leave_requests_approver` FOREIGN KEY (`approved_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_leave_requests_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`employee_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `leave_requests`
--

LOCK TABLES `leave_requests` WRITE;
/*!40000 ALTER TABLE `leave_requests` DISABLE KEYS */;
/*!40000 ALTER TABLE `leave_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `positions`
--

DROP TABLE IF EXISTS `positions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `positions` (
  `position_id` int(11) NOT NULL AUTO_INCREMENT,
  `position_code` varchar(30) NOT NULL,
  `position_name` varchar(150) NOT NULL,
  `level_name` varchar(80) DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`position_id`),
  UNIQUE KEY `position_code` (`position_code`),
  KEY `idx_positions_active_name` (`is_active`,`position_name`)
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `positions`
--

LOCK TABLES `positions` WRITE;
/*!40000 ALTER TABLE `positions` DISABLE KEYS */;
INSERT INTO `positions` VALUES (1,'HRM','Trưởng Phòng Nhân Sự','Manager',1,'2026-07-16 21:44:07','2026-07-16 21:44:07'),(2,'HRS','Chuyên Viên Nhân Sự','Staff',1,'2026-07-16 21:44:07','2026-07-16 21:44:07'),(3,'DEV','Lập Trình Viên','Staff',1,'2026-07-16 21:44:07','2026-07-16 21:44:07'),(4,'SEC','Nhân Viên Bảo Vệ','Staff',1,'2026-07-16 21:44:07','2026-07-16 21:44:07'),(5,'ACC','Kế Toán Viên','Staff',1,'2026-07-16 21:44:07','2026-07-16 21:44:07'),(6,'OPS','Điều Phối Viên','Staff',1,'2026-07-16 21:44:07','2026-07-16 21:44:07');
/*!40000 ALTER TABLE `positions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `recognition_attempts`
--

DROP TABLE IF EXISTS `recognition_attempts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `recognition_attempts` (
  `recognition_attempt_id` bigint(20) NOT NULL AUTO_INCREMENT,
  `employee_id` int(11) DEFAULT NULL,
  `device_id` int(11) DEFAULT NULL,
  `attempted_at` datetime NOT NULL DEFAULT current_timestamp(),
  `result` enum('MATCHED','NO_FACE','UNKNOWN_FACE','LOW_CONFIDENCE','LIVENESS_FAILED','MULTIPLE_FACES','ERROR') NOT NULL,
  `confidence` decimal(5,4) DEFAULT NULL,
  `liveness_score` decimal(5,4) DEFAULT NULL,
  `face_quality_score` decimal(5,4) DEFAULT NULL,
  `threshold` decimal(5,4) NOT NULL DEFAULT 0.7000,
  `processing_ms` int(11) DEFAULT NULL,
  `image_path` varchar(500) DEFAULT NULL,
  `error_message` varchar(1000) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`recognition_attempt_id`),
  KEY `fk_recognition_attempts_device` (`device_id`),
  KEY `idx_recognition_attempts_time_result` (`attempted_at`,`result`),
  KEY `idx_recognition_attempts_employee_time` (`employee_id`,`attempted_at`),
  KEY `idx_recognition_attempts_quality` (`confidence`,`liveness_score`,`face_quality_score`),
  CONSTRAINT `fk_recognition_attempts_device` FOREIGN KEY (`device_id`) REFERENCES `devices` (`device_id`) ON DELETE SET NULL,
  CONSTRAINT `fk_recognition_attempts_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`employee_id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `recognition_attempts`
--

LOCK TABLES `recognition_attempts` WRITE;
/*!40000 ALTER TABLE `recognition_attempts` DISABLE KEYS */;
INSERT INTO `recognition_attempts` VALUES (1,1,1,'2026-07-16 21:44:07','MATCHED',0.9100,0.9600,0.9000,0.7000,142,NULL,NULL,'2026-07-16 21:44:07'),(2,2,1,'2026-07-16 21:44:07','MATCHED',0.9100,0.9600,0.9000,0.7000,142,NULL,NULL,'2026-07-16 21:44:07'),(3,3,1,'2026-07-16 21:44:07','MATCHED',0.9100,0.9600,0.9000,0.7000,142,NULL,NULL,'2026-07-16 21:44:07'),(4,4,1,'2026-07-16 21:44:07','MATCHED',0.9100,0.9600,0.9000,0.7000,142,NULL,NULL,'2026-07-16 21:44:07'),(5,4,1,'2026-07-16 21:44:07','LOW_CONFIDENCE',0.6400,0.9300,0.6500,0.7000,168,NULL,NULL,'2026-07-16 21:44:07'),(6,5,1,'2026-07-16 21:44:07','MATCHED',0.9100,0.9600,0.9000,0.7000,142,NULL,NULL,'2026-07-16 21:44:07'),(7,6,1,'2026-07-16 21:44:07','MATCHED',0.9100,0.9600,0.9000,0.7000,142,NULL,NULL,'2026-07-16 21:44:07'),(8,NULL,1,'2026-07-16 21:44:07','UNKNOWN_FACE',0.4300,0.8800,0.7200,0.7000,151,NULL,NULL,'2026-07-16 21:44:07'),(9,NULL,1,'2026-07-16 21:44:07','NO_FACE',NULL,NULL,NULL,0.7000,91,NULL,NULL,'2026-07-16 21:44:07'),(10,1,1,'2026-07-16 21:45:17','MATCHED',0.9100,0.9600,0.9000,0.7000,142,NULL,NULL,'2026-07-16 21:45:17'),(11,2,1,'2026-07-16 21:45:17','MATCHED',0.9100,0.9600,0.9000,0.7000,142,NULL,NULL,'2026-07-16 21:45:17'),(12,3,1,'2026-07-16 21:45:17','MATCHED',0.9100,0.9600,0.9000,0.7000,142,NULL,NULL,'2026-07-16 21:45:17'),(13,4,1,'2026-07-16 21:45:17','MATCHED',0.9100,0.9600,0.9000,0.7000,142,NULL,NULL,'2026-07-16 21:45:17'),(14,4,1,'2026-07-16 21:45:17','LOW_CONFIDENCE',0.6400,0.9300,0.6500,0.7000,168,NULL,NULL,'2026-07-16 21:45:17'),(15,5,1,'2026-07-16 21:45:17','MATCHED',0.9100,0.9600,0.9000,0.7000,142,NULL,NULL,'2026-07-16 21:45:17'),(16,6,1,'2026-07-16 21:45:17','MATCHED',0.9100,0.9600,0.9000,0.7000,142,NULL,NULL,'2026-07-16 21:45:17'),(17,NULL,1,'2026-07-16 21:45:17','UNKNOWN_FACE',0.4300,0.8800,0.7200,0.7000,151,NULL,NULL,'2026-07-16 21:45:17'),(18,NULL,1,'2026-07-16 21:45:17','NO_FACE',NULL,NULL,NULL,0.7000,91,NULL,NULL,'2026-07-16 21:45:17');
/*!40000 ALTER TABLE `recognition_attempts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `report_exports`
--

DROP TABLE IF EXISTS `report_exports`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `report_exports` (
  `report_export_id` bigint(20) NOT NULL AUTO_INCREMENT,
  `requested_by` int(11) DEFAULT NULL,
  `report_type` enum('ATTENDANCE_DAILY','ATTENDANCE_MONTHLY','EMPLOYEE_LIST','FACE_RELIABILITY') NOT NULL,
  `file_name` varchar(255) NOT NULL,
  `file_path` varchar(500) DEFAULT NULL,
  `filter_json` longtext DEFAULT NULL,
  `sort_json` longtext DEFAULT NULL,
  `columns_json` longtext DEFAULT NULL,
  `status` enum('PENDING','PROCESSING','COMPLETED','FAILED') NOT NULL DEFAULT 'PENDING',
  `row_count` int(11) NOT NULL DEFAULT 0,
  `error_message` varchar(1000) DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `completed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`report_export_id`),
  KEY `fk_report_exports_requested_by` (`requested_by`),
  KEY `idx_report_exports_type_status` (`report_type`,`status`),
  KEY `idx_report_exports_created` (`created_at`),
  CONSTRAINT `fk_report_exports_requested_by` FOREIGN KEY (`requested_by`) REFERENCES `users` (`user_id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `report_exports`
--

LOCK TABLES `report_exports` WRITE;
/*!40000 ALTER TABLE `report_exports` DISABLE KEYS */;
INSERT INTO `report_exports` VALUES (1,1,'ATTENDANCE_DAILY','attendance_daily_20260716.xlsx','exports/attendance_daily.xlsx','{\"from\":\"last_7_days\",\"department\":\"ALL\"}','{\"work_date\":\"desc\",\"department_name\":\"asc\",\"employee_code\":\"asc\"}','[\"work_date\",\"employee_code\",\"full_name\",\"department_name\",\"shift_name\",\"first_check_in\",\"last_check_out\",\"status\"]','COMPLETED',24,NULL,'2026-07-16 21:44:07','2026-07-16 21:44:07'),(2,1,'ATTENDANCE_DAILY','attendance_daily_20260716.xlsx','exports/attendance_daily.xlsx','{\"from\":\"last_7_days\",\"department\":\"ALL\"}','{\"work_date\":\"desc\",\"department_name\":\"asc\",\"employee_code\":\"asc\"}','[\"work_date\",\"employee_code\",\"full_name\",\"department_name\",\"shift_name\",\"first_check_in\",\"last_check_out\",\"status\"]','COMPLETED',24,NULL,'2026-07-16 21:45:17','2026-07-16 21:45:17');
/*!40000 ALTER TABLE `report_exports` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `shifts`
--

DROP TABLE IF EXISTS `shifts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `shifts` (
  `shift_id` int(11) NOT NULL AUTO_INCREMENT,
  `shift_code` varchar(30) NOT NULL,
  `shift_name` varchar(120) NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `break_minutes` int(11) NOT NULL DEFAULT 60,
  `late_grace_minutes` int(11) NOT NULL DEFAULT 10,
  `early_leave_grace_minutes` int(11) NOT NULL DEFAULT 10,
  `standard_work_minutes` int(11) NOT NULL,
  `is_overnight` tinyint(1) NOT NULL DEFAULT 0,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`shift_id`),
  UNIQUE KEY `shift_code` (`shift_code`),
  KEY `idx_shifts_active_start` (`is_active`,`start_time`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `shifts`
--

LOCK TABLES `shifts` WRITE;
/*!40000 ALTER TABLE `shifts` DISABLE KEYS */;
INSERT INTO `shifts` VALUES (1,'HC','Giờ Hành Chính','08:00:00','17:00:00',60,10,10,480,0,1,'2026-07-16 21:44:07','2026-07-16 21:44:07'),(2,'S1','Ca sáng','06:00:00','14:00:00',30,5,5,450,0,1,'2026-07-16 21:44:07','2026-07-16 21:44:07'),(3,'S2','Ca chiều','14:00:00','22:00:00',30,5,5,450,0,1,'2026-07-16 21:44:07','2026-07-16 21:44:07'),(4,'N1','Ca tối','22:00:00','06:00:00',30,5,5,450,1,1,'2026-07-16 21:44:07','2026-07-16 21:44:07');
/*!40000 ALTER TABLE `shifts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE `users` (
  `user_id` int(11) NOT NULL AUTO_INCREMENT,
  `employee_id` int(11) DEFAULT NULL,
  `username` varchar(80) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `role` enum('SUPER_ADMIN','HR_MANAGER','HR_STAFF','SECURITY','EMPLOYEE') NOT NULL,
  `status` enum('ACTIVE','LOCKED','DISABLED') NOT NULL DEFAULT 'ACTIVE',
  `last_login_at` datetime DEFAULT NULL,
  `created_at` datetime NOT NULL DEFAULT current_timestamp(),
  `updated_at` datetime NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `username` (`username`),
  KEY `fk_users_employee` (`employee_id`),
  KEY `idx_users_role_status` (`role`,`status`),
  CONSTRAINT `fk_users_employee` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`employee_id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,1,'admin','f865b53623b121fd34ee5426c792e5c33af8c227','SUPER_ADMIN','ACTIVE',NULL,'2026-07-16 21:44:07','2026-07-16 21:44:07'),(2,5,'hr.staff','78a28dabae41209cf680f99d4ec5c560447c39f7','HR_STAFF','ACTIVE',NULL,'2026-07-16 21:44:07','2026-07-16 21:44:07'),(3,6,'security','f45fc5847bee336ee240f2698da4d5833caa5803','SECURITY','ACTIVE',NULL,'2026-07-16 21:44:07','2026-07-16 21:44:07');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Temporary table structure for view `v_attendance_daily_report`
--

DROP TABLE IF EXISTS `v_attendance_daily_report`;
/*!50001 DROP VIEW IF EXISTS `v_attendance_daily_report`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8;
/*!50001 CREATE VIEW `v_attendance_daily_report` AS SELECT
 1 AS `summary_id`,
  1 AS `work_date`,
  1 AS `employee_code`,
  1 AS `full_name`,
  1 AS `department_code`,
  1 AS `department_name`,
  1 AS `position_name`,
  1 AS `shift_code`,
  1 AS `shift_name`,
  1 AS `shift_start_time`,
  1 AS `shift_end_time`,
  1 AS `first_check_in`,
  1 AS `last_check_out`,
  1 AS `worked_minutes`,
  1 AS `late_minutes`,
  1 AS `early_leave_minutes`,
  1 AS `overtime_minutes`,
  1 AS `missing_check_out`,
  1 AS `status`,
  1 AS `approval_status`,
  1 AS `note` */;
SET character_set_client = @saved_cs_client;

--
-- Temporary table structure for view `v_face_reliability_report`
--

DROP TABLE IF EXISTS `v_face_reliability_report`;
/*!50001 DROP VIEW IF EXISTS `v_face_reliability_report`*/;
SET @saved_cs_client     = @@character_set_client;
SET character_set_client = utf8;
/*!50001 CREATE VIEW `v_face_reliability_report` AS SELECT
 1 AS `employee_code`,
  1 AS `full_name`,
  1 AS `department_name`,
  1 AS `face_status`,
  1 AS `quality_score`,
  1 AS `liveness_score`,
  1 AS `samples_count`,
  1 AS `threshold`,
  1 AS `enrolled_at`,
  1 AS `last_verified_at`,
  1 AS `attempts_count`,
  1 AS `matched_count`,
  1 AS `failed_count`,
  1 AS `avg_confidence`,
  1 AS `avg_processing_ms` */;
SET character_set_client = @saved_cs_client;

--
-- Dumping events for database 'facelog_db'
--

--
-- Dumping routines for database 'facelog_db'
--

--
-- Current Database: `facelog_db`
--

USE `facelog_db`;

--
-- Final view structure for view `v_attendance_daily_report`
--

/*!50001 DROP VIEW IF EXISTS `v_attendance_daily_report`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `v_attendance_daily_report` AS select `ads`.`summary_id` AS `summary_id`,`ads`.`work_date` AS `work_date`,`e`.`employee_code` AS `employee_code`,`e`.`full_name` AS `full_name`,`d`.`department_code` AS `department_code`,`d`.`department_name` AS `department_name`,`p`.`position_name` AS `position_name`,`s`.`shift_code` AS `shift_code`,`s`.`shift_name` AS `shift_name`,`s`.`start_time` AS `shift_start_time`,`s`.`end_time` AS `shift_end_time`,`ads`.`first_check_in` AS `first_check_in`,`ads`.`last_check_out` AS `last_check_out`,`ads`.`worked_minutes` AS `worked_minutes`,`ads`.`late_minutes` AS `late_minutes`,`ads`.`early_leave_minutes` AS `early_leave_minutes`,`ads`.`overtime_minutes` AS `overtime_minutes`,`ads`.`missing_check_out` AS `missing_check_out`,`ads`.`status` AS `status`,`ads`.`approval_status` AS `approval_status`,`ads`.`note` AS `note` from ((((`attendance_daily_summary` `ads` join `employees` `e` on(`e`.`employee_id` = `ads`.`employee_id`)) left join `departments` `d` on(`d`.`department_id` = `e`.`department_id`)) left join `positions` `p` on(`p`.`position_id` = `e`.`position_id`)) left join `shifts` `s` on(`s`.`shift_id` = `ads`.`shift_id`)) */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Final view structure for view `v_face_reliability_report`
--

/*!50001 DROP VIEW IF EXISTS `v_face_reliability_report`*/;
/*!50001 SET @saved_cs_client          = @@character_set_client */;
/*!50001 SET @saved_cs_results         = @@character_set_results */;
/*!50001 SET @saved_col_connection     = @@collation_connection */;
/*!50001 SET character_set_client      = utf8mb4 */;
/*!50001 SET character_set_results     = utf8mb4 */;
/*!50001 SET collation_connection      = utf8mb4_general_ci */;
/*!50001 CREATE ALGORITHM=UNDEFINED */
/*!50013 DEFINER=`root`@`localhost` SQL SECURITY DEFINER */
/*!50001 VIEW `v_face_reliability_report` AS select `e`.`employee_code` AS `employee_code`,`e`.`full_name` AS `full_name`,`d`.`department_name` AS `department_name`,`fp`.`status` AS `face_status`,`fp`.`quality_score` AS `quality_score`,`fp`.`liveness_score` AS `liveness_score`,`fp`.`samples_count` AS `samples_count`,`fp`.`threshold` AS `threshold`,`fp`.`enrolled_at` AS `enrolled_at`,`fp`.`last_verified_at` AS `last_verified_at`,count(`ra`.`recognition_attempt_id`) AS `attempts_count`,sum(case when `ra`.`result` = 'MATCHED' then 1 else 0 end) AS `matched_count`,sum(case when `ra`.`result` <> 'MATCHED' then 1 else 0 end) AS `failed_count`,round(avg(`ra`.`confidence`),4) AS `avg_confidence`,round(avg(`ra`.`processing_ms`),0) AS `avg_processing_ms` from (((`employees` `e` left join `departments` `d` on(`d`.`department_id` = `e`.`department_id`)) left join `face_profiles` `fp` on(`fp`.`employee_id` = `e`.`employee_id`)) left join `recognition_attempts` `ra` on(`ra`.`employee_id` = `e`.`employee_id`)) group by `e`.`employee_code`,`e`.`full_name`,`d`.`department_name`,`fp`.`status`,`fp`.`quality_score`,`fp`.`liveness_score`,`fp`.`samples_count`,`fp`.`threshold`,`fp`.`enrolled_at`,`fp`.`last_verified_at` */;
/*!50001 SET character_set_client      = @saved_cs_client */;
/*!50001 SET character_set_results     = @saved_cs_results */;
/*!50001 SET collation_connection      = @saved_col_connection */;

--
-- Employee employment-date validation triggers
--

DROP TRIGGER IF EXISTS `trg_employees_validate_insert`;
DROP TRIGGER IF EXISTS `trg_employees_validate_update`;
DELIMITER $$
CREATE TRIGGER `trg_employees_validate_insert` BEFORE INSERT ON `employees` FOR EACH ROW
BEGIN
  IF NEW.termination_date IS NOT NULL AND NEW.termination_date < NEW.hire_date THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Termination date cannot be before hire date';
  END IF;
  IF NEW.employment_status = 'RESIGNED' AND NEW.termination_date IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Resigned employee requires a termination date';
  END IF;
  IF NEW.termination_date IS NOT NULL AND NEW.termination_date <= CURDATE() AND NEW.employment_status <> 'RESIGNED' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Expired termination date requires RESIGNED status';
  END IF;
  IF NEW.employment_status = 'RESIGNED' AND NEW.termination_date > CURDATE() THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Future termination date cannot use RESIGNED status';
  END IF;
END$$
CREATE TRIGGER `trg_employees_validate_update` BEFORE UPDATE ON `employees` FOR EACH ROW
BEGIN
  IF NEW.termination_date IS NOT NULL AND NEW.termination_date < NEW.hire_date THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Termination date cannot be before hire date';
  END IF;
  IF NEW.employment_status = 'RESIGNED' AND NEW.termination_date IS NULL THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Resigned employee requires a termination date';
  END IF;
  IF NEW.termination_date IS NOT NULL AND NEW.termination_date <= CURDATE() AND NEW.employment_status <> 'RESIGNED' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Expired termination date requires RESIGNED status';
  END IF;
  IF NEW.employment_status = 'RESIGNED' AND NEW.termination_date > CURDATE() THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Future termination date cannot use RESIGNED status';
  END IF;
END$$
DELIMITER ;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-07-16 21:56:17
