export const COUNTRIES = [
  { code: '+27', name: 'South Africa', flag: '🇿🇦' },
  { code: '+1', name: 'USA/Canada', flag: '🇺🇸' },
  { code: '+44', name: 'UK', flag: '🇬🇧' },
  { code: '+263', name: 'Zimbabwe', flag: '🇿🇼' },
  { code: '+267', name: 'Botswana', flag: '🇧🇼' },
  { code: '+264', name: 'Namibia', flag: '🇳🇦' },
  { code: '+258', name: 'Mozambique', flag: '🇲🇿' },
];

// This function converts "0621234567" to "+27621234567"
export function formatToE164(countryCode: string, localNumber: string) {
  let cleanNumber = localNumber.replace(/\D/g, ''); // Remove spaces, dashes, etc.
  
  // If they typed a leading 0, remove it
  if (cleanNumber.startsWith('0')) {
    cleanNumber = cleanNumber.substring(1);
  }
  
  return `${countryCode}${cleanNumber}`;
}