"use client";

import { useState, useTransition } from "react";
import { Flag, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { useI18n } from "@/i18n/client";
import { reportReview, requestReviewRemoval, submitReview } from "@/server/actions/reviews";

export function ReviewForm({ slug }: { slug: string }) {
  const { t, tr } = useI18n();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [pending, start] = useTransition();
  if (status?.ok) return <p className="rounded-lg bg-success-soft p-3 text-sm text-success" role="status">{status.msg}</p>;
  return (
    <form
      className="space-y-3 rounded-lg border border-border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await submitReview(slug, { rating, comment });
          setStatus(r.ok ? { ok: true, msg: r.message ? tr(r.message) : t("reviews.thanks") } : { ok: false, msg: tr(r.error) });
        });
      }}
    >
      <p className="text-sm font-medium">{t("reviews.yourReview")}</p>
      <div className="flex gap-1" role="radiogroup" aria-label={t("reviews.rating")} onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={t("reviews.stars", { n })} onMouseEnter={() => setHover(n)} onClick={() => setRating(n)} className="p-0.5 text-warning">
            <Star className={cn("size-6", n <= (hover || rating) ? "fill-current" : "opacity-30")} aria-hidden="true" />
          </button>
        ))}
      </div>
      <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} maxLength={800} placeholder={t("reviews.placeholder")} aria-label={t("reviews.comment")} />
      {status && !status.ok ? <p className="text-sm text-danger" role="alert">{status.msg}</p> : null}
      <Button type="submit" size="sm" loading={pending} disabled={!rating}>{t("reviews.publish")}</Button>
    </form>
  );
}

const REASONS = ["insulting", "false", "spam", "personal", "other"] as const;

export function ReportReviewButton({ reviewId, action = "report" }: { reviewId: string; action?: "report" | "owner" }) {
  const { t, tr } = useI18n();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);
  const [pending, start] = useTransition();
  if (status?.ok) return <p className="text-xs text-success" role="status">{status.msg}</p>;
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 text-xs text-muted hover:text-danger">
        <Flag className="size-3" aria-hidden="true" />
        {action === "owner" ? t("reviews.askRemoval") : t("reviews.report")}
      </button>
    );
  return (
    <form
      className="mt-2 space-y-2 rounded-lg border border-border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = action === "owner" ? await requestReviewRemoval(reviewId, { reason, message }) : await reportReview(reviewId, { reason, message });
          setStatus(r.ok ? { ok: true, msg: r.message ? tr(r.message) : t("reviews.sent") } : { ok: false, msg: tr(r.error) });
        });
      }}
    >
      <Select value={reason} onChange={(e) => setReason(e.target.value)} required aria-label={t("reviews.reason")}>
        <option value="">{t("reviews.reasonPlaceholder")}</option>
        {REASONS.map((r) => <option key={r} value={r}>{t(`reviews.reasons.${r}`)}</option>)}
      </Select>
      <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} maxLength={1000} placeholder={t("reviews.details")} aria-label={t("reviews.details")} />
      {status && !status.ok ? <p className="text-xs text-danger" role="alert">{status.msg}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="secondary" loading={pending}>{t("common.send")}</Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
      </div>
    </form>
  );
}
