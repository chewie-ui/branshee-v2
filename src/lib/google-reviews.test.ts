import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeGoogleUrl } from "./google-reviews";

test("liens Google acceptés", () => {
  assert.equal(normalizeGoogleUrl("https://g.page/r/CabcDEF123/review"), "https://g.page/r/CabcDEF123/review");
  assert.equal(normalizeGoogleUrl("g.page/r/CabcDEF123/review"), "https://g.page/r/CabcDEF123/review");
  assert.equal(normalizeGoogleUrl("ChIJN1t_tDeuEmsRUsoyG83frY4"), "https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4");
  assert.equal(normalizeGoogleUrl("http://maps.app.goo.gl/xyz"), "https://maps.app.goo.gl/xyz");
});
test("autres liens refusés", () => {
  assert.equal(normalizeGoogleUrl("https://evil.com/g.page"), null);
  assert.equal(normalizeGoogleUrl("https://g.page.evil.com/x"), null);
  assert.equal(normalizeGoogleUrl("javascript:alert(1)"), null);
  assert.equal(normalizeGoogleUrl(""), null);
});
