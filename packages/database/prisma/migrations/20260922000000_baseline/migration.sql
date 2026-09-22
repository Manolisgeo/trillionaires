-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."AgentMode" AS ENUM ('LISTENING', 'THINKING', 'SPEAKING', 'WAITING', 'CLARIFYING', 'FOLLOW_UP');

-- CreateEnum
CREATE TYPE "public"."ClaimKind" AS ENUM ('FACT', 'INFERENCE', 'UNCERTAINTY');

-- CreateEnum
CREATE TYPE "public"."ConsentStatus" AS ENUM ('PENDING', 'GRANTED', 'DENIED');

-- CreateEnum
CREATE TYPE "public"."ConversationEventType" AS ENUM ('SESSION_STARTED', 'SESSION_ENDED', 'AGENT_JOINED', 'AGENT_LEFT', 'TURN_STARTED', 'TURN_ENDED', 'INTERRUPTION', 'FALSE_INTERRUPTION', 'TRANSCRIPT_PARTIAL', 'TRANSCRIPT_FINAL', 'TOOL_CALL', 'FACT_SAVED', 'OBJECTIVE_UPDATED', 'QUESTION_ASKED', 'QUESTION_SKIPPED', 'FOLLOW_UP', 'MOMENT', 'CONSENT', 'RECORDING_STARTED', 'RECORDING_STOPPED', 'ANALYSIS_STARTED', 'ANALYSIS_COMPLETED', 'ERROR', 'TELEMETRY');

-- CreateEnum
CREATE TYPE "public"."ConversationStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'LIVE', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."ConversationType" AS ENUM ('INTERVIEW', 'SALES', 'RESEARCH', 'MEETING', 'EXPERT_INTERVIEW', 'CUSTOM');

-- CreateEnum
CREATE TYPE "public"."ImportanceCategory" AS ENUM ('KEY_FACT', 'DECISION', 'ACTION', 'INSIGHT', 'CONCERN', 'CONTRADICTION', 'QUESTION', 'BACKGROUND', 'LOW_VALUE');

-- CreateEnum
CREATE TYPE "public"."MembershipRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "public"."ParticipantRole" AS ENUM ('HOST', 'PARTICIPANT', 'AI_AGENT', 'OBSERVER');

-- CreateEnum
CREATE TYPE "public"."ProcessingStatus" AS ENUM ('NOT_STARTED', 'PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "public"."ActionItem" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "owner" TEXT,
    "dueDate" TIMESTAMP(3),
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "timestampSeconds" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AgentSession" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "sessionId" TEXT,
    "livekitRoom" TEXT NOT NULL,
    "model" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "AgentSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AuditLog" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "metadata" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Conversation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "public"."ConversationType" NOT NULL,
    "title" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "status" "public"."ConversationStatus" NOT NULL DEFAULT 'DRAFT',
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "createdById" TEXT NOT NULL,
    "recordingUrl" TEXT,
    "transcriptStatus" "public"."ProcessingStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "analysisStatus" "public"."ProcessingStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "reportStatus" "public"."ProcessingStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "livekitRoom" TEXT NOT NULL,
    "templateId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ConversationEvent" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "sessionId" TEXT,
    "agentSessionId" TEXT,
    "type" "public"."ConversationEventType" NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data" JSONB NOT NULL,
    "model" TEXT,
    "latencyMs" INTEGER,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "estimatedCostUsd" DOUBLE PRECISION,

    CONSTRAINT "ConversationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ConversationInsight" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "kind" "public"."ClaimKind" NOT NULL,
    "category" "public"."ImportanceCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "timestampSeconds" DOUBLE PRECISION,
    "evidence" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConversationInsight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ConversationObjective" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "importance" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "status" TEXT NOT NULL DEFAULT 'UNCOVERED',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ConversationObjective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ConversationParticipant" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "personId" TEXT,
    "userId" TEXT,
    "displayName" TEXT NOT NULL,
    "role" "public"."ParticipantRole" NOT NULL,
    "isAgent" BOOLEAN NOT NULL DEFAULT false,
    "identity" TEXT NOT NULL,
    "consentStatus" "public"."ConsentStatus" NOT NULL DEFAULT 'PENDING',
    "consentedAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3),
    "leftAt" TIMESTAMP(3),

    CONSTRAINT "ConversationParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ConversationQuestion" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "objectiveId" TEXT,
    "topicId" TEXT,
    "prompt" TEXT NOT NULL,
    "expectedEvidence" JSONB NOT NULL,
    "importance" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "difficulty" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "prerequisites" JSONB NOT NULL,
    "followUpIds" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ConversationQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ConversationSession" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "livekitRoom" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "ConversationSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ConversationTag" (
    "conversationId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "ConversationTag_pkey" PRIMARY KEY ("conversationId","tagId")
);

-- CreateTable
CREATE TABLE "public"."ConversationTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "type" "public"."ConversationType" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isBuiltin" BOOLEAN NOT NULL DEFAULT false,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConversationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ConversationTopic" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "importance" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "summary" TEXT,

    CONSTRAINT "ConversationTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "retentionDays" INTEGER NOT NULL DEFAULT 365,
    "requireConsent" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OrganizationInvite" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "public"."MembershipRole" NOT NULL DEFAULT 'MEMBER',
    "token" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."OrganizationMember" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "public"."MembershipRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Person" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "title" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Recording" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL DEFAULT 'video/mp4',
    "durationSeconds" INTEGER,
    "egressId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "byteSize" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "Recording_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Report" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "status" "public"."ProcessingStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "executiveSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReportSection" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "kind" "public"."ClaimKind",
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ReportSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RubricCriterion" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "strongAnchor" TEXT NOT NULL,
    "weakAnchor" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RubricCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ScorecardRating" (
    "id" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "score" INTEGER,
    "rationale" TEXT NOT NULL,
    "evidenceKind" "public"."ClaimKind" NOT NULL DEFAULT 'UNCERTAINTY',
    "source" TEXT NOT NULL DEFAULT 'DRAFT',
    "quotes" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScorecardRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SearchDocument" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "chunkType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Tag" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Tracker" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "phrases" JSONB NOT NULL,
    "isBuiltin" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Tracker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TrackerHit" (
    "id" TEXT NOT NULL,
    "trackerId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "startTime" DOUBLE PRECISION NOT NULL,
    "speakerName" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL,

    CONSTRAINT "TrackerHit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Transcript" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "status" "public"."ProcessingStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "language" TEXT NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transcript_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TranscriptSegment" (
    "id" TEXT NOT NULL,
    "transcriptId" TEXT NOT NULL,
    "speakerId" TEXT NOT NULL,
    "speakerName" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "startTime" DOUBLE PRECISION NOT NULL,
    "endTime" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "isFinal" BOOLEAN NOT NULL DEFAULT true,
    "importanceScore" DOUBLE PRECISION,
    "importanceReason" TEXT,
    "category" "public"."ImportanceCategory",

    CONSTRAINT "TranscriptSegment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActionItem_conversationId_idx" ON "public"."ActionItem"("conversationId" ASC);

-- CreateIndex
CREATE INDEX "ActionItem_organizationId_completed_idx" ON "public"."ActionItem"("organizationId" ASC, "completed" ASC);

-- CreateIndex
CREATE INDEX "AgentSession_conversationId_idx" ON "public"."AgentSession"("conversationId" ASC);

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "public"."AuditLog"("organizationId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_livekitRoom_key" ON "public"."Conversation"("livekitRoom" ASC);

-- CreateIndex
CREATE INDEX "Conversation_organizationId_createdAt_idx" ON "public"."Conversation"("organizationId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "Conversation_organizationId_status_idx" ON "public"."Conversation"("organizationId" ASC, "status" ASC);

-- CreateIndex
CREATE INDEX "ConversationEvent_conversationId_timestamp_idx" ON "public"."ConversationEvent"("conversationId" ASC, "timestamp" ASC);

-- CreateIndex
CREATE INDEX "ConversationEvent_conversationId_type_idx" ON "public"."ConversationEvent"("conversationId" ASC, "type" ASC);

-- CreateIndex
CREATE INDEX "ConversationInsight_conversationId_category_idx" ON "public"."ConversationInsight"("conversationId" ASC, "category" ASC);

-- CreateIndex
CREATE INDEX "ConversationObjective_conversationId_idx" ON "public"."ConversationObjective"("conversationId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ConversationParticipant_conversationId_identity_key" ON "public"."ConversationParticipant"("conversationId" ASC, "identity" ASC);

-- CreateIndex
CREATE INDEX "ConversationParticipant_conversationId_idx" ON "public"."ConversationParticipant"("conversationId" ASC);

-- CreateIndex
CREATE INDEX "ConversationQuestion_conversationId_idx" ON "public"."ConversationQuestion"("conversationId" ASC);

-- CreateIndex
CREATE INDEX "ConversationSession_conversationId_idx" ON "public"."ConversationSession"("conversationId" ASC);

-- CreateIndex
CREATE INDEX "ConversationTemplate_organizationId_type_idx" ON "public"."ConversationTemplate"("organizationId" ASC, "type" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "public"."Organization"("slug" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationInvite_organizationId_email_key" ON "public"."OrganizationInvite"("organizationId" ASC, "email" ASC);

-- CreateIndex
CREATE INDEX "OrganizationInvite_organizationId_idx" ON "public"."OrganizationInvite"("organizationId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationInvite_token_key" ON "public"."OrganizationInvite"("token" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMember_organizationId_userId_key" ON "public"."OrganizationMember"("organizationId" ASC, "userId" ASC);

-- CreateIndex
CREATE INDEX "OrganizationMember_userId_idx" ON "public"."OrganizationMember"("userId" ASC);

-- CreateIndex
CREATE INDEX "Person_organizationId_idx" ON "public"."Person"("organizationId" ASC);

-- CreateIndex
CREATE INDEX "Recording_conversationId_idx" ON "public"."Recording"("conversationId" ASC);

-- CreateIndex
CREATE INDEX "Recording_organizationId_idx" ON "public"."Recording"("organizationId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Report_conversationId_key" ON "public"."Report"("conversationId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ReportSection_reportId_key_key" ON "public"."ReportSection"("reportId" ASC, "key" ASC);

-- CreateIndex
CREATE INDEX "RubricCriterion_conversationId_idx" ON "public"."RubricCriterion"("conversationId" ASC);

-- CreateIndex
CREATE INDEX "ScorecardRating_conversationId_idx" ON "public"."ScorecardRating"("conversationId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ScorecardRating_criterionId_key" ON "public"."ScorecardRating"("criterionId" ASC);

-- CreateIndex
CREATE INDEX "ScorecardRating_organizationId_idx" ON "public"."ScorecardRating"("organizationId" ASC);

-- CreateIndex
CREATE INDEX "SearchDocument_conversationId_idx" ON "public"."SearchDocument"("conversationId" ASC);

-- CreateIndex
CREATE INDEX "SearchDocument_organizationId_idx" ON "public"."SearchDocument"("organizationId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Tag_organizationId_name_key" ON "public"."Tag"("organizationId" ASC, "name" ASC);

-- CreateIndex
CREATE INDEX "Tracker_organizationId_idx" ON "public"."Tracker"("organizationId" ASC);

-- CreateIndex
CREATE INDEX "TrackerHit_conversationId_idx" ON "public"."TrackerHit"("conversationId" ASC);

-- CreateIndex
CREATE INDEX "TrackerHit_organizationId_trackerId_idx" ON "public"."TrackerHit"("organizationId" ASC, "trackerId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Transcript_conversationId_key" ON "public"."Transcript"("conversationId" ASC);

-- CreateIndex
CREATE INDEX "TranscriptSegment_transcriptId_startTime_idx" ON "public"."TranscriptSegment"("transcriptId" ASC, "startTime" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email" ASC);

-- AddForeignKey
ALTER TABLE "public"."ActionItem" ADD CONSTRAINT "ActionItem_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "public"."Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AgentSession" ADD CONSTRAINT "AgentSession_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "public"."Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AgentSession" ADD CONSTRAINT "AgentSession_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."ConversationSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Conversation" ADD CONSTRAINT "Conversation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Conversation" ADD CONSTRAINT "Conversation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Conversation" ADD CONSTRAINT "Conversation_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."ConversationTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ConversationEvent" ADD CONSTRAINT "ConversationEvent_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "public"."Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ConversationInsight" ADD CONSTRAINT "ConversationInsight_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "public"."Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ConversationObjective" ADD CONSTRAINT "ConversationObjective_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "public"."Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "public"."Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ConversationParticipant" ADD CONSTRAINT "ConversationParticipant_personId_fkey" FOREIGN KEY ("personId") REFERENCES "public"."Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ConversationQuestion" ADD CONSTRAINT "ConversationQuestion_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "public"."Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ConversationSession" ADD CONSTRAINT "ConversationSession_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "public"."Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ConversationTag" ADD CONSTRAINT "ConversationTag_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "public"."Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ConversationTag" ADD CONSTRAINT "ConversationTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "public"."Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ConversationTemplate" ADD CONSTRAINT "ConversationTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ConversationTopic" ADD CONSTRAINT "ConversationTopic_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "public"."Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrganizationInvite" ADD CONSTRAINT "OrganizationInvite_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrganizationInvite" ADD CONSTRAINT "OrganizationInvite_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."OrganizationMember" ADD CONSTRAINT "OrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Person" ADD CONSTRAINT "Person_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Recording" ADD CONSTRAINT "Recording_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "public"."Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Report" ADD CONSTRAINT "Report_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "public"."Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReportSection" ADD CONSTRAINT "ReportSection_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "public"."Report"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."RubricCriterion" ADD CONSTRAINT "RubricCriterion_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "public"."Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ScorecardRating" ADD CONSTRAINT "ScorecardRating_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "public"."Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ScorecardRating" ADD CONSTRAINT "ScorecardRating_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "public"."RubricCriterion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SearchDocument" ADD CONSTRAINT "SearchDocument_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "public"."Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SearchDocument" ADD CONSTRAINT "SearchDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Tag" ADD CONSTRAINT "Tag_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Tracker" ADD CONSTRAINT "Tracker_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "public"."Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TrackerHit" ADD CONSTRAINT "TrackerHit_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "public"."Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TrackerHit" ADD CONSTRAINT "TrackerHit_trackerId_fkey" FOREIGN KEY ("trackerId") REFERENCES "public"."Tracker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Transcript" ADD CONSTRAINT "Transcript_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "public"."Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TranscriptSegment" ADD CONSTRAINT "TranscriptSegment_transcriptId_fkey" FOREIGN KEY ("transcriptId") REFERENCES "public"."Transcript"("id") ON DELETE CASCADE ON UPDATE CASCADE;

