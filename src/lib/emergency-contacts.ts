import AsyncStorage from '@react-native-async-storage/async-storage';

export type EmergencyContact = {
  id: string;
  name: string;
  phone: string;
  relationship: string;
};

export const MAX_EMERGENCY_CONTACTS = 5;

export function getLegacyEmergencyContactsKey(userId: string) {
  return `@bathoalert/emergency-contacts:${userId}`;
}

export async function getLegacyEmergencyContacts(userId: string) {
  const storedContacts = await AsyncStorage.getItem(getLegacyEmergencyContactsKey(userId));
  const parsedContacts: unknown = storedContacts ? JSON.parse(storedContacts) : [];

  if (
    !Array.isArray(parsedContacts) ||
    !parsedContacts.every(
      (contact) =>
        contact !== null &&
        typeof contact === 'object' &&
        typeof contact.name === 'string' &&
        typeof contact.phone === 'string' &&
        typeof contact.relationship === 'string',
    )
  ) {
    throw new Error('Saved emergency contacts could not be read.');
  }

  const uniqueContacts = new Map<string, Omit<EmergencyContact, 'id'>>();
  for (const { name, phone, relationship } of parsedContacts) {
    const normalizedPhone = normalizePhoneNumber(phone) ?? phone.trim();
    if (!uniqueContacts.has(normalizedPhone)) {
      uniqueContacts.set(normalizedPhone, {
        name,
        phone: normalizedPhone,
        relationship,
      });
    }
  }
  return [...uniqueContacts.values()];
}

export function normalizePhoneNumber(phone: string) {
  const normalized = phone.trim().replace(/[\s().-]/g, '');
  return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : null;
}
