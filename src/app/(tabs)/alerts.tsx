import { useRouter } from 'expo-router';
import { CheckCircle2, ChevronLeft, Clock, HeartPulse, MapPin, ShieldAlert } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';

export default function MyReportsScreen() {
  const router = useRouter();
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    fetchMyReports();
  }, []);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)'); // Fallback to Home tab if no history
    }
  };

  async function fetchMyReports() {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { data, error } = await supabase
      .from('emergency_reports')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (!error && data) setReports(data);
    setLoading(false);
  }

  async function updateSafetyStatus(reportId: string, newStatus: string) {
    setBusyId(reportId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const { error } = await supabase
        .from('emergency_reports')
        .update({ status: newStatus })
        .eq('id', reportId);

      if (error) throw error;

      await supabase.from('emergency_report_updates').insert({
        report_id: reportId,
        user_id: session?.user.id,
        update_status: newStatus === 'Resolved' ? 'I am safe' : 'Need more help'
      });

      Alert.alert('Status Updated', `Your report has been marked as: ${newStatus}`);
      fetchMyReports();
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setBusyId(null);
    }
  }

  const renderReport = ({ item }: { item: any }) => {
    const isActive = item.status === 'Active';
    const isBusy = busyId === item.id;
    const dateStr = new Date(item.created_at).toLocaleString();

    return (
      <View style={[styles.card, !isActive && styles.cardResolved]}>
        <View style={styles.cardHeader}>
          <Text style={styles.emergencyType}>{item.incident_type.toUpperCase()}</Text>
          <Text style={[styles.statusBadge, isActive ? styles.statusActive : styles.statusResolved]}>
            {item.status}
          </Text>
        </View>

        <View style={styles.metaRow}>
          <Clock size={14} color={Colors.textMuted} />
          <Text style={styles.metaText}>{dateStr}</Text>
        </View>

        {/* AI ANALYSIS SECTION */}
        <View style={styles.aiBox}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 5 }}>
            <ShieldAlert size={16} color={Colors.primary} />
            <Text style={styles.aiTitle}>AI Analysis ({item.risk_level} Risk)</Text>
          </View>
          <Text style={styles.aiAdvice}>"{item.ai_summary}"</Text>
        </View>

        <Text style={styles.description}>{item.description}</Text>

        {item.latitude && (
          <View style={styles.locationRow}>
            <MapPin size={14} color={Colors.textMuted} />
            <Text style={styles.locationText}>
              {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
            </Text>
          </View>
        )}

        {/* ACTION BUTTONS */}
        {isActive && (
          <View style={styles.actionRow}>
            <TouchableOpacity 
              style={[styles.safeBtn, isBusy && styles.disabled]} 
              onPress={() => updateSafetyStatus(item.id, 'Resolved')}
              disabled={isBusy}
            >
              <CheckCircle2 size={16} color="#FFF" />
              <Text style={styles.btnText}>I am Safe / Resolve</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.helpBtn, isBusy && styles.disabled]} 
              onPress={() => updateSafetyStatus(item.id, 'Active')}
              disabled={isBusy}
            >
              <HeartPulse size={16} color={Colors.primary} />
              <Text style={styles.helpBtnText}>Still Need Help</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* CUSTOM HEADER WITH BACK BUTTON */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <ChevronLeft color={Colors.text} size={28} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Reports</Text>
        <View style={styles.spacer} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 15, paddingBottom: 100 }}
          ListEmptyComponent={
            <View style={styles.center}>
              <ShieldAlert size={60} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No Reports Yet</Text>
              <Text style={styles.emptyText}>You haven't submitted any emergency reports.</Text>
            </View>
          }
          renderItem={renderReport}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: { padding: 5, marginLeft: -5 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text },
  spacer: { width: 28 },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30, marginTop: 50 },
  
  card: { backgroundColor: Colors.card, padding: 18, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: Colors.border, borderLeftWidth: 5, borderLeftColor: Colors.primary },
  cardResolved: { borderLeftColor: Colors.textMuted, opacity: 0.8 },
  
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  emergencyType: { fontSize: 16, fontWeight: 'bold', color: Colors.text },
  statusBadge: { fontSize: 12, fontWeight: 'bold', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, overflow: 'hidden' },
  statusActive: { backgroundColor: '#FEE2E2', color: Colors.primary },
  statusResolved: { backgroundColor: '#F3F4F6', color: Colors.textMuted },
  
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 12 },
  metaText: { fontSize: 12, color: Colors.textMuted },

  aiBox: { backgroundColor: '#FEF2F2', padding: 12, borderRadius: 8, marginBottom: 12 },
  aiTitle: { fontSize: 14, fontWeight: 'bold', color: Colors.primary },
  aiAdvice: { fontSize: 14, color: Colors.text, fontStyle: 'italic', lineHeight: 20 },

  description: { fontSize: 14, color: Colors.text, marginBottom: 10 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 15 },
  locationText: { fontSize: 12, color: Colors.textMuted },

  actionRow: { flexDirection: 'row', gap: 10, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 15, marginTop: 5 },
  safeBtn: { flex: 1, flexDirection: 'row', backgroundColor: '#10B981', paddingVertical: 10, borderRadius: 8, justifyContent: 'center', alignItems: 'center', gap: 5 },
  helpBtn: { flex: 1, flexDirection: 'row', backgroundColor: '#FFF', borderWidth: 1, borderColor: Colors.primary, paddingVertical: 10, borderRadius: 8, justifyContent: 'center', alignItems: 'center', gap: 5 },
  btnText: { color: '#FFF', fontWeight: 'bold', fontSize: 13 },
  helpBtnText: { color: Colors.primary, fontWeight: 'bold', fontSize: 13 },
  
  emptyTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text, marginTop: 15 },
  emptyText: { fontSize: 14, color: Colors.textMuted, textAlign: 'center', marginTop: 5 },
  disabled: { opacity: 0.5 }
});