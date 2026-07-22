USE `facelog_db`;

DROP TRIGGER IF EXISTS `trg_employees_validate_insert`;
DROP TRIGGER IF EXISTS `trg_employees_validate_update`;

DELIMITER $$

CREATE TRIGGER `trg_employees_validate_insert`
BEFORE INSERT ON `employees`
FOR EACH ROW
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

CREATE TRIGGER `trg_employees_validate_update`
BEFORE UPDATE ON `employees`
FOR EACH ROW
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
