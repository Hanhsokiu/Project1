-- Commit enum additions before using them in the next migration.
ALTER TYPE "RegistrationStatus" ADD VALUE IF NOT EXISTS 'DRAFT';
ALTER TYPE "RegistrationStatus" ADD VALUE IF NOT EXISTS 'SUBMITTED';
