import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { ChevronLeft, MapPin, Navigation, RefreshCw, ShieldCheck } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../constants/colors';
import { supabase } from '../../lib/supabase';

// Helper function to calculate distance between two coordinates in KM
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
  const d = R * c; // Distance in km
  return d.toFixed(1); // Return rounded to 1 decimal place
}

export default function LocationScreen() {
  const router = useRouter();
  
  const [locationData, setLocationData] = useState<{ lat: number, lng: number, accuracy: number } | null>(null);
  const [locationStatus, setLocationStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  
  const [safeZones, setSafeZones] = useState<any[]>([]);
  const [loadingZones, setLoadingZones] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchLocation();
    fetchSafeZones();
  }, []);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  async function fetchLocation() {
    setLocationStatus('loading');
    setErrorMsg('');
    
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationStatus('error');
        setErrorMsg('Permission denied. Please enable location services.');
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      setLocationData({
        lat: loc.coords.latitude,
        lng: loc.coords.longitude,
        accuracy: loc.coords.accuracy || 0
      });
      setLocationStatus('success');
    } catch (error) {
      setLocationStatus('error');
      setErrorMsg('Could not fetch location. Ensure GPS is turned on.');
    }
  }

  async function fetchSafeZones() {
    try {
      const { data, error } = await supabase.from('safe_zones').select('*');
      if (!error && data) {
        setSafeZones(data);
      }
    } catch (error) {
      console.log('Error fetching safe zones:', error);
    } finally {
      setLoadingZones(false);
      setRefreshing(false);
    }
  }

  function openMaps(lat: number, lng: number) {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    Linking.openURL(url);
  }

  // Sort Safe Zones by distance if we have the user's location
  const sortedZones = [...safeZones].sort((a, b) => {
    if (!locationData) return 0;
    const distA = parseFloat(calculateDistance(locationData.lat, locationData.lng, a.latitude, a.longitude));
    const distB = parseFloat(calculateDistance(locationData.lat, locationData.lng, b.latitude, b.longitude));
    return distA - distB;
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <ChevronLeft color={Colors.text} size={28} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Location & Safe Zones</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchLocation(); fetchSafeZones(); }} />}
      >
        
        {/* CURRENT LOCATION CARD */}
        <Text style={styles.sectionTitle}>My Current Location</Text>
        <View style={styles.locationCard}>
          <View style={styles.locationHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Navigation color={locationStatus === 'success' ? Colors.success : Colors.primary} size={24} />
              <Text style={styles.locationTitle}>GPS Status</Text>
            </View>
            <TouchableOpacity onPress={fetchLocation} disabled={locationStatus === 'loading'}>
              {locationStatus === 'loading' ? <ActivityIndicator size="small" color={Colors.primary} /> : <RefreshCw color={Colors.primary} size={20} />}
            </TouchableOpacity>
          </View>

          {locationStatus === 'error' ? (
            <Text style={styles.errorText}>{errorMsg}</Text>
          ) : locationStatus === 'success' && locationData ? (
            <>
              <Text style={styles.coordText}>Lat: {locationData.lat.toFixed(6)}</Text>
              <Text style={styles.coordText}>Lng: {locationData.lng.toFixed(6)}</Text>
              <Text style={styles.accuracyText}>Accuracy: ±{Math.round(locationData.accuracy)} meters</Text>
              
              <TouchableOpacity style={styles.mapBtn} onPress={() => openMaps(locationData.lat, locationData.lng)}>
                <MapPin color="#FFF" size={18} />
                <Text style={styles.mapBtnText}>Get Directions</Text>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.loadingText}>Fetching your location...</Text>
          )}
        </View>

        {/* SAFE ZONES LIST */}
        <Text style={[styles.sectionTitle, { marginTop: 30 }]}>Nearby Safe Zones</Text>
        
        {loadingZones ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} />
        ) : sortedZones.length === 0 ? (
          <View style={styles.emptyCard}>
            <ShieldCheck color={Colors.textMuted} size={40} />
            <Text style={styles.emptyTitle}>No Safe Zones Found</Text>
            <Text style={styles.emptyText}>Pull down to refresh.</Text>
          </View>
        ) : (
          sortedZones.map((zone) => {
            const distance = locationData 
              ? calculateDistance(locationData.lat, locationData.lng, zone.latitude, zone.longitude) 
              : null;

            return (
              <View key={zone.zone_id || zone.id} style={styles.zoneCard}>
                <View style={styles.zoneIconBox}>
                  <ShieldCheck color={Colors.success} size={24} />
                </View>
                <View style={styles.zoneInfo}>
                  <Text style={styles.zoneName}>{zone.name}</Text>
                  <Text style={styles.zoneType}>{zone.zone_type}</Text>
                  <Text style={styles.zoneAddress} numberOfLines={1}>{zone.address}</Text>
                </View>
                
                <View style={styles.zoneRight}>
                  {distance && (
                    <Text style={styles.distanceText}>{distance} km</Text>
                  )}
                  <TouchableOpacity onPress={() => openMaps(zone.latitude, zone.longitude)} style={styles.zoneMapBtn}>
                    <MapPin color={Colors.primary} size={20} />
                  </TouchableOpacity>
                </View>
              </View>
            )
          })
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: { padding: 5, marginLeft: -5 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: Colors.text },
  content: { padding: 20 },
  
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text, marginBottom: 15 },
  
  locationCard: { backgroundColor: Colors.card, padding: 20, borderRadius: 16, borderWidth: 1, borderColor: Colors.border },
  locationHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  locationTitle: { fontSize: 16, fontWeight: 'bold', color: Colors.text },
  coordText: { fontSize: 16, color: Colors.text, marginBottom: 5, fontFamily: 'monospace' },
  accuracyText: { fontSize: 13, color: Colors.textMuted, marginBottom: 15 },
  loadingText: { fontSize: 14, color: Colors.textMuted, fontStyle: 'italic' },
  errorText: { fontSize: 14, color: Colors.primary, lineHeight: 20 },
  
  mapBtn: { flexDirection: 'row', backgroundColor: Colors.primary, padding: 12, borderRadius: 10, justifyContent: 'center', alignItems: 'center', gap: 8 },
  mapBtnText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },

  emptyCard: { alignItems: 'center', backgroundColor: Colors.card, padding: 30, borderRadius: 16, borderWidth: 1, borderColor: Colors.border },
  emptyTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text, marginTop: 10 },
  emptyText: { fontSize: 13, color: Colors.textMuted, textAlign: 'center', marginTop: 5 },

  zoneCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, padding: 15, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: Colors.border },
  zoneIconBox: { width: 45, height: 45, borderRadius: 10, backgroundColor: '#ECFDF5', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  zoneInfo: { flex: 1, marginRight: 10 },
  zoneName: { fontSize: 15, fontWeight: 'bold', color: Colors.text, marginBottom: 2 },
  zoneType: { fontSize: 12, color: Colors.primary, fontWeight: '600', marginBottom: 2 },
  zoneAddress: { fontSize: 12, color: Colors.textMuted },
  
  zoneRight: { alignItems: 'center', gap: 5 },
  distanceText: { fontSize: 12, fontWeight: 'bold', color: Colors.success },
  zoneMapBtn: { padding: 8, backgroundColor: '#FEF2F2', borderRadius: 8 }
});