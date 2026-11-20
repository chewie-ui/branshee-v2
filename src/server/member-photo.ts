import "server-only";
import { sql } from "drizzle-orm";
import { members } from "@/db/schema";

/**
 * Photo d'un membre : celle choisie pour l'équipe, sinon la photo de son compte (par défaut).
 * À utiliser dans un select : `photoUrl: memberPhotoSql`.
 */
export const memberPhotoSql = sql<string | null>`coalesce(${members.photoUrl}, (select u.avatar_url from users u where u.id = ${members.userId}))`;
