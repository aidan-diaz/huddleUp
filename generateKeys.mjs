import { exportJWK, exportPKCS8, generateKeyPair } from "jose";

const keys = await generateKeyPair("RS256", { extractable: true });
const privateKey = await exportPKCS8(keys.privateKey);
const publicKey = await exportJWK(keys.publicKey);
const jwks = JSON.stringify({ keys: [{ use: "sig", ...publicKey }] });

console.log("\n=== Copy these environment variables to your Convex dashboard ===\n");
console.log(`JWT_PRIVATE_KEY="${privateKey.trimEnd().replace(/\n/g, " ")}"`);
console.log("");
console.log(`JWKS=${jwks}`);
console.log("\n=================================================================\n");
console.log("Go to: https://dashboard.convex.dev -> Your project -> Settings -> Environment Variables");
console.log("Add both JWT_PRIVATE_KEY and JWKS variables there.\n");
