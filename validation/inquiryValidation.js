const fieldLimits = {
  fullName: 150,
  country: 100,
  mobileNumber: 30,
  email: 255,
  treatment: 150,
  preferredDestination: 150,
  message: 5000,
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const mobilePattern = /^[0-9+()\-\s]{7,30}$/;

export function validateInquiry(body) {
  const errors = {};
  const cleaned = {};

  for (const [field, maxLength] of Object.entries(fieldLimits)) {
    const value = body[field];

    if (typeof value !== "string" || value.trim() === "") {
      errors[field] = `${field} is required`;
      continue;
    }

    cleaned[field] = value.trim();

    if (cleaned[field].length > maxLength) {
      errors[field] = `${field} must not exceed ${maxLength} characters`;
    }
  }

  if (cleaned.email && !emailPattern.test(cleaned.email)) {
    errors.email = "email must be a valid email address";
  }

  if (cleaned.mobileNumber && !mobilePattern.test(cleaned.mobileNumber)) {
    errors.mobileNumber = "mobileNumber must be a valid phone number";
  }

  if (cleaned.email) {
    cleaned.email = cleaned.email.toLowerCase();
  }

  return { errors, cleaned };
}
