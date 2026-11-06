-- Commit enum additions before they are used by the next migration.
ALTER TYPE "RegistrationStatus" ADD VALUE 'DRAFT';
ALTER TYPE "RegistrationStatus" ADD VALUE 'SUBMITTED';
ALTER TYPE "ImportJobStatus" ADD VALUE 'VALIDATED';
ALTER TYPE "ImportJobStatus" ADD VALUE 'PARTIAL';
