DROP TRIGGER IF EXISTS deceased_person_profile_immutable;

CREATE TRIGGER deceased_person_profile_immutable
BEFORE UPDATE OF
  given_name, middle_name, family_name, display_name, gender, life_status,
  birth_date_kind, birth_exact_date, birth_year, birth_range_start_year,
  birth_range_end_year, birth_original_text, death_date_kind, death_exact_date,
  death_year, death_range_start_year, death_range_end_year, death_original_text,
  biography
ON persons
WHEN OLD.life_status = 'deceased'
 AND (
   NEW.life_status <> 'alive'
   OR NEW.given_name IS NOT OLD.given_name
   OR NEW.middle_name IS NOT OLD.middle_name
   OR NEW.family_name IS NOT OLD.family_name
   OR NEW.display_name IS NOT OLD.display_name
   OR NEW.gender IS NOT OLD.gender
   OR NEW.birth_date_kind IS NOT OLD.birth_date_kind
   OR NEW.birth_exact_date IS NOT OLD.birth_exact_date
   OR NEW.birth_year IS NOT OLD.birth_year
   OR NEW.birth_range_start_year IS NOT OLD.birth_range_start_year
   OR NEW.birth_range_end_year IS NOT OLD.birth_range_end_year
   OR NEW.birth_original_text IS NOT OLD.birth_original_text
   OR NEW.biography IS NOT OLD.biography
 )
BEGIN
  SELECT RAISE(ABORT, 'deceased_person_profile_immutable');
END;
