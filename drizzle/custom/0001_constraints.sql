-- Contraintes que Drizzle ne sait pas déclarer : appliquées après les migrations générées.
-- Script idempotent : peut être relancé à chaque `npm run db:migrate`.
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Interdit deux rendez-vous (ou blocages) confirmés qui se chevauchent pour un même membre.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_no_overlap') THEN
    ALTER TABLE appointments
      ADD CONSTRAINT appointments_no_overlap
      EXCLUDE USING gist (
        member_id WITH =,
        tstzrange(starts_at, ends_at, '[)') WITH &&
      )
      WHERE (status = 'confirmed' AND group_session_id IS NULL AND overbooked = false AND member_id IS NOT NULL);
  END IF;
END $$;
