import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import {
  AlertTriangle,
  Car,
  CircleHelp,
  CloudLightning,
  Flame,
  HeartPulse,
  Search,
  Shield,
} from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ScreenBackButton } from '../components/screen-back-button';
import { Colors } from '../constants/colors';
import {
  createEmergencyReportId,
  saveOfflineEmergencyReport,
  sendEmergencyAlert,
  type EmergencyReport,
} from '../lib/emergency-alerts';
import { ensureProfile, supabase } from '../lib/supabase';


const EMERGENCY_TYPES = [
  { id: 'medical_emergency', label: 'Medical emergency', icon: HeartPulse },
  { id: 'accident_or_injury', label: 'Accident or injury', icon: Car },
  { id: 'crime_assault_or_robbery', label: 'Crime, assault or robbery', icon: Shield },
  { id: 'fire_or_explosion', label: 'Fire or explosion', icon: Flame },
  { id: 'dangerous_person_or_threat', label: 'Dangerous person or threat', icon: AlertTriangle },
  { id: 'missing_or_trapped_person', label: 'Missing or trapped person', icon: Search },
  { id: 'natural_disaster_or_severe_weather', label: 'Natural disaster or severe weather', icon: CloudLightning },
  { id: 'unsafe_situation_other', label: 'Unsafe situation / other', icon: CircleHelp },
];

const YES_NO_UNSURE = ['Yes', 'No', 'Not sure'] as const;

type EmergencyQuestion = {
  id: string;
  label: string;
  kind: 'choice' | 'text' | 'number';
  options?: readonly string[];
};

const MEDICAL_QUESTIONS: EmergencyQuestion[] = [
  { id: 'conscious', label: 'Is the person conscious?', kind: 'choice', options: YES_NO_UNSURE },
  { id: 'breathing', label: 'Is the person breathing normally?', kind: 'choice', options: YES_NO_UNSURE },
  { id: 'injury_symptoms', label: 'What type of injury or symptoms are visible?', kind: 'text' },
  { id: 'medical_people_count', label: 'How many people need medical assistance?', kind: 'number' },
  { id: 'severe_bleeding', label: 'Is there severe bleeding?', kind: 'choice', options: YES_NO_UNSURE },
  { id: 'allergies', label: 'Known allergies or relevant medical information (optional)', kind: 'text' },
];

const ACCIDENT_QUESTIONS: EmergencyQuestion[] = [
  { id: 'accident_kind', label: 'What happened?', kind: 'choice', options: ['Vehicle collision', 'Pedestrian accident', 'Fall', 'Other / not sure'] },
  { id: 'accident_people_count', label: 'How many vehicles or people are involved?', kind: 'text' },
  { id: 'serious_injury', label: 'Is anyone trapped, unconscious or seriously injured?', kind: 'choice', options: YES_NO_UNSURE },
  { id: 'traffic_hazard', label: 'Is the road blocked or is there an ongoing traffic hazard?', kind: 'choice', options: YES_NO_UNSURE },
  { id: 'landmark', label: 'What nearby landmark or road name can responders use?', kind: 'text' },
];

const CRIME_QUESTIONS: EmergencyQuestion[] = [
  { id: 'danger_nearby', label: 'Is the person causing danger still nearby?', kind: 'choice', options: YES_NO_UNSURE },
  { id: 'safe_place', label: 'Are you currently in a safe place?', kind: 'choice', options: YES_NO_UNSURE },
  { id: 'people_involved', label: 'How many people are involved, if known?', kind: 'number' },
  { id: 'weapon', label: 'Is a weapon visible or suspected?', kind: 'choice', options: YES_NO_UNSURE },
  { id: 'threat_behavior', label: 'Is the person following, threatening or preventing you from leaving?', kind: 'choice', options: YES_NO_UNSURE },
  { id: 'safe_to_call', label: 'Is it safe for emergency contacts to call you?', kind: 'choice', options: YES_NO_UNSURE },
];

const FIRE_QUESTIONS: EmergencyQuestion[] = [
  { id: 'fire_visible', label: 'Is there visible fire, smoke or an explosion?', kind: 'choice', options: YES_NO_UNSURE },
  { id: 'people_trapped', label: 'Is anyone trapped inside?', kind: 'choice', options: YES_NO_UNSURE },
  { id: 'fire_spreading', label: 'Is the fire spreading?', kind: 'choice', options: YES_NO_UNSURE },
  { id: 'fire_location', label: 'Where is the emergency?', kind: 'choice', options: ['Inside a building', 'In a vehicle', 'Outdoors', 'Not sure'] },
  { id: 'hazardous_material', label: 'Is there a known gas leak or hazardous material?', kind: 'choice', options: YES_NO_UNSURE },
];

const MISSING_DISASTER_QUESTIONS: EmergencyQuestion[] = [
  { id: 'missing_trapped', label: 'Is someone missing, trapped or separated from the group?', kind: 'choice', options: YES_NO_UNSURE },
  { id: 'people_need_help', label: 'How many people need help?', kind: 'number' },
  { id: 'last_seen', label: 'When and where were they last seen, if known?', kind: 'text' },
  { id: 'environmental_hazard', label: 'Is there flooding, structural damage, dangerous weather or another hazard?', kind: 'choice', options: YES_NO_UNSURE },
  { id: 'hazard_details', label: 'Describe any known hazards, if applicable', kind: 'text' },
  { id: 'access_point', label: 'What is the safest known access point?', kind: 'text' },
];

const OTHER_QUESTIONS: EmergencyQuestion[] = [
  { id: 'immediate_danger', label: 'Is anyone in immediate danger?', kind: 'choice', options: YES_NO_UNSURE },
  { id: 'other_hazard', label: 'What is happening and what help is needed?', kind: 'text' },
];

function getEmergencyQuestions(type: string): EmergencyQuestion[] {
  switch (type) {
    case 'medical_emergency':
      return MEDICAL_QUESTIONS;
    case 'accident_or_injury':
      return [...MEDICAL_QUESTIONS, ...ACCIDENT_QUESTIONS];
    case 'crime_assault_or_robbery':
    case 'dangerous_person_or_threat':
      return CRIME_QUESTIONS;
    case 'fire_or_explosion':
      return FIRE_QUESTIONS;
    case 'missing_or_trapped_person':
    case 'natural_disaster_or_severe_weather':
      return MISSING_DISASTER_QUESTIONS;
    case 'unsafe_situation_other':
      return OTHER_QUESTIONS;
    default:
      return [];
  }
}

export default function RiskDetectorScreen() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState('');
  const [questionAnswers, setQuestionAnswers] = useState<Record<string, string>>({});
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);

  const emergencyQuestions = getEmergencyQuestions(selectedType);
  const reportDescription = [
    description.trim(),
    ...emergencyQuestions
      .filter((question) => questionAnswers[question.id]?.trim())
      .map((question) => `${question.label}: ${questionAnswers[question.id].trim()}`),
  ].filter(Boolean).join('\n');

  async function analyzeEmergency(reportId: string, type: string, details: string) {
    try {
      const { data, error } = await supabase.functions.invoke('analyze-emergency', {
        body: { description: details, type },
      });
      if (error) throw error;
      if (!data || typeof data.severity !== 'string' || typeof data.advice !== 'string') {
        throw new Error('AI analysis returned an invalid response.');
      }

      const { error: updateError } = await supabase
        .from('emergency_reports')
        .update({ risk_level: data.severity, ai_summary: data.advice })
        .eq('id', reportId);
      if (updateError) throw updateError;

      setAiResult(data);
    } catch (error) {
      console.error('Emergency alert was sent, but AI analysis could not be completed:', error);
    }
  }

  async function handleSubmit() {
    if (!selectedType) {
      Alert.alert('Missing Info', 'Please select the type of emergency.');
      return;
    }
    
    setIsSubmitting(true);
    setAiResult(null);

    try {
      let latitude = null;
      let longitude = null;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({});
          latitude = location.coords.latitude;
          longitude = location.coords.longitude;
        }
      } catch (error) {
        console.error('Could not get emergency location; continuing without it:', error);
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !session.user) {
        throw new Error('No user session found. Please log out and log in again.');
      }
      try {
        await ensureProfile(session.user);
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (!/network|failed to fetch|fetch failed|offline|connection|timed out/i.test(message)) {
          throw error;
        }
        console.error('Could not verify the profile while offline; the alert will be queued locally:', error);
      }

      const report: EmergencyReport = {
        id: createEmergencyReportId(),
        user_id: session.user.id,
        incident_type: selectedType,
        description: reportDescription,
        latitude,
        longitude,
        risk_level: 'Pending',
        ai_summary: 'AI analysis is pending.',
        status: 'Active',
        delivery_status: 'sending',
        delivery_details: 'Contacting your emergency contacts.',
        created_at: new Date().toISOString(),
      };

      const { data: reportData, error: dbError } = await supabase
        .from('emergency_reports')
        .insert(report)
        .select()
        .single();

      if (dbError) {
        if (!/network|failed to fetch|fetch failed|offline|connection|timed out/i.test(dbError.message)) {
          throw dbError;
        }
        const offlineReport: EmergencyReport = {
          ...report,
          delivery_status: 'saved_offline',
          delivery_details: 'Saved on this device. Open or refresh the Alert tab while online to send it.',
        };
        await saveOfflineEmergencyReport(offlineReport);
        Alert.alert(
          'Alert saved offline',
          'Your alert is saved on this device. Open or refresh the Alert tab while online to send it.',
          [{ text: 'View alert status', onPress: () => router.push('/(tabs)/alerts') }],
        );
        return;
      }

      if (!reportData) throw new Error('The emergency report was not returned after saving.');
      const savedReport: EmergencyReport = { ...report, ...reportData };
      void analyzeEmergency(savedReport.id, selectedType, reportDescription);
      try {
        const delivery = await sendEmergencyAlert(savedReport);
        Alert.alert(
          delivery.delivery_status === 'sent' ? 'Alert sent' : 'Alert saved',
          delivery.delivery_details,
          [{ text: 'View alert status', onPress: () => router.push('/(tabs)/alerts') }],
        );
      } catch (error) {
        console.error('Emergency report was saved, but delivery failed:', error);
        Alert.alert(
          'Alert saved; delivery needs attention',
          error instanceof Error
            ? `Your report is saved, but your contacts could not be notified: ${error.message}`
            : 'Your report is saved, but your contacts could not be notified. Check the Alert tab for its status.',
          [{ text: 'View alert status', onPress: () => router.push('/(tabs)/alerts') }],
        );
      }
    } catch (error) {
      console.error('Failed to submit emergency alert:', error);
      Alert.alert('Error', error instanceof Error ? error.message : 'Something went wrong.');
    } finally {
      setIsSubmitting(false);
    }
  }
  
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <ScreenBackButton />
        <Text style={styles.title}>Risk Detector</Text>
        <View style={{ width: 28 }} />
      </View>

      <Text style={styles.label}>What is the emergency?</Text>
      <View style={styles.grid}>
        {EMERGENCY_TYPES.map((type) => {
          const Icon = type.icon;
          const isSelected = selectedType === type.id;
          return (
            <TouchableOpacity
              key={type.id}
              style={[styles.typeCard, isSelected && styles.typeCardSelected]}
              onPress={() => {
                setSelectedType(type.id);
                setQuestionAnswers({});
                setAiResult(null);
              }}
            >
              <Icon color={isSelected ? Colors.background : Colors.text} size={24} />
              <Text style={[styles.typeText, isSelected && styles.typeTextSelected]}>{type.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {emergencyQuestions.length > 0 && (
        <View style={styles.questionsCard}>
          <Text style={styles.questionsTitle}>A few optional questions</Text>
          <Text style={styles.questionsNotice}>
            You can send the alert without answering. Do not delay seeking emergency help; AI guidance is not a substitute for a medical professional.
          </Text>
          {selectedType === 'crime_assault_or_robbery' || selectedType === 'dangerous_person_or_threat' ? (
            <Text style={styles.safetyNotice}>
              Do not confront, follow or approach anyone. If it is unsafe to speak, leave questions unanswered.
            </Text>
          ) : null}
          {emergencyQuestions.map((question) => (
            <View key={question.id} style={styles.question}>
              <Text style={styles.questionLabel}>{question.label}</Text>
              {question.kind === 'choice' ? (
                <View style={styles.answerOptions}>
                  {question.options?.map((option) => {
                    const isSelected = questionAnswers[question.id] === option;
                    return (
                      <TouchableOpacity
                        key={option}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        style={[styles.answerOption, isSelected && styles.answerOptionSelected]}
                        onPress={() => setQuestionAnswers((answers) => ({ ...answers, [question.id]: option }))}
                      >
                        <Text style={[styles.answerOptionText, isSelected && styles.answerOptionTextSelected]}>
                          {option}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <TextInput
                  style={styles.answerInput}
                  placeholder={question.kind === 'number' ? 'Enter a number, if known' : 'Optional'}
                  placeholderTextColor={Colors.textMuted}
                  keyboardType={question.kind === 'number' ? 'number-pad' : 'default'}
                  value={questionAnswers[question.id] ?? ''}
                  onChangeText={(answer) => setQuestionAnswers((answers) => ({ ...answers, [question.id]: answer }))}
                  maxLength={question.kind === 'number' ? 4 : 200}
                />
              )}
            </View>
          ))}
        </View>
      )}

      <Text style={styles.label}>Describe the situation</Text>
      <TextInput style={styles.input} placeholder="E.g., A stranded person collapsed and is unconscious..." placeholderTextColor={Colors.textMuted} multiline numberOfLines={4} maxLength={500} value={description} onChangeText={setDescription} />

      <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={isSubmitting}>
        {isSubmitting ? (
          <ActivityIndicator color={Colors.text} />
        ) : (
          <Text style={styles.submitText}>REPORT EMERGENCY & SEND ALERT</Text>
        )}
      </TouchableOpacity>

      {aiResult && (
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>AI Analysis</Text>
          <View style={styles.severityRow}>
            <Text style={styles.resultLabel}>Severity:</Text>
            <Text style={[styles.severityText, { color: aiResult.severity === 'Critical' || aiResult.severity === 'High' ? Colors.primary : Colors.success }]}>
              {aiResult.severity}
            </Text>
          </View>
          <Text style={styles.adviceText}>{aiResult.advice}</Text>
          <Text style={styles.instructionTitle}>Action Steps:</Text>
          {aiResult.instructions?.map((step: string, index: number) => (
            <Text key={index} style={styles.instructionText}>• {step}</Text>
          ))}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => router.push('/(tabs)/alerts')}
            accessibilityRole="button"
            accessibilityLabel="Close analysis and view alerts"
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 30 },
  title: { fontSize: 22, fontWeight: 'bold', color: Colors.text },
  label: { fontSize: 16, color: Colors.textMuted, marginBottom: 15, fontWeight: '600' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 30 },
  typeCard: { width: '23.5%', minHeight: 120, backgroundColor: Colors.card, paddingHorizontal: 4, paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'flex-start', marginBottom: 12 },
  typeCardSelected: { backgroundColor: Colors.primary },
  typeText: { color: Colors.text, marginTop: 6, fontSize: 11, lineHeight: 14, fontWeight: '600', textAlign: 'center' },
  typeTextSelected: { color: Colors.background },
  questionsCard: { backgroundColor: Colors.card, padding: 16, borderRadius: 16, marginBottom: 30 },
  questionsTitle: { color: Colors.text, fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  questionsNotice: { color: Colors.textMuted, fontSize: 13, lineHeight: 19, marginBottom: 16 },
  safetyNotice: { color: Colors.primary, fontSize: 13, lineHeight: 19, fontWeight: '600', marginBottom: 16 },
  question: { marginBottom: 16 },
  questionLabel: { color: Colors.text, fontSize: 14, fontWeight: '600', marginBottom: 8 },
  answerOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  answerOption: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, borderWidth: 1, borderColor: Colors.border },
  answerOptionSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  answerOptionText: { color: Colors.text, fontSize: 13 },
  answerOptionTextSelected: { color: '#FFF' },
  answerInput: { backgroundColor: Colors.background, color: Colors.text, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, fontSize: 14 },
  input: { backgroundColor: Colors.card, color: Colors.text, padding: 15, borderRadius: 16, fontSize: 16, minHeight: 120, textAlignVertical: 'top', marginBottom: 30 },
  submitButton: { backgroundColor: Colors.primary, padding: 20, borderRadius: 16, alignItems: 'center' },
  submitText: { color: Colors.text, fontSize: 18, fontWeight: 'bold' },
  resultCard: { backgroundColor: Colors.card, padding: 20, borderRadius: 16, marginTop: 20, borderWidth: 1, borderColor: Colors.primary },
  resultTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text, marginBottom: 15 },
  severityRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  resultLabel: { color: Colors.textMuted, fontSize: 16, marginRight: 10 },
  severityText: { fontSize: 18, fontWeight: 'bold' },
  adviceText: { color: Colors.text, fontSize: 16, marginBottom: 15, fontStyle: 'italic' },
  instructionTitle: { fontSize: 16, fontWeight: 'bold', color: Colors.text, marginBottom: 10 },
  instructionText: { color: Colors.textMuted, fontSize: 15, marginBottom: 5, lineHeight: 22 },
  closeButton: { backgroundColor: Colors.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center', marginTop: 20 },
  closeButtonText: { color: Colors.text, fontSize: 16, fontWeight: 'bold' },
});