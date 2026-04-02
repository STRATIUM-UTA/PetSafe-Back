export const normalizeDocumentId = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.replace(/\D/g, '').trim();
  return normalized.length > 0 ? normalized : null;
};

export const isValidEcuadorianCedula = (value: string): boolean => {
  const cedula = normalizeDocumentId(value);

  if (!cedula || !/^\d{10}$/.test(cedula)) {
    return false;
  }

  const provinceCode = Number(cedula.slice(0, 2));
  const thirdDigit = Number(cedula[2]);

  if (provinceCode < 1 || provinceCode > 24) {
    return false;
  }

  if (thirdDigit < 0 || thirdDigit > 5) {
    return false;
  }

  const digits = cedula.split('').map(Number);
  const verifierDigit = digits[9];

  const total = digits
    .slice(0, 9)
    .reduce((sum, digit, index) => {
      if (index % 2 === 0) {
        const doubled = digit * 2;
        return sum + (doubled > 9 ? doubled - 9 : doubled);
      }

      return sum + digit;
    }, 0);

  const nextTen = Math.ceil(total / 10) * 10;
  const expectedVerifier = (nextTen - total) % 10;

  return verifierDigit === expectedVerifier;
};
