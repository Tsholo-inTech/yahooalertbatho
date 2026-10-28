import { Clock, MailOpen, MapPin, ShieldAlert } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Linking, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/colors';
import { supabase } from '../lib/supabase';

export default function MessagesScreen() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userPhone, setUserPhone] = useState<string | null>(null);

  useEffect(() => {
    fetchAlerts();
  }, []);

  async function fetchAlerts() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('phone_number')
        .eq('id', session.user.id)
        .maybeSingle(); // Safe version

      if (!profile?.phone_number) {
        setUserPhone(null);
        setLoading(false);
        setRefreshing(false);
        return; 
      }
      setUserPhone(profile.phone_number);

      const { data, error } = await supabase
        .from('alerts_log')
        .select(`
          id,
          recipient_phone,
          status,
          emergency_reports:report_id (
            id,
            incident_type,
            description,
            latitude,
            longitude,
            risk_level,
            created_at,
            profiles:user_id (
              first_name,
              last_name
            )
          )
        `)
        .eq('recipient_phone', profile.phone_number)
        .order('id', { ascending: false });

      if (error) throw error;
      if (data) setAlerts(data);

    } catch (error) {
      console.error("Error fetching alerts:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function openMap(lat: number, lng: number) {
    if (!lat || !lng) return;
    Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
  }

  const renderAlert = ({ item }: { item: any }) => {
    const report = item.emergency_reports;
    const sender = report?.profiles;
    const senderName = sender ? `${sender.first_name} ${sender.last_name}` : 'Unknown User';
    const dateStr = report?.created_at ? new Date(report.created_at).toLocaleString() : 'Unknown Date';

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <ShieldAlert color={Colors.primary} size={24} />
            <Text style={styles.senderName}>Alert from {senderName}</Text>
          </View>
          <Text style={styles.statusBadge}>RECEIVED</Text>
        </View>

        <Text style={styles.emergencyType}>
          {report?.incident_type?.toUpperCase()} EMERGENCY ({report?.risk_level} RISK)
        </Text>
        <Text style={styles.description}>"{report?.description}"</Text>

        <View style={styles.metaRow}>
          <Clock size={14} color={Colors.textMuted} />
          <Text style={styles.metaText}>{dateStr}</Text>
        </View>

        {report?.latitude && report?.longitude && (
          <TouchableOpacity style={styles.locationBtn} onPress={() => openMap(report.latitude, report.longitude)}>
            <MapPin size={16} color={Colors.primary} />
            <Text style={styles.locationText}>View {senderName}'s Location</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={Colors.primary} /></View>;

  if (!userPhone) {
    return (
      <View style={styles.center}>
        <MailOpen size={60} color={Colors.textMuted} />
        <Text style={styles.emptyTitle}>No Phone Number Linked</Text>
        <Text style={styles.emptyText}>Please ensure your profile has a valid phone number to receive alerts.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={alerts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: 15, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAlerts(); }} />}
        ListEmptyComponent={
          <View style={styles.center}>
            <MailOpen size={60} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>Inbox Empty</Text>
            <Text style={styles.emptyText}>No emergency alerts have been sent to {userPhone} yet.</Text>
          </View>
        }
        renderItem={renderAlert}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, marginTop: 50 },
  card: { backgroundColor: Colors.card, padding: 18, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 5, borderLeftColor: Colors.primary },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  senderName: { fontSize: 16, fontWeight: 'bold', color: Colors.text },
  statusBadge: { fontSize: 12, fontWeight: 'bold', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: '#FEE2E2', color: Colors.primary, overflow: 'hidden' },
  emergencyType: { fontSize: 15, fontWeight: '600', color: Colors.text, marginBottom: 5 },
  description: { fontSize: 14, color: Colors.textMuted, fontStyle: 'italic', marginBottom: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 15 },
  metaText: { fontSize: 12, color: Colors.textMuted },
  locationBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FEF2F2', padding: 10, borderRadius: 8, alignSelf: 'flex-start' },
  locationText: { fontSize: 13, fontWeight: '600', color: Colors.primary },
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text, marginTop: 15 },
  emptyText: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', marginTop: 5, lineHeight: 20 },
});