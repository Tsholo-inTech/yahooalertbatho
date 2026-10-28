import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { AlertTriangle, ChevronRight, HeartPulse, History, LogOut, MapPin, ShieldAlert } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';

type CurrentLocation = {
  address: string | null;
  latitude: number;
  longitude: number;
  accuracy: number | null;
};

export default function Dashboard() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [latestReport, setLatestReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<CurrentLocation | null>(null);
  const [isUpdatingLocation, setIsUpdatingLocation] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [addressUnavailable, setAddressUnavailable] = useState(false);

  useEffect(() => {
        async function loadProfile() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // Fetch Profile
        const { data } = await supabase
          .from('profiles')
          .select('first_name, last_name')
          .eq('id', session.user.id)
          .single();
        
        if (data) {
          setFirstName(data.first_name || '');
          setLastName(data.last_name || '');
        }

        // Fetch Latest Report
        const { data: reportData } = await supabase
          .from('emergency_reports')
          .select('id, created_at, delivery_status, status')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (reportData) {
          setLatestReport(reportData);
        }
      }
      setLoading(false);
    }

    loadProfile();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace('/auth');
  }

  async function updateCurrentLocation() {
    setIsUpdatingLocation(true);
    setLocationError('');
    setAddressUnavailable(false);

    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setLocationError('Location access is off. Allow location access to update your position.');
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      let address: string | null = null;
      let hasStreetAddress = false;

      try {
        const [result] = await Location.reverseGeocodeAsync({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        if (result) {
          const street = [result.streetNumber, result.street].filter(Boolean).join(' ');
          hasStreetAddress = Boolean(result.street);
          address =
            [street || result.name, result.city || result.district, result.region]
              .filter(Boolean)
              .join(', ') || null;
        }
      } catch (error) {
        console.error('Could not look up the current street address:', error);
        setAddressUnavailable(true);
      }

      setCurrentLocation({
        address,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      });
      setAddressUnavailable(!hasStreetAddress);
    } catch (error) {
      console.error('Could not update the current location:', error);
      setLocationError(
        error instanceof Error
          ? `Could not get your location: ${error.message}`
          : 'Could not get your location. Check that location services are enabled and try again.',
      );
    } finally {
      setIsUpdatingLocation(false);
    }
  }

  const accuracyLabel = currentLocation?.accuracy == null
    ? 'Accuracy unavailable'
    : `Accuracy: ±${Math.round(currentLocation.accuracy)} m`;

  return (
    <View style={styles.mainContainer}>

      {/* --- MAIN CONTENT --- */}
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        
        {loading ? (
          <ActivityIndicator color={Colors.primary} size="large" style={{ marginTop: 50 }} />
        ) : (
          <Text style={styles.greeting}>
            {firstName} {lastName}, Welcome Back
          </Text>
        )}

        <View style={styles.statusCard}>
          <ShieldAlert color={Colors.primary} size={32} />
          <View style={styles.statusTextContainer}>
            <Text style={styles.statusTitle}>System Ready</Text>
            <Text style={styles.statusSubtitle}>You are protected</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Emergency Actions</Text>

        <TouchableOpacity 
          style={styles.sosButton} 
          onPress={() => router.push('/report-emergency')}
        >
          <AlertTriangle color="#FFF" size={40} />
          <Text style={styles.sosText}>REPORT EMERGENCY</Text>
        </TouchableOpacity>

        <View style={styles.row}>
          <TouchableOpacity 
            style={styles.secondaryButton} 
            onPress={() => router.push('/first-aid')} // <--- Add the navigation
        >
            <HeartPulse color={Colors.primary} size={24} />
            <Text style={styles.secondaryText}>First Aid</Text>
        </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton}>
            <ShieldAlert color={Colors.primary} size={24} />
            <Text style={styles.secondaryText}>Safe Zones</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.locationCard}>
          <View style={styles.locationHeader}>
            <View style={styles.locationIcon}>
              <MapPin color={Colors.primary} size={22} />
            </View>
            <View style={styles.locationDetails}>

        {/* --- NEW LOCATION STATUS SECTION --- */}
        <Text style={[styles.sectionTitle, { marginTop: 30 }]}>Location Status</Text>

              <Text style={styles.locationTitle}>Location status</Text>
              <Text style={styles.locationSubtitle}>
                {currentLocation ? 'Current location available' : 'Check your location availability'}
              </Text>
            </View>
          </View>

          {currentLocation && (
            <View style={styles.locationResult}>
              <Text style={styles.locationAddress}>
                {currentLocation.address ?? 'Street address unavailable'}
              </Text>
              <Text style={styles.locationMeta}>{accuracyLabel}</Text>
              <Text style={styles.locationCoordinates}>
                {currentLocation.latitude.toFixed(5)}, {currentLocation.longitude.toFixed(5)}
              </Text>
              {addressUnavailable && (
                <Text style={styles.locationWarning}>
                  Street-level address is unavailable for this location.
                </Text>
              )}
            </View>
          )}

          {!!locationError && <Text style={styles.locationWarning}>{locationError}</Text>}

          <TouchableOpacity
            style={[styles.locationButton, isUpdatingLocation && styles.disabledButton]}
            onPress={() => void updateCurrentLocation()}
            disabled={isUpdatingLocation}
            accessibilityRole="button"
          >
            {isUpdatingLocation ? (
              <ActivityIndicator color={Colors.primary} />
            ) : (
              <Text style={styles.locationButtonText}>
                {currentLocation ? 'Update location' : 'Check location'}
              </Text>
            )}

            
          </TouchableOpacity>

           {/* --- RECENT EMERGENCY ACTIVITY CARD --- */}
        <TouchableOpacity 
          style={styles.activityCard} 
          onPress={() => router.push('/(tabs)/alerts')}
          activeOpacity={0.7}
        >
          <View style={styles.activityLeft}>
            <History color={Colors.text} size={28} />
            <View style={styles.activityTextContainer}>
              <Text style={styles.activityTitle}>Recent Emergency Activity</Text>
              <Text style={styles.activitySubtitle}>
                {latestReport 
                  ? `Latest: ${new Date(latestReport.created_at).toLocaleDateString()} | Status: ${latestReport.delivery_status || 'Pending'}`
                  : 'No recent alerts'}
              </Text>
            </View>
          </View>
          <ChevronRight color={Colors.textMuted} size={24} />
        </TouchableOpacity>
        </View>



        <View style={{ height: 100 }} />
      </ScrollView>


      {/* --- FLOATING LOGOUT BUTTON --- */}
      <TouchableOpacity style={styles.floatingLogout} onPress={handleLogout}>
        <LogOut color="#FFF" size={24} />
      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1, backgroundColor: Colors.background },

  // CONTENT STYLES
  container: { flex: 1 },
  content: { padding: 20 },
  greeting: { fontSize: 22, color: Colors.text, fontWeight: '600', marginBottom: 25, marginTop: 10 },
  
  statusCard: { flexDirection: 'row', backgroundColor: Colors.card, padding: 20, borderRadius: 16, alignItems: 'center', marginBottom: 30, borderWidth: 1, borderColor: Colors.border },
  statusTextContainer: { marginLeft: 15 },
  statusTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text },
  statusSubtitle: { fontSize: 14, color: Colors.textMuted },
  
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text, marginBottom: 15 },
  
  sosButton: { 
    backgroundColor: Colors.primary, 
    padding: 30, 
    borderRadius: 20, 
    alignItems: 'center', 
    marginBottom: 20, 
    shadowColor: Colors.primary, 
    shadowOpacity: 0.3, 
    shadowRadius: 10, 
    elevation: 5 
  },
  sosText: { color: '#FFF', fontSize: 20, fontWeight: 'bold', marginTop: 10 },
  
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  secondaryButton: { 
    backgroundColor: Colors.card, 
    padding: 20, 
    borderRadius: 16, 
    alignItems: 'center', 
    flex: 0.48,
    borderWidth: 1,
    borderColor: Colors.border
  },
  secondaryText: { color: Colors.text, marginTop: 10, fontWeight: '600' },

  locationCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
    padding: 18,
    marginTop: 20,
  },
  locationHeader: { flexDirection: 'row', alignItems: 'center' },
  locationIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  locationDetails: { flex: 1 },
  locationTitle: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  locationSubtitle: { color: Colors.textMuted, fontSize: 13, marginTop: 3 },
  locationResult: { marginTop: 14 },
  locationAddress: { color: Colors.text, fontSize: 15, fontWeight: '600' },
  locationMeta: { color: Colors.textMuted, fontSize: 13, marginTop: 5 },
  locationCoordinates: { color: Colors.textMuted, fontSize: 12, marginTop: 3 },
  locationWarning: { color: Colors.warning, fontSize: 13, marginTop: 8 },
  locationButton: {
    minHeight: 44,
    marginTop: 14,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationButtonText: { color: Colors.primary, fontSize: 14, fontWeight: '700' },
  disabledButton: { opacity: 0.6 },

  floatingLogout: {
    position: 'absolute',
    bottom: 20, 
    right: 20,
    backgroundColor: Colors.text, 
    width: 55,
    height: 55,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },

    // RECENT ACTIVITY CARD STYLES
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    padding: 20,
    borderRadius: 16,
    marginTop: 25,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  activityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 15,
    flex: 1,
  },
  activityTextContainer: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  activitySubtitle: {
    fontSize: 13,
    color: Colors.textMuted,
  },
});