// ─── Field mapping helpers ────────────────────────────────────────────────────
// API returns snake_case; UI uses camelCase.
// Generic approach for consistent conversion.

const FIELD_MAP = {
  map_x: "mapX",
  map_y: "mapY",
  rtsp_port: "rtspPort",
  api_port: "apiPort",
  api_username: "apiUsername",
  api_password: "apiPassword",
};

const REVERSE_MAP = Object.fromEntries(
  Object.entries(FIELD_MAP).map(([k, v]) => [v, k])
);

/**
 * Normalize API response (snake_case → camelCase) with defaults.
 */
export const normalize = (cam) => {
  const result = { ...cam };
  for (const [snake, camel] of Object.entries(FIELD_MAP)) {
    result[camel] = cam[snake] ?? cam[camel] ?? getDefault(camel);
  }
  return result;
};

/**
 * Serialize UI state (camelCase → snake_case) for API requests.
 */
export const serialize = (cam) => {
  const result = {};
  // Direct fields (already snake_case or no mapping needed)
  const directFields = ["name", "ip", "path", "protocol", "room", "enabled"];
  for (const field of directFields) {
    if (cam[field] !== undefined) result[field] = cam[field];
  }
  // Port with default
  result.port = cam.port ?? 8889;
  // Mapped fields
  for (const [camel, snake] of Object.entries(REVERSE_MAP)) {
    result[snake] = cam[camel] ?? cam[snake] ?? getDefault(camel);
  }
  return result;
};

function getDefault(camelField) {
  const defaults = {
    mapX: 50, mapY: 50,
    rtspPort: 8554, apiPort: 9997,
    apiUsername: "", apiPassword: "",
  };
  return defaults[camelField];
}
