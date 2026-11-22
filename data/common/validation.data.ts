/**
 * Negative / boundary inputs and the validation messages observed on the shared Wakanow cart form
 * (DEVTEST, 2026-11-14). Messages are the literal role="alert" texts rendered by the application.
 */
export const invalidContactInputs = {
  emails: ['not-an-email', 'missing-at.example.com', 'user@', '@example.com'],
  /** Phone must be 9-11 digits — values just outside both boundaries plus a short value. */
  phones: { tooShort: '12345678', wayTooShort: '12', tooLong: '090909090901' },
  /** Values inside the documented boundary. */
  validPhones: { minLength: '809090909', maxLength: '09090909090' },
};

export const cartValidationMessages = {
  invalidEmail: 'Enter a valid email',
  invalidPhone: 'Phone must be 9-11 digits',
  surnameRequired: 'Surname is required',
  firstNameRequired: 'First name is required',
  passportRequired: 'Passport number is required',
} as const;
