const http = require("http");
const fs = require("fs");
const path = require("path");
const { parseOffer } = require("./lib/parseOffer");
const { generateBrief } = require("./lib/generateBrief");
const { getStockData } = require("./lib/getStockData");

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 3000);

loadEnvFile(path.join(ROOT, ".env"));

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".jsx": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url === "/api/parse-offer") {
      await handleParseOffer(req, res);
      return;
    }

    if (req.method === "POST" && req.url === "/api/offer-brief") {
      await handleOfferBrief(req, res);
      return;
    }

    if (req.method === "GET" && req.url.startsWith("/api/stock")) {
      await handleStock(req, res);
      return;
    }

    if (req.method !== "GET" && req.method !== "HEAD") {
      sendJson(res, 405, { error: "Method not allowed" });
      return;
    }

    serveStatic(req, res);
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Internal server error" });
  }
});

server.listen(PORT, () => {
  console.log(`Total Comp Decoder running at http://localhost:${PORT}/Decoded%20Offer%20Dashboard.html`);
});

async function handleParseOffer(req, res) {
  if (!process.env.ANTHROPIC_API_KEY) {
    sendJson(res, 500, { error: "ANTHROPIC_API_KEY is missing. Add it to .env and restart npm start." });
    return;
  }

  const body = await readJsonBody(req);
  const offer = await parseOffer(body.offerText);
  sendJson(res, 200, { offer });
}

async function handleOfferBrief(req, res) {
  if (!process.env.ANTHROPIC_API_KEY) {
    sendJson(res, 500, { error: "ANTHROPIC_API_KEY is missing. Add it to .env and restart npm start." });
    return;
  }

  const body = await readJsonBody(req);
  if (!body.offer || typeof body.offer !== "object") {
    sendJson(res, 400, { error: "Request body must include a parsed { offer } object." });
    return;
  }
  const brief = await generateBrief(body.offer);
  sendJson(res, 200, { brief });
}

async function handleStock(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const ticker = url.searchParams.get("ticker") || "";
  const points = await getStockData(ticker);
  sendJson(res, 200, { points });
}

function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);
  const requestedPath = pathname === "/" ? "/Decoded Offer Dashboard.html" : pathname;
  const filePath = path.normalize(path.join(ROOT, requestedPath));

  if (!filePath.startsWith(ROOT)) {
    sendJson(res, 403, { error: "Forbidden" });
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendJson(res, error.code === "ENOENT" ? 404 : 500, { error: "File not found" });
      return;
    }

    res.writeHead(200, {
      "content-type": MIME_TYPES[path.extname(filePath)] || "application/octet-stream",
    });
    res.end(content);
  });
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        req.destroy(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        reject(new Error("Invalid JSON request body"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
