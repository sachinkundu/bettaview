export async function request(path, options = {}, fetchImplementation = fetch) {
  const response = await fetchImplementation(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const text = await response.text();
  let value = null;

  if (text) {
    try {
      value = JSON.parse(text);
    } catch {
      const looksLikeHtml = /^\s*</.test(text);
      const reason = looksLikeHtml
        ? "The BettaView API returned a web page instead of JSON. Restart the BettaView server and refresh this page."
        : "The BettaView API returned an unreadable response.";
      throw new Error(`${reason} (HTTP ${response.status})`);
    }
  }

  if (!response.ok) {
    const detailMessages = Array.isArray(value?.details?.errors)
      ? value.details.errors.map((detail) => typeof detail === "string" ? detail : detail?.message).filter(Boolean)
      : [];
    const message = [value?.error, ...detailMessages]
      .filter(Boolean)
      .filter((item, index, items) => items.indexOf(item) === index)
      .join(" — ");
    throw new Error(message || `The request failed (HTTP ${response.status}).`);
  }
  return value;
}
