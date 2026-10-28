import { Link, Tabs } from 'expo-router';
import { AlertCircle, Bell, Home, MapPin, Phone, User } from 'lucide-react-native';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../../constants/colors';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: Colors.card, height: 120 },
        headerTintColor: Colors.text,
        headerTitle: '',
        headerLeft: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 15 }}>
            <Image
              source={require('../../../assets/yaho-logo.png')}
              style={{ height: 80, width: 80, marginRight: 15 }} 
              resizeMode="contain"
            />
            <View style={{ justifyContent: 'center' }}>
              <Text style={{ fontFamily: 'Xelio BC', fontSize: 67, color: Colors.primary, lineHeight: 70, includeFontPadding: false }}>
                Yahoo
              </Text>
              <Text style={{ fontFamily: 'Quadra BC', fontSize: 34, color: Colors.text, marginTop: -15, lineHeight: 40, includeFontPadding: false }}>
                Alert Batho
              </Text>
            </View>
          </View>
        ),
        headerRight: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15, marginRight: 15 }}>
            <Link href="/network" asChild>
              <TouchableOpacity style={{ padding: 5 }} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                <Phone color={Colors.text} size={24} />
              </TouchableOpacity>
            </Link>
            <Link href="/messages" asChild>
              <TouchableOpacity style={{ padding: 5 }} hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}>
                <Bell color={Colors.text} size={26} />
              </TouchableOpacity>
            </Link>
          </View>
        ),
        tabBarStyle: {
          backgroundColor: Colors.card,
          borderTopColor: Colors.border,
          height: 70,
          paddingBottom: 10,
          paddingTop: 10,
        },
        tabBarItemStyle: {
          flex: 1, // This will now perfectly divide the 4 tabs!
          alignItems: 'center',
          justifyContent: 'center',
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600', marginTop: 4 },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color }) => <Home color={color} size={24} /> }} />
            <Tabs.Screen 
        name="alerts" 
        options={{ 
          title: 'Reports', 
          tabBarIcon: ({ color }) => <AlertCircle color={color} size={24} />,
          headerShown: false, // <--- ADD THIS LINE
        }} 
      />
      <Tabs.Screen name="location" options={{ title: 'Location', tabBarIcon: ({ color }) => <MapPin color={color} size={24} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color }) => <User color={color} size={24} /> }} />
    </Tabs>
  );
}