import * as Location from 'expo-location';
import { Send, Shield, UserCheck, Users } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/colors';
import { supabase } from '../lib/supabase';

export default function NetworkScreen() {
  const [myContacts, setMyContacts] = useState<any[]>([]);
  const [watchers, setWatchers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingTo, setSendingTo] = useState<string | null>(null);

  useEffect(() => {
    fetchNetwork();
  }, []);

  async function fetchNetwork() {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data: myProfile } = await supabase
        .from('profiles')
        .select('phone_number, first_name, last_name')
        .eq('id', session.user.id)
        .maybeSingle();

      const { data: contacts } = await supabase
        .from('emergency_contacts')
        .select('*')
        .eq('user_id', session.user.id);
        
      if (contacts) setMyContacts(contacts);

      if (myProfile?.phone_number) {
        const { data: watchersData } = await supabase
          .from('emergency_contacts')
          .select(`
            id,
            contact_name,
            profiles:user_id (first_name, last_name, phone_number)
          `)
          .eq('contact_phone', myProfile.phone_number);

        if (watchersData) {
          const formattedWatchers = watchersData.map((w: any) => ({
            id: w.id,
            watcher_name: w.profiles?.first_name ? `${w.profiles.first_name} ${w.profiles.last_name}` : w.contact_name,
            watcher_phone: w.profiles?.phone_number || 'Unknown'
          }));
          setWatchers(formattedWatchers);
        }
      }
    } catch (error) {
      console.error("Network fetch error:", error);
    } finally {
      setLoading(false);
    }
  }

  async function sendManualAlert(contact: any, myName: string) {
    Alert.alert(
      'Send Alert?',
      `Are you sure you want to send an emergency alert to ${contact.contact_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          style: 'destructive',
          onPress: async () => {
            setSendingTo(contact.id);
            try {
              let lat = null, lng = null;
              const { status } = await Location.requestForegroundPermissionsAsync();
              if (status === 'granted') {
                const loc = await Location.getCurrentPositionAsync({});
                lat = loc.coords.latitude;
                lng = loc.coords.longitude;
              }

              const { data: report } = await supabase.from('emergency_reports').insert([{
                user_id: (await supabase.auth.getUser()).data.user?.id,
                incident_type: 'manual',
                description: 'Manual alert sent from Network page.',
                latitude: lat,
                longitude: lng,
                risk_level: 'High',
                ai_summary: 'User manually triggered an alert.',
                status: 'Active'
              }]).select().single();

              const mapLink = lat && lng ? `https://maps.google.com/?q=${lat},${lng}` : 'Location unavailable';
              const smsText = `EMERGENCY: ${myName} has sent you a manual alert and needs help. Location: ${mapLink}`;
              
              await supabase.functions.invoke('send-emergency-sms', {
                body: { to: contact.contact_phone, message: smsText }
              });

              if (report) {
                await supabase.from('alerts_log').insert([{
                  report_id: report.id,
                  recipient_phone: contact.contact_phone,
                  status: 'Sent'
                }]);
              }

              Alert.alert('Success', `Alert sent to ${contact.contact_name}!`);
            } catch (error: any) {
              Alert.alert('Error', 'Could not send alert: ' + error.message);
            } finally {
              setSendingTo(null);
            }
          }
        }
      ]
    );
  }

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      
      <View style={styles.headerRow}>
        <Users color={Colors.primary} size={28} />
        <Text style={styles.sectionTitle}>My Contacts</Text>
      </View>
      <Text style={styles.subtitle}>Send a targeted alert to a specific person.</Text>

      {myContacts.length === 0 ? (
        <Text style={styles.emptyText}>You haven't added any contacts yet.</Text>
      ) : (
        myContacts.map((contact) => (
          <View key={contact.id} style={styles.card}>
            <View style={styles.cardInfo}>
              <Text style={styles.name}>{contact.contact_name}</Text>
              <Text style={styles.phone}>{contact.contact_phone}</Text>
            </View>
            <TouchableOpacity style={styles.sendBtn} onPress={() => sendManualAlert(contact, 'A Batho Alert User')} disabled={sendingTo === contact.id}>
              {sendingTo === contact.id ? <ActivityIndicator size="small" color="#FFF" /> : <><Send color="#FFF" size={16} /><Text style={styles.sendBtnText}>Alert</Text></>}
            </TouchableOpacity>
          </View>
        ))
      )}

      <View style={styles.divider} />

      <View style={styles.headerRow}>
        <Shield color={Colors.success} size={28} />
        <Text style={styles.sectionTitle}>Watching Over Me</Text>
      </View>
      <Text style={styles.subtitle}>People who have saved your number and will be alerted if you trigger an SOS.</Text>

      {watchers.length === 0 ? (
        <Text style={styles.emptyText}>No one has added you as an emergency contact yet.</Text>
      ) : (
        watchers.map((watcher) => (
          <View key={watcher.id} style={[styles.card, { borderLeftColor: Colors.success, borderLeftWidth: 4 }]}>
            <View style={styles.cardInfo}>
              <Text style={styles.name}>{watcher.watcher_name}</Text>
              <Text style={styles.phone}>{watcher.watcher_phone}</Text>
            </View>
            <UserCheck color={Colors.success} size={24} />
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingBottom: 100 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 5, marginTop: 10 },
  sectionTitle: { fontSize: 22, fontWeight: 'bold', color: Colors.text },
  subtitle: { fontSize: 14, color: Colors.textMuted, marginBottom: 15 },
  card: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
  cardInfo: { flex: 1 },
  name: { fontSize: 16, fontWeight: 'bold', color: Colors.text },
  phone: { fontSize: 14, color: Colors.textMuted, marginTop: 2 },
  sendBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: Colors.primary, paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8 },
  sendBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 25 },
  emptyText: { color: Colors.textMuted, fontStyle: 'italic', marginBottom: 15 }
});