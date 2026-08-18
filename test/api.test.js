import test from "node:test";
import assert from "node:assert/strict";
import { request } from "../src/api.js";

test("returns parsed JSON from the BettaView API", async () => {
  const fetchImplementation = async () => new Response(JSON.stringify({ published: 2 }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
  assert.deepEqual(await request("/api/comments/batch", {}, fetchImplementation), { published: 2 });
});

test("explains an HTML API fallback instead of exposing a JSON parse error", async () => {
  const fetchImplementation = async () => new Response("<!DOCTYPE html><title>BettaView</title>", {
    status: 404,
    headers: { "content-type": "text/html" },
  });
  await assert.rejects(
    request("/api/comments/batch", {}, fetchImplementation),
    /returned a web page instead of JSON.*HTTP 404/,
  );
});

test("preserves a JSON API error message", async () => {
  const fetchImplementation = async () => new Response(JSON.stringify({ error: "Publish failed safely." }), {
    status: 409,
    headers: { "content-type": "application/json" },
  });
  await assert.rejects(request("/api/comments/batch", {}, fetchImplementation), /Publish failed safely/);
});

test("adds GitHub validation details to a generic API error", async () => {
  const fetchImplementation = async () => new Response(JSON.stringify({
    error: "Unprocessable Entity",
    details: { errors: [{ message: "Pull request authors cannot approve their own pull requests." }] },
  }), {
    status: 422,
    headers: { "content-type": "application/json" },
  });
  await assert.rejects(
    request("/api/reviews", {}, fetchImplementation),
    /Unprocessable Entity — Pull request authors cannot approve their own pull requests/,
  );
});
