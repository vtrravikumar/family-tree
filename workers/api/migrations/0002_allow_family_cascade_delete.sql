-- Permit an explicit family-owner deletion to cascade through deceased profiles.
-- Ordinary direct deletion of a deceased person remains blocked while its family exists.
DROP TRIGGER IF EXISTS deceased_person_delete_forbidden;
CREATE TRIGGER deceased_person_delete_forbidden
BEFORE DELETE ON persons
WHEN OLD.life_status = 'deceased'
  AND EXISTS (SELECT 1 FROM families WHERE id = OLD.family_id)
BEGIN
  SELECT RAISE(ABORT, 'deceased_person_delete_forbidden');
END;
