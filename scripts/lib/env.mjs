import fs from "node:fs";

export function loadDotEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    if (Object.prototype.hasOwnProperty.call(process.env, key)) {
      continue;
    }

    process.env[key] = stripQuotes(rawValue.trim());
  }
}

export function envFlag(name) {
  const value = process.env[name];
  return value === "1" || value === "true" || value === "yes";
}

export function allowsPaidApi() {
  return envFlag("PAPERCLIPALYPSE_ALLOW_PAID_API");
}

export function configuredModel(contestant) {
  return process.env[contestant.modelEnv] || contestant.defaultModel;
}

function stripQuotes(value) {
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
