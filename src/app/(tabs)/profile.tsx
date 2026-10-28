import { useRouter } from 'expo-router';
import { LogOut, Plus, ShieldCheck, Trash2, UserRound, Users, X } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { ScreenBackButton } from '../../components/screen-back-button';
import { Colors } from '../../constants/colors';
import { COUNTRIES, formatToE164 } from '../../constants/countries';
import { supabase } from '../../lib/supabase';


// Define the type locally so we don't need the helper file
type EmergencyContact = {
  id: string;
  name: string;
  phone: string;
  relationship?: string;
};

// Helper to format phone numbers
function normalizePhoneNumber(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7) return null;
  return phone.trim(); 
}

export default function ProfileScreen() {
  const router = useRouter();
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isAddingContact, setIsAddingContact] = useState(false);
  
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0]); // Defaults to South Africa
  const [isCountryModalOpen, setIsCountryModalOpen] = useState(false);

  const [relationship, setRelationship] = useState('');

  const MAX_EMERGENCY_CONTACTS = 5;

  useEffect(() => {
    let isActive = true;

    async function loadContacts() {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (!session?.user) {
          router.replace('/auth');
          return;
        }

        // FETCH FROM SUPABASE (using correct column names)
        const { data: savedContacts, error: contactsError } = await supabase
          .from('emergency_contacts')
          .select('id, contact_name, contact_phone')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: true });

        if (contactsError) throw contactsError;

        // Map Supabase columns back to our local UI variables
        const mappedContacts = (savedContacts || []).map((c) => ({
          id: c.id,
          name: c.contact_name,
          phone: c.contact_phone,
        }));

        if (isActive) {
          setUserId(session.user.id);
          setContacts(mappedContacts);
        }
      } catch (error) {
        console.error('Failed to load emergency contacts:', error);
        Alert.alert('Unable to load contacts', 'Please try again.');
      } finally {
        if (isActive) setIsLoading(false);
      }
    }

    void loadContacts();

    return () => {
      isActive = false;
    };
  }, [router]);

  async function handleAddContact() {
    const trimmedName = name.trim();
    const formattedPhone = formatToE164(selectedCountry.code, phone);
    const normalizedPhone = normalizePhoneNumber(formattedPhone);

    if (!trimmedName || !phone.trim()) {
      Alert.alert('Missing details', 'Enter a valid name and phone number.');
      return;
    }

    if (!normalizedPhone) {
      Alert.alert('Invalid phone number', 'Enter a valid phone number.');
      return;
    }

    if (contacts.length >= MAX_EMERGENCY_CONTACTS) {
      Alert.alert('Limit reached', `You can add up to ${MAX_EMERGENCY_CONTACTS} contacts.`);
      return;
    }

    if (!userId) return;
    setIsSaving(true);

    try {
      const { data, error } = await supabase
        .from('emergency_contacts')
        .insert({
          user_id: userId,
          contact_name: trimmedName,
          contact_phone: formattedPhone,
        })
        .select('id, contact_name, contact_phone')
        .single();

      if (error) throw error;

      setContacts((prev) => [...prev, {
        id: data.id,
        name: data.contact_name,
        phone: data.contact_phone,
        relationship: relationship.trim()
      }]);

      setName('');
      setPhone('');
      setRelationship('');
      setIsAddingContact(false);
    } catch (error) {
      console.error('Failed to save contact:', error);
      Alert.alert('Error', 'Could not save the contact. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  function handleDeleteContact(contact: EmergencyContact) {
    // Cross-platform confirmation
    if (Platform.OS === 'web') {
      const confirmDelete = window.confirm(`Are you sure you want to remove ${contact.name}?`);
      if (confirmDelete) {
        performDelete(contact);
      }
    } else {
      Alert.alert(
        'Remove contact?',
        `${contact.name} will be removed.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Remove',
            style: 'destructive',
            onPress: () => performDelete(contact),
          },
        ]
      );
    }
  }

async function performDelete(contact: EmergencyContact) {
    if (!userId) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('emergency_contacts')
        .delete()
        .eq('id', contact.id)
        .eq('user_id', userId);

      if (error) throw error;
      
      // Update UI instantly
      setContacts((prev) => prev.filter((c) => c.id !== contact.id));
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Could not remove contact.');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleLogout() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.replace('/auth');
    } catch (error) {
      Alert.alert('Unable to log out', 'Please try again.');
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.headerTitle}>
            <ScreenBackButton />
            <View>
              <Text style={styles.eyebrow}>YOUR ACCOUNT</Text>
              <Text style={styles.title}>Profile</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <LogOut color={Colors.textMuted} size={18} />
            <Text style={styles.logoutText}>Log out</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.introCard}>
          <View style={styles.introIcon}>
            <ShieldCheck color={Colors.primary} size={24} />
          </View>
          <View style={styles.introCopy}>
            <Text style={styles.introTitle}>People who have your back</Text>
            <Text style={styles.introText}>
              Keep trusted people close by adding their contact details here.
            </Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionTitle}>Emergency contacts</Text>
            <Text style={styles.sectionSubtitle}>
              {contacts.length === 1 ? '1 trusted contact' : `${contacts.length} trusted contacts`}
            </Text>
          </View>
          {!isAddingContact && contacts.length < MAX_EMERGENCY_CONTACTS && (
            <TouchableOpacity style={styles.addButton} onPress={() => setIsAddingContact(true)}>
              <Plus color={Colors.text} size={18} />
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          )}
        </View>

        {isAddingContact && (
          <View style={styles.formCard}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>New contact</Text>
              <TouchableOpacity onPress={() => setIsAddingContact(false)} disabled={isSaving} hitSlop={8}>
                <X color={Colors.textMuted} size={22} />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Full names</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Sam Mokoena"
              placeholderTextColor={Colors.textMuted}
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />

            <Text style={styles.inputLabel}>Phone number</Text>
            <View style={{ flexDirection: 'row', marginBottom: 16, gap: 10 }}>
              <TouchableOpacity
                style={[
                  styles.input,
                  {
                    width: 100,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 0,
                  },
                ]}
                onPress={() => setIsCountryModalOpen(true)}
                accessibilityRole="button"
                accessibilityLabel={`Select country, currently ${selectedCountry.name}`}
              >
                <Text style={{ color: Colors.text }}>
                  {selectedCountry.flag} {selectedCountry.code}
                </Text>
                <Text style={{ color: Colors.textMuted, fontSize: 10 }}>▼</Text>
              </TouchableOpacity>

              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder="e.g. 0621234567"
                placeholderTextColor={Colors.textMuted}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>

            <Modal
              visible={isCountryModalOpen}
              transparent
              animationType="slide"
              onRequestClose={() => setIsCountryModalOpen(false)}
            >
              <View
                style={{
                  flex: 1,
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  justifyContent: 'center',
                  padding: 20,
                }}
              >
                <View style={{ backgroundColor: Colors.card, borderRadius: 12, padding: 20 }}>
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: Colors.text, marginBottom: 15 }}>
                    Select Country
                  </Text>
                  {COUNTRIES.map((country) => (
                    <TouchableOpacity
                      key={country.code}
                      style={{
                        paddingVertical: 12,
                        borderBottomWidth: 1,
                        borderBottomColor: Colors.border,
                        flexDirection: 'row',
                        alignItems: 'center',
                      }}
                      onPress={() => {
                        setSelectedCountry(country);
                        setIsCountryModalOpen(false);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`${country.name}, ${country.code}`}
                    >
                      <Text style={{ fontSize: 20, marginRight: 10 }}>{country.flag}</Text>
                      <Text style={{ fontSize: 16, color: Colors.text, flex: 1 }}>
                        {country.name}
                      </Text>
                      <Text style={{ fontSize: 16, color: Colors.textMuted }}>{country.code}</Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={{ marginTop: 15, alignItems: 'center' }}
                    onPress={() => setIsCountryModalOpen(false)}
                  >
                    <Text style={{ color: Colors.primary, fontWeight: 'bold' }}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>

            <Text style={styles.inputLabel}>Relationship <Text style={styles.optionalText}>OPTIONAL</Text></Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. Family, friend"
              placeholderTextColor={Colors.textMuted}
              value={relationship}
              onChangeText={setRelationship}
            />

            <TouchableOpacity
              style={[styles.saveButton, isSaving && styles.disabledButton]}
              onPress={() => void handleAddContact()}
              disabled={isSaving}
            >
              {isSaving ? <ActivityIndicator color={Colors.text} /> : <Text style={styles.saveButtonText}>Save contact</Text>}
            </TouchableOpacity>
          </View>
        )}

        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={Colors.primary} />
            <Text style={styles.loadingText}>Loading your contacts…</Text>
          </View>
        ) : contacts.length === 0 && !isAddingContact ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Users color={Colors.textMuted} size={26} />
            </View>
            <Text style={styles.emptyTitle}>No contacts added yet</Text>
            <Text style={styles.emptyText}>
              Add someone you trust so their details are easy to find when you need them.
            </Text>
            <TouchableOpacity style={styles.emptyAddButton} onPress={() => setIsAddingContact(true)}>
              <Plus color={Colors.primary} size={18} />
              <Text style={styles.emptyAddButtonText}>Add your first contact</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.contactList}>
            {contacts.map((contact) => (
              <View key={contact.id} style={styles.contactCard}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {contact.name.trim().charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.contactDetails}>
                  <Text style={styles.contactName}>{contact.name}</Text>
                  <Text style={styles.contactPhone}>{contact.phone}</Text>
                  {!!contact.relationship && (
                    <Text style={styles.relationship}>{contact.relationship}</Text>
                  )}
                </View>
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => handleDeleteContact(contact)}
                  disabled={isSaving}
                  hitSlop={8}
                >
                  <Trash2 color={Colors.textMuted} size={19} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {!isLoading && contacts.length > 0 && (
          <View style={styles.privacyNote}>
            <UserRound color={Colors.textMuted} size={16} />
            <Text style={styles.privacyText}>Contacts are private to your account and used for emergency alerts.</Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 8 },
  headerTitle: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  eyebrow: { color: Colors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 1.3, marginBottom: 5 },
  title: { color: Colors.text, fontSize: 30, fontWeight: 'bold' },
  logoutButton: { flexDirection: 'row', alignItems: 'center', gap: 7, padding: 10, borderRadius: 12, backgroundColor: Colors.card },
  logoutText: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
  introCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: 18, padding: 17, marginBottom: 30 },
  introIcon: { height: 46, width: 46, borderRadius: 14, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  introCopy: { flex: 1 },
  introTitle: { color: Colors.text, fontSize: 15, fontWeight: '700', marginBottom: 4 },
  introText: { color: Colors.textMuted, fontSize: 13, lineHeight: 19 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { color: Colors.text, fontSize: 20, fontWeight: 'bold', marginBottom: 4 },
  sectionSubtitle: { color: Colors.textMuted, fontSize: 13 },
  addButton: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.primary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  addButtonText: { color: Colors.text, fontSize: 14, fontWeight: '700' },
  formCard: { backgroundColor: Colors.card, padding: 18, borderRadius: 18, marginBottom: 18 },
  formHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  formTitle: { color: Colors.text, fontSize: 18, fontWeight: 'bold' },
  inputLabel: { color: Colors.text, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  optionalText: { color: Colors.textMuted, fontSize: 10, letterSpacing: 0.7 },
  input: { backgroundColor: Colors.background, color: Colors.text, paddingHorizontal: 14, paddingVertical: 13, borderRadius: 12, fontSize: 15, marginBottom: 16 },
  saveButton: { backgroundColor: Colors.primary, paddingVertical: 15, borderRadius: 12, alignItems: 'center', marginTop: 2 },
  disabledButton: { opacity: 0.7 },
  saveButtonText: { color: Colors.text, fontSize: 15, fontWeight: 'bold' },
  loading: { alignItems: 'center', paddingVertical: 36, gap: 12 },
  loadingText: { color: Colors.textMuted, fontSize: 14 },
  emptyCard: { alignItems: 'center', backgroundColor: Colors.card, padding: 25, borderRadius: 18 },
  emptyIcon: { height: 52, width: 52, borderRadius: 16, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', marginBottom: 15 },
  emptyTitle: { color: Colors.text, fontSize: 16, fontWeight: '700', marginBottom: 7 },
  emptyText: { color: Colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center', marginBottom: 19 },
  emptyAddButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 },
  emptyAddButtonText: { color: Colors.primary, fontWeight: '700', fontSize: 14 },
  contactList: { gap: 12 },
  contactCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, padding: 15, borderRadius: 16 },
  avatar: { width: 46, height: 46, borderRadius: 15, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', marginRight: 13 },
  avatarText: { color: Colors.primary, fontSize: 20, fontWeight: 'bold' },
  contactDetails: { flex: 1 },
  contactName: { color: Colors.text, fontSize: 15, fontWeight: '700', marginBottom: 3 },
  contactPhone: { color: Colors.textMuted, fontSize: 14 },
  relationship: { color: Colors.textMuted, fontSize: 12, marginTop: 4 },
  removeButton: { padding: 8, marginLeft: 8 },
  privacyNote: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 18 },
  privacyText: { color: Colors.textMuted, fontSize: 11 },
});