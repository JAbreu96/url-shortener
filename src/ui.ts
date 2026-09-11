/**
 * Minimal no-build UI for POST /urls: one static HTML page with inline JS.
 * Served by GET / in app.ts as text/html.
 */
export const HTML = `<!doctype html>
<html>
<head><meta charset="utf-8"><title>URL Shortener</title></head>
<body>
  <h1>URL Shortener</h1>
  <form id="form">
    <div><input data-testid="long-url" id="long_url" placeholder="https://example.com" required /></div>
    <div><input data-testid="custom-alias" id="custom_alias" placeholder="custom alias (optional)" /></div>
    <div><input data-testid="expires-at" id="expires_at" type="datetime-local" /></div>
    <button data-testid="submit" type="submit">Shorten</button>
  </form>
  <p id="result-link" data-testid="result-link"></p>
  <p id="error" data-testid="error" style="color:red"></p>
  <script>
    document.getElementById("form").addEventListener("submit", async function (e) {
      e.preventDefault();
      var resultEl = document.getElementById("result-link");
      var errorEl = document.getElementById("error");
      resultEl.textContent = "";
      resultEl.innerHTML = "";
      errorEl.textContent = "";

      var longUrl = document.getElementById("long_url").value;
      var customAlias = document.getElementById("custom_alias").value;
      var expiresAt = document.getElementById("expires_at").value;

      var body = { long_url: longUrl };
      if (customAlias) body.custom_alias = customAlias;
      if (expiresAt) body.expires_at = new Date(expiresAt).toISOString();

      try {
        var res = await fetch("/urls", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        var data = await res.json();
        if (res.status === 201) {
          var a = document.createElement("a");
          a.href = data.short_url;
          a.textContent = data.short_url;
          resultEl.appendChild(a);
        } else {
          errorEl.textContent = data.error || "request failed";
        }
      } catch (err) {
        errorEl.textContent = "network error";
      }
    });
  </script>
</body>
</html>`;
