export function normalizeEmailAddress(value: string, label = "Email") {
  const email = value.trim().toLowerCase();

  if (!email) {
    throw new Error(`${label} is required.`);
  }

  if (email.length > 255) {
    throw new Error(`${label} must be 255 characters or fewer.`);
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error(`Enter a valid ${label.toLowerCase()}.`);
  }

  return email;
}
