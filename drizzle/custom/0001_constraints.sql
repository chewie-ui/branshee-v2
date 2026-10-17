-- Contraintes que Drizzle ne sait pas déclarer : à appliquer après les migrations générées.
-- Interdit deux rendez-vous (ou blocages) confirmés qui se chevauchent pour un même membre.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE appointments
  ADD CONSTRAINT appointments_no_overlap
  EXCLUDE USING gist (
    member_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  )
  WHERE (status = 'confirmed' AND group_session_id IS NULL AND overbooked = false AND member_id IS NOT NULL);
