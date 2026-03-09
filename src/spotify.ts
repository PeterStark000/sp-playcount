import base32Encode from "base32-encode";
import GQLQuery, { JSONRecord } from "./query";
import { TOTP } from "totp-generator";
import type { KVNamespace } from "@cloudflare/workers-types";

const SPOTIFY_WEB_URL = "https://open.spotify.com"
const SPOTIFY_APP_VERSION = "1.2.68.438.ga33faf54" // This should probably be scraped from the web player
const USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36"
const SPOTIFY_PARTNER_URL = "https://api-partner.spotify.com";

interface TokenResponse {
  clientId: string;
  accessToken: string;
  accessTokenExpirationTimestampMs: number;
  isAnonymous: boolean;
  _notes: string;
  totpVerExpired: string;
  totpValidUntil: string;
};

interface SpotifySecret {
  version: number;
  secret: number[];
};

const SECRETS_URL = "https://raw.githubusercontent.com/xyloflake/spot-secrets-go/refs/heads/main/secrets/secretDict.json";

async function refreshToken(): Promise<TokenResponse> {
  const secretsRes = await fetch(SECRETS_URL);
  const secrets = await secretsRes.json<Record<string, number[]>>();
  const versions = Object.keys(secrets).map(v => parseInt(v));
  const latestVersion = Math.max(...versions);
  const secretInfo = { version: latestVersion, secret: secrets[latestVersion.toString()] };

  const processedCipher = secretInfo.secret.map((c, i) => (c ^ (i % 33 + 9)).toString()).join("")
  const cipherBytes = Uint8Array.from(processedCipher.split("").map(c => c.charCodeAt(0)))
  const secret = base32Encode(cipherBytes, "RFC4648", { padding: false });
  const { otp } = TOTP.generate(secret);

  const url = new URL("/api/token", SPOTIFY_WEB_URL);
  url.searchParams.set("reason", "init");
  url.searchParams.set("productType", "web-player");
  url.searchParams.set("totp", otp);
  url.searchParams.set("totpVer", secretInfo.version.toString());

  const response = await fetch(url, { method: "GET" });
  return response.json()
}

async function getToken(): Promise<string> {
  const res = await refreshToken();
  if (res.accessToken === undefined) {
    throw new Error("Failed to refresh access token");
  }
  return res.accessToken;
}

export async function spotifyRequest(query: GQLQuery): Promise<JSONRecord> {
  const token = await getToken();

  const url = new URL("/pathfinder/v1/query", SPOTIFY_PARTNER_URL);
  url.searchParams.set("operationName", query.name);
  url.searchParams.set("variables", JSON.stringify(query.variables));
  url.searchParams.set("extensions", JSON.stringify(await query.getExtensions()));

  const headers = {
    "accept": "application/json",
    "app-platform": "WebPlayer",
    "content-type": "application/json",
    "origin": SPOTIFY_WEB_URL,
    "referer": SPOTIFY_WEB_URL + "/",
    "spotify-app-version": SPOTIFY_APP_VERSION,
    "user-agent": USER_AGENT,
    "authorization": "Bearer " + token
  };

  const body = {
    operationName: query.name,
    variables: query.variables,
    extensions: await query.getExtensions(),
    query: query.query
  };

  const response = await fetch(url.toString(), { 
    method: "POST", 
    headers: headers,
    body: JSON.stringify(body)
  });
  
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
  
  return await response.json()
}