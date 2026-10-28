import { useRouter } from 'expo-router';
import {
    Activity,
    Bone,
    ChevronLeft,
    Droplets,
    Flame,
    HeartPulse,
    PhoneCall,
    ShieldAlert,
    Skull,
    Thermometer,
    Wind,
    Zap
} from 'lucide-react-native';
import { Linking, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors } from '../constants/colors';

// --- OFFLINE DATA ---
const FIRST_AID_GUIDES = [
  {
    id: 'cpr',
    title: 'CPR (Cardiopulmonary Resuscitation)',
    icon: HeartPulse,
    color: '#E63946',
    steps: [
      'Check the scene for safety before approaching.',
      'Check for responsiveness. Tap the person and shout, "Are you okay?"',
      'Call 10177 (Ambulance) or 112 immediately.',
      'Place the heel of your hand on the center of their chest.',
      'Push hard and fast (100-120 compressions per minute).',
      'If trained, give 2 rescue breaths after every 30 compressions.'
    ]
  },
  {
    id: 'heart_attack',
    title: 'Heart Attack / Stroke',
    icon: Activity,
    color: '#DC2626',
    steps: [
      'Call 10177 immediately. Note the time symptoms started.',
      'Have the person sit down, stay calm, and rest.',
      'If they have prescribed medication (like nitroglycerin), help them take it.',
      'If they are not allergic, give them one adult aspirin (300mg) to chew slowly.',
      'Monitor their breathing. If they become unresponsive, start CPR.',
      'For a stroke, remember F.A.S.T: Face drooping, Arm weakness, Speech difficulty, Time to call.'
    ]
  },
  {
    id: 'bleeding',
    title: 'Severe Bleeding',
    icon: Droplets,
    color: '#B91C1C',
    steps: [
      'Ensure your own safety and wear gloves if available.',
      'Apply firm, direct pressure to the wound with a clean cloth.',
      'Do not remove the cloth if it soaks through; add more layers on top.',
      'Elevate the injured limb above the heart if possible.',
      'Call 10177 immediately if bleeding does not stop.'
    ]
  },
  {
    id: 'burns',
    title: 'Burns',
    icon: Flame,
    color: '#EA580C',
    steps: [
      'Stop the burning process by removing the person from the source.',
      'Cool the burn with cool (not cold) running water for 20 minutes.',
      'Do NOT apply butter, ointments, or ice to the burn.',
      'Cover the burn loosely with a clean, non-stick dressing or plastic wrap.',
      'Seek medical attention for large, deep, or facial burns.'
    ]
  },
  {
    id: 'fractures',
    title: 'Fractures & Broken Bones',
    icon: Bone,
    color: '#6B7280',
    steps: [
      'Do not move the person unless they are in immediate danger.',
      'Immobilize the injured area. Do not try to straighten a broken bone.',
      'Apply a cold pack wrapped in a cloth to reduce swelling.',
      'If the bone is sticking out (open fracture), cover it with a sterile dressing.',
      'Call 10177 for transport, especially for suspected neck or spine injuries.'
    ]
  },
  {
    id: 'choking',
    title: 'Choking',
    icon: Wind,
    color: '#2563EB',
    steps: [
      'Ask the person, "Are you choking?" If they cannot speak, act immediately.',
      'Give 5 firm back blows between the shoulder blades.',
      'If unsuccessful, perform 5 abdominal thrusts (Heimlich maneuver).',
      'Alternate between 5 back blows and 5 abdominal thrusts.',
      'If the person becomes unresponsive, start CPR and call 10177.'
    ]
  },
  {
    id: 'seizures',
    title: 'Seizures (Epilepsy)',
    icon: Zap,
    color: '#D97706',
    steps: [
      'Stay calm. Time the seizure.',
      'Clear the area of hard or sharp objects to prevent injury.',
      'Place something soft (like a jacket) under their head.',
      'Do NOT hold them down and do NOT put anything in their mouth.',
      'Once the seizure stops, roll them onto their side (recovery position).',
      'Call 10177 if the seizure lasts longer than 5 minutes or if they do not wake up.'
    ]
  },
  {
    id: 'poisoning',
    title: 'Poisoning / Overdose',
    icon: Skull,
    color: '#4B5563',
    steps: [
      'Try to identify what was swallowed and how much.',
      'Do NOT induce vomiting unless a medical professional tells you to.',
      'If the person is unconscious or struggling to breathe, call 10177 immediately.',
      'Call the Poisons Information Helpline (0861 555 777) for guidance.',
      'Keep the container or a sample of the poison to show the paramedics.'
    ]
  },
  {
    id: 'shock',
    title: 'Shock (Post-Injury)',
    icon: Thermometer,
    color: '#059669',
    steps: [
      'Shock happens after severe injuries or blood loss. Look for pale skin, rapid pulse, and confusion.',
      'Lay the person down flat on their back.',
      'Elevate their legs slightly (about 30cm) to help blood flow to vital organs.',
      'Keep them warm with a blanket or jacket. Do not overheat them.',
      'Do not give them anything to eat or drink.',
      'Call 10177 and monitor their breathing until help arrives.'
    ]
  },
  {
    id: 'snakebite',
    title: 'Snake Bite',
    icon: ShieldAlert,
    color: '#65A30D',
    steps: [
      'Keep the person calm and still to slow the spread of venom.',
      'Keep the bitten limb below the level of the heart.',
      'Remove any tight clothing, rings, or watches near the bite.',
      'Do NOT cut the wound, suck out venom, or apply a tight tourniquet.',
      'Get the person to a hospital immediately. Try to remember the snake appearance.'
    ]
  }
];

export default function FirstAidScreen() {
  const router = useRouter();

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const callEmergency = () => {
    Linking.openURL('tel:10177');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <ChevronLeft color={Colors.text} size={28} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>First Aid Guide</Text>
        <View style={styles.spacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.subtitle}>
          Quick, offline instructions for life-threatening emergencies. Swipe down to read more.
        </Text>

        <TouchableOpacity style={styles.callBtn} onPress={callEmergency}>
          <PhoneCall color="#FFF" size={24} />
          <Text style={styles.callBtnText}>Call Ambulance (10177)</Text>
        </TouchableOpacity>

        {FIRST_AID_GUIDES.map((guide) => {
          const Icon = guide.icon;
          return (
            <View key={guide.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={[styles.iconContainer, { backgroundColor: `${guide.color}15` }]}>
                  <Icon color={guide.color} size={28} />
                </View>
                <Text style={styles.cardTitle}>{guide.title}</Text>
              </View>

              <View style={styles.stepsContainer}>
                {guide.steps.map((step, index) => (
                  <View key={index} style={styles.stepRow}>
                    <Text style={[styles.stepNumber, { color: guide.color }]}>
                      {index + 1}.
                    </Text>
                    <Text style={styles.stepText}>{step}</Text>
                  </View>
                ))}
              </View>
            </View>
          );
        })}
        
        <View style={styles.bottomSpacer} />
      </ScrollView>
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
  content: { padding: 20 },
  subtitle: { fontSize: 15, color: Colors.textMuted, marginBottom: 20, lineHeight: 22 },
  
  callBtn: {
    flexDirection: 'row',
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginBottom: 25,
  },
  callBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },

  card: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 18,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 15 },
  iconContainer: { padding: 10, borderRadius: 12 },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text, flex: 1 },
  
  stepsContainer: { gap: 10 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start' },
  stepNumber: { fontSize: 15, fontWeight: 'bold', width: 25, marginTop: 1 },
  stepText: { fontSize: 15, color: Colors.text, flex: 1, lineHeight: 22 },
  bottomSpacer: { height: 40 }
});