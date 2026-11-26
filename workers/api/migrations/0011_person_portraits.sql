-- Person portrait support: one active family-uploaded portrait per person.
-- Existing media records are preserved; only the new media_type convention is indexed.
CREATE UNIQUE INDEX one_active_person_portrait
  ON media(family_id, person_id)
  WHERE media_type = 'person_portrait' AND person_id IS NOT NULL;
